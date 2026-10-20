// v0.7 远征的局内内容表：培养点、装备、一次性法术、招募令、主将与被动。
// 引擎按 id 解释效果；新增类型优先在这里加一行。
import type { Effect, GeneralDef, UnitGrants, UnitState } from './types';

// ───────────── 培养点 ─────────────

export interface PointWeightCtx {
  /** 施法单位数（场上 + 备战，按星级 1 / 1.5 / 2 加权） */
  casterWeight: number;
  /** 上一关发放的法强点数 */
  lastPower: number;
}
export interface PointType {
  id: 'atk' | 'hp' | 'power' | 'block';
  name: string;
  /** 角标用的单字 */
  short: string;
  /** 每点效果 */
  text: string;
  /** 可以分配给主将 */
  toGeneral?: boolean;
  /** 开战时把 n 点结算到单位身上 */
  apply(u: UnitState, n: number): void;
  weight(c: PointWeightCtx): number;
}
export const POINT_TYPES: PointType[] = [
  { id: 'atk', name: '攻击', short: '攻', text: '+1 攻击', apply: (u, n) => { u.atk += n; }, weight: () => 38 },
  { id: 'hp', name: '生命', short: '血', text: '+2 生命', apply: (u, n) => { u.hp += 2 * n; u.maxHp += 2 * n; }, weight: () => 38 },
  {
    id: 'power', name: '法强', short: '法', text: '+1 个人法强（只强化自己的施法）；也可以分给主将', toGeneral: true,
    apply: (u, n) => { u.grants.power = (u.grants.power ?? 0) + n; },
    weight: (c) => (c.lastPower >= 2 && c.casterWeight === 0 ? 0 : Math.min(30, 4 + 6 * c.casterWeight)),
  },
  { id: 'block', name: '格挡', short: '挡', text: '开战时 +1 层格挡', apply: (u, n) => { u.block = Math.min(3, u.block + n); }, weight: () => 14 },
];
export const POINT_MAP: Record<string, PointType> = Object.fromEntries(POINT_TYPES.map((p) => [p.id, p]));

// ───────────── 装备 ─────────────

export interface EquipDef {
  id: string;
  name: string;
  text: string;
  price: number;
  atk?: number;
  hp?: number;
  grants?: UnitGrants;
  onStart?: Effect[];
  afterAttack?: Effect[];
  /** 引擎专属逻辑 */
  special?: 'hammer';
  /** 推荐与过滤用的机制标签 */
  tags: string[];
}
const fx = (op: Effect['op'], to: Effect['to'], v: number, o: Partial<Effect> = {}): Effect => ({ op, to, v: [v, v, v], ...o });
export const EQUIPS: EquipDef[] = [
  { id: 'eq_combo', name: '连环刃', text: '获得连击，攻击 −1', price: 6, atk: -1, grants: { combo: true }, tags: ['给连击'] },
  { id: 'eq_bow', name: '鹰眼弓', text: '获得狙击', price: 5, grants: { snipe: true }, tags: ['给狙击'] },
  { id: 'eq_thorn', name: '荆棘甲', text: '反击 2', price: 4, grants: { thorns: 2 }, tags: ['反击'] },
  { id: 'eq_guard', name: '守护盾', text: '获得护卫', price: 5, grants: { guard: true }, tags: ['护卫'] },
  { id: 'eq_ice', name: '冰甲', text: '护甲 1', price: 4, grants: { armor: 1 }, tags: ['护甲'] },
  { id: 'eq_halo', name: '不灭圣徽', text: '每场一次复生', price: 6, grants: { reborn: true }, tags: ['复生'] },
  { id: 'eq_flame', name: '炽焰刃', text: '普攻后：目标获得 2 层灼烧', price: 5, afterAttack: [fx('burn', 'target', 2)], tags: ['给灼烧'] },
  { id: 'eq_frost', name: '霜刃', text: '普攻后：目标获得 1 层寒意', price: 4, afterAttack: [fx('chill', 'target', 1)], tags: ['给寒意'] },
  { id: 'eq_hammer', name: '破甲锤', text: '普攻带护甲的敌人时，伤害 +2', price: 4, special: 'hammer', tags: [] },
  { id: 'eq_tome', name: '法典', text: '法强 +2', price: 5, grants: { power: 2 }, tags: ['法强'] },
  { id: 'eq_belt', name: '巨人腰带', text: '生命 +6', price: 4, hp: 6, tags: [] },
  { id: 'eq_banner', name: '战旗', text: '开战时：相邻友军 +1 攻', price: 5, onStart: [fx('buff', 'adjacent', 1)], tags: [] },
];
export const EQUIP_MAP: Record<string, EquipDef> = Object.fromEntries(EQUIPS.map((e) => [e.id, e]));

// ───────────── 一次性法术（本场生效） ─────────────

