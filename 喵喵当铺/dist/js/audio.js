// WebAudio 合成音效与八音盒背景乐，不依赖音频文件
let ctx = null, master = null, musicGain = null, musicTimer = null;
const musicVoices = new Map();
let playing = null, musicGeneration = 0;
export const sound = { sfx: true, music: true };

function ac() {
  if (!ctx) {
    const C = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!C) return null;
    try {
      const c = new C(), main = c.createGain(), bgm = c.createGain();
      main.gain.value = 0.5; main.connect(c.destination);
      bgm.gain.value = 0.16; bgm.connect(main);
      ctx = c; master = main; musicGain = bgm;
      // iOS interruptions can end without another game button click. Restart only
      // after the audio clock is running, using the latest requested song.
      c.onstatechange = () => {
        if (c !== ctx) return;
        if (c.state === 'running') {
          if (current && sound.music && musicTimer === null) music(current);
        } else if (c.state === 'suspended' || c.state === 'interrupted') stopMusic();
      };
    } catch { return null; }
  }
  if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
    // 解锁可能异步成功或被宿主拒绝；仅在成功后按最新请求起曲。
    const c = ctx;
    try {
      c.resume()?.then(() => {
        if (c === ctx && c.state === 'running' && current && sound.music && musicTimer === null) music(current);
      }, () => {});
    } catch {}
  }
  return ctx;
}

function tone(f, t0, dur, { type = 'square', vol = 0.18, to = null, out = null } = {}) {
  const c = ctx, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  const release = () => {
    o.disconnect(); g.disconnect(); o.onended = null;
    musicVoices.delete(o);
  };
  o.onended = release;
  if (out === musicGain) musicVoices.set(o, release);
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
function stopMusic() {
  clearTimeout(musicTimer); musicTimer = null;
  playing = null; musicGeneration++;
  // 一整段音符已提交给 WebAudio，取消 JS 定时器不会撤回它们。
  for (const [o, release] of musicVoices) {
    try { o.stop(ctx.currentTime); } catch {} // 已结束但尚未收到 ended 也可安全清理。
    release();
  }
}
export function music(name) {
  current = name;
  if (!sound.music || !SONGS[name]) { stopMusic(); return; }
  const c = ac();
  if (!c || c.state !== 'running') { stopMusic(); return; }
  if (playing === name && musicTimer !== null) return;
  stopMusic(); playing = name;
  const generation = musicGeneration;
  const song = SONGS[name], step = 60 / song.bpm / 2;
  const notes = song.notes.split(' '), bass = song.bass.split(' ');
  const duration = notes.length * step;
  let nextLoopAt = 0;
  const loop = () => {
    if (generation !== musicGeneration) return;
    musicTimer = null;
    if (current !== name || !sound.music || ctx.state !== 'running') { stopMusic(); return; }
    // AudioContext 暂停会冻结音频时钟；墙钟定时器到期不代表上段已播完。
    const remaining = nextLoopAt - ctx.currentTime;
    if (remaining > 0.001) { musicTimer = setTimeout(loop, remaining * 1000); return; }
    const t0 = ctx.currentTime + 0.05;
    notes.forEach((n, i) => { const f = freq(n); if (f) tone(f, t0 + i * step, step * 2.2, { type: 'sine', vol: 0.5, out: musicGain }); });
    bass.forEach((n, i) => tone(freq(n), t0 + i * step * 4, step * 4, { type: 'triangle', vol: 0.35, out: musicGain }));
    nextLoopAt = ctx.currentTime + duration;
    musicTimer = setTimeout(loop, duration * 1000);
  };
  loop();
}
export function unlockAudio() { ac(); if (current && sound.music && musicTimer === null) music(current); }
