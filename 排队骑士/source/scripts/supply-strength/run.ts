// Fixed-team final-boss ablation reconstructed from the public T16 journal.
// Run all: npx vite-node scripts/supply-strength/run.ts
// Append only the 64-seed naked isolation to an existing result: add --naked-only
// @ts-ignore node builtins are available to vite-node scripts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { simulate, type BattleOut, type UnitSpec } from '../../src/core/engine';

const N = 4096;
const NAKED_N = 64;
const relics = ['r_share', 'r_rear', 'r_heavy'] as const;

// Journal T16 visible stats and source IDs. `plate` and `thunder` are the final
// supplies bought immediately before the boss; first three `undy` instances are
// the shared potion. o_grail remains equipped in every feature ablation.
const actual: UnitSpec[] = [
  { def: 'l_shield', lvl: 2, atk: 50, hp: 50, oid: 1, ench: 'b_lance', tfx: ['undy', 'plate'] },
  { def: 'd_dune', lvl: 2, atk: 50, hp: 50, oid: 2, ench: 'b_buckler', tfx: ['undy'] },
  { def: 'v_sentinel', lvl: 1, atk: 42, hp: 50, oid: 3, tfx: ['undy'] },
  { def: 'v_keeper', lvl: 1, atk: 50, hp: 50, oid: 4, ench: 'o_grail' },
  { def: 'v_scout', lvl: 1, atk: 29, hp: 30, oid: 5, tfx: ['thunder'] },
];

// Exact visible boss line. The front's 3 opening block in the journal fixes
// e_shield at level 2; the encounter is authored as one common level.
const boss: UnitSpec[] = [
  { def: 'e_shield', lvl: 2, atk: 12, hp: 50 },
  { def: 'e_twin', lvl: 2, atk: 30, hp: 36 },
  { def: 'e_void', lvl: 2, atk: 36, hp: 50 },
  { def: 'e_pyre', lvl: 2, atk: 36, hp: 24 },
  { def: 'e_tomb', lvl: 2, atk: 18, hp: 42 },
];

type Feature = 'baseline' | 'no_shared_undying' | 'no_lance' | 'no_shared_undying_or_lance';
type Body = 'observed' | 'cap40_diagnostic';

function team(feature: Feature, body: Body): UnitSpec[] {
  const out = structuredClone(actual);
  const removeUndying = feature === 'no_shared_undying' || feature === 'no_shared_undying_or_lance';
  const removeLance = feature === 'no_lance' || feature === 'no_shared_undying_or_lance';
  if (removeUndying) {
    for (let i = 0; i < 3; i++) out[i].tfx = out[i].tfx?.filter((x) => x !== 'undy');
  }
  if (removeLance) out[0].ench = null;
  // Transparent late-growth diagnostic: reduce only observed stats above 40.
  // This does not claim a historical shop path; all identities and effects stay fixed.
  if (body === 'cap40_diagnostic') for (const u of out) {
    u.atk = Math.min(u.atk, 40);
    u.hp = Math.min(u.hp, 40);
  }
  return out;
}

function finalFriendlyHp(out: BattleOut) {
  const side = new Map(out.init.map((u) => [u.uid, u.side]));
  const hp = new Map(out.init.map((u) => [u.uid, u.hp]));
  const dead = new Set<number>();
  for (const e of out.events) {
    if (e.t === 'dmg') hp.set(e.tgt, e.hp);
    else if (e.t === 'heal') hp.set(e.tgt, e.hp);
    else if (e.t === 'buff') hp.set(e.tgt, e.nowHp);
    else if (e.t === 'die') dead.add(e.uid);
    else if (e.t === 'summon') { side.set(e.unit.uid, e.unit.side); hp.set(e.unit.uid, e.unit.hp); }
  }
  return [...hp].filter(([uid, value]) => side.get(uid) === 0 && !dead.has(uid) && value > 0).map(([, value]) => value);
}