export interface SpellDef { id: string; name: string; text: string; price: number }
export const SPELLS: SpellDef[] = [
  { id: 'sp_anchor', name: '锚定符', text: '本场敌方不能移动、拉拽你的单位', price: 3 },
  { id: 'sp_freeze', name: '冰封卷轴', text: '开战时：敌方队首获得等同其攻击的寒意（冻结一次）', price: 3 },
  { id: 'sp_purify', name: '净化之光', text: '本场你的单位每次获得寒意时减少 2 层', price: 3 },
  { id: 'sp_firerain', name: '火雨', text: '开战时：全体敌人获得 3 层灼烧', price: 3 },
  { id: 'sp_shield', name: '圣盾术', text: '开战时：全体友军获得 1 层格挡', price: 3 },
  { id: 'sp_sunder', name: '破甲药剂', text: '本场敌方全体护甲 −2', price: 2 },
  { id: 'sp_haste', name: '号令卷轴', text: '开战时：我方队首首回合行动次数 +1', price: 3 },
  { id: 'sp_warsong', name: '战歌', text: '本场全体友军 +2 攻', price: 4 },
  { id: 'sp_revive', name: '复苏药', text: '本场第一个阵亡的友军复生', price: 3 },
];
export const SPELL_MAP: Record<string, SpellDef> = Object.fromEntries(SPELLS.map((s) => [s.id, s]));

// ───────────── 招募令 ─────────────

export type OrderKind = 'o_faction' | 'o_tag' | 'o_named';
export interface OrderDef { id: OrderKind; name: string; text: string; price: [number, number]; weight: number }
export const ORDERS: OrderDef[] = [
  { id: 'o_faction', name: '阵营招募令', text: '选一个本局可用阵营或中立：重新生成本轮候选，3 张全部出自该阵营', price: [3, 4], weight: 40 },
  { id: 'o_tag', name: '词条招募令', text: '选一个标签：重新生成本轮候选，3 张全部带该标签', price: [3, 4], weight: 40 },
  { id: 'o_named', name: '指名招募令', text: '选一张已持有的单位：重新生成本轮候选，至少 1 张是它的同名卡', price: [5, 5], weight: 20 },
];
export const ORDER_MAP: Record<string, OrderDef> = Object.fromEntries(ORDERS.map((o) => [o.id, o]));

// ───────────── 主将 ─────────────

export const GENERALS: GeneralDef[] = [
  { id: 'argeon', name: '阿尔吉昂', title: '圣光统帅', faction: 'light', base: 2, art: 'f1_general', art2: 'f1_tier2general',
    text: '每第 3 拍结束：生命最低的友军获得 1 层格挡，并恢复 2+法强 生命' },
  { id: 'kaleos', name: '卡雷奥斯', title: '影之刃', faction: 'shadow', base: 3, art: 'f2_general', art2: 'f2_tier2general',
    text: '每第 3 拍结束：敌方生命最低的单位受 3+法强 伤害' },
  { id: 'lilithe', name: '莉莉丝', title: '深渊之母', faction: 'abyss', base: 2, art: 'f4_general', art2: 'f4_tier2general',
    text: '每第 3 拍结束：敌方队首受 2+法强 伤害，我方队首恢复等量生命' },
  { id: 'vulkan', name: '瓦尔坎', title: '熔岩之主', faction: 'magma', base: 2, art: 'f5_general', art2: 'f5_tier2general',
    text: '每第 3 拍结束：敌方队首获得 2+法强 层灼烧' },
  { id: 'faie', name: '法伊', title: '寒冰女王', faction: 'frost', base: 2, art: 'f6_general', art2: 'f6_tier2general',
    text: '每第 3 拍结束：敌方下一个出手者获得 2+法强 层寒意' },
  { id: 'zirix', name: '齐瑞克斯', title: '星行者', faction: 'desert', base: 3, art: 'f3_general', art2: 'f3_tier2general',
    text: '每第 3 拍结束：敌方队首获得 3+法强 层易伤' },
  { id: 'hank', name: '赫克', title: '佣兵团长', faction: 'neutral', base: 0, art: 'neutral_captainhankheart',
    text: '每第 3 拍结束：攻击最高的友军立即攻击一次，本次攻击 +法强' },
];
export const GENERAL_MAP: Record<string, GeneralDef> = Object.fromEntries(GENERALS.map((g) => [g.id, g]));

