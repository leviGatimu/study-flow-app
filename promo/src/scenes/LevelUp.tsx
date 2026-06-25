import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, random } from "remotion";
import { COLORS } from "../theme";
import { FONT_HEAD, FONT_BODY } from "../lib/fonts";
import { Background } from "../components/Background";

// Gamification money-shot: XP bar fills, "LEVEL UP", rank badge slams in.
export const LevelUp: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const xp = interpolate(frame, [8, 45], [0.15, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const burst = frame > 44;
  const labelS = spring({ frame: frame - 46, fps, config: { damping: 9, stiffness: 180 } });
  const badgeS = spring({ frame: frame - 52, fps, config: { damping: 8, stiffness: 150 } });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Background hue={60} />

      {/* confetti / particles after the level-up hit */}
      {burst &&
        new Array(40).fill(0).map((_, i) => {
          const a = (i / 40) * Math.PI * 2;
          const dist = interpolate(frame - 44, [0, 30], [0, 600 + random(`d${i}`) * 300], { extrapolateRight: "clamp" });
          const colors = [COLORS.primary, COLORS.amber, COLORS.emerald, COLORS.cyan, COLORS.indigo];
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                width: 16,
                height: 16,
                borderRadius: random(`r${i}`) > 0.5 ? "50%" : 2,
                background: colors[i % colors.length],
                transform: `translate(${Math.cos(a) * dist}px, ${Math.sin(a) * dist}px) rotate(${frame * 8}deg)`,
                opacity: interpolate(frame - 44, [0, 25, 40], [1, 1, 0], { extrapolateRight: "clamp" }),
              }}
            />
          );
        })}

      <div
        style={{
          fontFamily: FONT_HEAD,
          fontSize: 130,
          fontWeight: 800,
          color: COLORS.amber,
          letterSpacing: -2,
          transform: `scale(${interpolate(labelS, [0, 1], [0.3, 1])})`,
          opacity: labelS,
          textShadow: `0 0 50px ${COLORS.amber}aa`,
        }}
      >
        LEVEL UP!
      </div>

      {/* XP bar */}
      <div style={{ width: 720, marginTop: 50 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_BODY, fontSize: 30, color: COLORS.muted, marginBottom: 14 }}>
          <span>LV {Math.round(interpolate(xp, [0.15, 1], [29, 30]))}</span>
          <span>{Math.round(xp * 100)}% XP</span>
        </div>
        <div style={{ height: 36, background: COLORS.bgCard, borderRadius: 999, overflow: "hidden", border: `1px solid ${COLORS.border}` }}>
          <div style={{ width: `${xp * 100}%`, height: "100%", background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.cyan})`, boxShadow: `0 0 24px ${COLORS.primary}`, borderRadius: 999 }} />
        </div>
      </div>

      {/* rank badge */}
      <div
        style={{
          marginTop: 60,
          transform: `scale(${interpolate(badgeS, [0, 1], [0.2, 1])}) rotate(${interpolate(badgeS, [0, 1], [-20, 0])}deg)`,
          opacity: badgeS,
          display: "flex",
          alignItems: "center",
          gap: 22,
          padding: "26px 44px",
          borderRadius: 28,
          background: `linear-gradient(135deg, ${COLORS.indigo}, ${COLORS.primary})`,
          boxShadow: `0 30px 70px ${COLORS.indigo}66`,
        }}
      >
        <span style={{ fontSize: 70 }}>💎</span>
        <div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 26, color: "rgba(255,255,255,0.7)", letterSpacing: 3 }}>RANK UNLOCKED</div>
          <div style={{ fontFamily: FONT_HEAD, fontSize: 60, fontWeight: 800, color: "#fff" }}>DIAMOND ELITE</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
