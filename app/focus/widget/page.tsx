'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import {
  Check,
  CheckCircle2,
  Maximize2,
  Music,
  Pause,
  Play,
  RectangleHorizontal,
  Smartphone,
  Square,
  type LucideIcon,
} from 'lucide-react';

import { useFocus } from '@/lib/FocusContext';
import { cn } from '@/lib/utils';
import { DEFAULT_PALETTE } from '@/components/focus/useMusicPlayer';

/**
 * The desktop's small always-on-top focus window (opened from the focus
 * screen). It comes in three preset sizes, each with its own layout:
 *
 * - mini: a pill with the ring, the time and play/pause;
 * - compact: big time, controls, progress, goals count and the song;
 * - card: a tall card with a big progress ring, goals and the song.
 *
 * The chosen size is remembered (localStorage, shared with the main window,
 * which opens the widget at that size). The window itself is resized by the
 * desktop app (`widget:size` in desktop-app/main.js; keep WIDGET_SIZES there
 * in step with these names). Track, goals and the timer arrive from the main
 * window through localStorage / FocusContext.
 */

type WidgetSize = 'mini' | 'compact' | 'card';
const SIZE_KEY = 'study-flow-widget-size';
const SIZES: { id: WidgetSize; label: string; icon: LucideIcon }[] = [
  { id: 'mini', label: 'Mini', icon: RectangleHorizontal },
  { id: 'compact', label: 'Compact', icon: Smartphone },
  { id: 'card', label: 'Card', icon: Square },
];

const DRAG = { WebkitAppRegion: 'drag' } as React.CSSProperties;
const NO_DRAG = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

type Bridge = { send: (channel: string, data?: unknown) => void };
const bridge = (): Bridge | undefined => (window as unknown as { electron?: Bridge }).electron;

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
      completed: Array.isArray(data?.completed) ? data.completed : [],
    };
  } catch {
    return { goals: [], completed: [] };
  }
}

function readSize(): WidgetSize {
  try {
    const v = localStorage.getItem(SIZE_KEY);
    return v === 'mini' || v === 'card' || v === 'compact' ? v : 'compact';
  } catch {
    return 'compact';
  }
}

const pad = (n: number) => n.toString().padStart(2, '0');

