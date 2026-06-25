import { getUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { SchoolTimetable } from '@/components/SchoolTimetable';
import { GraduationCap, ShieldAlert } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SchoolPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, isAdmin: true }
  });

  // Access Control: only administrators can see this page.
  if (user?.isAdmin !== true) {
    return (
      <div className="flex flex-col items-center justify-center py-32 bg-destructive/5 border-2 border-dashed border-destructive/20 rounded-[40px] text-center max-w-2xl mx-auto mt-20">
        <ShieldAlert className="w-16 h-16 text-destructive/40 mb-6" />
        <h2 className="text-2xl font-heading font-bold text-destructive/80">Access Restricted</h2>
        <p className="text-muted-foreground mt-2 px-8">
          This portal is reserved for authorized personnel only. If you believe this is an error, please contact the administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-16">
      <div className="pt-6 pb-2 border-b border-border/40 flex items-center justify-between">
        <div>
          <h1 className="text-5xl font-heading font-black tracking-tight text-foreground">School Portal</h1>
          <p className="text-xl text-muted-foreground font-semibold mt-3">Live timetable and lesson tracking for {user.username}.</p>
        </div>
        <div className="p-4 bg-primary/10 rounded-3xl text-primary">
          <GraduationCap className="w-8 h-8" />
        </div>
      </div>

      <SchoolTimetable />
    </div>
  );
}
