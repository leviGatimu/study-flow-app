"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Flame, Globe, Sparkles, Trophy } from "lucide-react";

import { cn } from "@/lib/utils";
import { DEFAULT_TIMEZONE, formatTimeZoneLabel } from "@/lib/utils";
import { SafeUserProgress as UserProgress } from "@/lib/types";

/**
 * The always-on stat strip in the app header: streak, all-time best, level/XP
 * and the local clock.
 *
 * These used to be four separately-styled coloured widgets on the dashboard,
 * which meant they were only visible on one page. Here they follow you around
 * the app and cost one line of chrome.
 *
 * Each is a link to the page that explains it, and each carries a title so the
 * label survives even though the strip itself shows only icon + value; a 64px
 * bar has no room for stacked caption text, and stacking it is how the old
 * dashboard ended up shouting.
 */
export function HeaderStats({ progress }: { progress: UserProgress }) {
  return (
    <div className="flex items-center gap-0.5">
      <Stat
        href="/streak"
        label="Day streak"
        icon={<Flame className="size-4 text-orange-500" />}
        value={progress.currentStreak}
        className="hidden md:flex"
        tourId="streak"
      />
      <Stat
        href="/streak"
        label="All-time best"
        icon={<Trophy className="size-4 text-muted-foreground" />}
        value={progress.longestStreak}
        className="hidden 2xl:flex"
      />
      <Stat
        href="/ranks"
        label={`Level ${progress.level}`}
        icon={<Sparkles className="size-4 text-primary" />}
        value={
          <>
            {progress.level}
            <span className="ml-1.5 font-normal text-muted-foreground">
              {progress.xp.toLocaleString()} XP
            </span>
          </>
        }
        className="hidden lg:flex"
      />
      <Clock timezone={progress.timezone} />
    </div>
  );
}

function Stat({
  href,
  label,
  icon,
  value,
  className,
  tourId,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  value: React.ReactNode;
  className?: string;
  /** Anchor for the onboarding tour, when this stat is one of its steps. */
  tourId?: string;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      data-tour={tourId}
      className={cn(
        "items-center gap-1.5 rounded-xl px-2.5 py-1.5 transition-colors hover:bg-muted",
        className
      )}
    >
      {icon}
      <span className="text-sm font-medium whitespace-nowrap text-foreground">
        {value}
      </span>
    </Link>
  );
}

function Clock({ timezone }: { timezone?: string | null }) {
  const zone = timezone || DEFAULT_TIMEZONE;
  const label = formatTimeZoneLabel(zone);
  const [time, setTime] = useState<string | null>(null);

  // Rendered only after mount: the server has no idea what time it is in the
  // user's zone, so painting it during SSR guarantees a hydration mismatch.
  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("en-US", {
          timeZone: zone,
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [zone]);

  return (
    <Link
      href="/time"
      title={`Local time in ${label}`}
      className="hidden items-center gap-1.5 rounded-xl px-2.5 py-1.5 transition-colors hover:bg-muted xl:flex"
    >
      <Globe className="size-4 text-muted-foreground" />
      <span className="text-sm whitespace-nowrap text-muted-foreground">
        {label}
      </span>
      {/* Reserve the width so the strip does not jump when the clock arrives. */}
      <span className="min-w-[4.5rem] text-sm font-medium whitespace-nowrap text-foreground">
        {time ?? ""}
      </span>
    </Link>
  );
}
