import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS } from "../theme";
import { FONT_HEAD, FONT_BODY } from "../lib/fonts";
import { Logo } from "../components/Logo";
import { Background } from "../components/Background";

export const CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoS = spring({ frame, fps, config: { damping: 12 } });
  const btnS = spring({ frame: frame - 24, fps, config: { damping: 12, stiffness: 160 } });
  const btnPulse = 1 + Math.sin(frame / 7) * 0.03;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Background hue={20} />

      <div style={{ transform: `scale(${interpolate(logoS, [0, 1], [0.4, 1])})`, opacity: logoS }}>
        <Logo size={170} />
      </div>

      <div
        style={{
          marginTop: 44,
          fontFamily: FONT_HEAD,
          fontSize: 120,
          fontWeight: 800,
          letterSpacing: -3,
          color: COLORS.text,
          opacity: interpolate(frame, [8, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        Study<span style={{ color: COLORS.primary }}>Flow</span>
      </div>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 42,
          color: COLORS.muted,
          marginTop: 4,
          opacity: interpolate(frame, [16, 32], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        stop planning. start flowing.
      </div>

      {/* CTA button */}
      <div
        style={{
          marginTop: 70,
          transform: `scale(${interpolate(btnS, [0, 1], [0.6, 1]) * btnPulse})`,
          opacity: btnS,
          fontFamily: FONT_HEAD,
          fontSize: 50,
          fontWeight: 800,
          color: "#fff",
          padding: "32px 80px",
          borderRadius: 999,
          background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.indigo})`,
          boxShadow: `0 24px 70px ${COLORS.primary}77`,
        }}
      >
        Start Studying Free →
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 150,
          fontFamily: FONT_BODY,
          fontSize: 30,
          color: COLORS.muted,
          letterSpacing: 2,
          opacity: interpolate(frame, [40, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        AI Tutor · Focus Mode · Ranks · Analytics
      </div>
    </AbsoluteFill>
  );
};
