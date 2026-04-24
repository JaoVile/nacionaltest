type SfxKind = 'click' | 'success' | 'error' | 'open';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function blip(freq: number, duration: number, type: OscillatorType = 'sine', gainPeak = 0.08) {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function chord(freqs: number[], duration: number, type: OscillatorType = 'sine', gainPeak = 0.06) {
  freqs.forEach((f, i) => setTimeout(() => blip(f, duration, type, gainPeak), i * 45));
}

export function playSfx(kind: SfxKind) {
  switch (kind) {
    case 'click':   return blip(880, 0.05, 'triangle', 0.05);
    case 'open':    return blip(520, 0.09, 'sine',     0.05);
    case 'success': return chord([523.25, 659.25, 783.99], 0.18, 'sine', 0.06);
    case 'error':   return chord([311.13, 246.94],         0.22, 'sawtooth', 0.045);
  }
}
