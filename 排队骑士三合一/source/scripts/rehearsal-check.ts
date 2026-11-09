import { createRehearsal } from '../src/core/rehearsal';
import { adSaveHeart, AD_RETRY_MAX, buy, endTurn, fight, moveOwned, newRun, sell, settleBattle, trialFight, useFood, type RunState } from '../src/core/run';

function check(ok: unknown, label: string): asserts ok { if (!ok) throw new Error(label); }
const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let storageCalls = 0;
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem() { storageCalls++; return null; }, setItem() { storageCalls++; }, removeItem() { storageCalls++; }, clear() { storageCalls++; },
} });

function lostBattle(sameUnits = false) {
  const before = newRun(6432);
  before.queue[0] = { oid: before.nextId++, def: 'a_imp', copies: 1, atkBonus: 1, hpBonus: 2,
    ench: 'w_sword', tmpAtk: 1, foodHistory: [{ id: 'f_bread', atk: 1, hp: 1, sourceId: 87 }] };
  before.queue[1] = { oid: before.nextId++, def: sameUnits ? 'a_imp' : 'a_spine', copies: 1, atkBonus: 0, hpBonus: 0 };
  before.bag = ['w_mail'];
  before.shop = [
    { sid: before.nextId++, kind: 'unit' as const, def: 'a_spine', locked: false, free: false },
    { sid: before.nextId++, kind: 'food' as const, def: 'f_bread', locked: false, free: false },
  ];
  before.enemy = { boss: null, units: [{ def: 'e_guardian', lvl: 1, atk: 50, hp: 100 }] };
  const settled = structuredClone(before);
  endTurn(settled);
  const out = fight(settled);
  check(out.result === 'lose', 'fixture must lose using real combat');
  settleBattle(settled, out);
  return { before, settled, result: out.result };
}

const { before, settled, result } = lostBattle();
const savedBefore = JSON.stringify(before), savedSettled = JSON.stringify(settled);
const session = createRehearsal(settled, before, result);
check(session.settled === settled && session.working !== before, 'original result identity and isolated working copy');
check(session.canRetry(), 'original loss can retry');
const w = session.working;
check(moveOwned(w, 0, 1), 'real positioning swaps different units');
check(moveOwned(w, 1, 3), 'real positioning moves into an empty slot');
const expected = structuredClone(before);
[expected.queue[0], expected.queue[1], expected.queue[3]] = [before.queue[1], before.queue[3], before.queue[0]];
expected.adRetry = 1;
const workingSnapshot = JSON.stringify(w);
trialFight(w);
check(JSON.stringify(w) === workingSnapshot, 'trial must not mutate working copy');
check(JSON.stringify(before) === savedBefore && JSON.stringify(settled) === savedSettled, 'positioning and trial leave snapshots unchanged');

// Even bypassing the UI can only carry original unit positions into the retry.
check(useFood(w, w.shop[1].sid, 3).ok, 'food mutation fixture uses real rule');
w.gold = 999;
w.bag = ['shroom', 'w_helm'];
w.shop.length = 0;
w.nextId = 9000;
w.enemy.units[0].hp = 1;
w.lives = 999;
w.adRetry = -100;
const edited = w.queue[3]!;
edited.def = 'a_spine';
edited.copies = 6;
edited.atkBonus = 999;
edited.hpBonus = 999;
edited.tmpAtk = 999;
edited.ench = 'shroom';
edited.foodHistory![0].atk = 999;
const abandoned = createRehearsal(settled, before, result);
check(sell(abandoned.working, 0), 'real selling in disposable copy');
check(JSON.stringify(settled) === savedSettled, 'discarded copy cannot leak');
check(session.commitRetry() === settled, 'commit returns the original formal reference');
check(JSON.stringify(settled) === JSON.stringify(expected), 'commit preserves the entire original snapshot except positions and retry charge');
const committedSnapshot = JSON.stringify(settled);
edited.foodHistory![0].hp = 999;
check(JSON.stringify(settled) === committedSnapshot, 'committed units do not alias mutable working units');
check(!session.canRetry() && session.commitRetry() === null && JSON.stringify(settled) === committedSnapshot, 'commit cannot charge twice');
check(!abandoned.canRetry() && abandoned.commitRetry() === null, 'a stale session cannot commit after the original loss is cleared');

