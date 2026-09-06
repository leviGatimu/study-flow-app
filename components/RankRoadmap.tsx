"use client";

import { motion } from "framer-motion";
import { 
  Trophy, 
  Lock, 
  CheckCircle, 
  Flame, 
  Zap, 
  Shield, 
  Star,
  Crown,
  Sparkles,
  Clock,
  Award
} from "lucide-react";
import { SafeUserProgress as UserProgress } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { RANKS, getXpForNextLevel } from "@/lib/gamification";

const TIER_CONFIGS = [
  {
    name: "Bronze Tier",
    description: "Start of your study adventure. Setting up your routine and locking in your daily schedules.",
    gradient: "from-amber-600/20 to-amber-900/10",
    border: "border-amber-500/30",
    text: "text-amber-500",
    glow: "shadow-amber-500/5",
    icon: Shield,
  },
  {
    name: "Silver Tier",
    description: "Consistency unlocked. Building study discipline, keeping up streaks, and polishing revision structures.",
    gradient: "from-slate-400/20 to-slate-600/10",
    border: "border-slate-400/30",
    text: "text-slate-400",
    glow: "shadow-slate-400/5",
    icon: Star,
  },
  {
    name: "Gold Tier",
    description: "Advanced deep work. Focusing for longer blocks, tracking multiple topics, and mastering homework targets.",
    gradient: "from-yellow-500/20 to-yellow-700/10",
    border: "border-yellow-500/30",
    text: "text-yellow-500",
    glow: "shadow-yellow-500/5",
    icon: Trophy,
  },
  {
    name: "Platinum Tier",
    description: "Elite academic performance. Optimizing revision pipelines, tackling exams with ease, and showing strong routines.",
    gradient: "from-cyan-500/20 to-cyan-700/10",
    border: "border-cyan-500/30",
    text: "text-cyan-500",
    glow: "shadow-cyan-500/5",
    icon: Crown,
  },
  {
    name: "Diamond Elite",
    description: "Ultimate academic mastery. Top-tier level completion, exceptional focus mastery, and flawless consistency.",
    gradient: "from-indigo-500/20 to-purple-700/10",
    border: "border-indigo-500/30",
    text: "text-indigo-400",
    glow: "shadow-indigo-500/5",
    icon: Sparkles,
  }
];

