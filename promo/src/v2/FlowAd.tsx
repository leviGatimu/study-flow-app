import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Grain } from "../components/Grain";
import { FONT_BODY, FONT_HEAD, FONT_DISPLAY } from "../lib/fonts";
import { Mesh, Glass, Rise, Pop, Chip, PALETTE, ease } from "./primitives";

const TR = 14;
const LEVEL_HIT = 46;

const SCENES = [
  { key: "hook", dur: 210 },
  { key: "logo", dur: 180 },
  { key: "today", dur: 280 },
  { key: "tutor", dur: 160 },
  { key: "focus", dur: 120 },
  { key: "marks", dur: 110 },
  { key: "level", dur: 120 },
  { key: "verse", dur: 150 },
  { key: "cta", dur: 130 },
] as const;

const STARTS: Record<string, number> = {};
{
  let acc = 0;
  SCENES.forEach((s, i) => {
    STARTS[s.key] = acc;
    acc += s.dur - (i < SCENES.length - 1 ? TR : 0);
  });
}
export const FLOW_DURATION = SCENES.reduce((a, s) => a + s.dur, 0) - TR * (SCENES.length - 1);
const D = (k: string) => SCENES.find((s) => s.key === k)!.dur;

// ============================================================ SCENES

const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  // subtle anxious jitter that settles
  const jit = interpolate(frame, [0, 70], [3, 0], { extrapolateRight: "clamp" });
  const shake = Math.sin(frame * 1.7) * jit;
  return (
    <AbsoluteFill>
      <Mesh colors={[PALETTE.rose, PALETTE.violet, "#7c1d3a"]} intensity={0.8} speed={1.2} />
      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 160, transform: `translateX(${shake}px)` }}>
        <div style={{ maxWidth: 1300 }}>
          <Rise delay={4} style={{ marginBottom: 26 }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 34, letterSpacing: "0.2em", color: PALETTE.rose }}>
              11:47 PM
            </span>
          </Rise>
          <Rise delay={16}>
            <h1 style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 150, lineHeight: 0.98, color: PALETTE.text, margin: 0, letterSpacing: "-0.03em" }}>
              Three deadlines.
            </h1>
          </Rise>
          <Rise delay={30}>
            <h1 style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 150, lineHeight: 1.0, margin: 0, letterSpacing: "-0.03em", color: PALETTE.text }}>
              One exam you
            </h1>
          </Rise>
          <Rise delay={40}>
            <h1 style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 150, lineHeight: 1.0, margin: 0, letterSpacing: "-0.03em", color: PALETTE.rose }}>
              forgot about.
            </h1>
          </Rise>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Wordmark: React.FC<{ size?: number; delay?: number }> = ({ size = 168, delay = 0 }) => {
  const frame = useCurrentFrame();
  const t = ease(frame, delay, 30);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.18, transform: `scale(${0.9 + t * 0.1})`, opacity: t, filter: `blur(${(1 - t) * 10}px)` }}>
      <div
        style={{
          width: size * 0.92,
          height: size * 0.92,
          borderRadius: size * 0.26,
          background: `linear-gradient(140deg, ${PALETTE.blue}, ${PALETTE.indigo})`,
          boxShadow: `0 24px 80px -18px ${PALETTE.blue}aa, inset 0 2px 0 rgba(255,255,255,0.35)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT_HEAD,
          fontWeight: 800,
          fontSize: size * 0.55,
          color: "#fff",
        }}
      >
        S
      </div>
      <span style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: size, letterSpacing: "-0.04em", color: PALETTE.text }}>
        Study<span style={{ color: PALETTE.blue }}>Flow</span>
      </span>
    </div>
  );
};

const LogoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const bloom = ease(frame, 0, 40);
  const sweepX = interpolate(frame, [10, 50], [-60, 160], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <Mesh colors={[PALETTE.blue, PALETTE.indigo, PALETTE.violet]} intensity={0.95} />
      {/* central bloom */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ position: "absolute", width: 900, height: 900, borderRadius: "50%", background: `radial-gradient(circle, ${PALETTE.blue}55, transparent 60%)`, transform: `scale(${0.6 + bloom * 0.8})`, opacity: bloom * 0.9, filter: "blur(40px)" }} />
        <div style={{ position: "relative", overflow: "hidden" }}>
          <Wordmark />
          {/* light sweep */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.45) 50%, transparent 60%)", transform: `translateX(${sweepX}%)`, mixBlendMode: "overlay" }} />
        </div>
        <div style={{ marginTop: 40 }}>
          <Rise delay={26}>
            <span style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 34, color: PALETTE.muted, letterSpacing: "0.02em" }}>
              Your entire study life — in flow.
            </span>
          </Rise>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Feature: React.FC<{
  chip: string;
  lines: [string, string];
  body: string;
  accent: string;
  meshColors: string[];
  screen: React.ReactNode;
  side?: "left" | "right";
}> = ({ chip, lines, body, accent, meshColors, screen, side = "right" }) => {
  const frame = useCurrentFrame();
  const float = Math.sin(frame * 0.04) * 10;
  const textCol = (
    <div style={{ flex: 1, maxWidth: 720 }}>
      <Pop delay={6}><Chip color={accent} font={FONT_DISPLAY}>{chip}</Chip></Pop>
      <div style={{ marginTop: 28 }}>
        <Rise delay={12}>
          <h2 style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 116, lineHeight: 0.98, margin: 0, letterSpacing: "-0.03em", color: PALETTE.text }}>{lines[0]}</h2>
        </Rise>
        <Rise delay={22}>
          <h2 style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 116, lineHeight: 1.02, margin: 0, letterSpacing: "-0.03em", color: accent }}>{lines[1]}</h2>
        </Rise>
      </div>
      <Pop delay={34} y={18}>
        <p style={{ fontFamily: FONT_BODY, fontWeight: 500, fontSize: 30, lineHeight: 1.5, color: PALETTE.muted, marginTop: 30, maxWidth: 620 }}>{body}</p>
      </Pop>
    </div>
  );
  const screenCol = (
    <div style={{ flex: 1, display: "flex", justifyContent: "center", transform: `translateY(${float}px)` }}>
      <Pop delay={10} from={0.9} y={40}>{screen}</Pop>
    </div>
  );
  return (
    <AbsoluteFill>
      <Mesh colors={meshColors} intensity={0.85} />
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", gap: 80, padding: "0 150px" }}>
        {side === "right" ? (<>{textCol}{screenCol}</>) : (<>{screenCol}{textCol}</>)}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---- glass screens ----
const TimelineScreen: React.FC = () => {
  const rows = [
    { t: "08:00", s: "Calculus — Lecture", c: PALETTE.blue },
    { t: "11:30", s: "Physics Lab report", c: PALETTE.rose },
    { t: "15:00", s: "AI: revise Chapter 7", c: PALETTE.indigo },
    { t: "19:00", s: "Focus block — Essay", c: PALETTE.cyan },
  ];
  return (
    <Glass style={{ width: 720, padding: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <span style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 34, color: PALETTE.text }}>Today</span>
        <span style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 20, color: PALETTE.muted }}>Mon, Jun 15</span>
      </div>
      {rows.map((r, i) => (
        <Pop key={i} delay={20 + i * 9} y={20} from={0.96}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderLeft: `4px solid ${r.c}`, borderRadius: 18, padding: "20px 22px", marginBottom: 14 }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22, color: r.c, minWidth: 84 }}>{r.t}</span>
            <span style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 26, color: PALETTE.text }}>{r.s}</span>
          </div>
        </Pop>
      ))}
    </Glass>
  );
};

const TutorScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const full = "Think of a derivative as speed — how fast something changes at one instant.";
  const chars = Math.floor(ease(frame, 34, 70) * full.length);
  return (
    <Glass style={{ width: 720, padding: 36, display: "flex", flexDirection: "column", gap: 18 }}>
      <Pop delay={16} y={16}>
        <div style={{ alignSelf: "flex-end", marginLeft: "auto", maxWidth: 460, background: PALETTE.blue, color: "#fff", borderRadius: "22px 22px 6px 22px", padding: "18px 24px", fontFamily: FONT_BODY, fontWeight: 600, fontSize: 26 }}>
          Explain derivatives like I&apos;m 12.
        </div>
      </Pop>
      <Pop delay={30} y={16}>
        <div style={{ maxWidth: 560, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: PALETTE.text, borderRadius: "22px 22px 22px 6px", padding: "18px 24px", fontFamily: FONT_BODY, fontWeight: 500, fontSize: 26, lineHeight: 1.45 }}>
          {full.slice(0, chars)}
          <span style={{ opacity: Math.sin(frame * 0.6) > 0 ? 1 : 0, color: PALETTE.indigo }}>▍</span>
        </div>
      </Pop>
    </Glass>
  );
};

const FocusScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const p = ease(frame, 16, 80);
  const R = 150;
  const C = 2 * Math.PI * R;
  return (
    <Glass style={{ width: 620, padding: 50, display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
      <div style={{ position: "relative", width: 360, height: 360 }}>
        <svg width={360} height={360} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={180} cy={180} r={R} stroke="rgba(255,255,255,0.08)" strokeWidth={16} fill="none" />
          <circle cx={180} cy={180} r={R} stroke={PALETTE.cyan} strokeWidth={16} fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - p)} style={{ filter: `drop-shadow(0 0 16px ${PALETTE.cyan})` }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 76, color: PALETTE.text }}>24:00</span>
          <span style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 18, letterSpacing: "0.3em", color: PALETTE.cyan }}>DEEP FOCUS</span>
        </div>
      </div>
      <Pop delay={40} y={14}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, color: PALETTE.muted, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 22 }}>
          <span style={{ width: 12, height: 12, borderRadius: 99, background: PALETTE.cyan }} /> Lo-fi focus · now playing
        </div>
      </Pop>
    </Glass>
  );
};

const MarksScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const p = ease(frame, 18, 70);
  const pts = [
    [40, 300], [180, 250], [320, 270], [460, 180], [600, 150], [680, 70],
  ];
  const path = pts.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt[0]} ${pt[1]}`).join(" ");
  const len = 1100;
  return (
    <Glass style={{ width: 720, padding: 44 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
        <span style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 32, color: PALETTE.text }}>Average</span>
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 56, color: PALETTE.emerald }}>{Math.round(p * 92)}%</span>
      </div>
      <svg width={680} height={340}>
        <path d={path} fill="none" stroke={PALETTE.emerald} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - p)} style={{ filter: `drop-shadow(0 0 14px ${PALETTE.emerald}aa)` }} />
        {pts.map((pt, i) => (
          <circle key={i} cx={pt[0]} cy={pt[1]} r={7} fill={PALETTE.emerald} opacity={ease(frame, 26 + i * 6, 12)} />
        ))}
      </svg>
    </Glass>
  );
};

