import { redirect } from 'next/navigation';

/** AI Notes was folded into AI Study's Review mode. See app/tutor/page.tsx. */
export default function AiNotesRedirect() {
  redirect('/ai');
}
