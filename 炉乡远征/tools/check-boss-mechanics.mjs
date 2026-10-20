// Boss rule gate (霜墙女王 / frost-03): telegraph → resolve, shard growth, frost armor,
// shatter splash, HP phase entered once, mid-battle save round trip, no Math.random.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { endTurn, attackUnit, restoreMatch, validateMatch, autoAct, findGeneral } from '../dist/js/engine.js';
import { ICE_SHARD_ID } from '../dist/js/boss-mechanics.js';
import { getCard } from '../dist/js/cards.js';
import { campaignMatch, makeUnit } from './battle-fixture.mjs';

const LEVEL = 'frost-03';
const make = (heroId = 1) => campaignMatch({ heroId, levelId: LEVEL });
const queen = s => findGeneral(s, s.boss.owner);
const shards = s => s.units.filter(u => u.cardId === ICE_SHARD_ID && u.health > 0);
const at = (s, x, y) => s.units.find(u => u.x === x && u.y === y && u.health > 0);
const roundTrip = s => { assert.ok(validateMatch(s)); const r = restoreMatch(JSON.parse(JSON.stringify(s))); assert.ok(r); assert.deepEqual(r.boss, s.boss); return r; };
const playerUnitId = s => s.playerDeck.find(id => getCard(id).type === 'unit');
const ally = (s, x, y, extra = {}) => { const u = makeUnit(playerUnitId(s), 0, x, y, 900 + s.units.length, extra); s.units.push(u); return u; };
const free = (s, x0) => { for (let x = x0; x >= 0; x--) for (let y = 0; y < s.board.rows; y++) if (!at(s, x, y)) return { x, y }; };

// Setup: boss state exists only on boss levels, three shards wall the queen.
{
  const s = make();
  assert.deepEqual(Object.keys(s.boss).sort(), ['announce', 'id', 'marks', 'owner', 'phase']);
  assert.equal(s.boss.id, 'frost-queen');
  assert.equal(shards(s).length, 3);
  assert.equal(campaignMatch().boss, undefined, 'non-boss levels carry no boss state');
  roundTrip(s);
}

// Telegraph: the queen's turn end marks the player general; staying there costs 3 HP and a freeze.
{
  const s = make(), general = findGeneral(s, 0);
  assert.ok(endTurn(s, 0)); assert.equal(s.currentPlayer, 1);
  assert.ok(endTurn(s, 1));
  assert.deepEqual(s.boss.marks, [{ x: general.x, y: general.y }]);
  assert.equal(s.boss.announce.serial, 1);
  const saved = roundTrip(s), hp = general.health;
  assert.ok(endTurn(s, 0));
  assert.equal(general.health, hp - 3);
  assert.ok(general.stunTurns >= 1, 'marked unit is frozen');
  assert.deepEqual(s.boss.marks, []);
  roundTrip(s);

  // Same save, general steps off the mark: the empty cell grows a shard instead.
  const g = findGeneral(saved, 0), mark = { x: g.x, y: g.y }, dest = free(saved, 2);
  g.x = dest.x; g.y = dest.y;
  const before = shards(saved).length, hp2 = g.health;
  assert.ok(endTurn(saved, 0));
  assert.equal(g.health, hp2);
  assert.equal(shards(saved).length, before + 1);
  assert.equal(at(saved, mark.x, mark.y)?.cardId, ICE_SHARD_ID);
  roundTrip(saved);
}

// Frost armor: with 3 adjacent shards a hit on the queen is capped at 1; without, it lands in full.
{
  const s = make(), q = queen(s), striker = ally(s, q.x, q.y - 1, { attack: 6 });
  const hp = q.health;
  assert.ok(attackUnit(s, striker.unitId, q.unitId));
  assert.equal(q.health, hp - 1);
  const open = make(), q2 = queen(open);
  open.units = open.units.filter(u => u.cardId !== ICE_SHARD_ID);
  const striker2 = ally(open, q2.x, q2.y - 1, { attack: 6 }), hp2 = q2.health;
  assert.ok(attackUnit(open, striker2.unitId, q2.unitId));
  assert.equal(q2.health, hp2 - 6);
  const two = make(), q3 = queen(two);
  two.units.splice(two.units.indexOf(shards(two)[0]), 1);
  const striker3 = ally(two, q3.x, q3.y - 1, { attack: 6 }), hp3 = q3.health;
  assert.ok(attackUnit(two, striker3.unitId, q3.unitId));
  assert.equal(q3.health, hp3 - 6, 'two shards are not enough for armor');
}

// Shatter: a destroyed shard deals 2 to every adjacent unit, ignoring frost armor.
{
  const s = make(), q = queen(s), shard = at(s, 6, 2);
  shard.health = 1;
  const striker = ally(s, 5, 2, { attack: 3, health: 5, maxHealth: 5 });
  const qhp = q.health;
  assert.ok(attackUnit(s, striker.unitId, shard.unitId));
  assert.ok(!s.units.includes(shard) || shard.health <= 0);
  assert.equal(q.health, qhp - 2, 'shatter bypasses frost armor');
  assert.equal(striker.health, 5 - 2);
  roundTrip(s);
}

// Phase: crossing half HP enters 凛冬 exactly once.
{
  const s = make(), q = queen(s);
  s.units = s.units.filter(u => u.cardId !== ICE_SHARD_ID);
  const half = Math.floor((q.maxHealth + q.healthBuff) / 2);
  q.health = half + 2;
  const striker = ally(s, q.x, q.y - 1, { attack: 3, health: 20, maxHealth: 20 });
  assert.ok(attackUnit(s, striker.unitId, q.unitId));
  assert.equal(s.boss.phase, 1);
  const grown = shards(s).length;
  assert.ok(grown > 0 && grown <= 3);
  assert.ok(striker.stunTurns >= 1, 'winter freezes foes next to shards');
  // General 527 grants walls provoke on summon; clear it to reach the queen again.
  for (const shard of shards(s)) delete shard.provokeBuff;
  striker.stunTurns = 0; striker.attacked = false; striker.attacksUsed = 0;
  assert.ok(attackUnit(s, striker.unitId, q.unitId));
  assert.equal(s.boss.phase, 1);
  assert.equal(shards(s).length, grown, 'phase never re-enters');
  roundTrip(s);
}

// Corrupt boss state is rejected.
{
  const s = make();
  for (const bad of [{ ...s.boss, extra: 1 }, { ...s.boss, id: 'nope' }, { ...s.boss, marks: [{ x: 99, y: 0 }] }, { ...s.boss, phase: 5 }]) {
    assert.equal(validateMatch({ ...JSON.parse(JSON.stringify(s)), boss: bad }), false);
  }
}

// Boss code never calls Math.random (statically, and at runtime across full bot battles).
{
  assert.ok(!readFileSync(new URL('../dist/js/boss-mechanics.js', import.meta.url), 'utf8').includes('Math.random'));
  const original = Math.random;
  Math.random = () => { if (new Error().stack.includes('/js/boss-mechanics.js')) throw new Error('Math.random used by boss code'); return original(); };
  try {
    for (const heroId of [1, 101, 201, 301, 401, 501]) {
      const s = make(heroId);
      let n = 0;
      while (s.phase !== 'over' && n++ < 1500 && autoAct(s)) if (n % 25 === 0) assert.ok(validateMatch(s), `hero ${heroId} valid at action ${n}`);
      assert.ok(validateMatch(s));
    }
  } finally { Math.random = original; }
}
console.log('Boss mechanics passed: setup, telegraph resolve, shard growth, frost armor, shatter, single phase entry, corrupt-state rejection, seeded randomness.');
