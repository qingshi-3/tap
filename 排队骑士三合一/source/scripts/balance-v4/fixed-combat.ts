// Fixed-composition regression and sensitivity checks for balance-v4 relic/undying changes.
// This intentionally bypasses shop/economy so combat atoms are compared without bot policy noise.
// @ts-ignore node builtin
import { mkdirSync, writeFileSync } from 'node:fs';
import { simulate as candidateSim, type UnitSpec } from '../../src/core/engine';
import { simulate as baselineSim } from './baseline/engine';
import { newRun as candidateRun, useFood as candidateUseFood, type Owned, type RunState } from '../../src/core/run';
import { newRun as baselineRun, useFood as baselineUseFood } from './baseline/run';

type Sim = typeof candidateSim;
type Out = ReturnType<Sim>;
type Ev = Out['events'][number];
let checks = 0;
function assert(ok: unknown, message: string): asserts ok {
  checks++;
  if (!ok) throw new Error(message);
}
const unit = (atk: number, hp: number, extra: Partial<UnitSpec> = {}): UnitSpec =>
  ({ def: 'd_artificer', lvl: 1, atk, hp, ...extra });
const buffs = (out: Out, uid: number) => out.events.filter((e): e is Extract<Ev, { t: 'buff' }> => e.t === 'buff' && e.tgt === uid);
const tags = (out: Out, label: string) => out.events.filter((e) => e.t === 'trigger' && e.label === label);
const run = (sim: Sim, left: UnitSpec[], right: UnitSpec[], relics: string[]) => sim(left, right, 1701, relics);

function legacy(sim: Sim) {
  const out = run(sim, [unit(50, 1), unit(5, 40)], [unit(1, 200)], ['r_legacy']);
  const grant = buffs(out, 2).find((e) => e.atk > 0)?.atk ?? 0;
  return { grant, result: out.result };
}

function loneGrail(sim: Sim) {
  const out = run(sim, [unit(2, 8, { ench: 'o_grail' })], [unit(99, 99)], ['r_lone']);
  const loneBuffs = buffs(out, 1).filter((e) => e.atk > 0 && e.hp > 0);
  return {
    loneTriggers: tags(out, '独狼').length,
    loneBuffs: loneBuffs.map((e) => [e.atk, e.hp]),
    undyingTriggers: tags(out, '不屈').length,
    exhaustions: tags(out, '不屈耗尽').length,
    result: out.result,
  };
}

function heavy(sim: Sim, frontHp: number) {
  const out = run(sim, [unit(3, frontHp), unit(10, 40)], [unit(1, 200)], ['r_heavy']);
  const frontHpBuff = buffs(out, 1).filter((e) => e.hp !== 0).map((e) => e.hp);
  const rearAtkBuff = buffs(out, 2).filter((e) => e.atk !== 0).map((e) => e.atk);
  return { frontHpBuff, rearAtkBuff };
}

function undyingDuration(sim: Sim) {
  const out = run(sim, [unit(1, 4, { ax: ['undying'] })], [unit(99, 99)], []);
  const start = out.events.findIndex((e) => e.t === 'trigger' && e.label === '不屈');
  const end = out.events.findIndex((e) => e.t === 'trigger' && e.label === '不屈耗尽');
  return {
    triggers: tags(out, '不屈').length,
    exhaustion: tags(out, '不屈耗尽').length,
    // The lethal clash event is emitted immediately before the undying trigger.
    clashesFromTriggerThroughExhaustion: 1 + out.events.slice(start, end + 1).filter((e) => e.t === 'clash').length,
  };
}

function dedupe(sim: Sim) {
  const plain = run(sim, [unit(1, 4, { ax: ['undying'] })], [unit(99, 99)], []);
  const repeated = run(sim, [unit(1, 4, { ench: 'b_banner', ax: ['undying'], tfx: ['undy'] })], [unit(99, 99)], []);
  const signature = (out: Out) => ({
    undying: tags(out, '不屈').length,
    exhaustion: tags(out, '不屈耗尽').length,
    result: out.result,
    damageEvents: out.events.filter((e) => e.t === 'dmg').map((e) => [e.tgt, e.hp]),
  });
  return { plain: signature(plain), repeated: signature(repeated) };
}

function legacySharedUndyingCombatFixture(sim: Sim) {
  // Sensitivity fixture for the OLD plate rule, where an undying potion reached three units.
  // This is intentionally not a claim about the v4 production plate rule.
  const out = run(sim, [
    unit(1, 4, { tfx: ['undy'] }),
    unit(1, 4, { tfx: ['undy'], ench: 'b_banner' }),
    unit(1, 4, { tfx: ['undy'], ax: ['undying'] }),
  ], [unit(99, 99), unit(99, 99), unit(99, 99)], []);
  return {
    initialUndyingAtoms: out.init.slice(0, 3).map((u) => u.ax?.filter((a) => a === 'undying').length ?? 0),
    undyingTriggers: tags(out, '不屈').length,
  };
}

function plateUndyingIntegration(newRun: (seed: number) => any, useFood: (r: any, sid: number, slot: number | null) => any) {
  const owned = (oid: number): Owned => ({ def: 'd_artificer', oid, copies: 1, atkBonus: 0, hpBonus: 0, foodHistory: [] });
  const r = newRun(440042) as RunState;
  r.gold = 100; r.relics = ['r_share']; r.queue = [owned(101), owned(102), owned(103), null, null];
  r.shop = [{ sid: 9001, kind: 'food', def: 'f_undy', locked: false, free: false }];
  const result = useFood(r as any, 9001, 1);
  return { ok: result.ok, tfx: r.queue.slice(0, 3).map((o) => o?.tfx ?? []), shareUsed: r.tc.shareUsed ?? false };
}

