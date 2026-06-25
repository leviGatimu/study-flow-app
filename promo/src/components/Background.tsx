import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS } from "../theme";

// Animated aurora / mesh-gradient background with a slow drifting grid.
export const Background: React.FC<{ hue?: number }> = ({ hue = 0 }) => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 300], [0, 60]);
  const blobA = interpolate(frame % 240, [0, 120, 240], [-120, 120, -120]);
  const blobB = interpolate(frame % 200, [0, 100, 200], [80, -80, 80]);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, overflow: "hidden" }}>
      {/* glow blobs */}
      <div
        style={{
          position: "absolute",
          top: `${20 + blobA * 0.1}%`,
          left: `${10 + blobB * 0.05}%`,
          width: 900,
          height: 900,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.primary}55, transparent 60%)`,
          filter: "blur(80px)",
          transform: `rotate(${hue}deg)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: `${10 + blobB * 0.1}%`,
          right: `${5 + blobA * 0.05}%`,
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.indigo}44, transparent 60%)`,
          filter: "blur(90px)",
        }}
      />
      {/* drifting grid */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${COLORS.border} 1px, transparent 1px), linear-gradient(90deg, ${COLORS.border} 1px, transparent 1px)`,
          backgroundSize: "90px 90px",
          backgroundPosition: `${drift}px ${drift}px`,
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          opacity: 0.5,
        }}
      />
      {/* vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
