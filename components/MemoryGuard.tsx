"use client";

import { TutorModule } from "@/lib/types";
import { Brain, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { differenceInCalendarDays } from "date-fns";

const understandingDot: Record<string, string> = {
  Master: "bg-emerald-500",
  Intermediate: "bg-blue-500",
  Beginner: "bg-orange-500",
};

function getUrgency(nextReviewAt: Date | string | null) {
  const days = nextReviewAt ? differenceInCalendarDays(new Date(), new Date(nextReviewAt)) : 0;
  if (days >= 3) return { label: `${days}d overdue`, dot: "bg-red-500", text: "text-red-600", bg: "bg-red-500/10" };
  if (days >= 1) return { label: `${days}d overdue`, dot: "bg-orange-500", text: "text-orange-600", bg: "bg-orange-500/10" };
  return { label: "Due today", dot: "bg-blue-500", text: "text-blue-600", bg: "bg-blue-500/10" };
}

export function MemoryGuard({ dueModules }: { dueModules: TutorModule[] }) {
  if (dueModules.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border/60 rounded-3xl p-6 shadow-sm relative overflow-hidden group hover:shadow-md transition-all"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

      <div className="flex items-center justify-between mb-5 relative z-10">
        <h3 className="font-heading font-black text-lg flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          Memory Guard
        </h3>
        <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
          {dueModules.length} Due
        </span>
      </div>

      <div className="space-y-1 relative z-10">
        {dueModules.map((module) => {
          const urgency = getUrgency(module.nextReviewAt);
          return (
            <Link key={module.id} href={`/tutor/${module.id}`}>
              <div className="flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/60 transition-colors group/item">
                <span className={cn("h-2 w-2 rounded-full shrink-0", urgency.dot)} />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{module.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide truncate">
                      {module.subject}
                    </span>
                    <span className="text-muted-foreground/40">•</span>
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", understandingDot[module.understanding || "Beginner"])} />
                    <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                      {module.understanding || "Beginner"}
                    </span>
                  </div>
                </div>

                <span className={cn("text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-full shrink-0", urgency.bg, urgency.text)}>
                  {urgency.label}
                </span>

                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover/item:text-primary group-hover/item:translate-x-0.5 transition-all shrink-0" />
              </div>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}
