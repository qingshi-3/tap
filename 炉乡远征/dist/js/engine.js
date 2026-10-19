import {recordBattlePresentation,withBattlePresentationStage} from './battle-presentation-events.js';
import { RECRUITMENT_CARDS, RECRUITMENT_CARD_IDS, RECRUITMENT_UNIT_IDS } from './recruitment-cards.js';
import { EXPANSION_VERSION, RECRUITMENT_VERSION, TURN_START_DRAW_VERSION, usesTurnStartDraw, isRecruitmentExpansion, recruitmentStart, EXPANSION_CARDS, EXPANSION_IDS, EXPANSION_UNIT_IDS, EXPANSION_SPELL_IDS, EXPANSION_RACES, isExpansion, enemyHalf, actionQuota, randomIndex, buff, putCard, generatedCardId, drawMatching, openingFollowup, resolveOpening, expansionEvent, expansionEnd, validateExpansionState } from './expansion-mechanics.js';
import { cardAttackRange } from './attack-range.js';
import { CARDS, DECK_LIST, getCard } from './cards.js';
import { LEVELS } from './levels.js';
import { DEPLOYMENT_BUDGET, EXPEDITION_LEVELS, TRAINABLE_IDS, deploymentCost, trainingBonus } from './expedition-data.js';
import { getFaction, getHero } from './factions.js';
import { CONTENT_VERSION } from './campaign-content.js';
import { getSpellUpgrade, getUnitSpecializations, getUnitSpecializationsForCard, isSpellTrainable, NEUTRAL_IDS, CAMPAIGN_UNIT_IDS } from './campaign-rules.js';
import { validatePlayerDeck } from './battle-deck.js';
import { getEnemyPlan, validateEnemyPlan } from './enemy-plans.js';
import { HAND_LIMIT, SAVED_HAND_LIMIT } from './hand-rules.js';

