import type { RunState } from './run';
import type { BattleOutput, Slotted } from './types';
import { unitDef } from './data';
import { ACHIEVEMENTS, getAchievementProgress } from './achievements';

export const CAREER_KEY = 'zl_career_v1';
const WINDOW = 128;
export interface Totals { played: number; wins: number; losses: number; streak: number; bestStreak: number }
interface Outcome { id: string; general: string; outcome: 'victory' | 'defeat' | 'abandon' }
export interface CareerBattle { key: string; general: string; chapter: number; node: number; beats: number; metrics: Record<string, number>; facts: Record<string, number> }
export interface CareerProfile {
  version: 1; totals: Totals; generals: Record<string, { played: number; wins: number }>;
  best: Record<string, number>; bossBest: Record<string, number>; facts: Record<string, number>;
  achievementPoints: number; unlocked: string[]; activeRunId: string | null;
  storageStatus: 'ok' | 'unavailable' | 'corrupt';
  base: Totals; baseGenerals: Record<string, { played: number; wins: number }>;
  outcomes: Outcome[]; battleKeys: string[];
}
let cached: CareerProfile | undefined;
let cachedRaw: string | null = null;
const blankTotals = (): Totals => ({ played: 0, wins: 0, losses: 0, streak: 0, bestStreak: 0 });
function empty(): CareerProfile { return { version: 1, totals: blankTotals(), generals: {}, best: {}, bossBest: {}, facts: {}, achievementPoints: 0, unlocked: [], activeRunId: null, storageStatus: 'ok', base: blankTotals(), baseGenerals: {}, outcomes: [], battleKeys: [] }; }
function storage(): Storage | null { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } }
/** UUID is independent from the simulation seed; fallback also separates identical seeds. */
export function ensureRunCareer(run: RunState): string {
  if (!run.runId) run.runId = globalThis.crypto?.randomUUID?.() ?? `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return run.runId;
}
export function loadCareer(): CareerProfile {
  // Failed writes are dirty state. Preserve them rather than silently replacing them with disk data.
  if (cached && cached.storageStatus !== 'ok') return cached;
  const s = storage();
  if (!s) { cached ??= empty(); cached.storageStatus = 'unavailable'; return cached; }
  let raw: string | null;
  try { raw = s.getItem(CAREER_KEY); }
  catch { cached ??= empty(); cached.storageStatus = 'unavailable'; return cached; }
  try {
    if (cached && raw === cachedRaw) return cached;
    cachedRaw = raw;
    if (!raw) return cached = empty();
    const value = JSON.parse(raw) as CareerProfile;
    const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
    const numbers = (v: unknown) => record(v) && Object.values(v).every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0);
    const totals = (v: unknown) => numbers(v) && ['played','wins','losses','streak','bestStreak'].every(k => typeof (v as Record<string, unknown>)[k] === 'number');
    const generals = (v: unknown) => record(v) && Object.values(v).every(g => numbers(g) && typeof (g as Record<string, unknown>).played === 'number' && typeof (g as Record<string, unknown>).wins === 'number');
    if (!value || value.version !== 1 || !totals(value.totals) || !totals(value.base)
      || !generals(value.generals) || !generals(value.baseGenerals) || !numbers(value.best) || !numbers(value.bossBest) || !numbers(value.facts)
      || !Array.isArray(value.outcomes) || value.outcomes.length > WINDOW
      || value.outcomes.some(o => !o || typeof o.id !== 'string' || typeof o.general !== 'string' || !['victory','defeat','abandon'].includes(o.outcome))
      || !Array.isArray(value.battleKeys) || value.battleKeys.length > 256 || value.battleKeys.some(k => typeof k !== 'string')
      || typeof value.achievementPoints !== 'number' || !Number.isFinite(value.achievementPoints) || value.achievementPoints < 0
      || !Array.isArray(value.unlocked) || value.unlocked.length > 4096 || value.unlocked.some(k => typeof k !== 'string')
      || !(value.activeRunId === null || typeof value.activeRunId === 'string')) throw new Error('Unsupported career');
    cached = value; cached.storageStatus = 'ok'; return cached;
  } catch { cached = empty(); cached.storageStatus = 'corrupt'; return cached; }
}
function save(profile: CareerProfile) {
  // One key is the transaction boundary. A failed write keeps the dirty in-memory state for retry.
  if (profile.storageStatus === 'corrupt') return;
  try {
    const s = storage(); if (!s) throw new Error('storage unavailable');
    // Another local tab may have committed since this snapshot (or while this tab was dirty).
    // Retain dirty state for recovery instead of overwriting that newer profile.
    if (s.getItem(CAREER_KEY) !== cachedRaw) throw new Error('career changed in another tab');
    profile.storageStatus = 'ok';
    const raw = JSON.stringify(profile); s.setItem(CAREER_KEY, raw); cachedRaw = raw;
  }
  catch { profile.storageStatus = 'unavailable'; }
}
function add(t: Totals, generals: CareerProfile['generals'], item: Outcome) {
  t.played++; const g = generals[item.general] ??= { played: 0, wins: 0 }; g.played++;
  if (item.outcome === 'victory') { t.wins++; g.wins++; t.streak++; t.bestStreak = Math.max(t.bestStreak, t.streak); }
  else { t.losses++; t.streak = 0; }
}
function recalc(p: CareerProfile) {
  while (p.outcomes.length > WINDOW) add(p.base, p.baseGenerals, p.outcomes.shift()!);
  p.totals = { ...p.base }; p.generals = structuredClone(p.baseGenerals);
  for (const item of p.outcomes) add(p.totals, p.generals, item);
  const progress = getAchievementProgress(p);
  for (const a of progress) if (a.completed && !p.unlocked.includes(a.id)) p.unlocked.push(a.id);
  p.achievementPoints = ACHIEVEMENTS.filter(a => p.unlocked.includes(a.id)).reduce((s, a) => s + a.points, 0);
}
function maximize(target: Record<string, number>, facts: Record<string, number>) { for (const [key, n] of Object.entries(facts)) if (Number.isFinite(n) && n >= 0) target[key] = Math.max(target[key] ?? 0, n); }
function growth(run: RunState, slots: readonly (Slotted | null)[], bench: readonly (Slotted | null)[]) {
  const units = [...slots, ...bench].filter((u): u is Slotted => !!u);
  const field = slots.filter((u): u is Slotted => !!u);
  const defs = field.map(u => unitDef(u.defId));
  return { gold: run.gold, genPower: run.genPower, promotions: run.promoCount, passives: run.passives.length,
    equips: units.reduce((n,u) => n + (u.equips?.length ?? 0), 0), maxStars: Math.max(0, ...units.map(u => u.copies === 4 ? 3 : u.copies)),
    trained: Math.max(0, ...units.map(u => Object.values(u.train ?? {}).reduce<number>((a,b) => a + (b ?? 0), 0))),
    fullRoster: units.length, spells: run.activeSpells.length,
    fieldCount: field.length, fieldNoLegendary: defs.every(d => d.tier < 4) ? 1 : 0,
    fieldFactions: new Set(defs.map(d => d.faction)).size,
    fieldNeutral: defs.filter(d => d.faction === 'neutral').length,
    fieldDual: field.some(u => (u.equips?.length ?? 0) >= 2) ? 1 : 0,
    fieldThreeStar: field.filter(u => u.copies === 4).length };
}
/** Stage on the authoritative run; saveRun commits this only after the run itself is durable. */
export function recordOfficialBattle(run: RunState, out: BattleOutput, checkpoint: RunState,
  slots: readonly (Slotted | null)[] = checkpoint.slots, bench: readonly (Slotted | null)[] = checkpoint.bench): CareerProfile {
  const id = ensureRunCareer(run);
  if (out.fault || out.result !== 'win' || (checkpoint.runId && checkpoint.runId !== id)) return loadCareer();
  const metrics: Record<string, number> = {};
  for (const [k,v] of Object.entries(out.metrics ?? {})) if (typeof v === 'number' && Number.isFinite(v) && v >= 0) metrics[k] = v;
  run.careerPending = { key: `${id}:${checkpoint.chapter}:${checkpoint.node}`, general: run.general,
    chapter: checkpoint.chapter, node: checkpoint.node, beats: Number.isFinite(out.beats) ? Math.max(0, out.beats) : 0, metrics,
    facts: growth(checkpoint, slots, bench) };
  return loadCareer();
}
/** Called after the run save commits; replays safely after a crash before profile save. */
export function observeRun(run: RunState): CareerProfile {
  const p = loadCareer(); const id = ensureRunCareer(run);
  if (run.careerPrevious && p.activeRunId !== id) {
    const previous = run.careerPrevious;
    // This durable outbox can only close the identity it replaced.
    if (p.activeRunId && p.activeRunId !== previous.id) return p;
    const i = p.outcomes.findIndex(x => x.id === previous.id);
    if (i < 0) p.outcomes.push(previous);
    else if (p.outcomes[i].outcome !== 'victory') p.outcomes[i] = previous;
    p.activeRunId = id;
  }
  if (p.activeRunId !== id && run.careerActivateFrom !== undefined && run.careerActivateFrom === p.activeRunId) p.activeRunId = id;
  if (p.activeRunId && p.activeRunId !== id) return p;
  p.activeRunId = id;
  const b = run.careerPending;
  if (b && b.key.startsWith(id + ':') && !p.battleKeys.includes(b.key)) {
    maximize(p.best, b.metrics); maximize(p.facts, b.facts);
    if (b.node === 8) { const key = String(b.chapter); p.bossBest[key] = Math.min(p.bossBest[key] ?? Infinity, b.beats); p.facts[`boss_${key}`] = 1; }
    const challenges: Record<string, number> = { winSmall: (b.facts.fullRoster ?? 9) <= 4 ? 1 : 0,
      winNoSpell: b.facts.spells === 0 ? 1 : 0, winFast: b.beats <= 10 ? 1 : 0,
      winZero: b.beats === 0 ? 1 : 0, burnAndFreeze: b.metrics.burnDamage > 0 && b.metrics.freezes > 0 ? 1 : 0,
      guardAndBlock: b.metrics.guards > 0 && b.metrics.blocks > 0 ? 1 : 0,
      reviveAndSummon: b.metrics.revives > 0 && b.metrics.summons > 0 ? 1 : 0,
      spellAndStrike: b.metrics.spellDamage > 0 && b.metrics.attackDamage > 0 ? 1 : 0,
      bossNoLegendary: b.node === 8 && b.facts.fieldNoLegendary === 1 ? 1 : 0,
      winThreeFactions: b.facts.fieldFactions >= 3 ? 1 : 0,
      winThreeNeutral: b.facts.fieldNeutral >= 3 ? 1 : 0,
      winDual: b.facts.fieldDual > 0 ? 1 : 0,
      winThreeStars: b.facts.fieldThreeStar >= 3 ? 1 : 0,
      thornsAndArmor: b.metrics.thornsDamage > 0 && b.metrics.mitigated > 0 ? 1 : 0,
      freezeAndCast: b.metrics.freezes > 0 && b.metrics.casts > 0 ? 1 : 0,
      summonAndSacrifice: b.metrics.summons > 0 && b.metrics.sacrifices > 0 ? 1 : 0 };
    maximize(p.facts, challenges); p.battleKeys.push(b.key); p.battleKeys = p.battleKeys.slice(-256);
  }
  const index = p.outcomes.findIndex(x => x.id === id);
  if (run.over) { const item: Outcome = { id, general: run.general, outcome: run.over }; if (index < 0) p.outcomes.push(item); else p.outcomes[index] = item; }
  else if (index >= 0 && p.outcomes[index].outcome !== 'abandon') p.outcomes.splice(index, 1);
  recalc(p); save(p); return p;
}
/** Register the new active identity only on deliberate new-game creation, never a late callback. */
export function activateCareerRun(run: RunState) { const p = loadCareer(); p.activeRunId = ensureRunCareer(run); save(p); }
export function recordRunOutcome(run: RunState, outcome: 'victory' | 'defeat' | 'abandon'): CareerProfile {
  const p = loadCareer(), id = ensureRunCareer(run);
  if (p.activeRunId && p.activeRunId !== id) return p;
  const index = p.outcomes.findIndex(x => x.id === id);
  if (outcome === 'abandon' && (run.over || index >= 0)) return p;
  const item: Outcome = { id, general: run.general, outcome };
  if (index < 0) p.outcomes.push(item); else p.outcomes[index] = item;
  recalc(p); save(p); return p;
}

/** Stage before saveRun(next); if that write fails neither expedition changes in career storage. */
export function stageRunReplacement(previous: RunState | null | undefined, next: RunState) {
  ensureRunCareer(next);
  next.careerActivateFrom = loadCareer().activeRunId;
  if (previous) next.careerPrevious = { id: ensureRunCareer(previous), general: previous.general, outcome: previous.over ?? 'abandon' };
}