function rejectsRosterChange(label: string, mutate: (r: RunState) => void, sameUnits = false) {
  const fixture = lostBattle(sameUnits);
  const session = createRehearsal(fixture.settled, fixture.before, 'lose');
  const snapshot = JSON.stringify(fixture.settled);
  mutate(session.working);
  check(session.commitRetry() === null && JSON.stringify(fixture.settled) === snapshot, `${label} is rejected without charge or state change`);
  session.working.queue = structuredClone(fixture.before.queue);
  check(session.commitRetry()?.adRetry === 1, `${label} rejection does not consume session`);
}
rejectsRosterChange('purchase', r => check(buy(r, r.shop[0].sid, 2).ok, 'real purchase'));
rejectsRosterChange('sale', r => check(sell(r, 0), 'real sale'));
rejectsRosterChange('merge', r => check(moveOwned(r, 0, 1)?.merged, 'real merge'), true);
rejectsRosterChange('duplicate unit', r => { r.queue[2] = structuredClone(r.queue[0]); });
rejectsRosterChange('replacement identity', r => { r.queue[0]!.oid = r.nextId++; });
rejectsRosterChange('extra slot', r => { r.queue.push(null); });
rejectsRosterChange('missing slot', r => { r.queue.pop(); });

const identical = lostBattle(true);
const sameSession = createRehearsal(identical.settled, identical.before, 'lose');
[sameSession.working.queue[0], sameSession.working.queue[1]] = [sameSession.working.queue[1], sameSession.working.queue[0]];
check(sameSession.commitRetry()?.queue[0]?.oid === identical.before.queue[1]?.oid, 'same-definition units can exchange positions without merging');

const isolated = lostBattle();
const originalSnapshot = JSON.stringify({ ...isolated.before, adRetry: 1 });
const isolatedSession = createRehearsal(isolated.settled, isolated.before, 'lose');
isolated.before.gold = 1234;
isolated.before.queue[0]!.foodHistory![0].atk = 1234;
check(JSON.stringify(isolatedSession.commitRetry()) === originalSnapshot, 'private snapshot remains unchanged when its caller mutates the source');

for (const blockedResult of ['win', 'draw'] as const) {
  const fixture = lostBattle();
  const blocked = createRehearsal(fixture.settled, fixture.before, blockedResult);
  const snapshot = JSON.stringify(fixture.settled);
  check(!blocked.canRetry() && blocked.commitRetry() === null && JSON.stringify(fixture.settled) === snapshot, `${blockedResult} must never retry`);
}
const capped = lostBattle();
capped.settled.adRetry = AD_RETRY_MAX;
check(createRehearsal(capped.settled, capped.before, 'lose').commitRetry() === null, 'existing retry maximum is enforced');
const last = lostBattle();
last.settled.adRetry = AD_RETRY_MAX - 1;
check(createRehearsal(last.settled, last.before, 'lose').commitRetry()?.adRetry === AD_RETRY_MAX, 'last permitted retry uses the existing limit');
const protectedLoss = lostBattle();
const protectedSession = createRehearsal(protectedLoss.settled, protectedLoss.before, 'lose');
check(adSaveHeart(protectedLoss.settled), 'real heart protection');
check(!protectedSession.canRetry() && protectedSession.commitRetry() === null, 'heart protection invalidates retry even after adjustment opened');
check(storageCalls === 0, 'adjustment, trial, and retry core never access player save');
if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
else Reflect.deleteProperty(globalThis, 'localStorage');
console.log('Rehearsal check passed: positions-only commit, isolated trial, original economy/stats/equipment preserved, invalid rosters rejected without charge, same-unit swap, retry limits, heart protection, duplicate/stale rejection, no save access.');
