import { CARD, SHOP_POOL, card, type CardDef } from '../../src/core/data';
import { simulate, type BattleOut, type UnitSpec } from '../../src/core/engine';
import { maxTier } from '../../src/core/run';

type Level = 1 | 2 | 3;
type Stage = 'base' | 'grown' | 'late';
interface Context { id: string; size: number; support: string[] }
export interface Cell {
  unit: string; level: Level; stage: Stage; turn: number; context: string; position: number;
  n: number; factual: number; blank: number; delta: number; positive: number; negative: number;
  marginDelta: number; triggers: number; fizzles: number; left: number; right: number;
}
export interface Replacement {
  unit: string; alternative: string; n: number; score: number; alternativeScore: number; delta: number;
}
export interface Sensitivity {
  unit: string; type: 'upgrade-1-2' | 'upgrade-2-3' | 'duplicate'; position: number;
  n: number; before: number; after: number; delta: number;
}
const CONTEXTS: Context[] = [
  { id: 'neutral', size: 5, support: [] },
  { id: 'rotate', size: 5, support: ['l_vigil', 'l_caliber', 'n_medic', 's_step', 'l_shield', 'l_windblade'] },
  { id: 'blade', size: 5, support: ['v_guard', 's_dancer', 's_viper', 's_dart', 's_fox'] },
  { id: 'soul', size: 5, support: ['a_imp', 'a_graveguard', 'a_reaper', 'a_ritualist', 'a_spine'] },
  { id: 'beast-open', size: 4, support: ['m_egg', 'm_incubator', 'm_bloodcaller', 'm_heart', 'm_whelp', 'm_raptor'] },
  { id: 'beast-full', size: 5, support: ['m_egg', 'm_incubator', 'm_bloodcaller', 'm_heart', 'm_whelp', 'm_raptor'] },
  { id: 'frost', size: 5, support: ['v_guard', 'v_snowman', 'v_keeper', 'v_bear', 'v_queen', 'v_scout'] },
  { id: 'mixed', size: 5, support: ['l_vigil', 's_dancer', 'a_imp', 'v_snowman', 'l_shield', 's_dart'] },
];
const FOES: Context[] = [
  { id: 'plain-five', size: 5, support: [] },
  { id: 'tall-three', size: 3, support: [] },
  { id: 'shield', size: 5, support: ['v_guard', 'v_keeper', 'v_bear', 'v_queen', 'v_snowman'] },
  { id: 'rotate', size: 5, support: ['l_vigil', 's_step', 'l_caliber', 'n_medic', 'l_shield'] },
  { id: 'death', size: 5, support: ['a_imp', 'a_graveguard', 'a_reaper', 'a_ritualist', 'a_spine'] },
  { id: 'summon', size: 4, support: ['m_titan', 'm_incubator', 'm_bloodcaller', 'm_heart', 'm_egg', 'm_whelp', 'm_raptor'] },
  { id: 'ranged', size: 5, support: ['v_guard', 's_dart', 's_dancer', 's_viper', 's_lord', 's_fox'] },
  { id: 'opening', size: 5, support: ['s_fox', 's_hunter', 's_master', 'v_scout', 'v_wyvern'] },
];
const BLANK = '__audit_plain';
const bonusFor = (stage: Stage) => ({ base: 0, grown: 6, late: 18 })[stage];
const turnFor = (d: CardDef, stage: Stage) => Math.max(d.tier * 2 - 1, stage === 'base' ? 1 : stage === 'grown' ? 7 : 13);
const score = (o: BattleOut, side: number) => o.result === 'draw' ? .5 : (o.result === 'win') === (side === 0) ? 1 : 0;
const realSpec = (id: string, level: Level, growth: number, oid?: number): UnitSpec => {
  const d = card(id);
  const copies = [0, 2, 5][level - 1];
  return { def: id, lvl: level, atk: Math.min(50, d.atk + copies + growth), hp: Math.min(50, d.hp + copies + growth), oid,
    ...(d.ab === 'egg' ? { bank: Math.min(40, growth) } : {}) };
};
function support(context: Context, tier: number, level: Level, growth: number, exclude?: string | string[]) {
  const excluded = typeof exclude === 'string' ? [exclude] : exclude ?? [];
  const ids = context.support.filter((id) => !excluded.includes(id) && card(id).tier <= tier);
  return Array.from({ length: context.size - (exclude ? 1 : 0) }, (_, i) => realSpec(ids[i % Math.max(1, ids.length)] ?? BLANK, level, growth));
}
function teamFor(d: CardDef, level: Level, stage: Stage, context: Context, position: number) {
  const growth = bonusFor(stage);
  const companions = support(context, maxTier(turnFor(d, stage)), level, growth, d.id);
  companions.splice(position, 0, realSpec(d.id, level, growth, 1));
  return companions;
}
const total = (team: UnitSpec[]) => team.reduce((n, u) => n + u.atk + u.hp, 0);
/** Equal total printed attack+health across opponent archetypes; mechanics remain deliberately different. */
function normalized(team: UnitSpec[], budget: number) {
  const out = team.map((u) => ({ ...u }));
  const original = total(team);
  const target = Math.min(out.length * 100, Math.max(out.length * 2, Math.round(budget)));
  for (const u of out) {
    u.atk = Math.max(1, Math.min(50, Math.round(u.atk * target / original)));
    u.hp = Math.max(1, Math.min(50, Math.round(u.hp * target / original)));
  }
  let difference = target - total(out);
  for (let guard = 0; difference && guard < 1000; guard++) {
    const u = out[Math.floor(guard / 2) % out.length];
    const key = guard % 2 ? 'hp' : 'atk';
    const change = Math.sign(difference);
    if (u[key] + change >= 1 && u[key] + change <= 50) { u[key] += change; difference -= change; }
  }
  return out;
}
function margin(out: BattleOut, side: number) {
  const living = new Map(out.init.map((u) => [u.uid, { side: u.side, hp: u.hp }]));
  for (const e of out.events) {
    if (e.t === 'die') living.delete(e.uid);
    if (e.t === 'summon') living.set(e.unit.uid, { side: e.unit.side, hp: e.unit.hp });
    if (e.t === 'dmg' || e.t === 'heal') { const u = living.get(e.tgt); if (u) u.hp = Math.max(0, e.hp); }
    if (e.t === 'buff') { const u = living.get(e.tgt); if (u) u.hp = Math.max(0, e.nowHp); }
  }
  const ours = [...living.values()].filter((u) => u.side === side).reduce((n, u) => n + u.hp, 0);
  const theirs = [...living.values()].filter((u) => u.side !== side).reduce((n, u) => n + u.hp, 0);
  return (ours - theirs) / Math.max(1, out.init.reduce((n, u) => n + u.hp, 0));
}
const simulateSide = (ours: UnitSpec[], foes: UnitSpec[], seed: number, side: number) => side ? simulate(foes, ours, seed) : simulate(ours, foes, seed);
export function runComparison(options: { seeds: number; progress?: (s: string) => void; limit?: number }) {
  const cells: Cell[] = [];
  const matchup = new Map<string, { unit: string; foe: string; n: number; delta: number; factual: number; blank: number }>();
  const replacements: Replacement[] = [];
  let battles = 0;
  CARD[BLANK] = { id: BLANK, name: '测试白板', tier: 1, atk: 2, hp: 3, kws: [], line: 'enemy', text: '' };
  const tested = SHOP_POOL.slice(0, options.limit ?? SHOP_POOL.length);
  try {
    for (const [index, d] of tested.entries()) {
      const blankId = `__audit_without_${d.id}`;
      CARD[blankId] = { ...d, id: blankId, ab: undefined, v: undefined, u: undefined, kws: [], text: '', perm: false };
      for (const level of [1, 2, 3] as const) for (const stage of ['base', 'grown', 'late'] as const) {
        const turn = turnFor(d, stage);
        const tier = maxTier(turn);
        const growth = bonusFor(stage);
        for (const context of CONTEXTS) for (let position = 0; position < context.size; position++) {
          const ours = teamFor(d, level, stage, context, position);
          const blank = ours.map((u, i) => i === position ? { ...u, def: blankId } : u);
          const cell: Cell = { unit: d.id, level, stage, turn, context: context.id, position, n: 0, factual: 0, blank: 0, delta: 0,
            positive: 0, negative: 0, marginDelta: 0, triggers: 0, fizzles: 0, left: 0, right: 0 };
          for (const foe of FOES) {
            const enemy = normalized(support(foe, tier, level, growth), total(ours));
            const key = `${d.id}/${foe.id}`;
            const match = matchup.get(key) ?? { unit: d.id, foe: foe.id, n: 0, delta: 0, factual: 0, blank: 0 };
            for (let seed = 1; seed <= options.seeds; seed++) for (const side of [0, 1]) {
              const a = simulateSide(ours, enemy, seed * 104729 + 37, side);
              const b = simulateSide(blank, enemy, seed * 104729 + 37, side);
              battles += 2;
              const sa = score(a, side), sb = score(b, side), delta = sa - sb;
              const targetUid = a.init.find((u) => u.side === side && u.def === d.id)?.uid;
              cell.n++; cell.factual += sa; cell.blank += sb; cell.delta += delta;
              cell.positive += delta > 0 ? 1 : 0; cell.negative += delta < 0 ? 1 : 0;
              cell.marginDelta += margin(a, side) - margin(b, side);
              cell.triggers += a.events.filter((e) => e.t === 'trigger' && e.uid === targetUid).length;
              cell.fizzles += a.events.filter((e) => e.t === 'fizzle' && e.uid === targetUid).length;
              if (side === 0) cell.left += sa; else cell.right += sa;
              match.n++; match.delta += delta; match.factual += sa; match.blank += sb;
            }
            matchup.set(key, match);
          }
          cells.push(cell);
        }
      }
      // Predeclared shared shells, all seats; exclude BOTH alternatives from companions to avoid duplicate contamination.
      const native: Record<string, string> = { rotate: 'rotate', blade: 'blade', soul: 'soul', beast: 'beast-open', frost: 'frost', sand: 'mixed' };
      for (const alternative of SHOP_POOL.filter((c) => c.tier === d.tier && c.id > d.id)) {
        const r: Replacement = { unit: d.id, alternative: alternative.id, n: 0, score: 0, alternativeScore: 0, delta: 0 };
        const shells = [...new Set(['neutral', 'mixed', native[d.line], native[alternative.line]])].map((id) => CONTEXTS.find((c) => c.id === id)!);
        for (const context of shells) for (let position = 0; position < context.size; position++) {
          const companions = support(context, maxTier(turnFor(d, 'grown')), 1, 6, [d.id, alternative.id]);
          const ours = [...companions], other = [...companions];
          ours.splice(position, 0, realSpec(d.id, 1, 6, 1));
          other.splice(position, 0, realSpec(alternative.id, 1, 6, 1));
          for (const foe of FOES) {
            const enemy = normalized(support(foe, maxTier(turnFor(d, 'grown')), 1, 6), (total(ours) + total(other)) / 2);
            for (let k = 0; k < Math.min(options.seeds, 8); k++) for (const side of [0, 1]) {
              const seed = 900001 + k * 7919;
              const a = simulateSide(ours, enemy, seed, side), b = simulateSide(other, enemy, seed, side);
              battles += 2;
              r.n++; r.score += score(a, side); r.alternativeScore += score(b, side); r.delta += score(a, side) - score(b, side);
            }
          }
        }
        replacements.push(r);
        replacements.push({ unit: alternative.id, alternative: d.id, n: r.n, score: r.alternativeScore, alternativeScore: r.score, delta: -r.delta });
      }
      delete CARD[blankId];
      options.progress?.(`${index + 1}/${tested.length} ${d.name}，累计 ${battles.toLocaleString()} 场`);
    }
  } finally {
    delete CARD[BLANK];
    for (const d of tested) delete CARD[`__audit_without_${d.id}`];
  }
  return { battles, cells, matchups: [...matchup.values()], replacements,
    method: { seeds: options.seeds, contexts: CONTEXTS, foes: FOES, stages: { base: '+0/+0', grown: '+6/+6', late: '+18/+18' },
      score: '胜=1，平=.5，负=0；比较同身材技能清空对照，左右各一次；替代比较用预注册中立/混搭/双方流派共同壳、全部位置，排除双方在支持位的重复污染，固定同一敌方预算与独立种子。',
      caveats: ['环境等权是实验选择，不代表真实对手分布。', '同种子在触发次数不同后随机抽样可能分叉；它降低噪声但不是逐次随机命中的精确反事实。',
        '按卡阶限制支持单位；支持位在可用池中循环，满编与四人壳分别记录。', '成型高星与固定成长是受控上限，不代表自然商店可获得。',
        '同阶替换测整卡即时战斗性价比，不包含此前/未来经济作用；不能用该局部结果宣称全局严格压制。', 'margin仅用于胜负不变时的剩余生命辅助信号，不计格挡与未兑现成长。'] } };
}

