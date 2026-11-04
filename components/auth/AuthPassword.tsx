'use client';
import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import styles from './AuthShell.module.css';

interface AuthPasswordProps {
  id: string;
  name: string;
  autoComplete: string;
  minLength?: number;
  placeholder?: string;
  describedBy?: string;
  onValueChange?: (value: string) => void;
}

export function AuthPassword({ id, name, autoComplete, minLength, placeholder, describedBy, onValueChange }: AuthPasswordProps) {
  const [visible,setVisible]=useState(false);
  const [capsLock,setCapsLock]=useState(false);
  const hintId=`${id}-caps`;
  const described=[describedBy,capsLock?hintId:undefined].filter(Boolean).join(' ')||undefined;
  return <div>
    <div className={`${styles.password} ${styles.withIcon}`}>
      <Lock className={styles.icon} aria-hidden="true" />
      <input id={id} name={name} type={visible?'text':'password'} autoComplete={autoComplete} minLength={minLength} maxLength={72} required
        placeholder={placeholder} aria-describedby={described}
        onChange={(event)=>onValueChange?.(event.target.value)}
        onKeyUp={(event)=>setCapsLock(event.getModifierState('CapsLock'))}
        onBlur={()=>setCapsLock(false)} />
      <button type="button" aria-label={`${visible?'Hide':'Show'} ${name==='confirmPassword'?'password confirmation':'password'}`} aria-pressed={visible} onClick={()=>setVisible(value=>!value)}>{visible?<EyeOff className="size-4" />:<Eye className="size-4" />}</button>
    </div>
    {capsLock&&<p id={hintId} className={styles.capsLock}>Caps Lock is on.</p>}
  </div>;
}
