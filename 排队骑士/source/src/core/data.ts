// 排队骑士 · 卡牌、补给与 Boss 数据（v0.4：去阵营，按引擎标签归类；技能照搬 SAP 原型）。
// 技能逻辑在 engine.ts（战斗内）与 run.ts（商店内）里按 ab 实现；ab 用 SAP 原型名，这里只放数值与文案。

export type Kw = 'block' | 'reborn' | 'splash';
export type Tier = 1 | 2 | 3 | 4 | 5 | 6;
export type V3 = [number, number, number];
/** 引擎标签（v0.4 去阵营）：按触发时机归类，只用于图鉴筛选、配色与 bot 选卡，没有羁绊规则 */
export type Line = 'death' | 'hurt' | 'start' | 'food' | 'grow' | 'any' | 'enemy';

export interface CardDef {
  id: string;
  name: string;
  tier: Tier;
  atk: number;
  hp: number;
  /** 天生词条（格挡是状态，不在这里） */
  kws: Kw[];
  /** 技能 id（SAP 原型名），engine / run 按它分派 */
  ab?: string;
  v?: V3;
  /** 第二组数值，文案里写 {u} */
  u?: V3;
  /** 卡面文案；{v} {u} 替换成当前星级数值 */
  text: string;
  /** 主标签 */
  line: Line;
  /** 副标签：桥接卡同时服务的另一个引擎 */
  tag2?: Line;
  /** 永久成长卡（卡面标「永」） */
  perm?: boolean;
  /** 仅这些单位可记录直接食用的白名单补给，并在出售时传承重吃。 */
  inherit?: boolean;
  /** 召唤物：固定 token id，或随机单位的阶层 */
  sum?: string | Tier;
  token?: boolean;
  enemy?: boolean;
}

const C = (id: string, name: string, tier: Tier, atk: number, hp: number, line: Line, text: string, o: Partial<CardDef> = {}): CardDef =>
  ({ id, name, tier, atk, hp, line, text, kws: [], ...o });

