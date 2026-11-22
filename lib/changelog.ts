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
    version: '1.0.34',
    date: '2026-11-22',
    title: 'A new focus screen',
    changes: {
      new: [
        'The focus screen is redesigned. The time sits inside a ring that fills as the session goes, with your goals underneath as pills you tap to tick off. Pause, Finish, the song playing, Deep focus, your files and your music are all in one bar at the bottom.',
        'Choose how the clock looks in Focus settings: Bold, Mono, Rounded or Classic.',
        'Twenty colour themes for the focus background in Focus settings, and you can still mix your own.',
        'The music view is new: the album cover fills the room behind it, with bigger controls and a cleaner Lyrics and Up next panel. Your music library opens as a full-height panel.',
      ],
      better: [
        'Files and the rest of the plan for today open in a side panel from the bottom bar (or press D), so the screen stays clear while you work.',
      ],
      removed: [
        'Study tools (notes, tutor and flashcards inside a focus session) are gone from the focus screen.',
      ],
      dev: [
        'components/focus/FocusRing.tsx (ring clock), components/focus/clock-fonts.ts (next/font, self-hosted so it works offline). FlowAIPanel and its render test removed; P and Z shortcuts removed, D opens the session panel.',
      ],
    },
  },
  {
    version: '1.0.33',
    date: '2026-11-22',
    title: 'Mentor access, Word and PowerPoint files, and sharing your timetable',
    changes: {
      new: [
        'Mentor access: in Settings > Account, make a username and password for your mentor. They sign in on the Study Flow website and see your schedule, study logs, reports, marks and streak. They cannot change anything, and they do not see your AI chats, notes, homework answers or settings. Turn it off any time and they are signed out straight away.',
        'Word (.docx), PowerPoint (.pptx), Excel (.xlsx), CSV and text files in Resources now open inside Study Flow instead of downloading. PowerPoint shows every slide, with Previous and Next and the arrow keys; Excel shows each sheet as a tab. Older .doc, .ppt and .xls files explain how to save them in the newer format, and every file still has a Download button.',
        'Subjects has a new look: every subject gets its own colour and an icon that matches it (code, maths, physics, a chip for embedded systems...), with a badge when homework is overdue or an exam is close. A subject page opens with a big banner in its colour showing what is open, your average mark against your target, and Focus, Practice and Ask. Resources uses the same icons and colours for every subject folder.',
        'Calm tools: a round leaf button in the bottom-right corner. Hover or tap it for small tools for when studying gets too much: pull out a sticky note (pin it to keep it on every page), a Calm room with a breathing circle and music from a YouTube link you paste, Talk it out (an AI that listens, answers in a few words and starts replying straight away), a two-minute Body reset, and Calm words. Your notes and chat are kept on this device only.',
        'Share your timetable: on School lessons or Study routine, choose Share > Download to share to get a file you can send to anyone. They choose Share > Import a timetable, check what is in it, and it replaces their school lessons and study routine for this year. Blocks they have already finished stay in History, and subjects they do not have yet are added.',
      ],
      fixed: [
        'Finishing a focus session no longer needs notes or a PDF. Before, closing the "What did you get done?" box saved nothing, and the block was then marked missed even though you had studied. Now the session is always saved and the block ticked; notes are optional.',
        'A block you spent focus time on is never marked missed.',
        'A missed block can be ticked off (or given proof) if you did study it; ticking it clears "missed".',
        'Syncing no longer sends the same files to the website over and over. A file the website already has is not checked again, and one that fails is retried after 5 minutes, then less and less often.',
        'On the website, large files (a slide deck over about 4 MB) can now be uploaded and opened, and files are kept safely instead of disappearing when the website is updated.',
      ],
      dev: [
        'Viewers in components/resources/viewers (docx-preview, pptx-preview, read-excel-file, each loaded only when a file of that kind opens); lib/file-preview.ts (test/file-preview.test.mjs). Rendered documents are cleaned: no scripts, frames or inline handlers, only http(s)/mailto links.',
        'Website uploads go straight to the private Supabase bucket through signed upload URLs (beginResourceUploads / finishResourceUploads, tickets in lib/upload-ticket.ts); /uploads answers with a 60-second signed link. Desktop sync writes into the bucket and uses POST /api/sync/file/ticket for files over 4 MB.',
        'Mentor access: MentorAccess table (migration 20261120000000_mentor_access); a mentor session is a token for the student with a mentorId, re-checked on every request (lib/auth.ts). proxy.ts marks mentor requests and keeps them off private pages (lib/mentor-header.ts); lib/mentor-guard.ts refuses every database write inside a server action a mentor makes; mentor tokens are never accepted as device tokens or admin; notes, answers and proof are removed before pages render (lib/mentor-redact.ts).',
        'File sync backoff (lib/sync/file-backoff.ts); lib/sync/server-url.ts can move a retired address (off: sync stays on Vercel until the Render service in render.yaml exists).',
        'Timetable files: lib/timetable-share.ts (format, checks; test/timetable-share.test.mjs), lib/timetable-import.ts (one transaction, rows on the same natural key edited in place; test/timetable-import.test.mjs).',
      ],
    },
  },
  {
    version: '1.0.32',
    date: '2026-11-17',
    title: 'Schedule bar fixed',
    changes: {
      fixed: [
        'The Week, Month, Study routine and School lessons tabs no longer slip down and get cut off inside their bar. The bar now fits the tabs and the tab names are a little bigger.',
      ],
    },
  },
  {
    version: '1.0.31',
    date: '2026-11-17',
    title: 'Double lessons, quick chat replies and a cleaner Schedule bar',
    changes: {
      new: [
        'The Study chat answers hello, thanks, bye, "ok" and "what can you do" straight away, without waiting for the AI or using up your AI requests. Anything with a real question in it still goes to the AI.',
      ],
      fixed: [
        'A double lesson (two of the same subject back to back) now shows on the home card as one lesson. The countdown runs to the end of the whole lesson, not the end of the first half, and "Then" names the lesson after it.',
      ],
      better: [
        'The Week, Month, Study routine and School lessons bar looks cleaner: the tabs sit in the middle of their box, it lines up with the buttons next to it, and the open page is easy to see in dark mode.',
      ],
      dev: [
        'joinDoubleLessons in lib/school.ts (test/double-lessons.test.mjs) joins same-subject lessons with up to 5 minutes between them; breaks are never joined.',
        'lib/quick-replies.ts (test/quick-replies.test.mjs) answers whole-message small talk in askCopilot before any AI call. 1.0.30 was never published (GitHub uploads timed out); its changes are here.',
      ],
    },
  },
  {
    version: '1.0.29',
    date: '2026-11-17',
    title: 'Week follows your study routine',
    changes: {
      fixed: [
        'Week still showed blocks at old times after you changed them in Study routine. Blocks planned before your last change now take the routine’s times, and ones left on a day the routine no longer uses are removed.',
        'Blocks from routine blocks you deleted still showed on Week. They are now removed from today on.',
        'Done blocks, blocks with notes or homework, past days and blocks you moved by hand stay as they are.',
      ],
      dev: [
        'repairOutOfStep (lib/schedule-placement.ts) runs whenever blocks are made: a block older than its template’s last edit that no longer matches it is fixed; blocks of deleted templates are soft-deleted. Rules in lib/schedule-sync.ts.',
      ],
    },
  },
  {
    version: '1.0.28',
    date: '2026-11-17',
    title: 'Your year in review',
    changes: {
      new: [
        'A recap of each finished year that plays like a story: hours studied, your top subjects, your biggest month, when you studied, days in a row, exams, homework, practice and XP. Tap or use the arrow keys to move through it.',
        'A home page for each year. Opening a finished year now lands there, with its highlights, each term, your most studied subjects, every month, and buttons to look back at that year’s calendar, marks, exams, homework, reports and files.',
      ],
      fixed: [
        'Days after the last day of term still had study blocks. Setting the end of term now clears every day after it, and none are planned there again.',
        'Changing a block in Study routine did not change the blocks already on Week, so Week showed clashes Study routine did not. Edits now reach Week from today on. A block you moved by itself stays where you put it.',
      ],
      dev: [
        'lib/year-recap.ts and lib/schedule-sync.ts hold the rules and are tested on their own. Blocks the app withdraws are detached from their routine slot so sync cannot fold a later block into them.',
      ],
    },
  },
  {
    version: '1.0.27',
    date: '2026-11-16',
    title: 'Exam results count towards your goals',
    changes: {
      new: [
        'Focus, a new tab in Marks: the subjects that need you most, in order, with the reasons (below target, an exam coming up, marks falling) and buttons to practise or start a focus session.',
        'Each exam page shows your goal for that subject: where you are now, your target, and the mark you need on the exams left.',
      ],
      better: [
        'Goals now use your exam results. Mark a midterm and its subject shows where you are against your target straight away. With no exam results yet, your report card is used as before.',
        'Each goal shows the exams it is based on and what you need on the exams left to reach it. Exams with a share of the grade set are weighted by it.',
      ],
      fixed: ['The exam page said a result fed into Marks, but Marks never read it.'],
      dev: ['lib/subject-progress.ts works out every subject\'s standing and the focus ranking, and is tested on its own.'],
    },
  },
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
