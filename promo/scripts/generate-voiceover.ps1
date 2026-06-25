# Generates the AI voiceover for the Study Flow ad using offline Windows SAPI TTS.
# One WAV per scene, written to public/audio/voN.wav.
# Upgrade path: swap these for ElevenLabs/PlayHT renders of the same lines for broadcast quality.

Add-Type -AssemblyName System.Speech
$ErrorActionPreference = "Stop"

$root   = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root "public\audio"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$lines = @(
  @{ id = "vo1"; text = "Homework, exams, deadlines... chaos." }
  @{ id = "vo2"; text = "Meet Study Flow. Your entire study life, finally in flow." }
  @{ id = "vo3"; text = "See every class and deadline on one clean timeline." }
  @{ id = "vo4"; text = "Stuck on something? Your A I tutor explains it instantly." }
  @{ id = "vo5"; text = "Hit Focus Mode, lock in, and crush distraction." }
  @{ id = "vo6"; text = "Track your marks and watch your insights climb." }
  @{ id = "vo7"; text = "Earn X P, level up, and rank up to Diamond Elite." }
  @{ id = "vo8"; text = "Whatever your hand finds to do, do it with all your might." }
  @{ id = "vo9"; text = "Study Flow. Stop planning. Start flowing." }
)

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer

# Prefer a richer voice if available (Zira/Hazel/David), else system default.
$preferred = @("Microsoft Zira Desktop", "Microsoft Hazel Desktop", "Microsoft David Desktop")
$installed = $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }
foreach ($p in $preferred) {
  if ($installed -contains $p) { $synth.SelectVoice($p); break }
}
Write-Host ("Voice: " + $synth.Voice.Name)

$synth.Rate   = 2     # brisk, ad-paced energy
$synth.Volume = 100

foreach ($l in $lines) {
  $path = Join-Path $outDir ($l.id + ".wav")
  $synth.SetOutputToWaveFile($path)
  $synth.Speak($l.text)
  Write-Host ("wrote " + $path)
}
$synth.SetOutputToNull()
$synth.Dispose()
Write-Host "Voiceover done."
