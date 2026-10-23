// v0.7 远征路线：3 章 × 9 节点。每章：战斗 ×3 → 商店 → 战斗 → 分岔（精英/普通）→ 战斗 → 商店 → 首领。
// 第一章前三场为基础遭遇；按当时真实招募/培养能力设预算，不能用整局均胜代替开局可解性。
import type { BattleRule, EnemyEntry } from './types';
import { BOSS_ENCOUNTER_RULES } from './encounterRules';
import { encounterRuleText } from './encounterText';

export type BattleKind = 'normal' | 'elite' | 'boss';
export interface RouteNode {
  kind: BattleKind;
  name: string;
  lineup: (EnemyEntry | null)[];
  hint?: string;
  /** 本场专属规则；与单位固有能力分开，运行状态由每场战斗持有。 */
  rules?: readonly BattleRule[];
}
export type Stage =
  | { type: 'battle'; main: RouteNode; variant?: RouteNode }
  | { type: 'shop' }
  | { type: 'fork'; elite: RouteNode; normal: RouteNode }
  | { type: 'boss'; main: RouteNode };
export interface Chapter { name: string; theme: string; stages: Stage[] }

/** 章节数值系数（攻、血）；模拟器校准用 */
export const CHAPTER_SCALE: { atk: number; hp: number }[] = [
  { atk: 1, hp: 1 },
  { atk: 1.15, hp: 1.2 },
  { atk: 1.25, hp: 1.3 },
];

const E = (defId: string, atk?: number, hp?: number, o: Partial<EnemyEntry> = {}): EnemyEntry =>
  ({ defId, ...(atk !== undefined ? { atk } : {}), ...(hp !== undefined ? { hp } : {}), ...o });
const L = (...xs: (EnemyEntry | null)[]) => { const out = xs.slice(0, 5); while (out.length < 5) out.push(null); return out; };
const N = (name: string, hint: string, lineup: (EnemyEntry | null)[]): RouteNode => ({ kind: 'normal', name, hint, lineup });
const EL = (name: string, hint: string, lineup: (EnemyEntry | null)[]): RouteNode => ({ kind: 'elite', name, hint, lineup });
const B = (bossId: string, name: string, hint: string, lineup: (EnemyEntry | null)[]): RouteNode => {
  const rules = BOSS_ENCOUNTER_RULES[bossId] ?? [];
  return { kind: 'boss', name, hint: `${hint}。${encounterRuleText(rules)}`, lineup, rules };
};
const SHOP: Stage = { type: 'shop' };

