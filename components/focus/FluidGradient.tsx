'use client';

import { useEffect, useRef } from 'react';

interface FluidGradientProps {
  /** Hex colors, strongest first. Changing this crossfades the whole scene. */
  colors: string[];
  /** Slows the drift when the timer is paused. */
  paused?: boolean;
  /** When set, bass energy makes the blobs swell and drift faster. */
  analyser?: AnalyserNode | null;
  /** Deep Focus: the scene drifts faster, hotter and more turbulent. */
  intense?: boolean;
  className?: string;
}

interface RGB { r: number; g: number; b: number }

function hexToRgb(hex: string): RGB {
  const value = parseInt(hex.replace('#', ''), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

/**
 * Apple Music-style fluid gradient backdrop. A handful of huge radial blobs
 * drift on layered sine paths over a low-res canvas that the GPU blurs up to
 * full screen — cheap to render, silky to look at. Palette changes ease in
 * over ~2.5s so switching songs feels like the room slowly re-lighting.
 */
export function FluidGradient({ colors, paused = false, analyser = null, intense = false, className }: FluidGradientProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef<RGB[]>([]);
  const pausedRef = useRef(paused);
  const analyserRef = useRef<AnalyserNode | null>(analyser);
  const intenseRef = useRef(intense);

  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { analyserRef.current = analyser; }, [analyser]);
  useEffect(() => { intenseRef.current = intense; }, [intense]);

  useEffect(() => {
    targetRef.current = colors.map(hexToRgb);
  }, [colors]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Render tiny; CSS blur + scale does the heavy lifting.
    const W = 320;
    const H = 200;
    canvas.width = W;
    canvas.height = H;

    // Current colors animate toward targetRef each frame (palette crossfade).
    const current: RGB[] = (targetRef.current.length ? targetRef.current : [
      { r: 30, g: 30, b: 60 }, { r: 90, g: 20, b: 40 }, { r: 20, g: 50, b: 90 }, { r: 60, g: 20, b: 80 }
    ]).map(c => ({ ...c }));

    // Each blob orbits on a unique pair of sine waves so paths never repeat.
    const blobs = Array.from({ length: 6 }, (_, i) => ({
      colorIndex: i % 4,
      radius: (0.55 + (i % 3) * 0.22) * H,
      speedX: 0.00009 + i * 0.000023,
      speedY: 0.00012 + i * 0.000019,
      phaseX: i * 1.7,
      phaseY: i * 2.9,
      ampX: 0.38 + (i % 2) * 0.14,
      ampY: 0.34 + (i % 3) * 0.12,
    }));

    let raf = 0;
    let last = performance.now();
    let clock = Math.random() * 100000;
    let energy = 0;
    const freqData = new Uint8Array(128);

    const frame = (now: number) => {
      const dt = Math.min(now - last, 100);
      last = now;

      // Audio reactivity: average the bass bins, smooth heavily so the scene
      // breathes with the music instead of strobing.
      const node = analyserRef.current;
      if (node && !pausedRef.current) {
        try {
          node.getByteFrequencyData(freqData);
          let sum = 0;
          for (let i = 1; i < 10; i++) sum += freqData[i];
          const bass = sum / (9 * 255);
          energy += (bass - energy) * Math.min(1, dt / 120);
        } catch {
          energy *= 0.98;
        }
      } else {
        energy *= 0.98;
      }

      // Keep breathing very slowly while paused instead of freezing dead.
      // Deep Focus drives the whole scene faster and reacts harder to bass.
      const hot = intenseRef.current;
      clock += dt * (pausedRef.current ? 0.25 : (hot ? 2.1 : 1) + energy * (hot ? 3.4 : 2.2));

      // Ease current palette toward the target (~2.5s crossfade).
      const targets = targetRef.current;
      if (targets.length) {
        const ease = 1 - Math.pow(0.001, dt / 2500);
        for (let i = 0; i < current.length; i++) {
          const t = targets[i % targets.length];
          current[i].r += (t.r - current[i].r) * ease;
          current[i].g += (t.g - current[i].g) * ease;
          current[i].b += (t.b - current[i].b) * ease;
        }
      }

      // Deep base coat from the darkest tone so blur edges never go grey.
      const base = current[current.length - 1];
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgb(${base.r * 0.35 | 0}, ${base.g * 0.35 | 0}, ${base.b * 0.35 | 0})`;
      ctx.fillRect(0, 0, W, H);

      ctx.globalCompositeOperation = 'lighter';
      for (const blob of blobs) {
        const c = current[blob.colorIndex % current.length];
        const x = W * (0.5 + Math.sin(clock * blob.speedX + blob.phaseX) * blob.ampX);
        const y = H * (0.5 + Math.cos(clock * blob.speedY + blob.phaseY) * blob.ampY);
        const radius = blob.radius * (1 + energy * (hot ? 0.7 : 0.45)) * (hot ? 1.12 : 1);
        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        grad.addColorStop(0, `rgba(${c.r | 0}, ${c.g | 0}, ${c.b | 0}, ${(hot ? 0.82 : 0.7) + energy * 0.3})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={className} aria-hidden>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full transition-[filter] duration-700"
        style={{
          filter: intense ? 'blur(40px) saturate(1.8) contrast(1.12)' : 'blur(48px) saturate(1.35)',
          transform: intense ? 'scale(1.35)' : 'scale(1.25)',
        }}
      />
      {/* Grain + vignette keep the blur from looking like a flat smear.
          Deep Focus tightens the vignette into a tunnel-vision frame. */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          background: intense
            ? 'radial-gradient(ellipse at center, transparent 14%, rgba(0,0,0,0.72) 100%)'
            : 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.45) 100%)',
        }}
      />
    </div>
  );
}
