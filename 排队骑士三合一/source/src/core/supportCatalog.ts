// 支援目录直接使用经营与战斗规则。只从 data 导入类型，避免目录初始化环。
import type { ArchetypeId, BattleRule, CardRole, PrepRule, ReworkRule } from './archetypes';
import type { EquipDef, FoodDef, Quality, RelicDef, Tier } from './data';
import type { FoodResources } from './support';

export type SupportRelicId = 'r_relay_bell' | 'r_shot_chain' | 'r_ash_vow' | 'r_blood_pact' | 'r_tally_book'
  | 'r_nest_roll' | 'r_ink_well' | 'r_pair_pennant' | 'r_quarry_writ' | 'r_anchor_chain' | 'r_mess_bell';

function battle(on: BattleRule['on'], effect: BattleRule['effect'], target: BattleRule['target'], n: number,
  options: Pick<BattleRule, 'hp' | 'limit' | 'every' | 'when' | 'scale'> = {}): BattleRule {
  return { phase:'battle', on, effect, target, n, ...options };
}
function prep(on: PrepRule['on'], effect: PrepRule['effect'], target: PrepRule['target'], n: number, limit: number,
  options: Pick<PrepRule, 'at' | 'hp' | 'every' | 'when'> = {}): PrepRule {
  return { phase:'prep', on, effect, target, n, limit, ...options };
}

// {0}、{0hp}、{0limit} 等索引对应实际规则的数值，{charge} 等对应资源。
// 同一条规则的等级序列专供单位。支援道具采用固定数值，随道具记录。
function ruleText(template: string, rules: readonly ReworkRule[], resources: FoodResources = {}): string {
  return template.replace(/\{(\d+)(hp|limit|every|at)?\}|\{(charge|seal|block|wounds)\}/g, (_, index: string | undefined, field: string | undefined, resource: keyof FoodResources | undefined) => {
    const rule = index === undefined ? undefined : rules[Number(index)];
    const value = resource ? resources[resource]
      : field === 'at' ? (rule?.phase === 'prep' ? rule.at?.join('、') : undefined)
      : rule?.[(field ?? 'n') as 'n' | 'hp' | 'limit' | 'every'];
    if (typeof value !== 'number' && typeof value !== 'string') throw Error('支援文案缺少数值 ' + template);
    return String(value);
  });
}
function meal(id: string, name: string, tier: Tier, price: number, icon: string, archetypes: ArchetypeId[], role: CardRole,
  template: string, battleRules: BattleRule[] = [], resources?: FoodResources): FoodDef {
  const short = ruleText(template, battleRules, resources);
  return { id, name, tier, price, icon, archetypes, role, tmp:true, text:'下场战斗：' + short, short,
    battleRules:battleRules.length ? battleRules : undefined, resources };
}
function gear(id: string, name: string, q: Quality, icon: string, archetypes: ArchetypeId[], role: CardRole,
  template: string, ...rules: ReworkRule[]): EquipDef {
  return { id, name, q, icon, archetypes, role, text:ruleText(template, rules), rules };
}
function artifact(id: SupportRelicId, name: string, icon: string, archetypes: ArchetypeId[], role: CardRole,
  template: string, counterScope: 'team' | 'holder', ...rules: ReworkRule[]): RelicDef {
  const battleRules = rules.filter((r): r is BattleRule => r.phase === 'battle');
  const prepRules = rules.filter((r): r is PrepRule => r.phase === 'prep');
  return { id, name, icon, archetypes, role, text:ruleText(template, rules), counterScope, battleRules, prepRules };
}

