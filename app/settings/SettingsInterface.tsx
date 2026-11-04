"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Search } from "lucide-react";

import { Page, PageBody } from "@/components/ui/page";
import { PageHeader } from "@/components/ui/page-header";
import { selectClass, type SettingsData } from "./settings-ui";
import { ProfileSettings } from "./ProfileSettings";
import { ScheduleSettings } from "./ScheduleSettings";
import { AISettings } from "./AISettings";
import { AppearanceSettings } from "./AppearanceSettings";
import { SyncSettings } from "./SyncSettings";
import { DataSettings, DangerSettings } from "./DataSettings";
import { SetupStatus, useSetupItems, type SetupCounts } from "./SetupStatus";
import {
  SECTIONS,
  jumpToSetting,
  scrollParent,
  scrollToElement,
  searchSettings,
  sectionFromParam,
  type SectionId,
} from "./settings-index";
import styles from "./Settings.module.css";

export default function SettingsInterface({
  initialData,
  counts,
}: {
  initialData: SettingsData;
  counts: SetupCounts;
}) {
  const reduceMotion = useReducedMotion();
  const params = useSearchParams();
  const contentRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<SectionId>(() => sectionFromParam(params.get("tab")) ?? "profile");
  // While a nav click is smooth-scrolling, ignore the sections it passes.
  const lockUntil = useRef(0);

  const setupItems = useSetupItems(initialData, counts);
  const needsAttention = new Set(setupItems.filter((i) => !i.done && i.section).map((i) => i.section));

  const jump = useCallback((settingId: string) => jumpToSetting(settingId, styles.flash), []);

  const goToSection = useCallback(
    (id: SectionId | "status", smooth = true) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id !== "status") {
        setActive(id);
        lockUntil.current = Date.now() + 900;
        // The URL is the state: a reload or a shared link opens the same section.
        window.history.replaceState(null, "", `?tab=${id}`);
      }
      scrollToElement(el, { smooth });
    },
    []
  );

  // Deep links (?tab=ai from the tour, ?tab=sync from admin): open at that
  // section once on arrival.
  useEffect(() => {
    const initial = sectionFromParam(new URLSearchParams(window.location.search).get("tab"));
    // The first section already sits at the top, under the setup status.
    const el = initial && initial !== SECTIONS[0].id && document.getElementById(initial);
    if (el) scrollToElement(el, { smooth: false });
  }, []);

  // Scroll spy: the active section is the last one whose top has passed the
  // band near the top of the scroller, or the last one at the very bottom.
  useEffect(() => {
    const scroller = scrollParent(contentRef.current);
    const target: HTMLElement | Window = scroller ?? window;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (Date.now() < lockUntil.current) return;
      const sections = [...document.querySelectorAll<HTMLElement>("[data-settings-section]")];
      if (!sections.length) return;
      const top = scroller ? scroller.getBoundingClientRect().top : 0;
      const atBottom = scroller
        ? scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4
        : window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current = sections[0].id;
      for (const s of sections) if (s.getBoundingClientRect().top - top <= 160) current = s.id;
      if (atBottom) current = sections[sections.length - 1].id;
      setActive(current as SectionId);
    };
    const onScroll = () => {
      // A nav click owns the highlight until the scroll it started has
      // settled; otherwise reaching the bottom would hand it to "Reset".
      if (Date.now() < lockUntil.current) {
        lockUntil.current = Date.now() + 200;
        return;
      }
      if (!frame) frame = requestAnimationFrame(update);
    };
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      target.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const doneCount = setupItems.filter((i) => i.done).length;

  return (
    <Page>
      <PageHeader
        className="pt-7 pb-5 [&_h1]:text-3xl [&_h1]:font-semibold"
        title="Settings"
        description="Make Study Flow work the way you do."
      />
      <PageBody className="pt-8">
        <div className={styles.layout}>
          <nav aria-label="Settings sections" className={styles.navigation}>
            <SettingsSearch onPick={jump} shortcut />
            <ul className={styles.navList}>
              {SECTIONS.map((s, index) => {
                const Icon = s.icon;
                const current = s.id === active;
                return (
                  <li key={s.id}>
                    {index === SECTIONS.length - 1 && <div className={styles.navDivider} aria-hidden="true" />}
                    <button
                      type="button"
                      onClick={() => goToSection(s.id)}
                      aria-current={current ? "true" : undefined}
                      className={styles.navButton}
                    >
                      {current && (
                        <motion.span
                          layoutId="settings-nav-pill"
                          className={styles.navPill}
                          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                        />
                      )}
                      <Icon />
                      <span className={styles.navLabel}>{s.label}</span>
                      {needsAttention.has(s.id) && (
                        <span className={styles.navDot} title="Needs attention" aria-label="needs attention" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            <button type="button" className={styles.navProgress} onClick={() => goToSection("status")}>
              <span className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">Setup</span>
                <span className="tabular-nums text-muted-foreground">
                  {doneCount} of {setupItems.length}
                </span>
              </span>
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <span
                  className="block h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${(doneCount / setupItems.length) * 100}%` }}
                />
              </span>
            </button>
          </nav>

          <div ref={contentRef} className="min-w-0">
            {/* Phone and tablet: search plus one jump menu, so nothing scrolls sideways. */}
            <div className={styles.mobileBar}>
              <SettingsSearch onPick={jump} />
              <select
                aria-label="Jump to section"
                value={active}
                onChange={(e) => goToSection(e.target.value as SectionId)}
                className={selectClass}
              >
                {SECTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.content}>
              <SetupStatus items={setupItems} onJump={jump} />
              <ProfileSettings data={initialData} />
              <ScheduleSettings data={initialData} />
              <AISettings data={initialData} />
              <AppearanceSettings />
              <SyncSettings />
              <DataSettings />
              <DangerSettings />
            </div>
          </div>
        </div>
      </PageBody>
    </Page>
  );
}

/** Finds any setting by name or by what it does, and jumps to it. */
function SettingsSearch({ onPick, shortcut = false }: { onPick: (id: string) => void; shortcut?: boolean }) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const results = searchSettings(query);

  // "/" focuses the search from anywhere on the page, unless you are typing.
  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (!inputRef.current?.offsetParent) return; // hidden at this width
      e.preventDefault();
      inputRef.current.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);

  const pick = (id: string) => {
    setQuery("");
    setOpen(false);
    onPick(id);
  };

  const showList = open && query.trim() !== "";

  return (
    <div className={styles.search}>
      <Search className={styles.searchIcon} aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Search settings"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && results[highlight] ? `${listId}-${results[highlight].id}` : undefined}
        aria-autocomplete="list"
        placeholder="Search settings"
        value={query}
        className={styles.searchInput}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, Math.max(results.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter" && results[highlight]) {
            e.preventDefault();
            pick(results[highlight].id);
          } else if (e.key === "Escape") {
            setQuery("");
            setOpen(false);
          }
        }}
      />
      {shortcut && !query && <kbd className={styles.searchKey} aria-hidden="true">/</kbd>}
      {showList && (
        <div id={listId} role="listbox" aria-label="Matching settings" className={styles.results}>
          {results.length === 0 ? (
            <p className={styles.noResults}>No setting matches “{query.trim()}”.</p>
          ) : (
            results.map((r, i) => (
              <button
                key={r.id}
                id={`${listId}-${r.id}`}
                type="button"
                role="option"
                aria-selected={i === highlight}
                tabIndex={-1}
                className={styles.result}
                // mousedown, not click: the input's blur would close the list first.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(r.id);
                }}
                onMouseEnter={() => setHighlight(i)}
              >
                <strong>{r.label}</strong>
                <span>{r.sectionLabel}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
