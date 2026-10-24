// 排队骑士 · 卡牌、补给与 Boss 数据。技能逻辑在 engine.ts（战斗内）与 run.ts（商店内）里按 ab 实现，这里只放数值与文案。

export type Kw = 'rotate' | 'block' | 'reborn' | 'splash';
export type Tier = 1 | 2 | 3 | 4 | 5 | 6;
export type V3 = [number, number, number];
/** 流派线：只用于图鉴筛选与立绘归属，没有羁绊规则 */
export type Line = 'rotate' | 'blade' | 'soul' | 'beast' | 'frost' | 'sand' | 'enemy';

export interface CardDef {
  id: string;
  name: string;
  tier: Tier;
  atk: number;
  hp: number;
  /** 天生词条（格挡是状态，不在这里） */
  kws: Kw[];
  /** 技能 id，engine / run 按它分派 */
  ab?: string;
  v?: V3;
  /** 第二组数值（次数等），文案里写 {u} */
  u?: V3;
  /** 卡面文案；{v} {u} 替换成当前星级数值 */
  text: string;
  line: Line;
  /** 永久成长卡（卡面标「永」） */
  perm?: boolean;
  token?: boolean;
  enemy?: boolean;
}

const C = (id: string, name: string, tier: Tier, atk: number, hp: number, line: Line, text: string, o: Partial<CardDef> = {}): CardDef =>
  ({ id, name, tier, atk, hp, line, text, kws: [], ...o });

