import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

// ---- Per-character stagger with blur + overshoot. The 2026 "kinetic type" look. ----
export const CharStagger: React.FC<{
  text: string;
  delay?: number;
  stagger?: number;
  style?: React.CSSProperties;
  damping?: number;
}> = ({ text, delay = 0, stagger = 1.6, style, damping = 14 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", ...style }}>
      {text.split("").map((ch, i) => {
        const s = spring({ frame: frame - delay - i * stagger, fps, config: { damping, stiffness: 180 } });
        const blur = interpolate(s, [0, 1], [16, 0]);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              whiteSpace: "pre",
              opacity: s,
              transform: `translateY(${interpolate(s, [0, 1], [70, 0])}px) scale(${interpolate(s, [0, 1], [0.6, 1])})`,
              filter: `blur(${blur}px)`,
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
};

// ---- Mask reveal: text slides up from behind a clip edge (clean, premium). ----
export const MaskReveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
  damping?: number;
}> = ({ children, delay = 0, style, damping = 20 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping, stiffness: 110 } });
  const y = interpolate(s, [0, 1], [110, 0]);
  return (
    <span style={{ display: "inline-block", overflow: "hidden", paddingBottom: "0.12em", ...style }}>
      <span style={{ display: "inline-block", transform: `translateY(${y}%)` }}>{children}</span>
    </span>
  );
};

// ---- Word-by-word rise with blur. ----
export const WordStagger: React.FC<{
  text: string;
  delay?: number;
  stagger?: number;
  style?: React.CSSProperties;
  highlight?: string[];
  highlightColor?: string;
}> = ({ text, delay = 0, stagger = 3.5, style, highlight = [], highlightColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <span style={{ display: "inline", ...style }}>
      {text.split(" ").map((w, i) => {
        const s = spring({ frame: frame - delay - i * stagger, fps, config: { damping: 18 } });
        const isHi = highlight.includes(w.replace(/[.,]/g, ""));
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              marginRight: "0.28em",
              opacity: s,
              transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px)`,
              filter: `blur(${interpolate(s, [0, 1], [10, 0])}px)`,
              color: isHi ? highlightColor : undefined,
            }}
          >
            {w}
          </span>
        );
      })}
    </span>
  );
};
