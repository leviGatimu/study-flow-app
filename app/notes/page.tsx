import { getStickyNotes } from "@/lib/actions";
import { StickyNotesContainer } from "@/components/StickyNotesContainer";
import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StickyNotesPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const initialNotes = await getStickyNotes();
  
  return (
    <div className="min-h-full w-full bg-[#f8f9fa] dark:bg-[#0a0a0a] relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] dark:opacity-[0.05] pointer-events-none z-0 bg-[url('/textures/cubes.png')]" />
      
      <div className="container mx-auto py-10 px-6 md:px-10 relative z-10">
        <StickyNotesContainer initialNotes={initialNotes} />
      </div>
    </div>
  );
}
