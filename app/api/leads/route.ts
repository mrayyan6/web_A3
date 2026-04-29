import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import Lead from '@/models/Lead';
import { LEAD_STATUSES } from '@/types/lead';
import User from '@/models/User';
import { serializeLead } from '@/lib/leads';
import { computePriority, computeScore } from '@/lib/scoring';
import { sendNewLeadEmail } from '@/lib/email';
import ActivityLog from '@/models/ActivityLog';
import { recordActivity } from '@/lib/activity';
import mongoose from 'mongoose';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();

  // Agents see only their assigned leads; Admins see all
  const filter =
    session.user.role === 'Admin' ? {} : { assignedTo: session.user.id };

  const leads = await Lead.find(filter)
    .populate({ path: 'assignedTo', model: User, select: 'name email' })
    .sort({ createdAt: -1 })
    .lean();

  // Attach lastActivityAt for each lead (most recent activity)
  const leadIds = leads.map((l) => (l._id ? (typeof l._id === 'string' ? new mongoose.Types.ObjectId(l._id) : l._id) : null)).filter(Boolean);
  const activityMap: Record<string, string> = {};
  if (leadIds.length > 0) {
    const ag = await ActivityLog.aggregate([
      { $match: { leadId: { $in: leadIds } } },
      { $group: { _id: '$leadId', last: { $max: '$createdAt' } } },
    ]);
    for (const a of ag) {
    activityMap[String(a._id)] = a.last ? new Date(a.last).toISOString() : "";    }
  }

  const serialized = leads.map((l) => {
    const s = serializeLead(l as Parameters<typeof serializeLead>[0]);
    s.lastActivityAt = activityMap[s._id] ?? null;
    // compute overdue followup flag in client via lastActivityAt and followUpDate if needed
    return s;
  });

  return NextResponse.json({ leads: serialized });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden: only Admins can create leads' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, email, phone, propertyInterest, budget, status, notes, assignedTo, followUpDate } = body;

    if (!name || !email || !phone || !propertyInterest || budget == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (status && !LEAD_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const budgetNum = Number(budget);

    // Auto-compute priority and score from budget — cannot be overridden by caller
    const priority = computePriority(budgetNum);
    const score = computeScore(budgetNum);

    // Admins may create unassigned leads (assignedTo = null)
    const finalAssignedTo = assignedTo || null;

    await connectDB();

    const lead = await Lead.create({
      name,
      email,
      phone,
      propertyInterest,
      budget: budgetNum,
      status: status ?? 'New',
      notes: notes ?? '',
      assignedTo: finalAssignedTo,
      priority,
      score,
      followUpDate: followUpDate ? new Date(followUpDate) : null,
    });

    const populated = await lead.populate({
      path: 'assignedTo',
      model: User,
      select: 'name email',
    });

    const serialized = serializeLead(populated.toObject() as Parameters<typeof serializeLead>[0]);

    // Record activity: created
    try {
      await recordActivity(serialized, 'created', session.user.id, { budget: budgetNum });
      if (followUpDate) {
        await recordActivity(serialized, 'followup_set', session.user.id, { followUpDate });
      }
      // mark lastActivityAt as now since we just recorded activity
      serialized.lastActivityAt = new Date().toISOString();
    } catch (e) {
      // ignore
    }

    // Notify all admins in background — don't block the response
    User.find({ role: 'Admin' }).select('email').lean().then((admins) => {
      const emails = admins.map((a) => String(a.email)).filter(Boolean);
      sendNewLeadEmail(serialized, emails).catch(() => {});
    }).catch(() => {});

    return NextResponse.json({ lead: serialized }, { status: 201 });
  } catch (err) {
    console.error('[LEADS_POST]', err);
    const message = err instanceof Error ? err.message : 'Failed to create lead';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
