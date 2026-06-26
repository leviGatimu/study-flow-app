"use client";

import { motion } from "framer-motion";
import { BookOpen, Fingerprint, Lock, MousePointer2, Zap } from "lucide-react";
import Link from "next/link";
import { useRef, type ReactNode, type RefObject } from "react";

/* ------------------------------------------------------------------ */
/*  Floaty: idle bob + drag-to-throw                                  */
/* ------------------------------------------------------------------ */

function Floaty({
  className,
  rotate = 0,
  float = 12,
  duration = 7,
  delay = 0,
  z = 20,
  constraints,
  children,
}: {
  className?: string;
  rotate?: number;
  float?: number;
  duration?: number;
  delay?: number;
  z?: number;
  constraints?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  return (
    <motion.div
      drag
      dragConstraints={constraints as RefObject<Element>}
      dragElastic={0.15}
      dragMomentum
      dragTransition={{ bounceStiffness: 300, bounceDamping: 22 }}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.97 }}
      whileDrag={{ scale: 1.12, zIndex: 60 }}
      style={{ zIndex: z }}
      className={`absolute cursor-grow touch-none pointer-events-auto ${className ?? ""}`}
    >
      <motion.div
        style={{ rotate }}
        animate={{ y: [0, -float, 0] }}
        transition={{ repeat: Infinity, duration, ease: "easeInOut", delay }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Big subject cards                                                 */
/* ------------------------------------------------------------------ */

const cardVariants: Record<string, string> = {
  amber: "bg-gradient-to-br from-amber-300 to-amber-400 text-amber-950",
  light: "bg-white text-slate-900",
  dark: "bg-slate-900 text-white",
  green: "bg-gradient-to-br from-emerald-400 to-green-500 text-white",
  blue: "bg-gradient-to-br from-blue-500 to-blue-600 text-white",
  violet: "bg-gradient-to-br from-violet-500 to-purple-600 text-white",
};

function SubjectCard({ title, tag, variant }: { title: string; tag: string; variant: keyof typeof cardVariants }) {
  return (
    <div
      className={`w-[252px] h-[150px] rounded-[1.6rem] p-6 shadow-[0_30px_60px_-22px_rgba(0,0,0,0.45)] border border-white/40 flex flex-col justify-between pointer-events-none ${cardVariants[variant]}`}
    >
      <div className="flex justify-between items-start">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">Subject</span>
        <span className="w-7 h-7 rounded-lg bg-white/25 flex items-center justify-center">
          <BookOpen size={16} />
        </span>
      </div>
      <div>
        <p className="text-[28px] font-display font-semibold leading-none">{title}</p>
        <p className="text-[11px] mt-2 opacity-70 font-medium">{tag}</p>
      </div>
    </div>
  );
}

const FAN = [
  { title: "Maths", tag: "Thu · 19:00", variant: "amber", pos: "left-[-2%] top-[13%]", rotate: -16, float: 9, dur: 7.5 },
  { title: "Chemistry", tag: "Tue · 22:00", variant: "light", pos: "left-[4%] top-[22%]", rotate: -9, float: 8, dur: 8 },
  { title: "Business", tag: "Mon · 20:00", variant: "dark", pos: "left-[10%] top-[31%]", rotate: -3, float: 11, dur: 6.5 },
  { title: "Biology", tag: "Wed · 21:30", variant: "green", pos: "left-[14%] top-[38%]", rotate: 5, float: 9, dur: 7 },
  { title: "Physics", tag: "Mon · 20:30", variant: "blue", pos: "left-[19%] top-[46%]", rotate: 12, float: 12, dur: 8.5 },
] as const;

/* ------------------------------------------------------------------ */

export default function Hero() {
  const stageRef = useRef<HTMLDivElement>(null);

  return (
    <section className="relative">
      <div className="relative overflow-hidden bg-[#ececec] dark:bg-[#0a0e17] min-h-screen flex flex-col">
        {/* Stage */}
        <div
          ref={stageRef}
          className="relative flex-1 flex flex-col items-center justify-center text-center px-6 pb-24 pt-24"
        >
          {/* ---- headline (sits under the draggable elements) ---- */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.21, 0.5, 0.3, 1] }}
            className="relative z-10 font-display font-bold text-slate-900 dark:text-slate-50 leading-[0.9] tracking-[-0.03em] text-6xl sm:text-7xl lg:text-[8.5rem] xl:text-[10rem]"
          >
            <span className="block">Studying</span>
            <span className="block">that feels</span>
            <span className="block text-blue-600 dark:text-blue-400">effortless</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="relative z-10 mt-10 max-w-md text-slate-600 dark:text-slate-300 text-lg leading-relaxed"
          >
            Designed for focused students — your weekly timetable becomes a daily rhythm, from the first task of the morning to the final exam.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative z-10 mt-11"
          >
            <Link
              href="/register"
              className="group relative inline-flex items-center gap-3 overflow-hidden rounded-2xl bg-slate-900 px-14 py-5 text-lg font-semibold text-white shadow-[0_24px_50px_-16px_rgba(0,0,0,0.6)] transition-transform hover:scale-[1.02] active:scale-95"
            >
              <span className="relative z-10">Get started</span>
              <span className="absolute right-0 bottom-0 w-0 h-0 border-l-[34px] border-l-transparent border-b-[34px] border-b-blue-600 transition-all duration-300 group-hover:border-b-blue-500" />
            </Link>
          </motion.div>

          {/* ---- draggable floating elements (over the text, lg and up) ---- */}
          <div className="hidden lg:block absolute inset-0 z-20 pointer-events-none">
            <div className="absolute left-[3%] top-[28%] font-display font-bold text-[10rem] leading-none text-black/[0.04] dark:text-white/[0.04] select-none pointer-events-none -rotate-12">
              Mon
            </div>

            {FAN.map((c, i) => (
              <Floaty key={c.title} constraints={stageRef} rotate={c.rotate} className={c.pos} z={20 + i} float={c.float} duration={c.dur} delay={i * 0.2}>
                <SubjectCard title={c.title} tag={c.tag} variant={c.variant} />
              </Floaty>
            ))}

            {/* cursor */}
            <Floaty constraints={stageRef} rotate={-10} className="left-[17%] top-[56%]" z={26} float={7} duration={6}>
              <MousePointer2 size={54} className="text-white fill-white drop-shadow-[0_8px_14px_rgba(0,0,0,0.35)] pointer-events-none" />
            </Floaty>

            {/* green focus toggle */}
            <Floaty constraints={stageRef} rotate={-4} className="right-[16%] top-[13%]" z={30} float={16} duration={7.5}>
              <div className="w-[116px] h-[64px] rounded-full bg-green-500 border-4 border-white shadow-[0_24px_44px_-14px_rgba(0,0,0,0.4)] flex items-center px-2 justify-end pointer-events-none">
                <div className="w-[46px] h-[46px] rounded-full bg-white shadow-md" />
              </div>
            </Floaty>

            {/* lightning */}
            <Floaty constraints={stageRef} rotate={-8} className="right-[14%] top-[54%]" z={32} float={14} duration={6.8} delay={0.4}>
              <div className="w-[98px] h-[98px] rounded-[1.8rem] bg-slate-900 border-4 border-white shadow-[0_28px_50px_-16px_rgba(0,0,0,0.5)] flex items-center justify-center pointer-events-none">
                <Zap size={46} className="text-amber-400 fill-amber-400" />
              </div>
            </Floaty>

            {/* fingerprint */}
            <Floaty constraints={stageRef} rotate={7} className="right-[26%] top-[64%]" z={31} float={12} duration={7.2} delay={0.6}>
              <div className="w-[88px] h-[88px] rounded-[1.8rem] bg-white/70 backdrop-blur-md border-4 border-white shadow-[0_28px_50px_-16px_rgba(0,0,0,0.4)] flex items-center justify-center pointer-events-none">
                <Fingerprint size={44} className="text-blue-500" />
              </div>
            </Floaty>

            {/* padlock */}
            <Floaty constraints={stageRef} rotate={11} className="right-[7%] top-[65%]" z={34} float={15} duration={7} delay={0.2}>
              <div className="w-[100px] h-[100px] rounded-[2rem] bg-gradient-to-br from-blue-500 to-blue-600 border-4 border-white shadow-[0_30px_56px_-16px_rgba(37,99,235,0.6)] flex items-center justify-center pointer-events-none">
                <Lock size={42} className="text-white" />
              </div>
            </Floaty>
          </div>
        </div>
      </div>
    </section>
  );
}