export const CARDS: CardDef[] = [
  // 卡按原 SAP 原型分组排列；归属看 line / tag2
  C('l_shield', '银盾侍卫', 1, 2, 6, 'hurt', '受伤时：自己本场 +{v} 攻', { ab: 'peacock', v: [2, 4, 6] }),
  C('l_windblade', '风刃剑士', 1, 3, 6, 'hurt', '交锋前：对身后 {v} 个友军各造成 1 伤害', { ab: 'elephant', v: [2, 3, 4] }),
  C('l_vigil', '守誓者', 2, 3, 6, 'hurt', '受伤时：身后友军本场 +{v}/+{u}', { ab: 'camel', v: [2, 3, 4], u: [2, 4, 6] }),
  C('n_tether', '链誓术士', 2, 2, 4, 'grow', '回合结束时：相邻友军永久 +{v} 血', { tag2: 'hurt', ab: 'tfish', v: [1, 2, 3], perm: true }),
  C('l_warden', '晨光盾卫', 3, 3, 7, 'hurt', '受伤时：随机打一个敌人 {v}', { ab: 'blowfish', v: [3, 6, 9] }),
  C('n_medic', '苦修导师', 3, 3, 7, 'hurt', '开战时：对身后 {v} 个友军各造成 1 伤害，并让它们本场 +1 攻', { ab: 'drill', v: [1, 2, 3], tag2: 'start' }),
  C('l_caliber', '圣铸机兵', 4, 7, 11, 'hurt', '开战时：对所有友军（含自己）造成 1 伤害，重复 {v} 次', { ab: 'anvil', v: [1, 2, 3] }),
  C('l_knight', '晨曦骑士', 4, 7, 9, 'any', '击杀敌人时：打新的敌方队首 {v}', { ab: 'rhino', v: [4, 8, 12] }),
  C('l_storm', '风暴剑圣', 5, 9, 11, 'hurt', '友军受伤时：自己本场 +{v}/+{v}', { ab: 'storm', v: [2, 4, 6] }),
  C('l_archon', '曙光执政官', 6, 7, 8, 'any', '身前友军的技能额外释放 1 次（按我的星级结算）', { ab: 'tiger', v: [1, 2, 3] }),
  C('s_dart', '飞镖手', 1, 2, 3, 'start', '开战时：随机 {v} 个敌人各受 1 伤害', { ab: 'mosquito', v: [1, 2, 3] }),
  C('s_fox', '灯笼狐', 1, 2, 1, 'grow', '回合结束时：队尾友军永久 +{v} 攻', { ab: 'bluebird', v: [1, 2, 3], perm: true }),
  C('s_step', '影步刺客', 2, 3, 5, 'start', '开战时：身前友军本场获得我攻击的 {v}%', { ab: 'dodo', v: [50, 100, 150] }),
  C('s_backstab', '背刺者', 2, 3, 4, 'grow', '回合结束时：身前友军永久 +{v} 攻', { tag2: 'start', ab: 'backstab', v: [1, 2, 3], perm: true }),
  C('s_dancer', '影舞者', 3, 4, 5, 'start', '身前友军攻击后：打敌方队首，伤害 = 我攻击的 {v}%', { ab: 'snake', v: [50, 100, 150] }),
  C('s_ninja', '连环忍者', 3, 1, 2, 'start', '身前友军攻击后：自己本场 +{v}/+{v}', { ab: 'kangaroo', v: [2, 4, 6] }),
  C('s_hunter', '暗隙猎手', 4, 7, 7, 'start', '开战时：打敌方血最低的单位 {v}', { ab: 'dolphin', v: [4, 8, 12] }),
  C('s_viper', '赤蛇刺客', 5, 10, 6, 'start', '开战时：打敌方队尾 {v}', { ab: 'croc', v: [6, 12, 18] }),
  C('s_master', '千刃宗师', 5, 6, 9, 'start', '开战时：敌方血最高的单位失去 {v}% 血', { ab: 'skunk', v: [33, 66, 99] }),
  C('s_lord', '岚影宗主', 6, 12, 7, 'start', '开战时：随机 {v} 个敌人各受我攻击 50% 的伤害', { ab: 'leopard', v: [1, 2, 3] }),
  C('a_imp', '残魂小鬼', 1, 2, 2, 'death', '阵亡时：原位召唤 {v}/{v} 魂火', { ab: 'cricket', v: [2, 3, 4], sum: 't_wisp' }),
  C('a_spine', '暗棘', 1, 3, 2, 'death', '阵亡时：随机一个友军本场 +{v}/+{u}', { ab: 'ant', v: [3, 6, 9], u: [2, 4, 6] }),
  C('a_graveguard', '墓园守卫', 2, 4, 2, 'death', '阵亡时：身后 2 个友军本场 +{v}/+{v}', { ab: 'flamingo', v: [2, 4, 6] }),
  C('a_reaper', '灵魂收割者', 2, 3, 2, 'death', '阵亡时：场上所有单位（敌我都算）受到 {v} 伤害', { tag2: 'hurt', ab: 'hedgehog', v: [2, 4, 6] }),
  C('a_ritualist', '唤亡祭师', 3, 2, 6, 'death', '友军阵亡时：自己本场 +{v} 攻，并获得 1 层格挡（每场 {u} 次）', { ab: 'ox', v: [2, 4, 6], u: [2, 2, 3] }),
  C('a_chanter', '魂缚吟者', 4, 5, 8, 'death', '阵亡时：身后 {v} 个友军各获得 1 层格挡', { ab: 'turtle', v: [1, 2, 3] }),
  C('a_cult', '献祭术士', 4, 7, 7, 'death', '阵亡时：对相邻单位（敌我都算）造成我攻击 {v}% 的伤害', { tag2: 'hurt', ab: 'badger', v: [50, 100, 150] }),
  C('a_engulf', '吞噬之影', 5, 7, 9, 'death', '友军阵亡时：自己本场 +{v}/+{u}', { ab: 'shark', v: [3, 6, 9], u: [2, 4, 6] }),
  C('a_matriarch', '深渊主母', 6, 8, 10, 'death', '友军阵亡时：在它原位召唤 {v}/{v} 骷髅（每场 3 次，骷髅阵亡不触发）', { ab: 'fly', v: [5, 10, 15], sum: 't_bonelet' }),
  C('a_nightmare', '夜魇', 6, 7, 14, 'death', '阵亡时：所有友军本场 +{v}/+{v}', { ab: 'mammoth', v: [3, 6, 9] }),
  C('m_egg', '幼兽蛋', 1, 0, 3, 'death', '阵亡时：原位孵出幼龙（1/1 + 蛋里攒的成长）。回合结束时：幼龙永久 +{v}/+{v}', { tag2: 'grow', ab: 'egg', v: [1, 2, 3], perm: true, sum: 't_drakelet' }),
  C('m_whelp', '炽棘幼龙', 1, 2, 1, 'death', '友军被召唤时：它本场 +{v} 攻', { ab: 'horse', v: [1, 2, 3] }),
  C('m_raptor', '白鬃猎龙', 2, 2, 2, 'death', '阵亡时：原位召唤一个随机 3 阶单位（2/2，{v} 星）', { ab: 'spider', v: [1, 2, 3], sum: 3 }),
  C('m_incubator', '孵化看守', 3, 3, 4, 'death', '友军被召唤时：自己 +{v}/+{v}（商店里永久，战斗中本场）', { tag2: 'grow', ab: 'dog', v: [1, 2, 3] }),
  C('m_kujata', '驮岩兽', 3, 2, 2, 'death', '阵亡时：原位召唤 2 只 {v}/{v} 小兽', { ab: 'sheep', v: [3, 6, 9], sum: 't_wolf' }),
  C('m_rex', '熔岩巨蜥', 4, 3, 5, 'death', '阵亡时：原位召唤 {v}/{v} 熔岩小蜥（溅射）', { ab: 'deer', v: [5, 10, 15], sum: 't_flame' }),
  C('m_bloodcaller', '熔血巫兽', 5, 6, 8, 'death', '友军被召唤时：它本场 +{v}/+{v}', { ab: 'turkey', v: [3, 6, 9] }),
  C('m_mankator', '炎鬃战兽', 5, 8, 6, 'death', '阵亡时：原位召唤 {v} 只小兽（攻击 = 我攻击的一半，1 血）', { ab: 'rooster', v: [1, 2, 3], sum: 't_wolf' }),
  C('m_titan', '熔岩巨像', 6, 9, 9, 'death', '阵亡时：原位召唤一个随机 6 阶单位（{v} 星）', { ab: 'eagle', v: [1, 2, 3], sum: 6 }),
  C('m_heart', '火山之心', 6, 9, 12, 'death', '召唤物出现时：它本场 +{v}/+{v}，并获得溅射', { ab: 'heart', v: [3, 6, 9] }),
  C('v_guard', '冰晶甲虫', 1, 1, 3, 'food', '自己吃补给时：额外永久 +{v}/+{v}', { tag2: 'grow', ab: 'ladybug', v: [1, 2, 3], perm: true, inherit: true }),
  C('v_snowman', '雪人', 2, 4, 3, 'food', '自己吃补给时：所有友军本场 +{v} 攻', { ab: 'tabby', v: [1, 2, 3], inherit: true }),
  C('v_scout', '冰原霜狼', 2, 3, 4, 'food', '其他友军吃补给时：它额外永久 +{v} 血', { tag2: 'grow', ab: 'rabbit', v: [1, 1, 2], perm: true, inherit: true }),
  C('v_mage', '冰霜法师', 3, 3, 4, 'food', '自己吃补给时：额外永久 +{v}/+{v}', { tag2: 'grow', ab: 'worm', v: [1, 1, 2], perm: true, inherit: true }),
  C('v_keeper', '寒冬守望者', 4, 4, 8, 'food', '自己吃补给时：相邻友军各永久 +{v}/+{v}（每回合 {u} 次）', { tag2: 'grow', ab: 'seal', v: [1, 1, 2], u: [2, 3, 3], perm: true, inherit: true }),
  C('v_sentinel', '冰角战兽', 4, 6, 8, 'food', '备战回合开始时：追加 1 瓶免费牛奶（永久 +{v}/+{u}，全场最多 2 瓶，本回合有效）', { tag2: 'grow', ab: 'cow', v: [1, 2, 3], u: [1, 2, 3], inherit: true }),
  C('v_bear', '冰河巨熊', 5, 7, 10, 'food', '购买付费补给后：返还 {v} 金（全队每回合 {u} 次，同次取最高星）', { ab: 'sauropod', v: [1, 2, 3], u: [2, 2, 2], inherit: true }),
  C('v_rhyno', '冰原巨犀', 5, 7, 8, 'food', '回合结束时：本回合直接吃过至少 3 次补给，则全队永久 +{v}/+{v}（传承重吃不计）', { tag2: 'grow', ab: 'rhyno', v: [1, 1, 2], perm: true, inherit: true }),
  C('v_queen', '霜冠执政官', 6, 7, 9, 'food', '自己吃的补给，攻血效果 ×{v}', { ab: 'cat', v: [2, 2, 3], inherit: true }),
  C('v_wyvern', '白霜巨龙', 6, 8, 11, 'food', '友军吃补给时：相邻另外至多 {v} 个友军获得其攻血效果的一半（至少 +1，身前优先）', { ab: 'wyvern', v: [1, 1, 2], perm: true, inherit: true }),
  C('d_artificer', '构装学徒', 1, 2, 3, 'grow', '出售时：随机一个友军永久 +{v}/+{v}', { ab: 'beaver', v: [1, 2, 3], perm: true }),
  C('d_dune', '棘网蛛', 2, 3, 6, 'hurt', '受伤时：对伤害来源造成 {v} 伤害', { ab: 'thornback', v: [3, 6, 9] }),
  C('d_howler', '沙嚎者', 3, 3, 6, 'grow', '回合结束时：身前 {v} 个友军各永久 +1/+1', { ab: 'giraffe', v: [1, 2, 3], perm: true }),
  C('d_keeper', '遗迹守卫', 3, 3, 5, 'grow', '自己升星时：所有友军永久 +{v}/+{v}（升 2 星 +1，升 3 星 +2）', { ab: 'fish', v: [2, 3, 4], perm: true }),
  C('d_dunecaster', '沙灵塑师', 4, 7, 7, 'grow', '每买一个友军：自己永久 +{v}/+{v}', { ab: 'buffalo', v: [1, 2, 3], perm: true }),
  C('d_hourglass', '沙漏构装', 4, 4, 7, 'grow', '回合结束时：其他 2 星及以上的友军各永久 +{v}/+{v}', { ab: 'penguin', v: [1, 2, 3], perm: true }),
  C('d_goldob', '金焰方尖碑', 5, 4, 8, 'grow', '回合结束时：队首友军永久 +{v}/+{u}', { tag2: 'hurt', ab: 'monkey', v: [1, 2, 3], u: [2, 3, 4], perm: true }),
  C('d_pharaoh', '沙域法老', 5, 7, 7, 'any', '回合结束时：复制身前友军的技能（按 {v} 星），持续到下回合', { ab: 'parrot', v: [1, 2, 3] }),
  C('d_onyx', '黑曜豹神', 6, 8, 11, 'grow', '每买一个 1 阶单位：全队永久 +{v}/+{v}', { ab: 'dragon', v: [1, 1, 2], perm: true }),
  C('d_worm', '黑沙巨虫', 6, 9, 16, 'hurt', '受伤时：所有友军本场 +{v}/+{v}（每场 3 次）', { ab: 'idol', v: [2, 4, 6] }),
  // ── 召唤物 ──
  C('t_wisp', '魂火', 1, 1, 1, 'death', '', { token: true }),
  C('t_bonelet', '骷髅', 1, 2, 2, 'death', '', { token: true }),
  C('t_drakelet', '幼龙', 1, 1, 1, 'death', '', { token: true }),
  C('t_wolf', '小兽', 1, 1, 1, 'death', '', { token: true }),
  C('t_flame', '熔岩小蜥', 1, 3, 3, 'death', '溅射', { token: true, kws: ['splash'] }),
  // ── Boss 专用（数值是形状，实际按回合强度缩放） ──
  C('e_shield', '钢铁傀儡', 2, 2, 9, 'enemy', '开战时：自己 +{v} 格挡', { enemy: true, ab: 'ironwall', v: [2, 3, 4] }),
  C('e_guardian', '持盾宗师', 2, 3, 7, 'enemy', '阵亡时：身后 {v} 个友军各获得 1 层格挡', { enemy: true, ab: 'turtle', v: [1, 2, 3] }),
  C('e_golem', '沙岩傀儡', 1, 2, 10, 'enemy', '受伤时：获得 1 层格挡（每场 {v} 次）', { enemy: true, ab: 'gorilla', v: [1, 2, 3] }),
  C('e_skel', '白骨兵', 1, 2, 3, 'enemy', '阵亡时：原位召唤 {v}/{v} 骷髅', { enemy: true, ab: 'cricket', v: [1, 2, 3], sum: 't_bonelet' }),
  C('e_tomb', '墓穴看守', 3, 3, 7, 'enemy', '友军阵亡时：在它原位召唤 {v}/{v} 骷髅（每场 3 次）', { enemy: true, ab: 'fly', v: [2, 4, 6], sum: 't_bonelet' }),
  C('e_lich', '白骨收割者', 3, 4, 7, 'enemy', '友军阵亡时：自己本场 +{v}/+{v}', { enemy: true, ab: 'shark', v: [1, 2, 3], u: [1, 2, 3] }),
  C('e_revenant', '复仇亡魂', 2, 4, 4, 'enemy', '', { enemy: true, kws: ['reborn'] }),
  C('e_warlord', '熔炉战将', 3, 5, 7, 'enemy', '交锋前：对身后 {v} 个友军各造成 1 伤害', { enemy: true, ab: 'elephant', v: [1, 2, 3] }),
  C('e_frostq', '炉火女王', 3, 3, 8, 'enemy', '受伤时：自己本场 +50% 攻（每场 {v} 次）', { enemy: true, ab: 'peacock', v: [1, 2, 3] }),
  C('e_thorn', '熔棘兽', 2, 3, 7, 'enemy', '受伤时：随机打一个敌人 {v}', { enemy: true, ab: 'blowfish', v: [2, 3, 4] }),
  C('e_nightk', '炉誓骑士', 3, 4, 8, 'enemy', '受伤时：身后友军本场 +{v}/+{u}', { enemy: true, ab: 'camel', v: [1, 2, 3], u: [2, 3, 4] }),
  C('e_twin', '双刃督战', 3, 5, 6, 'enemy', '溅射 {v}%', { enemy: true, kws: ['splash'], v: [50, 75, 100] }),
  C('e_pyre', '焚身者', 3, 6, 4, 'enemy', '阵亡时：场上所有单位受到 {v} 伤害', { enemy: true, ab: 'hedgehog', v: [3, 5, 7] }),
  C('e_void', '暗影领主', 4, 6, 12, 'enemy', '交锋前：自己本场 +{v}/+{v}', { enemy: true, ab: 'boar', v: [2, 3, 4] }),
];