export default function FocusWidgetPage() {
  const { activeTask, timeLeft, isPaused, pauseFocus, resumeFocus, completeFocus, initialDurationMinutes, step, openEnded } =
    useFocus();

  const [mounted, setMounted] = useState(false);
  const [size, setSize] = useState<WidgetSize>('compact');
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [objectives, setObjectives] = useState<Objectives>({ goals: [], completed: [] });

  useEffect(() => {
    // One read of browser-only state after mount, so the server render and
    // the first client render match.
    /* eslint-disable react-hooks/set-state-in-effect */
    setMounted(true);
    setSize(readSize());
    setNowPlaying(readNowPlaying());
    setObjectives(readObjectives());
    /* eslint-enable react-hooks/set-state-in-effect */

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'study-flow-now-playing' || e.key === null) setNowPlaying(readNowPlaying());
      if (e.key === 'study-flow-objectives' || e.key === null) setObjectives(readObjectives());
    };
    window.addEventListener('storage', onStorage);

    // Transparent page so the rounded card floats on the desktop.
    const html = document.documentElement;
    const body = document.body;
    const before = { html: html.style.backgroundColor, body: body.style.backgroundColor };
    html.style.backgroundColor = 'transparent';
    body.style.backgroundColor = 'transparent';
    body.classList.remove('bg-background');
    return () => {
      window.removeEventListener('storage', onStorage);
      html.style.backgroundColor = before.html;
      body.style.backgroundColor = before.body;
      body.classList.add('bg-background');
    };
  }, []);

  const togglePause = useCallback(() => (isPaused ? resumeFocus() : pauseFocus()), [isPaused, pauseFocus, resumeFocus]);

  // Space pauses and resumes, like the full focus screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && activeTask && step !== 'DONE') {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeTask, step, togglePause]);

  const chooseSize = (next: WidgetSize) => {
    if (next === size) return;
    setSize(next);
    try {
      localStorage.setItem(SIZE_KEY, next);
    } catch {}
    bridge()?.send('widget:size', next);
  };

  const exitWidget = () => bridge()?.send('exit-widget');

  const toggleObjective = (idx: number) => {
    const next = { goals: objectives.goals, completed: [...objectives.completed] };
    next.completed[idx] = !next.completed[idx];
    setObjectives(next);
    try {
      localStorage.setItem('study-flow-objectives', JSON.stringify(next));
    } catch {}
  };

  const palette = nowPlaying?.palette?.length ? nowPlaying.palette : DEFAULT_PALETTE;

  if (!mounted) return <div className="h-full w-full rounded-[28px] bg-black/80" />;

  const remaining = timeLeft.h * 3600 + timeLeft.m * 60 + timeLeft.s;
  const total = (initialDurationMinutes || 0) * 60;
  // Open-ended sessions count up and have no end, so no progress.
  const progress = !openEnded && total > 0 ? Math.min(1, Math.max(0, 1 - remaining / total)) : null;
  const time = `${timeLeft.h > 0 ? `${pad(timeLeft.h)}:` : ''}${pad(timeLeft.m)}:${pad(timeLeft.s)}`;
  // Same filtered-index scheme the main focus screen uses for its checklist.
  const goals = objectives.goals
    .map((text, i) => ({ text, i, done: Boolean(objectives.completed[i]) }))
    .filter((g) => g.text.trim());

  const view: ViewProps = {
    subject: activeTask?.subject ?? '',
    time,
    progress,
    openEnded,
    isPaused,
    done: step === 'DONE',
    goals,
    nowPlaying,
    onToggle: togglePause,
    onFinish: completeFocus,
    onExpand: exitWidget,
    onGoal: toggleObjective,
    size,
    onSize: chooseSize,
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="h-full w-full select-none overflow-hidden bg-transparent text-white">
        <div
          style={DRAG}
          className={cn(
            'group/w relative h-full w-full overflow-hidden ring-1 ring-inset ring-white/15',
            size === 'mini' && activeTask ? 'rounded-full' : 'rounded-[28px]'
          )}
        >
          <Backdrop palette={palette} dim={isPaused || step === 'DONE'} />

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTask ? size : 'idle'}
              initial={{ opacity: 0, filter: 'blur(8px)', scale: 0.97 }}
              animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
              exit={{ opacity: 0, filter: 'blur(8px)', scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
              className="relative h-full"
            >
              {!activeTask ? (
                <Idle onExpand={exitWidget} />
              ) : size === 'mini' ? (
                <MiniView {...view} />
              ) : size === 'card' ? (
                <CardView {...view} />
              ) : (
                <CompactView {...view} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}

type ViewProps = {
  subject: string;
  time: string;
  progress: number | null;
  openEnded: boolean;
  isPaused: boolean;
  done: boolean;
  goals: { text: string; i: number; done: boolean }[];
  nowPlaying: NowPlaying | null;
  onToggle: () => void;
  onFinish: () => void;
  onExpand: () => void;
  onGoal: (i: number) => void;
  size: WidgetSize;
  onSize: (s: WidgetSize) => void;
};

/* ------------------------------------------------------------- backdrop */

const WIDGET_CSS = `
  @keyframes widget-drift-a { 0% { transform: translate(-18%, -30%) scale(1); } 50% { transform: translate(8%, 10%) scale(1.25); } 100% { transform: translate(-12%, 22%) scale(1); } }
  @keyframes widget-drift-b { 0% { transform: translate(30%, 25%) scale(1.15); } 50% { transform: translate(-5%, -12%) scale(0.95); } 100% { transform: translate(22%, -28%) scale(1.2); } }
  @keyframes widget-eq { 0%, 100% { height: 30%; } 50% { height: 100%; } }
  @keyframes widget-slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }
  .widget-eq { height: 60%; animation: widget-eq 0.9s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) { .widget-drift, .widget-eq { animation: none !important; } }
`;

/** The song's colours drifting under a dark glass, like the full focus screen. */
function Backdrop({ palette, dim }: { palette: string[]; dim: boolean }) {
  return (
    <>
      <style>{WIDGET_CSS}</style>
      <div className="absolute inset-0" style={{ backgroundColor: palette[3] || '#0a0a14' }} />
      <div
        className="widget-drift absolute -inset-1/2 rounded-full opacity-80"
        style={{
          background: `radial-gradient(circle at center, ${palette[0]} 0%, transparent 65%)`,
          filter: 'blur(30px)',
          animation: 'widget-drift-a 16s ease-in-out infinite alternate',
        }}
      />
      <div
        className="widget-drift absolute -inset-1/2 rounded-full opacity-70"
        style={{
          background: `radial-gradient(circle at center, ${palette[1] || palette[0]} 0%, transparent 65%)`,
          filter: 'blur(30px)',
          animation: 'widget-drift-b 20s ease-in-out infinite alternate',
        }}
      />
      <div className={cn('absolute inset-0 transition-colors duration-700', dim ? 'bg-black/60' : 'bg-black/40')} />
      {/* A soft light along the top edge, for a bit of glass depth. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.07] to-transparent" />
    </>
  );
}

/* ----------------------------------------------------------- shared bits */

function StatusDot({ isPaused, done }: { isPaused: boolean; done: boolean }) {
  return (
    <span className="relative grid size-2 shrink-0 place-items-center">
      {!isPaused && !done && <span className="absolute inset-0 rounded-full bg-red-400 motion-safe:animate-ping" />}
      <span className={cn('relative size-2 rounded-full', done ? 'bg-emerald-400' : isPaused ? 'bg-amber-400' : 'bg-red-400')} />
    </span>
  );
}

function statusText(isPaused: boolean, done: boolean) {
  if (done) return 'Done';
  return isPaused ? 'Paused' : 'Focus';
}

/** The three preset sizes, shown on hover. */
function SizePicker({ size, onSize, className }: { size: WidgetSize; onSize: (s: WidgetSize) => void; className?: string }) {
  return (
    <div
      style={NO_DRAG}
      role="radiogroup"
      aria-label="Widget size"
      className={cn(
        'flex items-center rounded-full bg-black/25 p-0.5 ring-1 ring-inset ring-white/10 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover/w:opacity-100',
        className
      )}
    >
      {SIZES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={size === id}
          aria-label={`${label} size`}
          title={label}
          onClick={() => onSize(id)}
          className={cn('relative grid size-6 place-items-center rounded-full transition-colors', size === id ? 'text-black' : 'text-white/55 hover:text-white')}
        >
          {size === id && (
            <motion.span layoutId="widget-size" className="absolute inset-0 rounded-full bg-white" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
          )}
          <Icon className="relative size-3" strokeWidth={2.4} />
        </button>
      ))}
    </div>
  );
}

function IconButton({ label, onClick, children, className }: { label: string; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      style={NO_DRAG}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn('grid size-7 shrink-0 place-items-center rounded-full text-white/55 transition-colors hover:bg-white/15 hover:text-white', className)}
    >
      {children}
    </button>
  );
}

function PlayButton({ isPaused, onToggle, className }: { isPaused: boolean; onToggle: () => void; className?: string }) {
  return (
    <motion.button
      type="button"
      style={NO_DRAG}
      onClick={onToggle}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      aria-label={isPaused ? 'Resume' : 'Pause'}
      title={isPaused ? 'Resume (Space)' : 'Pause (Space)'}
      className={cn('grid shrink-0 place-items-center rounded-full bg-white text-black shadow-lg shadow-black/30', className)}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isPaused ? 'play' : 'pause'}
          initial={{ scale: 0.5, opacity: 0, rotate: -30 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.5, opacity: 0, rotate: 30 }}
          transition={{ duration: 0.15 }}
          className="grid place-items-center"
        >
          {isPaused ? <Play className="ml-0.5 size-4 fill-current" /> : <Pause className="size-4 fill-current" />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

function FinishButton({ onFinish, className }: { onFinish: () => void; className?: string }) {
  return (
    <button
      type="button"
      style={NO_DRAG}
      onClick={onFinish}
      aria-label="Finish session"
      title="Finish session"
      className={cn(
        'grid shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 text-white/75 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/25 hover:text-emerald-200',
        className
      )}
    >
      <CheckCircle2 className="size-4" />
    </button>
  );
}

/** Progress ring; open-ended sessions get a slow orbiting arc instead. */
function Ring({ progress, size, stroke, children }: { progress: number | null; size: number; stroke: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className={cn('absolute inset-0 -rotate-90', progress === null && 'motion-safe:animate-[spin_6s_linear_infinite]')}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="white"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={progress === null ? c * 0.78 : c * (1 - progress)}
          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          style={{ filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.45))' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

function Clock({ time, isPaused, className }: { time: string; isPaused: boolean; className?: string }) {
  const main = time.slice(0, -3);
  const secs = time.slice(-2);
  return (
    <span className={cn('font-heading font-black leading-none tracking-tight tabular-nums drop-shadow-lg transition-opacity duration-500', isPaused && 'opacity-50', className)}>
      {main}
      <span className="opacity-40">:</span>
      <span className="text-[0.7em] text-white/80">{secs}</span>
    </span>
  );
}

function SongRow({ nowPlaying, playing, className }: { nowPlaying: NowPlaying; playing: boolean; className?: string }) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      {nowPlaying.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={nowPlaying.coverUrl} alt="" className="size-5 shrink-0 rounded-md object-cover ring-1 ring-white/15" draggable={false} />
      ) : (
        <span className="grid size-5 shrink-0 place-items-center rounded-md bg-white/10">
          <Music className="size-3 text-white/60" />
        </span>
      )}
      <p className="min-w-0 truncate text-[11px] font-bold text-white/60">
        {nowPlaying.title}
        {nowPlaying.artist ? <span className="text-white/35"> · {nowPlaying.artist}</span> : null}
      </p>
      {playing && (
        <span aria-hidden className="ml-auto flex h-2.5 shrink-0 items-end gap-[2px]">
          {[0, 1, 2].map((i) => (
            <span key={i} className="widget-eq w-[2px] rounded-full bg-white/50" style={{ animationDelay: `${i * 0.18}s` }} />
          ))}
        </span>
      )}
    </div>
  );
}

function DoneBlock({ onExpand, big }: { onExpand: () => void; big?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3', big && 'flex-col text-center')}>
      <motion.span
        initial={{ scale: 0.3, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 15 }}
        className={cn('grid shrink-0 place-items-center rounded-full bg-emerald-400/20 text-emerald-300 ring-1 ring-emerald-300/30', big ? 'size-16' : 'size-10')}
      >
        <Check className={big ? 'size-8' : 'size-5'} strokeWidth={3} />
      </motion.span>
      <div className="leading-tight">
        <p className={cn('font-heading font-black', big ? 'text-2xl' : 'text-lg')}>Session complete</p>
        <button type="button" style={NO_DRAG} onClick={onExpand} className="mt-0.5 text-[11px] font-bold text-white/55 transition-colors hover:text-white">
          Open Study Flow →
        </button>
      </div>
    </div>
  );
}

function GoalsCount({ goals }: { goals: ViewProps['goals'] }) {
  if (!goals.length) return null;
  const done = goals.filter((g) => g.done).length;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-white/60">
      <CheckCircle2 className="size-3.5" />
      {done}/{goals.length} goals
    </span>
  );
}

function Header(v: ViewProps) {
  return (
    <div className="flex h-8 shrink-0 items-center justify-between gap-2">
      <p className="flex min-w-0 items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/60">
        <StatusDot isPaused={v.isPaused} done={v.done} />
        <span className="truncate">{v.subject}</span>
        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[9px] tracking-[0.14em] text-white/70">{statusText(v.isPaused, v.done)}</span>
      </p>
      <div className="flex shrink-0 items-center gap-1">
        <SizePicker size={v.size} onSize={v.onSize} />
        <IconButton label="Back to full focus mode" onClick={v.onExpand}>
          <Maximize2 className="size-3.5" />
        </IconButton>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- views */

function MiniView(v: ViewProps) {
  return (
    <div className="flex h-full items-center gap-3 pl-3 pr-6">
      {v.done ? (
        <div className="min-w-0 flex-1 pl-1">
          <DoneBlock onExpand={v.onExpand} />
        </div>
      ) : (
        <>
          <Ring progress={v.progress} size={64} stroke={4}>
            <PlayButton isPaused={v.isPaused} onToggle={v.onToggle} className="size-11" />
          </Ring>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/60">
              <StatusDot isPaused={v.isPaused} done={v.done} />
              <span className="truncate">{v.subject}</span>
            </p>
            <Clock time={v.time} isPaused={v.isPaused} className="mt-1 block text-[1.75rem]" />
          </div>
        </>
      )}
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <SizePicker size={v.size} onSize={v.onSize} />
        <div className="flex items-center gap-0.5">
          {!v.done && <FinishButton onFinish={v.onFinish} className="size-7 [&_svg]:size-3.5" />}
          <IconButton label="Back to full focus mode" onClick={v.onExpand}>
            <Maximize2 className="size-3.5" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

function CompactView(v: ViewProps) {
  return (
    <div className="flex h-full flex-col px-4 pb-3.5 pt-2.5">
      <Header {...v} />
      <div className="flex min-h-0 flex-1 items-center justify-between gap-3">
        {v.done ? (
          <DoneBlock onExpand={v.onExpand} />
        ) : (
          <>
            <Clock time={v.time} isPaused={v.isPaused} className={v.time.length > 5 ? 'text-[2.4rem]' : 'text-[2.9rem]'} />
            <div className="flex shrink-0 items-center gap-2">
              <FinishButton onFinish={v.onFinish} className="size-10" />
              <PlayButton isPaused={v.isPaused} onToggle={v.onToggle} className="size-12" />
            </div>
          </>
        )}
      </div>
      <div className="shrink-0 space-y-2">
        {!v.done && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/15">
            {v.progress === null ? (
              <div className="h-full w-1/4 rounded-full bg-white/80 motion-safe:animate-[widget-slide_2.4s_ease-in-out_infinite]" />
            ) : (
              <div
                className="h-full rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.6)] transition-[width] duration-1000 ease-linear"
                style={{ width: `${v.progress * 100}%` }}
              />
            )}
          </div>
        )}
        <div className="flex items-center gap-3">
          {v.nowPlaying ? <SongRow nowPlaying={v.nowPlaying} playing={!v.isPaused && !v.done} className="flex-1" /> : <span className="flex-1" />}
          <GoalsCount goals={v.goals} />
        </div>
      </div>
    </div>
  );
}

function CardView(v: ViewProps) {
  return (
    <div className="flex h-full flex-col px-4 pb-4 pt-2.5">
      <Header {...v} />
      {v.done ? (
        <div className="flex flex-1 items-center justify-center">
          <DoneBlock onExpand={v.onExpand} big />
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center pt-2">
            <Ring progress={v.progress} size={168} stroke={7}>
              <div className="text-center">
                <Clock time={v.time} isPaused={v.isPaused} className={v.time.length > 5 ? 'text-[1.9rem]' : 'text-[2.6rem]'} />
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
                  {v.progress === null ? 'focused' : `${Math.round(v.progress * 100)}% done`}
                </p>
              </div>
            </Ring>
            <div className="mt-3 flex items-center gap-3">
              <FinishButton onFinish={v.onFinish} className="size-10" />
              <PlayButton isPaused={v.isPaused} onToggle={v.onToggle} className="size-12" />
            </div>
          </div>

          <div className="mt-3 min-h-0 flex-1 space-y-0.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={NO_DRAG}>
            {v.goals.map((g) => (
              <button
                key={g.i}
                type="button"
                onClick={() => v.onGoal(g.i)}
                className="group/obj flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-white/10"
              >
                <span
                  className={cn(
                    'grid size-4 shrink-0 place-items-center rounded-full border transition-colors',
                    g.done ? 'border-emerald-300 bg-emerald-400 text-black' : 'border-white/35 group-hover/obj:border-white/70'
                  )}
                >
                  {g.done && <Check className="size-2.5" strokeWidth={4} />}
                </span>
                <span className={cn('truncate text-xs font-bold transition-colors', g.done ? 'text-white/35 line-through' : 'text-white/80')}>{g.text}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {v.nowPlaying && (
        <SongRow nowPlaying={v.nowPlaying} playing={!v.isPaused && !v.done} className="mt-2 shrink-0 rounded-xl bg-black/20 px-2 py-1.5" />
      )}
    </div>
  );
}

function Idle({ onExpand }: { onExpand: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 px-4 text-center">
      <p className="text-sm font-bold text-white/65">No focus session running</p>
      <button type="button" style={NO_DRAG} onClick={onExpand} className="text-[11px] font-bold text-white transition-colors hover:text-white/70">
        Open Study Flow →
      </button>
    </div>
  );
}
