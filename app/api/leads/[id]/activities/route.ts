import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import ActivityLog from '@/models/ActivityLog';
import mongoose from 'mongoose';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  await connectDB();

  const items = await ActivityLog.find({ leadId: id }).sort({ createdAt: -1 }).lean();

  return NextResponse.json({ activities: items });
}
