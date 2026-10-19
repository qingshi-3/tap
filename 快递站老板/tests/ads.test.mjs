import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,dispatch,tick,validate,adRewardAvailable} from '../js/engine.js';
import {createRewardAds,AD_UNIT_ID} from '../js/ads.js';
import {loadGame,saveGame,SAVE_KEY} from '../js/storage.js';
const flush = () => new Promise(resolve=>setImmediate(resolve));
function settled(){const s=createGame();dispatch(s,{type:'START'});tick(s,1000);return s;}
function harness(options={}){
 const state=settled(), results=[], instances=[]; let current=state, saves=0;
 const host={createRewardedVideoAd(config){assert.equal(config.adUnitId,AD_UNIT_ID);const ad={onClose(fn){this.close=fn;},onError(fn){this.error=fn;},show(){this.shows=(this.shows||0)+1;return options.show?.(this)??Promise.resolve();},load(){this.loads=(this.loads||0)+1;return Promise.resolve();},destroy(){}};instances.push(ad);return options.instance||ad;}};
 const api=createRewardAds({getState:()=>current,save:s=>{saves++;return options.save?.(s,saves)??{ok:true};},onResult:(...r)=>results.push(r),host:()=>options.missing?null:host,timeoutMs:options.timeoutMs??10000});
 return {state,api,instances,results,get saves(){return saves;},replace:s=>current=s};
}
test('rules: fixed reward, once per settlement, strict requests and validation',()=>{
 const s=settled(), before=s.cash, history=JSON.stringify(s.history);
 assert.equal(adRewardAvailable(s),true);
 for(const id of ['', 'x', 'x'.repeat(101)])assert.equal(dispatch(s,{type:'BEGIN_AD',id}).ok,false);
 assert.equal(dispatch(s,{type:'BEGIN_AD',id:'request_0001'}).ok,true);
 assert.equal(dispatch(s,{type:'GRANT_AD',id:'request_old'}).ok,false);
 s.adRewards.pending.amount=200;assert.equal(validate(s).ok,false);assert.equal(dispatch(s,{type:'GRANT_AD',id:'request_0001'}).ok,false);s.adRewards.pending.amount=20;
 assert.equal(dispatch(s,{type:'GRANT_AD',id:'request_0001'}).ok,true);
 assert.equal(s.cash,before+20);assert.equal(JSON.stringify(s.history),history);assert.equal(adRewardAvailable(s),false);
 assert.equal(dispatch(s,{type:'GRANT_AD',id:'request_0001'}).ok,false);assert.equal(validate(s).ok,true);
 dispatch(s,{type:'NEXT'});assert.equal(adRewardAvailable(s),false);
});
test('SDK missing and show success alone never grant',async()=>{
 const absent=harness({missing:true});assert.equal(absent.api.available(),false);assert.equal(absent.api.request(),false);
 const h=harness(), cash=h.state.cash;assert.equal(h.api.request(),true);assert.equal(h.api.request(),false);await flush();assert.equal(h.state.cash,cash);h.api.cancel();assert.equal(h.state.adRewards.pending,null);
});
test('only strict completed true grants once; old callbacks cannot grant new requests',async()=>{
 for(const response of [undefined,{}, {isEnded:false},{isEnded:1}]){const h=harness(),cash=h.state.cash;h.api.request();await flush();h.instances[0].close(response);assert.equal(h.state.cash,cash);assert.equal(h.api.busy,false);}
 const h=harness(),cash=h.state.cash;h.api.request();await flush();const old=h.instances[0].close;h.api.cancel();h.api.request();await flush();old({isEnded:true});assert.equal(h.state.cash,cash);h.instances[1].close({isEnded:true});h.instances[1].close({isEnded:true});assert.equal(h.state.cash,cash+20);assert.equal(h.api.request(),false);
});
test('show rejection retries load/show once; second rejection terminates',async()=>{
 for(const failAgain of [false,true]){const h=harness({show:ad=>ad.shows===1||failAgain?Promise.reject(Error()):Promise.resolve()});h.api.request();await flush();await flush();assert.equal(h.instances[0].shows,2);assert.equal(h.instances[0].loads,1);if(failAgain)assert.equal(h.api.busy,false);h.api.cancel();}
});
test('errors, timeout, changed generation and reused instance reject grants',async()=>{
 const h=harness(),cash=h.state.cash;h.api.request();await flush();h.instances[0].error();h.instances[0].close({isEnded:true});assert.equal(h.state.cash,cash);
 const t=harness({timeoutMs:5});t.api.request();await new Promise(resolve=>setTimeout(resolve,15));assert.equal(t.api.busy,false);assert.equal(t.state.adRewards.pending,null);
 const changed=harness();changed.api.request();await flush();changed.replace(settled());const previousSaves=changed.saves;changed.instances[0].close({isEnded:true});assert.equal(changed.saves,previousSaves);assert.equal(changed.state.adRewards.grants.length,0);
 const instance={onClose(fn){this.close=fn;},onError(){},show(){return Promise.resolve();}};
 const reused=harness({instance});reused.api.request();await flush();reused.api.cancel();assert.equal(reused.api.request(),true);assert.equal(reused.api.busy,false);assert.equal(reused.state.adRewards.pending,null);
});
test('checkpoint failure never shows; reward save failure preserves grant for retry without re-award',async()=>{
 const failed=harness({save:()=>({ok:false,message:'full'})});assert.equal(failed.api.request(),false);assert.equal(failed.instances.length,0);assert.equal(failed.state.adRewards.pending,null);
 const h=harness({save:(_s,n)=>({ok:n!==2,message:'full'})}),cash=h.state.cash;h.api.request();await flush();h.instances[0].close({isEnded:true});assert.equal(h.state.cash,cash+20);assert.equal(h.state.adRewards.grants.length,1);assert.deepEqual(h.results.at(-1)[1],{granted:true,saveFailed:true});assert.equal(h.api.request(),false);h.instances[0].close({isEnded:true});assert.equal(h.state.cash,cash+20);
});
test('old and rewarded documents load/play/save/reload/save at unchanged storage key',()=>{
 for(const ads of [false,true]){const map=new Map(), storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};let state=loadGame(storage).state;dispatch(state,{type:'START'});tick(state,1000);
 if(ads){dispatch(state,{type:'BEGIN_AD',id:'roundtrip_0001'});dispatch(state,{type:'GRANT_AD',id:'roundtrip_0001'});}
 assert.equal(saveGame(storage,state).ok,true);assert.ok(map.has(SAVE_KEY));state=loadGame(storage).state;dispatch(state,{type:'NEXT'});dispatch(state,{type:'START'});tick(state,1000);assert.equal(saveGame(storage,state).ok,true);state=loadGame(storage).state;assert.equal(saveGame(storage,state).ok,true);}
});
test('pending recovery and NEXT clear locks; malformed or duplicate ledgers are rejected',()=>{
 const state=settled();dispatch(state,{type:'BEGIN_AD',id:'recover_0001'});assert.equal(validate(state).ok,true);
 const reload=JSON.parse(JSON.stringify(state));assert.equal(dispatch(reload,{type:'CANCEL_AD',id:'recover_0001'}).ok,true);assert.equal(adRewardAvailable(reload),true);
 dispatch(state,{type:'NEXT'});assert.equal(state.adRewards.pending,null);assert.equal(dispatch(state,{type:'GRANT_AD',id:'recover_0001'}).ok,false);
 const claimed=settled();dispatch(claimed,{type:'BEGIN_AD',id:'claimed_0001'});dispatch(claimed,{type:'GRANT_AD',id:'claimed_0001'});
 for(const mutate of [s=>s.adRewards.grants.push({...s.adRewards.grants[0]}),s=>s.adRewards.grants[0].day=2,s=>s.adRewards.grants[0].amount=21,s=>s.adRewards.grants[0].id='bad']){const copy=JSON.parse(JSON.stringify(claimed));mutate(copy);assert.equal(validate(copy).ok,false);}
});
test('pagehide cancels viewing and ignores late completion',async()=>{
 const previousAdd=globalThis.addEventListener,previousRemove=globalThis.removeEventListener;
 let hide;
 globalThis.addEventListener=(name,fn)=>{if(name==='pagehide')hide=fn;};globalThis.removeEventListener=()=>{};
 try{const h=harness(),cash=h.state.cash;h.api.request();await flush();hide();h.instances[0].close({isEnded:true});assert.equal(h.state.cash,cash);assert.equal(h.state.adRewards.pending,null);assert.equal(h.api.busy,false);}
 finally{if(previousAdd)globalThis.addEventListener=previousAdd;else delete globalThis.addEventListener;if(previousRemove)globalThis.removeEventListener=previousRemove;else delete globalThis.removeEventListener;}
});

