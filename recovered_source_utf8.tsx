'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Volume2, VolumeX, Maximize2, Minimize2,
  Play, Pause, Flame, Zap, CheckCircle2,
  ArrowLeft, ListTodo, Trophy, BookOpen, FileText, Plus,
  Clock, Save, ChevronRight, Paperclip, Send, X,
  Music, SkipForward, SkipBack, Eye, EyeOff, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { cn, getRwandaTime } from '@/lib/utils';
import { logFocusSession, toggleTaskDone, updateTaskProof } from '@/lib/actions';
import Link from 'next/link';
import { TaskWithTemplate, Resource } from '@/lib/types';
import { useFocus } from '@/lib/FocusContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTheme } from '@/components/ThemeProvider';

interface FocusSessionProps {
  task: TaskWithTemplate;
  resources: Resource[];
}

const AMBIENT_CHANNELS = [
  {
    id: 'lofi-focus',
    title: 'Lofi Focus Radio',
    artist: 'Laut.fm',
    coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80',
    audioUrl: 'https://stream.laut.fm/lofi'
  },
  {
    id: 'chill-hop',
    title: '0R Chill Hop',
    artist: '0R Radio',
    coverUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80',
    audioUrl: 'https://0nlineradio.radioho.st/0r-lo-fi?ref=radio-browser26'
  },
  {
    id: 'lofi-lounge',
    title: '0nline Lofi Lounge',
    artist: '0nline Radio',
    coverUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80',
    audioUrl: 'https://stream.0nlineradio.com/lo-fi?ref=radiobrowser'
  },
  {
    id: 'bgm-vibes',
    title: 'BGM Vibes Study',
    artist: 'BGMVibes',
    coverUrl: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=600&auto=format&fit=crop&q=80',
    audioUrl: 'https://radio.sutekihost.com/listen/bgmvibes/radio.mp3'
  },
  {
    id: 'workday-lounge',
    title: 'Workday Lounge',
    artist: 'Epic Lounge',
    coverUrl: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&auto=format&fit=crop&q=80',
    audioUrl: 'https://stream.epic-lounge.com/workday-lounge?ref=radiobrowser'
  },
  {
    id: 'b3cks-beats',
    title: 'b3cks Radio Beats',
    artist: 'b3cks',
    coverUrl: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=600&auto=format&fit=crop&q=80',
    audioUrl: 'https://radio.b3ck.com/listen/b3cks-radio/radio.mp3'
  },
  {
    id: 'hotmix-lofi',
    title: 'Hotmix Lofi',
    artist: 'Hotmix Radio',
    coverUrl: 'https://images.unsplash.com/photo-1528164344705-47542687000d?w=600&auto=format&fit=crop&q=80',
    audioUrl: 'https://streaming.hotmixradio.com/hotmix-lofi-en-mp3'
  },
  {
    id: 'zeno-hiphop',
    title: 'Zeno Lofi Hip Hop',
    artist: 'Zeno.fm',
    coverUrl: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=600&auto=format&fit=crop&q=80',
    audioUrl: 'https://stream.zeno.fm/0r0xa792kwzuv'
  }
];

