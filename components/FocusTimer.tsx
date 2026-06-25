'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock } from 'lucide-react';

export function FocusTimer({ endTime }: { endTime: string }) {
  const [timeLeft, setTimeLeft] = useState<{h: number, m: number, s: number} | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setMounted(m => m === false ? true : m);
      const calculateTime = () => {
        const now = new Date();
        const [endH, endM] = endTime.split(':').map(Number);
        
        const end = new Date();
        end.setHours(endH, endM, 0, 0);

        const diff = end.getTime() - now.getTime();

        if (diff <= 0) {
          setTimeLeft({ h: 0, m: 0, s: 0 });
          return;
        }

        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        setTimeLeft({ h, m, s });
      };

      calculateTime();
      const interval = setInterval(calculateTime, 1000);
      return () => clearInterval(interval);
    }, 0);
  }, [endTime]);

  if (!mounted || !timeLeft) return null;

  return (
    <div className="flex flex-col items-center justify-center space-y-8 py-12">
      <div className="relative group">
        {/* Static Outer Glow */}
        <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/30 transition-colors" />
        
        {/* Main Timer Circle */}
        <div className="relative w-[340px] h-[340px] sm:w-[450px] sm:h-[450px] rounded-full bg-card border-8 border-primary/20 flex flex-col items-center justify-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
          
          <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] text-primary mb-2 animate-in fade-in duration-1000">Session Remaining</span>
          
          <div className="flex items-baseline font-heading font-black tabular-nums tracking-tighter">
            <span className="text-7xl sm:text-9xl text-foreground">
              {timeLeft.h.toString().padStart(2, '0')}
            </span>
            <span className="text-5xl sm:text-7xl text-primary mx-1">:</span>
            <span className="text-7xl sm:text-9xl text-foreground">
              {timeLeft.m.toString().padStart(2, '0')}
            </span>
            <span className="text-5xl sm:text-7xl text-primary mx-1">:</span>
            <span className="text-4xl sm:text-6xl text-muted-foreground ml-1">
              {timeLeft.s.toString().padStart(2, '0')}
            </span>
          </div>

          <div className="mt-8 flex items-center gap-3 bg-muted px-4 py-2 rounded-2xl border border-border/60 shadow-sm">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Scheduled end: {endTime}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
