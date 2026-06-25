import React from "react";
import { AbsoluteFill, Sequence, Audio, staticFile, interpolate } from "remotion";
import { TransitionSeries, springTiming, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { COLORS } from "./theme";
import { Grain } from "./components/Grain";

import { HookPC } from "./pc/HookPC";
import { LogoPC } from "./pc/LogoPC";
import { FeaturePC } from "./pc/FeaturePC";
import { LevelUpPC } from "./pc/LevelUpPC";
import { VersePC } from "./pc/VersePC";
import { CTAPC } from "./pc/CTAPC";

import { TodayScreen } from "./components/screens/TodayScreen";
import { TutorScreen } from "./components/screens/TutorScreen";
import { FocusScreen } from "./components/screens/FocusScreen";
import { MarksScreen } from "./components/screens/MarksScreen";

// ===== Timeline config — durations tuned to the ElevenLabs VO (see scripts/measure.mjs). =====
const TR = 15; // transition length (frames)
const LEVEL_HIT = 52; // frame within LevelUp scene where "LEVEL UP" slams

// Durations = lead + measured Bella VO + tail (tail leaves room for the TR crossfade).
const SCENES = [
  { key: "hook", dur: 117 },
  { key: "logo", dur: 141 },
  { key: "today", dur: 139 },
  { key: "tutor", dur: 149 },
  { key: "focus", dur: 138 },
  { key: "marks", dur: 112 },
  { key: "level", dur: 132 },
  { key: "verse", dur: 130 },
  { key: "cta", dur: 141 },
] as const;

// Absolute content-start frame of each scene (TransitionSeries overlaps each cut by TR).
export const STARTS: Record<string, number> = {};
{
  let acc = 0;
  SCENES.forEach((s, i) => {
    STARTS[s.key] = acc;
    acc += s.dur - (i < SCENES.length - 1 ? TR : 0);
  });
}
export const AD_PC_DURATION = SCENES.reduce((a, s) => a + s.dur, 0) - TR * (SCENES.length - 1);

interface Props {
  withAudio: boolean;
  withMusic: boolean;
}

export const AdPC: React.FC<Props> = ({ withAudio, withMusic }) => {
  const D = (k: string) => SCENES.find((s) => s.key === k)!.dur;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* ===== VISUALS ===== */}
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={D("hook")}>
          <HookPC dur={D("hook")} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={springTiming({ config: { damping: 200 }, durationInFrames: TR })} presentation={fade()} />

        <TransitionSeries.Sequence durationInFrames={D("logo")}>
          <LogoPC dur={D("logo")} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={linearTiming({ durationInFrames: TR })} presentation={slide({ direction: "from-right" })} />

        <TransitionSeries.Sequence durationInFrames={D("today")}>
          <FeaturePC dur={D("today")} chip="TODAY'S FOCUS" title={["One timeline.", "*Zero chaos."]} body="Every class, homework and revision block — laid out for today, ordered by time." accent={COLORS.primary} screen={<TodayScreen />} side="right" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={linearTiming({ durationInFrames: TR })} presentation={wipe({ direction: "from-bottom-right" })} />

        <TransitionSeries.Sequence durationInFrames={D("tutor")}>
          <FeaturePC dur={D("tutor")} chip="AI TUTOR" title={["Stuck?", "*Just ask."]} body="A built-in AI tutor explains any topic, instantly — in words that actually click." accent={COLORS.indigo} screen={<TutorScreen />} side="left" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={linearTiming({ durationInFrames: TR })} presentation={slide({ direction: "from-left" })} />

        <TransitionSeries.Sequence durationInFrames={D("focus")}>
          <FeaturePC dur={D("focus")} chip="FOCUS MODE" title={["Lock in.", "*Beat distraction."]} body="A deep-work timer that rewards every minute you stay focused." accent={COLORS.cyan} screen={<FocusScreen />} side="right" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={linearTiming({ durationInFrames: TR })} presentation={wipe({ direction: "from-bottom-left" })} />

        <TransitionSeries.Sequence durationInFrames={D("marks")}>
          <FeaturePC dur={D("marks")} chip="INSIGHTS" title={["Watch your", "*marks climb."]} body="Track every grade and see your trend line rise, week after week." accent={COLORS.emerald} screen={<MarksScreen />} side="left" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={springTiming({ config: { damping: 200 }, durationInFrames: TR })} presentation={fade()} />

        <TransitionSeries.Sequence durationInFrames={D("level")}>
          <LevelUpPC dur={D("level")} hit={LEVEL_HIT} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={springTiming({ config: { damping: 200 }, durationInFrames: TR })} presentation={fade()} />

        <TransitionSeries.Sequence durationInFrames={D("verse")}>
          <VersePC dur={D("verse")} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={springTiming({ config: { damping: 200 }, durationInFrames: TR })} presentation={fade()} />

        <TransitionSeries.Sequence durationInFrames={D("cta")}>
          <CTAPC dur={D("cta")} />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      <Grain opacity={0.045} />

      {/* ===== AUDIO ===== */}
      {withMusic && (
        <Audio
          src={staticFile("audio/music.wav")}
          volume={(f) => interpolate(f, [0, 30, AD_PC_DURATION - 45, AD_PC_DURATION], [0, 0.26, 0.26, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        />
      )}

      {withAudio && (
        <>
          {/* Voiceover — one Rachel clip per scene */}
          <VO file="vo1" from={STARTS.hook + 4} />
          <VO file="vo2" from={STARTS.logo + 8} />
          <VO file="vo3" from={STARTS.today + 8} />
          <VO file="vo4" from={STARTS.tutor + 8} />
          <VO file="vo5" from={STARTS.focus + 8} />
          <VO file="vo6" from={STARTS.marks + 8} />
          <VO file="vo7" from={STARTS.level + 8} />
          <VO file="vo8" from={STARTS.verse + 10} />
          <VO file="vo9" from={STARTS.cta + 8} />

          {/* Sound design */}
          <Sfx file="boom" from={STARTS.logo} vol={0.7} />
          <Sfx file="swoosh" from={STARTS.today - 8} vol={0.5} />
          <Sfx file="swoosh" from={STARTS.tutor - 8} vol={0.5} />
          <Sfx file="swoosh" from={STARTS.focus - 8} vol={0.5} />
          <Sfx file="swoosh" from={STARTS.marks - 8} vol={0.5} />
          <Sfx file="chime" from={STARTS.today + 6} vol={0.35} />
          <Sfx file="chime" from={STARTS.tutor + 6} vol={0.35} />
          <Sfx file="chime" from={STARTS.focus + 6} vol={0.35} />
          <Sfx file="chime" from={STARTS.marks + 6} vol={0.35} />
          <Sfx file="riser" from={STARTS.level - 40} vol={0.45} />
          <Sfx file="impact" from={STARTS.level + LEVEL_HIT} vol={0.85} />
          <Sfx file="impact" from={STARTS.cta} vol={0.7} />
          <Sfx file="pop" from={STARTS.today + 42} vol={0.3} />
          <Sfx file="pop" from={STARTS.today + 54} vol={0.3} />
        </>
      )}
    </AbsoluteFill>
  );
};

const VO: React.FC<{ file: string; from: number }> = ({ file, from }) => (
  <Sequence from={from}>
    <Audio src={staticFile(`audio/${file}.mp3`)} volume={1} />
  </Sequence>
);

const Sfx: React.FC<{ file: string; from: number; vol: number }> = ({ file, from, vol }) => (
  <Sequence from={Math.max(0, from)}>
    <Audio src={staticFile(`audio/${file}.wav`)} volume={vol} />
  </Sequence>
);
