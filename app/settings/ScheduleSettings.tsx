"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarRange, Globe, Timer } from "lucide-react";

import { updateCurrentTerm, updateTimezone } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, SettingRow, SettingsPanel, reportError, selectClass, type SettingsData } from "./settings-ui";

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

export function ScheduleSettings({ data }: { data: SettingsData }) {
  return (
    <div className="space-y-6">
      <TimeZonePanel initial={data.progress?.timezone || DEFAULT_TZ} />
      <YearPanel initialTerm={data.currentTerm || "Term 1"} />
      <FocusPresetsPanel />
    </div>
  );
}

function TimeZonePanel({ initial }: { initial: string }) {
  const router = useRouter();
  const [timezone, setTimezone] = useState(initial);
  const [saving, startSaving] = useTransition();
  const options = getTimezoneOptions();

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
          toast.success(`Time zone set to ${readable(next.split("/").pop() ?? next)}.`);
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
    <SettingsPanel
      title="Time zone"
      icon={<Globe />}
      description="Sets your clock and greeting, and which calendar day each task falls on."
    >
      <SettingRow label="Your time zone" htmlFor="settings-timezone" description={saving ? "Saving…" : readable(timezone)}>
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
    </SettingsPanel>
  );
}

function YearPanel({ initialTerm }: { initialTerm: string }) {
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
    <SettingsPanel
      title="Academic year"
      icon={<CalendarRange />}
      description="Your years and terms (start, pause, end, archive) are managed on Year & terms."
      action={
        <Button variant="outline" asChild>
          <Link href="/year">Open Year &amp; terms</Link>
        </Button>
      }
    >
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (changed) save();
        }}
      >
        <Field
          id="settings-academic-term"
          label="Term label on your marks"
          className="flex-1 sm:max-w-sm"
        >
          <Input
            id="settings-academic-term"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="e.g. Term 1"
            className="h-9"
          />
        </Field>
        <Button type="submit" size="lg" disabled={saving || !changed}>
          {saving ? "Saving…" : "Save label"}
        </Button>
      </form>
    </SettingsPanel>
  );
}

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

const noopSubscribe = () => () => {};

function FocusPresetsPanel() {
  // Stored in this browser only; the focus screen reads the same key. Read
  // through useSyncExternalStore so the server render (no localStorage) and
  // the first client render agree.
  const stored = useSyncExternalStore(noopSubscribe, readStoredPresets, () => null);
  const [draft, setDraft] = useState<[number, number, number] | null>(null);
  const presets = draft ?? parsePresets(stored) ?? DEFAULT_PRESETS;

  const setAt = (index: number, value: string) => {
    const next = [...presets] as [number, number, number];
    next[index] = parseInt(value, 10) || 0;
    setDraft(next);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (presets.some((n) => n <= 0 || n > 180)) {
      toast.error("Each duration must be between 1 and 180 minutes.");
      return;
    }
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
      toast.success("Focus durations saved.");
    } catch (error) {
      reportError("save focus presets", error);
      toast.error("This browser would not save the durations. Check that site storage is allowed.");
    }
  };

  const labels = ["Short", "Standard", "Deep"];

  return (
    <SettingsPanel
      title="Focus durations"
      icon={<Timer />}
      description="The three quick-start lengths offered when you start a focus session. Saved on this device."
      action={
        <Button variant="ghost" asChild>
          <Link href="/focus">Open Focus</Link>
        </Button>
      }
    >
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-3 gap-3 sm:max-w-md">
          {labels.map((label, i) => (
            <Field key={label} id={`settings-preset-${i}`} label={`${label} (min)`}>
              <Input
                id={`settings-preset-${i}`}
                type="number"
                inputMode="numeric"
                min={1}
                max={180}
                value={presets[i]}
                onChange={(e) => setAt(i, e.target.value)}
                className="h-9"
              />
            </Field>
          ))}
        </div>
        <Button type="submit" size="lg">
          Save durations
        </Button>
      </form>
    </SettingsPanel>
  );
}
