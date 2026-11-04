// 图鉴实机演示配置：规则 / 词条 / 时机 / 装备词条 / 遗物 / 装备 / 单位。键与图鉴条目一致；没有配置的条目只显示大图标。
import { ATOM_INFO, EQUIP, type Atom } from './data';
import { demoOutput, type DemoHit, type DemoSpec, type DemoUnit } from './demo';

/** 我方触发了某个标签 */
const lab = (...l: string[]): DemoHit => (e, side) => e.t === 'trigger' && l.includes(e.label) && side(e.uid) === 0;
/** 敌方木桩：没有技能的骷髅；我方木桩：小兽 */
const dummy = (n: number, atk = 2, hp = 10): DemoUnit[] => Array.from({ length: n }, () => ({ id: 't_bonelet', atk, hp }));
const ally = (n: number, atk = 3, hp = 8): DemoUnit[] => Array.from({ length: n }, () => ({ id: 't_wolf', atk, hp }));
const hero = (o: Partial<DemoUnit> = {}): DemoUnit => ({ id: 't_wolf', atk: 4, hp: 10, ...o });

const ATOM_DEMO: Record<Atom, (eq: string) => DemoSpec> = {
  exec: (eq) => ({ me: [hero({ eq })], foe: dummy(2, 2, 12), hit: (e, s) => e.t === 'dmg' && e.kind === 'melee' && s(e.src) === 0 && e.n > 4, tail: 0 }),
  reap: (eq) => ({ me: [hero({ eq })], foe: dummy(3, 3, 4), hit: lab('收割') }),
  undying: (eq) => ({ me: [hero({ eq, atk: 3, hp: 5 }), ...ally(1)], foe: dummy(2, 7, 20), hit: lab('不屈'), tail: 2 }),
  pierce: (eq) => ({ me: [hero({ eq, atk: 9 })], foe: dummy(3, 1, 4), hit: lab('穿透') }),
  shield: (eq) => ({ me: [hero({ eq, hp: 15 })], foe: dummy(2, 3, 12), hit: lab('护盾') }),
  burn: (eq) => ({ me: [hero({ eq })], foe: dummy(2, 2, 14), hit: (e, s) => e.t === 'dmg' && e.kind === 'burn' && s(e.tgt) === 1, tail: 1 }),
  fury: (eq) => ({ me: [hero({ eq })], foe: dummy(2, 2, 14), hit: (e, s) => e.t === 'buff' && e.src === e.tgt && s(e.tgt) === 0, tail: 2 }),
  charge: (eq) => ({ me: [hero({ eq })], foe: dummy(2, 2, 12), hit: lab('冲锋') }),
};
const ATOM_EQ: Record<Atom, string> = { exec: 'b_axe', reap: 'b_scythe', undying: 'b_banner', pierce: 'b_lance', shield: 'b_buckler', burn: 'b_torch', fury: 'b_horn', charge: 'b_spur' };

const splash: DemoHit = (e, s) => e.t === 'dmg' && e.kind === 'splash' && s(e.tgt) === 1;
const revive: DemoHit = (e, s) => e.t === 'summon' && !!e.revive && s(e.unit.uid) === 0;
const blocked: DemoHit = (e, s) => e.t === 'dmg' && e.blocked && s(e.tgt) === 0;

export const KW_DEMOS: Record<string, DemoSpec> = {
  // ── 规则 ──
  交锋: { me: ally(2), foe: dummy(2, 2, 10), hit: (e) => e.t === 'clash' && e.n === 2, tail: 1, focus: 'clash' },
  // ── 词条 ──
  格挡: { me: [hero({ eq: 'amulet' })], foe: dummy(2), hit: blocked, tail: 1 },
  复生: { me: [hero({ eq: 'shroom', atk: 3, hp: 3 }), ...ally(1)], foe: dummy(2, 4, 12), hit: revive },
  溅射: { me: [{ id: 't_flame', atk: 4, hp: 10 }], foe: dummy(2), hit: splash },
  // ── 时机 ──
  开战时: { me: [{ id: 's_dart', lv: 2 }, ...ally(1)], foe: dummy(3), hit: lab('开战') },
  交锋前: { me: [{ id: 'l_windblade' }, ...ally(2)], foe: dummy(2), hit: lab('交锋前') },
  攻击后: { me: [...ally(1), { id: 's_ninja' }], foe: dummy(2), hit: lab('身前友军攻击') },
  受伤时: { me: [{ id: 'l_shield' }], foe: dummy(2), hit: lab('受伤') },
  阵亡时: { me: [{ id: 'a_imp' }, ...ally(1)], foe: dummy(2, 4, 12), hit: lab('阵亡') },
  击杀时: { me: [{ id: 'l_knight' }], foe: dummy(3, 1, 4), hit: lab('击杀') },
  友军被召唤时: { me: [{ id: 'a_imp' }, { id: 'm_whelp' }], foe: dummy(2, 4, 12), hit: lab('友军被召唤') },
  // ── 遗物 ──
  r_vanguard: { me: ally(2), foe: dummy(2), relics: ['r_vanguard'], hit: lab('先锋徽章') },
  r_legacy: { me: [hero({ atk: 6, hp: 3 }), ...ally(1)], foe: dummy(2, 4, 14), relics: ['r_legacy'], hit: lab('传承') },
  r_volley: { me: ally(3), foe: dummy(3), relics: ['r_volley'], hit: lab('齐射号角') },
  r_drums: { me: [{ id: 'l_windblade' }, ...ally(2)], foe: dummy(2, 2, 14), relics: ['r_drums'], hit: lab('战鼓') },
  r_lone: { me: [hero({ atk: 2, hp: 3 }), ...ally(1, 3, 6)], foe: dummy(2, 4, 14), relics: ['r_lone'], hit: lab('独狼') },
  r_few: { me: ally(2), foe: dummy(2), relics: ['r_few'], hit: lab('少即是多') },
  r_rear: { me: ally(3), foe: dummy(3), relics: ['r_rear'], hit: lab('后卫弩') },
  r_heavy: { me: ally(3), foe: dummy(3), relics: ['r_heavy'], hit: lab('重装铠') },
  r_relay: { me: [hero({ atk: 3, hp: 2 }), ...ally(1)], foe: dummy(2, 4, 16), relics: ['r_relay'], hit: lab('车轮战') },
};
for (const a of Object.keys(ATOM_DEMO) as Atom[]) KW_DEMOS[ATOM_INFO[a].name] = ATOM_DEMO[a](ATOM_EQ[a]);

