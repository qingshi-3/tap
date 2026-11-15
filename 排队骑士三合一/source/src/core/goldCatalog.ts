// 金色技能（CARD-REVIEW.md）：每张商店卡一行"金色："。
// patch：按原生规则序号覆盖字段（金色时生效）；extra：金色专属规则，排在原生规则之后。
// 基础数值不再随金色变化，金色的数值类升级（终结卡、资源产出卡）也写在 patch 里。
import type { BattleRule, PrepRule, ReworkRule } from './archetypes';

type Patch = Partial<Omit<BattleRule, 'phase' | 'gold' | 'goldOnly'>> | Partial<Omit<PrepRule, 'phase' | 'gold' | 'goldOnly'>>;
export interface GoldSpec { text: string; patch?: Record<number, Patch>; extra?: ReworkRule[] }

const b = (on: BattleRule['on'], effect: BattleRule['effect'], target: BattleRule['target'], n: number, o: Partial<BattleRule> = {}): BattleRule => ({ phase: 'battle', on, effect, target, n, ...o });
const p = (on: PrepRule['on'], effect: PrepRule['effect'], target: PrepRule['target'], n: number, limit: number, o: Partial<PrepRule> = {}): PrepRule => ({ phase: 'prep', on, effect, target, n, limit, ...o });
const PAIR = '任意相邻友军都算作同名搭档。';

