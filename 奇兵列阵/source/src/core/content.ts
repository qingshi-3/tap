// 远征内容表：培养点、装备、一次性法术、旧版招募令、主将与被动。
// 六阶普通单位与备战事件成长在 data.ts；这里的战斗被动不复制购买/出售成长。
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
  special?: 'hammer' | 'hourglass';
  /** 推荐与过滤用的机制标签 */
  tags: string[];
}
const fx = (op: Effect['op'], to: Effect['to'], v: number, o: Partial<Effect> = {}): Effect => ({ op, to, v: [v, v, v], ...o });
export const EQUIPS: EquipDef[] = [
  { id: 'eq_combo', name: '连环刃', text: '获得连击，攻击 −1', price: 6, atk: -1, grants: { combo: true }, tags: ['给连击'] },
  { id: 'eq_bow', name: '鹰眼弓', text: '获得狙击', price: 5, grants: { snipe: true }, tags: ['给狙击'] },
  { id: 'eq_thorn', name: '荆棘甲', text: '反击 2', price: 4, grants: { thorns: 2 }, tags: ['反击'] },
  { id: 'eq_guard', name: '挑衅盾', text: '获得嘲讽', price: 5, grants: { taunt: true }, tags: ['嘲讽'] },
  { id: 'eq_ice', name: '冰甲', text: '护甲 1', price: 4, grants: { armor: 1 }, tags: ['护甲'] },
  { id: 'eq_halo', name: '不灭圣徽', text: '获得复生（已有复生则无效）', price: 6, grants: { reborn: true }, tags: ['复生'] },
  { id: 'eq_flame', name: '炽焰刃', text: '普攻后：目标获得 2 层灼烧', price: 5, afterAttack: [fx('burn', 'target', 2)], tags: ['给灼烧'] },
  { id: 'eq_frost', name: '霜刃', text: '普攻后：目标获得 1 层寒意', price: 4, afterAttack: [fx('chill', 'target', 1)], tags: ['给寒意'] },
  { id: 'eq_hammer', name: '破甲锤', text: '普攻带护甲的敌人时，伤害 +2', price: 4, special: 'hammer', tags: [] },
  { id: 'eq_tome', name: '法典', text: '法强 +2', price: 5, grants: { power: 2 }, tags: ['法强'] },
  { id: 'eq_belt', name: '巨人腰带', text: '生命 +6', price: 4, hp: 6, tags: [] },
  { id: 'eq_boots', name: '风行靴', text: '获得轮换', price: 5, grants: { rotate: true }, tags: ['轮换'] },
  { id: 'eq_duel', name: '决斗剑', text: '获得决斗', price: 5, grants: { duel: true }, tags: ['决斗'] },
  { id: 'eq_hourglass', name: '沙漏坠', text: '蓄力需求 −1（最少 1）', price: 5, special: 'hourglass', tags: ['蓄力'] },
  { id: 'eq_banner', name: '战旗', text: '开战时：相邻友军 +1 攻', price: 5, onStart: [fx('buff', 'adjacent', 1)], tags: [] },
];
export const EQUIP_MAP: Record<string, EquipDef> = Object.fromEntries(EQUIPS.map((e) => [e.id, e]));

// ───────────── 一次性法术（本场生效） ─────────────