test('real storage reward write failure retries same object and reload cannot award again',async()=>{
 const values=new Map();let fail=false;
 const storage={getItem:key=>values.get(key)??null,setItem(key,value){if(fail&&key===SAVE_KEY)throw Error('full');values.set(key,String(value));}};
 let state=loadGame(storage).state;
 dispatch(state,{type:'START'});tick(state,1000);assert.equal(saveGame(storage,state).ok,true);
 const cash=state.cash, results=[];
 const ad={onClose(fn){this.close=fn;},onError(fn){this.error=fn;},show(){return Promise.resolve();}};
 const api=createRewardAds({getState:()=>state,save:s=>saveGame(storage,s),host:()=>({createRewardedVideoAd:()=>ad}),onResult:(...args)=>results.push(args)});
 assert.equal(api.request(),true);await flush();
 fail=true;ad.close({isEnded:true});
 assert.equal(state.cash,cash+20);assert.equal(state.adRewards.grants.length,1);assert.equal(state.adRewards.pending,null);
 assert.deepEqual(results.at(-1)[1],{granted:true,saveFailed:true});
 assert.equal(JSON.parse(values.get(SAVE_KEY)).cash,cash,'failed write keeps persisted cash unchanged');
 assert.equal(api.request(),false);ad.close({isEnded:true});assert.equal(state.cash,cash+20);
 fail=false;assert.equal(saveGame(storage,state).ok,true,'same WeakMap identity can retry');
 state=loadGame(storage).state;assert.equal(state.cash,cash+20);assert.equal(adRewardAvailable(state),false);
 assert.equal(dispatch(state,{type:'GRANT_AD',id:state.adRewards.grants[0].id}).ok,false);
 assert.equal(saveGame(storage,state).ok,true);assert.equal(loadGame(storage).state.cash,cash+20);
});
