"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";

/**
 * Theme switch. Lives in the app header only.
 *
 * It used to be rendered three times on the dashboard alone (sidebar, plus an
 * xl:hidden and an xl:flex copy in the hero), which is how you end up with an
 * interface where nothing feels authoritative.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Theme is resolved on the client, so render nothing until mounted to avoid
  // a hydration mismatch. Reserve the space so the header does not shift.
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="size-9" aria-hidden />;

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon-lg"
      className="[&_svg]:size-[18px]"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
