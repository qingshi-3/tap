import { card } from '../../src/core/data';
import { authoredEncounters } from '../../src/core/encounters';
import { simulate, type UnitSpec } from '../../src/core/engine';
import { load, newRun, reroll, save, settleBattle, useFood, type RunState } from '../../src/core/run';

declare const process: { exitCode?: number };

let passed = 0;
const failures: string[] = [];
const check = (ok: boolean, message: string) => ok ? passed++ : failures.push(message);
const budgetOf = (units: UnitSpec[]) => units.reduce((n, u) => n + u.atk + u.hp, 0);

for (const turn of [1, 8, 9, 11, 12, 14, 15, 16, 17, 18]) for (const budget of [10, 11, 83, 108, 193, 499, 500]) {
  const all = authoredEncounters(turn, budget);
  check(all.length === (turn < 9 ? 0 : turn < 12 ? 4 : 8), `T${turn} template count=${all.length}`);
  for (const encounter of all) {
    check(budgetOf(encounter.units) === budget, `T${turn}/${encounter.key} budget=${budgetOf(encounter.units)} expected=${budget}`);
    check(encounter.units.every((u) => u.atk >= 1 && u.atk <= 50 && u.hp >= 1 && u.hp <= 50), `T${turn}/${encounter.key} stat bounds`);
    check(encounter.units.every((u) => u.lvl === (turn >= 17 ? 2 : 1)), `T${turn}/${encounter.key} level`);
    check(encounter.units.every((u) => card(u.def).tier <= Math.min(6, Math.ceil(turn / 2))), `T${turn}/${encounter.key} unlock tier`);
  }
}

const expected: Record<string, string[]> = {
  'hurt-mid': ['l_windblade','l_vigil','l_warden','l_storm','l_caliber'],
  'summon-mid': ['a_chanter','m_rex','m_mankator','m_bloodcaller','a_engulf'],
  'wall-mid': ['a_chanter','l_shield','s_dancer','a_ritualist','s_hunter'],
  'rush-mid': ['l_knight','s_step','s_dancer','s_hunter','s_viper'],
  'hurt-late': ['l_windblade','l_vigil','l_warden','l_storm','d_worm'],
  'summon-late': ['m_rex','m_mankator','a_matriarch','m_bloodcaller','m_heart'],
  'snipe-late': ['a_chanter','s_master','s_viper','s_lord','l_archon'],
  'boom-late': ['a_graveguard','a_chanter','a_nightmare','a_engulf','a_matriarch'],
};
for (const encounter of authoredEncounters(12, 180))
  check(encounter.units.map((u) => u.def).join(',') === expected[encounter.key].join(','), `${encounter.key} fixed order`);

// Replace the designated amplifier with a prep-only card while preserving its exact stats.
// Across three seeds, the authored amplifier must actually trigger and the blank control must not.
const amplifier: Record<string, number> = {
  'hurt-mid': 3, 'summon-mid': 3, 'wall-mid': 2, 'rush-mid': 1,
  'hurt-late': 3, 'summon-late': 3, 'snipe-late': 4, 'boom-late': 3,
};
const foes = Array.from({ length: 5 }, (): UnitSpec => ({ def: 'l_shield', lvl: 1, atk: 22, hp: 50 }));
for (const encounter of authoredEncounters(15, 180)) for (const seed of [7, 31, 97]) {
  const index = amplifier[encounter.key];
  const control = encounter.units.map((u, i) => i === index ? { ...u, def: 'd_onyx' } : { ...u });
  const actual = simulate(encounter.units, foes, seed), blank = simulate(control, foes, seed);
  const actualUid = actual.init[index].uid, blankUid = blank.init[index].uid;
  const actualTriggers = actual.events.filter((e) => e.t === 'trigger' && e.uid === actualUid).length;
  const blankTriggers = blank.events.filter((e) => e.t === 'trigger' && e.uid === blankUid).length;
  check(actualTriggers > blankTriggers, `${encounter.key}/seed${seed} amplifier triggers ${actualTriggers} <= blank ${blankTriggers}`);
}

const advanceTo = (r: RunState, turn: number) => {
  while (r.turn < turn) settleBattle(r, { result: 'draw', perm: {} });
};
const snapshotEnemy = (r: RunState) => JSON.stringify({ enemy: r.enemy, branch: r.branch });

// Real run generation: early turns never carry authored metadata; later seeded runs do.
for (let seed = 1; seed <= 20; seed++) {
  const r = newRun(seed);
  while (r.turn <= 8) {
    check(!r.enemy.encounter && !r.branch?.some((e) => e.encounter), `seed${seed}/T${r.turn} injected authored encounter early`);
    settleBattle(r, { result: 'draw', perm: {} });
  }
}

const found = new Map<number, RunState>();
for (let seed = 1; seed <= 200 && found.size < 3; seed++) {
  // T12 itself is the fixed Forge boss; T13 is the first generated fight using the T12+ pool.
  for (const turn of [9, 13, 15]) {
    if (found.has(turn)) continue;
    const r = newRun(seed);
    advanceTo(r, turn);
    const visible = [r.enemy, ...(r.branch ?? [])].find((e) => e.encounter);
    if (!visible?.encounter) continue;
    r.enemy = structuredClone(visible);
    r.branch = null;
    found.set(turn, r);
  }
}
for (const turn of [9, 13, 15]) {
  const r = found.get(turn);
  check(!!r, `no authored encounter generated at T${turn} in seeds 1..200`);
  if (!r?.enemy.encounter) continue;
  const template = authoredEncounters(turn, 100).find((x) => x.key === r.enemy.encounter!.key);
  check(r.enemy.units.map((u) => u.def).join(',') === template?.units.map((u) => u.def).join(','), `T${turn}/${r.enemy.encounter.key} order changed by tidy`);

  const beforeReroll = snapshotEnemy(r);
  reroll(r);
  check(snapshotEnemy(r) === beforeReroll, `T${turn} reroll changed displayed enemy`);

  r.queue[0] = { oid: 9000 + turn, def: 'l_shield', copies: 1, atkBonus: 0, hpBonus: 0, foodHistory: [] };
  const food = r.shop.find((s) => s.kind === 'food');
  if (food) {
    const beforeFood = snapshotEnemy(r);
    useFood(r, food.sid, 0);
    check(snapshotEnemy(r) === beforeFood, `T${turn} useFood changed displayed enemy`);
  }
}

// Save/load round-trip retains authored metadata and the already generated lineup.
const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value); },
  removeItem: (key: string) => { memory.delete(key); },
} });
const saved = found.get(15);
if (saved) {
  const before = snapshotEnemy(saved);
  save(saved);
  const restored = load();
  check(!!restored, 'authored run failed save/load round-trip');
  check(!!restored && snapshotEnemy(restored) === before, 'save/load changed authored enemy metadata or units');
}

console.log(JSON.stringify({ passed, failed: failures.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;

