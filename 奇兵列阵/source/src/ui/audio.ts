// 纯 WebAudio 合成音效：无外部资源，首个用户手势后解锁。

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = localStorage.getItem('zl_muted') === '1';
let noiseBuf: AudioBuffer | null = null;
let needsGesture = false;
let listening = false;
const visibility = () => {
  if (document.hidden) {
    needsGesture = true;
    if (ctx && ctx.state !== 'closed') void ctx.suspend().catch(() => {});
  }
};
const gesture = (event: Event) => {
  if (!event.isTrusted || document.hidden) return;
  needsGesture = false;
  unlockAudio();
};
function listen() {
  if (listening) return;
  listening = true;
  document.addEventListener('visibilitychange', visibility);
  document.addEventListener('pointerdown', gesture);
  document.addEventListener('keydown', gesture);
}

/** Release only listeners/context owned by this audio module. */
export function disposeAudio() {
  document.removeEventListener('visibilitychange', visibility);
  document.removeEventListener('pointerdown', gesture);
  document.removeEventListener('keydown', gesture);
  listening = false; needsGesture = false;
  if (ctx) void ctx.close().catch(() => {});
  ctx = null; master = null; noiseBuf = null;
}

export function unlockAudio() {
  listen();
  if (document.hidden || muted) return;
  if (needsGesture && !navigator.userActivation?.isActive) return;
  needsGesture = false;
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    return;
  }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.55;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function isMuted() {
  return muted;
}
export function setMuted(m: boolean) {
  muted = m;
  localStorage.setItem('zl_muted', m ? '1' : '0');
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.55, ctx.currentTime, 0.02);
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, slideTo?: number, delay = 0) {
  if (muted || document.hidden || needsGesture || !ctx || !master || ctx.state !== 'running') return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.3, freq = 1200, q = 0.8, delay = 0, type: BiquadFilterType = 'bandpass') {
  if (muted || document.hidden || needsGesture || !ctx || !master || !noiseBuf || ctx.state !== 'running') return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + dur + 0.02);
}

export const sfx = {
  click: () => tone(660, 0.06, 'triangle', 0.12, 880),
  hover: () => tone(1200, 0.03, 'sine', 0.04),
  pick: () => {
    tone(520, 0.09, 'triangle', 0.18, 780);
    tone(780, 0.12, 'triangle', 0.12, 1040, 0.05);
  },
  place: () => {
    noise(0.08, 0.25, 500, 1.2);
    tone(180, 0.12, 'sine', 0.3, 90);
  },
  merge: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.15, undefined, i * 0.05)),
  /** 广告奖励到账：比 merge 更亮的短促上行，不与整场胜利音效混淆 */
  reward: () => {
    [659, 880, 1174].forEach((f, i) => tone(f, 0.16, 'triangle', 0.13, undefined, i * 0.06));
    tone(1568, 0.24, 'sine', 0.07, undefined, 0.2);
  },
  swap: () => {
    noise(0.14, 0.12, 2200, 0.6);
    tone(400, 0.12, 'sine', 0.12, 700);
  },
  hit: (big = false) => {
    noise(big ? 0.22 : 0.12, big ? 0.55 : 0.38, big ? 700 : 1100, 0.9);
    tone(big ? 120 : 170, big ? 0.2 : 0.12, 'sine', 0.45, 50);
  },
  shieldHit: () => {
    tone(1400, 0.15, 'sine', 0.12, 900);
    noise(0.06, 0.15, 4000, 2);
  },
  shield: () => {
    tone(880, 0.25, 'sine', 0.12, 1320);
    tone(1320, 0.3, 'sine', 0.06, 1760, 0.04);
  },
  buff: () => {
    tone(440, 0.16, 'triangle', 0.12, 660);
    tone(660, 0.18, 'triangle', 0.1, 990, 0.06);
  },
  trigger: () => {
    tone(988, 0.12, 'sine', 0.1);
    tone(1318, 0.18, 'sine', 0.08, undefined, 0.05);
  },
  fizzle: () => tone(300, 0.2, 'sawtooth', 0.05, 150),
  death: () => {
    noise(0.35, 0.3, 400, 0.7, 0, 'lowpass');
    tone(220, 0.35, 'square', 0.06, 55);
  },
  summon: () => [392, 523, 784].forEach((f, i) => tone(f, 0.2, 'sine', 0.12, f * 1.5, i * 0.04)),
  freeze: () => {
    noise(0.3, 0.12, 6000, 3);
    tone(1760, 0.3, 'sine', 0.05, 2600);
  },
  silence: () => tone(200, 0.3, 'sawtooth', 0.08, 120),
  beat: () => tone(90, 0.06, 'sine', 0.15),
  whoosh: () => noise(0.18, 0.12, 1800, 0.5),
  win: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.35, 'triangle', 0.14, undefined, i * 0.09)),
  lose: () => [392, 349, 311, 262].forEach((f, i) => tone(f, 0.45, 'triangle', 0.12, undefined, i * 0.14)),
  start: () => {
    noise(0.5, 0.2, 300, 0.6, 0, 'lowpass');
    [262, 392, 523].forEach((f, i) => tone(f, 0.4, 'sawtooth', 0.05, undefined, i * 0.06));
  },
};
