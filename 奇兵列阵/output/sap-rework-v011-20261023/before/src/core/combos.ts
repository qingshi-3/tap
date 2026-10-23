// 0.10 图鉴方向示例：四位当前主将与实际单位职责交叉；不代表合法获取或已收敛的强度。
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
    roles: ['接棒时临时加攻', '接棒时获得格挡', '新队首回血并得格挡，每回合限一次', '友军接棒时本场加攻', '轮换后强化新队首'],
    extras: ['eq_boots', 'sp_shield', 'eq_banner'] },
  { name: '决斗点将', faction: 'shadow', general: 'reva', units: ['s_fox', 'n_gladiator', 's_backstab', 's_viper', 's_panda'],
    idea: '开战前交换敌人位置，安排决斗对位。灯笼狐削弱目标，背刺者与赤蛇追击，武尊兑现击败对手。嘲讽仍优先拦截。',
    roles: ['决斗命中后削攻', '可用净培养长期成长的决斗载体', '击败锁定目标后成长并追击', '锁定对手阵亡后追击', '友军赢得决斗后全队加攻'],
    extras: ['eq_duel', 'eq_combo', 'sp_warsong'] },
  { name: '沙兵接力', faction: 'desert', general: 'sajj', units: ['d_dune', 'd_keeper', 'd_artificer', 'd_glass', 'm_incubator'],
    idea: '沙丘行者与学徒通过真实阵亡补出后继，遗迹守卫给新召唤物格挡。预备队与看守是后续支援，不把少放一人当作前提。',
    roles: ['亡语留下轮换沙兵', '嘲讽并有限保护真正新召唤物', '其他友军阵亡后有限补沙兵', '真实召唤后本场加攻', '强化新召唤物并让其当回合行动'],
    extras: ['eq_guard', 'eq_banner', 'sp_revive'] },
  { name: '多段号令', faction: 'shadow', general: 'kaleos', units: ['n_breaker', 's_wind', 's_dancer', 's_master', 'm_raptor'],
    idea: '指定攻击核心，让其前两回合获得额外完整行动。碎石兵拆甲，连击与追击增加普攻命中，宗师把每段命中兑现为队尾伤害。',
    roles: ['溅射并削减目标固有及获得护甲', '连击与自身升星成长', '让最高攻击队友普攻追击', '我方每段普攻命中后打敌方队尾', '连击后给目标灼烧'],
    extras: ['eq_combo', 'eq_bow', 'sp_haste'] },
  { name: '冻结防线', faction: 'frost', general: 'reva', units: ['v_guard', 'v_chaser', 'v_scout', 'v_keeper', 'v_drake'],
    idea: '按敌方攻击和行动顺序安排寒意投放。真实冻结后霜狼成长、守望者保护队首、地龙打队尾；敌方攻击高时未必能冻住。',
    roles: ['受击给攻击者寒意', '持续给敌方队首寒意', '真实冻结后本场加攻', '冻结后给队首格挡，每回合限一次', '冻结后对敌方队尾造成伤害'],
    extras: ['eq_ice', 'sp_freeze', 'sp_shield'] },
  { name: '法术养成', faction: 'abyss', general: 'kaleos', units: ['n_bulwark', 'd_pyro', 'a_chanter', 'a_solus', 'a_devour'],
    idea: '沙焰术士部署后再购买真正受法强增益的法师，永夜在结束备战时培养相邻法师。号令指定需要更多常规行动的输出，注意保护后排。',
    roles: ['护甲前排，可出售转交生命', '购买法术受益队友时永久加法强', '个人定时群体法伤', '备战结束培养相邻施法者的法强', '持续前排法术伤害'],
    extras: ['eq_tome', 'eq_belt', 'sp_purify'] },
];
