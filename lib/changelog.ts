/**
 * What changed in each version, shown on the Updates page.
 *
 * Add an entry here before every release, newest first. test/changelog.test.mjs
 * fails if the desktop app's version has no entry, so one cannot be forgotten.
 * Write for the person using the app, in plain words. Anything only a developer
 * would care about goes under `dev`.
 */

export type ChangeKind = 'new' | 'better' | 'fixed' | 'removed' | 'security' | 'dev';

export const CHANGE_LABELS: Record<ChangeKind, string> = {
  new: 'New',
  better: 'Better',
  fixed: 'Fixed',
  removed: 'Removed',
  security: 'Security',
  dev: 'Behind the scenes',
};

export type Release = {
  version: string;
  /** "yyyy-MM-dd". */
  date: string;
  title: string;
  changes: Partial<Record<ChangeKind, string[]>>;
};

export const CHANGELOG: Release[] = [
  {
    version: '1.0.26',
    date: '2026-11-06',
    title: 'A streak you actually earn',
    changes: {
      new: [
        'This Updates page: every version and what changed in it.',
        'Auto update, in Settings. Turn it on and the app installs updates by itself when you are not using it.',
        'Admin shows when each person was last in the app, including who is online now.',
      ],
      better: [
        'After an update the app reopens by itself, with no installer window to click through.',
        'School lessons now look like Week, Month and Study routine: day columns of cards that fill the screen.',
        'The page for a single finished block is rebuilt, with your notes, focus sessions and planned against focused time.',
      ],
      fixed: [
        'The streak only counted opening the app. It now counts days you finished a block, and days with nothing planned do not break it.',
        'Best streak is now your real best.',
        'The Streak tile on reports always showed 0 days.',
        'The sidebar no longer draws a scrollbar on short windows.',
      ],
      dev: ['The streak is worked out from finished blocks on every load instead of being counted up.'],
    },
  },
  {
    version: '1.0.25',
    date: '2026-11-06',
    title: 'Exams, practice, homework and admin, reworked',
    changes: {
      new: [
        'Add an exam by picking its subject. You can put it in a category then or later.',
        'Number grid and keyboard controls in full-page practice and exams.',
        'Completed work shows the change on the previous period, a by-subject table and a log grouped by day.',
      ],
      better: [
        'The Exams page groups exams by category with each average. Long category names no longer break it.',
        'A new single exam page, with preparation on one side and the result on the other.',
        'Homework opens beside its list, and warns you before you leave unsaved work.',
        'Admin is split into Overview, Accounts, Activity and System.',
      ],
      fixed: ['Pressing Enter when a practice paper opened could trigger Save & exit.'],
      removed: ['The schedule Pause button. Term dates now decide when your schedule runs.'],
    },
  },
  {
    version: '1.0.24',
    date: '2026-11-06',
    title: 'Safer sync, and you choose which side is right',
    changes: {
      new: [
        'Make the website match this app, or this app match the website. You see what will change first, and you can undo it.',
        'Choose what happens when a device connects: combine both sides or copy one over the other.',
      ],
      better: ['Disconnect now asks first, and the app warns you when a device has stopped syncing.'],
      fixed: [
        'Two blocks added by hand on the same day could be merged into one when syncing.',
        'Changes the website refused were never tried again.',
        'Large sends could time out, so they now go in small batches.',
      ],
      security: ['A homework can only link to a schedule block in your own account.'],
    },
  },
  {
    version: '1.0.23',
    date: '2026-11-06',
    title: 'No more overlapping blocks',
    changes: {
      new: [
        'If you add or move a block onto another one, the app asks first: move it to the next free time, replace the other block, or cancel.',
        'Homework goes on your schedule. Pick the day and the next free time is filled in for you.',
      ],
      better: [
        'Overlaps you already have are labelled on Week and Study routine.',
        'Finishing a homework ticks its block.',
      ],
      fixed: ['Moving a block could land it a day early when your browser and the server were in different time zones.'],
    },
  },
  {
    version: '1.0.22',
    date: '2026-11-06',
    title: 'A new look for your schedule',
    changes: {
      better: [
        'Week and Study routine show each day as a column of neat cards in time order, with the length written on each card.',
        'Month fills the screen, with the chosen day beside it.',
      ],
    },
  },
  {
    version: '1.0.21',
    date: '2026-11-05',
    title: 'Homework, reports, resources and streak, redone',
    changes: {
      new: [
        'Every homework has its own page: what was set, your answers, and finishing it with proof.',
        'The clock page shows what is on now and how long is left, and counts down to the next block.',
      ],
      better: [
        'Reports show the grade, time done of planned, every block, time per subject and what to do next.',
        'Resources work like a drive: a folder list, search across every file and recent files first.',
        'Streak shows your next milestone, this week and a full year of study days.',
        'Study chat replies type out as they arrive, and the AI has its own logo.',
        'Homework, Exams and Resources have their own places in the sidebar.',
      ],
    },
  },
  {
    version: '1.0.20',
    date: '2026-11-05',
    title: 'Study becomes one AI chat',
    changes: {
      new: [
        'Ask the study chat anything, or say "quiz me on photosynthesis" and it makes a practice you can start right away.',
        'Exam categories: put each subject\'s midterm in "Midterm 1" and see the average across all of them.',
        'Choose a main colour in Settings, from seven colours.',
      ],
      better: [
        'Subject pages have a summary at the top, with homework and exams together under Up next.',
        'Focus mode has its colour backgrounds back, with one large clock.',
        'Each block on Today keeps its details inside one card.',
      ],
    },
  },
  {
    version: '1.0.19',
    date: '2026-11-05',
    title: 'A timeline for today, and safer sign-in',
    changes: {
      better: [
        "Today's focus is a timeline, with one tick per block.",
        'Month is a cleaner grid. Click a day to see its blocks beside it.',
        'Resources open as subject cards, then a folder page.',
        'Year & terms shows how far through the year you are.',
      ],
      security: [
        'Too many wrong passwords locks sign-in for 15 minutes.',
        'Changing your password signs out your other devices, and there is a Log out everywhere button.',
        'Restoring a backup only replaces this year.',
        'Backups no longer contain your AI key.',
      ],
    },
  },
  {
    version: '1.0.18',
    date: '2026-11-04',
    title: 'A rebuilt Settings page and setup',
    changes: {
      new: [
        'Click any finished block in History to see its notes, proof, time and focus sessions.',
        'Test your AI from Settings: it tries every AI you have set up and shows which one answered.',
      ],
      better: [
        'Settings is one page. Jump between sections, or press / and type to find any setting.',
        'A setup check at the top of Settings shows what is done and what is missing.',
        'A rebuilt setup, where your school timetable provides your subjects.',
        'A clearer sidebar, with your level and an XP ring at the bottom.',
        'Week, Study routine and School lessons share one aligned timetable.',
      ],
      fixed: ['Connecting the desktop app now offers the right website address.'],
    },
  },
  {
    version: '1.0.17',
    date: '2026-10-29',
    title: 'Practice workspace, exact exam times and profiles',
    changes: {
      new: [
        'Set an exam\'s exact start and end times. When it ends it shows Done with marks pending.',
        'Practise in a dedicated workspace with fullscreen, flagged questions and a final review before handing in.',
        'Save a practice and pick it up later, even after a reload.',
        'A Profile page for your name, school, bio, time zone and photo.',
      ],
      removed: ['Calculator, Projects and Notes left the menu. Their data is kept.'],
    },
  },
  {
    version: '1.0.16',
    date: '2026-10-24',
    title: 'Later daily reports',
    changes: {
      better: [
        'Daily reports now default to 11:58 PM in your own time zone. Custom report times are kept.',
        'Missed daily reports are caught up the next time you open Reports.',
      ],
    },
  },
  {
    version: '1.0.15',
    date: '2026-09-30',
    title: 'Study routine back to its familiar layout',
    changes: {
      better: ['Study routine returns to every day Monday to Sunday, with each day\'s hours shown large and clearer cards.'],
    },
  },
  {
    version: '1.0.14',
    date: '2026-09-30',
    title: 'Study routine built around hours',
    changes: {
      new: ['A weekly total, an hours-per-day chart and hours per subject on Study routine.'],
      fixed: ['A block running past midnight was marked missed as soon as it was created.'],
    },
  },
  {
    version: '1.0.13',
    date: '2026-09-25',
    title: 'School lessons rebuilt',
    changes: {
      better: [
        "School lessons has a live card with a countdown to the bell, today's timeline and the week at a glance.",
        "The new-streak celebration is a clean card with yesterday's tasks, focus time and XP.",
      ],
    },
  },
  {
    version: '1.0.12',
    date: '2026-09-24',
    title: 'A slim sidebar',
    changes: {
      better: ['The sidebar is a slim icon rail that opens on hover, and Add task moved to the + in the top bar.'],
    },
  },
  {
    version: '1.0.11',
    date: '2026-09-24',
    title: 'A normal sidebar',
    changes: { better: ['The sidebar stays open, with labelled sections and nothing that unfolds on hover.'] },
  },
  {
    version: '1.0.10',
    date: '2026-09-24',
    title: 'One header on every page',
    changes: {
      better: ["Every page opens with the Home page's header: a big title, the section's pages and a card with its key number."],
      removed: ['The tab strip under the top bar.'],
    },
  },
  {
    version: '1.0.9',
    date: '2026-09-24',
    title: 'One app, six sections',
    changes: {
      better: [
        'The app is rebuilt around Today, Schedule, Subjects, Study, Progress and Settings, with a bottom tab bar on small screens.',
        'Daily and weekly summaries are one Reports page, and ranks live in Streak.',
        "Every page shares the dashboard's design.",
      ],
      removed: ['The overview hub pages and Deep Study Studio.'],
    },
  },
  {
    version: '1.0.8',
    date: '2026-09-24',
    title: 'Hubs for every section',
    changes: {
      new: ['Every section has a hub page, and a tab strip links every page to its section.'],
      better: [
        'Homework is a planner list grouped by due date.',
        "The AI Study Buddy reads the subject's syllabus, homework and exams.",
      ],
      removed: ['Course Notes.'],
    },
  },
  {
    version: '1.0.7',
    date: '2026-09-24',
    title: 'Subjects become the hub',
    changes: {
      better: [
        'Opening a subject links to its resources, homework and upcoming exams.',
        "A subject's resources open as a full-page file explorer.",
      ],
    },
  },
  {
    version: '1.0.6',
    date: '2026-09-23',
    title: 'Resources like File Explorer',
    changes: {
      new: ["Each subject's resources work like a Windows File Explorer window, with folders, views, renaming and keyboard shortcuts."],
    },
  },
  {
    version: '1.0.5',
    date: '2026-09-22',
    title: 'Resources become a real folder',
    changes: {
      new: ['Documents\\Study Tracker\\<Year>\\<Subject> is your library, and the Resources page is a file explorer over it.'],
      fixed: [
        'The app no longer attached itself to another server on port 3000.',
        'Update checks now point at the right place.',
      ],
    },
  },
];
