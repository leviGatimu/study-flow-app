import React from "react";
import { AbsoluteFill, Sequence, Audio, staticFile, useCurrentFrame, interpolate } from "remotion";
import { COLORS } from "./theme";
import { Grain } from "./components/Grain";

import { Hook } from "./scenes/Hook";
import { LogoReveal } from "./scenes/LogoReveal";
import { FeatureScene } from "./scenes/FeatureScene";
import { LevelUp } from "./scenes/LevelUp";
import { Verse } from "./scenes/Verse";
import { CTA } from "./scenes/CTA";

import { TodayScreen } from "./components/screens/TodayScreen";
import { TutorScreen } from "./components/screens/TutorScreen";
import { FocusScreen } from "./components/screens/FocusScreen";
import { MarksScreen } from "./components/screens/MarksScreen";

// ---- Scene timeline (frames @ 30fps) ----
// Durations are tuned to the measured voiceover length of each scene
// (lead-in + narration + tail) so visuals and VO stay locked together.
const T = {
  hook: { from: 0, dur: 124 },
  logo: { from: 124, dur: 143 },
  today: { from: 267, dur: 108 },
  tutor: { from: 375, dur: 130 },
  focus: { from: 505, dur: 118 },
  marks: { from: 623, dur: 96 },
  level: { from: 719, dur: 123 },
  verse: { from: 842, dur: 119 },
  cta: { from: 961, dur: 146 },
};
export const AD_DURATION = 1107; // ~37s

// White flash at each hard cut for punchy transitions.
const cuts = [124, 267, 375, 505, 623, 719, 842, 961];
const Flashes: React.FC = () => {
  const frame = useCurrentFrame();
  const o = cuts.reduce((acc, c) => {
    const v = interpolate(frame, [c - 3, c, c + 5], [0, 0.5, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return Math.max(acc, v);
  }, 0);
  return <AbsoluteFill style={{ backgroundColor: "#fff", opacity: o, pointerEvents: "none" }} />;
};

interface Props {
  withAudio: boolean;
  withMusic: boolean;
}

export const Ad: React.FC<Props> = ({ withAudio, withMusic }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* ===== VISUALS ===== */}
      <Sequence from={T.hook.from} durationInFrames={T.hook.dur}><Hook /></Sequence>
      <Sequence from={T.logo.from} durationInFrames={T.logo.dur}><LogoReveal /></Sequence>

      <Sequence from={T.today.from} durationInFrames={T.today.dur}>
        <FeatureScene chip="TODAY'S FOCUS" title="Every *deadline. One timeline." accent={COLORS.primary} screen={<TodayScreen />} side="right" />
      </Sequence>
      <Sequence from={T.tutor.from} durationInFrames={T.tutor.dur}>
        <FeatureScene chip="AI TUTOR" title="Stuck? Just *ask." accent={COLORS.indigo} screen={<TutorScreen />} side="left" />
      </Sequence>
      <Sequence from={T.focus.from} durationInFrames={T.focus.dur}>
        <FeatureScene chip="FOCUS MODE" title="Lock in. *Beat distraction." accent={COLORS.cyan} screen={<FocusScreen />} side="right" />
      </Sequence>
      <Sequence from={T.marks.from} durationInFrames={T.marks.dur}>
        <FeatureScene chip="INSIGHTS" title="Watch your *marks climb." accent={COLORS.emerald} screen={<MarksScreen />} side="left" />
      </Sequence>

      <Sequence from={T.level.from} durationInFrames={T.level.dur}><LevelUp /></Sequence>
      <Sequence from={T.verse.from} durationInFrames={T.verse.dur}><Verse /></Sequence>
      <Sequence from={T.cta.from} durationInFrames={T.cta.dur}><CTA /></Sequence>

      <Flashes />
      <Grain opacity={0.05} />

      {/* ===== AUDIO ===== */}
      {withMusic && (
        <Audio src={staticFile("audio/music.wav")} volume={(f) => interpolate(f, [0, 30, AD_DURATION - 40, AD_DURATION], [0, 0.28, 0.28, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      )}

      {withAudio && (
        <>
          {/* Voiceover — one clip per scene */}
          <VO file="vo1" from={T.hook.from + 6} />
          <VO file="vo2" from={T.logo.from + 6} />
          <VO file="vo3" from={T.today.from + 6} />
          <VO file="vo4" from={T.tutor.from + 6} />
          <VO file="vo5" from={T.focus.from + 6} />
          <VO file="vo6" from={T.marks.from + 6} />
          <VO file="vo7" from={T.level.from + 6} />
          <VO file="vo8" from={T.verse.from + 8} />
          <VO file="vo9" from={T.cta.from + 6} />

          {/* Sound design */}
          <Sfx file="whoosh" from={T.logo.from - 4} vol={0.5} />
          <Sfx file="whoosh" from={T.today.from - 4} vol={0.45} />
          <Sfx file="whoosh" from={T.tutor.from - 4} vol={0.45} />
          <Sfx file="whoosh" from={T.focus.from - 4} vol={0.45} />
          <Sfx file="whoosh" from={T.marks.from - 4} vol={0.45} />
          <Sfx file="riser" from={T.level.from - 45} vol={0.4} />
          <Sfx file="impact" from={T.level.from + 46} vol={0.7} />
          <Sfx file="impact" from={T.cta.from} vol={0.6} />
          <Sfx file="pop" from={T.today.from + 40} vol={0.3} />
          <Sfx file="pop" from={T.today.from + 52} vol={0.3} />
        </>
      )}
    </AbsoluteFill>
  );
};

const VO: React.FC<{ file: string; from: number }> = ({ file, from }) => (
  <Sequence from={from}>
    <Audio src={staticFile(`audio/${file}.wav`)} volume={1} />
  </Sequence>
);

const Sfx: React.FC<{ file: string; from: number; vol: number }> = ({ file, from, vol }) => (
  <Sequence from={from}>
    <Audio src={staticFile(`audio/${file}.wav`)} volume={vol} />
  </Sequence>
);
