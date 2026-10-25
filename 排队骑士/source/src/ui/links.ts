// 备战连线：点选单位时，画出它的技能和哪些位置有关（身前 / 身后 / 敌方队首…），目标不存在时画红色失效箭头
import { card, summonInfo } from '../core/data';
import type { ArrowKind } from '../qb/board';
import type { Side } from '../qb/shim';

/** slot 可以越界（-1 = 队首之前，QUEUE_MAX = 队尾之后），用来画失效 / 召唤落点 */
export interface LinkPos { side: Side; slot: number }
export interface Link { from: LinkPos; to: LinkPos; kind: ArrowKind; label: string; broken?: boolean }
export interface LinkUnit { def: string; lvl: number }

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
      /** 阵亡召唤出现在原位：箭头画回自己 */
      const summonHere = (label: string) => add({ side, slot }, 'summon', label);
      const others = (kind: ArrowKind, label: string) => mine.forEach((s) => { if (s !== slot) ally(s, kind, label); });
      const allFoes = (kind: ArrowKind, label: string) => foe.forEach((s) => add({ side: other, slot: s }, kind, label));
      const lead = (kind: ArrowKind, label: string) => { if (k > 0) ally(mine[0], kind, label); };
      const u2 = d.u?.[u.lvl - 1] ?? 0;
      const sum = summonInfo(d, u.lvl as 1 | 2 | 3);
      if (sum) summonHere(sum.def ? `${sum.count > 1 ? `${sum.count}×` : ''}${d.ab === 'rooster' ? '小兽' : d.ab === 'egg' ? '幼龙' : `${sum.atk}/${sum.hp}`}` : `随机${sum.tier}阶`);
      switch (d.ab) {
        // 战斗
        case 'elephant': behind('dmg', '打1', v); break;
        case 'tiger': front('buff', '再放一次'); break;
        case 'camel': behind('buff', `+${v}/+${u2}`); break;
        case 'flamingo': behind('buff', `+${v}/+${v}`, 2); break;
        case 'turtle': behind('block', '+1挡', v); break;
        case 'dodo': front('buff', `${v}%攻`); break;
        case 'snake': front('buff', '攻击后'); enemyAt(0, 'dmg', `${v}%攻`); break;
        case 'kangaroo': front('buff', '攻击后'); break;
        case 'ox': others('buff', '阵亡时'); break;
        case 'drill': behind('dmg', '打1 +1攻', v); break;
        case 'anvil': others('dmg', `打1×${v}`); add(from, 'dmg', `打1×${v}`); break;
        case 'storm': others('buff', '受伤时'); break;
        case 'idol': others('buff', `+${v}/+${v}`); break;
        case 'badger': behind('dmg', `${v}%攻`); if (k === 0) enemyAt(0, 'dmg', `${v}%攻`); else ally(mine[k - 1], 'dmg', `${v}%攻`); break;
        case 'mosquito': allFoes('dmg', `随机${v}个`); break;
        case 'blowfish': allFoes('dmg', `随机打${v}`); break;
        case 'dolphin': allFoes('dmg', `血最低 打${v}`); break;
        case 'croc': enemyAt(foe.length - 1, 'dmg', `打${v}`); break;
        case 'skunk': allFoes('dmg', `血最高 -${v}%`); break;
        case 'leopard': allFoes('dmg', `随机${v}个`); break;
        case 'rhino': enemyAt(1, 'dmg', `击杀后 打${v}`); break;
        case 'hedgehog': allFoes('dmg', `打${v}`); others('dmg', `打${v}`); break;
        case 'mammoth': others('buff', `+${v}/+${v}`); break;
        case 'shark': others('buff', '友军阵亡'); break;
        case 'fly': others('summon', `${v}/${v}`); break;
        case 'ant': others('buff', `随机+${v}/+${u2}`); break;
        // 商店
        case 'tfish': front('buff', `+${v}血`); behind('buff', `+${v}血`); break;
        case 'backstab': front('buff', `+${v}攻`); break;
        case 'giraffe': front('buff', '+1/+1', v); break;
        case 'bluebird': if (k < mine.length - 1) ally(mine[mine.length - 1], 'buff', `+${v}攻`); break;
        case 'monkey': lead('buff', `+${v}/+${u2}`); break;
        case 'parrot': front('buff', '复制技能'); break;
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
