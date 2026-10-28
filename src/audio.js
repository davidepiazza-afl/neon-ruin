// Tiny synthesized SFX via WebAudio (no files).
let ctx = null, master = null, noiseBuf = null, muted = false;
function env(node, t, a, d, peak) { node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function noise(dur, freq, q, peak, type = 'bandpass') {
  if (!ctx || muted) return; const t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); env(g, t, 0.003, dur, peak);
  src.connect(f).connect(g).connect(master); src.start(t, Math.random()); src.stop(t + dur + 0.05);
}
function tone(f0, f1, dur, peak, type = 'square') {
  if (!ctx || muted) return; const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain(); env(g, t, 0.004, dur, peak); o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
}
export const Sfx = {
  init() {
    if (ctx) { ctx.resume?.(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (_) { ctx = null; }
  },
  toggleMute() { muted = !muted; },
  shot() { noise(0.09, 1400, 0.7, 0.6); tone(180, 60, 0.08, 0.25); },
  hit() { tone(1200, 900, 0.04, 0.12, 'triangle'); },
  boom() { noise(0.35, 400, 0.6, 0.7, 'lowpass'); tone(220, 40, 0.3, 0.3, 'sawtooth'); },
  hurt() { tone(120, 60, 0.18, 0.35, 'sawtooth'); },
  zap() { tone(900, 300, 0.15, 0.08, 'sine'); },
  reload() { noise(0.05, 3000, 2, 0.2); setTimeout(() => noise(0.06, 2200, 2, 0.25), 700); },
  pickup() { tone(500, 1200, 0.18, 0.15, 'triangle'); },
  jump() { tone(200, 260, 0.06, 0.05, 'sine'); },
};
