import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS } from "../theme";
import { FONT_HEAD, FONT_BODY } from "../lib/fonts";
import { Phone } from "../components/Phone";
import { Background } from "../components/Background";

interface Props {
  chip: string;
  title: string;
  accent?: string;
  screen: React.ReactNode;
  side?: "left" | "right";
}

// Reusable feature beat: big kinetic headline + a phone showing a live mock screen.
export const FeatureScene: React.FC<Props> = ({ chip, title, accent = COLORS.primary, screen, side = "right" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneS = spring({ frame: frame - 4, fps, config: { damping: 18, stiffness: 110 } });
  const dir = side === "right" ? 1 : -1;
  const phoneX = interpolate(phoneS, [0, 1], [dir * 700, 0]);
  const phoneRot = interpolate(phoneS, [0, 1], [dir * 12, -4]);

  const chipS = spring({ frame: frame - 10, fps, config: { damping: 14 } });
  const titleWords = title.split(" ");

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start" }}>
      <Background hue={side === "right" ? 0 : 30} />

      {/* headline block */}
      <div style={{ width: "100%", padding: "120px 70px 0", zIndex: 2 }}>
        <div
          style={{
            display: "inline-block",
            fontFamily: FONT_BODY,
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: 4,
            color: accent,
            background: `${accent}1A`,
            border: `1px solid ${accent}55`,
            padding: "10px 22px",
            borderRadius: 999,
            transform: `translateY(${interpolate(chipS, [0, 1], [30, 0])}px)`,
            opacity: chipS,
          }}
        >
          {chip}
        </div>
        <div style={{ marginTop: 24, fontFamily: FONT_HEAD, fontSize: 92, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2, color: COLORS.text }}>
          {titleWords.map((w, i) => {
            const s = spring({ frame: frame - 14 - i * 4, fps, config: { damping: 16 } });
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  marginRight: 22,
                  transform: `translateY(${interpolate(s, [0, 1], [50, 0])}px)`,
                  opacity: s,
                  color: w.startsWith("*") ? accent : COLORS.text,
                }}
              >
                {w.replace("*", "")}
              </span>
            );
          })}
        </div>
      </div>

      {/* phone */}
      <div
        style={{
          position: "absolute",
          bottom: -120,
          transform: `translateX(${phoneX}px) rotate(${phoneRot}deg)`,
          opacity: phoneS,
        }}
      >
        <Phone width={520}>{screen}</Phone>
      </div>
    </AbsoluteFill>
  );
};
