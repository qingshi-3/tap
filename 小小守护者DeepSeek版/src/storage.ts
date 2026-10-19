/**
 * 本机存档。固定键，与其他游戏隔离。
 * 契约：未知结构/损坏/存储失败都保留原件并返回错误，绝不清空或静默重置。
 * 战斗中只保留本波开始前的检查点。浏览器存储不是跨设备云存档。
 */
import { createGame, restoreGame, serializeGame, replayGame, step } from './core/index.ts';
import type { GameState, RecordedAction } from './core/types.ts';

export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export const RUN_KEY = 'deepseek-guardians.run.v1';
const PROFILE_KEY = 'deepseek-guardians.profile.v1';

interface Envelope { version: 1; runId: string; snapshot: string }

const knownRaw = new WeakMap<GameState, string | null>();
const runIds = new WeakMap<GameState, string>();
let activeId = '';

const defaultPort = (): StoragePort => localStorage;
function fingerprint(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
function readEnvelope(raw: string): Envelope {
  const e: unknown = JSON.parse(raw);
  if (!e || typeof e !== 'object') throw new Error('存档结构无法识别，已保留原件');
  const p = e as Record<string, unknown>;
  if (p.version !== 1 || typeof p.runId !== 'string' || !p.runId || typeof p.snapshot !== 'string' || Object.keys(p).length !== 3)
    throw new Error('存档版本不支持，已保留原件');
  return p as unknown as Envelope;
}
export const activeRunId = (state?: GameState): string => (state ? runIds.get(state) || '' : activeId);

export function loadRun(port?: StoragePort): { state: GameState | null; error?: string } {
  try {
    port ??= defaultPort();
    const raw = port.getItem(RUN_KEY);
    if (raw === null) return { state: null };
    const envelope = readEnvelope(raw);
    const state = restoreGame(envelope.snapshot);
    knownRaw.set(state, raw);
    runIds.set(state, envelope.runId);
    activeId = envelope.runId;
    return { state };
  } catch (error) {
    return { state: null, error: error instanceof Error ? error.message : '读取失败，未覆盖存档' };
  }
}

export function saveRun(state: GameState, port?: StoragePort): { ok: boolean; message?: string } {
  if (state.phase === 'combat') return { ok: true, message: '战斗中保留本波开始前检查点' };
  try {
    port ??= defaultPort();
    const current = port.getItem(RUN_KEY);
    if (knownRaw.has(state) && current !== knownRaw.get(state))
      throw new Error('另一个页面已改变存档，请重新读取；未覆盖新进度');
    if (!knownRaw.has(state) && current !== null)
      throw new Error('已有存档尚未加载，未覆盖进度');
    const runId = runIds.get(state) || crypto.randomUUID();
    const payload: Envelope = { version: 1, runId, snapshot: serializeGame(state) };
    const next = JSON.stringify(payload);
    port.setItem(RUN_KEY, next);
    if (port.getItem(RUN_KEY) !== next) throw new Error('存档写入未确认，请保留当前页面');
    knownRaw.set(state, next);
    runIds.set(state, runId);
    activeId = runId;
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : '保存失败，旧档保持原样' };
  }
}

export function startFreshRun(seed: number, port?: StoragePort): GameState {
  port ??= defaultPort();
  const state = createGame(seed);
  const old = port.getItem(RUN_KEY);
  if (old !== null) {
    const backupKey = `${RUN_KEY}.backup.${fingerprint(old)}`;
    const backup = port.getItem(backupKey);
    if (backup !== null && backup !== old) throw new Error('备份位置已有不同存档，未创建新局');
    port.setItem(backupKey, old);
    if (port.getItem(backupKey) !== old) throw new Error('旧档备份失败，未创建新局');
  }
  knownRaw.set(state, old);
  runIds.set(state, crypto.randomUUID());
  const saved = saveRun(state, port);
  if (!saved.ok) throw new Error(saved.message);
  return state;
}

export function exportReplay(state: GameState): string {
  return JSON.stringify({
    version: 1,
    rulesVersion: state.rulesVersion,
    seed: state.seed,
    mapId: state.mapId,
    tick: state.tick,
    actions: state.actions,
  });
}

