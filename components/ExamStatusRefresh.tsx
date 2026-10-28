'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { examStatus, type TimedExam } from '@/lib/exam-time';

/** Refresh only at a status boundary, including after a sleeping tab resumes. */
export function ExamStatusRefresh({ exams, timezone, renderedAt }: { exams: TimedExam[]; timezone: string; renderedAt: string }) {
  const router = useRouter();
  useEffect(() => {
    const watched = exams.filter((exam) => examStatus(exam, timezone, new Date(renderedAt)) !== 'DONE');
    if (watched.length === 0) return;
    const signature = (now: Date) => watched.map((exam) => examStatus(exam, timezone, now)).join('|');
    let previous = signature(new Date(renderedAt));
    const check = () => {
      const current = signature(new Date());
      if (current !== previous) {
        previous = current;
        router.refresh();
      }
    };
    const timer = window.setInterval(check, 1000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    check();
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [exams, timezone, renderedAt, router]);
  return null;
}
