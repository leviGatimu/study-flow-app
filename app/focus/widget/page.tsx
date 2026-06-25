'use client';

import { useEffect, useState } from 'react';
import { useFocus } from '@/lib/FocusContext';
import { Play, Pause, CheckCircle2, Maximize2, Music, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_PALETTE } from '@/components/focus/useMusicPlayer';

const DRAG = { WebkitAppRegion: 'drag' } as React.CSSProperties;
const NO_DRAG = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

interface NowPlaying {
  title: string;
  artist: string | null;
  coverUrl: string | null;
  palette: string[];
}

function readNowPlaying(): NowPlaying | null {
  try {
    const raw = localStorage.getItem('study-flow-now-playing');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

interface Objectives {
  goals: string[];
  completed: boolean[];
}

function readObjectives(): Objectives {
  try {
    const raw = localStorage.getItem('study-flow-objectives');
    const data = raw ? JSON.parse(raw) : null;
    return {
      goals: Array.isArray(data?.goals) ? data.goals : [],
      completed: Array.isArray(data?.completed) ? data.completed : []
    };
  } catch {
    return { goals: [], completed: [] };
  }
}

export default function FocusWidgetPage() {
  const {
    activeTask,
    timeLeft,
    isPaused,
    pauseFocus,
    resumeFocus,
    completeFocus,
    initialDurationMinutes,
    step
  } = useFocus();

  const [mounted, setMounted] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [objectives, setObjectives] = useState<Objectives>({ goals: [], completed: [] });

  useEffect(() => {
    setMounted(true);
    setNowPlaying(readNowPlaying());
    setObjectives(readObjectives());

    // Track and objective changes in the main window arrive via storage events.
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'study-flow-now-playing' || e.key === null) {
        setNowPlaying(readNowPlaying());
      }
      if (e.key === 'study-flow-objectives' || e.key === null) {
        setObjectives(readObjectives());
      }
    };
    window.addEventListener('storage', onStorage);

    // Transparent chrome so the rounded card floats on the desktop.
    const originalBg = document.body.style.backgroundColor;
    const originalHtmlBg = document.documentElement.style.backgroundColor;
    document.body.style.backgroundColor = 'transparent';
    document.body.classList.add('bg-transparent');
    document.body.classList.remove('bg-background');
    document.documentElement.style.backgroundColor = 'transparent';
    document.documentElement.classList.add('bg-transparent');

    return () => {
      window.removeEventListener('storage', onStorage);
      document.body.style.backgroundColor = originalBg;
      document.body.classList.remove('bg-transparent');
      document.body.classList.add('bg-background');
      document.documentElement.style.backgroundColor = originalHtmlBg;
      document.documentElement.classList.remove('bg-transparent');
    };
  }, []);

  const palette = nowPlaying?.palette?.length ? nowPlaying.palette : DEFAULT_PALETTE;

  if (!mounted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-transparent">
        <div className="w-full h-full bg-black/80 rounded-[26px] animate-pulse" />
      </div>
    );
  }

  const handleExitWidget = () => {
    if (typeof window !== 'undefined' && 'electron' in window) {
      (window as any).electron.send('exit-widget');
    }
  };

  const formatTime = (val: number) => val.toString().padStart(2, '0');
  const showHours = timeLeft.h > 0;

  // Same filtered-index scheme the main focus screen uses for its checklist.
  const visibleGoals = objectives.goals.filter(g => g.trim());
  const toggleObjective = (idx: number) => {
    const next = { goals: objectives.goals, completed: [...objectives.completed] };
    next.completed[idx] = !next.completed[idx];
    setObjectives(next);
    localStorage.setItem('study-flow-objectives', JSON.stringify(next));
  };

  const remainingSeconds = timeLeft.h * 3600 + timeLeft.m * 60 + timeLeft.s;
  const totalSeconds = (initialDurationMinutes || 0) * 60;
  const progress = totalSeconds > 0 ? Math.min(1, Math.max(0, 1 - remainingSeconds / totalSeconds)) : 0;

  return (
    <div className="w-full h-full bg-transparent overflow-hidden select-none text-white">
      <style>{`
        @keyframes widget-drift-a {
          0%   { transform: translate(-18%, -30%) scale(1); }
          50%  { transform: translate(8%, 10%) scale(1.25); }
          100% { transform: translate(-12%, 22%) scale(1); }
        }
        @keyframes widget-drift-b {
          0%   { transform: translate(30%, 25%) scale(1.15); }
          50%  { transform: translate(-5%, -12%) scale(0.95); }
          100% { transform: translate(22%, -28%) scale(1.2); }
        }
      `}</style>

      <div
        style={DRAG}
        className="group w-full h-full rounded-[26px] relative overflow-hidden shadow-2xl ring-1 ring-white/15 cursor-grab active:cursor-grabbing"
      >
        {/* Fluid tinted backdrop — same DNA as the full focus screen */}
        <div className="absolute inset-0" style={{ backgroundColor: palette[3] || '#0a0a14' }} />
        <div
          className="absolute -inset-1/2 rounded-full opacity-80"
          style={{
            background: `radial-gradient(circle at center, ${palette[0]} 0%, transparent 65%)`,
            filter: 'blur(28px)',
            animation: 'widget-drift-a 16s ease-in-out infinite alternate'
          }}
        />
        <div
          className="absolute -inset-1/2 rounded-full opacity-70"
          style={{
            background: `radial-gradient(circle at center, ${palette[1] || palette[0]} 0%, transparent 65%)`,
            filter: 'blur(28px)',
            animation: 'widget-drift-b 20s ease-in-out infinite alternate'
          }}
        />
        {/* Glass veil for readability */}
        <div className={cn('absolute inset-0 transition-colors duration-700', isPaused ? 'bg-black/60' : 'bg-black/40')} />

        {/* Content */}
        <div className="relative h-full flex flex-col px-4 pt-2.5 pb-3">
          {activeTask ? (
            <>
              {/* Header: subject + status + maximize */}
              <div className="flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn(
                    'w-1.5 h-1.5 rounded-full shrink-0',
                    step === 'DONE' ? 'bg-emerald-400' : isPaused ? 'bg-amber-400' : 'bg-red-400 animate-pulse'
                  )} />
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60 truncate">
                    {activeTask.subject}{step !== 'DONE' && isPaused ? ' • Paused' : ''}
                  </span>
                </div>
                <button
                  style={NO_DRAG}
                  onClick={handleExitWidget}
                  className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/15 transition-colors"
                  title="Back to full focus mode"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Body: big time + controls */}
              <div className="flex-1 flex items-center justify-between gap-3 min-h-0">
                {step === 'DONE' ? (
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                    <div className="leading-tight">
                      <p className="text-lg font-heading font-black">Session complete</p>
                      <button
                        style={NO_DRAG}
                        onClick={handleExitWidget}
                        className="text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white transition-colors"
                      >
                        Open StudyFlow →
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className={cn(
                      'font-heading font-black tracking-tight tabular-nums leading-none drop-shadow-lg transition-opacity duration-500',
                      showHours ? 'text-[2rem]' : 'text-[2.4rem]',
                      isPaused && 'opacity-50'
                    )}>
                      {showHours && `${formatTime(timeLeft.h)}:`}
                      {formatTime(timeLeft.m)}
                      <span className="opacity-40">:</span>
                      <span className="text-[0.72em] text-white/80">{formatTime(timeLeft.s)}</span>
                    </span>

                    <div className="flex items-center gap-2 shrink-0" style={NO_DRAG}>
                      <button
                        onClick={() => (isPaused ? resumeFocus() : pauseFocus())}
                        className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-transform"
                        title={isPaused ? 'Resume' : 'Pause'}
                      >
                        {isPaused ? <Play className="w-4.5 h-4.5 fill-current ml-0.5" /> : <Pause className="w-4.5 h-4.5 fill-current" />}
                      </button>
                      <button
                        onClick={() => completeFocus()}
                        className="w-9 h-9 rounded-full bg-white/10 hover:bg-emerald-500/30 border border-white/15 text-white/70 hover:text-emerald-300 flex items-center justify-center transition-colors"
                        title="Finish session"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Objectives (synced live with the main focus screen) */}
              {step !== 'DONE' && visibleGoals.length > 0 && (
                <div className="shrink-0 max-h-[72px] overflow-y-auto space-y-1 mb-2 pr-1" style={NO_DRAG}>
                  {visibleGoals.map((goal, i) => (
                    <button
                      key={i}
                      onClick={() => toggleObjective(i)}
                      className="w-full flex items-center gap-2 text-left group/obj"
                    >
                      <span className={cn(
                        'w-3.5 h-3.5 rounded-[5px] border flex items-center justify-center shrink-0 transition-colors',
                        objectives.completed[i] ? 'bg-white border-white' : 'border-white/30 group-hover/obj:border-white/60'
                      )}>
                        {objectives.completed[i] && <Check className="w-2.5 h-2.5 text-black" strokeWidth={4} />}
                      </span>
                      <span className={cn(
                        'text-[11px] font-bold truncate transition-colors',
                        objectives.completed[i] ? 'text-white/30 line-through' : 'text-white/75'
                      )}>
                        {goal}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Footer: progress + now playing */}
              <div className="shrink-0 space-y-1.5">
                <div className="h-[3px] w-full rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-white/90 transition-[width] duration-1000 ease-linear"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
                {nowPlaying && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    {nowPlaying.coverUrl ? (
                      <img src={nowPlaying.coverUrl} alt="" className="w-3.5 h-3.5 rounded-[4px] object-cover shrink-0" draggable={false} />
                    ) : (
                      <Music className="w-3 h-3 text-white/40 shrink-0" />
                    )}
                    <p className="text-[10px] font-bold text-white/45 truncate">
                      {nowPlaying.title}{nowPlaying.artist ? ` — ${nowPlaying.artist}` : ''}
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* No active session */
            <div className="flex-1 flex flex-col items-center justify-center gap-1.5">
              <p className="text-sm font-bold text-white/60">No active focus session</p>
              <button
                style={NO_DRAG}
                onClick={handleExitWidget}
                className="text-[10px] font-black uppercase tracking-widest text-white hover:text-white/70 transition-colors"
              >
                Open StudyFlow →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
