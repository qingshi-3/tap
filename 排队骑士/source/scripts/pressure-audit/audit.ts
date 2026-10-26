// Read-only pressure audit: fixed mature player team, deterministic campaign and battle seeds.
// Run: npx vite-node scripts/pressure-audit/audit.ts
// @ts-ignore node builtins are available to vite-node scripts
import { mkdirSync, writeFileSync } from 'node:fs';
import { BOSSES, card } from '../../src/core/data';
import { simulate, type UnitSpec } from '../../src/core/engine';
import { bossMul, bossScaleOf, bossTeam, diffK, newRun, playerTeam, scaleTeam, settleBattle, type Enemy, type Owned, type RunState } from '../../src/core/run';

const CAMPAIGN_SEEDS = 600;
const BATTLE_SEEDS = 48;
const relics = ['r_share', 'r_rear', 'r_heavy'] as const;

function owned(def: string, copies: number, atk: number, hp: number, oid: number, ench?: string, undy = false): Owned {
  const d = card(def);
  return {
    oid, def, copies, atkBonus: atk - d.atk - copies + 1, hpBonus: hp - d.hp - copies + 1,
    ench: (ench ?? null) as Owned['ench'], tfx: undy ? ['undy'] : undefined,
  };
}

// Public end-of-run composition reconstructed from the completed journal/report.
const matureQueue: Owned[] = [
  owned('l_shield', 3, 50, 50, 1, 'b_lance', true),
  owned('d_dune', 3, 50, 50, 2, 'b_buckler', true),
  owned('v_sentinel', 1, 42, 50, 3, undefined, true),
  owned('v_keeper', 1, 50, 50, 4),
  owned('v_scout', 1, 29, 30, 5),
];

function fixture(seed: number, turn: number, wins: number): RunState {
  const r = newRun(seed, { diff: 1 });
  r.turn = turn; r.wins = wins; r.lives = 10; r.streak = 8; r.warm = false; r.chaos = 0;
  r.queue = structuredClone(matureQueue); r.relics = [...relics];
  r.enemy = { boss: null, units: [{ def: 'l_shield', lvl: 1, atk: 1, hp: 1 }] };
  r.branch = null; r.event = null; r.lastForm = null; r.eco = ['tank', 'summon', 'carry', 'snipe', 'mixed'];
  return r;
}

function advanceTo(seed: number, target: 15 | 16): RunState {
  const r = fixture(seed, target - 1, target === 15 ? 13 : 13);
  settleBattle(r, { result: target === 15 ? 'draw' : 'win', perm: {} });
  // Selection occurs during advance, before the new prep phase; then the player
  // buys the publicly recorded potion and shares it to the first three units.
  for (const o of r.queue.slice(0, 3)) if (o) o.tfx = ['undy'];
  return r;
}

function rate(team: UnitSpec[], enemy: UnitSpec[], salt: number) {
  let win = 0, draw = 0;
  for (let i = 0; i < BATTLE_SEEDS; i++) {
    const out = simulate(team, enemy, (salt * 104729 + i * 7919 + 17) & 0x7fffffff, [...relics]);
    if (out.result === 'win') win++; else if (out.result === 'draw') draw++;
  }
  return { win: win / BATTLE_SEEDS, score: (win + draw * 0.5) / BATTLE_SEEDS };
}

const sum = (t: UnitSpec[]) => t.reduce((s, u) => s + u.atk + u.hp, 0);
const capped = (t: UnitSpec[]) => t.reduce((s, u) => s + Number(u.atk === 50) + Number(u.hp === 50), 0);
type Pair = { seed: number; normal: Enemy; elite: Enemy; normalRate: number; eliteRate: number; prePrepNormalRate: number; prePrepEliteRate: number; eliteEasier: boolean; baseEliteTopRate: number };
const pairs: Pair[] = [];
let skippedEvent = 0, skippedNoElite = 0;
for (let i = 0; i < CAMPAIGN_SEEDS; i++) {
  const seed = i * 104729 + 23;
  const r = advanceTo(seed, 15);
  if (r.event) { skippedEvent++; continue; }
  const normal = r.branch?.find((e) => !e.elite?.length);
  const elite = r.branch?.find((e) => e.elite?.length);
  if (!normal || !elite) { skippedNoElite++; continue; }
  const team = playerTeam(r);
  const nr = rate(team, normal.units, i * 2).score;
  const er = rate(team, elite.units, i * 2).score;
  const prePrep = team.map((u) => ({ ...u, tfx: undefined }));
  const pnr = rate(prePrep, normal.units, i * 2).score;
  const per = rate(prePrep, elite.units, i * 2).score;
  const top = rate(team, scaleTeam(elite.units, 2.2), i * 2).score;
  pairs.push({ seed, normal, elite, normalRate: nr, eliteRate: er, prePrepNormalRate: pnr, prePrepEliteRate: per, eliteEasier: er > nr, baseEliteTopRate: top });
}

