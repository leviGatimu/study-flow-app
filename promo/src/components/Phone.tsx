import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS } from "../theme";

// A premium phone shell to frame the app mock screens.
export const Phone: React.FC<{
  children: React.ReactNode;
  width?: number;
  glare?: boolean;
}> = ({ children, width = 560, glare = false }) => {
  const height = width * 2.06;
  const frame = useCurrentFrame();
  const sweep = interpolate(frame, [10, 55], [-40, 140], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        width,
        height,
        borderRadius: width * 0.13,
        padding: 14,
        background: "linear-gradient(160deg, #2A2D38, #0E0F14)",
        boxShadow:
          "0 60px 120px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.05), inset 0 0 0 2px rgba(0,0,0,0.4)",
        position: "relative",
      }}
    >
      {/* screen */}
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: width * 0.1,
          background: COLORS.bg,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {children}
        {glare && (
          <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
            <div
              style={{
                position: "absolute",
                inset: "-40%",
                background: `linear-gradient(115deg, transparent ${sweep - 14}%, rgba(255,255,255,0.16) ${sweep}%, transparent ${sweep + 14}%)`,
              }}
            />
          </AbsoluteFill>
        )}
      </div>
      {/* notch */}
      <div
        style={{
          position: "absolute",
          top: 26,
          left: "50%",
          transform: "translateX(-50%)",
          width: width * 0.34,
          height: 30,
          borderRadius: 18,
          background: "#000",
          zIndex: 5,
        }}
      />
    </div>
  );
};

// Reusable glass card used inside mock screens.
export const GlassCard: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  accent?: string;
}> = ({ children, style, accent }) => (
  <div
    style={{
      background: COLORS.bgCard,
      border: `1px solid ${COLORS.border}`,
      borderLeft: accent ? `4px solid ${accent}` : `1px solid ${COLORS.border}`,
      borderRadius: 22,
      padding: 22,
      boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
      ...style,
    }}
  >
    {children}
  </div>
);
