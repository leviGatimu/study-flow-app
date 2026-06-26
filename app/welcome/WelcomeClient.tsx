'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Lenis from 'lenis';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Camera,
  Check,
  CloudOff,
  Code2,
  Database,
  Flame,
  HardDrive,
  Lock,
  Menu,
  MessageSquare,
  MonitorPlay,
  MousePointer2,
  Shield,
  Sparkles,
  Target,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import Hero from '@/components/landing/Hero';
import MacbookMockup from '@/components/landing/MacbookMockup';
import ScrollReveal from '@/components/landing/ScrollReveal';
import VideoEmbed from '@/components/landing/VideoEmbed';
import SandText from '@/components/landing/SandText';

const YOUTUBE_URL = 'https://www.youtube.com/channel/UCF19E7DtMFwa0eRv1BNiPbw';
const INSTAGRAM_URL = 'https://www.instagram.com/studyflowofficiall/';
const GITHUB_URL = 'https://github.com/leviGatimu/Study-Flow';
const DISCORD_URL = 'https://discord.gg/RQQfJAUCy';

const INK_GRAINS = ['#000000', '#070707', '#0d0d0d', '#050505', '#111111', '#030303'];
const LIGHT_GRAINS = ['#ffffff', '#e9eefb', '#cdd8f2', '#aebfe6', '#dde6fa', '#8fa6dd'];

const blobRadii = [
  '42% 58% 63% 37% / 41% 44% 56% 59%',
  '63% 37% 47% 53% / 38% 63% 37% 62%',
  '39% 61% 38% 62% / 58% 39% 61% 42%',
  '58% 42% 64% 36% / 49% 56% 44% 51%',
  '47% 53% 35% 65% / 64% 47% 53% 36%',
  '61% 39% 56% 44% / 36% 58% 42% 64%',
];

const features = [
  { icon: <Zap />, chip: 'bg-blue-600', blob: 'bg-blue-200', title: 'Auto-built agenda', desc: 'Your weekly templates turn into a precise daily to-do list at midnight. Wake up, execute.' },
  { icon: <Target />, chip: 'bg-emerald-500', blob: 'bg-emerald-200', title: 'Focus mode', desc: 'Mute everything and lock into one study block at a time, with a live countdown.' },
  { icon: <Flame />, chip: 'bg-amber-500', blob: 'bg-amber-200', title: 'Streaks & XP', desc: 'Every finished task feeds your streak and level — momentum you can actually see.' },
  { icon: <CalendarDays />, chip: 'bg-indigo-500', blob: 'bg-indigo-200', title: 'Workload heatmap', desc: 'Spot exam clusters and deadline pile-ups weeks before they become an emergency.' },
  { icon: <Sparkles />, chip: 'bg-sky-500', blob: 'bg-sky-200', title: 'On-device AI', desc: 'A private study assistant for notes, summaries and exam prep — nothing leaves your machine.' },
  { icon: <Lock />, chip: 'bg-slate-900', blob: 'bg-slate-200', title: 'Local & private', desc: 'Everything lives in your own database. No tracking, no noise — just your work.' },
];

const laptopPoints = [
  { t: 'Set your timetable once', d: 'Add subjects, times and deadlines as recurring templates — no code, no spreadsheets.' },
  { t: 'Wake up to a ready day', d: "Today's homework and revision are generated automatically, in time order." },
  { t: 'Review your whole semester', d: 'Calendar, history and insights keep every bit of effort in one place.' },
];

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'The app', href: '#desktop' },
  { label: 'Private', href: '#privacy' },
];

/* ------------------------------------------------------------------ */
/*  Custom arrow cursor                                               */
/* ------------------------------------------------------------------ */

function CustomCursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine =
      window.matchMedia('(pointer: fine)').matches && window.matchMedia('(hover: hover)').matches;
    if (!fine) return;

    const el = ref.current;
    if (!el) return;

    const root = document.documentElement;
    root.classList.add('has-custom-cursor');

    const interactiveSel = 'a,button,[role=button],input,textarea,select,summary,label,.cursor-grow';

    const onMove = (e: MouseEvent) => {
      el.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      if (el.style.opacity !== '1') el.style.opacity = '1';
      const target = e.target as Element | null;
      el.classList.toggle('is-hover', !!target?.closest?.(interactiveSel));
    };
    const onDown = () => el.classList.add('is-down');
    const onUp = () => el.classList.remove('is-down');
    const onLeave = () => (el.style.opacity = '0');
    const onEnter = () => (el.style.opacity = '1');

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('mouseenter', onEnter);

    return () => {
      root.classList.remove('has-custom-cursor');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mouseenter', onEnter);
    };
  }, []);

  return (
    <div ref={ref} className="custom-cursor" aria-hidden="true">
      <MousePointer2 size={30} strokeWidth={1.5} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function WelcomeClient() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Buttery smooth scrolling for the landing surface + in-page anchor routing.
  useEffect(() => {
    const wrapper = scrollRef.current;
    if (!wrapper) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({
      wrapper,
      content: wrapper.firstElementChild as HTMLElement,
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6,
    });

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('a[href^="#"]');
      if (!target) return;
      const href = target.getAttribute('href') || '';
      const id = href.slice(1);
      const el = id ? document.getElementById(id) : null;
      if (el) {
        e.preventDefault();
        setMenuOpen(false);
        lenis.scrollTo(el, { offset: -80 });
      }
    };
    wrapper.addEventListener('click', onClick);

    return () => {
      cancelAnimationFrame(raf);
      wrapper.removeEventListener('click', onClick);
      lenis.destroy();
    };
  }, []);

  // Shrink + blur the nav once the user scrolls a little.
  useEffect(() => {
    const wrapper = scrollRef.current;
    if (!wrapper) return;
    const onScroll = () => setScrolled(wrapper.scrollTop > 20);
    wrapper.addEventListener('scroll', onScroll, { passive: true });
    return () => wrapper.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      ref={scrollRef}
      className="landing-scroll absolute inset-0 z-[60] overflow-y-auto overflow-x-hidden bg-[#ececec] dark:bg-[#0a0e17] text-slate-900 dark:text-slate-50 font-sans"
    >
      <div className="relative">
        <div className="grain" />
        <CustomCursor />

        {/* ---- Navbar ---- */}
        <nav className={`fixed top-0 w-full z-[100] transition-all duration-300 ${scrolled ? 'py-3 backdrop-blur-xl bg-[#ececec]/80 dark:bg-[#0a0e17]/80 border-b border-black/5 dark:border-white/10' : 'py-6 bg-transparent'}`}>
          <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
            <Link href="/" className="inline-flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Study Flow logo" width={34} height={34} className="rounded-full" />
              <span className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Study Flow</span>
            </Link>

            <div className="hidden md:flex gap-10 items-center">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-slate-600 dark:text-slate-300 transition-all hover:text-slate-900 dark:hover:text-white"
                >
                  {link.label}
                </a>
              ))}
              <Link href="/login" className="text-sm font-medium text-slate-600 dark:text-slate-300 transition-all hover:text-slate-900 dark:hover:text-white">
                Log in
              </Link>
              <ThemeToggle />
              <Link
                href="/register"
                className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-500 transition-all flex items-center gap-2 group shadow-[0_10px_30px_-8px_rgba(37,99,235,0.7)]"
              >
                Get started
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="md:hidden flex items-center gap-2">
              <ThemeToggle />
              <button className="text-slate-900 dark:text-slate-50 p-1" onClick={() => setMenuOpen((o) => !o)} aria-label="Toggle menu">
                {menuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>

          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="md:hidden absolute top-full left-0 w-full bg-white dark:bg-slate-900 border-b border-black/5 dark:border-white/10 py-6 px-6 flex flex-col gap-6 shadow-2xl"
            >
              {navLinks.map((link) => (
                <a key={link.href} href={link.href} className="text-lg font-semibold text-slate-900 dark:text-slate-50" onClick={() => setMenuOpen(false)}>
                  {link.label}
                </a>
              ))}
              <Link href="/login" className="text-lg font-semibold text-slate-900 dark:text-slate-50" onClick={() => setMenuOpen(false)}>
                Log in
              </Link>
              <Link href="/register" className="bg-blue-600 text-white py-4 rounded-2xl font-semibold text-center" onClick={() => setMenuOpen(false)}>
                Get started
              </Link>
            </motion.div>
          )}
        </nav>

        {/* ---- Hero ---- */}
        <Hero />

        {/* ---- Demo video ---- */}
        <section className="px-6 pt-20 lg:pt-28">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-[0.3em]">The trailer</span>
              <h2 className="font-display text-4xl md:text-6xl font-semibold text-slate-900 dark:text-slate-50 tracking-tight leading-[0.98] mt-4">
                Meet <span className="text-blue-600 dark:text-blue-400">Study Flow.</span>
              </h2>
            </ScrollReveal>
            <ScrollReveal className="relative">
              <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-blue-300/30 dark:bg-blue-600/20 blur-2xl" />
              <VideoEmbed id="Xcjc0py2L-U" title="Study Flow" />
            </ScrollReveal>
          </div>
        </section>

        {/* ---- Features with splash shapes ---- */}
        <section id="features" className="px-6 py-28 lg:py-36 scroll-mt-24">
          <div className="max-w-7xl mx-auto">
            <ScrollReveal className="max-w-3xl">
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-[0.3em]">Everything in one place</span>
              <h2 className="font-display text-5xl md:text-7xl font-semibold text-slate-900 dark:text-slate-50 tracking-tight leading-[0.95] mt-5">
                Built for the way <br />
                you <span className="text-blue-600 dark:text-blue-400">actually study.</span>
              </h2>
              <p className="text-xl text-slate-500 dark:text-slate-400 leading-relaxed mt-6">
                Far more than a to-do list — a complete student workstation that keeps homework, revision and exams moving without the busywork.
              </p>
            </ScrollReveal>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
              {features.map((f, i) => (
                <ScrollReveal key={f.title} delay={(i % 3) * 0.08}>
                  <motion.div
                    whileHover={{ y: -8 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                    className="relative h-full overflow-hidden bg-white dark:bg-slate-900 rounded-[1.9rem] p-8 border border-black/[0.06] dark:border-white/10 shadow-[0_28px_60px_-34px_rgba(15,23,42,0.3)]"
                  >
                    <div
                      className={`absolute -top-10 -right-8 w-44 h-44 ${f.blob} opacity-70`}
                      style={{ borderRadius: blobRadii[i % blobRadii.length] }}
                    />
                    <div className="relative">
                      <div className={`w-16 h-16 ${f.chip} rounded-[1.3rem] flex items-center justify-center text-white mb-7 shadow-[0_14px_30px_-10px_rgba(15,23,42,0.5)]`}>
                        {f.icon}
                      </div>
                      <h3 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-50 tracking-tight mb-2">{f.title}</h3>
                      <p className="text-slate-500 dark:text-slate-400 leading-relaxed">{f.desc}</p>
                    </div>
                  </motion.div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Laptop mockup + text ---- */}
        <section id="desktop" className="px-6 py-20 lg:py-28 scroll-mt-24">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <ScrollReveal direction="right">
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-[0.3em]">Your command center</span>
              <h2 className="font-display text-5xl md:text-6xl font-semibold text-slate-900 dark:text-slate-50 tracking-tight leading-[0.95] mt-5 mb-8">
                A workstation that <span className="text-blue-600 dark:text-blue-400">keeps up.</span>
              </h2>
              <div className="space-y-7">
                {laptopPoints.map((p) => (
                  <div key={p.t} className="flex gap-4">
                    <span className="mt-1 w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-[0_8px_20px_-6px_rgba(37,99,235,0.7)]">
                      <Check size={16} strokeWidth={3} />
                    </span>
                    <div>
                      <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-50 mb-1">{p.t}</h3>
                      <p className="text-slate-500 dark:text-slate-400 leading-relaxed">{p.d}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link
                href="/register"
                className="group inline-flex items-center gap-3 mt-10 bg-slate-900 text-white pl-8 pr-5 py-4 rounded-2xl font-semibold hover:bg-slate-800 transition-colors"
              >
                Create your account
                <span className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center group-hover:rotate-45 transition-transform">
                  <ArrowUpRight size={16} />
                </span>
              </Link>
            </ScrollReveal>

            <ScrollReveal direction="left" className="relative">
              <div className="absolute -inset-6 bg-blue-300/30 rounded-[3rem] -z-10" style={{ borderRadius: blobRadii[2] }} />
              <MacbookMockup />
            </ScrollReveal>
          </div>
        </section>

        {/* ---- Local-first / privacy ---- */}
        <section id="privacy" className="px-6 py-20 lg:py-28 scroll-mt-24">
          <ScrollReveal className="max-w-7xl mx-auto">
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 to-[#0a1020] text-white px-8 py-16 md:p-16 lg:p-20 border border-white/10">
              <div className="absolute -top-28 right-10 w-[440px] h-[440px] bg-blue-600/25 blur-[130px] rounded-full pointer-events-none" />
              <div className="absolute -bottom-32 -left-20 w-[440px] h-[440px] bg-indigo-500/15 blur-[130px] rounded-full pointer-events-none" />
              <div className="absolute inset-0 opacity-[0.05] pointer-events-none [background-image:radial-gradient(rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:22px_22px]" />

              <div className="relative z-10 grid lg:grid-cols-2 gap-14 lg:gap-16 items-center">
                <div>
                  <span className="inline-flex items-center gap-2 text-blue-300 text-[11px] font-bold uppercase tracking-[0.3em]">
                    <Shield size={14} /> Private by design
                  </span>
                  <h2 className="font-display text-4xl md:text-6xl font-semibold tracking-tight leading-[0.98] mt-5">
                    Your study data <br /> stays yours.
                  </h2>
                  <p className="text-lg text-slate-300 leading-relaxed mt-6 max-w-lg">
                    No noise, no selling your attention. Study Flow keeps your notes, grades and schedule in one
                    secure place built around a single goal — helping you pass.
                  </p>
                  <div className="flex flex-wrap gap-3 mt-8">
                    {[
                      { icon: <WifiOff size={15} />, label: 'Distraction-free' },
                      { icon: <Database size={15} />, label: 'SQLite + Prisma' },
                      { icon: <Lock size={15} />, label: 'Yours alone' },
                    ].map((b) => (
                      <span key={b.label} className="inline-flex items-center gap-2 bg-white/[0.07] border border-white/10 px-4 py-2 rounded-full text-sm font-semibold text-slate-200">
                        <span className="text-blue-300">{b.icon}</span>
                        {b.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="relative w-full max-w-sm mx-auto lg:ml-auto">
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
                    className="absolute -top-5 -right-2 z-20 inline-flex items-center gap-2 bg-white/10 border border-white/15 backdrop-blur-md px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-100 shadow-xl"
                  >
                    <CloudOff size={15} className="text-rose-300" /> No noise
                  </motion.div>

                  <div className="rounded-[1.9rem] border border-white/15 bg-white/[0.05] backdrop-blur-xl p-7 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.7)]">
                    <div className="flex gap-1.5 mb-7">
                      <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                      <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                      <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                    </div>

                    <div className="flex flex-col items-center text-center">
                      <div className="w-20 h-20 rounded-[1.6rem] bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-[0_18px_44px_-10px_rgba(37,99,235,0.8)]">
                        <Lock size={34} className="text-white" />
                      </div>
                      <p className="mt-5 font-display text-lg font-semibold">Your study vault</p>
                      <p className="text-sm text-slate-400">Everything in one focused place</p>
                    </div>

                    <div className="mt-6 space-y-2.5">
                      <div className="flex items-center justify-between bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3">
                        <span className="flex items-center gap-2.5 text-sm font-medium text-slate-200">
                          <Database size={16} className="text-blue-300" /> study.db
                        </span>
                        <span className="text-[11px] text-emerald-300 font-semibold flex items-center gap-1">
                          <Lock size={11} /> secured
                        </span>
                      </div>
                      <div className="flex items-center justify-between bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3">
                        <span className="flex items-center gap-2.5 text-sm font-medium text-slate-200">
                          <HardDrive size={16} className="text-blue-300" /> Your account
                        </span>
                        <span className="text-[11px] text-slate-400 font-semibold">just you</span>
                      </div>
                    </div>
                  </div>

                  <motion.div
                    animate={{ y: [0, 10, 0] }}
                    transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut', delay: 0.6 }}
                    className="absolute -left-3 -bottom-4 z-20 inline-flex items-center gap-2 bg-white/10 border border-white/15 backdrop-blur-md px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-100 shadow-xl"
                  >
                    <Target size={15} className="text-blue-300" /> Built to focus
                  </motion.div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* ---- Closing CTA ---- */}
        <section className="px-6 pb-32 pt-10 text-center">
          <ScrollReveal className="max-w-3xl mx-auto">
            <h2 className="font-display text-5xl md:text-7xl font-semibold text-slate-900 dark:text-slate-50 tracking-tight leading-[0.95]">
              Ready for a <span className="text-blue-600 dark:text-blue-400">calmer</span> semester?
            </h2>
            <p className="text-xl text-slate-500 dark:text-slate-400 leading-relaxed mt-6 max-w-xl mx-auto">
              Turn your timetable into a daily rhythm. Create your account and let Study Flow run your week.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
              <Link
                href="/register"
                className="group relative inline-flex items-center gap-3 overflow-hidden rounded-2xl bg-slate-900 px-12 py-5 text-lg font-semibold text-white shadow-[0_24px_50px_-16px_rgba(0,0,0,0.6)] transition-transform hover:scale-[1.02] active:scale-95"
              >
                <span className="relative z-10">Get started</span>
                <span className="absolute right-0 bottom-0 w-0 h-0 border-l-[34px] border-l-transparent border-b-[34px] border-b-blue-600" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 px-10 py-5 rounded-2xl text-lg font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <BookOpen size={20} />
                I already have an account
              </Link>
            </div>
          </ScrollReveal>
        </section>

        {/* ---- Footer ---- */}
        <footer className="relative bg-[#ececec] dark:bg-[#0a0e17] text-slate-600 dark:text-slate-300 overflow-hidden border-t border-black/10 dark:border-white/10">
          <div className="relative max-w-7xl mx-auto px-6 pt-28">
            <div className="grid md:grid-cols-12 gap-12 pb-24 border-b border-black/10 dark:border-white/10">
              <div className="md:col-span-5 space-y-8">
                <Link href="/" className="inline-flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="Study Flow logo" width={40} height={40} className="rounded-full" />
                  <span className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Study Flow</span>
                </Link>
                <p className="text-lg leading-relaxed max-w-sm text-slate-500 dark:text-slate-400">
                  A private study workstation. Turn your timetable into a daily rhythm — focused, organised, and built to help you pass.
                </p>
                <Link
                  href="/register"
                  className="group inline-flex items-center gap-3 bg-slate-900 text-white pl-7 pr-5 py-4 rounded-2xl font-semibold hover:bg-slate-800 transition-colors shadow-[0_18px_40px_-14px_rgba(15,23,42,0.6)]"
                >
                  Get started
                  <span className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center group-hover:rotate-45 transition-transform">
                    <ArrowUpRight size={16} />
                  </span>
                </Link>
                <div className="flex gap-5 pt-2">
                  <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="w-11 h-11 rounded-full border border-black/10 dark:border-white/10 flex items-center justify-center hover:border-blue-500 hover:text-blue-600 transition-colors">
                    <Code2 size={18} />
                  </a>
                  <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" aria-label="Discord" className="w-11 h-11 rounded-full border border-black/10 dark:border-white/10 flex items-center justify-center hover:border-blue-500 hover:text-blue-600 transition-colors">
                    <MessageSquare size={18} />
                  </a>
                  <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="w-11 h-11 rounded-full border border-black/10 dark:border-white/10 flex items-center justify-center hover:border-red-500 hover:text-red-500 transition-colors">
                    <MonitorPlay size={18} />
                  </a>
                  <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-11 h-11 rounded-full border border-black/10 dark:border-white/10 flex items-center justify-center hover:border-pink-500 hover:text-pink-500 transition-colors">
                    <Camera size={18} />
                  </a>
                </div>
              </div>

              <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-10">
                <div>
                  <h3 className="text-blue-600 dark:text-blue-400 font-semibold mb-6 text-xs uppercase tracking-[0.25em]">Product</h3>
                  <ul className="space-y-4 text-[15px]">
                    <li><a href="#features" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">Features</a></li>
                    <li><a href="#desktop" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">The app</a></li>
                    <li><a href="#privacy" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">Privacy</a></li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-blue-600 dark:text-blue-400 font-semibold mb-6 text-xs uppercase tracking-[0.25em]">Account</h3>
                  <ul className="space-y-4 text-[15px]">
                    <li><Link href="/register" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">Create account</Link></li>
                    <li><Link href="/login" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">Log in</Link></li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-blue-600 dark:text-blue-400 font-semibold mb-6 text-xs uppercase tracking-[0.25em]">Community</h3>
                  <ul className="space-y-4 text-[15px]">
                    <li><a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors inline-flex items-center gap-1.5 group">Discord <ArrowUpRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" /></a></li>
                    <li><a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors inline-flex items-center gap-1.5 group">GitHub <ArrowUpRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" /></a></li>
                    <li><a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors inline-flex items-center gap-1.5 group">YouTube <ArrowUpRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" /></a></li>
                    <li><a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors inline-flex items-center gap-1.5 group">Instagram <ArrowUpRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" /></a></li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="py-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
              <p>© 2026 Study Flow — built by scholars, for scholars.</p>
              <div className="flex gap-8"><span>English (US)</span></div>
            </div>
          </div>

          {/* Giant interactive wordmark */}
          <div className="relative w-full select-none">
            <div className="h-[34vw] min-h-[260px] max-h-[520px] w-full">
              <SandText lines={['STUDY', 'FLOW']} colors={INK_GRAINS} darkColors={LIGHT_GRAINS} className="w-full h-full cursor-none touch-none" />
            </div>
            <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[11px] uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 pointer-events-none">
              Drag your cursor through the grains
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
