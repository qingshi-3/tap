import { CARD_ACQUISITION } from './campaign-content.js';
import { getCard } from './cards.js';

// These IDs and effects are the version-1 battle contract. Balance changes need
// a new rule version: unfinished battles must retain the rules they started with.
const relic = (id, name, description, tags, event, limit) => Object.freeze({
  id, name, description, tags: Object.freeze(tags), event, limit,
});
export const RELICS = Object.freeze([
  relic('scout-lantern', '探路灯', '首个己方回合开始时额外抽1张牌。', ['draw'], 'turnStart', 1),
  relic('ember-pouch', '余烬袋', '前三个己方回合开始时额外获得1点法力，至多9点。', ['mana'], 'turnStart', 3),
  relic('hearth-stone', '暖炉石', '每个己方回合开始时治疗主将2点，每战至多3次有效治疗。', ['heal'], 'turnStart', 3),
  relic('bone-banner', '骨旗', '前两个己方回合开始时，在主将附近空格召唤一个幽灵。', ['summon', 'death'], 'turnStart', 2),
  relic('field-kit', '行军药箱', '从手牌召唤非衍生随从后治疗主将2点；每回合至多1次，每战至多3次有效治疗。', ['summon', 'heal'], 'summon', 3),
  relic('iron-seed', '铁种', '每回合首次从手牌召唤非衍生随从时，使其生命+2；每战至多3次。', ['summon'], 'summon', 3),
  relic('war-drum', '战鼓', '每回合首次从手牌召唤非衍生随从时，使其攻击+1；每战至多3次。', ['summon'], 'summon', 3),
  relic('wing-boots', '羽靴', '每回合首次从手牌召唤非衍生随从时，使其获得飞行；每战至多2次。', ['summon', 'position'], 'summon', 2),
  relic('oath-shield', '誓盾', '每回合首次从手牌召唤非衍生随从时，使其获得嘲讽；每战至多2次。', ['summon', 'guard'], 'summon', 2),
  relic('sun-chalice', '日耀杯', '实际治疗己方角色后恢复1点法力，不超过有效上限；每回合至多1次，每战至多3次。', ['heal', 'mana'], 'heal', 3),
  relic('sun-script', '圣露书页', '实际治疗己方角色后抽1张牌；每回合至多1次，每战至多2次。', ['heal', 'draw'], 'heal', 2),
  relic('sun-hammer', '晨光锤', '每回合首次实际治疗己方角色后，使被治疗者攻击+1；每战至多3次。', ['heal'], 'heal', 3),
  relic('rune-nest', '符文巢', '成功施法后在主将附近空格召唤一个幽灵；每回合至多1次，每战至多3次。', ['spell', 'summon'], 'spell', 3),
  relic('echo-crystal', '回响晶', '成功施法后恢复1点法力，不超过有效上限；每回合至多1次，每战至多3次。', ['spell', 'mana'], 'spell', 3),
  relic('storm-bell', '风暴铃', '成功施法后对生命最低的敌方随从造成1点伤害；每回合至多1次，每战至多3次。', ['spell', 'damage'], 'spell', 3),
  relic('mourning-quill', '挽歌羽笔', '每回合首个己方非衍生随从阵亡后抽1张牌；每战至多3次。', ['death', 'draw'], 'death', 3),
  relic('soul-bowl', '归魂碗', '己方非衍生随从阵亡后治疗主将2点；每回合至多1次，每战至多3次有效治疗。', ['death', 'heal'], 'death', 3),
  relic('grave-candle', '墓烛', '己方非衍生随从阵亡后，在其原格或主将附近空格召唤一个幽灵；每回合至多1次，每战至多3次。', ['death', 'summon'], 'death', 3),
]);
const RELIC_BY_ID = new Map(RELICS.map(value => [value.id, value]));
const COLLECTIBLE_IDS = new Set(CARD_ACQUISITION.map(card => card.id));
const own = (value, key) => Object.hasOwn(value, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => own(value, key));
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const collectible = id => Number.isSafeInteger(id) && COLLECTIBLE_IDS.has(id)
  && ['unit', 'spell'].includes(getCard(id)?.type) && !getCard(id).token;

export function validateRoguelikeDeck(deck) {
  if (!Array.isArray(deck) || deck.length < 12 || deck.length > 45) return false;
  const counts = new Map();
  return deck.every(id => {
    counts.set(id, (counts.get(id) ?? 0) + 1);
    return collectible(id) && counts.get(id) <= 6;
  });
}

