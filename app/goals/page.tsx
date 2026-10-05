import { redirect } from 'next/navigation';

/** Goals is now a tab of Marks; old links and bookmarks land there. */
export default function GoalsPage() {
  redirect('/marks?view=goals');
}