export interface SpellDef { id: string; name: string; text: string; price: number }
export const SPELLS: SpellDef[] = [
  { id: 'sp_anchor', name: '锚定符', text: '本场敌方的换位、调动效果对你无效', price: 3 },
  { id: 'sp_freeze', name: '冰封卷轴', text: '开战时：敌方队首获得等同其攻击的寒意（冻结一次）', price: 3 },
  { id: 'sp_purify', name: '净化之光', text: '本场你的单位每次获得寒意时减少 2 层', price: 3 },
  { id: 'sp_firerain', name: '火雨', text: '开战时：全体敌人获得 3 层灼烧', price: 3 },
  { id: 'sp_shield', name: '圣盾术', text: '开战时：全体友军获得 1 层格挡', price: 3 },
  { id: 'sp_sunder', name: '破甲药剂', text: '本场敌方全体护甲 −2', price: 2 },
  { id: 'sp_haste', name: '号令卷轴', text: '开战时：我方队首首回合行动次数 +1', price: 3 },
  { id: 'sp_warsong', name: '战歌', text: '本场全体友军 +2 攻', price: 4 },
  { id: 'sp_revive', name: '复苏药', text: '本场第一个阵亡的友军复生', price: 3 },
  { id: 'sp_soul', name: '召魂符', text: '本场你的第一个亡语触发两次', price: 3 },
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
  { id: 'argeon', name: '阿尔吉昂', title: '圣光统帅', faction: 'light', skill: '亲征', base: 2, art: 'f1_general', art2: 'f1_tier2general',
    text: '阿尔吉昂作为单位上场（3/8，每章 +2/+4），不能出售；每场第一次受到致命伤害时保留 1 生命' },
  { id: 'zilan', name: '齐兰', title: '轮转剑主', faction: 'light', skill: '轮番上阵', base: 2, art: 'f1_altgeneral', art2: 'f1_altgeneraltier2',
    text: '每回合结束时：全队轮转一格，队首去队尾，其余前移' },
  { id: 'kaleos', name: '卡雷奥斯', title: '影之刃', faction: 'shadow', skill: '压轴', base: 0, art: 'f2_general', art2: 'f2_tier2general',
    text: '每回合我方最后一个完成常规行动的友军，行动后追击一次，本次攻击 +法强' },
  { id: 'reva', name: '蕾娃', title: '幻影谋士', faction: 'shadow', skill: '调虎离山', base: 1, art: 'f2_altgeneral', art2: 'f2_altgeneraltier2',
    text: '每场开战前：在布阵界面选两个敌人交换位置（每场一次）；被调动的敌人本场 −1 攻' },
  { id: 'lilithe', name: '莉莉丝', title: '深渊之母', faction: 'abyss', skill: '魂潮', base: 4, art: 'f4_general', art2: 'f4_tier2general',
    text: '双方任一单位阵亡时获得 1 魂；每攒满 3 魂：全体友军本场 +1/+1' },
  { id: 'kasiva', name: '卡西瓦', title: '血祭司', faction: 'abyss', skill: '血祭', base: 0, art: 'f4_altgeneral', art2: 'f4_altgeneraltier2',
    text: '开战时：献祭我方队尾单位，其余友军平分它 2 倍的攻击和生命（本场）' },
  { id: 'vulkan', name: '瓦尔坎', title: '熔岩之主', faction: 'magma', skill: '火山战场', base: 2, art: 'f5_general', art2: 'f5_tier2general',
    text: '每回合结束时：敌方队首获得 2+法强 层灼烧' },
  { id: 'xingjiao', name: '星角', title: '驭龙者', faction: 'magma', skill: '龙蛋', base: 0, art: 'f5_altgeneral', art2: 'f5_altgeneraltier2',
    text: '开局获得一颗龙蛋（不行动）；战斗事件（阵亡/灼烧/冻结/换位/召唤）跨场累积，任一类满 12 孵化成对应的龙' },
  { id: 'faie', name: '法伊', title: '寒冰女王', faction: 'frost', skill: '先机', base: 2, art: 'f6_general', art2: 'f6_tier2general',
    text: '前 2 回合：敌方全体推迟一个行动轮；友军普攻或技能击杀敌人后，全体友军本场 +2 攻（每场最多2次，后发也生效）' },
  { id: 'kara', name: '卡拉', title: '棱镜术士', faction: 'frost', skill: '棱镜', base: 0, art: 'f6_altgeneral', art2: 'f6_altgeneraltier2',
    text: '开战时：我方场上每种不同关键词使全体友军 +1 生命；每满 3 种再 +1 攻（最多 +3）' },
  { id: 'zirix', name: '齐瑞克斯', title: '星行者', faction: 'desert', skill: '星轨', base: 3, art: 'f3_general', art2: 'f3_tier2general',
    text: '每次交锋结束时积 1 星能；满 4 时：交换敌方的队首和队尾，然后清零' },
  { id: 'sajj', name: '萨吉', title: '沙域统领', faction: 'desert', skill: '预备队', base: 2, art: 'f3_altgeneral', art2: 'f3_altgeneraltier2',
    text: '获得第 6 格预备位：预备单位不行动、不能被选中；我方出现空位时立即补进，当回合可以行动' },
  { id: 'hank', name: '赫克', title: '佣兵团长', faction: 'neutral', skill: '佣兵团', base: 0, art: 'neutral_captainhankheart',
    text: '每场战斗前可免费招 1 名临时佣兵（随机二阶，只参加本场）；每场胜利 +1 金' },
];
export const GENERAL_MAP: Record<string, GeneralDef> = Object.fromEntries(GENERALS.map((g) => [g.id, g]));

