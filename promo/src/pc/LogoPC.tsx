import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS } from "../theme";
import { FONT_DISPLAY, FONT_BODY } from "../lib/fonts";
import { Logo } from "../components/Logo";
import { BackgroundPC } from "../components/BackgroundPC";
import { Camera, Particles, LightSweep, Grade, ChromaPulse } from "../components/Cinematic";
import { MaskReveal } from "../anim/Text";

export const LogoPC: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoS = spring({ frame, fps, config: { damping: 11, stiffness: 150 } });
  const ringScale = interpolate(frame, [2, 45], [0.2, 4], { extrapolateRight: "clamp" });
  const ringOpacity = interpolate(frame, [4, 45], [0.7, 0], { extrapolateRight: "clamp" });
  const flash = interpolate(frame, [0, 5, 16], [0, 1, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <BackgroundPC />
      <Particles count={26} />
      <Camera dur={dur} from={1.04} to={1.12}>
        <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 50 }}>
          {/* shockwave */}
          <div
            style={{
              position: "absolute",
              width: 360,
              height: 360,
              borderRadius: "50%",
              border: `3px solid ${COLORS.primary}`,
              transform: `scale(${ringScale})`,
              opacity: ringOpacity,
            }}
          />
          <div style={{ transform: `scale(${interpolate(logoS, [0, 1], [0.2, 1])}) rotate(${interpolate(logoS, [0, 1], [-50, 0])}deg)`, opacity: logoS }}>
            <Logo size={230} />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 170, fontWeight: 700, letterSpacing: -6, color: COLORS.text, lineHeight: 1 }}>
              <MaskReveal delay={10}>
                Study<span style={{ color: COLORS.primary }}>Flow</span>
              </MaskReveal>
            </div>
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: 40,
                color: COLORS.muted,
                marginTop: 18,
                letterSpacing: 1,
                opacity: interpolate(frame, [28, 46], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              }}
            >
              your entire study life — in flow.
            </div>
          </div>
        </AbsoluteFill>
        <LightSweep delay={20} duration={28} />
      </Camera>
      <ChromaPulse at={4} />
      <Grade />
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: flash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
