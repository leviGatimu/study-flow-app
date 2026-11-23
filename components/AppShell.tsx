'use client';

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

import { Sidebar } from "@/components/Sidebar";
import { AppHeader } from "@/components/AppHeader";
import { MobileTabBar } from "@/components/MobileTabBar";
import { CommandMenu } from "@/components/CommandMenu";
import { SyncWatcher } from "@/components/SyncWatcher";
import { PresencePing } from '@/components/PresencePing';
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { ArchiveBanner } from "@/components/ArchiveBanner";
import { ArchiveProvider, MentorProvider, type ArchiveView, type MentorView } from "@/components/ArchiveContext";
import { MentorBanner } from "@/components/MentorBanner";
import { SafeUserProgress as UserProgress } from "@/lib/types";
import { isBareRoute } from "@/lib/nav";
import { BirthdayMode } from "@/components/birthday/BirthdayMode";
import { DEFAULT_TIMEZONE } from "@/lib/utils";

// Client-only: it lives in this device's localStorage, which the server cannot see.
const CalmToolbar = dynamic(() => import("@/components/calm/CalmToolbar").then((m) => m.CalmToolbar), { ssr: false });

/**
 * The app frame: a fixed sidebar and header around a single scrolling content
 * region. Only the content region scrolls, so the chrome stays put and the
 * page never shifts under you on navigation.
 */
export function AppShell({
  children,
  userProgress,
  subjects,
  archive = null,
  mentor = null,
  isAdmin = false,
}: {
  children: React.ReactNode;
  userProgress: UserProgress | null;
  subjects: { id: string; name: string }[];
  /** Set while a finished year is open; null in the normal case. */
  archive?: ArchiveView;
  /** Set when a mentor is looking at this account read-only. */
  mentor?: MentorView;
  /** Shows the admin console in the sidebar. Nobody else learns it exists. */
  isAdmin?: boolean;
}) {
  const pathname = usePathname();

  // The Electron mini widget is its own tiny always-on-top window, and the
  // auth/marketing pages own their full canvas: both render bare.
  if (isBareRoute(pathname)) {
    return <div className="h-full w-full">{children}</div>;
  }

  return (
    <ArchiveProvider value={archive}>
     <MentorProvider value={mentor}>
      <div className="flex h-full w-full">
        {/* A mentor gets no tour, and must not mark the student "last seen". */}
        {!mentor && <OnboardingTour hasOnboarded={!!userProgress?.onboardedAt} />}
        <CommandMenu />
        {/* Bottom-right calm tools. A mentor is only looking, so not for them. */}
        {!mentor && <CalmToolbar />}
        {/* Headless. Watches for work arriving from another device, refreshes
            the page under you and says so. Does nothing on the web build. */}
        {!mentor && <SyncWatcher />}
        {!mentor && <PresencePing />}
        {!mentor && <BirthdayMode birthday={userProgress?.birthday} timezone={userProgress?.timezone || DEFAULT_TIMEZONE} />}

        <Sidebar userProgress={userProgress} isAdmin={isAdmin && !mentor} />

        {/* The sidebar and header are one frame (bg-sidebar); the page sits in it
            as a panel with a rounded top-left corner where the two meet. */}
        <div className="flex min-w-0 flex-1 flex-col bg-sidebar">
          <AppHeader userProgress={userProgress} subjects={subjects} />
          {/* Outside <main>, so it cannot scroll out of sight. */}
          {mentor ? <MentorBanner mentor={mentor} /> : <ArchiveBanner />}
          <main className="app-scroll flex-1 overflow-y-auto bg-background md:rounded-tl-3xl md:border-l md:border-t md:border-border">
            {children}
          </main>
          <MobileTabBar />
        </div>
      </div>
     </MentorProvider>
    </ArchiveProvider>
  );
}
