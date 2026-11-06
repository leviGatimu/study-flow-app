'use client';

import { useEffect } from 'react';

import { recordPresence } from '@/lib/presence-actions';

const EVERY_MS = 4 * 60_000;

/** Headless. While the app is open and on screen, notes that this person is here. */
export function PresencePing() {
  useEffect(() => {
    // Never worth bothering anyone over: the worst case is an older "last seen".
    const ping = () => {
      if (document.visibilityState === 'visible') void recordPresence().catch(() => undefined);
    };
    ping();
    const timer = setInterval(ping, EVERY_MS);
    document.addEventListener('visibilitychange', ping);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', ping);
    };
  }, []);
  return null;
}