export const GOLD: Record<string, GoldSpec> = {
  // 车轮
  rw_wheel_courier: { text: '成为队首时的伤害同时打敌方第二名。', patch: { 1: { count: 2 } } },
  rw_wheel_runner: { text: '格挡给身后两名友军。', patch: { 0: { count: 2 } } },
  rw_wheel_relay: { text: '加成给身后两名友军。', patch: { 0: { count: 2 } } },
  rw_wheel_lancer: { text: '伤害打敌尾和倒数第二名。', patch: { 0: { count: 2 } } },
  rw_wheel_bell: { text: '改为每次交锋后都让队首退到队尾（每场5次）。', patch: { 0: { every: 1, limit: 5 } } },
  rw_wheel_reserve: { text: '每场3次。', patch: { 0: { limit: 3 } } },
  rw_wheel_marshal: { text: '伤害改为4，转圈加成同样翻倍。', patch: { 0: { n: 4 } } },
  rw_wheel_sigil: { text: '本回合前3次施法都生效。', patch: { 0: { limit: 3, at: [1, 2, 3] } } },
  // 蓄势
  rw_charge_sling: { text: '释放的伤害同时打敌方第二名。', patch: { 1: { count: 2 } } },
  rw_charge_bunker: { text: '受伤存活时，身后两名友军各蓄能1。', patch: { 1: { count: 2 } } },
  rw_charge_gunner: { text: '释放后保留一半蓄能（向下取整）。', patch: { 1: { retain: 0.5 } } },
  rw_charge_battery: { text: '蓄能给身后两名友军。', patch: { 0: { count: 2 } } },
  rw_charge_mortar: { text: '释放后退到队尾，可以重新蓄能。', extra: [b('released', 'rotate', 'self', 1)] },
  rw_charge_brake: { text: '阵亡时身后两名友军各蓄能1。', patch: { 1: { count: 2 } } },
  rw_charge_siege: { text: '每点蓄能的伤害改为4。', patch: { 1: { n: 4 } } },
  rw_charge_surveyor: { text: '改为每次交锋后都给猎物猎标。', patch: { 0: { every: 1 } } },
  // 薪火
  rw_ember_tinder: { text: '阵亡伤害同时打敌方第二名。', patch: { 0: { count: 2 } } },
  rw_ember_torch: { text: '格挡给身后两名友军。', patch: { 0: { count: 2 } } },
  rw_ember_blade: { text: '阵亡伤害打敌尾和倒数第二名。', patch: { 0: { count: 2 } } },
  rw_ember_legate: { text: '每场5次。', patch: { 0: { limit: 5 } } },
  rw_ember_cinder: { text: '对全体敌人的阵亡伤害触发两次。', extra: [b('faint', 'damage', 'enemies', 2)] },
  rw_ember_lantern: { text: '开战格挡给身后两名友军。', patch: { 0: { count: 2 } } },
  rw_ember_crown: { text: '两项伤害比例各+20%。', patch: { 0: { n: 55 }, 1: { n: 85 } } },
  rw_ember_brood: { text: '阵亡时召唤2只幼兽（需空位）。', patch: { 1: { count: 2 } } },
  // 兽巢
  rw_nest_hatch: { text: '开战召唤2只幼兽（需空位）。', patch: { 0: { count: 2 } } },
  rw_nest_den: { text: '阵亡时召唤2只幼兽（需空位）。', patch: { 0: { count: 2 } } },
  rw_nest_matron: { text: '改为每次交锋后召唤（每场4次）。', patch: { 0: { every: 1, limit: 4 } } },
  rw_nest_pack: { text: '自己也获得同样的格挡。', extra: [b('summon', 'block', 'self', 1, { limit: 3, when: 'token' })] },
  rw_nest_fuser: { text: '开战召唤2只（队满时都并入小兵）。', patch: { 1: { count: 2 } } },
  rw_nest_pelt: { text: '每场6次。', patch: { 1: { limit: 6 } } },
  rw_nest_progenitor: { text: '幼兽基础身材改为4/4。', patch: { 0: { n: 4, hp: 4 } } },
  rw_nest_outrider: { text: '每场4次。', patch: { 0: { limit: 4 } } },
  // 血契
  rw_blood_cutpurse: { text: '献血换金每回合2次。', patch: { 0: { limit: 2 } } },
  rw_blood_razor: { text: '伤害同时打敌方第二名。', patch: { 0: { count: 2 } } },
  rw_blood_vow: { text: '献血换攻每回合2次。', patch: { 0: { limit: 2 } } },
  rw_blood_lance: { text: '每场4次。', patch: { 0: { limit: 4 } } },
  rw_blood_pact: { text: '半血及以下就触发全体伤害。', patch: { 1: { when: 'half' } } },
  rw_blood_shelter: { text: '开战格挡给身前两名友军。', patch: { 0: { count: 2 } } },
  rw_blood_immortal: { text: '保命每场2次。', patch: { 0: { n: 2 } } },
  rw_blood_brazier: { text: '阵亡伤害同时打敌尾。', extra: [b('faint', 'damage', 'enemyLast', 2)] },
  // 行商
  rw_trade_broker: { text: '出售时额外获得2金。', patch: { 0: { n: 2 } } },
  rw_trade_porter: { text: '每回合首次购买单位后，队首下场战斗获得1层格挡。', extra: [p('buy', 'block', 'front', 1, 1)] },
  rw_trade_teller: { text: '每回合4次。', patch: { 0: { limit: 4 } } },
  rw_trade_hawker: { text: '本回合购买第1、2个单位后各追加1份口粮。', patch: { 0: { every: 1, at: [1, 2], limit: 2 } } },
  rw_trade_factor: { text: '追伤给身前两名队友。', patch: { 0: { count: 2 } } },
  rw_trade_bailiff: { text: '本回合前两次出售其他单位后各给1层。', patch: { 0: { limit: 2 } } },
  rw_trade_tycoon: { text: '每剩1金的伤害改为2。', patch: { 0: { n: 2 } } },
  rw_trade_twins: { text: PAIR },
  // 咒印
  rw_rune_scribe: { text: '本回合前3次施法都生效。', patch: { 0: { limit: 3, at: [1, 2, 3] } } },
  rw_rune_satchel: { text: '每回合开始时获得1张本回合法术。', extra: [p('turnStart', 'spell', 'self', 1, 1)] },
  rw_rune_cantor: { text: '改为第2、3、4次施法都触发。', patch: { 0: { every: 1, at: [2, 3, 4], limit: 3 } } },
  rw_rune_binder: { text: '格挡和追伤给身后两名队友。', patch: { 0: { count: 2 }, 1: { count: 2 } } },
  rw_rune_quill: { text: '回合结束时自己也获得同样的追伤。', extra: [p('turnEnd', 'seal', 'self', 2, 1, { scale: 'spells' })] },
  rw_rune_ward: { text: '本回合前两次施法后各给1层。', patch: { 0: { limit: 2, at: [1, 2] } } },
  rw_rune_chorus: { text: '每次施法的伤害改为4。', patch: { 0: { n: 4 } } },
  rw_rune_ink: { text: '献血换法术每回合2次。', patch: { 0: { limit: 2 } } },
  // 并肩：金色时任意相邻友军都算作同名搭档（engine.pair / run.goldPairOwned）
  rw_pair_cadet: { text: PAIR },
  rw_pair_shield: { text: PAIR },
  rw_pair_flanker: { text: PAIR },
  rw_pair_drummer: { text: PAIR },
  rw_pair_officer: { text: '自己和任意相邻友军都算一对。' },
  rw_pair_picket: { text: PAIR },
  rw_pair_standard: { text: '每场共应援5次。', patch: { 0: { limit: 5 } } },
  rw_pair_oath: { text: PAIR },
  // 猎标
  rw_hunt_spotter: { text: '开战时敌首也获得1层猎标。', extra: [b('start', 'mark', 'enemyFront', 1)] },
  rw_hunt_barb: { text: '每场4次。', patch: { 0: { limit: 4 } } },
  rw_hunt_tracker: { text: '改为每次交锋后（每场4次）。', patch: { 0: { every: 1, limit: 4 } } },
  rw_hunt_setter: { text: '阵亡时敌首也获得2层猎标。', extra: [b('faint', 'mark', 'enemyFront', 2)] },
  rw_hunt_powder: { text: '清除后，一半层数（向下取整）转给下一个敌人。', patch: { 0: { transfer: 0.5 } } },
  rw_hunt_hide: { text: '每次受伤存活都给猎标（每场3次）。', patch: { 1: { limit: 3 } } },
  rw_hunt_executioner: { text: '每层伤害改为8。', patch: { 1: { n: 8 } } },
  rw_hunt_watch: { text: '成为队首时，敌首也获得1层猎标。', extra: [b('enter', 'mark', 'enemyFront', 1)] },
  // 军阵
  rw_formation_guard: { text: '开战时自己获得1层格挡。', extra: [b('start', 'block', 'self', 1)] },
  rw_formation_banner: { text: '加成给左右各两名友军。', patch: { 0: { count: 2 } } },
  rw_formation_ranks: { text: '加成同时给身后友军。', extra: [b('enter', 'buff', 'behind', 1, { hp: 1, limit: 1, scale: 'edges' })] },
  rw_formation_stakes: { text: '每场4次。', patch: { 0: { limit: 4 } } },
  rw_formation_phalanx: { text: '分担的伤害自己只受一半（向上取整）。', patch: { 0: { halve: true } } },
  rw_formation_reserve: { text: '每场3次。', patch: { 0: { limit: 3 } } },
  rw_formation_citadel: { text: '每对紧邻队友的生命加成改为4。', patch: { 1: { hp: 4 } } },
  rw_formation_battery: { text: '蓄能给身后两名友军。', patch: { 1: { count: 2 } } },
  // 补给
  rw_supply_pup: { text: '每回合3次。', patch: { 0: { limit: 3 } } },
  rw_supply_canteen: { text: '每回合开始时，货架追加1份免费口粮。', extra: [p('turnStart', 'ration', 'self', 1, 1)] },
  rw_supply_cook: { text: '格挡给身前身后各两名友军。', patch: { 0: { count: 2 } } },
  rw_supply_steward: { text: '每回合追加2份口粮。', patch: { 0: { n: 2 } } },
  rw_supply_miller: { text: '每回合5次。', patch: { 0: { limit: 5 } } },
  rw_supply_inspector: { text: '格挡给队首和第二名。', patch: { 0: { count: 2 } } },
  rw_supply_feast: { text: '每次喂食的追伤改为2。', patch: { 0: { n: 2 } } },
  rw_supply_wagon: { text: '本回合前两次出售其他单位后各追加1份口粮。', patch: { 1: { limit: 2 } } },
  // 通用
  rw_common_buckler: { text: '每次成为队首时也获得1层格挡。', extra: [b('enter', 'block', 'self', 1)] },
  rw_common_runner: { text: '加成给身后两名友军。', patch: { 0: { count: 2 } } },
  rw_common_cook: { text: '每回合首次购买单位后，货架追加1份免费口粮。', extra: [p('buy', 'ration', 'self', 1, 1)] },
  rw_common_sapper: { text: '前两次成为队首时都射击。', patch: { 0: { limit: 2 } } },
  rw_common_hearth: { text: '阵亡时的生命加成给身后两名友军。', patch: { 1: { count: 2 } } },
  rw_common_veteran: { text: '阵亡时的伤害改为打敌方前两名。', patch: { 1: { count: 2 } } },
};

/** 把基础数值固定为普通值，再挂上金色覆盖、金色专属规则和"金色："文案。 */
export function applyGold<C extends { id: string; rules?: ReworkRule[]; goldText?: string }>(c: C): C {
  const spec = GOLD[c.id];
  if (!spec) throw Error('缺少金色设计 ' + c.id);
  const base = (c.rules ?? []).map((rule, i) => spec.patch?.[i] ? { ...rule, gold: spec.patch[i] } as ReworkRule : rule);
  for (const i of Object.keys(spec.patch ?? {})) if (!(c.rules ?? [])[Number(i)]) throw Error(`金色覆盖的规则不存在 ${c.id}:${i}`);
  return { ...c, rules: [...base, ...(spec.extra ?? []).map(rule => ({ ...rule, goldOnly: true }) as ReworkRule)], goldText: spec.text };
}
