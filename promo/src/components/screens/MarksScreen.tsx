import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS } from "../../theme";
import { FONT_HEAD, FONT_BODY } from "../../lib/fonts";

const bars = [
  { label: "Wk1", v: 0.52 },
  { label: "Wk2", v: 0.61 },
  { label: "Wk3", v: 0.58 },
  { label: "Wk4", v: 0.74 },
  { label: "Wk5", v: 0.83 },
  { label: "Wk6", v: 0.92 },
];

export const MarksScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const avg = interpolate(frame, [10, 55], [62, 88], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ padding: "70px 30px 30px", height: "100%", color: COLORS.text }}>
      <div style={{ fontFamily: FONT_BODY, color: COLORS.muted, fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>
        INSIGHTS · ANALYTICS
      </div>
      <div style={{ fontFamily: FONT_HEAD, fontSize: 52, fontWeight: 800, marginTop: 6 }}>
        Your Marks
      </div>

      <div style={{ marginTop: 22, background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 24, padding: 26 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontFamily: FONT_BODY, color: COLORS.muted, fontSize: 22 }}>Average</div>
            <div style={{ fontFamily: FONT_HEAD, fontSize: 72, fontWeight: 800, color: COLORS.emerald, fontVariantNumeric: "tabular-nums" }}>
              {Math.round(avg)}%
            </div>
          </div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 26, color: COLORS.emerald, fontWeight: 700 }}>
            ▲ +26% trend
          </div>
        </div>

        {/* bar chart */}
        <div style={{ marginTop: 30, height: 260, display: "flex", alignItems: "flex-end", gap: 18 }}>
          {bars.map((b, i) => {
            const s = spring({ frame: frame - 12 - i * 5, fps, config: { damping: 14 } });
            const h = b.v * s;
            return (
              <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: "100%",
                    height: `${h * 100}%`,
                    borderRadius: 12,
                    background: `linear-gradient(180deg, ${COLORS.primary}, ${COLORS.indigo})`,
                    boxShadow: `0 0 24px ${COLORS.primary}66`,
                  }}
                />
                <div style={{ fontFamily: FONT_BODY, fontSize: 20, color: COLORS.muted }}>{b.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 16 }}>
        {[
          { k: "Streak", v: "23🔥" },
          { k: "Done", v: "148" },
          { k: "Rank", v: "Gold" },
        ].map((c) => (
          <div key={c.k} style={{ flex: 1, background: COLORS.bgCardSoft, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: "18px 14px", textAlign: "center" }}>
            <div style={{ fontFamily: FONT_HEAD, fontSize: 36, fontWeight: 800 }}>{c.v}</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 20, color: COLORS.muted }}>{c.k}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
