import { EXPANSION_IDS } from './expansion-mechanics.js';
import { RECRUITMENT_CARD_IDS } from './recruitment-cards.js';
import { cardKeywords, cleanCardCopy } from './card-keywords.js';
import { getHero } from './factions.js';
import { cardAttackRange } from './attack-range.js';

// Rules describe engine.js, including automatic targets; printed card descriptions
// are historical shorthand and must not be used as the rules source.
const section = (label, text) => ({ label, text });
const STUN = '目标立即失去移动和攻击机会，并跳过下个己方回合的移动与攻击。';
const spells = {
  mistDragonSeal:['强化与传送','友方随从永久增加1攻击、1生命，再传送至所选空格；不恢复行动机会。'],
  juxtaposition:['换位','交换任意两个不同随从的位置，敌我均可；不恢复移动或攻击。'],
  siphonEnergy:['驱散','驱散主将相邻一名敌方随从的能力、战场强化及脚下腐化地形；培养属性保留。'],
  entropicDecay:['消灭','消灭主将相邻一名敌方随从，触发亡愿、死亡成长与死亡召唤；不是伤害。'],
  daemonicLure:['伤害与传送','敌方随从受到1伤害，存活时传送至所选空格；不能选择主将。'],
  darkTransformation:['消灭与召唤','消灭敌方随从，触发死亡后在原格召唤己方1/1暗灵；亡愿占格时不覆盖。'],
  naturalSelection:['最低攻消灭','消灭全场当前攻击最低或并列最低的一名随从，敌我均可。'],
  plasmaStorm:['条件消灭','消灭全场当前攻击不超过3的随从，包含友军；不是3点伤害。'],
  chromaticCold:['格子驱散','驱散一格单位与腐化地形；其中敌人随后受到1伤害，可选主将；不会删墙或据点。'],
  aspectRavager:['变形','随从变成无能力3/3掠食者，保留归属和已消耗行动，不触发死亡或登场。'],
  roar: ['强化', '主将相邻的一名友方随从永久增加2攻击。'],
  heal: ['治疗', '任一受伤单位恢复5生命，敌我均可，包含主将。'],
  strike: ['伤害', '任一随从受到2伤害，敌我均可；不能选择主将。'],
  tempest: ['全场伤害', '对全场单位造成 2 点伤害，包括主将。'],
  bond: ['强化', '任一随从永久增加等同于其当前生命值的攻击，敌我均可。'],
  phoenixFire: ['伤害', '选择一名敌方单位，造成 3 点伤害；可选择随从或主将。'],
  innerFocus: ['再行动', '攻击不高于3的友方随从可立即移动和攻击；不解除眩晕。'],
  firstWish: ['强化抽牌', '选择一名友方随从，永久增加 1 攻击、1 生命，然后己方抽 1 张牌。'],
  boneSwarm: ['范围伤害', '对所有敌方主将及其相邻的敌方单位造成 2 点伤害。'],
  voidPulse: ['汲取', '选择一名敌方主将，造成 2 点伤害；己方主将恢复 3 生命，不超过生命上限。'],
  wraithlingSwarm: ['召唤暗灵', '选择战场任一可用空格，在该格和相邻空格依次召唤最多 3 名 1 攻击、1 生命的暗灵。'],
  greaterFortitude: ['强化', '选择一名友方随从，永久增加 2 攻击、2 生命。'],
  earthSphere: ['治疗', '己方主将恢复 8 生命，不超过生命上限。'],
  flashFreeze: ['伤害与眩晕', `任一随从受到1伤害并眩晕，敌我均可；不能选择主将。${STUN}`],
  bonechillBarrier: ['召唤冰墙', `选择战场任一可用空格，在该格和相邻空格依次召唤最多 3 面 0 攻击、2 生命的寒骨屏障。攻击冰墙的单位会被眩晕。${STUN}`],
};
const spellSummaries = {
  roar:'主将附近的一名友方随从永久增加 2 攻击。', heal:'为任一受伤随从或主将恢复 5 生命，敌我均可。',
  strike:'对任一随从造成 2 点伤害，敌我均可，不能选主将。', tempest:'对全场友军和敌军造成 2 点伤害，包括主将。',
  bond:'任一随从永久增加等同于其当前生命值的攻击。', phoenixFire:'对一名敌方随从或主将造成 3 点伤害。',
  innerFocus:'攻击不高于 3 的友方随从恢复移动和攻击机会。', firstWish:'友方随从永久增加 1 攻击和 1 生命；抽 1 张牌。',
  boneSwarm:'对敌方主将及其附近敌军造成 2 点伤害。', voidPulse:'敌方主将受到 2 点伤害；己方主将恢复 3 生命。',
  wraithlingSwarm:'在所选空格及附近召唤最多 3 名暗灵。', greaterFortitude:'一名友方随从永久增加 2 攻击和 2 生命。',
  earthSphere:'为己方主将恢复 8 生命，不超过生命上限。', flashFreeze:'对任一随从造成 1 点伤害，并使其眩晕。',
  bonechillBarrier:'在所选空格及附近召唤最多 3 面冰墙，攻击者眩晕。',
};
const activeOverrides = {
  1:'主将相邻的一名友方随从永久增加2攻击。',
  23:'选择一名受伤的友方随从，恢复 3 生命，不超过生命上限。',
  101:'友方随从自动移至主将相邻空格，不恢复行动机会。',
  123:'在主将相邻所选空格召唤1/1远程心猎者。',
  201:'在主将身旁召唤2/3铁甲沙魔，回合结束时保留。',
  223:'本回合主将主动攻击敌方随从时额外造成2伤害，反击不受影响。',
  301:'在主将相邻空格自动召唤最多2名1/1暗灵。',
  323:'敌方单位受到1伤害，脚下留下腐化；己方回合结束时，该格敌人受到1伤害。',
  418:'各存活阵营抽1张牌。',
  501:'阵营顺序最前的敌方主将受到2伤害。',
  527:'本回合随后召唤的友方随从永久增加1攻击和1生命。',
};
const passiveOverrides = {
  123:'每回合首次施法后，最早入场的友方远程随从永久增加1攻击。',
  301:'每回合首名非衍生友方随从死亡时，原格召唤1/1暗灵，优先于重生与亡愿召唤。',
  527:'每回合首次召唤的友方随从永久增加1生命；其相邻最早入场的友方冰墙永久获得嘲讽。',
};

