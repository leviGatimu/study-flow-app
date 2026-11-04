'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Loader2, User } from 'lucide-react';
import { loginUser } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthPassword } from '@/components/auth/AuthPassword';
import styles from '@/components/auth/AuthShell.module.css';

export function LoginClient() {
  const [pending,startTransition]=useTransition();
  const [error,setError]=useState<string|null>(null);
  const router=useRouter();
  const submit=(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setError(null);
    const data=new FormData(event.currentTarget);
    startTransition(async()=>{
      try{const result=await loginUser(data);if(result?.error)setError(result.error==='Invalid credentials'?'That username and password don’t match. Check them and try again.':result.error);else{router.replace('/');router.refresh();}}
      catch{setError('Sign-in could not be completed. Check your connection and try again.');}
    });
  };
  return <AuthShell>
    <h1>Welcome back</h1>
    <p className={styles.subtitle}>Sign in with your username and password.</p>
    <form method="post" onSubmit={submit} className={styles.form}>
      {error&&<p role="alert" className={styles.error}><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</p>}
      <fieldset disabled={pending} className="contents">
        <div className={styles.field}><label htmlFor="login-username">Username</label><div className={styles.withIcon}><User className={styles.icon} aria-hidden="true" /><input id="login-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Your username" required /></div></div>
        <div className={styles.field}><label htmlFor="login-password">Password</label><AuthPassword id="login-password" name="password" autoComplete="current-password" placeholder="Your password" /></div>
        <Button type="submit" disabled={pending} className={styles.submit}>{pending?<><Loader2 className="size-4 animate-spin" />Signing in…</>:<>Sign in<ArrowRight className="size-4" /></>}</Button>
      </fieldset>
    </form>
    <p className={styles.footer}>Don’t have an account?<Link href="/register">Create one</Link></p>
  </AuthShell>;
}