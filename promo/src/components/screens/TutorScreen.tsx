import React from "react";
import { useCurrentFrame, spring, interpolate, useVideoConfig } from "remotion";
import { COLORS } from "../../theme";
import { FONT_HEAD, FONT_BODY } from "../../lib/fonts";
import { Sparkle } from "../Logo";

const bubbles = [
  { from: "user", text: "Explain recursion like I'm 5 🥲" },
  { from: "ai", text: "Picture mirrors facing mirrors — each one calls the next until the smallest case stops it." },
  { from: "user", text: "ohhh that actually clicks" },
];

export const TutorScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ padding: "70px 28px 30px", height: "100%", color: COLORS.text, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.indigo})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkle size={30} />
        </div>
        <div>
          <div style={{ fontFamily: FONT_HEAD, fontSize: 36, fontWeight: 800 }}>AI Tutor</div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 20, color: COLORS.emerald }}>● online · always</div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 20, paddingBottom: 20 }}>
        {bubbles.map((b, i) => {
          const s = spring({ frame: frame - 15 - i * 22, fps, config: { damping: 15 } });
          const isUser = b.from === "user";
          return (
            <div
              key={i}
              style={{
                alignSelf: isUser ? "flex-end" : "flex-start",
                maxWidth: "80%",
                transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px) scale(${interpolate(s, [0, 1], [0.9, 1])})`,
                opacity: s,
                background: isUser ? `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.indigo})` : COLORS.bgCard,
                border: isUser ? "none" : `1px solid ${COLORS.border}`,
                color: COLORS.text,
                borderRadius: 26,
                borderBottomRightRadius: isUser ? 8 : 26,
                borderBottomLeftRadius: isUser ? 26 : 8,
                padding: "20px 24px",
                fontFamily: FONT_BODY,
                fontSize: 28,
                lineHeight: 1.35,
                fontWeight: 500,
              }}
            >
              {b.text}
            </div>
          );
        })}
      </div>

      {/* input bar */}
      <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 22, padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: FONT_BODY, color: COLORS.muted, fontSize: 24 }}>Ask anything…</span>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: COLORS.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>➤</div>
      </div>
    </div>
  );
};
