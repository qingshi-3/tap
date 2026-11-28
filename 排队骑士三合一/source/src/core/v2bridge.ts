// v2 引擎接旧播放层的桥：
//   ① 把 v2 卡牌（id 加 v2_ 前缀）注册进旧卡牌查找表，单位视图、提示框据此取名字、阵营、素材；
//   ② 把 v2 战斗日志逐条转换成旧播放器 BattlePlayer 认识的事件流（Ev）。
// 播放器只读事件；v2 的状态（蓄力、冰冻、标记）用快照前后对比同步。
import { registerCards, type CardDef as OldCardDef, type Faction as OldFaction, type Line, type Tier } from './data';
import type { Ev, Order, Snap } from './engine';
import { CARDS as V2_CARDS } from './v2/cards';
import type { CardDef, Faction, LogEntry, Snapshot } from './v2/types';

export const V2_PREFIX = 'v2_';
export const v2Def = (id: string) => V2_PREFIX + id;

const FACTION: Record<Faction, OldFaction> = { shield: 'light', blade: 'shadow', abyss: 'abyss', frost: 'frost', neutral: 'neutral', enemy: 'enemy', token: 'neutral' };
const LINE: Record<OldFaction, Line> = { light: 'hurt', shadow: 'start', abyss: 'death', magma: 'any', frost: 'food', desert: 'grow', neutral: 'any', enemy: 'enemy' };
// 召唤物跟随召唤者的阵营配色
const TOKEN_FACTION: Record<string, OldFaction> = { shade: 'abyss', wolf1: 'frost', wolf3: 'frost' };

function toOld(d: CardDef): OldCardDef {
  const faction = d.faction === 'token' ? TOKEN_FACTION[d.id] ?? 'neutral' : FACTION[d.faction];
  return {
    id: v2Def(d.id), name: d.name, faction, line: LINE[faction], art: d.art,
    tier: Math.max(1, Math.min(6, d.tier)) as Tier, atk: d.atk, hp: d.hp, kws: [], abilities: [],
    text: d.text, goldText: d.lv3 !== '—' ? `3 级：${d.lv3}` : undefined,
    token: d.faction === 'token' || undefined, enemy: d.faction === 'enemy' || undefined,
  };
}

let registered = false;
/** 幂等：第一次进 v2 战斗时注册 */
export function registerV2Cards() {
  if (registered) return;
  registered = true;
  registerCards(Object.values(V2_CARDS).map(toOld));
}

type SnapUnit = Snapshot['lines'][number][number];

export function toOldSnap(u: SnapUnit, side: 0 | 1): Snap {
  return {
    uid: u.uid, side, def: v2Def(u.id), lvl: u.lvl, atk: u.atk, hp: u.hp, maxHp: u.maxHp, block: u.block, kws: [],
    shield: u.shield, burn: 0, charge: u.charge, mark: u.mark, rounds: 0, stun: u.stun,
  };
}

const orderOf = (snap: Snapshot): Order => [snap.lines[0].map((u) => u.uid), snap.lines[1].map((u) => u.uid)];
function find(snap: Snapshot, uid: unknown): { u: SnapUnit; side: 0 | 1 } | null {
  for (const side of [0, 1] as const) {
    const u = snap.lines[side].find((x) => x.uid === uid);
    if (u) return { u, side };
  }
  return null;
}

/** 开场阵容（取日志第一条的快照） */
export function initialOf(snap: Snapshot): { init: Snap[]; initOrder: Order } {
  return { init: [0, 1].flatMap((side) => snap.lines[side].map((u) => toOldSnap(u, side as 0 | 1))), initOrder: orderOf(snap) };
}

const LABEL: Record<string, string> = { combo: '连击', assist: '协同', snipe: '狙击' };
const MOVE_WHY: Record<string, string> = {
  swap: '换位', knockback: '击退', pull: '拉拽', insert: '插队', rotate: '轮换', hunt: '围猎', scout: '侦察换位', regroup: '重整',
};

/**
 * 日志转换器：逐段喂入新的日志条目，输出旧播放器的事件。
 * 内部记住上一次的站位和每个单位的蓄力、冰冻、标记，变化时补发 counter 事件。
 */
export class LogConverter {
  private order: Order;
  private last = new Map<number, { charge: number; stun: number; mark: number }>();

  constructor(first: Snapshot) {
    this.order = orderOf(first);
    this.remember(first);
  }

  private remember(snap: Snapshot) {
    for (const ln of snap.lines) for (const u of ln) this.last.set(u.uid, { charge: u.charge, stun: u.stun, mark: u.mark });
  }

  /** 快照里蓄力、冰冻、标记有变化的单位，补发 counter */
  private sync(snap: Snapshot, out: Ev[]) {
    for (const ln of snap.lines) for (const u of ln) {
      const p = this.last.get(u.uid);
      if (p && p.charge === u.charge && p.stun === u.stun && p.mark === u.mark) continue;
      out.push({ t: 'counter', uid: u.uid, charge: u.charge, mark: u.mark, rounds: 0, stun: u.stun });
    }
    this.remember(snap);
  }