export const CARDS: CardDef[] = [
  // ── 1 阶 ──
  C('l_shield', '银盾侍卫', 1, 1, 4, 'rotate', '', { kws: ['rotate'] }),
  C('l_windblade', '风刃剑士', 1, 2, 2, 'rotate', '友军退后时：自己 +{v} 攻', { ab: 'wind', v: [1, 2, 3] }),
  C('s_dart', '飞镖手', 1, 2, 1, 'blade', '身前友军受伤时：打敌方队首 {v}', { ab: 'dart', v: [1, 2, 3] }),
  C('s_fox', '灯笼狐', 1, 1, 3, 'blade', '开战时：随机打一个敌人 {v}', { ab: 'fox', v: [1, 2, 3] }),
  C('a_imp', '残魂小鬼', 1, 1, 2, 'soul', '阵亡时：原位召唤 {v}/{v} 魂火', { ab: 'imp', v: [1, 2, 3] }),
  C('a_spine', '暗棘', 1, 2, 2, 'soul', '友军阵亡时：打敌方队首 {v}', { ab: 'spine', v: [1, 2, 3] }),
  C('m_egg', '幼兽蛋', 1, 1, 3, 'beast', '阵亡时：孵出 1/1 幼龙。回合结束时：蛋里的幼龙永久 +{v}/+{v}', { ab: 'egg', v: [1, 2, 3], perm: true }),
  C('m_whelp', '炽棘幼龙', 1, 2, 2, 'beast', '友军被召唤时：自己 +{v} 攻', { ab: 'whelp', v: [1, 2, 3] }),
  C('v_guard', '冰晶甲虫', 1, 1, 4, 'frost', '开战时：自己 +{v} 格挡', { ab: 'guard', v: [1, 2, 3] }),
  C('d_artificer', '构装学徒', 1, 2, 2, 'sand', '出售时：随机友军永久 +{v}/+{v}', { ab: 'artificer', v: [2, 3, 4], perm: true }),
  // ── 2 阶 ──
  C('l_vigil', '守誓者', 2, 2, 4, 'rotate', '退后时：自己 +{v} 格挡', { kws: ['rotate'], ab: 'vigil', v: [1, 1, 2] }),
  C('n_tether', '换位术士', 2, 2, 4, 'rotate', '交锋后：让活着的队首（自己以外）退后（每场 {v} 次）', { ab: 'tether', v: [2, 3, 4] }),
  C('s_step', '影步刺客', 2, 3, 3, 'blade', '上前时：打敌方第 2 位 {v}（没有则打队首）', { ab: 'step', v: [2, 4, 6] }),
  C('s_backstab', '背刺者', 2, 2, 4, 'blade', '回合结束时：身前友军永久 +{v} 攻', { ab: 'backstab', v: [2, 3, 4], perm: true }),
  C('a_graveguard', '墓园守卫', 2, 3, 2, 'soul', '', { kws: ['reborn'] }),
  C('a_reaper', '灵魂收割者', 2, 2, 4, 'soul', '友军阵亡时：自己 +{v}/+{v}', { ab: 'reaper', v: [1, 2, 3] }),
  C('m_raptor', '白鬃猎龙', 2, 3, 3, 'beast', '开战时：身后召唤 {v}/{v} 小兽', { ab: 'raptor', v: [1, 2, 3] }),
  C('v_snowman', '雪人', 2, 2, 4, 'frost', '开战时：身前友军 +{v} 格挡', { ab: 'snowman', v: [1, 2, 3] }),
  C('v_scout', '冰原霜狼', 2, 3, 3, 'frost', '开战时：敌方队首 -{v} 攻', { ab: 'scout', v: [1, 2, 3] }),
  C('d_dune', '沙丘行者', 2, 2, 4, 'sand', '回合开始时：+{v} 金', { ab: 'dune', v: [1, 2, 3] }),
  // ── 3 阶 ──
  C('l_warden', '晨光盾卫', 3, 3, 5, 'rotate', '回合结束时：所有轮换友军永久 +{v} 生命', { ab: 'warden', v: [2, 3, 4], perm: true }),
  C('n_medic', '战地医师', 3, 2, 6, 'rotate', '友军退后时：为它回复 {v}', { ab: 'medic', v: [2, 4, 6] }),
  C('s_dancer', '影舞者', 3, 3, 5, 'blade', '身前友军交锋时：自己也打敌方队首（{v}% 攻）', { ab: 'dancer', v: [50, 75, 100] }),
  C('s_ninja', '连环忍者', 3, 4, 4, 'blade', '回合结束时：若站在队尾，永久 +{v}/+{v}', { ab: 'ninja', v: [2, 3, 4], perm: true }),
  C('a_ritualist', '唤亡祭师', 3, 3, 5, 'soul', '友军阵亡时：队尾召唤 {v}/{v} 骷髅（每场 3 次）', { ab: 'ritualist', v: [2, 3, 4] }),
  C('m_incubator', '孵化看守', 3, 2, 6, 'beast', '友军被召唤时：它 +{v}/+{v}', { ab: 'incubator', v: [1, 2, 3] }),
  C('m_kujata', '驮岩兽', 3, 3, 5, 'beast', '受伤时：队尾召唤 {v}/{v} 小兽（每场 {u} 次）', { ab: 'kujata', v: [1, 2, 3], u: [3, 4, 5] }),
  C('v_mage', '冰霜法师', 3, 3, 5, 'frost', '回合结束时：队首友军永久 +{v} 生命', { ab: 'mage', v: [2, 4, 6], perm: true }),
  C('d_howler', '沙嚎者', 3, 3, 5, 'sand', '回合结束时：身前 2 个友军永久 +{v}/+{v}', { ab: 'howler', v: [1, 2, 3], perm: true }),
  C('d_keeper', '遗迹守卫', 3, 2, 5, 'sand', '自己升星时：其他友军永久 +3/+3，升到 3 星时 +5/+5', { ab: 'keeper', v: [0, 3, 5], perm: true }),
  // ── 4 阶 ──
  C('l_caliber', '圣铸机兵', 4, 4, 6, 'rotate', '友军上前时：它 +{v}/+{v}', { ab: 'caliber', v: [2, 3, 4] }),
  C('l_knight', '晨曦骑士', 4, 5, 5, 'rotate', '上前时：自己 +{v} 攻', { kws: ['rotate'], ab: 'knight', v: [2, 4, 6] }),
  C('s_hunter', '暗隙猎手', 4, 5, 5, 'blade', '开战时：打敌方血最高的单位 {v}（★3 打 2 次）', { ab: 'hunter', v: [4, 6, 8] }),
  C('a_chanter', '魂缚吟者', 4, 3, 6, 'soul', '开战时：身后 {v} 个友军获得复生', { ab: 'chanter', v: [1, 2, 3] }),
  C('a_cult', '献祭术士', 4, 4, 5, 'soul', '阵亡时：攻血的 {v}% 交给身后友军', { ab: 'cult', v: [50, 75, 100] }),
  C('m_rex', '熔岩巨蜥', 4, 4, 6, 'beast', '开战时：身后召唤 {v}/{v} 熔岩小蜥', { ab: 'rex', v: [3, 6, 9] }),
  C('v_keeper', '寒冬守望者', 4, 3, 7, 'frost', '交锋后：队首 +1 格挡（每场 {v} 次）', { ab: 'wkeeper', v: [2, 3, 4] }),
  C('v_sentinel', '冰角战兽', 4, 4, 6, 'frost', '有格挡时：交锋伤害 +{v}', { ab: 'sentinel', v: [3, 5, 7] }),
  C('d_dunecaster', '沙灵塑师', 4, 3, 6, 'sand', '友军被出售时：自己永久 +{v}/+{v}', { ab: 'dunecaster', v: [2, 3, 4], perm: true }),
  C('d_hourglass', '沙漏构装', 4, 4, 5, 'sand', '每回合前 {v} 次刷新：随机友军永久 +1/+1', { ab: 'hourglass', v: [2, 3, 4], perm: true }),
  // ── 5 阶 ──
  C('l_storm', '风暴剑圣', 5, 5, 7, 'rotate', '友军退后时：打敌方队首 {v}（★3 连第 2 位）', { ab: 'storm', v: [2, 4, 6] }),
  C('s_viper', '赤蛇刺客', 5, 5, 6, 'blade', '友军技能伤害 +{v}', { ab: 'viper', v: [1, 2, 3] }),
  C('s_master', '千刃宗师', 5, 5, 6, 'blade', '开战时：每个后排单位（含自己）打随机敌人 {v}', { ab: 'master', v: [2, 3, 4] }),
  C('a_engulf', '吞噬之影', 5, 5, 6, 'soul', '敌方阵亡时：自己永久 +{v}/+{v}（每场 3 次）', { ab: 'engulf', v: [1, 2, 3], perm: true }),
  C('m_bloodcaller', '熔血巫兽', 5, 4, 7, 'beast', '友军被召唤时：它获得自己攻血的 {v}%', { ab: 'bloodcaller', v: [25, 50, 75] }),
  C('m_mankator', '炎鬃战兽', 5, 6, 6, 'beast', '溅射 {v}%', { kws: ['splash'], v: [50, 75, 100] }),
  C('v_bear', '冰河巨熊', 5, 5, 8, 'frost', '我方格挡挡住伤害时：自己 +{v}/+{v}', { ab: 'bear', v: [1, 2, 3] }),
  C('v_rhyno', '冰原巨犀', 5, 6, 6, 'frost', '交锋击杀队首时：打新队首 {v}', { ab: 'rhyno', v: [3, 6, 9] }),
  C('d_goldob', '金焰方尖碑', 5, 3, 8, 'sand', '回合结束时：花光余金，每 1 金让随机友军永久 +{v}/+{v}', { ab: 'goldob', v: [1, 1, 2], perm: true }),
  C('d_pharaoh', '沙域法老', 5, 5, 7, 'sand', '攻血类补给的效果 +{v}%（不叠加）', { ab: 'pharaoh', v: [50, 100, 150] }),
  // ── 6 阶 ──
  C('l_archon', '曙光执政官', 6, 6, 8, 'rotate', '友军的上前时、退后时技能额外结算 {v} 次（最多 2 次）', { ab: 'archon', v: [1, 1, 2] }),
  C('s_lord', '岚影宗主', 6, 6, 8, 'blade', '每次交锋：所有后排友军也打敌方队首（各自 {v}% 攻）', { ab: 'lord', v: [25, 50, 75] }),
  C('a_matriarch', '深渊主母', 6, 7, 7, 'soul', '友军阵亡时：队尾召唤阵亡友军的 1/1 复制品（每场 {v} 次）', { ab: 'matriarch', v: [1, 2, 3] }),
  C('a_nightmare', '夜魇', 6, 8, 5, 'soul', '阵亡时：敌方全体受到 {v} 伤害', { ab: 'nightmare', v: [4, 8, 12] }),
  C('m_titan', '熔岩巨像', 6, 7, 8, 'beast', '阵亡时：召唤 3 块 {v}/{v} 熔岩碎片', { ab: 'titan', v: [3, 6, 9] }),
  C('m_heart', '火山之心', 6, 6, 8, 'beast', '召唤物出现时：它 +{v}/+{v} 并获得溅射 50%', { ab: 'heart', v: [3, 5, 7] }),
  C('v_queen', '霜冠执政官', 6, 6, 9, 'frost', '开战时：全队 +{v} 格挡。我方格挡挡住伤害时：打敌方队首 {u}', { ab: 'queen', v: [1, 1, 2], u: [2, 4, 6] }),
  C('v_wyvern', '白霜巨龙', 6, 7, 8, 'frost', '开战时：敌方全体 -{v} 攻', { ab: 'wyvern', v: [2, 3, 4] }),
  C('d_onyx', '黑曜豹神', 6, 6, 8, 'sand', '回合结束时：全队永久 +{v}/+{v}', { ab: 'onyx', v: [1, 2, 3], perm: true }),
  C('d_worm', '黑沙巨虫', 6, 7, 7, 'sand', '出售时：攻血的 {v}% 永久平分给全队', { ab: 'worm', v: [50, 75, 100], perm: true }),
  // ── 召唤物 ──
  C('t_wisp', '魂火', 1, 1, 1, 'soul', '', { token: true }),
  C('t_bonelet', '骷髅', 1, 2, 2, 'soul', '', { token: true }),
  C('t_drakelet', '幼龙', 1, 1, 1, 'beast', '', { token: true }),
  C('t_wolf', '小兽', 1, 1, 1, 'beast', '', { token: true }),
  C('t_flame', '熔岩小蜥', 1, 3, 3, 'beast', '', { token: true }),
  C('t_statue', '熔岩碎片', 1, 3, 3, 'beast', '', { token: true }),
  // ── Boss 专用（数值是形状，实际按回合强度缩放） ──
  C('e_shield', '钢铁傀儡', 2, 2, 9, 'enemy', '开战时：自己 +{v} 格挡', { enemy: true, ab: 'guard', v: [2, 3, 4] }),
  C('e_guardian', '持盾宗师', 2, 3, 7, 'enemy', '退后时：自己 +{v} 格挡', { enemy: true, kws: ['rotate'], ab: 'vigil', v: [1, 1, 2] }),
  C('e_golem', '沙岩傀儡', 1, 2, 10, 'enemy', '交锋后：队首 +1 格挡（每场 {v} 次）', { enemy: true, ab: 'wkeeper', v: [2, 3, 4] }),
  C('e_skel', '白骨兵', 1, 2, 3, 'enemy', '阵亡时：原位召唤 {v}/{v} 骷髅', { enemy: true, ab: 'imp', v: [2, 3, 4] }),
  C('e_tomb', '墓穴看守', 3, 3, 7, 'enemy', '友军阵亡时：队尾召唤 {v}/{v} 骷髅（每场 3 次）', { enemy: true, ab: 'ritualist', v: [3, 4, 5] }),
  C('e_lich', '白骨收割者', 3, 4, 7, 'enemy', '友军阵亡时：自己 +{v}/+{v}', { enemy: true, ab: 'reaper', v: [2, 3, 4] }),
  C('e_revenant', '复仇亡魂', 2, 4, 4, 'enemy', '', { enemy: true, kws: ['reborn'] }),
  C('e_thorn', '沼泽兽', 2, 3, 7, 'enemy', '', { enemy: true, kws: ['rotate'] }),
  C('e_warlord', '誓仇战将', 3, 5, 7, 'enemy', '友军退后时：自己 +{v} 攻', { enemy: true, ab: 'wind', v: [2, 3, 4] }),
  C('e_nightk', '夜誓骑士', 3, 4, 8, 'enemy', '友军上前时：它 +{v}/+{v}', { enemy: true, ab: 'caliber', v: [2, 3, 4] }),
  C('e_frostq', '霜之女王', 3, 3, 8, 'enemy', '友军退后时：为它回复 {v}', { enemy: true, ab: 'medic', v: [3, 5, 7] }),
  C('e_twin', '双刃督战', 3, 5, 6, 'enemy', '溅射 {v}%', { enemy: true, kws: ['splash'], v: [50, 75, 100] }),
  C('e_pyre', '焚身者', 3, 6, 4, 'enemy', '阵亡时：敌方全体受到 {v} 伤害', { enemy: true, ab: 'nightmare', v: [3, 5, 7] }),
  C('e_void', '暗影领主', 4, 6, 12, 'enemy', '敌方阵亡时：自己 +{v}/+{v}（每场 3 次）', { enemy: true, ab: 'engulf', v: [2, 3, 4] }),
];

