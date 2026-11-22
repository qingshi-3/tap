import type { BattleOut, DmgKind, Snap } from '../core/engine';
import type { Kw } from '../core/data';

const KW_NAMES: Record<Kw, string> = { block: '格挡', reborn: '复生', splash: '溅射' };

export type MomentAction = { kind: 'damage' | 'heal' | 'block' | 'die' | 'summon' | 'revive' | 'trigger' | 'fizzle' | 'buff' | 'stat' | 'kw'; src: number | null; tgt: number | null; value?: number; label?: string; damageKind?: DmgKind; side: 0 | 1 | null };
export interface ReviewMoment { title: string; a: number | null; b: number | null; actions: MomentAction[]; damage: [number, number]; dead: Set<number> }

/** 按事件顺序重建有效伤害；每段保存交锋结束时的阵亡状态。 */
export function battleMoments(out: BattleOut): { moments: ReviewMoment[]; units: Map<number, Snap> } {
  const units = new Map<number, Snap>(out.init.map((s) => [s.uid, { ...s }]));
  const alive = new Set(out.init.map((s) => s.uid));
  const moments: ReviewMoment[] = [{ title: '开战前', a: null, b: null, actions: [], damage: [0, 0], dead: new Set() }];
  let page = moments[0];
  const add = (action: MomentAction) => { page.actions.push(action); };
  for (const e of out.events) {
    if (e.t === 'clash') {
      page = { title: `交锋 ${e.n}`, a: e.a, b: e.b, actions: [], damage: [0, 0], dead: new Set() };
      moments.push(page);
    } else if (e.t === 'dmg') {
      const target = units.get(e.tgt), source = e.src === null ? undefined : units.get(e.src);
      const value = target ? Math.max(0, target.hp - Math.max(0, e.hp)) + Math.max(0, target.shield - e.shield) : 0;
      if (source && target && source.side !== target.side) page.damage[source.side] += value;
      add({ kind: e.blocked && !value ? 'block' : 'damage', src: e.src, tgt: e.tgt, value, damageKind: e.kind, side: source?.side ?? null });
      if (target) { target.hp = e.hp; target.shield = e.shield; target.block = e.block; }
    } else if (e.t === 'heal') {
      add({ kind: 'heal', src: e.src, tgt: e.tgt, value: e.n, side: units.get(e.src)?.side ?? null });
      const target = units.get(e.tgt); if (target) target.hp = e.hp;
    } else if (e.t === 'block') add({ kind: 'block', src: e.src, tgt: e.tgt, value: e.n, side: units.get(e.src)?.side ?? null });
    else if (e.t === 'buff') {
      const target = units.get(e.tgt), atk = target ? e.nowAtk - target.atk : e.atk, hp = target ? e.nowHp - target.hp : e.hp;
      add({ kind: 'buff', src: e.src, tgt: e.tgt, label: `${atk >= 0 ? '+' : ''}${atk}/${hp >= 0 ? '+' : ''}${hp}`, side: units.get(e.src)?.side ?? null });
      if (target) { target.atk = e.nowAtk; target.hp = e.nowHp; }
    } else if (e.t === 'kw') {
      add({ kind: 'kw', src: e.src, tgt: e.tgt, label: e.kws.map((k) => KW_NAMES[k]).join('、'), side: units.get(e.src)?.side ?? null });
      const u = units.get(e.tgt); if (u) u.kws = [...new Set([...u.kws, ...e.kws])];
    } else if (e.t === 'stat') {
      add({ kind: 'stat', src: null, tgt: e.uid, label: `护盾 ${e.shield} · 灼烧 ${e.burn}`, side: units.get(e.uid)?.side ?? null });
      const u = units.get(e.uid); if (u) { u.shield = e.shield; u.burn = e.burn; }
    }
    else if (e.t === 'die') { alive.delete(e.uid); add({ kind: 'die', src: e.uid, tgt: e.uid, side: units.get(e.uid)?.side ?? null }); }
    else if (e.t === 'summon') { units.set(e.unit.uid, { ...e.unit }); alive.add(e.unit.uid); add({ kind: e.revive ? 'revive' : 'summon', src: e.src, tgt: e.unit.uid, label: `${e.unit.atk}/${e.unit.hp}`, side: units.get(e.src ?? e.unit.uid)?.side ?? null }); }
    else if (e.t === 'trigger' || e.t === 'fizzle') add({ kind: e.t, src: e.uid, tgt: null, label: e.label, side: units.get(e.uid)?.side ?? null });
    page.dead = new Set([...units.keys()].filter((uid) => !alive.has(uid)));
  }
  return { moments, units };
}

