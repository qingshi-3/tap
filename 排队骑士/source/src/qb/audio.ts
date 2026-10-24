import battle02Url from '../assets/audio/music_battlemap02.m4a?url';
import battle01Url from '../assets/audio/music_battlemap01.m4a?url';
import songhaiUrl from '../assets/audio/music_battlemap_songhai.m4a?url';
import titleUrl from '../assets/audio/music_mainmenu_songhai.m4a?url';

export const MUSIC_TRACKS = [
  { id: 'battle02', label: '战场 02' },
  { id: 'battle01', label: '战场 01' },
  { id: 'songhai', label: 'Songhai' },
] as const;
export type MusicTrackId = typeof MUSIC_TRACKS[number]['id'];
export type MusicSelection = 'random' | MusicTrackId;
type PlayingTrackId = MusicTrackId | 'title';
const musicUrls: Record<PlayingTrackId, string> = { battle02: battle02Url, battle01: battle01Url, songhai: songhaiUrl, title: titleUrl };
const trackIds = MUSIC_TRACKS.map(t => t.id);
let selection: MusicSelection = 'random';
type MusicRun = { key: string; order: MusicTrackId[] };
let rememberedRun: MusicRun | null = null;
try {
  const saved = localStorage.getItem('zl_music_selection');
  if (saved === 'random' || trackIds.includes(saved as MusicTrackId)) selection = saved as MusicSelection;
  const run = JSON.parse(localStorage.getItem('zl_music_run') ?? 'null');
  if (typeof run?.key === 'string' && Array.isArray(run.order) && run.order.length === 3 &&
      new Set(run.order).size === 3 && run.order.every((id: unknown) => trackIds.includes(id as MusicTrackId))) rememberedRun = run;
} catch { /* Audio preferences are optional. */ }
let runKey: string | null = null;
let chapter = 0;
let currentTrack: PlayingTrackId | null = null;
let titleActive = false;
let musicOffset = 0;
let sourceStartedAt = 0;
let ducked = false;
let fadeTimer: ReturnType<typeof setTimeout> | null = null;
let fadeToken = 0;


export type VolumeChannel = 'master' | 'sfx' | 'bgm';
type Volumes = Record<VolumeChannel, number>;
const STORAGE = 'zl_audio_volumes';
const volumes: Volumes = { master: 1, sfx: 1, bgm: 0.2 };
let muted = false;
try {
  muted = localStorage.getItem('zl_muted') === '1';
  const saved = JSON.parse(localStorage.getItem(STORAGE) ?? 'null');
  for (const channel of ['master', 'sfx', 'bgm'] as const) {
    if (typeof saved?.[channel] === 'number' && Number.isFinite(saved[channel]))
      volumes[channel] = Math.max(0, Math.min(1, saved[channel]));
  }
} catch { /* Storage restrictions must not disable play or sound. */ }
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let musicBuffer: AudioBuffer | null = null;
let musicSource: AudioBufferSourceNode | null = null;
let loading: Promise<void> | null = null;
let loadAbort: AbortController | null = null;
let epoch = 0;

let paused = false;
let unlockedByGesture = false;
let needsGesture = false;
let listening = false;

