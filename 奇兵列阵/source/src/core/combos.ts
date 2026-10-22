// 图鉴推荐阵容（v0.8 §8：主将与流派交叉）。强度用 scripts/combo-bench.ts 对照随机阵容校验，改动后重跑。
import type { Faction } from './types';

export interface Combo {
  name: string;
  faction: Faction;
  general: string;
  /** 1 号位 → 5 号位 */
  units: string[];
  idea: string;
  /** 每个号位一句话 */
  roles: string[];
  extras: string[];
}

export const COMBOS: Combo[] = [
  { name: '车轮战阵', faction: 'light', general: 'zilan', units: ['l_windblade', 'l_shield', 'l_archer', 'l_storm', 'l_caliber'],
    idea: '每回合全队转一格，成为队首的效果一回合触发两次；剑圣和机兵吃轮换广播越打越强。',
    roles: ['轮换，成为队首时加攻', '轮换，成为队首时叠格挡', '轮换，在队尾时打敌方队尾', '友军成为队首时自己加攻', '友军轮换时强化新队首'],
    extras: ['eq_boots', 'sp_shield', 'eq_banner'] },
  { name: '擂台点将', faction: 'shadow', general: 'reva', units: ['s_backstab', 's_xyle', 's_viper', 's_panda', 'n_gladiator'],
    idea: '开战前把敌方脆皮换到决斗对位上，每击败一个对手擂台就给全队叠攻击。',
    roles: ['决斗，击败对手时加攻', '决斗加连击，击败对手时成长', '决斗，对手阵亡时追击', '友军击败对手时全队加攻', '中立决斗手'],
    extras: ['eq_duel', 'eq_combo', 'sp_warsong'] },
  { name: '沙漏蓄势', faction: 'desert', general: 'sajj', units: ['d_keeper', 'd_hourglass', 'd_onyx', 'd_pyro', 'd_obelisk'],
    idea: '嘲讽在前面拖时间，预备位里的单位先把蓄力充满，补上场就放蓄力技。',
    roles: ['嘲讽，挨打时给相邻蓄力', '相邻友军蓄力更快', '蓄力满时大幅成长并追击', '蓄力技点杀生命最高的', '节拍召唤嘲讽沙像'],
    extras: ['eq_hourglass', 'eq_guard', 'eq_tome'] },
  { name: '魂潮献祭', faction: 'abyss', general: 'lilithe', units: ['a_graveguard', 'a_seed', 'a_jugg', 'a_matriarch', 'a_void'],
    idea: '嘲讽加献祭主动送死，主母让亡语触发两次，魂潮把每次阵亡都变成全队属性。',
    roles: ['嘲讽，亡语给身后复生', '亡语召唤暗影', '友军阵亡时全队加攻', '亡语触发两次', '每回合献祭队尾吸收属性'],
    extras: ['sp_soul', 'eq_guard', 'sp_revive'] },
  { name: '冰封坚守', faction: 'frost', general: 'faie', units: ['v_wall', 'v_snowman', 'v_rhyno', 'v_stag', 'd_keeper'],
    idea: '冰霜和沙域混搭坚守蓄力，冰封时刻让开局就能放蓄力技。',
    roles: ['嘲讽护甲前排', '蓄力技冻结敌方队首', '蓄力技双倍普攻并加护甲', '蓄力技全体寒意和格挡', '嘲讽，挨打时给相邻蓄力'],
    extras: ['eq_ice', 'eq_hourglass', 'sp_freeze'] },
  { name: '熔炉车轮', faction: 'magma', general: 'vulkan', units: ['l_windblade', 'v_keeper', 'm_heart', 'l_caliber', 'n_tether'],
    idea: '车轮战把自己吃的灼烧摊到每个人身上，敌方队首却一直在烧。',
    roles: ['轮换，成为队首时加攻', '护甲前排，在队首时更硬', '每次交锋双方队首各烧一层', '友军轮换时强化新队首', '施法把队首换到队尾'],
    extras: ['eq_flame', 'eq_boots', 'sp_firerain'] },
  { name: '破壳献礼', faction: 'abyss', general: 'kasiva', units: ['m_egg', 'd_goldob', 'm_incubator', 'd_pharaoh', 'd_glass'],
    idea: '开战献祭队尾的蛋直接拿到召唤物，孵化看守让召唤物当回合就能出手。',
    roles: ['破壳召唤幼兽', '节拍召唤沙灵', '召唤物加属性并立即行动', '全队和召唤物加属性', '友军召唤时自己加攻'],
    extras: ['sp_soul', 'eq_banner', 'eq_belt'] },
  { name: '千刃压轴', faction: 'shadow', general: 'kaleos', units: ['s_wind', 's_ninja', 's_dancer', 's_master', 'm_raptor'],
    idea: '千刃宗师放在队尾压轴，每回合额外追击加连击，每段命中都补刀敌方队尾。',
    roles: ['连击', '连击，击杀时追击', '让攻击最高的友军追击', '连击，每段命中打敌方队尾', '连击并点燃目标'],
    extras: ['eq_combo', 'eq_bow', 'sp_haste'] },
  { name: '棱镜杂烩', faction: 'frost', general: 'kara', units: ['v_wall', 'l_windblade', 's_xyle', 'd_pyro', 'm_raptor'],
    idea: '阵容不用成型，关键词越杂棱镜给的数值越多。',
    roles: ['嘲讽护甲', '轮换', '决斗加连击', '法强加蓄力', '连击加灼烧'],
    extras: ['eq_tome', 'eq_belt', 'sp_warsong'] },
  { name: '剑誓亲征', faction: 'light', general: 'argeon', units: ['x_argeon', 's_backstab', 's_monk', 's_choreo', 's_panda'],
    idea: '阿尔吉昂本人站在队首当决斗核心，导师给他连击，武尊把每次击败对手变成全队攻击。',
    roles: ['主将亲征，决斗核心', '决斗，击败对手时加攻', '决斗，打高攻对手加伤', '开战给相邻最高攻连击', '友军击败对手时全队加攻'],
    extras: ['eq_duel', 'eq_halo', 'sp_warsong'] },
];
