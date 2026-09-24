import { redirect } from 'next/navigation';
import Link from 'next/link';

import { getUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { listSubjects } from '@/lib/subject-actions';
import { getStudySet, listStudySets, type StudySetDetail } from '@/lib/study-actions';
import { Button } from '@/components/ui/button';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/error-state';
import { StudyGenerator } from './StudyGenerator';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Practice.
 *
 * One thing: turn a document into questions and answer them. The five-mode chat
 * that lived here was removed - it was a chatbot in a study app rather than a
 * study tool, and a student with a chapter to revise wanted to be tested, not
 * to have a conversation about being tested.
 *
 * Other pages link in with two parameters:
 *   ?set=<id>        open that practice set
 *   ?subject=<name>  open the generator with that subject chosen
 */
export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string; subject?: string }>;
}) {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const params = await searchParams;
  const setId = typeof params.set === 'string' ? params.set.trim() : '';
  const subject = typeof params.subject === 'string' ? params.subject.trim() : '';

  let data: {
    sets: Awaited<ReturnType<typeof listStudySets>>;
    subjects: string[];
    aiReady: boolean;
    detail: StudySetDetail | null;
  };

  try {
    const [sets, subjects, progress, detail] = await Promise.all([
      listStudySets(),
      listSubjects(),
      prisma.userProgress.findUnique({
        where: { userId },
        select: { geminiApiKey: true, openaiApiKey: true, ollamaEnabled: true },
      }),
      setId ? getStudySet(setId) : Promise.resolve(null),
    ]);
    data = {
      sets,
      subjects: subjects.map((s) => s.name),
      aiReady: Boolean(progress?.geminiApiKey || progress?.openaiApiKey || progress?.ollamaEnabled),
      detail,
    };
  } catch (error) {
    console.error('Practice page failed to load', error);
    return (
      <Page>
        <PageHeader title="Practice" description="Turn a chapter or your notes into questions, then answer them." />
        <PageBody>
          <ErrorState
            title="Your practice sets could not be loaded"
            description="Something went wrong while fetching them. Check your connection and try again."
            action={
              <Button asChild variant="outline">
                <Link href="/ai">Try again</Link>
              </Button>
            }
          />
        </PageBody>
      </Page>
    );
  }

  return (
    <StudyGenerator
      sets={data.sets}
      subjects={data.subjects}
      aiReady={data.aiReady}
      initialDetail={data.detail}
      initialSubject={subject || null}
      missingSet={Boolean(setId) && !data.detail}
    />
  );
}
