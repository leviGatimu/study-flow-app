'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether the app should track your school lessons, remembered per browser.
 *
 * Three components read this flag - the portal, the dashboard status card and
 * the lesson notifier - and each had its own copy of the same effect plus
 * `storage` listener. Read through useSyncExternalStore instead: the server has
 * no localStorage, so it renders "on" and React reconciles on hydration without
 * a setState-in-effect cascade. Same reasoning as the sidebar's pin state.
 *
 * Defaults to ON when nothing is stored - a user who has never touched the
 * toggle has lessons tracked, which is what the toggle being on means.
 */
const KEY = 'isTimetableSynced';

const subscribe = (onChange: () => void) => {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
};

const read = () => localStorage.getItem(KEY) !== 'false';
const onServer = () => true;

export function useTimetableSync(): [boolean, (next: boolean) => void] {
  const enabled = useSyncExternalStore(subscribe, read, onServer);

  const setEnabled = (next: boolean) => {
    localStorage.setItem(KEY, String(next));
    // `storage` does not fire in the tab that wrote it, so the other readers on
    // this page - and this hook itself - are told by hand.
    window.dispatchEvent(new Event('storage'));
  };

  return [enabled, setEnabled];
}
