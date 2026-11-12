// 预告只读取正式引擎的事件；开战成长在独立副本上结算。
import { card, equipOf, FOOD, RELIC } from '../core/data';
import { simulate, type Ev } from '../core/engine';
import { curNode, endTurn, playerTeam, simOpts, type RunState } from '../core/run';
import type { Side } from './shim';

export interface TargetPos { side: Side; slot: number }
export interface TargetPreview { source: TargetPos | null; target: TargetPos; kind: 'opening' | 'skill' | 'melee' }
export interface TargetPreviews { opening: TargetPreview[]; focused: TargetPreview[] }

/** 只有本场已上阵的实际规则会启用指定猎物。 */
export function canSelectQuarry(r: RunState): boolean {
  const hasTarget = (rules: { phase: string; target: string }[] | undefined) => rules?.some(rule => rule.phase === 'battle' && rule.target === 'quarry') ?? false;
  return r.queue.some(o => !!o && (hasTarget(card(o.def).rules) || hasTarget(equipOf(o.ench)?.rules)
    || (o.supportFoods ?? []).some(id => hasTarget(FOOD[id]?.battleRules))))
    || r.queue.some(Boolean) && r.relics.some(id => hasTarget(RELIC[id]?.battleRules));
}

export function previewTargets(run: RunState): TargetPreviews {
  const r = structuredClone(run);
  endTurn(r);
  const out = simulate(playerTeam(r), r.enemy.units, curNode(r)?.battleSeed ?? r.seed, r.relics, simOpts(r));
  const original = new Map<number, TargetPos>();
  const sides = new Map<number, Side>();
  const slots = r.queue.flatMap((unit, slot) => unit ? [slot] : []);
  for (const s of out.init) {
    const index = out.initOrder[s.side].indexOf(s.uid);
    const slot = s.side === 0 ? slots[index] : index;
    if (slot != null && slot >= 0 && slot < 5) original.set(s.uid, { side: s.side, slot });
    sides.set(s.uid, s.side);
  }
  const opening: TargetPreview[] = [], focused: TargetPreview[] = [];
  const first = new Map<number, { phase: number; melee: boolean }>();
  let clash = 0;
  const hostile = (e: Extract<Ev, { t: 'dmg' }>) => e.src != null && e.kind !== 'burn'
    && sides.has(e.src) && sides.has(e.tgt) && sides.get(e.src) !== sides.get(e.tgt);
  const aim = (e: Extract<Ev, { t: 'dmg' }>, kind: TargetPreview['kind']): TargetPreview | null => {
    const target = original.get(e.tgt);
    if (!target || !hostile(e)) return null;
    return { source: e.src == null ? null : original.get(e.src) ?? null, target, kind };
  };
  for (const e of out.events) {
    if (e.t === 'summon') sides.set(e.unit.uid, e.unit.side);
    if (e.t === 'clash') clash++;
    if (e.t !== 'dmg' || !hostile(e)) continue;
    const kind = e.kind === 'melee' ? 'melee' : clash === 0 ? 'opening' : 'skill';
    const target = aim(e, kind);
    if (target && (clash === 0 || clash === 1 && e.kind === 'melee')) opening.push(target);
    if (e.src == null) continue;
    // 先锁定首次真实伤害的阶段和类别，再映射原盘面；受伤反应可穿插群攻与护卫分担。
    let batch = first.get(e.src);
    if (!batch) first.set(e.src, batch = { phase: clash, melee: e.kind === 'melee' });
    if (target && batch.phase === clash && batch.melee === (e.kind === 'melee')) focused.push(target);
  }
  return { opening, focused };
}
