'use client';

/**
 * The guided tour.
 *
 * It WALKS. Each step in tour-steps.ts names a route; this navigates there,
 * waits for the thing it wants to point at to actually exist, and only then
 * spotlights it. The previous version never left the dashboard and described
 * five other pages in prose, which is why people finished it no better oriented
 * than they started.
 *
 * Three things that are easy to get wrong here, and how they are handled:
 *
 *   THE ANCHOR IS NOT THERE YET. A route change renders on the server, so the
 *   element a step wants can be hundreds of milliseconds away. Measuring
 *   immediately would spotlight nothing; so the step polls for its anchor and
 *   shows a plain "opening..." card in the meantime, then gives up gracefully
 *   into a centred card rather than hanging.
 *
 *   THE ANCHOR IS THERE BUT INVISIBLE. Elements that only exist above a
 *   breakpoint (the sidebar rail, the header stat strip) still answer
 *   querySelector while measuring 0x0 at 0,0 - which would spotlight the corner
 *   of the screen. Zero-size counts as absent.
 *
 *   THE USER RELOADS MID-TOUR. Position is mirrored into sessionStorage so a
 *   refresh resumes where they were instead of dumping them back at step one.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, X, Check, Compass, Loader2, SkipForward } from 'lucide-react';
import { markOnboarded } from '@/lib/actions';
import { TOUR_STEPS, TOUR_CHAPTERS, routePath } from './tour-steps';

/**
 * A second, local guard - NOT the source of truth.
 *
 * Whether this account has seen the tour lives on the account
 * (UserProgress.onboardedAt), because localStorage could not hold it: the
 * desktop app binds the first free port from 3000, and localhost:3000 and
 * localhost:3001 are different origins with different storage, so the flag
 * vanished on almost every launch and the tour introduced itself again to
 * somebody who had dismissed it a dozen times.
 *
 * This key survives only to stop the tour reappearing in the seconds between
 * dismissing it and the server round trip landing.
 */
const STORAGE_KEY = 'study-flow-onboarded';

/** Where the user had got to, so a page refresh does not restart the tour. */
const RESUME_KEY = 'study-flow-tour-step';

const CARD_W = 380;

