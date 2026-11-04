'use client';
import { passwordStrength } from '@/lib/password-strength';
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, ArrowLeft, ArrowRight, AtSign, Check, Clock, Globe, Loader2, School, User, X } from 'lucide-react';
import { registerUser } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthPassword } from '@/components/auth/AuthPassword';
import styles from '@/components/auth/AuthShell.module.css';

const subscribe=()=>()=>{};
const browserZone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Kigali';
// A clock that ticks every 30 seconds; null while server rendering.
const subscribeClock=(onTick:()=>void)=>{const t=setInterval(onTick,30_000);return ()=>clearInterval(t);};
const clockSnapshot=()=>Math.floor(Date.now()/30_000);
const USERNAME=/^[a-zA-Z0-9_.-]{3,32}$/;
const BIO_MAX=400;

function localTime(zone:string){
  try{return new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',weekday:'short'}).format(new Date());}
  catch{return null;}
}

const initials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(part=>part[0]?.toUpperCase()).join('')||'?';

export function RegisterClient({ zones }: {zones:string[]}) {
  const reduced=useReducedMotion();
  const headingRef=useRef<HTMLHeadingElement>(null);
  const [step,setStep]=useState<'profile'|'account'>('profile');
  const [profile,setProfile]=useState({name:'',school:'',bio:'',timezone:''});
  const detected=useSyncExternalStore(subscribe,browserZone,()=> 'Africa/Kigali');
  const tick=useSyncExternalStore(subscribeClock,clockSnapshot,()=>null);
  const [zone,setZone]=useState('');
  const [bioLength,setBioLength]=useState(0);
  const [username,setUsername]=useState('');
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [error,setError]=useState<string|null>(null);
  const [pending,startTransition]=useTransition();
  const router=useRouter();
  const shown=useRef({step,error});
  useEffect(()=>{
    // Move focus only when the step or error changes, not on page load.
    if(shown.current.step===step&&shown.current.error===error)return;
    shown.current={step,error};
    headingRef.current?.closest('main')?.scrollTo({top:0});
    headingRef.current?.focus({preventScroll:true});
  },[step,error]);

  const selectedZone=zone||profile.timezone||detected;
  const zoneTime=tick===null?null:localTime(selectedZone);
  const meter=passwordStrength(password);
  const usernameValid=USERNAME.test(username.trim());
  const matches=confirm.length>0&&confirm===password;

  const next=(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();const form=new FormData(event.currentTarget);
    setProfile({name:String(form.get('name')??'').trim(),school:String(form.get('school')??'').trim(),bio:String(form.get('bio')??'').trim(),timezone:String(form.get('timezone')??detected)});
    setError(null);setStep('account');
  };
  const back=()=>{setError(null);setPassword('');setConfirm('');setUsername('');setBioLength(profile.bio.length);setStep('profile');};
  const submit=(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setError(null);
    if(confirm!==password){setError('Your passwords do not match.');return;}
    const form=new FormData(event.currentTarget);
    for(const [key,value] of Object.entries(profile))form.set(key,value);
    startTransition(async()=>{
      try{const result=await registerUser(form);if(result?.error)setError(result.error==='Username already taken'?'That username is taken. Try another one.':result.error);else{router.replace('/setup');router.refresh();}}
      catch{setError('Your account could not be created. Check your connection and try again.');}
    });
  };

  const onAccount=step==='account';
  const slide=reduced?{}:{initial:{opacity:0,x:onAccount?24:-24},animate:{opacity:1,x:0},exit:{opacity:0,x:onAccount?-24:24},transition:{duration:0.3,ease:[0.22,1,0.36,1] as const}};

  return <AuthShell variant="register">
    <nav aria-label="Registration progress" className={styles.stepper}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">Step {onAccount?2:1} of 2</span>
        <span className="text-muted-foreground">{onAccount?'Your account':'Your details'}</span>
      </div>
      <ol className="mt-2 grid grid-cols-2 gap-1.5">
        <li aria-current={!onAccount?'step':undefined}>
          {onAccount
            ? <button type="button" onClick={back} className={styles.stepDone} aria-label="Step 1, your details, done. Go back to edit"><span className={styles.stepFill} /></button>
            : <span className={styles.stepTrack}><span className={styles.stepFill} /></span>}
        </li>
        <li aria-current={onAccount?'step':undefined}>
          <span className={styles.stepTrack}><motion.span className={styles.stepFill} initial={false} animate={{scaleX:onAccount?1:0}} transition={{duration:0.5,ease:[0.22,1,0.36,1]}} /></span>
        </li>
      </ol>
    </nav>

    <h1 ref={headingRef} tabIndex={-1}>{onAccount?'Create your account':'Tell us about you'}</h1>
    <p className={styles.subtitle}>{onAccount?'Choose the username and password you’ll sign in with.':'Your name and timezone. You’ll add your subjects and timetable after this.'}</p>
    {error&&<p role="alert" className={`${styles.error} mt-5`}><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</p>}

    <AnimatePresence mode="wait" initial={false}>
      {!onAccount?<motion.form key="profile" {...slide} method="post" onSubmit={next} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="register-name">Your name</label>
          <div className={styles.withIcon}><User className={styles.icon} aria-hidden="true" /><input id="register-name" name="name" autoComplete="name" maxLength={60} defaultValue={profile.name} placeholder="e.g. Amani Uwase" required /></div>
        </div>
        <div className={styles.field}>
          <label htmlFor="register-school">School or college <span className="font-normal text-muted-foreground">(optional)</span></label>
          <div className={styles.withIcon}><School className={styles.icon} aria-hidden="true" /><input id="register-school" name="school" autoComplete="organization" maxLength={120} defaultValue={profile.school} placeholder="e.g. City High School" /></div>
        </div>
        <div className={styles.field}>
          <label htmlFor="register-timezone">Your timezone</label>
          <div className={styles.withIcon}><Globe className={styles.icon} aria-hidden="true" />
            <select id="register-timezone" name="timezone" value={selectedZone} onChange={(e)=>setZone(e.target.value)} aria-describedby="register-timezone-hint">
              {[...new Set([...zones,detected])].sort().map(z=><option key={z} value={z}>{z.replaceAll('_',' ')}</option>)}
            </select>
          </div>
          <small id="register-timezone-hint" className="flex items-center gap-1.5">
            <Clock className="size-3.5" aria-hidden="true" />
            {zoneTime?<>It’s <span className="font-medium text-foreground">{zoneTime}</span> there now. Your schedule follows this timezone.</>:'Your schedule follows this timezone.'}
          </small>
        </div>
        <div className={styles.field}>
          <div className="flex items-baseline justify-between">
            <label htmlFor="register-bio">A little about you <span className="font-normal text-muted-foreground">(optional)</span></label>
            <span className={`text-xs tabular-nums ${bioLength>BIO_MAX-40?'text-orange-500':'text-muted-foreground'}`} aria-live="polite">{bioLength}/{BIO_MAX}</span>
          </div>
          <textarea id="register-bio" name="bio" rows={3} maxLength={BIO_MAX} defaultValue={profile.bio} onChange={(e)=>setBioLength(e.target.value.length)} placeholder="e.g. Year 2 software development, preparing for my exams in June" />
        </div>
        <Button type="submit" className={styles.submit}>Continue<ArrowRight className="size-4" /></Button>
      </motion.form>
      :<motion.form key="account" {...slide} method="post" onSubmit={submit} className={styles.form}>
        <div className={styles.summary}>
          <span className={styles.avatar} aria-hidden="true">{initials(profile.name)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{profile.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{[profile.school,profile.timezone.replaceAll('_',' ')].filter(Boolean).join(' · ')}</span>
          </span>
          <button type="button" onClick={back} className={styles.edit}>Edit</button>
        </div>
        <fieldset disabled={pending} className="contents">
          <div className={styles.field}>
            <label htmlFor="register-username">Username</label>
            <div className={styles.withIcon}><AtSign className={styles.icon} aria-hidden="true" />
              <input id="register-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} minLength={3} maxLength={32} pattern="[a-zA-Z0-9_.\-]+" required
                placeholder="e.g. amani_u" aria-describedby="register-username-hint" onChange={(e)=>setUsername(e.target.value)} />
              {usernameValid&&<Check className={`${styles.trailing} text-emerald-500`} aria-hidden="true" />}
            </div>
            <small id="register-username-hint" className={username&&!usernameValid?'!text-orange-500':undefined}>3–32 letters, numbers, dots, dashes or underscores.</small>
          </div>
          <div className={styles.field}>
            <label htmlFor="register-password">Password</label>
            <AuthPassword id="register-password" name="password" autoComplete="new-password" minLength={8} placeholder="At least 8 characters" describedBy="register-password-meter" onValueChange={setPassword} />
            <div id="register-password-meter" aria-live="polite" className="flex items-center gap-3">
              <span className="grid flex-1 grid-cols-4 gap-1" aria-hidden="true">
                {[1,2,3,4].map(i=><span key={i} className="h-1 overflow-hidden rounded-full bg-muted"><span className={`block h-full rounded-full transition-all duration-300 ${meter&&i<=meter.score?meter.tone:''}`} style={{width:meter&&i<=meter.score?'100%':'0%'}} /></span>)}
              </span>
              <span className="w-16 text-right text-xs text-muted-foreground">{meter?meter.label:''}</span>
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="register-confirm">Confirm password</label>
            <AuthPassword id="register-confirm" name="confirmPassword" autoComplete="new-password" minLength={8} placeholder="Type it again" describedBy="register-confirm-hint" onValueChange={setConfirm} />
            <small id="register-confirm-hint" aria-live="polite" className="flex min-h-4 items-center gap-1.5">
              {confirm&&(matches
                ?<><Check className="size-3.5 text-emerald-500" aria-hidden="true" /><span className="text-emerald-600 dark:text-emerald-400">Passwords match</span></>
                :<><X className="size-3.5 text-orange-500" aria-hidden="true" /><span>Doesn’t match yet</span></>)}
            </small>
          </div>
          <div className="mt-1 grid grid-cols-[auto_1fr] gap-2">
            <Button type="button" variant="outline" className={`${styles.submit} px-4`} onClick={back} aria-label="Back to your details"><ArrowLeft className="size-4" />Back</Button>
            <Button type="submit" disabled={pending} className={`${styles.submit} !mt-0`}>{pending?<><Loader2 className="size-4 animate-spin" />Creating account…</>:<>Create account<ArrowRight className="size-4" /></>}</Button>
          </div>
        </fieldset>
      </motion.form>}
    </AnimatePresence>
    <p className={styles.footer}>Already have an account?<Link href="/login">Sign in</Link></p>
  </AuthShell>;
}
