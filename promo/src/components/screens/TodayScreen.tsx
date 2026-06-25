import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS } from "../../theme";
import { FONT_HEAD, FONT_BODY } from "../../lib/fonts";

const tasks = [
  { subject: "Javascript", time: "20:30", type: "HOMEWORK", color: COLORS.primary, done: true },
  { subject: "Networking", time: "20:00", type: "HOMEWORK", color: COLORS.primary, done: true },
  { subject: "Physics", time: "19:00", type: "REVISION", color: COLORS.amber, done: false },
  { subject: "Database", time: "21:30", type: "HOMEWORK", color: COLORS.primary, done: false },
  { subject: "C programming", time: "22:30", type: "HOMEWORK", color: COLORS.primary, done: false },
];

export const TodayScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = interpolate(frame, [10, 60], [0.18, 0.62], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ padding: "70px 30px 30px", height: "100%", color: COLORS.text }}>
      <div style={{ fontFamily: FONT_BODY, color: COLORS.muted, fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>
        TODAY · JUNE 7
      </div>
      <div style={{ fontFamily: FONT_HEAD, fontSize: 54, fontWeight: 800, marginTop: 6 }}>
        Today&apos;s Focus
      </div>

      {/* progress ring row */}
      <div
        style={{
          marginTop: 24,
          background: COLORS.bgCard,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 24,
          padding: 24,
          display: "flex",
          alignItems: "center",
          gap: 22,
        }}
      >
        <Ring pct={progress} fps={fps} frame={frame} />
        <div>
          <div style={{ fontFamily: FONT_HEAD, fontSize: 40, fontWeight: 800 }}>
            {Math.round(progress * 100)}%
          </div>
          <div style={{ fontFamily: FONT_BODY, color: COLORS.muted, fontSize: 24 }}>
            of today done
          </div>
        </div>
      </div>

      {/* task list */}
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        {tasks.map((t, i) => {
          const s = spring({ frame: frame - 12 - i * 6, fps, config: { damping: 16 } });
          const checked = t.done && frame > 40 + i * 4;
          return (
            <div
              key={t.subject}
              style={{
                transform: `translateX(${interpolate(s, [0, 1], [80, 0])}px)`,
                opacity: s,
                background: COLORS.bgCardSoft,
                border: `1px solid ${COLORS.border}`,
                borderLeft: `5px ${t.type === "REVISION" ? "dashed" : "solid"} ${t.color}`,
                borderRadius: 18,
                padding: "18px 20px",
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: `2px solid ${checked ? COLORS.emerald : COLORS.muted}`,
                  background: checked ? COLORS.emerald : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#0A0B0F",
                  fontWeight: 900,
                  fontSize: 22,
                }}
              >
                {checked ? "✓" : ""}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: FONT_HEAD, fontSize: 30, fontWeight: 700, textDecoration: checked ? "line-through" : "none", opacity: checked ? 0.5 : 1 }}>
                  {t.subject}
                </div>
                <div style={{ fontFamily: FONT_BODY, fontSize: 20, color: COLORS.muted }}>
                  {t.time} · {t.type}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Ring: React.FC<{ pct: number; fps: number; frame: number }> = ({ pct }) => {
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <svg width={120} height={120} viewBox="0 0 120 120">
      <circle cx={60} cy={60} r={r} stroke={COLORS.bgCardSoft} strokeWidth={12} fill="none" />
      <circle
        cx={60}
        cy={60}
        r={r}
        stroke={COLORS.primary}
        strokeWidth={12}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        transform="rotate(-90 60 60)"
      />
    </svg>
  );
};
