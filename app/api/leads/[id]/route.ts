import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import Lead from '@/models/Lead';
import { LEAD_STATUSES } from '@/types/lead';
import User from '@/models/User';
import { serializeLead } from '@/lib/leads';

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

  // Agents may only access leads assigned to them
  if (session.user.role !== 'Admin') {
    const assignedId =
      typeof lead.assignedTo === 'object' && lead.assignedTo !== null
        ? (lead.assignedTo as { _id: { toString(): string } })._id.toString()
        : String(lead.assignedTo);
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

  return NextResponse.json({
    lead: serializeLead(result.lead.toObject() as Parameters<typeof serializeLead>[0]),
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const result = await loadAndAuthorize(id, session);
  if (result.error) return result.error;

  try {
    const body = await req.json();
    const allowed = [
      'name',
      'email',
      'phone',
      'propertyInterest',
      'budget',
      'status',
      'notes',
      'score',
    ] as const;

    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body && body[key] !== undefined) updates[key] = body[key];
    }

    if (updates.status && !LEAD_STATUSES.includes(updates.status as never)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    if (updates.budget != null) updates.budget = Number(updates.budget);
    if (updates.score != null) updates.score = Number(updates.score);

    // Only admins can reassign leads
    if (session.user.role === 'Admin' && body.assignedTo) {
      if (!isValidId(body.assignedTo)) {
        return NextResponse.json({ error: 'Invalid assignedTo id' }, { status: 400 });
      }
      updates.assignedTo = body.assignedTo;
    }

    const updated = await Lead.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).populate({ path: 'assignedTo', model: User, select: 'name email' });

    if (!updated) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({
      lead: serializeLead(updated.toObject() as Parameters<typeof serializeLead>[0]),
    });
  } catch (err) {
    console.error('[LEADS_PATCH]', err);
    const message = err instanceof Error ? err.message : 'Failed to update lead';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden: only Admins can delete leads' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const result = await loadAndAuthorize(id, session);
  if (result.error) return result.error;

  await Lead.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
