'use client';

import { usePathname } from "next/navigation";

import { Sidebar } from "@/components/Sidebar";
import { AppHeader } from "@/components/AppHeader";
import { CommandMenu } from "@/components/CommandMenu";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { SafeUserProgress as UserProgress } from "@/lib/types";
import { isBareRoute } from "@/lib/nav";

/**
 * The app frame: a fixed sidebar and header around a single scrolling content
 * region. Only the content region scrolls, so the chrome stays put and the
 * page never shifts under you on navigation.
 */
export function AppShell({
  children,
  userProgress,
  subjects,
}: {
  children: React.ReactNode;
  userProgress: UserProgress | null;
  subjects: { id: string; name: string }[];
}) {
  const pathname = usePathname();

  // The Electron mini widget is its own tiny always-on-top window, and the
  // auth/marketing pages own their full canvas: both render bare.
  if (isBareRoute(pathname)) {
    return <div className="h-full w-full">{children}</div>;
  }

  return (
    <div className="flex h-full w-full">
      <OnboardingTour />
      <CommandMenu />

      <Sidebar userProgress={userProgress} subjects={subjects} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader userProgress={userProgress} subjects={subjects} />
        <main className="app-scroll flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
