import { card } from '../core/data';
import type { BattleOut, Snap } from '../core/engine';

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
      case 'stat': { const s = states.get(e.uid); if (s) { s.shield = e.shield; s.burn = e.burn; } break; }
      case 'die': line = `${name(e.uid)} 阵亡`; break;
      case 'summon': states.set(e.unit.uid, { ...e.unit }); line = `${name(e.src)} ${e.revive ? '复生' : '召唤'} ${name(e.unit.uid)} ${e.unit.atk}/${e.unit.hp}`; break;
      case 'fizzle': line = `${name(e.uid)} · ${e.label}`; break;
    }
    if (line) page.lines.push(line);
  }
  return pages;
}
