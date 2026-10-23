// 词条实机演示配置：键与图鉴「词条」页条目名一致；用真实单位和引擎模拟，没有配置的条目只显示大图标。
import type { DemoSpec, DemoUnit } from './demo';
import type { BattleEvent, Snap, TriggerKind } from './types';

type Hit = DemoSpec['hit'];
const sideOf = (s: Snap, uid?: number) => s.find(u => u.uid === uid)?.side;
const mine = (s: Snap, uid?: number) => sideOf(s, uid) === 0;
const foes = (s: Snap, uid?: number) => sideOf(s, uid) === 1;
const trig = (...k: TriggerKind[]): Hit => ev => ev.t === 'trigger' && ev.side === 0 && k.includes(ev.kind);
const attackBy = (defId: string): Hit => (ev, s) => ev.t === 'attack' && ev.pairs.some(p => s.find(u => u.uid === p.atk && u.side === 0)?.defId === defId);
const beat = (f: (ev: Extract<BattleEvent, { t: 'beat' }>) => boolean): Hit => ev => ev.t === 'beat' && f(ev);

/** 木桩：骷髅兵改数值 */
const dummy = (n: number, atk = 1, hp = 12): DemoUnit[] => Array.from({ length: n }, () => ({ id: 'e_skel', atk, hp }));
const glass = (n: number) => dummy(n, 4, 6);
/** 我方木桩：掠夺者，和敌方骷髅区分 */
const ally = (n: number, atk = 2, hp = 9): DemoUnit[] => Array.from({ length: n }, () => ({ id: 'e_raider', atk, hp }));
const sk: DemoUnit = { id: 'e_skel' };
const u = (id: string, lv: 1 | 2 | 3 = 1): DemoUnit => ({ id, lv });

