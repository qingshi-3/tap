// 玩家候选。规则数值直接供卡面取用，例如 {0} 是第一条规则的 n，{0h} 是其 hp。
import type { CardDef, Faction, Line, Tier, V3 } from './data';
import { type ArchetypeId, type BattleRule, type CardRole, type PrepRule, type ReworkRule, type RuleNumber } from './archetypes';

const battle = (on: BattleRule['on'], effect: BattleRule['effect'], target: BattleRule['target'], n: RuleNumber, opts: Partial<Pick<BattleRule, 'when' | 'scale' | 'limit' | 'every' | 'hp'>> = {}): BattleRule =>
  ({ phase:'battle', on, effect, target, n, ...opts });
const prep = (on: PrepRule['on'], effect: PrepRule['effect'], target: PrepRule['target'], n: RuleNumber, limit: number, opts: Partial<Pick<PrepRule, 'when' | 'scale' | 'every' | 'hp' | 'at'>> = {}): PrepRule =>
  ({ phase:'prep', on, effect, target, n:on === 'ownBuy' && typeof n !== 'number' ? n[0] : n, limit, ...opts });

/**
 * 阶层身材系数：高阶单卡要能和低阶金色（基础翻倍）比身材，后期追高阶才有意义。
 * 卡表里写的是原始身材，这里统一放大，卡面、图鉴、战斗都读放大后的值。
 */
export const TIER_STAT: Record<Tier, number> = { 1: 1, 2: 1, 3: 1.15, 4: 1.3, 5: 1.5, 6: 1.6 };
const tierStat = (v: number, tier: Tier) => Math.max(1, Math.round(v * TIER_STAT[tier]));

const artFaction: Record<string, Faction> = { l:'light', s:'shadow', a:'abyss', m:'magma', v:'frost', d:'desert', n:'neutral' };
const oldLine: Record<ArchetypeId, Line> = { wheel:'start', charge:'start', ember:'death', nest:'death', blood:'hurt', trade:'grow', rune:'grow', pair:'any', hunt:'start', formation:'hurt', supply:'food' };
function group(archetype?: ArchetypeId) {
  return (id: string, name: string, art: string, role: CardRole, tier: Tier, atk: number, hp: number,
    template: string, rules: ReworkRule[], bridge?: ArchetypeId): CardDef => {
    const faction = artFaction[art.split('_')[0]];
    if (!faction) throw Error('精灵缺少阵营 ' + art);
    const values: V3[] = [];
    const text = template.replace(/\{(\d+)(h?)\}/g, (_, index: string, useHp: string) => {
      const rule = rules[Number(index)];
      const value = useHp ? rule?.hp : rule?.n;
      if (value === undefined) throw Error('卡面数值不存在 ' + id + ':' + index);
      if (typeof value === 'number') return String(value);
      let slot = values.findIndex(([v,g]) => v === value[0] && g === value[1]);
      if (slot < 0) slot = values.push([value[0], value[1], value[1]]) - 1;
      if (slot >= 3) throw Error('卡面变量过多 ' + id);
      return ['{v}', '{u}', '{p}'][slot];
    });
    return {
      id:'rw_' + (archetype ?? 'common') + '_' + id, name, art, faction, role, archetype, bridge, tier, atk:tierStat(atk, tier), hp:tierStat(hp, tier),
      text, rules, v:values[0], u:values[1], pv:values[2], abilities:[], kws:[],
      line:archetype ? oldLine[archetype] : 'any', tag2:bridge ? oldLine[bridge] : undefined,
      perm:rules.some(r => r.phase === 'prep' && r.effect === 'buff'),
      inherit:archetype === 'supply' || undefined,
    };
  };
}

const wheel = group('wheel'), charge = group('charge'), ember = group('ember'), nest = group('nest');
const blood = group('blood'), trade = group('trade'), rune = group('rune'), pair = group('pair');
const hunt = group('hunt'), formation = group('formation'), supply = group('supply'), common = group();
const ride = () => battle('afterAttack', 'rotate', 'self', 1);
const load = (v: RuleNumber) => battle('clashEnd', 'charge', 'self', v, {when:'rear'});
const release = (v: RuleNumber, all = false) => battle('enter', 'release', all ? 'enemies' : 'enemyFront', v);
const bequest = (percent: RuleNumber) => battle('faint', 'inherit', 'behind', percent);
const ownBlood = (effect: PrepRule['effect'], n: RuleNumber) => prep('bloodPay', effect, 'self', n, 1);
const pairStart = (effect: BattleRule['effect'], target: BattleRule['target'], n: RuleNumber, hp?: RuleNumber) =>
  battle('start', effect, target, n, { hp, when:'paired' });

