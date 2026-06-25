'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Trophy, Clock, CheckCircle2, Zap, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StreakStats {
  tasksCompleted: number;
  totalTasks: number;
  focusMinutes: number;
  xpEarned: number;
}

interface StreakCelebrationProps {
  currentStreak: number;
  stats: StreakStats | null;
  onClose: () => void;
}

export function StreakCelebration({ currentStreak, stats, onClose }: StreakCelebrationProps) {
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    // Show stats after the initial fire animation
    const timer = setTimeout(() => setShowStats(true), 2800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <AnimatePresence mode="wait">
        {!showStats ? (
          <motion.div
            key="fire-anim"
            initial={{ scale: 0, opacity: 0, rotate: -10 }}
            animate={{ 
              scale: 1, 
              opacity: 1,
              rotate: 0
            }}
            exit={{ 
              scale: 0.5, 
              opacity: 0,
              filter: "blur(20px)",
              transition: { duration: 0.3 }
            }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 20
            }}
            onClick={() => setShowStats(true)}
            className="relative flex flex-col items-center gap-8 cursor-pointer"
          >
            <div className="relative">
               {/* Massive Glowing Background */}
               <div className="absolute inset-[-50%] bg-orange-500 rounded-full blur-[120px] opacity-30 animate-pulse" />
               <motion.div
                 animate={{ 
                   y: [0, -30, 0],
                   scale: [1, 1.15, 1],
                   filter: ["drop-shadow(0 0 20px rgba(249,115,22,0.4))", "drop-shadow(0 0 60px rgba(249,115,22,0.8))", "drop-shadow(0 0 20px rgba(249,115,22,0.4))"]
                 }}
                 transition={{ 
                   duration: 2, 
                   repeat: Infinity,
                   ease: "easeInOut" 
                 }}
                 className="relative z-10"
               >
                 <Flame className="w-64 h-64 text-orange-500 fill-orange-500" />
               </motion.div>
            </div>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-center"
            >
              <h2 className="text-8xl font-heading font-black text-white tracking-tighter drop-shadow-2xl">
                {currentStreak}
              </h2>
              <p className="text-2xl font-black text-orange-500 uppercase tracking-[0.4em] mt-[-10px]">
                DAY STREAK!
              </p>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mt-8 animate-pulse">
                Tap anywhere to skip
              </p>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="stats-card"
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, transition: { duration: 0.2 } }}
            transition={{ 
              type: "spring",
              stiffness: 300,
              damping: 25
            }}
            className="max-w-md w-full mx-4 bg-zinc-900 border-2 border-white/10 rounded-[48px] p-10 shadow-[0_32px_80px_rgba(0,0,0,0.5)] relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-80 h-80 bg-primary/20 rounded-full blur-[100px] -z-0 translate-x-1/3 -translate-y-1/3" />
            
            <div className="relative z-10 space-y-10">
              <div className="text-center space-y-3">
                <div className="w-24 h-24 bg-orange-500/10 rounded-[32px] flex items-center justify-center mx-auto mb-6 border border-orange-500/20 shadow-inner">
                   <Trophy className="w-12 h-12 text-orange-500" />
                </div>
                <h2 className="text-5xl font-heading font-black text-white tracking-tighter leading-none">Victory Lap</h2>
                <p className="text-white/40 font-bold uppercase tracking-widest text-[10px]">Yesterday's Legendary Performance</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/[0.03] border border-white/5 rounded-[32px] p-6 space-y-1">
                  <div className="flex items-center gap-2 text-white/30 mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Tasks</span>
                  </div>
                  <p className="text-3xl font-black text-white">{stats?.tasksCompleted ?? '–'}<span className="text-lg text-white/20 ml-1">/{stats?.totalTasks ?? '–'}</span></p>
                </div>

                <div className="bg-white/[0.03] border border-white/5 rounded-[32px] p-6 space-y-1">
                  <div className="flex items-center gap-2 text-white/30 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Focus</span>
                  </div>
                  <p className="text-3xl font-black text-white">{stats?.focusMinutes ?? 0}<span className="text-lg text-white/20 ml-1">m</span></p>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-[32px] p-6 space-y-1 col-span-2 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <Zap className="w-12 h-12 text-primary fill-current" />
                  </div>
                  <div className="flex items-center gap-2 text-primary/60 mb-1">
                    <Zap className="w-4 h-4 fill-current" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Rewards Claimed</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-4xl font-black text-white">+{stats?.xpEarned ?? 0} <span className="text-primary text-xl">XP</span></p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button 
                  onClick={onClose}
                  className="w-full h-20 rounded-[28px] font-black text-xl bg-white text-black hover:bg-zinc-200 shadow-2xl group transition-all active:scale-95"
                >
                  KEEP CRUSHING IT <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-2 transition-transform duration-300" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
