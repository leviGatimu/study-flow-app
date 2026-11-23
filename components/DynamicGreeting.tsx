'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_TIMEZONE } from '@/lib/utils';
import { useBirthdayToday } from '@/components/birthday/BirthdayMode';

export function DynamicGreeting({ name = 'Student', timezone = DEFAULT_TIMEZONE, birthday }: { name?: string; timezone?: string; birthday?: string | null }) {
  const { isToday: isBirthday } = useBirthdayToday(birthday, timezone);
  const [greeting, setGreeting] = useState('Good morning');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setMounted(m => m === false ? true : m);
      const updateGreeting = () => {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
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
  }, [timezone]);

  if (!mounted) {
    return (
      <h1 className="text-4xl font-heading font-black tracking-tight text-foreground opacity-0">
        Good morning, {name}.
      </h1>
    );
  }

  return (
    <h1 className="text-4xl font-heading font-black tracking-tight text-foreground">
      {isBirthday ? (
        <span className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 bg-clip-text text-transparent">Happy birthday, {name}.</span>
      ) : (
        <>{greeting}, {name}.</>
      )}
    </h1>
  );
}