export function validateRoguelikeUpgrades(upgrades) {
  return object(upgrades) && Object.keys(upgrades).length <= COLLECTIBLE_IDS.size
    && Object.entries(upgrades).every(([id, rank]) => String(Number(id)) === id
      && collectible(Number(id)) && integer(rank, 1, 2));
}

function validOptions(value) {
  return exact(value, ['version', 'runId', 'stage', 'difficulty', 'relics', 'upgrades'])
    && value.version === 1 && typeof value.runId === 'string' && value.runId.length > 0 && value.runId.length <= 200
    && integer(value.stage, 1, 6) && integer(value.difficulty, 1, 5)
    && Array.isArray(value.relics) && value.relics.length <= RELICS.length
    && new Set(value.relics).size === value.relics.length && value.relics.every(id => RELIC_BY_ID.has(id))
    && validateRoguelikeUpgrades(value.upgrades);
}

export function createRoguelikeMarker(options) {
  if (!validOptions(options)) throw new Error('秘境战斗规则无效。');
  return {
    ...structuredClone(options),
    ledger: Object.fromEntries(options.relics.map(id => [id, { used: 0, turn: -1 }])),
    upgradeBases: {},
  };
}

export function validateRoguelikeState(state) {
  const marker = state?.roguelike;
  if (!exact(marker, ['version', 'runId', 'stage', 'difficulty', 'relics', 'upgrades', 'ledger', 'upgradeBases'])) return false;
  const { ledger, upgradeBases, ...options } = marker;
  if (!validOptions(options) || state.schemaVersion !== 7 || state.mode !== 'expedition'
    || !validateRoguelikeDeck(state.loadout?.deck) || !integer(state.turnSerial, 0, Number.MAX_SAFE_INTEGER)
    || !exact(ledger, marker.relics) || !exact(upgradeBases, Object.keys(marker.upgrades))) return false;
  if (!Object.entries(upgradeBases).every(([id, base]) => getCard(Number(id))?.type === 'spell'
    ? exact(base, ['cost']) && integer(base.cost, 0, 30)
    : exact(base, ['attack', 'health']) && integer(base.attack, 0, 100 - marker.upgrades[id])
      && integer(base.health, 1, 100 - marker.upgrades[id] * 2))) return false;
  // Roguelike power comes only from this run. Never import collection training.
  if (!object(state.training) || Object.values(state.training).some(rank => rank !== 0)
    || !object(state.loadout.spellTraining) || Object.values(state.loadout.spellTraining).some(rank => rank !== 0)
    || !object(state.loadout.spellModes) || Object.values(state.loadout.spellModes).some(mode => mode !== 'base')
    || !object(state.loadout.specializations) || Object.values(state.loadout.specializations).some(spec => spec !== 'none')
    || !object(state.loadout.growthVersion) || Object.values(state.loadout.growthVersion).some(version => version !== 'low-v2')) return false;
  return marker.relics.every(id => {
    const counter = ledger[id];
    return exact(counter, ['used', 'turn']) && integer(counter.used, 0, RELIC_BY_ID.get(id).limit)
      && integer(counter.turn, -1, state.turnSerial)
      && (counter.used === 0 ? counter.turn === -1 : counter.turn >= counter.used);
  });
}

// Applied once while creating the frozen table, never while restoring it. The
// table is also what previews and mana payment read, so no UI-only discounts.
export function applyRoguelikeUpgrades(state) {
  if (Object.keys(state.roguelike.upgradeBases).length) throw new Error('秘境强化已应用，不能重复强化冻结卡表。');
  for (const [id, rank] of Object.entries(state.roguelike.upgrades)) {
    const card = state.battleCards?.[0]?.[id];
    if (!card) throw new Error('秘境强化卡牌不在战斗快照内。');
    if (card.type === 'unit') {
      state.roguelike.upgradeBases[id] = { attack: card.attack, health: card.health };
      card.attack += rank; card.health += rank * 2;
    } else if (card.type === 'spell') {
      state.roguelike.upgradeBases[id] = { cost: card.cost };
      card.cost = Math.max(0, card.cost - rank);
    }
    else throw new Error('秘境只能强化随从或法术。');
  }
}

// Saved bases belong to this battle, not today's mutable content catalog.
// Existing engine validation still checks every frozen card's identity/rules.
export function validateRoguelikeCardTable(state) {
  if (!validateRoguelikeState(state)) return false;
  return Object.entries(state.roguelike.upgrades).every(([id, rank]) => {
    const base = state.roguelike.upgradeBases[id], card = state.battleCards?.[0]?.[id];
    return card?.type === 'spell' ? card.cost === Math.max(0, base.cost - rank)
      : card?.type === 'unit' && card.attack === base.attack + rank && card.health === base.health + rank * 2;
  });
}

