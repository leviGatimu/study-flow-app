import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAdminConsole, isCurrentUserAdmin } from '@/lib/admin-actions';
import { AdminDashboard } from './AdminDashboard';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  if (!(await isCurrentUserAdmin())) notFound();
  const { source } = await searchParams;
  try {
    const report = await getAdminConsole(source === 'device');
    return <AdminDashboard {...report} />;
  } catch (error) {
    return (
      <Page>
        <PageHeader
          title="Admin console"
          description="Accounts, study activity and service health."
        />
        <PageBody>
          <ErrorState
            title="Current admin reports are unavailable"
            description={
              error instanceof Error
                ? error.message
                : 'Try refreshing in a moment.'
            }
          />
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/admin">Retry server report</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/admin?source=device">View this device only</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/settings?tab=sync">Sync settings</Link>
            </Button>
          </div>
        </PageBody>
      </Page>
    );
  }
}
