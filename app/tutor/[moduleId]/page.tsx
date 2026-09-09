import { redirect } from 'next/navigation';

/** Individual tutor modules are gone; AI Study holds the sessions now. */
export default function TutorModuleRedirect() {
  redirect('/ai');
}
