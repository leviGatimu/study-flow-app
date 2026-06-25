import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, random } from "remotion";
import { COLORS } from "../theme";
import { FONT_DISPLAY, FONT_BODY } from "../lib/fonts";
import { BackgroundPC } from "../components/BackgroundPC";
import { Camera, Particles, Grade, ChromaPulse, LightSweep } from "../components/Cinematic";

export const LevelUpPC: React.FC<{ dur: number; hit: number }> = ({ dur, hit }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const xp = interpolate(frame, [6, hit - 4], [0.12, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const labelS = spring({ frame: frame - hit, fps, config: { damping: 9, stiffness: 190 } });
  const badgeS = spring({ frame: frame - hit - 8, fps, config: { damping: 8, stiffness: 150 } });
  const burst = frame > hit - 1;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <BackgroundPC accent={COLORS.amber} accent2={COLORS.indigo} />
      <Particles count={18} color={COLORS.amber} />

      {burst &&
        new Array(56).fill(0).map((_, i) => {
          const a = (i / 56) * Math.PI * 2 + random(`a${i}`);
          const dist = interpolate(frame - hit, [0, 34], [0, 700 + random(`d${i}`) * 500], { extrapolateRight: "clamp" });
          const colors = [COLORS.primary, COLORS.amber, COLORS.emerald, COLORS.cyan, COLORS.indigo, COLORS.rose];
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                width: 14,
                height: 14,
                borderRadius: random(`r${i}`) > 0.5 ? "50%" : 2,
                background: colors[i % colors.length],
                transform: `translate(${Math.cos(a) * dist}px, ${Math.sin(a) * dist}px) rotate(${frame * 9}deg)`,
                opacity: interpolate(frame - hit, [0, 28, 44], [1, 1, 0], { extrapolateRight: "clamp" }),
              }}
            />
          );
        })}

      <Camera dur={dur} from={1.05} to={1.12}>
        <AbsoluteFill style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 44 }}>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 200,
              fontWeight: 700,
              color: COLORS.amber,
              letterSpacing: -6,
              transform: `scale(${interpolate(labelS, [0, 1], [0.3, 1])})`,
              opacity: labelS,
              textShadow: `0 0 70px ${COLORS.amber}aa`,
            }}
          >
            LEVEL UP
          </div>

          <div style={{ width: 900 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_BODY, fontSize: 32, color: COLORS.muted, marginBottom: 14 }}>
              <span>LEVEL {Math.round(interpolate(xp, [0.12, 1], [29, 30]))}</span>
              <span>{Math.round(xp * 100)}% XP</span>
            </div>
            <div style={{ height: 38, background: COLORS.bgCard, borderRadius: 999, overflow: "hidden", border: `1px solid ${COLORS.border}` }}>
              <div style={{ width: `${xp * 100}%`, height: "100%", background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.cyan})`, boxShadow: `0 0 26px ${COLORS.primary}`, borderRadius: 999 }} />
            </div>
          </div>

          <div
            style={{
              transform: `scale(${interpolate(badgeS, [0, 1], [0.2, 1])}) rotate(${interpolate(badgeS, [0, 1], [-14, 0])}deg)`,
              opacity: badgeS,
              display: "flex",
              alignItems: "center",
              gap: 26,
              padding: "28px 52px",
              borderRadius: 30,
              background: `linear-gradient(135deg, ${COLORS.indigo}, ${COLORS.primary})`,
              boxShadow: `0 30px 80px ${COLORS.indigo}77`,
            }}
          >
            <span style={{ fontSize: 80 }}>💎</span>
            <div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 28, color: "rgba(255,255,255,0.7)", letterSpacing: 4 }}>RANK UNLOCKED</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 72, fontWeight: 700, color: "#fff", letterSpacing: -2 }}>DIAMOND ELITE</div>
            </div>
          </div>
        </AbsoluteFill>
        <LightSweep delay={hit + 4} duration={26} />
      </Camera>
      <ChromaPulse at={hit} />
      <Grade />
    </AbsoluteFill>
  );
};