export const CARD: Record<string, CardDef> = Object.fromEntries(CARDS.map((c) => [c.id, c]));
export const card = (id: string) => CARD[id];
export const SHOP_POOL = CARDS.filter((c) => !c.token && !c.enemy);

/** 召唤物预览：战斗里实际召唤什么（说明框小卡也用它）。随机单位只给阶层 */
export interface SummonInfo { def?: string; tier?: Tier; lvl: 1 | 2 | 3; atk: number; hp: number; count: number }
export function summonInfo(d: CardDef, lvl: 1 | 2 | 3, atk = d.atk, bank = 0): SummonInfo | null {
  if (!d.sum) return null;
  const v = d.v ? d.v[lvl - 1] : 0;
  switch (d.ab) {
    case 'egg': return { def: 't_drakelet', lvl: 1, atk: Math.min(50, 1 + bank), hp: Math.min(50, 1 + bank), count: 1 };
    case 'spider': return { tier: 3, lvl, atk: 2, hp: 2, count: 1 };
    case 'eagle': return { tier: 6, lvl, atk: 0, hp: 0, count: 1 };
    case 'sheep': return { def: 't_wolf', lvl: 1, atk: v, hp: v, count: 2 };
    case 'rooster': return { def: 't_wolf', lvl: 1, atk: Math.max(1, Math.floor(atk / 2)), hp: 1, count: v };
    default: return { def: d.sum as string, lvl: 1, atk: v, hp: v, count: 1 };
  }
}

