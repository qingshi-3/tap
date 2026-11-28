import { EXPANSION_SPELL_IDS } from './expansion-mechanics.js';
import { CARD_ACQUISITION } from './campaign-content.js';
import { CARDS } from './cards.js';
import { FACTIONS } from './factions.js';
import { EXPEDITION_LEVELS } from './expedition-data.js';
import { starterInventory } from './battle-deck.js';

// These are permanent ownership milestones, independent of the active battle.
export const NEUTRAL_IDS = Object.freeze(CARD_ACQUISITION.filter(c=>c.type==='unit'&&c.faction===0).map(c=>c.id));
export const CAMPAIGN_UNIT_IDS = Object.freeze([...FACTIONS.flatMap(f=>f.unitIds),...NEUTRAL_IDS]);
export const SPELL_IDS = Object.freeze(FACTIONS.flatMap(f=>f.spellIds));
export const SPELL_TRAINING_COSTS = Object.freeze([60,100]);
export const GROWTH_VERSIONS = Object.freeze(['legacy-v1','low-v2']);
const milestones = new Map(CARD_ACQUISITION.map(c=>[c.id,c.acquisition==='initial'?0:c.acquisition==='campaign'?c.level:null]));
const LEGACY_IDS = new Set([14,9,15,16,11,17,110,115,109,108,111,116,213,211,214,209,215,216,308,317,311,309,310,316,406,412,410,402,404,413,505,506,503,526,511,513,20174,20043,20066,20044,20068,20081,20086,20095,20151,20052,20072,20116,20117,20139,20149]);
export function getCardAcquisition(id) { return CARD_ACQUISITION.find(c=>c.id===Number(id)) ?? null; }
export function isSpellTrainable(id) { return SPELL_IDS.includes(Number(id)) && !EXPANSION_SPELL_IDS.includes(Number(id)) && ![20129,20073,20077,20061,20125,20144].includes(Number(id)); }
export function getSpellTrainingPolicy(id) { const trainable=isSpellTrainable(id); return {trainable,reason:EXPANSION_SPELL_IDS.includes(Number(id))?'保留原版费用与效果，无需培养。':trainable?'强化式提升效果；战术式费用增加1，施放后主将恢复2生命。':'位移、驱散、消灭和变形法术无需培养，直接使用基础效果。',maxRank:trainable?2:0}; }
export function unlockedInventory(completed = [], { legacy = false } = {}) {
  const finished = new Set(completed);
  const owned = id => {
    if (legacy && LEGACY_IDS.has(id)) return true;
    const count = milestones.get(id);
    return count === 0 || finished.has(EXPEDITION_LEVELS[count - 1]?.id);
  };
  return { units: CAMPAIGN_UNIT_IDS.filter(owned), spells: SPELL_IDS.filter(owned) };
}
export function getUnlockRewards(levelId, factionId = null) {
  const count = EXPEDITION_LEVELS.findIndex(level => level.id === levelId) + 1;
  return { units: CAMPAIGN_UNIT_IDS.filter(id => milestones.get(id) === count && count > 0 && (factionId===null || CARDS[id].faction===0 || CARDS[id].faction===Number(factionId))),
    spells: SPELL_IDS.filter(id => milestones.get(id) === count && count > 0 && (factionId===null || CARDS[id].faction===0 || CARDS[id].faction===Number(factionId))) };
}
export function getUnlockLabel(id) {
  if(getCardAcquisition(id)?.acquisition==='recruitment')return '灵魂宝珠招募与碎片合成';
  const count = milestones.get(Number(id));
  return count === 0 ? '初始可用' : count ? `通关「${EXPEDITION_LEVELS[count - 1].title}」解锁` : '暂不可招募';
}
export function spellTrainingGate(rank) { return rank === 0 ? 3 : 6; }
const specialties = {
  bodyguard: { id: 'bodyguard', name: '协防', description: '每个己方回合开始重置：为相邻其他友军减免1次伤害，减免1点。' },
  skirmish: { id: 'skirmish', name: '游击', description: '每回合首次主动攻击后，可再次移动；不会恢复攻击机会。' },
  medic: { id: 'medic', name: '战地救护', description: '登场时，为损失生命最多的友军恢复2生命，包含主将；并列时选最早入场者。' },
};
export function getUnitSpecializations(id, growthVersion = 'low-v2') { return getUnitSpecializationsForCard(CARDS[id],growthVersion); }
export function getUnitSpecializationsForCard(card, growthVersion = 'low-v2') {
  const id=card?.id;
  if (!card || card.type !== 'unit' || !CAMPAIGN_UNIT_IDS.includes(Number(id))) return [];
  const pair = card.provoke ? ['bodyguard', 'medic']
    : card.obelysk || card.attack === 0 ? ['medic', 'bodyguard']
    : card.ranged || card.backstab || card.airdrop || card.rush ? ['skirmish', 'medic']
    : ['medic', 'skirmish'];
  return pair.map((key, i) => ({ ...specialties[key], rank: i === 0 || growthVersion === 'low-v2' ? 2 : 4 }));
}

