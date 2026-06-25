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
    <div className="space-y-10 max-w-[1600px] mx-auto animate-in fade-in duration-500 p-4 md:p-8 pb-16">
      {/* Header */}
      <div className="pt-10 pb-6 border-b border-border/40 mb-4">
        <h1 className="text-5xl md:text-6xl font-heading font-black tracking-tight text-foreground uppercase flex items-center gap-4">
          <BookOpen className="w-12 h-12 text-primary animate-pulse" /> Homeworks
        </h1>
        <p className="text-base md:text-lg text-muted-foreground font-semibold mt-2">Track, plan, and manage your academic assignments with high fidelity.</p>
      </div>

      {/* Full Width Layout */}
      <div className="w-full">
        <HomeworkList homeworks={homeworks} subjects={subjects} />
      </div>
    </div>
  );
}
