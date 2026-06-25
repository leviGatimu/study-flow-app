'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// useLayoutEffect warns during SSR; fall back to useEffect on the server.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
import { usePathname, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, X, Sparkles, Check, Compass } from 'lucide-react';

type Placement = 'top' | 'bottom' | 'left' | 'right';
type Step = { selector?: string; title: string; body: string; placement?: Placement };

const STORAGE_KEY = 'study-flow-onboarded';
const CARD_W = 360;

// The tour lives entirely on the dashboard (`/`); steps anchor to the always-
// present sidebar nav and a few dashboard elements via [data-tour] attributes.
const STEPS: Step[] = [
  {
    title: 'Welcome to Study Flow 👋',
    body: "Your private academic command center. Let's take a 60-second tour of the essentials — you can skip anytime.",
  },
  {
    selector: '[data-tour="sidebar"]',
    title: 'Everything lives here',
    body: 'Your sidebar holds every tool — subjects, timetable, exams, focus mode, AI and more, grouped for quick access.',
    placement: 'right',
  },
  {
    selector: '[data-tour="streak"]',
    title: 'Build your streak 🔥',
    body: 'Complete a task each day to grow your streak and earn XP. Heading on a break? You can pause it from the calendar.',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="todays-focus"]',
    title: "Today's focus",
    body: 'Your tasks for today, ordered by time. Check them off, attach proof of work, or jump into a focus session.',
    placement: 'top',
  },
  {
    selector: '[data-tour="quick-add"]',
    title: 'Add a task in seconds',
    body: 'Drop in a one-off task or study block on the fly — it lands straight on today and your calendar.',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="command-palette"]',
    title: 'Jump anywhere instantly',
    body: 'Press ⌘E (Ctrl+E) to open the command palette and fly to any page or action without touching the mouse.',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="nav-exams"]',
    title: 'Exams & timetable',
    body: 'Upload a photo of your timetable and AI schedules every exam on your calendar — plus a revision plan around your week.',
    placement: 'right',
  },
  {
    selector: '[data-tour="nav-focus-mode"]',
    title: 'Deep Focus Mode',
    body: 'A full-screen study zone: timer, ambient music with lyrics, wellness nudges, and an AI tutor for your material.',
    placement: 'right',
  },
  {
    selector: '[data-tour="nav-ai-buddy"]',
    title: 'Your AI study buddy',
    body: 'Ask questions, summarize notes, and get help planning. Add your free API key once in Settings to switch it on.',
    placement: 'right',
  },
  {
    title: "You're all set! 🎉",
    body: 'That\'s the tour. You can replay it anytime with the “Take a tour” button on your dashboard. Now go execute.',
  },
];

