import { requireAuth } from '@/lib/withRole';
import connectDB from '@/lib/mongoose';
import Lead from '@/models/Lead';
import User from '@/models/User';
import { serializeLead } from '@/lib/leads';
import LeadsView from './LeadsView';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await requireAuth();
  await connectDB();

  const filter = session.user.role === 'Admin' ? {} : { assignedTo: session.user.id };

  const leadDocs = await Lead.find(filter)
    .populate({ path: 'assignedTo', model: User, select: 'name email' })
    .sort({ createdAt: -1 })
    .lean();

  const initialLeads = leadDocs.map((l) =>
    serializeLead(l as Parameters<typeof serializeLead>[0])
  );

  // Admins need the agent list to assign leads
  let agents: { _id: string; name: string; email: string }[] = [];
  if (session.user.role === 'Admin') {
    const users = await User.find({ role: 'Agent' }).select('name email').lean();
    agents = users.map((u) => ({
      _id: String(u._id),
      name: u.name,
      email: u.email,
    }));
  }

  return (
    <LeadsView
      initialLeads={initialLeads}
      role={session.user.role}
      currentUserId={session.user.id}
      agents={agents}
    />
  );
}
