// Same-seed balance-v4 comparison. Never change strategy/enemies between labels.
// Usage: vite-node scripts/balance-v4/run.ts baseline|after|no-authored [N]
// @ts-ignore node builtin
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
// @ts-ignore node builtin
import { createHash } from 'node:crypto';
// @ts-ignore node builtin
import { execFileSync } from 'node:child_process';

type Stage = 'early' | 'mid' | 'late';
type Group = { id: string; diff: 0 | 1; strategy: 'strong' | 'mixed'; line?: string };
const GROUPS: Group[] = [
  { id: 'hard-mix', diff: 1, strategy: 'strong' },
  { id: 'hard-food', diff: 1, strategy: 'strong', line: 'food' },
  { id: 'hard-hurt', diff: 1, strategy: 'strong', line: 'hurt' },
  { id: 'hard-grow', diff: 1, strategy: 'strong', line: 'grow' },
  { id: 'hard-death', diff: 1, strategy: 'strong', line: 'death' },
  { id: 'hard-start', diff: 1, strategy: 'strong', line: 'start' },
  { id: 'normal-mixed', diff: 0, strategy: 'mixed' },
];
const CHECKPOINTS = new Set([6, 8, 10, 12, 15]);
// Abilities whose rules live entirely in prep/economy. Hybrids such as egg/parrot are excluded.
const PREP_ONLY_AB = new Set(['bluebird', 'backstab', 'tfish', 'beaver', 'giraffe', 'fish', 'buffalo', 'penguin', 'monkey', 'dragon',
  'ladybug', 'tabby', 'rabbit', 'worm', 'seal', 'cow', 'sauropod', 'rhyno', 'cat', 'wyvern']);
const CANDIDATE_B: Record<string, [number, number]> = {
  l_caliber: [7, 11], l_knight: [7, 9], s_hunter: [7, 7], a_chanter: [5, 8], a_cult: [7, 7],
  m_rex: [3, 5], v_keeper: [4, 8], v_sentinel: [6, 8], d_dunecaster: [7, 7], d_hourglass: [4, 7],
  l_storm: [9, 11], s_viper: [10, 6], s_master: [6, 9], a_engulf: [7, 9], m_bloodcaller: [6, 8],
  m_mankator: [8, 6], v_bear: [7, 10], v_rhyno: [7, 8], d_goldob: [4, 8], d_pharaoh: [7, 7],
  l_archon: [7, 8], s_lord: [12, 7], a_matriarch: [8, 10], a_nightmare: [7, 14], m_titan: [9, 9],
  m_heart: [9, 12], v_queen: [7, 9], v_wyvern: [8, 11], d_onyx: [8, 11], d_worm: [9, 16],
};
const argv = (globalThis as any).process.argv.slice(2);
const label = argv[0];
if (label !== 'baseline' && label !== 'after' && label !== 'candidate-b' && label !== 'no-authored') throw new Error('label must be baseline, after, candidate-b, or no-authored');
const N = Number(argv[1] ?? 80);
if (!Number.isInteger(N) || N <= 0) throw new Error('N must be a positive integer');
const MAX_TURN = 40;

const sha256 = (path: URL) => createHash('sha256').update(readFileSync(path)).digest('hex');
if (label === 'baseline') {
  const manifest = JSON.parse(readFileSync(new URL('./baseline/manifest.json', import.meta.url), 'utf8'));
  for (const [name, entry] of Object.entries(manifest.files) as [string, any][]) {
    const actual = sha256(new URL(`./baseline/${name}`, import.meta.url));
    if (actual !== entry.frozenSha256) throw new Error(`Frozen baseline changed: ${name} expected ${entry.frozenSha256}, got ${actual}`);
  }
}

