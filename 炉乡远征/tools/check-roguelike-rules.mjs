import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createExpeditionMatch, validateMatch, confirmMulligan, restoreMatch, getBattleCard, summonPositions, playCard, castSpell, findGeneral, attackPositions, attackUnit, simulateAttackUnit, effectiveAttack } from '../dist/js/engine.js';
import { CAMPAIGN_UNIT_IDS } from '../dist/js/campaign-rules.js';
import { CARDS } from '../dist/js/cards.js';
import { EXPEDITION_LEVELS } from '../dist/js/expedition-data.js';
import { encounterDefinition } from '../dist/js/encounter-content.js';
import { getEnemyPlan } from '../dist/js/enemy-plans.js';
import { makeStarterDeck } from '../dist/js/battle-deck.js';
import {
  RELICS, validateRoguelikeDeck, validateRoguelikeUpgrades, createRoguelikeMarker,
  validateRoguelikeState, applyRoguelikeUpgrades, validateRoguelikeCardTable, roguelikeEvent,
} from '../dist/js/roguelike-rules.js';

const results = [];
const deck = [9, 108, 20043].flatMap(id => Array(5).fill(id));
const options = relics => ({ version: 1, runId: 'rules-fixture', stage: 1, difficulty: 1, relics, upgrades: {} });
const body = (unitId, cardId, owner, x, y) => ({ unitId, cardId, owner, x, y, health: 3, maxHealth: 6, healthBuff: 0, attackBuff: 0, token: false });
function fixture(relics) {
  const state = {
    schemaVersion: 7, mode: 'expedition', phase: 'playing', turnSerial: 1,
    roguelike: createRoguelikeMarker(options(relics)), training: { 9: 0 },
    loadout: { deck: [...deck], spellTraining: {}, spellModes: {}, specializations: {}, growthVersion: { 9: 'low-v2' } },
    players: [{ id: 0, turnsStarted: 1, mana: 1, maxMana: 3 }, { id: 1, turnsStarted: 0 }],
    units: [body(1, 23, 0, 0, 1), body(2, 9, 0, 1, 1), body(3, 108, 1, 4, 1)],
    drawn: 0, summoned: 0, refreshed: 0,
  };
  const api = {
    card: id => ({ id, type: [23, 1].includes(id) ? 'general' : 'unit' }),
    general: owner => state.units.find(unit => unit.owner === owner && unit.cardId === 23),
    allFree: () => [{ x: 0, y: 0 }, { x: 1, y: 0 }].filter(cell => !state.units.some(unit => unit.x === cell.x && unit.y === cell.y)),
    free: () => api.allFree(),
    draw: () => { state.drawn++; },
    heal: (unit, amount) => {
      const before = unit.health;
      unit.health = Math.min(unit.maxHealth + unit.healthBuff, unit.health + amount);
      roguelikeEvent(state, 'heal', { target: unit, amount: unit.health - before }, api);
      return unit.health - before;
    },
    damage: (unit, amount) => { unit.health -= amount; if (unit.health <= 0) state.units = state.units.filter(value => value !== unit); },
    summon: (id, owner, x, y, extra) => {
      const unit = { ...body(20 + state.summoned++, id, owner, x, y), ...extra };
      state.units.push(unit);
      roguelikeEvent(state, 'summon', { unit, fromHand: false }, api);
      return unit;
    },
    refresh: () => { state.refreshed++; },
  };
  return { state, api };
}
function test(name, fn) { fn(); results.push(name); }

