"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, MapPin } from "lucide-react";

import { updateCurrentTerm, updateTimezone } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, SettingRow, SettingsCard, SettingsSection, reportError, selectClass, type SettingsData } from "./settings-ui";
import styles from "./Settings.module.css";
import { subscribeOnMount } from "@/lib/use-client-value";

const DEFAULT_TZ = "Africa/Kigali";
const PRESETS_KEY = "study-flow-focus-presets";
const DEFAULT_PRESETS: [number, number, number] = [25, 50, 90];

// The full IANA list when the runtime has it, otherwise a curated set so the
// picker always works.
function getTimezoneOptions(): string[] {
  try {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf?.("timeZone");
    if (supported && supported.length) return supported;
  } catch {}
  return [
    "Africa/Kigali", "Africa/Nairobi", "Africa/Lagos", "Africa/Cairo", "Africa/Johannesburg",
    "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Moscow",
    "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Sao_Paulo",
    "Asia/Dubai", "Asia/Kolkata", "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney", "UTC",
  ];
}

const readable = (tz: string) => tz.replace(/_/g, " ");
const city = (tz: string) => readable(tz.split("/").pop() ?? tz);

const deviceZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
};

// A minute clock for "14:02 in Kigali". The server renders nothing.
const subscribeMinute = (onChange: () => void) => {
  const timer = window.setInterval(onChange, 15_000);
  return () => window.clearInterval(timer);
};
const minuteSnapshot = () => Math.floor(Date.now() / 60_000);

function localTime(zone: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: zone, weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date());
  } catch {
    return null;
  }
}

export function ScheduleSettings({ data }: { data: SettingsData }) {
  return (
    <SettingsSection
      id="schedule"
      icon={CalendarClock}
      title="Schedule & time"
      description="Your time zone, term label and focus lengths."
    >
      <SettingsCard>
        <TimeZoneRow initial={data.progress?.timezone || DEFAULT_TZ} />
        <TermRow initialTerm={data.currentTerm || "Term 1"} />
        <SettingRow
          id="year-terms"
          label="Year & terms"
          description="Start, pause, end or archive your academic years and terms."
        >
          <Button variant="outline" asChild>
            <Link href="/year">Open Year &amp; terms</Link>
          </Button>
        </SettingRow>
      </SettingsCard>
      <SettingsCard>
        <FocusLengthsRow />
      </SettingsCard>
    </SettingsSection>
  );
}

function TimeZoneRow({ initial }: { initial: string }) {
  const router = useRouter();
  const [timezone, setTimezone] = useState(initial);
  const [saving, startSaving] = useTransition();
  const options = getTimezoneOptions();
  const device = useSyncExternalStore(subscribeOnMount, deviceZone, () => null);
  const minute = useSyncExternalStore(subscribeMinute, minuteSnapshot, () => null);
  const now = minute === null ? null : localTime(timezone);

  const change = (next: string) => {
    const previous = timezone;
    setTimezone(next);
    startSaving(async () => {
      try {
        const res = await updateTimezone(next);
        if (res?.error) {
          setTimezone(previous);
          toast.error(res.error);
        } else {
          toast.success(`Time zone set to ${city(next)}.`);
          router.refresh();
        }
      } catch (error) {
        reportError("update timezone", error);
        setTimezone(previous);
        toast.error("The time zone could not be saved. Check your connection and try again.");
      }
    });
  };

  return (
    <SettingRow
      id="timezone"
      label="Time zone"
      htmlFor="settings-timezone"
      description={
        <>
          Sets your clock and greeting, and which day each task falls on.
          {now && (
            <span className="mt-1 block font-medium text-foreground tabular-nums">
              {saving ? "Saving…" : `It is ${now} in ${city(timezone)}.`}
            </span>
          )}
          {device && device !== timezone && !saving && (
            <span className={styles.notice}>
              <MapPin className="size-4 shrink-0 text-orange-500" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-foreground">This device is set to {readable(device)}.</span>
              <Button size="sm" variant="outline" onClick={() => change(device)}>
                Use {city(device)}
              </Button>
            </span>
          )}
        </>
      }
    >
      <select
        id="settings-timezone"
        value={timezone}
        disabled={saving}
        onChange={(e) => change(e.target.value)}
        className={`${selectClass} sm:w-64`}
      >
        {!options.includes(timezone) && <option value={timezone}>{readable(timezone)}</option>}
        {options.map((tz) => (
          <option key={tz} value={tz}>
            {readable(tz)}
          </option>
        ))}
      </select>
    </SettingRow>
  );
}

