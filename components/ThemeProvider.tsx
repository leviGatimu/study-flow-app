"use client";

import * as React from "react";

type Theme = "light" | "dark" | "system" | "glass";
export const ACCENTS = ["blue", "indigo", "violet", "teal", "emerald", "rose", "slate"] as const;
export type Accent = (typeof ACCENTS)[number];

/** A stored value this build does not know (e.g. the retired "orange") reads as blue. */
function readAccent(value: string | null): Accent {
  return (ACCENTS as readonly string[]).includes(value ?? "") ? (value as Accent) : "blue";
}

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  accent: Accent;
  setAccent: (accent: Accent) => void;
};

type ThemeProviderProps = {
  children: React.ReactNode;
  attribute?: "class";
  defaultTheme?: Theme;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "study-flow-theme";
const ACCENT_STORAGE_KEY = "study-flow-accent";

function getSystemTheme() {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme, disableTransitionOnChange?: boolean) {
  if (typeof document === "undefined") return getSystemTheme();

  const systemTheme = getSystemTheme();
  const resolvedTheme = (theme === "system" || theme === "glass") ? systemTheme : theme;
  const root = document.documentElement;

  if (disableTransitionOnChange) {
    root.classList.add("[&_*]:!transition-none");
    window.setTimeout(() => root.classList.remove("[&_*]:!transition-none"), 0);
  }

  root.classList.toggle("dark", resolvedTheme === "dark");
  root.classList.toggle("glass-theme", theme === "glass");

  return resolvedTheme;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  enableSystem = true,
  disableTransitionOnChange,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    if (typeof window === "undefined") return defaultTheme;
    const storedTheme = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initialTheme = storedTheme ?? defaultTheme;
    return initialTheme === "system" && !enableSystem ? "light" : initialTheme;
  });
  
  const [accent, setAccentState] = React.useState<Accent>(() => {
    if (typeof window === "undefined") return "blue";
    return readAccent(window.localStorage.getItem(ACCENT_STORAGE_KEY));
  });

  const [systemTheme, setSystemTheme] = React.useState<"light" | "dark">(() => getSystemTheme());

  const resolvedTheme = (theme === "system" || theme === "glass") ? systemTheme : theme;

  React.useEffect(() => {
    applyTheme(theme, disableTransitionOnChange);
  }, [theme, disableTransitionOnChange, systemTheme]);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    
    // One accent class at a time (theme-orange may linger from older builds).
    root.classList.remove("theme-orange", ...ACCENTS.map((a) => `theme-${a}`));
    root.classList.add(`theme-${accent}`);
  }, [accent]);

  React.useEffect(() => {
    if (!enableSystem || (theme !== "system" && theme !== "glass")) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      setSystemTheme(getSystemTheme());
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, enableSystem]);

  const setTheme = React.useCallback(
    (nextTheme: Theme) => {
      const safeTheme = nextTheme === "system" && !enableSystem ? "light" : nextTheme;
      setThemeState(safeTheme);
      window.localStorage.setItem(STORAGE_KEY, safeTheme);
    },
    [enableSystem]
  );

  const setAccent = React.useCallback((nextAccent: Accent) => {
    setAccentState(nextAccent);
    window.localStorage.setItem(ACCENT_STORAGE_KEY, nextAccent);
  }, []);

  const value = React.useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      accent,
      setAccent,
    }),
    [theme, resolvedTheme, setTheme, accent, setAccent]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}
