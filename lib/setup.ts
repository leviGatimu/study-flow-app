/**
 * What a usable account actually needs, in one place.
 *
 * Registering used to create a username, a password, a silent "Year 1 / Term 1"
 * nobody chose, and nothing else. Everything the app runs on - which year you
 * are in, when the term ends, what you study, when you study it, and the API key
 * that switches the AI on - had to be discovered by the user, page by page, with
 * nothing anywhere saying it was missing. The person who built the app knew;
 * nobody else could.
 *
 * This file is the shared vocabulary for fixing that: the wizard at /setup walks
 * these steps, and the dashboard checklist reports on the ones whose absence can
 * be proven. It holds no server code so both can import it.
 */

/** The wizard's steps, in the order they are asked. */
export type SetupStepId =
  | 'profile'
  | 'year'
  | 'ai'
  | 'subjects'
  | 'school'
  | 'blocks';

/**
 * The checklist items shown on the dashboard afterwards.
 *
 * A deliberate subset of the wizard's steps: only the ones where "not done" is a
 * FACT, not a guess. A missing subject is a fact - the table is empty. A
 * "wrong" year name is not: `Year 1` is both the default nobody chose and a
 * perfectly good answer for somebody in their first year, and no query can tell
 * those apart. Nagging about the second kind would make the checklist a liar,
 * and one wrong item is enough for a user to stop believing all of them.
 */
export type ChecklistItemId = 'subjects' | 'blocks' | 'ai' | 'termDates' | 'school';

export type ChecklistItem = {
  id: ChecklistItemId;
  title: string;
  /** Why this matters, in the user's terms - never "configure X". */
  why: string;
  done: boolean;
  /** Whether the app works without it. Optional items never block "all done". */
  required: boolean;
  /** Where the user goes to do it by hand. */
  href: string;
  /** The wizard step that also does it. */
  step: SetupStepId;
};

export type SetupSnapshot = {
  username: string;
  name: string;
  timezone: string;
  classId: string | null;
  classLabel: string | null;
  termId: string | null;
  termName: string | null;
  /** ISO "yyyy-MM-dd", the shape an <input type="date"> wants. */
  termStartDate: string | null;
  termEndDate: string | null;
  subjects: string[];
  templateCount: number;
  schoolLessonCount: number;
  ai: { gemini: boolean; openai: boolean; ollama: boolean };
  /** Set once the user dismissed the dashboard checklist for good. */
  setupCompletedAt: Date | null;
  /** Set once the guided tour has been seen. */
  onboardedAt: Date | null;
};

/**
 * Turn a snapshot into the checklist.
 *
 * Pure, and exported, so the dashboard card and the wizard's final screen agree
 * by construction rather than by two people remembering the same rules.
 */
export function buildChecklist(snapshot: SetupSnapshot): ChecklistItem[] {
  return [
    {
      id: 'subjects',
      title: 'Add your subjects',
      why: 'Everything else - homework, exams, marks, revision - hangs off a subject. Without them the forms have nothing to offer you.',
      done: snapshot.subjects.length > 0,
      required: true,
      href: '/subjects',
      step: 'subjects',
    },
    {
      id: 'blocks',
      title: 'Set your weekly study blocks',
      why: 'This is the engine. Each day is generated from your recurring week, so today has something on it without you planning it.',
      done: snapshot.templateCount > 0,
      required: true,
      href: '/manage',
      step: 'blocks',
    },
    {
      id: 'ai',
      title: 'Switch the AI on',
      why: 'The tutor, the notes, the quizzes and reading a timetable off a photo all need a key - or a local model if you would rather stay offline.',
      done: snapshot.ai.gemini || snapshot.ai.openai || snapshot.ai.ollama,
      required: true,
      href: '/settings?tab=ai',
      step: 'ai',
    },
    {
      id: 'termDates',
      title: 'Set your term dates',
      why: 'Optional. With an end date the app prompts you to close the term instead of letting it run forever.',
      done: Boolean(snapshot.termStartDate && snapshot.termEndDate),
      required: false,
      href: '/year',
      step: 'year',
    },
    {
      id: 'school',
      title: 'Import your school timetable',
      why: 'Optional. Upload a photo of the timetable on the wall and the dashboard knows when you are in class.',
      done: snapshot.schoolLessonCount > 0,
      required: false,
      href: '/school-timetable',
      step: 'school',
    },
  ];
}
