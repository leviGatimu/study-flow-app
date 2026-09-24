import { redirect } from 'next/navigation';
import Link from 'next/link';
import { FolderKanban } from 'lucide-react';

import { getProjects } from '@/lib/project-actions';
import { getUserId } from '@/lib/auth';
import { ProjectWithDocs } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ProjectList } from './ProjectList';
import { DialogTriggerButton } from './DialogTriggerButton';

export const dynamic = 'force-dynamic';

const DESCRIPTION = 'Longer pieces of coursework, each with its own docs and progress.';

export default async function ProjectsPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  let projects: ProjectWithDocs[];
  try {
    projects = (await getProjects()) as ProjectWithDocs[];
  } catch (error) {
    console.error('Projects page failed to load', error);
    return (
      <Page>
        <PageHeader title="Projects" description={DESCRIPTION} />
        <PageBody>
          <ErrorState
            title="Your projects could not be loaded"
            description="Check your connection and try again."
            action={
              <Button asChild variant="outline">
                <Link href="/projects">Try again</Link>
              </Button>
            }
          />
        </PageBody>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Projects"
        description={DESCRIPTION}
        highlight={{ label: 'Projects', value: projects.length }}
        actions={<DialogTriggerButton size="lg" />}
      />
      <PageBody>
        {projects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban />}
            title="No projects yet"
            description="Create one for coursework that takes more than a sitting: plan it in docs and track how far along it is."
            action={<DialogTriggerButton />}
          />
        ) : (
          <ProjectList initialProjects={projects} />
        )}
      </PageBody>
    </Page>
  );
}