const LevelScene: React.FC<{ hit: number }> = ({ hit }) => {
  const frame = useCurrentFrame();
  const pre = ease(frame, 6, hit - 10);
  const slam = frame >= hit ? interpolate(frame - hit, [0, 6, 16], [1.5, 0.94, 1], { extrapolateRight: "clamp" }) : 1.5;
  const slamO = ease(frame, hit, 6);
  const xp = ease(frame, hit + 8, 40);
  return (
    <AbsoluteFill>
      <Mesh colors={[PALETTE.violet, PALETTE.amber, PALETTE.blue]} intensity={1} speed={1.3} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 40 }}>
        <span style={{ opacity: pre, fontFamily: FONT_BODY, fontWeight: 800, fontSize: 26, letterSpacing: "0.4em", color: PALETTE.amber }}>YOU JUST</span>
        <h1 style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 220, margin: 0, letterSpacing: "-0.04em", color: "#fff", transform: `scale(${slam})`, opacity: slamO, textShadow: `0 30px 90px ${PALETTE.violet}` }}>
          LEVELED UP
        </h1>
        {/* XP bar */}
        <div style={{ width: 760, height: 22, borderRadius: 99, background: "rgba(255,255,255,0.1)", overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)" }}>
          <div style={{ width: `${xp * 100}%`, height: "100%", background: `linear-gradient(90deg, ${PALETTE.amber}, ${PALETTE.violet})`, boxShadow: `0 0 24px ${PALETTE.amber}` }} />
        </div>
        <Pop delay={hit + 20} from={0.6}>
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 30, letterSpacing: "0.2em", color: PALETTE.text, border: `1px solid ${PALETTE.amber}55`, background: `${PALETTE.amber}1a`, padding: "12px 26px", borderRadius: 999 }}>
            ◆ DIAMOND ELITE
          </span>
        </Pop>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const VerseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 150], [0, -16]);
  return (
    <AbsoluteFill style={{ background: "#04050A" }}>
      <Mesh colors={["#11204a", "#1a1340", "#0a1830"]} intensity={0.5} speed={0.6} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 280px", transform: `translateY(${drift}px)` }}>
        <div style={{ textAlign: "center" }}>
          <Rise delay={6} dur={40} y={40} blur={20}>
            <p style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 64, lineHeight: 1.3, color: PALETTE.text, margin: 0, letterSpacing: "-0.01em" }}>
              “Whatever your hand finds to do, do it with all your might.”
            </p>
          </Rise>
          <Pop delay={46} y={14}>
            <span style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 22, letterSpacing: "0.3em", color: PALETTE.muted }}>ECCLESIASTES 9:10</span>
          </Pop>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const glow = 0.5 + Math.sin(frame * 0.1) * 0.3;
  return (
    <AbsoluteFill>
      <Mesh colors={[PALETTE.blue, PALETTE.indigo, PALETTE.violet]} intensity={1} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 44 }}>
        <Pop delay={4} from={0.85}><Wordmark size={120} /></Pop>
        <div style={{ textAlign: "center" }}>
          <Rise delay={18}>
            <span style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 56, color: PALETTE.muted }}>Stop surviving school.</span>
          </Rise>
          <Rise delay={28}>
            <span style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 84, letterSpacing: "-0.03em", background: `linear-gradient(90deg, ${PALETTE.cyan}, ${PALETTE.blue}, ${PALETTE.violet})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
              Start owning it.
            </span>
          </Rise>
        </div>
        <Pop delay={44} from={0.8}>
          <div style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 30, color: "#fff", background: `linear-gradient(140deg, ${PALETTE.blue}, ${PALETTE.indigo})`, padding: "22px 56px", borderRadius: 999, boxShadow: `0 20px 60px -10px ${PALETTE.blue}, 0 0 ${40 + glow * 40}px ${PALETTE.blue}88` }}>
            Get Study Flow
          </div>
        </Pop>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================================ COMPOSITION

interface Props {
  withAudio: boolean;
  withMusic: boolean;
}

export const FlowAd: React.FC<Props> = ({ withAudio, withMusic }) => {
  const { durationInFrames } = useVideoConfig();
  const tr = () => <TransitionSeries.Transition timing={springTiming({ config: { damping: 200 }, durationInFrames: TR })} presentation={fade()} />;

  return (
    <AbsoluteFill style={{ backgroundColor: PALETTE.bg }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={D("hook")}><HookScene /></TransitionSeries.Sequence>
        {tr()}
        <TransitionSeries.Sequence durationInFrames={D("logo")}><LogoScene /></TransitionSeries.Sequence>
        {tr()}
        <TransitionSeries.Sequence durationInFrames={D("today")}>
          <Feature chip="One Timeline" lines={["One timeline.", "Zero chaos."]} body="Every class, deadline and revision block in one place — or snap your timetable and let A.I. plan the rest." accent={PALETTE.blue} meshColors={[PALETTE.blue, PALETTE.indigo, "#102a6a"]} screen={<TimelineScreen />} side="right" />
        </TransitionSeries.Sequence>
        {tr()}
        <TransitionSeries.Sequence durationInFrames={D("tutor")}>
          <Feature chip="AI Tutor" lines={["Stuck?", "Just ask."]} body="Your A.I. tutor explains any topic, instantly — in words that actually click." accent={PALETTE.indigo} meshColors={[PALETTE.indigo, PALETTE.violet, "#241a5e"]} screen={<TutorScreen />} side="left" />
        </TransitionSeries.Sequence>
        {tr()}
        <TransitionSeries.Sequence durationInFrames={D("focus")}>
          <Feature chip="Focus Mode" lines={["Music in.", "World out."]} body="A deep-work timer with focus music that rewards every minute you stay locked in." accent={PALETTE.cyan} meshColors={[PALETTE.cyan, PALETTE.blue, "#0b3a4a"]} screen={<FocusScreen />} side="right" />
        </TransitionSeries.Sequence>
        {tr()}
        <TransitionSeries.Sequence durationInFrames={D("marks")}>
          <Feature chip="Insights" lines={["Watch it", "climb."]} body="Track every grade and watch your trend line rise, week after week." accent={PALETTE.emerald} meshColors={[PALETTE.emerald, PALETTE.cyan, "#0c3a30"]} screen={<MarksScreen />} side="left" />
        </TransitionSeries.Sequence>
        {tr()}
        <TransitionSeries.Sequence durationInFrames={D("level")}><LevelScene hit={LEVEL_HIT} /></TransitionSeries.Sequence>
        {tr()}
        <TransitionSeries.Sequence durationInFrames={D("verse")}><VerseScene /></TransitionSeries.Sequence>
        {tr()}
        <TransitionSeries.Sequence durationInFrames={D("cta")}><CTAScene /></TransitionSeries.Sequence>
      </TransitionSeries>

      <Grain opacity={0.05} />

      {withMusic && (
        <Audio src={staticFile("audio/music-v2.m4a")} volume={(f) => interpolate(f, [0, 24, durationInFrames - 50, durationInFrames], [0, 0.28, 0.28, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      )}

      {withAudio && (
        <>
          <Sequence from={6}><Audio src={staticFile("audio/vo-new.wav")} volume={1.1} /></Sequence>
          <Sfx file="boom" from={STARTS.logo} vol={0.6} />
          <Sfx file="swoosh" from={STARTS.today - 8} vol={0.45} />
          <Sfx file="swoosh" from={STARTS.tutor - 8} vol={0.45} />
          <Sfx file="swoosh" from={STARTS.focus - 8} vol={0.45} />
          <Sfx file="swoosh" from={STARTS.marks - 8} vol={0.45} />
          <Sfx file="chime" from={STARTS.today + 8} vol={0.3} />
          <Sfx file="chime" from={STARTS.tutor + 8} vol={0.3} />
          <Sfx file="chime" from={STARTS.focus + 8} vol={0.3} />
          <Sfx file="riser" from={STARTS.level - 40} vol={0.5} />
          <Sfx file="impact" from={STARTS.level + LEVEL_HIT} vol={0.9} />
          <Sfx file="impact" from={STARTS.cta} vol={0.6} />
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
