// v0.7 §5 刷卡推荐：三个候选分别走「贴近 / 相关 / 探索」权重，显示顺序打乱，不对玩家公开。
// 先按品质权重抽品质，再在该品质内按位置权重抽卡；随机数只走 rngState。
import { ROLE_TAGS, tagFamily } from './data';
import { rand, shuffle, weighted, type RngHolder } from './rng';
import type { Slotted, UnitDef } from './types';

export interface RecState {
  /** 最近 2 次刷新出现过的卡（递减） */
  recent: string[][];
  /** 出现但没拿的卡，剩余降权次数 */
  skipped: { id: string; left: number }[];
  /** 连续没出现已持有同名卡的刷新次数（保底） */
  dry: number;
}
export const newRec = (): RecState => ({ recent: [], skipped: [], dry: 0 });

export interface RecInput {
  /** New rules keep charge as individual timing, never a related-build affinity. */
  tacticsVersion?: 1;
  /** 已按阵营与品质上限过滤的卡池 */
  pool: readonly UnitDef[];
  /** 品质权重 [普通, 稀有, 史诗, 传说] */
  weights: readonly number[];
  /** 场上 + 备战 */
  owned: readonly (Slotted | null)[];
  /** 场上（相关位只看场上阵容） */
  field: readonly (Slotted | null)[];
}
type Role = 'close' | 'related' | 'explore';

const mech = (d: UnitDef, tacticsVersion?: 1) => (d.tags ?? []).filter((t) => !ROLE_TAGS.includes(t)
  && (tacticsVersion !== 1 || tagFamily(t) !== '蓄力'));
/** 已持有且未满三星的同名份数列表 */
function ownedCopies(owned: readonly (Slotted | null)[]) {
  const m = new Map<string, number[]>();
  for (const u of owned) if (u && u.copies < 6) m.set(u.defId, [...(m.get(u.defId) ?? []), u.copies]);
  return m;
}

function roleWeight(role: Role, d: UnitDef, inp: RecInput, rec: RecState, ctx: ReturnType<typeof context>) {
  let w = 1;
  if (role === 'close') {
    const cs = ctx.owned.get(d.id);
    if (cs?.length) {
      w *= 2.5;
      if (cs.some(c => c === 2 || c === 5)) w *= 1.3;
      w *= Math.min(4, 1 + 0.5 * rec.dry);
    }
  } else if (role === 'related') {
    const fams = new Set(mech(d, inp.tacticsVersion).map(tagFamily));
    let shared = 0;
    for (const f of fams) if (ctx.teamFam.has(f)) shared++;
    w += Math.min(2.4, 0.8 * shared);
    const pair = mech(d, inp.tacticsVersion).some((t) => (t.startsWith('给') && ctx.teamTags.has('吃' + t.slice(1)))
      || (t.startsWith('吃') && ctx.teamTags.has('给' + t.slice(1))));
    if (pair) w *= 1.5;
  }
  if (rec.recent.some((ids) => ids.includes(d.id))) w *= 0.6;
  if (rec.skipped.some((s) => s.id === d.id && s.left > 0)) w *= 0.5;
  return w;
}
function context(inp: RecInput) {
  const teamTags = new Set<string>(), teamFam = new Set<string>();
  for (const u of inp.field) {
    if (!u) continue;
    const d = inp.pool.find((x) => x.id === u.defId);
    for (const t of d ? mech(d, inp.tacticsVersion) : []) { teamTags.add(t); teamFam.add(tagFamily(t)); }
  }
  return { owned: ownedCopies(inp.owned), teamTags, teamFam };
}

/** 先抽品质（只在该品质还有可选卡时计权），再在品质内按 wfn 抽卡 */
export function drawOne(h: RngHolder, pool: readonly UnitDef[], weights: readonly number[], wfn: (d: UnitDef) => number,
  exclude: ReadonlySet<string>): UnitDef | null {
  const groups = Array.from({ length: weights.length }, (_, i) => i + 1).map((t) => pool.filter((d) => d.tier === t && !exclude.has(d.id)));
  const qi = weighted(h, weights.map((w, i) => (groups[i].some((d) => wfn(d) > 0) ? w : 0)));
  if (qi < 0) return null;
  const g = groups[qi], i = weighted(h, g.map(wfn));
  return i < 0 ? g[Math.floor(rand(h) * g.length)] : g[i];
}

/** 推荐算法抽 n 张不重复候选；update 为 true 时写入递减 / 保底 / 跳过记录 */
export function recommend(h: RngHolder, inp: RecInput, rec: RecState, n = 3, update = true): string[] {
  const ctx = context(inp);
  const roles = shuffle(h, ['close', 'related', 'explore'] as Role[]);
  const out: string[] = [], taken = new Set<string>();
  for (let i = 0; i < n; i++) {
    const role = roles[i % roles.length];
    const d = drawOne(h, inp.pool, inp.weights, (x) => roleWeight(role, x, inp, rec, ctx), taken);
    if (!d) break;
    out.push(d.id); taken.add(d.id);
  }
  if (update && out.length === n) {
    rec.recent = [out, ...rec.recent].slice(0, 2);
    rec.dry = out.some((id) => ctx.owned.has(id)) ? 0 : rec.dry + 1;
    rec.skipped = rec.skipped.map((s) => ({ ...s, left: s.left - 1 })).filter((s) => s.left > 0);
  }
  return out;
}
/** 出现但没拿的卡：接下来 2 次刷新内降权 */
export function markSkipped(rec: RecState, ids: readonly string[]) {
  for (const id of ids) {
    rec.skipped = rec.skipped.filter((s) => s.id !== id);
    rec.skipped.push({ id, left: 2 });
  }
}
/** 招募令：从筛选后的卡池按品质权重纯随机抽 n 张；must 为必出的同名卡 */
export function filtered(h: RngHolder, pool: readonly UnitDef[], weights: readonly number[], n = 3, must?: string): string[] {
  const out: string[] = [], taken = new Set<string>();
  if (must && pool.some((d) => d.id === must)) { out.push(must); taken.add(must); }
  while (out.length < n) {
    const d = drawOne(h, pool, weights.map((w) => w || 0.0001), () => 1, taken);
    if (!d) break;
    out.push(d.id); taken.add(d.id);
  }
  return shuffle(h, out);
}
