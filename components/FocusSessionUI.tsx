'use client';

import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Volume2, VolumeX, Maximize2, Minimize2,
  Play, Pause, Flame, Zap, CheckCircle2,
  ArrowLeft, ListTodo, BookOpen, Plus,
  Clock, ChevronRight, Paperclip, Send, X,
  Music, SkipForward, SkipBack, Info,
  Shuffle, Repeat, Repeat1, ListMusic, Disc3, Timer,
  Upload, Trash2, ImagePlus, Loader2,
  Droplets, PersonStanding, Coffee, CalendarClock, ScrollText,
  ListPlus, Pencil, Check, FolderPlus, RotateCcw,
  Search, Globe, WifiOff, Settings, Palette, ImageIcon, Sparkles,
  Infinity as InfinityIcon, CalendarDays, FolderOpen,
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
import { FocusRing } from '@/components/focus/FocusRing';
import { CLOCK_FONTS, CLOCK_FONT_KEY, clockFontClass, isClockFontId, type ClockFontId } from '@/components/focus/clock-fonts';
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
  { name: 'Aurora', colors: ['#064e3b', '#1e3a8a', '#34d399', '#020617'] },
  { name: 'Ocean', colors: ['#0c4a6e', '#0e7490', '#22d3ee', '#082f49'] },
  { name: 'Lagoon', colors: ['#134e4a', '#0f766e', '#5eead4', '#042f2e'] },
  { name: 'Forest', colors: ['#14532d', '#166534', '#84cc16', '#052e16'] },
  { name: 'Matcha', colors: ['#3f6212', '#4d7c0f', '#bef264', '#1a2e05'] },
  { name: 'Sunset', colors: ['#9a3412', '#be185d', '#fb923c', '#1c0a12'] },
  { name: 'Ember', colors: ['#7c2d12', '#9a3412', '#f97316', '#1c1917'] },
  { name: 'Honey', colors: ['#78350f', '#a16207', '#facc15', '#1c1208'] },
  { name: 'Rose', colors: ['#831843', '#9d174d', '#fb7185', '#1a0a12'] },
  { name: 'Peach', colors: ['#9f1239', '#c2410c', '#fdba74', '#1f0a0a'] },
  { name: 'Candy', colors: ['#86198f', '#be185d', '#f0abfc', '#1a0520'] },
  { name: 'Lavender', colors: ['#4c1d95', '#6d28d9', '#c4b5fd', '#120a24'] },
  { name: 'Grape', colors: ['#581c87', '#701a75', '#e879f9', '#13051c'] },
  { name: 'Sky', colors: ['#1e3a8a', '#0369a1', '#7dd3fc', '#0a1128'] },
  { name: 'Cobalt', colors: ['#1e40af', '#1d4ed8', '#60a5fa', '#050b1f'] },
  { name: 'Wine', colors: ['#4c0519', '#7f1d1d', '#f43f5e', '#0f0306'] },
  { name: 'Coffee', colors: ['#44260f', '#6b3e1e', '#d6a77a', '#140a04'] },
  { name: 'Slate', colors: ['#1e293b', '#334155', '#94a3b8', '#020617'] },
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

/** The lightest colour in a palette, lifted if it is still too dark to see. */
function brightestColour(colors: string[]): string {
  const lum = (hex: string) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return 0;
    const n = parseInt(m[1], 16);
    return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  };
  const best = [...colors].sort((a, b) => lum(b) - lum(a))[0] ?? '#ffffff';
  return lum(best) < 110 ? `color-mix(in srgb, ${best} 45%, white)` : best;
}

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

/** One round button in the focus toolbar. `active` shows a pressed state. */
function BarButton({
  title,
  active,
  tone,
  size = 'bar',
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  tone?: 'ember';
  size?: 'bar' | 'dock';
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'grid shrink-0 place-items-center text-white/65 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
        size === 'dock' ? 'size-12 rounded-[22px] [&_svg]:size-5' : 'size-9 rounded-full [&_svg]:size-[18px]',
        active && (tone === 'ember' ? 'bg-orange-500/25 text-orange-300 hover:bg-orange-500/30 hover:text-orange-200' : 'bg-white/15 text-white')
      )}
    >
      {children}
    </button>
  );
}

