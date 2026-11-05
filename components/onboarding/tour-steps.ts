/**
 * The guided tour, as data.
 *
 * It walks: each step names the route it belongs to and the engine navigates
 * there before pointing at anything. It is also about YOU: steps read the
 * person's own week (TourContext) so the dashboard step says "your first block
 * today is Physics at 19:00" rather than describing a stranger's day, and a
 * step about something not set up yet offers to go and set it up.
 *
 * Rules for writing a step:
 *
 *   TEACH, DO NOT LABEL. Say why someone would open the page, not its name.
 *
 *   ONE IDEA PER STEP, and only the ideas someone uses in their first week.
 *   Everything else is findable with Ctrl+K.
 *
 *   ANCHOR ON SOMETHING THAT RENDERS. Every selector exists in the app; the nav
 *   anchors are derived in Sidebar.tsx from the section names in lib/nav.ts. A
 *   step whose target is missing degrades to a centred card.
 *
 *   NEVER ACT FOR THEM. An `action` is a link the person chooses to follow; it
 *   ends the tour and takes them there. The tour itself clicks nothing.
 */

export type Placement = 'top' | 'bottom' | 'left' | 'right';

/** What the tour knows about the person taking it (lib/tour-actions.ts). */
export type TourContext = {
  firstName: string;
  subjectCount: number;
  templateCount: number;
  lessonCount: number;
  todayCount: number;
  todayFirst: { subject: string; startTime: string } | null;
  /** A cloud AI key is saved. */
  aiKey: boolean;
};

type Text = string | ((ctx: TourContext) => string);

