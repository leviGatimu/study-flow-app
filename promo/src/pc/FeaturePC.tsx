import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS } from "../theme";
import { FONT_DISPLAY, FONT_BODY } from "../lib/fonts";
import { Phone } from "../components/Phone";
import { BackgroundPC } from "../components/BackgroundPC";
import { Camera, Particles, Grade } from "../components/Cinematic";
import { CharStagger, MaskReveal } from "../anim/Text";

interface Props {
  dur: number;
  chip: string;
  title: string[]; // each line; prefix a line with "*" to accent it
  body: string;
  accent: string;
  screen: React.ReactNode;
  side?: "left" | "right";
}

// Premium 16:9 feature beat: kinetic headline on one side, a tilted glassy phone on the other.
export const FeaturePC: React.FC<Props> = ({ dur, chip, title, body, accent, screen, side = "right" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneS = spring({ frame: frame - 6, fps, config: { damping: 20, stiffness: 110 } });
  const dir = side === "right" ? 1 : -1;
  const phoneX = interpolate(phoneS, [0, 1], [dir * 500, 0]);
  const tilt = interpolate(phoneS, [0, 1], [dir * 16, dir * 8]);
  const chipS = spring({ frame: frame - 4, fps, config: { damping: 16 } });
  const bodyO = interpolate(frame, [26, 44], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const textCol = (
    <div style={{ flex: 1, padding: "0 90px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div
        style={{
          alignSelf: "flex-start",
          fontFamily: FONT_BODY,
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: 5,
          color: accent,
          background: `${accent}1A`,
          border: `1px solid ${accent}55`,
          padding: "12px 26px",
          borderRadius: 999,
          transform: `translateY(${interpolate(chipS, [0, 1], [24, 0])}px)`,
          opacity: chipS,
        }}
      >
        {chip}
      </div>
      <div style={{ marginTop: 30, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 110, lineHeight: 1.0, letterSpacing: -3, color: COLORS.text }}>
        {title.map((line, i) => {
          const accented = line.startsWith("*");
          return (
            <div key={i}>
              <MaskReveal delay={12 + i * 8}>
                <span style={{ color: accented ? accent : COLORS.text }}>{line.replace("*", "")}</span>
              </MaskReveal>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 28, fontFamily: FONT_BODY, fontSize: 36, lineHeight: 1.4, color: COLORS.muted, maxWidth: 640, opacity: bodyO }}>
        {body}
      </div>
    </div>
  );

  const phoneCol = (
    <div style={{ width: 720, display: "flex", alignItems: "center", justifyContent: "center", perspective: 1600 }}>
      <div
        style={{
          transform: `translateX(${phoneX}px) rotateY(${tilt}deg) rotateX(2deg)`,
          opacity: phoneS,
          transformStyle: "preserve-3d",
          boxShadow: `0 40px 120px ${accent}33`,
          borderRadius: 70,
        }}
      >
        <Phone width={420} glare>{screen}</Phone>
      </div>
    </div>
  );

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <BackgroundPC accent={accent} accent2={accent} />
      <Particles count={20} color={accent} />
      <Camera dur={dur} from={1.03} to={1.09} pan={dir * -14}>
        <AbsoluteFill style={{ flexDirection: "row", alignItems: "center" }}>
          {side === "right" ? (
            <>
              {textCol}
              {phoneCol}
            </>
          ) : (
            <>
              {phoneCol}
              {textCol}
            </>
          )}
        </AbsoluteFill>
      </Camera>
      <Grade />
    </AbsoluteFill>
  );
};
