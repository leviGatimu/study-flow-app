import { redirect } from 'next/navigation';

/** Creating a tutor module is now just starting a session in AI Study. */
export default function NewTutorRedirect() {
  redirect('/ai');
}