/** Isolate skill-level changes from copy-stat bonuses, and the second copy's skill from its body. */
export function runSensitivity(cells: Cell[], seeds: number) {
  const rows: Sensitivity[] = [];
  let battles = 0;
  CARD[BLANK] = { id: BLANK, name: '测试白板', tier: 1, atk: 2, hp: 3, kws: [], line: 'enemy', text: '' };
  const ids = [...new Set(cells.map((c) => c.unit))];
  try {
    for (const id of ids) {
      const d = card(id);
      const best = cells.filter((c) => c.unit === id && c.level === 1 && c.stage === 'grown')
        .sort((a, b) => b.delta / b.n - a.delta / a.n || b.marginDelta / b.n - a.marginDelta / a.n)[0];
      const context = CONTEXTS.find((c) => c.id === best.context)!;
      const team = teamFor(d, 1, 'grown', context, best.position);
      const blankId = `__audit_extra_without_${id}`;
      CARD[blankId] = { ...d, id: blankId, ab: undefined, kws: [], v: undefined, u: undefined, perm: false };
      const variants: { type: Sensitivity['type']; position: number; before: UnitSpec[]; after: UnitSpec[] }[] = [];
      for (const [a, b, type] of [[1, 2, 'upgrade-1-2'], [2, 3, 'upgrade-2-3']] as const) {
        variants.push({ type, position: best.position,
          before: team.map((u, i) => i === best.position ? { ...u, lvl: a } : u),
          after: team.map((u, i) => i === best.position ? { ...u, lvl: b } : u) });
      }
      for (let position = 0; position < team.length; position++) if (position !== best.position) {
        const after = team.map((u, i) => i === position ? realSpec(id, 1, 6, 2) : u);
        const before = after.map((u, i) => i === position ? { ...u, def: blankId } : u);
        variants.push({ type: 'duplicate', position, before, after });
      }
      for (const variant of variants) {
        const row: Sensitivity = { unit: id, type: variant.type, position: variant.position, n: 0, before: 0, after: 0, delta: 0 };
        for (const foe of FOES) {
          const enemy = normalized(support(foe, maxTier(turnFor(d, 'grown')), 1, 6), total(variant.before));
          for (let k = 0; k < seeds; k++) for (const side of [0, 1]) {
            const seed = 2000003 + k * 15485863;
            const a = simulateSide(variant.before, enemy, seed, side), b = simulateSide(variant.after, enemy, seed, side);
            row.n++; battles += 2; row.before += score(a, side); row.after += score(b, side); row.delta += score(b, side) - score(a, side);
          }
        }
        rows.push(row);
      }
      delete CARD[blankId];
    }
  } finally {
    delete CARD[BLANK];
    for (const id of ids) delete CARD[`__audit_extra_without_${id}`];
  }
  return { rows, battles, note: '升星对比固定同一面板，只变技能等级，不计额外2/3份复制的身材；经济收益看商店测量。第二张对比固定双张面板，清空第二张技能作对照，并扫描所有其余位。使用独立种子与候选有利壳，非全局最优。' };
}
