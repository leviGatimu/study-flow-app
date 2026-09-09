/**
 * The guided tour, as data.
 *
 * The old tour was one overlay that never left the dashboard: it TALKED about
 * the weekly timetable, the year, the marks page and the AI without ever going
 * to any of them, so a new user finished it having seen one screen and been told
 * about six. This one walks. Each step names the route it belongs to, and the
 * engine navigates there before it points at anything - the user ends up on the
 * page while being told what the page is for, which is the only version of this
 * that anybody remembers afterwards.
 *
 * Rules for writing a step, learned from the version that did not work:
 *
 *   TEACH, DO NOT LABEL. "Progress" tells a new user nothing. "Marks turns your
 *   report cards into a trend line" tells them why they would ever open it.
 *
 *   ONE IDEA PER STEP. Where a page holds two genuinely different ideas - a
 *   recurring timetable is not the same thought as an academic year - it gets
 *   two steps, on two pages.
 *
 *   ANCHOR ON SOMETHING THAT RENDERS. Every selector here exists in the app;
 *   the nav anchors are derived in Sidebar.tsx from the section names in
 *   lib/nav.ts, so renaming a section there renames the anchor here. A step
 *   whose target is missing degrades to a centred card rather than breaking,
 *   which is forgiving enough that rot goes unnoticed - hence the development
 *   warning in the engine.
 */

export type Placement = 'top' | 'bottom' | 'left' | 'right';

export type TourStep = {
  /** Stable id, used for resuming and for the chapter menu. */
  id: string;
  /** The chapter this step belongs to. Consecutive steps share one. */
  chapter: string;
  /**
   * Where the step lives. The engine navigates here first. May carry a query
   * (`/settings?tab=ai`); only the path is compared when deciding to navigate.
   */
  route: string;
  selector?: string;
  title: string;
  body: string;
  placement?: Placement;
  /**
   * One concrete thing the user could do here, shown as a prompt under the
   * body. The tour never performs it for them - a tour that clicks things
   * teaches nothing and destroys data when it guesses wrong.
   */
  tryIt?: string;
};

