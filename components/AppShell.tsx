'use client';

import { Sidebar } from "@/components/Sidebar";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { UserProgress } from "@/lib/types";
import { useSidebar } from "@/lib/SidebarContext";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

export function AppShell({
  children,
  userProgress
}: {
  children: React.ReactNode;
  userProgress: UserProgress | null;
}) {
  const { isCollapsed } = useSidebar();
  const pathname = usePathname();
  const isAuthPage = ['/login', '/register', '/welcome'].includes(pathname || '');

  // The Electron mini widget is its own tiny always-on-top window — it must
  // render bare, with no sidebar or app chrome around it.
  if (pathname?.startsWith('/focus/widget')) {
    return <div className="h-full w-full bg-transparent">{children}</div>;
  }

  return (
    <div className="flex h-full w-full overflow-hidden relative">
      <OnboardingTour />
      <Sidebar userProgress={userProgress} />

      <main
        className={cn(
          "flex-1 overflow-y-auto custom-scrollbar bg-background transition-all duration-300",
          (!isAuthPage && isCollapsed) ? "pl-20" : ""
        )}
      >
        {children}
      </main>
    </div>
  );
}
