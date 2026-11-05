// Procedural WebAudio sound: UI blips, keypad, footsteps, doors, lasers,
// alarm siren, detection stinger, heartbeat and a low building ambience.
// Everything is synthesized - zero audio files to download.
let ctx = null, master = null, sfxBus = null, ambBus = null, noiseBuf = null;
let vol = 0.8;
const loops = {};

function ac(create) {
  if (!ctx) {
    if (!create) return null; // only a user gesture (unlock) may create the context
    const C = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!C) return null;
    try { ctx = new C(); } catch { return null; }
    master = ctx.createGain(); master.gain.value = vol;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = 0.6; ambBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function env(g, t, a, peak, dec, sus = 0) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus || 0.0001), t + a + dec);
}
function tone(type, f, t, dur, peak, { f2, to = sfxBus, a = 0.005, q } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  let node = o;
  if (q) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = q; o.connect(fl); node = fl; }
  node.connect(g); g.connect(to);
  env(g, t, a, peak, dur);
  o.start(t); o.stop(t + a + dur + 0.05);
}
function noise(t, dur, peak, { type = 'bandpass', f = 800, f2, q = 1, to = sfxBus, a = 0.004 } = {}) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain();
  s.connect(fl); fl.connect(g); g.connect(to);
  env(g, t, a, peak, dur);
  s.start(t, Math.random() * 0.5); s.stop(t + a + dur + 0.05);
}

const SOUNDS = {
  click: (t) => tone('sine', 880, t, 0.05, 0.12),
  hover: (t) => tone('sine', 1500, t, 0.02, 0.03),
  key: (t) => { tone('square', 1250, t, 0.07, 0.05, { q: 3000 }); },
  ok: (t) => { tone('sine', 660, t, 0.12, 0.13); tone('sine', 990, t + 0.09, 0.2, 0.13); },
  good: (t) => { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, t + i * 0.07, 0.22, 0.09)); },
  bad: (t) => { tone('sawtooth', 150, t, 0.28, 0.12, { q: 900 }); tone('sawtooth', 156, t, 0.28, 0.1, { q: 900 }); },
  step: (t, o = {}) => noise(t, 0.05 + (o.v || 0.5) * 0.05, 0.05 + (o.v || 0.5) * 0.12, { f: 260 + Math.random() * 380, q: 0.9 }),
  door: (t) => { tone('sine', 90, t, 0.25, 0.25, { f2: 60 }); noise(t, 0.35, 0.06, { type: 'lowpass', f: 900, f2: 200 }); },
  edoor: (t) => { noise(t, 0.5, 0.08, { type: 'bandpass', f: 400, f2: 1200, q: 2 }); tone('sine', 70, t + 0.45, 0.2, 0.2); },
  laser: (t) => tone('sawtooth', 2400, t, 0.16, 0.06, { f2: 180, q: 4000 }),
  trip: (t) => { tone('square', 1800, t, 0.12, 0.08); tone('square', 1800, t + 0.16, 0.12, 0.08); tone('square', 1800, t + 0.32, 0.12, 0.08); },
  spotted: (t) => { tone('sawtooth', 220, t, 0.6, 0.12, { a: 0.01, q: 1800 }); tone('sawtooth', 233, t, 0.6, 0.1, { a: 0.01, q: 1800 }); tone('sine', 55, t, 0.7, 0.3); },
  sus: (t) => tone('sine', 420, t, 0.25, 0.05, { f2: 520 }),
  grab: (t) => { tone('sine', 1320, t, 0.08, 0.08); tone('sine', 1760, t + 0.05, 0.15, 0.07); noise(t, 0.12, 0.03, { f: 3000 }); },
  secure: (t) => { [784, 988, 1175, 1568].forEach((f, i) => tone('sine', f, t + i * 0.06, 0.25, 0.07)); },
  vault: (t) => { tone('sine', 48, t, 2.4, 0.35, { a: 0.4 }); noise(t, 2.6, 0.08, { type: 'lowpass', f: 300, f2: 90, a: 0.3 }); tone('triangle', 196, t + 2.2, 1.0, 0.06); },
  emp: (t) => { tone('sawtooth', 1600, t, 0.6, 0.1, { f2: 40, q: 2500 }); noise(t, 0.6, 0.08, { f: 2000, f2: 200 }); },
  smoke: (t) => noise(t, 1.2, 0.12, { type: 'highpass', f: 1500, a: 0.03 }),
  throw: (t) => noise(t, 0.25, 0.05, { f: 600, f2: 1500 }),
  loop: (t) => { tone('square', 2200, t, 0.04, 0.04); tone('square', 2200, t + 0.08, 0.04, 0.04); tone('square', 1650, t + 0.16, 0.06, 0.04); },
  zone: (t) => { [392, 523, 659, 784].forEach((f, i) => tone('square', f, t + i * 0.05, 0.08, 0.04, { q: 3000 })); },
  ping: (t) => { tone('sine', 1800, t, 0.5, 0.06, { f2: 900 }); },
  lure: (t) => noise(t, 0.4, 0.06, { f: 900, q: 3 }),
  nobw: (t) => tone('square', 220, t, 0.18, 0.05, { q: 1200 }),
  takedown: (t) => { tone('sine', 120, t, 0.18, 0.3, { f2: 50 }); noise(t, 0.15, 0.1, { type: 'lowpass', f: 1200 }); },
  pick: (t) => { for (let i = 0; i < 3; i++) noise(t + i * 0.06, 0.02, 0.06, { f: 4000, q: 6 }); tone('sine', 300, t + 0.2, 0.08, 0.1); },
  fuse: (t) => { noise(t, 0.05, 0.12, { f: 2500, q: 2 }); tone('sine', 140, t, 0.1, 0.12); },
  win: (t) => { [392, 494, 587, 784, 988].forEach((f, i) => tone('triangle', f, t + i * 0.11, 0.5, 0.08)); },
  bust: (t) => { [392, 370, 349, 311].forEach((f, i) => tone('sawtooth', f, t + i * 0.22, 0.45, 0.06, { q: 1400 })); },
  heart: (t, o = {}) => { const v = o.v || 0.5; tone('sine', 62, t, 0.12, 0.35 * v, { f2: 40 }); tone('sine', 58, t + 0.16, 0.12, 0.25 * v, { f2: 40 }); },
};

