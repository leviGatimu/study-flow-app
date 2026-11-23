import { redirect } from 'next/navigation';

/**
 * Mentors used to have a dashboard of their own here. They now see the
 * student's own pages, read-only, exactly as the student sees them, so this
 * address only sends old links home.
 */
export default function MentorPage() {
  redirect('/');
}