export const KW_DEMOS: Record<string, DemoSpec> = {
  // ── 基础规则 ──
  交锋: { me: ally(3), foe: dummy(3, 1, 9), hit: beat(b => b.n === 2), tail: 2 },
  回合: { me: ally(2), foe: dummy(2, 1, 9), hit: beat(b => (b.round ?? 1) >= 2), tail: 1 },
  行动轮: { me: [u('n_marshal'), sk], foe: dummy(2, 1, 9), hit: beat(b => (b.wave ?? 1) >= 2), tail: 1 },
  等待: { me: ally(2, 1, 12), foe: dummy(1, 1, 12), hit: beat(b => b.n === 2), tail: 2 },
  常规行动: { me: [u('m_shaman'), sk], foe: dummy(2), hit: ev => ev.t === 'act' && ev.side === 0, tail: 2 },
  额外行动: { me: [u('n_marshal'), sk], foe: dummy(2, 1, 9), hit: ev => ev.t === 'actionGain', tail: 3 },
  交锋结束与主将: { me: ally(2), foe: dummy(2, 1, 12), general: { id: 'vulkan' }, hit: ev => ev.t === 'gen' },
  // ── 触发时机 ──
  开战时: { me: [u('l_warden')], foe: dummy(2), hit: trig('start') },
  施法: { me: [u('a_devour')], foe: dummy(2), hit: ev => ev.t === 'act' && ev.side === 0 && ev.mode === 'cast' },
  普攻后: { me: [u('s_wind')], foe: dummy(2), hit: trig('afterAttack') },
  受击时: { me: [u('m_hide')], foe: dummy(2), hit: trig('hurt', 'attacked') },
  击杀时: { me: [sk, u('s_ninja')], foe: glass(3), hit: trig('kill') },
  亡语: { me: [u('l_martyr'), sk], foe: glass(2), hit: trig('rattle') },
  阵亡时: { me: [sk, u('a_reaper')], foe: dummy(2), hit: trig('allyFaint') },
  成为队首时: { me: [sk, u('l_shield')], foe: dummy(2), hit: trig('front') },
  在队尾时: { me: [sk, sk, u('l_vigil')], foe: dummy(3), hit: trig('rear') },
  击败对手: { me: [u('s_xyle', 2), sk], foe: glass(2), hit: trig('duelKill') },
  蓄力技: { me: [sk, u('v_snowman', 2)], foe: dummy(2), hit: trig('charge') },
  节拍: { me: [u('d_goldob')], foe: dummy(2), hit: trig('pulse') },
  每次交锋结束时: { me: [u('m_heart')], foe: dummy(2), hit: trig('beatEnd') },
  条件触发: { me: [u('v_chaser'), u('v_scout')], foe: dummy(2), hit: trig('freeze') },
  // ── 特性 ──
  嘲讽: { me: [sk, u('l_warden')], foe: dummy(2), hit: (ev, s) => ev.t === 'taunt' && mine(s, ev.to) },
  轮换: { me: [u('l_shield'), sk], foe: dummy(2), hit: ev => ev.t === 'move' && ev.side === 0 },
  决斗: { me: [u('s_backstab')], foe: dummy(2), hit: attackBy('s_backstab') },
  蓄力: { me: [u('v_snowman')], foe: dummy(2), hit: (ev, s) => ev.t === 'charge' && mine(s, ev.uid) },
  不行动: { me: [...ally(1), u('m_egg')], foe: dummy(2), hit: beat(b => b.n === 2), tail: 0 },
  护甲: { me: [u('v_wall')], foe: dummy(2), hit: (ev, s) => ev.t === 'dmg' && mine(s, ev.tgt) },
  反击: { me: [u('n_thorn')], foe: dummy(2), hit: ev => ev.t === 'dmg' && ev.kind === 'thorns' },
  连击: { me: [u('s_wind')], foe: dummy(2), hit: attackBy('s_wind') },
  狙击: { me: [u('n_archer')], foe: dummy(2), hit: attackBy('n_archer') },
  溅射: { me: [u('m_whelp')], foe: dummy(2), hit: ev => ev.t === 'dmg' && ev.kind === 'splash' },
  法强: { me: [u('v_chaser')], foe: dummy(2), hit: ev => ev.t === 'act' && ev.side === 0 && ev.mode === 'cast' },
  复生: { me: [u('l_martyr'), sk], foe: glass(2), hit: (ev, s) => ev.t === 'revive' && mine(s, ev.uid) },
  放逐: { me: [u('l_martyr')], foe: [{ id: 'e_exile' }], hit: ev => ev.t === 'death' && !!ev.exiled },
  // ── 状态 ──
  格挡: { me: [u('l_warden')], foe: dummy(2), hit: (ev, s) => ev.t === 'block' && mine(s, ev.uid), tail: 2 },
  寒意: { me: [u('v_guard')], foe: dummy(2), hit: (ev, s) => ev.t === 'chill' && foes(s, ev.uid) },
  冻结: { me: [u('v_chaser')], foe: dummy(2), hit: (ev, s) => ev.t === 'frozenSkip' && foes(s, ev.uid) },
  灼烧: { me: [u('m_shaman')], foe: dummy(2), hit: (ev, s) => ev.t === 'dmg' && ev.kind === 'burn' && foes(s, ev.tgt) },
  行动次数: { me: [u('n_marshal')], foe: dummy(2), hit: (ev, s) => ev.t === 'actionGain' && mine(s, ev.uid), tail: 2 },
  // ── 动作 ──
  献祭: { me: [u('a_void'), sk], foe: dummy(2), hit: (ev, s) => ev.t === 'sacrifice' && mine(s, ev.src) },
  追击: { me: [u('s_dancer'), sk], foe: dummy(2), hit: ev => ev.t === 'act' && ev.side === 0 && ev.mode === 'extra' },
  召唤: { me: [u('d_artificer')], foe: dummy(2), hit: (ev, s) => ev.t === 'summon' && mine(s, ev.uid) },
};