/** 装备：带词条的用词条演示（换成这件装备），专属规则单独配；纯数值装备没有演示 */
const EQ_SP: Record<string, DemoSpec> = {
  iron: { me: [hero({ eq: 'iron' })], foe: dummy(2), hit: blocked },
  amulet: KW_DEMOS.格挡,
  wine: { me: [hero({ eq: 'wine' })], foe: dummy(2, 2, 14), hit: (e, s) => e.t === 'dmg' && e.kind === 'melee' && s(e.src) === 0, tail: 1 },
  chili: { me: [hero({ eq: 'chili' })], foe: dummy(2), hit: splash },
  shroom: KW_DEMOS.复生,
  p_phoenix: { me: [hero({ eq: 'p_phoenix', atk: 3, hp: 4 }), ...ally(1)], foe: dummy(2, 5, 12), hit: revive },
  p_inferno: { me: [hero({ eq: 'p_inferno' })], foe: dummy(2), hit: splash, tail: 1 },
  p_bulwark: { me: [hero({ eq: 'p_bulwark', atk: 3, hp: 5 })], foe: dummy(2, 7, 20), hit: lab('不屈'), tail: 2 },
  p_thorn: { me: [hero({ eq: 'p_thorn' })], foe: dummy(2), hit: lab('荆棘') },
  c_blood: { me: [hero({ eq: 'c_blood' })], foe: dummy(2), hit: lab('饮血剑') },
  c_rage: { me: [hero({ eq: 'c_rage' })], foe: dummy(2, 2, 14), hit: (e, s) => e.t === 'dmg' && e.kind === 'melee' && s(e.src) === 0 },
  o_crown: { me: [{ id: 'a_imp', eq: 'o_crown' }, ...ally(1)], foe: dummy(2, 4, 12), hit: lab('冥魂王冠') },
  o_spear: { me: [hero({ eq: 'o_spear' })], foe: dummy(3), hit: lab('贯日之枪') },
  o_grail: { me: [hero({ eq: 'o_grail', atk: 3, hp: 5 })], foe: dummy(2, 7, 30), hit: lab('不屈'), tail: 3 },
  o_storm: { me: [hero({ eq: 'o_storm' })], foe: dummy(3), hit: lab('风暴之心') },
};
export function equipDemo(id: string): DemoSpec | null {
  if (EQ_SP[id]) return EQ_SP[id];
  const a = EQUIP[id]?.atoms?.[0];
  return a ? ATOM_DEMO[a](id) : null;
}

/** 单位：换几个站位试，取最早触发自己技能的一种；纯备战技能的单位没有演示 */
const unitCache = new Map<string, DemoSpec | null>();
export function unitDemo(id: string, lv: 1 | 2 | 3 = 1): DemoSpec | null {
  const key = `${id}:${lv}`;
  if (unitCache.has(key)) return unitCache.get(key)!;
  const me: DemoUnit = { id, lv };
  const hit: DemoHit = (e, s, d) => e.t === 'trigger' && s(e.uid) === 0 && d(e.uid) === id;
  let best: DemoSpec | null = null, bestAt = Infinity;
  // 吃召唤 / 复制技能的单位放在小鬼、飞镖手身后
  for (const line of [[me, ...ally(2)], [...ally(1), me, ...ally(1)], [...ally(2), me], [{ id: 'a_imp' }, me, ...ally(1)], [{ id: 's_dart' }, me, ...ally(1)]]) {
    const spec: DemoSpec = { me: line, foe: dummy(3, 3, 9), hit, tail: 1 };
    const { at } = demoOutput(spec);
    if (at >= 0 && at < bestAt) { best = spec; bestAt = at; }
  }
  unitCache.set(key, best);
  return best;
}