function grailChargeProbe(sim: Sim) {
  const out = run(sim, [unit(1, 4, { ench: 'o_grail' })], [unit(99, 99)], []);
  return { undyingTriggers: tags(out, '不屈').length, exhaustions: tags(out, '不屈耗尽').length, result: out.result };
}

function grailStackingProbe(sim: Sim) {
  const probe = (extra: Partial<UnitSpec>, relics: string[] = []) => {
    const out = run(sim, [unit(1, 4, { ench: 'o_grail', ...extra })], [unit(99, 99)], relics);
    return { triggers: tags(out, '不屈').length, exhaustions: tags(out, '不屈耗尽').length };
  };
  return { grail: probe({}), grailAndPotion: probe({ tfx: ['undy'] }), grailAndLone: probe({}, ['r_lone']) };
}

const baseline = {
  legacy: legacy(baselineSim), loneGrail: loneGrail(baselineSim), heavy50: heavy(baselineSim, 50),
  heavy30: heavy(baselineSim, 30), undyingDuration: undyingDuration(baselineSim),
  dedupe: dedupe(baselineSim), legacySharedUndying: legacySharedUndyingCombatFixture(baselineSim),
  plateUndyingIntegration: plateUndyingIntegration(baselineRun, baselineUseFood), grailChargeProbe: grailChargeProbe(baselineSim),
  grailStacking: grailStackingProbe(baselineSim),
};
const candidate = {
  legacy: legacy(candidateSim), loneGrail: loneGrail(candidateSim), heavy50: heavy(candidateSim, 50),
  heavy30: heavy(candidateSim, 30), undyingDuration: undyingDuration(candidateSim),
  dedupe: dedupe(candidateSim), legacySharedUndying: legacySharedUndyingCombatFixture(candidateSim),
  plateUndyingIntegration: plateUndyingIntegration(candidateRun, candidateUseFood), grailChargeProbe: grailChargeProbe(candidateSim),
  grailStacking: grailStackingProbe(candidateSim),
};

assert(baseline.legacy.grant === 25 && candidate.legacy.grant === 10, 'legacy must change 50 attack inheritance from +25 to capped +10');
assert(candidate.loneGrail.loneTriggers === 1, 'lone relic must trigger exactly once');
assert(JSON.stringify(candidate.loneGrail.loneBuffs) === '[[6,6]]', 'lone relic must grant +6/+6 exactly once');
assert(baseline.loneGrail.undyingTriggers === 1 && candidate.loneGrail.undyingTriggers === 2, 'grail contract repair must change observable cycles from one to two');
assert(candidate.loneGrail.exhaustions === 2, 'lone plus grail must exhaust exactly two cycles');
assert(candidate.heavy50.frontHpBuff.length === 0 && candidate.heavy50.rearAtkBuff.length === 0, 'heavy at 50 hp must neither add hp nor penalize rear attack');
assert(JSON.stringify(candidate.heavy30.frontHpBuff) === '[15]' && JSON.stringify(candidate.heavy30.rearAtkBuff) === '[-1]', 'heavy 30 hp must become 45 and penalize rear attack');
assert(candidate.undyingDuration.clashesFromTriggerThroughExhaustion === 2, 'undying must cover two clashes including the lethal trigger clash');
assert(JSON.stringify(candidate.dedupe.plain) === JSON.stringify(candidate.dedupe.repeated), 'repeated equipment/supply/ax undying sources must deduplicate');
assert(candidate.legacySharedUndying.initialUndyingAtoms.every((n) => n === 1), 'legacy three-unit undying fixture must give each affected unit exactly one undying atom');
assert(JSON.stringify(baseline.plateUndyingIntegration.tfx) === '[["undy"],["undy"],["undy"]]' && baseline.plateUndyingIntegration.shareUsed, 'baseline plate must share undying to three units');
assert(JSON.stringify(candidate.plateUndyingIntegration.tfx) === '[[],["undy"],[]]' && !candidate.plateUndyingIntegration.shareUsed, 'v4 plate must leave undying on its selected target only');
assert(candidate.grailStacking.grail.triggers === 2 && candidate.grailStacking.grail.exhaustions === 2, 'grail must provide exactly two undying cycles');
assert(JSON.stringify(candidate.grailStacking.grailAndPotion) === JSON.stringify(candidate.grailStacking.grail), 'undying potion must not stack a third charge onto grail');
assert(JSON.stringify(candidate.grailStacking.grailAndLone) === JSON.stringify(candidate.grailStacking.grail), 'lone relic must not stack a third charge onto grail');

const result = { schemaVersion: 1, checks, baseline, candidate,
  notes: [
    'Fixed combat isolates engine behavior; it does not estimate shop frequency or economy.',
    'legacySharedUndying is explicitly an old-rule three-unit sensitivity fixture, not the v4 production sharing-plate behavior.',
    'plateUndyingIntegration calls production/frozen useFood: baseline shares f_undy to three units, while v4 correctly applies it only to the selected target and does not consume the plate share.',
    'The candidate repairs a pre-existing o_grail bug: baseline discards its second charge at first exhaustion, while candidate produces exactly two cycles (up to four clashes). This is an orange-equipment strength increase.',
    'Neither an undying potion nor the lone relic adds a third grail cycle.',
  ] };
const dir = new URL('../../output/balance-v4/', import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL('fixed-combat.json', dir), JSON.stringify(result, null, 2));
console.log(`BALANCE_V4_FIXED_COMBAT_OK ${checks} assertions`);
