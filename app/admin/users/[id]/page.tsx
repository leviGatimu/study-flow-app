import { notFound } from 'next/navigation';

import { getAdminUser, isCurrentUserAdmin } from '@/lib/admin-actions';
import { AdminUserView } from './AdminUserView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isCurrentUserAdmin())) notFound();

  const { id } = await params;
  const user = await getAdminUser(id);
  if (!user) notFound();

  return <AdminUserView user={user} />;
}