export const sfx = {
  unlock() { ac(true); },
  get ready() { return !!ctx && ctx.state === 'running'; },
  setVolume(v) { vol = v; if (master) master.gain.value = v; },
  play(name, o) {
    if (!ac() || !SOUNDS[name]) return;
    try { SOUNDS[name](ctx.currentTime + 0.01, o); } catch { /* ignore */ }
  },
  // looping beds
  ambience(on) {
    if (!ac()) return;
    if (on && !loops.amb) {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 160;
      const g = ctx.createGain(); g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 2);
      const hum = ctx.createOscillator(); hum.frequency.value = 50; const hg = ctx.createGain(); hg.gain.value = 0.006;
      s.connect(fl); fl.connect(g); g.connect(ambBus); hum.connect(hg); hg.connect(ambBus);
      s.start(); hum.start();
      loops.amb = { stop: () => { const t = ctx.currentTime; g.gain.setTargetAtTime(0.0001, t, 0.4); hg.gain.setTargetAtTime(0.0001, t, 0.4); s.stop(t + 2); hum.stop(t + 2); } };
    } else if (!on && loops.amb) { loops.amb.stop(); loops.amb = null; }
  },
  alarm(level) {
    if (!ac()) return;
    if (level > 0 && !loops.alarm) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.9; const lg = ctx.createGain(); lg.gain.value = 180;
      lfo.connect(lg); lg.connect(o.frequency); o.frequency.value = 760;
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1800;
      const g = ctx.createGain(); g.gain.value = 0.0001;
      o.connect(fl); fl.connect(g); g.connect(sfxBus); o.start(); lfo.start();
      loops.alarm = { g, stop: () => { const t = ctx.currentTime; g.gain.setTargetAtTime(0.0001, t, 0.3); o.stop(t + 1.5); lfo.stop(t + 1.5); } };
    }
    if (loops.alarm) {
      if (level <= 0) { loops.alarm.stop(); loops.alarm = null; } else loops.alarm.g.gain.setTargetAtTime(0.012 + 0.012 * level, ctx.currentTime, 0.2);
    }
  },
  stopAll() { this.ambience(false); this.alarm(0); },
};

// Map a sim event to a sound for a given role ('runner' hears the building,
// 'hacker' hears the van console).
export function eventSound(type, a, role) {
  const R = role === 'runner';
  switch (type) {
    case 'zone': return 'zone';
    case 'solved': return 'good';
    case 'wrong': return 'bad';
    case 'serial_noport': case 'serial_locked': case 'door_lockdown': return 'nobw';
    case 'key': return R ? 'key' : null;
    case 'fuse_ok': return R ? 'fuse' : 'key';
    case 'alert': return 'spotted';
    case 'cam_spot': return 'spotted';
    case 'sus': return R ? 'sus' : null;
    case 'laser_trip': return 'trip';
    case 'laser': return R ? 'laser' : 'click';
    case 'loop': return R ? null : 'loop';
    case 'door': return R ? 'edoor' : 'click';
    case 'light': return R ? 'door' : 'click';
    case 'ping': return R ? null : 'ping';
    case 'lure': return R ? 'lure' : 'click';
    case 'nobw': return R ? null : 'nobw';
    case 'grab': return R ? 'grab' : null;
    case 'secure': return 'secure';
    case 'vault_unlocked': return 'ok';
    case 'vault_open': return 'vault';
    case 'emp': return R ? 'emp' : null;
    case 'smoke': return R ? 'smoke' : null;
    case 'throw': return R ? 'throw' : null;
    case 'ko': return R ? 'takedown' : null;
    case 'picked': return R ? 'pick' : 'ok';
    case 'mark': return 'loop';
    case 'end': return a[0] === 'won' ? 'win' : a[0] === 'bust' ? 'bust' : 'ok';
    default: return null;
  }
}
