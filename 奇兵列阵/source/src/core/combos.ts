// 构筑方向示例：说明配合与站位，不代表指定卡必得、固定最优阵容或胜率排名。
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

/** Current direction examples, not guaranteed offers or a tested win-rate ranking. */
export const COMBOS: Combo[] = [
  { name: '轮换换防', faction: 'light', general: 'zilan', units: ['l_windblade', 'l_shield', 'd_hourglass', 'l_storm', 'l_caliber'],
    idea: '指定需要换防的友军。轮换与前排阵亡让新队首接棒，沙漏构装保护接棒者，剑圣和机兵兑现轮换。',
    roles: ['开场与接棒时本场加攻', '开场得盾，轮换后给新队首盾', '新队首回血并得格挡，每回合限一次', '友军接棒时本场加攻', '轮换后强化新队首'],
    extras: ['eq_boots', 'sp_shield', 'eq_banner'] },
  { name: '决斗点将', faction: 'shadow', general: 'reva', units: ['s_fox', 'n_gladiator', 's_backstab', 's_viper', 's_panda'],
    idea: '开战前交换敌人位置，安排决斗对位。灯笼狐削弱目标，背刺者与赤蛇追击，武尊兑现击败对手，后期可用宗主让获胜核心继续追击。紧邻目标前后的嘲讽可护卫。',
    roles: ['决斗命中后削攻', '可用净培养长期成长的决斗载体', '击败锁定目标后成长并追击', '锁定对手阵亡后追击', '友军赢得决斗后全队加攻'],
    extras: ['eq_duel', 'eq_combo', 'sp_warsong'] },
  { name: '沙兵接力', faction: 'desert', general: 'sajj', units: ['d_dune', 'd_keeper', 'd_goldob', 'd_howler', 'm_incubator'],
    idea: '培养亡语来源，方尖碑养相邻召唤者并将永久攻血投入的一半传给真正入场的后继。后期可用法老替方尖碑提高传承，主母增加亡语；满场折算仍只计算原始召唤身材。',
    roles: ['承接培养，亡语留下轮换沙兵', '嘲讽并有限保护真正新召唤物', '培养相邻召唤者，传承永久攻血投入', '亡语召唤两只沙狼', '强化新召唤物并让其当回合行动'],
    extras: ['eq_guard', 'eq_banner', 'sp_revive'] },
  { name: '千刃接力', faction: 'shadow', general: 'kaleos', units: ['n_bulwark', 's_dancer', 's_wind', 's_choreo', 's_master'],
    idea: '培养连击核心，让影舞追加普攻、导师积累成长。宗师将全队命中兑现为按核心攻击计算的群伤；厚甲关可用碎石兵替换导师，临战也可换传令并调到核心身前。',
    roles: ['护甲前排保护后续出手', '让最高攻击队友普攻追击', '承接培养与升星的连击核心', '结束备战培养相邻连击友军', '每六段普攻命中兑现一次群体爆发'],
    extras: ['eq_combo', 'eq_bow', 'sp_haste'] },
  { name: '冻结防线', faction: 'frost', general: 'reva', units: ['v_guard', 'v_chaser', 'v_conduit', 'v_keeper', 'v_drake'],
    idea: '培养寒意法强，寒潮在备战结束继续养相邻寒意法术单位。真实冻结后守望者保护队首，培养攻击的地龙追伤队尾；后期女皇扩散寒意、巨龙追加普攻，是否换掉已养地龙取决于配合。',
    roles: ['受击给攻击者寒意', '承接法强，持续给敌方队首寒意', '备战培养相邻寒意法术单位', '冻结后给队首格挡，每回合限一次', '冻结追伤叠加自身半攻，每回合两次'],
    extras: ['eq_ice', 'sp_freeze', 'sp_shield'] },
  { name: '法术养成', faction: 'abyss', general: 'kaleos', units: ['n_bulwark', 'd_pyro', 'a_chanter', 'a_solus', 'a_devour'],
    idea: '沙焰术士部署后再购买真正受法强增益的法师，永夜在结束备战时培养相邻法师。号令指定需要更多常规行动的输出，注意保护后排。',
    roles: ['护甲前排，可出售转交生命', '购买法术受益队友时永久加法强', '个人定时群体法伤', '开场增幅法术队，备战培养相邻法术受益者', '持续前排法术伤害'],
    extras: ['eq_tome', 'eq_belt', 'sp_purify'] },
  { name: '溅射破阵', faction: 'magma', general: 'kaleos', units: ['n_colossus', 'n_envoy', 'm_rager', 'n_breaker', 'l_priest'],
    idea: '从幼龙、巨蜥或碎石兵起步，培养溅射核心的攻击。传令放在核心身前，碎石削甲，牧师补续航；单个敌人没有溅射目标，需要保住普攻输出。',
    roles: ['兼顾承伤与第二目标伤害', '让身后核心立即完整行动', '攻击培养与战内增攻的溅射核心', '削护甲并补溅射', '法强投入转为实际治疗'],
    extras: ['eq_bow', 'eq_guard', 'sp_haste'] },
  { name: '灼烧续燃', faction: 'magma', general: 'kaleos', units: ['m_mender', 'm_shaman', 'm_bloodcaller', 'm_harvester', 'm_titan'],
    idea: '萨满用法强提高灼烧层数，巫兽延续尚未烧尽的火。熔甲分担前排压力，噬焰把燃烧中的阵亡变为后继；巨像提供群体点火，不是启动必需。',
    roles: ['承伤并给攻击者灼烧', '法强成长的持续点火核心', '交锋后给仍燃烧的敌人续层', '灼烧敌人阵亡后召唤火苗', '群体点火与溅射'],
    extras: ['eq_tome', 'sp_firerain', 'sp_shield'] },
  { name: '格挡反攻', faction: 'light', general: 'sajj', units: ['l_lion', 'd_obelisk', 'l_banner', 'l_priest', 'l_archon'],
    idea: '雄狮在队首消耗格挡长攻击，流沙方尖碑持续补盾，骑将放大消盾收益。培养生命让前排撑住；执政官可补全队复生，缺它时继续用治疗或防护。',
    roles: ['消耗格挡增长攻击的前排核心', '按节拍持续给队首格挡', '全队消盾时增加攻击', '受伤后实际治疗', '让全队获得一次复生机会'],
    extras: ['eq_guard', 'eq_banner', 'sp_shield'] },
  { name: '反击守线', faction: 'neutral', general: 'sajj', units: ['n_thorn', 'l_priest', 'n_gladiator', 'l_vigil', 'l_archon'],
    idea: '棘背兽放队首承受普攻，生命培养同时提高开场反击。牧师续航，角斗士承接攻击点处理施法敌人；反击需要真实受击，灼烧与法术不能靠反击解决。',
    roles: ['把最大生命投入转为开场反击', '培养法强以维持前排生命', '独立输出，补反击无法处理的敌人', '备战持续培养队首生命', '全队复生提供续战机会'],
    extras: ['eq_guard', 'eq_thorn', 'sp_shield'] },
  { name: '献祭转化', faction: 'abyss', general: 'sajj', units: ['a_void', 'a_reaper', 'a_jugg', 'a_matriarch', 'd_dune'],
    idea: '把带亡语或复生的祭品放队尾，虚空吞噬它的攻血并触发退场联动。没有虚空时，可让祭仪师紧贴祭品身后，把属性转交另一个输出核心；不要让两名祭司争同一祭品。',
    roles: ['吞噬合格队尾，承接攻击与生命', '友军阵亡转为前排伤害', '友军阵亡时增强全队攻击', '增加亡语的兑现次数', '牺牲本体后留下轮换沙兵'],
    extras: ['eq_guard', 'eq_banner', 'sp_revive'] },
];
