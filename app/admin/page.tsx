import { notFound } from 'next/navigation';

import {
  getAdminOverview,
  getAdminUsers,
  getSystemHealth,
  isCurrentUserAdmin,
} from '@/lib/admin-actions';
import { AdminDashboard } from './AdminDashboard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * The admin console.
 *
 * notFound() rather than a redirect for a non-admin: a redirect to the
 * dashboard confirms the route exists and that they simply lack the rights,
 * which is a small thing to hand a curious account. A 404 says nothing.
 *
 * The guard here is convenience, not security. Every action in lib/admin-actions
 * re-checks admin rights on its own, because a server action is an endpoint
 * anyone can call directly regardless of which page they can open.
 */
export default async function AdminPage() {
  if (!(await isCurrentUserAdmin())) notFound();

  const [overview, users, health] = await Promise.all([
    getAdminOverview(),
    getAdminUsers(),
    getSystemHealth(),
  ]);

  return <AdminDashboard overview={overview} users={users} health={health} />;
}
