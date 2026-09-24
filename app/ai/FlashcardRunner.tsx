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
import { Panel } from '@/components/ui/panel';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { saveFlashcardReview, type Flashcard } from '@/lib/study-actions';

/** SM-2 quality values. "Again" is a lapse; the rest are degrees of success. */
const GRADES = [
  { label: 'Again', quality: 1, hint: 'No idea', tone: 'border-destructive/40 hover:bg-destructive/10' },
  { label: 'Hard', quality: 3, hint: 'Struggled', tone: 'border-orange-500/40 hover:bg-orange-500/10' },
  { label: 'Good', quality: 4, hint: 'Got it', tone: 'border-success/40 hover:bg-success/10' },
  { label: 'Easy', quality: 5, hint: 'Instant', tone: 'border-primary/40 hover:bg-primary/10' },
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

  /**
   * Write the grades given so far. Every exit path goes through here: a card
   * the student has already graded is a real review, and throwing it away
   * because they left half way through would quietly reset its schedule.
   */
  const persist = async (): Promise<boolean> => {
    if (reviews.length === 0) return true;
    setSaving(true);
    const res = await saveFlashcardReview(setId, reviews);
    setSaving(false);
    if ('error' in res) {
      toast.error(res.error ?? 'Your reviews could not be saved. Try again.');
      return false;
    }
    return true;
  };

  const finish = async () => {
    const graded = reviews.length;
    if (!(await persist())) return;
    if (graded > 0) toast.success(graded === 1 ? '1 review saved.' : `${graded} reviews saved.`);
    await onDone();
  };

  const goAgain = async () => {
    if (!(await persist())) return;
    setIndex(0);
    setReviews([]);
    setRevealed(false);
  };

  if (ordered.length === 0) {
    return (
      <EmptyState
        title="This set has no flashcards yet"
        description="Go back to the set and make some from the same material."
        action={
          <Button variant="outline" onClick={() => void onDone()}>
            <ArrowLeft />
            Back to the set
          </Button>
        }
      />
    );
  }

  if (done) {
    const again = reviews.filter((r) => r.quality < 3).length;
    return (
      <Panel className="flex flex-col items-center py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-success/10">
          <Check className="size-6 text-success" />
        </div>
        <h2 className="mt-4 font-heading text-2xl font-bold">{reviews.length} cards reviewed</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {again === 0
            ? 'You knew every one. They will come back further apart.'
            : `${again} to come back sooner. The rest move further out.`}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={finish} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Check />}
            Save and finish
          </Button>
          <Button variant="outline" size="lg" onClick={goAgain} disabled={saving}>
            <RotateCcw />
            Save and go again
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-sm font-medium text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={finish} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <ArrowLeft />}
          {reviews.length > 0 ? 'Save and leave' : 'Leave'}
        </Button>
        <span className="tabular-nums">
          {index + 1} of {ordered.length}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Cards reviewed"
        aria-valuemin={0}
        aria-valuemax={ordered.length}
        aria-valuenow={index}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${(index / ordered.length) * 100}%` }}
        />
      </div>

      <Panel className="mt-6 flex min-h-64 flex-col justify-center text-center md:p-8">
        <p className="font-heading text-xl font-bold leading-snug md:text-2xl">{card.front}</p>

        {revealed && (
          <>
            <div className="my-6 h-px bg-border" />
            <p className="text-base leading-relaxed text-muted-foreground">{card.back}</p>
          </>
        )}
      </Panel>

      {revealed ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {GRADES.map((g) => (
            <button
              key={g.label}
              type="button"
              onClick={() => grade(g.quality)}
              className={cn(
                'rounded-2xl border-2 bg-card px-3 py-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                g.tone
              )}
            >
              <span className="block font-heading text-base font-bold">{g.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{g.hint}</span>
            </button>
          ))}
        </div>
      ) : (
        <Button size="lg" className="mt-6 h-12 w-full rounded-xl text-base" onClick={() => setRevealed(true)}>
          Show answer
        </Button>
      )}
    </div>
  );
}
