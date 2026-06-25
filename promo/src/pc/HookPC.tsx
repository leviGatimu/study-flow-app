import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, random } from "remotion";
import { COLORS } from "../theme";
import { FONT_DISPLAY } from "../lib/fonts";
import { MaskReveal } from "../anim/Text";
import { Camera, Grade, ChromaPulse } from "../components/Cinematic";

const words = ["HOMEWORK", "EXAMS", "DEADLINES"];

export const HookPC: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chaos = spring({ frame: frame - 40, fps, config: { damping: 9, stiffness: 200 } });
  const glitch = frame > 40 ? (random(`g${Math.floor(frame / 2)}`) - 0.5) * 10 : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#050608", alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 45%, ${COLORS.rose}22, transparent 60%)`,
          opacity: interpolate(frame, [35, 50, dur], [0, 1, 0.3]),
        }}
      />
      <Camera dur={dur} from={1.0} to={1.1}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 50, flexWrap: "wrap", padding: 80 }}>
          {words.map((w, i) => (
            <MaskReveal key={w} delay={i * 7} damping={16}>
              <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 120, color: COLORS.muted, letterSpacing: -2 }}>
                {w}
              </span>
            </MaskReveal>
          ))}
        </AbsoluteFill>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", marginTop: 230 }}>
          <span
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 280,
              color: COLORS.rose,
              letterSpacing: -8,
              opacity: chaos,
              transform: `scale(${interpolate(chaos, [0, 1], [0.5, 1])}) translateX(${glitch}px)`,
              textShadow: `0 0 80px ${COLORS.rose}99`,
            }}
          >
            CHAOS.
          </span>
        </AbsoluteFill>
      </Camera>
      <ChromaPulse at={40} />
      <Grade />
    </AbsoluteFill>
  );
};
