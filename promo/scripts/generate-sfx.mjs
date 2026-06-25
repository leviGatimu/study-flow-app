// Procedural sound design + a modern, sidechained music bed for the ad.
// Pure Node, no deps. Writes 16-bit PCM mono WAVs to public/audio/.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 44100;
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "public", "audio");
mkdirSync(outDir, { recursive: true });

const dur = (s) => Math.floor(SR * s);
const rnd = () => Math.random() * 2 - 1;
const clamp = (x) => Math.max(-1, Math.min(1, x));

function writeWav(name, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE((clamp(samples[i]) * 32767) | 0, 44 + i * 2);
  writeFileSync(join(outDir, name), buf);
  console.log("wrote", name, (n / SR).toFixed(2) + "s");
}

function lowpass(input, fcStart, fcEnd) {
  const out = new Float32Array(input.length);
  let y = 0;
  for (let i = 0; i < input.length; i++) {
    const t = i / input.length;
    const fc = fcStart + (fcEnd - fcStart) * t;
    const a = Math.min(0.999, (2 * Math.PI * fc) / SR);
    y += a * (input[i] - y);
    out[i] = y;
  }
  return out;
}

// Cheap reverb tail via a few decaying delay taps.
function reverb(input, amount = 0.3) {
  const out = Float32Array.from(input);
  const taps = [0.013, 0.021, 0.031, 0.043, 0.057].map((s) => Math.floor(s * SR));
  const gains = [0.6, 0.5, 0.42, 0.34, 0.28];
  const extra = SR * 0.5;
  const ext = new Float32Array(out.length + extra);
  ext.set(out);
  for (let t = 0; t < taps.length; t++) {
    for (let i = 0; i < ext.length; i++) {
      const j = i - taps[t];
      if (j >= 0) ext[i] += ext[j] * gains[t] * amount;
    }
  }
  return ext;
}

// ---- SWOOSH: airy filtered-noise transition whoosh ----
{
  const N = dur(0.6);
  const noise = new Float32Array(N);
  for (let i = 0; i < N; i++) noise[i] = rnd();
  const filtered = lowpass(noise, 500, 7000);
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / N;
    out[i] = filtered[i] * Math.sin(Math.PI * t) ** 1.5 * 0.9;
  }
  writeWav("swoosh.wav", reverb(out, 0.2));
}

// ---- BOOM: cinematic sub-drop with reverb tail (logo / brand hit) ----
{
  const N = dur(1.1);
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const env = Math.exp(-t * 4.5);
    const pitch = 120 - 70 * Math.min(1, t * 4);
    const sub = Math.sin(2 * Math.PI * pitch * t) * env;
    const click = i < dur(0.03) ? rnd() * Math.exp(-i / dur(0.008)) * 0.6 : 0;
    out[i] = sub * 1.0 + click;
  }
  writeWav("boom.wav", reverb(out, 0.35));
}

// ---- IMPACT: punchy hit for the LEVEL UP / CTA slam ----
{
  const N = dur(0.8);
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const env = Math.exp(-t * 7);
    const pitch = 95 - 40 * Math.min(1, t * 6);
    const sub = Math.sin(2 * Math.PI * pitch * t) * env;
    const body = Math.sin(2 * Math.PI * 180 * t) * env * 0.4;
    const click = i < dur(0.02) ? rnd() * Math.exp(-i / dur(0.005)) * 0.8 : 0;
    out[i] = sub * 0.9 + body + click;
  }
  writeWav("impact.wav", reverb(out, 0.3));
}

// ---- RISER: tension build into the level-up ----
{
  const N = dur(1.5);
  const noise = new Float32Array(N);
  for (let i = 0; i < N; i++) noise[i] = rnd();
  const filtered = lowpass(noise, 300, 10000);
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / N;
    const env = t * t;
    const f = 220 + 2200 * t;
    const tone = Math.sin(2 * Math.PI * f * (i / SR)) * 0.22 * t;
    out[i] = (filtered[i] * 0.5 + tone) * env;
  }
  writeWav("riser.wav", out);
}

// ---- CHIME: bright FM bell for text/feature reveals ----
{
  const N = dur(0.5);
  const out = new Float32Array(N);
  const carrier = 880, modR = 2.0, modI = 4;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const env = Math.exp(-t * 8);
    const mod = Math.sin(2 * Math.PI * carrier * modR * t) * modI * env;
    out[i] = Math.sin(2 * Math.PI * carrier * t + mod) * env * 0.5;
  }
  writeWav("chime.wav", reverb(out, 0.35));
}

// ---- POP: short UI tick ----
{
  const N = dur(0.1);
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    out[i] = Math.sin(2 * Math.PI * 760 * t) * Math.exp(-t * 48) * 0.6;
  }
  writeWav("pop.wav", out);
}

// ---- MUSIC BED: sidechained future-pop (~40s) ----
// Pad (ducked by the kick), sub bass, soft kick, and a plucky arp — the modern "pump".
{
  const LEN = 40;
  const N = dur(LEN);
  const out = new Float32Array(N);
  const bpm = 124;
  const beat = 60 / bpm; // seconds per beat
  const chords = [
    [220.0, 277.18, 329.63], // A C# E   (A major-ish, bright)
    [196.0, 246.94, 293.66], // G B D
    [164.81, 207.65, 246.94], // E G# B
    [174.61, 220.0, 261.63], // F A C
  ];
  const arpScale = [440, 554.37, 659.25, 880];

  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const beatPos = t / beat;
    const bar = Math.floor(beatPos / 4) % chords.length;
    const chord = chords[bar];

    // sidechain envelope: dip to ~0.35 on each beat, recover — the pump
    const phase = beatPos - Math.floor(beatPos);
    const duck = 0.35 + 0.65 * Math.min(1, phase * 1.8);

    // pad (detuned sines)
    let pad = 0;
    for (const f of chord) {
      pad += Math.sin(2 * Math.PI * f * t);
      pad += Math.sin(2 * Math.PI * f * 1.004 * t) * 0.6;
    }
    pad *= 0.045 * duck;

    // sub bass on the chord root, one octave down
    const root = chord[0] / 2;
    const sub = Math.sin(2 * Math.PI * root * t) * 0.16 * (0.5 + 0.5 * duck);

    // soft kick on each beat
    const kEnv = Math.exp(-phase * beat * 11);
    const kick = Math.sin(2 * Math.PI * (110 - 70 * Math.min(1, phase * 8)) * t) * kEnv * 0.5;

    // plucky arp (16ths), enters in the second half for lift
    const six = Math.floor(beatPos * 4) % arpScale.length;
    const sixPhase = beatPos * 4 - Math.floor(beatPos * 4);
    const arpEnv = Math.exp(-sixPhase * 6);
    const arpGain = Math.min(1, Math.max(0, (t - LEN * 0.35) / 4)) * 0.12;
    const arp = Math.sin(2 * Math.PI * arpScale[six] * t) * arpEnv * arpGain * duck;

    let s = pad + sub + kick + arp + rnd() * 0.006;
    const fade = Math.min(1, t / 2) * Math.min(1, (LEN - t) / 2.5);
    out[i] = s * fade;
  }
  // normalize
  let peak = 0;
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(out[i]));
  const g = peak > 0 ? 0.82 / peak : 1;
  for (let i = 0; i < N; i++) out[i] *= g;
  writeWav("music.wav", out);
}

console.log("Sound design + music done.");
