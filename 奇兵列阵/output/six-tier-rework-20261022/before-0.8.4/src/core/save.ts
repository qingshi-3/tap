// Run save is the durable outbox for career metrics and replacement settlements.
import { CONTENT_STRUCTURE, CONTENT_VERSION, SAVE_VERSION, claimPendingEggs, finishBattle, recoverEmptyRoster, type RunState } from './run';
import { GENERAL_MAP, UNIT_MAP } from './data';
import { EQUIP_MAP, PASSIVE_MAP, SPELL_MAP } from './content';
import { activateCareerRun, CAREER_KEY, ensureRunCareer, loadCareer, observeRun } from './career';

export const SAVE_KEY = 'zl_expedition_v1';
/** 0.8.1 之前的存档没有 contentStructure 字段：0.8.0 就是结构 1 */
const structureOf = (r: RunState) => r.contentStructure ?? (r.contentVersion === '0.8.0' ? 1 : 0);
/** 存档里引用的每个 ID 都还在当前内容里，才允许续玩（兜底：忘记升结构版本时不至于崩） */
export function runFitsContent(r: RunState): boolean {
  const units = [...(r.slots ?? []), ...(r.bench ?? [])].filter((u): u is NonNullable<typeof u> => !!u);
  return !!GENERAL_MAP[r.general]
    && units.every((u) => !!UNIT_MAP[u.defId] && (u.equips ?? []).every((e) => !!EQUIP_MAP[e]))
    && (r.draft ?? []).every((id) => !!UNIT_MAP[id])
    && [...(r.passives ?? []), ...(r.promo ?? [])].every((id) => !!PASSIVE_MAP[id])
    && (r.bag ?? []).every((id) => !!EQUIP_MAP[id])
    && [...(r.spells ?? []), ...(r.activeSpells ?? [])].every((id) => !!SPELL_MAP[id]);
}
/** 设置里的「清除全部数据」：远征、生涯、教学和提示进度；声音偏好保留 */
export function clearAllData() {
  const s = store(); if (!s) return;
  for (const k of [SAVE_KEY, PLAYED_KEY, CAREER_KEY, 'zl_tutorial_done', 'zl_coach']) { try { s.removeItem(k); } catch { /* ignore */ } }
  accessedRunId = null;
}
export type LoadResult = { kind: 'none' } | { kind: 'ok'; run: RunState } | { kind: 'incompatible' };
const store = (): Storage | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };
const PLAYED_KEY = 'zl_played';
// The identity this tab actually loaded/saved; clearRun must not adopt a different tab's save.
let accessedRunId: string | null = null;
/** False means the durable run/profile pair is incomplete; the outbox remains available for retry. */
export function saveRun(r: RunState): boolean {
  ensureRunCareer(r);
  try {
    const s = store(); if (!s) return false;
    const durableRaw = s.getItem(SAVE_KEY);
    if (durableRaw) {
      const durable = JSON.parse(durableRaw) as RunState;
      if (!durable || durable.saveVersion !== SAVE_VERSION || !durable.runId) return false;
      if (durable.runId !== r.runId && r.careerPrevious?.id !== durable.runId && r.careerActivateFrom !== durable.runId) return false;
    }
    const p = loadCareer();
    // A callback from an earlier expedition must never replace the active save.
    if (p.activeRunId && p.activeRunId !== r.runId && r.careerPrevious?.id !== p.activeRunId && r.careerActivateFrom !== p.activeRunId) return false;
    // Recheck immediately before mutation; no asynchronous work may intervene in this write path.
    if (s.getItem(SAVE_KEY) !== durableRaw) return false;
    s.setItem(SAVE_KEY, JSON.stringify(r));
    accessedRunId = r.runId!;
    const profile = observeRun(r);
    if (profile.storageStatus !== 'ok') return false;
    try { s.setItem(PLAYED_KEY, '1'); } catch { /* Nonessential convenience flag; run is already durable. */ }
    return true;
  } catch { return false; }
}
export function hasPlayed() { try { return store()?.getItem(PLAYED_KEY) === '1' || !!store()?.getItem(SAVE_KEY); } catch { return false; } }
/** Do not discard a durable statistics outbox while career storage is failing. */
export function clearRun(options: { discardIncompatible?: boolean } = {}): boolean {
  try {
    const s = store(); if (!s) return false;
    const raw = s.getItem(SAVE_KEY); if (!raw) return true;
    let run: RunState | undefined;
    try { run = JSON.parse(raw) as RunState; } catch { /* Explicit incompatible discard below. */ }
    if (!run || run.saveVersion !== SAVE_VERSION || !run.runId) {
      if (!options.discardIncompatible) return false;
    } else {
      if (run.runId !== accessedRunId) return false;
      if (run.pending) finishBattle(run);
      if (observeRun(run).storageStatus !== 'ok') return false;
    }
    if (s.getItem(SAVE_KEY) !== raw) return false;
    s.removeItem(SAVE_KEY); accessedRunId = null; return true;
  } catch { return false; }
}
/** Recover pending battle results and replay metrics without reconstructing history. */
export function loadRun(): LoadResult {
  let raw: string | null = null;
  try { raw = store()?.getItem(SAVE_KEY) ?? null; } catch { return { kind: 'none' }; }
  if (!raw) return { kind: 'none' };
  try {
    const r = JSON.parse(raw) as RunState;
    if (!r || r.saveVersion !== SAVE_VERSION || structureOf(r) !== CONTENT_STRUCTURE || !runFitsContent(r)
      || (r.pendingEggs !== undefined && (!Number.isSafeInteger(r.pendingEggs) || r.pendingEggs < 0))) return { kind: 'incompatible' };
    // 只改数值的更新：沿用存档，记下当前版本号
    r.contentVersion = CONTENT_VERSION; r.contentStructure = CONTENT_STRUCTURE;
    if (r.general === 'xingjiao') r.pendingEggs ??= 0;
    const hadId = !!r.runId; ensureRunCareer(r);
    if (!hadId) {
      // Never publish a legacy identity to career storage until the identity itself is durable.
      try { const s = store(); if (!s) return { kind: 'ok', run: r }; s.setItem(SAVE_KEY, JSON.stringify(r)); }
      catch { return { kind: 'ok', run: r }; }
    }
    accessedRunId = r.runId!;
    // A replacement outbox must close the previous run before it activates this one.
    if (r.careerPrevious) observeRun(r); else activateCareerRun(r);
    const hadPending = !!r.pending;
    if (r.pending) finishBattle(r);
    const claimedEggs = claimPendingEggs(r);
    const recovered = recoverEmptyRoster(r);
    if (hadPending || claimedEggs || recovered || !hadId || r.careerPending || r.careerPrevious || r.over) saveRun(r);
    else observeRun(r);
    return { kind: 'ok', run: r };
  } catch { return { kind: 'incompatible' }; }
}
export const hasSave = () => loadRun().kind !== 'none';