/** New expeditions use these four; legacy definitions remain addressable for saved runs. */
export const ACTIVE_GENERAL_IDS = ['reva', 'zilan', 'sajj', 'kaleos'] as const;
/** Shared tactical choices for tacticsVersion 1; legacy exclusive passives stay in PASSIVE_MAP. */
export const TACTIC_IDS = ['g_martyr', 'g_revive', 'g_horde', 'g_relay', 'g_arena', 'g_surge', 'g_dual', 'g_elite', 'g_breach', 'g_drill', 'g_pay', 'g_taunt'] as const;

/** Display definition follows the run's version; never mutate the legacy map. */
export function generalDefinition(id: string, tacticsVersion?: 1): GeneralDef {
  const legacy = GENERAL_MAP[id];
  if (!legacy) throw new Error(`unknown general ${id}`);
  if (tacticsVersion !== 1) return legacy;
  if (id === 'zilan') return { ...legacy, skill: '换防', text: '备战时指定一名战位友军：本场获得轮换，每回合实际轮换后恢复 2 生命（每回合限一次）' };
  if (id === 'kaleos') return { ...legacy, skill: '号令', text: '备战时指定一名战位友军：前 2 回合各增加 1 次完整常规行动（每回合限一次）' };
  return legacy;
}


/** 当前已获得技能的法强用途；培养入口和说明共用，不能把未选的专属当作现有收益。 */
export function generalPowerSources(id: string, passives: readonly string[]): string[] {
  const result = id === 'kaleos' ? ['压轴追击'] : id === 'vulkan' ? ['火山战场'] : [];
  const uses: Record<string, readonly [string, string][]> = {
    argeon: [['argeon_3', '光誓']],
    zilan: [['zilan_2', '接力'], ['zilan_3', '换防']],
    reva: [['reva_2', '惊扰']],
    lilithe: [['lilithe_1', '收割']],
    xingjiao: [['xingjiao_3', '龙血']],
    faie: [['faie_1', '凝滞']],
    zirix: [['zirix_1', '星痕'], ['zirix_3', '引力']],
    sajj: [['sajj_2', '援军']],
  };
  for (const [passive, name] of uses[id] ?? []) if (passives.includes(passive)) result.push(name);
  return result;
}


