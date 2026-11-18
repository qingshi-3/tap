import assert from 'node:assert/strict';
import { campaignMatch, makeUnit } from './battle-fixture.mjs';
import {
  getAdventureAbilityOptions,
  previewAdventureAbility,
  useAdventureAbility,
  validateMatch,
  restoreMatch,
  endTurn,
  findGeneral,
  castSpell,
  dispelCell,
  attackUnit,
  playCard,
  movementPositions,
  moveUnit,
  withIsolatedBattleSimulation,
} from '../dist/js/engine.js';
import { adventureLineOfSight } from '../dist/js/adventure-system.js';
const results = [];
const test = (name, fn) => {
  fn();
  results.push(name);
  console.log('PASS', name);
};
const match = (id) => campaignMatch({ levelId: id });
const body = (s, id, n = 0) => s.units.filter((u) => u.cardId === id)[n];
const command = (s, u, args = {}) => ({
  unitId: u.unitId,
  abilityId: getAdventureAbilityOptions(s, u.unitId).abilityId,
  revision: s.revision,
  ...args,
});
const pass = (s) => assert.equal(endTurn(s, s.currentPlayer), true);
const round = (s) => {
  pass(s);
  pass(s);
};

test('P1 has exactly five mana, P2 six; initial cannon four-target overcharge', () => {
  const s = match('storm-02');
  assert.equal(s.players[0].mana, 5);
  const u = body(s, 9202),
    c = command(s, u, { direction: 'east' }),
    before = JSON.stringify(s),
    p = previewAdventureAbility(s, c);
  assert.equal(p.ok, true);
  assert.equal(JSON.stringify(s), before);
  assert.equal(p.statChanges.length, 4);
  assert.ok(p.statChanges.every((v) => v.amount === 10));
  assert.equal(useAdventureAbility(s, c), true);
  assert.equal(s.players[0].mana, 3);
  assert.equal(s.adventure.units.find((q) => q.unitId === u.unitId).charge, 0);
  assert.equal(useAdventureAbility(s, c), false);
  assert.equal(validateMatch(s), true);
  round(s);
  assert.equal(s.players[0].maxMana, 6);
});
test('chain follows three real enemies and silence prevents a friendly relay', () => {
  const s = match('storm-01'),
    u = body(s, 9201);
  const c = command(s, u, { targetId: body(s, 9211).unitId }),
    p = previewAdventureAbility(s, c);
  assert.equal(p.ok, true);
  assert.equal(p.statChanges.length, 4);
  assert.equal(useAdventureAbility(s, c), true);
  assert.equal(s.units.filter((u) => u.cardId === 9211 && u.health === 1).length, 3);
  const t = match('storm-02'),
    conductor = body(t, 9201),
    cannon = body(t, 9202);
  dispelCell(t, cannon.x, cannon.y);
  assert.equal(
    getAdventureAbilityOptions(t, conductor.unitId).unitIds.includes(cannon.unitId),
    false,
  );
});
test('supercover rejects exact corner walls and beam stops at a wall', () => {
  const s = match('storm-02');
  s.board.tiles.push({ x: 3, y: 2, type: 'wall' });
  assert.equal(adventureLineOfSight(s, { x: 2, y: 2 }, { x: 3, y: 3 }), false);
  s.board.tiles.push({ x: 5, y: 3, type: 'wall' });
  const p = previewAdventureAbility(s, command(s, body(s, 9202), { direction: 'east' }));
  assert.equal(p.ok, true);
  assert.equal(p.statChanges.length, 1);
  assert.equal(p.cells.at(-1).x, 4);
});
test('same-turn well plus meteor kills three and preview equals committed movement', () => {
  const s = match('starfall-02'),
    g = body(s, 9203),
    m = body(s, 9204);
  const c = command(s, g, { cell: { x: 6, y: 3 } }),
    p = previewAdventureAbility(s, c);
  assert.equal(p.ok, true);
  assert.equal(useAdventureAbility(s, c), true);
  for (const u of p.units)
    assert.deepEqual(
      {
        x: s.units.find((v) => v.unitId === u.unitId).x,
        y: s.units.find((v) => v.unitId === u.unitId).y,
      },
      { x: u.x, y: u.y },
    );
  const before = s.units.filter((u) => u.owner === 1).length;
  assert.equal(useAdventureAbility(s, command(s, m, { cell: { x: 6, y: 4 } })), true);
  assert.equal(before - s.units.filter((u) => u.owner === 1).length, 4);
  assert.equal(s.players[0].mana, 0);
  assert.equal(validateMatch(s), true);
});
test('double well has four targets with the frozen ordered layout', () => {
  const s = match('starfall-07');
  s.players[0].mana = 7;
  s.players[0].maxMana = 7;
  const gs = s.units.filter((u) => u.cardId === 9203),
    m = body(s, 9204);
  assert.equal(useAdventureAbility(s, command(s, gs[0], { cell: { x: 5, y: 2 } })), true);
  assert.equal(useAdventureAbility(s, command(s, gs[1], { cell: { x: 5, y: 4 } })), true);
  const p = previewAdventureAbility(s, command(s, m, { cell: { x: 6, y: 4 } }));
  assert.equal(p.ok, true);
  assert.equal(p.statChanges.length, 4);
  assert.equal(useAdventureAbility(s, command(s, m, { cell: { x: 6, y: 4 } })), true);
  assert.equal(validateMatch(s), true);
});
test('borrowed identity cannot be transformed; silence and refresh do not reset per-turn use', () => {
  const s = match('starfall-02'),
    g = body(s, 9203);
  s.players[0].hand = [20144];
  s.players[0].mana = 9;
  const old = g.cardId;
  assert.equal(castSpell(s, 0, g.unitId), false);
  assert.equal(g.cardId, old);
  assert.equal(s.players[0].mana, 9);
  assert.equal(useAdventureAbility(s, command(s, g, { cell: { x: 6, y: 3 } })), true);
  g.attacked = false;
  g.attacksUsed = 0;
  assert.equal(getAdventureAbilityOptions(s, g.unitId).available, false);
  dispelCell(s, g.x, g.y);
  assert.equal(getAdventureAbilityOptions(s, g.unitId).reason, '已沉默');
});
test('enemy storm is absorbed and reflected, instead of consuming ordinary armor', () => {
  const s = match('storm-01');
  round(s);
  const ev = s.adventure.events[0],
    g = body(s, 9201),
    pg = findGeneral(s, 0);
  pg.x = 0;
  pg.y = 3;
  g.x = ev.cells[0].x;
  g.y = ev.cells[0].y;
  const enemy = body(s, 9211);
  enemy.x = 3;
  enemy.y = 3;
  const hp = g.health,
    ehp = enemy.health;
  pass(s);
  assert.equal(g.health, hp);
  assert.equal(enemy.health, ehp - 3);
  assert.ok(s.lastAction.steps.some((v) => v.kind === 'absorb'));
});
test('one shared reserve returns a new ID with summon waiting and cannot duplicate', () => {
  const s = match('storm-02'),
    c = body(s, 9202),
    enemy = findGeneral(s, 1);
  c.health = 1;
  c.x = 3;
  c.y = 3;
  body(s, 9211).y = 1;
  enemy.x = 4;
  enemy.y = 3;
  pass(s);
  assert.equal(attackUnit(s, enemy.unitId, c.unitId, 1), true);
  assert.equal(s.adventure.pending.length, 1);
  const old = c.unitId;
  const restored = restoreMatch(structuredClone(s));
  assert.ok(restored);
  pass(restored);
  const reserve = body(restored, 9202);
  assert.ok(reserve);
  assert.ok(reserve.unitId > old);
  assert.equal(reserve.summonedThisTurn, true);
  assert.equal(getAdventureAbilityOptions(restored, reserve.unitId).available, false);
  assert.equal(restored.adventure.reserves[9202], 0);
  assert.equal(validateMatch(restored), true);
});
test('two-source identical strike survives closing just one source', () => {
  const s = match('storm-09');
  s.adventure.phase = 1;
  round(s);
  assert.equal(s.adventure.events.length, 2);
  const [a, b] = s.adventure.sources;
  const e0 = s.adventure.events[0],
    e1 = s.adventure.events[1];
  e1.cells = structuredClone(e0.cells);
  e0.sources.push(...e1.sources);
  s.adventure.events = [e0];
  const src = s.units.find((u) => u.unitId === a.unitId);
  dispelCell(s, src.x, src.y);
  assert.equal(s.adventure.events.length, 1);
  assert.deepEqual(s.adventure.events[0].sources, [b.unitId]);
});
test('lethal meteor ends immediately, cancels future events and pending reserves', () => {
  const s = match('starfall-09'),
    boss = findGeneral(s, 1),
    m = body(s, 9204);
  boss.health = 1;
  m.x = 5;
  m.y = 3;
  s.units = s.units.filter((u) => u === m || u.x !== 5 || u.y !== 3);
  assert.equal(useAdventureAbility(s, command(s, m, { cell: { x: 9, y: 3 } })), true);
  assert.equal(s.result, 'win');
  assert.deepEqual(s.adventure.events, []);
  assert.deepEqual(s.adventure.pending, []);
  assert.equal(validateMatch(s), true);
});
test('boss anchoring and enemy deployment quota use real engine input', () => {
  const s = match('storm-03');
  assert.deepEqual(movementPositions(s, findGeneral(s, 1)), []);
  pass(s);
  const p = s.players[1];
  p.hand = [9211, 9211, 9211];
  p.mana = 9;
  for (let n = 0; n < 2; n++) {
    const g = findGeneral(s, 1),
      pos = [
        { x: g.x - 1, y: g.y },
        { x: g.x, y: g.y - 1 },
      ][n];
    s.units = s.units.filter((u) => u.x !== pos.x || u.y !== pos.y);
    assert.equal(playCard(s, n, pos.x, pos.y, 1), true);
  }
  const before = p.mana;
  assert.equal(playCard(s, 0, 9, 4, 1), false);
  assert.equal(p.mana, before);
});
test('ordinary move invalidates a previously valid skill preview', () => {
  const s = match('storm-02'),
    c = command(s, body(s, 9202), { direction: 'east' }),
    before = s.revision;
  assert.equal(previewAdventureAbility(s, c).ok, true);
  const g = findGeneral(s, 0),
    p = movementPositions(s, g)[0];
  assert.ok(p);
  assert.equal(moveUnit(s, g.unitId, p.x, p.y), true);
  assert.ok(s.revision > before);
  const mana = s.players[0].mana;
  assert.equal(useAdventureAbility(s, c), false);
  assert.equal(s.players[0].mana, mana);
});
test('lethal first chain target stops locked downstream hits', () => {
  const s = match('storm-03'),
    g = body(s, 9201),
    boss = findGeneral(s, 1),
    troops = s.units.filter((u) => u.cardId === 9211);
  troops[0].y = 1;
  boss.x = 5;
  boss.y = 2;
  boss.health = 1;
  const hp = troops[1].health;
  assert.equal(useAdventureAbility(s, command(s, g, { targetId: boss.unitId })), true);
  assert.equal(s.result, 'win');
  assert.equal(troops[1].health, hp);
  assert.equal(s.lastAction.steps.filter((v) => v.kind === 'hit').length, 1);
  assert.equal(validateMatch(s), true);
});
test('storm09 third-turn boss cannon replaces power strikes and survives both sources closing', () => {
  const s = match('storm-09');
  for (const source of s.adventure.sources) {
    const u = s.units.find((v) => v.unitId === source.unitId);
    dispelCell(s, u.x, u.y);
  }
  round(s);
  round(s);
  round(s);
  assert.equal(s.currentPlayer, 0);
  assert.equal(s.players[0].turnsStarted, 4);
  assert.equal(s.adventure.events.length, 1);
  const beam = s.adventure.events[0];
  assert.equal(beam.kind, 'beam');
  assert.equal(beam.damage, 6);
  assert.equal(beam.due, 4);
  assert.equal(beam.bound, false);
  assert.deepEqual(beam.sources, []);
  assert.ok(beam.cells.every((c) => c.y === 3));
  assert.deepEqual(beam.cells[0], { x: 8, y: 3 });
  assert.deepEqual(beam.cells.at(-1), { x: 0, y: 3 });
  const guide = body(s, 9201),
    cannon = body(s, 9202);
  guide.x = 3;
  guide.y = 3;
  const guideHp = guide.health,
    cannonHp = cannon.health;
  pass(s);
  assert.equal(guide.health, guideHp - 6);
  assert.equal(cannon.health, cannonHp - 6);
  assert.equal(s.adventure.units.find((q) => q.unitId === cannon.unitId).charge, 0);
  assert.equal(
    s.lastAction.steps.some((v) => v.kind === 'absorb'),
    false,
  );
  assert.equal(validateMatch(s), true);
});
test('storm09 second phase alternates two source strikes with one eight-damage boss cannon', () => {
  const s = match('storm-09');
  s.adventure.phase = 1;
  round(s);
  assert.equal(s.adventure.events.length, 2);
  assert.ok(s.adventure.events.every((e) => e.kind === 'stormStrike' && e.bound));
  round(s);
  assert.ok(s.adventure.events.every((e) => e.kind === 'stormStrike'));
  round(s);
  assert.equal(s.adventure.events.length, 1);
  assert.equal(s.adventure.events[0].kind, 'beam');
  assert.equal(s.adventure.events[0].damage, 8);
  assert.equal(s.adventure.events[0].bound, false);
  assert.equal(validateMatch(s), true);
});
test('candidate restores and summons leave the next real unit ID unchanged, including exceptions', () => {
  const s = match('storm-02');
  s.players[0].hand = [14];
  s.players[0].mana = 9;
  assert.equal(playCard(s, 0, 1, 2), true);
  const removedId = s.lastAction.unitId;
  // A normal dead body has no persistent adventure reference. The allocator must
  // nevertheless retain its live-session high-water mark during candidate work.
  s.units = s.units.filter((u) => u.unitId !== removedId);
  const result = withIsolatedBattleSimulation(() => {
    for (let n = 0; n < 3; n++) {
      const candidate = restoreMatch(structuredClone(s));
      assert.ok(candidate);
      candidate.players[0].hand = [14, 14];
      candidate.players[0].mana = 9;
      assert.equal(playCard(candidate, 0, 1, 2), true);
      assert.equal(playCard(candidate, 0, 0, 2), true);
    }
    return 'search result';
  });
  assert.equal(result, 'search result');
  s.players[0].hand = [14];
  s.players[0].mana = 9;
  assert.equal(playCard(s, 0, 1, 2), true);
  assert.equal(s.lastAction.unitId, removedId + 1);
  const expectedNext = s.lastAction.unitId + 1;
  assert.throws(
    () =>
      withIsolatedBattleSimulation(() => {
        const candidate = structuredClone(s);
        candidate.units = candidate.units.filter((u) => u.unitId <= removedId);
        assert.ok(restoreMatch(candidate));
        candidate.players[0].hand = [14];
        candidate.players[0].mana = 9;
        assert.equal(playCard(candidate, 0, 1, 2), true);
        throw new Error('isolated candidate failure');
      }),
    /isolated candidate failure/,
  );
  s.players[0].hand = [14];
  s.players[0].mana = 9;
  assert.equal(playCard(s, 0, 0, 2), true);
  assert.equal(s.lastAction.unitId, expectedNext);
});
console.log(JSON.stringify({ passed: results.length, cases: results }, null, 2));
