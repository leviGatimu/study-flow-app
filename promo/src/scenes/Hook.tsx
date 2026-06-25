import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, random } from "remotion";
import { COLORS } from "../theme";
import { FONT_HEAD } from "../lib/fonts";

// Cold-open hook: aggressive kinetic type that names the pain.
const lines = ["HOMEWORK.", "EXAMS.", "DEADLINES.", "CHAOS."];

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" }}>
      {/* red emergency wash that fades */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 40%, ${COLORS.rose}22, transparent 60%)`,
          opacity: interpolate(frame, [0, 20, 55], [0, 1, 0.2]),
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        {lines.map((l, i) => {
          const start = i * 9;
          const s = spring({ frame: frame - start, fps, config: { damping: 12, stiffness: 200 } });
          const jitter = (random(`j${i}${Math.floor(frame / 2)}`) - 0.5) * (i === lines.length - 1 ? 14 : 4);
          return (
            <div
              key={l}
              style={{
                fontFamily: FONT_HEAD,
                fontWeight: 800,
                fontSize: i === lines.length - 1 ? 150 : 96,
                color: i === lines.length - 1 ? COLORS.rose : COLORS.text,
                letterSpacing: -2,
                transform: `translateY(${interpolate(s, [0, 1], [60, 0])}px) translateX(${jitter}px) scale(${interpolate(s, [0, 1], [0.7, 1])})`,
                opacity: s,
                textShadow: i === lines.length - 1 ? `0 0 40px ${COLORS.rose}88` : "none",
              }}
            >
              {l}
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 360,
          fontFamily: FONT_HEAD,
          fontSize: 40,
          color: COLORS.muted,
          opacity: interpolate(frame, [50, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          letterSpacing: 2,
        }}
      >
        sound familiar?
      </div>
    </AbsoluteFill>
  );
};
