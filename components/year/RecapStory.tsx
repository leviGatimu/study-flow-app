"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, animate, motion, useReducedMotion, type Variants } from "framer-motion";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { hours, monthName, studyTimeLabel, WEEKDAYS, type YearRecap } from "@/lib/year-recap";

/**
 * The year recap as a full-screen story: one highlight per slide, each slide
 * advancing on its own, like the year-in-review stories music apps make.
 *
 * Tap the right of the screen (or press the right arrow) for the next slide,
 * the left for the one before; hold, or press Space, to pause; Escape closes.
 * Slides with nothing to say (no exams marked, say) are left out.
 *
 * Always dark, whatever the app theme: each slide has its own colour wash.
 */

const SLIDE_MS = 6500;

type Slide = { key: string; wash: string; body: React.ReactNode; label: string };

/* ---------- formatting ---------- */

const fmt = (n: number) => n.toLocaleString("en-GB");

function hm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function longDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  });
}

function monthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

/* ---------- motion ---------- */

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.18, delayChildren: 0.1 } },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

function Rise({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={rise} className={className}>
      {children}
    </motion.div>
  );
}

/** Counts from 0 to `to` once the slide shows; jumps straight there with reduced motion. */
function CountUp({ to, suffix = "", delay = 0.3 }: { to: number; suffix?: string; delay?: number }) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? to : 0);
  useEffect(() => {
    if (reduced) return;
    const controls = animate(0, to, {
      duration: 1.6,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [to, delay, reduced]);
  return (
    <span className="tabular-nums">
      {fmt(value)}
      {suffix}
    </span>
  );
}

/** Bars that grow from the bottom one after another. */
function MonthBars({ months }: { months: YearRecap["months"] }) {
  const max = Math.max(1, ...months.map((m) => m.minutes));
  const peak = months.reduce((best, m, i) => (m.minutes > months[best].minutes ? i : best), 0);
  return (
    <div className="mx-auto mt-8 w-full max-w-md">
      <div className="flex h-28 items-end gap-1.5" aria-hidden="true">
        {months.map((m, i) => (
          <motion.div
            key={m.key}
            className={cn("flex-1 rounded-t-md", i === peak ? "bg-white" : "bg-white/35")}
            initial={{ height: 0 }}
            animate={{ height: `${Math.max(4, (m.minutes / max) * 100)}%` }}
            transition={{ delay: 0.6 + i * 0.06, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </div>
      <div className="mt-2 flex gap-1.5 text-[10px] font-medium uppercase text-white/60" aria-hidden="true">
        {months.map((m) => (
          <span key={m.key} className="flex-1 text-center">
            {monthName(m.key, false).slice(0, 1)}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- slides ---------- */

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <Rise className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">{children}</Rise>
);

const Big = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <Rise className={cn("font-heading text-6xl font-black leading-none tracking-tight text-white sm:text-8xl", className)}>
    {children}
  </Rise>
);

const Line = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <Rise className={cn("text-lg font-medium text-white/85 sm:text-xl", className)}>{children}</Rise>
);

function buildSlides(r: YearRecap): Slide[] {
  const slides: Slide[] = [];
  const range = `${monthYear(r.startedAt)} – ${r.completedAt ? monthYear(r.completedAt) : "now"}`;

  slides.push({
    key: "intro",
    label: `${r.label}, ${range}. Here is your year.`,
    wash: "from-blue-600 via-indigo-700 to-slate-950",
    body: (
      <>
        <Eyebrow>{range}</Eyebrow>
        <Big className="text-7xl sm:text-9xl">{r.label}</Big>
        <Line>Here is your year, in numbers.</Line>
      </>
    ),
  });

  if (r.minutes > 0) {
    const days = Math.round(r.minutes / 60 / 24);
    slides.push({
      key: "hours",
      label: `You studied for ${hours(r.minutes)} hours.`,
      wash: "from-violet-600 via-purple-800 to-slate-950",
      body: (
        <>
          <Eyebrow>You studied for</Eyebrow>
          <Big>
            <CountUp to={hours(r.minutes)} />
          </Big>
          <Line>hours</Line>
          {r.months.length > 1 && <MonthBars months={r.months} />}
          <Line className="mt-4 text-base text-white/75 sm:text-lg">
            {days >= 1 ? `That is ${days} full ${days === 1 ? "day" : "days"}, around the clock.` : `Across ${fmt(r.blocksDone)} blocks.`}
            {r.focusMinutes > 0 && ` ${hm(r.focusMinutes)} of it in focus sessions.`}
          </Line>
        </>
      ),
    });
  }

  const top = r.subjects[0];
  if (top) {
    slides.push({
      key: "top-subject",
      label: `Your most studied subject was ${top.subject}, ${hours(top.minutes)} hours.`,
      wash: "from-teal-500 via-emerald-700 to-slate-950",
      body: (
        <>
          <Eyebrow>Your number one subject</Eyebrow>
          <Big className="break-words text-5xl sm:text-7xl">{top.subject}</Big>
          <Line>
            <CountUp to={hours(top.minutes)} /> hours, {top.share}% of everything you studied.
          </Line>
        </>
      ),
    });
  }

  if (r.subjects.length >= 3) {
    const five = r.subjects.slice(0, 5);
    const max = five[0].minutes || 1;
    slides.push({
      key: "top-five",
      label: `Your top subjects: ${five.map((s) => s.subject).join(", ")}.`,
      wash: "from-sky-500 via-blue-800 to-slate-950",
      body: (
        <>
          <Eyebrow>Your top {five.length}</Eyebrow>
          <ol className="mx-auto mt-4 w-full max-w-md space-y-3 text-left">
            {five.map((s, i) => (
              <motion.li
                key={s.subject}
                variants={rise}
                className="relative overflow-hidden rounded-xl bg-white/10 px-4 py-3"
              >
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 bg-white/15"
                  initial={{ width: 0 }}
                  animate={{ width: `${(s.minutes / max) * 100}%` }}
                  transition={{ delay: 0.5 + i * 0.15, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                />
                <span className="relative flex items-baseline gap-3">
                  <span className="w-5 font-heading text-lg font-black text-white/60">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-lg font-bold text-white">{s.subject}</span>
                  <span className="shrink-0 tabular-nums text-white/80">{hours(s.minutes)}h</span>
                </span>
              </motion.li>
            ))}
          </ol>
        </>
      ),
    });
  }

  if (r.busiestMonth && r.months.length > 1) {
    slides.push({
      key: "month",
      label: `Your biggest month was ${monthName(r.busiestMonth.key)}.`,
      wash: "from-amber-500 via-orange-700 to-slate-950",
      body: (
        <>
          <Eyebrow>Your biggest month</Eyebrow>
          <Big>{monthName(r.busiestMonth.key, false)}</Big>
          <Line>{hm(r.busiestMonth.minutes)} of study in one month.</Line>
          {r.bestDay && (
            <Line className="mt-6 text-base text-white/75 sm:text-lg">
              Your best single day was {longDay(r.bestDay.day)}: {hm(r.bestDay.minutes)}.
            </Line>
          )}
        </>
      ),
    });
  }

  if (r.favouriteHour !== null) {
    slides.push({
      key: "when",
      label: `${studyTimeLabel(r.favouriteHour)} Most study started at ${hourLabel(r.favouriteHour)}.`,
      wash: "from-indigo-500 via-slate-800 to-black",
      body: (
        <>
          <Eyebrow>When you studied</Eyebrow>
          <Big className="tabular-nums">{hourLabel(r.favouriteHour)}</Big>
          <Line>{studyTimeLabel(r.favouriteHour)}</Line>
          {r.busiestWeekday && (
            <Line className="mt-6 text-base text-white/75 sm:text-lg">
              {WEEKDAYS[r.busiestWeekday.weekday]}s were your busiest day of the week.
            </Line>
          )}
        </>
      ),
    });
  }

  if (r.activeDays > 0) {
    slides.push({
      key: "consistency",
      label: `You studied on ${r.activeDays} days, ${r.longestRun} in a row at best, and finished ${r.completion}% of your planned blocks.`,
      wash: "from-rose-500 via-pink-800 to-slate-950",
      body: (
        <>
          <Eyebrow>You showed up on</Eyebrow>
          <Big>
            <CountUp to={r.activeDays} />
          </Big>
          <Line>different days</Line>
          <div className="mx-auto mt-8 grid w-full max-w-md grid-cols-2 gap-3">
            <Rise className="rounded-2xl bg-white/10 p-4">
              <p className="font-heading text-4xl font-black text-white"><CountUp to={r.longestRun} delay={0.8} /></p>
              <p className="text-sm text-white/75">days in a row, your longest run</p>
            </Rise>
            <Rise className="rounded-2xl bg-white/10 p-4">
              <p className="font-heading text-4xl font-black text-white"><CountUp to={r.completion} suffix="%" delay={0.9} /></p>
              <p className="text-sm text-white/75">of planned blocks done ({fmt(r.blocksDone)})</p>
            </Rise>
          </div>
        </>
      ),
    });
  }

  if (r.examsMarked > 0 && r.examAverage !== null) {
    slides.push({
      key: "exams",
      label: `Across ${r.examsMarked} marked exams you averaged ${Math.round(r.examAverage)}%.`,
      wash: "from-emerald-500 via-teal-800 to-slate-950",
      body: (
        <>
          <Eyebrow>Across {r.examsMarked} marked {r.examsMarked === 1 ? "exam" : "exams"} you averaged</Eyebrow>
          <Big>
            <CountUp to={Math.round(r.examAverage)} suffix="%" />
          </Big>
          {r.bestExam && (
            <Line className="mt-6">
              Best result: <span className="font-bold text-white">{r.bestExam.title}</span>, {Math.round(r.bestExam.percent)}%.
            </Line>
          )}
        </>
      ),
    });
  }

  if (r.homeworkDone > 0 || r.practiceAttempts > 0) {
    slides.push({
      key: "work",
      label: `${r.homeworkDone} homework finished and ${r.practiceAttempts} practice tries.`,
      wash: "from-cyan-500 via-sky-800 to-slate-950",
      body: (
        <>
          <Eyebrow>The work behind it</Eyebrow>
          <div className="mx-auto mt-4 grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
            {r.homeworkDone > 0 && (
              <Rise className="rounded-2xl bg-white/10 p-5">
                <p className="font-heading text-5xl font-black text-white"><CountUp to={r.homeworkDone} /></p>
                <p className="text-white/80">homework finished</p>
                <p className="mt-1 text-sm text-white/60">{r.homeworkOnTime} on time</p>
              </Rise>
            )}
            {r.practiceAttempts > 0 && (
              <Rise className="rounded-2xl bg-white/10 p-5">
                <p className="font-heading text-5xl font-black text-white"><CountUp to={r.practiceAttempts} /></p>
                <p className="text-white/80">practice {r.practiceAttempts === 1 ? "try" : "tries"}</p>
                {r.practiceBest !== null && <p className="mt-1 text-sm text-white/60">best score {r.practiceBest}%</p>}
              </Rise>
            )}
          </div>
        </>
      ),
    });
  }

  if (r.xp > 0) {
    slides.push({
      key: "xp",
      label: `You earned ${r.xp} XP.`,
      wash: "from-fuchsia-500 via-violet-800 to-slate-950",
      body: (
        <>
          <Eyebrow>You earned</Eyebrow>
          <Big>
            <CountUp to={r.xp} />
          </Big>
          <Line>XP this year</Line>
          {r.longestSessionMinutes > 0 && (
            <Line className="mt-6 text-base text-white/75 sm:text-lg">
              Your longest focus session lasted {hm(r.longestSessionMinutes)}.
            </Line>
          )}
        </>
      ),
    });
  }

  slides.push({
    key: "summary",
    label: `${r.label} in short.`,
    wash: "from-blue-600 via-indigo-800 to-black",
    body: <Summary recap={r} />,
  });

  return slides;
}

function Summary({ recap: r }: { recap: YearRecap }) {
  const items: [string, string][] = [
    ["Hours studied", fmt(hours(r.minutes))],
    ["Top subject", r.subjects[0]?.subject ?? "None"],
    ["Days studied", fmt(r.activeDays)],
    ["Longest run", `${r.longestRun} ${r.longestRun === 1 ? "day" : "days"}`],
    ["Exam average", r.examAverage !== null ? `${Math.round(r.examAverage)}%` : "No marks"],
    ["Homework done", fmt(r.homeworkDone)],
  ];
  return (
    <>
      <Eyebrow>{r.label} in short</Eyebrow>
      <Rise className="mx-auto mt-4 w-full max-w-md rounded-3xl border border-white/15 bg-white/10 p-6 text-left shadow-2xl backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate font-heading text-3xl font-black text-white">{r.label}</p>
            <p className="text-sm text-white/65">
              {monthYear(r.startedAt)} – {r.completedAt ? monthYear(r.completedAt) : "now"}
            </p>
          </div>
          {r.grade && (
            <div className="shrink-0 text-center">
              <p className="font-heading text-4xl font-black text-white">{r.grade}</p>
              <p className="text-[11px] uppercase tracking-wider text-white/60">Grade</p>
            </div>
          )}
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5">
          {items.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs uppercase tracking-wider text-white/55">{label}</dt>
              <dd className="truncate font-heading text-xl font-bold text-white">{value}</dd>
            </div>
          ))}
        </dl>
      </Rise>
    </>
  );
}

/* ---------- the player ---------- */

export function RecapStory({ recap, onClose }: { recap: YearRecap; onClose: () => void }) {
  const slides = useMemo(() => buildSlides(recap), [recap]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Bumped on replay so the first slide's animations run again.
  const [round, setRound] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const press = useRef<{ at: number; x: number } | null>(null);
  const last = index === slides.length - 1;

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, slides.length - 1)), [slides.length]);
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);
  const replay = () => {
    setIndex(0);
    setPaused(false);
    setRound((r) => r + 1);
  };

  useEffect(() => {
    closeRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " ") {
        // Space on a focused button would also click it.
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose]);

  // A tap moves; a hold pauses until released.
  const onPointerDown = (e: React.PointerEvent) => {
    press.current = { at: Date.now(), x: e.clientX };
    setPaused(true);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const p = press.current;
    press.current = null;
    setPaused(false);
    if (!p || Date.now() - p.at > 250) return;
    const { left, width } = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientX - left < width * 0.3) prev();
    else next();
  };

  const slide = slides[index];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${recap.label} recap`}
      className="dark fixed inset-0 z-[100] flex flex-col overflow-hidden bg-black text-white"
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={`${slide.key}-wash`}
          aria-hidden="true"
          className={cn("absolute inset-0 bg-gradient-to-br", slide.wash)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
        />
      </AnimatePresence>
      {/* Soft light that drifts, so a still slide does not look frozen. */}
      <div aria-hidden="true" className="recap-glow pointer-events-none absolute -left-1/4 -top-1/4 size-[80vmax] rounded-full bg-white/10 blur-3xl" />

      {/* Progress: one segment per slide. */}
      <div className="relative z-10 flex gap-1.5 px-4 pt-4 sm:px-6">
        {slides.map((s, i) => (
          <div key={s.key} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
            {(i < index || (i === index && last)) && <div className="h-full w-full bg-white" />}
            {i === index && !last && (
              <div
                key={`${s.key}-${round}`}
                className="recap-progress h-full bg-white"
                style={{ animationDuration: `${SLIDE_MS}ms`, animationPlayState: paused ? "paused" : "running" }}
                onAnimationEnd={next}
              />
            )}
          </div>
        ))}
      </div>

      <div className="relative z-10 flex items-center justify-between px-4 pt-3 sm:px-6">
        <p className="text-sm font-semibold text-white/80">{recap.label} recap</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Play" : "Pause"}
            className="flex size-10 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/15"
          >
            {paused ? <Play className="size-5" /> : <Pause className="size-5" />}
          </button>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close the recap"
            className="flex size-10 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/15"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      {/* The whole stage is the tap target; the summary's buttons sit above it. */}
      <div
        className="relative z-10 flex flex-1 touch-manipulation select-none items-center justify-center px-6 pb-10"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { press.current = null; setPaused(false); }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`${slide.key}-${round}`}
            className="flex w-full max-w-2xl flex-col items-center gap-3 text-center"
            variants={stagger}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, y: -16, transition: { duration: 0.25 } }}
            aria-live="polite"
          >
            <span className="sr-only">{slide.label}</span>
            <div aria-hidden="true" className="contents">
              {slide.body}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {last && (
        <div className="relative z-20 flex justify-center gap-3 px-6 pb-10">
          <button
            type="button"
            onClick={replay}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-white/15 px-5 font-semibold text-white transition-colors hover:bg-white/25"
          >
            <RotateCcw className="size-4" /> Play again
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center rounded-full bg-white px-6 font-semibold text-slate-950 transition-colors hover:bg-white/90"
          >
            Done
          </button>
        </div>
      )}

      <p className="sr-only">
        Slide {index + 1} of {slides.length}. Use the arrow keys to move between slides and Space to pause.
      </p>
    </div>,
    document.body
  );
}
