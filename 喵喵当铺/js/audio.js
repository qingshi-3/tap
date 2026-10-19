// WebAudio 合成音效与八音盒背景乐，不依赖音频文件
let ctx = null, master = null, musicGain = null, musicTimer = null;
export const sound = { sfx: true, music: true };

function ac() {
  if (!ctx) {
    const C = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(f, t0, dur, { type = 'square', vol = 0.18, to = null, out = null } = {}) {
  const c = ctx, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(out || master); o.start(t0); o.stop(t0 + dur + 0.02);
}

const SFX = {
  tap: (t) => tone(880, t, 0.06, { vol: 0.08 }),
  coin: (t) => { tone(1318, t, 0.08, { vol: 0.12 }); tone(1760, t + 0.07, 0.16, { vol: 0.12 }); },
  pay: (t) => { tone(660, t, 0.08, { vol: 0.1 }); tone(440, t + 0.07, 0.14, { vol: 0.1 }); },
  bad: (t) => { tone(220, t, 0.18, { type: 'sawtooth', vol: 0.1, to: 140 }); },
  good: (t) => { [784, 988, 1175].forEach((f, i) => tone(f, t + i * 0.07, 0.14, { type: 'triangle', vol: 0.16 })); },
  bell: (t) => { tone(1568, t, 0.5, { type: 'sine', vol: 0.16 }); tone(2093, t + 0.12, 0.6, { type: 'sine', vol: 0.12 }); },
  meow: (t) => { tone(620, t, 0.32, { type: 'triangle', vol: 0.18, to: 900 }); tone(900, t + 0.18, 0.22, { type: 'triangle', vol: 0.12, to: 560 }); },
  hiss: (t) => { tone(300, t, 0.25, { type: 'sawtooth', vol: 0.08, to: 180 }); },
  check: (t) => tone(1046, t, 0.09, { type: 'triangle', vol: 0.12 }),
  ach: (t) => { [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.08, 0.22, { type: 'triangle', vol: 0.15 })); },
};

export function sfx(name) {
  if (!sound.sfx || !ac()) return;
  SFX[name]?.(ctx.currentTime + 0.01);
}

// 两段八音盒旋律：白天轻快、夜晚安静
const SONGS = {
  day: { bpm: 104, notes: 'E5 G5 A5 G5 E5 D5 C5 D5 E5 G5 C6 B5 A5 G5 - - A5 C6 B5 A5 G5 E5 D5 E5 G5 A5 G5 E5 D5 C5 - -', bass: 'C3 G3 A2 E3 F2 C3 G2 G3' },
  night: { bpm: 72, notes: 'A4 C5 E5 - D5 C5 B4 - G4 B4 D5 - C5 B4 A4 - F4 A4 C5 - B4 A4 G4 - E4 G#4 B4 - A4 - - -', bass: 'A2 E3 G2 D3 F2 C3 E2 E3' },
};
const freq = (n) => {
  const m = /^([A-G])(#?)(\d)$/.exec(n); if (!m) return 0;
  const k = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0);
  return 440 * Math.pow(2, (k - 9 + (Number(m[3]) - 4) * 12) / 12);
};
let current = null;
export function music(name) {
  current = name;
  clearTimeout(musicTimer);
  if (!sound.music || !name || !ac()) return;
  const song = SONGS[name], step = 60 / song.bpm / 2;
  const notes = song.notes.split(' '), bass = song.bass.split(' ');
  const loop = () => {
    if (current !== name || !sound.music) return;
    const t0 = ctx.currentTime + 0.05;
    notes.forEach((n, i) => { const f = freq(n); if (f) tone(f, t0 + i * step, step * 2.2, { type: 'sine', vol: 0.5, out: musicGain }); });
    bass.forEach((n, i) => tone(freq(n), t0 + i * step * 4, step * 4, { type: 'triangle', vol: 0.35, out: musicGain }));
    musicTimer = setTimeout(loop, notes.length * step * 1000);
  };
  loop();
}
export function unlockAudio() { ac(); if (current && sound.music && !musicTimer) music(current); }
