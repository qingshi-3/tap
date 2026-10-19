import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {RankedChallengeSession,RANKED_CHALLENGE} from '../dist/js/ranked-challenge.js';
import {ExpeditionProgress} from '../dist/js/expedition-progress.js';
import {createExpeditionMatch,confirmMulligan} from '../dist/js/engine.js';

class Storage { data=new Map();fail=false;getItem(k){return this.data.get(k)??null}removeItem(k){this.data.delete(k)}setItem(k,v){if(this.fail)throw Error('quota');this.data.set(k,String(v))} }
// Execute the production main persistence boundary with real profile/challenge
// services; DOM effects are inert. This catches challenge-to-profile leakage
// without launching a browser or inventing reward settlement UI events.
const source=await readFile(new URL('../dist/js/main.js',import.meta.url),'utf8');
const persistSource=source.slice(source.indexOf('function persist(state = match)'),source.indexOf('\nfunction enterMatch('));
assert.ok(persistSource.length>100);
const storage=new Storage(),expedition=new ExpeditionProgress(storage),session=new RankedChallengeSession({storage});
const regular=createExpeditionMatch('border-01',expedition.state.training,expedition.state.squad,expedition.state.selectedHeroId,expedition.getBattleLoadout());
assert.ok(expedition.saveBattle(regular).ok);
const ordinaryBefore=JSON.stringify(expedition.state),attempt=session.createAttempt(RANKED_CHALLENGE.initialDeck);assert.ok(attempt.ok);
const rankedAttempts=new WeakSet([attempt.match]);
const context=vm.createContext({match:attempt.match,replacingPlayerSave:false,rankedChallenge:session,rankedAttempts,isRankedMatch:state=>session.owns(state),expedition,lastSettlement:null,rankedResultNotice:'',ui:{battleLog:{textContent:''}},showHint(){},clearHint(){},saves:{saveLocal(){throw Error('challenge entered ordinary trial save')}},campaign:{observe(){throw Error('challenge entered ordinary campaign')}},playerCloud:{notifyLocalChange(){throw Error('challenge notified ordinary cloud')}}});
vm.runInContext(`${persistSource}\nthis.persist = persist;`,context);
assert.equal(context.persist(attempt.match),true);
assert.equal(JSON.stringify(expedition.state),ordinaryBefore,'successful checkpoint preserves ordinary active battle/profile');
assert.equal(confirmMulligan(attempt.match),true);
storage.fail=true;assert.equal(context.persist(attempt.match),false);assert.match(context.rankedResultNotice,/挑战未保存/);assert.equal(JSON.stringify(expedition.state),ordinaryBefore);
storage.fail=false;assert.equal(context.persist(attempt.match),true,'failed checkpoint can retry');
session.leave();assert.equal(context.persist(attempt.match),false,'detached challenge fails closed');assert.equal(JSON.stringify(expedition.state),ordinaryBefore);
assert.equal(context.persist(regular),true,'ordinary expedition save remains available');
Object.assign(regular,{phase:'over',winner:0,result:'win'});assert.equal(context.persist(regular),true,'ordinary expedition still settles');assert.ok(expedition.state.settlements[regular.runId]);
console.log('Ranked main isolation passed: independent real storage checkpoint, failed-save retry, detached match rejection, preserved player active battle, ordinary victory settlement.');