export function OnboardingTour() {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardH, setCardH] = useState(220);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const start = useCallback(() => {
    setI(0);
    setActive(true);
  }, []);

  const finish = useCallback(() => {
    setActive(false);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
  }, []);

  const next = useCallback(() => {
    setI((prev) => {
      if (prev >= STEPS.length - 1) {
        finish();
        return prev;
      }
      return prev + 1;
    });
  }, [finish]);

  const back = useCallback(() => setI((prev) => Math.max(0, prev - 1)), []);

  // Auto-start: first visit ever, or ?tour=1 (used by replay buttons elsewhere).
  useEffect(() => {
    if (pathname !== '/') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tour') === '1') {
        window.history.replaceState(null, '', '/');
        timer = setTimeout(start, 450);
      } else if (!localStorage.getItem(STORAGE_KEY)) {
        timer = setTimeout(start, 900);
      }
    } catch {
      // ignore
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [pathname, start]);

  // Any element with [data-tour-start] (or the custom event) launches the tour;
  // off-dashboard it routes home first so the anchors exist.
  useEffect(() => {
    const launch = () => {
      if (pathname !== '/') router.push('/?tour=1');
      else start();
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
  }, [pathname, router, start]);

  // Locate + measure the current target (re-measures on scroll/resize).
  useEffect(() => {
    if (!active) return;
    const measure = () => {
      const sel = STEPS[i]?.selector;
      if (!sel) {
        setRect(null);
        return;
      }
      const el = document.querySelector(sel) as HTMLElement | null;
      setRect(el ? el.getBoundingClientRect() : null);
    };

    const sel = STEPS[i]?.selector;
    const el = sel ? (document.querySelector(sel) as HTMLElement | null) : null;
    if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });

    measure();
    const t1 = setTimeout(measure, 250);
    const t2 = setTimeout(measure, 550);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [active, i]);

  useIsoLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [i, active, rect]);

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

  if (!mounted || !active) return null;

  const step = STEPS[i];
  const isFirst = i === 0;
  const isLast = i === STEPS.length - 1;
  const pad = 12;

  // Position the tooltip card relative to the spotlight (or centered).
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
      {/* Click blocker so the app behind stays untouched during the tour */}
      <div className="absolute inset-0" />

      {/* Spotlight cutout (or full dim for centered steps) */}
      {rect ? (
        <motion.div
          className="absolute pointer-events-none"
          initial={false}
          animate={{ top: rect.top - 10, left: rect.left - 10, width: rect.width + 20, height: rect.height + 20 }}
          transition={{ type: 'spring', stiffness: 280, damping: 32 }}
        >
          {/* dim everything except this box */}
          <div className="absolute inset-0 rounded-[20px]" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.74)' }} />
          {/* crisp accent ring */}
          <div className="absolute inset-0 rounded-[20px] ring-2 ring-primary" />
          {/* breathing halo */}
          <motion.div
            className="absolute -inset-1.5 rounded-[26px] border-2 border-primary/50"
            animate={{ opacity: [0.65, 0, 0.65], scale: [1, 1.05, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      ) : (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-[3px]" />
      )}

      {/* Always-available skip */}
      <motion.button
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={finish}
        className="fixed top-6 right-6 z-[202] flex items-center gap-2 pl-4 pr-3 py-2.5 rounded-full bg-card/90 backdrop-blur-xl border border-border/60 text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-border shadow-lg transition-all active:scale-95"
      >
        Skip tour <X className="w-3.5 h-3.5" />
      </motion.button>

      {/* Tooltip card */}
      <motion.div
        ref={cardRef}
        key={i}
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        style={{ width: CARD_W, ...cardStyle }}
        className="absolute z-[201] rounded-[28px] border border-border/60 bg-card/95 backdrop-blur-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.65)] overflow-hidden text-foreground"
      >
        {/* ambient glow + top accent */}
        <div className="absolute -top-20 -right-16 w-44 h-44 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />

        <div className="relative p-7">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 border border-primary/30 flex items-center justify-center shadow-inner shrink-0">
              {isLast ? <Check className="w-5 h-5 text-primary" /> : isFirst ? <Compass className="w-5 h-5 text-primary" /> : <Sparkles className="w-5 h-5 text-primary" />}
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-[0.25em] text-primary/70">Guided Tour</span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                Step {i + 1} of {STEPS.length}
              </span>
            </div>
          </div>

          <h3 className="text-2xl font-heading font-black tracking-tight leading-tight mb-2.5">{step.title}</h3>
          <p className="text-sm font-semibold text-muted-foreground leading-relaxed">{step.body}</p>

          {/* Progress bar */}
          <div className="mt-6 h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
              initial={false}
              animate={{ width: `${((i + 1) / STEPS.length) * 100}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 30 }}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between gap-3 mt-6">
            {!isFirst ? (
              <Button variant="ghost" onClick={back} className="h-11 px-4 rounded-2xl font-bold text-sm gap-1.5 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
            ) : (
              <span />
            )}
            <Button
              onClick={next}
              className="h-11 px-6 rounded-2xl font-black text-sm gap-2 shadow-lg shadow-primary/25 hover:scale-[1.03] active:scale-95 transition-transform"
            >
              {isLast ? 'Finish 🎉' : isFirst ? 'Start tour' : 'Next'}
              {!isLast && <ArrowRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