test('deck: cross faction, 12–45 cards, six copies, reject tokens/unknown/noninteger', () => {
  assert.equal(validateRoguelikeDeck(deck), true);
  assert.equal(validateRoguelikeDeck(deck.slice(0, 11)), false);
  assert.equal(validateRoguelikeDeck(Array(12).fill(9)), false);
  assert.equal(validateRoguelikeDeck([...deck.slice(1), 315]), false);
  assert.equal(validateRoguelikeDeck([...deck.slice(1), 999999]), false);
  assert.equal(validateRoguelikeDeck([...deck.slice(1), '9']), false);
  assert.equal(validateRoguelikeDeck(Array(46).fill(9)), false);
});
test('upgrade validation and exact fixed amount, zero cost floor, no base mutation', () => {
  assert(validateRoguelikeUpgrades({ 9: 2, 20043: 1 }));
  for (const bad of [{ 9: 0 }, { 9: 3 }, { '09': 1 }, { 315: 1 }, { 1: 1 }, []]) assert(!validateRoguelikeUpgrades(bad));
  const { state } = fixture([]);
  state.roguelike.upgrades = { 9: 2, 20043: 2 };
  const pristine = { 9: { id: 9, type: 'unit', attack: 2, health: 3, cost: 2 }, 20043: { id: 20043, type: 'spell', cost: 1 } };
  state.battleCards = { 0: structuredClone(pristine) };
  applyRoguelikeUpgrades(state);
  assert.equal(state.battleCards[0][9].attack, 4);
  assert.equal(state.battleCards[0][9].health, 7);
  assert.equal(state.battleCards[0][20043].cost, 0);
  assert.equal(pristine[9].attack, 2);
  assert(validateRoguelikeCardTable(state, pristine));
  state.battleCards[0][9].attack++;
  assert(!validateRoguelikeCardTable(state, pristine));
});
test('marker: rejects unknown version, duplicate relics, foreign growth, malformed/forged ledger', () => {
  assert.throws(() => createRoguelikeMarker({ ...options([]), version: 2 }));
  assert.throws(() => createRoguelikeMarker(options(['iron-seed', 'iron-seed'])));
  const { state } = fixture(['iron-seed']);
  assert(validateRoguelikeState(state));
  for (const mutate of [
    value => { value.roguelike.ledger['iron-seed'].used = 99; },
    value => { value.roguelike.ledger['iron-seed'].turn = 2; },
    value => { value.roguelike.version = 9; },
    value => { value.training[9] = 1; },
    value => { value.loadout.spellModes[20043] = 'power'; },
    value => { value.loadout.growthVersion[9] = 'legacy-v1'; },
    value => { value.mode = 'challenge'; },
    value => { value.roguelike.ledger.extra = { used: 0, turn: -1 }; },
  ]) { const changed = structuredClone(state); mutate(changed); assert(!validateRoguelikeState(changed)); }
});

