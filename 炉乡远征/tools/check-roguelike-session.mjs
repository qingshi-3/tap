import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { RoguelikeSession, ROGUELIKE_KEY } from '../dist/js/roguelike-session.js';
import { ROGUELIKE_HEROES, ENCOUNTERS, BOSSES, CAMP_COSTS, createRoguelikeRoute } from '../dist/js/roguelike-data.js';
import { createRoguelikeMarker, applyRoguelikeUpgrades, validateRoguelikeState, validateRoguelikeDeck } from '../dist/js/roguelike-rules.js';
import { EXPEDITION_LEVELS } from '../dist/js/expedition-data.js';
import { getEnemyPlan, validateEnemyPlan } from '../dist/js/enemy-plans.js';
import { encounterDefinition } from '../dist/js/encounter-content.js';
import { getCard } from '../dist/js/cards.js';
import { getFaction } from '../dist/js/factions.js';
import { CAMPAIGN_UNIT_IDS } from '../dist/js/campaign-rules.js';
import * as realEngine from '../dist/js/engine.js';

const checks = [], fixtures = {}, engineFixtures = {};
const check = (name, operation) => { operation(); checks.push(name); };
const clone = value => structuredClone(value);
class Storage {
  data = new Map([['ordinary-profile', 'protected'], ['duelyst-h5.safe-v1.ranked-challenge-v1', 'protected-ranked']]);
  writes = 0; fail = false; afterWrite = false; corruptWrite = false; failReadback = false; readFailures = 0;
  getItem(key) { if (this.readFailures > 0) { this.readFailures--; throw new Error('temporary read unavailable'); } return this.data.get(key) ?? null; }
  setItem(key, value) { if (this.fail) throw new Error('quota exceeded'); this.writes++; this.data.set(key, this.corruptWrite ? 'racing-writer' : value); if (this.failReadback) { this.failReadback = false; this.readFailures++; } if (this.afterWrite) throw new Error('adapter threw after commit'); }
}
// A small explicit adapter exercises transactions independently of battle AI.
// It does not count as engine integration or gameplay/balance evidence.
let battleSerial = 0;
const contexts = new WeakMap();
const isolatedEngine = {
  createExpeditionMatch(levelId, training, squad, heroId, loadout, options) {
    const template = options.roguelikeTemplate ?? EXPEDITION_LEVELS.find(value => value.id === levelId);
    const match = { schemaVersion: 7, mode: 'expedition', runId: `isolated-${++battleSerial}`, revision: 0, levelId,
      phase: 'mulligan', round: 0, turnSerial: 0, players: [{ id: 0, generalId: heroId }], training: clone(training), loadout: clone(loadout),
      roguelike: createRoguelikeMarker(options.roguelike), enemyPlan: clone(options.enemyPlanOverride),
      board: { columns: template.columns, rows: template.rows, tiles: clone(template.tiles ?? []) }, objective: clone(template.objective), turnLimit: template.turnLimit,
      winner: null, result: null, expansionRandom: options.challengeSeed, battleCards: { 0: Object.fromEntries([...new Set(loadout.deck)].map(id => [id, clone(getCard(id))])) } };
    if (options.enemyPlanOverride.encounterVersion === 1) match.encounter = { config: clone(options.roguelikeMechanics ?? encounterDefinition(levelId)) };
    applyRoguelikeUpgrades(match); contexts.set(match, { rng: match.expansionRandom, deaths: 0 }); return match;
  },
  validateMatch(match) { return !!match && ['mulligan', 'playing', 'over'].includes(match.phase) && typeof match.runId === 'string' && validateRoguelikeState(match); },
  restoreMatch(match) { return this.validateMatch(match) ? match : null; },
  challengeContext(match) { const value = contexts.get(match); return value ? { rng: match.expansionRandom, deaths: value.deaths } : null; },
  bindChallengeContext(match, context) { assert.equal(context.rng, match.expansionRandom); contexts.set(match, clone(context)); },
  unbindChallengeContext(match) { contexts.delete(match); },
};
function open(storage = new Storage(), engine = isolatedEngine) { return { storage, session: new RoguelikeSession({ storage, engine }) }; }
function good(result) { assert.equal(result.ok, true, result.error); return result; }
function start(target = open(), options = {}) { good(target.session.start({ heroId: 23, seed: 12345, ...options })); return target; }
function reopen(target, label) {
  if (label && !fixtures[label]) fixtures[label] = clone(target.session.record);
  const before = target.storage.getItem(ROGUELIKE_KEY); target.session.leave();
  target.session = new RoguelikeSession({ storage: target.storage, engine: isolatedEngine });
  assert.equal(target.session.error, ''); assert.equal(target.storage.getItem(ROGUELIKE_KEY), before, 'loading is read-only');
  assert(target.session.validRecord(target.session.record));
  if (target.session.record.run.phase === 'battle') { const restored = good(target.session.restoreBattle()); good(target.session.checkpoint(restored.match)); }
  return target;
}
function chooseOpening(target) { const session = target.session; good(session.chooseRelic(session.record.run.offers.relics[0].id)); return target; }
function enter(target, index = 0) {
  const session = target.session; good(session.chooseRoute(session.record.run.offers.routes[index].id));
  const prepared = good(session.prepareBattle()); good(session.commitBattle(prepared.match)); return prepared.match;
}
function finish(target, match, won = true) {
  match.phase = 'over'; match.round = 4; match.turnSerial = 8; match.winner = won ? 0 : 1; match.result = won ? 'win' : 'loss';
  good(target.session.checkpoint(match)); return target;
}
function afterRewards(target, skip = false) {
  const session = target.session;
  if (session.record.run.phase === 'cards') good(session.chooseCards(skip ? null : session.record.run.offers.cards[0]?.id ?? null));
  if (session.record.run.phase === 'relic') good(session.chooseRelic(session.record.run.offers.relics[0].id));
  return target;
}
function fullRun(target, { heroId = 23, difficulty = 1, kitId, seed = 12345, snapshots = false } = {}) {
  start(target, { heroId, difficulty, kitId, seed }); if (snapshots) reopen(target, 'opening-relic');
  chooseOpening(target);
  for (let stage = 1; stage <= 6; stage++) {
    if (snapshots) reopen(target, 'route');
    const route = target.session.record.run.offers.routes[stage % 2];
    good(target.session.chooseRoute(route.id)); if (snapshots) reopen(target, 'selected-route');
    assert.equal(route.kind === 'boss', [3, 6].includes(stage));
    const prepared = good(target.session.prepareBattle()); good(target.session.commitBattle(prepared.match));
    if (snapshots) reopen(target, 'battle');
    const match = target.session.active;
    finish(target, match);
    const raw = target.storage.getItem(ROGUELIKE_KEY), gold = target.session.record.run.gold;
    good(target.session.checkpoint(match)); assert.equal(target.storage.getItem(ROGUELIKE_KEY), raw); assert.equal(target.session.record.run.gold, gold);
    if (stage === 6) break;
    if (snapshots) reopen(target, 'cards');
    good(target.session.chooseCards(stage % 2 ? null : target.session.record.run.offers.cards[0]?.id ?? null));
    if (target.session.record.run.phase === 'relic') { if (snapshots) reopen(target, 'reward-relic'); good(target.session.chooseRelic(target.session.record.run.offers.relics[0].id)); }
    if (snapshots) reopen(target, 'camp');
    good(target.session.camp('continue'));
  }
  if (snapshots) reopen(target, 'won');
  assert.equal(target.session.record.run.phase, 'won'); assert.equal(target.session.record.heroes[heroId].bestDifficulty, difficulty);
  assert.equal(target.storage.getItem('ordinary-profile'), 'protected'); assert.equal(target.storage.getItem('duelyst-h5.safe-v1.ranked-challenge-v1'), 'protected-ranked');
  return target;
}

