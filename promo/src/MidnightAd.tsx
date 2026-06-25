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

// ===== Timeline tuned to the single continuous Higgsfield (Inworld "Olivia") VO,
// public/audio/vo-new.wav ≈ 44.9s. Scene shares ≈ each beat's spoken length. =====
const TR = 15;
const LEVEL_HIT = 48;

const SCENES = [
  { key: "hook", dur: 210 },   // "It's almost midnight... an exam you forgot about."
  { key: "logo", dur: 180 },   // "What if your whole study life could organize itself? Meet Study Flow."
  { key: "today", dur: 280 },  // timeline + snap-your-timetable AI planning
  { key: "tutor", dur: 160 },  // AI tutor
  { key: "focus", dur: 120 },  // Focus Mode
  { key: "marks", dur: 110 },  // marks climb
  { key: "level", dur: 120 },  // streak grows / level up
  { key: "verse", dur: 150 },  // Ecclesiastes 9:10
  { key: "cta", dur: 130 },    // Stop surviving school. Start owning it.
] as const;

export const STARTS: Record<string, number> = {};
{
  let acc = 0;
  SCENES.forEach((s, i) => {
    STARTS[s.key] = acc;
    acc += s.dur - (i < SCENES.length - 1 ? TR : 0);
  });
}
export const MIDNIGHT_DURATION = SCENES.reduce((a, s) => a + s.dur, 0) - TR * (SCENES.length - 1);

interface Props {
  withAudio: boolean;
  withMusic: boolean;
}

export const MidnightAd: React.FC<Props> = ({ withAudio, withMusic }) => {
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
          <FeaturePC dur={D("today")} chip="ONE TIMELINE" title={["One timeline.", "*Zero chaos."]} body="Every class, deadline and revision block in one place — or just snap your timetable and let A.I. plan the rest." accent={COLORS.primary} screen={<TodayScreen />} side="right" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={linearTiming({ durationInFrames: TR })} presentation={wipe({ direction: "from-bottom-right" })} />

        <TransitionSeries.Sequence durationInFrames={D("tutor")}>
          <FeaturePC dur={D("tutor")} chip="AI TUTOR" title={["Stuck?", "*Just ask."]} body="Your A.I. tutor explains any topic, instantly — in plain words that actually click." accent={COLORS.indigo} screen={<TutorScreen />} side="left" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={linearTiming({ durationInFrames: TR })} presentation={slide({ direction: "from-left" })} />

        <TransitionSeries.Sequence durationInFrames={D("focus")}>
          <FeaturePC dur={D("focus")} chip="FOCUS MODE" title={["Music in.", "*World out."]} body="A deep-work timer with focus music that rewards every minute you stay locked in." accent={COLORS.cyan} screen={<FocusScreen />} side="right" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={linearTiming({ durationInFrames: TR })} presentation={wipe({ direction: "from-bottom-left" })} />

        <TransitionSeries.Sequence durationInFrames={D("marks")}>
          <FeaturePC dur={D("marks")} chip="INSIGHTS" title={["Watch your", "*marks climb."]} body="Track every grade and watch your trend line rise, week after week." accent={COLORS.emerald} screen={<MarksScreen />} side="left" />
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
          volume={(f) => interpolate(f, [0, 30, MIDNIGHT_DURATION - 45, MIDNIGHT_DURATION], [0, 0.24, 0.24, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        />
      )}

      {withAudio && (
        <>
          {/* Continuous Higgsfield voiceover (one take) */}
          <Sequence from={6}>
            <Audio src={staticFile("audio/vo-new.wav")} volume={1} />
          </Sequence>

          {/* Sound design — cues mapped to the new beat starts */}
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
        </>
      )}
    </AbsoluteFill>
  );
};

const Sfx: React.FC<{ file: string; from: number; vol: number }> = ({ file, from, vol }) => (
  <Sequence from={Math.max(0, from)}>
    <Audio src={staticFile(`audio/${file}.wav`)} volume={vol} />
  </Sequence>
);