/** 仅把触发后连续、同来源的记录排在一起；关系只表示先后，不推断因果。 */
export function groupMomentActions(actions: MomentAction[]): MomentAction[][] {
  const groups: MomentAction[][] = [];
  for (const action of actions) {
    const previous = groups[groups.length - 1];
    if (previous && previous[0].kind === 'trigger' && action.kind !== 'trigger' && action.kind !== 'fizzle'
      && action.kind !== 'die' && action.src !== null && action.src === previous[0].src) {
      previous.push(action);
    } else groups.push([action]);
  }
  return groups;
}

import { card } from '../core/data';


export interface BattleMoment { title: string; lines: string[] }

/** 来源和目标都来自本场事件，按开战/交锋分页，回放不重新计算。 */
export function battleTimeline(out: BattleOut): BattleMoment[] {
  const states = new Map<number, Snap>(out.init.map((s) => [s.uid, { ...s }]));
  const name = (uid: number | null) => {
    const s = uid == null ? null : states.get(uid);
    return s ? `${s.side ? '敌·' : ''}${card(s.def).name}` : '场上效果';
  };
  const pages: BattleMoment[] = [{ title: '开战至首次交锋前', lines: [] }];
  let page = pages[0];
  for (const e of out.events) {
    let line = '';
    switch (e.t) {
      case 'clash': page = { title: `交锋 ${e.n} 及随后效果`, lines: [`${name(e.a)} ↔ ${name(e.b)}`] }; pages.push(page); break;
      case 'trigger': line = `${name(e.uid)} · ${e.label}`; break;
      case 'dmg': {
        const s = states.get(e.tgt);
        const actual = s ? Math.max(0, s.hp - Math.max(0, e.hp)) + Math.max(0, s.shield - e.shield) : 0;
        line = `${name(e.src)} → ${name(e.tgt)}：${e.blocked && !actual ? '格挡' : `${actual} 伤害`}`;
        if (s) { s.hp = e.hp; s.shield = e.shield; s.block = e.block; }
        break;
      }
      case 'buff': {
        const s = states.get(e.tgt);
        const signed = (n: number) => n > 0 ? `+${n}` : String(n);
        const a = s ? e.nowAtk - s.atk : e.atk, hp = s ? e.nowHp - s.hp : e.hp;
        line = `${name(e.src)} → ${name(e.tgt)}：${signed(a)}/${signed(hp)}${!a && !hp ? '（未增加属性）' : ''}`;
        if (s) { s.atk = e.nowAtk; s.hp = e.nowHp; }
        break;
      }
      case 'heal': line = `${name(e.src)} → ${name(e.tgt)}：回复 ${e.n}`; if (states.has(e.tgt)) states.get(e.tgt)!.hp = e.hp; break;
      case 'block': line = `${name(e.tgt)} 获得 ${e.n} 层格挡`; break;
      case 'kw': { const s = states.get(e.tgt); if (s) s.kws = [...new Set([...s.kws, ...e.kws])]; line = `${name(e.src)} → ${name(e.tgt)}：获得 ${e.kws.map((k) => KW_NAMES[k]).join('、')}`; break; }
      case 'stat': { const s = states.get(e.uid); if (s) { s.shield = e.shield; s.burn = e.burn; } break; }
      case 'die': line = `${name(e.uid)} 阵亡`; break;
      case 'summon': states.set(e.unit.uid, { ...e.unit }); line = `${name(e.src)} ${e.revive ? '复生' : '召唤'} ${name(e.unit.uid)} ${e.unit.atk}/${e.unit.hp}`; break;
      case 'fizzle': line = `${name(e.uid)} · ${e.label}`; break;
    }
    if (line) page.lines.push(line);
  }
  return pages;
}
