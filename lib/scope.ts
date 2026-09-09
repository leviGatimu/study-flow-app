import { cache } from 'react';

import { cookies } from 'next/headers';

import { prisma } from '@/lib/prisma';

/**
 * Which academic year the app is showing right now.
 *
 * Every model in this schema is either class-scoped (`classId`) or term-scoped
 * (`termId`, whose term belongs to a class). Until this file existed, almost
 * none of the queries used either: the columns were populated correctly but
 * never filtered on, so a new academic year opened showing the previous year's
 * exams, marks, notes and summaries. This is the one place that answers "which
 * year am I looking at", and every read goes through it.
 *
 * Reads follow the VIEWED class - normally the active one, or an archived year
 * while it is open from Year & Terms. Writes always target the ACTIVE class and
 * are refused while an archive is open, which is what read-only means here.
 */

/** Set while browsing a finished year. Absent means "the active year". */
export const VIEW_COOKIE = 'viewingClassId';

export type ClassScope = {
  classId: string;
  label: string;
  /** Every term in this class, for the models scoped by term rather than class. */
  termIds: string[];
  /** True when this is not the user's active class - i.e. a read-only archive. */
  isArchive: boolean;
};

/**
 * Memoised per request.
 *
 * Roughly a hundred queries now ask "which year am I in" before they run, and
 * a page renders dozens of them. Without this the answer would be re-fetched
 * for every one of them - two round trips each, against a database in
 * Frankfurt. React's cache() keys on the arguments, so the active view and an
 * explicitly named class are each resolved once and shared.
 */
const loadScope = cache(async function loadScope(
  userId: string,
  classId: string | null
): Promise<ClassScope | null> {
  const active = await prisma.class.findFirst({
    where: { userId, status: 'ACTIVE', deletedAt: null },
    orderBy: { startedAt: 'desc' },
    select: { id: true, label: true, terms: { where: { deletedAt: null }, select: { id: true } } },
  });

  // Asking for a specific class only works if it is the user's own.
  const viewed = classId
    ? await prisma.class.findFirst({
        where: { id: classId, userId, deletedAt: null },
        select: { id: true, label: true, terms: { where: { deletedAt: null }, select: { id: true } } },
      })
    : null;

  const target = viewed ?? active;
  if (!target) return null;

  return {
    classId: target.id,
    label: target.label,
    termIds: target.terms.map((t) => t.id),
    isArchive: target.id !== active?.id,
  };
});

/**
 * The class the current request should READ from.
 *
 * Null when the user has no class at all - a brand new account, or one that
 * predates academic years. Callers must treat null as "do not filter": adding
 * `classId: null` to a where clause would hide every row they own.
 */
export async function getViewScope(userId: string): Promise<ClassScope | null> {
  const store = await cookies();
  return loadScope(userId, store.get(VIEW_COOKIE)?.value ?? null);
}

/** The user's active class, ignoring whatever archive is being viewed. */
export async function getActiveScope(userId: string): Promise<ClassScope | null> {
  return loadScope(userId, null);
}

/**
 * Where-fragment for a model that carries `classId`.
 *
 *   where: { userId, ...byClass(scope) }
 */
export function byClass(scope: ClassScope | null): { classId?: string } {
  return scope ? { classId: scope.classId } : {};
}

/**
 * Where-fragment for a model that carries `termId`.
 *
 * A class with no terms yet would produce `{ in: [] }`, which matches nothing -
 * correct, and deliberately different from "no filter".
 */
export function byTerm(scope: ClassScope | null): { termId?: { in: string[] } } {
  return scope ? { termId: { in: scope.termIds } } : {};
}

