import { redirect } from 'next/navigation';

/** Insights is now History's Overview tab; old links and bookmarks land there. */
export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const { scope } = await searchParams;
  redirect(scope === 'lifetime' ? '/history?view=overview&scope=lifetime' : '/history?view=overview');
}
