import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  ADVENTURE_LEVELS,
  ADVENTURE_CHAPTERS,
  ADVENTURE_CARDS,
  ADVENTURE_CARD_IDS,
  getAdventureDefinition,
} from "../dist/js/adventure-content.js";
import {
  EXPEDITION_LEVELS,
  EXPEDITION_CHAPTERS,
} from "../dist/js/expedition-data.js";
import { getEnemyPlan, validateEnemyPlan } from "../dist/js/enemy-plans.js";
import { CARD_ACQUISITION } from "../dist/js/campaign-content.js";
import { EFFECT_MANIFEST } from "../dist/js/effect-manifest.js";
const historicalPrefixes = [
  "border",
  "road",
  "banners",
  "sand",
  "shadow",
  "frost",
  "crossroads",
  "citadel",
  "ruins",
  "confluence",
];
assert.deepEqual(
  EXPEDITION_LEVELS.slice(0, 30).map((l) => l.id),
  historicalPrefixes.flatMap((prefix) =>
    [1, 2, 3].map((n) => `${prefix}-${String(n).padStart(2, "0")}`),
  ),
  "Original 30 IDs and order must remain fixed",
);
for (const level of EXPEDITION_LEVELS.slice(0, 30))
  assert.ok(
    validateEnemyPlan(getEnemyPlan(level.id, 3), level.id),
    `Historical plan rejected ${level.id}`,
  );
assert.equal(EXPEDITION_LEVELS.length, 48);
assert.equal(EXPEDITION_CHAPTERS.length, 16);
assert.equal(ADVENTURE_LEVELS.length, 18);
assert.equal(ADVENTURE_CHAPTERS.length, 6);
assert.deepEqual(
  EXPEDITION_LEVELS.slice(30).map((l) => l.id),
  ADVENTURE_LEVELS.map((l) => l.id),
);
assert.equal(new Set(EXPEDITION_LEVELS.map((l) => l.id)).size, 48);
assert.equal(ADVENTURE_CARD_IDS.length, 15);
for (const card of Object.values(ADVENTURE_CARDS)) {
  assert.ok(
    EFFECT_MANIFEST.bodies[card.spriteFrom],
    `Missing existing body ${card.id}`,
  );
  assert.ok(
    !CARD_ACQUISITION.some((c) => c.id === card.id),
    `Adventure unit entered collectible roster: ${card.id}`,
  );
}
for (const ch of ADVENTURE_CHAPTERS) {
  assert.equal(ch.levelIds.length, 3);
  assert.ok(existsSync(new URL("../dist/" + ch.image, import.meta.url)));
}
let bosses = 0,
  first = 0,
  repeat = 0;
for (const l of ADVENTURE_LEVELS) {
  const d = getAdventureDefinition(l.id),
    plan = getEnemyPlan(l.id, 3),
    p = plan.players[1];
  assert.ok(validateEnemyPlan(plan, l.id));
  assert.deepEqual(p.deck, l.enemyDecks[1]);
  assert.equal(l.columns, 11);
  assert.equal(l.rows, 7);
  assert.equal(l.mana, 5);
  assert.ok(d.allies.length >= 1 && d.allies.length <= 3);
  assert.equal(d.version, 1);
  assert.equal(d.revision, 1);
  assert.equal(p.openingHandSize, 4);
  assert.equal(p.manaCap, 8);
  assert.equal(p.deployLimit, 2);
  assert.equal(p.unitLimit, 8);
  const cells = new Set(),
    walls = new Set(
      l.tiles.filter((t) => t.type === "wall").map((t) => `${t.x},${t.y}`),
    );
  for (const pos of [l.playerStart, ...d.allies, ...d.sources, ...l.enemies]) {
    const k = `${pos.x},${pos.y}`;
    assert.ok(pos.x >= 0 && pos.x < 11 && pos.y >= 0 && pos.y < 7);
    assert.ok(!cells.has(k), `Overlap ${l.id} ${k}`);
    assert.ok(!walls.has(k));
    cells.add(k);
  }
  for (const mutate of [
    (q) => q.players[1].deck.push(9201),
    (q) => (q.adventureRevision = 2),
    (q) => (q.players[1].deployLimit = 3),
    (q) => q.players[1].garrison.push({ ...q.players[1].garrison[0] }),
    (q) => (q.players[1].generalId = 9201),
  ]) {
    const bad = structuredClone(plan);
    mutate(bad);
    assert.equal(validateEnemyPlan(bad, l.id), false);
  }
  const copy = getEnemyPlan(l.id, 3);
  copy.players[1].deck.pop();
  assert.deepEqual(
    getEnemyPlan(l.id, 3),
    plan,
    "Plan must be independently frozen per match",
  );
  if (l.boss) {
    bosses++;
    assert.ok(d.boss);
    assert.equal(d.boss.threshold, p.generalHealth / 2);
  }
  first += l.reward.first;
  repeat += l.reward.repeat;
}
assert.equal(bosses, 6);
assert.equal(first, 6360);
assert.equal(first + 6 * 60, 6720);
assert.equal(first + 5 * repeat + 6 * 6 * 60, 15570);
assert.equal(getAdventureDefinition("border-01"), null);
console.log(
  JSON.stringify({
    levels: 18,
    chapters: 6,
    bosses,
    cards: 15,
    firstCoins: first,
    repeatCoins: repeat,
    allFactionCoins: 15570,
    checks:
      "catalogue, plans, malformed plans, bodies, layouts, rewards, independent copies",
  }),
);
