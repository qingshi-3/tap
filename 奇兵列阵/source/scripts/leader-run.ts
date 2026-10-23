declare const process: { env: Record<string, string | undefined> };
// @ts-expect-error Node host module; browser project has no Node types.
import { readFileSync, writeFileSync } from 'node:fs';
import { GENERALS } from '../src/core/data';
import { simulate, FATIGUE_BEAT } from '../src/core/engine';
import { allOwned, applyResult, buildBattle, currentNode, generalChoices, newRun, screen } from '../src/core/run';
import { forkLeader, newPolicyAudit, prepareLeader, promoteLeader, recruitLeader, rewardLeader, shopLeader, type LeaderPolicy } from './leader-policy';
import { measureLeaderBattle } from './leader-diagnostics';

interface SeedRow { general: string; seed: number }
const source = JSON.parse(readFileSync(process.env.SEED_INPUT!, 'utf8')) as { rows: SeedRow[] };
const samples = Number(process.env.LEADER_SAMPLES ?? 10);
const rows: unknown[] = [], admissions: unknown[] = [], boundaries: unknown[] = [];
for (const general of GENERALS) {
  const seeds = [...new Set(source.rows.filter(r => r.general === general.id).map(r => r.seed))].slice(0, samples);
  if (seeds.length !== samples) throw new Error(`Insufficient fixed seeds for ${general.id}`);
  for (const [seedIndex, seed] of seeds.entries()) {
    const legal = generalChoices(seed).includes(general.id);
    admissions.push({ general: general.id, seed, legal });
    if (!legal) throw new Error(`Illegal paired seed: ${general.id}/${seed}`);
    for (const policy of ['A', 'B'] as LeaderPolicy[]) {
      const r = newRun(general.id, seed), audit = newPolicyAudit(), battles: unknown[] = [], attempts: Record<string, number> = {};
      const initialResources = { gold: r.gold, stash: { ...r.stash }, owned: allOwned(r).filter(Boolean).map(u => u!.defId), picks: r.picks };
      let guard = 0, consecutiveBossDraws = 0, status = 'finished', traces = 0;
      while (!r.over && guard++ < 400) {
        const phase = screen(r);
        if (phase === 'promo') { promoteLeader(r, policy, audit); continue; }
        if (phase === 'reward') { rewardLeader(r, policy, audit); continue; }
        if (phase === 'shop') { shopLeader(r, policy, audit); continue; }
        if (phase === 'fork') { forkLeader(r, policy, audit); continue; }
        recruitLeader(r, policy, audit);
        prepareLeader(r, policy, audit);
        const owned = allOwned(r).filter(Boolean);
        if (r.gold < 0 || Object.values(r.stash).some(n => n < 0) || owned.some(u => ![1, 2, 4].includes(u!.copies)) || new Set(owned.map(u => u!.ownedId)).size !== owned.length || r.slots.length !== 5 || r.bench.length !== 3) throw new Error(`Policy state invariant failed ${general.id}/${policy}/${seed}`);
        const setup = buildBattle(r), node = currentNode(r), key = `${r.chapter + 1}-${r.node + 1}`;
        const attempt = attempts[key] = (attempts[key] ?? 0) + 1;
        const out = simulate({ ...setup, record: false });
        const firstBoundary = seedIndex === 0 && node.kind === 'boss' && attempt === 1 && traces < 2;
        const record = firstBoundary || out.beats >= FATIGUE_BEAT || !!out.fault;
        const detailed = record ? simulate({ ...setup, record: true }) : out;
        if (detailed.result !== out.result || detailed.beats !== out.beats) throw new Error('Recorded boundary replay changed combat');
        const fatigue = record && detailed.log.some(x => x.ev.t === 'dmg' && x.ev.kind === 'fatigue');
        const observation = measureLeaderBattle(r, setup, detailed);
        const eggBefore = r.eggStats ? { ...r.eggStats } : null;
        const points = Object.fromEntries(allOwned(r).filter(Boolean).flatMap(u => Object.entries(u!.train ?? {})).reduce((acc, [type, n]) => acc.set(type, (acc.get(type) ?? 0) + (n ?? 0)), new Map<string, number>()));
        const battle = { key, kind: node.kind, attempt, name: node.name, result: out.result, beats: out.beats, rounds: out.rounds,
          fatigue, firstFour: r.chapter === 0 && [0, 1, 2, 4].includes(r.node), livesBefore: r.lives, goldBefore: r.gold,
          trainedPoints: points, generalPower: r.genPower, unusedPoints: { ...r.stash }, observation,
          passives: [...r.passives], eggBefore, hatchAfterBattle: null as string | null, livesAfter: r.lives };
        if (firstBoundary || out.fault) {
          boundaries.push({ general: general.id, policy, seed, key, attempt, setup, observation, log: detailed.log });
          traces++;
        }
        battles.push(battle);
        if (out.fault) { status = 'combat-fault'; break; }
        if (node.kind === 'boss' && out.result === 'draw') {
          if (++consecutiveBossDraws >= 3) { status = 'censored-three-boss-draws'; break; }
        } else consecutiveBossDraws = 0;
        applyResult(r, out.result, out.gold ?? 0, out.eggStats);
        battle.hatchAfterBattle = r.lastHatch ?? null;
        battle.livesAfter = r.lives;
      }
      if (guard >= 400 && !r.over) status = 'phase-guard';
      rows.push({ general: general.id, policy, seed, pool: [...r.activeFactions], wins: r.wins, clear: r.over === 'victory', over: r.over, status,
        initialResources, finalGold: r.gold, finalStash: r.stash, battles, audit });
    }
  }
  console.log(JSON.stringify({ general: general.id, policies: 2, seeds: samples }));
}
writeFileSync(process.env.LEADER_OUT!, JSON.stringify({ policyVersion: 'leader-visible-v1', core: process.env.LEADER_CORE_LABEL,
  legalSeedInput: process.env.SEED_INPUT, samplesPerGeneralPerPolicy: samples,
  constraints: 'real APIs, no simulated outcome in policy selection, no ads or passive/resource injection, only recorded boundaries', admissions, rows }, null, 2));
writeFileSync(process.env.LEADER_TRACE_OUT!, JSON.stringify({ policyVersion: 'leader-visible-v1', boundaries }, null, 2));