// ── 补给 ──
/** 装备 id（v0.6：装备只从精英战的装备箱获得，补给不再给装备） */
export type Ench = string;
/** 补给的本场效果（只管下一场战斗，打完就散） */
export type FoodFx = 'bomb' | 'berry' | 'bone' | 'plate' | 'splash' | 'fury' | 'undy' | 'thunder';
export interface FoodDef {
  id: string; name: string; tier: Tier; text: string; icon: string; ench?: Ench;
  /** 攻血效果（n 个随机友军，99 为全队；tmp 为只在下一场有效） */
  atk?: number; hp?: number; n?: number; tmp?: boolean;
  /** 指定目标及紧邻身后的实际队列格，不跳过空位。 */
  behind?: boolean;
  /** 指定目标及实际前后相邻队列格，不跳过空位。 */
  around?: boolean;
  /** 本场特效 */
  fx?: FoodFx;
  /** 卡面短句（目标/攻血/时长已由 icon 行表达，这里只写额外效果） */
  short?: string;
  /** 价格，默认 3 */
  price?: number;
  /** 不进随机池（牛奶、旧版补给） */
  noPool?: boolean;
  /** 随机补给池的单件相对权重；省略为 1，不随阶级额外放大。 */
  rollWeight?: number;
}
export const ALL = 99;
/** 本场特效 → 来源补给 */
export const fxFood = (fx: FoodFx) => FOODS.find((f) => f.fx === fx)!;
export const FOODS: FoodDef[] = [
  { id: 'f_bread', name: '面包', tier: 1, text: '一个友军永久 +1/+1', icon: 'bread', atk: 1, hp: 1 },
  { id: 'f_lamp', name: '魂灯', tier: 1, text: '一个友军本场获得「复生」', icon: 'lamp', tmp: true, rollWeight: 0.5, short: '获得「复生」' },
  { id: 'f_bomb', name: '火药包', tier: 1, text: '一个友军本场「开战时」：敌方队首受 3 伤害', icon: 'bomb', tmp: true, fx: 'bomb', short: '开战时：敌方队首受 3 伤害' },
  { id: 'f_drum', name: '战鼓', tier: 2, text: '一个友军本场 +3/+3', icon: 'drum', atk: 3, hp: 3, tmp: true },
  { id: 'f_berry', name: '刺莓', tier: 2, text: '一个友军本场 +0/+4，「开战时」自己受 1 伤害', icon: 'berry', hp: 4, tmp: true, fx: 'berry', short: '开战时：自己受 1 伤害' },
  { id: 'f_bone', name: '骨汤', tier: 2, text: '一个友军本场「阵亡时」：召唤 3/3 骷髅', icon: 'bone', tmp: true, fx: 'bone', short: '阵亡时：召唤 3/3 骷髅' },
  { id: 'f_stew', name: '炖锅', tier: 3, text: '指定友军及其紧邻身后友军各永久 +1/+1', icon: 'stew', atk: 1, hp: 1, behind: true },
  { id: 'f_whet', name: '磨刀石', tier: 3, text: '一个友军永久 +2/+1', icon: 'whet', atk: 2, hp: 1 },
  { id: 'f_plate', name: '铁甲片', tier: 3, text: '一个友军本场「开战时」+2「格挡」', icon: 'plate', tmp: true, fx: 'plate', short: '开战时：+2「格挡」' },
  { id: 'f_elixir', name: '秘药', tier: 4, text: '一个友军多叠 1 份，凑够就升星', icon: 'elixir', short: '多叠 1 份，凑够就升星' },
  { id: 'f_sushi', name: '寿司', tier: 4, text: '指定友军及其实际前后相邻友军各永久 +1/+1', icon: 'sushi', atk: 1, hp: 1, around: true },
  { id: 'f_oil', name: '火油', tier: 4, text: '一个友军本场获得「溅射」', icon: 'oil', tmp: true, fx: 'splash', rollWeight: 0.5, short: '获得「溅射」' },
  { id: 'f_fury', name: '战意药水', tier: 4, text: '一个友军本场获得「战意」', icon: 'fury', tmp: true, fx: 'fury', short: '获得「战意」' },
  { id: 'f_roast', name: '烤全羊', tier: 5, text: '一个友军永久 +3/+3', icon: 'roast', atk: 3, hp: 3 },
  { id: 'f_horn', name: '集结号', tier: 5, text: '全队本场 +2/+2', icon: 'horn', atk: 2, hp: 2, n: ALL, tmp: true },
  { id: 'f_undy', name: '不屈药剂', tier: 5, text: '一个友军本场获得「不屈」', icon: 'undy', tmp: true, fx: 'undy', rollWeight: 0.5, short: '获得「不屈」' },
  { id: 'f_can', name: '罐头', tier: 6, text: '之后每买 1 份单位（含合并）额外 +1/+1，可叠加', icon: 'can', short: '之后每买 1 份单位额外 +1/+1，可叠加' },
  { id: 'f_dragon', name: '龙肉', tier: 6, text: '指定友军及其紧邻身后友军各永久 +2/+2', icon: 'dragon', atk: 2, hp: 2, behind: true },
  { id: 'f_thunder', name: '雷霆瓶', tier: 6, text: '一个友军本场「开战时」：所有敌人受 2 伤害', icon: 'thunder', tmp: true, fx: 'thunder', short: '开战时：所有敌人受 2 伤害' },
  { id: 'f_milk', name: '牛奶', tier: 1, text: '免费！一个友军永久 +{a}/+{h}', icon: 'milk', price: 0, noPool: true, short: '免费！' },
];
/** 补给文案（牛奶带货架上的数值） */
export const foodText = (id: string, val?: [number, number]) =>
  FOOD[id].text.replace('+{a}/+{h}', val ? `+${val[0]}/+${val[1]}` : '攻血');
