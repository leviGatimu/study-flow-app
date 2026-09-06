import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppShell } from "@/components/AppShell";
import { GlobalShortcuts } from "@/components/GlobalShortcuts";

import { getUserId } from "@/lib/auth";
import { syncStreak } from "@/lib/actions";
import { listSubjects } from "@/lib/subject-actions";
import { FocusProvider } from "@/lib/FocusContext";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Study Flow | Elite Academic Workstation",
  description: "A clean, private study and assignment tracker for top students.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const userId = await getUserId();
  const [userProgress, subjects] = userId
    ? await Promise.all([syncStreak(), listSubjects()])
    : [null, []];

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="icon" href="/logo.png" />
        {/* Apply theme before first paint to avoid a flash of the wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('study-flow-theme')||'system';var sysDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var isDark=t==='dark'||((t==='system'||t==='glass')&&sysDark);var r=document.documentElement;r.classList.toggle('dark',isDark);r.classList.toggle('glass-theme',t==='glass');var a=localStorage.getItem('study-flow-accent')||'blue';r.classList.add('theme-'+a);}catch(e){}})();`,
          }}
        />
      </head>
      <body 
        className="flex h-screen w-screen overflow-hidden bg-background font-sans text-foreground antialiased relative"
        style={{
          ["--font-sans" as string]: '"Nunito", "Avenir Next", "Segoe UI", sans-serif',
          ["--font-heading" as string]: '"Outfit", "Segoe UI", sans-serif',
        }}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Toaster position="top-right" richColors />
          <FocusProvider>
            <GlobalShortcuts />
            <AppShell userProgress={userProgress} subjects={subjects}>
              {children}
            </AppShell>
          </FocusProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