/** How long to wait for a step's anchor after navigating, before giving up. */
const ANCHOR_TIMEOUT_MS = 4000;

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function OnboardingTour({ hasOnboarded = true }: { hasOnboarded?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [i, setI] = useState(0);
  /**
   * The last measurement, tagged with the step it belongs to.
   *
   * Tagged rather than plain, so that "we have not measured this step yet" and
   * "this step has nothing to point at" are different states. Everything the
   * render needs is derived from it, which is why nothing below sets state
   * synchronously inside an effect - the measurement genuinely arrives later,
   * from a timer or a listener, and pretending otherwise caused a frame where
   * the spotlight sat over the previous step's element.
   */
  const [measured, setMeasured] = useState<{ stepId: string; rect: DOMRect | null } | null>(null);
  const [cardH, setCardH] = useState(240);
  const cardRef = useRef<HTMLDivElement>(null);

  const step = TOUR_STEPS[i];
  const onRoute = Boolean(step) && pathname === routePath(step.route);
  const rect = measured?.stepId === step?.id ? measured.rect : null;
  /** Nothing to show yet: the page is still arriving, or the anchor is. */
  const waiting = Boolean(step) && (!onRoute || (Boolean(step.selector) && measured?.stepId !== step.id));

  const start = useCallback((at = 0) => {
    setI(at);
    setActive(true);
  }, []);

  const finish = useCallback(() => {
    setActive(false);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
      sessionStorage.removeItem(RESUME_KEY);
    } catch {
      // A browser with storage disabled still gets the line below, which is
      // the one that actually counts.
    }
    // Finishing and skipping are the same statement - "I have seen this" - so
    // both record it. Fire and forget: nothing on screen depends on the answer,
    // and a failed write means at worst one more tour, not a broken app.
    void markOnboarded();
  }, []);

  const goTo = useCallback(
    (index: number) => {
      if (index >= TOUR_STEPS.length) {
        finish();
        return;
      }
      setI(Math.max(0, index));
    },
    [finish]
  );

  const next = useCallback(() => goTo(i + 1), [goTo, i]);
  const back = useCallback(() => goTo(i - 1), [goTo, i]);

  /** Jump past everything in the current chapter - for the parts you know. */
  const skipChapter = useCallback(() => {
    const chapter = TOUR_STEPS[i]?.chapter;
    let index = i;
    while (index < TOUR_STEPS.length && TOUR_STEPS[index].chapter === chapter) index++;
    goTo(index);
  }, [goTo, i]);

  // Remember the position for a reload. Session-scoped on purpose: a new tab
  // tomorrow is a new visit, not an interrupted tour.
  useEffect(() => {
    if (!active) return;
    try {
      sessionStorage.setItem(RESUME_KEY, String(i));
    } catch {
      // nothing to do; resume is a convenience, not a requirement
    }
  }, [active, i]);

  // Auto-start: a genuinely new account, ?tour=1 from a replay button, or an
  // interrupted tour picked back up after a refresh.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tour') === '1') {
        // Strip the flag so a refresh does not relaunch it.
        window.history.replaceState(null, '', window.location.pathname);
        try {
          sessionStorage.removeItem(RESUME_KEY);
        } catch {
          // ignore
        }
        timer = setTimeout(() => start(0), 400);
        return () => { if (timer) clearTimeout(timer); };
      }

      const resume = sessionStorage.getItem(RESUME_KEY);
      if (resume !== null) {
        const at = Number(resume);
        if (Number.isInteger(at) && at >= 0 && at < TOUR_STEPS.length) {
          timer = setTimeout(() => start(at), 300);
          return () => { if (timer) clearTimeout(timer); };
        }
      }

      // First run only, and only from the dashboard - the tour's first steps
      // are there, and starting it on top of some other page the user opened
      // deliberately would be rude.
      if (!hasOnboarded && pathname === '/' && !localStorage.getItem(STORAGE_KEY)) {
        timer = setTimeout(() => start(0), 900);
      }
    } catch {
      // Storage can throw outright in a private window; the account flag has
      // already decided, so this only affects the grace period.
      if (!hasOnboarded && pathname === '/') timer = setTimeout(() => start(0), 900);
    }
    return () => { if (timer) clearTimeout(timer); };
    // Deliberately runs once. Re-running on every navigation would restart the
    // tour each time the tour itself moved the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Any element with [data-tour-start] (or the custom event) launches the tour.
  useEffect(() => {
    const launch = () => {
      try {
        sessionStorage.removeItem(RESUME_KEY);
      } catch {
        // ignore
      }
      start(0);
      // The first step lives on the dashboard; the navigation effect below will
      // take us there, so there is nothing to do about the current route here.
    };
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest('[data-tour-start]');
      if (el) {
        e.preventDefault();
        launch();
      }
    };
    window.addEventListener('study-flow:start-tour', launch);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('study-flow:start-tour', launch);
      document.removeEventListener('click', onClick);
    };
  }, [start]);

  // Take the user to the step's page. Separate from measuring so that a step
  // which is already on the right page never pays for a navigation.
  useEffect(() => {
    if (!active || !step || onRoute) return;
    router.push(step.route);
  }, [active, step, onRoute, router]);

  // Find and measure the anchor, re-measuring while the page settles.
  useEffect(() => {
    if (!active || !step || !onRoute) return;
    // A step with nothing to point at needs no measurement: `rect` derives to
    // null and the card centres itself.
    if (!step.selector) return;

    const selector = step.selector;
    const stepId = step.id;
    let cancelled = false;
    const startedAt = Date.now();

    // An element hidden at this breakpoint (the rail and the stat strip are
    // both md+) still answers querySelector, but measures 0x0 at 0,0 - which
    // would spotlight the top-left corner of the screen. Treat it as absent.
    const locate = (): { el: HTMLElement; box: DOMRect } | null => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) return null;
      const box = el.getBoundingClientRect();
      return box.width > 0 && box.height > 0 ? { el, box } : null;
    };

    const remeasure = () => {
      if (cancelled) return;
      setMeasured({ stepId, rect: locate()?.box ?? null });
    };

    const tick = () => {
      if (cancelled) return;

      const found = locate();
      if (found) {
        clearInterval(poll);
        found.el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
        setMeasured({ stepId, rect: found.box });
        // The smooth scroll moves it after this frame, so re-measure as it
        // lands rather than spotlighting where it used to be.
        settle.push(setTimeout(remeasure, 300), setTimeout(remeasure, 650));
        return;
      }

      if (Date.now() - startedAt > ANCHOR_TIMEOUT_MS) {
        clearInterval(poll);
        // Degrade to a centred card. The step still teaches; it just cannot
        // point. Say so in development, because this is how anchors rot: a
        // missing one looks deliberate.
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[OnboardingTour] "${stepId}" anchor never appeared: ${selector}`);
        }
        setMeasured({ stepId, rect: null });
      }
    };

    const settle: ReturnType<typeof setTimeout>[] = [];
    // Deliberately no synchronous first look: a route change renders on the
    // server, so the anchor is usually a few hundred milliseconds away, and
    // the first tick costs one frame.
    const poll = setInterval(tick, 120);
    const kick = setTimeout(tick, 0);

    window.addEventListener('resize', remeasure);
    window.addEventListener('scroll', remeasure, true);
    return () => {
      cancelled = true;
      clearInterval(poll);
      clearTimeout(kick);
      settle.forEach(clearTimeout);
      window.removeEventListener('resize', remeasure);
      window.removeEventListener('scroll', remeasure, true);
    };
  }, [active, step, onRoute]);

  useIsoLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [i, active, rect, waiting]);

  // Move focus onto the card as each step opens, so a keyboard or screen-reader
  // user is reading the tour rather than whatever was focused behind it.
  useEffect(() => {
    if (!active || waiting) return;
    cardRef.current?.focus({ preventScroll: true });
  }, [active, i, waiting]);

  // Keyboard navigation.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, next, back, finish]);

  const chapterIndex = useMemo(
    () => (step ? TOUR_CHAPTERS.indexOf(step.chapter) : -1),
    [step]
  );

  // No separate "mounted" flag: `active` only ever becomes true from a client
  // timer or a click, so by the time this renders a portal there is certainly a
  // document to portal into.
  if (!active || !step) return null;

  const isFirst = i === 0;
  const isLast = i === TOUR_STEPS.length - 1;
  const pad = 14;

  // Position the tooltip card relative to the spotlight (or centred).
  let cardStyle: React.CSSProperties;
  if (!rect) {
    cardStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  } else {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const placement = step.placement || 'bottom';
    let top = 0;
    let left = 0;
    if (placement === 'bottom') {
      top = rect.bottom + pad;
      left = cx - CARD_W / 2;
      if (top + cardH + pad > vh) top = rect.top - cardH - pad;
    } else if (placement === 'top') {
      top = rect.top - cardH - pad;
      left = cx - CARD_W / 2;
      if (top < pad) top = rect.bottom + pad;
    } else if (placement === 'right') {
      left = rect.right + pad;
      top = cy - cardH / 2;
      if (left + CARD_W + pad > vw) left = rect.left - CARD_W - pad;
    } else {
      left = rect.left - CARD_W - pad;
      top = cy - cardH / 2;
      if (left < pad) left = rect.right + pad;
    }
    left = Math.max(pad, Math.min(left, vw - CARD_W - pad));
    top = Math.max(pad, Math.min(top, vh - cardH - pad));
    cardStyle = { top, left };
  }

  return createPortal(
    <div className="fixed inset-0 z-[200]">
      {/* Click blocker, so the app behind stays untouched while the tour drives
          the navigation. The card's own buttons sit above it. */}
      <div className="absolute inset-0" />

      {/* Spotlight cutout, or a full dim for a step with nothing to point at. */}
      {rect ? (
        <motion.div
          className="pointer-events-none absolute"
          initial={false}
          animate={{
            top: rect.top - 10,
            left: rect.left - 10,
            width: rect.width + 20,
            height: rect.height + 20,
          }}
          transition={{ type: 'spring', stiffness: 280, damping: 32 }}
        >
          <div
            className="absolute inset-0 rounded-xl"
            style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.74)' }}
          />
          <div className="absolute inset-0 rounded-xl ring-2 ring-primary/70" />
        </motion.div>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-black/74" />
      )}

      <motion.div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
        aria-describedby="tour-step-body"
        key={step.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        style={{ ...cardStyle, width: CARD_W, maxWidth: 'calc(100vw - 28px)' }}
        className="absolute rounded-2xl border border-border/60 bg-card p-5 shadow-2xl outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-primary">
            <Compass className="h-3 w-3" />
            {step.chapter}
          </p>
          <button
            type="button"
            onClick={finish}
            aria-label="Leave the tour"
            className="-mr-1 -mt-1 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {waiting ? (
          <div className="flex items-center gap-2.5 py-6 text-sm font-semibold text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Opening {routePath(step.route)}…
          </div>
        ) : (
          <>
            <h2 id="tour-step-title" className="mt-2 font-heading text-lg font-black leading-snug">
              {step.title}
            </h2>
            <p
              id="tour-step-body"
              className="mt-2 text-sm leading-relaxed text-muted-foreground"
            >
              {step.body}
            </p>
            {step.tryIt && (
              <p className="mt-3 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs font-semibold leading-relaxed text-primary">
                {step.tryIt}
              </p>
            )}
          </>
        )}

        {/* Chapter progress. Steps within a chapter are dots; chapters are the
            unit a person actually remembers, so they get the count. */}
        <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
          {TOUR_CHAPTERS.map((chapter, index) => (
            <span
              key={chapter}
              className={
                'h-1 flex-1 rounded-full ' +
                (index < chapterIndex
                  ? 'bg-primary/50'
                  : index === chapterIndex
                    ? 'bg-primary'
                    : 'bg-muted')
              }
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-muted-foreground">
            Step {i + 1} of {TOUR_STEPS.length}
          </span>
          <div className="flex items-center gap-1.5">
            {!isFirst && (
              <Button variant="ghost" size="sm" onClick={back}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            )}
            {!isLast && (
              <Button
                variant="ghost"
                size="sm"
                onClick={skipChapter}
                title="Skip the rest of this chapter"
              >
                <SkipForward className="h-3.5 w-3.5" />
                Skip part
              </Button>
            )}
            <Button size="sm" onClick={isLast ? finish : next}>
              {isLast ? 'Finish' : 'Next'}
              {isLast ? <Check className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
