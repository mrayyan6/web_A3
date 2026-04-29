import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import Lead from '@/models/Lead';
import { LEAD_STATUSES } from '@/types/lead';
import User from '@/models/User';
import { serializeLead } from '@/lib/leads';
import { computePriority, computeScore } from '@/lib/scoring';
import { recordActivity } from '@/lib/activity';
import { sendLeadAssignedEmail } from '@/lib/email';

type Ctx = { params: Promise<{ id: string }> };

function isValidId(id: string) {
  return mongoose.Types.ObjectId.isValid(id);
}

async function loadAndAuthorize(id: string, session: { user: { id: string; role: string } }) {
  if (!isValidId(id)) {
    return { error: NextResponse.json({ error: 'Invalid lead id' }, { status: 400 }) };
  }
  await connectDB();
  const lead = await Lead.findById(id).populate({
    path: 'assignedTo',
    model: User,
    select: 'name email',
  });
  if (!lead) {
    return { error: NextResponse.json({ error: 'Lead not found' }, { status: 404 }) };
  }

  if (session.user.role !== 'Admin') {
    const assignedId =
      lead.assignedTo && typeof lead.assignedTo === 'object' && '_id' in lead.assignedTo
        ? (lead.assignedTo as { _id: { toString(): string } })._id.toString()
        : lead.assignedTo
        ? String(lead.assignedTo)
        : null;

    if (assignedId !== session.user.id) {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }
  }

  return { lead };
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const result = await loadAndAuthorize(id, session);
  if (result.error) return result.error;

  return NextResponse.json({ lead: serializeLead(result.lead.toObject() as Parameters<typeof serializeLead>[0]) });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const result = await loadAndAuthorize(id, session);
  if (result.error) return result.error;

  try {
    const body = await req.json();
    const allowed = ['name', 'email', 'phone', 'propertyInterest', 'budget', 'status', 'notes'] as const;

    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body && body[key] !== undefined) updates[key] = body[key];
    }

    if (updates.status && !LEAD_STATUSES.includes(updates.status as never)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // When budget changes, auto-recompute priority and score
    if (updates.budget != null) {
      const newBudget = Number(updates.budget);
      updates.budget = newBudget;
      updates.priority = computePriority(newBudget);
      updates.score = computeScore(newBudget);
    }

    // followUpDate handling
    if ('followUpDate' in body) {
      if (body.followUpDate === null || body.followUpDate === '') {
        updates.followUpDate = null;
      } else {
        updates.followUpDate = new Date(body.followUpDate);
      }
    }

    // Only Admins can change assignedTo
    if (session.user.role === 'Admin' && 'assignedTo' in body) {
      const incoming = body.assignedTo;
      if (incoming === null || incoming === '') {
        updates.assignedTo = null;
      } else if (isValidId(String(incoming))) {
        updates.assignedTo = incoming;
      } else {
        return NextResponse.json({ error: 'Invalid assignedTo id' }, { status: 400 });
      }
    }

    const updated = await Lead.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).populate({
      path: 'assignedTo',
      model: User,
      select: 'name email',
    });

    if (!updated) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const serialized = serializeLead(updated.toObject() as Parameters<typeof serializeLead>[0]);

    // Notify assigned agent in background
    if (session.user.role === 'Admin' && 'assignedTo' in body && body.assignedTo && body.assignedTo !== '') {
      const agent = updated.assignedTo as { name: string; email: string } | null;
      if (agent && typeof agent === 'object' && 'email' in agent) {
        sendLeadAssignedEmail(serialized, agent.email, agent.name).catch(() => {});
      }
    }

    // Record activity entries for changes
    try {
      // status change
      if (updates.status) {
        await recordActivity(serialized, 'status_changed', session.user.id, { newStatus: updates.status });
      }
      // assignment change
      if ('assignedTo' in body) {
        const wasAssigned = (result.lead.assignedTo && String((result.lead.assignedTo as any)._id)) || result.lead.assignedTo || null;
        const nowAssigned = updates.assignedTo ?? null;
        if (nowAssigned && !wasAssigned) {
          await recordActivity(serialized, 'assigned', session.user.id, { assignedTo: nowAssigned });
        } else if (nowAssigned && wasAssigned && String(nowAssigned) !== String(wasAssigned)) {
          await recordActivity(serialized, 'reassigned', session.user.id, { from: wasAssigned, to: nowAssigned });
        } else if (!nowAssigned && wasAssigned) {
          await recordActivity(serialized, 'assigned', session.user.id, { assignedTo: null });
        }
      }
      // notes change
      if ('notes' in updates) {
        await recordActivity(serialized, 'notes_updated', session.user.id, { notes: updates.notes });
      }
      // follow-up change
      if ('followUpDate' in updates) {
        if (updates.followUpDate) {
          await recordActivity(serialized, 'followup_set', session.user.id, { followUpDate: updates.followUpDate });
        } else {
          await recordActivity(serialized, 'followup_cleared', session.user.id, {});
        }
      }

      // update lastActivityAt
      serialized.lastActivityAt = new Date().toISOString();
    } catch (e) {
      // ignore activity errors
    }

    return NextResponse.json({ lead: serialized });
  } catch (err) {
    console.error('[LEADS_PATCH]', err);
    const message = err instanceof Error ? err.message : 'Failed to update lead';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'Admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await ctx.params;
  if (!isValidId(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  await connectDB();
  await Lead.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
