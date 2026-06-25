import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS } from "../theme";

// Wide animated mesh-gradient background tuned for 16:9, with a per-scene accent hue.
export const BackgroundPC: React.FC<{ accent?: string; accent2?: string }> = ({
  accent = COLORS.primary,
  accent2 = COLORS.indigo,
}) => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 400], [0, 80]);
  const a = interpolate(frame % 300, [0, 150, 300], [-1, 1, -1]);
  const b = interpolate(frame % 260, [0, 130, 260], [1, -1, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: `${10 + a * 8}%`,
          left: `${8 + b * 5}%`,
          width: 1200,
          height: 1200,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent}55, transparent 62%)`,
          filter: "blur(110px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: `${5 + b * 8}%`,
          right: `${6 + a * 5}%`,
          width: 1100,
          height: 1100,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent2}44, transparent 62%)`,
          filter: "blur(120px)",
        }}
      />
      {/* perspective grid floor */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${COLORS.border} 1px, transparent 1px), linear-gradient(90deg, ${COLORS.border} 1px, transparent 1px)`,
          backgroundSize: "120px 120px",
          backgroundPosition: `${drift}px ${drift}px`,
          maskImage: "radial-gradient(ellipse 80% 70% at center, black 25%, transparent 85%)",
          opacity: 0.35,
        }}
      />
    </AbsoluteFill>
  );
};
