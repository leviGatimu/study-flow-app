"use client";

import { useFocus } from "@/lib/FocusContext";
import { Zap, Pause, Play, ChevronRight, Clock, Flame, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, getRwandaTime } from "@/lib/utils";
import Link from "next/link";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

export function ActiveFocusCard() {
  const { activeTask, timeLeft, isActive, isPaused, step, resumeFocus, pauseFocus, sessionXP, resetFocus } = useFocus();

  if (!activeTask || step !== 'FOCUS') return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <Card className={cn(
        "relative overflow-hidden border-2 transition-all duration-500 rounded-[40px] p-8 md:p-10",
        isPaused 
          ? "border-amber-500/20 bg-amber-500/[0.02]" 
          : "border-primary/30 bg-primary/[0.02] shadow-2xl shadow-primary/10"
      )}>
        {/* Background Decorative Elements */}
        <div className={cn(
          "absolute top-0 right-0 w-96 h-96 rounded-full blur-[100px] -z-0 opacity-20 translate-x-1/2 -translate-y-1/2 transition-colors duration-700",
          isPaused ? "bg-amber-500" : "bg-primary"
        )} />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-10">
           
           <div className="space-y-6 flex-1">
              <div className="flex items-center gap-3">
                 <div className={cn(
                   "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border shadow-sm transition-colors",
                   isPaused ? "bg-amber-500/10 border-amber-500/20 text-amber-600" : "bg-primary/10 border-primary/20 text-primary"
                 )}>
                    {isPaused ? 'Session Paused' : 'Focus Active'}
                 </div>
                 <div className="h-1 w-1 rounded-full bg-border" />
                 <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    <span>In progress: {activeTask.subject}</span>
                 </div>
              </div>

              <div className="space-y-2">
                 <h2 className="text-5xl md:text-6xl font-heading font-black tracking-tighter text-foreground">
                    {activeTask.subject}
                 </h2>
                 <p className="text-muted-foreground text-lg font-medium">
                    You are currently in a deep focus session. Stay consistent!
                 </p>
              </div>

              <div className="flex items-center gap-4 pt-2">
                 <div className="flex items-center gap-2 bg-background/50 backdrop-blur-sm border px-4 py-2 rounded-2xl">
                    <Flame className="w-5 h-5 text-orange-500 fill-orange-500" />
                    <span className="font-black text-lg tabular-nums">+{sessionXP} XP</span>
                 </div>
                 {activeTask.startTime && (
                   <div className="text-xs font-bold text-muted-foreground bg-muted px-4 py-2 rounded-2xl border">
                      Started at {activeTask.startTime}
                   </div>
                 )}
              </div>
           </div>

           {/* Timer & Main Actions */}
           <div className="flex flex-col items-center gap-8 min-w-[300px]">
              <div className={cn(
                "flex items-baseline font-heading font-black tracking-tighter tabular-nums transition-opacity duration-700",
                isPaused ? "opacity-40" : "opacity-100"
              )}>
                 <span className="text-7xl md:text-8xl text-foreground">
                    {timeLeft.h > 0 && `${timeLeft.h.toString().padStart(2, '0')}:`}
                    {timeLeft.m.toString().padStart(2, '0')}
                 </span>
                 <span className="text-4xl md:text-5xl text-primary animate-pulse mx-1">:</span>
                 <span className="text-4xl md:text-5xl text-muted-foreground">
                    {timeLeft.s.toString().padStart(2, '0')}
                 </span>
              </div>

              <div className="flex items-center gap-4 w-full">
                 <Button 
                    onClick={() => isPaused ? resumeFocus() : pauseFocus()}
                    className={cn(
                      "flex-1 h-16 rounded-3xl font-black text-lg gap-3 shadow-xl transition-all hover:scale-[1.02]",
                      isPaused ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20" : "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
                    )}
                 >
                    {isPaused ? <Play className="w-6 h-6 fill-current" /> : <Pause className="w-6 h-6 fill-current" />}
                    {isPaused ? 'RESUME SESSION' : 'PAUSE SESSION'}
                 </Button>

                 <div className="flex flex-col gap-2 flex-1">
                    <Link href={`/focus/${activeTask.id}`} className="w-full">
                        <Button 
                          variant="outline"
                          className="w-full h-12 rounded-2xl font-black text-sm gap-2 border-2 border-primary/20 hover:bg-primary/5 hover:border-primary/40 text-primary transition-all"
                        >
                           EXPAND
                           <ChevronRight className="w-4 h-4" />
                        </Button>
                    </Link>
                    <Button 
                      variant="ghost"
                      onClick={resetFocus}
                      className="w-full h-10 rounded-xl font-black text-[10px] tracking-widest uppercase text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
                    >
                       CANCEL SESSION
                    </Button>
                 </div>
              </div>
           </div>

        </div>
      </Card>
    </motion.div>

  );
}
