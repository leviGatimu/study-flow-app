"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Small per-browser preferences for the explorer pages: which view, whether a
 * pane is open, how wide a column is.
 *
 * useSyncExternalStore rather than an effect so the server renders the
 * default, the client corrects it during hydration, and no render ever sets
 * state. When storage is blocked a choice still holds for the session.
 */

const EVENT = "resources:pref-change";
const fallback = new Map<string, string>();

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function readRaw(key: string): string | null {
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) return stored;
  } catch {
    // fall through
  }
  return fallback.get(key) ?? null;
}

function writeRaw(key: string, value: string) {
  fallback.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the change lasts for this page only.
  }
  window.dispatchEvent(new Event(EVENT));
}

/**
 * A stored string preference. `parse` turns what is stored into a value or
 * null when it is not one this version understands, so a stale or tampered
 * entry falls back to the default instead of breaking the page.
 */
export function useStoredPref<T extends string | number | boolean>(
  key: string,
  initial: T,
  parse: (raw: string) => T | null
): [T, (value: T) => void] {
  // The snapshot must be referentially stable, so compare the raw string and
  // parse outside the store.
  const raw = useSyncExternalStore(subscribe, () => readRaw(key), () => null);
  const value = raw === null ? initial : parse(raw) ?? initial;
  const set = useCallback((next: T) => writeRaw(key, String(next)), [key]);
  return [value, set];
}

export type View = "grid" | "list";

/**
 * Grid or list for the Resources overview. Kept on its own key: the subject
 * explorer has Explorer's full set of views and remembers them separately.
 */
export function useStoredView(): [View, (view: View) => void] {
  return useStoredPref<View>("resources:view", "grid", (raw) => (raw === "grid" || raw === "list" ? raw : null));
}