function summarize(feature: Feature, body: Body, sampleCount = N, stripAllMechanics = false) {
  const player = team(feature, body).map((u) => stripAllMechanics ? { ...u, ench: null, tfx: undefined } : u);
  const activeRelics = stripAllMechanics ? [] : relics;
  const counts = { win: 0, draw: 0, lose: 0 };
  const survivors: number[] = [], hp: number[] = [], clashes: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const out = simulate(player, boss, (i * 104729 + 17) & 0x7fffffff, activeRelics);
    counts[out.result]++;
    const aliveHp = finalFriendlyHp(out);
    survivors.push(aliveHp.length);
    hp.push(aliveHp.reduce((a, b) => a + b, 0));
    clashes.push(out.events.filter((e) => e.t === 'clash').length);
  }
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
  const pct = (xs: number[], p: number) => sorted(xs)[Math.min(xs.length - 1, Math.floor(xs.length * p))];
  return {
    feature, body, samples: sampleCount, player, relics: activeRelics, counts,
    rates: { win: counts.win / sampleCount, draw: counts.draw / sampleCount, lose: counts.lose / sampleCount },
    pressure: {
      averageFriendlySurvivors: avg(survivors), p10FriendlySurvivors: pct(survivors, .1),
      averageRemainingFriendlyHp: avg(hp), p10RemainingFriendlyHp: pct(hp, .1),
      averageClashes: avg(clashes), p90Clashes: pct(clashes, .9),
    },
  };
}

const features: Feature[] = ['baseline', 'no_shared_undying', 'no_lance', 'no_shared_undying_or_lance'];
const bodies: Body[] = ['observed', 'cap40_diagnostic'];
const dir = new URL('../../output/supply-strength/', import.meta.url);
const outputFile = new URL('results.json', dir);
const nakedOnly = (globalThis as unknown as { process?: { argv?: string[] } }).process?.argv?.includes('--naked-only') ?? false;
const previous = nakedOnly && existsSync(outputFile) ? JSON.parse(readFileSync(outputFile, 'utf8')) : null;
const result = {
  revision: '88a987d',
  method: {
    samplesPerCondition: N, seedFormula: '(i * 104729 + 17) & 0x7fffffff',
    fixedEnemy: boss, relics,
    interpretation: 'Fixed final-team ablation, not a natural clear-rate or economy simulation.',
    noSharedUndying: 'Removes only the T16 potion shared to slots 1-3; o_grail remains on slot 4.',
    cap40Diagnostic: 'Caps only player attack/health above 40 after reconstruction. It is a transparent pressure sensitivity check, not a claimed counterfactual history.',
  },
  conditions: previous?.conditions ?? bodies.flatMap((body) => features.map((feature) => summarize(feature, body))),
  nakedBodyIsolation: bodies.map((body) => summarize('baseline', body, NAKED_N, true)),
  observedGrowthEvidence: {
    milestones: [
      { turn: 7, core: { shield: [23, 23], dune: [16, 15], keeper: [10, 10] } },
      { turn: 9, team: [[40, 44], [29, 30], [6, 10], [21, 26], [5, 6]], totalAttack: 101, totalHealth: 116, totalStats: 217 },
      { turn: 12, team: [[48, 50], [46, 50], [26, 34], [44, 50], [16, 17]] },
      { turn: 16, team: [[50, 50], [50, 50], [42, 50], [50, 50], [29, 30]] },
    ],
    documentedMultipliers: [
      'r_share made the first eligible single-target supply feed three adjacent units.',
      'v_keeper granted permanent +1/+1 to each physical neighbor whenever it ate (level-1 journal composition).',
      'v_scout granted +1 health per eater, turning multi-target/shared supplies into repeated team health.',
      'Free milk added another eater trigger each prep from T8 onward; sushi/dragon meat fed all five and stew fed two.',
    ],
    warning: 'Milestones and trigger descriptions are factual journal/source evidence; they are not a reconstructed no-platter alternate history.',
  },
};

mkdirSync(dir, { recursive: true });
writeFileSync(outputFile, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