const travelRuskHp = 2;
export const SUPPORT_FOODS: FoodDef[] = [
  meal('f_relay_ribbon','接力彩带',1,1,'rl_relay',['wheel'],'cover','轮转到队尾时，新队首获得{0}层格挡（限{0limit}次）。',
    [battle('move','block','front',1,{limit:1})]),
  meal('f_powder','预装弹包',1,2,'f_bomb',['charge'],'starter','开战时，获得{charge}点蓄能。需搭配释放蓄能技能。',[],{charge:2}),
  meal('f_heir_wax','守火蜡',2,2,'f_lamp',['ember'],'engine','获得传承时，额外+{0}/+{0hp}（限{0limit}次）。',
    [battle('inherited','buff','self',2,{hp:3,limit:1})]),
  meal('f_den_feed','幼兽饲粮',2,2,'f_bone',['nest'],'engine','召唤友方小兵时，它+{0}/+{0hp}（限{0limit}次）。',
    [battle('summon','buff','event',1,{hp:2,when:'token',limit:2})]),
  meal('f_red_bitters','苦胆酒',2,1,'f_berry',['blood'],'starter','初始生命-{wounds}（至少1血），获得{block}层格挡。',[],{wounds:3,block:1}),
  meal('f_tollcake','压箱金饼',3,2,'mint',['trade'],'terminal','首次成为队首时，每剩1金，对敌尾造成{0}伤害。',
    [battle('enter','damage','enemyLast',1,{scale:'gold',limit:1})]),
  meal('f_sigil_ink','蘸印墨',1,1,'eq_tome',['rune'],'starter','下次攻击后追加{seal}伤害。',[],{seal:3}),
  meal('f_twincake','对半饼',1,2,'f_sushi',['pair'],'starter','开战时，若与同名友军相邻，搭档获得{0}层格挡。',
    [battle('start','block','partner',1,{when:'paired',limit:1})]),
  meal('f_quarry_salt','寻踪香盐',1,2,'rl_rear',['hunt'],'starter','开战时，指定猎物获得{0}层猎标。',
    [battle('start','mark','quarry',1,{limit:1})]),
  meal('f_line_broth','列阵浓汤',2,2,'f_stew',['formation'],'cover','首次成为队首时，每保留一对原本前后紧邻的队友，自己+{0hp}生命。',
    [battle('enter','buff','self',0,{hp:2,scale:'edges',limit:1})]),
  { id:'f_travel_rusk', name:'行军干粮', tier:1, price:1, icon:'f_bread', archetypes:['supply'], role:'engine', atk:0, hp:travelRuskHp,
    inheritable:true, text:`一个友军永久+${travelRuskHp}生命。补给单位会记录，出售时传给队友。`, short:'出售补给单位时传承' },
  meal('f_spur_oats','换班燕麦',3,2,'eq_boots',['wheel','formation'],'bridge','首次攻击后退到队尾。',
    [battle('afterAttack','rotate','self',1,{limit:1})]),
  meal('f_siege_fuse','散弹引信',4,2,'f_thunder',['charge','hunt'],'bridge','释放蓄能后，对指定猎物追加{0}伤害（限{0limit}次）。',
    [battle('released','damage','quarry',3,{limit:2})]),
  meal('f_rally_seed','守巢种',5,3,'f_shroom',['nest','ember'],'bridge','阵亡时，在队首召唤{0}/{0hp}幼兽（限{0limit}次，需空位）。',
    [battle('faint','summon','front',4,{hp:4,limit:1})]),
  meal('f_reserve_wax','续契封蜡',6,3,'f_undy',['blood','rune'],'cover','受伤存活且半血及以下时，获得{0}层格挡（每场1次）。下次攻击后追加{seal}伤害。',
    [battle('hurt','block','self',1,{when:'half',limit:1})],{seal:4}),
];