export const FOOD: Record<string, FoodDef> = Object.fromEntries(FOODS.map((f) => [f.id, f]));
export const FOOD_POOL = FOODS.filter((f) => !f.noPool);

// ── 词条原子库（装备 / 精英词缀共用，全部带上限） ──
export type Atom = 'exec' | 'reap' | 'undying' | 'pierce' | 'shield' | 'burn' | 'fury' | 'charge';
export const ATOMS: Atom[] = ['exec', 'reap', 'undying', 'pierce', 'shield', 'burn', 'fury', 'charge'];
export const ATOM_INFO: Record<Atom, { name: string; desc: string; icon: string }> = {
  exec: { name: '斩杀', desc: '对半血以下的敌人伤害 ×1.5。', icon: 'eq_hammer' },
  reap: { name: '收割', desc: '击杀敌人时回复 25% 最大血（每场 3 次）。', icon: 'sp_soul' },
  undying: { name: '不屈', desc: '致命伤时锁住 1 血，两次交锋结算后倒下（触发当次计入）；期间不回血、不触发受伤，每场 1 次。', icon: 'eq_banner' },
  pierce: { name: '穿透', desc: '交锋击杀时，溢出的伤害打身后下一个敌人。', icon: 'eq_bow' },
  shield: { name: '护盾', desc: '开战时获得 20% 最大血的护盾，先于血量扣除。', icon: 'sp_shield' },
  burn: { name: '灼烧', desc: '交锋打中的敌人叠 1 层灼烧（最多 3 层），每次交锋后每层扣 2 血，无视格挡。', icon: 'sp_firerain' },
  fury: { name: '战意', desc: '每次交锋后本场 +1 攻（最多 +5）。', icon: 'sp_warsong' },
  charge: { name: '冲锋', desc: '第一次交锋伤害 ×2。', icon: 'eq_boots' },
};