export function unitSections(card) {
  const range = cardAttackRange(card);
  const reach = Number.isFinite(range) ? `${range}格内` : '';
  const rules = {
    provoke:'相邻敌人不能移动，只能攻击相邻嘲讽单位；远程与爆破也受限。',
    ranged:`可攻击${reach}敌人，并反击射程内的攻击者；相邻嘲讽优先。`,
    blast:`攻击${reach}同排或同列敌人，同时伤害该方向射程内的其他敌人；仅主目标反击，相邻嘲讽优先。`,
    backstab:`从目标背后紧邻的同排格主动攻击，额外造成${card.backstab === true ? 1 : card.backstab}伤害，目标不反击。己方背后在左，敌方在右。`,
    deathWatch:'其他随从死亡时，永久增加1攻击和1生命，敌我均可触发。',
    deathWatchSpawn:'其他随从死亡时，在相邻空格召唤1/1暗灵，敌我均可触发。',
    obelysk:'不能移动。己方回合开始，召唤相邻2/2沙魔，立即可行动，己方回合结束消散。',
    dervishAura:`存活时，全场友方沙魔、铁甲沙魔增加${card.dervishAuraAttack || card.dervishAuraHealth}${card.dervishAuraAttack ? '攻击' : '生命'}，可叠加；离场移除加成，保留已受伤害。`,
    openingBuff:card.id === 211 ? '登场：最早入场的友方沙魔或铁甲沙魔永久增加2攻击和2生命；临时沙魔不再消散。' : '登场：相邻最早入场的友方随从永久增加2攻击和2生命。',
    openingAlliedAttack:'登场：场上其他友方随从增加2攻击，持续至本回合结束。',
    creepTrail:'己方回合结束，在相邻非墙、未腐化的一格留下腐化，可在单位脚下；己方腐化格上的敌人立即受到1伤害。',
    creepStats:'每格己方腐化使自身增加1攻击和1生命，随地形数量变化；保留已受伤害。',
    creepDamageMultiplier:'存活时，己方回合结束的腐化伤害翻倍；多个倍率相乘。',
    spellWatchLeech:'己方每次施法后，阵营顺序最前的敌方主将受到1伤害，己方主将恢复1生命。',
    spellWatch:'己方每次施法后，永久增加1攻击和1生命。',
    wall:`主动攻击它的单位被眩晕，即使冰墙被击败也触发。${STUN}`,
    dervish:'方尖碑召唤时立即可行动；己方回合结束消散。沙丘塑师可使它保留。',
    rebirth:'死亡：原格留下0/1卵。存活至下个己方回合开始，恢复原随从基础属性，失去强化，立即可行动。',
    flying:'可飞往任意空格，越过单位与地形；不能停在墙上，仍受相邻嘲讽限制。',
    airdrop:'可召唤到任意空格，无需邻近友军。',
    rush:'召唤当回合即可移动和攻击，仍受嘲讽与眩晕限制。',
    zeal:`邻近己方主将时增加${card.zeal}攻击，离开后失去加成。`,
    zealHeal:'邻近己方主将时，己方回合结束恢复全部生命。',
    grow:`己方回合开始，永久增加${card.grow}攻击和${card.grow}生命。`,
    healWatch:'任一单位实际恢复生命时，自身永久增加1攻击和1生命。',
    infiltrate:`位于敌方半场时增加${card.infiltrate}攻击，中央列不计入。`,
    manaWisp:'死亡：己方法力上限增加1，最高9。',
    dyingWolf:'死亡：原格召唤3/2幽灵狼。',
    openingWraith:'登场：在相邻空格召唤1/1暗灵。',
  };
  const result = cardKeywords(card).map(({id,label,explanation}) => section(label,rules[id] || cleanCardCopy(explanation)));
  if (card.id === 411) result.push(section('孵化','不能移动。存活至下个己方回合开始，孵化为原随从，恢复基础属性，失去强化，立即可行动。'));
  if (card.description && !result.length) return [section('规则',cleanCardCopy(card.description))];
  return result.length ? result : [section('规则','无特殊效果。')];
}

