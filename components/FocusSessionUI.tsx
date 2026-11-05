'use client';

import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Volume2, VolumeX, Maximize2, Minimize2,
  Play, Pause, Flame, Zap, CheckCircle2,
  ArrowLeft, ListTodo, BookOpen, Plus,
  Clock, ChevronRight, Paperclip, Send, X,
  Music, SkipForward, SkipBack, Eye, EyeOff, Info,
  Shuffle, Repeat, Repeat1, ListMusic, Disc3, Timer,
  Upload, Trash2, ImagePlus, Loader2,
  Droplets, PersonStanding, Coffee, CalendarClock, ScrollText, GraduationCap,
  ListPlus, Pencil, Check, FolderPlus, RotateCcw,
  Search, Globe, WifiOff, Settings, Palette, ImageIcon, Sparkles,
  Infinity as InfinityIcon, CalendarDays,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { cn, getRwandaTime } from '@/lib/utils';
import { updateTaskProof } from '@/lib/actions';
import Link from 'next/link';
import { TaskWithTemplate, Resource, Song, PlaylistInfo } from '@/lib/types';
import { useFocus } from '@/lib/FocusContext';
import { FluidGradient } from '@/components/focus/FluidGradient';
import { LyricsPanel } from '@/components/focus/LyricsPanel';
import { useMusicPlayer, DEFAULT_PALETTE } from '@/components/focus/useMusicPlayer';
import { FlowAIPanel } from '@/components/focus/FlowAIPanel';
import { searchOnlineSongs, getTrendingOnlineSongs, type OnlineTrack } from '@/lib/online-music';
import { fallbackPalette } from '@/lib/palette';

interface FocusSessionProps {
  task: TaskWithTemplate;
  resources: Resource[];
  songs: Song[];
  playlists: PlaylistInfo[];
  upcomingTasks: TaskWithTemplate[];
}

const INTENSE_PALETTE = ['#7c2d12', '#451a03', '#f97316', '#1c1917'];

// Custom-background defaults + quick-pick palettes for the settings panel.
const DEFAULT_CUSTOM_PALETTE = ['#1e1b4b', '#312e81', '#7c3aed', '#0b1020'];
const PRESET_BG_PALETTES: { name: string; colors: string[] }[] = [
  { name: 'Midnight', colors: ['#1e1b4b', '#312e81', '#7c3aed', '#0b1020'] },
  { name: 'Ember', colors: ['#7c2d12', '#9a3412', '#f97316', '#1c1917'] },
  { name: 'Ocean', colors: ['#0c4a6e', '#0e7490', '#22d3ee', '#082f49'] },
  { name: 'Forest', colors: ['#14532d', '#166534', '#84cc16', '#052e16'] },
  { name: 'Rose', colors: ['#831843', '#9d174d', '#fb7185', '#1a0a12'] },
  { name: 'Mono', colors: ['#27272a', '#3f3f46', '#a1a1aa', '#09090b'] },
];

type BgMode = 'AUTO' | 'PHOTO' | 'CUSTOM';

// Scene takeovers: each wellness moment re-lights the whole room in its own hue.
const BREAK_PALETTE = ['#0f766e', '#155e75', '#5eead4', '#042f2e'];   // calm teal
const WATER_PALETTE = ['#0369a1', '#0e7490', '#38bdf8', '#082f49'];   // deep aqua
const STRETCH_PALETTE = ['#4d7c0f', '#15803d', '#a3e635', '#052e16']; // fresh lime

const BREAK_PRESETS = [
  { label: 'Off', work: 0, rest: 0 },
  { label: '25 · 5', work: 25, rest: 5 },
  { label: '50 · 10', work: 50, rest: 10 },
];

const WATER_INTERVAL_MIN = 20;
const STRETCH_INTERVAL_MIN = 45;


type Reminder = 'WATER' | 'STRETCH';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** A row of mutually exclusive choices, used throughout the setup and settings. */
function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T | null;
  options: { value: T; label: React.ReactNode }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/50 p-1">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex min-w-16 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&_svg]:size-4',
              selected ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A labelled group inside the setup screen and the settings panel. */
function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Today's date and the time, for the top bar. Renders after mount so the
 * server and the browser never disagree about the minute. */
