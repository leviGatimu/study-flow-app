"use client";

import { TutorModule } from "@/lib/types";
import { Brain, ChevronRight, Clock, Sparkles, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export function MemoryGuard({ dueModules }: { dueModules: TutorModule[] }) {
  if (dueModules.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between px-2">
        <h3 className="font-heading font-black text-xl flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          Memory Guard
        </h3>
        <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
          {dueModules.length} Due
        </span>
      </div>

      <div className="space-y-3">
        {dueModules.map((module) => (
          <Link key={module.id} href={`/tutor/${module.id}`}>
            <Card className="p-5 border-2 border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 transition-all group rounded-[24px] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-primary/10 transition-colors" />
              
              <div className="relative z-10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                    Spaced Review
                  </span>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    Due Now
                  </div>
                </div>

                <h4 className="font-heading font-black text-lg leading-tight group-hover:text-primary transition-colors">
                  {module.title}
                </h4>

                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        module.understanding === "Master" ? "bg-emerald-500" :
                        module.understanding === "Intermediate" ? "bg-blue-500" :
                        "bg-orange-500"
                      )} />
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                        {module.understanding || "Beginner"} Level
                      </span>
                   </div>
                   <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                      <ChevronRight className="w-4 h-4" />
                   </div>
                </div>
              </div>
            </Card>
          </Link>
        ))}

        <div className="p-4 bg-muted/30 border-dashed border-2 rounded-2xl flex items-start gap-3">
           <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
           <p className="text-[11px] font-medium text-muted-foreground leading-relaxed">
             The forgetting curve shows you&apos;ll lose 70% of this material by tomorrow if you don&apos;t review now.
           </p>
        </div>
      </div>
    </motion.div>
  );
}
