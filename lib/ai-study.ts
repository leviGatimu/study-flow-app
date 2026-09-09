/**
 * AI Study's vocabulary, shared by the server and the page.
 *
 * There used to be three destinations - AI Buddy, AI Tutor, AI Notes - which
 * read as three separate products a student had to choose between before they
 * had even asked their question. They were not three products. They were one
 * assistant with three front doors, and none of the three knew anything about
 * the student.
 *
 * So: one destination, and these are the things it can DO. A mode is not a
 * different AI; it is the same AI, holding the same context, told to behave
 * differently. That distinction is the whole design - it is why "test me on my
 * Newton's Laws notes" works without the student navigating anywhere.
 *
 * No system prompts live here. This module is imported by the client, and the
 * instructions that shape a mode are server-side in ai-study-actions.ts.
 */

export type StudyMode = 'ASK' | 'LEARN' | 'PRACTICE' | 'EXAM' | 'REVIEW';

export type StudyModeMeta = {
  id: StudyMode;
  /** The button. A verb, because the student is choosing an action. */
  label: string;
  /** One line, shown under the label - what it will actually do. */
  blurb: string;
  /** Seeds the input when the mode is picked with nothing typed. */
  starter: string;
};

export const STUDY_MODES: StudyModeMeta[] = [
  {
    id: 'ASK',
    label: 'Ask',
    blurb: 'Anything — a concept, a bug in your code, what to do tonight.',
    starter: '',
  },
  {
    id: 'LEARN',
    label: 'Teach me',
    blurb: 'A guided lesson: explain, check I followed, then make it harder.',
    starter: 'Teach me ',
  },
  {
    id: 'PRACTICE',
    label: 'Test me',
    blurb: 'Questions one at a time, with feedback after each.',
    starter: 'Test me on ',
  },
  {
    id: 'EXAM',
    label: 'Mock exam',
    blurb: 'Exam conditions. No hints, no explanations until the end.',
    starter: 'Give me a mock exam on ',
  },
  {
    id: 'REVIEW',
    label: 'Review my notes',
    blurb: 'Works from what you have actually written, not generic material.',
    starter: 'Review my notes on ',
  },
];

export function modeMeta(mode: string): StudyModeMeta {
  return STUDY_MODES.find((m) => m.id === mode) ?? STUDY_MODES[0];
}

/** What a session is called before the student has said anything. */
export function defaultSessionTitle(mode: StudyMode, subject?: string | null): string {
  const meta = modeMeta(mode);
  return subject ? `${meta.label} · ${subject}` : meta.label;
}

/**
 * The single recommendation shown on the AI Study home.
 *
 * Deliberately computed, not generated. Three reasons: it is instant, it costs
 * nothing on a metered key, and it still works for a student who has not added
 * an AI key at all - which is exactly the student most in need of being told
 * what to do next. The AI's job is to run the session, not to decide there is
 * one.
 */
export type Recommendation = {
  /** "20 min Physics" */
  headline: string;
  /** Why this, right now. */
  reason: string;
  minutes: number;
  subject: string | null;
  mode: StudyMode;
  /** What gets sent to the AI if they press Start. */
  prompt: string;
};
