import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS } from "../theme";
import { FONT_DISPLAY, FONT_BODY } from "../lib/fonts";
import { Logo } from "../components/Logo";
import { BackgroundPC } from "../components/BackgroundPC";
import { Camera, Particles, LightSweep, Grade, ChromaPulse } from "../components/Cinematic";
import { MaskReveal } from "../anim/Text";

const features = ["AI Tutor", "Focus Mode", "Ranks & XP", "Analytics", "Timetable"];

export const CTAPC: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoS = spring({ frame, fps, config: { damping: 12 } });
  const btnS = spring({ frame: frame - 22, fps, config: { damping: 11, stiffness: 170 } });
  const btnPulse = 1 + Math.sin(frame / 7) * 0.025;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <BackgroundPC />
      <Particles count={30} />
      <Camera dur={dur} from={1.04} to={1.1}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 34, transform: `scale(${interpolate(logoS, [0, 1], [0.5, 1])})`, opacity: logoS }}>
            <Logo size={140} />
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 150, fontWeight: 700, letterSpacing: -5, color: COLORS.text }}>
              Study<span style={{ color: COLORS.primary }}>Flow</span>
            </div>
          </div>

          <div style={{ marginTop: 30, fontFamily: FONT_DISPLAY, fontSize: 72, fontWeight: 700, letterSpacing: -2, color: COLORS.text }}>
            <MaskReveal delay={14}>stop planning. start flowing.</MaskReveal>
          </div>

          <div
            style={{
              marginTop: 60,
              transform: `scale(${interpolate(btnS, [0, 1], [0.6, 1]) * btnPulse})`,
              opacity: btnS,
              fontFamily: FONT_DISPLAY,
              fontSize: 56,
              fontWeight: 700,
              color: "#fff",
              padding: "34px 90px",
              borderRadius: 999,
              background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.indigo})`,
              boxShadow: `0 28px 80px ${COLORS.primary}77`,
              position: "relative",
              overflow: "hidden",
            }}
          >
            Start Studying Free →
            <LightSweep delay={40} duration={26} />
          </div>

          <div style={{ marginTop: 56, display: "flex", gap: 18, opacity: interpolate(frame, [42, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
            {features.map((f) => (
              <div key={f} style={{ fontFamily: FONT_BODY, fontSize: 28, color: COLORS.muted, padding: "14px 26px", borderRadius: 999, background: COLORS.bgCard, border: `1px solid ${COLORS.border}` }}>
                {f}
              </div>
            ))}
          </div>
        </AbsoluteFill>
      </Camera>
      <ChromaPulse at={2} />
      <Grade />
    </AbsoluteFill>
  );
};