export function importReplay(text: string): GameState {
  if (text.length > 2000000) throw new Error('回放过大');
  const raw: unknown = JSON.parse(text);
  if (!raw || typeof raw !== 'object') throw new Error('回放格式无效');
  const p = raw as Record<string, unknown>;
  const fresh = createGame(1);
  if (p.version !== 1 || p.rulesVersion !== fresh.rulesVersion || typeof p.mapId !== 'string')
    throw new Error('回放规则或内容版本不匹配');
  if (typeof p.seed !== 'number' || !Number.isInteger(p.seed) || typeof p.tick !== 'number' || !Number.isInteger(p.tick) || p.tick < 0 || p.tick > 30 * 180 * 7 || !Array.isArray(p.actions) || p.actions.length > 10000)
    throw new Error('回放数据无效');
  const actions = p.actions as RecordedAction[];
  for (const entry of actions) {
    if (!entry || !Number.isInteger(entry.tick) || entry.tick < 0 || entry.tick > p.tick || !entry.action || typeof entry.action !== 'object')
      throw new Error('回放动作无效');
  }
  // 每个动作都必须走同一 applyAction 入口，不允许旁路。
  const state = replayGame(p.seed, actions, p.mapId);
  if (state.tick > p.tick) throw new Error('回放时间顺序无效');
  // 最后一段战斗通常没有玩家动作，必须补齐到终点。
  while (state.tick < p.tick) {
    const before = state.tick;
    step(state, Math.min(100000, p.tick - state.tick));
    if (state.tick === before) throw new Error('回放无法到达终点');
  }
  return state;
}

/* ---------- 局外档案 ---------- */

export interface Profile {
  version: 1;
  discovered: string[];
  stats: { runs: number; wins: number; maxWave: number; kills: number };
  history: { seed: number; wave: number; kills: number; result: 'won' | 'lost' }[];
}

const emptyProfile = (): Profile => ({ version: 1, discovered: [], stats: { runs: 0, wins: 0, maxWave: 0, kills: 0 }, history: [] });
const outcomes = new WeakSet<GameState>();

function validProfile(value: unknown): value is Profile {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  if (p.version !== 1) return false;
  const stats = p.stats as Record<string, unknown> | undefined;
  return Array.isArray(p.discovered) && p.discovered.every((k) => typeof k === 'string')
    && !!stats && ['runs', 'wins', 'maxWave', 'kills'].every((k) => typeof stats[k] === 'number' && Number.isFinite(stats[k]))
    && Array.isArray(p.history) && p.history.length <= 20;
}

export function loadProfile(port?: StoragePort): { profile: Profile; error?: string } {
  try {
    port ??= defaultPort();
    const raw = port.getItem(PROFILE_KEY);
    if (raw === null) return { profile: emptyProfile() };
    const value: unknown = JSON.parse(raw);
    if (!validProfile(value)) throw new Error('档案结构无法识别，已保留原件');
    return { profile: value };
  } catch (error) {
    return { profile: emptyProfile(), error: error instanceof Error ? error.message : '档案读取失败' };
  }
}

function writeProfile(profile: Profile, port?: StoragePort): { ok: boolean; message?: string } {
  try {
    port ??= defaultPort();
    port.setItem(PROFILE_KEY, JSON.stringify(profile));
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : '档案保存失败，旧档保持原样' };
  }
}

export function observeRun(state: GameState, port?: StoragePort): { ok: boolean; message?: string } {
  const seen = new Set(loadProfile(port).profile.discovered);
  let added = false;
  for (const unit of state.units) if (unit.team === 'enemy' && !seen.has(unit.kind)) { seen.add(unit.kind); added = true; }
  if (!added) return { ok: true };
  const { profile } = loadProfile(port);
  profile.discovered = [...seen];
  return writeProfile(profile, port);
}

/** 结算只记录一次，重载同一终局不重复计数。 */
export function recordOutcome(state: GameState, port?: StoragePort): { ok: boolean; message?: string; duplicate?: boolean } {
  if (outcomes.has(state)) return { ok: true, duplicate: true };
  outcomes.add(state);
  const loaded = loadProfile(port);
  const profile = loaded.profile;
  profile.stats.runs += 1;
  if (state.phase === 'won') profile.stats.wins += 1;
  profile.stats.maxWave = Math.max(profile.stats.maxWave, state.stats.wavesCleared);
  profile.stats.kills += state.stats.kills;
  profile.history.unshift({ seed: state.seed, wave: state.stats.wavesCleared, kills: state.stats.kills, result: state.phase === 'won' ? 'won' : 'lost' });
  profile.history = profile.history.slice(0, 12);
  return writeProfile(profile, port);
}
