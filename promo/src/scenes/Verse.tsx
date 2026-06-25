import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, useVideoConfig, spring } from "remotion";
import { COLORS } from "../theme";
import { FONT_HEAD, FONT_BODY } from "../lib/fonts";

// Emotional beat: the app's signature verse (Ecclesiastes 9:10), word-by-word.
const verse = "Whatever your hand finds to do, do it with all your might.";
const words = verse.split(" ");

export const Verse: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#06070A", alignItems: "center", justifyContent: "center", padding: 90 }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 50%, ${COLORS.primary}18, transparent 65%)`,
          opacity: interpolate(frame, [0, 40], [0, 1]),
        }}
      />
      <div style={{ fontFamily: FONT_BODY, fontSize: 30, letterSpacing: 6, color: COLORS.primary, marginBottom: 50, opacity: interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" }) }}>
        ECCLESIASTES 9:10
      </div>
      <div style={{ fontFamily: FONT_HEAD, fontSize: 78, fontWeight: 800, lineHeight: 1.25, textAlign: "center", color: COLORS.text, maxWidth: 900 }}>
        {words.map((w, i) => {
          const s = spring({ frame: frame - 8 - i * 5, fps, config: { damping: 20 } });
          const highlight = ["might.", "do,"].includes(w);
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                marginRight: 20,
                opacity: interpolate(s, [0, 1], [0.05, 1]),
                transform: `translateY(${interpolate(s, [0, 1], [20, 0])}px)`,
                color: highlight ? COLORS.primary : COLORS.text,
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
