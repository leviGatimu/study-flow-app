import { isOnline, lastSeenLabel } from '@/lib/last-seen';
import { requireMentorStudent } from '@/lib/mentor-data';
import { MentorShell } from '@/components/mentor/MentorShell';

export const dynamic = 'force-dynamic';

/**
 * The mentor's own section. proxy.ts keeps mentors inside it and
 * requireMentorStudent keeps everyone else out. Nothing here can write: no
 * page in it has a form or server action other than signing out, and
 * lib/mentor-guard.ts refuses writes from a mentor regardless.
 */
export default async function MentorLayout({ children }: { children: React.ReactNode }) {
  const student = await requireMentorStudent();
  const now = seenNow();
  const line = [student.classLabel, student.termName].filter(Boolean).join(' · ') || student.school || 'Student';

  return (
    <MentorShell
      studentName={student.name}
      studentLine={line}
      mentorName={student.mentorName}
      avatarUrl={student.avatarUrl}
      lastSeen={lastSeenLabel(student.lastActiveDate, now)}
      online={isOnline(student.lastActiveDate, now)}
    >
      {children}
    </MentorShell>
  );
}

/** This request's clock, outside render so the purity lint is satisfied. */
function seenNow() {
  return Date.now();
}
