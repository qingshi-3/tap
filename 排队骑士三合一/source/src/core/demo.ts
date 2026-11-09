// 图鉴实机演示的战斗配置：纯数据 + 真实引擎模拟，不碰 DOM。
import { card, type Atom } from './data';
import { simulate, type BattleOut, type Ev } from './engine';

export interface DemoUnit {
  id: string;
  lv?: 1 | 2 | 3;
  /** 不给就用卡面数值（按星级补成长） */
  atk?: number;
  hp?: number;
  eq?: string;
  ax?: Atom[];
}
/** 命中判定：事件 + 单位属于哪一方 */
export type DemoHit = (ev: Ev, side: (uid: number | null | undefined) => 0 | 1 | undefined, def: (uid: number | null | undefined) => string | undefined) => boolean;
export interface DemoSpec {
  me: DemoUnit[];
  foe: DemoUnit[];
  relics?: string[];
  hit: DemoHit;
  /** 目标出现后再播几次交锋（默认 1） */
  tail?: number;
  seed?: number;
  /** 镜头主角：默认取事件本身的单位；'clash' 看中线 */
  focus?: 'clash';
}

const GROW = [0, 2, 5];
const spec = (u: DemoUnit) => {
  const d = card(u.id), lv = u.lv ?? 1;
  return { def: u.id, lvl: lv, atk: u.atk ?? d.atk + GROW[lv - 1], hp: u.hp ?? d.hp + GROW[lv - 1], ench: u.eq ?? null, ax: u.ax };
};

/** 模拟并截取：返回截断后的输出与命中事件下标（-1 未命中） */
export function demoOutput(s: DemoSpec): { out: BattleOut; at: number } {
  const out = simulate(s.me.map(spec), s.foe.map(spec), s.seed ?? 7, s.relics ?? []);
  const units = new Map(out.init.map((u) => [u.uid, u]));
  for (const e of out.events) if (e.t === 'summon') units.set(e.unit.uid, e.unit);
  const side = (uid: number | null | undefined) => (uid == null ? undefined : units.get(uid)?.side);
  const def = (uid: number | null | undefined) => (uid == null ? undefined : units.get(uid)?.def);
  const at = out.events.findIndex((e) => s.hit(e, side, def));
  let end = out.events.length;
  let clashes = 0;
  const from = at >= 0 ? at + 1 : 0, limit = at >= 0 ? (s.tail ?? 1) : 4;
  for (let i = from; i < out.events.length; i++) if (out.events[i].t === 'clash' && ++clashes > limit) { end = i; break; }
  return { out: { ...out, events: out.events.slice(0, end) }, at };
}

/** 事件落在哪个单位上 */
export function focusUid(ev: Ev): number | null {
  switch (ev.t) {
    case 'trigger': case 'fizzle': case 'die': case 'stat': return ev.uid;
    case 'dmg': case 'heal': case 'buff': case 'block': case 'kw': return ev.tgt;
    case 'summon': return ev.unit.uid;
    default: return null;
  }
}
