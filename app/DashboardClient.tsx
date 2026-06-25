'use client';

import { useState, useEffect } from 'react';
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
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    if (streakData?.streakIncreased) {
      setShowCelebration(true);
    }
  }, [streakData]);

  if (!showCelebration) return null;

  return (
    <StreakCelebration 
      currentStreak={streakData?.currentStreak || 0}
      stats={streakData?.yesterdayStats || null}
      onClose={() => setShowCelebration(false)}
    />
  );
}