/** 装备：q 0 白 / 1 蓝 / 2 紫 / 3 橙。sp 为破格或诅咒的专属规则 */
export type Quality = 0 | 1 | 2 | 3;
export type EquipSp = 'crown' | 'spear' | 'grail' | 'storm' | 'blood' | 'rage' | 'thorn';
export interface EquipDef {
  id: string; name: string; q: Quality; icon: string; text: string;
  atk?: number; hp?: number; atoms?: Atom[]; block?: number; melee?: number; splash?: number; reborn?: boolean; sp?: EquipSp;
  curse?: boolean;
  /** 只从补给获得，不进装备箱 */
  food?: boolean;
}
const E = (id: string, name: string, q: Quality, icon: string, text: string, o: Partial<EquipDef> = {}): EquipDef => ({ id, name, q, icon, text, ...o });
export const EQUIPS: EquipDef[] = [
  // 白：纯数值
  E('w_sword', '铁剑', 0, 'eq_duel', '+3 攻', { atk: 3 }),
  E('w_mail', '锁子甲', 0, 'eq_belt', '+5 血', { hp: 5 }),
  E('w_helm', '铁盔', 0, 'eq_guard', '+2/+3', { atk: 2, hp: 3 }),
  E('iron', '铁护腕', 0, 'eq_bracer', '开战时 +1 格挡', { block: 1 }),
  E('wine', '重拳护手', 1, 'eq_gauntlet', '交锋伤害 +5', { melee: 5 }),
  // 蓝：单词条
  E('chili', '横扫巨斧', 1, 'eq_cleave', '溅射 50%', { splash: 50 }),
  E('amulet', '冰晶护符', 1, 'eq_ice', '开战时 +3 格挡', { block: 3 }),
  E('shroom', '复生圣符', 1, 'eq_ankh', '复生', { reborn: true }),
  E('b_axe', '处刑斧', 1, 'eq_hammer', '斩杀', { atoms: ['exec'] }),
  E('b_scythe', '收割镰', 1, 'sp_soul', '收割', { atoms: ['reap'] }),
  E('b_banner', '残旗', 1, 'eq_banner', '不屈', { atoms: ['undying'] }),
  E('b_lance', '骑枪', 1, 'eq_bow', '穿透', { atoms: ['pierce'] }),
  E('b_buckler', '圆盾', 1, 'sp_shield', '护盾', { atoms: ['shield'] }),
  E('b_torch', '火把', 1, 'sp_firerain', '灼烧', { atoms: ['burn'] }),
  E('b_horn', '战号', 1, 'sp_warsong', '战意', { atoms: ['fury'] }),
  E('b_spur', '马刺', 1, 'eq_boots', '冲锋', { atoms: ['charge'] }),
  // 紫：词条联动 / 诅咒
  E('p_reaver', '噬魂刃', 2, 'sp_sunder', '斩杀 + 收割', { atoms: ['exec', 'reap'] }),
  E('p_phoenix', '凤羽', 2, 'sp_revive', '复生 + 护盾', { atoms: ['shield'], reborn: true }),
  E('p_inferno', '熔岩锤', 2, 'eq_flame', '灼烧 + 溅射 50%', { atoms: ['burn'], splash: 50 }),
  E('p_berserk', '狂战面具', 2, 'sp_haste', '战意 + 冲锋', { atoms: ['fury', 'charge'] }),
  E('p_bulwark', '不动壁垒', 2, 'sp_anchor', '不屈 + 开战时 +2 格挡', { atoms: ['undying'], block: 2 }),
  E('p_thorn', '荆棘甲', 2, 'eq_thorn', '+4 血；受到敌人伤害时，反打 3', { hp: 4, sp: 'thorn' }),
  E('c_blood', '饮血剑', 2, 'eq_combo', '+6 攻；开战时自己受 3 伤害', { atk: 6, sp: 'blood', curse: true }),
  E('c_rage', '狂怒之心', 2, 'eq_tome', '交锋伤害 ×2；最大血减半', { sp: 'rage', curse: true }),
  // 橙：破格（每局自然掉落最多 1 件）
  E('o_crown', '冥魂王冠', 3, 'eq_halo', '阵亡技能额外触发 1 次', { sp: 'crown' }),
  E('o_spear', '贯日之枪', 3, 'eq_frost', '交锋伤害穿透全部敌人', { sp: 'spear' }),
  E('o_grail', '不灭圣杯', 3, 'sp_revive', '不屈每场 2 次；锁血期间照常触发受伤', { atoms: ['undying'], sp: 'grail' }),
  E('o_storm', '风暴之心', 3, 'eq_hourglass', '每次交锋后，所有敌人受 1 伤害', { sp: 'storm' }),
];
export const EQUIP: Record<string, EquipDef> = Object.fromEntries(EQUIPS.map((e) => [e.id, e]));
export const equipOf = (id: Ench | null | undefined) => (id ? EQUIP[id] ?? null : null);
export const Q_INFO: { name: string; color: string }[] = [
  { name: '普通', color: '#d8dde6' },
  { name: '精良', color: '#4fa8ff' },
  { name: '史诗', color: '#c27bff' },
  { name: '传说', color: '#ffa23a' },
];
/** 装备带来的攻血（诅咒：狂怒之心最大血减半） */
export function equipStats(id: Ench | null | undefined, atk: number, hp: number, cap = 50): [number, number] {
  const e = equipOf(id);
  if (!e) return [atk, hp];
  let a = atk + (e.atk ?? 0);
  let h = hp + (e.hp ?? 0);
  if (e.sp === 'rage') h = Math.ceil(h / 2);
  return [Math.max(1, Math.min(cap, a)), Math.max(1, Math.min(cap, h))];
}
/** 装备完整说明：词条一并展开 */
export function equipText(e: EquipDef) {
  const atoms = (e.atoms ?? []).map((a) => `${ATOM_INFO[a].name}：${ATOM_INFO[a].desc}`);
  return [e.text, ...atoms];
}