export const BOARD = { columns: 9, rows: 5 };
export const MANA_TILES = [{ x: 4, y: 0 }, { x: 4, y: 4 }, { x: 5, y: 2 }];
const LEGACY_CAMPAIGN_UNIT_IDS = Object.freeze([14,9,15,16,11,17,110,115,109,108,111,116,213,211,214,209,215,216,308,317,311,309,310,316,406,412,410,402,404,413,505,506,503,526,511,513,10021,19027,10981,10019,19037,10012,19050]);
const SCHEMA7_NEW_CARD_IDS = Object.freeze([10001,10018,19026,10204,10013,10982,10017,10978,10020,19033,19034,19049,10207,10307,19042,10959,20168,20129,20073,20077,20049,20061,20125,20122,20134,20144,520]);
const SCHEMA7_UNIT_IDS = Object.freeze([...LEGACY_CAMPAIGN_UNIT_IDS,10001,10018,19026,10204,10013,10982,10017,10978,10020,19033,19034,19049,10207,10307,19042,10959]);
const SCHEMA7_CONTENT_VERSIONS = Object.freeze(['campaign-2026-10-13-v1',EXPANSION_VERSION,RECRUITMENT_VERSION,TURN_START_DRAW_VERSION]);
const expansionSpellOwners=new WeakMap();
const battleCardIds=state=>state.schemaVersion===7?[...SCHEMA5_CARD_IDS,...SCHEMA7_NEW_CARD_IDS,...(isExpansion(state)?EXPANSION_IDS:[]),...(isRecruitmentExpansion(state)?RECRUITMENT_CARD_IDS:[])]:SCHEMA5_CARD_IDS;
const battleUnitIds=state=>state.schemaVersion===7?[...SCHEMA7_UNIT_IDS,...(isExpansion(state)?EXPANSION_UNIT_IDS:[]),...(isRecruitmentExpansion(state)?RECRUITMENT_UNIT_IDS:[])]:LEGACY_CAMPAIGN_UNIT_IDS;
const MAX_TURNS = 60;
const LEGACY_TRAINABLE_IDS = [9, 11, 14, 15, 16, 17];
// Frozen schema-4 roster: unfinished battles keep their original training snapshot.
const SCHEMA4_ORIGINAL_TRAINABLE_IDS = Object.freeze([14,9,15,16,11,17,110,115,109,213,211,214,308,317,311,406,412,410,505,506,503]);
const SCHEMA4_FULL_TRAINABLE_IDS = Object.freeze([14,9,15,16,11,17,110,115,109,108,111,116,213,211,214,209,215,216,308,317,311,309,310,316,406,412,410,402,404,413,505,506,503,526,511,513]);
// Schema 5's complete rules closure includes every token and death/entry summon.
// Freeze this contract rather than making saved battles depend on future card additions.
const SCHEMA5_CARD_IDS = Object.freeze([1,9,11,14,15,16,17,23,101,108,109,110,111,115,116,123,201,209,211,213,214,215,216,217,223,225,301,308,309,310,311,315,316,317,323,401,402,404,406,410,411,412,413,418,501,503,504,505,506,511,513,525,526,527,10012,10019,10021,10981,19027,19037,19050,20043,20044,20052,20066,20068,20072,20081,20086,20095,20116,20117,20139,20149,20151,20174]);
let nextUnitId = 1;
const botSessions = new WeakMap();
const refreshingAuras = new WeakSet();
// Only this run's provisional completion can be withdrawn when a later casualty
// from the same effect changes a win to a loss. Historical clears are untouched.
const provisionalTrialClears = new WeakMap();
function recordTrialResult(state) {
  if (state.mode !== 'challenge') return;
  if (state.winner === 0) {
    if (!state.completedLevels.includes(state.levelId)) {
      state.completedLevels.push(state.levelId);
      provisionalTrialClears.set(state, { runId: state.runId, levelId: state.levelId });
    }
  } else {
    const provisional = provisionalTrialClears.get(state);
    if (provisional?.runId === state.runId && provisional.levelId === state.levelId) {
      state.completedLevels = state.completedLevels.filter((id) => id !== provisional.levelId);
      provisionalTrialClears.delete(state);
    }
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clone = (value) => JSON.parse(JSON.stringify(value));
export const boardOf = (state) => state?.board ?? BOARD;
export const isTacticalMatch = (state) => state?.mode === 'expedition' || state?.mode === 'challenge' && state?.schemaVersion === 4;
const withinBoard = (x, y, board = BOARD) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < board.columns && y < board.rows;
const newRunId = () => globalThis.crypto?.randomUUID?.() ?? `duelyst-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
export const distance = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

// Optional challenge-only context stays outside strict historical snapshots.
const challengeContexts = new WeakMap();
const nextChallengeRandom = context => {
  context.rng = (Math.imul(context.rng,1664525)+1013904223)>>>0;
  return context.rng/4294967296;
};
function battleRandom(state) {
  const context=challengeContexts.get(state);
  if(!context)return Math.random();
  // Expansion effects advance this existing validated field too: one stream.
  if(isExpansion(state))context.rng=state.expansionRandom;
  const value=nextChallengeRandom(context);
  if(isExpansion(state))state.expansionRandom=context.rng;
  return value;
}
export function bindChallengeContext(state, data) {
  if(!Number.isInteger(data?.rng)||data.rng<0||data.rng>4294967295||!Number.isSafeInteger(data.deaths)||data.deaths<0)throw new Error('Invalid challenge context');
  if(isExpansion(state)&&state.expansionRandom!==data.rng)throw new Error('Challenge random state mismatch');
  challengeContexts.set(state,{rng:data.rng,deaths:data.deaths});
}
export function challengeContext(state) {
  const context=challengeContexts.get(state);
  return context?{rng:isExpansion(state)?state.expansionRandom:context.rng,deaths:context.deaths}:null;
}
export function unbindChallengeContext(state) {challengeContexts.delete(state);}
function shuffled(values, random = Math.random) {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function makePlayer(id, name, generalId, ai) {
  const deck = shuffled(DECK_LIST);
  const hand = deck.splice(0, 5);
  return { id, name, generalId, ai, deck, hand, maxMana: 2, mana: 2, turnsStarted: 0, bbsUsed: false, wins: 0 };
}

function createUnit(cardId, owner, x, y, extra = {}, training = null) {
  const card = getCard(cardId);
  const bonus = owner === 0 && training && TRAINABLE_IDS.includes(cardId) ? trainingBonus(cardId, training[cardId] ?? 0) : { attack: 0, health: 0 };
  return {
    unitId: nextUnitId++, cardId, owner, x, y,
    attack: card.attack + bonus.attack, maxHealth: card.health + bonus.health, health: card.health + bonus.health,
    attackBuff: 0, healthBuff: 0, moved: true, attacked: true,
    summonedThisTurn: true, token: false, reborn: false, ...extra
  };
}

function isSchema4(state) { return [4, 5, 6, 7].includes(state?.schemaVersion); }
function heroOf(state, playerId) { return isSchema4(state) ? getHero(state.players[playerId]?.generalId) : null; }
function resetTurnTriggers(player) {
  player.turnTriggers = { adjacentSummon: false, heal: false, backstab: false, spell: false, minionKill: false, nonTokenDeath: false, creepDamage: false, survivedGeneralDamage: false, costlySummon: false, summon: false };
  delete player.bbsMinionAttackBonus;
  delete player.summonBuffThisTurn;
}

export function createMatch() {
  nextUnitId = 1;
  const human = makePlayer(0, '你', 1, false);
  const bot = makePlayer(1, '齐兰', 23, true);
  return {
    schemaVersion: 1,
    attackRangeVersion: 1,
    mode: 'local-ai',
    runId: newRunId(),
    revision: 0,
    phase: 'mulligan',
    currentPlayer: 0,
    round: 0,
    turnSerial: 0,
    players: [human, bot],
    units: [createUnit(1, 0, 0, 2), createUnit(23, 1, 8, 2)],
    manaTiles: clone(MANA_TILES),
    mulligan: [],
    log: ['将军登场。起手牌可替换至多两张。'],
    winner: null,
    result: null,
    selectedUnitId: null,
    lastAction: null,
    playtimeSeconds: 0
  };
}

export function getLevel(levelId) {
  return EXPEDITION_LEVELS.find((level) => level.id === levelId) ?? LEVELS.find((level) => level.id === levelId) ?? EXPEDITION_LEVELS[0] ?? LEVELS[0];
}


// Required schema-5 mechanics are versioned separately from mutable content.
const SCHEMA5_GENERAL_IDS = Object.freeze([1,23,101,123,201,223,301,323,401,418,501,527]);
const SCHEMA5_UNIT_MECHANICS = Object.freeze({
  9:{zeal:'number'},11:{zeal:'number',provoke:true},15:{healWatch:true},16:{zealHeal:true},17:{airdrop:true,provoke:true},
  108:{ranged:true},109:{ranged:true},110:{backstab:'number'},111:{flying:true,backstab:'number'},115:{spellWatch:true},116:{spellWatchLeech:'number'},
  209:{blast:true},211:{openingBuff:'number'},213:{blast:true},214:{obelysk:true,openingDervish:true},215:{obelysk:true,openingDervish:true,dervishAuraAttack:'number'},216:{obelysk:true,openingDervish:true,dervishAuraHealth:'number'},217:{dervish:true,token:true},225:{token:true},
  308:{creepTrail:true},309:{creepStats:'number'},310:{deathWatchSpawn:315},311:{deathWatch:true},315:{token:true},316:{creepDamageMultiplier:'number'},317:{openingWraith:true},
  402:{grow:'number'},404:{grow:'number'},410:{openingBuff:'number'},411:{token:true},412:{rebirth:true},413:{rebirth:true},503:{dyingWolf:504},504:{token:true},505:{infiltrate:'number'},506:{manaWisp:true},511:{flying:true,infiltrate:'number'},513:{openingAlliedAttack:'number'},525:{wall:true,token:true},526:{airdrop:true},
  10012:{rush:true},10019:{airdrop:true},10021:{ranged:true},10981:{openingHeal:'number'},19027:{provoke:true},19037:{openingTempAttack:'number'},19050:{dyingAlliedHealth:'number'},
});
const SCHEMA5_SPELL_RULES = Object.freeze({
  20043:{effect:'heal',numeric:['amount']},20044:{effect:'tempest',numeric:['amount']},20066:{effect:'strike',numeric:['amount']},20068:{effect:'bond',numeric:['bondBonus']},20174:{effect:'roar',numeric:['amount']},
  20052:{effect:'voidPulse',target:'enemy',numeric:['amount','heal']},20072:{effect:'wraithlingSwarm',target:'cell',numeric:['count'],summon:315},
  20081:{effect:'phoenixFire',target:'enemy',numeric:['amount']},20086:{effect:'innerFocus',target:'ally',numeric:['maxAttack'],refresh:true},
  20095:{effect:'firstWish',target:'ally',numeric:['attackBuff','healthBuff','draw']},20116:{effect:'greaterFortitude',target:'ally',numeric:['attackBuff','healthBuff']},
  20117:{effect:'earthSphere',target:'self',numeric:['heal']},20139:{effect:'flashFreeze',target:'minion',numeric:['amount'],stun:true},
  20149:{effect:'bonechillBarrier',target:'cell',numeric:['count'],summon:525},20151:{effect:'boneSwarm',target:'enemyArea',numeric:['amount']},
});
const SCHEMA7_UNIT_MECHANICS = Object.freeze({10001:{flying:true},19026:{provoke:true},10013:{openingDrawBoth:'number'},10982:{dyingDraw:'number'},10017:{ranged:true},10020:{openingDispel:true},19033:{flying:true},19034:{flying:true},19049:{damageDraw:'number'},10307:{frenzy:true},19042:{openingDamageNearby:'number'},10959:{openingDamageFront:'number'},520:{token:true}});
const SCHEMA7_SPELL_RULES = Object.freeze({20168:{effect:'mistDragonSeal',target:'ally',numeric:['attackBuff','healthBuff'],followup:'teleport'},20129:{effect:'juxtaposition',target:'minion',numeric:[],followup:'swap'},20073:{effect:'siphonEnergy',target:'enemyMinion',numeric:[],nearGeneral:true},20077:{effect:'entropicDecay',target:'enemyMinion',numeric:[],nearGeneral:true},20049:{effect:'daemonicLure',target:'enemyMinion',numeric:['amount'],followup:'teleport'},20061:{effect:'darkTransformation',target:'enemyMinion',numeric:[],deathSpawn:315},20125:{effect:'naturalSelection',target:'lowestAttack',numeric:[]},20122:{effect:'plasmaStorm',target:'allMinions',numeric:['maxAttack']},20134:{effect:'chromaticCold',target:'occupiedCell',numeric:['amount']},20144:{effect:'aspectRavager',target:'minion',numeric:[],transform:520}});
function validRequiredRules(id, card, schema=5) {
  const spell = SCHEMA5_SPELL_RULES[id] ?? (schema===7?SCHEMA7_SPELL_RULES[id]:null);
  if (spell) {
    if (card.effect !== spell.effect || card.target !== spell.target || spell.numeric.some(key => !Number.isInteger(card[key]) || card[key] < 0 || card[key] > 100)) return false;
    return ['summon','refresh','stun','followup','nearGeneral','deathSpawn','transform'].every(key => spell[key] === undefined || card[key] === spell[key]);
  }
  const mechanics = SCHEMA5_UNIT_MECHANICS[id] ?? (schema===7?SCHEMA7_UNIT_MECHANICS[id]:null) ?? {};
  return Object.entries(mechanics).every(([key,required]) => required === 'number' ? Number.isInteger(card[key]) && card[key] > 0 && card[key] <= 100 : card[key] === required);
}
function freezeBattleCard(card, owner = 0) {
  if (owner > 0 && card.effect === 'firstWish') card = {...card, description:card.description.replace('补给1次','抽1张牌'), campaignSummary:card.campaignSummary?.replace('补给1次','抽1张牌')};
  return Object.fromEntries(Object.entries(card).filter(([key]) => !['sprite','art'].includes(key)));
}
// Pure construction shared by current content battles and challenge validation.
// It never creates a match, allocates unit IDs, reads RNG or mutates source cards.
export function createContentBattleCardTables(enemyPlan,loadout={spellTraining:{},spellModes:{}}) {
  const recruited=[RECRUITMENT_VERSION,TURN_START_DRAW_VERSION].includes(CONTENT_VERSION);
  const expanded=[EXPANSION_VERSION,RECRUITMENT_VERSION,TURN_START_DRAW_VERSION].includes(CONTENT_VERSION);
  const ids=[...SCHEMA5_CARD_IDS,...SCHEMA7_NEW_CARD_IDS,...(expanded?EXPANSION_IDS:[]),...(recruited?RECRUITMENT_CARD_IDS:[])];
  const tables=Object.fromEntries([0,...Object.keys(enemyPlan.players).map(Number)].map(owner=>[owner,Object.fromEntries(ids.map(id=>{
    const base=getCard(id),card=freezeBattleCard(base.type==='spell'?getSpellUpgrade(id,owner===0?loadout.spellTraining[id]??0:enemyPlan.players[owner]?.spellRank??0,owner===0?loadout.spellModes[id]??'base':'power'):base,owner);
    if(expanded&&EXPANSION_RACES[id]!==undefined)card.race=EXPANSION_RACES[id];
    if(card.effect==='firstWish'){card.description=card.description.replace('补给1次','抽1张牌');card.campaignSummary=card.campaignSummary.replace('补给1次','抽1张牌');}
    return [id,card];
  }))]));
  for(const [owner,plan]of Object.entries(enemyPlan.players)){
    for(const [id,stats]of Object.entries(plan.unitStats))Object.assign(tables[owner][id],stats);
    tables[owner][plan.generalId].attack=plan.generalAttack;
    tables[owner][plan.generalId].health=plan.generalHealth;
  }
  return tables;
}
function validFrozenCard(id, card, schema=5, expanded=false, recruited=false) {
  if(expanded&&card?.race!==(recruited?RECRUITMENT_CARDS[id]?.race??EXPANSION_RACES[id]:EXPANSION_RACES[id]))return false;
  if(expanded&&EXPANSION_IDS.includes(Number(id))) {const base=EXPANSION_CARDS[id];if(!card||card.type!==base.type||Object.entries(base).some(([k,v])=>!['description','name','cost','attack','health','sprite','art'].includes(k)&&card[k]!==v))return false;}
  if(recruited&&RECRUITMENT_CARD_IDS.includes(Number(id))){const base=RECRUITMENT_CARDS[id];if(!card||card.type!==base.type||Object.entries(base).some(([k,v])=>!['description','name','cost','attack','health','sprite','art'].includes(k)&&card[k]!==v))return false;}
  const rule = SCHEMA5_SPELL_RULES[id] ?? (schema===7?SCHEMA7_SPELL_RULES[id]:null) ?? (expanded&&EXPANSION_CARDS[id]?.type==='spell'?EXPANSION_CARDS[id]:null), expectedType = rule ? 'spell' : SCHEMA5_GENERAL_IDS.includes(Number(id)) ? 'general' : 'unit';
  if (!(schema===7?[...SCHEMA5_CARD_IDS,...SCHEMA7_NEW_CARD_IDS,...(expanded?EXPANSION_IDS:[]),...(recruited?RECRUITMENT_CARD_IDS:[])]:SCHEMA5_CARD_IDS).includes(Number(id)) || !card || card.id !== Number(id) || card.type !== expectedType || !validRequiredRules(id, card,schema) || !['general','unit','spell'].includes(card.type) || typeof card.name !== 'string' || typeof card.description !== 'string') return false;
  if (Object.hasOwn(card,'attackRange') && (card.type === 'spell' || !Number.isInteger(card.attackRange) || card.attackRange < 1 || card.attackRange > 100)) return false;
  if (card.type !== 'general' && (!Number.isInteger(card.cost) || card.cost < 0 || card.cost > 30)) return false;
  if (card.type !== 'spell' && (!Number.isInteger(card.attack) || card.attack < 0 || card.attack > 100 || !Number.isInteger(card.health) || card.health < 1 || card.health > 100)) return false;
  if (card.type === 'spell' && (card.tactical !== (card.campaignMode === 'tactical') || card.campaignMode === 'tactical' && card.campaignRank !== 2 || card.campaignMode === 'power' && card.campaignRank < 1 || !Number.isInteger(card.campaignRank) || card.campaignRank < 0 || card.campaignRank > 2 || !['base','power','tactical'].includes(card.campaignMode) || typeof card.tactical !== 'boolean')) return false;
  return Object.entries(card).every(([key,value]) => typeof value === 'number' ? Number.isFinite(value) && (value >= 0 || expanded&&key==='openingStatHealth'&&value===-2) && value <= (['id','summon','hatchCardId','dyingWolf','deathWatchSpawn','deathSpawn','transform','damageGenerate','handSummonSpawn','dyingSpawn','openingGrantDyingSpawnToAllies'].includes(key) ? 100000 : 100) : ['string','boolean'].includes(typeof value));
}
function validLoadout(loadout, faction, training, squad, frozenCards = null) {
  if (!loadout || typeof loadout !== 'object' || Array.isArray(loadout) || !Array.isArray(loadout.spells) || loadout.spells.length !== 2 || new Set(loadout.spells).size !== 2 || loadout.spells.some(id => !faction.spellIds.includes(id))) return false;
  for (const key of ['spellTraining','spellModes','specializations']) if (!loadout[key] || typeof loadout[key] !== 'object' || Array.isArray(loadout[key])) return false;
  if(loadout.growthVersion && Object.entries(loadout.spellTraining).some(([id,rank])=>!isSpellTrainable(Number(id))&&rank!==0))return false;
  if (Object.entries(loadout.spellTraining).some(([id,rank]) => getCard(Number(id))?.type !== 'spell' || !Number.isInteger(rank) || rank < 0 || rank > 2)) return false;
  if (Object.entries(loadout.spellModes).some(([id,mode]) => getCard(Number(id))?.type !== 'spell' || !['base','power','tactical'].includes(mode) || mode === 'power' && !(loadout.spellTraining[id] >= 1) || mode === 'tactical' && loadout.spellTraining[id] !== 2)) return false;
  if (Object.entries(loadout.specializations).some(([id,choice]) => !CAMPAIGN_UNIT_IDS.includes(Number(id)) || choice !== 'none' && !(frozenCards?getUnitSpecializationsForCard(frozenCards[id],loadout.growthVersion?.[id]??'legacy-v1'):getUnitSpecializations(Number(id),loadout.growthVersion?.[id]??'legacy-v1')).some(spec => spec.id === choice && training[id] >= spec.rank))) return false;
  return Array.isArray(squad) && squad.every(id => CAMPAIGN_UNIT_IDS.includes(id));
}
export function getBattleCard(state, cardId, owner = 0) {
  const frozen = [5, 6, 7].includes(state?.schemaVersion);
  const card = frozen ? state.battleCards?.[owner]?.[cardId] ?? null : getCard(cardId);
  if (!card) return null;
  const view = frozen ? {...card, sprite:getCard(cardId)?.sprite, art:getCard(cardId)?.art} : {...card};
  // Old matches retain their original unlimited geometry, including unfrozen schema1–4.
  // Never rewrite either their persisted card snapshot or the current content table.
  if (state?.attackRangeVersion !== 1) delete view.attackRange;
  if(isExpansion(state)&&view.type==='spell')view.cost+=state.players[owner]?.spellTax??0;
  return view;
}

export function canUseHandCard(state, index, owner = 0) {
  const player = state?.players?.[owner];
  return !!player && Number.isInteger(index) && index >= 0 && index < player.hand.length && (state.schemaVersion !== 5 || owner !== 0 || state.campaignSupply.remaining[index] > 0);
}
// Silence removes battlefield modifiers and intrinsic abilities, while authored
// base stats (including permanent out-of-battle growth) remain the printed body.
export function getUnitBattleCard(state,unit) {
  return getBattleCard(state,unit.cardId,isRecruitmentExpansion(state)?unit.controlledFromOwner??unit.owner:unit.owner);
}
function unitRuleCard(state, unit) {
  const card=getUnitBattleCard(state,unit);
  if(!card)return null;
  const rule=state.schemaVersion===7&&unit.silenced
    ? Object.fromEntries(Object.entries(card).filter(([key])=>['id','name','type','faction','cost','attack','health','description','sprite','art'].includes(key)||isExpansion(state)&&key==='race')) : card;
  // Silence strips the printed abilities, not race or abilities granted later.
  if(isExpansion(state)){if(unit.generalImmuneBuff)rule.generalImmune=true;if(unit.flyingBuff)rule.flying=true;if(unit.frenzyBuff)rule.frenzy=true;}
  return rule;
}
export function dispelCell(state, x, y) {
  if(state.schemaVersion!==7 || !withinBoard(x,y,boardOf(state)))return false;
  delete state.creepCells[`${x},${y}`];
  const unit=occupiedUnit(state,x,y);
  if(unit) {
    unit.silenced=true;unit.attackBuff=0;unit.healthBuff=0;unit.health=Math.min(unit.health,unit.maxHealth);
    for(const key of ['specialization','tempAttackBuff','tempHeroAttackBuff','tempAlliedAttackBuff','auraAttackBuff','auraHealthBuff','stunTurns','provokeBuff','hatchCardId','expiresEndTurn','dervish','deathWatchBuff','generalImmuneBuff','flyingBuff','frenzyBuff','tempDebuff','debuffOwner','grantedDyingSpawns'])delete unit[key];
    if(unit.owner===0&&!unit.token&&getCard(unit.cardId).type==='unit')unit.specialization='none';
  }
  if(isExpansion(state)&&unit&&!unit.summonedThisTurn&&!unit.stunTurns){if(unit.movesUsed!==undefined)unit.moved=unit.movesUsed>=1;if(unit.attacksUsed!==undefined)unit.attacked=unit.attacksUsed>=1;}
  refreshAuras(state);return true;
}
export function getOpeningFollowup(state, cardId, deployCell, owner=0, primaryId=null) {
  const card=getBattleCard(state,cardId,owner);
  if(isExpansion(state)&&deployCell){const expanded=openingFollowup(state,card,deployCell,owner,primaryId,expansionApi(state));if(expanded)return expanded;}
  if(state.schemaVersion!==7||!card?.openingDispel||!deployCell)return null;
  const cells=[];for(let y=deployCell.y-1;y<=deployCell.y+1;y++)for(let x=deployCell.x-1;x<=deployCell.x+1;x++)if((x!==deployCell.x||y!==deployCell.y)&&withinBoard(x,y,boardOf(state)))cells.push({x,y});
  return {type:'cell',optional:true,cells};
}
export function getSpellFollowup(state, spell, primaryId, owner=0) {
  spell=getBattleCard(state,spell?.id??spell,owner);
  if(state.schemaVersion!==7||!spell?.followup)return null;
  if(!spellTargets(state,spell,owner).some(unit=>unit.unitId===primaryId))return null;
  if(isExpansion(state)&&spell.followup==='killEnemy')return {type:'unit',unitIds:state.units.filter(u=>u.owner!==owner&&unitRuleCard(state,u)?.type==='unit'&&!unitRuleCard(state,u)?.spellImmune).map(u=>u.unitId)};
  if(spell.followup==='swap')return {type:'unit',unitIds:spellTargets(state,spell,owner).filter(unit=>unit.unitId!==primaryId).map(unit=>unit.unitId)};
  return {type:'cell',cells:spellPositions(state,spell,owner,primaryId)};
}
function destroyUnit(state, unit, owner) {
  if(!unit||!state.units.includes(unit))return false;
  unit.health=0;
  takeDamage(state,unit,0,{auraRemoval:true,destroy:true,sourceOwner:owner});
  return true;
}
function transformUnit(state, unit, cardId) {
  const body=getBattleCard(state,cardId,unit.owner);if(!body)return false;
  for(const key of ['specialization','tempAttackBuff','tempHeroAttackBuff','tempAlliedAttackBuff','auraAttackBuff','auraHealthBuff','stunTurns','provokeBuff','hatchCardId','expiresEndTurn','dervish','deathWatchBuff','generalImmuneBuff','flyingBuff','frenzyBuff','tempDebuff','debuffOwner','grantedDyingSpawns'])delete unit[key];
  Object.assign(unit,{cardId,attack:body.attack,health:body.health,maxHealth:body.health,attackBuff:0,healthBuff:0,token:true,reborn:false,silenced:false,bodyguardUsed:false,skirmishUsed:false});
  refreshAuras(state);return true;
}

function mostWounded(state, owner) {
  return state.units.filter(unit => unit.owner === owner && unit.health > 0 && unit.health < unit.maxHealth + unit.healthBuff).sort((a,b) => (b.maxHealth+b.healthBuff-b.health)-(a.maxHealth+a.healthBuff-a.health) || a.unitId-b.unitId)[0];
}
function applyCampaignUnit(state, unit) {
  const card = unitRuleCard(state, unit);
  if (!card || card.type !== 'unit' || unit.token) return;
  if (unit.owner === 0) {
    unit.specialization = state.loadout.specializations[unit.cardId] ?? 'none';
  } else if (state.schemaVersion!==7) {
    const plan = state.enemyPlan.players[unit.owner];
    unit.attack += plan.attackBonus; unit.maxHealth += plan.healthBonus; unit.health += plan.healthBonus;
  }
  unit.bodyguardUsed = false; unit.skirmishUsed = false;
  if (card.rush) { unit.summonedThisTurn = false; unit.moved = false; unit.attacked = false; }
  if (card.openingHeal || unit.specialization === 'medic') triggerHeal(state, mostWounded(state, unit.owner), (card.openingHeal ?? 0) + (unit.specialization === 'medic' ? 2 : 0));
  if (card.openingTempAttack) {
    const ally = state.units.filter(other => other.unitId !== unit.unitId && other.owner === unit.owner && other.health > 0 && getCard(other.cardId)?.type === 'unit' && isNear(other, unit)).sort((a,b) => a.unitId-b.unitId)[0];
    if (ally) { ally.attackBuff += card.openingTempAttack; ally.tempAlliedAttackBuff = (ally.tempAlliedAttackBuff ?? 0) + card.openingTempAttack; }
  }
}
const PLAYER_DRAW_RULES = Object.freeze({openingHandSize:5,drawPerTurn:1,handLimit:6,fatigueDamage:2,replacePerTurn:1,shuffleDeck:true});
function drawRules(owner, plan, fatigueVersion) {
  if (owner === 0) return {...PLAYER_DRAW_RULES,...(fatigueVersion===1?{fatigueDamage:1}:{})};
  return {openingHandSize:plan?.openingHandSize ?? 3,drawPerTurn:plan?.drawPerTurn ?? 1,handLimit:plan?.handLimit ?? 8,fatigueDamage:fatigueVersion===1?1:plan?.fatigueDamage ?? 2,replacePerTurn:plan?.replacePerTurn ?? 0,shuffleDeck:plan?.shuffleDeck ?? false};
}
function validDrawBattle(state) {
  if (!validateEnemyPlan(state.enemyPlan,state.levelId,state.players.filter(player=>player.id!==0).map(player=>player.id))) return false;
  if (state.campaignSupply !== undefined || !state.deckRules || Object.keys(state.deckRules).length !== state.players.length || !validatePlayerDeck(state.loadout?.deck,state.players[0].generalId)) return false;
  if (!Array.isArray(state.mulligan) || state.mulligan.length>2 || new Set(state.mulligan).size !== state.mulligan.length || state.mulligan.some(index=>!Number.isInteger(index)||index<0||index>=state.players[0].hand.length) || state.phase !== 'mulligan' && state.mulligan.length) return false;
  for (const player of state.players) {
    const rules=state.deckRules[player.id];
    if (!rules || Object.keys(rules).length !== 6 || ['openingHandSize','drawPerTurn','handLimit','fatigueDamage','replacePerTurn'].some(key=>!Number.isInteger(rules[key])||rules[key]<0||rules[key]>30) || rules.handLimit<1 || rules.openingHandSize>rules.handLimit || rules.drawPerTurn>10 || rules.replacePerTurn>5 || typeof rules.shuffleDeck!=='boolean') return false;
    if (player.id>0 && (!state.enemyPlan?.players?.[player.id] || Object.keys(PLAYER_DRAW_RULES).some(key=>!Object.hasOwn(state.enemyPlan.players[player.id],key)))) return false;
    if(state.fatigueVersion===1&&player.id>0&&state.enemyPlan.players[player.id].fatigueDamage!==1)return false;
    const expected=drawRules(player.id,state.enemyPlan?.players?.[player.id],state.fatigueVersion);
    if (Object.keys(expected).some(key=>rules[key]!==expected[key]) || !Number.isInteger(player.replacesUsed) || player.replacesUsed<0 || player.replacesUsed>rules.replacePerTurn || player.hand.length>rules.handLimit) return false;
    const original=player.id===0?state.loadout.deck:state.enemyPlan?.players?.[player.id]?.deck;
    if (!Array.isArray(original) || original.some(id=>!battleCardIds(state).includes(id)||getCard(id)?.type==='general')) return false;
    const counts=new Map(); for (const id of original) counts.set(id,(counts.get(id)??0)+1);
    // Expansion generation is persisted separately from the original 30-card
    // loadout. The source receipt is validated against frozen card mechanics.
    if(isExpansion(state))for(const [source,count]of Object.entries(player.generatedBySource??{})){
      const id=generatedCardId(state,player.id,source),total=(counts.get(id)??0)+count;
      if(!Number.isSafeInteger(total))return false;
      counts.set(id,total);
    }
    for (const id of [...player.hand,...player.deck]) { counts.set(id,(counts.get(id)??0)-1); if(counts.get(id)<0)return false; }
    const generals=state.units.filter(unit=>unit.owner===player.id&&getCard(unit.cardId)?.type==='general');
    if (generals.length>1 || generals.some(unit=>unit.cardId!==player.generalId) || state.phase!=='over'&&player.id===0&&generals.length!==1) return false;
  }
  if (state.phase==='mulligan' && (state.currentPlayer!==0 || state.round!==0 || state.turnSerial!==0 || state.players[0].turnsStarted!==0 || state.players[0].replacesUsed!==0 || state.players[0].hand.length!==5 || state.players[0].deck.length!==25 || state.units.filter(unit=>unit.owner===0).length!==1)) return false;
  return true;
}
export function canReplaceHandCard(state, index, owner = 0) {
  const player=state?.players?.[owner], rules=state?.deckRules?.[owner];
  return [6,7].includes(state?.schemaVersion) && canPlay(state,owner) && !!player && !!rules && Number.isInteger(index) && index>=0 && index<player.hand.length && player.deck.length>0 && player.replacesUsed<rules.replacePerTurn;
}
export function replaceHandCard(state, index, owner = 0) {
  if (!canReplaceHandCard(state,index,owner)) return false;
  const player=state.players[owner], original=player.hand[index];
  const different=player.deck.map((id,i)=>({id,i})).filter(entry=>entry.id!==original);
  const pick=different.length ? different[state.deckRules[owner].shuffleDeck ? Math.floor(battleRandom(state)*different.length) : 0].i : 0;
  const replacement=player.deck.splice(pick,1)[0];
  player.hand[index]=replacement; player.deck.push(original);
  recordBattlePresentation(state,{kind:'replace',owner,cardId:replacement,previousCardId:original,handIndex:index});
  if(state.deckRules[owner].shuffleDeck)player.deck=shuffled(player.deck,()=>battleRandom(state));
  player.replacesUsed++;
  addLog(state,`${player.name}替换了一张手牌。`);
  state.lastAction={kind:'replace',cardId:replacement,handIndex:index,playerId:owner};
  return true;
}

function validCampaignSnapshot(state) {
  const faction = getFaction(getHero(state.players[0].generalId)?.faction), supply = state.campaignSupply;
  const unitIds=battleUnitIds(state),cardIds=battleCardIds(state);
  if (state.schemaVersion===7 && (!SCHEMA7_CONTENT_VERSIONS.includes(state.contentVersion) || !state.loadout?.growthVersion || Object.keys(state.loadout.growthVersion).length!==unitIds.length || unitIds.some(id=>!['legacy-v1','low-v2'].includes(state.loadout.growthVersion[id])))) return false;
  if(state.schemaVersion===7 && unitIds.some(id=>{const expected=trainingBonus(id,state.training?.[id],state.loadout.growthVersion[id]);return state.unitGrowth?.[id]?.attack!==expected.attack||state.unitGrowth?.[id]?.health!==expected.health;}))return false;
  if (!state.unitGrowth || Object.keys(state.unitGrowth).length !== unitIds.length || unitIds.some(id => !state.unitGrowth[id] || ['attack','health'].some(key => !Number.isInteger(state.unitGrowth[id][key]) || state.unitGrowth[id][key] < 0 || state.unitGrowth[id][key] > 20))) return false;
  if (!faction || !state.training || Object.keys(state.training).length !== unitIds.length || unitIds.some(id => !Number.isInteger(state.training[id]) || state.training[id] < 0 || state.training[id] > 4) || !validLoadout(state.loadout,faction,state.training,state.squad,state.battleCards?.[0])) return false;
  if (state.schemaVersion === 5 && (!supply || JSON.stringify(supply.capacity) !== '[1,1,3,3,3]' || !Array.isArray(supply.remaining) || supply.remaining.length !== 5 || supply.remaining.some((n,i) => !Number.isInteger(n) || n < 0 || n > supply.capacity[i]) || !Number.isInteger(supply.resupply) || supply.resupply < 0 || supply.resupply > 3)) return false;
  if (state.schemaVersion === 5 && (state.players[0].deck.length || JSON.stringify(state.players[0].hand) !== JSON.stringify([...state.squad,...state.loadout.spells]))) return false;
  if ([6,7].includes(state.schemaVersion) && !validDrawBattle(state)) return false;
  if (!state.enemyPlan || typeof state.enemyPlan.label !== 'string' || typeof state.enemyPlan.hint !== 'string' || !state.enemyPlan.players || !state.battleCards) return false;
  for (const player of state.players) {
    if (!state.battleCards[player.id] || Object.keys(state.battleCards[player.id]).length !== cardIds.length || cardIds.some(id => !Object.hasOwn(state.battleCards[player.id],id)) || Object.entries(state.battleCards[player.id]).some(([id,card]) => !validFrozenCard(id,card,state.schemaVersion,isExpansion(state),isRecruitmentExpansion(state)))) return false;
    if ([...player.hand,...player.deck].some(id => !getBattleCard(state,id,player.id))) return false;
    if (!player.id) continue;
    const plan = state.enemyPlan.players[player.id];
    if(state.schemaVersion===7 && (plan.version!==undefined || Object.entries(plan.unitStats??{}).some(([id,stats])=>['attack','health','cost'].some(key=>state.battleCards[player.id][id]?.[key]!==stats[key])) || state.battleCards[player.id][plan.generalId]?.attack!==plan.generalAttack || state.battleCards[player.id][plan.generalId]?.health!==plan.generalHealth))return false;
    if (!plan || ['mana','maxMana','manaGrowth','manaCap','drawPerTurn','handLimit','attackBonus','healthBonus','spellRank','generalHealth'].some(key => !Number.isInteger(plan[key]) || plan[key] < 0) || plan.manaCap > 30 || plan.handLimit < 1 || plan.handLimit > 30 || plan.drawPerTurn > 10 || plan.spellRank > 2 || plan.generalHealth < 1 || !['assault','defend','support','flank'].includes(plan.behavior) || !Array.isArray(plan.deck) || plan.deck.some(id => !getCard(id))) return false;
  }
  for (const unit of state.units) {
    if(!getUnitBattleCard(state,unit))return false;
    if (unit.owner === 0 && unit.controlledFromOwner === undefined && !unit.token && getCard(unit.cardId)?.type === 'unit' && unit.specialization === undefined) return false;
    if (unit.specialization !== undefined && ((unit.controlledFromOwner ?? unit.owner) !== 0 || unit.token || !['none','bodyguard','skirmish','medic'].includes(unit.specialization) || unit.specialization !== (unit.silenced?'none':state.loadout.specializations[unit.cardId] ?? 'none'))) return false;
    for (const key of ['bodyguardUsed','skirmishUsed']) if ((unit[key] !== undefined || !unit.token && getCard(unit.cardId)?.type === 'unit') && typeof unit[key] !== 'boolean') return false;
  }
  return true;
}

function normalizeTraining(training) {
  return Object.fromEntries(SCHEMA4_FULL_TRAINABLE_IDS.map((id) => [id, Math.max(0, Math.min(4, Number.isInteger(training?.[id]) ? training[id] : 0))]));
}

export function createExpeditionMatch(levelId, training = {}, squad = null, heroId = 1, loadout = null, options = {}) {
  const seeded=Number.isInteger(options.challengeSeed)&&options.challengeSeed>=0&&options.challengeSeed<=4294967295;
  const challenge=seeded?{rng:options.challengeSeed,deaths:0}:null;
  const initialRandom=challenge?()=>nextChallengeRandom(challenge):Math.random;
  const level = EXPEDITION_LEVELS.find((entry) => entry.id === levelId) ?? EXPEDITION_LEVELS[0];
  if (!level) throw new Error('No expedition levels are available.');
  const hero = getHero(heroId);
  const faction = hero && getFaction(hero.faction);
  if (!hero || !faction) throw new Error('未知英雄。');
  squad ??= [...faction.defaultSquad];
  const contentBattle=!!loadout?.deck && !!loadout?.growthVersion;
  const recruited=contentBattle&&[RECRUITMENT_VERSION,TURN_START_DRAW_VERSION].includes(CONTENT_VERSION);
  const expanded=contentBattle&&[EXPANSION_VERSION,RECRUITMENT_VERSION,TURN_START_DRAW_VERSION].includes(CONTENT_VERSION);
  const battleUnitIds=contentBattle?[...SCHEMA7_UNIT_IDS,...(expanded?EXPANSION_UNIT_IDS:[]),...(recruited?RECRUITMENT_UNIT_IDS:[])]:LEGACY_CAMPAIGN_UNIT_IDS;
  const trained = loadout === null ? normalizeTraining(training) : Object.fromEntries(battleUnitIds.map(id => [id, Math.max(0, Math.min(4, Math.floor(training[id] ?? 0)))]));
  const campaign = loadout !== null;
  const drawBattle = campaign && Object.hasOwn(loadout,'deck');
  if (drawBattle && !validatePlayerDeck(loadout.deck, heroId)) throw new Error('牌组必须有30张合法牌，同名最多3张。');
  if (campaign && !validLoadout(loadout, faction, trained, squad)) throw new Error("出战法术或专精无效。");
  const enemyPlan = campaign ? clone(options.enemyPlanOverride ?? getEnemyPlan(level.id,contentBattle ? 3 : drawBattle ? 2 : 1,faction.id)) : null;
  if (drawBattle && !validateEnemyPlan(enemyPlan,level.id)) throw new Error('敌军抽牌配置无效。');
  // New content battles freeze the new fatigue rule without rewriting old plans.
  if(contentBattle)for(const plan of Object.values(enemyPlan.players))plan.fatigueDamage=1;
  if (!Array.isArray(squad) || squad.length !== 3 || new Set(squad).size !== 3 || squad.some((id) => !(faction.unitIds.includes(id) || campaign && (contentBattle?NEUTRAL_IDS:LEGACY_CAMPAIGN_UNIT_IDS.filter(id=>!SCHEMA4_FULL_TRAINABLE_IDS.includes(id))).includes(id)))) {
    throw new Error('队伍必须由同一阵营的 3 个不同单位组成。');
  }
  if (!drawBattle && deploymentCost(squad) > DEPLOYMENT_BUDGET) {
    throw new Error(`前两名部署单位的总费用不能超过 ${DEPLOYMENT_BUDGET}。`);
  }
  const picked = [...squad];
  nextUnitId = 1;
  const battleEnemies=contentBattle?Object.entries(enemyPlan.players).flatMap(([owner,plan])=>plan.garrison.map(entry=>({...entry,cardId:entry.id,maxHealth:entry.health,owner:Number(owner)}))):level.enemies;
  const maxOwner = Math.max(1, ...battleEnemies.map((entry) => entry.owner));
  const players = Array.from({ length: maxOwner + 1 }, (_, id) => {
    const factionCycle = [picked[0], faction.spellIds[0], picked[1], picked[2], faction.spellIds[1], picked[0]].filter((cardId) => cardId !== undefined);
    let deck = id === 0
      ? Array.from({ length: 4 }, () => factionCycle).flat()
      : [...(enemyPlan?.players?.[id]?.deck ?? level.enemyDecks?.[id] ?? [])];
    let hand = id === 0
      ? campaign ? [...picked, ...loadout.spells] : [picked[2], ...faction.spellIds.slice(0, 2)]
      : deck.splice(0, Math.min(3, deck.length));
    if (campaign && id === 0) deck = [];
    if (drawBattle) {
      const rules = drawRules(id, enemyPlan?.players?.[id]);
      deck = id === 0 ? [...loadout.deck] : [...enemyPlan.players[id].deck];
      if (rules.shuffleDeck) deck = shuffled(deck,initialRandom);
      hand = deck.splice(0, rules.openingHandSize);
    }
    const generalId = id === 0 ? heroId : battleEnemies.find((entry) => entry.owner === id && getCard(entry.cardId)?.type === 'general')?.cardId;
    if (!generalId) throw new Error(`Expedition faction ${id} has no general.`);
    return { id, name: id === 0 ? '你' : getCard(generalId).name, generalId, ai: id !== 0, deck, hand, maxMana: enemyPlan?.players?.[id]?.maxMana ?? level.mana, mana: enemyPlan?.players?.[id]?.mana ?? level.mana, turnsStarted: id === 0 ? 1 : 0, bbsUsed: false, wins: 0, turnTriggers: {} };
  });
  const units = [createUnit(heroId, 0, level.playerStart.x, level.playerStart.y, { moved: false, attacked: false, summonedThisTurn: false }, null)];
  for (const [index, pos] of (drawBattle ? [] : level.allyStarts.slice(0, 2)).entries()) {
    units.push(createUnit(picked[index], 0, pos.x, pos.y, { moved: false, attacked: false, summonedThisTurn: false }, trained));
  }
  for (const enemy of battleEnemies) {
    // Scenario caps apply only to newly created matches; restored units retain their saved stats.
    const enemyHealth = enemy.health ?? getCard(enemy.cardId).health;
    if (enemy.maxHealth !== undefined && (!Number.isFinite(enemy.maxHealth) || enemy.maxHealth <= 0 ||
        !Number.isFinite(enemyHealth) || enemyHealth <= 0 || enemyHealth > enemy.maxHealth)) {
      throw new Error(`Invalid scenario health cap for enemy ${enemy.cardId}.`);
    }
    units.push(createUnit(enemy.cardId, enemy.owner, enemy.x, enemy.y, {
      moved: false, attacked: false, summonedThisTurn: false,
      ...(enemy.health === undefined ? {} : { health: enemy.health, maxHealth: Math.max(enemy.health, getCard(enemy.cardId).health) }),
      ...(enemy.maxHealth === undefined ? {} : { maxHealth: enemy.maxHealth }),
      ...(enemy.attack === undefined ? {} : { attack: enemy.attack })
    }));
  }
  const state = {
    attackRangeVersion: 1, schemaVersion: contentBattle ? 7 : drawBattle ? 6 : campaign ? 5 : 4, mode: 'expedition', levelId: level.id, board: { columns: level.columns, rows: level.rows, tiles: clone(level.tiles ?? []) },
    objective: clone(level.objective), turnLimit: level.turnLimit, training: trained, squad: picked, runId: newRunId(), revision: 0,
    phase: 'playing', currentPlayer: 0, round: 1, turnSerial: 1, players, units, manaTiles: [], outposts: {}, creepCells: {}, mulligan: [],
    log: [`远征开始：${level.title}。${level.goal}`], winner: null, result: null, resultReason: null, selectedUnitId: null, lastAction: null, playtimeSeconds: 0
  };
  if (campaign) {
    state.loadout = clone(loadout);
    if (!drawBattle) state.campaignSupply = { remaining: [1,1,3,3,3], capacity: [1,1,3,3,3], resupply: 3 };
    state.enemyPlan = enemyPlan;
    state.unitGrowth = Object.fromEntries(battleUnitIds.map(id => [id, trainingBonus(id, trained[id],contentBattle?loadout.growthVersion[id]:'legacy-v1')]));
    state.battleCards = contentBattle ? createContentBattleCardTables(enemyPlan,loadout) : Object.fromEntries(players.map(player => [player.id, Object.fromEntries((contentBattle?[...SCHEMA5_CARD_IDS,...SCHEMA7_NEW_CARD_IDS,...(expanded?EXPANSION_IDS:[]),...(recruited?RECRUITMENT_CARD_IDS:[])]:SCHEMA5_CARD_IDS).map(id => getCard(id)).map(card => [card.id, freezeBattleCard(card.type === 'spell' ? getSpellUpgrade(card.id, player.id === 0 ? loadout.spellTraining[card.id] ?? 0 : enemyPlan.players[player.id]?.spellRank ?? 0, player.id === 0 ? loadout.spellModes[card.id] ?? 'base' : 'power') : card, player.id)]))]));
    if (!drawBattle)for(const card of Object.values(state.battleCards[0]))if(card.effect==='firstWish'){card.description=card.description.replace('抽1张牌','补给1次');card.campaignSummary=card.campaignSummary.replace('抽1张牌','补给1次');}
    if (contentBattle) {
      state.contentVersion=CONTENT_VERSION;
      if(expanded){state.expansionRandom=(initialRandom()*4294967296)>>>0;for(const table of Object.values(state.battleCards))for(const [id,race]of Object.entries(EXPANSION_RACES))if(table[id])table[id].race=race;}
      for (const [owner,plan] of Object.entries(enemyPlan.players)) {
        for (const [id,stats] of Object.entries(plan.unitStats)) Object.assign(state.battleCards[owner][id],stats);
        state.battleCards[owner][plan.generalId].attack=plan.generalAttack;
        state.battleCards[owner][plan.generalId].health=plan.generalHealth;
      }
    }
    for (const unit of units) {
      if (contentBattle)unit.silenced=false;
      if (unit.owner > 0 && getCard(unit.cardId).type === 'general') { unit.health = unit.maxHealth = enemyPlan.players[unit.owner].generalHealth; }
      applyCampaignUnit(state, unit);
    }
  }
  if(challenge)challengeContexts.set(state,challenge);
  if (drawBattle) {
    if(contentBattle){state.fatigueVersion=1;for(const player of players)player.fatigueCount=0;}
    state.deckRules = Object.fromEntries(players.map(player => [player.id, drawRules(player.id,enemyPlan.players[player.id],state.fatigueVersion)]));
    for (const player of players) { player.replacesUsed = 0; player.turnsStarted = 0; }
    for (const owner of Object.values(state.battleCards)) for (const card of Object.values(owner)) if (card.effect === 'firstWish') {
      card.description = card.description.replace('补给1次','抽1张牌'); card.campaignSummary = card.campaignSummary.replace('补给1次','抽1张牌');
    }
    state.phase = 'mulligan'; state.round = 0; state.turnSerial = 0;
    refreshAuras(state);
    if (!validateMatch(state)) throw new Error('新战斗配置无效。');
    if(usesTurnStartDraw(state))for(const player of state.players)player.hand.forEach((cardId,handIndex)=>recordBattlePresentation(state,{kind:'draw',reason:'opening',owner:player.id,cardId,handIndex}));
  }
  refreshAuras(state);
  return state;
}

export function terrainAt(state, x, y) {
  return boardOf(state).tiles?.find((tile) => tile.x === x && tile.y === y)?.type ?? null;
}

export function objectiveText(state) {
  if (!isTacticalMatch(state)) return state?.mode === 'challenge' ? getLevel(state.levelId)?.goal ?? '' : '击败敌方主将';
  const level = getLevel(state.levelId);
  return state.objective?.type === 'survive' ? `坚守 ${state.objective.rounds} 个完整回合` : level?.goal ?? '消灭所有敌军';
}

export function createChallengeMatch(levelId, completedLevels = []) {
  const level = getLevel(levelId);
  if (level.extended === true) return createTacticalChallenge(level, completedLevels);
  nextUnitId = 1;
  const players = [
    { id: 0, name: '你', generalId: 1, ai: false, deck: [], hand: [...level.hand], maxMana: level.maxMana, mana: level.mana, turnsStarted: 1, bbsUsed: false, wins: 0 },
    { id: 1, name: '齐兰', generalId: 23, ai: false, deck: [], hand: [], maxMana: 0, mana: 0, turnsStarted: 0, bbsUsed: false, wins: 0 }
  ];
  const units = level.board.map((entry) => createUnit(entry.cardId, entry.owner, entry.x, entry.y, {
    moved: false, attacked: false, summonedThisTurn: false,
    ...(entry.health === undefined ? {} : { health: entry.health }),
    ...(entry.attack === undefined ? {} : { attack: entry.attack }),
    ...(entry.attackBuff === undefined ? {} : { attackBuff: entry.attackBuff })
  }));
  return {
    schemaVersion: 2,
    attackRangeVersion: 1,
    mode: 'challenge',
    levelId: level.id,
    turnLimit: level.turnLimit ?? 1,
    completedLevels: [...new Set(completedLevels.filter((id) => LEVELS.some((entry) => entry.id === id)))],
    runId: newRunId(),
    revision: 0,
    phase: 'playing',
    currentPlayer: 0,
    round: 1,
    turnSerial: 1,
    players,
    units,
    manaTiles: clone(MANA_TILES),
    mulligan: [],
    log: [`试炼开始：${level.title}。${level.goal}`],
    winner: null,
    result: null,
    selectedUnitId: null,
    lastAction: null,
    playtimeSeconds: 0
  };
}

function createTacticalChallenge(level, completedLevels) {
  nextUnitId = 1;
  const board = { columns: level.map?.columns ?? 9, rows: level.map?.rows ?? 5, tiles: clone(level.map?.tiles ?? []) };
  const maxOwner = Math.max(1, ...level.board.map((entry) => entry.owner));
  if (!Number.isInteger(maxOwner) || maxOwner > 2) throw new Error('试炼仅支持两至三个阵营。');
  const players = Array.from({ length: maxOwner + 1 }, (_, id) => {
    const generalId = id === 0 ? level.heroId ?? level.board.find((entry) => entry.owner === 0 && getCard(entry.cardId)?.type === 'general')?.cardId
      : level.board.find((entry) => entry.owner === id && getCard(entry.cardId)?.type === 'general')?.cardId;
    if (!getHero(generalId)) throw new Error(`试炼阵营 ${id} 缺少有效主将。`);
    const deck = [...(id === 0 ? level.deck ?? [] : level.enemyDecks?.[id] ?? [])];
    const hand = id === 0 ? [...(level.hand ?? [])] : deck.splice(0, Math.min(3, deck.length));
    return { id, name: id === 0 ? '你' : getCard(generalId).name, generalId, ai: id !== 0, deck, hand,
      maxMana: level.maxMana ?? level.mana ?? 2, mana: level.mana ?? 2,
      turnsStarted: id === 0 ? 1 : 0, bbsUsed: false, wins: 0, turnTriggers: {} };
  });
  const allowed = ['health', 'maxHealth', 'attack', 'attackBuff', 'healthBuff', 'moved', 'attacked', 'summonedThisTurn', 'token', 'reborn', 'stunTurns', 'hatchCardId', 'expiresEndTurn'];
  const units = level.board.map((entry) => {
    const extra = { moved: false, attacked: false, summonedThisTurn: false };
    for (const key of allowed) if (entry[key] !== undefined) extra[key] = entry[key];
    if (entry.health !== undefined && entry.maxHealth === undefined) extra.maxHealth = Math.max(entry.health, getCard(entry.cardId)?.health ?? 0);
    return createUnit(entry.cardId, entry.owner, entry.x, entry.y, extra);
  });
  const state = {
    attackRangeVersion: 1, schemaVersion: 4, mode: 'challenge', levelId: level.id, board,
    objective: clone(level.objective ?? { type: 'eliminate' }), turnLimit: level.turnLimit ?? 1,
    completedLevels: [...new Set(completedLevels.filter((id) => LEVELS.some((entry) => entry.id === id)))],
    runId: newRunId(), revision: 0, phase: 'playing', currentPlayer: 0, round: 1, turnSerial: 1,
    players, units, manaTiles: clone(level.manaTiles ?? []), outposts: {}, creepCells: {}, mulligan: [],
    log: [`试炼开始：${level.title}。${level.goal}`], winner: null, result: null, resultReason: null,
    selectedUnitId: null, lastAction: null, playtimeSeconds: 0
  };
  refreshAuras(state);
  if (!validateMatch(state)) throw new Error(`试炼配置无效：${level.id}`);
  return state;
}

export function validateMatch(snapshot) {
  try {
    return validateMatchValue(snapshot);
  } catch {
    return false;
  }
}

function validateMatchValue(snapshot) {
  if (!snapshot || (Object.hasOwn(snapshot,'attackRangeVersion') && snapshot.attackRangeVersion !== 1)) return false;
  if(Object.hasOwn(snapshot,'fatigueVersion')&&(snapshot.fatigueVersion!==1||snapshot.schemaVersion!==7||snapshot.mode!=='expedition'))return false;
  // A finite frozen card proves this is a range-versioned match. A missing marker
  // is damaged state, not evidence that the match predates finite ranges.
  if ([5,6,7].includes(snapshot.schemaVersion) && !Object.hasOwn(snapshot,'attackRangeVersion')
    && Object.values(snapshot.battleCards ?? {}).some(table => Object.values(table).some(card => card && Object.hasOwn(card,'attackRange')))) return false;
  if (snapshot.attackRangeVersion === 1) {
    const tables = [5,6,7].includes(snapshot.schemaVersion) ? Object.values(snapshot.battleCards ?? {}) : [CARDS];
    if (!tables.length || tables.some(table => Object.values(table).some(card => (card.ranged || card.blast) && (!Number.isInteger(card.attackRange) || card.attackRange < 1 || card.attackRange > 100)))) return false;
  }

  const legacyMatch = snapshot?.schemaVersion === 1 && snapshot.mode === 'local-ai';
  const challengeMatch = snapshot?.schemaVersion === 2 && snapshot.mode === 'challenge'
    && LEVELS.some((level) => level.id === snapshot.levelId)
    && Array.isArray(snapshot.completedLevels) && snapshot.completedLevels.every((id) => LEVELS.some((level) => level.id === id));
  const tacticalChallenge = snapshot?.schemaVersion === 4 && snapshot.mode === 'challenge'
    && LEVELS.some((level) => level.id === snapshot.levelId && level.extended === true)
    && Array.isArray(snapshot.completedLevels) && new Set(snapshot.completedLevels).size === snapshot.completedLevels.length
    && snapshot.completedLevels.every((id) => LEVELS.some((level) => level.id === id))
    && snapshot.training === undefined && snapshot.squad === undefined;
  const tacticalShape = snapshot.objective && ['eliminate', 'survive'].includes(snapshot.objective.type)
    && (snapshot.objective.type !== 'survive' || Number.isInteger(snapshot.objective.rounds) && snapshot.objective.rounds > 0)
    && Number.isInteger(snapshot.turnLimit) && snapshot.turnLimit > 0
    && snapshot.board && Number.isInteger(snapshot.board.columns) && Number.isInteger(snapshot.board.rows)
    && snapshot.board.columns >= 5 && snapshot.board.columns <= 20 && snapshot.board.rows >= 3 && snapshot.board.rows <= 12
    && Array.isArray(snapshot.board.tiles) && snapshot.board.tiles.every((tile) => tile && typeof tile === 'object' && withinBoard(tile.x, tile.y, snapshot.board) && ['wall', 'rough', 'outpost'].includes(tile.type))
    && new Set(snapshot.board.tiles.map((tile) => `${tile.x},${tile.y}`)).size === snapshot.board.tiles.length;
  if (tacticalChallenge && !tacticalShape) return false;
  const expeditionMatch = [3, 4, 5, 6, 7].includes(snapshot?.schemaVersion) && snapshot.mode === 'expedition'
    && EXPEDITION_LEVELS.some((level) => level.id === snapshot.levelId)
    && snapshot.objective && ['eliminate', 'survive'].includes(snapshot.objective.type)
    && (snapshot.objective.type !== 'survive' || Number.isInteger(snapshot.objective.rounds) && snapshot.objective.rounds > 0)
    && Number.isInteger(snapshot.turnLimit) && snapshot.turnLimit > 0
    && snapshot.board && Number.isInteger(snapshot.board.columns) && Number.isInteger(snapshot.board.rows)
    && snapshot.board.columns >= 5 && snapshot.board.columns <= 20 && snapshot.board.rows >= 3 && snapshot.board.rows <= 12
    && Array.isArray(snapshot.board.tiles) && snapshot.board.tiles.every((tile) => tile && typeof tile === 'object' && withinBoard(tile.x, tile.y, snapshot.board) && ['wall', 'rough', 'outpost'].includes(tile.type))
    && new Set(snapshot.board.tiles.map((tile) => `${tile.x},${tile.y}`)).size === snapshot.board.tiles.length
    && Array.isArray(snapshot.squad) && snapshot.squad.length === 3 && new Set(snapshot.squad).size === 3
    && (snapshot.schemaVersion === 3
      ? snapshot.squad.every((id) => LEGACY_TRAINABLE_IDS.includes(id)) && snapshot.training && LEGACY_TRAINABLE_IDS.every((id) => Number.isInteger(snapshot.training[id]) && snapshot.training[id] >= 0 && snapshot.training[id] <= 4)
      : (() => { const hero = getHero(snapshot.players?.[0]?.generalId), faction = hero && getFaction(hero.faction); return !!faction && snapshot.squad.every((id) => faction.unitIds.includes(id) || [5, 6, 7].includes(snapshot.schemaVersion) && NEUTRAL_IDS.includes(id)); })());
  if (!legacyMatch && !challengeMatch && !tacticalChallenge && !expeditionMatch) return false;
  if (!Array.isArray(snapshot.players) || (expeditionMatch || tacticalChallenge ? snapshot.players.length < 2 || snapshot.players.length > 3 : snapshot.players.length !== 2)) return false;
  if (!Array.isArray(snapshot.units) || snapshot.units.length > boardOf(snapshot).columns * boardOf(snapshot).rows) return false;
  if (!(challengeMatch || tacticalChallenge || expeditionMatch ? ([6,7].includes(snapshot.schemaVersion) ? ['mulligan','playing','ai','over'] : ['playing', 'ai', 'over']).includes(snapshot.phase) : ['mulligan', 'playing', 'ai', 'over'].includes(snapshot.phase))) return false;
  if (!Number.isInteger(snapshot.currentPlayer) || snapshot.currentPlayer < 0 || snapshot.currentPlayer >= snapshot.players.length || !Number.isInteger(snapshot.round) || snapshot.round < 0) return false;
  if (typeof snapshot.runId !== 'string' || !snapshot.runId || !Number.isInteger(snapshot.revision) || snapshot.revision < 0 || !Number.isInteger(snapshot.turnSerial) || snapshot.turnSerial < 0) return false;
  if (!Number.isFinite(snapshot.playtimeSeconds) || snapshot.playtimeSeconds < 0) return false;
  if (!(snapshot.winner === null || Number.isInteger(snapshot.winner) && snapshot.winner >= 0 && snapshot.winner < snapshot.players.length)) return false;
  if (![null, 'win', 'loss'].includes(snapshot.result)) return false;
  if (snapshot.phase === 'over' ? snapshot.result === null || snapshot.winner === null : snapshot.result !== null || snapshot.winner !== null) return false;
  if(!validateExpansionState(snapshot))return false;
  if (!Array.isArray(snapshot.mulligan) || !Array.isArray(snapshot.log)) return false;
  if (snapshot.mulligan.some((entry) => !Number.isInteger(entry) || entry < 0)) return false;
  if (snapshot.log.some((entry) => typeof entry !== 'string')) return false;
  for (const [index, player] of snapshot.players.entries()) {
    if (!player || typeof player !== 'object' || Array.isArray(player)) return false;
    if (!Number.isInteger(player.id) || player.id < 0 || player.id >= snapshot.players.length || !Array.isArray(player.hand) || player.hand.length > ([6,7].includes(snapshot.schemaVersion) ? snapshot.deckRules?.[index]?.handLimit ?? 0 : [5, 6, 7].includes(snapshot.schemaVersion) && index > 0 ? snapshot.enemyPlan?.players?.[index]?.handLimit ?? SAVED_HAND_LIMIT : SAVED_HAND_LIMIT) || !Array.isArray(player.deck) || !Number.isFinite(player.mana) || !Number.isFinite(player.maxMana)) return false;
    if (typeof player.name !== 'string' || !player.name || !Number.isInteger(player.wins) || player.wins < 0) return false;
    if (player.id !== index || !getCard(player.generalId) || getCard(player.generalId).type !== 'general') return false;
    if (player.mana < 0 || player.maxMana < 0 || player.maxMana > ([5, 6, 7].includes(snapshot.schemaVersion) && index > 0 ? snapshot.enemyPlan?.players?.[index]?.manaCap ?? 9 : 9) || typeof player.ai !== 'boolean') return false;
    if (!Number.isInteger(player.turnsStarted) || player.turnsStarted < 0 || typeof player.bbsUsed !== 'boolean') return false;
    if(snapshot.fatigueVersion===1){
      if(!Number.isSafeInteger(player.fatigueCount)||player.fatigueCount<0||player.fatigueCount>=Number.MAX_SAFE_INTEGER||snapshot.phase==='mulligan'&&player.fatigueCount!==0)return false;
    }else if(Object.hasOwn(player,'fatigueCount'))return false;
    if (player.hand.some((id) => !getCard(id) || snapshot.schemaVersion!==7&&!SCHEMA5_CARD_IDS.includes(id)) || player.deck.some((id) => !getCard(id) || snapshot.schemaVersion!==7&&!SCHEMA5_CARD_IDS.includes(id))) return false;
    if ([4, 5, 6, 7].includes(snapshot.schemaVersion)) {
      if (!player.turnTriggers || typeof player.turnTriggers !== 'object' || Array.isArray(player.turnTriggers) || Object.values(player.turnTriggers).some((value) => typeof value !== 'boolean')) return false;
      if (player.summonBuffThisTurn !== undefined && typeof player.summonBuffThisTurn !== 'boolean') return false;
      if (player.bbsMinionAttackBonus !== undefined && player.bbsMinionAttackBonus !== 2) return false;
    }
  }
  if (new Set(snapshot.players.map((player) => player.id)).size !== snapshot.players.length) return false;
  if (tacticalChallenge) {
    if (!Array.isArray(snapshot.manaTiles) || snapshot.manaTiles.some((tile) => !tile || !withinBoard(tile.x, tile.y, snapshot.board))) return false;
    for (const player of snapshot.players) {
      const generals = snapshot.units.filter((unit) => unit.owner === player.id && getCard(unit.cardId)?.type === 'general');
      if (generals.length > 1 || generals.some((unit) => unit.cardId !== player.generalId)) return false;
      if (snapshot.phase !== 'over' && player.id === 0 && generals.length !== 1) return false;
    }
    if (snapshot.phase !== 'over' && !snapshot.units.some((unit) => unit.owner !== 0 && getCard(unit.cardId)?.type === 'general')) return false;
  }
  if (expeditionMatch || tacticalChallenge) {
    if (snapshot.players[0].id !== 0 || snapshot.players[0].ai || snapshot.players.slice(1).some((player) => !player.ai)) return false;
    if (snapshot.outposts === null || typeof snapshot.outposts !== 'object' || Array.isArray(snapshot.outposts)) return false;
    const validOutposts = new Set(snapshot.board.tiles.filter((tile) => tile.type === 'outpost').map((tile) => `${tile.x},${tile.y}`));
    if (Object.entries(snapshot.outposts).some(([key, owner]) => !validOutposts.has(key) || !Number.isInteger(owner) || owner < 0 || owner >= snapshot.players.length)) return false;
    if (snapshot.phase !== 'over' && snapshot.phase !== 'mulligan' && (snapshot.currentPlayer === 0 ? snapshot.phase !== 'playing' : snapshot.phase !== 'ai')) return false;
    if (!(snapshot.resultReason === null || ['general-defeated', 'enemies-eliminated', 'survived', 'turn-limit'].includes(snapshot.resultReason))) return false;
    if ([4, 5, 6, 7].includes(snapshot.schemaVersion)) {
      if (expeditionMatch && snapshot.schemaVersion === 4 && (!snapshot.training || typeof snapshot.training !== 'object' || Array.isArray(snapshot.training)
        || ![SCHEMA4_ORIGINAL_TRAINABLE_IDS, SCHEMA4_FULL_TRAINABLE_IDS].some((ids) => Object.keys(snapshot.training).length === ids.length
          && ids.every((id) => Object.hasOwn(snapshot.training, id) && Number.isInteger(snapshot.training[id]) && snapshot.training[id] >= 0 && snapshot.training[id] <= 4)))) return false;
      if (!snapshot.creepCells || typeof snapshot.creepCells !== 'object' || Array.isArray(snapshot.creepCells)) return false;
      if (Object.entries(snapshot.creepCells).some(([key, owner]) => {
        const [x, y, extra] = key.split(',').map(Number);
        return extra !== undefined || !withinBoard(x, y, snapshot.board) || !Number.isInteger(owner) || owner < 0 || owner >= snapshot.players.length;
      })) return false;
      if (snapshot.players.some((player) => !player.turnTriggers || typeof player.turnTriggers !== 'object' || Array.isArray(player.turnTriggers))) return false;
    }
  }
  if ([5, 6, 7].includes(snapshot.schemaVersion) && !validCampaignSnapshot(snapshot)) return false;
  const unitIds = new Set();
  const positions = new Set();
  for (const unit of snapshot.units) {
    if (!unit || typeof unit !== 'object' || Array.isArray(unit)) return false;
    if (!getCard(unit.cardId) || snapshot.schemaVersion!==7&&!SCHEMA5_CARD_IDS.includes(unit.cardId) || !withinBoard(unit.x, unit.y, boardOf(snapshot)) || !Number.isInteger(unit.owner) || unit.owner < 0 || unit.owner >= snapshot.players.length) return false;
    if (terrainAt(snapshot, unit.x, unit.y) === 'wall') return false;
    if (!Number.isInteger(unit.unitId) || unitIds.has(unit.unitId) || !Number.isFinite(unit.health) || !Number.isFinite(unit.maxHealth) || !Number.isFinite(unit.attack) || !Number.isFinite(unit.attackBuff) || !Number.isFinite(unit.healthBuff)) return false;
    if (typeof unit.moved !== 'boolean' || typeof unit.attacked !== 'boolean' || typeof unit.summonedThisTurn !== 'boolean') return false;
    if(snapshot.schemaVersion===7 && (typeof unit.silenced!=='boolean' || unit.openingTarget!==undefined))return false;
    if ([4, 5, 6, 7].includes(snapshot.schemaVersion)) {
      if (typeof unit.token !== 'boolean' || typeof unit.reborn !== 'boolean') return false;
      for (const key of ['auraAttackBuff', 'auraHealthBuff', 'tempAlliedAttackBuff']) {
        if (unit[key] !== undefined && (!Number.isInteger(unit[key]) || unit[key] <= 0)) return false;
      }
      const expectedAura = auraBonuses(snapshot, unit);
      if ((unit.auraAttackBuff ?? 0) !== expectedAura.attack || (unit.auraHealthBuff ?? 0) !== expectedAura.health) return false;
      if (unit.tempAlliedAttackBuff !== undefined && (getCard(unit.cardId)?.type !== 'unit' || unit.attackBuff < unit.tempAlliedAttackBuff)) return false;
      if (unit.health <= 0 || unit.maxHealth <= 0 || unit.health > unit.maxHealth + unit.healthBuff) return false;
      if (unit.tempHeroAttackBuff !== undefined && (!Number.isFinite(unit.tempHeroAttackBuff) || unit.tempHeroAttackBuff <= 0)) return false;
      if (unit.stunTurns !== undefined && (!Number.isInteger(unit.stunTurns) || unit.stunTurns < 0)) return false;
      if (unit.hatchCardId !== undefined && !getCard(unit.hatchCardId)) return false;
      if (unit.expiresEndTurn !== undefined && typeof unit.expiresEndTurn !== 'boolean') return false;
    }
    const position = `${unit.x},${unit.y}`;
    if (positions.has(position)) return false;
    unitIds.add(unit.unitId);
    positions.add(position);
  }
  if (!(snapshot.selectedUnitId === null || Number.isInteger(snapshot.selectedUnitId) && unitIds.has(snapshot.selectedUnitId))) return false;
  if (snapshot.lastAction !== null) {
    if (!snapshot.lastAction || typeof snapshot.lastAction !== 'object' || Array.isArray(snapshot.lastAction)) return false;
    if (!['move', 'attack', 'summon', 'spell', 'bbs', 'end-turn', ...([6,7].includes(snapshot.schemaVersion) ? ['replace'] : [])].includes(snapshot.lastAction.kind)) return false;
  }
  return true;
}

export function restoreMatch(snapshot) {
  if (!validateMatch(snapshot)) return null;
  nextUnitId = Math.max(0, ...snapshot.units.map((unit) => unit.unitId)) + 1;
  snapshot.runId ??= newRunId();
  snapshot.revision = Number.isInteger(snapshot.revision) ? snapshot.revision : 0;
  snapshot.selectedUnitId = null;
  return snapshot;
}

export function occupiedUnit(state, x, y) {
  return state.units.find((unit) => unit.health > 0 && unit.x === x && unit.y === y) ?? null;
}

export function findGeneral(state, playerId) {
  return state.units.find((unit) => unit.owner === playerId && unitRuleCard(state, unit)?.type === 'general') ?? null;
}

function cardAtHand(player, handIndex) { return getCard(player.hand[handIndex]); }

function addLog(state, message) {
  state.log.push(message);
  state.log = state.log.slice(-5);
}

function isNear(a, b, radius = 1) {
  return distance(a, b) <= radius;
}

// Dynamic buffs retain damage already suffered, matching original getHP=maxHP-damage.
function auraBonuses(state, unit) {
  const card = unitRuleCard(state, unit);
  const ownSources = state.units.filter((source) => source.owner === unit.owner && source.health > 0);
  const dervish = isExpansion(state) ? card?.race==='dervish' : card?.dervish || [217, 225].includes(unit.cardId);
  const creep = card?.creepStats ? Object.values(state.creepCells ?? {}).filter((owner) => owner === unit.owner).length * card.creepStats : 0;
  return {
    attack: creep + (isRecruitmentExpansion(state)&&card?.type==='unit' ? ownSources.reduce((sum,source)=>sum+(source!==unit?(unitRuleCard(state,source)?.otherAlliedAttackAura??0):0),0) : 0) + (dervish ? ownSources.reduce((sum, source) => sum + (unitRuleCard(state, source)?.dervishAuraAttack ?? 0), 0) : 0),
    health: creep + (dervish ? ownSources.reduce((sum, source) => sum + (unitRuleCard(state, source)?.dervishAuraHealth ?? 0), 0) : 0)
  };
}

function refreshAuras(state) {
  if (refreshingAuras.has(state)) return;
  refreshingAuras.add(state);
  try {
    // Removing a health source can kill another source; settle until the board is stable.
    let deaths;
    do {
      for (const unit of state.units.filter((entry) => entry.health > 0)) {
        if(isExpansion(state)&&!unit.summonedThisTurn&&!unit.stunTurns){const quota=actionQuota(state,unit,unitRuleCard(state,unit));if(unit.movesUsed!==undefined)unit.moved=unit.movesUsed>=quota;if(unit.attacksUsed!==undefined)unit.attacked=unit.attacksUsed>=quota;}
        const bonus = auraBonuses(state, unit);
        const attackDelta = bonus.attack - (unit.auraAttackBuff ?? 0);
        const healthDelta = bonus.health - (unit.auraHealthBuff ?? 0);
        unit.attackBuff += attackDelta;
        unit.healthBuff += healthDelta;
        unit.health += healthDelta;
        if (bonus.attack) unit.auraAttackBuff = bonus.attack; else delete unit.auraAttackBuff;
        if (bonus.health) unit.auraHealthBuff = bonus.health; else delete unit.auraHealthBuff;
      }
      deaths = state.units.filter((unit) => unit.health <= 0);
      for (const unit of deaths) if (state.units.includes(unit)) takeDamage(state, unit, 0, { auraRemoval: true });
    } while (deaths.length);
  } finally { refreshingAuras.delete(state); }
}

export function effectiveAttack(state, unit) {
  const card = unitRuleCard(state, unit);
  let attack = unit.attack + unit.attackBuff;
  if (card?.zeal) {
    const general = findGeneral(state, unit.owner);
    if (general && isNear(unit, general)) attack += card.zeal;
  }
  const center = (boardOf(state).columns - 1) / 2;
  if (card?.infiltrate && (unit.owner === 0 ? unit.x > center : unit.x < center)) attack += card.infiltrate;
  return Math.max(0, attack);
}

export function summonPositions(state, playerId, cardId) {
  const card = getBattleCard(state, cardId, playerId);
  const ownUnits = state.units.filter((unit) => unit.owner === playerId && unit.health > 0);
  const result = [];
  const board = boardOf(state);
  for (let y = 0; y < board.rows; y++) {
    for (let x = 0; x < board.columns; x++) {
      if (occupiedUnit(state, x, y) || terrainAt(state, x, y) === 'wall') continue;
      // Ordinary units deploy in the eight cells around any living allied unit.
      if (card?.airdrop || ownUnits.some((unit) => distance(unit, { x, y }) <= 1)) result.push({ x, y });
    }
  }
  return result;
}

function canPlay(state, playerId) {
  return state.currentPlayer === playerId && (state.phase === 'playing' || state.phase === 'ai');
}

function removeHandCard(state, player, handIndex) {
  if (state.schemaVersion === 5 && player.id === 0) state.campaignSupply.remaining[handIndex] -= 1;
  else player.hand.splice(handIndex, 1);
}

function triggerHeal(state, target, amount) {
  if (!target || target.health <= 0 || !state.units.includes(target)) return 0;
  const before = target.health;
  target.health = Math.min(target.maxHealth + target.healthBuff, target.health + amount);
  const restored = target.health - before;
  if (!restored) return 0;
  const hero = heroOf(state, target.owner), player = state.players[target.owner];
  if (hero?.id === 23 && !player.turnTriggers?.heal) {
    player.turnTriggers.heal = true;
    target.attackBuff += 1;
  }
  for (const unit of state.units) {
    const card = unitRuleCard(state, unit);
    // Original ModifierHealWatch reacts to any actual healing, regardless of owner.
    if (card?.healWatch && unit.health > 0) {
      unit.attackBuff += 1;
      unit.healthBuff += 1;
      unit.health += 1;
      addLog(state, '逐光者因治疗获得 +1 / +1。');
    }
  }
  expansionEvent(state,'heal',{target,amount:restored},expansionApi(state));
  return restored;
}

function adjacentFreeCells(state, center) {
  const cells = [];
  for (let y = center.y - 1; y <= center.y + 1; y++) for (let x = center.x - 1; x <= center.x + 1; x++) {
    if ((x !== center.x || y !== center.y) && withinBoard(x, y, boardOf(state)) && !occupiedUnit(state, x, y) && terrainAt(state, x, y) !== 'wall') cells.push({ x, y });
  }
  return cells.sort((a, b) => a.y - b.y || a.x - b.x);
}

function summonUnit(state, cardId, owner, x, y, extra = {}) {
  if (!withinBoard(x, y, boardOf(state)) || occupiedUnit(state, x, y) || terrainAt(state, x, y) === 'wall' || !getCard(cardId)) return null;
  const unit = createUnit(cardId, owner, x, y, extra, state.mode === 'expedition' && owner === 0 ? state.training : null);
  if (cardId === 217) { unit.summonedThisTurn = false; unit.moved = false; unit.attacked = false; unit.expiresEndTurn ??= true; }
  if(state.schemaVersion===7)unit.silenced=false;
  state.units.push(unit);
  if ([5, 6, 7].includes(state.schemaVersion)) {
    const frozen = getBattleCard(state, cardId, owner), bonus = !unit.token && owner === 0 ? state.unitGrowth[cardId] ?? {attack:0,health:0} : {attack:0,health:0};
    unit.attack = frozen.attack + bonus.attack; unit.maxHealth = frozen.health + bonus.health; unit.health = unit.maxHealth;
    applyCampaignUnit(state, unit);
  }
  const card = getBattleCard(state, cardId, owner), player = state.players[owner], hero = heroOf(state, owner), triggers = player?.turnTriggers ?? (player.turnTriggers = {});
  if (player?.summonBuffThisTurn && card.type === 'unit') { unit.attackBuff += 1; unit.healthBuff += 1; unit.health += 1; }
  if (hero?.id === 1 && !triggers.adjacentSummon && card.type === 'unit' && isNear(unit, findGeneral(state, owner))) { triggers.adjacentSummon = true; unit.healthBuff += 1; unit.health += 1; }
  if (hero?.id === 201 && (isExpansion(state) ? card.race==='dervish' : card.dervish || [217, 225].includes(card.id))) { unit.healthBuff += 1; unit.health += 1; }
  if (hero?.id === 418 && !triggers.costlySummon && card.type === 'unit' && (card.cost ?? 0) >= 3) { triggers.costlySummon = true; drawCard(state, owner); }
  if (hero?.id === 501 && card.infiltrate) { unit.healthBuff += 1; unit.health += 1; }
  if (hero?.id === 527 && !triggers.summon && card.type === 'unit') {
    triggers.summon = true; unit.healthBuff += 1; unit.health += 1;
    const wall = state.units.find((other) => other.owner === owner && unitRuleCard(state, other)?.wall && isNear(unit, other));
    if (wall) wall.provokeBuff = true;
  }
  if (card.openingBuff) {
    const buff = typeof card.openingBuff === 'number' ? card.openingBuff : 2;
    const candidates = state.units.filter((entry) => entry.owner === owner && entry.unitId !== unit.unitId && unitRuleCard(state, entry)?.type === 'unit');
    const target = card.id === 211
      ? candidates.filter((entry) => isExpansion(state) ? unitRuleCard(state, entry)?.race==='dervish' : unitRuleCard(state, entry)?.dervish || [217, 225].includes(entry.cardId)).sort((a, b) => a.unitId - b.unitId)[0]
      : candidates.filter((entry) => isNear(entry, unit)).sort((a, b) => a.unitId - b.unitId)[0];
    if (target) {
      target.attackBuff += buff; target.healthBuff += buff; target.health += buff;
      if (card.id === 211 && target.cardId === 217) target.expiresEndTurn = false;
    }
  }
  if (card.openingAlliedAttack) {
    for (const ally of state.units.filter((entry) => entry.owner === owner && entry.unitId !== unit.unitId && entry.health > 0 && unitRuleCard(state, entry)?.type === 'unit')) {
      ally.attackBuff += card.openingAlliedAttack;
      ally.tempAlliedAttackBuff = (ally.tempAlliedAttackBuff ?? 0) + card.openingAlliedAttack;
    }
  }
  refreshAuras(state);
  const tokenId = card.openingDervish && !card.obelysk ? 217 : card.openingWraith ? 315 : null;
  if (tokenId) for (const cell of adjacentFreeCells(state, unit).slice(0, card.openingCount ?? 1)) summonUnit(state, tokenId, owner, cell.x, cell.y, { token: true });
  if(state.schemaVersion===7) {
    if(card.openingDispel && extra.openingTarget)dispelCell(state,extra.openingTarget.x,extra.openingTarget.y);
    if(card.openingDrawBoth)for(const player of state.players)if(findGeneral(state,player.id))drawCard(state,player.id);
    if(card.openingDamageNearby)for(const victim of [...state.units].filter(other=>other.unitId!==unit.unitId&&isNear(unit,other)))takeDamage(state,victim,card.openingDamageNearby,{sourceOwner:owner,sourceId:unit.unitId});
    if(card.openingDamageFront){const target=occupiedUnit(state,unit.x+(owner===0?1:-1),unit.y);if(target&&unitRuleCard(state,target)?.type==='unit')takeDamage(state,target,card.openingDamageFront,{sourceOwner:owner,sourceId:unit.unitId});}
  }
  if(isExpansion(state)){if(!extra.skipOpening)resolveOpening(state,unit,card,extra.openingTarget,expansionApi(state));refreshAuras(state);expansionEvent(state,'summon',{unit,fromHand:!!extra.fromHand},expansionApi(state));}
  delete unit.openingTarget;delete unit.fromHand;delete unit.skipOpening;
  return unit;
}

function takeDamage(state, unit, amount, context = {}) {
  if (!unit || !state.units.includes(unit) || amount < 0 || amount === 0 && !(context.auraRemoval && unit.health <= 0)) return 0;
  let died=false;const damageCard=unitRuleCard(state,unit),sourceUnit=state.units.find(u=>u.unitId===context.sourceId),sourceCard=sourceUnit&&unitRuleCard(state,sourceUnit);
  // Immunity prevents the hit itself; an adjacent bodyguard keeps its charge
  // for actual damage. Keep historical frozen rules outside the expansion.
  if(isExpansion(state)&&!context.destroy&&!context.auraRemoval&&!context.trueDamage){if(damageCard?.attackImmune&&context.attack)return 0;if(damageCard?.generalImmune&&sourceUnit&&unitRuleCard(state,sourceUnit)?.type==='general')return 0;}
  if(isRecruitmentExpansion(state)&&!context.destroy&&damageCard?.type==='general'&&sourceCard?.damageGeneralMultiplier)amount*=sourceCard.damageGeneralMultiplier;
  if ([5, 6, 7].includes(state.schemaVersion) && !context.auraRemoval && !context.trueDamage) {
    const guard = state.units.filter(other => other.owner === unit.owner && other.unitId !== unit.unitId && other.health > 0 && other.specialization === 'bodyguard' && !other.bodyguardUsed && isNear(unit, other)).sort((a,b) => a.unitId-b.unitId)[0];
    if (guard) { amount = Math.max(0, amount - 1); guard.bodyguardUsed = true; }
  }
  if (amount === 0 && !context.auraRemoval) return 0;
  unit.health -= amount;
  if(isExpansion(state)&&amount>0&&!context.destroy)expansionEvent(state,'damageTaken',{unit,card:damageCard,amount},expansionApi(state));
  const damagedGeneral = unitRuleCard(state, unit)?.type === 'general';
  if (unit.health > 0 && damagedGeneral && !context.trueDamage) {
    const hero = heroOf(state, unit.owner), triggers = state.players[unit.owner]?.turnTriggers;
    if (hero?.id === 401 && triggers && !triggers.survivedGeneralDamage) { triggers.survivedGeneralDamage = true; unit.attackBuff += 1; unit.tempHeroAttackBuff = (unit.tempHeroAttackBuff ?? 0) + 1; }
  }
  if (context.creep) {
    const hero = heroOf(state, context.sourceOwner), triggers = state.players[context.sourceOwner]?.turnTriggers;
    if (hero?.id === 323 && triggers && !triggers.creepDamage) { triggers.creepDamage = true; triggerHeal(state, findGeneral(state, context.sourceOwner), 1); }
  }
  if (unit.health <= 0 && state.units.includes(unit)) {
    const card = unitRuleCard(state, unit);
    // Count actual non-token allied minion deaths at the unified removal path.
    // Eggs, temporary dervishes and generated tokens do not add a casualty.
    const audit=challengeContexts.get(state);
    if(audit&&unit.owner===0&&card?.type==='unit'&&!unit.token&&!unit.dervish&&!unit.hatchCardId)audit.deaths++;
    if ([5, 6, 7].includes(state.schemaVersion) && card?.dyingAlliedHealth) for (const ally of state.units.filter(other => other.unitId !== unit.unitId && other.owner === unit.owner && other.health > 0 && unitRuleCard(state, other)?.type === 'unit' && isNear(unit, other))) { ally.healthBuff += card.dyingAlliedHealth; ally.health += card.dyingAlliedHealth; }
    const deathCell = { x: unit.x, y: unit.y }, deadOwner = unit.owner;
    addLog(state, `${card?.name ?? '单位'}被击败。`);
    if (card?.type === 'general') {
      if (isTacticalMatch(state)) {
        const defeatedOwner = unit.owner;
        state.units = state.units.filter((entry) => entry.owner !== defeatedOwner || entry.unitId === unit.unitId);
        if (!state.units.some((entry) => entry.unitId === state.selectedUnitId && entry.owner !== defeatedOwner)) state.selectedUnitId = null;
        if (defeatedOwner === 0) finishExpedition(state, 1, 'general-defeated');
        else if (!state.units.some((entry) => entry.owner !== 0 && unitRuleCard(state, entry)?.type === 'general' && entry.health > 0)) finishExpedition(state, 0, 'enemies-eliminated');
      } else {
        state.phase = 'over';
        state.winner = state.mode === 'challenge' && (unit.owner === 0 || !findGeneral(state, 0)) ? 1 : 1 - unit.owner;
        state.result = state.winner === 0 ? 'win' : 'loss';
        addLog(state, state.winner === 0 ? '敌方主将倒下。胜利。' : '阿杰农倒下。战败。');
      }
      recordTrialResult(state);
    }
    state.units = state.units.filter((entry) => entry.unitId !== unit.unitId);died=true;
    refreshAuras(state);
    if(state.schemaVersion===7 && card?.dyingDraw)drawCard(state,deadOwner);
    if (state.selectedUnitId === unit.unitId) state.selectedUnitId = null;
    const killerHero = heroOf(state, context.sourceOwner), killerTriggers = state.players[context.sourceOwner]?.turnTriggers;
    if (killerHero?.id === 223 && context.sourceOwner !== undefined && deadOwner !== context.sourceOwner && card?.type === 'unit' && killerTriggers && !killerTriggers.minionKill) {
      killerTriggers.minionKill = true; triggerHeal(state, findGeneral(state, context.sourceOwner), 2);
    }
    const ownerHero = heroOf(state, deadOwner), ownerTriggers = state.players[deadOwner]?.turnTriggers;
    if (ownerHero?.id === 301 && card?.type === 'unit' && !unit.token && ownerTriggers && !ownerTriggers.nonTokenDeath) {
      ownerTriggers.nonTokenDeath = true; summonUnit(state, 315, deadOwner, deathCell.x, deathCell.y, { token: true });
    } else if (card?.rebirth) summonUnit(state, 411, deadOwner, deathCell.x, deathCell.y, { token: true, hatchCardId: unit.cardId });
    else if (card?.dyingWolf) summonUnit(state, typeof card.dyingWolf === 'number' ? card.dyingWolf : 504, deadOwner, deathCell.x, deathCell.y, { token: true });
    if(isRecruitmentExpansion(state)&&state.phase!=='over') {
      for(const spawnId of [...(card?.dyingSpawn?[card.dyingSpawn]:[]),...(unit.grantedDyingSpawns??[])]) {
        if(!occupiedUnit(state,deathCell.x,deathCell.y))summonUnit(state,spawnId,deadOwner,deathCell.x,deathCell.y,{token:true});
      }
    }
    if (card?.manaWisp) state.players[deadOwner].maxMana = Math.min(9, state.players[deadOwner].maxMana + 1);
    if (card?.type === 'unit' && state.phase !== 'over') {
      const watchers = state.units.filter((entry) => entry.unitId !== unit.unitId && entry.health > 0);
      for (const watcher of watchers) {
        if (!state.units.includes(watcher)) continue;
        const watchCard = unitRuleCard(state, watcher);
        if (watchCard?.deathWatch) { watcher.attackBuff += 1; watcher.healthBuff += 1; watcher.health += 1; }
        if (watchCard?.deathWatchSpawn) {
          const pos = adjacentFreeCells(state, watcher)[0];
          if (pos) summonUnit(state, watchCard.deathWatchSpawn, watcher.owner, pos.x, pos.y, { token: true });
        }
      }
    }
  }
  if(isExpansion(state)&&damageCard?.type==='unit'&&died)expansionEvent(state,'death',{unit,card:damageCard},expansionApi(state));
  if(isExpansion(state)&&amount>0&&!context.destroy&&sourceUnit)expansionEvent(state,'damageDealt',{source:sourceUnit,card:sourceCard,target:unit,targetCard:damageCard,amount},expansionApi(state));
  if(state.schemaVersion===7 && amount>0 && !context.destroy && context.sourceId) {
    const source=state.units.find(entry=>entry.unitId===context.sourceId);
    if(source&&unitRuleCard(state,source)?.damageDraw)drawCard(state,source.owner);
  }
  return amount;
}

export function drawCard(state, playerId, presentation = {}) {
  const reason=presentation.reason??'effect';
  const player = state.players[playerId];
  if ([6,7].includes(state.schemaVersion)) {
    if (!player || !['playing','ai'].includes(state.phase) || !findGeneral(state,playerId)) return null;
    const rules = state.deckRules[playerId];
    if (!player.deck.length) {
      const general = findGeneral(state, playerId);
      // Persist before damage: nested draws and reloads must observe this attempt.
      if(state.fatigueVersion===1&&(!Number.isSafeInteger(player.fatigueCount)||player.fatigueCount<0||player.fatigueCount>=Number.MAX_SAFE_INTEGER-1))throw new RangeError('疲劳次数超过可保存范围，战斗状态保持原样。');
      const damage=state.fatigueVersion===1?++player.fatigueCount:rules.fatigueDamage;
      addLog(state, `${player.name}抽空牌库，主将受到${damage}点疲劳伤害。`);
      recordBattlePresentation(state,{kind:'fatigue',reason,owner:playerId,amount:damage});
      if (general) takeDamage(state, general, damage, { trueDamage:true });
      return null;
    }
    const id = player.deck.shift();
    expansionEvent(state,'draw',{owner:playerId},expansionApi(state));
    if (player.hand.length >= rules.handLimit) { recordBattlePresentation(state,{kind:'burn',reason,owner:playerId,cardId:id,origin:'draw'}); addLog(state, `${player.name}手牌已满，${getBattleCard(state,id,playerId).name}被烧毁。`); return null; }
    const handIndex=player.hand.length;player.hand.push(id);recordBattlePresentation(state,{kind:'draw',reason,owner:playerId,cardId:id,handIndex});return id;
  }
  if (state.schemaVersion === 5 && playerId === 0) {
    const supply = state.campaignSupply, index = supply.remaining.findIndex((value,i) => value < supply.capacity[i]);
    if (index < 0 || supply.resupply <= 0) return null;
    supply.remaining[index]++; supply.resupply--; return player.hand[index];
  }
  // Pause before touching the deck (or empty-deck fatigue), including over-cap legacy hands.
  if (player.hand.length >= ([5, 6, 7].includes(state.schemaVersion) ? state.enemyPlan.players[playerId]?.handLimit ?? HAND_LIMIT : HAND_LIMIT)) {
    addLog(state, `${player.name} 的手牌已满，暂停抽牌，牌库保留。`);
    return null;
  }
  if (!player.deck.length) {
    if (isTacticalMatch(state)) return null;
    const general = findGeneral(state, playerId);
    if (general) takeDamage(state, general, 1);
    addLog(state, `${player.name} 的牌库已空，主将受到 1 点疲劳伤害。`);
    return null;
  }
  const cardId = player.deck.shift();
  const handIndex=player.hand.length;player.hand.push(cardId);recordBattlePresentation(state,{kind:'draw',reason,owner:playerId,cardId,handIndex});
  return cardId;
}

export function toggleMulligan(state, handIndex) {
  if (state.phase !== 'mulligan' || !Number.isInteger(handIndex) || handIndex < 0 || handIndex >= state.players[0].hand.length) return false;
  const selected = state.mulligan.indexOf(handIndex);
  if (selected >= 0) state.mulligan.splice(selected, 1);
  else if (state.mulligan.length < 2) state.mulligan.push(handIndex);
  return true;
}

function beginTurn(state,playerId,firstTurn=false) {
  return withBattlePresentationStage(state,'turnStart',()=>beginTurnImpl(state,playerId,firstTurn));
}
function beginTurnImpl(state, playerId, firstTurn = false) {
  const player = state.players[playerId];
  resetTurnTriggers(player);
  const general = findGeneral(state, playerId);
  if (general?.tempHeroAttackBuff) { general.attackBuff -= general.tempHeroAttackBuff; delete general.tempHeroAttackBuff; }
  for (const egg of [...state.units].filter((unit) => unit.owner === playerId && unit.hatchCardId)) {
    if(!state.units.includes(egg))continue;
    const { x, y, hatchCardId } = egg;
    state.units = state.units.filter((unit) => unit.unitId !== egg.unitId);
    summonUnit(state, hatchCardId, playerId, x, y, { reborn: true, summonedThisTurn: false });
    // Hatching can trigger the Starhorn draw passive and lethal fatigue. A
    // terminal result must survive the turn transition, and a defeated seat
    // cannot hatch further eggs or be assigned an AI turn.
    if(settleTurnStart(state,playerId))return;
  }
  state.currentPlayer = playerId;
  state.turnSerial += 1;
  if (player.turnsStarted > 0) {
    const plan = [5, 6, 7].includes(state.schemaVersion) ? state.enemyPlan.players[playerId] : null;
    player.maxMana = Math.min(plan?.manaCap ?? 9, player.maxMana + (plan?.manaGrowth ?? 1));
    if (![6,7].includes(state.schemaVersion) && !(state.schemaVersion === 5 && playerId === 0)) for (let i = 0; i < (plan?.drawPerTurn ?? 1); i++) drawCard(state, playerId);
    if(settleTurnStart(state,playerId))return;
  }
  player.mana = player.maxMana;
  player.bbsUsed = false;
  if ([6,7].includes(state.schemaVersion)) player.replacesUsed = 0;
  player.turnsStarted += 1;
  for (const unit of state.units) {
    if (unit.owner === playerId) {
      if ([5, 6, 7].includes(state.schemaVersion)) { unit.bodyguardUsed = false; unit.skirmishUsed = false; }
      unit.moved = false;
      unit.attacked = false;
      if(isExpansion(state)){unit.movesUsed=0;unit.attacksUsed=0;}
      unit.summonedThisTurn = false;
      if (unit.tempAttackBuff) { unit.attackBuff -= unit.tempAttackBuff; delete unit.tempAttackBuff; }
      if (unit.stunTurns > 0) { unit.stunTurns -= 1; unit.moved = true; unit.attacked = true; }
    }
  }
  for (const unit of state.units.filter((entry) => entry.owner === playerId && entry.health > 0)) {
    const grow = unitRuleCard(state, unit)?.grow ?? 0;
    if (grow) { unit.attackBuff += grow; unit.healthBuff += grow; unit.health += grow; }
  }
  for (const obelysk of [...state.units].filter((unit) => unit.owner === playerId && unitRuleCard(state, unit)?.obelysk)) {
    const pos = adjacentFreeCells(state, obelysk)[0];
    if (pos) summonUnit(state, 217, playerId, pos.x, pos.y, { token: true, dervish: true });
  }
  if(isExpansion(state))for(const unit of [...state.units].filter(u=>u.owner===playerId)){const c=unitRuleCard(state,unit);if(c?.startSelfDamage)takeDamage(state,findGeneral(state,playerId),c.startSelfDamage,{sourceOwner:playerId});}
  recruitmentStart(state,playerId,expansionApi(state));
  if(settleTurnStart(state,playerId))return;
  const capturedOrbs = (state.manaTiles ?? []).filter((tile) => occupiedUnit(state, tile.x, tile.y)?.owner === playerId).length;
  player.mana += capturedOrbs;
  if (isTacticalMatch(state)) {
    for (const tile of boardOf(state).tiles.filter((entry) => entry.type === 'outpost')) {
      const owner = occupiedUnit(state, tile.x, tile.y)?.owner;
      if (owner !== undefined) state.outposts[`${tile.x},${tile.y}`] = owner;
    }
    const outpostMana = Object.values(state.outposts).filter((owner) => owner === playerId).length;
    player.mana = Math.min([5, 6, 7].includes(state.schemaVersion) ? state.enemyPlan.players[playerId]?.manaCap ?? 9 : 9, player.mana + outpostMana);
  }
  if (playerId === 0) {
    state.round += 1;
    state.phase = 'playing';
    addLog(state, firstTurn ? '你的第一回合开始。' : `第 ${state.round} 回合开始。`);
  } else {
    state.phase = 'ai';
    if (isTacticalMatch(state)) addLog(state, `${player.name}开始回合。`);
    else addLog(state, capturedOrbs ? `齐兰占据法力泉，获得 ${capturedOrbs} 点额外法力。` : '齐兰开始回合。');
  }
  if(usesTurnStartDraw(state)){
    for(let i=0;i<state.deckRules[playerId].drawPerTurn&&state.phase!=='over'&&findGeneral(state,playerId);i++)drawCard(state,playerId,{reason:'turnStart'});
    if(settleTurnStart(state,playerId))return;
  }
  state.selectedUnitId = null;
  state.lastAction = null;
}

function settleTurnStart(state,owner) {
  if(state.phase==='over')return true;
  if(!isTacticalMatch(state)||findGeneral(state,owner))return false;
  const living=state.players.map(p=>p.id).filter(id=>findGeneral(state,id));
  if(!living.includes(0)){finishExpedition(state,1,'general-defeated');return true;}
  if(!living.some(id=>id!==0)){finishExpedition(state,0,'enemies-eliminated');return true;}
  const next=living.find(id=>id>owner)??living[0];
  if(next===0&&state.objective.type==='survive'&&state.round>=state.objective.rounds){finishExpedition(state,0,'survived');return true;}
  if(next===0&&state.round>=state.turnLimit){finishExpedition(state,1,'turn-limit');return true;}
  beginTurn(state,next,false);return true;
}

export function confirmMulligan(state) {
  if (state.phase !== 'mulligan') return false;
  const player = state.players[0];
  if ([6,7].includes(state.schemaVersion)) {
    if (!validDrawBattle(state)) return false;
    const returned=[];
    for (const index of state.mulligan) { const previousCardId=player.hand[index];returned.push(previousCardId);player.hand[index] = player.deck.shift();recordBattlePresentation(state,{kind:'mulligan',owner:0,cardId:player.hand[index],previousCardId,handIndex:index}); }
    player.deck = shuffled([...player.deck,...returned],()=>battleRandom(state));
    state.mulligan=[]; beginTurn(state,0,true); return true;
  }
  const indices = [...state.mulligan].sort((a, b) => b - a);
  for (const index of indices) {
    if (index < player.hand.length) player.deck.push(player.hand.splice(index, 1)[0]);
  }
  player.deck = shuffled(player.deck,()=>battleRandom(state));
  for (let i = 0; i < indices.length; i++) drawCard(state, 0);
  state.mulligan = [];
  beginTurn(state, 0, true);
  return true;
}

function findPath(state, unit, maxSteps) {
  const start = { x: unit.x, y: unit.y, steps: 0, path: [{ x: unit.x, y: unit.y }] };
  const queue = [start];
  const visited = new Set([`${start.x},${start.y}`]);
  const positions = [];
  const provoked = state.units.some((other) => other.owner !== unit.owner && other.health > 0 && isNear(unit, other) && (unitRuleCard(state, other)?.provoke || other.provokeBuff));
  if (provoked || unit.hatchCardId || unitRuleCard(state, unit)?.obelysk || (unitRuleCard(state, unit)?.speed === 0)) return [];
  if (unitRuleCard(state, unit)?.flying) {
    for (let y = 0; y < boardOf(state).rows; y++) for (let x = 0; x < boardOf(state).columns; x++) {
      if (!occupiedUnit(state, x, y) && terrainAt(state, x, y) !== 'wall') positions.push({ x, y, path: [{ x: unit.x, y: unit.y }, { x, y }] });
    }
    return positions;
  }
  while (queue.length) {
    const current = queue.shift();
    if (current.steps > 0 && !occupiedUnit(state, current.x, current.y)) positions.push(current);
    if (current.steps >= maxSteps) continue;
    // Original MOVE_PATTERN_STEP is cardinal. Allies can be crossed but never occupied.
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const x = current.x + dx, y = current.y + dy, key = `${x},${y}`;
      const occupant = occupiedUnit(state, x, y);
      const stepCost = terrainAt(state, x, y) === 'rough' ? 2 : 1;
      if (!withinBoard(x, y, boardOf(state)) || terrainAt(state, x, y) === 'wall' || current.steps + stepCost > maxSteps || visited.has(key) || occupant && occupant.owner !== unit.owner) continue;
      visited.add(key);
      queue.push({ x, y, steps: current.steps + stepCost, path: [...current.path, { x, y }] });
    }
  }
  return positions;
}

export function movementSpeed(state,unit) {
  const card=unitRuleCard(state,unit);
  return (card?.speed??2)+(isRecruitmentExpansion(state)?state.units.filter(source=>source.owner===unit.owner&&source.health>0).reduce((sum,source)=>sum+(unitRuleCard(state,source)?.movementAura??0),0):0);
}
export function movementPositions(state, unit) {
  if (!unit || unit.hatchCardId || unit.moved || unit.summonedThisTurn || state.currentPlayer !== unit.owner) return [];
  return findPath(state, unit, movementSpeed(state,unit)).map(({ x, y }) => ({ x, y }));
}

export function movementPath(state, unit, x, y) {
  if (!unit || unit.moved || unit.summonedThisTurn || state.currentPlayer !== unit.owner) return [];
  return findPath(state, unit, movementSpeed(state,unit)).find((position) => position.x === x && position.y === y)?.path ?? [];
}

function canReachWithCard(card, source, target) {
  const range = cardAttackRange(card);
  if (range === null || distance(source,target) > range) return false;
  return !card?.blast || source.x === target.x || source.y === target.y || isNear(source,target);
}
function attackableEnemies(state, unit) {
  const card = unitRuleCard(state, unit);
  const nearby = state.units.filter((other) => other.owner !== unit.owner && other.health > 0 && isNear(unit, other));
  const provokes = nearby.filter((other) => unitRuleCard(state, other)?.provoke || other.provokeBuff);
  const enemies = (card?.ranged || card?.blast) && !provokes.length
    ? state.units.filter((other) => other.owner !== unit.owner && other.health > 0 && (card.ranged || other.x === unit.x || other.y === unit.y) && canReachWithCard(card,unit,other))
    : nearby;
  return provokes.length ? provokes : enemies;
}

export function attackPositions(state, unit) {
  if (!unit || unit.attacked || unit.summonedThisTurn || state.currentPlayer !== unit.owner) return [];
  return attackableEnemies(state, unit).map((target) => ({ x: target.x, y: target.y, unitId: target.unitId }));
}

export function moveUnit(state, unitId, x, y, playerId = state.currentPlayer) {
  if (!canPlay(state, playerId)) return false;
  const unit = state.units.find((entry) => entry.unitId === unitId && entry.owner === playerId);
  const path = movementPath(state, unit, x, y);
  if (!path.length) return false;
  unit.x = x; unit.y = y; unit.moved = true;
  if(isExpansion(state)){unit.movesUsed=(unit.movesUsed??0)+1;unit.moved=unit.movesUsed>=actionQuota(state,unit,unitRuleCard(state,unit));}
  if(isExpansion(state))refreshAuras(state);
  state.selectedUnitId = unitId;
  const card = unitRuleCard(state, unit);
  addLog(state, `${card.name} 移动。`);
  state.lastAction = { kind: 'move', x, y, unitId, path };
  return true;
}

// Preview uses the actual synchronous settlement, including death summons. Restore
// the module's allocator so inspecting an attack never consumes real unit IDs.
export function simulateAttackUnit(state, attackerId, targetId, playerId = state.currentPlayer) {
  const snapshot = clone(state);
  const audit=challengeContext(state);if(audit)bindChallengeContext(snapshot,audit);
  const savedNextUnitId = nextUnitId;
  try {
    return attackUnit(snapshot, attackerId, targetId, playerId) ? snapshot : null;
  } finally {
    nextUnitId = savedNextUnitId;
  }
}

export function attackUnit(state, attackerId, targetId, playerId = state.currentPlayer, fromFrenzy = false) {
  if (!canPlay(state, playerId)) return false;
  const attacker = state.units.find((unit) => unit.unitId === attackerId && unit.owner === playerId);
  const target = state.units.find((unit) => unit.unitId === targetId && unit.owner !== playerId);
  if (!attacker || !target || !(fromFrenzy ? isNear(attacker,target) : attackPositions(state, attacker).some((pos) => pos.unitId === targetId))) return false;
  const frenzyTargets=state.schemaVersion===7&&!fromFrenzy&&unitRuleCard(state,attacker)?.frenzy&&isNear(attacker,target)?state.units.filter(other=>other.owner!==playerId&&other.unitId!==targetId&&isNear(attacker,other)).map(other=>other.unitId):[];
  const attack = effectiveAttack(state, attacker);
  let retaliation = effectiveAttack(state, target);
  const attackerCard = unitRuleCard(state, attacker);let targetCard = unitRuleCard(state, target);
  const behind = attacker.y === target.y && attacker.x === target.x + (target.owner === 0 ? -1 : 1);
  let dealt = attack + (attackerCard?.type === 'general' && targetCard?.type === 'unit' ? state.players[playerId].bbsMinionAttackBonus ?? 0 : 0);
  if (behind && attackerCard?.backstab) {
    dealt += attackerCard.backstab === true ? 1 : attackerCard.backstab;
    const triggers = state.players[playerId].turnTriggers;
    if (heroOf(state, playerId)?.id === 101 && triggers && !triggers.backstab) { triggers.backstab = true; dealt += 1; }
  }
  attacker.attacked = true;
  if(isExpansion(state)&&!fromFrenzy){attacker.attacksUsed=(attacker.attacksUsed??0)+1;attacker.attacked=attacker.attacksUsed>=actionQuota(state,attacker,attackerCard);if(attackerCard.attackDispel){dispelCell(state,target.x,target.y);targetCard=unitRuleCard(state,target);retaliation=effectiveAttack(state,target);}}
  if (attacker.specialization === 'skirmish' && !attacker.skirmishUsed) { attacker.moved = false;if(isExpansion(state))attacker.movesUsed=Math.min(attacker.movesUsed??0,actionQuota(state,attacker,attackerCard)-1); attacker.skirmishUsed = true; }
  addLog(state, `${attackerCard.name} 攻击 ${targetCard.name}（${dealt} 点伤害）。`);
  const primaryDamage=takeDamage(state, target, dealt, { sourceOwner: playerId, sourceId: attackerId,attack:true });
  const blastVictims = [];
  if (attackerCard?.blast) {
    const dx = Math.sign(target.x - attacker.x), dy = Math.sign(target.y - attacker.y);
    blastVictims.push(...state.units.filter((unit) => unit.owner !== playerId && unit.unitId !== targetId && canReachWithCard(attackerCard,attacker,unit) && (dx ? unit.y === attacker.y && Math.sign(unit.x - attacker.x) === dx : unit.x === attacker.x && Math.sign(unit.y - attacker.y) === dy)));
    for (const splash of [...blastVictims]) takeDamage(state, splash, attackerCard.blast === true ? dealt : attackerCard.blast, { sourceOwner: playerId, sourceId: attackerId,attack:true });
  }
  const targetCanReach = canReachWithCard(targetCard,target,attacker);
  const retaliated = !(isRecruitmentExpansion(state)&&fromFrenzy) && state.phase !== 'over' && state.units.some((unit) => unit.unitId === attackerId) && target.health > 0 && !(behind && attackerCard?.backstab) && targetCanReach;
  let retaliationDamage=0;
  if (retaliated) {
    retaliationDamage=takeDamage(state, attacker, retaliation, { sourceOwner: target.owner, sourceId: targetId,attack:true });
  }
  if (targetCard?.wall && !(isRecruitmentExpansion(state)&&fromFrenzy) && (!isExpansion(state)||target.cardId===525) && state.units.some((unit) => unit.unitId === attackerId)) { attacker.stunTurns = 1; attacker.moved = true; attacker.attacked = true; }
  const statChanges = [{ unitId: targetId, kind: 'damage', amount: primaryDamage }];
  for (const splash of blastVictims) statChanges.push({ unitId: splash.unitId, kind: 'damage', amount: attackerCard.blast === true ? dealt : attackerCard.blast });
  if (retaliated) statChanges.push({ unitId: attackerId, kind: 'damage', amount: retaliationDamage });
  state.lastAction = { kind: 'attack', unitId: attackerId, sourceId: attackerId, targetId, targetIds: [targetId, ...blastVictims.map((unit) => unit.unitId)], cardId: attacker.cardId, retaliated, statChanges };
  const primary=clone(state.lastAction);
  for(const otherId of frenzyTargets) {
    if(state.phase==='over'||!state.units.includes(attacker))break;
    const other=state.units.find(unit=>unit.unitId===otherId);if(!other||!isNear(attacker,other))continue;
    attacker.attacked=false;
    if(attackUnit(state,attackerId,otherId,playerId,true)){primary.targetIds.push(...state.lastAction.targetIds);primary.statChanges.push(...state.lastAction.statChanges);}
    attacker.attacked=true;
  }
  if(isExpansion(state)&&!fromFrenzy&&state.units.includes(attacker)){attacker.attacked=(attacker.attacksUsed??1)>=actionQuota(state,attacker,unitRuleCard(state,attacker));if(attackerCard.attackWatchBuff)buff(attacker,attackerCard.attackWatchBuff,attackerCard.attackWatchBuff);}
  state.lastAction=primary;
  return true;
}

function spellTargetsBase(state, spell, playerId = state.currentPlayer) {
  if ([5, 6, 7].includes(state.schemaVersion)) spell = getBattleCard(state, spell?.id, playerId);
  if (!spell || spell.type !== 'spell') return [];
  if(isExpansion(state)&&EXPANSION_SPELL_IDS.includes(spell.id)){const minions=state.units.filter(u=>unitRuleCard(state,u)?.type==='unit');if(spell.target==='damagedAlly')return minions.filter(u=>u.owner===playerId&&u.health<u.maxHealth+u.healthBuff);if(spell.target==='allyDervish')return minions.filter(u=>u.owner===playerId&&unitRuleCard(state,u)?.race==='dervish');if(spell.target==='none')return []; }
  if(state.schemaVersion===7) {
    const minions=state.units.filter(unit=>unitRuleCard(state,unit)?.type==='unit');
    if(spell.target==='enemyMinion')return minions.filter(unit=>unit.owner!==playerId&&(!spell.nearGeneral||isNear(unit,findGeneral(state,playerId))));
    if(spell.target==='lowestAttack'){const minimum=Math.min(...minions.map(unit=>effectiveAttack(state,unit)));return minions.filter(unit=>effectiveAttack(state,unit)===minimum);}
    if(spell.target==='allMinions')return minions.filter(unit=>effectiveAttack(state,unit)<=spell.maxAttack);
    if(spell.target==='occupiedCell')return state.units;
  }
  if (spell.effect === 'heal') return state.units.filter((unit) => unit.health < unit.maxHealth + unit.healthBuff);
  if (spell.effect === 'strike') return state.units.filter((unit) => unitRuleCard(state, unit)?.type === 'unit');
  if (spell.target === 'self') { const general = findGeneral(state, playerId); return general ? [general] : []; }
  if (spell.target === 'ally') return state.units.filter((unit) => unit.owner === playerId && unitRuleCard(state, unit)?.type === 'unit' && (!spell.refresh || effectiveAttack(state, unit) <= (spell.maxAttack ?? 3)));
  if (spell.target === 'minion') return state.units.filter((unit) => unitRuleCard(state, unit)?.type === 'unit');
  if (spell.target === 'enemy') {
    const enemies = state.units.filter((unit) => unit.owner !== playerId);
    if (spell.effect === 'voidPulse') return enemies.filter((unit) => unitRuleCard(state, unit)?.type === 'general');
    return enemies.filter((unit) => spell.effect !== 'flashFreeze' || unitRuleCard(state, unit)?.type === 'unit');
  }
  if (spell.target === 'enemyArea') return state.units.filter((unit) => unit.owner !== playerId && isNear(unit, findGeneral(state, unit.owner)));
  if (['damage', 'drain', 'stun'].includes(spell.effect)) return state.units.filter((unit) => unit.owner !== playerId);
  if (spell.effect === 'bond') return state.units.filter((unit) => unitRuleCard(state, unit)?.type === 'unit');
  if (['buff', 'buffDraw'].includes(spell.effect)) return state.units.filter((unit) => unit.owner === playerId && unitRuleCard(state, unit)?.type === 'unit');
  if (spell.effect === 'damageArea') return state.units.filter((unit) => unit.owner !== playerId && unitRuleCard(state, unit)?.type === 'unit' && isNear(unit, findGeneral(state, playerId)));
  if (spell.effect === 'roar') {
    const general = findGeneral(state, playerId);
    return general ? state.units.filter((unit) => unit.owner === playerId && unitRuleCard(state, unit)?.type === 'unit' && isNear(unit, general)) : [];
  }
  return [];
}

export function spellPositions(state, spell, playerId = state.currentPlayer, selectedId = null) {
  if ([5, 6, 7].includes(state.schemaVersion)) spell = getBattleCard(state, spell?.id, playerId);
  if(isExpansion(state)&&spell?.target==='areaCell'){const cells=[];for(let y=0;y<boardOf(state).rows;y++)for(let x=0;x<boardOf(state).columns;x++)cells.push({x,y});return cells;}
  if(state.schemaVersion===7&&(spell?.followup==='teleport'||spell?.effect==='chromaticCold')) {
    const cells=[];for(let y=0;y<boardOf(state).rows;y++)for(let x=0;x<boardOf(state).columns;x++) {
      const occupied=occupiedUnit(state,x,y);
      if(spell.effect==='chromaticCold'||terrainAt(state,x,y)!=='wall'&&(!occupied||occupied.unitId===selectedId))cells.push({x,y});
    }return cells;
  }
  if (!spell || spell.type !== 'spell' || spell.target !== 'cell'  || !state.players[playerId]) return [];
  const result = [], board = boardOf(state);
  for (let y = 0; y < board.rows; y++) for (let x = 0; x < board.columns; x++) {
    if (!occupiedUnit(state, x, y) && terrainAt(state, x, y) !== 'wall') result.push({ x, y });
  }
  return result;
}

export function playCard(state, handIndex, x, y, playerId = state.currentPlayer, openingTarget = null) {
  if (!canPlay(state, playerId) || !canUseHandCard(state, handIndex, playerId)) return false;
  const player = state.players[playerId], card = getBattleCard(state, player.hand[handIndex], playerId);
  if (!card || card.type !== 'unit' || player.mana < card.cost) return false;
  if (!summonPositions(state, playerId, card.id).some((pos) => pos.x === x && pos.y === y)) return false;
  if(state.schemaVersion===7&&card.openingDispel&&openingTarget&&!getOpeningFollowup(state,card.id,{x,y},playerId).cells.some(cell=>cell.x===openingTarget.x&&cell.y===openingTarget.y))return false;
  if(isExpansion(state)&&!validOpeningChoice(state,card,{x,y},playerId,openingTarget))return false;
  player.mana -= card.cost;
  removeHandCard(state, player, handIndex);
  const unit = summonUnit(state, card.id, playerId, x, y,{...(openingTarget?{openingTarget}:{}),...(isExpansion(state)?{fromHand:true}:{})});
  addLog(state, `${player.name} 召唤 ${card.name}。`);
  state.lastAction = { kind: 'summon', x, y, unitId: unit.unitId, cardId: card.id };
  return true;
}

function castContentSpell(state, index, argument, owner) {
  const player=state.players[owner],spell=getBattleCard(state,player.hand[index],owner);
  const primaryId=typeof argument==='number'?argument:argument?.unitId??argument?.unitIds?.[0];
  const target=state.units.find(unit=>unit.unitId===primaryId), cell=argument?.cell??(argument&&Number.isInteger(argument.x)?argument:null);
  let second=null;
  if(spell.effect==='chromaticCold') { if(!cell||!spellPositions(state,spell,owner).some(pos=>pos.x===cell.x&&pos.y===cell.y))return false; }
  else if(spell.effect==='plasmaStorm') { if(!spellTargets(state,spell,owner).length)return false; }
  else if(!target||!spellTargets(state,spell,owner).some(unit=>unit.unitId===primaryId))return false;
  if(spell.followup==='teleport') {
    if(!cell||!getSpellFollowup(state,spell,primaryId,owner)?.cells.some(pos=>pos.x===cell.x&&pos.y===cell.y))return false;
  }
  if(spell.followup==='swap') {
    const secondId=argument?.unitIds?.[1]??argument?.secondUnitId;
    second=state.units.find(unit=>unit.unitId===secondId);
    if(!second||!getSpellFollowup(state,spell,primaryId,owner)?.unitIds.includes(secondId))return false;
  }
  player.mana-=spell.cost;removeHandCard(state,player,index);
  const ids=[],changes=[];
  if(spell.effect==='mistDragonSeal') { target.attackBuff+=spell.attackBuff;target.healthBuff+=spell.healthBuff;target.health+=spell.healthBuff;target.x=cell.x;target.y=cell.y;ids.push(target.unitId); }
  if(spell.effect==='daemonicLure') { takeDamage(state,target,spell.amount,{sourceOwner:owner});if(state.units.includes(target)&&state.phase!=='over'){target.x=cell.x;target.y=cell.y;}ids.push(primaryId);changes.push({unitId:primaryId,kind:'damage',amount:spell.amount}); }
  if(spell.effect==='juxtaposition') { const old={x:target.x,y:target.y};target.x=second.x;target.y=second.y;second.x=old.x;second.y=old.y;ids.push(target.unitId,second.unitId); }
  if(spell.effect==='siphonEnergy'){dispelCell(state,target.x,target.y);ids.push(primaryId);}
  if(['entropicDecay','naturalSelection','darkTransformation'].includes(spell.effect)) {
    const old={x:target.x,y:target.y};destroyUnit(state,target,owner);ids.push(primaryId);
    if(spell.effect==='darkTransformation'&&state.phase!=='over'&&!occupiedUnit(state,old.x,old.y)){const made=summonUnit(state,spell.deathSpawn,owner,old.x,old.y,{token:true});if(made)ids.push(made.unitId);}
  }
  if(spell.effect==='plasmaStorm')for(const victim of [...spellTargets(state,spell,owner)]) {if(state.phase==='over')break;ids.push(victim.unitId);destroyUnit(state,victim,owner);}
  if(spell.effect==='chromaticCold') { const victim=occupiedUnit(state,cell.x,cell.y);dispelCell(state,cell.x,cell.y);if(victim){ids.push(victim.unitId);if(victim.owner!==owner&&state.units.includes(victim)&&state.phase!=='over')takeDamage(state,victim,spell.amount,{sourceOwner:owner});} }
  if(spell.effect==='aspectRavager'){transformUnit(state,target,spell.transform);ids.push(primaryId);}
  refreshAuras(state);
  if(state.phase!=='over')changes.push(...onSpellCast(state,owner,spell));
  addLog(state,`${player.name}施放${spell.name}。`);
  state.lastAction={kind:'spell',effect:spell.effect,cardId:spell.id,sourceId:findGeneral(state,owner)?.unitId, targetId:primaryId??null,targetIds:ids,cell:cell??null,statChanges:changes};return true;
}

function castSpellImpl(state, handIndex, targetUnitId = null, playerId = state.currentPlayer) {
  if (!canPlay(state, playerId) || !canUseHandCard(state, handIndex, playerId)) return false;
  const player = state.players[playerId], spell = getBattleCard(state, player.hand[handIndex], playerId);
  if (!spell || spell.type !== 'spell' || player.mana < spell.cost) return false;
  if(isExpansion(state)&&EXPANSION_SPELL_IDS.includes(spell.id))return castExpansionSpell(state,handIndex,targetUnitId,playerId);
  if(state.schemaVersion===7&&SCHEMA7_SPELL_RULES[spell.id])return castContentSpell(state,handIndex,targetUnitId,playerId);
  const cellTarget = targetUnitId && typeof targetUnitId === 'object' ? targetUnitId : null;
  if (spell.summon) {
    if (!cellTarget || !withinBoard(cellTarget.x, cellTarget.y, boardOf(state)) || occupiedUnit(state, cellTarget.x, cellTarget.y) || terrainAt(state, cellTarget.x, cellTarget.y) === 'wall') return false;
    player.mana -= spell.cost; removeHandCard(state, player, handIndex);
    const count = spell.count ?? 1, cells = [{ x: cellTarget.x, y: cellTarget.y }, ...adjacentFreeCells(state, cellTarget)].slice(0, count);
    const made = cells.map((cell) => summonUnit(state, spell.summon, playerId, cell.x, cell.y, { token: true })).filter(Boolean);
    if (!made.length) return false;
    const watchChanges = onSpellCast(state, playerId, spell);
    state.lastAction = { kind: 'spell', effect: spell.effect, cardId: spell.id, targetIds: [...new Set([...made.map((unit) => unit.unitId), ...watchChanges.map((change) => change.unitId)])], cell: cellTarget, statChanges: watchChanges };
    return true;
  }
  if (spell.effect === 'tempest') {
    const targetIds = state.units.map((unit) => unit.unitId);
    const sourceId = findGeneral(state, playerId)?.unitId;
    player.mana -= spell.cost;
    removeHandCard(state, player, handIndex);
    for (const unit of [...state.units]) takeDamage(state, unit, spell.amount ?? 2);
    const watchChanges = onSpellCast(state, playerId, spell);
    addLog(state, `风暴席卷棋盘，所有单位受到 ${spell.amount ?? 2} 点伤害。`);
    state.lastAction = { kind: 'spell', effect: 'tempest', cardId: spell.id, sourceId, targetIds,
      statChanges: [...targetIds.map((unitId) => ({ unitId, kind: 'damage', amount: spell.amount ?? 2 })), ...watchChanges] };
    return true;
  }
  if (spell.target === 'enemyArea') {
    const targets = spellTargets(state, spell, playerId);
    player.mana -= spell.cost; removeHandCard(state, player, handIndex);
    for (const victim of [...targets]) takeDamage(state, victim, spell.amount ?? 1, { sourceOwner: playerId });
    const watchChanges = onSpellCast(state, playerId, spell);
    state.lastAction = { kind: 'spell', effect: spell.effect, cardId: spell.id, sourceId: findGeneral(state, playerId)?.unitId, targetIds: [...new Set([...targets.map((unit) => unit.unitId), ...watchChanges.map((change) => change.unitId)])], statChanges: [...targets.map((unit) => ({ unitId: unit.unitId, kind: 'damage', amount: spell.amount ?? 1 })), ...watchChanges] };
    return true;
  }
  const resolvedTargetId = spell.target === 'self' && targetUnitId === null ? findGeneral(state, playerId)?.unitId : targetUnitId;
  const target = state.units.find((unit) => unit.unitId === resolvedTargetId);
  if (!target || !spellTargets(state, spell, playerId).some((unit) => unit.unitId === resolvedTargetId)) return false;
  player.mana -= spell.cost;
  removeHandCard(state, player, handIndex);
  const statChanges = [];
  if (spell.effect === 'heal') statChanges.push({ unitId: resolvedTargetId, kind: 'heal', amount: triggerHeal(state, target, spell.amount ?? spell.heal ?? 5) });
  if (spell.effect === 'strike') takeDamage(state, target, spell.amount ?? 2);
  if (spell.effect === 'phoenixFire') { const amount = spell.amount ?? 3; takeDamage(state, target, amount, { sourceOwner: playerId }); statChanges.push({ unitId: resolvedTargetId, kind: 'damage', amount }); }
  if (spell.effect === 'voidPulse') {
    const amount = spell.amount ?? 2, ownGeneral = findGeneral(state, playerId);
    takeDamage(state, target, amount, { sourceOwner: playerId });
    statChanges.push({ unitId: resolvedTargetId, kind: 'damage', amount });
    const healed = triggerHeal(state, ownGeneral, spell.heal ?? 3);
    if (healed) statChanges.push({ unitId: ownGeneral.unitId, kind: 'heal', amount: healed });
  }
  if (spell.effect === 'damage') takeDamage(state, target, spell.amount ?? 3, { sourceOwner: playerId });
  if (spell.effect === 'drain') { takeDamage(state, target, spell.amount ?? 2, { sourceOwner: playerId }); triggerHeal(state, findGeneral(state, playerId), spell.heal ?? 2); }
  if (spell.effect === 'strike') statChanges.push({ unitId: targetUnitId, kind: 'damage', amount: spell.amount ?? 2 });
  if (spell.effect === 'bond') target.attackBuff += target.health + (spell.bondBonus ?? 0);
  if (spell.effect === 'roar') target.attackBuff += spell.amount ?? spell.attackBuff ?? 2;
  if (['buff', 'buffDraw'].includes(spell.effect)) {
    const attack = spell.attack ?? spell.attackBuff ?? 0, health = spell.health ?? spell.healthBuff ?? 0;
    target.attackBuff += attack; target.healthBuff += health; target.health += health;
    if (spell.effect === 'buffDraw') drawCard(state, playerId);
  }
  if (['firstWish', 'greaterFortitude'].includes(spell.effect)) {
    target.attackBuff += spell.attackBuff ?? 0; target.healthBuff += spell.healthBuff ?? 0; target.health += spell.healthBuff ?? 0;
    if (spell.draw) drawCard(state, playerId);
  }
  if (spell.effect === 'innerFocus') {
    // A refresh grants a fresh action allowance, including after an earlier
    // refresh in the same turn. Stun still blocks both actions below.
    if(isExpansion(state)){target.movesUsed=0;target.attacksUsed=0;}
    target.moved = [5, 6, 7].includes(state.schemaVersion) && target.stunTurns > 0;
    target.attacked = [5, 6, 7].includes(state.schemaVersion) && target.stunTurns > 0;
    target.summonedThisTurn = false;
  }
  if (spell.effect === 'earthSphere') { const healed = triggerHeal(state, target, spell.heal ?? 8); if (healed) statChanges.push({ unitId: resolvedTargetId, kind: 'heal', amount: healed }); }
  if (spell.effect === 'flashFreeze') { const amount = spell.amount ?? 1; takeDamage(state, target, amount, { sourceOwner: playerId }); statChanges.push({ unitId: resolvedTargetId, kind: 'damage', amount }); target.stunTurns = 1; target.moved = true; target.attacked = true; }
  if (spell.effect === 'damageArea') for (const victim of [...spellTargets(state, spell, playerId)]) takeDamage(state, victim, spell.amount ?? 1, { sourceOwner: playerId });
  if (spell.effect === 'stun') { target.stunTurns = Math.max(1, target.stunTurns ?? 0); target.moved = true; target.attacked = true; }
  statChanges.push(...onSpellCast(state, playerId, spell));
  addLog(state, `${player.name} 施放 ${spell.name}。`);
  state.lastAction = { kind: 'spell', effect: spell.effect, cardId: spell.id, sourceId: findGeneral(state, playerId)?.unitId, targetId: resolvedTargetId, targetIds: [...new Set([resolvedTargetId, ...statChanges.map((change) => change.unitId)].filter(Number.isInteger))], statChanges };
  return true;
}

function onSpellCast(state, playerId, spell) {
  const statChanges = [];
  if (spell?.tactical) { const general = findGeneral(state, playerId), healed = triggerHeal(state, general, 2); if (healed) statChanges.push({unitId: general.unitId, kind:'heal', amount:healed}); }
  for (const watcher of [...state.units].filter((unit) => unit.owner === playerId && unit.health > 0 && unitRuleCard(state, unit)?.spellWatchLeech)) {
    if (!state.units.includes(watcher) || state.phase === 'over') continue;
    // Original is a duel. In multi-army scenarios choose the lowest living enemy owner.
    const enemy = state.units.filter((unit) => unit.owner !== playerId && unit.health > 0 && unitRuleCard(state, unit)?.type === 'general').sort((a,b) => a.owner-b.owner)[0];
    const amount = unitRuleCard(state, watcher).spellWatchLeech;
    if (enemy) { takeDamage(state, enemy, amount, { sourceOwner: playerId, sourceId: watcher.unitId }); statChanges.push({unitId:enemy.unitId,kind:'damage',amount}); }
    const own = findGeneral(state, playerId), healed = triggerHeal(state, own, amount);
    if (healed) statChanges.push({unitId:own.unitId,kind:'heal',amount:healed});
  }
  for (const unit of state.units.filter((entry) => entry.owner === playerId && (unitRuleCard(state, entry)?.spellgrowth || unitRuleCard(state, entry)?.spellWatch))) {
    unit.attackBuff += 1; unit.healthBuff += 1; unit.health += 1;
  }
  const triggers = state.players[playerId]?.turnTriggers;
  if (heroOf(state, playerId)?.id === 123 && triggers && !triggers.spell) {
    triggers.spell = true;
    const ranged = state.units.filter((unit) => unit.owner === playerId && unitRuleCard(state, unit)?.type === 'unit' && unitRuleCard(state, unit)?.ranged).sort((a, b) => a.unitId - b.unitId)[0];
    if (ranged) ranged.attackBuff += 1;
  }
  return statChanges;
}

export function battleCommandTargets(state, playerId = 0) {
  const player = state.players[playerId], general = findGeneral(state, playerId);
  const result = { type: 'self', unitIds: [], cells: [], available: false,cost:battleCommandCost(state,playerId) };
  if (!player || !general || !canPlay(state, playerId) || player.bbsUsed || player.mana < result.cost) return result;
  const allies = state.units.filter((unit) => unit.owner === playerId && unitRuleCard(state, unit)?.type === 'unit');
  const enemies = state.units.filter((unit) => unit.owner !== playerId && unit.health > 0);
  switch (player.generalId) {
    case 1: result.type = 'ally'; result.unitIds = allies.filter((unit) => isNear(unit, general)).map((unit) => unit.unitId); break;
    case 23: result.type = 'ally'; result.unitIds = (isSchema4(state) ? allies.filter((unit) => unit.health < unit.maxHealth + unit.healthBuff) : allies).map((unit) => unit.unitId); break;
    case 101: result.type = 'ally'; result.unitIds = adjacentFreeCells(state, general).length ? allies.map((unit) => unit.unitId) : []; break;
    case 123: case 201: result.type = 'cell'; result.cells = adjacentFreeCells(state, general); break;
    case 323: result.type = 'enemy'; result.unitIds = enemies.map((unit) => unit.unitId); break;
    case 223: case 301: case 401: case 418: case 501: case 527: result.type = 'self'; result.available = true; return result;
    default: return result;
  }
  result.available = result.unitIds.length > 0 || result.cells.length > 0;
  return result;
}

export function useBattleCommand(state, targetUnitId, playerId = state.currentPlayer) {
  if (!canPlay(state, playerId)) return false;
  const player = state.players[playerId];
  const general = findGeneral(state, playerId);
  if (!general || player.bbsUsed || player.mana < battleCommandCost(state,playerId)) return false;
  const options = battleCommandTargets(state, playerId);
  const target = typeof targetUnitId === 'number' ? state.units.find((unit) => unit.unitId === targetUnitId) : null;
  const cell = targetUnitId && typeof targetUnitId === 'object' ? targetUnitId : null;
  if (!options.available || options.type === 'self' && targetUnitId !== null || options.type === 'cell' && !options.cells.some((p) => p.x === cell?.x && p.y === cell?.y) || ['ally', 'enemy'].includes(options.type) && !options.unitIds.includes(targetUnitId)) return false;
  const commandCost=battleCommandCost(state,playerId);player.mana -= commandCost;
  player.bbsUsed = true;
  const statChanges = [];
  const affectedIds = [];
  if (player.generalId === 1) {
    target.attackBuff += 2;
    addLog(state, '狮王怒吼：友方随从 +2 攻击。');
  } else if (player.generalId === 23) {
    statChanges.push({ unitId: targetUnitId, kind: 'heal', amount: triggerHeal(state, target, 3) });
    addLog(state, '日耀回生：友方随从恢复 3 点生命。');
  } else if (player.generalId === 101) {
    const old = { x: target.x, y: target.y }; target.x = -1; target.y = -1;
    const destination = adjacentFreeCells(state, general)[0];
    if (!destination) { target.x = old.x; target.y = old.y; player.mana += commandCost; player.bbsUsed = false; return false; }
    target.x = destination.x; target.y = destination.y;
  } else if (player.generalId === 123) { const made = summonUnit(state, 108, playerId, cell.x, cell.y, { token: true }); if (made) affectedIds.push(made.unitId); }
  else if (player.generalId === 201) { const made = summonUnit(state, 225, playerId, cell.x, cell.y, { token: true }); if (made) affectedIds.push(made.unitId); }
  else if (player.generalId === 223) { player.bbsMinionAttackBonus = 2; affectedIds.push(general.unitId); }
  else if (player.generalId === 301) for (const pos of adjacentFreeCells(state, general).slice(0, 2)) { const made = summonUnit(state, 315, playerId, pos.x, pos.y, { token: true }); if (made) affectedIds.push(made.unitId); }
  else if (player.generalId === 323) { takeDamage(state, target, 1, { sourceOwner: playerId }); statChanges.push({ unitId: target.unitId, kind: 'damage', amount: 1 }); affectedIds.push(target.unitId); (state.creepCells ??= {})[`${target.x},${target.y}`] = playerId; }
  else if (player.generalId === 401) { general.attackBuff += 1; affectedIds.push(general.unitId); }
  else if (player.generalId === 418) { for (const living of state.players.filter((entry) => findGeneral(state, entry.id))) drawCard(state, living.id); affectedIds.push(general.unitId); }
  else if (player.generalId === 501) {
    const enemyGeneral = state.units.filter((unit) => unit.owner !== playerId && unitRuleCard(state, unit)?.type === 'general').sort((a, b) => a.owner - b.owner || a.unitId - b.unitId)[0];
    if (!enemyGeneral) { player.mana += commandCost; player.bbsUsed = false; return false; }
    takeDamage(state, enemyGeneral, 2, { sourceOwner: playerId }); statChanges.push({ unitId: enemyGeneral.unitId, kind: 'damage', amount: 2 }); affectedIds.push(enemyGeneral.unitId);
  }
  else if (player.generalId === 527) { player.summonBuffThisTurn = true; affectedIds.push(general.unitId); }
  else {
    player.mana += commandCost; player.bbsUsed = false; return false;
  }
  refreshAuras(state);
  if (typeof targetUnitId === 'number') affectedIds.push(targetUnitId);
  state.lastAction = { kind: 'bbs', cardId: getHero(player.generalId)?.bbsCardId ?? player.generalId, sourceId: general.unitId, targetId: typeof targetUnitId === 'number' ? targetUnitId : affectedIds[0] ?? general.unitId, targetIds: [...new Set(affectedIds)], cell, effect: 'battle-command', statChanges };
  return true;
}

export function endTurn(state,playerId=state.currentPlayer,fromBot=false) {
  return withBattlePresentationStage(state,'turnEnd',()=>endTurnImpl(state,playerId,fromBot));
}
function endTurnImpl(state, playerId = state.currentPlayer, fromBot = false) {
  if (state.currentPlayer !== playerId || !['playing', 'ai'].includes(state.phase)) return false;
  if (state.mode === 'challenge' && !isTacticalMatch(state)) {
    state.phase = 'over';
    state.winner = 1;
    state.result = 'loss';
    addLog(state, '回合结束时敌方主将仍然存活，试炼失败。');
    return true;
  }
  if(isExpansion(state))expansionEnd(state,playerId,expansionApi(state));
  const beforeTurnUnits = new Map(state.units.map((unit) => [unit.unitId, { health: unit.health }]));
  for (const unit of state.units.filter((entry) => entry.owner === playerId && entry.health > 0)) {
    const card = unitRuleCard(state, unit);
    const general = findGeneral(state, playerId);
    if (card?.zealHeal && general && isNear(unit, general) && unit.health < unit.maxHealth + unit.healthBuff) {
      triggerHeal(state, unit, unit.maxHealth + unit.healthBuff - unit.health);
      addLog(state, '旭日少女在主将身边恢复了生命。');
    }
    if (card?.creepTrail) {
      state.creepCells ??= {};
      const cells = [];
      for (let y = unit.y - 1; y <= unit.y + 1; y++) for (let x = unit.x - 1; x <= unit.x + 1; x++) {
        const key = `${x},${y}`;
        if ((x !== unit.x || y !== unit.y) && withinBoard(x, y, boardOf(state)) && terrainAt(state, x, y) !== 'wall' && state.creepCells[key] === undefined) cells.push({ x, y });
      }
      const pos = cells.sort((a, b) => a.y - b.y || a.x - b.x)[0];
      if (pos) state.creepCells[`${pos.x},${pos.y}`] = playerId;
    }
  }
  refreshAuras(state);
  for (const victim of [...state.units]) {
    const creepOwner = state.creepCells?.[`${victim.x},${victim.y}`];
    if (creepOwner === playerId && victim.owner !== playerId) takeDamage(state, victim, state.units.filter((unit) => unit.owner === playerId && unit.health > 0).reduce((amount, unit) => amount * (unitRuleCard(state, unit)?.creepDamageMultiplier ?? 1), 1), { sourceOwner: playerId, creep: true });
  }
  for (const ally of state.units.filter((unit) => unit.owner === playerId && unit.tempAlliedAttackBuff)) {
    ally.attackBuff -= ally.tempAlliedAttackBuff; delete ally.tempAlliedAttackBuff;
  }
  for (const dervish of [...state.units].filter((unit) => unit.owner === playerId && unit.cardId === 217 && unit.expiresEndTurn)) takeDamage(state, dervish, dervish.health);
  if ([6,7].includes(state.schemaVersion) && state.phase !== 'over') {
    for (let i=0; i<(usesTurnStartDraw(state)?0:state.deckRules[playerId].drawPerTurn)+(state.players[playerId].drawBonus??0) && state.phase !== 'over' && findGeneral(state,playerId); i++) drawCard(state,playerId,{reason:i<(usesTurnStartDraw(state)?0:state.deckRules[playerId].drawPerTurn)?'turnEnd':'turnEndBonus'});
  }
  if(isExpansion(state)){delete state.players[playerId].drawBonus;delete state.players[playerId].deathDraw;}
  if ([6,7].includes(state.schemaVersion) && state.phase === 'over') { recordEndTurnAction(state,playerId,beforeTurnUnits); return true; }
  if (isTacticalMatch(state)) {
    const living = state.players.map((player) => player.id).filter((id) => findGeneral(state, id));
    if (!living.includes(0)) { finishExpedition(state, 1, 'general-defeated'); recordEndTurnAction(state, playerId, beforeTurnUnits); return true; }
    if (!living.some((id) => id !== 0)) { finishExpedition(state, 0, 'enemies-eliminated'); recordEndTurnAction(state, playerId, beforeTurnUnits); return true; }
    const ordered = living.sort((a, b) => a - b);
    let nextPlayer = ordered.find((id) => id > playerId) ?? ordered[0];
    const completedRound = nextPlayer === 0;
    if (completedRound && state.objective.type === 'survive' && state.round >= state.objective.rounds) { finishExpedition(state, 0, 'survived'); recordEndTurnAction(state, playerId, beforeTurnUnits); return true; }
    if (completedRound && state.round >= state.turnLimit) { finishExpedition(state, 1, 'turn-limit'); recordEndTurnAction(state, playerId, beforeTurnUnits); return true; }
    beginTurn(state, nextPlayer, false);
    if (fromBot && nextPlayer === 0) addLog(state, '轮到你了。');
    recordEndTurnAction(state, playerId, beforeTurnUnits);
    return true;
  }
  if (state.round >= MAX_TURNS && playerId === 1) {
    const hp0 = findGeneral(state, 0)?.health ?? 0;
    const hp1 = findGeneral(state, 1)?.health ?? 0;
    state.winner = hp0 >= hp1 ? 0 : 1;
    state.phase = 'over';
    state.result = state.winner === 0 ? 'win' : 'loss';
    recordEndTurnAction(state, playerId, beforeTurnUnits);
    return true;
  }
  const nextPlayer = 1 - playerId;
  beginTurn(state, nextPlayer, false);
  if (fromBot && nextPlayer === 0) addLog(state, '轮到你了。');
  recordEndTurnAction(state, playerId, beforeTurnUnits);
  return true;
}

function recordEndTurnAction(state, playerId, beforeUnits) {
  const current = new Map(state.units.map((unit) => [unit.unitId, unit]));
  const targetIds = [];
  const statChanges = [];
  for (const [unitId, before] of beforeUnits) {
    const unit = current.get(unitId);
    if (!unit) targetIds.push(unitId);
    else if (unit.health < before.health) { targetIds.push(unitId); statChanges.push({ unitId, kind: 'damage', amount: before.health - unit.health }); }
    else if (unit.health > before.health) { targetIds.push(unitId); statChanges.push({ unitId, kind: 'heal', amount: unit.health - before.health }); }
  }
  for (const unit of state.units) if (!beforeUnits.has(unit.unitId)) targetIds.push(unit.unitId);
  state.lastAction = { kind: 'end-turn', playerId, nextPlayerId: state.phase === 'over' ? null : state.currentPlayer, targetIds: [...new Set(targetIds)], statChanges };
}

function finishExpedition(state, winner, reason) {
  // A simultaneous effect that kills every general is still a player loss.
  // Once that loss is known, later casualties from the same effect cannot flip it.
  if (state.phase === 'over' && state.resultReason === 'general-defeated' && reason !== 'general-defeated') return true;
  state.phase = 'over';
  state.winner = winner;
  state.result = winner === 0 ? 'win' : 'loss';
  state.resultReason = reason;
  recordTrialResult(state);
  const label = state.mode === 'challenge' ? '试炼' : '远征';
  addLog(state, winner === 0 ? `${label}目标完成。` : reason === 'turn-limit' ? `超过回合限制，${label}失败。` : `我方主将倒下，${label}失败。`);
  return true;
}

function targetValue(state, unit) {
  const card = unitRuleCard(state, unit);
  if (card?.type === 'general') return 18;
  return (card?.provoke ? 14 : 0) + unit.attack * 2 + unit.health;
}

function chooseAttack(state, unit) {
  const targets = attackableEnemies(state, unit);
  if (!targets.length) return null;
  const damage = effectiveAttack(state, unit);
  return targets.sort((a, b) => {
    const score = (target) => (target.health <= damage ? 100 : 0) + targetValue(state, target);
    return score(b) - score(a);
  })[0];
}

function chooseMove(state, unit) {
  const targets = state.units.filter((other) => other.owner !== unit.owner && other.health > 0);
  const provokes = targets.filter((other) => unitRuleCard(state, other)?.provoke && isNear(unit, other));
  const behavior = [5, 6, 7].includes(state.schemaVersion) ? state.enemyPlan.players[unit.owner]?.behavior : null;
  const card = unitRuleCard(state, unit);
  const preferred = behavior === 'flank' ? targets.filter(enemy => unitRuleCard(state, enemy)?.ranged || unitRuleCard(state, enemy)?.type === 'general') : [];
  const target = (provokes.length ? provokes : preferred.length ? preferred : targets).sort((a, b) => distance(unit, a) - distance(unit, b) || targetValue(state, b) - targetValue(state, a))[0];
  if (!target) return null;
  const paths = findPath(state, unit, movementSpeed(state,unit));
  const safeScore = (pos) => {
    const danger = state.units.filter((enemy) => enemy.owner !== unit.owner && isNear(pos, enemy)).length;
    const resourceTiles = [...(state.manaTiles ?? []), ...(boardOf(state).tiles ?? []).filter((tile) => tile.type === 'outpost')];
    const orbDistance = resourceTiles.length ? Math.min(...resourceTiles.map((tile) => distance(pos, tile))) : 0;
    if ((state.attackRangeVersion === 1 || [5,6,7].includes(state.schemaVersion)) && card?.ranged) {
      const range = cardAttackRange(card), preferredRange = Number.isFinite(range) ? range : 3;
      return Math.abs(distance(pos,target) - preferredRange) * 8 + danger * 20 + orbDistance;
    }
    if (state.attackRangeVersion === 1 && card?.blast) {
      const aligned = pos.x === target.x || pos.y === target.y;
      const range = cardAttackRange(card);
      return (aligned && distance(pos,target) <= range ? 0 : 100) + distance(pos,target)*8 + danger*12 + orbDistance;
    }
    if (behavior === 'defend') { const home = findGeneral(state,unit.owner), point = resourceTiles.slice().sort((a,b) => distance(unit,a)-distance(unit,b))[0] ?? home; return distance(pos,point)*8 + danger*2; }
    if (behavior === 'support') { const allies = state.units.filter(ally => ally.owner === unit.owner && ally.unitId !== unit.unitId); const wounded = mostWounded(state,unit.owner); const escort = wounded ?? allies[0]; return (escort ? distance(pos,escort)*7 : 0) + danger*12; }
    return distance(pos, target) * 10 + danger * (unitRuleCard(state, unit)?.type === 'general' ? 2 : 4) + orbDistance * 0.6;
  };
  return paths.sort((a, b) => safeScore(a) - safeScore(b))[0] ?? null;
}

function bestSpawn(state, playerId, cardId) {
  const enemies = state.units.filter((unit) => unit.owner !== playerId);
  const general = findGeneral(state, playerId);
  const positions = summonPositions(state, playerId, cardId);
  const card = getBattleCard(state, cardId, playerId);
  return positions.sort((a, b) => {
    const score = (pos) => {
      const opponentDistance = Math.min(...enemies.map((enemy) => distance(pos, enemy)));
      const friendDistance = Math.min(...state.units.filter((unit) => unit.owner === playerId).map((ally) => distance(pos, ally)));
      const orb = (state.manaTiles ?? []).some((tile) => tile.x === pos.x && tile.y === pos.y) || terrainAt(state, pos.x, pos.y) === 'outpost' ? -3 : 0;
      return opponentDistance * 2 + friendDistance * 0.4 + orb + (card.airdrop && general && distance(pos, general) > 2 ? 3 : 0);
    };
    return score(a) - score(b);
  })[0] ?? null;
}

export function autoAct(state, playerId = state.currentPlayer) {
  if ([6,7].includes(state.schemaVersion) && state.phase === 'mulligan' && playerId === 0) { state.mulligan=[]; return confirmMulligan(state); }
  if (!['playing', 'ai'].includes(state.phase) || state.currentPlayer !== playerId || !state.players[playerId]) return false;
  const player = state.players[playerId];
  const general = findGeneral(state, playerId);
  const wounded = state.units.filter((unit) => unit.owner === playerId && unitRuleCard(state, unit)?.type === 'unit' && unit.health < unit.maxHealth + unit.healthBuff)
    .sort((a, b) => (b.maxHealth + b.healthBuff - b.health) - (a.maxHealth + a.healthBuff - a.health))[0];
  if (!player.bbsUsed && player.mana >= 1) {
    const options = battleCommandTargets(state, playerId);
    let commandTarget = null;
    if (options.type === 'ally') commandTarget = (player.generalId === 23 ? wounded?.unitId : null) ?? options.unitIds[0] ?? null;
    else if (options.type === 'enemy') commandTarget = options.unitIds.map((id) => state.units.find((unit) => unit.unitId === id)).filter(Boolean).sort((a, b) => targetValue(state, b) - targetValue(state, a))[0]?.unitId ?? null;
    else if (options.type === 'cell') commandTarget = options.cells[0] ?? null;
    if (options.available && useBattleCommand(state, commandTarget, playerId)) return true;
  }

  for (let i = player.hand.length - 1; i >= 0; i--) {
    const spell = getBattleCard(state, player.hand[i], playerId);
    if (!canUseHandCard(state, i, playerId)) continue;
    if (!spell || spell.type !== 'spell' || spell.cost > player.mana) continue;
    if(isExpansion(state)&&EXPANSION_SPELL_IDS.includes(spell.id)){if(autoExpansionSpell(state,i,spell,playerId))return true;continue;}
    if(state.schemaVersion===7&&SCHEMA7_SPELL_RULES[spell.id]) {
      if(spell.effect==='plasmaStorm'){const victims=spellTargets(state,spell,playerId);if(victims.some(unit=>unit.owner!==playerId)&&castSpell(state,i,null,playerId))return true;continue;}
      if(spell.effect==='chromaticCold'){const victim=state.units.filter(unit=>unit.owner!==playerId).sort((a,b)=>targetValue(state,b)-targetValue(state,a))[0];if(victim&&castSpell(state,i,{x:victim.x,y:victim.y},playerId))return true;continue;}
      const targets=spellTargets(state,spell,playerId).sort((a,b)=>(a.owner===playerId)-(b.owner===playerId)||targetValue(state,b)-targetValue(state,a));
      for(const target of targets){const followup=getSpellFollowup(state,spell,target.unitId,playerId);let argument=target.unitId;
        if(followup?.type==='unit'){const second=followup.unitIds.map(id=>state.units.find(unit=>unit.unitId===id)).find(unit=>unit.owner!==target.owner);if(!second)continue;argument={unitIds:[target.unitId,second.unitId]};}
        if(followup?.type==='cell'){const enemies=state.units.filter(unit=>unit.owner!==playerId);const cells=[...followup.cells].sort((a,b)=>{const score=pos=>Math.min(...enemies.map(enemy=>distance(pos,enemy)));return target.owner===playerId?score(a)-score(b):score(b)-score(a);});if(!cells.length)continue;argument={unitId:target.unitId,cell:cells[0]};}
        if(castSpell(state,i,argument,playerId))return true;
      }continue;
    }
    if (spell.effect === 'summon') {
      const cell = spellPositions(state, spell, playerId)[0];
      if (cell && castSpell(state, i, cell, playerId)) return true;
    }
    if (spell.effect === 'tempest') {
      const friends = state.units.filter((unit) => unit.owner === playerId && unit.health <= 2).length;
      const enemies = state.units.filter((unit) => unit.owner !== playerId && unit.health > 0).length;
      if (enemies > friends && castSpell(state, i, null, playerId)) return true;
    }
    if (['self', 'enemyArea'].includes(spell.target) && castSpell(state, i, null, playerId)) return true;
    const pool = spellTargets(state, spell, playerId);
    const target = pool.sort((a, b) => ['heal','earthSphere'].includes(spell.effect) ? (a.owner !== playerId)-(b.owner !== playerId) || (b.maxHealth+b.healthBuff-b.health)-(a.maxHealth+a.healthBuff-a.health) : targetValue(state, b) - targetValue(state, a))[0];
    if (target && castSpell(state, i, target.unitId, playerId)) return true;
  }

  const playable = player.hand.map((id, index) => ({ id, index, card: getBattleCard(state, id, playerId) }))
    .filter((entry) => canUseHandCard(state, entry.index, playerId) && entry.card?.type === 'unit' && entry.card.cost <= player.mana)
    .sort((a, b) => b.card.cost - a.card.cost)[0];
  if (playable) {
    const position = bestSpawn(state, playerId, playable.id);
    const opening=getOpeningFollowup(state,playable.id,position,playerId);const openingTarget=opening?.cells?.filter(cell=>{const unit=occupiedUnit(state,cell.x,cell.y);return unit&&unit.owner!==playerId;})[0]??null;
    if (position && playCard(state, playable.index, position.x, position.y, playerId,isExpansion(state)?autoOpeningChoice(state,playable.id,position,playerId):openingTarget)) return true;
  }

  for (const unit of state.units.filter((entry) => entry.owner === playerId && !entry.summonedThisTurn)) {
    const target = !unit.attacked && chooseAttack(state, unit);
    if (target && attackUnit(state, unit.unitId, target.unitId, playerId)) return true;
    const move = !unit.moved && chooseMove(state, unit);
    if (move && moveUnit(state, unit.unitId, move.x, move.y, playerId)) return true;
  }
  const ended = endTurn(state, playerId, true);
  if (ended && state.lastAction?.kind !== 'end-turn') state.lastAction = { kind: 'end-turn', playerId, nextPlayerId: state.phase === 'over' ? null : state.currentPlayer, targetIds: [], statChanges: [] };
  return ended;
}

async function botAct(state, notify, options, sessionId) {
  const isCancelled = options?.isCancelled ?? (() => false);
  const cancelled = () => isCancelled() || botSessions.get(state) !== sessionId;
  const delay = options?.delayMs ?? 380;
  if (cancelled()) return;
  if (delay > 0) await sleep(delay);
  let guard = 0;
  while (state.phase === 'ai' && state.players[state.currentPlayer]?.ai && guard++ < 100) {
    if (cancelled()) return;
    const beforeUnits = clone(state.units);
    if (!autoAct(state, state.currentPlayer)) return;
    const action = state.lastAction ? clone(state.lastAction) : { kind: 'end-turn' };
    await notify(beforeUnits, action);
    if (cancelled()) return;
    if (state.phase === 'ai' && delay > 0) await sleep(action.kind === 'attack' ? delay + 40 : delay);
  }
}

export function startBotTurn(state, onChange = () => {}, options = {}) {
  if (state.phase !== 'ai' || !state.players[state.currentPlayer]?.ai) return Promise.resolve();
  const sessionId = (botSessions.get(state) ?? 0) + 1;
  botSessions.set(state, sessionId);
  return botAct(state, onChange, options, sessionId);
}

export function listUnitCards() {
  return Object.values(CARDS).filter((card) => card.type === 'unit');
}

function expansionApi(state) {
  return {
    card:(id,owner=0)=>getBattleCard(state,id,owner),rule:u=>unitRuleCard(state,u),attack:u=>effectiveAttack(state,u),
    general:owner=>findGeneral(state,owner),free:u=>adjacentFreeCells(state,u),allFree:()=>allFreeCells(state),
    damage:(u,n,c={})=>takeDamage(state,u,n,c),heal:(u,n)=>triggerHeal(state,u,n),draw:owner=>drawCard(state,owner),
    kill:(u,owner)=>destroyUnit(state,u,owner),dispel:(x,y)=>dispelCell(state,x,y),
    summon:(id,owner,x,y,extra={})=>summonUnit(state,id,owner,x,y,extra),
    settle:u=>{if(u.health<=0)takeDamage(state,u,0,{auraRemoval:true});},
    copy:(unit,target)=>copyBattleUnit(state,unit,target),
    control:(unit,owner)=>controlBattleUnit(state,unit,owner),
    remove:unit=>{state.units=state.units.filter(other=>other!==unit);if(state.selectedUnitId===unit.unitId)state.selectedUnitId=null;},
    refresh:()=>refreshAuras(state)
  };
}
function controlBattleUnit(state,unit,owner) {
  if(!isRecruitmentExpansion(state)||!unit||unit.owner===owner||!state.units.includes(unit)||unitRuleCard(state,unit)?.type!=='unit')return false;
  unit.controlledFromOwner??=unit.owner;
  unit.owner=owner;
  const card=unitRuleCard(state,unit),ready=Boolean(card.rush)&&!unit.stunTurns;
  unit.moved=unit.attacked=unit.summonedThisTurn=!ready;
  unit.movesUsed=unit.attacksUsed=ready?0:actionQuota(state,unit,card);
  if(state.selectedUnitId===unit.unitId)state.selectedUnitId=null;
  refreshAuras(state);return true;
}
function allFreeCells(state) {
  const cells=[];for(let y=0;y<boardOf(state).rows;y++)for(let x=0;x<boardOf(state).columns;x++)if(!occupiedUnit(state,x,y)&&terrainAt(state,x,y)!=='wall')cells.push({x,y});return cells;
}
function copyBattleUnit(state,unit,target) {
  const position={x:unit.x,y:unit.y,moved:unit.moved,attacked:unit.attacked,summonedThisTurn:unit.summonedThisTurn};
  const keep={unitId:unit.unitId,owner:unit.owner};
  for(const key of Object.keys(unit))delete unit[key];
  Object.assign(unit,clone(target),keep,position,{token:true,bodyguardUsed:false,skirmishUsed:false});delete unit.specialization;delete unit.openingTarget;
}
function validOpeningChoice(state,card,cell,owner,choice) {
  const first=getOpeningFollowup(state,card.id,cell,owner);if(!first)return choice===null;
  if(choice===null)return !!first.optional;
  if(first.type==='unit') {
    const primary=choice?.unitId;if(!first.unitIds.includes(primary))return false;
    if(card.openingTeleport){const next=getOpeningFollowup(state,card.id,cell,owner,primary),pos=choice.cell;return !!pos&&next?.cells.some(c=>c.x===pos.x&&c.y===pos.y);}
    return true;
  }
  const selected=choice.cell??choice;return first.cells.some(c=>c.x===selected.x&&c.y===selected.y);
}
function autoOpeningChoice(state,id,cell,owner) {
  const first=getOpeningFollowup(state,id,cell,owner);if(!first)return null;
  if(first.type==='cell')return first.cells[0]??null;
  const card=getBattleCard(state,id,owner);const targets=first.unitIds.map(id=>state.units.find(u=>u.unitId===id));
  const target=targets.sort((a,b)=>{if(card.openingStatAttack||card.openingVespyrBuff)return (a.owner!==owner)-(b.owner!==owner)||b.health-a.health;return (a.owner===owner)-(b.owner===owner)||targetValue(state,b)-targetValue(state,a);})[0];
  if(!target)return null;const choice={unitId:target.unitId};if(card.openingTeleport){const next=getOpeningFollowup(state,id,cell,owner,target.unitId);choice.cell=next?.cells.slice().sort((a,b)=>distance(b,findGeneral(state,owner))-distance(a,findGeneral(state,owner)))[0];if(!choice.cell)return null;}return choice;
}
export function battleCommandCost(state,owner=0){return 1+(isExpansion(state)?state.players[owner]?.spellTax??0:0);}
export function spellTargets(state,spell,owner=state.currentPlayer) {
  const card=getBattleCard(state,spell?.id,owner);const area=['none','areaCell','occupiedCell','allMinions','enemyArea'].includes(card?.target)||['tempest','innerOasis','sunBloom','avalanche','twinStrike'].includes(card?.effect);return spellTargetsBase(state,spell,owner).filter(u=>!isExpansion(state)||area||u.owner===owner||!unitRuleCard(state,u)?.spellImmune);
}
export function castSpell(state,index,argument=null,owner=state.currentPlayer) {
  if(!isExpansion(state))return castSpellImpl(state,index,argument,owner);
  const previous=expansionSpellOwners.get(state);expansionSpellOwners.set(state,owner);
  try{return castSpellImpl(state,index,argument,owner);}finally{if(previous===undefined)expansionSpellOwners.delete(state);else expansionSpellOwners.set(state,previous);}
}
function castExpansionSpell(state,index,argument,owner) {
  const player=state.players[owner],spell=getBattleCard(state,player.hand[index],owner),api=expansionApi(state);
  const primaryId=typeof argument==='number'?argument:argument?.unitId??argument?.unitIds?.[0];
  const target=state.units.find(u=>u.unitId===primaryId),cell=argument?.cell??argument;
  if(['areaCell','cell'].includes(spell.target)) {if(!cell||!spellPositions(state,spell,owner).some(p=>p.x===cell.x&&p.y===cell.y))return false;}
  else if(spell.target!=='none'&&(!target||!spellTargets(state,spell,owner).some(u=>u===target)))return false;
  let second=null;
  if(spell.followup==='killEnemy'){const id=argument?.unitIds?.[1]??argument?.secondUnitId;second=state.units.find(u=>u.unitId===id);if(!second||!getSpellFollowup(state,spell,primaryId,owner)?.unitIds.includes(id))return false;}
  const enemyMinions=()=>state.units.filter(u=>u.owner!==owner&&unitRuleCard(state,u)?.type==='unit');
  if(spell.effect==='twinStrike'&&enemyMinions().length<2)return false;
  if(spell.effect==='spiritWild'&&!state.units.some(u=>u.owner===owner&&unitRuleCard(state,u)?.type==='unit'&&enemyHalf(state,u)))return false;
  if(spell.effect==='eggMorph'&&target.cardId===411&&!target.hatchCardId)return false;
  player.mana-=spell.cost;removeHandCard(state,player,index);
  const ids=[],damage=(u,n)=>{if(u){ids.push(u.unitId);takeDamage(state,u,n,{sourceOwner:owner});}};
  if(['cosmicFlesh','secondWish','thirdWish','diretideFrenzy','amplification','killingEdge'].includes(spell.effect)) {
    buff(target,spell.attackBuff,spell.healthBuff);if(spell.grantProvoke)target.provokeBuff=true;if(spell.grantGeneralImmune)target.generalImmuneBuff=true;if(spell.grantFlying)target.flyingBuff=true;if(spell.grantFrenzy)target.frenzyBuff=true;
    if(spell.effect==='killingEdge'&&unitRuleCard(state,target)?.backstab)player.drawBonus=(player.drawBonus??0)+1;ids.push(primaryId);
  }
  if(spell.effect==='martyrdom'){const heal=target.health,who=target.owner;destroyUnit(state,target,owner);triggerHeal(state,findGeneral(state,who),heal);ids.push(primaryId);}
  if(spell.effect==='sunBloom'||spell.effect==='shadowNova')for(let y=cell.y;y<=cell.y+1;y++)for(let x=cell.x;x<=cell.x+1;x++){if(!withinBoard(x,y,boardOf(state)))continue;if(spell.effect==='sunBloom')dispelCell(state,x,y);else if(terrainAt(state,x,y)!=='wall')(state.creepCells??={})[`${x},${y}`]=owner;}
  if(spell.effect==='holyImmolation'){triggerHeal(state,target,spell.heal);for(const victim of [...state.units].filter(u=>u.owner!==owner&&isNear(target,u)))damage(victim,spell.amount);ids.push(primaryId);}
  if(spell.effect==='onyxBearSeal'){transformUnit(state,target,113);ids.push(primaryId);}
  if(spell.effect==='twinStrike'){const pool=enemyMinions();for(let i=0;i<2;i++){const [victim]=pool.splice(randomIndex(state,pool.length),1);damage(victim,spell.amount);}player.drawBonus=(player.drawBonus??0)+1;}
  if(spell.effect==='heavensEclipse')drawMatching(state,owner,c=>c.type==='spell',api,spell.count);
  if(spell.effect==='innerOasis'){for(const unit of state.units.filter(u=>u.owner===owner&&unitRuleCard(state,u)?.type==='unit')){buff(unit,0,spell.healthBuff);ids.push(unit.unitId);}drawCard(state,owner);}
  if(spell.effect==='deathfireCrescendo'){target.deathWatchBuff=(target.deathWatchBuff??0)+spell.deathWatchBuff;ids.push(primaryId);}
  if(spell.effect==='ritualBanishing'){destroyUnit(state,target,owner);if(state.units.includes(second))destroyUnit(state,second,owner);ids.push(primaryId,second.unitId);}
  if(spell.effect==='riteUndervault'){const n=state.deckRules[owner].handLimit-player.hand.length;for(let i=0;i<n&&state.phase!=='over';i++)drawCard(state,owner);}
  if(spell.effect==='danceDreams')player.deathDraw=true;
  if(spell.effect==='eggMorph') {
    const body=target.cardId===411?target.hatchCardId:target.cardId;
    if(target.cardId===411){transformUnit(state,target,body);target.moved=false;target.attacked=false;target.summonedThisTurn=false;target.reborn=true;}
    else {transformUnit(state,target,411);target.hatchCardId=body;target.moved=true;target.attacked=true;target.summonedThisTurn=true;}
    ids.push(primaryId);
  }
  if(spell.effect==='gravityWell')for(const pos of [cell,...adjacentFreeCells(state,cell)].slice(0,spell.count)){const made=summonUnit(state,spell.summon,owner,pos.x,pos.y,{token:true});if(made)ids.push(made.unitId);}
  if(spell.effect==='avalanche')for(const unit of [...state.units].filter(u=>owner===0?u.x<(boardOf(state).columns-1)/2:u.x>(boardOf(state).columns-1)/2)){damage(unit,spell.amount);if(state.units.includes(unit)){unit.stunTurns=1;unit.moved=true;unit.attacked=true;}}
  if(spell.effect==='cryogenesis'){damage(target,spell.amount);drawMatching(state,owner,c=>c.type==='unit'&&c.race==='vespyr',api);}
  if(spell.effect==='spiritWild')for(const unit of state.units.filter(u=>u.owner===owner&&unitRuleCard(state,u)?.type==='unit'&&enemyHalf(state,u))){if(!unit.stunTurns){unit.movesUsed=0;unit.attacksUsed=0;unit.moved=false;unit.attacked=false;unit.summonedThisTurn=false;}ids.push(unit.unitId);}
  refreshAuras(state);const changes=state.phase==='over'?[]:onSpellCast(state,owner,spell);
  addLog(state,`${player.name}施放${spell.name}。`);state.lastAction={kind:'spell',effect:spell.effect,cardId:spell.id,targetId:primaryId??null,targetIds:ids,cell:['cell','areaCell'].includes(spell.target)?cell:null,statChanges:changes};return true;
}
function autoExpansionSpell(state,index,spell,owner) {
  if(spell.target==='none')return castSpell(state,index,null,owner);
  if(['cell','areaCell'].includes(spell.target)){const enemy=state.units.find(u=>u.owner!==owner);const positions=spellPositions(state,spell,owner);const cell=positions.sort((a,b)=>distance(a,enemy??findGeneral(state,owner))-distance(b,enemy??findGeneral(state,owner)))[0];return cell?castSpell(state,index,cell,owner):false;}
  const targets=spellTargets(state,spell,owner).sort((a,b)=>targetValue(state,b)-targetValue(state,a));
  for(const target of targets){if(spell.followup==='killEnemy'){const second=getSpellFollowup(state,spell,target.unitId,owner)?.unitIds[0];if(second&&castSpell(state,index,{unitIds:[target.unitId,second]},owner))return true;}else if(castSpell(state,index,target.unitId,owner))return true;}return false;
}
