/**
 * Synthesizes a notification tone locally using the Web Audio API.
 * This runs offline-first and doesn't require any local asset files.
 */
export function playNotificationSound(type: "beep" | "chime" | "gong", volume = 0.5) {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Gain node for volume control
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.connect(ctx.destination);
    
    if (type === "beep") {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.connect(gainNode);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === "chime") {
      // Create a nice double chime
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc1.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.4); // C6
      
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      osc2.frequency.exponentialRampToValueAtTime(1318.51, ctx.currentTime + 0.5); // E6
      
      const chimeGain = ctx.createGain();
      chimeGain.gain.setValueAtTime(volume, ctx.currentTime);
      chimeGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      
      osc1.connect(chimeGain);
      osc2.connect(chimeGain);
      chimeGain.connect(ctx.destination);
      
      osc1.start();
      osc2.start(ctx.currentTime + 0.1);
      
      osc1.stop(ctx.currentTime + 0.6);
      osc2.stop(ctx.currentTime + 0.6);
    } else if (type === "gong") {
      // A deep complex gong sound
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(120, ctx.currentTime); // Low frequency
      osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 1.5);
      
      const mod = ctx.createOscillator();
      mod.type = "sawtooth";
      mod.frequency.setValueAtTime(125, ctx.currentTime);
      
      const modGain = ctx.createGain();
      modGain.gain.setValueAtTime(30, ctx.currentTime);
      
      mod.connect(modGain);
      modGain.connect(osc.frequency);
      
      const gongGain = ctx.createGain();
      gongGain.gain.setValueAtTime(volume, ctx.currentTime);
      gongGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.0);
      
      osc.connect(gongGain);
      gongGain.connect(ctx.destination);
      
      mod.start();
      osc.start();
      
      mod.stop(ctx.currentTime + 2.0);
      osc.stop(ctx.currentTime + 2.0);
    }
  } catch (e) {
    console.error("Failed to play synthesized sound", e);
  }
}