export const KW_INFO: Record<Kw, { name: string; desc: string; color: string }> = {
  block: { name: '格挡', desc: '每层完整挡住 1 次伤害。', color: '#ffd36b' },
  reborn: { name: '复生', desc: '第一次阵亡时，保留攻击、以 1 血原位复活（队伍满时失败）。', color: '#ffe9a0' },
  splash: { name: '溅射', desc: '交锋时，敌方第 2 位也受到一部分伤害。', color: '#ff8a3a' },
};

export const LINE_INFO: Record<Line, { name: string; color: string; desc: string }> = {
  death: { name: '阵亡召唤', color: '#b77bff', desc: '阵亡就召唤，召唤物再阵亡；「友军阵亡时」「友军被召唤时」吃收益。' },
  hurt: { name: '受伤', color: '#ffd36b', desc: '自伤或全场伤害启动，「受伤时」吃收益。格挡会挡掉受伤触发。' },
  start: { name: '开战', color: '#ff5f6d', desc: '开战直伤与连击，不靠队友，什么阵容都能塞一两张。' },
  food: { name: '补给', color: '#6fe6ff', desc: '买补给、吃补给，转成成长、加倍或分给队友。' },
  grow: { name: '养成', color: '#e9bd72', desc: '回合结束、买入、出售、升星时永久成长，越拖越强。' },
  any: { name: '通用', color: '#ff9a3d', desc: '不靠触发时机，或复制别人的技能，放进任何阵容。' },
  enemy: { name: '敌军', color: '#ff5a6a', desc: '' },
};
export const LINES: Line[] = ['death', 'hurt', 'start', 'food', 'grow', 'any'];
/** 卡是否带某个标签（主或副） */
export const hasTag = (d: CardDef, t: Line) => d.line === t || d.tag2 === t;

