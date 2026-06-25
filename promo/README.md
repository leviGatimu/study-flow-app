# Study Flow — Promo Ad (Remotion)

Two cuts of a hype ad for **Study Flow**, built with [Remotion](https://remotion.dev):

- **`StudyFlowAdPC`** — 1920×1080 (16:9), the premium PC cut. *Default render.*
- **`StudyFlowAd`** — 1080×1920 (9:16), vertical for Reels / Shorts / TikTok.

Motion graphics + an **ElevenLabs** voiceover + procedurally-generated sound design & music bed.

## Quick start

```bash
cd promo
npm install

# 1) audio
#    ElevenLabs VO — needs promo/.env with ELEVENLABS_API_KEY=sk_...
npm run audio:vo            # -> public/audio/vo1..vo9.mp3  (voice via VOICE_NAME / VOICE_ID)
npm run audio:sfx          # -> whoosh/boom/impact/riser/chime/pop/music.wav

# 2) preview + render
npm run dev                # Remotion Studio (pick a composition, scrub)
npm run render             # -> out/studyflow-ad-pc.mp4   (16:9, default)
npm run render:vertical    # -> out/studyflow-ad.mp4      (9:16)
```

## ElevenLabs voiceover

`scripts/generate-voiceover-eleven.mjs` reads `promo/.env`, resolves a voice, generates one MP3
per scene, and prints each clip's length in frames.

```bash
# pick a voice by name (premade) ...
VOICE_NAME=Bella  npm run audio:vo
# ... or by explicit voice id (professional / cloned — needs a PAID plan)
VOICE_ID=vr5WKaGvRWsoaX5LCVax npm run audio:vo
```

> **Free-plan note:** ElevenLabs only allows *premade* voices over the API on the free tier.
> Professional/library/cloned voices (e.g. **Cherie R**, **Rachel**) return `402 paid_plan_required`.
> This build currently uses **Bella** (premade). To use Cherie R, upgrade your ElevenLabs plan,
> then `VOICE_ID=vr5WKaGvRWsoaX5LCVax npm run audio:vo` and re-render.

There's also an offline fallback (`npm run audio:vo:sapi`) that uses Windows SAPI — no key, lower quality.

### Re-timing after changing the voiceover
Scene lengths in `src/AdPC.tsx` (`const SCENES`) are tuned to each clip's measured length so the
visuals stay locked to the narration. The VO script prints the new frame counts; set
`dur = lead + voFrames + tail` per scene (tail ≥ the 15-frame `TR` crossfade).

## Structure

```
src/
  Root.tsx               # registers both compositions
  AdPC.tsx               # 16:9 master: TransitionSeries flow + computed audio timeline
  Ad.tsx                 # 9:16 master
  theme.ts               # brand palette, canvas sizes, fps
  lib/fonts.ts           # Inter + Plus Jakarta Sans + Space Grotesk (weight-limited)
  anim/Text.tsx          # CharStagger / MaskReveal / WordStagger kinetic type
  components/
    Cinematic.tsx        # Camera push-in, Particles, LightSweep, Grade, ChromaPulse
    BackgroundPC.tsx Background.tsx Grain.tsx Logo.tsx Phone.tsx
    screens/             # animated mock app screens (Today, Tutor, Focus, Marks)
  pc/                    # 16:9 scenes: Hook, Logo, Feature, LevelUp, Verse, CTA
  scenes/                # 9:16 scenes
scripts/
  generate-voiceover-eleven.mjs   # ElevenLabs TTS + per-clip frame measure
  generate-voiceover.ps1          # offline Windows SAPI fallback
  generate-sfx.mjs                # WAV synth: SFX + sidechained music bed
```

## Scene flow (30fps)

Hook → Logo Reveal → Today's Focus → AI Tutor → Focus Mode → Insights → Level Up (Diamond Elite)
→ Verse (Ecclesiastes 9:10) → CTA. Hard cuts use `TransitionSeries` (fade / slide / wipe), every
scene has a slow camera push-in, bokeh, light sweeps, grain and a color grade.

## Render variants

```bash
npx remotion render StudyFlowAdPC out/ad.mp4
npx remotion render StudyFlowAdPC out/silent.mp4 --props='{"withAudio":false,"withMusic":false}'
npx remotion render StudyFlowAdPC out/ad.gif --codec=gif
```
