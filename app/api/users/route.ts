import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';

/**
 * Returns a list of users — used by the lead-assignment dropdown.
 * Admin only.
 *   GET /api/users           → all users (id/name/email/role)
 *   GET /api/users?role=Agent → filtered by role
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const roleParam = req.nextUrl.searchParams.get('role');
  const filter: { role?: 'Admin' | 'Agent' } = {};
  if (roleParam === 'Admin' || roleParam === 'Agent') {
    filter.role = roleParam;
  }

  await connectDB();
  const users = await User.find(filter).select('name email role').lean();

  return NextResponse.json({
    users: users.map((u) => ({
      _id: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
    })),
  });
}