check('three heroes, two legal 15-card kits each, 12 encounters and four bosses', () => {
  assert.deepEqual(ROGUELIKE_HEROES.map(value => value.id), [23, 123, 301]); assert.equal(ENCOUNTERS.length, 12); assert.equal(BOSSES.length, 4);
  for (const hero of ROGUELIKE_HEROES) { assert.equal(hero.kits.length, 2); for (const kit of hero.kits) { assert.equal(kit.deck.length, 15); assert(validateRoguelikeDeck(kit.deck)); } }
});
check('independent enemy curves preserve original plans, complete maps and encounter machinery', () => {
  const original = JSON.stringify(EXPEDITION_LEVELS), plans = JSON.stringify([...ENCOUNTERS, ...BOSSES].map(value => getEnemyPlan(value.levelId, 3)));
  for (const heroId of [23, 123, 301]) for (let difficulty = 1; difficulty <= 5; difficulty++) for (let stage = 1; stage <= 6; stage++) {
    for (const source of [...ENCOUNTERS, ...BOSSES].filter(value => value.minStage <= stage)) {
      const route = createRoguelikeRoute(source.id, { stage, difficulty, heroId, kind: BOSSES.includes(source) ? 'boss' : 'safe', battleSeed: 1 });
      assert(validateEnemyPlan(route.enemyPlan, route.levelId)); assert.deepEqual(route.template, EXPEDITION_LEVELS.find(value => value.id === source.levelId)); assert.deepEqual(route.mechanics, encounterDefinition(source.levelId));
      if (stage <= 2) for (const plan of Object.values(route.enemyPlan.players)) { assert(plan.generalHealth <= 30); assert(plan.garrison.length <= 2); assert(plan.mana <= 3); }
    }
  }
  assert.equal(JSON.stringify(EXPEDITION_LEVELS), original); assert.equal(JSON.stringify([...ENCOUNTERS, ...BOSSES].map(value => getEnemyPlan(value.levelId, 3))), plans);
});
check('all phases reload, continue, save, re-enter and save under the fixed independent key', () => {
  fullRun(open(), { snapshots: true });
  const target = chooseOpening(start()); finish(target, enter(target), false); reopen(target, 'lost');
  good(target.session.start({ heroId: 301, seed: 55 })); assert.equal(target.session.record.run.phase, 'relic');
});
check('first win unlocks only that hero second kit; difficulties unlock sequentially through five', () => {
  const target = open();
  assert.equal(target.session.start({ heroId: 23, kitId: ROGUELIKE_HEROES[0].kits[1].id }).ok, false);
  assert.equal(target.session.start({ difficulty: 2 }).ok, false);
  for (let difficulty = 1; difficulty <= 5; difficulty++) {
    fullRun(target, { difficulty }); assert.equal(target.session.record.unlockedDifficulty, Math.min(5, difficulty + 1));
    assert.equal(target.session.record.heroes[23].wins, difficulty); assert.equal(target.session.record.heroes[123].unlockedKits.length, 1);
  }
  fullRun(target, { heroId: 123 }); fullRun(target, { heroId: 301 });
  good(target.session.start({ heroId: 23, kitId: ROGUELIKE_HEROES[0].kits[1].id, difficulty: 5, seed: 4 })); good(target.session.abandon()); reopen(target, 'abandoned');
});
check('same seed freezes route, relic and reward candidates across reload and failed saves', () => {
  const a = chooseOpening(start()), b = chooseOpening(start()); assert.deepEqual(a.session.record.run.offers, b.session.record.run.offers);
  const selected = a.session.record.run.offers.routes[0]; good(a.session.chooseRoute(selected.id));
  const raw = a.storage.getItem(ROGUELIKE_KEY), prepared = good(a.session.prepareBattle());
  assert.equal(a.storage.getItem(ROGUELIKE_KEY), raw); assert.strictEqual(good(a.session.prepareBattle()).match, prepared.match);
  a.storage.fail = true; assert.equal(a.session.commitBattle(prepared.match).ok, false); assert.equal(a.storage.getItem(ROGUELIKE_KEY), raw); assert.equal(a.session.record.run.phase, 'route');
  a.storage.fail = false; good(a.session.commitBattle(prepared.match));
  prepared.match.phase = 'over'; prepared.match.winner = 0; prepared.match.result = 'win';
  const prior = clone(a.session.record); a.storage.fail = true; assert.equal(a.session.checkpoint(prepared.match).ok, false); assert.deepEqual(a.session.record, prior);
  a.storage.fail = false; good(a.session.checkpoint(prepared.match)); const offers = clone(a.session.record.run.offers.cards); reopen(a); assert.deepEqual(a.session.record.run.offers.cards, offers);
  const rewardRaw = a.storage.getItem(ROGUELIKE_KEY); a.storage.fail = true; assert.equal(a.session.chooseCards(offers[0].id).ok, false); assert.equal(a.storage.getItem(ROGUELIKE_KEY), rewardRaw);
  a.storage.fail = false; good(a.session.chooseCards(offers[0].id)); const claimed = clone(a.session.record); assert.equal(a.session.chooseCards(offers[0].id).ok, false); assert.deepEqual(a.session.record, claimed);
});
check('uncommitted new-run failure reuses the original run identity, seed and candidates', () => {
  const target = open(); target.storage.fail = true; assert.equal(target.session.start().ok, false); const pending = clone(target.session.pendingStart.record);
  assert.equal(target.storage.getItem(ROGUELIKE_KEY), null); target.storage.fail = false; good(target.session.start()); assert.deepEqual(target.session.record, pending);
});
check('save commits that throw afterwards reconcile exact bytes and remain writable', () => {
  const target = start(); target.storage.afterWrite = true; chooseOpening(target); const match = enter(target); finish(target, match); afterRewards(target); good(target.session.camp('continue')); reopen(target);
});
check('temporary post-commit read failure reconciles the pending exact candidate on retry', () => {
  const target = start(), relicId = target.session.record.run.offers.relics[0].id;
  target.storage.failReadback = true; assert.equal(target.session.chooseRelic(relicId).ok, false); assert.equal(target.session.record.run.phase, 'relic');
  const writes = target.storage.writes; good(target.session.chooseRelic(relicId)); assert.equal(target.storage.writes, writes); assert.equal(target.session.record.run.phase, 'route');
  const match = enter(target); match.phase = 'over'; match.winner = 0; match.result = 'win';
  target.storage.failReadback = true; assert.equal(target.session.checkpoint(match).ok, false); good(target.session.checkpoint(match));
  assert.equal(target.session.record.run.settled.length, 1); assert.equal(target.session.record.run.gold, 110); good(target.session.chooseCards(null));
});
check('CAS rejects a stale page and a racing write without overwriting raw bytes', () => {
  const target = start(), competitor = new RoguelikeSession({ storage: target.storage, engine: isolatedEngine });
  good(competitor.chooseRelic(competitor.record.run.offers.relics[0].id)); const raw = target.storage.getItem(ROGUELIKE_KEY);
  assert.equal(target.session.chooseRelic(target.session.record.run.offers.relics[0].id).ok, false); assert.equal(target.storage.getItem(ROGUELIKE_KEY), raw); assert(target.session.blocked);
  const race = start(); race.storage.corruptWrite = true; assert.equal(race.session.chooseRelic(race.session.record.run.offers.relics[0].id).ok, false); assert.equal(race.storage.getItem(ROGUELIKE_KEY), 'racing-writer'); assert(race.session.blocked);
});
check('malformed, unknown and inconsistent saves stop writes and preserve the original', () => {
  const base = fixtures.battle;
  const wrongContext = clone(base); wrongContext.run.context.rng++;
  const wrongRoute = clone(base); wrongRoute.run.route.enemyPlan.players[1].generalHealth++;
  const wrongUpgrade = clone(fixtures.camp); wrongUpgrade.run.upgrades[999999] = 2;
  const corruptPending = change => {
    const record = clone(fixtures['selected-route']); change(record.run.route); record.run.offers.routes[record.run.offers.routes.findIndex(value => value.id === record.run.route.id)] = clone(record.run.route); return JSON.stringify(record);
  };
  for (const raw of ['{broken', 'null', JSON.stringify({ ...base, schemaVersion: 99 }), JSON.stringify({ ...base, modeVersion: 99 }), JSON.stringify(wrongContext), JSON.stringify(wrongRoute), JSON.stringify(wrongUpgrade),
    corruptPending(route => { route.template.playerStart.x = 'bad'; }), corruptPending(route => { route.mechanics.sources[0].kind = 'unknown-mechanism'; }), corruptPending(route => { route.enemyPlan.players[1].garrison[0].x = 999; })]) {
    const storage = new Storage(); storage.data.set(ROGUELIKE_KEY, raw); const target = open(storage); assert(target.session.error); assert.equal(target.session.start().ok, false); assert.equal(target.session.abandon().ok, false); assert.equal(target.session.restoreBattle().ok, false); assert.equal(storage.getItem(ROGUELIKE_KEY), raw); assert.equal(storage.writes, 0);
  }
});
check('camp charges, rank caps, deck floor, insufficient funds and skip are transactional', () => {
  const target = chooseOpening(start()); finish(target, enter(target)); const count = target.session.record.run.deck.length; good(target.session.chooseCards(null)); assert.equal(target.session.record.run.deck.length, count);
  const cardId = target.session.record.run.deck[0], before = target.session.record.run.gold;
  good(target.session.camp('upgrade', cardId)); assert.equal(target.session.record.run.upgrades[cardId], 1); assert.equal(target.session.record.run.gold, before - CAMP_COSTS.upgrade);
  const raw = target.storage.getItem(ROGUELIKE_KEY); target.storage.fail = true; assert.equal(target.session.camp('remove', cardId).ok, false); assert.equal(target.storage.getItem(ROGUELIKE_KEY), raw); target.storage.fail = false;
  good(target.session.camp('remove', cardId)); assert.equal(target.session.record.run.deck.length, count - 1); reopen(target);
  const fixture = clone(fixtures.camp); fixture.run.gold = 500; fixture.run.deck = fixture.run.deck.slice(0, 12); fixture.run.upgrades = {};
  const storage = new Storage(); storage.data.set(ROGUELIKE_KEY, JSON.stringify(fixture)); const small = open(storage); assert.equal(small.session.error, ''); assert.equal(small.session.camp('remove', small.session.record.run.deck[0]).ok, false);
  const id = small.session.record.run.deck[0]; good(small.session.camp('upgrade', id)); good(small.session.camp('upgrade', id)); assert.equal(small.session.camp('upgrade', id).ok, false);
  const poorFixture = clone(fixture); poorFixture.run.gold = 0; const poorStorage = new Storage(); poorStorage.data.set(ROGUELIKE_KEY, JSON.stringify(poorFixture)); const poor = open(poorStorage); assert.equal(poor.session.camp('upgrade', poor.session.record.run.deck[0]).ok, false); good(poor.session.camp('continue'));
});
check('foreign battle objects cannot checkpoint, commit or acquire ownership', () => {
  const target = chooseOpening(start()); good(target.session.chooseRoute(target.session.record.run.offers.routes[0].id));
  const match = good(target.session.prepareBattle()).match; assert.equal(target.session.commitBattle(clone(match)).ok, false); good(target.session.commitBattle(match)); assert.equal(target.session.checkpoint(clone(match)).ok, false); target.session.leave(); assert.equal(target.session.owns(match), false); assert.equal(target.session.checkpoint(match).ok, false);
});
check('all reward packets remain legal, cross faction and collectible, with owned relics excluded', () => {
  let crossFaction = false;
  for (let seed = 0; seed < 50; seed++) {
    const target = chooseOpening(start(open(), { seed })); finish(target, enter(target, 1));
    const run = target.session.record.run; assert.equal(run.offers.cards.length, 3);
    for (const offer of run.offers.cards) { assert.equal(offer.cards.length, 2); assert(validateRoguelikeDeck([...run.deck, ...offer.cards])); crossFaction ||= offer.cards.some(id => ![0, 1].includes(getCard(id).faction)); }
    good(target.session.chooseCards(null)); assert.equal(target.session.record.run.phase, 'relic'); assert(target.session.record.run.offers.relics.every(value => !target.session.record.run.relics.includes(value.id)));
  }
  assert(crossFaction);
});

