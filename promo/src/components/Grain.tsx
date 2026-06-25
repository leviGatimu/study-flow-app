import React from "react";
import { AbsoluteFill, useCurrentFrame, random } from "remotion";

// Subtle animated film grain for a cinematic, less-digital feel.
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.06 }) => {
  const frame = useCurrentFrame();
  // Reseed every frame so the noise shimmers.
  const seed = Math.floor(random(`grain-${frame}`) * 1000);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity, mixBlendMode: "overlay" }}>
      <svg width="100%" height="100%">
        <filter id={`noise-${seed}`}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            seed={seed}
          />
        </filter>
        <rect width="100%" height="100%" filter={`url(#noise-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};