/** A tool in the bottom dock: bigger than the top-bar buttons, same behaviour. */
function DockButton(props: React.ComponentProps<typeof BarButton>) {
  return (
    <BarButton {...props} size="dock" />
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
      <CalendarDays className="size-4 text-white/45" />
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
  const [showSessionPanel, setShowSessionPanel] = useState(false);
  const [addingGoal, setAddingGoal] = useState(false);
  const [clockFont, setClockFont] = useState<ClockFontId>('BOLD');
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
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
  // The ring needs a colour that shows up on the dark room: the brightest of the scene.
  const ringAccent = brightestColour(scenePalette);

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
      const font = localStorage.getItem(CLOCK_FONT_KEY);
      if (isClockFontId(font)) setClockFont(font);
      const reminders = localStorage.getItem('study-flow-reminders-on');
      if (reminders === 'false') setRemindersOn(false);
    } catch {
      // Ignore corrupt preferences.
    }
  }, []);

  const chooseClockFont = (id: ClockFontId) => {
    setClockFont(id);
    try { localStorage.setItem(CLOCK_FONT_KEY, id); } catch {}
  };

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

  /**
   * Notes and a PDF are optional. The session itself is what proves the block
   * was studied: it is saved and the block ticked off whatever happens to the
   * notes. Requiring them used to mean that closing this form saved nothing,
   * and the block was then marked missed at its end time.
   */
  const handleFinishWithProof = async () => {
    setIsFinishing(true);
    try {
      const hasNotes = proofDescription.trim() !== '' || proofFile !== null;
      if (task.id !== 'free' && hasNotes) {
        const formData = new FormData();
        formData.append('taskId', task.id);
        formData.append('description', proofDescription);
        if (proofFile) formData.append('file', proofFile);
        try {
          const result = await updateTaskProof(formData);
          if (result && 'error' in result) {
            toast.error('Your notes were not saved', { description: `${result.error} Your session is still saved.` });
          }
        } catch {
          toast.error('Your notes were not saved', { description: 'Your session is still saved.' });
        }
      }
    } finally {
      await handleSessionComplete();
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
        case 'KeyD':
          e.preventDefault();
          setShowSessionPanel(prev => !prev);
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
        {/* Music view: the cover, blurred, fills the room */}
        {viewMode === 'SONG' && currentSong?.coverUrl && bgMode !== 'PHOTO' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentSong.coverUrl}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 size-full scale-125 object-cover opacity-45"
            style={{ filter: 'blur(70px) saturate(1.3)' }}
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
                <p className="text-sm font-semibold leading-tight">
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
                className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl"
                style={{ background: `linear-gradient(135deg, ${BREAK_PALETTE[0]}, ${BREAK_PALETTE[1]})` }}
              >
                <Coffee className="w-12 h-12 text-white" />
              </div>
              <div className="text-center space-y-3">
                <h2 className="text-5xl md:text-6xl font-heading font-semibold tracking-tight drop-shadow-xl">Break</h2>
                <p className="text-base font-bold text-white/60">
                  Stand up, look away from the screen, have some water.
                </p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <p className="text-[11px] font-semibold text-white/40">Back to work in</p>
                <p className="text-6xl font-heading font-semibold tabular-nums drop-shadow-xl" style={{ color: BREAK_PALETTE[2] }}>
                  {formatTime(breakRemainingSeconds)}
                </p>
              </div>
              <p className="text-xs font-bold text-white/30">
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
              className="absolute inset-4 z-50 rounded-3xl border-2 border-dashed border-white/50 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center gap-4 pointer-events-none"
            >
              <Upload className="w-16 h-16 text-white/80" />
              <p className="text-2xl font-heading font-semibold">Drop songs to add them to your music</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top bar: leave + session facts on the left, a few window controls on the right. */}
        <div className="relative z-20 flex shrink-0 items-center justify-between gap-3 px-4 py-4 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/"
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-black/25 pl-3 pr-4 text-sm font-medium text-white/80 backdrop-blur-xl transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <ArrowLeft className="size-4" /> Leave
            </Link>
            <div className="hidden h-10 items-center gap-3 rounded-full border border-white/10 bg-black/25 px-4 text-sm text-white/70 backdrop-blur-xl md:flex">
              <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-white">
                <Flame className={cn('size-4 text-orange-400', isIntense && 'fill-orange-400')} /> {sessionXP} XP
              </span>
              <span aria-hidden className="h-4 w-px bg-white/15" />
              <NowClock className="flex items-center gap-2 tabular-nums" />
            </div>
          </div>

          {viewMode === 'SONG' && (
            <button
              type="button"
              onClick={() => setViewMode('TIMER')}
              title="Back to the timer (V)"
              className="hidden h-10 items-center gap-2 rounded-full border border-white/10 bg-black/25 px-4 text-sm backdrop-blur-xl transition-colors hover:bg-white/10 sm:inline-flex"
            >
              <span className={cn('size-1.5 rounded-full', isPaused ? 'bg-amber-400' : 'bg-emerald-400 motion-safe:animate-pulse')} />
              <span className="font-semibold tabular-nums">
                {timeLeft.h > 0 && `${timeLeft.h}:`}{String(timeLeft.m).padStart(2, '0')}:{String(timeLeft.s).padStart(2, '0')}
              </span>
              <span className="max-w-[10rem] truncate text-white/60">{task.subject}</span>
            </button>
          )}

          <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-black/25 p-1 backdrop-blur-xl">
            {typeof window !== 'undefined' && 'electron' in window && (
              <BarButton
                title="Small always-on-top window"
                onClick={() => {
                  (window as any).electron.send('enter-widget', { taskId: task.id });
                }}
              >
                <Minimize2 />
              </BarButton>
            )}
            <BarButton title="Keyboard shortcuts" active={showKeybindsInfo} onClick={() => setShowKeybindsInfo(!showKeybindsInfo)}>
              <Info />
            </BarButton>
            <BarButton title="Focus settings" active={showSettings} onClick={() => setShowSettings(true)}>
              <Settings />
            </BarButton>
            <BarButton title="Full screen (F)" onClick={toggleFullscreen}>
              <Maximize2 />
            </BarButton>
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
                    <h3 className="text-lg font-heading font-semibold tracking-tight">Focus settings</h3>
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
                    <h4 className="text-xs font-semibold text-white/40 flex items-center gap-2">
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
                              ? 'bg-white/10 border-white/60 text-white'
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
                            <span className="text-xs font-semibold text-white/30">Shown slightly blurred so the timer stays readable</span>
                          </button>
                        )}
                      </div>
                    )}

                    {bgMode !== 'PHOTO' && (
                      <div className="grid grid-cols-5 gap-x-2 gap-y-3">
                        {PRESET_BG_PALETTES.map((p) => {
                          const selected = bgMode === 'CUSTOM' && p.colors.every((c, i) => customPalette[i] === c);
                          return (
                            <button
                              key={p.name}
                              type="button"
                              onClick={() => applyPresetPalette(p.colors)}
                              aria-pressed={selected}
                              className="group flex flex-col items-center gap-1.5 focus-visible:outline-none"
                            >
                              <span
                                className={cn(
                                  'size-11 rounded-full ring-2 ring-offset-2 ring-offset-zinc-950 transition-transform group-hover:scale-105 group-focus-visible:ring-white/60',
                                  selected ? 'ring-white' : 'ring-transparent'
                                )}
                                style={{ background: `radial-gradient(circle at 30% 25%, ${p.colors[2]}, ${p.colors[1]} 45%, ${p.colors[0]} 70%, ${p.colors[3]})` }}
                              />
                              <span className={cn('text-[11px]', selected ? 'text-white' : 'text-white/50')}>{p.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {bgMode === 'CUSTOM' && (
                      <div className="space-y-4">
                        <p className="text-xs text-white/45">Or mix your own:</p>
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
                              <span className="text-[11px] font-bold text-white/30">
                                {i === 0 ? 'Base' : i === 3 ? 'Deep' : `Tone ${i}`}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>

                  {/* ---- Clock font ---- */}
                  <section className="space-y-3">
                    <h4 className="text-sm font-semibold text-white/85 flex items-center gap-2">
                      <Timer className="size-4 text-white/45" /> Clock
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {CLOCK_FONTS.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => chooseClockFont(f.id)}
                          aria-pressed={clockFont === f.id}
                          className={cn(
                            'flex flex-col items-center gap-1 rounded-2xl border py-3 transition-colors',
                            clockFont === f.id ? 'border-white/60 bg-white/10' : 'border-white/10 bg-white/[0.04] hover:bg-white/10'
                          )}
                        >
                          <span className={cn('text-2xl leading-none text-white', f.className)}>25:00</span>
                          <span className="text-xs text-white/55">{f.label}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* ---- Break Cycle ---- */}
                  <section className="space-y-4">
                    <h4 className="text-xs font-semibold text-white/40 flex items-center gap-2">
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
                                ? 'bg-white/10 border-white/60 text-white'
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
                        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
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
        {viewMode === 'TIMER' ? (
          /* ---------- TIMER VIEW: the ring, then your goals ---------- */
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-4">
            <motion.div
              animate={{ scale: isPaused ? 0.98 : 1 }}
              transition={{ duration: 0.4 }}
            >
              <FocusRing
                time={timeLeft}
                fraction={elapsedFraction}
                paused={isPaused}
                accent={ringAccent}
                fontClass={clockFontClass(clockFont)}
                subject={task.subject}
                status={isPaused ? 'Paused' : onBreak ? 'Break' : isIntense ? 'Deep focus' : 'Focusing'}
                detail={isPaused ? 'Space to carry on' : openEnded ? 'no set length' : `${initialDurationMinutes} min`}
              />
            </motion.div>

            {/* Goals */}
            <div className="mt-6 flex max-w-2xl flex-wrap items-center justify-center gap-2">
              {goals.map((goal, i) =>
                goal.trim() ? (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleGoal(i)}
                    aria-pressed={!!completedGoals[i]}
                    className={cn(
                      'inline-flex max-w-full items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-4 text-sm backdrop-blur-xl transition-colors',
                      completedGoals[i]
                        ? 'border-white/5 bg-black/15 text-white/45'
                        : 'border-white/10 bg-black/25 text-white hover:bg-white/10'
                    )}
                  >
                    <span
                      className={cn(
                        'grid size-5 shrink-0 place-items-center rounded-full border',
                        completedGoals[i] ? 'border-emerald-400 bg-emerald-400' : 'border-white/35'
                      )}
                    >
                      {completedGoals[i] && <Check className="size-3 text-black" strokeWidth={3} />}
                    </span>
                    <span className={cn('truncate', completedGoals[i] && 'line-through')}>{goal}</span>
                  </button>
                ) : null
              )}
              {addingGoal ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const text = newGoalInput.trim();
                    if (text) {
                      setGoals([...goals, text]);
                      setCompletedGoals([...completedGoals, false]);
                    }
                    setNewGoalInput('');
                    setAddingGoal(false);
                  }}
                >
                  <input
                    autoFocus
                    value={newGoalInput}
                    onChange={(e) => setNewGoalInput(e.target.value)}
                    onBlur={() => { if (!newGoalInput.trim()) setAddingGoal(false); }}
                    onKeyDown={(e) => { if (e.key === 'Escape') { setNewGoalInput(''); setAddingGoal(false); } }}
                    placeholder="What will you get done?"
                    aria-label="New goal"
                    className="h-9 w-64 rounded-full border border-white/20 bg-black/30 px-4 text-sm text-white outline-none backdrop-blur-xl placeholder:text-white/40 focus:border-white/40"
                  />
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingGoal(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-white/25 px-4 text-sm text-white/65 transition-colors hover:border-white/45 hover:text-white"
                >
                  <Plus className="size-4" /> {goals.some((g) => g.trim()) ? 'Add a goal' : 'Add a goal for this session'}
                </button>
              )}
            </div>
          </div>
        ) : (
          /* ---------- MUSIC VIEW ---------- */
          <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar">
            {!hasSongs ? (
              <div className="flex h-full flex-col items-center justify-center px-6">
                <div className="w-full max-w-md space-y-5 rounded-3xl border border-white/10 bg-black/30 p-10 text-center backdrop-blur-xl">
                  <div className="mx-auto grid size-20 place-items-center rounded-3xl" style={{ background: `linear-gradient(135deg, ${palette[0]}, ${palette[2]})` }}>
                    <Music className="size-9 text-white" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="font-heading text-2xl font-semibold">Add music for your sessions</h2>
                    <p className="text-sm text-white/55">
                      Add your own songs or find some online. The background takes its colours from each cover.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button onClick={() => uploadInputRef.current?.click()} className="h-11 gap-2 rounded-full bg-white px-6 font-semibold text-black hover:bg-white/90">
                      <Upload className="size-4" /> Add songs
                    </Button>
                    <Button
                      onClick={() => { setLibraryTab('ONLINE'); setIsLibraryOpen(true); }}
                      variant="ghost"
                      className="h-11 gap-2 rounded-full border border-white/15 px-6 text-white hover:bg-white/10"
                    >
                      <Globe className="size-4" /> Find online
                    </Button>
                  </div>
                  <p className="text-xs text-white/40">Or drag audio files anywhere on this screen.</p>
                </div>
              </div>
            ) : (
              <div className="mx-auto grid min-h-full w-full max-w-6xl grid-cols-1 items-center gap-10 px-6 py-2 md:px-10 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-14">
                {/* Now playing */}
                <div className="mx-auto flex w-full max-w-[min(380px,44vh)] flex-col gap-4 lg:max-w-[min(380px,44vh)]">
                  <motion.div
                    key={currentSong?.id}
                    initial={{ opacity: 0.6, scale: 0.97 }}
                    animate={{ opacity: 1, scale: player.isPlaying ? 1 : 0.95 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 24 }}
                    className="group/cover relative aspect-square w-full overflow-hidden rounded-3xl ring-1 ring-white/10"
                    style={{ boxShadow: `0 30px 80px -20px ${palette[2]}66, 0 20px 50px -20px rgba(0,0,0,0.8)` }}
                  >
                    <CoverArt song={currentSong} palette={palette} className="size-full" iconSize="w-20 h-20" />
                    <button
                      type="button"
                      onClick={() => setImmersiveCover(true)}
                      className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white opacity-0 backdrop-blur-md transition-opacity hover:bg-black/70 focus-visible:opacity-100 group-hover/cover:opacity-100"
                    >
                      <Maximize2 className="size-3.5" /> Full screen
                    </button>
                  </motion.div>

                  <div className="min-w-0">
                    <h2 className="truncate font-heading text-2xl font-semibold leading-tight md:text-3xl">{currentSong?.title}</h2>
                    <p className="truncate text-base text-white/60">{currentSong?.artist || 'Unknown artist'}</p>
                  </div>

                  <div className="space-y-1.5">
                    <Slider
                      value={[Math.min(player.currentTime, player.duration || player.currentTime)]}
                      max={player.duration || 1}
                      min={0}
                      step={1}
                      onValueChange={(v) => player.seek(v[0])}
                      aria-label="Song position"
                      className="cursor-pointer py-1 [&_[data-slot=slider-range]]:bg-white [&_[data-slot=slider-track]]:bg-white/15 [&_[data-slot=slider-thumb]]:border-white"
                    />
                    <div className="flex justify-between text-xs tabular-nums text-white/45">
                      <span>{formatTime(player.currentTime)}</span>
                      <span>-{formatTime(Math.max(0, (player.duration || 0) - player.currentTime))}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={player.toggleShuffle}
                      title="Shuffle"
                      aria-pressed={player.shuffle}
                      className={cn('grid size-10 place-items-center rounded-full transition-colors hover:bg-white/10', player.shuffle ? 'text-white' : 'text-white/40')}
                    >
                      <Shuffle className="size-5" />
                    </button>
                    <button type="button" onClick={player.prev} title="Previous (←)" className="grid size-12 place-items-center rounded-full text-white transition-colors hover:bg-white/10">
                      <SkipBack className="size-6 fill-current" />
                    </button>
                    <button
                      type="button"
                      onClick={player.togglePlay}
                      title={player.isPlaying ? 'Pause music' : 'Play music'}
                      className="grid size-16 place-items-center rounded-full bg-white text-black shadow-2xl transition-transform hover:scale-105 active:scale-95"
                    >
                      {player.isPlaying ? <Pause className="size-7 fill-current" /> : <Play className="ml-1 size-7 fill-current" />}
                    </button>
                    <button type="button" onClick={player.next} title="Next (→)" className="grid size-12 place-items-center rounded-full text-white transition-colors hover:bg-white/10">
                      <SkipForward className="size-6 fill-current" />
                    </button>
                    <button
                      type="button"
                      onClick={player.toggleRepeatOne}
                      title="Repeat this song"
                      aria-pressed={player.repeatOne}
                      className={cn('grid size-10 place-items-center rounded-full transition-colors hover:bg-white/10', player.repeatOne ? 'text-white' : 'text-white/40')}
                    >
                      {player.repeatOne ? <Repeat1 className="size-5" /> : <Repeat className="size-5" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setIsMuted(!isMuted)} title="Mute (M)" className="text-white/50 transition-colors hover:text-white">
                      {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                    </button>
                    <Slider
                      value={[isMuted ? 0 : volume]}
                      max={1} min={0} step={0.01}
                      onValueChange={(v) => {
                        setVolume(v[0]);
                        if (isMuted && v[0] > 0) setIsMuted(false);
                      }}
                      aria-label="Volume"
                      className="w-full cursor-pointer py-1 [&_[data-slot=slider-range]]:bg-white [&_[data-slot=slider-track]]:bg-white/15 [&_[data-slot=slider-thumb]]:border-white"
                    />
                  </div>
                </div>

                {/* Lyrics / Up next */}
                <div className="flex min-h-[50vh] w-full flex-col rounded-3xl border border-white/10 bg-black/25 p-2 backdrop-blur-xl lg:h-[min(64vh,600px)]">
                  <div className="flex shrink-0 items-center justify-between gap-2 p-2">
                    <div className="flex items-center gap-1 rounded-full bg-white/[0.06] p-1">
                      {([
                        { id: 'LYRICS', label: 'Lyrics', icon: ScrollText },
                        { id: 'QUEUE', label: 'Up next', icon: ListMusic },
                      ] as const).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSongPanelTab(t.id)}
                          aria-pressed={songPanelTab === t.id}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                            songPanelTab === t.id ? 'bg-white text-black' : 'text-white/60 hover:text-white'
                          )}
                        >
                          <t.icon className="size-3.5" /> {t.label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsLibraryOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <ListMusic className="size-4" /> Library
                    </button>
                  </div>

                  {songPanelTab === 'LYRICS' ? (
                    player.lyrics ? (
                      <div className="relative min-h-0 flex-1">
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
                      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
                        <ScrollText className="size-8 text-white/25" />
                        <p className="text-sm text-white/45">No lyrics for this song yet. They show up here when they are found.</p>
                      </div>
                    )
                  ) : (
                    <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto custom-scrollbar px-1 pb-1">
                      {currentSong && (
                        <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-2">
                          <CoverArt song={currentSong} palette={palette} className="size-11 shrink-0 rounded-xl" iconSize="w-4 h-4" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{currentSong.title}</p>
                            <p className="truncate text-xs text-white/50">Playing now</p>
                          </div>
                        </div>
                      )}
                      {player.upNext.length === 0 ? (
                        <p className="py-8 text-center text-sm text-white/40">Nothing after this one. Add more songs from the library.</p>
                      ) : (
                        player.upNext.map((song) => (
                          <button
                            key={song.id}
                            type="button"
                            onClick={() => player.selectSong(song.id)}
                            className="group flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-white/10"
                          >
                            <CoverArt song={song} palette={palette} className="size-11 shrink-0 rounded-xl" iconSize="w-4 h-4" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{song.title}</p>
                              <p className="truncate text-xs text-white/50">{song.artist || 'Unknown artist'}</p>
                            </div>
                            {song.duration ? (
                              <span className="text-xs tabular-nums text-white/40 group-hover:text-white/70">{formatTime(song.duration)}</span>
                            ) : null}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============ DOCK: music, pause, finish, tools ============ */}
        <div className="relative z-20 flex shrink-0 justify-center px-3 pb-5 pt-2">
          {!showProofForm ? (
            <div className="flex max-w-full items-center gap-1.5 rounded-[28px] border border-white/10 bg-black/35 p-1.5 shadow-2xl backdrop-blur-2xl">
              {viewMode === 'TIMER' && (
                <>
                  {currentSong ? (
                    <div className="hidden min-w-0 items-center gap-2.5 pl-1 pr-1 md:flex md:w-[250px]">
                      <button type="button" onClick={() => setViewMode('SONG')} title="Music view (V)" className="shrink-0">
                        <CoverArt song={currentSong} palette={palette} className="size-11 rounded-2xl" iconSize="w-4 h-4" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{currentSong.title}</p>
                        <p className="truncate text-xs text-white/50">{currentSong.artist || 'Unknown artist'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={player.togglePlay}
                        title={player.isPlaying ? 'Pause music' : 'Play music'}
                        className="grid size-9 shrink-0 place-items-center rounded-full text-white transition-colors hover:bg-white/10"
                      >
                        {player.isPlaying ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
                      </button>
                      <button type="button" onClick={player.next} title="Next song (→)" className="grid size-9 shrink-0 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white">
                        <SkipForward className="size-4 fill-current" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsLibraryOpen(true)}
                      className="hidden h-12 items-center gap-2 rounded-[22px] px-4 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white md:inline-flex"
                    >
                      <Music className="size-4" /> Add music
                    </button>
                  )}
                  <span aria-hidden className="mx-1 hidden h-8 w-px bg-white/10 md:block" />
                </>
              )}

              <button
                type="button"
                onClick={() => isPaused ? resumeFocus() : pauseFocus()}
                title={isPaused ? 'Carry on (Space)' : 'Pause (Space)'}
                aria-label={isPaused ? 'Carry on' : 'Pause'}
                className={cn(
                  'grid size-12 shrink-0 place-items-center rounded-[22px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                  isPaused ? 'bg-emerald-400 text-black hover:bg-emerald-300' : 'bg-white/10 text-white hover:bg-white/20'
                )}
              >
                {isPaused ? <Play className="size-5 fill-current" /> : <Pause className="size-5 fill-current" />}
              </button>
              <Button
                onClick={() => setShowProofForm(true)}
                className="h-12 shrink-0 gap-2 rounded-[22px] bg-white px-5 text-base font-semibold text-black hover:bg-white/90"
              >
                <CheckCircle2 className="size-5" />
                Finish
              </Button>

              <span aria-hidden className="mx-1 h-8 w-px bg-white/10" />

              <DockButton
                title={intensity === 'INTENSE' ? 'Deep focus is on (double XP). Turn off' : 'Deep focus: double XP'}
                active={intensity === 'INTENSE'}
                tone="ember"
                onClick={() => setIntensity(intensity === 'INTENSE' ? 'CHILL' : 'INTENSE')}
              >
                <Zap />
              </DockButton>
              <DockButton title="Files and later today (D)" active={showSessionPanel} onClick={() => setShowSessionPanel(v => !v)}>
                <FolderOpen />
              </DockButton>
              <DockButton
                title={viewMode === 'TIMER' ? 'Music view (V)' : 'Timer view (V)'}
                active={viewMode === 'SONG'}
                onClick={() => setViewMode(viewMode === 'TIMER' ? 'SONG' : 'TIMER')}
              >
                {viewMode === 'TIMER' ? <Disc3 /> : <Timer />}
              </DockButton>
              <DockButton title="Music library" active={isLibraryOpen} onClick={() => setIsLibraryOpen(!isLibraryOpen)}>
                <ListMusic />
              </DockButton>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-xl w-full rounded-3xl border border-white/10 bg-zinc-950/85 p-6 space-y-5 shadow-2xl backdrop-blur-xl text-left"
            >
              <div className="flex justify-between items-center">
                 <h3 className="font-heading text-lg font-semibold">What did you get done?</h3>
                 <Button variant="ghost" size="icon" onClick={() => setShowProofForm(false)} className="hover:bg-white/5 text-white/80" aria-label="Back to the session">
                   <X className="w-5 h-5" />
                 </Button>
              </div>

              <div className="space-y-4">
                 <Textarea
                   placeholder="Optional: a sentence about what you worked on."
                   value={proofDescription}
                   onChange={(e) => setProofDescription(e.target.value)}
                   className="min-h-[96px] rounded-2xl border-white/10 bg-white/[0.06] text-white placeholder:text-white/35"
                 />

                 <div className="flex flex-col sm:flex-row gap-3">
                    <label className="flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 transition-colors hover:bg-white/10">
                       <Paperclip className="size-4 text-white/60" />
                       <span className="truncate text-sm font-medium">
                         {proofFile ? proofFile.name : 'Attach a PDF (optional)'}
                       </span>
                       <input
                         type="file"
                         accept=".pdf"
                         className="hidden"
                         onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                       />
                    </label>

                    <Button
                      disabled={isFinishing}
                      onClick={handleFinishWithProof}
                      className="h-12 gap-2 rounded-full bg-white px-6 font-semibold text-black hover:bg-white/90"
                    >
                       {isFinishing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                       Finish session
                    </Button>
                 </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* ============ SESSION DRAWER: files + later today ============ */}
        <AnimatePresence>
          {showSessionPanel && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-40 bg-black/30"
                onClick={() => setShowSessionPanel(false)}
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', stiffness: 320, damping: 34 }}
                aria-label="This session"
                className="absolute inset-y-0 left-0 z-50 flex w-full max-w-[380px] flex-col border-r border-white/10 bg-zinc-950/85 shadow-2xl backdrop-blur-2xl"
              >
                <div className="flex shrink-0 items-start justify-between gap-3 px-6 pb-4 pt-6">
                  <div className="min-w-0">
                    <p className="text-sm text-white/50">{typeLabel}{isScheduled ? ` · ${task.startTime}–${task.endTime}` : ''}</p>
                    <h3 className="truncate font-heading text-2xl font-semibold">{task.subject}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSessionPanel(false)}
                    aria-label="Close"
                    className="grid size-9 shrink-0 place-items-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                <div className="flex-1 space-y-7 overflow-y-auto custom-scrollbar px-4 pb-6">
                  <section className="space-y-2">
                    <h4 className="flex items-center gap-2 px-2 text-sm font-semibold text-white/85">
                      <BookOpen className="size-4 text-white/45" /> Files
                    </h4>
                    {resources.length === 0 ? (
                      <p className="px-2 py-2 text-sm text-white/45">No files for this subject yet. Add them in Resources.</p>
                    ) : (
                      <div className="space-y-0.5">
                        {resources.map((res) => (
                          <a
                            key={res.id}
                            href={res.url}
                            target="_blank"
                            rel="noreferrer"
                            className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/10"
                          >
                            <span className="truncate text-sm font-medium">{res.title}</span>
                            <ChevronRight className="size-4 shrink-0 text-white/35 transition-transform group-hover:translate-x-0.5" />
                          </a>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="space-y-2">
                    <h4 className="flex items-center gap-2 px-2 text-sm font-semibold text-white/85">
                      <CalendarClock className="size-4 text-white/45" /> Later today
                    </h4>
                    {nextSessions.length === 0 ? (
                      <p className="px-2 py-2 text-sm text-white/45">Nothing else planned today.</p>
                    ) : (
                      <div className="space-y-0.5">
                        {nextSessions.map((next) => (
                          <Link
                            key={next.id}
                            href={`/focus/${next.id}`}
                            className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/10"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{next.subject}</p>
                              <p className="text-xs text-white/45">{next.type === 'REVISION' ? 'Revision' : 'Homework'}</p>
                            </div>
                            <span className="shrink-0 text-sm tabular-nums text-white/60 group-hover:text-white">{next.startTime}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

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
              className="absolute inset-y-0 right-0 z-50 flex w-full max-w-[400px] flex-col overflow-hidden border-l border-white/10 bg-zinc-950/85 shadow-2xl backdrop-blur-2xl"
            >
              <div className="p-6 pb-4 flex items-center justify-between shrink-0">
                <h3 className="font-heading text-2xl font-semibold">Music</h3>
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
                        'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold transition-colors',
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
                  className="w-full h-12 rounded-2xl bg-white text-black hover:bg-white/90 font-semibold gap-2"
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
                  <span className="text-xs font-semibold text-white/40">Playlists</span>
                  <button
                    onClick={() => { setNewPlaylistOpen(o => !o); setNewPlaylistName(''); }}
                    className="text-xs font-semibold text-white/50 hover:text-white flex items-center gap-1"
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
                      "px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors",
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
                              className="bg-transparent outline-none text-[11px] font-semibold px-3 py-1.5 w-24"
                            />
                          </form>
                        ) : (
                          <>
                            <button onClick={() => player.selectPlaylist(pl.id)} className="pl-3 pr-1 py-1.5 text-[11px] font-semibold max-w-[120px] truncate">
                              {pl.name}
                            </button>
                            <span className={cn("text-xs font-bold pr-1.5", active ? "text-black/40" : "text-white/30")}>{pl.songIds.length}</span>
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
                            <span className="text-xs font-semibold text-white/40">Add to playlist</span>
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
                          <p className="px-2 py-1.5 text-xs font-semibold text-white/40">Popular now</p>
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
                  <span className="text-sm font-semibold tabular-nums">
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
                  <h2 className="text-4xl md:text-6xl lg:text-7xl font-heading font-semibold tracking-tight drop-shadow-2xl truncate">{currentSong.title}</h2>
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
                className="w-full max-w-md bg-[#070b19]/95 border border-white/10 p-6 rounded-3xl shadow-2xl space-y-6 text-white text-left relative"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-semibold flex items-center gap-2">
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
                  <p className="text-xs text-white/60 font-semibold">Shortcuts</p>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { key: 'Space', desc: 'Pause or resume' },
                      { key: 'V', desc: 'Timer or music view' },
                      { key: 'D', desc: 'Files and later today' },
                      { key: 'M', desc: 'Mute music' },
                      { key: 'F', desc: 'Full screen' },
                      { key: '← / →', desc: 'Previous or next song' },
                    ].map((shortcut) => (
                      <div key={shortcut.key} className="flex items-center justify-between p-3.5 bg-white/5 border border-white/5 rounded-2xl">
                        <span className="text-sm font-bold text-white">{shortcut.desc}</span>
                        <kbd className="px-3 py-1 bg-white/10 rounded-xl text-xs font-semibold uppercase border border-white/10 shadow-sm font-mono text-center min-w-[2.5rem]">
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
