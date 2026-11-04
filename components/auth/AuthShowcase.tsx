'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { Flame, Pause, Square } from 'lucide-react';
import styles from './AuthShowcase.module.css';

/*
 * The right-hand panel on /login and /register: a slow carousel of small,
 * animated previews of the real app. All data is illustrative and follows the
 * shape of a normal weekly routine.
 */

const ease = [0.22, 1, 0.36, 1] as const;
const SLIDE_MS = 6500;
const rise = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease },
});

function CountUp({ to, decimals = 0, delay = 0.3 }: { to: number; decimals?: number; delay?: number }) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? to : 0);
  useEffect(() => {
    if (reduced) return;
    const controls = animate(0, to, { duration: 1.2, delay, ease, onUpdate: setValue });
    return () => controls.stop();
  }, [to, delay, reduced]);
  return <span className="tabular-nums">{value.toFixed(decimals)}</span>;
}

function Card({ label, title, aside, children }: { label: string; title: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode }) {
  return <div className="flex h-[440px] flex-col rounded-2xl border border-border bg-card/95 p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,.55)] ring-1 ring-white/[0.03] backdrop-blur">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-semibold tracking-tight">{title}</p>
      </div>
      {aside}
    </div>
    <div className="mt-5 flex min-h-0 flex-1 flex-col">{children}</div>
  </div>;
}

function Ring({ to, delay = 0 }: { to: number; delay?: number }) {
  const c = 2 * Math.PI * 15;
  return <div className="relative size-14">
    <svg viewBox="0 0 36 36" className="size-14 -rotate-90" aria-hidden="true">
      <circle cx="18" cy="18" r="15" fill="none" className="stroke-border" strokeWidth="3.5" />
      <motion.circle cx="18" cy="18" r="15" fill="none" className="stroke-primary" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={c}
        initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - to) }} transition={{ duration: 0.9, delay, ease }} />
    </svg>
    <span className="absolute inset-0 grid place-items-center whitespace-nowrap text-[10px] font-semibold"><span><CountUp to={Math.round(to * 100)} delay={delay} />%</span></span>
  </div>;
}