export const CARD: Record<string, CardDef> = Object.fromEntries(CARDS.map((c) => [c.id, c]));
export const card = (id: string) => CARD[id];
export const SHOP_POOL = CARDS.filter((c) => !c.token && !c.enemy);

// ── 补给 ──
export type Ench = 'rotate' | 'iron' | 'chili' | 'amulet' | 'shroom' | 'wine';
export interface FoodDef { id: string; name: string; tier: Tier; text: string; icon: string; ench?: Ench }
export const FOODS: FoodDef[] = [
  { id: 'f_bread', name: '面包', tier: 1, text: '永久 +1/+1', icon: 'bread' },
  { id: 'f_lamp', name: '魂灯', tier: 1, text: '下一场获得复生', icon: 'lamp' },
  { id: 'f_drum', name: '战鼓', tier: 2, text: '下一场 +3/+3', icon: 'drum' },
  { id: 'f_scroll', name: '换位卷轴', tier: 2, text: '附魔：轮换', icon: 'scroll', ench: 'rotate' },
  { id: 'f_stew', name: '炖锅', tier: 3, text: '随机 2 个友军永久 +2/+2', icon: 'stew' },
  { id: 'f_iron', name: '寒铁', tier: 3, text: '附魔：开战时 +1 格挡', icon: 'iron', ench: 'iron' },
  { id: 'f_whet', name: '磨刀石', tier: 3, text: '永久 +3/+1', icon: 'whet' },
  { id: 'f_chili', name: '辣椒', tier: 4, text: '附魔：溅射 50%', icon: 'chili', ench: 'chili' },
  { id: 'f_elixir', name: '秘药', tier: 4, text: '叠加 1 份（可升星）', icon: 'elixir' },
  { id: 'f_sushi', name: '寿司', tier: 4, text: '随机 3 个友军永久 +2/+2', icon: 'sushi' },
  { id: 'f_amulet', name: '冰晶护符', tier: 5, text: '附魔：开战时 +3 格挡', icon: 'amulet', ench: 'amulet' },
  { id: 'f_shroom', name: '冥菇', tier: 5, text: '附魔：复生（每场生效）', icon: 'shroom', ench: 'shroom' },
  { id: 'f_roast', name: '烤全羊', tier: 5, text: '随机 2 个友军永久 +4/+4', icon: 'roast' },
  { id: 'f_wine', name: '战神酒', tier: 6, text: '附魔：交锋伤害 +5', icon: 'wine', ench: 'wine' },
  { id: 'f_can', name: '罐头', tier: 6, text: '之后买入的每份单位 +1/+1', icon: 'can' },
];
export const FOOD: Record<string, FoodDef> = Object.fromEntries(FOODS.map((f) => [f.id, f]));
export const ENCH_INFO: Record<Ench, { name: string; text: string }> = {
  rotate: { name: '轮换', text: '轮换' },
  iron: { name: '寒铁', text: '开战时 +1 格挡' },
  chili: { name: '辣椒', text: '溅射 50%' },
  amulet: { name: '冰晶护符', text: '开战时 +3 格挡' },
  shroom: { name: '冥菇', text: '复生' },
  wine: { name: '战神酒', text: '交锋伤害 +5' },
};