const assertions = {
  'scout-lantern': state => assert.equal(state.drawn, 1),
  'ember-pouch': state => assert.equal(state.players[0].mana, 2),
  'hearth-stone': state => assert.equal(state.units[0].health, 5),
  'bone-banner': state => assert.equal(state.summoned, 1),
  'field-kit': state => assert.equal(state.units[0].health, 5),
  'iron-seed': state => assert.equal(state.units[1].healthBuff, 2),
  'war-drum': state => assert.equal(state.units[1].attackBuff, 1),
  'wing-boots': state => assert.equal(state.units[1].flyingBuff, true),
  'oath-shield': state => assert.equal(state.units[1].provokeBuff, true),
  'sun-chalice': state => assert.equal(state.players[0].mana, 2),
  'sun-script': state => assert.equal(state.drawn, 1),
  'sun-hammer': state => assert.equal(state.units[1].attackBuff, 1),
  'rune-nest': state => assert.equal(state.summoned, 1),
  'echo-crystal': state => assert.equal(state.players[0].mana, 2),
  'storm-bell': state => assert.equal(state.units[2].health, 2),
  'mourning-quill': state => assert.equal(state.drawn, 1),
  'soul-bowl': state => assert.equal(state.units[0].health, 5),
  'grave-candle': state => assert.equal(state.summoned, 1),
};
for (const relic of RELICS) test(`relic ${relic.id}: effect, once per turn, snapshot resume, total cap`, () => {
  const { state, api } = fixture([relic.id]);
  const data = { owner: 0, unit: state.units[1], target: state.units[1], card: { type: 'unit' }, fromHand: true, amount: 1 };
  roguelikeEvent(state, relic.event, data, api);
  assertions[relic.id](state);
  const frozen = JSON.stringify(state);
  roguelikeEvent(state, relic.event, data, api);
  assert.equal(JSON.stringify(state), frozen, 'second event must not spend twice');
  const restored = JSON.parse(frozen);
  assert(validateRoguelikeState(restored));
  // Exercise the saved counter through fresh-turn adapters up to its real cap.
  let ledger = restored.roguelike.ledger;
  for (let turn = 2; turn <= relic.limit; turn++) {
    const next = fixture([relic.id]);
    next.state.roguelike.ledger = structuredClone(ledger);
    next.state.turnSerial = turn * 2 - 1; next.state.players[0].turnsStarted = turn;
    roguelikeEvent(next.state, relic.event, { ...data, unit: next.state.units[1], target: next.state.units[1] }, next.api);
    assert.equal(next.state.roguelike.ledger[relic.id].used, turn);
    assert(validateRoguelikeState(next.state));
    ledger = JSON.parse(JSON.stringify(next.state.roguelike.ledger));
  }
  const capped = fixture([relic.id]);
  capped.state.roguelike.ledger = ledger; capped.state.turnSerial = 9; capped.state.players[0].turnsStarted = 2;
  const before = JSON.stringify(capped.state);
  roguelikeEvent(capped.state, relic.event, { ...data, unit: capped.state.units[1], target: capped.state.units[1] }, capped.api);
  assert.equal(JSON.stringify(capped.state), before);
});
test('relics: valid treatment only, enemy and token events excluded', () => {
  const { state, api } = fixture(['sun-script', 'iron-seed', 'grave-candle', 'echo-crystal']);
  roguelikeEvent(state, 'heal', { target: state.units[1], amount: 0 }, api);
  roguelikeEvent(state, 'heal', { target: state.units[2], amount: 1 }, api);
  roguelikeEvent(state, 'summon', { unit: state.units[1], fromHand: false }, api);
  roguelikeEvent(state, 'summon', { unit: { ...state.units[1], token: true }, fromHand: true }, api);
  roguelikeEvent(state, 'death', { unit: { ...state.units[1], token: true }, card: { type: 'unit' } }, api);
  roguelikeEvent(state, 'death', { unit: state.units[2], card: { type: 'unit' } }, api);
  roguelikeEvent(state, 'spell', { owner: 1 }, api);
  assert(Object.values(state.roguelike.ledger).every(counter => counter.used === 0));
});
test('relic combinations: healing responses and spell-generated tokens are bounded', () => {
  const { state, api } = fixture(RELICS.map(relic => relic.id));
  roguelikeEvent(state, 'summon', { unit: state.units[1], fromHand: true }, api);
  assert.equal(state.roguelike.ledger['field-kit'].used, 1);
  assert.equal(state.roguelike.ledger['sun-script'].used, 1);
  assert.equal(state.roguelike.ledger['sun-chalice'].used, 1);
  roguelikeEvent(state, 'spell', { owner: 0 }, api);
  assert.equal(state.roguelike.ledger['rune-nest'].used, 1);
  assert.equal(state.roguelike.ledger['iron-seed'].used, 1);
  assert.equal(state.summoned, 1);
  assert(validateRoguelikeState(state));
});
test('no target/no space/full resource does not consume entitlement', () => {
  const { state, api } = fixture(['sun-chalice', 'rune-nest', 'field-kit']);
  state.players[0].mana = state.players[0].maxMana;
  roguelikeEvent(state, 'heal', { target: state.units[1], amount: 1 }, api);
  api.allFree = () => []; api.free = () => [];
  roguelikeEvent(state, 'spell', { owner: 0 }, api);
  state.units[0].health = state.units[0].maxHealth;
  roguelikeEvent(state, 'summon', { unit: state.units[1], fromHand: true }, api);
  assert(Object.values(state.roguelike.ledger).every(counter => counter.used === 0));
});
test('preview clones cannot consume real counters; terminal callbacks stop later effects', () => {
  const { state, api } = fixture(['sun-script', 'sun-hammer']);
  const preview = structuredClone(state);
  const previewApi = { ...api, draw: () => { preview.drawn++; }, refresh: () => {} };
  roguelikeEvent(preview, 'heal', { target: preview.units[1], amount: 1 }, previewApi);
  assert.equal(state.drawn, 0);
  assert.equal(state.roguelike.ledger['sun-script'].used, 0);
  api.draw = () => { state.phase = 'over'; state.drawn++; };
  roguelikeEvent(state, 'heal', { target: state.units[1], amount: 1 }, api);
  assert.equal(state.roguelike.ledger['sun-hammer'].used, 0);
  const ended = JSON.stringify(state);
  roguelikeEvent(state, 'heal', { target: state.units[1], amount: 1 }, api);
  assert.equal(JSON.stringify(state), ended);
});

