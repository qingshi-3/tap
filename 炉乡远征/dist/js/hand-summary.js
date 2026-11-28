import { cardRuleSummary } from './card-rules.js';

// Up to three short lines for portrait cards; full timing/target rules remain in card details.
// These follow card-rules.js and the current engine, rather than historical printed descriptions.
const spells = {
  mistDragonSeal:'友军攻血+1\n传送所选空格',juxtaposition:'交换两个随从\n不刷新行动',siphonEnergy:'主将相邻敌军\n驱散能力增益',entropicDecay:'主将相邻敌军\n直接消灭',daemonicLure:'敌军受1伤害\n传送所选空格',darkTransformation:'消灭敌随从\n原格召己暗灵',naturalSelection:'全场最低攻击\n选择随从消灭',plasmaStorm:'敌我攻击≤3\n全部消灭',chromaticCold:'驱散一格\n敌人受1伤害',aspectRavager:'任意随从变为\n无能力3/3',
  roar:'主将相邻\n友方随从\n永久攻击+2',
  heal:'任一受伤单位\n恢复5生命',
  strike:'任一随从\n受到2伤害',
  tempest:'敌我全部单位\n受到2伤害',
  bond:'任一随从\n永久加攻击\n数值=当前生命',
  phoenixFire:'一名敌方单位\n受到3伤害',
  innerFocus:'攻击≤3的\n友方随从\n重置移动攻击',
  firstWish:'友方随从\n永久攻血+1\n抽1张牌',
  boneSwarm:'敌将及\n邻近敌军\n受到2伤害',
  voidPulse:'敌将受2伤害\n己将恢复3生命',
  wraithlingSwarm:'空格及附近\n最多召3暗灵',
  greaterFortitude:'一名友方随从\n永久攻血+2',
  earthSphere:'己方主将\n恢复8生命',
  flashFreeze:'任一随从\n受1伤害并眩晕',
  bonechillBarrier:'空格及附近\n最多召3冰墙\n攻击者眩晕',
};
const units = {
  14:'无特殊效果',9:'与主将相邻\n攻击+1',15:'任意治疗生效\n自身永久\n攻血+1',
  16:'与主将相邻\n回合末\n恢复全部生命',11:'嘲讽\n主将旁攻击+2',17:'全图空投\n嘲讽',
  110:'背刺1\n背后攻击加伤\n不受目标反击',115:'己方施法后\n永久攻血+1',109:'远程攻击\n任意敌人',
  111:'全图飞行\n背刺4\n背刺不受反击',116:'己方施法后\n敌将受1伤害\n己将恢复1血',
  213:'同排或同列\n直线伤害',211:'登场：友方沙魔\n永久攻血+2\n不再消散',214:'不能移动\n回合初召唤\n临时沙魔',
  209:'同排或同列\n直线伤害',215:'回合初召唤\n临时沙魔\n友方沙魔攻+1',216:'回合初召唤\n临时沙魔\n友方沙魔血+1',
  308:'回合末留腐化\n腐化地形伤敌1',317:'登场：附近\n召唤一名暗灵',311:'其他随从死亡\n永久攻血+1',
  309:'每格己方腐化\n自身攻血+1',310:'其他随从死亡\n附近召暗灵',316:'己方腐化\n伤害翻倍',
  406:'无特殊效果',412:'死亡留重生卵\n下回合初存活\n则重生',410:'登场：相邻\n友方随从\n永久攻血+2',
  402:'己方回合初\n永久攻血+1',404:'己方回合初\n永久攻血+4',413:'死亡留重生卵\n下回合初存活\n则重生',
  505:'敌方半场\n攻击+2',506:'亡愿：法力\n上限+1，最多9',503:'亡愿：原地\n召唤幽灵狼',
  526:'全图空格\n均可召唤',511:'全图飞行\n敌方半场\n攻击+3',513:'登场：其他\n友方随从\n本回合攻击+2',
  108:'远程攻击\n任意敌人',217:'临时沙魔\n立即行动\n己方回合末消散',225:'衍生随从',315:'衍生随从',
  411:'下回合初存活\n孵化为原随从',504:'衍生随从',525:'攻击者眩晕',
};
export function handSummary(card) {
  if (card.campaignMode !== undefined) {
    const summaries = {
      mistDragonSeal:`友军攻血+${card.attackBuff}\n传送所选空格`,daemonicLure:`敌随从受${card.amount}伤害\n传送所选空格`,chromaticCold:`驱散一格\n敌人受${card.amount}伤害`,plasmaStorm:`敌我攻击≤${card.maxAttack}\n全部消灭`,
      roar:`邻近友军攻击+${card.amount}`, heal:`任一受伤单位\n恢复${card.amount}生命`,
      strike:`任一随从\n受到${card.amount}伤害`, tempest:`敌我所有单位\n受到${card.amount}伤害`,
      bond:`攻击增加当前生命${card.bondBonus ? `+${card.bondBonus}` : ''}`, phoenixFire:`敌方单位\n受到${card.amount}伤害`,
      innerFocus:`攻击≤${card.maxAttack}友军\n恢复移动攻击`, firstWish:`友军攻血+${card.attackBuff}\n抽1张牌`,
      boneSwarm:`敌将及邻近敌军\n受到${card.amount}伤害`, voidPulse:`敌将受${card.amount}伤害\n己将回复${card.heal}`,
      wraithlingSwarm:`目标附近召${card.count}暗灵`, greaterFortitude:`友军永久攻血+${card.attackBuff}`,
      earthSphere:`己将恢复${card.heal}生命`, flashFreeze:`随从受${card.amount}伤害\n并眩晕`, bonechillBarrier:`召${card.count}冰墙\n攻击者眩晕`,
    };
    return (summaries[card.effect] ?? card.description) + (card.tactical ? '\n施法后主将恢复2生命' : '');
  }
  if (card.faction === 0) {
    return ({10021:'远程攻击\n任意敌人',19027:'嘲讽\n牵制相邻敌人',10981:'登场：缺血最多\n友军恢复2生命',10019:'全图空投',19037:'登场：附近友军\n本回合攻击+2',10012:'突袭\n召唤即能行动',19050:'亡愿：相邻友军\n当前与上限血+4'})[card.id] ?? card.description;
  }
  return card.type === 'spell' ? spells[card.effect] ?? cardRuleSummary(card) : units[card.id] ?? cardRuleSummary(card);
}
