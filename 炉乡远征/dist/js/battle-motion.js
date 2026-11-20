// Scale only finite battle presentations. Keep authored timings in their own
// timeline so bodies, projectiles, impacts, HUD reveals and completion agree.
// Audio is scheduled on this clock; its playback rate and pitch stay original.
export const BATTLE_PLAYBACK_RATE = 1.6;
export const BATTLE_SPEED_STORAGE_KEY = 'luxiang.battle-speed.v1';
export const BATTLE_SPEED_LEVELS = Object.freeze([1, 2, 3]);
const SPEED_RATES = Object.freeze({ 1: 1.6, 2: 2.5, 3: 3.6 });

const listeners = new Set();

function readStoredSpeed() {
  try {
    const raw = Number(globalThis.localStorage?.getItem(BATTLE_SPEED_STORAGE_KEY));
    if (BATTLE_SPEED_LEVELS.includes(raw)) return raw;
  } catch {}
  return 1;
}

let speedLevel = readStoredSpeed();

export const getBattleSpeed = () => speedLevel;
export const getBattlePlaybackRate = () => SPEED_RATES[speedLevel] ?? BATTLE_PLAYBACK_RATE;
export const battleSpeedScale = () => getBattlePlaybackRate() / BATTLE_PLAYBACK_RATE;

export function setBattleSpeed(level) {
  const next = BATTLE_SPEED_LEVELS.includes(Number(level)) ? Number(level) : 1;
  if (next === speedLevel) return speedLevel;
  speedLevel = next;
  try { globalThis.localStorage?.setItem(BATTLE_SPEED_STORAGE_KEY, String(speedLevel)); } catch {}
  for (const listener of listeners) { try { listener(speedLevel); } catch {} }
  return speedLevel;
}

export function cycleBattleSpeed() {
  const index = BATTLE_SPEED_LEVELS.indexOf(speedLevel);
  return setBattleSpeed(BATTLE_SPEED_LEVELS[(index + 1) % BATTLE_SPEED_LEVELS.length]);
}

export function onBattleSpeedChange(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const battleDelay = milliseconds => milliseconds / getBattlePlaybackRate();
export const battleElapsed = (now, startedAt) => (now - startedAt) * getBattlePlaybackRate();