function engineFixture(relics = [], upgrades = {}, customDeck = null) {
  const actualDeck = customDeck ?? [14, 108, 20043, 20081, 20052].flatMap(id => [id, id, id]);
  const state = createExpeditionMatch('border-01', {}, [14, 9, 11], 23,
    { deck: actualDeck, spells: [20174, 20043], spellTraining: {}, spellModes: {}, specializations: {}, growthVersion: Object.fromEntries(CAMPAIGN_UNIT_IDS.map(id => [id, 'low-v2'])) },
    { challengeSeed: 1842, roguelike: { ...options(relics), upgrades } });
  assert(validateMatch(state), 'new real snapshot must validate');
  findGeneral(state, 0).health = 15;
  assert(confirmMulligan(state), 'real mulligan path');
  assert(validateMatch(state), 'post-mulligan snapshot');
  state.players[0].mana = state.players[0].maxMana = 9;
  return state;
}
function handIndex(state, id) {
  const player = state.players[0];
  let index = player.hand.indexOf(id);
  if (index < 0) {
    const source = player.deck.indexOf(id);
    assert(source >= 0, `fixture needs card ${id}`);
    [player.hand[0], player.deck[source]] = [player.deck[source], player.hand[0]];
    index = 0;
  }
  return index;
}
function engineSummon(state) {
  const index = handIndex(state, 14), cell = summonPositions(state, 0, 14)[0];
  assert(cell); assert(playCard(state, index, cell.x, cell.y));
  return state.units.find(unit => unit.unitId === state.lastAction.unitId);
}
function prepareCasualty(state) {
  const unit = engineSummon(state);
  unit.health = 1; unit.summonedThisTurn = false; unit.moved = unit.attacked = false;
  unit.movesUsed = unit.attacksUsed = 0;
  // Place a legal pre-action fixture beside a retaliating enemy. The regression
  // below uses the public attack/preview paths for the actual death settlement.
  for (const enemy of state.units.filter(target => target.owner !== 0 && target.health > 1 && effectiveAttack(state, target) > 0)) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const x = enemy.x + dx, y = enemy.y + dy;
      if (x < 0 || y < 0 || x >= state.board.columns || y >= state.board.rows
        || state.units.some(other => other !== unit && other.x === x && other.y === y)
        || state.board.tiles.some(tile => tile.x === x && tile.y === y && tile.type === 'wall')) continue;
      unit.x = x; unit.y = y;
      if (attackPositions(state, unit).some(position => position.unitId === enemy.unitId)) {
        assert(validateMatch(state));
        return { unit, enemy };
      }
    }
  }
  throw new Error('Could not arrange legal retaliating attack fixture');
}

