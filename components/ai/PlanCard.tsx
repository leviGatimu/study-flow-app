'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CalendarCheck2, CalendarPlus, Check, Clock, GraduationCap, Loader2, MinusCircle, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';

import { applyCopilotPlan, dismissCopilotPlan } from '@/lib/copilot-actions';
import type { PlanStep, StoredPlan } from '@/lib/copilot-plan';
import { SubjectIcon } from '@/components/subjects/SubjectIcon';
import { cn } from '@/lib/utils';

const dayLabel = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * A plan the AI proposed: every exam and block it would add, then Yes / Not
 * now. Nothing is added until Yes; the server reads the plan back from the
 * saved reply, so what runs is exactly what is shown here.
 */
export function PlanCard({ messageId, stored, disabled }: { messageId: string; stored: StoredPlan; disabled?: boolean }) {
  const [current, setCurrent] = useState(stored);
  const [pending, startTransition] = useTransition();
  const { plan, state } = current;
  const exams = plan.steps.filter((s) => s.kind === 'exam').length;
  const blocks = plan.steps.length - exams;
  const added = plan.steps.filter((s) => s.outcome === 'done').length;

  const run = (yes: boolean) =>
    startTransition(async () => {
      const result = yes ? await applyCopilotPlan(messageId) : await dismissCopilotPlan(messageId);
      if (result.error || !result.plan) {
        toast.error(result.error ?? 'Could not do that. Try again.');
        return;
      }
      setCurrent(result.plan);
      if (yes) {
        const done = result.plan.plan.steps.filter((s) => s.outcome === 'done').length;
        const skipped = result.plan.plan.steps.length - done;
        toast.success(skipped ? `Added ${done}. ${skipped} skipped: see the plan.` : `Added all ${done} to your schedule.`);
      }
    });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.45, ease: [0.2, 0, 0, 1] }}
      className={cn(
        'mt-4 overflow-hidden rounded-3xl border bg-card shadow-sm',
        state === 'APPLIED' ? 'border-success/30' : state === 'DISMISSED' ? 'border-border/60 opacity-75' : 'border-primary/30'
      )}
    >
      <div
        className={cn(
          'flex items-center gap-3 px-5 py-4',
          state === 'APPLIED' ? 'bg-success/5' : state === 'DISMISSED' ? 'bg-muted/40' : 'bg-gradient-to-r from-primary/10 via-primary/5 to-transparent'
        )}
      >
        <span
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-2xl',
            state === 'APPLIED' ? 'bg-success/15 text-success' : state === 'DISMISSED' ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'
          )}
        >
          {state === 'APPLIED' ? <CalendarCheck2 className="size-5" /> : <CalendarPlus className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
            {state === 'APPLIED' ? 'Added to your schedule' : state === 'DISMISSED' ? 'Not added' : 'Plan · waiting for you'}
          </p>
          <p className="truncate font-heading text-base font-bold">{plan.title}</p>
        </div>
        <span className="hidden shrink-0 text-xs font-bold text-muted-foreground sm:block">
          {state === 'APPLIED'
            ? `${added} of ${plan.steps.length} added`
            : [exams && `${exams} exam${exams === 1 ? '' : 's'}`, blocks && `${blocks} block${blocks === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
        </span>
      </div>

      <ol className="divide-y divide-border/50 px-2">
        {plan.steps.map((step, i) => (
          <StepRow key={i} step={step} index={i} applied={state === 'APPLIED'} />
        ))}
      </ol>

      {state === 'PROPOSED' ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-5 py-4">
            <p className="mr-auto text-sm font-medium text-muted-foreground">Add this to your schedule?</p>
            <button
              type="button"
              disabled={pending || disabled}
              onClick={() => run(false)}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <X className="size-4" /> Not now
            </button>
            <button
              type="button"
              disabled={pending || disabled}
              onClick={() => run(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-md shadow-primary/25 transition-transform hover:scale-[1.03] active:scale-[0.97] disabled:opacity-60"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" strokeWidth={3} />}
              Yes, add it
            </button>
          </div>
        ) : state === 'APPLIED' ? (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-2 border-t border-border/60 px-5 py-3">
            <Link href="/timetable" className="text-sm font-bold text-primary hover:underline">
              See your week
            </Link>
            {exams > 0 && (
              <Link href="/exams" className="text-sm font-bold text-primary hover:underline">
                · Exams
              </Link>
            )}
          </motion.div>
        ) : (
          <motion.p key="no" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5 border-t border-border/60 px-5 py-3 text-sm text-muted-foreground">
            <RotateCcw className="size-3.5" /> Nothing was changed. Ask again any time.
          </motion.p>
        )}
    </motion.div>
  );
}

function StepRow({ step, index, applied }: { step: PlanStep; index: number; applied: boolean }) {
  const skipped = applied && step.outcome === 'skipped';
  return (
    <motion.li
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 + index * 0.04, duration: 0.3 }}
      className={cn('flex items-center gap-3 px-3 py-2.5', skipped && 'opacity-60')}
    >
      {step.kind === 'exam' ? (
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
          <GraduationCap className="size-4" />
        </span>
      ) : (
        <SubjectIcon name={step.subject} className="size-9 rounded-xl" iconClassName="!size-4" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">
          {step.kind === 'exam' ? `${step.subject} exam` : step.subject}
          {step.kind === 'exam' && step.category && <span className="font-medium text-muted-foreground"> · {step.category}</span>}
        </p>
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Clock className="size-3" />
          {dayLabel(step.date)}
          {step.start ? ` · ${step.start}–${step.end}` : ' · time not set'}
          {step.kind === 'block' && <span>· {step.type === 'REVISION' ? 'Revision' : 'Homework'}</span>}
        </p>
        {skipped && step.note && <p className="text-xs font-medium text-orange-600 dark:text-orange-400">Skipped: {step.note}</p>}
      </div>
      {applied &&
        (step.outcome === 'done' ? (
          <span className="tick-in grid size-6 shrink-0 place-items-center rounded-full bg-success text-white">
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        ) : (
          <MinusCircle className="size-5 shrink-0 text-orange-500" />
        ))}
    </motion.li>
  );
}