function FocusParticles({ intensity }: { intensity: 'CHILL' | 'INTENSE' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Array<{
      x: number;
      y: number;
      radius: number;
      vx: number;
      vy: number;
      alpha: number;
      decay: number;
    }> = [];

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const particleCount = intensity === 'INTENSE' ? 60 : 40;
    const baseSpeed = intensity === 'INTENSE' ? 0.4 : 0.15;
    
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 2 + (intensity === 'INTENSE' ? 1.5 : 1),
        vx: (Math.random() - 0.5) * baseSpeed * 2,
        vy: (Math.random() - 0.5) * baseSpeed * 2,
        alpha: Math.random() * 0.4 + 0.1,
        decay: Math.random() * 0.001 + 0.0005
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        
        if (intensity === 'INTENSE') {
          // Orange sparks
          ctx.fillStyle = `rgba(249, 115, 22, ${p.alpha})`;
          ctx.shadowColor = 'rgba(249, 115, 22, 0.4)';
        } else {
          // Blue cold stars
          ctx.fillStyle = `rgba(59, 130, 246, ${p.alpha})`;
          ctx.shadowColor = 'rgba(59, 130, 246, 0.3)';
        }
        
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [intensity]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />;
}

export function FocusSessionUI({ task, resources }: FocusSessionProps) {
  const focusContext = useFocus();
  
  const { 
    activeTask, timeLeft, isActive, isPaused, step, sessionXP, intensity,
    secondsFocused = 0, initialDurationMinutes = 25,
    startFocus, pauseFocus, resumeFocus, completeFocus, resetFocus,
    setIntensity
  } = focusContext;

  const [goals, setGoals] = useState<string[]>(['']);
  const [completedGoals, setCompletedGoals] = useState<boolean[]>([]);
  const [newGoalInput, setNewGoalInput] = useState('');
  const [customDuration, setCustomDuration] = useState(60);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [isMusicOpen, setIsMusicOpen] = useState(false);
  const [isSyncedWithTimetable, setIsSyncedWithTimetable] = useState(task.id !== 'free');
  const [presets, setPresets] = useState<number[]>([25, 50, 90]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedPresets = localStorage.getItem('study-flow-focus-presets');
      if (storedPresets) {
        try {
          const parsed = JSON.parse(storedPresets);
          if (Array.isArray(parsed) && parsed.length === 3) {
            setPresets(parsed);
          }
        } catch (e) {
          console.error("Failed to parse focus presets", e);
        }
      }
    }
  }, []);
  
  // Simulated Spotify Player state
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [volume, setVolume] = useState(0.4);

  // Proof state
  const [showProofForm, setShowProofForm] = useState(false);
  const [proofDescription, setProofDescription] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const prevUrlRef = useRef(AMBIENT_CHANNELS[0].audioUrl);

  const currentTrack = AMBIENT_CHANNELS[currentTrackIndex];

  // Set initial customDuration
  useEffect(() => {
    if (activeTask?.id === task.id) {
       // active context
    } else if (!activeTask) {
       if (task.id !== 'free') {
          const [startH, startM] = task.startTime.split(':').map(Number);
          const [endH, endM] = task.endTime.split(':').map(Number);
          let diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
          if (diffMinutes <= 0) diffMinutes += 1440;
          setCustomDuration(diffMinutes);
       }
    }
  }, [task, activeTask]);

  // Adjust volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Manage audio play, pause, source changes and loading state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const syncAudio = async () => {
      try {
        if (isActive && !isPaused) {
          // If source changed, force pause and reload the new stream
          if (prevUrlRef.current !== currentTrack.audioUrl) {
            audio.pause();
            audio.load();
            prevUrlRef.current = currentTrack.audioUrl;
          }
          if (audio.paused) {
            await audio.play();
          }
        } else {
          audio.pause();
        }
      } catch (err) {
        console.log("Audio play failed or was interrupted:", err);
      }
    };

    syncAudio();
  }, [isActive, isPaused, currentTrack.audioUrl]);

  const handleSessionComplete = useCallback(async () => {
    const actualDurationMinutes = Math.ceil(secondsFocused / 60);
    const xpToGrant = sessionXP;

    if (activeTask?.id !== 'free') {
      if (activeTask?.id) {
        await toggleTaskDone(activeTask.id, true);
      }
    }

    await logFocusSession(actualDurationMinutes > 0 ? actualDurationMinutes : 1, xpToGrant);
    completeFocus();
  }, [activeTask, secondsFocused, sessionXP, completeFocus]);

  const handleFinishWithProof = async () => {
    setIsFinishing(true);
    try {
      if (task.id !== 'free') {
        const formData = new FormData();
        formData.append('taskId', task.id);
        formData.append('description', proofDescription);
        if (proofFile) formData.append('file', proofFile);
        
        await updateTaskProof(formData);
      }
      await handleSessionComplete();
    } catch (error) {
      console.error("Failed to finish session", error);
    } finally {
      setIsFinishing(false);
    }
  };

  const handleStartFocus = () => {
    let duration = customDuration;
    if (isSyncedWithTimetable && task.id !== 'free' && task.endTime) {
       const [endH, endM] = task.endTime.split(':').map(Number);
       const now = getRwandaTime();
       
       const target = new Date(now);
       target.setHours(endH, endM, 0, 0);
       
       const [startH, startM] = task.startTime.split(':').map(Number);
       if (endH * 60 + endM < startH * 60 + startM) {
          target.setDate(target.getDate() + 1);
       }
       
       const diffMs = target.getTime() - now.getTime();
       if (diffMs > 0) {
         duration = Math.ceil(diffMs / (1000 * 60));
       } else {
         duration = 1;
       }
    }
    startFocus(task, duration);
  };

  useEffect(() => {
    if (step === 'FOCUS' && timeLeft.h === 0 && timeLeft.m === 0 && timeLeft.s === 0 && isActive) {
       handleSessionComplete();
    }
  }, [step, timeLeft, isActive, handleSessionComplete]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const addGoal = () => setGoals([...goals, '']);
  const updateGoal = (idx: number, val: string) => {
    const newGoals = [...goals];
    newGoals[idx] = val;
    setGoals(newGoals);
  };
  const toggleGoal = (idx: number) => {
    const newCompleted = [...completedGoals];
    newCompleted[idx] = !newCompleted[idx];
    setCompletedGoals(newCompleted);
  };

  const playNextTrack = useCallback(() => {
    setCurrentTrackIndex(prev => (prev + 1) % AMBIENT_CHANNELS.length);
  }, []);

  const playPrevTrack = useCallback(() => {
    setCurrentTrackIndex(prev => (prev - 1 + AMBIENT_CHANNELS.length) % AMBIENT_CHANNELS.length);
  }, []);

  const isThisTaskActive = activeTask?.id === task.id;
  const currentStep = isThisTaskActive ? step : 'PREP';

  // Keyboard Shortcuts for Premium UX
  useEffect(() => {
    if (currentStep !== 'FOCUS') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts if the user is typing in inputs or textareas
      if (
        document.activeElement instanceof HTMLInputElement || 
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (isPaused) {
            resumeFocus();
          } else {
            pauseFocus();
          }
          break;
        case 'KeyZ':
          e.preventDefault();
          setIsZenMode(prev => !prev);
          break;
        case 'KeyM':
          e.preventDefault();
          setIsMuted(prev => !prev);
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'ArrowRight':
          e.preventDefault();
          playNextTrack();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          playPrevTrack();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, isPaused, resumeFocus, pauseFocus, toggleFullscreen, playNextTrack, playPrevTrack]);

  // Compute remaining timer circle dash offset
  const RADIUS = 220;
  const totalDurationSeconds = initialDurationMinutes * 60;
  const remainingSeconds = timeLeft.h * 3600 + timeLeft.m * 60 + timeLeft.s;
  const timerCircleProgress = totalDurationSeconds > 0 
    ? (remainingSeconds / totalDurationSeconds) * 2 * Math.PI * RADIUS 
    : 0;



  if (currentStep === 'PREP') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-background overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full space-y-12"
        >
          <div className="text-center space-y-4">
            <Link href="/" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors mb-4">
              <ArrowLeft className="w-3 h-3" /> Back to Dashboard
            </Link>
            <h1 className="text-6xl font-heading font-black tracking-tighter text-foreground">Ready to focus?</h1>
            <p className="text-xl text-muted-foreground font-semibold uppercase tracking-widest">{task.subject}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {task.id === 'free' ? (
              <div className="space-y-6">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" /> Session Duration
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  {presets.map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setCustomDuration(mins)}
                      className={cn(
                        "p-4 rounded-2xl border-2 transition-all font-bold text-sm",
                        customDuration === mins ? "bg-primary/5 border-primary text-primary shadow-md" : "bg-card border-border/40 text-muted-foreground hover:border-primary/20"
                      )}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
                <div className="space-y-4 pt-2">
                   <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                     <span>Custom Minutes</span>
                     <span>{customDuration} min</span>
                   </div>
                   <Slider 
                     value={[customDuration]} 
                     onValueChange={(v) => setCustomDuration(v[0])} 
                     max={180} 
                     min={5} 
                     step={5} 
                     className="py-2"
                   />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Timetable Sync Control */}
                <div className="p-6 bg-card border border-border/40 rounded-3xl space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-black text-foreground flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" /> Timetable Sync
                      </Label>
                      <p className="text-[11px] text-muted-foreground font-semibold">
                        {isSyncedWithTimetable 
                          ? "Duration bound to scheduled timetable" 
                          : "Manual duration override active"}
                      </p>
                    </div>
                    <Switch
                      checked={isSyncedWithTimetable}
                      onCheckedChange={(checked) => {
                        setIsSyncedWithTimetable(checked);
                        if (checked) {
                          // Recalculate remaining time for schedule
                          const [startH, startM] = task.startTime.split(':').map(Number);
                          const [endH, endM] = task.endTime.split(':').map(Number);
                          let diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
                          if (diffMinutes <= 0) diffMinutes += 1440;
                          setCustomDuration(diffMinutes);
                        }
                      }}
                    />
                  </div>

                  {isSyncedWithTimetable && task.endTime && (
                    <div className="p-3 bg-muted/40 rounded-2xl border border-border/30 text-xs font-semibold text-muted-foreground flex justify-between items-center">
                      <span>Schedule Window:</span>
                      <span className="text-foreground">{task.startTime} - {task.endTime}</span>
                    </div>
                  )}
                </div>

                {/* Conditional Duration Overrides */}
                {!isSyncedWithTimetable && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6 p-6 bg-card border border-border/40 rounded-3xl"
                  >
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 animate-pulse" /> Override Duration
                    </Label>
                    <div className="grid grid-cols-3 gap-3">
                      {presets.map((mins) => (
                        <button
                          key={mins}
                          onClick={() => setCustomDuration(mins)}
                          className={cn(
                            "p-3 rounded-2xl border-2 transition-all font-bold text-xs",
                            customDuration === mins ? "bg-primary/5 border-primary text-primary shadow-md" : "bg-muted/30 border-border/40 text-muted-foreground hover:border-primary/20"
                          )}
                        >
                          {mins}m
                        </button>
                      ))}
                    </div>
                    <div className="space-y-4 pt-2">
                       <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                         <span>Custom Minutes</span>
                         <span>{customDuration} min</span>
                       </div>
                       <Slider 
                         value={[customDuration]} 
                         onValueChange={(v) => setCustomDuration(v[0])} 
                         max={180} 
                         min={5} 
                         step={5} 
                         className="py-2"
                       />
                    </div>
                  </motion.div>
                )}

                {/* Session Intensity */}
                <div className="space-y-4">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5" /> Session Intensity
                  </Label>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setIntensity('CHILL')}
                      className={cn(
                        "flex-1 p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3",
                        intensity === 'CHILL' ? "bg-primary/5 border-primary text-primary shadow-lg shadow-primary/10" : "bg-card border-border/40 text-muted-foreground grayscale opacity-50"
                      )}
                    >
                      <Volume2 className="w-8 h-8" />
                      <span className="font-bold">Chill Mode</span>
                    </button>
                    <button
                      onClick={() => setIntensity('INTENSE')}
                      className={cn(
                        "flex-1 p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3",
                        intensity === 'INTENSE' ? "bg-orange-500/5 border-orange-500 text-orange-600 shadow-lg shadow-orange-500/10" : "bg-card border-border/40 text-muted-foreground grayscale opacity-50"
                      )}
                    >
                      <Zap className="w-8 h-8" />
                      <span className="font-bold">Deep Focus</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-6">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <ListTodo className="w-3.5 h-3.5" /> Session Goals
              </Label>
              <div className="space-y-3">
                {goals.map((goal, idx) => (
                  <Input
                    key={idx}
                    value={goal}
                    onChange={(e) => updateGoal(idx, e.target.value)}
                    placeholder={`Goal #${idx + 1}...`}
                    className="h-12 rounded-xl bg-muted/30 border-border/40 font-bold px-4"
                  />
                ))}
                <Button variant="ghost" size="sm" onClick={addGoal} className="text-xs font-bold text-primary gap-1">
                   <Plus className="w-3 h-3" /> Add another goal
                </Button>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleStartFocus}
            className="w-full h-20 rounded-[32px] text-2xl font-heading font-black shadow-2xl shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-95"
          >
            ENTER FOCUS MODE
          </Button>
        </motion.div>
      </div>
    );
  }

  if (currentStep === 'FOCUS') {
    return (
      <div 
        ref={containerRef}
        className={cn(
          "h-full flex flex-col transition-all duration-1000 overflow-hidden relative select-none",
          intensity === 'INTENSE' ? "bg-[#0b0602]" : "bg-[#020617]",
          "text-white"
        )}
      >
        {/* Dynamic Blurred Cover Backdrop */}
        <div 
          className="absolute inset-0 bg-cover bg-center transition-all duration-1000 transform scale-110 opacity-20 filter blur-[80px]"
          style={{ backgroundImage: `url(${currentTrack.coverUrl})` }}
        />

        {/* Drifting Zen Particles */}
        <FocusParticles intensity={intensity} />

        {/* Top Ribbon Controls */}
        <div className="py-4 px-8 flex items-center justify-between relative z-10 shrink-0">
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-3 px-5 py-2 bg-white/5 border border-white/10 rounded-full backdrop-blur-xl shadow-inner">
               <Flame className="w-5 h-5 text-orange-500 fill-orange-500 animate-pulse" />
               <span className="font-black text-lg tabular-nums tracking-tight">{sessionXP} XP</span>
             </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Widget Mode Button (Electron only) */}
            {typeof window !== 'undefined' && 'electron' in window && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-12 h-12 rounded-2xl border bg-white/5 border-white/10 hover:bg-white/10 text-white transition-all duration-300"
                onClick={() => {
                  (window as any).electron.send('enter-widget', { taskId: task.id });
                }}
                title="Mini Widget Mode (Always on Top)"
              >
                <Minimize2 className="w-5 h-5 text-white/80" />
              </Button>
            )}

            <Button 
              variant="ghost" 
              size="icon" 
              className={cn(
                "w-12 h-12 rounded-2xl border transition-all duration-300", 
                isZenMode ? "bg-primary/20 border-primary/40 text-primary" : "bg-white/5 border-white/10 hover:bg-white/10 text-white"
              )}
              onClick={() => setIsZenMode(!isZenMode)}
              title={isZenMode ? "Show Dashboard Panels" : "Enter Distraction-Free Zen View"}
            >
              {isZenMode ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            </Button>

            {/* Ambient Music Floating Player */}
            <div className="relative">
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn(
                  "w-12 h-12 rounded-2xl border transition-all duration-300", 
                  isMusicOpen ? "bg-primary/20 border-primary/40 text-primary" : "bg-white/5 border-white/10 hover:bg-white/10 text-white"
                )}
                onClick={() => setIsMusicOpen(!isMusicOpen)}
                title="Ambient Soundtrack"
              >
                <Music className="w-5 h-5" />
              </Button>
              
              <AnimatePresence>
                {isMusicOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.95 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="absolute right-0 mt-3 w-80 bg-[#070b19]/95 border border-white/10 backdrop-blur-2xl p-4.5 rounded-[28px] shadow-2xl z-50 flex flex-col gap-4 text-white"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-lg">
                        <img src={currentTrack.coverUrl} alt="Cover" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                          <Music className="w-4 h-4 text-white/50" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <h4 className="text-xs font-black text-white leading-none truncate">{currentTrack.title}</h4>
                        <p className="text-[10px] text-white/40 font-bold leading-none mt-1 truncate">{currentTrack.artist}</p>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button variant="ghost" size="icon" onClick={playPrevTrack} className="w-8 h-8 rounded-lg hover:bg-white/5 text-white/80 hover:text-white">
                          <SkipBack className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setIsMuted(!isMuted)} 
                          className={cn("w-8 h-8 rounded-lg hover:bg-white/5 text-white/80 hover:text-white", isMuted && "text-red-500")}
                        >
                          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={playNextTrack} className="w-8 h-8 rounded-lg hover:bg-white/5 text-white/80 hover:text-white">
                          <SkipForward className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 px-1">
                      <Volume2 className="w-3.5 h-3.5 text-white/40" />
                      <Slider
                        value={[isMuted ? 0 : volume]}
                        max={1}
                        min={0}
                        step={0.01}
                        onValueChange={(val) => {
                          setVolume(val[0]);
                          if (isMuted && val[0] > 0) setIsMuted(false);
                        }}
                        className="w-full cursor-pointer py-1"
                      />
                      <span className="text-[9px] font-black text-white/40 min-w-[24px] text-right">
                        {Math.round((isMuted ? 0 : volume) * 100)}%
                      </span>
                    </div>

                    <div className="h-[1px] bg-white/5 my-0.5" />

                    <div className="space-y-1.5 text-left">
                       <p className="text-[8px] font-black uppercase tracking-wider text-white/35 px-1">Ambient Channels</p>
                       <div className="max-h-[140px] overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-1">
                          {AMBIENT_CHANNELS.map((channel, i) => (
                            <button
                              key={channel.id}
                              onClick={() => {
                                setCurrentTrackIndex(i);
                              }}
                              className={cn(
                                "w-full p-2 text-left rounded-xl text-[10px] font-bold transition-colors flex items-center justify-between",
                                currentTrackIndex === i 
                                  ? "bg-primary/20 text-primary border border-primary/25" 
                                  : "text-white/60 hover:bg-white/5 hover:text-white"
                              )}
                            >
                              <span className="truncate max-w-[190px]">{channel.title}</span>
                              {currentTrackIndex === i && <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                            </button>
                          ))}
                       </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="h-6 w-px bg-white/10 mx-1" />

            <Link href="/">
              <Button variant="ghost" size="icon" className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white" title="Back to Dashboard">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>

            <Button 
              variant="ghost" 
              size="icon" 
              className={cn("w-12 h-12 rounded-2xl border transition-all duration-500", intensity === 'INTENSE' ? "bg-orange-500/20 border-orange-500/40 text-orange-500" : "bg-white/5 border-white/10 hover:bg-white/10 text-white")}
              onClick={() => setIntensity(intensity === 'INTENSE' ? 'CHILL' : 'INTENSE')}
              title={intensity === 'INTENSE' ? 'Switch to Chill mode' : 'Switch to Intense Focus'}
            >
              <Zap className="w-5 h-5" />
            </Button>

            <Button variant="ghost" size="icon" className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white" onClick={toggleFullscreen}>
              <Maximize2 className="w-5 h-5" />
            </Button>

            <Button 
              variant="ghost" 
              size="icon" 
              className={cn(
                "w-12 h-12 rounded-2xl border transition-all",
                isPaused ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/30" : "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20"
              )} 
              onClick={() => isPaused ? resumeFocus() : pauseFocus()}
            >
              {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Workspace Area */}
        <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-24 px-8 md:px-16 relative z-10 overflow-y-auto pb-16">
          
          <AnimatePresence>
            {!isZenMode && (
              <motion.div 
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ type: "spring", stiffness: 260, damping: 26 }}
                className="w-full lg:w-[320px] shrink-0 space-y-6 hidden lg:block"
              >
                <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[32px] p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/40 flex items-center gap-2">
                      <ListTodo className="w-4 h-4 text-primary" /> Objectives
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {/* New Goal Input for Focus Mode */}
                    <div className="flex items-center gap-2">
                      <Input
                        value={newGoalInput}
                        onChange={(e) => setNewGoalInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newGoalInput.trim()) {
                            setGoals([...goals, newGoalInput.trim()]);
                            setCompletedGoals([...completedGoals, false]);
                            setNewGoalInput('');
                          }
                        }}
                        placeholder="Add new objective..."
                        className="h-10 rounded-xl bg-white/5 border-white/10 font-bold px-4 text-xs placeholder:text-white/20"
                      />
                      <Button 
                        size="icon" 
                        onClick={() => {
                          if (newGoalInput.trim()) {
                            setGoals([...goals, newGoalInput.trim()]);
                            setCompletedGoals([...completedGoals, false]);
                            setNewGoalInput('');
                          }
                        }}
                        className="h-10 w-10 shrink-0 rounded-xl bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {goals.filter(g => g.trim()).length === 0 ? (
                        <p className="text-xs font-bold text-white/30 text-center py-4">No objectives listed.</p>
                      ) : (
                        goals.filter(g => g.trim()).map((goal, i) => (
                          <div
                            key={i}
                            onClick={() => toggleGoal(i)}
                            className={cn(
                              "flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer",
                              completedGoals[i] ? "bg-primary/10 border-primary/20 text-white/50" : "bg-white/5 border-white/5 hover:border-white/10"
                            )}
                          >
                            <div className={cn(
                              "w-5 h-5 rounded border transition-colors flex items-center justify-center shrink-0",
                              completedGoals[i] ? "bg-primary border-primary" : "border-white/20"
                            )}>
                              {completedGoals[i] && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                            </div>
                            <span className={cn("text-sm font-bold truncate", completedGoals[i] && "line-through")}>{goal}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Central Apple-inspired Timer Face */}
          <div className="flex-1 flex flex-col items-center justify-center py-4">
            <div className="relative w-72 h-72 sm:w-96 sm:h-96 md:w-[460px] md:h-[460px] lg:w-[540px] lg:h-[540px] flex items-center justify-center">
              {/* Pulsing glow under indicator */}
              <div className="absolute inset-8 bg-primary/10 rounded-full blur-3xl animate-pulse" />
              
              {/* Outer Circular Gauge Track */}
              <svg viewBox="0 0 500 500" className="w-full h-full transform -rotate-90 absolute">
                <circle 
                  cx="250" cy="250" r="220" 
                  stroke="currentColor" 
                  strokeWidth="8" 
                  fill="transparent" 
                  className="text-white/5"
                />
                <circle 
                  cx="250" cy="250" r="220" 
                  stroke={intensity === 'INTENSE' ? '#f97316' : '#3b82f6'} 
                  strokeWidth="12" 
                  fill="transparent" 
                  strokeDasharray={2 * Math.PI * 220}
                  strokeDashoffset={timerCircleProgress}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>

              {/* Main Digital Clock */}
              <div className="relative flex flex-col items-center justify-center text-center">
                <div 
                  className={cn(
                    "text-7xl sm:text-8xl md:text-[6.5rem] lg:text-[7.5rem] font-heading font-black tracking-tight leading-none tabular-nums flex items-baseline transition-opacity duration-1000",
                    isPaused && "opacity-40"
                  )}
                >
                  {timeLeft.h > 0 && <span>{timeLeft.h.toString().padStart(2, '0')}:</span>}
                  <span>{timeLeft.m.toString().padStart(2, '0')}</span>
                  <span className="opacity-25 select-none animate-pulse">:</span>
                  <span className="text-[0.7em] font-bold text-white/80">{timeLeft.s.toString().padStart(2, '0')}</span>
                </div>
                
                <div className="mt-6 flex items-center gap-2 bg-white/5 border border-white/10 px-5 py-2 rounded-full backdrop-blur-md">
                  <div className={cn("w-2 h-2 rounded-full", isPaused ? "bg-amber-500 animate-ping" : "bg-red-500")} />
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/85">
                    {task.subject} â€¢ {isPaused ? 'Paused' : 'Active'}
                  </span>
                </div>
              </div>
            </div>


            {/* Keyboard Shortcuts Quick Reference */}
            <div className="mt-4 text-[9px] font-black text-white/30 uppercase tracking-[0.2em] flex items-center justify-center gap-3">
              <span>[Space] Play/Pause</span>
              <span>â€¢</span>
              <span>[Z] Zen</span>
              <span>â€¢</span>
              <span>[M] Mute</span>
              <span>â€¢</span>
              <span>[F] Fullscreen</span>
              <span>â€¢</span>
              <span>[â†/â†’] Skip</span>
            </div>
          </div>

          <AnimatePresence>
            {!isZenMode && (
              <motion.div 
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ type: "spring", stiffness: 260, damping: 26 }}
                className="w-full lg:w-[320px] shrink-0 space-y-6 hidden lg:block"
              >
                <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[32px] p-6 space-y-6">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/40 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" /> Resources
                  </h3>
                  <div className="space-y-3">
                     {resources.length === 0 ? (
                       <p className="text-xs font-bold text-white/30 text-center py-4">No assets attached.</p>
                     ) : (
                       resources.map((res) => (
                         <a 
                           key={res.id}
                           href={res.url}
                           target="_blank"
                           rel="noreferrer"
                           className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors group"
                         >
                           <span className="text-sm font-bold truncate pr-4">{res.title}</span>
                           <ChevronRight className="w-4 h-4 text-white/30 group-hover:translate-x-0.5 transition-all" />
                         </a>
                       ))
                     )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Footer Actions */}
        <div className="p-8 flex justify-center relative z-10 bg-gradient-to-t from-black/80 to-transparent">
          {!showProofForm ? (
            <Button 
              onClick={() => setShowProofForm(true)}
              className="h-16 px-12 rounded-[24px] bg-primary text-white font-black text-lg gap-3 shadow-2xl shadow-primary/20 hover:scale-105 transition-all"
            >
              <CheckCircle2 className="w-6 h-6" />
              FINISH FOCUS SESSION
            </Button>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl w-full bg-zinc-900/90 backdrop-blur-3xl border border-white/10 p-8 rounded-[32px] space-y-6 shadow-2xl text-left"
            >
              <div className="flex justify-between items-center">
                 <h3 className="text-xl font-black">Proof of Work Calibration</h3>
                 <Button variant="ghost" size="icon" onClick={() => setShowProofForm(false)} className="hover:bg-white/5 text-white/80">
                   <X className="w-5 h-5" />
                 </Button>
              </div>
              
              <div className="space-y-4">
                 <Textarea 
                   placeholder="Describe what you accomplished during this session..."
                   value={proofDescription}
                   onChange={(e) => setProofDescription(e.target.value)}
                   className="bg-white/5 border-white/10 min-h-[100px] rounded-2xl font-bold placeholder:text-white/25 text-white"
                 />
                 
                 <div className="flex flex-col sm:flex-row gap-4">
                    <label className="flex-1 flex items-center justify-center gap-2 h-14 bg-white/5 border border-white/10 rounded-2xl cursor-pointer hover:bg-white/10 transition-colors px-4">
                       <Paperclip className="w-5 h-5 text-primary" />
                       <span className="font-bold text-sm truncate">
                         {proofFile ? proofFile.name : 'Attach PDF Proof'}
                       </span>
                       <input 
                         type="file" 
                         accept=".pdf" 
                         className="hidden" 
                         onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                       />
                    </label>
                    
                    <Button 
                      disabled={isFinishing || (task.id !== 'free' && !proofDescription.trim() && !proofFile)}
                      onClick={handleFinishWithProof}
                      className="h-14 px-8 rounded-2xl bg-primary font-black gap-2 shadow-lg"
                    >
                       {isFinishing ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <Send className="w-5 h-5" />}
                       COMPLETE SESSION
                    </Button>
                 </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Looping Soundtrack Audio Node */}
        <audio 
          ref={audioRef}
          src={currentTrack.audioUrl}
          loop
          muted={isMuted}
        />
      </div>
    );
  }

  if (currentStep === 'DONE') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-background relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-primary/5 blur-[120px] rounded-full animate-pulse" />

        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-xl w-full text-center space-y-12 relative z-10"
        >
          <div className="space-y-6">
            <div className="w-32 h-32 bg-primary/10 rounded-[40px] flex items-center justify-center mx-auto mb-8 border border-primary/20 shadow-2xl shadow-primary/20">
              <Trophy className="w-16 h-16 text-primary" />
            </div>
            <h1 className="text-7xl font-heading font-black tracking-tighter leading-none text-foreground">Victory!</h1>
            <p className="text-2xl text-muted-foreground font-semibold">You absolutely crushed that session.</p>
          </div>

          <div className="bg-card border border-border/60 p-8 rounded-[40px] shadow-xl text-foreground">
             <div className="flex justify-between items-center mb-8">
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">XP EARNED</p>
                  <p className="text-4xl font-heading font-black text-primary">+{sessionXP}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">STREAK</p>
                  <p className="text-4xl font-heading font-black text-orange-500 flex items-center gap-2">
                    <Flame className="w-8 h-8 fill-orange-500" /> +1
                  </p>
                </div>
             </div>
             
             <div className="space-y-4">
                <div className="flex justify-between text-xs font-black uppercase tracking-widest mb-1">
                  <span>Level Progress</span>
                  <span className="text-primary">XP BOOST ACTIVE</span>
                </div>
                <div className="h-4 bg-muted rounded-full overflow-hidden shadow-inner border border-border/40 text-foreground">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '85%' }}
                    className="h-full bg-primary"
                  />
                </div>
             </div>
          </div>

          <Link href="/" onClick={() => resetFocus()}>
            <Button className="w-full h-20 rounded-[32px] text-2xl font-heading font-black shadow-2xl shadow-primary/20 hover:scale-[1.02] transition-transform">
              RETURN TO DASHBOARD
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return null;
}

