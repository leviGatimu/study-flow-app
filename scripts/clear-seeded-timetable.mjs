/**
 * Take the owner's timetable back out of the accounts it was copied into.
 *
 * Until 2026-06-25, registering seeded the new account with a copy of the app
 * owner's own weekly timetable - 19 ScheduleTemplates and the 11 Subjects they
 * name. The seeding was removed that day, but the rows it had already written
 * were never cleaned up, so those users open the app to someone else's
 * coursework: their dashboard, /subjects, /manage, /timetable, /calendar and
 * /marks all list modules they have never taken.
 *
 *   node scripts/clear-seeded-timetable.mjs --user John --dry-run
 *   node scripts/clear-seeded-timetable.mjs --user John
 *
 * WHAT IT REMOVES: only rows that match the retired seed EXACTLY - a template
 * on the same day, at the same times, with the same subject and type, and a
 * subject with one of the seeded names. Anything the user typed themselves has
 * to differ in at least one of those fields, and is left alone.
 *
 * WHAT IT REFUSES TO REMOVE, in two layers:
 *
 *   A template under which the user has actually done something. If any task
 *   generated from it is done, or carries a written description or a
 *   proof-of-work upload, that template is REPORTED AND KEPT - the person has
 *   adopted it, and deleting it would take their work with it through the
 *   cascade. The point of this script is to give someone an empty slate, never
 *   to erase what they did.
 *
 *   A subject that anything else of theirs refers to - a kept template, a
 *   completed task, homework, a goal, a resource, a mastery item, a tutor
 *   module, a studio note or a grade. A seeded NAME is not seeded DATA: these
 *   are the app owner's real modules, so on the owner's own account every one
 *   of them looks seeded while being entirely genuine.
 *
 * And it refuses outright to touch an admin account, which is where the seed
 * data came from in the first place. Both guards were added after a dry run on
 * the owner's account offered to remove 11 subjects and 76 tasks.
 *
 * It is a SOFT delete, so the removal is a fact that can travel: a desktop
 * install that already pulled these rows learns they are gone instead of
 * pushing them back. Tasks generated from a removed template go with it through
 * the normal cascade in lib/soft-delete.ts.
 *
 * IDEMPOTENT. Everything it looks at is filtered on deletedAt: null.
 */

import { PrismaClient } from '../node_modules/.prisma/client-custom-v8/index.js';
import { softDelete } from '../lib/soft-delete.ts';

/**
 * The retired registration seed, copied from prisma/seed.ts.
 *
 * A copy rather than an import because seed.ts is a script with side effects -
 * importing it would run it, and what it does is write this very data into
 * `prisma.user.findFirst()`, which is how the mess started.
 */
const SEEDED_TEMPLATES = [
  { dayOfWeek: 1, subject: 'Networking Fundamentals', startTime: '20:00', endTime: '20:30', type: 'HOMEWORK' },
  { dayOfWeek: 1, subject: 'Develop Web Application Using JavaScript', startTime: '20:30', endTime: '21:30', type: 'HOMEWORK' },
  { dayOfWeek: 1, subject: 'Design Embedded Systems Hardware', startTime: '20:00', endTime: '20:30', type: 'HOMEWORK' },
  { dayOfWeek: 2, subject: 'Design Web Application Using PHP', startTime: '20:00', endTime: '21:30', type: 'HOMEWORK' },
  { dayOfWeek: 2, subject: 'ENTREPRENEURSHIP', startTime: '21:30', endTime: '22:00', type: 'HOMEWORK' },
  { dayOfWeek: 2, subject: 'ENGLISH', startTime: '22:00', endTime: '23:30', type: 'HOMEWORK' },
  { dayOfWeek: 3, subject: 'Physics (Design electrical and electronic circuit using optical instruments)', startTime: '19:00', endTime: '21:30', type: 'HOMEWORK' },
  { dayOfWeek: 3, subject: 'Develop Basic Database', startTime: '21:30', endTime: '22:30', type: 'HOMEWORK' },
  { dayOfWeek: 3, subject: 'Foundamentals of Programming using C', startTime: '22:30', endTime: '23:30', type: 'HOMEWORK' },
  { dayOfWeek: 4, subject: 'Math (Apply Algebra, Trigonometry, Probability, and Statistics)', startTime: '19:00', endTime: '21:30', type: 'HOMEWORK' },
  { dayOfWeek: 4, subject: 'Design Web User Interface', startTime: '21:30', endTime: '22:30', type: 'HOMEWORK' },
  { dayOfWeek: 4, subject: 'Physics (Design electrical and electronic circuit using optical instruments)', startTime: '22:30', endTime: '00:00', type: 'HOMEWORK' },
  { dayOfWeek: 5, subject: 'Math (Apply Algebra, Trigonometry, Probability, and Statistics)', startTime: '20:00', endTime: '21:30', type: 'REVISION' },
  { dayOfWeek: 5, subject: 'Foundamentals of Programming using C', startTime: '21:30', endTime: '22:30', type: 'REVISION' },
  { dayOfWeek: 5, subject: 'Physics (Design electrical and electronic circuit using optical instruments)', startTime: '22:30', endTime: '00:00', type: 'REVISION' },
  { dayOfWeek: 6, subject: 'Develop Web Application Using JavaScript', startTime: '18:00', endTime: '20:30', type: 'REVISION' },
  { dayOfWeek: 6, subject: 'Physics (Design electrical and electronic circuit using optical instruments)', startTime: '20:30', endTime: '22:00', type: 'REVISION' },
  { dayOfWeek: 0, subject: 'Design Embedded Systems Hardware', startTime: '19:00', endTime: '20:30', type: 'REVISION' },
  { dayOfWeek: 0, subject: 'Design Web Application Using PHP', startTime: '20:30', endTime: '22:00', type: 'REVISION' },
];

