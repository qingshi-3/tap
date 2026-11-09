// 备战连线：点选单位时，画出它的技能和哪些位置有关（身前 / 身后 / 敌方队首…），目标不存在时画红色失效箭头
import { card } from '../core/data';
import type { ArrowKind } from '../qb/board';
import type { Side } from '../qb/shim';

/** slot 可以越界（-1 = 队首之前，QUEUE_MAX = 队尾之后），用来画失效 / 召唤落点 */
export interface LinkPos { side: Side; slot: number }
export interface Link { from: LinkPos; to: LinkPos; kind: ArrowKind; label: string; broken?: boolean; owner: LinkPos }
export interface LinkUnit { def: string; lvl: number; hp?: number }

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
      const add = (to: LinkPos, kind: ArrowKind, label: string, broken = false) => out.push({ from, to, kind, label, broken, owner: from });
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
      const enemyByHealth = (highest: boolean, label: string) => {
        const known = foe.filter(s => sides[other][s]?.hp != null);
        if (known.length !== foe.length || !known.length) return;
        const targetHp = (highest ? Math.max : Math.min)(...known.map(s => sides[other][s]!.hp!));
        const targets = known.filter(s => sides[other][s]!.hp === targetHp);
        if (targets.length === 1) add({ side: other, slot: targets[0] }, 'dmg', label);
      };
      const u2 = d.u?.[u.lvl - 1] ?? 0;
      // Random targets and team-wide listeners have no fixed directed target.
      // Their complete conditions remain visible in the unit detail.
      switch (d.ab) {
        // 战斗
        case 'elephant': behind('dmg', '打1', v); break;
        case 'tiger': front('buff', '再放一次'); break;
        case 'camel': behind('buff', `+${v}/+${u2}`); break;
        case 'flamingo': behind('buff', `+${v}/+${v}`, 2); break;
        case 'turtle': behind('block', '+1挡', v); break;
        case 'dodo': front('buff', `${v}%攻`); break;
        case 'snake':
          if (k === 0) add({ side, slot: slot - 1 }, 'buff', '无友军', true);
          else out.push({ from: { side, slot: mine[k - 1] }, to: from, kind: 'buff', label: '攻击后', owner: from });
          enemyAt(0, 'dmg', '追击');
          break;
        case 'kangaroo': front('buff', '攻击后'); break;
        case 'badger': behind('dmg', `${v}%攻`); if (k === 0) enemyAt(0, 'dmg', `${v}%攻`); else ally(mine[k - 1], 'dmg', `${v}%攻`); break;
        case 'dolphin': enemyByHealth(false, `血最低 打${v}`); break;
        case 'croc': enemyAt(foe.length - 1, 'dmg', `打${v}`); break;
        case 'skunk': enemyByHealth(true, `血最高 -${v}%`); break;
        case 'rhino': enemyAt(1, 'dmg', `击杀后 打${v}`); break;
        // 商店
        case 'tfish': front('buff', `+${v}血`); behind('buff', `+${v}血`); break;
        case 'backstab': front('buff', `+${v}攻`); break;
        case 'caretaker': front('buff', `永久加血后 +${v}攻`); break;
        case 'spellgrow': front('buff', `施法 +${v}/+${v}`); break;
        case 'giraffe': front('buff', '+1/+1', v); break;
        case 'seal':
          for (const s of [slot - 1, slot + 1]) if (sides[side][s]) ally(s, 'buff', `吃补给 +${v}/+${v}`);
          break;
        case 'wyvern':
          // 没有选定食用者时展示可能受益的相邻格；实际结算排除食用者并优先身前。
          for (const s of [slot - 1, slot + 1]) if (sides[side][s]) ally(s, 'buff', `相邻分发·至多${v}个`);
          break;
      }
    });
  }
  return out;
}
