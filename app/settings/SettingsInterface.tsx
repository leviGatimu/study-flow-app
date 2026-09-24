"use client";

import { useSearchParams } from "next/navigation";
import {
  BrainCircuit,
  CalendarClock,
  Database,
  Palette,
  RefreshCw,
  ShieldAlert,
  User,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Page, PageBody } from "@/components/ui/page";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Label } from "@/components/ui/label";
import { selectClass, type SettingsData } from "./settings-ui";
import { ProfileSettings } from "./ProfileSettings";
import { ScheduleSettings } from "./ScheduleSettings";
import { AISettings } from "./AISettings";
import { AppearanceSettings } from "./AppearanceSettings";
import { SyncSettings } from "./SyncSettings";
import { DataSettings, DangerSettings } from "./DataSettings";

type GroupId = "profile" | "schedule" | "ai" | "appearance" | "sync" | "data" | "danger";

const GROUPS: { id: GroupId; label: string; icon: LucideIcon; description: string }[] = [
  { id: "profile", label: "Profile", icon: User, description: "Your name, password and session, and the way back into setup." },
  { id: "schedule", label: "Schedule & time", icon: CalendarClock, description: "Your time zone, academic year and focus durations." },
  { id: "ai", label: "AI", icon: BrainCircuit, description: "Which AI the app uses, your keys, and the offline model." },
  { id: "appearance", label: "Appearance", icon: Palette, description: "Light or dark." },
  { id: "sync", label: "Sync & apps", icon: RefreshCw, description: "The desktop app, the website, and installing Study Flow." },
  { id: "data", label: "Data & backup", icon: Database, description: "Download a backup, restore one, or check your data." },
  { id: "danger", label: "Danger zone", icon: ShieldAlert, description: "Actions that delete things." },
];

/**
 * Old ?tab= values, so links written before the regroup still land somewhere
 * sensible. `ai` is unchanged: the guided tour and the setup checklist both
 * deep-link to /settings?tab=ai.
 */
const ALIASES: Record<string, GroupId> = {
  account: "profile",
  focus: "schedule",
  about: "sync",
};

function groupFromParam(param: string | null): GroupId {
  if (!param) return "profile";
  if (GROUPS.some((g) => g.id === param)) return param as GroupId;
  return ALIASES[param] ?? "profile";
}

export default function SettingsInterface({ initialData }: { initialData: SettingsData }) {
  // The URL is the state: deep links and the tour open a group, and switching
  // groups rewrites ?tab= without a server round trip (replaceState is
  // observed by useSearchParams), so a reload keeps you where you were.
  const active = groupFromParam(useSearchParams().get("tab"));
  const group = GROUPS.find((g) => g.id === active)!;

  const select = (id: GroupId) => {
    window.history.replaceState(null, "", `?tab=${id}`);
  };

  return (
    <Page>
      <PageHeader
        title="Settings"
        description="Your account, how the app works for you, and your data."
      />
      <PageBody>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          <nav aria-label="Settings groups" className="lg:col-span-3">
            {/* Phone and tablet: one select, so seven groups never wrap or scroll sideways. */}
            <div className="space-y-1.5 lg:hidden">
              <Label htmlFor="settings-group" className="text-xs font-medium text-muted-foreground">
                Settings group
              </Label>
              <select
                id="settings-group"
                value={active}
                onChange={(e) => select(e.target.value as GroupId)}
                className={selectClass}
              >
                {GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>

            <ul className="hidden space-y-1 lg:sticky lg:top-8 lg:block">
              {GROUPS.map((g) => {
                const Icon = g.icon;
                const current = g.id === active;
                return (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => select(g.id)}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        current
                          ? "bg-primary/10 text-primary"
                          : g.id === "danger"
                            ? "text-destructive hover:bg-destructive/5"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      {g.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* data-tour: the guided tour explains here that every AI feature is
              inert until something in this group is filled in. */}
          <div
            className="min-w-0 lg:col-span-9"
            data-tour={active === "ai" ? "settings-ai" : undefined}
          >
            <Section title={group.label} description={group.description}>
              {active === "profile" && <ProfileSettings data={initialData} />}
              {active === "schedule" && <ScheduleSettings data={initialData} />}
              {active === "ai" && <AISettings data={initialData} />}
              {active === "appearance" && <AppearanceSettings />}
              {active === "sync" && <SyncSettings />}
              {active === "data" && <DataSettings />}
              {active === "danger" && <DangerSettings />}
            </Section>
          </div>
        </div>
      </PageBody>
    </Page>
  );
}
