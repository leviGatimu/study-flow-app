/**
 * Phase 5 backfill: link existing exams to real subjects, and infer their kind.
 *
 * Before this, `ExamEvent.title` doubled as the subject key - app/exams looked
 * up preparation stats with getSubjectStats(exam.title). That works only when
 * the title is EXACTLY a subject name, so "Networking MID-TERM EXAM" silently
 * returned zero prep and the page looked like it was working.
 *
 * Matching, in order of confidence:
 *   1. title equals a subject name
 *   2. title with exam words stripped equals a subject name
 *   3. the stripped title is a distinctive word that appears in exactly one
 *      subject name ("php" -> "Design Web Application Using PHP")
 * Anything ambiguous is left unlinked and reported, rather than guessed at.
 *
 * Additive: only sets subjectId and kind, both previously null/default.
 *
 * Run:  npx tsx prisma/backfill-exams.ts [--dry]
 */

import { PrismaClient } from "../node_modules/.prisma/client-custom-v8";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry");

/** Words that describe the assessment, not the subject. */
const NOISE = [
  "mid-term", "mid term", "midterm", "final", "finals", "exam", "exams",
  "exma", "test", "quiz", "paper", "homework", "assessment", "revision",
  "practical", "theory", "cat", "term",
];

const norm = (v: string) =>
  v.toLowerCase().replace(/[()]/g, " ").replace(/\s+/g, " ").trim();

function stripNoise(title: string): string {
  let out = norm(title);
  for (const w of NOISE) out = out.replace(new RegExp(`\\b${w}\\b`, "gi"), " ");
  // Roman/arabic paper numbers: "paper 1", "II"
  out = out.replace(/\b(i{1,3}|iv|v|\d+)\b/gi, " ");
  return out.replace(/\s+/g, " ").trim();
}

function inferKind(title: string): string {
  const t = norm(title);
  if (/\bquiz\b/.test(t)) return "QUIZ";
  if (/\bmid[- ]?term\b|\bmidterm\b/.test(t)) return "MIDTERM";
  if (/\bfinals?\b/.test(t)) return "FINAL";
  if (/\btest\b|\bcat\b/.test(t)) return "TEST";
  return "EXAM";
}

function matchSubject(
  title: string,
  subjects: { id: string; name: string }[]
): { id: string; name: string; how: string } | null {
  const t = norm(title);

  const exact = subjects.find((s) => norm(s.name) === t);
  if (exact) return { ...exact, how: "exact" };

  const stripped = stripNoise(title);
  if (!stripped) return null;

  const strippedExact = subjects.find((s) => norm(s.name) === stripped);
  if (strippedExact) return { ...strippedExact, how: "exact after stripping" };

  // The stripped remainder appearing inside exactly one subject name.
  const contains = subjects.filter((s) => norm(s.name).includes(stripped));
  if (contains.length === 1) return { ...contains[0], how: `"${stripped}" in name` };

  // Or the longest single word of the remainder, if it is distinctive enough.
  const words = stripped.split(" ").filter((w) => w.length >= 3);
  words.sort((a, b) => b.length - a.length);
  for (const w of words) {
    const hits = subjects.filter((s) => norm(s.name).includes(w));
    if (hits.length === 1) return { ...hits[0], how: `keyword "${w}"` };
  }

  return null;
}

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, username: true } });
  console.log(DRY_RUN ? "[DRY RUN - no writes]\n" : "");

  let linked = 0;
  let unmatched = 0;

  for (const user of users) {
    const [exams, subjects] = await Promise.all([
      prisma.examEvent.findMany({
        where: { userId: user.id, subjectId: null },
        select: { id: true, title: true, kind: true },
        orderBy: { title: "asc" },
      }),
      prisma.subject.findMany({
        where: { userId: user.id, deletedAt: null },
        select: { id: true, name: true },
      }),
    ]);
    if (exams.length === 0) continue;

    console.log(`${user.username}: ${exams.length} unlinked exam(s), ${subjects.length} subjects`);

    for (const exam of exams) {
      const match = matchSubject(exam.title, subjects);
      const kind = inferKind(exam.title);

      if (!match) {
        unmatched++;
        console.log(`  ? "${exam.title}"  -> no confident match (kind ${kind}), left unlinked`);
        if (!DRY_RUN && kind !== exam.kind) {
          await prisma.examEvent.update({ where: { id: exam.id }, data: { kind } });
        }
        continue;
      }

      linked++;
      console.log(`  + "${exam.title}"  -> ${match.name}  [${match.how}, ${kind}]`);
      if (!DRY_RUN) {
        await prisma.examEvent.update({
          where: { id: exam.id },
          data: { subjectId: match.id, kind },
        });
      }
    }
  }

  console.log(`\n${linked} linked, ${unmatched} left for manual assignment.`);
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
