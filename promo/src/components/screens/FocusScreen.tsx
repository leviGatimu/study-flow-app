import React from "react";
import { useCurrentFrame, interpolate, useVideoConfig } from "remotion";
import { COLORS } from "../../theme";
import { FONT_HEAD, FONT_BODY } from "../../lib/fonts";

export const FocusScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Count down from 25:00, ticking ~ once per second of video time.
  const elapsed = Math.floor(frame / fps);
  const total = 25 * 60;
  const remaining = Math.max(total - elapsed * 37, 0); // speed up for the ad
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  const pct = 1 - remaining / total;
  const r = 150;
  const c = 2 * Math.PI * r;
  const pulse = 1 + Math.sin(frame / 6) * 0.012;

  return (
    <div style={{ height: "100%", color: COLORS.text, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 40, padding: 40 }}>
      <div style={{ fontFamily: FONT_BODY, fontSize: 24, letterSpacing: 4, color: COLORS.primary, fontWeight: 800 }}>
        FOCUS MODE
      </div>
      <div style={{ fontFamily: FONT_HEAD, fontSize: 30, color: COLORS.muted }}>Physics · Deep Work</div>

      <div style={{ position: "relative", transform: `scale(${pulse})` }}>
        <svg width={380} height={380} viewBox="0 0 380 380">
          <circle cx={190} cy={190} r={r} stroke={COLORS.bgCard} strokeWidth={18} fill="none" />
          <circle
            cx={190}
            cy={190}
            r={r}
            stroke={COLORS.primary}
            strokeWidth={18}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            transform="rotate(-90 190 190)"
            style={{ filter: `drop-shadow(0 0 18px ${COLORS.primary})` }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: FONT_HEAD, fontSize: 96, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
            {mm}:{ss}
          </div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 24, color: COLORS.muted }}>stay locked in</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 18 }}>
        {["Pause", "+5 XP / min"].map((t, i) => (
          <div
            key={t}
            style={{
              fontFamily: FONT_BODY,
              fontSize: 24,
              fontWeight: 700,
              padding: "16px 30px",
              borderRadius: 16,
              background: i === 0 ? COLORS.bgCard : `${COLORS.emerald}22`,
              color: i === 0 ? COLORS.text : COLORS.emerald,
              border: `1px solid ${i === 0 ? COLORS.border : COLORS.emerald + "55"}`,
              opacity: interpolate(frame, [20, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            }}
          >
            {t}
          </div>
        ))}
      </div>
    </div>
  );
};
