import {
  BookOpen,
  BrainCircuit,
  CheckCircle,
  CheckCircle2,
  Crown,
  Flame,
  Lock,
  Shield,
  Sparkles,
  Star,
  Timer,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { SafeUserProgress as UserProgress } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RANKS, getXpForNextLevel } from "@/lib/gamification";
import { Panel, PanelTitle } from "@/components/ui/panel";
import { Pill } from "@/components/ui/list-row";

/** Per-rank icon and one line on what that stage of the year looks like. */
const TIERS: Record<string, { icon: LucideIcon; description: string }> = {
  "Bronze Tier": {
    icon: Shield,
    description: "The start: setting up your routine and keeping to your timetable.",
  },
  "Silver Tier": {
    icon: Star,
    description: "Consistency: keeping streaks alive and revising on schedule.",
  },
  "Gold Tier": {
    icon: Trophy,
    description: "Longer focus sessions, more topics covered and homework handed in on time.",
  },
  "Platinum Tier": {
    icon: Crown,
    description: "A routine that holds through exam season.",
  },
  "Diamond Elite": {
    icon: Sparkles,
    description: "The top rank: a full year of steady, finished work.",
  },
};

/**
 * Where XP comes from, matching the grants in lib/ (grantXp callers): a task,
 * a homework, a streak day, a timed focus session and a practice attempt.
 */
const XP_SOURCES: { icon: LucideIcon; text: string }[] = [
  { icon: CheckCircle2, text: "Finish a scheduled study block: 100 XP." },
  { icon: BookOpen, text: "Complete a homework and attach its proof: 200 XP." },
  { icon: Flame, text: "Extend your streak: 50 XP for every day it has run." },
  { icon: Timer, text: "Complete a session in Focus: XP for the time you stayed on task." },
  { icon: BrainCircuit, text: "Finish a practice set: more XP for longer sets and higher scores." },
];

export function RankRoadmap({ userProgress }: { userProgress: UserProgress }) {
  const level = userProgress.level ?? 1;
  const xp = userProgress.xp ?? 0;
  const nextXp = getXpForNextLevel(level);
  const progressPercent = Math.min((xp / nextXp) * 100, 100);
  const currentRank = RANKS.find((r) => level >= r.minLevel && level <= r.maxLevel) ?? RANKS[0];

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-4 lg:order-2">
        <Panel>
          <PanelTitle icon={<Zap />}>Your level</PanelTitle>
          <div className="flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <span className="font-heading text-2xl font-black tabular-nums">{level}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Level {level}</p>
              <p className="truncate font-heading text-xl font-bold text-foreground">{currentRank.name}</p>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                <span className="font-bold tabular-nums text-foreground">{xp.toLocaleString()}</span> of{" "}
                {nextXp.toLocaleString()} XP
              </p>
              <span className="text-xs font-medium text-muted-foreground">
                {(nextXp - xp).toLocaleString()} XP to level {level + 1}
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label={`Progress to level ${level + 1}`}
              aria-valuemin={0}
              aria-valuemax={nextXp}
              aria-valuenow={xp}
            >
              <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelTitle icon={<Sparkles />}>How to earn XP</PanelTitle>
          <ul className="space-y-3">
            {XP_SOURCES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-muted-foreground">
                <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel padded={false} className="divide-y divide-border/40 lg:col-span-8 lg:order-1">
        {RANKS.map((rank) => {
          const tier = TIERS[rank.name] ?? TIERS["Bronze Tier"];
          const Icon = tier.icon;
          const isUnlocked = level >= rank.minLevel;
          const isCurrent = rank.name === currentRank.name;

          return (
            <div
              key={rank.name}
              className={cn("flex items-start gap-4 px-6 py-5", isCurrent && "bg-primary/5")}
              aria-current={isCurrent ? "step" : undefined}
            >
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl border",
                  isCurrent
                    ? "border-primary bg-primary text-primary-foreground"
                    : isUnlocked
                      ? "border-border bg-card text-foreground"
                      : "border-border/50 bg-muted/40 text-muted-foreground"
                )}
              >
                {isUnlocked ? <Icon className="size-5" /> : <Lock className="size-4" />}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={cn("font-heading text-lg font-bold", isUnlocked ? "text-foreground" : "text-muted-foreground")}>
                    {rank.name}
                  </p>
                  {isCurrent ? (
                    <Pill tone="primary">Current rank</Pill>
                  ) : isUnlocked ? (
                    <Pill tone="success">
                      <CheckCircle /> Reached
                    </Pill>
                  ) : (
                    <Pill>
                      <Lock /> Locked
                    </Pill>
                  )}
                </div>
                <p className="text-xs font-medium text-muted-foreground">
                  {rank.maxLevel >= 999 ? `Level ${rank.minLevel} and up` : `Levels ${rank.minLevel} to ${rank.maxLevel}`}
                </p>
                <p className="text-sm text-muted-foreground">{tier.description}</p>
              </div>
            </div>
          );
        })}
      </Panel>
    </div>
  );
}