const bosses: { seed: number; rate: number; noPrepUndyingRate: number; budget: number; capSlots: number; extra22Rate: number; extra22CapSlots: number }[] = [];
let bossBaseline: UnitSpec[] = [];
let bossProduction: UnitSpec[] = [];
for (let i = 0; i < CAMPAIGN_SEEDS; i++) {
  const r = advanceTo(i * 13007 + 71, 16);
  const team = playerTeam(r), enemy = r.enemy.units;
  const noPrepUndying = team.map((u) => ({ ...u, tfx: undefined }));
  if (!bossBaseline.length) {
    bossBaseline = bossTeam(BOSSES.final, 16, bossMul(r, 'final') * diffK(r), bossScaleOf('final', 16));
    bossProduction = enemy;
  }
  bosses.push({ seed: i, rate: rate(team, enemy, i).score, noPrepUndyingRate: rate(noPrepUndying, enemy, i).score, budget: sum(enemy), capSlots: capped(enemy), extra22Rate: rate(team, scaleTeam(enemy, 2.2), i).score, extra22CapSlots: capped(scaleTeam(enemy, 2.2)) });
}

const bossAtMaxK2 = scaleTeam(bossBaseline, 2);
const productionEqualsMaxK2 = JSON.stringify(bossProduction) === JSON.stringify(bossAtMaxK2);

const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))];
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const dist = (xs: number[]) => ({ n: xs.length, mean: avg(xs), p10: q(xs, .1), median: q(xs, .5), p90: q(xs, .9), alwaysWin: xs.filter((x) => x === 1).length / xs.length });
const normalRates = pairs.map((x) => x.normalRate), eliteRates = pairs.map((x) => x.eliteRate);
const result = {
  revision: '88a987d',
  method: { campaignSeeds: CAMPAIGN_SEEDS, battleSeedsPerEnemy: BATTLE_SEEDS, difficulty: 'hard', turn: 15, player: playerTeam(fixture(1, 15, 13)), relics, temporaryUndying: 'first three units, applied after enemy generation as in prep', exclusions: { skippedEvent, skippedNoElite }, score: 'win=1 draw=.5 loss=0' },
  turn15: {
    comparablePairs: pairs.length,
    normalPlayerScore: dist(normalRates), elitePlayerScore: dist(eliteRates),
    eliteEasierFraction: pairs.filter((x) => x.eliteEasier).length / pairs.length,
    eliteAtLeast25ppEasier: pairs.filter((x) => x.eliteRate - x.normalRate >= .25).length / pairs.length,
    prePrepNormalPlayerScore: dist(pairs.map((x) => x.prePrepNormalRate)),
    prePrepElitePlayerScore: dist(pairs.map((x) => x.prePrepEliteRate)),
    prePrepEliteEasierFraction: pairs.filter((x) => x.prePrepEliteRate > x.prePrepNormalRate).length / pairs.length,
    eliteLowerPanelBudgetFraction: pairs.filter((x) => sum(x.elite.units) < sum(x.normal.units)).length / pairs.length,
    elitePanelBudget: { mean: avg(pairs.map((x) => sum(x.elite.units))), p10: q(pairs.map((x) => sum(x.elite.units)), .1), p90: q(pairs.map((x) => sum(x.elite.units)), .9) },
    normalPanelBudget: { mean: avg(pairs.map((x) => sum(x.normal.units))), p10: q(pairs.map((x) => sum(x.normal.units)), .1), p90: q(pairs.map((x) => sum(x.normal.units)), .9) },
    eliteStillAboveTargetAt22: pairs.filter((x) => x.baseEliteTopRate > .38).length / pairs.length,
    eliteTopScore: dist(pairs.map((x) => x.baseEliteTopRate)),
  },
  finalBoss: {
    baseline: { panelBudget: sum(bossBaseline), units: bossBaseline },
    productionLift: { configuredMaxK: 2, equalsScaleTeamBaselineAtMaxK: productionEqualsMaxK2, scaleTeamBaselineAtMaxK: bossAtMaxK2 },
    productionUnits: bossProduction,
    playerScore: dist(bosses.map((x) => x.rate)), noPrepUndyingPlayerScore: dist(bosses.map((x) => x.noPrepUndyingRate)), panelBudget: { mean: avg(bosses.map((x) => x.budget)), min: q(bosses.map((x) => x.budget), 0), max: q(bosses.map((x) => x.budget), .999) },
    cappedStatSlotsOf10: { mean: avg(bosses.map((x) => x.capSlots)), min: q(bosses.map((x) => x.capSlots), 0), max: q(bosses.map((x) => x.capSlots), .999) },
    extra22AfterProductionScore: dist(bosses.map((x) => x.extra22Rate)), extra22AfterProductionCappedSlots: { mean: avg(bosses.map((x) => x.extra22CapSlots)), min: q(bosses.map((x) => x.extra22CapSlots), 0), max: q(bosses.map((x) => x.extra22CapSlots), .999) },
  },
  caveats: ['This is engine simulation, not human play.', 'The mature team is a controlled reconstruction from public end-of-run snapshots, not hidden live state.', 'The T15 fixture intentionally fixes eco, streak, warm and lives, and borrows the T16 end-state roster to stress-test a T15 branch; it is not a natural-run frequency estimate.', 'Each paired normal/elite comparison uses the exact same deterministic battle seeds.', 'Temporary undying is intentionally held constant to isolate enemy pressure; economy, shop decisions and replacement incentives are not simulated.', 'The extra 2.2 scaling is applied after the production Boss has already been lifted; it is not the production lift cap and is not a proposed balance change.'],
};

mkdirSync(new URL('../../output/pressure-audit/', import.meta.url), { recursive: true });
writeFileSync(new URL('../../output/pressure-audit/results.json', import.meta.url), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