const RAW: Chapter[] = [
  {
    name: '第一章 · 边境', theme: '基础十词',
    stages: [
      { type: 'battle', main: N('骷髅哨兵', '普攻先打队首；把耐打的单位放在前面',
        L(E('e_skel', 1, 2))) },
      { type: 'battle', main: N('影袭者', '狙击：影袭者的普攻打你的队尾',
        L(E('e_brute', 2, 5), E('e_assassin', 1, 3))) },
      { type: 'battle', main: N('焚火者', '灼烧：每次交锋结束受伤，无视格挡和护甲',
        L(E('e_brute', 2, 7), E('e_pyre', 1, 4), E('e_raider', 2, 4))) },
      SHOP,
      { type: 'battle',
        main: N('碎岩者', '溅射：碎岩者普攻时，目标身后的单位也受一半伤害',
          L(E('e_crusher', 3, 9), E('e_golem', 2, 7, { armor: 1 }), E('e_raider', 2, 6))),
        variant: N('亡魂骑士', '复生：亡魂骑士第一次阵亡会以 1 生命复活',
          L(E('e_revenant', 3, 8), E('e_shield', 2, 6), E('e_assassin', 2, 5))) },
      { type: 'fork',
        elite: EL('暗巷伏击', '盾卫开战时带格挡，影袭者狙击你的队尾，霜咒者冻你的下一个出手者',
          L(E('e_shield', 4, 12), E('e_brute', 5, 11), E('e_assassin', 5, 7), E('e_silencer', 2, 7), E('e_brute', 5, 10))),
        normal: N('荆棘守卫', '反击：普攻荆棘守卫会被扎；施法不会',
          L(E('e_thorn', 3, 14), E('e_brute', 5, 10), E('e_raider', 4, 8), E('e_skel', 4, 6))) },
      { type: 'battle',
        main: N('荆棘与放逐', '放逐者击杀的单位不能复生',
          L(E('e_thorn', 3, 16), E('e_exile', 5, 13), E('e_brute', 6, 11), E('e_assassin', 5, 8))),
        variant: N('孵化巢穴', '幼兽蛋按节拍破壳，幽火灵蛇亡语召唤暗影，收割者在友军阵亡时打你的队首',
          L(E('m_egg', undefined, 7), E('a_seed', undefined, 5), E('a_reaper', 4, 9), E('e_crusher', 5, 11), E('e_pyre', 4, 10))) },
      SHOP,
      { type: 'boss', main: B('e_void', '虚空领主', '每 3 次交锋拉队尾到队首，每单位限一次；锚定符免疫拉拽',
        L(E('e_void', 4, 27), E('e_brute', 5, 13), E('e_assassin', 5, 9), E('e_thorn', 3, 13), E('e_brute', 5, 13))) },
    ],
  },
  {
    name: '第二章 · 霜原', theme: '新词与玩家卡组成的敌阵',
    stages: [
      { type: 'battle', main: N('护卫兵', '嘲讽替前后紧邻的友军拦截普攻；可绕开护卫兵攻击其他位置',
        L(E('e_brute', 7, 16), E('e_guardian', 3, 18), E('e_assassin', 7, 11), E('e_lich', 2, 10))) },
      { type: 'battle', main: N('咒沙者', '削弱：咒沙者施法让你的队首本场攻击 −2，可以叠加',
        L(E('e_twin', 6, 15), E('e_curser', 2, 11), E('e_brute', 7, 16), E('e_curser', 2, 11))) },
      { type: 'battle', main: N('双刃兵', '连击：一次普攻打两下，会剥掉两层格挡',
        L(E('e_shield', 5, 17), E('e_twin', 7, 14), E('e_twin', 7, 14), E('e_pyre', 5, 12))) },
      SHOP,
      { type: 'battle',
        main: N('骨巫与暗祭司', '骨巫打你生命最低的单位，暗祭司给受伤的敌人回血',
          L(E('e_guardian', 4, 20), E('e_lich', 3, 12), E('e_dark_priest', 2, 13), E('e_brute', 8, 17))),
        variant: N('圣光壁垒', '晨光盾卫消耗格挡后增加护甲，骑士复生，牧师治疗伤员',
          L(E('l_warden', 5, 17, { level: 2 }), E('l_knight', 6, 16, { level: 2 }), E('l_priest', 2, 13, { level: 2 }), E('l_lion', 7, 13, { level: 2 }), E('l_shield', 3, 12))) },
      { type: 'fork',
        elite: EL('战帅亲卫', '战帅开战时让全体敌人 +1 攻；护卫兵嘲讽，咒沙者削弱你的队首',
          L(E('e_warlord', 7, 22), E('e_guardian', 4, 22), E('e_twin', 8, 15), E('e_curser', 2, 13), E('e_lich', 3, 13))),
        normal: N('暗祭司', '暗祭司会持续治疗前排；集火或群伤',
          L(E('e_brute', 8, 18), E('e_dark_priest', 2, 13), E('e_shield', 5, 18), E('e_dark_priest', 2, 13))) },
      { type: 'battle',
        main: N('深渊法阵', '收割者响应友军阵亡，献祭术士亡语给相邻法强；唤亡祭师优先复活高攻非召唤物',
          L(E('a_graveguard', 4, 22, { level: 2 }), E('a_reaper', 4, 15, { level: 2 }), E('a_cult', 2, 13, { level: 2 }), E('a_ritualist', 2, 12, { level: 2 }), E('a_devour', 2, 12, { level: 2 }))),
        variant: N('寒流战阵', '冰墙嘲讽带护甲，冰晶甲虫受击时冻攻击者，冰霜法师冻你的下一个出手者',
          L(E('v_wall', 4, 22, { level: 2 }), E('v_guard', 3, 18, { level: 2 }), E('v_mage', 2, 13, { level: 2 }), E('v_shard', 7, 14, { level: 2 }), E('e_brute', 8, 18))) },
      SHOP,
      { type: 'boss', main: B('e_frostq', '霜魇女皇', '每 5 次交锋给最高攻单位等同其攻击的寒意，本场最多 2 次',
        L(E('e_frostq', 8, 42), E('e_guardian', 5, 24), E('v_mage', 3, 15, { level: 2 }), E('e_twin', 8, 18), E('e_curser', 3, 15))) },
    ],
  },
  {
    name: '第三章 · 永夜', theme: '综合',
    stages: [
      { type: 'battle', main: N('墓园', '墓碑亡语召唤骷髅兵，亡魂骑士会复生',
        L(E('e_tomb', 1, 18), E('e_revenant', 9, 20), E('e_tomb', 1, 18), E('e_revenant', 9, 20), E('e_lich', 4, 16))) },
      { type: 'battle', main: N('沙域军阵', '护卫保护身后一位，沙嚎者亡语接力两只沙狼，沙灵塑师召唤沙像，镜沙猎蜥随召唤变强',
        L(E('d_sentry', 7, 24, { level: 2 }), E('d_keeper', 7, 22, { level: 2 }), E('d_howler', 3, 16, { level: 2 }), E('d_glass', 8, 18, { level: 2 }), E('d_dunecaster', 3, 17, { level: 2 }))) },
      { type: 'battle', main: N('熔岩之潮', '熔岩巨蜥溅射，熔甲兽与萨满叠灼烧',
        L(E('m_hide', 6, 26, { level: 2 }), E('m_rex', 9, 20, { level: 2 }), E('m_mender', 8, 19, { level: 2 }), E('m_shaman', 3, 16, { level: 2 }), E('m_bloodcaller', 7, 20, { level: 2 }))) },
      SHOP,
      { type: 'battle',
        main: N('影刃刺客', '连击剥格挡，狙击打你的后排',
          L(E('e_guardian', 6, 30), E('s_ninja', 9, 18, { level: 2 }), E('s_backstab', 9, 17, { level: 2 }), E('s_hunter', 9, 18, { level: 2 }), E('s_dancer', 3, 16, { level: 2 }))),
        variant: N('混合军团', '战帅提攻，护卫兵嘲讽，暗祭司治疗',
          L(E('e_warlord', 9, 30), E('e_guardian', 6, 30), E('e_twin', 9, 20), E('e_dark_priest', 3, 18), E('e_exile', 9, 20))) },
      { type: 'fork',
        elite: EL('永夜先锋', '多词混合：护甲、连击、削弱、放逐',
          L(E('e_golem', 6, 34), E('e_warlord', 10, 32), E('e_twin', 10, 22), E('e_curser', 4, 18), E('e_exile', 10, 22))),
        normal: N('骨墙', '石魔与护卫兵挡在前面，骨巫在后面点名',
          L(E('e_golem', 5, 30), E('e_guardian', 6, 30), E('e_lich', 4, 18), E('e_lich', 4, 18), E('e_brute', 10, 22))) },
      { type: 'battle',
        main: N('终末战阵', '冰霜法师制造寒意，冻结触发供盾与追伤；沙狼阵亡会强化深渊巨兽',
          L(E('v_keeper', 8, 30, { level: 3 }), E('a_jugg', 7, 30, { level: 2 }), E('d_howler', 4, 18, { level: 2 }), E('v_drake', 4, 20, { level: 2 }), E('v_mage', 4, 16, { level: 2 }))),
        variant: N('冰与火', '寒意控你的出手，灼烧持续掉血',
          L(E('v_wall', 6, 32, { level: 3 }), E('v_guard', 5, 26, { level: 2 }), E('n_alchemist', 4, 18, { level: 2 }), E('m_mender', 10, 22, { level: 2 }), E('v_mage', 4, 18, { level: 2 }))) },
      SHOP,
      { type: 'boss', main: B('e_nightk', '永夜君王', '首次低于半血，随从以半血召回，君王获得3层格挡',
        L(E('e_guardian', 7, 34), E('e_revenant', 11, 24), E('e_twin', 11, 24), E('e_nightk', 11, 110), E('e_lich', 5, 20))) },
    ],
  },
];

