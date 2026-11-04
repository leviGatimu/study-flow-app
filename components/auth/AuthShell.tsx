import type { ReactNode } from 'react';
import { Brand } from '@/components/Brand';
import { AuthShowcase } from './AuthShowcase';
import styles from './AuthShell.module.css';

/** Shared frame for /login and /register: the form, then an animated tour of the app. */
export function AuthShell({ children, variant = 'login' }: { children: ReactNode; variant?: 'login' | 'register' }) {
  return <main className={styles.shell} data-variant={variant}>
    <section className={styles.formSide}>
      <div className={styles.brand}><Brand /></div>
      <div className={styles.formBody}>{children}</div>
    </section>
    <aside className={styles.story}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.dots} aria-hidden="true" />
      <AuthShowcase />
    </aside>
  </main>;
}
