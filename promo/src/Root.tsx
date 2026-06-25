import React from "react";
import { Composition } from "remotion";
import { Ad, AD_DURATION } from "./Ad";
import { AdPC, AD_PC_DURATION } from "./AdPC";
import { MidnightAd, MIDNIGHT_DURATION } from "./MidnightAd";
import { FlowAd, FLOW_DURATION } from "./v2/FlowAd";
import { FPS, WIDTH, HEIGHT, WIDTH_PC, HEIGHT_PC } from "./theme";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* v2 — all-new 2026 motion graphics + Higgsfield music & VO (16:9 master) */}
      <Composition
        id="StudyFlowV2"
        component={FlowAd}
        durationInFrames={FLOW_DURATION}
        fps={FPS}
        width={WIDTH_PC}
        height={HEIGHT_PC}
        defaultProps={{ withAudio: true, withMusic: true }}
      />

      {/* "Midnight" story, Higgsfield Inworld VO, 16:9 master */}
      <Composition
        id="StudyFlowMidnight"
        component={MidnightAd}
        durationInFrames={MIDNIGHT_DURATION}
        fps={FPS}
        width={WIDTH_PC}
        height={HEIGHT_PC}
        defaultProps={{ withAudio: true, withMusic: true }}
      />

      {/* PC / landscape 16:9 — the premium cut */}
      <Composition
        id="StudyFlowAdPC"
        component={AdPC}
        durationInFrames={AD_PC_DURATION}
        fps={FPS}
        width={WIDTH_PC}
        height={HEIGHT_PC}
        defaultProps={{ withAudio: true, withMusic: true }}
      />

      {/* Vertical 9:16 — social / Reels */}
      <Composition
        id="StudyFlowAd"
        component={Ad}
        durationInFrames={AD_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ withAudio: true, withMusic: true }}
      />
    </>
  );
};