const scaleNode = (n: RouteNode, ch: number): RouteNode => {
  const k = CHAPTER_SCALE[ch];
  return { ...n, lineup: n.lineup.map((e) => e && {
    ...e,
    ...(e.atk !== undefined ? { atk: Math.max(1, Math.round(e.atk * k.atk)) } : {}),
    ...(e.hp !== undefined ? { hp: Math.max(1, Math.round(e.hp * k.hp)) } : {}),
  }) };
};
/** 取章节（已乘系数）；每次取都重新计算，模拟器改系数后立即生效 */
export const chapter = (ch: number): Chapter => {
  const c = RAW[ch];
  return { ...c, stages: c.stages.map((s): Stage => {
    switch (s.type) {
      case 'shop': return s;
      case 'boss': return { type: 'boss', main: scaleNode(s.main, ch) };
      case 'fork': return { type: 'fork', elite: scaleNode(s.elite, ch), normal: scaleNode(s.normal, ch) };
      case 'battle': return { type: 'battle', main: scaleNode(s.main, ch), ...(s.variant ? { variant: scaleNode(s.variant, ch) } : {}) };
    }
  }) };
};
export const CHAPTER_COUNT = RAW.length;
export const STAGES_PER_CHAPTER = 9;
/** 有变体的战斗节点 key：`${chapter}:${node}` */
export const VARIANT_KEYS = RAW.flatMap((c, ci) => c.stages.flatMap((s, ni) => (s.type === 'battle' && s.variant ? [`${ci}:${ni}`] : [])));
/** 本节点之前已打过的战斗场数（品质开放按此计） */
export const battleIndex = (ch: number, node: number) => {
  let n = 0;
  for (let c = 0; c <= ch; c++) RAW[c].stages.forEach((s, i) => { if ((c < ch || i < node) && s.type !== 'shop') n++; });
  return n;
};
/** 总战斗场数 */
export const TOTAL_BATTLES = RAW.reduce((a, c) => a + c.stages.filter((s) => s.type !== 'shop').length, 0);
