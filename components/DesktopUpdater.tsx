"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AlertTriangle, CheckCircle2, Download, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The update control for the desktop build.
 *
 * The app already checks GitHub Releases on launch and every six hours, but a
 * background check is invisible - there was no way to answer "am I on the
 * latest version?" without quitting and hoping. This is that answer, plus the
 * button that acts on it.
 *
 * Every phase here is pushed from the Electron main process (see
 * `desktop-app/main.js`), so the button never guesses: it shows what the
 * updater is actually doing.
 */
type Phase =
  | "unsupported"
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "downloaded"
  | "error";

type UpdateState = {
  phase: Phase;
  version: string | null;
  percent: number;
  message: string | null;
  currentVersion: string;
  supported: boolean;
};

type UpdatesBridge = {
  status: () => Promise<UpdateState>;
  check: () => Promise<UpdateState>;
  install: () => Promise<UpdateState>;
  subscribe: (callback: (state: UpdateState) => void) => () => void;
};

const bridge = (): UpdatesBridge | null => {
  if (typeof window === "undefined") return null;
  return (window as { electron?: { updates?: UpdatesBridge } }).electron?.updates ?? null;
};

const noopSubscribe = () => () => {};

/**
 * True only inside the desktop shell, where preload.js exposes the bridge.
 *
 * Read through useSyncExternalStore because the server has no `window`: it
 * renders false, hydration corrects it, and no effect has to set state.
 */
export function useIsDesktopApp() {
  return useSyncExternalStore(
    noopSubscribe,
    () => bridge() !== null,
    () => false
  );
}

export function DesktopUpdater() {
  const isDesktop = useIsDesktopApp();
  const [state, setState] = useState<UpdateState | null>(null);

  useEffect(() => {
    const api = bridge();
    if (!api) return;

    let alive = true;
    api
      .status()
      .then((current) => {
        if (alive) setState(current);
      })
      .catch(() => {});

    const unsubscribe = api.subscribe((next) => {
      if (alive) setState(next);
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  if (!isDesktop) return null;

  const phase = state?.phase ?? "idle";
  const version = state?.version ?? null;
  const currentVersion = state?.currentVersion ?? "";
  const percent = state?.percent ?? 0;
  const busy = phase === "checking" || phase === "available" || phase === "downloading";

  const summary = () => {
    switch (phase) {
      case "unsupported":
        return "This is a development build - updates are handled by your dev server, not by the updater.";
      case "checking":
        return "Looking for a newer version…";
      case "up-to-date":
        return `Version ${currentVersion} is the latest.`;
      case "available":
        return `Version ${version} found. Downloading it now.`;
      case "downloading":
        return `Downloading version ${version}… ${percent}%`;
      case "downloaded":
        return `Version ${version} is ready. Restart to finish installing it.`;
      case "error":
        return state?.message
          ? `Could not check for updates: ${state.message}`
          : "Could not check for updates.";
      default:
        return currentVersion
          ? `You are on version ${currentVersion}.`
          : "Check whether a newer version is available.";
    }
  };

  const Icon =
    phase === "downloaded"
      ? Download
      : phase === "up-to-date"
        ? CheckCircle2
        : phase === "error"
          ? AlertTriangle
          : RefreshCw;

  const onCheck = () => {
    bridge()
      ?.check()
      .then((next) => setState(next))
      .catch(() => {});
  };

  const onInstall = () => {
    bridge()?.install().catch(() => {});
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon
            className={`size-4 ${
              phase === "error"
                ? "text-destructive"
                : phase === "downloaded" || phase === "up-to-date"
                  ? "text-primary"
                  : "text-muted-foreground"
            } ${phase === "checking" ? "animate-spin" : ""}`}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">Updates</p>
          <p className="text-xs text-muted-foreground">{summary()}</p>
        </div>
      </div>

      {phase === "downloading" && (
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Update download progress"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-[var(--duration-base)] ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      {phase === "downloaded" ? (
        <Button onClick={onInstall} className="h-10 w-full rounded-xl text-sm font-medium">
          Restart and update
        </Button>
      ) : (
        <Button
          onClick={onCheck}
          disabled={busy || phase === "unsupported"}
          variant="outline"
          className="h-10 w-full rounded-xl text-sm font-medium"
        >
          {phase === "checking" ? "Checking…" : busy ? `Downloading… ${percent}%` : "Check for updates"}
        </Button>
      )}
    </div>
  );
}