export interface PassiveDef {
  id: string;
  name: string;
  text: string;
  /** 专属被动所属主将 */
  general?: string;
  /** 通用被动的过滤条件（阵容标签族）；不满足时出现权重 0.2 */
  need?: 'burn' | 'chill' | 'cast' | 'extra' | 'equip2' | 'rotate' | 'duel' | 'charge' | 'rattle' | 'summon' | 'taunt';
}
const X = (general: string, i: number, name: string, text: string): PassiveDef => ({ id: `${general}_${i}`, general, name, text });
export const PASSIVES: PassiveDef[] = [
  X('argeon', 1, '盾誓', '阿尔吉昂获得嘲讽；每次被普攻后：身后的友军获得 1 层格挡'),
  X('argeon', 2, '剑誓', '阿尔吉昂获得决斗和连击；击败对手时：全体友军本场 +1 攻'),
  X('argeon', 3, '光誓', '有友军受伤时，阿尔吉昂改为施法：全体友军恢复 2+主将法强 生命；否则普攻'),
  X('argeon', 4, '王誓', '阿尔吉昂获得轮换；他成为队首时：全体友军获得 1 层格挡'),
  X('zilan', 1, '回马枪', '轮转前：离开队首的友军先追击一次，本次 +2 攻'),
  X('zilan', 2, '接力', '因轮转成为队首的友军，下回合 +2+法强 攻'),
  X('zilan', 3, '换防', '被轮转到队尾的友军恢复 3+法强 生命，并获得 1 层格挡'),
  X('zilan', 4, '急转', '改为每次交锋结束时都轮转（每回合最多 3 次）'),
  X('kaleos', 1, '首发', '改为每回合第一个出手的友军'),
  X('kaleos', 2, '余韵', '压轴者本次若施法，改为追加同一技能，不追击；追加消耗剩余次数，不再触发复制'),
  X('kaleos', 3, '双幕', '倒数第二个出手的友军也追击，但伤害减半'),
  X('kaleos', 4, '影步', '压轴者成功追击或余韵追加施法后，和我方队首交换位置'),
  X('reva', 1, '二度', '每场可以交换两次'),
  X('reva', 2, '惊扰', '被你调动的敌人本场额外减攻 1+⌊法强/2⌋'),
  X('reva', 3, '抢拍', '被你调到队首的敌人首回合最后出手'),
  X('reva', 4, '孤立', '被你调到队尾的敌人本场不能获得其他友军的治疗、增益或光环；自身能力保留'),
  X('lilithe', 1, '收割', '每 3 魂改为对敌方队首造成 4+法强 伤害；可与魂火同时触发'),
  X('lilithe', 2, '魂火', '每 3 魂改为在我方队尾召唤 2/2 暗影；可与收割同时触发'),
  X('lilithe', 3, '噬魂', '只有敌人阵亡才计魂，但每个计 2'),
  X('lilithe', 4, '冥约', '每 3 魂：额外让第一个阵亡的友军以一半生命复活，插到队尾（每场最多 2 次）'),
  X('kasiva', 1, '双祭', '改为献祭队尾两个单位'),
  X('kasiva', 2, '哀悼', '被献祭者的亡语触发两次（和深渊主母不叠加）'),
  X('kasiva', 3, '血债', '改为只把属性给队首，但给的是全额（2 倍）'),
  X('kasiva', 4, '余烬', '被献祭者在第 2 回合开始时以一半生命回到队尾'),
  X('vulkan', 1, '浴火', '我方队首也获得 1 层灼烧；我方单位每次受到灼烧伤害后，本场 +1 攻'),
  X('vulkan', 2, '地裂', '改为敌方队尾'),
  X('vulkan', 3, '余烬扩散', '带灼烧的单位阵亡时，剩余灼烧转给身后友军；身后无人则转给其他友军中的队首'),
  X('vulkan', 4, '熔岩护体', '偶数回合结束时：我方队首获得 1 层格挡'),
  X('xingjiao', 1, '早孵', '孵化阈值降为8；龙开战时本场 +1/+2'),
  X('xingjiao', 2, '双黄', '孵化时再得1颗龙蛋；取得时已有龙且无蛋也补1颗。满位时保留，腾位后补入'),
  X('xingjiao', 3, '龙血', '龙本场 +法强/+法强×2'),
  X('xingjiao', 4, '硬壳', '龙蛋获得嘲讽和护甲2；龙获得护甲1'),
  X('faie', 1, '凝滞', '先机期间被我方命中的敌人获得 2+法强 层寒意'),
  X('faie', 2, '长冬', '前 2 回合先机不变；第 3 回合额外推迟敌方最后两个单位'),
  X('faie', 3, '后发', '仅首回合改为我方后发、全体本回合 +3 攻；第 2 回合恢复先机，长冬仍生效'),
  X('faie', 4, '冰封时刻', '先机期间，我方蓄力单位每次行动多 +1 蓄力'),
  X('kara', 1, '纯色', '改为：最多友军共有的关键词，带它的友军各 +X/+X（X=带它的友军数+3，最多6）'),
  X('kara', 2, '折射', '棱镜或纯色不再加生命，改为队首获得等量格挡（最多3层）；攻击及分光保留'),
  X('kara', 3, '分光', '关键词种类 ≥6 时，全体友军获得「法强 +1」'),
  X('kara', 4, '共鸣', '棱镜统计双方的关键词；纯色也计入敌方同词持有者，仍只强化友军，数值上限不变'),
  X('zirix', 1, '星痕', '被交换的敌人各获得 2+法强 层寒意'),
  X('zirix', 2, '轨迹', '双方每发生一次换位（星轨、轮换等都算）：全体友军本场 +1 攻'),
  X('zirix', 3, '引力', '被交换的单位各受 3+法强 伤害'),
  X('zirix', 4, '近轨', '改为交换队首和第 2 位'),
  X('sajj', 1, '待命', '预备单位每次交锋 +1 蓄力；没有蓄力的改为每次交锋 +1 攻（最多 +3）'),
  X('sajj', 2, '援军', '补位者入场时本场 +2+法强/+2+法强'),
  X('sajj', 3, '双预备', '预备位增加到 2 个，按顺序补位'),
  X('sajj', 4, '收容', '满员时召唤物进入空预备位；入场时触发一次召唤联动，预备已满则按原规则处理'),
  X('hank', 1, '长约', '临时佣兵可以花 3 金转正'),
  X('hank', 2, '抚恤', '临时佣兵阵亡时 +1 金'),
  X('hank', 3, '精锐合同', '临时佣兵改为随机三阶单位'),
  X('hank', 4, '军需官', '每场开战前额外获得 1 张随机一次性法术'),
  { id: 'g_wall', name: '坚壁', text: '开战时：全体友军获得 1 层格挡' },
  { id: 'g_morale', name: '战意', text: '友军击杀后：全体友军本场 +1 攻（每场最多 +3）' },
  { id: 'g_ember', name: '余烬', text: '敌人受到的灼烧伤害 +1', need: 'burn' },
  { id: 'g_tide', name: '寒潮', text: '敌人被冻结时：相邻敌人获得 2 层寒意', need: 'chill' },
  { id: 'g_surge', name: '法涌', text: '每个友军每场首次施法后追加一次，消耗该技能剩余次数；追加不再触发复制', need: 'cast' },
  { id: 'g_martyr', name: '殉道', text: '友军阵亡时：身后一名友军本场 +2/+2' },
  { id: 'g_elite', name: '精兵', text: '开战时场上友军 ≤ 4：全体友军 +2 攻、+4 生命' },
  { id: 'g_drill', name: '练兵', text: '之后每场胜利培养点 +1' },
  { id: 'g_revive', name: '复苏', text: '每场第一个阵亡的友军复生' },
  { id: 'g_breach', name: '破阵', text: '开战时：敌方全体失去格挡，本场护甲 −1' },
  { id: 'g_haste', name: '抢攻', text: '开战时：攻击最高的友军追击一次' },
  { id: 'g_chain', name: '连锁', text: '你的追击可以再引发一次追击', need: 'extra' },
  { id: 'g_core', name: '中坚', text: '队首受到的普攻伤害 −1（最少 1）' },
  { id: 'g_pay', name: '军饷', text: '每场胜利 +2 金币' },
  { id: 'g_dual', name: '双持', text: '每个单位可以装备 2 件', need: 'equip2' },
  { id: 'g_relay', name: '接力', text: '友军成为队首时：本回合 +1 攻', need: 'rotate' },
  { id: 'g_arena', name: '擂台', text: '友军击败对手时：该友军恢复 3 生命', need: 'duel' },
  { id: 'g_store', name: '厚积', text: '开战时：所有带蓄力的友军 +1 蓄力', need: 'charge' },
  { id: 'g_rattle', name: '回魂', text: '每场第一次亡语触发两次', need: 'rattle' },
  { id: 'g_horde', name: '扩编', text: '召唤物 +1/+1', need: 'summon' },
  { id: 'g_taunt', name: '铁壁', text: '嘲讽友军受到的普攻伤害 −1', need: 'taunt' },
];
export const PASSIVE_MAP: Record<string, PassiveDef> = Object.fromEntries(PASSIVES.map((p) => [p.id, p]));