for (const relic of RELICS) test(`engine ${relic.id}: public action hook, frozen ledger and resume`, () => {
  const state = engineFixture([relic.id]);
  if (relic.event === 'summon') engineSummon(state);
  else if (['spell', 'heal'].includes(relic.event)) {
    assert(castSpell(state, handIndex(state, 20043), findGeneral(state, 0).unitId));
  } else if (relic.event === 'death') {
    const { unit, enemy } = prepareCasualty(state);
    const before = JSON.stringify(state);
    const preview = simulateAttackUnit(state, unit.unitId, enemy.unitId);
    assert(preview); assert.equal(JSON.stringify(state), before, 'preview changes must remain isolated');
    assert(attackUnit(state, unit.unitId, enemy.unitId));
    assert(!state.units.includes(unit), 'actual retaliation removes the minion');
  }
  assert.equal(state.roguelike.ledger[relic.id].used, 1, `${relic.id} public event must trigger`);
  assert(validateMatch(state), `${relic.id} post-action snapshot must validate`);
  const restored = restoreMatch(JSON.parse(JSON.stringify(state)));
  assert(restored, `${relic.id} restore must succeed`);
  assert.deepEqual(restored.roguelike, state.roguelike);
});
test('engine: zero-cost payment, failed cast, and actual healing eligibility', () => {
  const state = engineFixture(['echo-crystal', 'sun-script'], { 20043: 2 });
  assert.equal(getBattleCard(state, 20043, 0).cost, 0);
  state.players[0].mana = 0;
  const spellIndex = handIndex(state, 20081);
  assert.equal(castSpell(state, spellIndex, findGeneral(state, 1).unitId), false);
  assert.equal(state.roguelike.ledger['echo-crystal'].used, 0);
  const general = findGeneral(state, 0);
  assert(castSpell(state, handIndex(state, 20043), general.unitId));
  assert.equal(state.players[0].mana, 1, 'zero-cost spell pays zero and refunds once');
  assert.equal(state.roguelike.ledger['sun-script'].used, 1);
  assert(validateMatch(state));
});
test('engine: saved upgrade bases survive later catalog numeric/text changes', () => {
  const state = engineFixture([], { 14: 2, 20043: 2 });
  const snapshot = JSON.parse(JSON.stringify(state));
  const oldAttack = CARDS[14].attack, oldDescription = CARDS[14].description;
  try {
    CARDS[14].attack = 42; CARDS[14].description = 'A later content revision';
    const restored = restoreMatch(snapshot);
    assert(restored);
    assert.equal(getBattleCard(restored, 14).attack, oldAttack + 2);
    assert.equal(getBattleCard(restored, 14).description, oldDescription);
    assert(validateMatch(restored));
  } finally { CARDS[14].attack = oldAttack; CARDS[14].description = oldDescription; }
  const forged = structuredClone(state); forged.roguelike.upgradeBases[14].attack++;
  assert(!validateMatch(forged));
  const absentMarker = structuredClone(state); delete absentMarker.roguelike;
  assert(!validateMatch(absentMarker), '15 cards cannot pass ordinary 30-card validation');
  const badVersion = structuredClone(state); badVersion.roguelike.version = 2;
  assert(!validateMatch(badVersion));
});
test('refunds use controlled outposts in the effective mana cap', () => {
  const { state, api } = fixture(['echo-crystal']);
  state.outposts = { '2,2': 0 }; state.players[0].mana = state.players[0].maxMana;
  roguelikeEvent(state, 'spell', { owner: 0 }, api);
  assert.equal(state.players[0].mana, state.players[0].maxMana + 1);
});
test('engine: 12/45-card boundaries and six copies stay isolated from ordinary decks', () => {
  for (const boundary of [Array(6).fill(14).concat(Array(6).fill(108)),
    [14, 108, 9, 11, 15, 109, 110, 115].flatMap(id => Array(6).fill(id)).slice(0, 45)]) {
    const state = engineFixture([], {}, boundary);
    assert(validateMatch(state)); assert(restoreMatch(JSON.parse(JSON.stringify(state))));
    const ordinary = structuredClone(state); delete ordinary.roguelike;
    assert(!validateMatch(ordinary));
  }
  const state = engineFixture([], { 14: 2 });
  assert.throws(() => applyRoguelikeUpgrades(state), /重复/);
  assert(validateMatch(state), 'refused repeated upgrade must retain the valid snapshot');
});
test('pending frozen map/mechanisms survive current catalog changes, then play/save/re-enter/play', () => {
  const base = engineFixture(), liveLevel = EXPEDITION_LEVELS.find(level => level.id === base.levelId);
  const liveMechanics = encounterDefinition(base.levelId);
  const template = structuredClone(liveLevel), mechanics = structuredClone(liveMechanics);
  // The scalar level object is intentionally frozen. Model an earlier route's
  // turn limit directly; mutable board/goal/mechanism fields change below.
  template.turnLimit -= 1;
  const enemyPlan = getEnemyPlan(base.levelId, 3, 1);
  const create = (map = template, rules = mechanics, extra = {}) => createExpeditionMatch(base.levelId, {}, [...base.squad], 23, structuredClone(base.loadout),
    { challengeSeed: 91, enemyPlanOverride: structuredClone(enemyPlan), roguelike: options([]), roguelikeTemplate: structuredClone(map), roguelikeMechanics: structuredClone(rules), ...extra });
  const originalLimit = liveLevel.turnLimit, originalObjective = structuredClone(liveLevel.objective), originalTiles = structuredClone(liveLevel.tiles);
  const originalTitle = liveMechanics.title, originalText = liveMechanics.text, originalDamage = liveMechanics.sources[0].damage;
  try {
    liveLevel.objective.type = 'survive'; liveLevel.objective.rounds = 2; liveLevel.tiles.splice(0, liveLevel.tiles.length);
    liveMechanics.title = 'A later mechanism title'; liveMechanics.text = 'A later mechanism rule'; liveMechanics.sources[0].damage = 4;
    // This is a pending route: the actual battle is first created only AFTER
    // the mutable catalog has changed, from its saved map and mechanisms.
    const state = create();
    assert.equal(state.turnLimit, template.turnLimit);
    assert.deepEqual(state.board.tiles, template.tiles);
    assert.deepEqual(state.objective, template.objective);
    assert.deepEqual(state.encounter.config, mechanics);
    assert(confirmMulligan(state));
    state.players[0].mana = state.players[0].maxMana = 9;
    engineSummon(state); assert(validateMatch(state));
    const resumed = restoreMatch(JSON.parse(JSON.stringify(state)));
    assert(resumed); resumed.players[0].mana = 9;
    assert(castSpell(resumed, handIndex(resumed, 20081), findGeneral(resumed, 1).unitId));
    assert(validateMatch(resumed));
    assert(restoreMatch(JSON.parse(JSON.stringify(resumed))), 'continued battle can be saved and re-entered again');
    const ordinaryLoadout = { ...structuredClone(base.loadout), deck: makeStarterDeck(23) };
    const ordinary = createExpeditionMatch(base.levelId, {}, [...base.squad], 23, ordinaryLoadout);
    assert.equal(ordinary.turnLimit, originalLimit, 'ordinary creation still uses the current map');
    assert.equal(ordinary.encounter.config.title, liveMechanics.title);
    assert(validateMatch(ordinary));
  } finally {
    for (const key of Object.keys(liveLevel.objective)) delete liveLevel.objective[key]; Object.assign(liveLevel.objective, originalObjective);
    liveLevel.tiles.splice(0, liveLevel.tiles.length, ...originalTiles);
    liveMechanics.title = originalTitle; liveMechanics.text = originalText; liveMechanics.sources[0].damage = originalDamage;
  }
  const invalidMap = structuredClone(template); invalidMap.playerStart.x = invalidMap.columns;
  assert.throws(() => create(invalidMap), /地图/);
  const invalidMechanic = structuredClone(mechanics); invalidMechanic.sources[0].owner = 2;
  assert.throws(() => create(template, invalidMechanic), /机关/);
  assert.throws(() => create(template, mechanics, { roguelike: undefined }), /规则/);
  const mixed = create(); delete mixed.roguelike;
  assert(!validateMatch(mixed), 'ordinary snapshots cannot opt into frozen roguelike sources');
  const corrupt = create(); corrupt.roguelikeTemplate.columns = 30;
  assert(!validateMatch(corrupt));
  const mismatched = create(); mismatched.roguelikeMechanics.sources[0].damage++;
  assert(!validateMatch(mismatched), 'saved config must match its frozen mechanism source');
});

const directory = fileURLToPath(new URL('../output/roguelike/', import.meta.url));
await mkdir(directory, { recursive: true });
await writeFile(`${directory}/rules-check.json`, JSON.stringify({ passed: true, tests: results, coverage: 'Rules adapters plus real engine mulligan, card play, spell payment, treatment, attack/preview/death and JSON restore.' }, null, 2));
console.log(`Roguelike rules: ${results.length} behavior checks passed; evidence output/roguelike/rules-check.json`);
