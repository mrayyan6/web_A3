import { requireAuth } from '@/lib/withRole';
import DashboardHeader from './DashboardHeader';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        userName={session.user.name ?? session.user.email ?? 'User'}
        role={session.user.role}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
