import { redirect } from 'next/navigation';

/**
 * AI Tutor was folded into AI Study.
 *
 * Teaching, testing and mock exams are modes of the one assistant now, so this
 * is a permanent redirect rather than a page. Kept because links to it exist in
 * the wild - bookmarks, and the desktop app's cached shell.
 */
export default function TutorRedirect() {
  redirect('/ai');
}