export type TourStep = {
  /** Stable id, used for resuming. */
  id: string;
  /** The chapter this step belongs to. Consecutive steps share one. */
  chapter: string;
  /** Where the step lives; may carry a query. Only the path is compared. */
  route: string;
  selector?: string;
  title: Text;
  body: Text;
  placement?: Placement;
  /** Shown only when this returns true. */
  when?: (ctx: TourContext) => boolean;
  /** A link the person may follow; following it ends the tour. */
  action?: (ctx: TourContext) => { label: string; href: string } | null;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const TOUR_STEPS: TourStep[] = [
  // ---------------------------------------------------------------- your day
  {
    id: 'welcome',
    chapter: 'Your day',
    route: '/',
    title: (c) => (c.firstName ? `Hi ${c.firstName}, here is how you will use this` : 'Here is how you will use this'),
    body: 'Two minutes, on the real pages: what to do each day, where your week lives, and how to study with the AI. Arrow keys move, Esc leaves, and you can replay it from the dashboard.',
  },
  {
    id: 'todays-focus',
    chapter: 'Your day',
    route: '/',
    selector: '[data-tour="todays-focus"]',
    title: (c) => (c.todayCount ? 'Start here every day' : 'Your day lands here'),
    body: (c) =>
      c.todayCount && c.todayFirst
        ? `Today you have ${plural(c.todayCount, 'block')}; the first is ${c.todayFirst.subject} at ${c.todayFirst.startTime}. Tick each one off when it is done, and add a line about what you covered or a photo of the work.`
        : c.templateCount
          ? 'Nothing is planned for today. On days that have blocks they appear here in order, and you tick them off as you go.'
          : 'This fills itself from your study week, which is empty right now. Plan your week once and every day shows up here on its own.',
    placement: 'top',
    action: (c) => (c.templateCount ? null : { label: 'Plan my study week', href: '/setup?step=blocks' }),
  },
  {
    id: 'quick-add',
    chapter: 'Your day',
    route: '/',
    selector: '[data-tour="quick-add"]',
    title: 'Something came up',
    body: 'Add a one-off task or study block in seconds. It goes on today only and never changes your normal week.',
    placement: 'bottom',
  },
  {
    id: 'command-palette',
    chapter: 'Your day',
    route: '/',
    selector: '[data-tour="command-palette"]',
    title: 'Find anything: Ctrl+K',
    body: 'Cmd+K on a Mac. Search your tasks, notes and subjects, or jump to any page. Everything this tour skips is one search away.',
    placement: 'bottom',
  },

  // --------------------------------------------------------------- your week
  {
    id: 'manage-intro',
    chapter: 'Your week',
    route: '/manage',
    selector: '[data-tour="manage-intro"]',
    title: 'Your study week repeats itself',
    body: (c) =>
      c.templateCount
        ? `You have ${plural(c.templateCount, 'block')} here, repeating every week. Change one and every future day follows. Homework has a solid blue edge, revision a dashed orange one.`
        : 'Describe one normal week here, like "Physics, Wednesdays, 19:00 to 21:00", and every day is filled in from it. Homework shows with a solid blue edge, revision with a dashed orange one.',
    placement: 'bottom',
    action: (c) => (c.templateCount ? null : { label: 'Let AI plan my week', href: '/setup?step=blocks' }),
  },
  {
    id: 'school-timetable',
    chapter: 'Your week',
    route: '/school-timetable',
    selector: '[data-tour="school-timetable-intro"]',
    title: (c) => (c.lessonCount ? 'Your school day' : 'Add your school timetable'),
    body: (c) =>
      c.lessonCount
        ? `${plural(c.lessonCount, 'lesson')} a week are saved. The dashboard uses them to show what class you are in and to keep study blocks out of lesson time.`
        : 'Upload a photo of your timetable and your lessons and subjects are read from it, each subject once. You check everything before it is saved.',
    placement: 'bottom',
    action: (c) => (c.lessonCount ? null : { label: 'Upload my timetable', href: '/setup?step=school' }),
  },
  {
    id: 'subjects-hero',
    chapter: 'Your week',
    route: '/subjects',
    selector: '[data-tour="subjects-hero"]',
    title: 'One place per subject',
    body: (c) =>
      `${c.subjectCount ? `Your ${plural(c.subjectCount, 'subject')} each` : 'Each subject'} keep their own homework, exams, files and marks. Add an exam here and revision is planned back from its date.`,
    placement: 'bottom',
  },

  // ---------------------------------------------------------------- studying
  {
    id: 'ask-ai',
    chapter: 'Studying',
    route: '/ai',
    selector: '[data-tour="ask-intro"]',
    title: 'Study with the AI',
    body: 'The Study chat knows your subjects, schedule and marks. Ask "what should I revise tonight?" or "explain this question", or say "quiz me on photosynthesis" and it makes a practice you can take, with your score saved.',
    placement: 'bottom',
  },
  {
    id: 'practice',
    chapter: 'Studying',
    route: '/ai/practices',
    selector: '[data-tour="practice-intro"]',
    title: 'Get tested on your notes',
    body: 'Upload a chapter, your notes or a photo of the board, choose how many questions, and answer them one by one or as a timed mock exam. Scores are saved per subject.',
    placement: 'bottom',
  },
  {
    id: 'settings-ai',
    chapter: 'Studying',
    route: '/settings?tab=ai',
    selector: '[data-tour="settings-ai"]',
    title: 'The AI needs a key first',
    body: 'Ask AI, Practice and reading timetable photos all need one. A Google Gemini key is free and takes a minute to get; the app tests it before saving.',
    placement: 'top',
    when: (c) => !c.aiKey,
    action: () => ({ label: 'Connect AI now', href: '/setup?step=ai' }),
  },
  {
    id: 'focus-mode',
    chapter: 'Studying',
    route: '/ai',
    selector: '[data-tour="focus-mode"]',
    title: 'When it is time to work',
    body: 'Focus mode is a full-screen timer for one block, with your music. The time you spend is logged against that block automatically.',
    placement: 'bottom',
  },

  // ---------------------------------------------------------------- progress
  {
    id: 'history-intro',
    chapter: 'Progress',
    route: '/history',
    selector: '[data-tour="history-intro"]',
    title: 'See where your hours went',
    body: 'Every block you finish lands here with its time and notes. Filter by subject to spot the one you have been avoiding.',
    placement: 'bottom',
  },
  {
    id: 'nav-progress',
    chapter: 'Progress',
    route: '/history',
    selector: '[data-tour="nav-progress"]',
    title: 'Marks, reports and your streak',
    body: 'Under Progress: Marks turns report cards into a trend per subject, Reports sums up each day and week, and Streak counts the days in a row you studied.',
    placement: 'right',
  },

  // ---------------------------------------------------------------- finish
  {
    id: 'finish',
    chapter: 'Done',
    route: '/',
    title: (c) => (missing(c).length ? 'Nearly there' : 'You are ready'),
    body: (c) => {
      const left = missing(c);
      return left.length
        ? `Still to set up: ${left.join(', ')}. Setup does each in a minute, and it saves as you go.`
        : 'Everything is in place. Open today, start your first block, and tick it off when you are done.';
    },
    action: (c) => (missing(c).length ? { label: 'Finish setting up', href: '/setup' } : null),
  },
];

function missing(c: TourContext) {
  return [
    !c.lessonCount && 'your school timetable',
    !c.subjectCount && 'your subjects',
    !c.templateCount && 'your study week',
    !c.aiKey && 'the AI',
  ].filter(Boolean) as string[];
}

/** The steps this person sees, in order. */
export function stepsFor(ctx: TourContext): TourStep[] {
  return TOUR_STEPS.filter((s) => !s.when || s.when(ctx));
}

/** Chapter titles in order, each appearing once. */
export function chaptersOf(steps: TourStep[]): string[] {
  return steps.reduce<string[]>((acc, step) => {
    if (acc[acc.length - 1] !== step.chapter) acc.push(step.chapter);
    return acc;
  }, []);
}

export const text = (value: Text, ctx: TourContext) => (typeof value === 'function' ? value(ctx) : value);

/** The path part of a step's route, for comparing against the current pathname. */
export function routePath(route: string): string {
  return route.split('?')[0];
}