export const KW_INFO: Record<Kw, { name: string; desc: string; color: string }> = {
  rotate: { name: '轮换', desc: '交锋后还活着：退到队尾，身后的友军上前。', color: '#8feaff' },
  block: { name: '格挡', desc: '每层完整挡住 1 次伤害。', color: '#ffd36b' },
  reborn: { name: '复生', desc: '第一次阵亡时，保留攻击、以 1 血回到队尾（队伍满时失败）。', color: '#ffe9a0' },
  splash: { name: '溅射', desc: '交锋时，敌方第 2 位也受到一部分伤害。', color: '#ff8a3a' },
};

export const LINE_INFO: Record<Line, { name: string; color: string }> = {
  rotate: { name: '轮换', color: '#8feaff' },
  blade: { name: '影刃', color: '#c590ff' },
  soul: { name: '亡魂', color: '#ff6a7a' },
  beast: { name: '兽群', color: '#ff9a4a' },
  frost: { name: '霜甲', color: '#9ad8ff' },
  sand: { name: '沙铸', color: '#ffd36b' },
  enemy: { name: '敌军', color: '#ff5a6a' },
};

// ── Boss：固定机制阵容，数值按回合强度缩放 ──
export interface BossDef { key: string; name: string; units: string[] }
export const BOSSES: Record<'wall' | 'tide' | 'wheel' | 'final', BossDef> = {
  wall: { key: 'wall', name: '铁壁', units: ['e_shield', 'e_guardian', 'e_golem', 'e_shield'] },
  tide: { key: 'tide', name: '亡潮', units: ['e_skel', 'e_revenant', 'e_lich', 'e_skel', 'e_tomb'] },
  wheel: { key: 'wheel', name: '车轮', units: ['e_guardian', 'e_thorn', 'e_warlord', 'e_frostq', 'e_nightk'] },
  final: { key: 'final', name: '暗影领主', units: ['e_shield', 'e_twin', 'e_void', 'e_pyre', 'e_tomb'] },
};
