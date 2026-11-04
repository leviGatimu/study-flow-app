import { Check, ChevronDown, Trophy } from 'lucide-react';
import type { SafeUserProgress as UserProgress } from '@/lib/types';
import { RANKS, getXpForNextLevel } from '@/lib/gamification';
import { cn } from '@/lib/utils';

/** Progress is a record to explore, not a list of demands. */
export function RankRoadmap({ userProgress }: { userProgress: UserProgress }) {
  const level=userProgress.level ?? 1;
  const xp=userProgress.xp ?? 0;
  const nextXp=getXpForNextLevel(level);
  const current=RANKS.find(rank=>level>=rank.minLevel&&level<=rank.maxLevel) ?? RANKS[0];
  const remaining=Math.max(0,nextXp-xp);
  return <section className="h-full rounded-xl border border-border bg-card p-5 sm:p-7" aria-label="Level and rank">
    <header className="flex items-start justify-between gap-4">
      <div><p className="mb-1 text-xs text-muted-foreground">Level & rank</p><h2 className="text-xl font-medium">{current.name}</h2></div>
      <span className="flex size-11 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground"><Trophy className="size-5" strokeWidth={1.75} /></span>
    </header>
    <div className="my-7 flex items-baseline gap-3"><span className="text-5xl font-medium tabular-nums">{level}</span><span className="text-sm text-muted-foreground">Your current level</span></div>
    <div className="mb-2 flex items-center justify-between gap-3 text-xs"><span>{xp.toLocaleString()} / {nextXp.toLocaleString()} XP</span><span className="text-muted-foreground">Level {level+1}</span></div>
    <div role="progressbar" aria-label={`Progress to level ${level+1}`} aria-valuemin={0} aria-valuemax={nextXp} aria-valuenow={Math.max(0,Math.min(xp,nextXp))} className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width:`${Math.min(100,Math.max(0,xp/nextXp*100))}%`}} /></div>
    <p className="mt-2 text-xs text-muted-foreground">{remaining.toLocaleString()} XP to the next level</p>
    <ol className="mt-6 divide-y divide-border/60">
      {RANKS.map(rank=>{
        const reached=level>=rank.minLevel;
        const isCurrent=rank===current;
        return <li key={rank.name} aria-current={isCurrent?'step':undefined} className="flex items-center gap-3 py-3.5">
          <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-xs',isCurrent?'border-primary bg-primary/10 text-primary':'text-muted-foreground')}>{reached?<Check className="size-3.5" />:rank.minLevel}</span>
          <div className="min-w-0 flex-1"><p className="text-sm font-medium">{rank.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{rank.maxLevel>=999?`Level ${rank.minLevel}+`:`Levels ${rank.minLevel}–${rank.maxLevel}`}</p></div>
          {isCurrent&&<span className="text-xs font-medium text-primary">Current</span>}
        </li>;
      })}
    </ol>
    <details className="group mt-4 border-t border-border pt-4 text-xs text-muted-foreground"><summary className="flex cursor-pointer list-none items-center justify-between gap-3">About XP<ChevronDown className="size-3.5 transition-transform group-open:rotate-180" /></summary><p className="mt-3 leading-relaxed">Completed study blocks, homework, focus sessions and optional practice contribute to your XP. Your existing progress stays recorded.</p></details>
  </section>;
}