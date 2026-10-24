// 备战连线：点选单位时，画出它的技能和哪些位置有关（身前 / 身后 / 敌方队首…），目标不存在时画红色失效箭头
import { card } from '../core/data';
import { QUEUE_MAX } from '../core/engine';
import type { ArrowKind } from '../qb/board';
import type { Side } from '../qb/shim';

/** slot 可以越界（-1 = 队首之前，QUEUE_MAX = 队尾之后），用来画失效 / 召唤落点 */
export interface LinkPos { side: Side; slot: number }
export interface Link { from: LinkPos; to: LinkPos; kind: ArrowKind; label: string; broken?: boolean }
export interface LinkUnit { def: string; lvl: number; rotate?: boolean }

/** sides[side][boardSlot]：备战盘面（可有空格；战斗里会按顺序挤紧） */
export function computeLinks(sides: [(LinkUnit | null)[], (LinkUnit | null)[]]): Link[] {
  const out: Link[] = [];
  const order = (side: Side) => sides[side].map((u, i) => (u ? i : -1)).filter((i) => i >= 0);
  for (const side of [0, 1] as Side[]) {
    const mine = order(side);
    const foe = order((1 - side) as Side);
    const other = (1 - side) as Side;
    mine.forEach((slot, k) => {
      const u = sides[side][slot]!;
      const d = card(u.def);
      const v = d.v?.[u.lvl - 1] ?? 0;
      const from = { side, slot };
      const add = (to: LinkPos, kind: ArrowKind, label: string, broken = false) => out.push({ from, to, kind, label, broken });
      const ally = (s: number, kind: ArrowKind, label: string) => add({ side, slot: s }, kind, label);
      const enemyAt = (i: number, kind: ArrowKind, label: string) => { const s = foe[i] ?? foe[0]; if (s != null) add({ side: other, slot: s }, kind, label); };
      // 身前：没有友军时朝前画一支红箭头
      const front = (kind: ArrowKind, label: string, n = 1) => {
        if (k === 0) { add({ side, slot: slot - 1 }, kind, '无友军', true); return; }
        for (let i = 1; i <= n && k - i >= 0; i++) ally(mine[k - i], kind, label);
      };
      const behind = (kind: ArrowKind, label: string, n = 1) => {
        if (k === mine.length - 1) { add({ side, slot: slot + 1 }, kind, '无友军', true); return; }
        for (let i = 1; i <= n && k + i < mine.length; i++) ally(mine[k + i], kind, label);
      };
      const summonBehind = (label: string) => add({ side, slot: slot + 1 }, 'summon', mine.length >= QUEUE_MAX ? '队伍满' : label, mine.length >= QUEUE_MAX);
      const summonTail = (label: string) => add({ side, slot: Math.min(QUEUE_MAX, mine[mine.length - 1] + 1) }, 'summon', label);
      const others = (kind: ArrowKind, label: string, pred: (x: LinkUnit) => boolean = () => true) =>
        mine.forEach((s) => { if (s !== slot && pred(sides[side][s]!)) ally(s, kind, label); });
      const allFoes = (kind: ArrowKind, label: string) => foe.forEach((s) => add({ side: other, slot: s }, kind, label));
      const lead = (kind: ArrowKind, label: string) => { if (k > 0) ally(mine[0], kind, label); };
      switch (d.ab) {
        case 'dart': front('block', '受伤时'); enemyAt(0, 'dmg', `打${v}`); break;
        case 'dancer': front('block', '交锋时'); enemyAt(0, 'dmg', `${v}%攻`); break;
        case 'backstab': front('buff', `+${v}攻`); break;
        case 'snowman': front('block', `+${v}挡`); break;
        case 'howler': front('buff', `+${v}/+${v}`, 2); break;
        case 'raptor': case 'rex': summonBehind(`${v}/${v}`); break;
        case 'chanter': behind('buff', '复生', v); break;
        case 'cult': behind('buff', `${v}%攻血`); break;
        case 'ritualist': case 'kujata': summonTail(`${v}/${v}`); break;
        case 'matriarch': summonTail('复制'); break;
        case 'mage': lead('buff', `+${v}血`); break;
        case 'wkeeper': lead('block', '+1挡'); break;
        case 'tether': lead('buff', '退后'); break;
        case 'warden': others('buff', `+${v}血`, (x) => !!x.rotate || card(x.def).kws.includes('rotate')); break;
        case 'medic': others('buff', `回${v}`, (x) => !!x.rotate || card(x.def).kws.includes('rotate')); break;
        case 'keeper': others('buff', '升星时'); break;
        case 'onyx': others('buff', `+${v}/+${v}`); break;
        case 'queen': others('block', `+${v}挡`); enemyAt(0, 'dmg', `打${d.u?.[u.lvl - 1] ?? 0}`); break;
        case 'spine': case 'storm': enemyAt(0, 'dmg', `打${v}`); break;
        case 'lord': enemyAt(0, 'dmg', '后排齐射'); break;
        case 'scout': enemyAt(0, 'chill', `-${v}攻`); break;
        case 'step': enemyAt(1, 'dmg', `打${v}`); break;
        case 'rhyno': enemyAt(1, 'dmg', `打${v}`); break;
        case 'nightmare': allFoes('dmg', `${v}`); break;
        case 'wyvern': allFoes('chill', `-${v}攻`); break;
      }
    });
  }
  return out;
}
