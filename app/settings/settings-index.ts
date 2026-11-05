import {
  BrainCircuit,
  CalendarClock,
  Database,
  Palette,
  RefreshCw,
  ShieldAlert,
  User,
  type LucideIcon,
} from "lucide-react";

export type SectionId = "profile" | "schedule" | "ai" | "appearance" | "sync" | "data" | "danger";

export const SECTIONS: { id: SectionId; label: string; icon: LucideIcon; description: string }[] = [
  { id: "profile", label: "Account", icon: User, description: "Your name, password and getting-started help." },
  { id: "schedule", label: "Schedule & time", icon: CalendarClock, description: "Your time zone, term label and focus lengths." },
  { id: "ai", label: "AI", icon: BrainCircuit, description: "Which AI answers, your keys, and the offline model." },
  { id: "appearance", label: "Appearance", icon: Palette, description: "Light or dark, and the main colour." },
  { id: "sync", label: "Sync & apps", icon: RefreshCw, description: "The desktop app, the website, and installing Study Flow." },
  { id: "data", label: "Data & backup", icon: Database, description: "Download a backup, restore one, or check your data." },
  { id: "danger", label: "Reset", icon: ShieldAlert, description: "Changes that delete data. Read each one before you use it." },
];

/**
 * Old ?tab= values, so links written before the regroup still land somewhere
 * sensible. `ai` and `sync` are unchanged: the guided tour, setup checklist
 * and admin pages deep-link to them.
 */
const ALIASES: Record<string, SectionId> = { account: "profile", focus: "schedule", about: "sync" };

export function sectionFromParam(param: string | null): SectionId | null {
  if (!param) return null;
  if (SECTIONS.some((s) => s.id === param)) return param as SectionId;
  return ALIASES[param] ?? null;
}

/**
 * Every setting the search box can find. `id` matches the SettingRow id
 * (element `setting-<id>`); `words` are extra terms people might type.
 */
export const SETTINGS_INDEX: { id: string; label: string; section: SectionId; words: string }[] = [
  { id: "display-name", label: "Display name", section: "profile", words: "name greeting account" },
  { id: "username", label: "Username", section: "profile", words: "login sign in account joined" },
  { id: "full-profile", label: "Profile and photo", section: "profile", words: "avatar picture bio school" },
  { id: "password", label: "Password", section: "profile", words: "security change sign in" },
  { id: "log-out", label: "Log out", section: "profile", words: "sign out session logout" },
  { id: "log-out-everywhere", label: "Log out everywhere", section: "profile", words: "sign out all devices sessions stolen lost phone security" },
  { id: "setup", label: "Set up your year", section: "profile", words: "onboarding wizard setup" },
  { id: "tour", label: "Guided tour", section: "profile", words: "help walkthrough tutorial" },
  { id: "timezone", label: "Time zone", section: "schedule", words: "clock timezone region country day" },
  { id: "term-label", label: "Term label", section: "schedule", words: "academic marks term semester" },
  { id: "year-terms", label: "Year & terms", section: "schedule", words: "academic year archive dates" },
  { id: "focus-lengths", label: "Focus lengths", section: "schedule", words: "pomodoro timer durations minutes" },
  { id: "main-ai", label: "Main AI", section: "ai", words: "provider gemini openai ollama assistant" },
  { id: "gemini-key", label: "Google Gemini key", section: "ai", words: "api key google gemini" },
  { id: "openai-key", label: "OpenAI key", section: "ai", words: "api key chatgpt gpt openai" },
  { id: "test-ai", label: "Test your AI", section: "ai", words: "check connection working model" },
  { id: "ollama", label: "Offline model (Ollama)", section: "ai", words: "local offline llama ollama internet" },
  { id: "theme", label: "Theme", section: "appearance", words: "dark light mode colour color appearance" },
  { id: "accent", label: "Main colour", section: "appearance", words: "accent primary colour color theme blue green violet rose purple teal" },
  { id: "sync", label: "Sync with the website", section: "sync", words: "desktop pair server website" },
  { id: "app", label: "Install or update the app", section: "sync", words: "desktop install update version pwa" },
  { id: "download-backup", label: "Download a backup", section: "data", words: "export save json backup" },
  { id: "restore-backup", label: "Restore a backup", section: "data", words: "import upload json restore" },
  { id: "check-data", label: "Check your data", section: "data", words: "integrity verify count database" },
  { id: "delete-blocks", label: "Delete this year's study blocks", section: "danger", words: "reset clear remove wipe tasks" },
];

export function searchSettings(query: string) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const sectionLabel = (id: SectionId) => SECTIONS.find((s) => s.id === id)!.label;
  return SETTINGS_INDEX.map((item) => {
    const label = item.label.toLowerCase();
    const haystack = `${label} ${item.words} ${sectionLabel(item.section).toLowerCase()}`;
    if (!terms.every((t) => haystack.includes(t))) return null;
    // Label matches first, label prefixes before that.
    const score = terms.reduce((s, t) => s + (label.startsWith(t) ? 3 : label.includes(t) ? 2 : 0), 0);
    return { ...item, sectionLabel: sectionLabel(item.section), score };
  })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.score - a.score);
}

/** localStorage key: when this device last downloaded a backup (ISO string). */
export const LAST_BACKUP_KEY = "study-flow-last-backup";
export const BACKUP_EVENT = "study-flow-backup";

export function readLastBackup(): string | null {
  try {
    return localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
}

export function subscribeLastBackup(onChange: () => void) {
  window.addEventListener(BACKUP_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(BACKUP_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function recordBackup() {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
  } catch {}
  window.dispatchEvent(new Event(BACKUP_EVENT));
}

/** The nearest scrolling ancestor: the app's <main>, or null for the window. */
export function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return null;
}

/**
 * Scroll only the element's own scroller. scrollIntoView would also scroll
 * the app frame around <main>, pushing the top bar out of sight.
 */
export function scrollToElement(el: HTMLElement, { smooth = true, center = false } = {}) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const behavior: ScrollBehavior = smooth && !reduce ? "smooth" : "auto";
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  const scroller = scrollParent(el);
  const viewTop = scroller ? scroller.getBoundingClientRect().top : 0;
  const viewHeight = scroller ? scroller.clientHeight : window.innerHeight;
  const rect = el.getBoundingClientRect();
  const offset = center
    ? rect.top - viewTop - Math.max((viewHeight - rect.height) / 2, margin)
    : rect.top - viewTop - margin;
  if (scroller) scroller.scrollBy({ top: offset, behavior });
  else window.scrollBy({ top: offset, behavior });
}

/** Scroll a setting row into view, flash it, and focus its first control. */
export function jumpToSetting(id: string, flashClass: string) {
  const row = document.getElementById(`setting-${id}`);
  if (!row) return;
  scrollToElement(row, { center: true });
  // Remove, reflow, re-add: restarts the animation when the same row is picked twice.
  row.classList.remove(flashClass);
  void row.offsetWidth;
  row.classList.add(flashClass);
  window.setTimeout(() => row.classList.remove(flashClass), 1700);
  const control = row.querySelector<HTMLElement>(
    "input:not([type=file]):not([disabled]), select:not([disabled]), button:not([disabled]), a[href]"
  );
  control?.focus({ preventScroll: true });
}
