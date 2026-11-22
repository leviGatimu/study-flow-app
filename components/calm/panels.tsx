"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BODY_RESET_STEPS, CALM_WORDS } from "@/lib/calm-tools";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Body reset

const RESET_TOTAL = BODY_RESET_STEPS.reduce((s, x) => s + x.seconds, 0);

/** A two-minute guided break for the body: shoulders, jaw, eyes, water, stretch, breath. */
export function BodyReset() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const done = elapsed >= RESET_TOTAL;

  useEffect(() => {
    if (!running || done) return;
    const timer = setInterval(() => setElapsed((e) => Math.min(RESET_TOTAL, e + 1)), 1000);
    return () => clearInterval(timer);
  }, [running, done]);

  let left = elapsed;
  let index = 0;
  while (index < BODY_RESET_STEPS.length - 1 && left >= BODY_RESET_STEPS[index].seconds) {
    left -= BODY_RESET_STEPS[index].seconds;
    index += 1;
  }
  const step = BODY_RESET_STEPS[index];
  const remaining = RESET_TOTAL - elapsed;
  const r = 34;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="relative grid size-24 place-items-center">
        <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="40" cy="40" r={r} fill="none" strokeWidth="6" className="stroke-muted" />
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            className="stroke-primary transition-[stroke-dashoffset] duration-1000 ease-linear"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - elapsed / RESET_TOTAL)}
          />
        </svg>
        <span className="text-lg font-semibold tabular-nums">
          {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.p
          key={done ? "done" : index}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="min-h-12 text-base"
          aria-live="polite"
        >
          {done ? "Done. Your body thanks you. Back to it, gently." : step.text}
        </motion.p>
      </AnimatePresence>

      {!done && (
        <p className="text-xs text-muted-foreground">
          Step {index + 1} of {BODY_RESET_STEPS.length}
        </p>
      )}

      <div className="flex gap-2">
        {done ? (
          <Button variant="outline" onClick={() => { setElapsed(0); setRunning(true); }}>
            <RotateCcw className="size-4" /> Again
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => setRunning(!running)}>
              {running ? <Pause className="size-4" /> : <Play className="size-4" />} {running ? "Pause" : "Carry on"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setElapsed(Math.min(RESET_TOTAL, elapsed - left + step.seconds))}
            >
              Next step
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calm words

function randomWordIndex() {
  return Math.floor(Math.random() * CALM_WORDS.length);
}

export function CalmWords() {
  // A random start, then in order, so "Another" never repeats the same one.
  const [index, setIndex] = useState(randomWordIndex);
  const word = CALM_WORDS[index];

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence mode="wait">
        <motion.blockquote
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className={cn("min-h-28 border-l-2 border-primary pl-4")}
        >
          <p className="text-base leading-relaxed">{word.text}</p>
          {word.source && <footer className="mt-2 text-sm text-muted-foreground">{word.source}</footer>}
        </motion.blockquote>
      </AnimatePresence>
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setIndex((index + 1) % CALM_WORDS.length)}>
          Another
        </Button>
      </div>
    </div>
  );
}
