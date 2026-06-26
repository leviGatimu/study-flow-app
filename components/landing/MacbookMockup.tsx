"use client";

import { motion } from "framer-motion";
import { Search, Flame, Trophy, Target, CheckCircle2 } from "lucide-react";

export default function MacbookMockup() {
  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      className="relative w-full max-w-[900px] mx-auto"
    >
      {/* Macbook Body */}
      <div className="relative bg-slate-800 rounded-t-2xl p-2 pb-0 border-[4px] border-slate-700 shadow-2xl">
        {/* Screen */}
        <div className="bg-slate-900 rounded-t-lg overflow-hidden border border-slate-800 aspect-[16/10] flex flex-col">
          {/* Dashboard UI Placeholder */}
          <div className="flex-1 bg-slate-50 dark:bg-white/[0.06] text-slate-900 dark:text-slate-50 flex flex-col overflow-hidden">
            {/* Nav Bar */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 px-6 py-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-6">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">S</div>
                <div className="flex gap-4">
                  <div className="w-16 h-2 bg-slate-100 rounded-full" />
                  <div className="w-16 h-2 bg-slate-100 rounded-full" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-32 h-8 bg-slate-50 dark:bg-white/[0.06] border border-slate-200 rounded-full flex items-center px-3 gap-2">
                  <Search size={12} className="text-slate-400 dark:text-slate-500" />
                  <div className="w-20 h-1.5 bg-slate-200 rounded-full" />
                </div>
                <div className="w-8 h-8 bg-slate-200 rounded-full" />
              </div>
            </div>

            {/* Main Dashboard Area */}
            <div className="flex-1 overflow-auto p-8 landing-scroll">
              <div className="max-w-4xl mx-auto space-y-10">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <h2 className="text-3xl font-black text-slate-900 dark:text-slate-50">Good Morning, Scholar</h2>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      <Target size={12} />
                      Monday, June 6th, 2026
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="bg-orange-50 border border-orange-100 px-4 py-2 rounded-2xl flex items-center gap-3">
                      <Flame className="text-orange-500 fill-orange-500" size={20} />
                      <div>
                        <p className="text-xl font-black text-orange-600 leading-none">12</p>
                        <p className="text-[8px] font-bold text-orange-600/60 uppercase">Streak</p>
                      </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 px-4 py-2 rounded-2xl flex items-center gap-3">
                      <Trophy className="text-blue-600 dark:text-blue-400 fill-blue-600/20" size={20} />
                      <div>
                        <p className="text-xl font-black text-blue-700 dark:text-blue-400 leading-none">45</p>
                        <p className="text-[8px] font-bold text-blue-600 dark:text-blue-400/60 uppercase">XP Level</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Focus Card */}
                <div className="bg-slate-900 rounded-[2rem] p-8 text-white flex items-center justify-between relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 blur-[80px] rounded-full -mr-32 -mt-32" />
                  <div className="space-y-4 relative z-10">
                    <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-[0.2em]">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                      Currently Studying
                    </div>
                    <h3 className="text-3xl font-black tracking-tight">Advanced Networking</h3>
                    <p className="text-slate-400 dark:text-slate-500 max-w-sm">Focusing on TCP/IP Protocol Layers. 45 minutes remaining in this block.</p>
                  </div>
                  <div className="relative z-10 hidden md:block">
                    <div className="w-24 h-24 rounded-full border-4 border-white/10 flex items-center justify-center relative">
                      <svg className="w-24 h-24 absolute -rotate-90">
                        <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/10" />
                        <motion.circle
                          initial={{ strokeDasharray: "276 276", strokeDashoffset: 276 }}
                          animate={{ strokeDashoffset: 70 }}
                          transition={{ duration: 2, delay: 1 }}
                          cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-blue-500"
                        />
                      </svg>
                      <span className="text-xl font-black italic">75%</span>
                    </div>
                  </div>
                </div>

                {/* Grid Content */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h4 className="text-xl font-bold flex justify-between">Today&apos;s Focus <span className="text-slate-400 dark:text-slate-500 text-sm font-medium">3/5 Tasks</span></h4>
                    <div className="space-y-3">
                      {[
                        { t: "Networking HW", d: "Due tomorrow", done: true },
                        { t: "C Programming", d: "Chapter 4 Rev", done: true },
                        { t: "Physics Lab", d: "Drafting Report", done: false },
                      ].map((task, i) => (
                        <div key={i} className={`p-5 rounded-2xl border transition-all flex items-center gap-4 ${task.done ? "bg-slate-50 dark:bg-white/[0.06] border-slate-100 opacity-60" : "bg-white dark:bg-slate-900 border-slate-200 shadow-sm"}`}>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${task.done ? "bg-blue-600 border-blue-600 text-white" : "border-slate-200"}`}>
                            {task.done && <CheckCircle2 size={12} />}
                          </div>
                          <div>
                            <p className="font-bold">{task.t}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase">{task.d}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-6">
                    <h4 className="text-xl font-bold">Exam Timeline</h4>
                    <div className="bg-orange-50/50 border border-orange-100 p-8 rounded-[2rem] space-y-4">
                      <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Next Exam: DBMS</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-black text-slate-900 dark:text-slate-50">04</span>
                        <span className="text-xl font-bold text-slate-400 dark:text-slate-500">days left</span>
                      </div>
                      <div className="w-full h-1 bg-orange-200 rounded-full overflow-hidden">
                        <div className="w-2/3 h-full bg-orange-500" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Macbook Bottom */}
      <div className="bg-slate-700 h-4 rounded-b-2xl shadow-xl border-t border-slate-600" />
      <div className="w-32 h-1 bg-slate-600 mx-auto rounded-b-full shadow-sm" />
    </motion.div>
  );
}