const runMod: any = label === 'baseline' ? await import('./baseline/run') : label === 'no-authored' ? await import('./candidate-no-authored/run') : await import('../../src/core/run');
const botMod: any = label === 'baseline' ? await import('./baseline/bot') : label === 'no-authored' ? await import('./candidate-no-authored/bot') : await import('../bot');
const dataMod: any = label === 'baseline' ? await import('./baseline/data') : label === 'no-authored' ? await import('./candidate-no-authored/data') : await import('../../src/core/data');
const { newRun, playerTeam, fight, settleBattle } = runMod;
const { shopTurn } = botMod;
const { card } = dataMod;
if (label === 'candidate-b') {
  for (const [id, [atk, hp]] of Object.entries(CANDIDATE_B)) Object.assign(card(id), { atk, hp });
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const stageOf = (turn: number): Stage => turn <= 4 ? 'early' : turn <= 10 ? 'mid' : 'late';
const wilson95 = (successes: number, total: number): [number, number] => {
  if (!total) return [0, 0];
  const z = 1.959963984540054, p = successes / total, den = 1 + z * z / total;
  const mid = (p + z * z / (2 * total)) / den;
  const half = z * Math.sqrt((p * (1 - p) + z * z / (4 * total)) / total) / den;
  return [mid - half, mid + half];
};
function play(group: Group, index: number) {
  const seed = index * 104729 + 11;
  const randomSeed = (seed ^ 0xa341316c) >>> 0;
  const strategySeed = (seed ^ 0xc8013ea4) >>> 0;
  const botRandom = mulberry32(randomSeed), strategyRandom = mulberry32(strategySeed);
  const originalRandom = Math.random;
  const encounters: any[] = [];
  let r: any;
  let replacements = 0, foodUses = 0, equipmentChanges = 0, relicPicks = 0;
  Math.random = botRandom;
  try {
    r = newRun(seed, { diff: group.diff });
    while (r.phase === 'prep' && r.turn <= MAX_TURN) {
      const before = new Map(r.queue.filter(Boolean).filter((o: any) => !o.merc).map((o: any) => [o.oid, o.def]));
      const beforeEquipment = new Map(r.queue.filter(Boolean).map((o: any) => [o.oid, o.ench ?? null]));
      const beforeRelics = new Set(r.relics);
      const skill = group.strategy === 'mixed' && strategyRandom() < 0.3 ? -0.01 : 1;
      shopTurn(r, skill, group.line);
      const afterIds = new Set(r.queue.filter(Boolean).map((o: any) => o.oid));
      replacements += [...before.keys()].filter((oid) => !afterIds.has(oid)).length;
      equipmentChanges += r.queue.filter(Boolean).filter((o: any) => o.ench && beforeEquipment.get(o.oid) !== o.ench).length;
      relicPicks += r.relics.filter((id: string) => !beforeRelics.has(id)).length;
      foodUses += r.tc.foods;
      const us = playerTeam(r);
      const tiers = { t4: 0, t5: 0, t6: 0 };
      for (const o of r.queue.filter(Boolean)) {
        const tier = card(o.def).tier;
        if (tier >= 4) (tiers as any)[`t${tier}`]++;
      }
      const stats = us.reduce((s: any, u: any) => ({ atk: s.atk + u.atk, hp: s.hp + u.hp, units: s.units + 1 }), { atk: 0, hp: 0, units: 0 });
      const playerDefs = r.queue.filter(Boolean).map((o: any) => card(o.def));
      const prepOnlySlots = playerDefs.filter((d: any) => PREP_ONLY_AB.has(d.ab ?? '')).length;
      const turn = r.turn, out = fight(r);
      encounters.push({ turn, stage: stageOf(turn), result: out.result, ...stats, ...tiers,
        checkpoint: CHECKPOINTS.has(turn), foodUses: r.tc.foods,
        equipment: r.queue.filter(Boolean).map((o: any) => o.ench).filter(Boolean), relics: [...r.relics],
        prepOnlySlots, authoredEncounter: r.enemy.encounter?.key ?? null });
      settleBattle(r, out);
    }
  } finally { Math.random = originalRandom; }
  return { index, seed, randomSeed, strategySeed, terminalPhase: r.phase, terminalTurn: r.turn,
    cleared: r.phase === 'won', hitTurnCap: r.phase === 'prep' && r.turn > MAX_TURN,
    replacements, foodUses, equipmentChanges, relicPicks, encounters };
}

function avg(xs: number[]) { return xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : null; }
function summarize(runs: any[]) {
  const cleared = runs.filter((r) => r.cleared).length;
  const stages = (['early', 'mid', 'late'] as Stage[]).map((stage) => {
    const es = runs.flatMap((r) => r.encounters.filter((e: any) => e.stage === stage));
    const wins = es.filter((e: any) => e.result === 'win').length;
    return { stage, turns: stage === 'early' ? '1-4' : stage === 'mid' ? '5-10' : '11+',
      reachedRuns: runs.filter((r) => r.encounters.some((e: any) => e.stage === stage)).length,
      encounters: es.length, wins, winRate: es.length ? wins / es.length : 0,
      draws: es.filter((e: any) => e.result === 'draw').length,
      avgAtk: avg(es.map((e: any) => e.atk)), avgHp: avg(es.map((e: any) => e.hp)), avgUnits: avg(es.map((e: any) => e.units)) };
  });
  const checkpoints = [...CHECKPOINTS].map((turn) => {
    const es = runs.flatMap((r) => r.encounters.filter((e: any) => e.turn === turn));
    return { turn, reachedRuns: es.length, avgAtk: avg(es.map((e: any) => e.atk)), avgHp: avg(es.map((e: any) => e.hp)),
      avgUnits: avg(es.map((e: any) => e.units)), avgTier4Slots: avg(es.map((e: any) => e.t4)),
      avgTier5Slots: avg(es.map((e: any) => e.t5)), avgTier6Slots: avg(es.map((e: any) => e.t6)) };
  });
  const meanTurn = avg(runs.map((r) => r.terminalTurn))!;
  const t9 = runs.flatMap((r) => r.encounters.filter((e: any) => e.turn >= 9));
  const authored = t9.filter((e: any) => e.authoredEncounter);
  return { runs: runs.length, cleared, clearRate: cleared / runs.length, clearWilson95: wilson95(cleared, runs.length),
    avgTerminalTurn: meanTurn,
    terminalTurnSd: Math.sqrt(runs.reduce((s, r) => s + (r.terminalTurn - meanTurn) ** 2, 0) / Math.max(1, runs.length - 1)),
    hitTurnCap: runs.filter((r) => r.hitTurnCap).length,
    avgReplacements: avg(runs.map((r) => r.replacements)), avgFoodUses: avg(runs.map((r) => r.foodUses)),
    equipmentCoverage: {
      runsWithEquippedBattle: runs.filter((r) => r.encounters.some((e: any) => e.equipment.length)).length,
      battleAppearances: runs.flatMap((r) => r.encounters).filter((e: any) => e.equipment.length).length,
      assignmentsOrUpgrades: runs.reduce((s, r) => s + r.equipmentChanges, 0),
      ids: [...new Set(runs.flatMap((r) => r.encounters.flatMap((e: any) => e.equipment)))].sort()
    },
    relicCoverage: {
      runsWithRelicBattle: runs.filter((r) => r.encounters.some((e: any) => e.relics.length)).length,
      battleAppearances: runs.flatMap((r) => r.encounters).filter((e: any) => e.relics.length).length,
      picks: runs.reduce((s, r) => s + r.relicPicks, 0),
      ids: [...new Set(runs.flatMap((r) => r.encounters.flatMap((e: any) => e.relics)))].sort()
    },
    t9PlusCoverage: {
      encounters: t9.length,
      playerSlots: t9.reduce((s, e) => s + e.units, 0),
      prepOnlySlots: t9.reduce((s, e) => s + e.prepOnlySlots, 0),
      prepOnlySlotRate: t9.reduce((s, e) => s + e.units, 0) ? t9.reduce((s, e) => s + e.prepOnlySlots, 0) / t9.reduce((s, e) => s + e.units, 0) : 0,
      authoredEncounters: authored.length,
      authoredEncounterRate: t9.length ? authored.length / t9.length : 0,
      authoredKeys: Object.fromEntries([...new Set(authored.map((e: any) => e.authoredEncounter))].sort().map((key) => [key, authored.filter((e: any) => e.authoredEncounter === key).length]))
    }, stages, checkpoints };
}

const repo = new URL('../../../', import.meta.url);
const sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
const strategyFile = label === 'baseline' ? new URL('./baseline/bot.ts', import.meta.url) : label === 'no-authored' ? new URL('./candidate-no-authored/bot.ts', import.meta.url) : new URL('../bot.ts', import.meta.url);
const sourceFiles = label === 'baseline'
  ? { run: './baseline/run.ts', data: './baseline/data.ts', engine: './baseline/engine.ts', battleStats: './baseline/battleStats.ts', ghosts: './baseline/ghosts.json' }
  : label === 'no-authored'
  ? { run: './candidate-no-authored/run.ts', data: './candidate-no-authored/data.ts', engine: './candidate-no-authored/engine.ts', battleStats: './candidate-no-authored/battleStats.ts', ghosts: './candidate-no-authored/ghosts.json', encounters: './candidate-no-authored/encounters.ts' }
  : { run: '../../src/core/run.ts', data: '../../src/core/data.ts', engine: '../../src/core/engine.ts', battleStats: '../../src/core/battleStats.ts', ghosts: '../../src/core/ghosts.json', encounters: '../../src/core/encounters.ts' };
const results = GROUPS.map((group) => {
  const runs = Array.from({ length: N }, (_, i) => play(group, i));
  const summary = summarize(runs);
  console.log(`${group.id}: clear=${(summary.clearRate * 100).toFixed(1)}% avgTurn=${summary.avgTerminalTurn.toFixed(2)}`);
  return { group, summary, runs };
});
const output = { schemaVersion: 2, label, generatedAt: new Date().toISOString(), sourceHead,
  source: { strategySha256: sha256(strategyFile), baselineManifest: './baseline/manifest.json',
    moduleSha256: Object.fromEntries(Object.entries(sourceFiles).map(([name, path]) => [name, sha256(new URL(path, import.meta.url))])),
    runtimeOverride: label === 'candidate-b' ? {
      reason: 'Candidate A increased overall strength too much across groups; calibrate tier 4-6 bodies without targeting a fixed win rate.',
      sha256: createHash('sha256').update(JSON.stringify(CANDIDATE_B)).digest('hex'), values: CANDIDATE_B
    } : null },
  config: { nPerGroup: N, maxTurn: MAX_TURN, seedFormula: 'i * 104729 + 11', checkpoints: [...CHECKPOINTS], stages: { early: '1-4', mid: '5-10', late: '11+' },
    strategy: 'hard groups use frozen strong bot; normal-mixed independently chooses weak skill=-0.01 on 30% of turns; unchanged shopTurn behavior',
    measurementNotes: {
      replacements: 'Count of non-mercenary owned oids present before shopTurn but absent afterward. Rare event-driven removals may be included.',
      foodUses: 'Sum of authoritative per-turn RunState.tc.foods after shopTurn.',
      equipmentCoverage: 'Exact equipped ids observed at battle entry plus per-oid enchant changes caused during shopTurn; this proves bot assignment/upgrade coverage but is not an equipment-value policy score.',
      relicCoverage: 'Exact RunState.relic ids observed at battle entry plus newly added ids during shopTurn; relic effects are passed to simulate by the frozen run module.',
      prepOnlySlots: 'T9+ player slots whose card ability is classified as prep/economy-only by PREP_ONLY_AB; egg and parrot are treated as combat-capable hybrids.',
      authoredEncounters: 'T9+ battles whose authoritative Enemy.encounter metadata contains an authored template key.',
      foodSpend: 'Not collected: current state has no food-only gold ledger, and net gold cannot distinguish rerolls, unit buys, sales, free milk, and food purchases reliably.'
    } }, groups: results };
const dir = new URL('../../output/balance-v4/', import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL(`${label}.json`, dir), JSON.stringify(output, null, 2));
