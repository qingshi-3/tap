// v0.7 §11 自动存档：整局 RunState 序列化，每次变更后保存。
import { SAVE_VERSION, finishBattle, type RunState } from './run';

export const SAVE_KEY = 'zl_expedition_v1';
export type LoadResult = { kind: 'none' } | { kind: 'ok'; run: RunState } | { kind: 'incompatible' };

const store = (): Storage | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
};
const PLAYED_KEY = 'zl_played';
export function saveRun(r: RunState) {
  try { store()?.setItem(SAVE_KEY, JSON.stringify(r)); store()?.setItem(PLAYED_KEY, '1'); } catch { /* 存储满或被禁用时静默 */ }
}
/** 本设备是否正式开过远征（教程不存档，不算）；有存档的老玩家也算 */
export function hasPlayed() {
  try { return store()?.getItem(PLAYED_KEY) === '1' || !!store()?.getItem(SAVE_KEY); } catch { return false; }
}
export function clearRun() {
  try { store()?.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
/** 读档；有「战斗进行中」标记时直接应用已算好的结果（防退出重打） */
export function loadRun(): LoadResult {
  let raw: string | null = null;
  try { raw = store()?.getItem(SAVE_KEY) ?? null; } catch { return { kind: 'none' }; }
  if (!raw) return { kind: 'none' };
  try {
    const r = JSON.parse(raw) as RunState;
    if (!r || r.saveVersion !== SAVE_VERSION) return { kind: 'incompatible' };
    if (r.pending) { finishBattle(r); saveRun(r); }
    return { kind: 'ok', run: r };
  } catch {
    return { kind: 'incompatible' };
  }
}
export const hasSave = () => loadRun().kind !== 'none';