export const SUPPORT_EQUIPS: EquipDef[] = [
  gear('e_field_cannon','行军臼炮',3,'eq_frost',[],'utility','在后排时，每次交锋后蓄能{0}（每场{0limit}次）。成为队首时，消耗全部蓄能，每点对敌尾造成{1}伤害。',
    battle('clashEnd','charge','self',1,{when:'rear',limit:4}),battle('enter','release','enemyLast',2)),
  gear('e_courier_spurs','折返马刺',1,'eq_boots',['wheel'],'engine','轮转到队尾时，本场+{0}/+{0hp}（每场{0limit}次）。',
    battle('move','buff','self',1,{hp:2,limit:3})),
  gear('e_race_standard','百里风旗',3,'eq_banner',['wheel'],'terminal','成为队首时，对敌尾造成{0}伤害，全队每转完一圈多{0}伤害（每场{0limit}次）。',
    battle('enter','damage','enemyLast',2,{scale:'laps',limit:4})),
  gear('e_chamber','回压弹膛',2,'eq_bow',['charge'],'engine','释放蓄能后，身后友军蓄能{0}（每场{0limit}次）。',
    battle('released','charge','behind',2,{limit:2})),
  gear('e_loader','递弹臂环',0,'eq_bracer',['charge','formation'],'bridge','在后排时，每次交锋后，身后友军蓄能{0}（每场{0limit}次）。',
    battle('clashEnd','charge','behind',1,{when:'rear',limit:3})),
  gear('e_ember_clasp','承火搭扣',1,'eq_halo',['ember'],'cover','获得传承时，获得{0}层格挡（每场{0limit}次）。',
    battle('inherited','block','self',1,{limit:1})),
  gear('e_testament','封存遗嘱',2,'eq_tome',['ember'],'engine','阵亡时，身后友军本场继承{0}%攻血及首个可传承的单位阵亡技能（每场{0limit}次）。',
    battle('faint','inherit','behind',30,{limit:1})),
  gear('e_hatch_basket','孵兽背篮',0,'eq_belt',['nest'],'starter','阵亡时，在队首召唤{0}/{0hp}幼兽（每场{0limit}次，需空位）。',
    battle('faint','summon','front',2,{hp:2,limit:1})),
  gear('e_den_plate','幼兽护面',2,'sp_shield',['nest'],'engine','召唤友方小兵时，它获得{0}层格挡（每场{0limit}次）。',
    battle('summon','block','event',1,{when:'token',limit:2})),
  gear('e_blood_blade','倒刺短刃',1,'sp_sunder',['blood'],'engine','受伤存活且半血及以下时，对敌首造成{0}伤害（每场{0limit}次）。',
    battle('hurt','damage','enemyFront',3,{when:'half',limit:2})),
  gear('e_till_chain','收银腰链',1,'eq_hourglass',['trade'],'engine','出售其他单位时，首击追加{0}伤害（每回合{0limit}次）。',
    prep('sell','seal','self',2,2,{when:'otherEvent'})),
  gear('e_sigil_quill','双声印笔',2,'eq_tome',['rune'],'engine','本回合第{0at}次施法，各使身后队友的首击追加{0}伤害。',
    prep('spell','seal','behind',3,2,{at:[2,4]})),
  gear('e_twin_knot','结对肩绳',0,'eq_gauntlet',['pair'],'starter','开战时，若与同名友军相邻，搭档本场+{0}/+{0hp}。',
    battle('start','buff','partner',2,{hp:2,when:'paired',limit:1})),
  gear('e_twin_blade','镜刃',3,'eq_duel',['pair'],'terminal','攻击后，若与同名友军仍相邻，搭档获得{0}层格挡；我对敌尾造成自身攻击{1}%的伤害（每项每场{0limit}次）。',
    battle('afterAttack','block','partner',1,{when:'paired',limit:2}),battle('afterAttack','damage','enemyLast',60,{when:'paired',scale:'attackPct',limit:2})),
  gear('e_hunting_scope','套索准星',1,'eq_bow',['hunt','charge'],'bridge','开战时，猎物获得{0}层猎标。释放蓄能后，猎物再获得{1}层猎标（每场{1limit}次）。',
    battle('start','mark','quarry',1,{limit:1}),battle('released','mark','quarry',1,{limit:2})),
  gear('e_quarry_hammer','收网重锤',2,'eq_hammer',['hunt'],'terminal','首次成为队首时，清除猎物全部猎标，每层造成{0}伤害。',
    battle('enter','detonate','quarry',3,{limit:1})),
  gear('e_line_guard','护邻肩甲',2,'eq_guard',['formation'],'cover','替相邻友军分担每次交锋至多{0}伤害（每场{0limit}次）。',
    battle('start','share','self',2,{limit:4})),
  gear('e_line_signet','方阵军印',3,'eq_halo',['formation'],'terminal','首次成为队首时，每保留一对原本前后紧邻的队友，身旁队友本场+{0}/+{0hp}。',
    battle('enter','buff','neighbors',2,{hp:2,scale:'edges',limit:1})),
  gear('e_mess_tin','野炊饭盒',0,'eq_belt',['supply'],'starter','本回合首次被喂食后，下场战斗获得{0}层格挡。',
    prep('food','block','self',1,1,{when:'selfEvent'})),
  gear('e_dining_bell','开饭铃',1,'sp_warsong',['supply'],'engine','其他友军被喂食后，永久+{0hp}生命（每回合{0limit}次）。',
    prep('food','buff','self',0,3,{hp:1,when:'otherEvent'})),
];

