import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS } from "../theme";
import { FONT_HEAD, FONT_BODY } from "../lib/fonts";
import { Logo } from "../components/Logo";
import { Background } from "../components/Background";

export const LogoReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoS = spring({ frame, fps, config: { damping: 11, stiffness: 140 } });
  const flash = interpolate(frame, [0, 6, 16], [0, 0.9, 0], { extrapolateRight: "clamp" });
  const titleS = spring({ frame: frame - 12, fps, config: { damping: 16 } });
  const ringScale = interpolate(frame, [0, 40], [0.2, 3], { extrapolateRight: "clamp" });
  const ringOpacity = interpolate(frame, [4, 40], [0.6, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Background />
      {/* shockwave ring */}
      <div
        style={{
          position: "absolute",
          width: 300,
          height: 300,
          borderRadius: "50%",
          border: `3px solid ${COLORS.primary}`,
          transform: `scale(${ringScale})`,
          opacity: ringOpacity,
        }}
      />
      <div style={{ transform: `scale(${interpolate(logoS, [0, 1], [0.2, 1])}) rotate(${interpolate(logoS, [0, 1], [-40, 0])}deg)`, opacity: logoS }}>
        <Logo size={200} />
      </div>

      <div
        style={{
          marginTop: 50,
          fontFamily: FONT_HEAD,
          fontSize: 110,
          fontWeight: 800,
          color: COLORS.text,
          letterSpacing: -3,
          transform: `translateY(${interpolate(titleS, [0, 1], [40, 0])}px)`,
          opacity: titleS,
        }}
      >
        Study<span style={{ color: COLORS.primary }}>Flow</span>
      </div>
      <div
        style={{
          marginTop: 10,
          fontFamily: FONT_BODY,
          fontSize: 38,
          color: COLORS.muted,
          opacity: interpolate(frame, [28, 48], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          letterSpacing: 1,
        }}
      >
        your entire study life — in flow.
      </div>

      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: flash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
