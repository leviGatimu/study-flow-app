import { notFound } from 'next/navigation';
import {
  getAdminUser,
  getAdminSource,
  isCurrentUserAdmin,
} from '@/lib/admin-actions';
import { AdminUserView } from './AdminUserView';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export default async function AdminUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ source?: string }>;
}) {
  if (!(await isCurrentUserAdmin())) notFound();
  const [{ id }, { source: mode }] = await Promise.all([params, searchParams]);
  const [user, source] = await Promise.all([
    getAdminUser(id, mode === 'device'),
    getAdminSource(mode === 'device'),
  ]);
  if (!user) notFound();
  return <AdminUserView user={user} source={source} />;
}