  convert(entries: LogEntry[]): Ev[] {
    const out: Ev[] = [];
    for (const e of entries) {
      const snap = e.snap;
      const uid = e.uid as number;
      const at = (id: unknown) => find(snap, id);
      switch (e.t) {
        case 'round': {
          const a = snap.lines[0][0], b = snap.lines[1][0];
          if (a && b) out.push({ t: 'clash', n: e.round, a: a.uid, b: b.uid });
          break;
        }
        case 'attack':
          if (e.label && e.label !== 'clash') out.push({ t: 'trigger', uid: e.src as number, label: LABEL[e.label as string] ?? String(e.label) });
          break;
        case 'hit': {
          // 格挡吃掉了这一击：旧播放器按"格挡碎裂"表现
          if (!e.blockUsed) break;
          const f = at(uid);
          if (f) out.push({ t: 'dmg', src: e.src as number, tgt: uid, n: 0, blocked: true, kind: 'melee', hp: f.u.hp, block: f.u.block, shield: f.u.shield });
          break;
        }
        case 'absorb': {
          const f = at(uid);
          if (f) out.push({ t: 'dmg', src: null, tgt: uid, n: e.n as number, blocked: true, kind: 'shot', hp: f.u.hp, block: f.u.block, shield: f.u.shield });
          break;
        }
        case 'damage': {
          const f = at(uid);
          if (f) out.push({
            t: 'dmg', src: (e.src as number | undefined) ?? null, tgt: uid, n: e.n as number, blocked: false,
            kind: e.kind === 'attack' ? 'melee' : e.kind === 'fatigue' ? 'burn' : 'shot', hp: f.u.hp, block: f.u.block, shield: f.u.shield,
          });
          break;
        }
        case 'cast': out.push({ t: 'trigger', uid: e.src as number, label: String(e.label ?? '施法') }); break;
        case 'block': {
          const f = at(uid);
          if (f) out.push({ t: 'block', src: uid, tgt: uid, n: e.n as number, block: f.u.block });
          break;
        }
        case 'shield': {
          const f = at(uid);
          if (f) out.push({ t: 'stat', uid, shield: f.u.shield, burn: 0 });
          break;
        }
        case 'buff': {
          const f = at(uid);
          if (f) out.push({ t: 'buff', src: uid, tgt: uid, atk: e.atk as number, hp: e.hp as number, nowAtk: f.u.atk, nowHp: f.u.hp });
          break;
        }
        case 'heal': {
          const f = at(uid);
          if (f) out.push({ t: 'heal', src: uid, tgt: uid, n: e.n as number, hp: f.u.hp });
          break;
        }
        case 'death': this.order = orderOf(snap); out.push({ t: 'die', uid, order: this.order }); break;
        case 'summon': {
          const f = at(uid);
          this.order = orderOf(snap);
          if (f) out.push({ t: 'summon', src: (e.src as number | undefined) ?? null, unit: toOldSnap(f.u, f.side), order: this.order });
          break;
        }
        case 'revive': out.push({ t: 'trigger', uid, label: '复活' }); break;
        case 'move': {
          const next = orderOf(snap);
          const side = e.side as 0 | 1;
          const ids = (e.uids as number[]) ?? [];
          const mover = ids[0] ?? next[side][0];
          const from = this.order[side].indexOf(mover), to = next[side].indexOf(mover);
          this.order = next;
          out.push({ t: 'move', uid: mover, from: Math.max(0, from), to: Math.max(0, to), order: next, reason: MOVE_WHY[e.why as string] ?? String(e.why) });
          break;
        }
        case 'stunned': out.push({ t: 'fizzle', uid, label: '冰冻中' }); break;
        case 'stun': out.push({ t: 'trigger', uid, label: '冰冻' }); break;
        case 'order': out.push({ t: 'trigger', uid, label: '号令' }); break;
        case 'devour': out.push({ t: 'trigger', uid: e.src as number, label: '吞噬' }); break;
        case 'redirect': out.push({ t: 'trigger', uid, label: '援护' }); break;
        case 'insert': out.push({ t: 'trigger', uid, label: '插队' }); break;
        case 'mark': out.push({ t: 'trigger', uid, label: '围猎' }); break;
        case 'vuln': out.push({ t: 'trigger', uid, label: `易伤 +${Math.round((e.pct as number) * 100)}%` }); break;
        case 'stagger': out.push({ t: 'fizzle', uid, label: '破甲 1' }); break;
        case 'end': out.push({ t: 'end', result: e.result as 'win' | 'lose' | 'draw' }); break;
        default: break; // setup / start / enterFront / energy / hero / halt / void / fatigue / delay / anchored …：由英雄面板或快照同步表现
      }
      this.sync(snap, out);
    }
    return out;
  }
}

/** v2 卡牌原始定义（界面显示技能说明、意图用） */
export const v2Card = (def: string): CardDef | undefined => V2_CARDS[def.startsWith(V2_PREFIX) ? def.slice(V2_PREFIX.length) : def];