export const SUPPORT_RELICS: RelicDef[] = [
  artifact('r_relay_bell','接棒钟','rl_relay',['wheel'],'engine','友军轮转到队尾时，新队首本场+{0}/+{0hp}（全队每场{0limit}次）。','team',
    battle('move','buff','front',1,{hp:2,limit:3})),
  artifact('r_shot_chain','联膛管','rl_volley',['charge'],'engine','友军释放蓄能后，其身后友军蓄能{0}（全队每场{0limit}次）。','team',
    battle('released','charge','behind',2,{limit:2})),
  artifact('r_ash_vow','守烬誓约','rl_ember',['ember','formation'],'bridge','友军获得传承时，其身后友军获得{0}层格挡（全队每场{0limit}次）。','team',
    battle('inherited','block','behind',1,{limit:2})),
  artifact('r_nest_roll','育兽名册','rl_brood',['nest'],'engine','友军成为队首时，身后友军本场+{0hp}生命；本场此前每召唤一个友军，多加{0hp}生命（全队每场{0limit}次）。','team',
    battle('enter','buff','behind',0,{hp:1,scale:'legion',limit:3})),
  artifact('r_blood_pact','共血契书','rl_legacy',['blood'],'cover','本回合首次献血后，队首下场战斗获得{0}层格挡。','team',
    prep('bloodPay','block','front',1,1)),
  artifact('r_tally_book','周转账簿','rl_reserve',['trade','supply'],'bridge','本回合出售第{0at}个单位后，若队首在场，货架追加{0}份免费面包（共用口粮生成额度）。','team',
    prep('sell','ration','front',1,1,{at:[2]})),
  artifact('r_ink_well','叠印石砚','rl_runebox',['rune'],'engine','本回合第{0at}次施法，使队首的首击追加{0}伤害。','team',
    prep('spell','seal','front',3,1,{at:[2]})),
  artifact('r_pair_pennant','双生队旗','rl_motley',['pair'],'engine','开战时，与同名相邻的友军各使一名同名搭档本场+{0}/+{0hp}（每人每场{0limit}次）。','holder',
    battle('start','buff','partner',2,{hp:1,when:'paired',limit:1})),
  artifact('r_quarry_writ','合猎令','rl_rear',['hunt'],'engine','友军攻击后，对指定猎物每层猎标造成{0}伤害，保留猎标（全队每场{0limit}次）。','team',
    battle('afterAttack','damage','quarry',1,{scale:'marks',limit:3})),
  artifact('r_anchor_chain','连营地钉','rl_heavy',['formation'],'engine','开战时，每保留一对原本前后紧邻的队友，全队本场+{0hp}生命。','team',
    battle('start','buff','team',0,{hp:1,when:'front',scale:'edges',limit:1})),
  artifact('r_mess_bell','轮餐铜钟','rl_share',['supply','rune'],'bridge','每喂食{0every}次，使本次吃到补给的队友首击追加{0}伤害（每回合{0limit}次）。','team',
    prep('food','seal','event',2,2,{every:2})),
];
