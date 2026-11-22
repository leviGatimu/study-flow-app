"use client";

import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Music, Pause, Play, Volume1, Volume2, VolumeX, X } from "lucide-react";

import {
  BREATH_PATTERNS,
  breathPhase,
  CALM_STORAGE,
  loadJson,
  parseYouTubeId,
  saveJson,
  youTubeEmbedUrl,
  type BreathPattern,
} from "@/lib/calm-tools";
import { cn } from "@/lib/utils";

type MusicSetting = { link: string; volume: number };

/**
 * Full-screen breathing room for when the brain is overclocked: a slow
 * breathing circle, a dim moving background, and music from a YouTube link the
 * student pastes. Esc or "I feel better" leaves.
 */
export function CalmRoom({ onClose }: { onClose: () => void }) {
  const [pattern, setPattern] = useState<BreathPattern>(savedPattern);
  // Milliseconds since this pattern started, advanced every animation frame.
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let frame = 0;
    const tick = (time: number) => {
      startRef.current ??= time;
      setElapsed(time - startRef.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const choosePattern = (p: BreathPattern) => {
    setPattern(p);
    startRef.current = null; // the next frame restarts the count
    saveJson(CALM_STORAGE.pattern, p.id);
  };

  const breath = breathPhase(pattern, elapsed);
  // Smooth in/out so the circle never jerks at a step change.
  const eased = 0.5 - Math.cos(Math.PI * breath.size) / 2;
  const scale = 0.55 + eased * 0.45;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Calm room"
      className="calm-room fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#0b1020] text-white"
    >
      <div aria-hidden className={cn("calm-room-bg absolute inset-0", reducedMotion && "calm-room-bg-still")} />

      <header className="relative z-10 flex items-center gap-2 p-4 sm:p-6">
        <div className="flex rounded-full bg-white/10 p-1 text-sm backdrop-blur" role="radiogroup" aria-label="Breathing pattern">
          {BREATH_PATTERNS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={pattern.id === p.id}
              onClick={() => choosePattern(p)}
              className={cn(
                "rounded-full px-3 py-1 text-white/70 transition-colors hover:text-white",
                pattern.id === p.id && "bg-white/20 text-white",
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="ml-auto flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/80 backdrop-blur hover:bg-white/20 hover:text-white"
        >
          <X className="size-4" /> Leave
        </button>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-10 px-6">
        <div className="relative grid size-[min(70vw,22rem)] place-items-center">
          <div
            aria-hidden
            className="absolute inset-0 rounded-full bg-gradient-to-br from-sky-300/40 via-indigo-300/30 to-violet-300/40 blur-2xl"
            style={reducedMotion ? { opacity: 0.35 + eased * 0.5 } : { transform: `scale(${scale * 1.1})` }}
          />
          <div
            aria-hidden
            className="absolute inset-0 rounded-full border border-white/25 bg-white/10 shadow-[0_0_80px_rgba(147,197,253,0.35)] backdrop-blur-sm"
            style={reducedMotion ? { opacity: 0.4 + eased * 0.6 } : { transform: `scale(${scale})` }}
          />
          <div className="relative text-center">
            <p className="text-3xl font-light tracking-wide sm:text-4xl" aria-live="polite">
              {breath.step.label}
            </p>
            <p className="mt-2 text-5xl font-extralight tabular-nums text-white/80">{breath.secondsLeft}</p>
          </div>
        </div>

        <p className="max-w-md text-center text-base text-white/60">
          {breath.rounds === 0
            ? "Follow the circle. Breathe in through your nose, out slowly through your mouth."
            : `${breath.rounds} ${breath.rounds === 1 ? "breath" : "breaths"} done. Keep going as long as you need.`}
        </p>

        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white px-6 py-2.5 text-sm font-medium text-slate-900 shadow-lg hover:bg-white/90"
        >
          I feel better
        </button>
      </main>

      <footer className="relative z-10 flex justify-center p-4 sm:p-6">
        <MusicBar />
      </footer>
    </div>,
    document.body,
  );
}

// Memoised: the room re-renders every animation frame, the player must not.
const MusicBar = memo(function MusicBar() {
  // Only mounted after a click, so reading storage while rendering is safe.
  const [setting, setSetting] = useState<MusicSetting>(savedMusic);
  const [draft, setDraft] = useState(setting.link);
  const [editing, setEditing] = useState(() => !parseYouTubeId(setting.link));
  const [playing, setPlaying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const id = parseYouTubeId(setting.link);

  // The YouTube IFrame API listens for these postMessage commands.
  const command = useCallback((func: string, args: unknown[] = []) => {
    frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
  }, []);

  const save = (next: MusicSetting) => {
    setSetting(next);
    saveJson(CALM_STORAGE.music, next);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) {
      save({ ...setting, link: "" });
      setError(null);
      return;
    }
    if (!parseYouTubeId(draft)) {
      setError("That is not a YouTube link. Copy the address of the video from YouTube and paste it here.");
      return;
    }
    setError(null);
    setPlaying(true);
    setEditing(false);
    save({ ...setting, link: draft.trim() });
  };

  const setVolume = (volume: number) => {
    save({ ...setting, volume });
    command("setVolume", [volume]);
    if (volume > 0) command("unMute");
  };

  const togglePlay = () => {
    command(playing ? "pauseVideo" : "playVideo");
    setPlaying(!playing);
  };

  const VolumeIcon = setting.volume === 0 ? VolumeX : setting.volume < 50 ? Volume1 : Volume2;

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-2">
      {id && (
        // Small and dim in the corner: the music is the point, not the video.
        // YouTube needs a player of about 200 px to keep playing, so it is not hidden.
        <iframe
          ref={frameRef}
          key={id}
          src={youTubeEmbedUrl(id, window.location.origin)}
          title="Calm room music"
          allow="autoplay; encrypted-media"
          className="fixed top-16 right-4 h-[113px] w-[200px] rounded-lg opacity-40 transition-opacity hover:opacity-100 sm:top-20 sm:right-6"
          onLoad={() => {
            // Listening turns the API on; then apply the saved volume.
            frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening" }), "*");
            command("setVolume", [setting.volume]);
            command("playVideo");
          }}
        />
      )}

      {editing || !id ? (
        <form onSubmit={submit} className="flex w-full items-center gap-2 rounded-full bg-white/10 p-1.5 pl-4 backdrop-blur">
          <Music className="size-4 shrink-0 text-white/60" aria-hidden />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste a YouTube link for music"
            aria-label="YouTube link for music"
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/50"
          />
          <button type="submit" className="rounded-full bg-white/90 px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-white">
            Play
          </button>
        </form>
      ) : (
        <div className="flex w-full items-center gap-3 rounded-full bg-white/10 p-1.5 pl-2 backdrop-blur">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Pause music" : "Play music"}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-white/90 text-slate-900 hover:bg-white"
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <VolumeIcon className="size-4 shrink-0 text-white/70" aria-hidden />
          <input
            type="range"
            min={0}
            max={100}
            value={setting.volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label="Music volume"
            className="h-1 min-w-0 flex-1 cursor-pointer accent-white"
          />
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-full px-3 py-1 text-sm text-white/70 hover:bg-white/10 hover:text-white"
          >
            Change song
          </button>
        </div>
      )}
      {error && <p className="text-center text-sm text-rose-200" role="alert">{error}</p>}
      {!error && !id && <p className="text-center text-xs text-white/45">Music is optional. It needs the internet.</p>}
    </div>
  );
});

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useReducedMotion() {
  return useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(REDUCED_MOTION).matches, () => false);
}

function savedPattern(): BreathPattern {
  const saved = loadJson<unknown>(CALM_STORAGE.pattern, BREATH_PATTERNS[0].id);
  return BREATH_PATTERNS.find((p) => p.id === saved) ?? BREATH_PATTERNS[0];
}

function savedMusic(): MusicSetting {
  const saved = loadJson<Partial<MusicSetting> | null>(CALM_STORAGE.music, null);
  const volume = Number.isFinite(saved?.volume) ? Math.min(100, Math.max(0, Number(saved?.volume))) : 60;
  return { link: typeof saved?.link === "string" ? saved.link : "", volume };
}
