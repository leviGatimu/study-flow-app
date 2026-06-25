'use client';

import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';

export function RwandaClock() {
  const [time, setTime] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setMounted(m => m === false ? true : m);
      const updateTime = () => {
        const rwandaTime = new Date().toLocaleTimeString('en-US', {
          timeZone: 'Africa/Kigali',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
        setTime(rwandaTime);
      };
      
      updateTime(); // Initial call
      const interval = setInterval(updateTime, 1000);
      return () => clearInterval(interval);
    }, 0);
  }, []);

  if (!mounted) {
    return (
      <div className="flex flex-col items-end">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 mb-1.5"><Globe className="w-3 h-3" /> Kigali, Rwanda</span>
        <div className="h-9 w-36 animate-pulse bg-muted rounded-md"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end animate-in fade-in duration-500">
      <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
        <Globe className="w-3 h-3 text-primary" /> Kigali, Rwanda
      </span>
      <span className="text-2xl sm:text-3xl font-heading font-black text-primary tracking-tight">
        {time}
      </span>
    </div>
  );
}
