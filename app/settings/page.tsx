import { getSettingsData } from '@/lib/actions';
import SettingsInterface from './SettingsInterface';
import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SettingsPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const settingsData = await getSettingsData();
  if (!settingsData) redirect('/welcome');

  return <SettingsInterface initialData={settingsData} />;
}
