import { redirect } from "next/navigation";
import Link from "next/link";

import { getStickyNotes } from "@/lib/actions";
import { getUserId } from "@/lib/auth";
import { StickyNotesContainer } from "@/components/StickyNotesContainer";
import { Button } from "@/components/ui/button";
import { Page, PageBody } from "@/components/ui/page";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState } from "@/components/ui/error-state";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const userId = await getUserId();
  if (!userId) redirect("/welcome");

  let notes: Awaited<ReturnType<typeof getStickyNotes>>;
  try {
    notes = await getStickyNotes();
  } catch (error) {
    console.error("Notes page failed to load", error);
    return (
      <Page>
        <PageHeader title="Notes" description="Sticky notes for the things you do not want to forget." />
        <PageBody>
          <ErrorState
            title="Your notes could not be loaded"
            description="Nothing has been lost. Check your connection and try again."
            action={
              <Button asChild variant="outline">
                <Link href="/notes">Try again</Link>
              </Button>
            }
          />
        </PageBody>
      </Page>
    );
  }

  return <StickyNotesContainer initialNotes={notes} />;
}