// ── Boss：固定机制阵容，数值按回合强度缩放 ──
export interface BossDef { key: string; name: string; desc: string; units: string[]; /** 固定星级（召唤类 Boss 的召唤物不随系数缩放，所以压星级） */ lvl?: 1 | 2 | 3 }
export const BOSSES: Record<'wall' | 'tide' | 'forge' | 'horde' | 'final', BossDef> = {
  wall: { key: 'wall', name: '铁壁', desc: '格挡拖住你，双刃督战的溅射扫后排', units: ['e_golem', 'e_twin', 'e_shield'] },
  tide: { key: 'tide', name: '亡潮', desc: '阵亡就召唤，杀不完', units: ['e_skel', 'e_revenant', 'e_lich', 'e_tomb'], lvl: 1 },
  forge: { key: 'forge', name: '熔炉', desc: '敌方的受伤流：战将打身后，越伤越强', units: ['e_warlord', 'e_frostq', 'e_thorn', 'e_nightk', 'e_thorn'] },
  horde: { key: 'horde', name: '兽潮', desc: '阵亡就召唤，巫兽给召唤物加攻血', units: ['m_kujata', 'm_rex', 'm_mankator', 'm_kujata', 'm_bloodcaller'], lvl: 1 },
  // 固定前后顺序：巨虫受伤后反哺前排，执政官紧贴晨光追加反击；尾部风暴收尾。
  final: { key: 'final', name: '伤痕王座', desc: '风刃引伤，巨虫强化全队，双重反击与风暴收尾', units: ['l_windblade', 'd_worm', 'l_warden', 'l_archon', 'l_storm'] },
};

// ── 遗物：Boss 胜后 3 选 1；只改写通用动作，不绑引擎 ──
export type RelicId = 'r_vanguard' | 'r_legacy' | 'r_share' | 'r_volley' | 'r_drums' | 'r_lone' | 'r_few' | 'r_rear' | 'r_heavy' | 'r_relay';
export interface RelicDef { id: RelicId; name: string; icon: string; text: string }
export const RELICS: RelicDef[] = [
  { id: 'r_vanguard', name: '先锋徽章', icon: 'shield', text: '每个友军第一次受伤后，获得 1 层格挡' },
  { id: 'r_legacy', name: '传承之剑', icon: 'tomb', text: '友军阵亡时，新的队首获得它一半的攻击，每次最多 +10 攻' },
  { id: 'r_share', name: '分享餐盘', icon: 'plate', text: '每回合第一份单体纯属性补给，同时喂给相邻友军；仅面包、磨刀石、烤全羊、牛奶、战鼓' },
  { id: 'r_volley', name: '齐射号角', icon: 'burst', text: '开战时，随机一个敌人受到等于我方人数 ×2 的伤害' },
  { id: 'r_drums', name: '战鼓', icon: 'bolt', text: '全队每累计受伤 5 次，全队本场 +1 攻（最多 3 次）' },
  { id: 'r_lone', name: '独狼披风', icon: 'star', text: '只剩 1 个友军时，它 +6/+6 并获得不屈；不增加已有不屈次数' },
  { id: 'r_few', name: '少即是多', icon: 'diamond', text: '上场不超过 3 人时，全员 +3/+3' },
  { id: 'r_rear', name: '后卫弩', icon: 'target', text: '每次交锋后，我方队尾射击敌方队尾，造成 2 伤害' },
  { id: 'r_heavy', name: '重装铠', icon: 'guard', text: '开战时队首血量 ×1.5（上限 50）；成功增血时其余友军攻击 -1' },
  { id: 'r_relay', name: '车轮战旗', icon: 'replay', text: '友军阵亡后，我方下一次交锋伤害 ×2' },
];
export const RELIC: Record<string, RelicDef> = Object.fromEntries(RELICS.map((x) => [x.id, x]));

// ── 事件：偶尔替代一次岔路 ──
export type EventId = 'camp' | 'smith' | 'morph' | 'merc' | 'chaos';
export const EVENT_INFO: Record<EventId, { name: string; icon: string; text: string }> = {
  camp: { name: '训练营', icon: 'sword', text: '教官愿意指点一下你的队伍。' },
  smith: { name: '铁匠', icon: 'spikes', text: '「升一星没问题，不过得拿另一个人来抵工钱。」' },
  morph: { name: '变形池', icon: 'wand', text: '池水能把一个单位变成同阶、同标签的另一张卡，星级和加成都保留。' },
  merc: { name: '雇佣兵', icon: 'crown', text: '一位高阶佣兵愿意免费跟你走 3 场。' },
  chaos: { name: '混沌契约', icon: 'skull', text: '签下契约：接下来 3 场敌人更强，熬过去换一件遗物。' },
};