export function cardRuleSections(card) {
  if (!card) return [section('规则', '无特殊效果。')];
  if (card.campaignSummary) {
    const result = [section('法术', cleanCardCopy(card.campaignSummary))];
    if (['flashFreeze','bonechillBarrier'].includes(card.effect)) result.push(section('眩晕', STUN));
    return result;
  }
  
  if (card.type === 'general') {
    const hero = getHero(card.id);
    if (!hero) return [section('规则', '无特殊效果。')];
    const result = [section(`指令 · ${hero.cost}费 · ${hero.activeName}`, `${activeOverrides[card.id] || hero.activeDescription}每个己方回合限用一次。`), section(`被动 · ${hero.passiveName}`, passiveOverrides[card.id] || hero.passiveDescription)];
    return result;
  }
  if (card.type === 'spell') {
    const rule = spells[card.effect];
    const result = [rule ? section(rule[0], rule[1]) : section('规则', cleanCardCopy(card.description) || '无特殊效果。')];
    return result;
  }
  if (EXPANSION_IDS.includes(card.id) || RECRUITMENT_CARD_IDS.includes(card.id)) return [section('规则', cleanCardCopy(card.description))];
  return unitSections(card);
}

const unitSummaries = {
  9:'邻近己方主将时增加 1 攻击，离开后失去加成。',15:'任一单位实际恢复生命时，自身永久增加 1 攻击和 1 生命。',16:'邻近己方主将时，在己方回合结束恢复全部生命。',
  11:'限制相邻敌人移动和攻击；邻近己方主将时增加 2 攻击。',17:'可召唤到任意可用空格，并限制相邻敌人移动和攻击。',
  110:'从敌人背后紧邻处攻击时，额外造成 1 伤害，目标不反击。',115:'己方每次施法后，永久增加 1 攻击和 1 生命。',
  111:'可飞往任意可用空格；背后攻击额外造成 4 伤害且不受反击。',116:'己方每次施法后，敌方主将受 1 伤害，己方主将恢复 1 生命。',
  213:'攻击同排或同列敌人，并伤害该方向直线上的其他敌人。',209:'攻击同排或同列敌人，并伤害该方向直线上的其他敌人。',211:'登场时自动强化最早入场的友方沙魔，并使临时沙魔不再消散。',
  214:'不能移动；己方回合开始召唤可立即行动的临时沙魔。',215:'不能移动；己方回合开始召唤临时沙魔，并为友方沙魔增加 1 攻击。',216:'不能移动；己方回合开始召唤临时沙魔，并为友方沙魔增加 1 生命。',217:'方尖碑召唤时可立即行动；己方回合结束消散。',
  308:'己方回合结束留下相邻腐化地形，腐化格上的敌人受 1 伤害。',317:'登场时，在相邻可用空格自动召唤一名暗灵。',311:'其他友方或敌方随从死亡时，永久增加 1 攻击和 1 生命。',309:'每格己方腐化地形增加 1 攻击和 1 生命，随地形数量变化。',310:'其他友方或敌方随从死亡时，在附近空格自动召唤暗灵。',316:'存活时使己方腐化地形伤害翻倍；多个效果可叠加。',
  412:'死亡留下重生之卵；卵存活到下个己方回合时孵化为原随从。',413:'死亡留下重生之卵；卵存活到下个己方回合时孵化为原随从。',410:'登场时，相邻最早入场的友方随从永久增加 2 攻击和 2 生命。',402:'己方回合开始时，永久增加 1 攻击和 1 生命。',404:'己方回合开始时，永久增加 4 攻击和 4 生命。',411:'重生产生的卵存活到下个己方回合时，孵化为原随从。',
  505:'位于敌方半场时增加 2 攻击，中央列不计入。',506:'死亡时增加 1 己方法力上限，最高为 9。',503:'死亡时，在原位置召唤一名幽灵狼。',526:'可召唤到战场任意可用空格，无需邻近友军。',511:'可飞往任意可用空格；位于敌方半场时增加 3 攻击。',513:'登场时，其他所有友方随从增加 2 攻击，持续到回合结束。',525:'攻击冰墙的单位被眩晕，失去行动机会并跳过下回合行动。',
};
const heroSummaries = {
  1:'1费指令：附近友方随从永久增加 2 攻击；每回合首次附近召唤增加 1 生命。',
  23:'1费指令：友方随从恢复 3 生命；每回合首次实际治疗友军永久增加 1 攻击。',
  101:'1费指令：友方随从移至主将附近；每回合首次背刺额外造成 1 伤害。',
  123:'1费指令：主将附近召唤心猎者；每回合首次施法使友方远程随从增加 1 攻击。',
  201:'1费指令：主将附近召唤铁甲沙魔；己方召唤的沙魔永久增加 1 生命。',
  223:'1费指令：本回合攻击随从额外造成 2 伤害；每回合首次击杀敌方随从回复 2 生命。',
  301:'1费指令：附近召唤最多两个暗灵；每回合首个非衍生友方随从死亡时留下暗灵。',
  323:'1费指令：敌人受 1 伤害并留下腐化；每回合首次腐化伤害使己方主将回复 1 生命。',
  401:'1费指令：永久增加 1 攻击；每回合首次受伤存活后暂时增加 1 攻击。',
  418:'1费指令：存活阵营各抽 1 张；每回合首次召唤至少 3 费的随从时抽 1 张。',
  501:'1费指令：敌方主将受 2 伤害；召唤潜入随从时永久增加 1 生命。',
  527:'1费指令，每回合一次：本回合随后召唤的友方随从永久增加 1 攻击和 1 生命。',
};
export function cardRuleSummary(card) {
  if (!card) return '无特殊效果。';
  if (card.campaignSummary) return cleanCardCopy(card.campaignSummary);
  if (card.ranged || card.blast) {
    const range=cardAttackRange(card), reach=Number.isFinite(range)?`${range}格内`:'战场任意位置的';
    return card.blast?`攻击${reach}同排或同列敌人，并伤害该方向射程内的其他敌人。`:`可攻击${reach}敌人；目标能攻击到自身时仍会反击。`;
  }
  if (card.faction === 0) return card.description;
  if (card.type === 'general') {
    return heroSummaries[card.id] || '无特殊效果。';
  }
  if (card.type === 'spell') return spellSummaries[card.effect] || card.description || '无特殊效果。';
  return unitSummaries[card.id] || cleanCardCopy(card.description) || '无特殊效果。';
}
