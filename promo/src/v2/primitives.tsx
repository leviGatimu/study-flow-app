import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

// Premium easings — expo-out for entrances, the "Apple" snap.
export const E_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const E_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

export const PALETTE = {
  bg: "#05060A",
  blue: "#3B6EF6",
  indigo: "#6366F1",
  cyan: "#22D3EE",
  emerald: "#34D399",
  amber: "#FBBF24",
  violet: "#8B5CF6",
  rose: "#FB7185",
  white: "#FFFFFF",
  text: "#F4F7FF",
  muted: "rgba(244,247,255,0.55)",
};

export function ease(frame: number, delay: number, dur: number, from = 0, to = 1, easing = E_OUT) {
  return interpolate(frame - delay, [0, dur], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });
}

/** A line/word that masks up from below with a blur-clear — the signature reveal. */
export const Rise: React.FC<{
  children: React.ReactNode;
  delay?: number;
  dur?: number;
  y?: number;
  blur?: number;
  style?: React.CSSProperties;
}> = ({ children, delay = 0, dur = 22, y = 60, blur = 16, style }) => {
  const frame = useCurrentFrame();
  const t = ease(frame, delay, dur);
  return (
    <div style={{ overflow: "hidden", paddingBottom: "0.12em", ...style }}>
      <div
        style={{
          transform: `translateY(${(1 - t) * y}px)`,
          opacity: t,
          filter: `blur(${(1 - t) * blur}px)`,
          willChange: "transform, filter, opacity",
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** Fade + slight scale/upglide for any element. */
export const Pop: React.FC<{
  children: React.ReactNode;
  delay?: number;
  dur?: number;
  from?: number;
  y?: number;
  style?: React.CSSProperties;
}> = ({ children, delay = 0, dur = 26, from = 0.94, y = 24, style }) => {
  const frame = useCurrentFrame();
  const t = ease(frame, delay, dur);
  return (
    <div
      style={{
        transform: `translateY(${(1 - t) * y}px) scale(${from + (1 - from) * t})`,
        opacity: t,
        willChange: "transform, opacity",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

type Blob = { s: number; ax: number; ay: number; px: number; py: number; sx: number; sy: number; c: number };
const BLOBS: Blob[] = [
  { s: 1100, ax: 26, ay: 18, px: 0.0, py: 1.1, sx: 0.011, sy: 0.013, c: 0 },
  { s: 900, ax: 30, ay: 22, px: 2.1, py: 3.0, sx: 0.013, sy: 0.009, c: 1 },
  { s: 820, ax: 22, ay: 26, px: 4.2, py: 0.6, sx: 0.009, sy: 0.014, c: 2 },
  { s: 700, ax: 34, ay: 16, px: 1.3, py: 2.4, sx: 0.015, sy: 0.011, c: 0 },
  { s: 620, ax: 18, ay: 28, px: 3.4, py: 4.7, sx: 0.012, sy: 0.016, c: 1 },
];

/** Deep, slowly-drifting gradient-mesh backdrop (frame-deterministic). */
export const Mesh: React.FC<{ colors: string[]; intensity?: number; speed?: number }> = ({
  colors,
  intensity = 1,
  speed = 1,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: PALETTE.bg, overflow: "hidden" }}>
      {BLOBS.map((b, i) => {
        const x = 50 + Math.sin(frame * b.sx * speed + b.px) * b.ax;
        const y = 50 + Math.cos(frame * b.sy * speed + b.py) * b.ay;
        const breathe = 1 + Math.sin(frame * 0.02 + i) * 0.06;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: b.s * breathe,
              height: b.s * breathe,
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${colors[b.c % colors.length]} 0%, transparent 64%)`,
              filter: "blur(90px)",
              opacity: 0.55 * intensity,
            }}
          />
        );
      })}
      {/* vignette to keep edges deep */}
      <AbsoluteFill
        style={{ background: "radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,0.66) 100%)" }}
      />
    </AbsoluteFill>
  );
};

/** Frosted-glass panel with depth + top highlight. */
export const Glass: React.FC<{ children?: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      background: "rgba(255,255,255,0.045)",
      border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: 30,
      backdropFilter: "blur(22px)",
      WebkitBackdropFilter: "blur(22px)",
      boxShadow:
        "0 50px 130px -36px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.25)",
      ...style,
    }}
  >
    {children}
  </div>
);

/** Small uppercase chip / eyebrow. */
export const Chip: React.FC<{ children: React.ReactNode; color?: string; font?: string }> = ({
  children,
  color = PALETTE.blue,
  font,
}) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      fontFamily: font,
      fontSize: 18,
      fontWeight: 800,
      letterSpacing: "0.28em",
      textTransform: "uppercase",
      color,
      background: `${color}1A`,
      border: `1px solid ${color}33`,
      padding: "8px 16px",
      borderRadius: 999,
    }}
  >
    {children}
  </span>
);