// Run the real adapter only after the owner has integrated the explicit marker.
// These are real engine state transitions, not browser or balance acceptance.
const integration = { verified: false, cases: [], remaining: ['真实浏览器输入和手机布局由主责验收', '长期数值与六战真人通关尚未验收'] };
try {
  for (const hero of ROGUELIKE_HEROES) {
    const target = start(open(new Storage(), realEngine), { heroId: hero.id }); chooseOpening(target);
    const match = enter(target); assert(realEngine.validateMatch(match)); assert(realEngine.confirmMulligan(match)); good(target.session.checkpoint(match));
    const saved = target.storage.getItem(ROGUELIKE_KEY); target.session.leave();
    target.session = new RoguelikeSession({ storage: target.storage }); const restored = good(target.session.restoreBattle()).match;
    assert(realEngine.validateMatch(restored)); assert.deepEqual(realEngine.challengeContext(restored), target.session.record.run.context); assert(realEngine.autoAct(restored)); good(target.session.checkpoint(restored));
    assert.notEqual(target.storage.getItem(ROGUELIKE_KEY), saved); integration.cases.push({ heroId: hero.id, levelId: restored.levelId, deckSize: restored.loadout.deck.length, rng: restored.expansionRandom });
  }
  let templateCases = 0;
  for (const hero of ROGUELIKE_HEROES) for (const difficulty of [1, 5]) for (const source of [...ENCOUNTERS, ...BOSSES]) {
    const stage = difficulty === 1 ? source.minStage : 6, faction = getFaction(hero.faction), kit = hero.kits[0];
    const upgrades = { [kit.deck[0]]: 2, [kit.deck.find(id => getCard(id).type === 'spell')]: 1 };
    const route = createRoguelikeRoute(source.id, { stage, difficulty, heroId: hero.id, kind: BOSSES.includes(source) ? 'boss' : 'elite', battleSeed: 456 });
    const match = realEngine.createExpeditionMatch(source.levelId, {}, faction.defaultSquad, hero.id,
      { deck: [...kit.deck], spells: faction.spellIds.slice(0, 2), spellTraining: {}, spellModes: {}, specializations: {}, growthVersion: Object.fromEntries(CAMPAIGN_UNIT_IDS.map(id => [id, 'low-v2'])) },
      { challengeSeed: route.battleSeed, enemyPlanOverride: clone(route.enemyPlan), roguelikeTemplate: clone(route.template), roguelikeMechanics: clone(route.mechanics),
        roguelike: { version: 1, runId: `template-${hero.id}-${source.id}`, stage, difficulty, relics: ['iron-seed'], upgrades } });
    assert(realEngine.validateMatch(match), `${hero.id}/${source.id}/difficulty-${difficulty}`); assert(realEngine.confirmMulligan(match)); assert(realEngine.validateMatch(match));
    const restored = realEngine.restoreMatch(clone(match)); assert(restored); realEngine.bindChallengeContext(restored, realEngine.challengeContext(match)); assert(realEngine.autoAct(restored)); assert(realEngine.validateMatch(restored));
    realEngine.unbindChallengeContext(match); realEngine.unbindChallengeContext(restored); templateCases++;
  }
  integration.templates = { count: templateCases, heroes: 3, difficulties: [1, 5], upgradedUnitRank: 2, upgradedSpellRank: 1, coverage: '16 original full templates: construct, confirm, restore, act, validate' };
  integration.autoplay = [];
  const captureEngine = (label, target) => { if (!engineFixtures[label]) engineFixtures[label] = clone(target.session.record); };
  for (const heroId of [23, 123, 301]) {
    const target = start(open(new Storage(), realEngine), { heroId }); captureEngine('opening-relic', target); chooseOpening(target); captureEngine('route', target);
    const battles = [];
    for (let stage = 1; stage <= 6; stage++) {
      good(target.session.chooseRoute(target.session.record.run.offers.routes[stage === 2 ? 1 : 0].id)); captureEngine('selected-route', target);
      const match = good(target.session.prepareBattle()).match; good(target.session.commitBattle(match)); captureEngine('battle', target);
      let actions = 0;
      while (match.phase !== 'over' && actions < 1200) { assert(realEngine.autoAct(match), `autoplay stalled ${heroId}/${stage}/${actions}`); assert(realEngine.validateMatch(match), `autoplay invalid ${heroId}/${stage}/${actions}`); actions++; }
      assert.equal(match.phase, 'over', 'autoplay must terminate'); good(target.session.checkpoint(match));
      const saved = target.storage.getItem(ROGUELIKE_KEY); good(target.session.checkpoint(match)); assert.equal(target.storage.getItem(ROGUELIKE_KEY), saved);
      battles.push({ stage, levelId: match.levelId, result: match.result, round: match.round, actions });
      captureEngine(target.session.record.run.phase, target);
      // Reload every actual reward/terminal snapshot through the production
      // validator before any purchase or continuation.
      target.session.leave(); target.session = new RoguelikeSession({ storage: target.storage }); assert.equal(target.session.error, '');
      if (['won', 'lost'].includes(target.session.record.run.phase)) break;
      good(target.session.chooseCards(target.session.record.run.offers.cards[0]?.id ?? null));
      if (target.session.record.run.phase === 'relic') { captureEngine('reward-relic', target); good(target.session.chooseRelic(target.session.record.run.offers.relics[0].id)); }
      captureEngine('camp', target);
      const upgradeId = target.session.record.run.deck.find(id => getCard(id).type === 'unit' && (target.session.record.run.upgrades[id] ?? 0) < 2);
      if (upgradeId && target.session.record.run.gold >= CAMP_COSTS.upgrade) good(target.session.camp('upgrade', upgradeId));
      good(target.session.camp('continue'));
    }
    integration.autoplay.push({ heroId, battles, result: target.session.record.run.result, note: 'real engine autoAct; not human gameplay/balance acceptance' });
  }
  const frozen = start(open(new Storage(), realEngine)); chooseOpening(frozen); good(frozen.session.chooseRoute(frozen.session.record.run.offers.routes[0].id));
  const selected = clone(frozen.session.record.run.route), frozenRaw = frozen.storage.getItem(ROGUELIKE_KEY), liveLevel = EXPEDITION_LEVELS.find(value => value.id === selected.levelId), liveMechanics = encounterDefinition(selected.levelId);
  const oldTiles = clone(liveLevel.tiles), oldObjective = clone(liveLevel.objective), oldMechanics = clone(liveMechanics);
  try {
    // In-memory catalog edits model a later app update without touching any
    // authored source file, shared process, or frozen historical fixture.
    liveLevel.tiles.push({ x: 0, y: 0, type: 'wall' }); liveLevel.objective.type = 'survive'; liveLevel.objective.rounds = 4;
    liveMechanics.title += '（新版）'; liveMechanics.text += '新版说明'; liveMechanics.sources[0].damage = 2;
    frozen.session = new RoguelikeSession({ storage: frozen.storage }); assert.equal(frozen.session.error, ''); assert.equal(frozen.storage.getItem(ROGUELIKE_KEY), frozenRaw);
    const prepared = good(frozen.session.prepareBattle()).match; assert.deepEqual(prepared.board.tiles, selected.template.tiles); assert.deepEqual(prepared.objective, selected.template.objective); assert.deepEqual(prepared.encounter.config, selected.mechanics);
    good(frozen.session.commitBattle(prepared)); assert(realEngine.confirmMulligan(prepared)); good(frozen.session.checkpoint(prepared)); frozen.session.leave();
    frozen.session = new RoguelikeSession({ storage: frozen.storage }); const restored = good(frozen.session.restoreBattle()).match;
    for (let i = 0; i < 80 && restored.phase !== 'over' && restored.turnSerial < 4; i++) assert(realEngine.autoAct(restored));
    good(frozen.session.checkpoint(restored)); assert(realEngine.validateMatch(restored));
    integration.pendingRouteAfterCatalogUpdate = { verified: true, levelId: selected.levelId, turnSerial: restored.turnSerial, boardPreserved: true, objectivePreserved: true, mechanicsPreserved: true, reloadSave: true };
  } finally {
    liveLevel.tiles.splice(0, liveLevel.tiles.length, ...oldTiles); for (const key of Object.keys(liveLevel.objective)) delete liveLevel.objective[key]; Object.assign(liveLevel.objective, oldObjective);
    for (const key of Object.keys(liveMechanics)) delete liveMechanics[key]; Object.assign(liveMechanics, oldMechanics);
  }
  integration.verified = true;
} catch (error) { integration.error = error.message; if (process.argv.includes('--require-engine')) throw error; }

mkdirSync(new URL('../output/roguelike/', import.meta.url), { recursive: true });
writeFileSync(new URL('../output/roguelike/session-fixtures.json', import.meta.url), JSON.stringify({ version: 1, source: 'isolated-transaction-adapter', fixtures }, null, 2));
writeFileSync(new URL('../output/roguelike/session-engine-fixtures.json', import.meta.url), JSON.stringify({ version: 1, source: 'real-engine-seeded-autoAct', fixtures: engineFixtures }, null, 2));
const report = { ok: true, storageKey: ROGUELIKE_KEY, checks, isolatedStateMachine: true, phaseCoverage: Object.keys(fixtures), realEngine: integration };
writeFileSync(new URL('../output/roguelike/session-report.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
