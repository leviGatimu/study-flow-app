import { redirect } from 'next/navigation';

import { getUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { listSubjects } from '@/lib/subject-actions';
import { listStudySets } from '@/lib/study-actions';
import { StudyGenerator } from './StudyGenerator';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * AI Study.
 *
 * One thing: turn a document into questions and answer them. The five-mode chat
 * that lived here was removed - it was a chatbot in a study app rather than a
 * study tool, and a student with a chapter to revise wanted to be tested, not
 * to have a conversation about being tested.
 */
export default async function AiStudyPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const [sets, subjects, progress] = await Promise.all([
    listStudySets(),
    listSubjects(),
    prisma.userProgress.findUnique({
      where: { userId },
      select: { geminiApiKey: true, openaiApiKey: true, ollamaEnabled: true },
    }),
  ]);

  return (
    <StudyGenerator
      sets={sets}
      subjects={subjects.map((s) => s.name)}
      aiReady={Boolean(progress?.geminiApiKey || progress?.openaiApiKey || progress?.ollamaEnabled)}
    />
  );
}
