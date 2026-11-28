import assert from 'node:assert/strict';
import { ExpeditionProgress } from '../dist/js/expedition-progress.js';
import { createExpeditionMatch } from '../dist/js/engine.js';
import { EXPEDITION_LEVELS } from '../dist/js/expedition-data.js';
import { battleRewardSummary } from '../dist/js/battle-reward-summary.js';

class Storage {
  data = new Map(); fail = false;
  getItem(k) { return this.data.get(k) ?? null; }
  removeItem(k) { this.data.delete(k); }
  setItem(k,v) { if(this.fail) throw Error('quota'); this.data.set(k,String(v)); }
}
const storage = new Storage(), progress = new ExpeditionProgress(storage);
function battle(id) {
  const state = progress.state;
  const match = createExpeditionMatch(id,state.training,state.squad,state.selectedHeroId,progress.getBattleLoadout());
  assert.ok(progress.saveBattle(match).ok);
  Object.assign(match,{phase:'over',winner:0,result:'win'});
  return match;
}
function summary(match,payout,error='') { return battleRewardSummary({match,payout:payout&&{...payout,runId:match.runId},profile:progress.state,error}); }
let cards = 0;
for (const level of EXPEDITION_LEVELS.slice(0,6)) {
  const match = battle(level.id);
  assert.equal(summary(match).status,'unsaved','frozen entitlement is not a payment');
  storage.fail = true;
  const failed = progress.settle(match);
  assert.equal(failed.ok,false);
  assert.deepEqual(summary(match,failed,failed.error).resources,[]);
  assert.deepEqual(summary(match,failed,failed.error).cards,[]);
  storage.fail = false;
  const payout = progress.settle(match), view = summary(match,payout);
  assert.equal(payout.ok,true);
  assert.equal(view.status,'saved');
  assert.equal(view.resources.find(r=>r.kind==='gold').amount,payout.amount);
  assert.equal(view.resources.find(r=>r.kind==='orb')?.amount??0,payout.tickets);
  assert.deepEqual(view.cards.map(c=>c.id),[...payout.unlocked.units,...payout.unlocked.spells]);
  cards += view.cards.length;
  const before = JSON.stringify(progress.state);
  const duplicate = progress.settle(match);
  assert.equal(duplicate.duplicate,true);
  assert.deepEqual(summary(match,duplicate).cards,[],'duplicate does not announce new cards');
  assert.equal(JSON.stringify(progress.state),before,'presentation and duplicate do not issue rewards');
  assert.deepEqual(summary({...match,winner:1},payout).resources,[]);
}
assert.ok(cards>0,'exercise actual newly granted cards');
const replay = battle(EXPEDITION_LEVELS[0].id), payout = progress.settle(replay);
assert.equal(payout.firstClear,false);
assert.deepEqual(summary(replay,payout).cards,[]);
assert.equal(summary(replay,payout).resources.some(r=>r.kind==='orb'),false);
assert.equal(battleRewardSummary({match:{mode:'challenge',phase:'over',winner:0}}),null);
console.log('Battle reward summary: saved receipts, card grants, failure/retry, duplicate, defeat, replay and trial passed.');
