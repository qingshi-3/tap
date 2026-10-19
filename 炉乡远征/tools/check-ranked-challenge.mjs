import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {RankedChallengeSession,RANKED_CHALLENGE,RANKED_CHALLENGE_KEY,rankedChallengeScore} from '../dist/js/ranked-challenge.js';
import {createExpeditionMatch,confirmMulligan,toggleMulligan,replaceHandCard,autoAct,validateMatch,challengeContext,simulateAttackUnit,attackPositions,restoreMatch,playCard,summonPositions,getBattleCard} from '../dist/js/engine.js';
class Storage {
  data=new Map([['ordinary-player-archive','untouched']]);fail=false;
  getItem(key){return this.data.get(key)??null;}
  setItem(key,value){if(this.fail)throw new Error('quota exceeded');this.data.set(key,value);}
}
function start(storage=new Storage()) {
  const session=new RankedChallengeSession({storage}),created=session.createAttempt();
  assert(created.ok,created.error);assert(session.owns(created.match));assert(session.hasResume);
  assert(validateMatch(created.match));return {storage,session,match:created.match};
}
const shape=match=>{const result=structuredClone(match);delete result.runId;return result;};
const randomBefore=Math.random;
const a=start(),b=start();assert.deepEqual(shape(a.match),shape(b.match));assert.equal(Math.random,randomBefore);
const reverse=new RankedChallengeSession({storage:new Storage()}).createAttempt([...RANKED_CHALLENGE.initialDeck].reverse());assert(reverse.ok);assert.deepEqual(shape(a.match),shape(reverse.match),'equal multisets ignore editing order');
assert.equal(challengeContext(createExpeditionMatch('road-03')),null,'ordinary engine remains unbound');
for(const target of [a,b]){
  toggleMulligan(target.match,0);assert(confirmMulligan(target.match));
  assert(replaceHandCard(target.match,0));assert(validateMatch(target.match));
}
assert.deepEqual(shape(a.match),shape(b.match),'mulligan and replace share the seeded stream');
assert.deepEqual(challengeContext(a.match),challengeContext(b.match));
assert(a.session.checkpoint(a.match).ok);
const reentered=new RankedChallengeSession({storage:a.storage}),resumed=reentered.restore();assert(resumed&&reentered.owns(resumed));
assert.deepEqual(challengeContext(resumed),challengeContext(a.match));
assert(reentered.checkpoint(resumed).ok,'re-entered game saves to the fixed key');
assert.equal(a.storage.getItem('ordinary-player-archive'),'untouched');
assert.deepEqual([...a.storage.data.keys()].sort(),['ordinary-player-archive',RANKED_CHALLENGE_KEY].sort());
// Production actions generate the victory and audit; no terminal state is forged.
const win=start();assert(confirmMulligan(win.match));let steps=0,observedDeaths=0,previewed=false;
while(win.match.phase!=='over'&&steps++<1200){
  if(!previewed&&win.match.currentPlayer===0){
    for(const unit of win.match.units.filter(unit=>unit.owner===0)){
      const target=attackPositions(win.match,unit)[0];if(!target)continue;
      const victim=win.match.units.find(other=>other.x===target.x&&other.y===target.y);
      if(!victim)continue;
      const before=JSON.stringify(win.match),audit=challengeContext(win.match);
      simulateAttackUnit(win.match,unit.unitId,victim.unitId,0);
      assert.equal(JSON.stringify(win.match),before);assert.deepEqual(challengeContext(win.match),audit);previewed=true;break;
    }
  }
  const before=win.match.units.filter(unit=>unit.owner===0&&!unit.token&&!unit.dervish&&!unit.hatchCardId&&unit.cardId!==1).map(unit=>unit.unitId);
  assert(autoAct(win.match));
  observedDeaths+=before.filter(id=>!win.match.units.some(unit=>unit.unitId===id)).length;
  assert(validateMatch(win.match));assert(win.session.checkpoint(win.match).ok);
}
assert.equal(win.match.phase,'over');assert(previewed,'attack preview exercised');
const result=win.session.result(win.match);assert(result.won);assert.equal(result.deaths,observedDeaths);assert.equal(result.deaths,1);assert.equal(result.round,4);assert.equal(result.health,7);assert.equal(result.score,96010);
assert.equal(rankedChallengeScore(result),96010);for(const invalid of [null,{score:180},{...result,won:false},{...result,challengeId:'future'},{...result,score:96011}])assert.equal(rankedChallengeScore(invalid),0);
assert.equal(result.score,100000-result.round*1000-result.deaths*25+result.health*5);
const saved=win.storage.getItem(RANKED_CHALLENGE_KEY);assert(win.session.checkpoint(win.match).ok);assert.equal(win.storage.getItem(RANKED_CHALLENGE_KEY),saved,'result checkpoint idempotent');
const reopened=new RankedChallengeSession({storage:win.storage});assert.deepEqual(reopened.bestResult,result);assert.equal(reopened.hasResume,false);
const terminal=reopened.restore();assert.deepEqual(reopened.result(terminal),result);assert(reopened.checkpoint(terminal).ok);
const prior=win.storage.getItem(RANKED_CHALLENGE_KEY);win.storage.fail=true;
assert.equal(reopened.createAttempt().ok,false);assert.equal(win.storage.getItem(RANKED_CHALLENGE_KEY),prior);assert.deepEqual(reopened.bestResult,result);
win.storage.fail=false;const active=reopened.createAttempt();assert(active.ok);assert(confirmMulligan(active.match));assert(autoAct(active.match));assert(reopened.checkpoint(active.match).ok);assert(reopened.hasResume);
const activeReload=new RankedChallengeSession({storage:win.storage});const continued=activeReload.restore();assert(continued);assert(autoAct(continued));assert(activeReload.checkpoint(continued).ok);assert.deepEqual(activeReload.bestResult,result);
const activeRaw=win.storage.getItem(RANKED_CHALLENGE_KEY);
// This optional fixture comes from the same create/action/checkpoint path above:
// a real four-round win followed by a new in-progress attempt, retaining its best.
if(process.argv.includes('--write-fixture')){
  const directory=new URL('./fixtures/',import.meta.url);mkdirSync(directory,{recursive:true});
  writeFileSync(new URL('ranked-challenge-v1-current.json',directory),JSON.stringify(JSON.parse(activeRaw),null,2)+'\n');
}
activeReload.leave();assert.equal(activeReload.owns(continued),false);assert.equal(win.storage.getItem(RANKED_CHALLENGE_KEY),activeRaw);
for(const raw of ['{broken',JSON.stringify({...JSON.parse(activeRaw),schemaVersion:999})]){
  const store=new Storage();store.data.set(RANKED_CHALLENGE_KEY,raw);const blocked=new RankedChallengeSession({storage:store});assert(blocked.error);assert.equal(blocked.restore(),null);assert.equal(blocked.createAttempt().ok,false);assert.equal(store.getItem(RANKED_CHALLENGE_KEY),raw);
}
const stale=start();const competing=new RankedChallengeSession({storage:stale.storage});assert(competing.createAttempt().ok);assert.equal(stale.session.checkpoint(stale.match).ok,false,'stale instance cannot overwrite a newer attempt');
assert.equal(new RankedChallengeSession({storage:new Storage()}).createAttempt([1]).ok,false);
// A host adapter may commit exact bytes and then throw. Readback must reconcile
// both disk and in-memory expected bytes, so the next changed checkpoint works.
class AfterWriteStorage extends Storage {
  afterWrite=false;
  setItem(key,value){super.setItem(key,value);if(this.afterWrite)throw new Error('after-write');}
}
const after=start(new AfterWriteStorage()),initialRaw=after.storage.getItem(RANKED_CHALLENGE_KEY);
assert(confirmMulligan(after.match));after.storage.afterWrite=true;
assert(after.session.checkpoint(after.match).ok);assert.notEqual(after.storage.getItem(RANKED_CHALLENGE_KEY),initialRaw);
assert(autoAct(after.match));assert(after.session.checkpoint(after.match).ok,'next checkpoint does not enter a permanent CAS conflict');
const afterReload=new RankedChallengeSession({storage:after.storage});assert.equal(afterReload.error,'');assert(afterReload.restore());
assert.deepEqual(afterReload.record.context,challengeContext(after.match));
// Generic snapshots intentionally allow frozen historical stats. This fixed
// challenge additionally requires the current canonical immutable card tables.
const altered=JSON.parse(activeRaw);altered.match.battleCards[0][14].attack=4;
assert(validateMatch(altered.match),'probe remains a structurally valid ordinary snapshot');
const wrongCards=new Storage(),wrongRaw=JSON.stringify(altered);wrongCards.data.set(RANKED_CHALLENGE_KEY,wrongRaw);
const rejected=new RankedChallengeSession({storage:wrongCards});assert(rejected.error);assert.equal(rejected.restore(),null);assert.equal(rejected.createAttempt().ok,false);assert.equal(wrongCards.getItem(RANKED_CHALLENGE_KEY),wrongRaw);
// Loading/validating the canonical table must not allocate IDs or touch a live
// battle's RNG: play the same real summon with and without validation in between.
const pure=start();assert(confirmMulligan(pure.match));const snapshot=structuredClone(pure.match),audit=challengeContext(pure.match);
const index=snapshot.players[0].hand.findIndex(id=>getBattleCard(snapshot,id).type==='unit'&&getBattleCard(snapshot,id).cost<=snapshot.players[0].mana);
assert(index>=0);const cardId=snapshot.players[0].hand[index],cell=summonPositions(snapshot,0,cardId)[0];assert(cell);
const baseline=restoreMatch(structuredClone(snapshot));assert(playCard(baseline,index,cell.x,cell.y,0));
const checked=restoreMatch(structuredClone(snapshot));
const validationOnly=new RankedChallengeSession({storage:pure.storage});assert.equal(validationOnly.error,'');
assert.deepEqual(challengeContext(pure.match),audit);assert.equal(JSON.stringify(pure.match),JSON.stringify(snapshot));
assert(playCard(checked,index,cell.x,cell.y,0));assert.deepEqual(checked.units,baseline.units,'canonical validation leaves the engine allocator unchanged');
console.log('ranked challenge: seeded creation/mulligan/replace, preview isolation, real victory/death audit, checkpoint/re-entry, best/idempotency, write failure/conflict and corrupt/future preservation passed');
