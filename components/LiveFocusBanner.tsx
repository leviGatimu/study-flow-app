"use client";

import { useFocus } from "@/lib/FocusContext";
import { Zap, Pause, Play, ChevronRight, X, Maximize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Button } from "./ui/button";

import { usePathname } from "next/navigation";

export function LiveFocusBanner() {
  const { activeTask, timeLeft, isActive, isPaused, step, resumeFocus, pauseFocus, resetFocus, initialDurationMinutes } = useFocus();
  const pathname = usePathname();

  if (!activeTask || step !== 'FOCUS' || pathname === '/' || pathname.startsWith('/focus')) return null;

  // Derive total session length from the actual configured duration rather than assuming 1 hour.
  const totalSessionSeconds = Math.max(1, initialDurationMinutes * 60);
  const remainingSeconds = timeLeft.h * 3600 + timeLeft.m * 60 + timeLeft.s;
  const progressPercent = Math.min(100, Math.max(0, (remainingSeconds / totalSessionSeconds) * 100));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-6 left-6 right-6 md:left-auto md:right-8 md:w-96 z-[100]"
      >
        <div className={cn(
          "bg-card border-2 shadow-2xl rounded-[32px] overflow-hidden transition-all duration-500",
          isPaused ? "border-amber-500/40" : "border-primary/40 shadow-primary/20"
        )}>
          {/* Background Glow */}
          <div className={cn(
            "absolute inset-0 opacity-10 pointer-events-none blur-3xl",
            isPaused ? "bg-amber-500" : "bg-primary"
          )} />

          <div className="relative p-5 flex items-center justify-between gap-4">
             <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className={cn(
                  "h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg transition-colors",
                  isPaused ? "bg-amber-500 text-white" : "bg-primary text-white shadow-primary/30"
                )}>
                  <Zap className={cn("w-6 h-6", !isPaused && "animate-pulse fill-current")} />
                </div>
                
                <div className="min-w-0 flex-1">
                   <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1">Live Focus</p>
                   <h4 className="font-bold text-sm truncate">{activeTask.subject}</h4>
                   <div className="flex items-center gap-2 mt-1">
                      <span className={cn(
                        "text-lg font-heading font-black tabular-nums leading-none",
                        isPaused ? "text-amber-500" : "text-primary"
                      )}>
                        {timeLeft.h > 0 && `${timeLeft.h.toString().padStart(2, '0')}:`}
                        {timeLeft.m.toString().padStart(2, '0')}:
                        {timeLeft.s.toString().padStart(2, '0')}
                      </span>
                      <span className="text-[10px] font-black uppercase text-muted-foreground/60">{isPaused ? 'Paused' : 'Active'}</span>
                   </div>
                </div>
             </div>

             <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn(
                    "h-10 w-10 rounded-xl transition-all",
                    isPaused ? "text-emerald-500 hover:bg-emerald-500/10" : "text-amber-500 hover:bg-amber-500/10"
                  )}
                  onClick={() => isPaused ? resumeFocus() : pauseFocus()}
                >
                  {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                </Button>
                
                <Link href={`/focus/${activeTask.id}`}>
                  <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-primary hover:bg-primary/10">
                    <Maximize2 className="w-5 h-5" />
                  </Button>
                </Link>

                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => resetFocus()}>
                  <X className="w-5 h-5" />
                </Button>
             </div>
          </div>

          {/* Progress Bar */}
          <div className="h-1 bg-muted">
             <motion.div 
               className={cn("h-full", isPaused ? "bg-amber-500" : "bg-primary")}
               initial={false}
               animate={{
                 width: `${progressPercent}%`
               }}
               transition={{ ease: "linear" }}
             />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