const TODAY = [
  { time: '19:00 – 21:30', subject: 'Physics', type: 'Homework', state: 'done' },
  { time: '21:30 – 22:30', subject: 'Database', type: 'Homework', state: 'now' },
  { time: '22:30 – 23:30', subject: 'C programming', type: 'Homework', state: 'next' },
  { time: 'Saturday 18:00', subject: 'Javascript', type: 'Revision', state: 'next' },
] as const;
function TodaySlide() {
  return <Card label="Today" title="3 blocks · 5 hours" aside={<Ring to={1 / 3} delay={1.5} />}>
    <ul className="grid gap-2.5">
      {TODAY.map((b, i) => {
        const homework = b.type === 'Homework';
        const done = b.state === 'done';
        return <motion.li key={b.subject} {...rise(0.15 + i * 0.1)}
          className={`relative flex items-center gap-3 rounded-xl border-2 bg-background/40 px-4 py-3 ${homework ? 'border-blue-500/70' : 'border-dashed border-orange-500/70'} ${b.state === 'now' ? 'shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_14%,transparent)]' : ''}`}>
          <span className="relative grid size-5 shrink-0 place-items-center rounded-md border border-border">
            {done && <motion.span className="absolute inset-0 grid place-items-center rounded-md bg-emerald-500 text-white"
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.3, type: 'spring', stiffness: 420, damping: 18 }}>
              <svg viewBox="0 0 16 16" className="size-3"><motion.path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.45, duration: 0.3 }} /></svg>
            </motion.span>}
          </span>
          <span className="min-w-0 flex-1">
            <motion.span className="relative inline-block font-medium" animate={done ? { opacity: 0.55 } : undefined} transition={{ delay: 1.6 }}>
              {b.subject}
              {done && <motion.span className="absolute inset-x-0 top-1/2 h-px origin-left bg-current" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.6, duration: 0.35 }} />}
            </motion.span>
            <span className="block text-xs text-muted-foreground">{b.time}</span>
          </span>
          {b.state === 'now'
            ? <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary"><span className={styles.pulse} />Now</span>
            : <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${homework ? 'bg-blue-500/15 text-blue-400' : 'bg-orange-500/15 text-orange-400'}`}>{b.type}</span>}
        </motion.li>;
      })}
    </ul>
  </Card>;
}

// Hours per block, Monday to Sunday; Friday to Sunday are revision days.
const WEEK = [[0.5, 1, 0.5], [1.5, 0.5, 1.5], [2.5, 1, 1], [2.5, 1, 1.5], [1.5, 1, 1.5], [2.5, 1.5], [1.5, 1.5]];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function WeekSlide() {
  return <Card label="This week" title={<><CountUp to={19} /> blocks · <CountUp to={30} /> hours</>}>
    <div className="grid flex-1 grid-cols-7 gap-1.5">
      {WEEK.map((blocks, d) => {
        const revision = d >= 4;
        const today = d === 2;
        return <div key={DAYS[d]} className={`flex flex-col gap-1.5 rounded-lg p-1 ${today ? 'bg-primary/[0.07]' : ''}`}>
          <span className={`pb-1 text-center text-[11px] font-semibold ${today ? 'text-primary' : 'text-muted-foreground'}`}>{DAYS[d]}</span>
          {blocks.map((h, j) => <motion.span key={j}
            className={`origin-top rounded-[6px] border-2 ${revision ? 'border-dashed border-orange-500/70 bg-orange-500/10' : 'border-blue-500/70 bg-blue-500/15'}`}
            style={{ height: h * 30 }}
            initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.2 + d * 0.08 + j * 0.06, ease }} />)}
        </div>;
      })}
    </div>
    <motion.div className="mt-4 flex gap-4 text-xs text-muted-foreground" {...rise(1)}>
      <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm border-2 border-blue-500/70" />Homework</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm border-2 border-dashed border-orange-500/70" />Revision</span>
    </motion.div>
  </Card>;
}

const FOCUS_TOTAL = 25 * 60;
function FocusSlide() {
  const reduced = useReducedMotion();
  const [left, setLeft] = useState(18 * 60 + 42);
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setLeft((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(t);
  }, [reduced]);
  const c = 2 * Math.PI * 54;
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return <Card label="Focus" title="Physics · Homework">
    <div className="flex flex-1 flex-col items-center justify-center">
      <div className="relative">
        <div className={styles.halo} aria-hidden="true" />
        <svg viewBox="0 0 120 120" className="relative size-48 -rotate-90" aria-hidden="true">
          <circle cx="60" cy="60" r="54" fill="none" className="stroke-border" strokeWidth="6" />
          <motion.circle cx="60" cy="60" r="54" fill="none" className="stroke-primary" strokeWidth="6" strokeLinecap="round" strokeDasharray={c}
            initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (left / FOCUS_TOTAL) }} transition={{ duration: 0.9, ease }} />
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-semibold tabular-nums tracking-tight">{mm}:{ss}</span>
          <span className="mt-1 text-xs text-muted-foreground">remaining</span>
        </span>
      </div>
      <div className="mt-6 flex items-center gap-2">
        {[0, 1, 2, 3].map((i) => <motion.span key={i} className={`size-2 rounded-full ${i < 2 ? 'bg-primary' : i === 2 ? styles.current : 'bg-border'}`} {...rise(0.3 + i * 0.08)} />)}
        <span className="ml-2 text-xs text-muted-foreground">Session 3 of 4</span>
      </div>
      <motion.div className="mt-5 flex gap-2" {...rise(0.6)}>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium"><Pause className="size-3.5" />Pause</span>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium"><Square className="size-3.5" />Stop</span>
      </motion.div>
    </div>
  </Card>;
}

// Five weeks, Monday first, oldest first; true = studied that day. The last 12 are the streak.
const STUDIED = [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1].map(Boolean);
function StreakSlide() {
  return <Card label="Streak" title={<><CountUp to={12} delay={0.9} /> days in a row</>}
    aside={<motion.span initial={{ scale: 0.6, opacity: 0, rotate: -12 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ delay: 1.1, type: 'spring', stiffness: 300, damping: 12 }}
      className="grid size-11 place-items-center rounded-xl bg-orange-500/15 text-orange-400"><Flame className={`size-5 ${styles.flicker}`} /></motion.span>}>
    <div className="mx-auto">
      <div className="mb-2 grid grid-cols-7 gap-2 text-center text-[10px] font-medium text-muted-foreground">
        {DAYS.map((d) => <span key={d}>{d.slice(0, 1)}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {STUDIED.map((on, i) => {
          const last = i === STUDIED.length - 1;
          return <motion.span key={i}
            className={`size-9 rounded-lg ${on ? (i >= 23 ? 'bg-emerald-500' : 'bg-emerald-500/35') : 'bg-muted'} ${last ? styles.today : ''}`}
            initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.1 + i * 0.025 }} />;
        })}
      </div>
    </div>
    <motion.div className="mt-auto flex justify-between border-t border-border pt-4 text-xs text-muted-foreground" {...rise(1.2)}>
      <span>Best streak: <span className="font-medium text-foreground">18 days</span></span>
      <span>Studied 28 of the last 35 days</span>
    </motion.div>
  </Card>;
}

const HOURS = [1.5, 3.5, 4.5, 5, 4, 4, 3];
function ProgressSlide() {
  return <Card label="This week" title={<><CountUp to={25.5} decimals={1} /> hours studied</>}>
    <div className="flex flex-1 items-end gap-3 pt-8">
      {HOURS.map((h, i) => <div key={DAYS[i]} className="flex h-full flex-1 flex-col items-center gap-2">
        <div className="relative w-full flex-1">
          <motion.span className={`absolute inset-x-0 bottom-0 origin-bottom rounded-md ${i === 3 ? 'bg-primary' : 'bg-primary/45'}`} style={{ height: `${(h / 5) * 100}%` }}
            initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.7, delay: 0.2 + i * 0.08, ease }} />
          {i === 3 && <motion.span className="absolute inset-x-0 -top-0 -translate-y-6 text-center text-[11px] font-semibold" {...rise(1)}>5h</motion.span>}
        </div>
        <span className="text-[11px] text-muted-foreground">{DAYS[i].slice(0, 1)}</span>
      </div>)}
    </div>
    <div className="mt-5 border-t border-border pt-4">
      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Blocks done</span><span className="font-medium"><CountUp to={14} delay={0.9} /> of 19</span></div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div className="h-full rounded-full bg-emerald-500" initial={{ width: 0 }} animate={{ width: `${(14 / 19) * 100}%` }} transition={{ duration: 0.9, delay: 0.9, ease }} />
      </div>
    </div>
  </Card>;
}

const SLIDES = [
  { title: 'Today’s schedule', text: 'See what’s due today and tick it off as you go.', View: TodaySlide },
  { title: 'Your week', text: 'Homework in blue, revision in orange, Monday to Sunday.', View: WeekSlide },
  { title: 'Focus timer', text: 'Time each study block and log it automatically.', View: FocusSlide },
  { title: 'Streaks', text: 'Keep a daily streak going and see every day you studied.', View: StreakSlide },
  { title: 'Progress', text: 'Hours studied and blocks finished, week by week.', View: ProgressSlide },
];

export function AuthShowcase() {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const slide = SLIDES[index];
  const next = () => setIndex((i) => (i + 1) % SLIDES.length);

  // A gentle tilt towards the pointer.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, [-1, 1], [-6, 6]), { stiffness: 120, damping: 18 });
  const rotateX = useSpring(useTransform(py, [-1, 1], [5, -5]), { stiffness: 120, damping: 18 });
  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set(((e.clientX - r.left) / r.width) * 2 - 1);
    py.set(((e.clientY - r.top) / r.height) * 2 - 1);
  };

  return <section
    aria-roledescription="carousel" aria-label="What Study Flow does"
    className="relative w-full max-w-[440px] [perspective:1200px]"
    onPointerMove={onMove}
    onPointerEnter={() => setPaused(true)}
    onPointerLeave={() => { setPaused(false); px.set(0); py.set(0); }}
    onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
    <motion.div style={{ rotateX, rotateY }} className="[transform-style:preserve-3d]">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={index} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${SLIDES.length}: ${slide.title}`}
          initial={{ opacity: 0, y: 24, scale: 0.97, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -16, scale: 0.98, filter: 'blur(6px)' }}
          transition={{ duration: 0.5, ease }} className={styles.float}>
          <slide.View />
        </motion.div>
      </AnimatePresence>
    </motion.div>

    <div className="mt-8">
      <div className="flex items-start justify-between gap-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={index} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
            <p className="font-semibold">{slide.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{slide.text}</p>
          </motion.div>
        </AnimatePresence>
        <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">{String(index + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}</span>
      </div>
      <div className="mt-4 flex gap-1.5">
        {SLIDES.map((s, i) => <button key={s.title} type="button" onClick={() => setIndex(i)}
          aria-label={`Show ${s.title}`} aria-current={i === index ? 'true' : undefined}
          className="group relative h-6 flex-1 cursor-pointer focus-visible:outline-none">
          <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-foreground/15 transition group-hover:bg-foreground/25 group-focus-visible:ring-2 group-focus-visible:ring-ring">
            {i < index && <span className="absolute inset-0 bg-foreground/70" />}
            {i === index && (reduced
              ? <span className="absolute inset-0 bg-foreground/70" />
              : <span key={index} className={styles.fill} style={{ animationDuration: `${SLIDE_MS}ms`, animationPlayState: paused ? 'paused' : 'running' }} onAnimationEnd={next} />)}
          </span>
        </button>)}
      </div>
    </div>
  </section>;
}
