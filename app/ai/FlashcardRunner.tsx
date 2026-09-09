'use client';

/**
 * Flashcards, graded the way spaced repetition needs them.
 *
 * The four buttons are not a rating of the card, they are a rating of the
 * RECALL - how hard it was to remember, which is what SM-2 schedules on. So the
 * card is shown, the student commits by pressing "Show answer", and only then
 * do the buttons appear. Offering them before the answer is revealed lets
 * somebody grade themselves on a memory they have not actually tested, which
 * quietly destroys the schedule.
 *
 * Nothing here writes a QuizAttempt. A self-assessed "I knew that" is not a
 * measurement, and letting it into the quiz average would corrupt the
 * weak-area signal that insights computes from real marked answers.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Check, Loader2, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { saveFlashcardReview, type Flashcard } from '@/lib/study-actions';

/** SM-2 quality values. "Again" is a lapse; the rest are degrees of success. */
const GRADES = [
  { label: 'Again', quality: 1, hint: 'No idea', tone: 'border-rose-500/50 hover:bg-rose-500/10' },
  { label: 'Hard', quality: 3, hint: 'Struggled', tone: 'border-amber-500/50 hover:bg-amber-500/10' },
  { label: 'Good', quality: 4, hint: 'Got it', tone: 'border-emerald-500/50 hover:bg-emerald-500/10' },
  { label: 'Easy', quality: 5, hint: 'Instant', tone: 'border-sky-500/50 hover:bg-sky-500/10' },
];

export function FlashcardRunner({
  setId,
  cards,
  onDone,
}: {
  setId: string;
  cards: Flashcard[];
  onDone: () => Promise<void>;
}) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviews, setReviews] = useState<{ id: string; quality: number }[]>([]);
  const [saving, setSaving] = useState(false);

  // Already ordered due-first by getStudySet. Doing it here would mean reading
  // the clock during a render, and would let the order shift under the student
  // half way through a session as a card came due.
  const ordered = cards;

  const card = ordered[index];
  const done = index >= ordered.length;

  const grade = (quality: number) => {
    setReviews((r) => [...r, { id: card.id, quality }]);
    setRevealed(false);
    setIndex((i) => i + 1);
  };

  const save = async () => {
    setSaving(true);
    const res = await saveFlashcardReview(setId, reviews);
    setSaving(false);
    if ('error' in res) {
      toast.error(res.error);
      return;
    }
    toast.success('Progress saved.');
    await onDone();
  };

  if (ordered.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-sm text-muted-foreground">This set has no flashcards yet.</p>
        <Button variant="outline" className="mt-4" onClick={() => void onDone()}>
          Back
        </Button>
      </div>
    );
  }

  if (done) {
    const again = reviews.filter((r) => r.quality < 3).length;
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
          <Check className="h-6 w-6 text-emerald-500" />
        </div>
        <h2 className="mt-5 font-heading text-2xl font-black">
          {reviews.length} cards reviewed
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {again === 0
            ? 'You knew every one. They will come back further apart.'
            : `${again} to come back sooner. The rest move further out.`}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button size="lg" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save and finish
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              setIndex(0);
              setReviews([]);
              setRevealed(false);
            }}
            disabled={saving}
          >
            <RotateCcw className="h-4 w-4" />
            Go again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8">
      <div className="flex items-center justify-between gap-4 text-xs font-black uppercase tracking-widest text-muted-foreground">
        <button
          type="button"
          onClick={() => void onDone()}
          className="flex items-center gap-1.5 hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Leave
        </button>
        <span>
          {index + 1} of {ordered.length}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${(index / ordered.length) * 100}%` }}
        />
      </div>

      <div className="mt-8 flex min-h-[16rem] flex-col justify-center rounded-3xl border border-border/60 bg-card p-8 text-center">
        <p className="font-heading text-2xl font-black leading-snug">{card.front}</p>

        {revealed && (
          <>
            <div className="my-6 h-px bg-border" />
            <p className="text-base leading-relaxed text-muted-foreground">{card.back}</p>
          </>
        )}
      </div>

      {revealed ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {GRADES.map((g) => (
            <button
              key={g.label}
              type="button"
              onClick={() => grade(g.quality)}
              className={cn(
                'rounded-2xl border-2 bg-card px-3 py-4 transition-colors',
                g.tone
              )}
            >
              <span className="block font-heading text-base font-black">{g.label}</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">{g.hint}</span>
            </button>
          ))}
        </div>
      ) : (
        <Button
          size="lg"
          className="mt-6 h-14 w-full rounded-2xl text-base"
          onClick={() => setRevealed(true)}
        >
          Show answer
        </Button>
      )}
    </div>
  );
}
