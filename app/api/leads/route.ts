import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import Lead from '@/models/Lead';
import { LEAD_STATUSES } from '@/types/lead';
import User from '@/models/User';
import { serializeLead } from '@/lib/leads';
import { computePriority, computeScore } from '@/lib/scoring';

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

  return NextResponse.json({
    leads: leads.map((l) => serializeLead(l as Parameters<typeof serializeLead>[0])),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden: only Admins can create leads' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, email, phone, propertyInterest, budget, status, notes, assignedTo } = body;

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
    });

    const populated = await lead.populate({
      path: 'assignedTo',
      model: User,
      select: 'name email',
    });

    return NextResponse.json(
      { lead: serializeLead(populated.toObject() as Parameters<typeof serializeLead>[0]) },
      { status: 201 }
    );
  } catch (err) {
    console.error('[LEADS_POST]', err);
    const message = err instanceof Error ? err.message : 'Failed to create lead';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
