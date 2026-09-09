/**
 * Move the hardcoded school timetable into the account it actually belongs to.
 *
 * Until 20260909000000_school_lesson these 44 lessons lived in a `SCHOOL_DATA`
 * array inside components/SchoolTimetable.tsx, and the dashboard, the lesson
 * notifier and the week view all read them - so every account on the
 * deployment saw them. They are one student's real timetable, and this puts
 * them where they belong: rows owned by that student, in their active class.
 *
 *   node scripts/seed-school-lessons.mjs --user levi --class "Year 1" --dry-run
 *   node scripts/seed-school-lessons.mjs --user levi --class "Year 1"
 *
 * --class IS REQUIRED, and it is required because the first run of this script
 * did not have it: it defaulted to the user's ACTIVE class and put a Year 1
 * timetable into Year 2, where a new academic year is supposed to start blank.
 * A school timetable belongs to a specific year, so naming that year is the
 * caller's job, not a guess.
 *
 * ONE-OFF. Nobody else should ever be seeded with these; every other account
 * starts with an empty school timetable and fills it in from /school.
 *
 * IDEMPOTENT. A lesson already present for that user and class - same day and
 * same start time - is left alone, so a second run adds nothing. Run it against
 * the desktop SQLite database too by pointing DATABASE_URL at the file.
 */

import { PrismaClient } from '../node_modules/.prisma/client-custom-v8/index.js';

const DRY = process.argv.includes('--dry-run') || process.argv.includes('--dry');
const flag = (name) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? null : process.argv[at + 1] ?? null;
};
const username = flag('--user');
const classLabel = flag('--class');

if (!username || !classLabel) {
  console.error(
    'Usage: node scripts/seed-school-lessons.mjs --user <username> --class "<year label>" [--dry-run]'
  );
  process.exit(1);
}