function cancelFade() {
  fadeToken++;
  if (fadeTimer !== null) clearTimeout(fadeTimer);
  fadeTimer = null;
  if (musicGain && ctx) musicGain.gain.cancelScheduledValues(ctx.currentTime);
}
function stopMusic(preservePosition = true) {
  cancelFade();
  const source = musicSource;
  musicSource = null;
  if (source) {
    if (preservePosition && ctx && musicBuffer?.duration)
      musicOffset = (musicOffset + Math.max(0, ctx.currentTime - sourceStartedAt)) % musicBuffer.duration;
    source.onended = null;
    try { source.stop(); } catch { /* Already ended. */ }
    source.disconnect();
  }
}
function canPlayMusic() {
  return !!ctx && ctx.state === 'running' && unlockedByGesture && !needsGesture &&
    !document.hidden && !paused && currentTrack !== null &&
    !muted && volumes.master > 0 && volumes.bgm > 0;
}
function syncMusic() {
  if (!canPlayMusic()) { stopMusic(); return; }
  if (ducked) {
    if (fadeTimer === null) stopMusic();
    return;
  }
  if (musicSource || !ctx || !musicGain || !currentTrack) return;
  if (!musicBuffer) {
    if (loading) return;
    const owner = ctx, generation = epoch, track = currentTrack;
    const abort = new AbortController();
    loadAbort = abort;
    const task = (async () => {
      try {
        const response = await fetch(musicUrls[track], { signal: abort.signal });
        if (!response.ok) throw new Error('Music unavailable');
        const bytes = await response.arrayBuffer();
        if (generation !== epoch || owner !== ctx) return;
        const decoded = await owner.decodeAudioData(bytes);
        if (generation !== epoch || owner !== ctx) return;
        musicBuffer = decoded;
      } catch { /* Failed music is optional; SFX and gameplay continue. */ }
      finally {
        if (generation === epoch && owner === ctx) {
          loading = null; loadAbort = null;
          if (musicBuffer) syncMusic();
        }
      }
    })();
    loading = task;
    return;
  }
  const source = ctx.createBufferSource();
  source.buffer = musicBuffer;
  source.loop = true;
  source.connect(musicGain);
  musicSource = source;
  sourceStartedAt = ctx.currentTime;
  musicGain.gain.cancelScheduledValues(ctx.currentTime);
  musicGain.gain.setValueAtTime(0, ctx.currentTime);
  musicGain.gain.linearRampToValueAtTime(volumes.bgm, ctx.currentTime + 0.3);
  source.onended = () => {
    source.disconnect();
    if (musicSource === source) musicSource = null;
  };
  try { source.start(0, musicOffset); }
  catch { musicSource = null; source.disconnect(); }
}
function changeTrack(track: PlayingTrackId | null) {
  if (currentTrack === track) { syncMusic(); return; }
  epoch++;
  loadAbort?.abort(); loadAbort = null; loading = null;
  stopMusic(false);
  musicOffset = 0;
  // Keep just one decoded track. Stale decode callbacks cannot populate this slot.
  musicBuffer = null;
  currentTrack = track;
  syncMusic();
}
function selectedTrack(): PlayingTrackId | null {
  if (runKey === null) return titleActive ? 'title' : null;
  if (selection !== 'random') return selection;
  return rememberedRun?.order[chapter] ?? null;
}
function updateGains() {
  if (!ctx) return;
  master?.gain.setTargetAtTime(muted ? 0 : volumes.master, ctx.currentTime, 0.02);
  sfxGain?.gain.setTargetAtTime(0.55 * volumes.sfx, ctx.currentTime, 0.02);
  if (!ducked) {
    musicGain?.gain.cancelScheduledValues(ctx.currentTime);
    musicGain?.gain.setTargetAtTime(volumes.bgm, ctx.currentTime, 0.02);
  }
  syncMusic();
}
function suspendAudio() {
  const owner = ctx;
  if (!owner || owner.state === 'closed') return;
  void owner.suspend().then(() => {
    // A failed/closed ad can unpause before suspend() actually changes state.
    // Reconcile current intent, never resume a replaced or disposed context.
    if (ctx === owner && !paused && !document.hidden && !needsGesture) unlockAudio();
  }).catch(() => {});
}
const visibility = () => {
  if (document.hidden) {
    needsGesture = true;
    stopMusic();
    suspendAudio();
  }
};
const gesture = (event: Event) => {
  if (!event.isTrusted || document.hidden) return;
  unlockedByGesture = true;
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

/** Release owned listeners, active sources and in-flight decode ownership. */
export function disposeAudio() {
  document.removeEventListener('visibilitychange', visibility);
  document.removeEventListener('pointerdown', gesture);
  document.removeEventListener('keydown', gesture);
  epoch++;
  loadAbort?.abort(); loadAbort = null; loading = null;
  stopMusic();
  listening = false; needsGesture = false; unlockedByGesture = false;
  runKey = null; currentTrack = null; titleActive = false; musicOffset = 0; ducked = false; paused = false;
  if (ctx) void ctx.close().catch(() => {});
  ctx = null; master = null; sfxGain = null; musicGain = null; noiseBuf = null;
  musicBuffer = null;
}

export function unlockAudio() {
  listen();
  if (document.hidden) return;
  if (navigator.userActivation?.isActive) unlockedByGesture = true;
  if (!unlockedByGesture) return;
  if (muted || paused) return;
  if (needsGesture && !navigator.userActivation?.isActive) return;
  needsGesture = false;
  if (ctx) {
    if (ctx.state === 'suspended') {
      const owner = ctx;
      void ctx.resume().then(() => {
        if (ctx === owner) syncMusic();
      }).catch(() => {});
    } else syncMusic();
    return;
  }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  try {
    ctx = new AC();
    master = ctx.createGain(); sfxGain = ctx.createGain(); musicGain = ctx.createGain();
    master.gain.value = volumes.master;
    sfxGain.gain.value = 0.55 * volumes.sfx;
    musicGain.gain.value = volumes.bgm;
    const comp = ctx.createDynamicsCompressor();
    sfxGain.connect(master); musicGain.connect(master);
    master.connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (ctx.state === 'suspended') {
      const owner = ctx;
      void ctx.resume().then(() => {
        if (ctx === owner) syncMusic();
      }).catch(() => {});
    } else syncMusic();
  } catch { /* Unsupported/blocked audio must not interrupt the game. */ }
}
export function getVolumes(): Volumes { return { ...volumes }; }
export function setVolume(channel: VolumeChannel, value: number) {
  if (!Number.isFinite(value)) return;
  volumes[channel] = Math.max(0, Math.min(1, value));
  try { localStorage.setItem(STORAGE, JSON.stringify(volumes)); } catch { /* Optional persistence. */ }
  updateGains();
}
export function getMusicSelection(): MusicSelection { return selection; }
export function setTitleMusic(active: boolean) {
  titleActive = active;
  changeTrack(selectedTrack());
}
export function setMusicSelection(value: MusicSelection) {
  if (value !== 'random' && !trackIds.includes(value)) return;
  selection = value;
  try { localStorage.setItem('zl_music_selection', value); } catch { /* Optional persistence. */ }
  changeTrack(selectedTrack());
}
/** Chapter is zero-based (0, 1, 2); caller supplies a stable key for the active run. */
export function setMusicRun(key: string | null, nextChapter = 0) {
  if (key !== null && rememberedRun?.key !== key) {
    const order = [...trackIds];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    rememberedRun = { key, order };
    try { localStorage.setItem('zl_music_run', JSON.stringify(rememberedRun)); } catch { /* Optional persistence. */ }
  }
  const changedRun = key !== runKey;
  runKey = key;
  chapter = Number.isFinite(nextChapter) ? Math.max(0, Math.min(2, Math.floor(nextChapter))) : 0;
  if (changedRun) {
    changeTrack(null);
    // A closed modal from the previous run cannot leave the next run ducked.
    ducked = false;
  }
  changeTrack(selectedTrack());
}
export function setMusicDucked(value: boolean) {
  if (ducked === value) return;
  ducked = value;
  cancelFade();
  if (!ducked) {
    if (musicSource && musicGain && ctx) {
      musicGain.gain.setTargetAtTime(volumes.bgm, ctx.currentTime, 0.08);
    }
    syncMusic();
    return;
  }
  if (!musicSource || !musicGain || !ctx || !canPlayMusic()) { stopMusic(); return; }
  const token = fadeToken, source = musicSource;
  musicGain.gain.setValueAtTime(musicGain.gain.value, ctx.currentTime);
  musicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
  fadeTimer = setTimeout(() => {
    if (token !== fadeToken || !ducked || musicSource !== source) return;
    fadeTimer = null;
    stopMusic();
  }, 300);
}
export function setAudioPaused(value: boolean) {
  paused = value;
  if (paused) {
    stopMusic();
    suspendAudio();
  } else if (!needsGesture && !document.hidden) unlockAudio();
}
export function isMuted() { return muted; }
export function setMuted(value: boolean) {
  muted = value;
  try { localStorage.setItem('zl_muted', value ? '1' : '0'); } catch { /* Optional persistence. */ }
  updateGains();
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, slideTo?: number, delay = 0) {
  if (muted || paused || volumes.master <= 0 || volumes.sfx <= 0 || document.hidden || needsGesture || !ctx || !sfxGain || ctx.state !== 'running') return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfxGain);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.3, freq = 1200, q = 0.8, delay = 0, type: BiquadFilterType = 'bandpass') {
  if (muted || paused || volumes.master <= 0 || volumes.sfx <= 0 || document.hidden || needsGesture || !ctx || !sfxGain || !noiseBuf || ctx.state !== 'running') return;
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
  s.connect(f).connect(g).connect(sfxGain);
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
  charge: (ratio = 0.5) => tone(520 + 520 * Math.min(1, ratio), 0.05, 'sine', 0.06),
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
