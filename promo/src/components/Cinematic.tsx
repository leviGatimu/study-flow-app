import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, random, useVideoConfig } from "remotion";
import { COLORS } from "../theme";

// ---- Camera: slow continuous push-in + drift so every scene feels alive. ----
export const Camera: React.FC<{
  children: React.ReactNode;
  from?: number;
  to?: number;
  pan?: number;
  dur?: number; // explicit length (needed inside TransitionSeries, where useVideoConfig returns the whole comp)
}> = ({ children, from = 1.06, to = 1.14, pan = 0, dur }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const span = dur ?? durationInFrames;
  const scale = interpolate(frame, [0, span], [from, to], { extrapolateRight: "clamp" });
  const x = interpolate(frame, [0, span], [0, pan], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ transform: `scale(${scale}) translateX(${x}px)`, transformOrigin: "center" }}>
      {children}
    </AbsoluteFill>
  );
};

// ---- Floating bokeh particles. ----
export const Particles: React.FC<{ count?: number; color?: string }> = ({ count = 28, color = COLORS.primary }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {new Array(count).fill(0).map((_, i) => {
        const seedX = random(`px${i}`);
        const seedY = random(`py${i}`);
        const size = 4 + random(`ps${i}`) * 16;
        const speed = 0.2 + random(`pv${i}`) * 0.6;
        const x = (seedX * 1920) % 1920;
        const y = (seedY * 1080 - frame * speed * 4 + 1080 * 3) % 1080;
        const tw = 0.3 + 0.7 * Math.abs(Math.sin(frame / 20 + i));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: "50%",
              background: color,
              opacity: tw * 0.5,
              filter: "blur(2px)",
              boxShadow: `0 0 ${size * 2}px ${color}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ---- Diagonal light sweep (glint) — great for logos & buttons. ----
export const LightSweep: React.FC<{ delay?: number; duration?: number; angle?: number }> = ({
  delay = 0,
  duration = 30,
  angle = 20,
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [delay, delay + duration], [-30, 130], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: "-50%",
          background: `linear-gradient(${angle}deg, transparent ${p - 12}%, rgba(255,255,255,0.18) ${p}%, transparent ${p + 12}%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// ---- Color grade: vignette + subtle top/bottom gradient + soft bloom. ----
export const Grade: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.55) 100%)" }} />
    <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, transparent 25%, transparent 70%, rgba(0,0,0,0.35) 100%)" }} />
  </AbsoluteFill>
);

// ---- Chromatic-aberration flash on a beat (RGB split pulse). ----
export const ChromaPulse: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const amt = interpolate(frame, [at - 2, at, at + 8], [0, 8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (amt < 0.1) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen" }}>
      <AbsoluteFill style={{ boxShadow: `inset ${amt}px 0 ${amt * 4}px ${COLORS.rose}66, inset ${-amt}px 0 ${amt * 4}px ${COLORS.cyan}66` }} />
    </AbsoluteFill>
  );
};
