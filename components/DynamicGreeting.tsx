'use client';

import { useEffect, useState } from 'react';

export function DynamicGreeting({ name = 'Student' }: { name?: string }) {
  const [greeting, setGreeting] = useState('Good morning');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setMounted(m => m === false ? true : m);
      const updateGreeting = () => {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Africa/Kigali',
          hour: 'numeric',
          hourCycle: 'h24',
        });
        const hourStr = formatter.format(new Date());
        const hour = parseInt(hourStr, 10);

        if (hour >= 5 && hour < 12) {
          setGreeting('Good morning');
        } else if (hour >= 12 && hour < 18) {
          setGreeting('Good afternoon');
        } else {
          setGreeting('Good evening');
        }
      };

      updateGreeting();
      const interval = setInterval(updateGreeting, 60000);
      return () => clearInterval(interval);
    }, 0);
  }, []);

  if (!mounted) {
    return (
      <h1 className="text-5xl font-heading font-black tracking-tight text-foreground opacity-0">
        Good morning, {name}.
      </h1>
    );
  }

  return (
    <h1 className="text-5xl font-heading font-black tracking-tight text-foreground animate-in fade-in duration-500">
      {greeting}, {name}.
    </h1>
  );
}
