import { CARD_ACQUISITION } from './campaign-content.js';
import { getCard } from './cards.js';
import { getHero } from './factions.js';
import { EXPEDITION_LEVELS } from './expedition-data.js';
import { getEnemyPlan, validateEnemyPlan } from './enemy-plans.js';
import { encounterDefinition } from './encounter-content.js';

const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const kit = (id, name, description, tags, cards) => ({ id, name, description, tags, deck: cards.flatMap(cardId => [cardId, cardId, cardId]) });
const hero = (id, kits) => { const source = getHero(id); return { id, name: source.name, portrait: source.portrait, faction: source.faction, kits }; };
export const ROGUELIKE_HEROES = freeze([
  hero(23, [kit('qiran-heal', '圣露', '治疗与守卫', ['heal', 'guard'], [14, 15, 10981, 20043, 11]), kit('qiran-sun', '晨光', '治疗与邻近强化', ['heal', 'summon'], [9, 16, 10981, 20064, 20068])]),
  hero(123, [kit('reva-spell', '心猎', '远程与低费法术', ['spell', 'draw'], [108, 115, 109, 20081, 20168]), kit('reva-wind', '疾风', '背刺与连续施法', ['spell', 'position'], [110, 115, 116, 20086, 20129])]),
  hero(301, [kit('lilithe-swarm', '暗灵', '召唤与阵亡成长', ['death', 'summon'], [308, 317, 311, 20052, 20072]), kit('lilithe-dusk', '挽歌', '阵亡与群体强化', ['death', 'heal'], [313, 310, 19050, 20049, 20133])]),
]);
export const ROGUELIKE_DIFFICULTIES = freeze(Array.from({ length: 5 }, (_, index) => ({ id: index + 1, name: `难度${index + 1}`, healthBonus: index * 3, unitHealth: Math.floor((index + 1) / 2), unitAttack: Math.floor(index / 3) })));
export const CAMP_COSTS = freeze({ remove: 35, upgrade: 45 });

// Templates stay in the campaign's authored catalog. Only a cloned enemy plan
// is scaled: board topology, objectives and encounter machinery are retained.
const encounter = (levelId, minStage) => {
  const level = EXPEDITION_LEVELS.slice(0, 30).find(value => value.id === levelId);
  if (!level) throw new Error(`秘境缺少原始地图：${levelId}`);
  return { id: levelId, levelId, title: level.title, hint: encounterDefinition(levelId)?.text ?? level.hint, minStage };
};
export const ENCOUNTERS = freeze([
  encounter('border-01', 1), encounter('border-02', 1), encounter('border-03', 2),
  encounter('road-01', 2), encounter('road-02', 2), encounter('banners-01', 4),
  encounter('sand-01', 2), encounter('sand-02', 4), encounter('shadow-01', 4),
  encounter('frost-01', 4), encounter('crossroads-01', 4), encounter('citadel-01', 4),
]);
export const BOSSES = freeze([encounter('road-03', 3), encounter('frost-03', 3), encounter('citadel-03', 6), encounter('confluence-03', 6)]);
const collectibleIds = new Set(CARD_ACQUISITION.filter(value => ['unit', 'spell'].includes(value.type) && !getCard(value.id)?.token).map(value => value.id));
export const REWARD_THEMES = freeze([
  { id: 'heal', title: '圣露', cards: [10981, 15, 16, 20043, 20064, 20068, 20117, 20153] },
  { id: 'spell', title: '符文', cards: [108, 115, 116, 20081, 20168, 20129, 20086, 20066] },
  { id: 'death', title: '挽歌', cards: [317, 311, 310, 313, 20072, 20052, 20133, 19050] },
  { id: 'guard', title: '坚守', cards: [11, 17, 19027, 19026, 10204, 10, 512, 20095] },
  { id: 'tempo', title: '先锋', cards: [14, 9, 110, 10019, 10001, 10018, 406, 505, 20116] },
  { id: 'power', title: '破阵', cards: [8, 10978, 19034, 513, 120, 318, 20090, 20077, 20122] },
].map(theme => ({ ...theme, cards: theme.cards.filter(id => collectibleIds.has(id)) })));

export function getRoguelikeHero(id) { return ROGUELIKE_HEROES.find(value => value.id === id) ?? null; }
export function getRoguelikeKit(heroId, kitId) { return getRoguelikeHero(heroId)?.kits.find(value => value.id === kitId) ?? null; }

