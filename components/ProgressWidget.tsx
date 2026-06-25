'use client';

import Link from 'next/link';

export function ProgressWidget({ percentage, completed, total }: { percentage: number, completed: number, total: number }) {
  const isComplete = percentage === 100 && total > 0;
  
  return (
    <Link href="/history" className={`block bg-card border shadow-sm rounded-3xl p-6 flex flex-col items-center justify-center min-h-[220px] hover:shadow-md hover:-translate-y-1 hover:border-primary/30 transition-all duration-500 group cursor-pointer ${isComplete ? 'border-success ring-1 ring-success/20' : ''}`}>
      <div className="flex items-center justify-between w-full mb-6">
        <h3 className="font-heading font-bold text-lg">Daily Progress</h3>
        <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold uppercase tracking-widest flex items-center gap-1">View <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></span>
      </div>
      
      {/* Circular Progress Ring */}
      <div className="relative w-32 h-32 flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            className="text-muted stroke-current"
            strokeWidth="8"
            cx="50"
            cy="50"
            r="40"
            fill="transparent"
          ></circle>
          <circle
            className={`${isComplete ? 'text-success' : 'text-primary'} stroke-current transition-all duration-1000 ease-out`}
            strokeWidth="8"
            strokeLinecap="round"
            cx="50"
            cy="50"
            r="40"
            fill="transparent"
            strokeDasharray={`${2 * Math.PI * 40}`}
            strokeDashoffset={2 * Math.PI * 40 * (1 - percentage / 100)}
          ></circle>
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className={`text-3xl font-heading font-bold animate-in zoom-in duration-500 ${isComplete ? 'text-success' : 'text-foreground'}`}>
            {percentage}%
          </span>
        </div>
      </div>
      
      <p className="mt-6 text-sm font-medium text-muted-foreground bg-muted px-4 py-2 rounded-full group-hover:bg-primary/10 group-hover:text-primary transition-colors">
        {completed} of {total} tasks completed
      </p>
    </Link>
  );
}
