/** Finite opening choice tree. No rerolls, progression, training or granted resources. */
declare const process: { env: Record<string, string | undefined> };
// @ts-expect-error Node host module; browser project has no Node types.
import { writeFileSync } from 'node:fs';
import { GENERALS } from '../src/core/data';
import { FATIGUE_BEAT, simulate } from '../src/core/engine';
import { addSwap, buildBattle, generalChoices, getOwned, hireMerc, moveSlot, newRun, reserveSlots, takeDraft, type RunState } from '../src/core/run';
import type { EnemyEntry, Slotted } from '../src/core/types';

const count = 100;
const candidate: (EnemyEntry | null)[] = [{ defId: 'e_skel', atk: 1, hp: 2 }, null, null, null, null];
const positions = [0, 1, 2, 3, 4, 5, 6, 7];
const clone = (r: RunState): RunState => structuredClone(r);
const roster = (r: RunState): Slotted[] => positions.map(i => getOwned(r, i)).filter((u): u is Slotted => !!u);
function permutations<T>(xs: T[]): T[][] {
  if (xs.length < 2) return [xs];
  return xs.flatMap((x, i) => permutations(xs.filter((_, j) => i !== j)).map(tail => [x, ...tail]));
}
function putOrder(r: RunState, order: Slotted[], reserve: Slotted | null) {
  const targets = [...order.map((u, i) => ({ u, to: i })), ...(reserve ? [{ u: reserve, to: 5 }] : [])];
  for (const { u, to } of targets) {
    const from = positions.find(i => getOwned(r, i)?.ownedId === u.ownedId);
    if (from === undefined) throw new Error('Lost owned unit');
    if (from !== to && moveSlot(r, from, to, 'swap') === 'invalid') throw new Error('Illegal deployment');
  }
  // Move any unwanted occupants out of compact field gaps, without selling anything.
  for (let i = order.length; i < 5; i++) if (getOwned(r, i)) {
    const empty = positions.find(j => j >= 5 && !getOwned(r, j));
    if (empty === undefined || moveSlot(r, i, empty, 'swap') === 'invalid') throw new Error('No legal reserve space');
  }
}
interface Outcome { cases: number; wins: number; draws: number; losses: number; faults: number; beforeFatigueWins: number; maxBeats: number; maxRounds: number; fatigueExamples: unknown[]; example?: unknown }
const empty = (): Outcome => ({ cases: 0, wins: 0, draws: 0, losses: 0, faults: 0, beforeFatigueWins: 0, maxBeats: 0, maxRounds: 0, fatigueExamples: [] });
function evaluate(r: RunState, fixture: (EnemyEntry | null)[], allowReserve: boolean): Outcome {
  const all = roster(r), out = empty();
  const reserveChoices: (Slotted | null)[] = [null, ...(allowReserve && reserveSlots(r) ? all : [])];
  const swaps: ([number, number] | null)[] = [null];
  if (r.general === 'reva') for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) {
    if (fixture[a] || fixture[b]) swaps.push([a, b]);
  }
  for (const reserve of reserveChoices) for (const order of permutations(all.filter(u => u !== reserve))) {
    if (!order.length) continue;
    for (const swap of swaps) {
      const prepared = clone(r);
      putOrder(prepared, order, reserve);
      if (swap && !addSwap(prepared, swap[0], swap[1])) throw new Error('Illegal Reva swap');
      const setup = { ...buildBattle(prepared), enemy: fixture, rules: [] };
      const result = simulate({ ...setup, record: false });
      out.cases++;
      out.maxBeats = Math.max(out.maxBeats, result.beats);
      out.maxRounds = Math.max(out.maxRounds, result.rounds ?? 0);
      if (result.fault) out.faults++;
      if (result.result === 'win' && !result.fault) {
        out.wins++;
        const fatigue = result.beats >= FATIGUE_BEAT && simulate({ ...setup, record: true }).log.some(x => x.ev.t === 'dmg' && x.ev.kind === 'fatigue');
        if (!fatigue) out.beforeFatigueWins++;
        else if (out.fatigueExamples.length < 2) out.fatigueExamples.push({ order: order.map(u => u.defId), copies: order.map(u => u.copies), reserve: reserve?.defId ?? null, swap, beats: result.beats, rounds: result.rounds });
        out.example ??= { order: order.map(u => u.defId), copies: order.map(u => u.copies), reserve: reserve?.defId ?? null, swap };
      } else if (result.result === 'draw') out.draws++;
      else out.losses++;
    }
  }
  return out;
}
const rows: unknown[] = [];
for (const general of GENERALS) {
  let accepted = 0;
  for (let index = 0; index < 30000 && accepted < count; index++) {
    const seed = 1000 + index * 7919;
    if (!generalChoices(seed).includes(general.id)) continue;
    accepted++;
    const initial = newRun(general.id, seed);
    if (initial.picks !== 2 || initial.draft.length !== 3) throw new Error('Opening contract changed');
    const fixtures = { current: [{ defId: 'e_golem', atk: 2, hp: 7, armor: 1 }, { defId: 'e_skel', atk: 2, hp: 4 }, null, null, null] as (EnemyEntry | null)[], candidate };
    const totals = { current: { normalProbability: 0, normalBeforeFatigueProbability: 0, any: false, anyBeforeFatigue: false, cases: 0, faults: 0, maxBeats: 0, maxRounds: 0 }, candidate: { normalProbability: 0, normalBeforeFatigueProbability: 0, any: false, anyBeforeFatigue: false, cases: 0, faults: 0, maxBeats: 0, maxRounds: 0 } };
    const paths: unknown[] = [];
    // Field placement is the normal path; first-card bench placement additionally audits legal offer changes.
    for (const firstOnBench of [false, true]) for (let first = 0; first < 3; first++) {
      const once = clone(initial), firstCard = once.draft[first];
      const firstAt = firstOnBench ? 5 : positions.find(i => i < 5 && !getOwned(once, i));
      if (firstAt === undefined || takeDraft(once, first, firstAt) === 'invalid') throw new Error('First recruit invalid');
      const secondOffers = [...once.draft];
      for (let second = 0; second < 3; second++) {
        const secondCard = secondOffers[second];
        const modes = firstCard === secondCard ? ['merge', 'separate'] as const : ['separate'] as const;
        for (const mode of modes) {
          const ready = clone(once);
          const secondAt = mode === 'merge' ? firstAt : positions.find(i => i < 5 && !getOwned(ready, i));
          if (secondAt === undefined || takeDraft(ready, second, secondAt) === 'invalid' || ready.picks !== 0) throw new Error('Second recruit invalid');
          if (general.id === 'hank' && !hireMerc(ready)) throw new Error('Free opening merc unavailable');
          const results: Record<string, unknown> = {};
          for (const name of ['current', 'candidate'] as const) {
            const normal = evaluate(ready, fixtures[name], false);
            const exhaustive = reserveSlots(ready) ? evaluate(ready, fixtures[name], true) : normal;
            const isNormal = !firstOnBench && (firstCard !== secondCard || mode === 'merge');
            const t = totals[name];
            if (isNormal) { t.normalProbability += normal.wins / normal.cases / 9; t.normalBeforeFatigueProbability += normal.beforeFatigueWins / normal.cases / 9; }
            t.any ||= exhaustive.wins > 0; t.anyBeforeFatigue ||= exhaustive.beforeFatigueWins > 0;
            t.maxBeats = Math.max(t.maxBeats, exhaustive.maxBeats); t.maxRounds = Math.max(t.maxRounds, exhaustive.maxRounds);
            t.cases += exhaustive.cases; t.faults += exhaustive.faults;
            results[name] = { ...exhaustive, normalCases: isNormal ? normal.cases : 0, normalWins: isNormal ? normal.wins : 0, normalBeforeFatigueWins: isNormal ? normal.beforeFatigueWins : 0 };
          }
          paths.push({ firstOnBench, first, second, cards: [firstCard, secondCard], secondOffers, mode, results });
        }
      }
    }
    rows.push({ general: general.id, seed, pool: initial.activeFactions, firstOffers: initial.draft, fixtures, totals, paths });
  }
  if (accepted !== count) throw new Error('Not enough legal opening seeds');
  console.log(JSON.stringify({ general: general.id, legalSeeds: accepted }));
}
writeFileSync(process.env.OUT!, JSON.stringify({ version: 'current core 0.8.2 opening only', seedsPerGeneral: count,
  policy: 'two real picks, second refreshed by takeDraft; no reroll/ads/selling/training/progression; compact permutations; legal duplicate merge/separate, first-card bench offer variation, Sajj reserve, Hank free merc, all Reva single swaps; draws not wins',
  normalPolicy: 'uniform first and refreshed second choices, duplicates auto-merge, uniform compact roster order, no reserve; Hank free merc included; Reva uniform legal single swaps including no swap', rows }, null, 2));
