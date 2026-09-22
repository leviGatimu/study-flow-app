"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Grid or list, remembered per browser.
 *
 * useSyncExternalStore rather than an effect so the server renders "grid",
 * the client corrects it during hydration, and no render ever sets state.
 * Both explorer pages share the key: switching to list view in a subject
 * should mean list view at the top level too.
 */

export type View = "grid" | "list";

const KEY = "resources:view";
const EVENT = "resources:view-change";

// When storage is blocked the choice still holds for the session.
let fallback: View | null = null;

function read(): View {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "list" || stored === "grid") return stored;
  } catch {
    // fall through
  }
  return fallback ?? "grid";
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function useStoredView(): [View, (view: View) => void] {
  const view = useSyncExternalStore(subscribe, read, () => "grid" as View);
  const setView = useCallback((next: View) => {
    fallback = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private mode or blocked storage: the change lasts for this page only.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [view, setView];
}
