import { getStudioNote, getStudioResources } from "@/lib/studio-actions";
import { StudioWorkspace } from "@/components/StudioWorkspace";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StudioPage({ params }: { params: Promise<{ subject: string }> }) {
  const { subject } = await params;
  const decodedSubject = decodeURIComponent(subject);
  
  const [note, resources] = await Promise.all([
    getStudioNote(decodedSubject),
    getStudioResources(decodedSubject)
  ]);

  return (
    <StudioWorkspace 
      subject={decodedSubject} 
      initialContent={note?.content || ""} 
      resources={resources}
    />
  );
}
