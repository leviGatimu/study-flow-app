// Study Flow brand palette — pulled from the app's globals.css (blue-on-deep-navy).
export const COLORS = {
  bg: "#0A0B0F",
  bgCard: "#15171E",
  bgCardSoft: "#1B1E27",
  border: "rgba(255,255,255,0.08)",
  primary: "#3B6EF6", // app primary blue
  primarySoft: "#2B4Fd0",
  indigo: "#6366F1",
  cyan: "#22D3EE",
  amber: "#FBBF24",
  emerald: "#34D399",
  rose: "#FB7185",
  text: "#F8FAFC",
  muted: "#9AA1AE",
  white: "#FFFFFF",
};

export const FPS = 30;

// Vertical, social-first canvas (Reels / Shorts / TikTok).
export const WIDTH = 1080;
export const HEIGHT = 1920;

// Landscape PC canvas (1080p, 16:9).
export const WIDTH_PC = 1920;
export const HEIGHT_PC = 1080;

// One shared spring config for snappy, premium motion.
export const SNAP = { damping: 18, stiffness: 160, mass: 0.7 } as const;
export const SOFT = { damping: 26, stiffness: 120, mass: 0.9 } as const;
