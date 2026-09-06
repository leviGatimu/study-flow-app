import { getHomeworks } from '@/lib/homework-actions';
import { HomeworkList } from './HomeworkList';
import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BookOpen } from 'lucide-react';
import { getSubjects } from '@/lib/subject-actions';

export const dynamic = 'force-dynamic';

export default async function HomeworksPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const [homeworks, subjects] = await Promise.all([
    getHomeworks(),
    getSubjects()
  ]);

  return (
    <div className="flex flex-col space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-16">
      {/* Header */}
      <header className="px-4 md:px-8 pt-10 pb-6 border-b border-border/40">
        <h1 className="text-2xl font-heading font-bold tracking-tight text-foreground flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-primary" /> Homeworks
        </h1>
        <p className="text-sm text-muted-foreground mt-2">Track, plan, and manage your academic assignments.</p>
      </header>

      <div className="px-4 md:px-8">
        <HomeworkList homeworks={homeworks} subjects={subjects} />
      </div>
    </div>
  );
}