function NowClock({ className }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  if (!now) return null;
  return (
    <div className={className}>
      <CalendarDays className="w-4 h-4 text-white/50" />
      <span>{now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</span>
      <span className="text-white/30">·</span>
      <span>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
  );
}

function CoverArt({ song, palette, className, iconSize = 'w-10 h-10' }: {
  song: Song | null;
  palette: string[];
  className?: string;
  iconSize?: string;
}) {
  if (song?.coverUrl) {
    return <img src={song.coverUrl} alt={song.title} className={cn('object-cover', className)} draggable={false} />;
  }
  // Tracks without artwork get a stable gradient identity from their title.
  const colors = song ? fallbackPalette(`${song.title}-${song.artist ?? ''}`) : palette;
  return (
    <div
      className={cn('flex items-center justify-center', className)}
      style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1] || colors[0]})` }}
    >
      <Music className={cn('text-white/60', iconSize)} />
    </div>
  );
}

export function FocusSessionUI({ task, resources, songs: initialSongs, playlists: initialPlaylists, upcomingTasks }: FocusSessionProps) {
  const focusContext = useFocus();

  const {
    activeTask, timeLeft, isActive, isPaused, step, sessionXP, intensity,
    initialDurationMinutes = 25,
    openEnded,
    secondsFocused,
    startFocus, pauseFocus, resumeFocus, completeFocus, resetFocus,
    setIntensity
  } = focusContext;

  const [goals, setGoals] = useState<string[]>(['']);
  const [completedGoals, setCompletedGoals] = useState<boolean[]>([]);
  const [newGoalInput, setNewGoalInput] = useState('');
  const [customDuration, setCustomDuration] = useState(60);
  // "No limit": run until the student ends it rather than for a set length.
  const [noLimit, setNoLimit] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [showFlowAI, setShowFlowAI] = useState(false);
  // Playlist management (library slide-over)
  const [newPlaylistOpen, setNewPlaylistOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [renamingPlaylistId, setRenamingPlaylistId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [playlistMenuSongId, setPlaylistMenuSongId] = useState<string | null>(null);
  // Immersive album-cover layout (Song view)
  const [immersiveCover, setImmersiveCover] = useState(false);
  // Online music (library slide-over tabs)
  const [libraryTab, setLibraryTab] = useState<'LIBRARY' | 'ONLINE'>('LIBRARY');
  const [onlineQuery, setOnlineQuery] = useState('');
  const [onlineResults, setOnlineResults] = useState<OnlineTrack[]>([]);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineSearched, setOnlineSearched] = useState(false);
  const [addingOnlineId, setAddingOnlineId] = useState<string | null>(null);
  const [isOnlineNet, setIsOnlineNet] = useState(true);
  const trendingLoadedRef = useRef(false);
  const [showKeybindsInfo, setShowKeybindsInfo] = useState(false);
  // Focus settings panel + background controls
  const [showSettings, setShowSettings] = useState(false);
  const [bgMode, setBgMode] = useState<BgMode>('AUTO');
  const [customPalette, setCustomPalette] = useState<string[]>(DEFAULT_CUSTOM_PALETTE);
  const [bgPhoto, setBgPhoto] = useState<string | null>(null);
  const [remindersOn, setRemindersOn] = useState(true);
  const bgPhotoInputRef = useRef<HTMLInputElement>(null);
  const [isSyncedWithTimetable, setIsSyncedWithTimetable] = useState(task.id !== 'free');
  const [presets, setPresets] = useState<number[]>([25, 50, 90]);
  const [viewMode, setViewMode] = useState<'TIMER' | 'SONG'>('TIMER');
  const [volume, setVolume] = useState(0.4);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [breakCycle, setBreakCycle] = useState<{ work: number; rest: number } | null>(null);
  const [activeReminder, setActiveReminder] = useState<Reminder | null>(null);
  const [songPanelTab, setSongPanelTab] = useState<'LYRICS' | 'QUEUE'>('LYRICS');
  const lastWaterRef = useRef(0);
  const lastStretchRef = useRef(0);
  const reminderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Proof state
  const [showProofForm, setShowProofForm] = useState(false);
  const [proofDescription, setProofDescription] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const coverTargetRef = useRef<string | null>(null);

  const isThisTaskActive = activeTask?.id === task.id;
  const currentStep = isThisTaskActive ? step : 'PREP';

  // ----- Break cycles & wellness reminders -----
  // The phase is derived purely from elapsed time, so pausing, the widget
  // window and storage syncs all keep working without extra timer state.
  const totalDurationSeconds = initialDurationMinutes * 60;
  // In an open-ended session timeLeft counts UP, so it IS the elapsed time and
  // there is no end to be near.
  const shownSeconds = timeLeft.h * 3600 + timeLeft.m * 60 + timeLeft.s;
  const remainingSeconds = openEnded ? Number.POSITIVE_INFINITY : shownSeconds;
  const elapsedSeconds = openEnded ? shownSeconds : Math.max(0, totalDurationSeconds - remainingSeconds);

  let onBreak = false;
  let breakRemainingSeconds = 0;
  if (breakCycle && isActive && currentStep === 'FOCUS' && remainingSeconds > 60) {
    const cycleLen = (breakCycle.work + breakCycle.rest) * 60;
    const pos = cycleLen > 0 ? elapsedSeconds % cycleLen : 0;
    if (pos >= breakCycle.work * 60) {
      onBreak = true;
      breakRemainingSeconds = cycleLen - pos;
    }
  }

  const player = useMusicPlayer(initialSongs, {
    sessionRunning: currentStep === 'FOCUS' && isActive && !isPaused,
    muted: isMuted,
    // Music ducks to a murmur during breaks instead of stopping.
    volume: volume * (onBreak ? 0.25 : 1)
  }, initialPlaylists);

  const hasSongs = player.songs.length > 0;
  const isIntense = intensity === 'INTENSE';
  const palette = hasSongs ? player.palette : (isIntense ? INTENSE_PALETTE : DEFAULT_PALETTE);
  // Base palette respects the chosen background mode: custom colours win over
  // album art; auto follows the current track (or the default).
  const basePalette = bgMode === 'CUSTOM' && customPalette.length >= 2
    ? customPalette
    : palette;
  // Deep Focus sets the whole room on fire — ember palette overrides the base,
  // unless a break or wellness nudge is briefly taking the scene over.
  const scenePalette = onBreak
    ? BREAK_PALETTE
    : activeReminder === 'WATER'
    ? WATER_PALETTE
    : activeReminder === 'STRETCH'
    ? STRETCH_PALETTE
    : isIntense
    ? INTENSE_PALETTE
    : basePalette;

  // Restore the user's preferred break rhythm.
  useEffect(() => {
    try {
      const stored = localStorage.getItem('study-flow-break-cycle');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.work > 0) setBreakCycle(parsed);
      }
    } catch {
      // Corrupt preference — breaks just stay off.
    }
  }, []);

  const chooseBreakCycle = (preset: { work: number; rest: number }) => {
    const value = preset.work > 0 ? preset : null;
    setBreakCycle(value);
    if (value) localStorage.setItem('study-flow-break-cycle', JSON.stringify(value));
    else localStorage.removeItem('study-flow-break-cycle');
  };

  // Fire water/stretch nudges on their own clocks. Stretch wins ties; the
  // water one simply lands a second later once the card is free again.
  useEffect(() => {
    if (!remindersOn) return;
    if (currentStep !== 'FOCUS' || !isActive || isPaused || onBreak || activeReminder) return;
    if (elapsedSeconds < 60) return;

    const stretchDue = Math.floor(elapsedSeconds / (STRETCH_INTERVAL_MIN * 60));
    const waterDue = Math.floor(elapsedSeconds / (WATER_INTERVAL_MIN * 60));

    let toShow: Reminder | null = null;
    if (stretchDue > lastStretchRef.current) {
      lastStretchRef.current = stretchDue;
      toShow = 'STRETCH';
    } else if (waterDue > lastWaterRef.current) {
      lastWaterRef.current = waterDue;
      toShow = 'WATER';
    }
    if (!toShow) return;

    setActiveReminder(toShow);
    if (reminderTimeoutRef.current) clearTimeout(reminderTimeoutRef.current);
    reminderTimeoutRef.current = setTimeout(() => setActiveReminder(null), 18000);
  }, [elapsedSeconds, currentStep, isActive, isPaused, onBreak, activeReminder, remindersOn]);

  useEffect(() => {
    return () => { if (reminderTimeoutRef.current) clearTimeout(reminderTimeoutRef.current); };
  }, []);

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
          console.error('Failed to parse focus presets', e);
        }
      }
    }
  }, []);

  // Restore background + reminder preferences.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const mode = localStorage.getItem('study-flow-bg-mode');
      if (mode === 'AUTO' || mode === 'PHOTO' || mode === 'CUSTOM') setBgMode(mode);
      const custom = localStorage.getItem('study-flow-bg-custom');
      if (custom) {
        const parsed = JSON.parse(custom);
        if (Array.isArray(parsed) && parsed.length >= 2) setCustomPalette(parsed);
      }
      const photo = localStorage.getItem('study-flow-bg-photo');
      if (photo) setBgPhoto(photo);
      const reminders = localStorage.getItem('study-flow-reminders-on');
      if (reminders === 'false') setRemindersOn(false);
    } catch {
      // Ignore corrupt preferences.
    }
  }, []);

  const chooseBgMode = (mode: BgMode) => {
    setBgMode(mode);
    if (typeof window !== 'undefined') localStorage.setItem('study-flow-bg-mode', mode);
  };

  const updateCustomColor = (index: number, color: string) => {
    setCustomPalette((prev) => {
      const next = [...prev];
      next[index] = color;
      try { localStorage.setItem('study-flow-bg-custom', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const applyPresetPalette = (colors: string[]) => {
    setCustomPalette(colors);
    setBgMode('CUSTOM');
    try {
      localStorage.setItem('study-flow-bg-custom', JSON.stringify(colors));
      localStorage.setItem('study-flow-bg-mode', 'CUSTOM');
    } catch {}
  };

  const toggleReminders = () => {
    setRemindersOn((prev) => {
      const next = !prev;
      try { localStorage.setItem('study-flow-reminders-on', String(next)); } catch {}
      return next;
    });
  };

  // Downscale an uploaded photo to keep it inside the localStorage quota, then
  // store it as the focus background.
  const handleBgPhoto = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const maxW = 1280;
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setBgPhoto(dataUrl);
        setBgMode('PHOTO');
        try {
          localStorage.setItem('study-flow-bg-photo', dataUrl);
          localStorage.setItem('study-flow-bg-mode', 'PHOTO');
        } catch {
          // Image too large for storage — keep it for this session only.
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const removeBgPhoto = () => {
    setBgPhoto(null);
    setBgMode('AUTO');
    try {
      localStorage.removeItem('study-flow-bg-photo');
      localStorage.setItem('study-flow-bg-mode', 'AUTO');
    } catch {}
  };

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

  // Share objectives with the Electron mini widget (separate window):
  // publish on change, and absorb toggles the widget writes back.
  useEffect(() => {
    if (currentStep !== 'FOCUS') return;
    localStorage.setItem('study-flow-objectives', JSON.stringify({
      goals,
      completed: completedGoals
    }));
  }, [goals, completedGoals, currentStep]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'study-flow-objectives' || !e.newValue) return;
      try {
        const data = JSON.parse(e.newValue);
        if (Array.isArray(data.goals)) setGoals(data.goals);
        if (Array.isArray(data.completed)) setCompletedGoals(data.completed);
      } catch {
        // Ignore malformed payloads.
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const handleSessionComplete = useCallback(async () => {
    await completeFocus();
  }, [completeFocus]);

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
      console.error('Failed to finish session', error);
    } finally {
      setIsFinishing(false);
    }
  };

  const handleStartFocus = () => {
    if (noLimit && (task.id === 'free' || !isSyncedWithTimetable)) {
      startFocus(task, null);
      return;
    }
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
    // An open-ended session starts at 0:00 and counts up - that zero is the
    // beginning, not the end.
    if (step === 'FOCUS' && !openEnded && timeLeft.h === 0 && timeLeft.m === 0 && timeLeft.s === 0 && isActive) {
      handleSessionComplete();
    }
  }, [step, timeLeft, isActive, openEnded, handleSessionComplete]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
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
        case 'KeyV':
          e.preventDefault();
          setViewMode(prev => (prev === 'TIMER' ? 'SONG' : 'TIMER'));
          break;
        case 'KeyP':
          e.preventDefault();
          setShowFlowAI(prev => !prev);
          break;
        case 'ArrowRight':
          e.preventDefault();
          player.next();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          player.prev();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, isPaused, resumeFocus, pauseFocus, toggleFullscreen, player.next, player.prev]);

  // Esc exits the immersive album-cover layout.
  useEffect(() => {
    if (!immersiveCover) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setImmersiveCover(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [immersiveCover]);

  // Track connectivity so online music gracefully steps aside when offline.
  useEffect(() => {
    const update = () => setIsOnlineNet(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  // Show trending tracks the first time the Online tab is opened.
  useEffect(() => {
    if (libraryTab !== 'ONLINE' || !isOnlineNet || trendingLoadedRef.current) return;
    trendingLoadedRef.current = true;
    setOnlineLoading(true);
    getTrendingOnlineSongs()
      .then((r) => setOnlineResults(r))
      .catch(() => {})
      .finally(() => setOnlineLoading(false));
  }, [libraryTab, isOnlineNet]);

  const runOnlineSearch = async () => {
    const q = onlineQuery.trim();
    if (!q || onlineLoading) return;
    setOnlineLoading(true);
    setOnlineSearched(true);
    try {
      setOnlineResults(await searchOnlineSongs(q));
    } catch {
      setOnlineResults([]);
    } finally {
      setOnlineLoading(false);
    }
  };

  // Drag & drop audio anywhere on the focus screen to add it to the library.
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFiles(false);
    const audioFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|oga|flac|opus)$/i.test(f.name));
    if (audioFiles.length > 0) {
      player.uploadFiles(audioFiles);
      setIsLibraryOpen(true);
    }
  }, [player.uploadFiles]);

  // How far through the session we are. Open-ended sessions lap once an hour.
  const elapsedFraction = openEnded
    ? (elapsedSeconds % 3600) / 3600
    : totalDurationSeconds > 0
    ? Math.min(1, Math.max(0, elapsedSeconds / totalDurationSeconds))
    : 0;
  const elapsedPercent = Math.round(elapsedFraction * 100);

  // Today's still-pending sessions that start after the current task.
  const nextSessions = upcomingTasks
    .filter(t => t.id !== task.id && !t.isDone)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .slice(0, 3);

  const isScheduled = task.id !== 'free';
  const typeLabel = task.type === 'REVISION' ? 'Revision' : task.type === 'HOMEWORK' ? 'Homework' : 'Free session';
  const durationChoices = (
    <div className="space-y-4">
      <Segmented
        label="Session length"
        value={noLimit ? -1 : presets.includes(customDuration) ? customDuration : null}
        options={[
          ...presets.map((mins) => ({ value: mins, label: `${mins} min` })),
          { value: -1, label: <><InfinityIcon /> No limit</> },
        ]}
        onChange={(v) => {
          if (v === -1) setNoLimit(true);
          else {
            setCustomDuration(v);
            setNoLimit(false);
          }
        }}
      />
      {noLimit ? (
        <p className="text-sm text-muted-foreground">
          The timer counts up from 0:00 and keeps going until you finish the session yourself.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Or pick your own</span>
            <span className="font-medium tabular-nums text-foreground">{customDuration} min</span>
          </div>
          <Slider
            value={[customDuration]}
            onValueChange={(v) => setCustomDuration(v[0])}
            max={180}
            min={5}
            step={5}
            aria-label="Session length in minutes"
          />
        </div>
      )}
    </div>
  );

  if (currentStep === 'PREP') {
    return (
      <div className="h-full overflow-y-auto bg-background text-foreground">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center gap-8 px-4 py-10 md:px-8">
          <div className="space-y-2">
            <Link
              href="/focus"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary/80 transition-colors hover:text-primary"
            >
              <ArrowLeft className="size-3.5" /> Back
            </Link>
            <h1 className="font-heading text-4xl font-bold tracking-tight break-words">{task.subject}</h1>
            <p className="text-base text-muted-foreground">
              {typeLabel}
              {isScheduled && ` · ${task.startTime}–${task.endTime}`}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <section className="space-y-6 rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
              <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
                <Clock className="size-5 text-primary" /> Length
              </h2>
              {isScheduled ? (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">Stop when the block ends</p>
                      <p className="text-xs text-muted-foreground">
                        {isSyncedWithTimetable
                          ? `Runs until ${task.endTime}, the end of this block.`
                          : 'Off: choose a length below.'}
                      </p>
                    </div>
                    <Switch
                      checked={isSyncedWithTimetable}
                      aria-label="Stop when the block ends"
                      onCheckedChange={(checked) => {
                        setIsSyncedWithTimetable(checked);
                        if (checked) {
                          const [startH, startM] = task.startTime.split(':').map(Number);
                          const [endH, endM] = task.endTime.split(':').map(Number);
                          let diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
                          if (diffMinutes <= 0) diffMinutes += 1440;
                          setCustomDuration(diffMinutes);
                        }
                      }}
                    />
                  </div>
                  {!isSyncedWithTimetable && durationChoices}
                </>
              ) : (
                durationChoices
              )}

              <Field label="Mode" hint={intensity === 'INTENSE' ? 'Earns double XP for the time you focus.' : 'Earns XP for the time you focus.'}>
                <Segmented
                  label="Mode"
                  value={intensity}
                  options={[
                    { value: 'CHILL', label: 'Normal' },
                    { value: 'INTENSE', label: <><Zap /> Deep focus</> },
                  ]}
                  onChange={setIntensity}
                />
              </Field>
            </section>

            <section className="space-y-6 rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
              <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
                <ListTodo className="size-5 text-primary" /> Goals
              </h2>
              <div className="space-y-2">
                {goals.map((goal, idx) => (
                  <Input
                    key={idx}
                    value={goal}
                    onChange={(e) => updateGoal(idx, e.target.value)}
                    placeholder={idx === 0 ? 'What will you get done?' : `Goal ${idx + 1}`}
                    aria-label={`Goal ${idx + 1}`}
                    className="h-10"
                  />
                ))}
                <Button variant="ghost" size="sm" onClick={addGoal} className="gap-1 text-primary">
                  <Plus className="size-4" /> Add a goal
                </Button>
              </div>

              <Field label="Breaks" hint="Work and rest minutes. The session timer keeps running and the music gets quieter.">
                <Segmented
                  label="Breaks"
                  value={breakCycle ? breakCycle.work : 0}
                  options={BREAK_PRESETS.map((p) => ({ value: p.work, label: p.label }))}
                  onChange={(work) => chooseBreakCycle(BREAK_PRESETS.find((p) => p.work === work) ?? BREAK_PRESETS[0])}
                />
              </Field>
            </section>
          </div>

          <Button onClick={handleStartFocus} size="lg" className="h-12 w-full text-base">
            <Play className="size-5" /> Start session
          </Button>
        </div>
      </div>
    );
  }

  if (currentStep === 'FOCUS') {
    const currentSong = player.currentSong;

    return (
      <div
        ref={containerRef}
        className="dark h-full flex flex-col overflow-hidden relative select-none bg-black text-white"
        onDragOver={(e) => { e.preventDefault(); setIsDraggingFiles(true); }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setIsDraggingFiles(false); }}
        onDrop={handleDrop}
      >
        {/* Background scene: a user photo, or the Apple Music-style fluid gradient
            (audio-reactive, retinted by breaks & reminders). */}
        {bgMode === 'PHOTO' && bgPhoto ? (
          <div className="absolute inset-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bgPhoto}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover scale-110"
              style={{ filter: 'blur(2px) brightness(0.78) saturate(1.1)' }}
            />
            {/* Transient colour wash so breaks / nudges / Deep Focus still register */}
            {(onBreak || activeReminder || isIntense) && (
              <div
                className="absolute inset-0 transition-colors duration-700 mix-blend-soft-light"
                style={{ backgroundColor: `${scenePalette[0]}88` }}
              />
            )}
          </div>
        ) : (
          <FluidGradient
            colors={scenePalette}
            paused={isPaused}
            analyser={player.analyser}
            intense={isIntense && !onBreak}
            className="absolute inset-0 overflow-hidden"
          />
        )}
        {/* Readability veil */}
        <div className="absolute inset-0 bg-black/25 pointer-events-none" />

        {/* Deep Focus tint: a hot ember wash + pulsing edge frame to lock you in */}
        {isIntense && !onBreak && (
          <>
            <div className="absolute inset-0 pointer-events-none bg-orange-900/15 mix-blend-overlay" />
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{ boxShadow: 'inset 0 0 200px 30px rgba(249,115,22,0.28)' }}
              animate={{ opacity: isPaused ? 0.25 : [0.45, 0.8, 0.45] }}
              transition={isPaused ? { duration: 0.4 } : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        )}

        {/* Wellness reminder card (water / stretch) */}
        <AnimatePresence>
          {activeReminder && !onBreak && (
            <motion.div
              initial={{ opacity: 0, y: -24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="absolute top-24 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 pl-4 pr-3 py-3.5 rounded-[24px] border backdrop-blur-2xl shadow-2xl"
              style={{
                backgroundColor: 'rgba(0,0,0,0.45)',
                borderColor: `${(activeReminder === 'WATER' ? WATER_PALETTE : STRETCH_PALETTE)[2]}55`
              }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: `linear-gradient(135deg, ${(activeReminder === 'WATER' ? WATER_PALETTE : STRETCH_PALETTE)[0]}, ${(activeReminder === 'WATER' ? WATER_PALETTE : STRETCH_PALETTE)[1]})` }}
              >
                {activeReminder === 'WATER'
                  ? <Droplets className="w-6 h-6 text-white" />
                  : <PersonStanding className="w-6 h-6 text-white" />}
              </div>
              <div className="pr-2">
                <p className="text-sm font-black leading-tight">
                  {activeReminder === 'WATER' ? 'Have some water' : 'Time to stretch'}
                </p>
                <p className="text-xs font-semibold text-white/55 leading-tight mt-0.5">
                  {activeReminder === 'WATER'
                    ? `You have been working for ${WATER_INTERVAL_MIN} minutes.`
                    : 'Stand up, roll your shoulders and sit up straight.'}
                </p>
              </div>
              <Button
                variant="ghost" size="icon"
                onClick={() => setActiveReminder(null)}
                className="w-8 h-8 rounded-xl hover:bg-white/10 text-white/50 hover:text-white shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Break takeover */}
        <AnimatePresence>
          {onBreak && !isPaused && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-8 bg-black/30 backdrop-blur-md"
            >
              <div
                className="w-24 h-24 rounded-[32px] flex items-center justify-center shadow-2xl"
                style={{ background: `linear-gradient(135deg, ${BREAK_PALETTE[0]}, ${BREAK_PALETTE[1]})` }}
              >
                <Coffee className="w-12 h-12 text-white" />
              </div>
              <div className="text-center space-y-3">
                <h2 className="text-5xl md:text-6xl font-heading font-black tracking-tight drop-shadow-xl">Break</h2>
                <p className="text-base font-bold text-white/60">
                  Stand up, look away from the screen, have some water.
                </p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-white/40">Back to work in</p>
                <p className="text-6xl font-heading font-black tabular-nums drop-shadow-xl" style={{ color: BREAK_PALETTE[2] }}>
                  {formatTime(breakRemainingSeconds)}
                </p>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                The session timer keeps running. Music is turned down.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Drop-files overlay */}
        <AnimatePresence>
          {isDraggingFiles && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-4 z-50 rounded-[40px] border-2 border-dashed border-white/50 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center gap-4 pointer-events-none"
            >
              <Upload className="w-16 h-16 text-white/80" />
              <p className="text-2xl font-heading font-black">Drop songs to add them to your music</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Ribbon Controls */}
        <div className="py-4 px-8 flex items-center justify-between relative z-20 shrink-0">
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-3 px-5 py-2 bg-white/5 border border-white/10 rounded-full backdrop-blur-xl shadow-inner">
               <Flame className="w-5 h-5 text-orange-500 fill-orange-500 animate-pulse" />
               <span className="font-black text-lg tabular-nums tracking-tight">{sessionXP} XP</span>
             </div>
             <NowClock className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full backdrop-blur-xl text-sm font-bold text-white/80 tabular-nums" />
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
                title="Small always-on-top window"
              >
                <Minimize2 className="w-5 h-5 text-white/80" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "w-12 h-12 rounded-2xl border transition-all duration-300",
                showKeybindsInfo ? "bg-primary/20 border-primary/40 text-primary" : "bg-white/5 border-white/10 hover:bg-white/10 text-white"
              )}
              onClick={() => setShowKeybindsInfo(!showKeybindsInfo)}
              title="Keyboard shortcuts"
            >
              <Info className="w-5 h-5" />
            </Button>

            {/* Focus settings (background, timer style, breaks, reminders) */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "w-12 h-12 rounded-2xl border transition-all duration-300",
                showSettings ? "bg-primary/20 border-primary/40 text-primary" : "bg-white/5 border-white/10 hover:bg-white/10 text-white"
              )}
              onClick={() => setShowSettings(true)}
              title="Focus settings"
            >
              <Settings className="w-5 h-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "w-12 h-12 rounded-2xl border transition-all duration-300",
                isZenMode ? "bg-primary/20 border-primary/40 text-primary" : "bg-white/5 border-white/10 hover:bg-white/10 text-white"
              )}
              onClick={() => setIsZenMode(!isZenMode)}
              title={isZenMode ? "Show side panels (Z)" : "Hide side panels (Z)"}
            >
              {isZenMode ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            </Button>

            {/* Flow AI study workspace */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "w-12 h-12 rounded-2xl border transition-all duration-300",
                showFlowAI ? "bg-primary/20 border-primary/40 text-primary" : "bg-white/5 border-white/10 hover:bg-white/10 text-white"
              )}
              onClick={() => setShowFlowAI(prev => !prev)}
              title="Study tools: notes, a tutor and flashcards from your material (P)"
            >
              <GraduationCap className="w-5 h-5" />
            </Button>

            {/* Song / Timer view toggle */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "w-12 h-12 rounded-2xl border transition-all duration-300",
                viewMode === 'SONG' ? "bg-primary/20 border-primary/40 text-primary" : "bg-white/5 border-white/10 hover:bg-white/10 text-white"
              )}
              onClick={() => setViewMode(viewMode === 'TIMER' ? 'SONG' : 'TIMER')}
              title={viewMode === 'TIMER' ? 'Music view (V)' : 'Timer view (V)'}
            >
              {viewMode === 'TIMER' ? <Disc3 className="w-5 h-5" /> : <Timer className="w-5 h-5" />}
            </Button>

            {/* Music library */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "w-12 h-12 rounded-2xl border transition-all duration-300",
                isLibraryOpen ? "bg-primary/20 border-primary/40 text-primary" : "bg-white/5 border-white/10 hover:bg-white/10 text-white"
              )}
              onClick={() => setIsLibraryOpen(!isLibraryOpen)}
              title="Your music"
            >
              <ListMusic className="w-5 h-5" />
            </Button>

            <div className="h-6 w-px bg-white/10 mx-1" />

            <Link href="/">
              <Button variant="ghost" size="icon" className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white" title="Leave">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              className={cn("w-12 h-12 rounded-2xl border transition-all duration-500", intensity === 'INTENSE' ? "bg-orange-500/20 border-orange-500/40 text-orange-500" : "bg-white/5 border-white/10 hover:bg-white/10 text-white")}
              onClick={() => setIntensity(intensity === 'INTENSE' ? 'CHILL' : 'INTENSE')}
              title={intensity === 'INTENSE' ? 'Switch to normal focus' : 'Switch to deep focus (double XP)'}
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

        {/* Hidden input for background photo uploads */}
        <input
          ref={bgPhotoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleBgPhoto(file);
            if (bgPhotoInputRef.current) bgPhotoInputRef.current.value = '';
          }}
        />

        {/* ============ FOCUS SETTINGS SLIDE-OVER ============ */}
        <AnimatePresence>
          {showSettings && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 bg-black/40"
                onClick={() => setShowSettings(false)}
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 320, damping: 34 }}
                className="absolute top-0 right-0 bottom-0 z-50 w-full max-w-[420px] bg-zinc-950/85 backdrop-blur-2xl border-l border-white/10 shadow-2xl flex flex-col"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                      <Settings className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-heading font-black tracking-tight">Focus settings</h3>
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => setShowSettings(false)}
                    className="w-10 h-10 rounded-xl hover:bg-white/10 text-white/60 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                  {/* ---- Background ---- */}
                  <section className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40 flex items-center gap-2">
                      <Palette className="w-3.5 h-3.5" /> Background
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { id: 'AUTO', label: 'Album', icon: Sparkles },
                        { id: 'PHOTO', label: 'Photo', icon: ImageIcon },
                        { id: 'CUSTOM', label: 'Custom', icon: Palette },
                      ] as { id: BgMode; label: string; icon: typeof Sparkles }[]).map(({ id, label, icon: Icon }) => (
                        <button
                          key={id}
                          onClick={() => chooseBgMode(id)}
                          className={cn(
                            'flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all font-bold text-xs',
                            bgMode === id
                              ? 'bg-primary/15 border-primary text-white'
                              : 'bg-white/5 border-white/10 text-white/50 hover:border-white/25'
                          )}
                        >
                          <Icon className="w-5 h-5" />
                          {label}
                        </button>
                      ))}
                    </div>

                    {bgMode === 'AUTO' && (
                      <p className="text-[11px] font-semibold text-white/40 leading-relaxed">
                        Slowly moving colours taken from the cover of the song that is playing.
                      </p>
                    )}

                    {bgMode === 'PHOTO' && (
                      <div className="space-y-3">
                        {bgPhoto ? (
                          <div className="relative rounded-2xl overflow-hidden border border-white/10 aspect-video">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={bgPhoto} alt="Background preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                              <Button size="sm" onClick={() => bgPhotoInputRef.current?.click()} className="rounded-xl bg-white text-black hover:bg-white/90 font-bold gap-1.5 h-9">
                                <Upload className="w-3.5 h-3.5" /> Replace
                              </Button>
                              <Button size="sm" variant="ghost" onClick={removeBgPhoto} className="rounded-xl bg-black/50 text-white hover:bg-black/70 font-bold gap-1.5 h-9">
                                <Trash2 className="w-3.5 h-3.5" /> Remove
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => bgPhotoInputRef.current?.click()}
                            className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-2xl border-2 border-dashed border-white/15 bg-white/5 hover:border-primary/40 hover:bg-white/10 transition-all"
                          >
                            <ImageIcon className="w-7 h-7 text-white/40" />
                            <span className="text-xs font-bold text-white/60">Upload a background photo</span>
                            <span className="text-[10px] font-semibold text-white/30">Shown slightly blurred so the timer stays readable</span>
                          </button>
                        )}
                      </div>
                    )}

                    {bgMode === 'CUSTOM' && (
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          {PRESET_BG_PALETTES.map((p) => (
                            <button
                              key={p.name}
                              onClick={() => applyPresetPalette(p.colors)}
                              title={p.name}
                              className="h-9 w-14 rounded-xl border border-white/15 overflow-hidden flex hover:scale-105 transition-transform"
                            >
                              {p.colors.map((c, i) => (
                                <span key={i} className="flex-1 h-full" style={{ backgroundColor: c }} />
                              ))}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                          {[0, 1, 2, 3].map((i) => (
                            <label key={i} className="flex flex-col items-center gap-1.5 cursor-pointer">
                              <span
                                className="w-full h-12 rounded-xl border border-white/15 shadow-inner relative overflow-hidden"
                                style={{ backgroundColor: customPalette[i] || '#000000' }}
                              >
                                <input
                                  type="color"
                                  value={customPalette[i] || '#000000'}
                                  onChange={(e) => updateCustomColor(i, e.target.value)}
                                  className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                              </span>
                              <span className="text-[9px] font-bold text-white/30 uppercase tracking-wider">
                                {i === 0 ? 'Base' : i === 3 ? 'Deep' : `Tone ${i}`}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>

                  {/* ---- Break Cycle ---- */}
                  <section className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40 flex items-center gap-2">
                      <Coffee className="w-3.5 h-3.5" /> Breaks
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      {BREAK_PRESETS.map((preset) => {
                        const selected = preset.work === 0 ? !breakCycle : breakCycle?.work === preset.work;
                        return (
                          <button
                            key={preset.label}
                            onClick={() => chooseBreakCycle(preset)}
                            className={cn(
                              'py-2.5 rounded-xl border-2 transition-all font-bold text-xs',
                              selected
                                ? 'bg-primary/15 border-primary text-white'
                                : 'bg-white/5 border-white/10 text-white/50 hover:border-white/25'
                            )}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {/* ---- Wellness Reminders ---- */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1 pr-4">
                        <h4 className="text-sm font-black text-white flex items-center gap-2">
                          <Droplets className="w-4 h-4 text-cyan-400" /> Water and stretch reminders
                        </h4>
                        <p className="text-[11px] font-semibold text-white/40 leading-relaxed">
                          Water every {WATER_INTERVAL_MIN} minutes, a stretch every {STRETCH_INTERVAL_MIN}.
                        </p>
                      </div>
                      <Switch checked={remindersOn} onCheckedChange={toggleReminders} />
                    </div>
                  </section>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ============ WORKSPACE ============ */}
        {showFlowAI ? (
          /* ---------- FLOW AI WORKSPACE ---------- */
          <FlowAIPanel
            subject={task.subject}
            timerLabel={`${timeLeft.h > 0 ? `${timeLeft.h}:` : ''}${timeLeft.m.toString().padStart(2, '0')}:${timeLeft.s.toString().padStart(2, '0')}`}
            onClose={() => setShowFlowAI(false)}
          />
        ) : viewMode === 'TIMER' ? (
          /* ---------- TIMER VIEW ---------- */
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
                        <ListTodo className="w-4 h-4 text-primary" /> Goals
                      </h3>
                    </div>

                    <div className="space-y-4">
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
                          placeholder="Add a goal"
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
                          <p className="text-xs font-bold text-white/30 text-center py-4">No goals yet.</p>
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

            {/* The clock. min-w-0 lets the column shrink so the digits never push
                the side panels off-screen; containerType powers the cqw sizing. */}
            <div className="flex-1 min-w-0 w-full flex flex-col items-center justify-center py-4" style={{ containerType: 'inline-size' }}>
              <motion.div
                className="flex w-full flex-col items-center text-center px-4"
                animate={{ scale: isPaused ? 0.985 : [1, 1.006, 1] }}
                transition={isPaused ? { duration: 0.4 } : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              >
                {/* What this session is */}
                <div className="mb-8 inline-flex max-w-full items-center gap-3 rounded-full border border-white/10 bg-white/[0.06] py-1.5 pl-1.5 pr-5 backdrop-blur-xl">
                  <span
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]"
                    style={{ backgroundColor: `${isPaused ? '#f59e0b' : scenePalette[2] || '#ffffff'}26`, color: isPaused ? '#fbbf24' : scenePalette[2] || '#ffffff' }}
                  >
                    <span className={cn('size-1.5 rounded-full bg-current', !isPaused && 'motion-safe:animate-pulse')} />
                    {isPaused ? 'Paused' : onBreak ? 'Break' : isIntense ? 'Deep focus' : 'Focusing'}
                  </span>
                  <span className="min-w-0 truncate text-sm font-bold text-white">{task.subject}</span>
                  <span className="hidden shrink-0 text-xs font-semibold text-white/50 sm:inline">{typeLabel}</span>
                </div>

                {/* Time left */}
                <div
                  role="timer"
                  aria-label={`${openEnded ? 'Time so far' : 'Time left'}: ${timeLeft.h > 0 ? `${timeLeft.h} hours ` : ''}${timeLeft.m} minutes ${timeLeft.s} seconds`}
                  className={cn(
                    'flex max-w-full items-baseline justify-center font-heading font-black tabular-nums leading-[0.8] tracking-tight text-white transition-[font-size,opacity] duration-700 ease-in-out drop-shadow-[0_10px_40px_rgba(0,0,0,0.35)]',
                    isPaused && 'opacity-45'
                  )}
                  style={{ fontSize: timeLeft.h > 0 ? 'clamp(3.5rem, 24cqw, 14rem)' : 'clamp(4.5rem, 34cqw, 18rem)' }}
                >
                  {timeLeft.h > 0 && (
                    <>
                      <span>{timeLeft.h.toString().padStart(2, '0')}</span>
                      <span className="mx-[0.04em] -translate-y-[0.06em] font-sans font-extralight text-white/30">:</span>
                    </>
                  )}
                  <span>{timeLeft.m.toString().padStart(2, '0')}</span>
                  <span className="mx-[0.04em] -translate-y-[0.06em] font-sans font-extralight text-white/30">:</span>
                  <span className="text-white/75">{timeLeft.s.toString().padStart(2, '0')}</span>
                </div>
                <p className="mt-6 text-[11px] font-black uppercase tracking-[0.35em] text-white/45">
                  {openEnded ? 'Time so far' : 'Time left'}
                </p>

                {/* Progress through the session */}
                <div className="mt-8 w-full max-w-[min(32rem,80cqw)]">
                  <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-linear"
                      style={{
                        width: `${Math.max(elapsedPercent, 1)}%`,
                        background: `linear-gradient(to right, ${scenePalette[1] || '#ffffff'}, ${scenePalette[2] || '#ffffff'})`,
                      }}
                    />
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-[11px] font-bold tabular-nums text-white/45">
                    <span>{openEnded ? 'No set length' : `${elapsedPercent}% done`}</span>
                    <span>{openEnded ? 'Finish when you are ready' : `${initialDurationMinutes} min session`}</span>
                  </div>
                </div>

                {isPaused && (
                  <p className="mt-6 text-xs font-semibold text-white/50">
                    Press <kbd className="rounded-md border border-white/15 bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white/80">Space</kbd> to carry on
                  </p>
                )}
              </motion.div>
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
                      <BookOpen className="w-4 h-4 text-primary" /> Files
                    </h3>
                    <div className="space-y-3">
                       {resources.length === 0 ? (
                         <p className="text-xs font-bold text-white/30 text-center py-4">No files for this subject yet.</p>
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

                  {/* Next focus sessions today */}
                  {nextSessions.length > 0 && (
                    <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[32px] p-6 space-y-4">
                      <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/40 flex items-center gap-2">
                        <CalendarClock className="w-4 h-4 text-primary" /> Later today
                      </h3>
                      <div className="space-y-2">
                        {nextSessions.map((next) => (
                          <Link
                            key={next.id}
                            href={`/focus/${next.id}`}
                            className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/15 hover:bg-white/10 transition-colors group"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-bold truncate">{next.subject}</p>
                              <p className="text-[10px] font-black uppercase tracking-widest text-white/35">{next.type === 'REVISION' ? 'Revision' : 'Homework'}</p>
                            </div>
                            <span className="text-xs font-black tabular-nums text-white/55 group-hover:text-white shrink-0">
                              {next.startTime}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          /* ---------- SONG VIEW (Apple Music style) ---------- */
          <div className="flex-1 relative z-10 overflow-y-auto custom-scrollbar">
            {!hasSongs ? (
              <div className="h-full flex flex-col items-center justify-center gap-8 px-8">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="max-w-lg w-full bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[40px] p-12 text-center space-y-6"
                >
                  <div className="w-24 h-24 mx-auto rounded-[28px] flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})` }}>
                    <Music className="w-12 h-12 text-white/80" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-heading font-black tracking-tight">Add music for your sessions</h2>
                    <p className="text-sm font-semibold text-white/50 leading-relaxed">
                      Add your own songs. Titles, artists and covers are read from the files, and the background takes its colours from each cover.
                    </p>
                  </div>
                  <Button
                    onClick={() => uploadInputRef.current?.click()}
                    className="h-14 px-10 rounded-2xl bg-white text-black hover:bg-white/90 font-black text-base gap-3"
                  >
                    <Upload className="w-5 h-5" /> Add music
                  </Button>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">or drag audio files anywhere on this screen</p>
                </motion.div>
              </div>
            ) : (
              <div className="min-h-full flex items-center justify-center px-8 md:px-12 py-8">
                <div className="w-full max-w-[1500px] grid grid-cols-1 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] gap-12 lg:gap-16 items-center">
                  {/* Left: artwork + transport */}
                  <div className="flex flex-col items-center lg:items-start gap-8 max-w-[520px] mx-auto lg:mx-0 w-full">
                    <motion.div
                      key={currentSong?.id}
                      initial={{ opacity: 0.6, scale: 0.96 }}
                      animate={{
                        opacity: 1,
                        scale: player.isPlaying ? 1 : 0.94
                      }}
                      transition={{ type: 'spring', stiffness: 220, damping: 24 }}
                      className="group/cover relative w-full max-w-[440px] aspect-square rounded-[28px] overflow-hidden shadow-[0_40px_90px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/10"
                    >
                      <CoverArt song={currentSong} palette={palette} className="w-full h-full" iconSize="w-20 h-20" />

                      {/* Hover controls over the artwork */}
                      <div className="absolute inset-0 flex flex-col justify-between p-4 bg-gradient-to-t from-black/60 via-transparent to-black/30 opacity-0 group-hover/cover:opacity-100 transition-opacity">
                        <div className="flex justify-end">
                          <button
                            onClick={() => setImmersiveCover(true)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/50 backdrop-blur-md border border-white/15 text-white text-[11px] font-black hover:bg-black/70 transition-colors"
                            title="Full screen cover"
                          >
                            <Maximize2 className="w-3.5 h-3.5" /> Full screen
                          </button>
                        </div>
                        <div className="flex items-center justify-center">
                          <button
                            onClick={player.togglePlay}
                            className="w-16 h-16 rounded-full bg-white/90 text-black flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-transform"
                          >
                            {player.isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current ml-1" />}
                          </button>
                        </div>
                        <div />
                      </div>
                    </motion.div>

                    <div className="w-full max-w-[440px] space-y-5">
                      <div className="space-y-1 text-center lg:text-left">
                        <h2 className="text-2xl md:text-3xl font-heading font-black tracking-tight leading-tight truncate drop-shadow-lg">
                          {currentSong?.title}
                        </h2>
                        <p className="text-base font-bold text-white/55 truncate">
                          {currentSong?.artist || 'Unknown artist'}
                        </p>
                      </div>

                      {/* Seek */}
                      <div className="space-y-1.5">
                        <Slider
                          value={[Math.min(player.currentTime, player.duration || player.currentTime)]}
                          max={player.duration || 1}
                          min={0}
                          step={1}
                          onValueChange={(v) => player.seek(v[0])}
                          className="cursor-pointer py-1"
                        />
                        <div className="flex justify-between text-[11px] font-bold tabular-nums text-white/40">
                          <span>{formatTime(player.currentTime)}</span>
                          <span>-{formatTime(Math.max(0, (player.duration || 0) - player.currentTime))}</span>
                        </div>
                      </div>

                      {/* Transport */}
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost" size="icon"
                          onClick={player.toggleShuffle}
                          className={cn("w-11 h-11 rounded-xl hover:bg-white/10", player.shuffle ? "text-white" : "text-white/40")}
                          title="Shuffle"
                        >
                          <Shuffle className="w-5 h-5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={player.prev} className="w-14 h-14 rounded-2xl hover:bg-white/10 text-white">
                          <SkipBack className="w-7 h-7 fill-current" />
                        </Button>
                        <Button
                          onClick={player.togglePlay}
                          className="w-[72px] h-[72px] rounded-full bg-white text-black hover:bg-white/90 hover:scale-105 active:scale-95 transition-all shadow-2xl"
                          title={player.musicOn ? 'Pause music' : 'Play music'}
                        >
                          {player.isPlaying
                            ? <Pause className="w-8 h-8 fill-current" />
                            : <Play className="w-8 h-8 fill-current ml-1" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={player.next} className="w-14 h-14 rounded-2xl hover:bg-white/10 text-white">
                          <SkipForward className="w-7 h-7 fill-current" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          onClick={player.toggleRepeatOne}
                          className={cn("w-11 h-11 rounded-xl hover:bg-white/10", player.repeatOne ? "text-white" : "text-white/40")}
                          title="Repeat this song"
                        >
                          {player.repeatOne ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                        </Button>
                      </div>

                      {/* Volume */}
                      <div className="flex items-center gap-3 px-2">
                        <button onClick={() => setIsMuted(!isMuted)} className="text-white/40 hover:text-white transition-colors">
                          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                        <Slider
                          value={[isMuted ? 0 : volume]}
                          max={1} min={0} step={0.01}
                          onValueChange={(v) => {
                            setVolume(v[0]);
                            if (isMuted && v[0] > 0) setIsMuted(false);
                          }}
                          className="w-full cursor-pointer py-1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right: timer pill + lyrics / up next */}
                  <div className="flex flex-col gap-5 w-full mx-auto lg:mx-0 lg:self-stretch">
                    {/* Compact session timer */}
                    <div className="shrink-0 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[28px] p-6 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40 mb-1 truncate">
                          {task.subject} • {isPaused ? 'Paused' : 'Focusing'}
                        </p>
                        <p className={cn("text-4xl font-heading font-black tabular-nums tracking-tight leading-none", isPaused && "opacity-40")}>
                          {timeLeft.h > 0 && `${timeLeft.h.toString().padStart(2, '0')}:`}
                          {timeLeft.m.toString().padStart(2, '0')}
                          <span className="text-white/40">:{timeLeft.s.toString().padStart(2, '0')}</span>
                        </p>
                      </div>
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => isPaused ? resumeFocus() : pauseFocus()}
                        className="w-14 h-14 shrink-0 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/10"
                      >
                        {isPaused ? <Play className="w-6 h-6 fill-current" /> : <Pause className="w-6 h-6 fill-current" />}
                      </Button>
                    </div>

                    {/* Lyrics / Up Next */}
                    {!isZenMode && (
                      <div className="flex-1 flex flex-col min-h-[52vh]">
                        {/* Chrome-free tab toggle */}
                        <div className="flex items-center justify-between mb-4 shrink-0">
                          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl p-1">
                            <button
                              onClick={() => setSongPanelTab('LYRICS')}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors",
                                songPanelTab === 'LYRICS' ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"
                              )}
                            >
                              <ScrollText className="w-3 h-3" /> Lyrics
                            </button>
                            <button
                              onClick={() => setSongPanelTab('QUEUE')}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors",
                                songPanelTab === 'QUEUE' ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"
                              )}
                            >
                              <ListMusic className="w-3 h-3" /> Up next
                            </button>
                          </div>
                          <button
                            onClick={() => uploadInputRef.current?.click()}
                            className="text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white flex items-center gap-1.5 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add music
                          </button>
                        </div>

                        {songPanelTab === 'LYRICS' ? (
                          player.lyrics ? (
                            /* Borderless, full-height karaoke that fills the right side */
                            <div className="relative flex-1 min-h-0">
                              <LyricsPanel
                                lyrics={player.lyrics}
                                currentTime={player.currentTime}
                                onSeek={player.seek}
                                immersive
                                accent={scenePalette[2] || '#ffffff'}
                                className="absolute inset-0 h-full"
                              />
                            </div>
                          ) : (
                            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
                              <ScrollText className="w-8 h-8 text-white/20" />
                              <p className="text-xs font-bold text-white/35 leading-relaxed">
                                No lyrics found for this track yet.<br />They appear automatically when available.
                              </p>
                            </div>
                          )
                        ) : (
                          <div className="flex-1 space-y-1 overflow-y-auto custom-scrollbar pr-1 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[28px] p-4">
                            {player.upNext.length === 0 ? (
                              <p className="text-xs font-bold text-white/30 text-center py-6">Nothing queued. Add more songs.</p>
                            ) : (
                              player.upNext.map((song) => (
                                <button
                                  key={song.id}
                                  onClick={() => player.selectSong(song.id)}
                                  className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-white/10 transition-colors text-left group"
                                >
                                  <CoverArt song={song} palette={palette} className="w-11 h-11 rounded-lg shrink-0" iconSize="w-4 h-4" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold truncate">{song.title}</p>
                                    <p className="text-[11px] font-semibold text-white/40 truncate">{song.artist || 'Unknown artist'}</p>
                                  </div>
                                  {song.duration ? (
                                    <span className="text-[10px] font-bold tabular-nums text-white/30 group-hover:text-white/60">{formatTime(song.duration)}</span>
                                  ) : null}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mini now-playing bar (timer view only) */}
        {!showFlowAI && viewMode === 'TIMER' && currentSong && (
          <div className="absolute bottom-8 left-8 z-20 hidden md:flex items-center gap-3 pl-3 pr-4 py-3 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[24px] shadow-2xl max-w-[360px]">
            <button onClick={() => setViewMode('SONG')} className="shrink-0 group relative" title="Open Song View">
              <CoverArt song={currentSong} palette={palette} className="w-12 h-12 rounded-xl" iconSize="w-5 h-5" />
              <div className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Disc3 className="w-5 h-5 text-white" />
              </div>
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black truncate">{currentSong.title}</p>
              <p className="text-[10px] font-bold text-white/40 truncate">{currentSong.artist || 'Unknown artist'}</p>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button variant="ghost" size="icon" onClick={player.prev} className="w-8 h-8 rounded-lg hover:bg-white/10 text-white/80">
                <SkipBack className="w-4 h-4 fill-current" />
              </Button>
              <Button variant="ghost" size="icon" onClick={player.togglePlay} className="w-9 h-9 rounded-lg hover:bg-white/10 text-white">
                {player.isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={player.next} className="w-8 h-8 rounded-lg hover:bg-white/10 text-white/80">
                <SkipForward className="w-4 h-4 fill-current" />
              </Button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {!showFlowAI && (
        <div className="p-8 flex justify-center relative z-10 bg-gradient-to-t from-black/70 to-transparent">
          {!showProofForm ? (
            <Button
              onClick={() => setShowProofForm(true)}
              className="h-16 px-12 rounded-[24px] bg-white text-black hover:bg-white/90 font-black text-lg gap-3 shadow-2xl hover:scale-105 transition-all"
            >
              <CheckCircle2 className="w-6 h-6" />
              Finish session
            </Button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl w-full bg-zinc-900/90 backdrop-blur-3xl border border-white/10 p-8 rounded-[32px] space-y-6 shadow-2xl text-left"
            >
              <div className="flex justify-between items-center">
                 <h3 className="text-xl font-black">What did you get done?</h3>
                 <Button variant="ghost" size="icon" onClick={() => setShowProofForm(false)} className="hover:bg-white/5 text-white/80">
                   <X className="w-5 h-5" />
                 </Button>
              </div>

              <div className="space-y-4">
                 <Textarea
                   placeholder="A sentence about what you worked on."
                   value={proofDescription}
                   onChange={(e) => setProofDescription(e.target.value)}
                   className="bg-white/5 border-white/10 min-h-[100px] rounded-2xl font-bold placeholder:text-white/25 text-white"
                 />

                 <div className="flex flex-col sm:flex-row gap-4">
                    <label className="flex-1 flex items-center justify-center gap-2 h-14 bg-white/5 border border-white/10 rounded-2xl cursor-pointer hover:bg-white/10 transition-colors px-4">
                       <Paperclip className="w-5 h-5 text-primary" />
                       <span className="font-bold text-sm truncate">
                         {proofFile ? proofFile.name : 'Attach a PDF'}
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
                       Finish session
                    </Button>
                 </div>
              </div>
            </motion.div>
          )}
        </div>
        )}

        {/* Hidden upload inputs */}
        <input
          ref={uploadInputRef}
          type="file"
          accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.flac,.opus"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) player.uploadFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && coverTargetRef.current) {
              player.setCover(coverTargetRef.current, file);
            }
            e.target.value = '';
          }}
        />

        {/* Music Library slide-over */}
        <AnimatePresence>
          {isLibraryOpen && (
            <motion.div
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 60 }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              className="absolute top-24 bottom-8 right-8 w-[380px] z-40 bg-black/55 backdrop-blur-3xl border border-white/10 rounded-[32px] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-6 pb-4 flex items-center justify-between shrink-0">
                <h3 className="text-lg font-heading font-black flex items-center gap-2.5">
                  <ListMusic className="w-5 h-5 text-white/60" /> Your music
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setIsLibraryOpen(false)} className="w-9 h-9 rounded-xl hover:bg-white/10 text-white/70">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Library / Online tabs */}
              <div className="px-6 pb-4 shrink-0">
                <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/5 border border-white/10">
                  {([
                    { id: 'LIBRARY', label: 'Library', icon: ListMusic },
                    { id: 'ONLINE', label: 'Online', icon: Globe },
                  ] as const).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setLibraryTab(t.id)}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors',
                        libraryTab === t.id ? 'bg-white text-black' : 'text-white/50 hover:text-white',
                      )}
                    >
                      <t.icon className="w-3.5 h-3.5" /> {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {libraryTab === 'LIBRARY' && (
              <div className="px-6 pb-4 shrink-0">
                <Button
                  onClick={() => uploadInputRef.current?.click()}
                  className="w-full h-12 rounded-2xl bg-white text-black hover:bg-white/90 font-black gap-2"
                >
                  <Upload className="w-4 h-4" /> Add music
                </Button>
                {player.uploadError && (
                  <p className="mt-2 text-[11px] font-bold text-red-400">{player.uploadError}</p>
                )}
              </div>
              )}

              {/* Playlists */}
              {libraryTab === 'LIBRARY' && (
              <div className="px-6 pb-4 shrink-0 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Playlists</span>
                  <button
                    onClick={() => { setNewPlaylistOpen(o => !o); setNewPlaylistName(''); }}
                    className="text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white flex items-center gap-1"
                  >
                    <FolderPlus className="w-3.5 h-3.5" /> New
                  </button>
                </div>

                {newPlaylistOpen && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const name = newPlaylistName.trim();
                      if (!name) return;
                      const pl = await player.createPlaylist(name);
                      setNewPlaylistName('');
                      setNewPlaylistOpen(false);
                      if (pl) player.selectPlaylist(pl.id);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Input
                      autoFocus
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      placeholder="Playlist name…"
                      className="h-9 rounded-xl bg-white/5 border-white/10 text-xs font-bold px-3 text-white placeholder:text-white/25"
                    />
                    <Button type="submit" size="icon" className="h-9 w-9 shrink-0 rounded-xl bg-primary text-primary-foreground">
                      <Check className="w-4 h-4" />
                    </Button>
                  </form>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => player.selectPlaylist(null)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[11px] font-black border transition-colors",
                      !player.activePlaylistId ? "bg-white text-black border-white" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                    )}
                  >
                    All songs
                  </button>
                  {player.playlists.map((pl) => {
                    const active = player.activePlaylistId === pl.id;
                    return (
                      <div
                        key={pl.id}
                        className={cn(
                          "flex items-center rounded-full border transition-colors",
                          active ? "bg-white text-black border-white" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                        )}
                      >
                        {renamingPlaylistId === pl.id ? (
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const v = renameValue.trim();
                              if (v) await player.renamePlaylist(pl.id, v);
                              setRenamingPlaylistId(null);
                            }}
                          >
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onBlur={() => setRenamingPlaylistId(null)}
                              className="bg-transparent outline-none text-[11px] font-black px-3 py-1.5 w-24"
                            />
                          </form>
                        ) : (
                          <>
                            <button onClick={() => player.selectPlaylist(pl.id)} className="pl-3 pr-1 py-1.5 text-[11px] font-black max-w-[120px] truncate">
                              {pl.name}
                            </button>
                            <span className={cn("text-[10px] font-bold pr-1.5", active ? "text-black/40" : "text-white/30")}>{pl.songIds.length}</span>
                            {active && (
                              <div className="flex items-center pr-1.5 gap-0.5">
                                <button onClick={() => { setRenamingPlaylistId(pl.id); setRenameValue(pl.name); }} className="p-1 rounded-full hover:bg-black/10" title="Rename">
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button onClick={() => player.deletePlaylist(pl.id)} className="p-1 rounded-full hover:bg-black/10" title="Delete playlist">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              )}

              {libraryTab === 'LIBRARY' && (
              <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-6 space-y-1">
                {player.uploading.map((name) => (
                  <div key={name} className="flex items-center gap-3 p-3 rounded-2xl bg-white/5">
                    <div className="w-11 h-11 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                      <Loader2 className="w-4 h-4 animate-spin text-white/60" />
                    </div>
                    <p className="text-xs font-bold text-white/50 truncate">{name}</p>
                  </div>
                ))}

                {player.songs.length === 0 && player.uploading.length === 0 ? (
                  <div className="text-center py-16 px-6 space-y-3">
                    <Music className="w-10 h-10 text-white/20 mx-auto" />
                    <p className="text-sm font-bold text-white/35 leading-relaxed">No songs yet. Songs you add stay here for every session.</p>
                  </div>
                ) : (
                  player.songs.map((song) => {
                    const isCurrent = player.currentSong?.id === song.id;
                    const menuOpen = playlistMenuSongId === song.id;
                    return (
                      <div key={song.id}>
                      <div
                        className={cn(
                          "group flex items-center gap-3 p-2.5 rounded-2xl transition-colors cursor-pointer",
                          isCurrent ? "bg-white/15" : "hover:bg-white/10"
                        )}
                        onClick={() => player.selectSong(song.id)}
                      >
                        <div className="relative shrink-0">
                          <CoverArt song={song} palette={palette} className="w-11 h-11 rounded-lg" iconSize="w-4 h-4" />
                          {isCurrent && player.isPlaying && (
                            <div className="absolute inset-0 rounded-lg bg-black/45 flex items-center justify-center">
                              <span className="flex items-end gap-[2px] h-3.5">
                                <span className="w-[3px] bg-white rounded-full animate-[pulse_0.8s_ease-in-out_infinite] h-2" />
                                <span className="w-[3px] bg-white rounded-full animate-[pulse_1.1s_ease-in-out_infinite] h-3.5" />
                                <span className="w-[3px] bg-white rounded-full animate-[pulse_0.9s_ease-in-out_infinite] h-2.5" />
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-bold truncate flex items-center gap-1.5", isCurrent ? "text-white" : "text-white/85")}>
                            {(song as any).sourceType === 'AUDIUS' && <Globe className="w-3 h-3 text-primary shrink-0" />}
                            <span className="truncate">{song.title}</span>
                          </p>
                          <p className="text-[11px] font-semibold text-white/40 truncate">
                            {song.artist || 'Unknown artist'}{song.duration ? ` • ${formatTime(song.duration)}` : ''}
                          </p>
                        </div>
                        <div className={cn("flex items-center transition-opacity shrink-0", menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                          <Button
                            variant="ghost" size="icon"
                            className={cn("w-8 h-8 rounded-lg hover:bg-white/10 text-white/50 hover:text-white", menuOpen && "bg-white/10 text-white")}
                            title="Add to playlist"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPlaylistMenuSongId(menuOpen ? null : song.id);
                            }}
                          >
                            <ListPlus className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="w-8 h-8 rounded-lg hover:bg-white/10 text-white/50 hover:text-white"
                            title="Set cover art"
                            onClick={(e) => {
                              e.stopPropagation();
                              coverTargetRef.current = song.id;
                              coverInputRef.current?.click();
                            }}
                          >
                            <ImagePlus className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="w-8 h-8 rounded-lg hover:bg-red-500/20 text-white/50 hover:text-red-400"
                            title="Remove from library"
                            onClick={(e) => {
                              e.stopPropagation();
                              player.removeSong(song.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {menuOpen && (
                        <div className="mx-2 mb-1 mt-0.5 p-2 rounded-2xl bg-black/50 border border-white/10 space-y-1" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-between px-2 pb-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Add to playlist</span>
                            <button onClick={() => setPlaylistMenuSongId(null)} className="text-white/40 hover:text-white">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {player.playlists.length === 0 ? (
                            <p className="text-[11px] font-bold text-white/40 px-2 py-1.5">No playlists yet. Make one above.</p>
                          ) : (
                            player.playlists.map((pl) => {
                              const inIt = pl.songIds.includes(song.id);
                              return (
                                <button
                                  key={pl.id}
                                  onClick={() => player.toggleSongInPlaylist(pl.id, song.id)}
                                  className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl hover:bg-white/10 text-left"
                                >
                                  <span className="text-xs font-bold truncate">{pl.name}</span>
                                  <span className={cn("w-5 h-5 rounded-md border flex items-center justify-center shrink-0", inIt ? "bg-primary border-primary" : "border-white/20")}>
                                    {inIt && <Check className="w-3.5 h-3.5 text-white" />}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                      </div>
                    );
                  })
                )}
              </div>
              )}

              {/* ===== Online (Audius) tab ===== */}
              {libraryTab === 'ONLINE' && (
                <>
                  <div className="px-6 pb-3 shrink-0">
                    {!isOnlineNet ? (
                      <div className="flex items-center gap-2 text-[11px] font-bold text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-3 py-3">
                        <WifiOff className="w-4 h-4 shrink-0" /> You are offline. Connect to the internet to search for music.
                      </div>
                    ) : (
                      <form onSubmit={(e) => { e.preventDefault(); runOnlineSearch(); }} className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                          <Input
                            value={onlineQuery}
                            onChange={(e) => setOnlineQuery(e.target.value)}
                            placeholder="Search songs or artists"
                            className="h-11 pl-9 rounded-2xl bg-white/5 border-white/10 text-sm font-bold text-white placeholder:text-white/25"
                          />
                        </div>
                        <Button type="submit" disabled={onlineLoading} size="icon" className="h-11 w-11 shrink-0 rounded-2xl bg-primary text-primary-foreground">
                          {onlineLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        </Button>
                      </form>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-6 space-y-1">
                    {onlineLoading ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/40">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <p className="text-xs font-bold">Searching…</p>
                      </div>
                    ) : onlineResults.length === 0 ? (
                      <div className="text-center py-16 px-6 space-y-3">
                        <Globe className="w-10 h-10 text-white/20 mx-auto" />
                        <p className="text-sm font-bold text-white/35 leading-relaxed">
                          {!isOnlineNet ? 'Online music is unavailable offline.' : onlineSearched ? 'No results. Try another search.' : 'Search for any song to play or add it.'}
                        </p>
                      </div>
                    ) : (
                      <>
                        {!onlineSearched && (
                          <p className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-white/40">Popular now</p>
                        )}
                        {onlineResults.map((track) => {
                          const added = player.songs.some((s) => (s as any).externalId === track.id);
                          return (
                            <div key={track.id} className="group flex items-center gap-3 p-2.5 rounded-2xl hover:bg-white/10 transition-colors">
                              <div className="relative shrink-0 w-11 h-11 rounded-lg overflow-hidden bg-white/10">
                                {track.artworkUrl ? (
                                  <img src={track.artworkUrl} alt="" className="w-full h-full object-cover" draggable={false} />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center"><Music className="w-4 h-4 text-white/40" /></div>
                                )}
                              </div>
                              <button onClick={() => player.playOnlineSong(track)} className="flex-1 min-w-0 text-left">
                                <p className="text-sm font-bold truncate text-white/90">{track.title}</p>
                                <p className="text-[11px] font-semibold text-white/40 truncate">
                                  {track.artist}{track.duration ? ` • ${formatTime(track.duration)}` : ''}
                                </p>
                              </button>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <Button variant="ghost" size="icon" onClick={() => player.playOnlineSong(track)} className="w-8 h-8 rounded-lg hover:bg-white/10 text-white/60 hover:text-white" title="Play now">
                                  <Play className="w-4 h-4 fill-current" />
                                </Button>
                                <Button
                                  variant="ghost" size="icon"
                                  disabled={added || addingOnlineId === track.id}
                                  onClick={async () => { setAddingOnlineId(track.id); await player.addOnlineSong(track); setAddingOnlineId(null); }}
                                  className={cn('w-8 h-8 rounded-lg', added ? 'text-emerald-400' : 'hover:bg-white/10 text-white/60 hover:text-white')}
                                  title={added ? 'In your library' : 'Add to library'}
                                >
                                  {addingOnlineId === track.id ? <Loader2 className="w-4 h-4 animate-spin" /> : added ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Immersive album-cover layout — cover fills the screen, nothing else */}
        <AnimatePresence>
          {immersiveCover && currentSong && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[115] bg-black select-none"
            >
              <CoverArt song={currentSong} palette={palette} className="absolute inset-0 w-full h-full" iconSize="w-40 h-40" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/45" />

              {/* Top bar */}
              <div className="absolute top-0 inset-x-0 p-6 flex items-center justify-between z-10">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10">
                  <div className={cn("w-2 h-2 rounded-full", isPaused ? "bg-amber-500" : "bg-red-500 animate-pulse")} />
                  <span className="text-sm font-black tabular-nums">
                    {timeLeft.h > 0 && `${timeLeft.h.toString().padStart(2, '0')}:`}
                    {timeLeft.m.toString().padStart(2, '0')}:{timeLeft.s.toString().padStart(2, '0')}
                  </span>
                </div>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => setImmersiveCover(false)}
                  className="w-12 h-12 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 hover:bg-black/60 text-white"
                  title="Close full screen cover (Esc)"
                >
                  <Minimize2 className="w-5 h-5" />
                </Button>
              </div>

              {/* Bottom: now playing + controls */}
              <div className="absolute bottom-0 inset-x-0 p-8 md:p-14 space-y-6 z-10">
                <div className="max-w-3xl">
                  <h2 className="text-4xl md:text-6xl lg:text-7xl font-heading font-black tracking-tight drop-shadow-2xl truncate">{currentSong.title}</h2>
                  <p className="text-lg md:text-2xl font-bold text-white/70 truncate mt-2">{currentSong.artist || 'Unknown artist'}</p>
                </div>

                <div className="max-w-3xl space-y-1.5">
                  <Slider
                    value={[Math.min(player.currentTime, player.duration || player.currentTime)]}
                    max={player.duration || 1}
                    min={0}
                    step={1}
                    onValueChange={(v) => player.seek(v[0])}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] font-bold tabular-nums text-white/50">
                    <span>{formatTime(player.currentTime)}</span>
                    <span>-{formatTime(Math.max(0, (player.duration || 0) - player.currentTime))}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost" size="icon"
                    onClick={player.toggleShuffle}
                    className={cn("w-11 h-11 rounded-2xl hover:bg-white/10", player.shuffle ? "text-white" : "text-white/40")}
                    title="Shuffle"
                  >
                    <Shuffle className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={player.prev} className="w-12 h-12 rounded-2xl hover:bg-white/10 text-white">
                    <SkipBack className="w-6 h-6 fill-current" />
                  </Button>
                  <Button onClick={player.togglePlay} className="w-16 h-16 rounded-full bg-white text-black hover:bg-white/90 hover:scale-105 active:scale-95 transition-transform shadow-2xl">
                    {player.isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={player.next} className="w-12 h-12 rounded-2xl hover:bg-white/10 text-white">
                    <SkipForward className="w-6 h-6 fill-current" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    onClick={player.toggleRepeatOne}
                    className={cn("w-11 h-11 rounded-2xl hover:bg-white/10", player.repeatOne ? "text-white" : "text-white/40")}
                    title="Repeat this song"
                  >
                    {player.repeatOne ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Keybinds info modal */}
        <AnimatePresence>
          {showKeybindsInfo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
              onClick={() => setShowKeybindsInfo(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-[#070b19]/95 border border-white/10 p-6 rounded-[32px] shadow-2xl space-y-6 text-white text-left relative"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-black flex items-center gap-2">
                    <Info className="w-5 h-5 text-primary" /> Keyboard shortcuts
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowKeybindsInfo(false)}
                    className="hover:bg-white/5 text-white/80 rounded-xl"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <p className="text-xs text-white/60 font-semibold uppercase tracking-wider">Shortcuts</p>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { key: 'Space', desc: 'Pause or resume' },
                      { key: 'V', desc: 'Timer or music view' },
                      { key: 'P', desc: 'Study tools' },
                      { key: 'Z', desc: 'Hide or show side panels' },
                      { key: 'M', desc: 'Mute music' },
                      { key: 'F', desc: 'Full screen' },
                      { key: '← / →', desc: 'Previous or next song' },
                    ].map((shortcut) => (
                      <div key={shortcut.key} className="flex items-center justify-between p-3.5 bg-white/5 border border-white/5 rounded-2xl">
                        <span className="text-sm font-bold text-white">{shortcut.desc}</span>
                        <kbd className="px-3 py-1 bg-white/10 rounded-xl text-xs font-black uppercase border border-white/10 shadow-sm font-mono text-center min-w-[2.5rem]">
                          {shortcut.key}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (currentStep === 'DONE') {
    // The time actually focused (pauses excluded), which is also what is saved,
    // not the length the session was set to.
    const focusedMinutes = Math.round(secondsFocused / 60);
    const focusedLabel = secondsFocused < 60 ? 'Under a minute' : `${focusedMinutes} ${focusedMinutes === 1 ? 'minute' : 'minutes'}`;
    const goalsTotal = goals.filter((g) => g.trim()).length;
    const goalsDone = goals.filter((g, i) => g.trim() && completedGoals[i]).length;
    const stats = [
      { label: 'Minutes', value: secondsFocused < 60 ? '<1' : focusedMinutes },
      { label: 'XP earned', value: `+${sessionXP}` },
      { label: goalsTotal ? 'Goals done' : 'No goals set', value: goalsTotal ? `${goalsDone}/${goalsTotal}` : '–' },
    ];

    return (
      <div className="flex h-full items-center justify-center overflow-y-auto bg-background px-4 py-10 text-foreground">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-6 rounded-2xl border border-border/60 bg-card p-8 text-center shadow-sm"
        >
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-success/10 text-success">
            <CheckCircle2 className="size-7" />
          </span>
          <div className="space-y-1">
            <h1 className="font-heading text-3xl font-bold tracking-tight">Session complete</h1>
            <p className="text-muted-foreground">
              {focusedLabel} on <span className="font-medium text-foreground">{task.subject}</span>.
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-border/60 bg-background px-2 py-3">
                <dd className="font-heading text-2xl font-black tabular-nums">{s.value}</dd>
                <dt className="mt-0.5 text-xs text-muted-foreground">{s.label}</dt>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" size="lg" className="flex-1 gap-2">
              <Link href="/focus" onClick={() => resetFocus()}>
                <RotateCcw className="size-4" /> Another session
              </Link>
            </Button>
            <Button asChild size="lg" className="flex-1 gap-2">
              <Link href="/" onClick={() => resetFocus()}>
                Back to today <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
}
