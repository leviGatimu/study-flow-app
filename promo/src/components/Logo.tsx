import React from "react";
import { COLORS } from "../theme";

// Recreates the app's sparkle logo: rounded square tile with a 4-point star.
export const Logo: React.FC<{ size?: number; glow?: boolean }> = ({
  size = 120,
  glow = true,
}) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.indigo})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: glow
          ? `0 0 ${size * 0.5}px ${COLORS.primary}88, inset 0 2px 6px rgba(255,255,255,0.25)`
          : "none",
      }}
    >
      <Sparkle size={size * 0.56} />
    </div>
  );
};

export const Sparkle: React.FC<{ size?: number; color?: string }> = ({
  size = 60,
  color = "#fff",
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M12 2c.6 4.8 2.6 6.8 7.4 7.4-4.8.6-6.8 2.6-7.4 7.4-.6-4.8-2.6-6.8-7.4-7.4C9.4 8.8 11.4 6.8 12 2z"
      fill={color}
    />
    <path
      d="M18.5 14.5c.3 2.2 1.2 3.1 3.4 3.4-2.2.3-3.1 1.2-3.4 3.4-.3-2.2-1.2-3.1-3.4-3.4 2.2-.3 3.1-1.2 3.4-3.4z"
      fill={color}
      opacity={0.85}
    />
  </svg>
);