function TermRow({ initialTerm }: { initialTerm: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialTerm);
  const [term, setTerm] = useState(initialTerm);
  const [saving, startSaving] = useTransition();
  const changed = term.trim() !== "" && term.trim() !== saved;

  const save = () =>
    startSaving(async () => {
      try {
        const res = await updateCurrentTerm(term.trim());
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        setSaved(term.trim());
        toast.success("Term label saved.");
        router.refresh();
      } catch (error) {
        reportError("update term label", error);
        toast.error("The term label could not be saved. Check your connection and try again.");
      }
    });

  return (
    <SettingRow
      id="term-label"
      label="Term label"
      htmlFor="settings-academic-term"
      description="Shown on your marks, for example “Term 1”."
    >
      <form
        className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (changed) save();
        }}
      >
        <Input
          id="settings-academic-term"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="e.g. Term 1"
          className="h-10 sm:w-64"
        />
        {changed && (
          <Button type="submit" size="lg" disabled={saving} className="h-10">
            {saving ? "Saving…" : "Save"}
          </Button>
        )}
      </form>
    </SettingRow>
  );
}

const PRESETS_EVENT = "study-flow-focus-presets";
const subscribePresets = (onChange: () => void) => {
  window.addEventListener(PRESETS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(PRESETS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
};

function readStoredPresets(): string | null {
  try {
    return localStorage.getItem(PRESETS_KEY);
  } catch {
    return null;
  }
}

function parsePresets(raw: string | null): [number, number, number] | null {
  try {
    const parsed = JSON.parse(raw ?? "null");
    if (Array.isArray(parsed) && parsed.length === 3 && parsed.every((n) => Number.isFinite(n))) {
      return parsed as [number, number, number];
    }
  } catch {}
  return null;
}

const LENGTH_LABELS = ["Short", "Standard", "Deep"] as const;

function FocusLengthsRow() {
  // Stored in this browser only; the focus screen reads the same key. Read
  // through useSyncExternalStore so the server render (no localStorage) and
  // the first client render agree.
  const stored = useSyncExternalStore(subscribePresets, readStoredPresets, () => null);
  const savedPresets = parsePresets(stored) ?? DEFAULT_PRESETS;
  const [draft, setDraft] = useState<[number, number, number] | null>(null);
  const presets = draft ?? savedPresets;
  const changed = draft !== null && draft.some((n, i) => n !== savedPresets[i]);
  const isDefault = presets.every((n, i) => n === DEFAULT_PRESETS[i]);

  const setAt = (index: number, value: string) => {
    const next = [...presets] as [number, number, number];
    next[index] = parseInt(value, 10) || 0;
    setDraft(next);
  };

  const store = (value: [number, number, number], message: string) => {
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(value));
      setDraft(null);
      window.dispatchEvent(new Event(PRESETS_EVENT));
      toast.success(message);
    } catch (error) {
      reportError("save focus presets", error);
      toast.error("This browser would not save the durations. Check that site storage is allowed.");
    }
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (presets.some((n) => n <= 0 || n > 180)) {
      toast.error("Each length must be between 1 and 180 minutes.");
      return;
    }
    store(presets, "Focus lengths saved.");
  };

  return (
    <SettingRow
      id="focus-lengths"
      label="Focus lengths"
      stacked
      description={
        <>
          The three quick-start lengths offered when you start a focus session. Saved on this device.{" "}
          <Link href="/focus" className="font-medium text-primary hover:underline">
            Open Focus
          </Link>
        </>
      }
    >
      <form onSubmit={save} className="mt-1 flex flex-wrap items-end gap-3">
        {LENGTH_LABELS.map((label, i) => (
          <Field key={label} id={`settings-preset-${i}`} label={label} className="w-28">
            <div className={styles.minutes}>
              <Input
                id={`settings-preset-${i}`}
                type="number"
                inputMode="numeric"
                min={1}
                max={180}
                value={presets[i]}
                onChange={(e) => setAt(i, e.target.value)}
                className="h-10"
              />
            </div>
          </Field>
        ))}
        <div className="flex gap-2">
          {changed && (
            <Button type="submit" size="lg" className="h-10">
              Save
            </Button>
          )}
          {!isDefault && (
            <Button type="button" variant="ghost" size="lg" className="h-10" onClick={() => store(DEFAULT_PRESETS, "Focus lengths reset to 25, 50 and 90.")}>
              Reset
            </Button>
          )}
        </div>
      </form>
    </SettingRow>
  );
}