/** The subject rows the seed created alongside the templates. */
const SEEDED_SUBJECTS = new Set(SEEDED_TEMPLATES.map((t) => t.subject.toLowerCase()));

const key = (t) => `${t.dayOfWeek}|${t.startTime}|${t.endTime}|${t.type}|${t.subject.toLowerCase()}`;
const SEEDED_KEYS = new Set(SEEDED_TEMPLATES.map(key));

const DRY = process.argv.includes('--dry-run') || process.argv.includes('--dry');
const at = process.argv.indexOf('--user');
const username = at === -1 ? null : process.argv[at + 1];

if (!username) {
  console.error('Usage: node scripts/clear-seeded-timetable.mjs --user <username> [--dry-run]');
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, isAdmin: true },
  });
  if (!user) {
    console.error(`No user named "${username}".`);
    process.exit(1);
  }
  if (user.isAdmin) {
    console.error(
      `${user.username} is an admin - this is the account the seed data came FROM, ` +
        'so every row here looks seeded while being genuine. Refusing.'
    );
    process.exit(1);
  }

  const templates = await prisma.scheduleTemplate.findMany({
    where: { userId: user.id, deletedAt: null },
    select: { id: true, dayOfWeek: true, subject: true, startTime: true, endTime: true, type: true },
  });

  const seeded = templates.filter((t) => SEEDED_KEYS.has(key(t)));
  const theirOwn = templates.filter((t) => !SEEDED_KEYS.has(key(t)));

  // A template the person has actually used is theirs now, whatever its origin.
  const kept = [];
  const removable = [];
  for (const template of seeded) {
    const used = await prisma.task.count({
      where: {
        templateId: template.id,
        deletedAt: null,
        // isDone, not isMissed. A missed task is the app marking a block the
        // user never touched - the exact opposite of adopting it - so counting
        // it as "used" would keep the whole seeded timetable forever, which is
        // what it did on the first run of this script.
        OR: [
          { isDone: true },
          { NOT: { workDescription: null } },
          { NOT: { proofPdfUrl: null } },
        ],
      },
    });
    (used > 0 ? kept : removable).push({ template, used });
  }

  const subjects = await prisma.subject.findMany({
    where: { userId: user.id, deletedAt: null },
    select: { id: true, name: true },
  });
  const seededByName = subjects.filter((s) => SEEDED_SUBJECTS.has(s.name.toLowerCase()));

  // A subject is only removable if nothing else of theirs still refers to it.
  const keptNames = new Set(kept.map((k) => k.template.subject.toLowerCase()));
  const seededSubjects = [];
  const keptSubjects = [];
  for (const subject of seededByName) {
    const name = subject.name;
    const references = keptNames.has(name.toLowerCase())
      ? 1
      : (await prisma.task.count({
          where: { userId: user.id, subject: name, deletedAt: null, isDone: true },
        })) +
        (await prisma.homework.count({ where: { userId: user.id, subject: name, deletedAt: null } })) +
        (await prisma.subjectGoal.count({ where: { userId: user.id, subject: name, deletedAt: null } })) +
        (await prisma.resource.count({ where: { userId: user.id, subject: name, deletedAt: null } })) +
        (await prisma.masteryItem.count({ where: { userId: user.id, subject: name, deletedAt: null } })) +
        (await prisma.tutorModule.count({ where: { userId: user.id, subject: name, deletedAt: null } })) +
        (await prisma.studioNote.count({ where: { userId: user.id, subject: name, deletedAt: null } })) +
        (await prisma.subjectGrade.count({
          where: { reportCard: { userId: user.id }, subject: name, deletedAt: null },
        }));
    (references > 0 ? keptSubjects : seededSubjects).push(subject);
  }

  console.log(`${user.username}:`);
  console.log(`  ${templates.length} template(s): ${seeded.length} from the seed, ${theirOwn.length} their own`);
  console.log(
    `  ${subjects.length} subject(s): ${seededByName.length} named by the seed, ` +
      `${keptSubjects.length} of them still referenced elsewhere`
  );
  if (kept.length > 0) {
    console.log(`  KEEPING ${kept.length} seeded template(s) - work has been done under them:`);
    for (const { template, used } of kept) {
      console.log(`    d${template.dayOfWeek} ${template.startTime} ${template.subject} (${used} task(s))`);
    }
  }
  if (removable.length === 0 && seededSubjects.length === 0) {
    console.log('  Nothing to remove.');
  } else if (DRY) {
    console.log(`  WOULD REMOVE ${removable.length} template(s) and ${seededSubjects.length} subject(s),`);
    const tasks = await prisma.task.count({
      where: { templateId: { in: removable.map((r) => r.template.id) }, deletedAt: null },
    });
    console.log(`  taking ${tasks} generated task(s) with them through the cascade.`);
  } else {
    let removedTemplates = 0;
    for (const { template } of removable) {
      removedTemplates += await softDelete(prisma, 'scheduleTemplate', { id: template.id, userId: user.id });
    }
    let removedSubjects = 0;
    for (const subject of seededSubjects) {
      removedSubjects += await softDelete(prisma, 'subject', { id: subject.id, userId: user.id });
    }
    console.log(`  Removed ${removedTemplates} template(s) and ${removedSubjects} subject(s).`);
  }
} finally {
  await prisma.$disconnect();
}