export const REWORK_CARDS: CardDef[] = [
  wheel('courier','绕阵快骑','l_knight','starter',1,3,4,'攻击后退到队尾。成为队首时，对敌首造成{1}伤害，全队每转完一圈多{1}伤害。',
    [ride(), battle('enter','damage','enemyFront',[1,2],{scale:'laps'})]),
  wheel('runner','风行旗手','n_windrunner','starter',2,2,6,'成为队首时，身后友军获得{0}层格挡（每场2次）。攻击后退到队尾。',
    [battle('enter','block','behind',[1,2],{limit:2}), ride()]),
  wheel('relay','回旋舞者','s_dancer','engine',3,4,7,'成为队首时，身后友军本场+{0}/+{0h}，全队每转完一圈多加一次。攻击后退到队尾。',
    [battle('enter','buff','behind',[2,3],{hp:[1,2],scale:'laps'}),ride()]),
  wheel('lancer','折返枪骑','l_sunriser','engine',3,5,5,'成为队首时，对敌尾造成攻击{0}%的伤害。攻击后退到队尾。',
    [battle('enter','damage','enemyLast',[60,95],{scale:'attackPct'}),ride()]),
  wheel('bell','日钢卫士','d_hourglass','engine',4,3,9,'每2次交锋后，我方队首退到队尾（每场3次）。成为队首时，获得{1}层格挡（每场2次）。',
    [battle('clashEnd','rotate','front',1,{every:2,limit:3}),battle('enter','block','self',[1,2],{limit:2})]),
  wheel('reserve','碧鬃战狮','l_azurelion','cover',2,3,5,'友军阵亡时，我方队首获得{0}层格挡（每场1次）。攻击后退到队尾。',
    [battle('allyFaint','block','front',[1,2],{limit:1}),ride()]),
  wheel('marshal','战爪统领','s_lord','terminal',6,7,11,'成为队首时，对全体敌人造成{0}伤害，全队每转完一圈多{0}伤害。攻击后退到队尾。',
    [battle('enter','damage','enemies',[2,3],{scale:'laps'}),ride()]),
  wheel('sigil','环焰灵犬','n_paragon','bridge',5,3,6,'本回合前2次施法，每次使首击追加{0}伤害。攻击后退到队尾。',
    [prep('spell','seal','self',[2,3],2,{at:[1,2]}),ride()],'rune'),

  charge('sling','掷弹手','n_grenadier','starter',1,2,4,'在后排时，每次交锋后蓄能{0}。成为队首时，消耗全部蓄能，每点对敌首造成{1}伤害。',
    [load([1,2]),release(2)]),
  charge('bunker','鳞甲盾卫','n_justicar','starter',2,1,8,'首次成为队首时，获得{0}层格挡。受伤存活时，身后友军蓄能{1}（每场3次）。',
    [battle('enter','block','self',[1,2],{limit:1}),battle('hurt','charge','behind',1,{limit:3})]),
  charge('gunner','金甲机兵','l_caliber','engine',3,3,6,'在后排时，每次交锋后蓄能{0}。成为队首时，消耗全部蓄能，每点对敌首造成{1}伤害。',
    [load(2),release([2,3])]),
  charge('battery','金焰方尖碑','d_goldob','engine',4,4,7,'在后排时，每次交锋后，身后友军蓄能{0}。阵亡时，身后友军获得1层格挡。',
    [battle('clashEnd','charge','behind',[2,3],{when:'rear'}),battle('faint','block','behind',1)]),
  charge('mortar','机甲炮手','n_mechcannon','engine',4,3,7,'在后排时，每次交锋后蓄能{0}。成为队首时，消耗全部蓄能，每点对全体敌人造成1伤害。',
    [load([1,2]),release(1,true)]),
  charge('brake','翠角蛮牛','m_kujata','cover',2,2,7,'替队首分担每次交锋至多{0}伤害。阵亡时，身后友军蓄能{1}。',
    [battle('start','guard','self',[1,2]),battle('faint','charge','behind',[1,2])]),
  charge('siege','坠岩巨人','m_titan','terminal',6,4,11,'在后排时，每次交锋后蓄能{0}。成为队首时，消耗全部蓄能，每点对全体敌人造成{1}伤害。',
    [load([2,3]),release([2,3],true)]),
  charge('surveyor','鸣镝射手','n_whistler','bridge',3,4,6,'在后排时，每2次交锋后，猎物获得{0}层猎标。成为队首时，消耗全部蓄能，每点对敌首造成{1}伤害。',
    [battle('clashEnd','mark','quarry',[1,2],{when:'rear',every:2}),release(2)],'hunt'),

  ember('tinder','携火小鬼','a_imp','starter',1,3,2,'阵亡时，对敌首造成{0}伤害；身后友军本场继承{1}%攻血及首个可传承阵亡技能。',
    [battle('faint','damage','enemyFront',[2,3]),bequest([25,40])]),
  ember('torch','暗脊魔','a_spine','starter',2,2,4,'阵亡时，身后友军获得1层格挡，本场继承{1}%攻血及首个可传承阵亡技能。',
    [battle('faint','block','behind',1),bequest([30,45])]),
  ember('blade','守墓人','a_graveguard','engine',3,6,3,'阵亡时，对敌尾造成攻击{0}%的伤害；身后友军本场继承{1}%攻血及首个可传承阵亡技能。',
    [battle('faint','damage','enemyLast',[70,95],{scale:'attackPct'}),bequest([25,40])]),
  ember('legate','夜哀剑姬','a_ritualist','engine',3,3,7,'友军阵亡时，本场+{0}/+{0h}（每场3次）。阵亡时，身后友军本场继承{1}%攻血及首个已继承的阵亡技能。',
    [battle('allyFaint','buff','self',[1,2],{hp:[2,3],limit:3}),bequest([40,50])]),
  ember('cinder','影舞者','a_cult','engine',4,6,5,'阵亡时，对全体敌人造成{0}伤害；身后友军本场继承{1}%攻血及首个可传承阵亡技能。',
    [battle('faint','damage','enemies',[2,3]),bequest([30,45])]),
  ember('lantern','缚灵女巫','n_tether','cover',2,2,5,'开战时，身后友军获得{0}层格挡。阵亡时，身后友军本场继承{1}%攻血及首个已继承的阵亡技能。',
    [battle('start','block','behind',[1,2]),bequest(30)]),
  ember('crown','余烬女王','a_matriarch','terminal',6,7,9,'其他友军阵亡时，对敌首造成攻击{0}%的伤害。阵亡时，对全体敌人造成攻击{1}%的伤害。',
    [battle('allyFaint','damage','enemyFront',[35,55],{scale:'attackPct'}),battle('faint','damage','enemies',[65,90],{scale:'attackPct'})]),
  ember('brood','渊巢魔','a_deep','bridge',4,3,4,'阵亡时，身后友军本场继承{0}%攻血及召唤技能；在队首召唤{1}/{1h}幼兽（需空位）。',
    [bequest([20,35]),battle('faint','summon','front',[2,3],{hp:[2,3]})],'nest'),

  nest('hatch','前哨兽卵','m_egg','starter',1,1,3,'开战时，在队首召唤{0}/{0h}幼兽（需空位）。',
    [battle('start','summon','front',[2,3],{hp:[2,4]})]),
  nest('den','熔脊幼龙','m_whelp','starter',2,2,5,'阵亡时，在队首召唤{0}/{0h}幼兽（需空位）。',
    [battle('faint','summon','front',[3,5],{hp:[2,3]})]),
  nest('matron','看巢兽母','m_incubator','engine',3,3,7,'每2次交锋后，在队首召唤{0}/{0h}幼兽（每场3次，需空位）。',
    [battle('clashEnd','summon','front',[2,3],{hp:[2,3],every:2,limit:3})]),
  nest('pack','迅龙老兵','m_raptor','engine',3,4,5,'召唤友方小兵时，它获得{0}层格挡（每场3次）。',
    [battle('summon','block','event',[1,2],{when:'token',limit:3})]),
  nest('fuser','巢穴巨兽','m_rex','engine',4,3,8,'开战时，在队首召唤{1}/{1h}幼兽。队满且有友方小兵时，召唤的攻血加给首个小兵。',
    [battle('start','coalesce','self',1),battle('start','summon','front',[2,3],{hp:[2,3]})]),
  nest('pelt','岩背兽','m_earthwalker','cover',2,2,6,'开战时，获得1层格挡。召唤友方小兵时，本场+{1h}生命（每场3次）。',
    [battle('start','block','self',1),battle('summon','buff','self',0,{hp:[2,3],when:'token',limit:3})]),
  nest('progenitor','万兽之母','m_heart','terminal',6,5,11,'每2次交锋后，在队首召唤{0}/{0h}幼兽；本场此前每召唤一个友军，多加一份攻血（每场4次，需空位）。',
    [battle('clashEnd','summon','front',[2,3],{hp:[2,3],scale:'legion',every:2,limit:4})]),
  nest('outrider','战兽游骑','m_mankator','bridge',3,4,5,'成为队首时，在队首召唤{0}/{0h}幼兽（每场2次，需空位）。攻击后退到队尾。',
    [battle('enter','summon','front',[2,3],{hp:[1,2],limit:2}),ride()],'wheel'),

  blood('cutpurse','血注赌徒','n_gambit','starter',1,3,4,'献出1点永久生命，获得{0}金（每回合1次）。',
    [ownBlood('gold',[1,2])]),
  blood('razor','赤触魔忍','a_reaper','starter',2,4,6,'受伤存活且半血及以下时，对敌首造成攻击{0}%的伤害（每场2次）。',
    [battle('hurt','damage','enemyFront',[80,110],{when:'half',scale:'attackPct',limit:2})]),
  blood('vow','血契巨兽','m_bloodcaller','engine',3,4,7,'献出1点永久生命，永久+{0}攻击（每回合1次）。受伤存活且半血及以下时，获得1层格挡（每场1次）。',
    [ownBlood('buff',[2,3]),battle('hurt','block','self',1,{when:'half',limit:1})]),
  blood('lance','赤蛇刺客','s_viper','engine',3,5,7,'半血及以下时，攻击后每缺1点生命，对敌尾造成{0}伤害（每场2次）。',
    [battle('afterAttack','damage','enemyLast',[1,2],{when:'half',scale:'missingHp',limit:2})]),
  blood('pact','噬心巫师','n_mindwarp','engine',4,3,9,'献出1点永久生命，获得{0}张本回合法术（每回合1次）。1血时，攻击后对全体敌人造成{1}伤害。',
    [ownBlood('spell',[1,2]),battle('afterAttack','damage','enemies',[4,6],{when:'critical'})]),
  blood('shelter','疗愈秘士','n_medic','cover',2,3,6,'开战时，身前友军获得{0}层格挡。受伤存活且半血及以下时，身前友军获得1层格挡（每场1次）。',
    [battle('start','block','ahead',[1,2]),battle('hurt','block','ahead',1,{when:'half',limit:1})]),
  blood('immortal','缚命君主','a_nightmare','terminal',6,7,9,'受到致命伤害时，保留1血（每场{0}次）。1血时，攻击后对全体敌人造成攻击{1}%的伤害。',
    [battle('start','survive','self',[1,2]),battle('afterAttack','damage','enemies',[80,100],{when:'critical',scale:'attackPct'})]),
  blood('brazier','血月祭司','a_bloodmoon','bridge',3,4,4,'献出1点永久生命，获得{0}金（每回合1次）。阵亡时，对敌首造成{1}伤害；身后友军本场继承{2}%攻血及此伤害技能。',
    [ownBlood('gold',1),battle('faint','damage','enemyFront',[2,4]),bequest([35,50])],'ember'),

  trade('broker','宫廷饰匠','d_artificer','starter',1,2,3,'出售时，额外获得{0}金。',
    [prep('ownSell','gold','self',[1,2],1)]),
  trade('porter','沙嚎兽','d_howler','starter',2,3,5,'买下它时，队首下场战斗获得{0}层格挡。',
    [prep('ownBuy','block','front',[1,2],1)]),
  trade('teller','沙丘法师','d_dunecaster','engine',3,3,6,'出售其他单位后，永久+{0}/+{0h}（每回合2次）。',
    [prep('sell','buff','self',[1,2],2,{hp:1,when:'otherEvent'})]),
  trade('hawker','撑伞旅商','n_zenrui','engine',3,4,6,'本回合购买第2个单位后，货架追加{0}份免费口粮。',
    [prep('buy','ration','self',[1,2],1,{every:2,at:[2]})]),
  trade('factor','白袍书记','d_aymara','engine',4,4,7,'回合结束时，本回合每买卖一个单位，就为身前队友的首击追加{0}伤害。',
    [prep('turnEnd','seal','ahead',[1,2],1,{scale:'trades'})]),
  trade('bailiff','旋沙行者','d_dervish','cover',2,3,6,'本回合首次出售其他单位后，队首下场战斗获得{0}层格挡。',
    [prep('sell','block','front',[1,2],1,{when:'otherEvent'})]),
  trade('tycoon','胡狼法老','d_pharaoh','terminal',6,6,10,'开战时，每剩1金，对全体敌人造成{0}伤害。',
    [battle('start','damage','enemies',[1,2],{scale:'gold'})]),
  trade('twins','游侠商人','n_locke','bridge',5,4,6,'买下它时，队首下场战斗获得1层格挡。开战时，若与同名友军相邻，搭档本场+{1}/+{1h}。',
    [prep('ownBuy','block','front',1,1),pairStart('buff','partner',[3,5],[2,3])],'pair'),

  rune('scribe','霜林精灵','v_mage','starter',1,2,3,'本回合前2次施法，每次使队首的首击追加{0}伤害。',
    [prep('spell','seal','front',[2,3],2,{at:[1,2]})]),
  rune('satchel','影狐','s_fox','starter',2,2,5,'买下它时，获得{0}张本回合法术。',
    [prep('ownBuy','spell','self',[1,2],1)]),
  rune('cantor','暗瞳兽','a_chanter','engine',3,3,6,'本回合第2、4次施法，各使全队的首击追加{0}伤害。',
    [prep('spell','seal','team',[1,2],2,{every:2,at:[2,4]})]),
  rune('binder','四风咒师','s_fourwinds','engine',3,3,6,'本回合首次施法，身后队友下场战斗获得{0}层格挡，首击追加{1}伤害。',
    [prep('spell','block','behind',1,1,{at:[1]}),prep('spell','seal','behind',[3,5],1,{at:[1]})]),
  rune('quill','灵卷书使','n_scribe','engine',4,4,7,'回合结束时，本回合每施法一次，就为身前队友的首击追加{0}伤害。',
    [prep('turnEnd','seal','ahead',[2,3],1,{scale:'spells'})]),
  rune('ward','冰晶哨兽','v_sentinel','cover',2,2,7,'本回合首次施法后，队首下场战斗获得{0}层格挡。阵亡时，身后友军获得1层格挡。',
    [prep('spell','block','front',[1,2],1,{at:[1]}),battle('faint','block','behind',1)]),
  rune('chorus','金环剑圣','s_master','terminal',6,5,10,'开战时，本回合每施法一次，对全体敌人造成{0}伤害。',
    [battle('start','damage','enemies',[2,3],{scale:'spells'})]),
  rune('ink','血石术士','n_bloodstone','bridge',3,3,6,'献出1点永久生命，获得1张本回合法术（每回合1次）。本回合首次施法，首击追加{1}伤害。',
    [ownBlood('spell',1),prep('spell','seal','self',[3,5],1,{at:[1]})],'blood'),

  pair('cadet','双刃新兵','l_windblade','starter',1,3,4,'开战时，若与同名友军相邻，搭档本场+{0}/+{0h}。',
    [pairStart('buff','partner',[2,3],[1,2])]),
  pair('shield','日石圣骑','l_templar','starter',2,2,6,'开战时，若与同名友军相邻，搭档获得{0}层格挡。',
    [pairStart('block','partner',[1,2])]),
  pair('flanker','影袭忍者','s_ninja','engine',3,4,6,'攻击后，若与同名友军仍相邻，对敌尾造成攻击{0}%的伤害。',
    [battle('afterAttack','damage','enemyLast',[60,95],{when:'paired',scale:'attackPct'})]),
  pair('drummer','塔盾卫士','l_warden','engine',3,3,7,'每2次交锋后，若与同名友军仍相邻，搭档本场+{0}/+{0h}（每场3次）。',
    [battle('clashEnd','buff','partner',[2,3],{hp:[2,3],when:'paired',every:2,limit:3})]),
  pair('officer','号角天使','l_angel','engine',4,4,7,'开战时，每有一对相邻同名友军，全队本场+{0}/+{0h}。',
    [battle('start','buff','team',[1,2],{hp:1,scale:'pairs'})]),
  pair('picket','双影哨兵','n_twins','cover',2,3,6,'开战时，获得1层格挡；若与同名友军相邻，搭档本场+{1h}生命。',
    [battle('start','block','self',1),pairStart('buff','partner',0,[2,4])]),
  pair('standard','双冠旗主','l_storm','terminal',5,6,9,'普通与金色同名友军相邻时，其属性、格挡、伤害、猎标、蓄能技能额外触发{0}次（每场共应援3次）。',
    [battle('start','pairEcho','self',[1,2],{limit:3})]),
  pair('oath','同袍剑士','l_vigil','bridge',4,4,7,'开战时，若与同名友军相邻，搭档获得{0}层格挡。替队首分担每次交锋至多{1}伤害。',
    [pairStart('block','partner',[1,2]),battle('start','guard','self',[1,2])],'formation'),

  hunt('spotter','扇刃斥候','s_dart','starter',1,2,3,'开战时，指定猎物获得{0}层猎标。每次交锋后，每层猎标造成1伤害。',
    [battle('start','mark','quarry',[1,2])]),
  hunt('barb','赤镰猎手','s_hunter','starter',2,3,4,'攻击后，敌首获得{0}层猎标（每场2次）。',
    [battle('afterAttack','mark','enemyFront',[1,2],{limit:2})]),
  hunt('tracker','相位猎犬','n_phasehound','engine',3,3,5,'每2次交锋后，指定猎物获得{0}层猎标（每场3次）。',
    [battle('clashEnd','mark','quarry',[1,2],{every:2,limit:3})]),
  hunt('setter','飞刃伏兵','n_kiri','engine',3,4,4,'阵亡时，指定猎物获得{0}层猎标。开战时，敌尾获得1层猎标。',
    [battle('faint','mark','quarry',[2,3]),battle('start','mark','enemyLast',1)]),
  hunt('powder','引线猎手','s_backstab','engine',4,5,6,'首次成为队首时，清除猎物全部猎标，每层造成{0}伤害。',
    [battle('enter','detonate','quarry',[3,4],{limit:1})]),
  hunt('hide','圣杖守卫','d_dune','cover',2,2,7,'开战时，获得{0}层格挡。首次受伤存活时，指定猎物获得1层猎标。',
    [battle('start','block','self',[1,2]),battle('hurt','mark','quarry',1,{limit:1})]),
  hunt('executioner','虚空猎手','n_voidhunter','terminal',6,6,8,'开战时，敌尾获得{0}层猎标。第3次交锋后，清除敌尾全部猎标，每层造成{1}伤害。',
    [battle('start','mark','enemyLast',[2,3]),battle('clashEnd','detonate','enemyLast',[4,6],{every:3,limit:1})]),
  hunt('watch','灵狼瞭手','v_scout','bridge',4,3,6,'在后排时，每次交锋后蓄能{0}。成为队首时，消耗全部蓄能，每点对猎物造成2伤害，再加{2}层猎标。',
    [load([1,2]),battle('enter','release','quarry',2),battle('enter','mark','quarry',[1,2])],'charge'),

  formation('guard','列阵护卫','l_shield','starter',1,2,5,'替队首分担每次交锋至多{0}伤害。',
    [battle('start','guard','self',[1,2])]),
  formation('banner','护旗手','n_oracle','starter',2,3,5,'开战时，相邻友军本场+{0}/+{0h}。',
    [battle('start','buff','neighbors',[1,2],{hp:[2,3]})]),
  formation('ranks','铁骑团长','l_zir','engine',3,4,7,'首次成为队首时，每保留一对原本前后紧邻的队友，本场+{0}/+{0h}。',
    [battle('enter','buff','self',[1,2],{hp:1,scale:'edges',limit:1})]),
  formation('stakes','霜鬼盾主','v_keeper','engine',3,2,8,'每累计2次未主动轮转的交锋，身前友军获得{0}层格挡（每场2次）。',
    [battle('clashEnd','block','ahead',[1,2],{when:'stationary',every:2,limit:2})]),
  formation('phalanx','霜岩傀儡','n_icegolem','engine',4,3,9,'替相邻友军分担每次交锋至多{0}伤害。阵亡时，身后友军获得1层格挡。',
    [battle('start','share','self',[2,3]),battle('faint','block','behind',1)]),
  formation('reserve','寒冰壁垒','v_barrier','cover',2,2,6,'其他友军阵亡时，队首获得{0}层格挡（每场1次）。首次成为队首时，本场+{1h}生命。',
    [battle('allyFaint','block','front',[1,2],{limit:1}),battle('enter','buff','self',0,{hp:[2,3],limit:1})]),
  formation('citadel','铁壁阵心','l_archon','terminal',6,4,13,'替相邻友军分担每次交锋至多{0}伤害。开战时，每保留一对原本前后紧邻的队友，本场+{1h}生命。',
    [battle('start','share','self',[4,6]),battle('start','buff','self',0,{hp:[2,3],scale:'edges'})]),
  formation('battery','黄道守卫','d_keeper','bridge',5,3,8,'替队首分担每次交锋至多{0}伤害。在后排时，每次交锋后，身后友军蓄能{1}。',
    [battle('start','guard','self',[1,2]),battle('clashEnd','charge','behind',[1,2],{when:'rear'})],'charge'),

  supply('pup','晶甲驮虫','v_guard','starter',1,2,4,'被喂食时，永久+{0}/+{0h}（每回合2次）。出售时传承已记录补给。',
    [prep('food','buff','self',[1,2],2,{when:'selfEvent',hp:1})]),
  supply('canteen','雪人伙夫','v_snowman','starter',2,3,5,'买下它时，货架追加{0}份免费口粮。出售时传承已记录补给。',
    [prep('ownBuy','ration','self',[1,2],1)]),
  supply('cook','霜林树人','v_treant','engine',3,3,6,'被喂食时，相邻友军下场战斗获得{0}层格挡（每回合2次）。出售时传承已记录补给。',
    [prep('food','block','neighbors',[1,2],2,{when:'selfEvent'})]),
  supply('steward','背包地精','n_zyx','engine',3,3,7,'备战回合开始时，货架追加{0}份免费口粮。出售时传承已记录补给。',
    [prep('turnStart','ration','self',[1,2],1)]),
  supply('miller','霜狼战长','v_fenrir','engine',4,4,7,'给其他队友喂食，使它的首击追加{0}伤害（每回合3次）。出售时传承已记录补给。',
    [prep('food','seal','event',[2,3],3,{when:'otherEvent'})]),
  supply('inspector','冰原水熊','v_bear','cover',2,3,6,'本回合首次喂食后，队首下场战斗获得{0}层格挡。出售时传承已记录补给。',
    [prep('food','block','front',[1,2],1)]),
  supply('feast','风语白鹿','v_stag','terminal',5,5,9,'回合结束时，本回合每喂食一次，就为全队的首击追加{0}伤害。出售时传承已记录补给。',
    [prep('turnEnd','seal','team',[1,2],1,{scale:'meals'})]),
  supply('wagon','驮货犀牛','v_rhyno','bridge',4,4,7,'出售时，额外获得{0}金，并传承补给。本回合首次出售其他单位后，货架追加1份免费口粮。',
    [prep('ownSell','gold','self',[1,2],1),prep('sell','ration','self',1,1,{when:'otherEvent'})],'trade'),

  common('buckler','誓盾佣兵','n_sworndef','utility',1,2,5,'开战时，获得{0}层格挡。',
    [battle('start','block','self',[1,2])]),
  common('runner','影步信使','s_step','utility',1,3,3,'阵亡时，身后友军本场+{0}/+{0h}。',
    [battle('faint','buff','behind',[2,3],{hp:[1,2]})]),
  common('cook','海盗厨子','n_pirate','utility',2,3,4,'买下它时，货架追加{0}份免费口粮。',
    [prep('ownBuy','ration','self',[1,2],1)]),
  common('sapper','破障射手','l_archer','utility',2,4,4,'首次成为队首时，对敌首造成攻击{0}%的伤害。',
    [battle('enter','damage','enemyFront',[65,95],{scale:'attackPct',limit:1})]),
  common('hearth','复苏骑士','n_rejuv','utility',3,3,7,'本场首次有队友阵亡时，队首获得{0}层格挡。阵亡时，身后友军本场+{1h}生命。',
    [battle('allyFaint','block','front',[1,2],{limit:1}),battle('faint','buff','behind',0,{hp:[3,5]})]),
  common('veteran','老城守将','l_ironcliffe','utility',4,5,8,'首次成为队首时，本场+{0h}生命。阵亡时，对敌首造成最大生命{1}%的伤害。',
    [battle('enter','buff','self',0,{hp:[3,5],limit:1}),battle('faint','damage','enemyFront',[35,50],{scale:'healthPct'})]),
];