export const TOUR_STEPS: TourStep[] = [
  // ------------------------------------------------------- getting oriented
  {
    id: 'welcome',
    chapter: 'Getting oriented',
    route: '/',
    title: 'Let me show you around',
    body: 'This tour walks through the actual pages with you — it moves the app as it goes, rather than describing things you cannot see. Arrow keys move, Esc leaves, and you can pick it up again later from the dashboard.',
  },
  {
    id: 'sidebar',
    chapter: 'Getting oriented',
    route: '/',
    selector: '[data-tour="sidebar"]',
    title: 'Six places, and that is all',
    body: 'Today, Plan, Subjects, Progress, Study and Settings. Hover an icon — or tab to it — and the pages inside that section appear beside it. Nothing in the app is more than two clicks from here.',
    placement: 'right',
  },
  {
    id: 'streak',
    chapter: 'Getting oriented',
    route: '/',
    selector: '[data-tour="streak"]',
    title: 'Streak, level and XP',
    body: 'Finish something each day and the streak grows; every finished block earns XP, and XP earns levels. The streak belongs to the academic year you are in, so starting a new year starts a clean one.',
    placement: 'bottom',
  },
  {
    id: 'command-palette',
    chapter: 'Getting oriented',
    route: '/',
    selector: '[data-tour="command-palette"]',
    title: 'The one shortcut worth learning',
    body: 'Ctrl+K — Cmd+K on a Mac — searches your tasks, notes and subjects and jumps to any page in the app. If you only remember one thing from this tour, this is the one that saves the most time.',
    placement: 'bottom',
    tryIt: 'Press Ctrl+K after the tour and type a subject name.',
  },

  // -------------------------------------------------------------- your day
  {
    id: 'todays-focus',
    chapter: 'Your day',
    route: '/',
    selector: '[data-tour="todays-focus"]',
    title: 'This is the page you live on',
    body: "Your blocks for today, in the order they happen. Tick one off when it is done, write a line about what you actually covered, or attach a photo or PDF as proof of work you can look back on months later.",
    placement: 'top',
  },
  {
    id: 'quick-add',
    chapter: 'Your day',
    route: '/',
    selector: '[data-tour="quick-add"]',
    title: 'Something came up',
    body: 'A one-off task or study block, in about five seconds. It lands on today and on your calendar, and it does not touch your recurring week — so a single late-night cram does not become a permanent Tuesday commitment.',
    placement: 'bottom',
  },
  {
    id: 'focus-mode',
    chapter: 'Your day',
    route: '/',
    selector: '[data-tour="focus-mode"]',
    title: 'Deep Focus',
    body: 'A full-screen session: a timer, your own music, and an AI tutor that answers on the material in front of you. The time you spend in here is counted automatically — you never have to log it.',
    placement: 'bottom',
  },

  // ----------------------------------------------------------- the engine
  {
    id: 'manage-intro',
    chapter: 'Your study week',
    route: '/manage',
    selector: '[data-tour="manage-intro"]',
    title: 'This is the engine of the whole app',
    body: 'You describe one ordinary week here — "Physics, Wednesdays, 7 to 9" — and every day the app writes that day onto your dashboard from it. It is why today already had something on it, and why you never plan the same week twice.',
    placement: 'bottom',
  },
  {
    id: 'manage-add',
    chapter: 'Your study week',
    route: '/manage',
    selector: '[data-tour="manage-add"]',
    title: 'Homework or revision',
    body: 'Each block is one or the other, and the difference is visible everywhere: homework gets a solid blue edge, revision a dashed orange one. At a glance you know whether you are producing work or going back over it.',
    placement: 'bottom',
    tryIt: 'Change your week here whenever your timetable changes — today rebuilds from it.',
  },

  // ----------------------------------------------------------- years, terms
  {
    id: 'year-active',
    chapter: 'Years and terms',
    route: '/year',
    selector: '[data-tour="year-active"]',
    title: 'A year at a time',
    body: 'Everything you do belongs to an academic year and a term inside it. End a term and the next one starts clean; finish the year and it is archived — still readable, no longer in your way. Going on holiday? Pause from here and the streak holds.',
    placement: 'top',
  },

  // ------------------------------------------------------ subjects and work
  {
    id: 'subjects-hero',
    chapter: 'Subjects and exams',
    route: '/subjects',
    selector: '[data-tour="subjects-hero"]',
    title: 'Everything hangs off a subject',
    body: 'Each subject collects its own homework, resources, goals, marks and AI tutor modules. Open one and you get the whole picture of how that course is going, in one place.',
    placement: 'bottom',
  },
  {
    id: 'nav-subjects',
    chapter: 'Subjects and exams',
    route: '/subjects',
    selector: '[data-tour="nav-subjects"]',
    title: 'Exams, homework and resources',
    body: 'They live one level in, under this section. Photograph your exam timetable and it is read for you — then revision is planned backwards from each paper, so the work lands before the exam rather than the night before.',
    placement: 'right',
  },

  // ------------------------------------------------------------- the proof
  {
    id: 'history-intro',
    chapter: 'Proof it is working',
    route: '/history',
    selector: '[data-tour="history-intro"]',
    title: 'Every block you have ever finished',
    body: 'Filter by range or subject and see where the hours actually went — which is usually not where you think. On a bad week this page is the argument that you are still moving.',
    placement: 'bottom',
  },
  {
    id: 'nav-progress',
    chapter: 'Proof it is working',
    route: '/history',
    selector: '[data-tour="nav-progress"]',
    title: 'Marks, insights and summaries',
    body: 'Marks turns your report cards into a trend line per subject. Insights and Summaries read your finished work and say plainly which subjects you have been quietly avoiding.',
    placement: 'right',
  },

  // ------------------------------------------------------------------- AI
  {
    id: 'settings-ai',
    chapter: 'The AI, and your school day',
    route: '/settings?tab=ai',
    selector: '[data-tour="settings-ai"]',
    title: 'Nothing AI works until this is filled in',
    body: 'The tutor, the note generator, the quizzes and the timetable-from-a-photo trick all need a key. Google gives one away free. Or point the app at a model running on your own machine and it keeps working with no internet at all.',
    placement: 'top',
    tryIt: 'No key yet? The setup checklist on your dashboard links straight here.',
  },
  {
    id: 'school-timetable',
    chapter: 'The AI, and your school day',
    route: '/school-timetable',
    selector: '[data-tour="school-timetable-intro"]',
    title: 'Your school day, from a photograph',
    body: 'Upload a picture of the timetable on the wall and it becomes your lessons — which you then correct, because nothing is saved until you have looked at it. Your dashboard uses it to know when you are in class.',
    placement: 'bottom',
  },
  {
    id: 'nav-study',
    chapter: 'The AI, and your school day',
    route: '/school-timetable',
    selector: '[data-tour="nav-study"]',
    title: 'Get tested on your own material',
    body: 'Drop a PDF, a Word file or a photo of your notes into AI Study, say how many questions you want and what kind, and it writes them. Then answer them one at a time, or sit the whole thing as a timed mock exam.',
    placement: 'right',
  },

  // ---------------------------------------------------------------- finish
  {
    id: 'finish',
    chapter: 'Done',
    route: '/',
    title: 'That is the whole app',
    body: 'Start with your study week under Plan — everything else grows from it. Anything still unset is on the checklist on this page, and you can replay this tour any time from the "Take a tour" button.',
  },
];

/** Chapter titles in order, each appearing once. */
export const TOUR_CHAPTERS: string[] = TOUR_STEPS.reduce<string[]>((acc, step) => {
  if (acc[acc.length - 1] !== step.chapter) acc.push(step.chapter);
  return acc;
}, []);

/** The path part of a step's route, for comparing against the current pathname. */
export function routePath(route: string): string {
  return route.split('?')[0];
}