export function getSpellUpgrade(cardId, rank = 0, mode = 'base') {
  const base = CARDS[cardId];
  if (!base || base.type !== 'spell') return base ? { ...base } : null;
  const level = !isSpellTrainable(cardId) ? 0 : Number.isInteger(rank) ? Math.max(0, Math.min(2, rank)) : 0;
  const activeMode = mode === 'power' && level >= 1 ? 'power' : mode === 'tactical' && level >= 2 ? 'tactical' : 'base';
  const boost = activeMode === 'power' ? level : 0;
  const card = { ...base, campaignRank: level, campaignMode: activeMode, tactical: activeMode === 'tactical' };
  if (card.tactical) card.cost += 1;
  switch (card.effect) {
    case 'mistDragonSeal': card.attackBuff=base.attackBuff+boost;card.healthBuff=base.healthBuff+boost;card.description=`友方随从永久增加${card.attackBuff}攻击和${card.healthBuff}生命，随后传送到所选空格。`;break;
    case 'daemonicLure': card.amount=base.amount+boost;card.description=`敌方随从受到${card.amount}伤害，存活时传送到所选空格。`;break;
    case 'chromaticCold': card.amount=base.amount+boost;card.description=`驱散一格单位与腐化；其中敌方单位随后受到${card.amount}伤害，可伤主将。`;break;
    case 'plasmaStorm': card.maxAttack=base.maxAttack+boost;card.description=`消灭全场当前攻击不超过${card.maxAttack}的随从，包含友军。`;break;
    case 'roar': card.amount = 2 + boost; card.description = `主将相邻一名友方随从永久增加${card.amount}攻击。`; break;
    case 'heal': card.amount = 5 + boost * 2; card.description = `任一受伤单位恢复${card.amount}生命，可选主将，敌我均可。`; break;
    case 'strike': card.amount = 2 + boost; card.description = `任一随从受到${card.amount}伤害，不能选择主将，敌我均可。`; break;
    case 'tempest': card.amount = 2 + boost; card.description = `全场单位受到${card.amount}伤害，包含友军和双方主将。`; break;
    case 'bond': card.bondBonus = boost * 2; card.description = `任一随从永久增加等同于其当前生命${card.bondBonus ? `加${card.bondBonus}` : ''}的攻击，敌我均可。`; break;
    case 'phoenixFire': card.amount = base.amount + boost; card.description = `一名敌方单位受到${card.amount}伤害，可选主将。`; break;
    case 'innerFocus': card.maxAttack = base.maxAttack + boost; card.description = `攻击不高于${card.maxAttack}的友方随从可立即移动和攻击；不解除眩晕。`; break;
    case 'firstWish': card.attackBuff = base.attackBuff + boost; card.healthBuff = base.healthBuff + boost; card.description = `友方随从永久增加${card.attackBuff}攻击与${card.healthBuff}生命，并抽1张牌。`; break;
    case 'boneSwarm': card.amount = base.amount + boost; card.description = `敌方主将及其相邻敌军受到${card.amount}伤害。`; break;
    case 'voidPulse': card.amount = base.amount + boost; card.heal = base.heal + boost; card.description = `敌方主将受到${card.amount}伤害，己方主将恢复${card.heal}生命。`; break;
    case 'wraithlingSwarm': card.count = base.count + boost; card.description = `在所选空格及附近召唤最多${card.count}名1/1暗灵。`; break;
    case 'greaterFortitude': card.attackBuff = base.attackBuff + boost; card.healthBuff = base.healthBuff + boost; card.description = `友方随从永久增加${card.attackBuff}攻击与${card.healthBuff}生命。`; break;
    case 'earthSphere': card.heal = base.heal + boost * 2; card.description = `己方主将恢复${card.heal}生命。`; break;
    case 'flashFreeze': card.amount = base.amount + boost; card.description = `任一随从受到${card.amount}伤害并眩晕，不能选择主将。`; break;
    case 'bonechillBarrier': card.count = base.count + boost; card.description = `在所选空格及附近召唤最多${card.count}面0/2冰墙；主动攻击冰墙的单位被眩晕。`; break;
  }
  // Rank two's alternative enables healing synergies at an explicit mana cost.
  if (card.tactical) card.description += '施放后，己方主将恢复2生命。';
  card.campaignSummary = card.description;
  return card;
}