// Guards are transient and keyed by the actual snapshot object. Preview clones
// cannot consume a real match's ledger, and no random/global counter is used.
const dispatching = new WeakMap();
const living = (state, unit) => !!unit && unit.health > 0 && state.units.includes(unit);
const wounded = unit => unit && unit.health < unit.maxHealth + unit.healthBuff;
const byId = (a, b) => a.unitId - b.unitId;
const manaCapacity = state => Math.min(9, state.players[0].maxMana + Object.values(state.outposts ?? {}).filter(owner => owner === 0).length);
const addMana = state => { const player = state.players[0]; player.mana = Math.min(manaCapacity(state), player.mana + 1); };

function spawnCell(state, api, preferred = null) {
  const free = api.allFree();
  if (preferred && free.some(cell => cell.x === preferred.x && cell.y === preferred.y)) return preferred;
  const general = api.general(0);
  return general ? api.free(general)[0] ?? null : null;
}

function effectFor(id, state, event, data, api) {
  const general = api.general(0), player = state.players[0];
  if (!living(state, general)) return null;
  const summon = preferred => {
    const cell = spawnCell(state, api, preferred);
    return cell ? () => api.summon(315, 0, cell.x, cell.y, { token: true }) : null;
  };
  const healGeneral = () => wounded(general) ? () => api.heal(general, 2) : null;
  const mana = () => player.mana < manaCapacity(state) ? () => addMana(state) : null;
  switch (id) {
    case 'scout-lantern': return player.turnsStarted === 1 ? () => api.draw(0) : null;
    case 'ember-pouch': return player.turnsStarted <= 3 && player.mana < 9
      ? () => { player.mana = Math.min(9, player.mana + 1); } : null;
    case 'hearth-stone': case 'field-kit': case 'soul-bowl': return healGeneral();
    case 'bone-banner': return player.turnsStarted <= 2 ? summon() : null;
    case 'iron-seed': return () => { data.unit.healthBuff += 2; data.unit.health += 2; };
    case 'war-drum': return () => { data.unit.attackBuff += 1; };
    case 'wing-boots': return () => { data.unit.flyingBuff = true; };
    case 'oath-shield': return () => { data.unit.provokeBuff = true; };
    case 'sun-chalice': case 'echo-crystal': return mana();
    case 'sun-script': case 'mourning-quill': return () => api.draw(0);
    case 'sun-hammer': return living(state, data.target) ? () => { data.target.attackBuff += 1; } : null;
    case 'rune-nest': return summon();
    case 'grave-candle': return summon(data.unit);
    case 'storm-bell': {
      const target = state.units.filter(unit => unit.owner !== 0 && living(state, unit)
        && api.card(unit.cardId, unit.owner)?.type === 'unit').sort((a, b) => a.health - b.health || byId(a, b))[0];
      return target ? () => api.damage(target, 1, { sourceOwner: 0, roguelike: true }) : null;
    }
    default: return null;
  }
}

export function roguelikeEvent(state, event, data, api) {
  if (!state?.roguelike || !['playing', 'ai'].includes(state.phase)) return;
  if (event === 'turnStart' && data.owner !== 0) return;
  if (event === 'summon' && (!data.fromHand || data.unit?.owner !== 0 || data.unit.token
    || !living(state, data.unit) || api.card(data.unit.cardId, 0)?.type !== 'unit')) return;
  if (event === 'spell' && data.owner !== 0) return;
  if (event === 'heal' && (!(data.amount > 0) || data.target?.owner !== 0 || !living(state, data.target))) return;
  if (event === 'death' && (data.unit?.owner !== 0 || data.unit.token || data.card?.type !== 'unit')) return;
  const active = dispatching.get(state) ?? new Set();
  if (active.has(event)) return;
  active.add(event); dispatching.set(state, active);
  try {
    for (const id of state.roguelike.relics) {
      if (!['playing', 'ai'].includes(state.phase)) break;
      const definition = RELIC_BY_ID.get(id), counter = state.roguelike.ledger[id];
      if (!definition || definition.event !== event || counter.used >= definition.limit || counter.turn === state.turnSerial) continue;
      const effect = effectFor(id, state, event, data, api);
      if (!effect) continue;
      // Spend before callbacks. A draw may cause fatal fatigue, or a summon may
      // invoke other effects, which must see this entitlement as consumed.
      counter.used++; counter.turn = state.turnSerial;
      effect();
      api.refresh();
    }
  } finally {
    active.delete(event);
    if (!active.size) dispatching.delete(state);
  }
}