export function RankRoadmap({ userProgress }: { userProgress: UserProgress }) {
  const nextXp = getXpForNextLevel(userProgress.level);
  const progressPercent = Math.min((userProgress.xp / nextXp) * 100, 100);
  const currentRankIndex = RANKS.findIndex(r => userProgress.level >= r.minLevel && userProgress.level <= r.maxLevel);
  const currentRank = RANKS[currentRankIndex] || RANKS[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
      {/* Left Column: Ranks Roadmap List (8 cols) */}
      <div className="lg:col-span-8 space-y-6">
        <div className="bg-card/40 backdrop-blur-xl border border-border/60 shadow-sm rounded-2xl p-6 md:p-10 relative overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-heading font-bold tracking-tight text-foreground">Ranks & Milestones</h2>
              <p className="text-sm text-muted-foreground mt-1">Level up your profile to unlock new academic tiers.</p>
            </div>
            <span className="text-xs font-medium text-primary bg-primary/10 px-4 py-1.5 rounded-full border border-primary/20">
              {RANKS.length} ranks total
            </span>
          </div>

          <div className="space-y-6 relative">
            {/* Progression Vertical Line */}
            <div className="absolute left-[31px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-primary via-border/50 to-border/10 hidden md:block" />

            {RANKS.map((rank, idx) => {
              const config = TIER_CONFIGS[idx] || TIER_CONFIGS[0];
              const Icon = config.icon;
              const isUnlocked = userProgress.level >= rank.minLevel;
              const isCurrent = userProgress.level >= rank.minLevel && userProgress.level <= rank.maxLevel;
              
              return (
                <motion.div 
                  key={rank.name} 
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "relative flex items-start gap-6 md:gap-8 rounded-2xl p-4 md:p-6 transition-all duration-300 border border-transparent",
                    isCurrent && "bg-muted/30 border-border/40 shadow-sm"
                  )}
                >
                  {/* Circle Icon Badge */}
                  <div className={cn(
                    "relative z-10 w-16 h-16 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all duration-700 hidden md:flex",
                    isCurrent ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-105" : 
                    isUnlocked ? "bg-card border-border/60 text-foreground" : "bg-muted/10 border-border/10 text-muted-foreground/30"
                  )}>
                    {isUnlocked ? <Icon className="w-6.5 h-6.5" /> : <Lock className="w-5 h-5 opacity-60" />}
                    {isCurrent && (
                      <div className="absolute -inset-1.5 border-2 border-primary/30 rounded-2xl" />
                    )}
                  </div>

                  {/* Text details */}
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h3 className={cn(
                          "text-xl font-heading font-bold tracking-tight uppercase leading-none",
                          isCurrent ? config.text : isUnlocked ? "text-foreground" : "text-muted-foreground/40"
                        )}>
                          {rank.name}
                        </h3>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">
                            Active
                          </span>
                        )}
                      </div>

                      {isCurrent ? (
                        <span className="text-xs font-medium text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
                          Current tier
                        </span>
                      ) : isUnlocked ? (
                        <span className="text-xs font-medium text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Unlocked
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-muted-foreground/30 bg-muted/10 border border-border/10 px-3 py-1 rounded-full flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Locked
                        </span>
                      )}
                    </div>

                    <p className={cn(
                      "text-xs font-medium",
                      isUnlocked ? "text-muted-foreground/60" : "text-muted-foreground/20"
                    )}>
                      Level {rank.minLevel} - {rank.maxLevel === 999 ? "∞" : rank.maxLevel}
                    </p>

                    <p className={cn(
                      "text-sm font-medium leading-relaxed max-w-2xl transition-colors duration-500",
                      isUnlocked ? "text-muted-foreground" : "text-muted-foreground/30 italic select-none"
                    )}>
                      {config.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Column: Profile Identity slab (4 cols) */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* RPG Profile Character Slab */}
        <Card className="p-8 border-border/60 shadow-sm rounded-2xl bg-card/40 backdrop-blur-xl relative overflow-hidden">
          <div className="space-y-8">
            {/* Avatar Row */}
            <div className="flex items-center gap-4.5">
              <div className="relative shrink-0">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20 relative z-10">
                  <span className="text-2xl font-heading font-black">{userProgress.level}</span>
                </div>
              </div>

              <div className="min-w-0 space-y-1">
                <p className="text-xs font-medium text-primary">Your academic standing</p>
                <h3 className="text-2xl font-heading font-bold tracking-tight uppercase italic text-foreground truncate">
                  {currentRank?.name}
                </h3>
              </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-border/40">
              <div className="bg-muted/20 border border-border/30 rounded-2xl p-4 space-y-1">
                <p className="text-xs font-medium text-muted-foreground/60 leading-none">Focus time</p>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <p className="text-xl font-heading font-black tabular-nums tracking-tight">
                    {(userProgress.totalFocusMinutes / 60).toFixed(1)}h
                  </p>
                </div>
              </div>

              <div className="bg-muted/20 border border-border/30 rounded-2xl p-4 space-y-1">
                <p className="text-xs font-medium text-muted-foreground/60 leading-none">Streak</p>
                <div className="flex items-center gap-2 mt-1">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <p className="text-xl font-heading font-black text-orange-500 tabular-nums tracking-tight">
                    {userProgress.currentStreak} days
                  </p>
                </div>
              </div>
            </div>

            {/* XP Experience pipeline */}
            <div className="space-y-3 pt-6 border-t border-border/40">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground/60">Experience</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-heading font-black tabular-nums">{userProgress.xp.toLocaleString()}</span>
                    <span className="text-xs font-medium text-muted-foreground/40">/ {nextXp.toLocaleString()} XP</span>
                  </div>
                </div>
                <span className="text-xs font-medium text-primary bg-primary/5 px-2.5 py-1 rounded-md border border-primary/10">
                  {Math.round(progressPercent)}%
                </span>
              </div>

              {/* Progress Slider Bar */}
              <div className="relative h-2 w-full bg-muted/40 rounded-full overflow-hidden border border-border/20 shadow-inner">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Level Up Strategy */}
        <div className="bg-card/40 backdrop-blur-xl border border-border/60 shadow-sm rounded-2xl p-6.5 space-y-5">
          <h3 className="font-heading font-bold text-lg text-foreground flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500 fill-yellow-500/10 shrink-0" />
            Rank Up Strategies
          </h3>

          <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
            <div className="flex items-start gap-3 bg-muted/20 p-3.5 rounded-xl border border-border/30">
              <div className="h-6 w-6 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                <Award className="w-3.5 h-3.5" />
              </div>
              <p>Complete your scheduled tasks to gain <strong className="text-foreground">XP</strong> and progress to the next academic level.</p>
            </div>
            <div className="flex items-start gap-3 bg-muted/20 p-3.5 rounded-xl border border-border/30">
              <div className="h-6 w-6 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                <Flame className="w-3.5 h-3.5" />
              </div>
              <p>Maintain your study streak! Consistent focus multipliers will accelerate your XP collection rate.</p>
            </div>
            <div className="flex items-start gap-3 bg-muted/20 p-3.5 rounded-xl border border-border/30">
              <div className="h-6 w-6 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <p>Use Focus Mode to record minutes of deep study. Every focus block boosts your Focus stats.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
