'use client';

import { getRankInfo, getXpForNextLevel } from '@/lib/gamification';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

export function RankBadge({ 
  level, 
  xp, 
  showProgress = false,
  className 
}: { 
  level: number; 
  xp: number; 
  showProgress?: boolean;
  className?: string;
}) {
  const rank = getRankInfo(level);
  const nextXp = getXpForNextLevel(level);
  const progress = Math.min((xp / nextXp) * 100, 100);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 shadow-inner">
          <span className="text-lg font-heading font-black text-primary">{level}</span>
        </div>
        <div className="flex flex-col">
          <span className={cn("text-xs font-black uppercase tracking-widest leading-none mb-1", rank.color)}>
            {rank.name}
          </span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
            Current Tier
          </span>
        </div>
      </div>
      
      {showProgress && (
        <div className="space-y-1.5 mt-1">
          <div className="flex justify-between items-end">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{xp} / {nextXp} XP</span>
          </div>
          <Progress value={progress} className="h-1.5 rounded-full bg-muted shadow-inner overflow-hidden" />
        </div>
      )}
    </div>
  );
}