/** Independent six-stage strength curve, with no permanent player training. */
export function createRoguelikeRoute(encounterId, { stage, difficulty, kind, battleSeed, heroId }) {
  const source = [...ENCOUNTERS, ...BOSSES].find(value => value.id === encounterId);
  const selectedHero = getRoguelikeHero(heroId), diff = ROGUELIKE_DIFFICULTIES.find(value => value.id === difficulty);
  if (!source || !selectedHero || !diff || !Number.isInteger(stage) || stage < 1 || stage > 6 || !['safe', 'elite', 'boss'].includes(kind)) throw new Error('秘境路线无效。');
  const template = structuredClone(EXPEDITION_LEVELS.find(value => value.id === source.levelId));
  const enemyPlan = getEnemyPlan(source.levelId, 3, selectedHero.faction);
  const boss = kind === 'boss', elite = kind === 'elite', later = stage >= 4;
  const owners = Object.values(enemyPlan.players).length;
  const targetHealth = (boss ? (stage === 3 ? 28 : 40) : 12 + stage * 3) + diff.healthBonus + (elite ? 5 : 0);
  for (const plan of Object.values(enemyPlan.players)) {
    plan.generalHealth = Math.max(10, Math.round(targetHealth / (owners === 2 ? 1.5 : 1)));
    plan.generalAttack = Math.min(4, (stage <= 2 ? 1 : 2) + (difficulty >= 4 ? 1 : 0));
    plan.mana = plan.maxMana = Math.min(6, 1 + Math.ceil(stage / 2) + (elite ? 1 : 0) + (difficulty >= 4 ? 1 : 0));
    plan.manaCap = Math.min(9, 5 + stage);
    plan.manaGrowth = 1; plan.drawPerTurn = 1; plan.fatigueDamage = 1; plan.shuffleDeck = false;
    plan.spellRank = 0; plan.spellMode = 'base'; plan.attackBonus = 0; plan.healthBonus = 0;
    // Preserve the ordered deck but move playable early bodies forward. Cost
    // reductions in late campaign stat rows must not leak into a new run.
    plan.deck = plan.deck.map((id, index) => ({ id, index })).sort((a, b) => (getCard(a.id).cost <= plan.mana ? 0 : 1) - (getCard(b.id).cost <= plan.mana ? 0 : 1) || a.index - b.index).map(value => value.id);
    plan.openingHandSize = Math.min(3 + (later ? 1 : 0), plan.deck.length, plan.handLimit);
    const bodies = plan.garrison.filter(value => value.id !== plan.generalId);
    const maxBodies = Math.min(bodies.length, (stage <= 2 ? 1 : 2) + (elite || stage === 6 ? 1 : 0));
    plan.garrison = plan.garrison.filter(value => value.id === plan.generalId || bodies.indexOf(value) < maxBodies);
    const required = new Set([...plan.deck, ...plan.garrison.map(value => value.id)].filter(id => getCard(id)?.type === 'unit' && !getCard(id).token));
    plan.unitStats = Object.fromEntries([...required].map(id => {
      const base = getCard(id);
      return [id, { cost: base.cost, attack: Math.max(1, Math.min(base.attack, stage <= 2 ? 3 : 6) + diff.unitAttack + (elite && later ? 1 : 0)), health: Math.max(1, Math.min(base.health, stage <= 2 ? 5 : 10) + diff.unitHealth + (later ? 1 : 0) + (elite ? 1 : 0)) }];
    }));
    for (const unit of plan.garrison) {
      if (unit.id === plan.generalId) { unit.attack = plan.generalAttack; unit.health = plan.generalHealth; }
      else if (plan.unitStats[unit.id]) Object.assign(unit, { attack: plan.unitStats[unit.id].attack, health: plan.unitStats[unit.id].health });
    }
  }
  if (!validateEnemyPlan(enemyPlan, source.levelId)) throw new Error('秘境敌军配置无效。');
  return { id: `${stage}-${kind}-${source.id}`, encounterId: source.id, levelId: source.levelId, title: source.title, hint: source.hint, kind,
    gold: (boss ? 90 : elite ? 70 : 45) + stage * 5, relic: elite || stage === 3,
    battleSeed, enemyPlan, template, mechanics: structuredClone(encounterDefinition(source.levelId) ?? null) };
}