export interface PassiveDef {
  id: string;
  name: string;
  text: string;
  /** 专属被动所属主将 */
  general?: string;
  /** 通用被动的过滤条件（阵容标签族）；不满足时出现权重 0.2 */
  need?: 'burn' | 'chill' | 'cast' | 'extra' | 'equip2';
}
const X = (general: string, i: number, name: string, text: string): PassiveDef => ({ id: `${general}_${i}`, general, name, text });
export const PASSIVES: PassiveDef[] = [
  X('argeon', 1, '圣光普照', '技能改为作用于全体友军，恢复量减半（向上取整）'),
  X('argeon', 2, '坚守誓言', '技能给的格挡 +1 层'),
  X('argeon', 3, '战意鼓舞', '技能目标本场攻击 +1'),
  X('argeon', 4, '迅捷祷言', '技能改为每 2 拍'),
  X('kaleos', 1, '连环处决', '技能击杀时立即再释放一次（每拍 1 次）'),
  X('kaleos', 2, '影分身', '技能额外命中敌方队尾'),
  X('kaleos', 3, '先发制人', '技能前，攻击最高的友军立即攻击一次'),
  X('kaleos', 4, '破绽', '技能目标获得 2 层易伤'),
  X('lilithe', 1, '血债', '友军阵亡时立即释放一次技能'),
  X('lilithe', 2, '深渊潮汐', '技能改为命中全体敌人，伤害 −1'),
  X('lilithe', 3, '母性', '恢复改为作用于全体友军'),
  X('lilithe', 4, '轮回', '每场第一个阵亡的友军复生'),
  X('vulkan', 1, '燎原', '灼烧同时施加给敌方第二位'),
  X('vulkan', 2, '引爆', '技能前，带灼烧的敌人立即受等同灼烧层数的伤害（不减层）'),
  X('vulkan', 3, '熔火之心', '技能同时使攻击最高的友军本场 +2 攻'),
  X('vulkan', 4, '烈焰之主', '主将每点法强额外 +1 层灼烧'),
  X('faie', 1, '冰风', '技能改为敌方前两个出手者'),
  X('faie', 2, '凛冬', '技能使目标冻结时，全体敌人获得 1 层寒意'),
  X('faie', 3, '冰铠', '技能同时使我方队首本场护甲 +1（最多 +3）'),
  X('faie', 4, '急冻', '技能改为每 2 拍'),
  X('zirix', 1, '星辰坠落', '技能改为全体敌人各获得 1 + 法强/2 层易伤'),
  X('zirix', 2, '星盾', '技能同时使我方队首获得 1 层格挡'),
  X('zirix', 3, '蚀甲', '技能目标本场护甲 −1'),
  X('zirix', 4, '星轨', '带易伤的敌人阵亡时，下次技能提前 1 拍'),
  X('hank', 1, '重金悬赏', '立即攻击的友军本次攻击额外 +2'),
  X('hank', 2, '战利品', '该次出手击杀时获得 1 金币（每场最多 2）'),
  X('hank', 3, '号令', '技能改为每 2 拍'),
  X('hank', 4, '斩首', '立即攻击改为攻击敌方队尾（视为狙击）'),
  { id: 'g_wall', name: '坚壁', text: '开战时：全体友军获得 1 层格挡' },
  { id: 'g_morale', name: '战意', text: '友军击杀后：全体友军本场 +1 攻（每场最多 +3）' },
  { id: 'g_ember', name: '余烬', text: '敌人受到的灼烧伤害 +1', need: 'burn' },
  { id: 'g_tide', name: '寒潮', text: '敌人被冻结时：相邻敌人获得 2 层寒意', need: 'chill' },
  { id: 'g_surge', name: '法涌', text: '每个友军每场第一次施法重复一次', need: 'cast' },
  { id: 'g_martyr', name: '殉道', text: '友军阵亡时：身后一名友军本场 +2/+2' },
  { id: 'g_elite', name: '精兵', text: '开战时场上友军 ≤ 4：全体友军 +2 攻、+4 生命' },
  { id: 'g_reserve', name: '后援', text: '开战时：每个备战位单位使一名随机场上友军本场 +1/+2' },
  { id: 'g_drill', name: '练兵', text: '之后每场胜利培养点 +1' },
  { id: 'g_revive', name: '复苏', text: '每场第一个阵亡的友军复生' },
  { id: 'g_breach', name: '破阵', text: '开战时：敌方全体失去格挡，本场护甲 −1' },
  { id: 'g_first', name: '先机', text: '第 1 拍开始前：攻击最高的友军立即攻击一次' },
  { id: 'g_chain', name: '连锁', text: '你每拍「立即攻击」上限 1 → 2', need: 'extra' },
  { id: 'g_core', name: '中坚', text: '队首受到的普攻伤害 −1（最少 1）' },
  { id: 'g_weak', name: '噬弱', text: '开战时：全体敌人获得 2 层易伤' },
  { id: 'g_pay', name: '军饷', text: '每场胜利 +2 金币' },
  { id: 'g_dual', name: '双持', text: '每个单位可以装备 2 件', need: 'equip2' },
];
export const PASSIVE_MAP: Record<string, PassiveDef> = Object.fromEntries(PASSIVES.map((p) => [p.id, p]));
/** 主将技能间隔：部分专属被动改为每 2 拍 */
export const generalInterval = (passives: readonly string[]) =>
  passives.some((p) => p === 'argeon_4' || p === 'faie_4' || p === 'hank_3') ? 2 : 3;
