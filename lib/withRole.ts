import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from './auth';

type Role = 'Admin' | 'Agent';

/**
 * Call at the top of a Server Component or Route Handler to enforce role access.
 * Redirects to /login if unauthenticated, or /unauthorized if wrong role.
 *
 * Usage:
 *   const session = await requireRole('Admin');
 */
export async function requireRole(...allowedRoles: Role[]) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(session.user.role as Role)) {
    redirect('/unauthorized');
  }

  return session;
}

/** Convenience wrappers */
export const requireAdmin = () => requireRole('Admin');
export const requireAgent = () => requireRole('Admin', 'Agent');
export const requireAuth = () => requireRole();
