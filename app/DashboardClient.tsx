'use client';

import { useState } from 'react';
import { StreakCelebration } from '@/components/StreakCelebration';

interface StreakStats {
  tasksCompleted: number;
  totalTasks: number;
  focusMinutes: number;
  xpEarned: number;
}

interface DashboardClientProps {
  streakData: {
    currentStreak: number;
    streakIncreased: boolean;
    yesterdayStats: StreakStats | null;
  } | null;
}

export function DashboardClient({ streakData }: DashboardClientProps) {
  // Decided once, from the data the page rendered with: the celebration is
  // for this load only, and closing it must not be undone by a re-render.
  const [showCelebration, setShowCelebration] = useState(() => Boolean(streakData?.streakIncreased));

  if (!showCelebration) return null;

  return (
    <StreakCelebration 
      currentStreak={streakData?.currentStreak || 0}
      stats={streakData?.yesterdayStats || null}
      onClose={() => setShowCelebration(false)}
    />
  );
}
