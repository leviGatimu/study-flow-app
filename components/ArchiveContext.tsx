"use client";

import { createContext, useContext } from "react";

/**
 * "Am I looking at a finished year?", available to any client component.
 *
 * Reads follow whichever year is open (lib/scope.ts). Writes never do - they
 * always target the active year, and `requireWritableScope` throws while an
 * archive is open. That guarantee is server-side and absolute; this context is
 * the other half of it, so the UI stops OFFERING actions that would only fail.
 *
 * Null means the active year is open and everything behaves normally.
 */
export type ArchiveView = {
  /** The class being read, so a list of years can mark which one is open. */
  classId: string;
  /** The finished year being read, e.g. "Year 1". */
  label: string;
  /** The year writes belong to, for the way back. Null if there isn't one. */
  activeLabel: string | null;
} | null;

const ArchiveContext = createContext<ArchiveView>(null);

export function ArchiveProvider({
  value,
  children,
}: {
  value: ArchiveView;
  children: React.ReactNode;
}) {
  return <ArchiveContext.Provider value={value}>{children}</ArchiveContext.Provider>;
}

/** The open archive, or null while the active year is open. */
export function useArchive(): ArchiveView {
  return useContext(ArchiveContext);
}

/** True while a finished year is open. */
export function useIsArchived(): boolean {
  return useContext(ArchiveContext) !== null;
}

/**
 * One sentence explaining why a control is unavailable, for a `title` or
 * helper line. Null when nothing is disabled, so it can be spread straight
 * into a prop.
 */
export function useArchiveReason(): string | null {
  const archive = useContext(ArchiveContext);
  if (!archive) return null;
  return archive.activeLabel
    ? `${archive.label} is an archive. Go back to ${archive.activeLabel} to make changes.`
    : `${archive.label} is an archive and cannot be changed.`;
}

/**
 * Hides a create / edit / delete affordance while an archive is open.
 *
 * The banner above the page already says why everything is read-only, so the
 * default is to remove the control rather than leave a dead one behind. Pass
 * `fallback` for the few places where an empty gap would read as broken.
 */
export function ArchiveGate({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const archive = useContext(ArchiveContext);
  return <>{archive ? fallback : children}</>;
}
