import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Brain, Sparkles } from "lucide-react";
import { getUniqueSubjects } from "@/lib/actions";
import { TutorSetupForm } from "@/components/TutorSetupForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewQuizPage() {
  const userId = await getUserId();
  if (!userId) redirect("/welcome");

  const subjects = await getUniqueSubjects();

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-primary/5 rounded-full blur-[160px] pointer-events-none -z-10" />

      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="max-w-3xl mx-auto px-6 md:px-8 h-16 flex items-center justify-between">
          <Link
            href="/tutor"
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Quiz Library
          </Link>
          <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
            <Brain className="w-3 h-3" /> AI Generator
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 md:px-8 py-12 md:py-16">
        <div className="text-center space-y-4 mb-12">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-primary/25 to-primary/5 border border-primary/30 flex items-center justify-center shadow-inner">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-6xl font-heading font-black tracking-tighter">Generate a New Quiz</h1>
          <p className="text-lg text-muted-foreground font-medium max-w-xl mx-auto">
            Pick a style, drop in your material, and the AI will craft an interactive practice quiz tailored to it.
          </p>
        </div>

        <div className="bg-card border border-border/60 rounded-[32px] shadow-xl p-8 md:p-10">
          <TutorSetupForm subjects={subjects} />
        </div>
      </main>
    </div>
  );
}
