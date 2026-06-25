// Generates the ad voiceover with ElevenLabs (one MP3 per scene) and measures each
// clip's length in frames for timeline syncing.
//
//   Requires promo/.env  ->  ELEVENLABS_API_KEY=sk_...
//   Optional: VOICE_NAME (default "Rachel"), MODEL_ID (default eleven_multilingual_v2)
//
// Run:  node scripts/generate-voiceover-eleven.mjs
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "public", "audio");
mkdirSync(outDir, { recursive: true });

// ---- load .env (no dependency) ----
function loadEnv() {
  const p = join(root, ".env");
  if (existsSync(p)) {
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv();

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error("\n✖ No ELEVENLABS_API_KEY found. Create promo/.env with:\n  ELEVENLABS_API_KEY=sk_your_key_here\n");
  process.exit(1);
}
const VOICE_NAME = process.env.VOICE_NAME || "Rachel";
const MODEL_ID = process.env.MODEL_ID || "eleven_multilingual_v2";
const FPS = 30;

// NOTE: regenerating these requires a PAID ElevenLabs plan — the free tier blocks
// premade/library voices via the API (HTTP 402). The committed vo1–vo9 audio in
// public/audio was generated from these exact lines and is reused as-is.
const LINES = [
  { id: "vo1", text: "Homework. Exams. Deadlines. It's chaos." },
  { id: "vo2", text: "Meet Study Flow — your entire study life, in perfect flow." },
  { id: "vo3", text: "Every class and deadline, on one clean timeline." },
  { id: "vo4", text: "Stuck? Your A.I. tutor explains anything, instantly." },
  { id: "vo5", text: "Switch on Focus Mode, lock in, and beat distraction." },
  { id: "vo6", text: "Track your marks and watch your insights climb." },
  { id: "vo7", text: "Earn X.P., level up, and rank up to Diamond Elite." },
  { id: "vo8", text: "Whatever your hand finds to do — do it with all your might." },
  { id: "vo9", text: "Study Flow. Stop planning. Start flowing." },
];

// Public/default ElevenLabs voice IDs — usable by ID even when not added to a library.
const KNOWN_VOICES = {
  rachel: "21m00Tcm4TlvDq8ikWAM",
  sarah: "EXAVITQu4vr4xnSDxMaL",
  aria: "9BWtsMINqrJLrRacOk9x",
  charlotte: "XB0fDUnXU5powFXDhCwa",
  laura: "FGY2WhTYpPnrIDTdsKH5",
};

async function resolveVoiceId() {
  // If an explicit id is provided, honour it.
  if (process.env.VOICE_ID) {
    console.log(`Voice: (explicit id) ${process.env.VOICE_ID}`);
    return process.env.VOICE_ID;
  }
  const res = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": API_KEY } });
  if (!res.ok) throw new Error(`/v1/voices failed: ${res.status} ${await res.text()}`);
  const { voices } = await res.json();
  const named =
    voices.find((v) => v.name?.toLowerCase() === VOICE_NAME.toLowerCase()) ||
    voices.find((v) => v.name?.toLowerCase().startsWith(VOICE_NAME.toLowerCase()));
  if (named) {
    console.log(`Voice: ${named.name} (${named.voice_id}) [from library]`);
    return named.voice_id;
  }
  // Not in the library — use the well-known public id for the requested name.
  const known = KNOWN_VOICES[VOICE_NAME.toLowerCase()];
  if (known) {
    console.log(`Voice: ${VOICE_NAME} (${known}) [public default id]`);
    return known;
  }
  const female = voices.find((v) => v.labels?.gender === "female") || voices[0];
  if (!female) throw new Error("No voices available on this account.");
  console.log(`Voice: ${female.name} (${female.voice_id}) [fallback]`);
  return female.voice_id;
}

async function tts(voiceId, text, outPath) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true },
    }),
  });
  if (!res.ok) throw new Error(`TTS failed (${res.status}): ${await res.text()}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
}

// ElevenLabs mp3_44100_128 is constant-bitrate 128 kbps, so duration ≈ bytes*8/128000.
function frames(file) {
  const bytes = readFileSync(file).length;
  const sec = (bytes * 8) / 128000;
  return Math.ceil(sec * FPS);
}

const voiceId = await resolveVoiceId();
const result = {};
for (const l of LINES) {
  const out = join(outDir, l.id + ".mp3");
  await tts(voiceId, l.text, out);
  const f = frames(out);
  result[l.id] = f;
  console.log(`wrote ${l.id}.mp3  ${f ?? "?"}f`);
}
console.log("\nVO frames:", JSON.stringify(result));
console.log("Update SCENES durations in src/AdPC.tsx so each scene = lead + these frames + tail.");
