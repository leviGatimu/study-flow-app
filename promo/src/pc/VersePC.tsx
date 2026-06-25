import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS } from "../theme";
import { FONT_DISPLAY, FONT_BODY } from "../lib/fonts";
import { WordStagger } from "../anim/Text";
import { Camera, Particles, Grade } from "../components/Cinematic";

export const VersePC: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: "#05060A", alignItems: "center", justifyContent: "center", padding: 140 }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, ${COLORS.primary}18, transparent 62%)`, opacity: interpolate(frame, [0, 40], [0, 1]) }} />
      <Particles count={14} color={COLORS.primary} />
      <Camera dur={dur} from={1.0} to={1.06}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
          <div style={{ fontFamily: FONT_BODY, fontSize: 32, letterSpacing: 8, color: COLORS.primary, marginBottom: 56, opacity: interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" }) }}>
            ECCLESIASTES 9:10
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 96, lineHeight: 1.22, textAlign: "center", color: COLORS.text, maxWidth: 1500, letterSpacing: -2 }}>
            <WordStagger
              text="Whatever your hand finds to do, do it with all your might."
              delay={10}
              stagger={4}
              highlight={["do", "might"]}
              highlightColor={COLORS.primary}
            />
          </div>
        </AbsoluteFill>
      </Camera>
      <Grade />
    </AbsoluteFill>
  );
};