/**
 * What a user is told when a write into a finished year is refused.
 *
 * It names the state AND the way out, because the moment this message is seen
 * is the moment the UI that would have explained it - hidden buttons, the
 * archive banner - has already failed to prevent the click.
 *
 * Actions that report failure by RETURNING it rather than throwing use the
 * constant directly, at the call site:
 *
 *   if (await isViewingArchive(userId)) return { error: ARCHIVE_WRITE_ERROR };
 *
 * That is deliberately not wrapped in a helper returning the object.
 * TypeScript only unifies an action's several `return { ... }` shapes into one
 * result type while every branch is a fresh object literal; a branch returning
 * a helper's declared type breaks that, and every caller reading `res.success`
 * or `res.error` stops compiling. Converting those actions to throw instead is
 * not an option either - their callers read the result rather than catch.
 */
export const ARCHIVE_WRITE_ERROR =
  'This academic year is archived and cannot be changed. Switch back to your active year to make changes.';

/**
 * The class new rows belong to.
 *
 * Throws while an archive is open, so a stray write cannot land in a finished
 * year. UI hides its create buttons in that state; this is the guarantee
 * behind it, because hidden is not the same as prevented.
 */
export async function requireWritableScope(userId: string): Promise<ClassScope | null> {
  const scope = await getViewScope(userId);
  if (scope?.isArchive) {
    throw new Error(ARCHIVE_WRITE_ERROR);
  }
  return scope;
}

/**
 * Refuse an EDIT or DELETE while an archive is open - the counterpart to
 * requireClassStamp/requireTermStamp, which do the same for creates.
 *
 * For actions that signal failure by throwing. The check is on the year being
 * VIEWED, never on the row: reads follow the viewed year, so a control reached
 * from an archived page is an edit of that archive, whatever year the id it
 * carries happens to belong to.
 *
 * Deliberately separate from requireWritableScope() even though it delegates to
 * it - an update needs the refusal, not the scope, and a bare call whose result
 * is discarded reads like something a later reader can safely delete.
 */
export async function assertWritableScope(userId: string): Promise<void> {
  await requireWritableScope(userId);
}

/** True while a finished year is open for browsing. */
export async function isViewingArchive(userId: string): Promise<boolean> {
  const scope = await getViewScope(userId);
  return scope?.isArchive ?? false;
}

/**
 * What a NEW row is stamped with, spread straight into `data`:
 *
 *   data: { userId, title, ...(await requireClassStamp(userId)) }   // classId models
 *   data: { userId, date,  ...(await requireTermStamp(userId)) }    // termId models
 *
 * No model carries both columns, which is why these are two helpers rather
 * than one - spreading a `classId` into a term-scoped model is a Prisma error,
 * not a no-op.
 *
 * The key is ABSENT, never null, when the user has no class, so a create on a
 * pre-academic-year account behaves exactly as it did before.
 *
 * Both throw while an archive is open, for the same reason requireWritableScope
 * does: a finished year is a record, not a workspace.
 */

/** Class-only stamp, for the models that carry `classId`. */
export async function requireClassStamp(userId: string): Promise<{ classId?: string }> {
  return byClass(await requireWritableScope(userId));
}

/**
 * Term-only stamp, for the models that carry `termId`.
 *
 * The term is the running one, falling back to the newest term in the class
 * when none is running. That fallback matters: reads match `termId in <every
 * term of the class>`, so a row written between terms would otherwise carry no
 * term at all and be invisible in the very year that produced it.
 */
export async function requireTermStamp(userId: string): Promise<{ termId?: string }> {
  const scope = await requireWritableScope(userId);
  if (!scope) return {};

  const termId = await writeTermId(scope.classId);
  return termId ? { termId } : {};
}

/** The term a row created right now belongs to: the running one, else the newest. */
const writeTermId = cache(async function writeTermId(classId: string): Promise<string | null> {
  const active = await prisma.term.findFirst({
    where: { classId, status: 'ACTIVE', deletedAt: null },
    select: { id: true },
  });
  if (active) return active.id;

  const latest = await prisma.term.findFirst({
    where: { classId, deletedAt: null },
    orderBy: { index: 'desc' },
    select: { id: true },
  });
  return latest?.id ?? null;
});