/** The timetable as it was hardcoded, with 0=Sunday days and breaks flagged. */
const LESSONS = [
  { dayOfWeek: 1, startTime: '07:30', endTime: '09:00', subject: "Self Study / Devotion", isBreak: false },
  { dayOfWeek: 1, startTime: '09:00', endTime: '10:40', subject: "Networking Fundamentals", isBreak: false },
  { dayOfWeek: 1, startTime: '10:40', endTime: '11:00', subject: "Short Break", isBreak: true },
  { dayOfWeek: 1, startTime: '11:00', endTime: '11:50', subject: "Citizenship", isBreak: false },
  { dayOfWeek: 1, startTime: '11:50', endTime: '12:40', subject: "Fundamentals of C (Extra hour)", isBreak: false },
  { dayOfWeek: 1, startTime: '12:40', endTime: '13:40', subject: "Lunch and Learn", isBreak: true },
  { dayOfWeek: 1, startTime: '13:40', endTime: '15:20', subject: "Develop Web Application using Javascripts", isBreak: false },
  { dayOfWeek: 1, startTime: '15:20', endTime: '15:40', subject: "Short Break", isBreak: true },
  { dayOfWeek: 1, startTime: '15:40', endTime: '17:20', subject: "Design Embedded Systems", isBreak: false },
  { dayOfWeek: 2, startTime: '07:30', endTime: '09:00', subject: "Self Study / Devotion", isBreak: false },
  { dayOfWeek: 2, startTime: '09:00', endTime: '10:40', subject: "Develop Web Application using PHP", isBreak: false },
  { dayOfWeek: 2, startTime: '10:40', endTime: '11:00', subject: "Short Break", isBreak: true },
  { dayOfWeek: 2, startTime: '11:00', endTime: '12:40', subject: "Design Graphic User Interface", isBreak: false },
  { dayOfWeek: 2, startTime: '12:40', endTime: '13:40', subject: "Lunch and Learn", isBreak: true },
  { dayOfWeek: 2, startTime: '13:40', endTime: '15:20', subject: "Maintain Professional Conversation in Upper Technical English", isBreak: false },
  { dayOfWeek: 2, startTime: '15:20', endTime: '15:40', subject: "Short Break", isBreak: true },
  { dayOfWeek: 2, startTime: '15:40', endTime: '16:30', subject: "English (Extra hour)", isBreak: false },
  { dayOfWeek: 2, startTime: '16:30', endTime: '17:20', subject: "Students' clubs", isBreak: false },
  { dayOfWeek: 3, startTime: '07:30', endTime: '09:00', subject: "Self Study / Devotion", isBreak: false },
  { dayOfWeek: 3, startTime: '09:00', endTime: '10:40', subject: "Apply Fundamentals of Programming Using C", isBreak: false },
  { dayOfWeek: 3, startTime: '10:40', endTime: '11:00', subject: "Short Break", isBreak: true },
  { dayOfWeek: 3, startTime: '11:00', endTime: '12:40', subject: "Develop Basic Database", isBreak: false },
  { dayOfWeek: 3, startTime: '12:40', endTime: '13:40', subject: "Lunch and Learn", isBreak: true },
  { dayOfWeek: 3, startTime: '13:40', endTime: '14:30', subject: "Entrepreneurship", isBreak: false },
  { dayOfWeek: 3, startTime: '14:30', endTime: '15:20', subject: "Computer Basics", isBreak: false },
  { dayOfWeek: 3, startTime: '15:20', endTime: '15:40', subject: "Short Break", isBreak: true },
  { dayOfWeek: 3, startTime: '15:40', endTime: '17:20', subject: "Design Electrical and Electronic Circuits and Optical Instruments", isBreak: false },
  { dayOfWeek: 4, startTime: '07:30', endTime: '09:00', subject: "Self Study / Devotion", isBreak: false },
  { dayOfWeek: 4, startTime: '09:00', endTime: '10:40', subject: "Design Electrical and Electronic Circuits and Optical Instruments", isBreak: false },
  { dayOfWeek: 4, startTime: '10:40', endTime: '11:00', subject: "Short Break", isBreak: true },
  { dayOfWeek: 4, startTime: '11:00', endTime: '12:40', subject: "Design Web User Interface", isBreak: false },
  { dayOfWeek: 4, startTime: '12:40', endTime: '13:40', subject: "Lunch and Learn", isBreak: true },
  { dayOfWeek: 4, startTime: '13:40', endTime: '14:30', subject: "Javascript (Extra hour)", isBreak: false },
  { dayOfWeek: 4, startTime: '14:30', endTime: '15:20', subject: "Develop Web Application using Javascripts", isBreak: false },
  { dayOfWeek: 4, startTime: '15:20', endTime: '15:40', subject: "Short Break", isBreak: true },
  { dayOfWeek: 4, startTime: '15:40', endTime: '17:20', subject: "Apply Fundamentals of Programming Using C", isBreak: false },
  { dayOfWeek: 5, startTime: '07:30', endTime: '09:00', subject: "Self Study / Devotion", isBreak: false },
  { dayOfWeek: 5, startTime: '09:00', endTime: '11:50', subject: "Math (Algebra, Trig, Prob, Stats)", isBreak: false },
  { dayOfWeek: 5, startTime: '11:50', endTime: '12:40', subject: "Design Embedded Systems", isBreak: false },
  { dayOfWeek: 5, startTime: '12:40', endTime: '13:40', subject: "Lunch and Learn", isBreak: true },
  { dayOfWeek: 5, startTime: '13:40', endTime: '14:30', subject: "Kinyarwanda", isBreak: false },
  { dayOfWeek: 5, startTime: '14:30', endTime: '15:20', subject: "Math (Algebra, Trig, Prob, Stats)", isBreak: false },
  { dayOfWeek: 5, startTime: '15:20', endTime: '15:40', subject: "Short Break", isBreak: true },
  { dayOfWeek: 5, startTime: '15:40', endTime: '17:20', subject: "Lab (Embedded Systems)", isBreak: false },
];

const prisma = new PrismaClient();

try {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true },
  });
  if (!user) {
    console.error(`No user named "${username}".`);
    process.exit(1);
  }

  const target = await prisma.class.findFirst({
    where: { userId: user.id, label: classLabel, deletedAt: null },
    select: { id: true, label: true },
  });
  if (!target) {
    const available = await prisma.class.findMany({
      where: { userId: user.id, deletedAt: null },
      select: { label: true },
    });
    console.error(
      `${username} has no class labelled "${classLabel}". They have: ` +
        (available.map((c) => c.label).join(', ') || '(none)')
    );
    process.exit(1);
  }

  const existing = await prisma.schoolLesson.findMany({
    where: { userId: user.id, classId: target.id, deletedAt: null },
    select: { dayOfWeek: true, startTime: true },
  });
  const taken = new Set(existing.map((l) => `${l.dayOfWeek}|${l.startTime}`));

  const missing = LESSONS.filter((l) => !taken.has(`${l.dayOfWeek}|${l.startTime}`));

  console.log(
    `${user.username} / ${target.label}: ` +
      `${existing.length} lesson(s) already there, ${missing.length} to add.`
  );

  if (missing.length === 0) {
    console.log('Nothing to do.');
  } else if (DRY) {
    for (const l of missing) console.log(`  would add ${l.startTime}-${l.endTime} ${l.subject}`);
  } else {
    await prisma.schoolLesson.createMany({
      data: missing.map((l) => ({ ...l, userId: user.id, classId: target.id })),
    });
    console.log(`Added ${missing.length} lesson(s).`);
  }
} finally {
  await prisma.$disconnect();
}
