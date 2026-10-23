/** Paired legal-seed, real-draft balance audit. No ads, injected cards or resources. */
declare const process: { env: Record<string, string | undefined> };
// @ts-expect-error Node host module; browser project has no Node types.
import { writeFileSync } from 'node:fs';
import { GENERALS } from '../src/core/data';
import { GENERAL_MAP } from '../src/core/content';
import { DRAGON_OF, generalChoices, newRun } from '../src/core/run';
import { playRun, type Strategy } from './simlib';

const baseDisrupt = GENERAL_MAP.reva.text.includes('被调动') && GENERAL_MAP.reva.text.includes('−1');
if (process.env.AUDIT_LABEL === 'final' && !baseDisrupt) throw new Error('Final Reva base disruption not detected');
if (process.env.AUDIT_LABEL === 'baseline-v2' && baseDisrupt) throw new Error('Frozen baseline unexpectedly has Reva base disruption');
const count = Number(process.env.SAMPLES ?? 50);
const rows: unknown[] = [];
for (const g of GENERALS) {
  let accepted = 0;
  for (let index = 0; index < 20000 && accepted < count; index++) {
    const seed = 1000 + index * 7919;
    if (!generalChoices(seed).includes(g.id)) continue;
    accepted++;
    const pool = newRun(g.id, seed).activeFactions.join('+');
    for (const strategy of ['steady', 'synergy'] as Strategy[]) {
      const attempts: Record<string, number> = {};
      const battles: Record<string, unknown>[] = [];
      let previousPassives = '';
      const run = playRun({ general: g.id, seed, strategy, requireLegalGeneral: true,
        onBattle: (r, _setup, out, node) => {
          const key = `${r.chapter + 1}-${r.node + 1}`;
          const attempt = attempts[key] = (attempts[key] ?? 0) + 1;
          const passives = r.passives.join('+');
          battles.push({ key, kind: node.kind, attempt, result: out.result, beats: out.beats,
            firstBattle: battles.length === 0, firstBossAttempt: node.kind === 'boss' && attempt === 1,
            passives, firstBattleAfterPassive: passives !== previousPassives && !!passives,
            eggStats: r.eggStats ? { ...r.eggStats } : null,
            eggs: [...r.slots, ...r.bench].filter(u => u?.defId === 'x_egg').length,
            dragons: [...r.slots, ...r.bench].filter(u => u && Object.values(DRAGON_OF).includes(u.defId)).length,
            lastHatch: r.lastHatch ?? null, faults: out.fault ?? null });
          previousPassives = passives;
        }, onSettled: r => {
          const last = battles[battles.length - 1];
          last.hatchAfterBattle = r.lastHatch ?? null;
          last.eggStatsAfterBattle = r.eggStats ? { ...r.eggStats } : null;
          last.pendingEggsAfterBattle = (r as unknown as { pendingEggs?: number }).pendingEggs ?? 0;
        } });
      rows.push({ general: g.id, seed, pool, strategy, wins: run.wins, clear: run.clear,
        stopped: !run.r.over, faults: run.faults, battles });
    }
  }
  if (accepted !== count) throw new Error(`Insufficient legal seeds: ${g.id}`);
}
const data = { strategyMetadata: { version: 'visible-v2', revaBaseDisrupt: baseDisrupt, revaPublicText: GENERAL_MAP.reva.text, decisionChange: 'same heuristic reads visible skill contract; new base disruption changes legal swap preference' }, core: process.env.CORE_LABEL ?? 'current', samplesPerGeneral: count,
  policy: 'legal generalChoices seeds; real draft and economy; no rewarded retry; boss rematches separate; three consecutive draws censored', rows };
writeFileSync(process.env.OUT ?? 'balance-results.json', JSON.stringify(data, null, 2));
console.log(JSON.stringify({ core: data.core, samplesPerGeneral: count, runs: rows.length }));
