import { getTutorModuleById } from "@/lib/tutor-actions";
import { TutorHub } from "@/components/TutorHub";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TutorModulePage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const module = await getTutorModuleById(moduleId);

  if (!module) {
    notFound();
  }

  return <TutorHub module={module} />;
}
