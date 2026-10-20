// 图鉴推荐阵容。强度用 scripts/combo-bench.ts 对照随机阵容校验，改动后重跑。
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
  { name: '不倒盾墙', faction: 'light', general: 'argeon', units: ['l_cliff', 'l_lion', 'l_banner', 'l_shield', 'l_sunriser'],
    idea: '格挡层层叠加：护卫在前面替队友挨打，雄狮把格挡变成伤害，格挡被打掉时骑将还会给攻击。',
    roles: ['护卫顶伤，挡下后自己叠格挡', '格挡越多打得越痛', '格挡被打掉时给攻击', '施法给队首格挡', '定期给血厚的格挡'],
    extras: ['sp_shield', 'eq_guard', 'eq_belt'] },
  { name: '生生不息', faction: 'light', general: 'argeon', units: ['l_knight', 'l_martyr', 'l_archon', 'l_mender', 'l_priest'],
    idea: '复生加治疗，每个单位都要被打倒两次，靠时间磨垮对手。',
    roles: ['复生，复活后带格挡', '复生，阵亡时给后面格挡', '开战全队复生', '全体回血', '给残血单位回血'],
    extras: ['eq_halo', 'sp_revive', 'eq_belt'] },
  { name: '连击刺杀', faction: 'shadow', general: 'kaleos', units: ['n_bulwark', 's_ninja', 's_choreo', 's_master', 's_dancer'],
    idea: '连击一次打两下，千刃宗师每段命中都补刀队尾，影舞者再让攻击最高的立即攻击一次。',
    roles: ['中立前排，护甲顶伤', '连击，击杀后立即攻击', '开战给相邻攻击最高的连击', '连击，每段命中打敌方队尾', '让攻击最高的友军立即攻击'],
    extras: ['eq_combo', 'sp_warsong', 'eq_bow'] },
  { name: '易伤处刑', faction: 'shadow', general: 'kaleos', units: ['n_thorn', 's_monk', 's_lord', 's_caster', 's_master'],
    idea: '四风术士挂易伤，武僧打易伤越打越强；宗主开战给千刃宗师狙击和连击，从后排收割。',
    roles: ['反击前排', '打易伤目标后自己加攻', '开战给攻击最高的狙击和连击', '施法点攻击最高的并挂 2 层易伤', '连击，每段命中打敌方队尾'],
    extras: ['eq_tome', 'eq_bow', 'sp_warsong'] },
  { name: '亡者献祭', faction: 'abyss', general: 'lilithe', units: ['a_seed', 'a_jugg', 'a_reaper', 'a_spine', 'n_ritualist'],
    idea: '祭仪师献祭身前的暗棘，触发复生与阵亡联动，再强化其余攻击最高的友军。',
    roles: ['阵亡原位召唤暗影', '反击，友军阵亡时反击变强', '友军阵亡时打敌方队首', '复生，复活时打队首', '献祭身前友军，给其余最高攻加攻击'],
    extras: ['eq_thorn', 'sp_revive', 'eq_belt'] },
  { name: '法强轰炸', faction: 'abyss', general: 'lilithe', units: ['a_matriarch', 'a_brood', 'a_cult', 'a_solus', 'a_engulf'],
    idea: '施法单位排在一起吃法强加成，每次施法后吟诵者再给法强，主母跟着补伤害。',
    roles: ['反击前排，友军施法后打队首', '相邻友军法强 +1', '施法打队首', '友军施法后法强 +1', '施法点生命最低的'],
    extras: ['eq_tome', 'eq_thorn', 'sp_warsong'] },
  { name: '烈焰灼烧', faction: 'magma', general: 'vulkan', units: ['m_hide', 'm_raptor', 'm_mender', 'm_bloodcaller', 'm_titan'],
    idea: '灼烧无视格挡和护甲，每拍结束扣血；熔岩巨像一次溅射点燃两个，熔血巫兽让灼烧越叠越多。',
    roles: ['受击加攻的前排', '连击，普攻后挂一次灼烧', '普攻挂灼烧', '每拍结束灼烧加层', '溅射 2，每拍首次命中挂大量灼烧'],
    extras: ['sp_firerain', 'eq_flame', 'eq_combo'] },
  { name: '溅射重锤', faction: 'magma', general: 'vulkan', units: ['m_hide', 'm_rex', 'm_mankator', 'm_vindicator', 'm_kujata'],
    idea: '溅射让每次普攻同时打到第二个敌人，对付人多的敌阵很有效。',
    roles: ['受击加攻的前排', '溅射 2', '开战全队溅射 1', '连击加溅射', '给攻击最高的溅射'],
    extras: ['eq_belt', 'eq_banner', 'sp_warsong'] },
  { name: '冰封控场', faction: 'frost', general: 'faie', units: ['v_keeper', 'v_wyvern', 'v_sentinel', 'v_mage', 'v_queen'],
    idea: '寒意攒够攻击值就冻结一次出手；执政官让冻结扩散寒意，白霜巨龙每拍吃一次冻结加攻并立即攻击。',
    roles: ['护甲前排，在队首时护甲更高', '敌人被冻结时加攻并立即攻击', '护甲，相邻施法后再加寒意', '冻敌方下一个出手者', '开战挂寒意，冻结时扩散寒意'],
    extras: ['sp_freeze', 'eq_frost', 'eq_tome'] },
  { name: '寒甲铁壁', faction: 'frost', general: 'faie', units: ['v_keeper', 'v_conduit', 'v_wall', 'v_shard', 'v_queen'],
    idea: '护甲每次受伤都减伤，引路者再给相邻护甲 +1；对付人多、单发低的敌阵很稳。',
    roles: ['护甲前排', '相邻友军护甲 +1', '护甲 1，血厚', '普攻挂寒意', '开战给敌方队首寒意'],
    extras: ['eq_ice', 'eq_belt', 'sp_freeze'] },
  { name: '易伤猎杀', faction: 'desert', general: 'zirix', units: ['d_keeper', 'd_onyx', 'd_dunecaster', 'd_howler', 'd_pharaoh'],
    idea: '守卫替友军挨打并挂易伤，沙嚎者施法补易伤，豹神让全队普攻多吃易伤；法老开战给全队加攻加血。',
    roles: ['护卫，替友军承伤时挂易伤', '让友军普攻多消耗易伤加伤', '施法给队首格挡', '施法给队首易伤', '开战全队加攻加血，护卫再给格挡'],
    extras: ['eq_belt', 'sp_warsong', 'eq_combo'] },
  { name: '护卫王庭', faction: 'desert', general: 'zirix', units: ['d_sentry', 'd_keeper', 'd_pharaoh', 'd_dunecaster', 'd_artificer'],
    idea: '多个护卫轮流替队友挨打，法老给全队加身材，带护卫的还额外拿格挡。',
    roles: ['护卫，开战带格挡', '护卫，承伤时挂易伤', '开战全队 +1/+1', '施法给队首格挡', '施法给队首加身材'],
    extras: ['eq_guard', 'sp_shield', 'eq_belt'] },
  { name: '佣兵团', faction: 'neutral', general: 'hank', units: ['n_bulwark', 'n_merc', 'n_envoy', 'n_breaker', 'n_marshal'],
    idea: '中立卡每局都能抽到，可以给任何阵营补位；传令使给最高攻友军增加本回合行动次数，赫克再令其立即攻击一次。',
    roles: ['护甲前排', '每次普攻后自己加攻', '最高攻的其他友军本回合行动次数 +1', '溅射', '开战给队首 +2/+2，首回合行动次数 +1'],
    extras: ['eq_belt', 'eq_banner', 'sp_haste'] },
];

