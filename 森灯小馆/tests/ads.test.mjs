import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGame,act,tick,validateState} from '../js/core.js';
import {createRewardAds,rewardCount,AD_UNIT_ID} from '../js/ads.js';
import {loadGame,saveGame,SAVE_KEY} from '../js/persistence.js';
const memory=new Map();let failWrites=false;
globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>{if(failWrites)throw Error('quota');memory.set(k,v);}};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function setup({initial=createGame(),host,timeoutMs}={}){
 failWrites=false;memory.clear();memory.set(SAVE_KEY,JSON.stringify(initial));let state=loadGame().state;let busy=false;const results=[],instances=[];
 const make=()=>{const ad={shows:0,loads:0,destroyed:0,onClose(fn){this.close=fn;},onError(fn){this.error=fn;},onLoad(fn){this.loaded=fn;},load(){this.loads++;return Promise.resolve();},show(){this.shows++;return Promise.resolve();},destroy(){this.destroyed++;}};instances.push(ad);return ad;};
 const ads=createRewardAds({getState:()=>state,save:saveGame,replace:s=>state=s,onBusy:b=>busy=b,onResult:(message,error)=>results.push({message,error}),host:host||(()=>({createRewardedVideoAd:options=>{assert.equal(options.adUnitId,AD_UNIT_ID);return make();}})),timeoutMs});
 return {ads,instances,results,get state(){return state;},set state(s){state=s;},get busy(){return busy;}};
}
test('frozen 1.0.0 save: load, reward transaction, save, reload, continue service and save',async()=>{
 const initial=JSON.parse(readFileSync(new URL('fixtures/save-v1.0.0-day11.json',import.meta.url)));assert.equal(initial.ads,undefined);
 const t=setup({initial});assert.equal(validateState(t.state).ok,true);const coins=t.state.coins;
 t.ads.request('coins');await flush();t.instances[0].close({isEnded:true});assert.equal(t.state.coins,coins+80);assert.equal(rewardCount(t.state),1);assert.equal(t.results.at(-1).error,false);
 let s=loadGame().state;assert.equal(s.coins,coins+80);assert.equal(act(s,{type:'start'}).ok,true);tick(s,4);assert.equal(saveGame(s).ok,true);s=loadGame().state;tick(s,4);assert.equal(saveGame(s).ok,true);assert.equal(s.ads.claims.length,1);assert.equal(s.ads.claims[0].kind,'coins');assert.ok(s.ads.claims[0].id.length>=8);assert.ok(s.service.elapsed>=7.9);
});
test('two rewards per game day, new day resets, exact ingredient IDs, duplicate close idempotent',async()=>{
 const t=setup();const old=t.state.inventory.mushroom;
 t.ads.request('ingredients');assert.equal(t.ads.request('coins'),false);await flush();const ad=t.instances[0];ad.close({isEnded:true});ad.close({isEnded:true});assert.equal(t.state.inventory.mushroom,old+6);assert.equal(t.state.inventory.rice,14);assert.equal(t.state.inventory.berry,12);assert.equal(ad.destroyed,1);
 t.ads.request('coins');await flush();t.instances[1].close({isEnded:true});assert.equal(rewardCount(t.state),2);assert.equal(t.ads.request('coins'),false);
 act(t.state,{type:'start'});tick(t.state,60);act(t.state,{type:'next'});assert.equal(rewardCount(t.state),0);assert.equal(t.ads.request('coins'),true);t.ads.cancel();
});
test('cancel, incomplete/legacy close, error, late completion and page cancellation never reward',async()=>{
 for(const end of [t=>t.ads.cancel(),t=>t.instances[0].close({isEnded:false}),t=>t.instances[0].close(),t=>t.instances[0].close({isEnded:'true'}),t=>t.instances[0].error()]){
  const t=setup();t.ads.request('coins');await flush();end(t);t.instances[0].close({isEnded:true});assert.equal(t.state.coins,160);assert.equal(rewardCount(t.state),0);assert.equal(t.busy,false);assert.equal(t.instances[0].destroyed,1);
 }
});
test('timeout and its delayed close never award',async()=>{
 const t=setup({timeoutMs:5});t.ads.request('coins');await new Promise(r=>setTimeout(r,15));t.instances[0].close({isEnded:true});assert.equal(t.state.coins,160);assert.equal(t.busy,false);
});
test('changed state, cross day, and reload invalidate callbacks',async()=>{
 for(const mutate of [t=>{t.state.coins++;},t=>{t.state.day++;},t=>{t.state=loadGame().state;}]){
  const t=setup();t.ads.request('coins');await flush();mutate(t);const before=t.state.coins;t.instances[0].close({isEnded:true});assert.equal(t.state.coins,before);assert.equal(rewardCount(t.state),0);
 }
});
test('pre-save failure never creates instance; reward save failure never changes resources or reports success',async()=>{
 const t=setup();failWrites=true;t.state.coins++;assert.equal(t.ads.request('coins'),false);assert.equal(t.instances.length,0);
 const u=setup();u.ads.request('coins');await flush();failWrites=true;u.instances[0].close({isEnded:true});assert.equal(u.state.coins,160);assert.equal(rewardCount(u.state),0);assert.equal(u.results.at(-1).error,true);failWrites=false;assert.equal(loadGame().state.coins,160);
});
test('storage conflict refuses award and preserves other tab',async()=>{
 const t=setup();t.ads.request('coins');await flush();const other=createGame();other.coins=175;memory.set(SAVE_KEY,JSON.stringify(other));t.instances[0].close({isEnded:true});assert.equal(t.state.coins,160);assert.equal(loadGame().state.coins,175);assert.equal(t.results.at(-1).error,true);
});
test('show rejection only loads then retries once, repeated failure recovers operation',async()=>{
 const t=setup();t.ads.request('coins');t.instances[0].show=function(){this.shows++;return this.shows===1?Promise.reject(Error('load')):Promise.resolve();};await flush();assert.equal(t.instances[0].shows,2);assert.equal(t.instances[0].loads,1);t.instances[0].close({isEnded:true});assert.equal(t.state.coins,240);
 const u=setup();u.ads.request('coins');u.instances[0].show=function(){this.shows++;return Promise.reject(Error('no fill'));};await flush();assert.equal(u.instances[0].shows,2);assert.equal(u.instances[0].loads,1);assert.equal(u.busy,false);assert.equal(u.state.coins,160);
});
test('ordinary browsers and reused host instances safely refuse',async()=>{
 const t=setup({host:()=>undefined});assert.equal(t.ads.request('coins'),false);assert.equal(t.instances.length,0);
 const u=setup();u.ads.request('coins');await flush();const ad=u.instances[0];u.ads.cancel();const v=setup({host:()=>({createRewardedVideoAd:()=>ad})});v.ads.request('coins');await flush();ad.close({isEnded:true});assert.equal(v.state.coins,160);assert.equal(v.busy,false);
});
test('malformed optional ad ledger is rejected while absent legacy ledger remains valid',()=>{
 assert.equal(validateState(createGame()).ok,true);
 for(const ads of [null,{}, {day:2,claims:[]},{day:1,claims:['coins','coins','coins']},{day:1,claims:['unknown']},{day:1,claims:[],extra:1}]){const s=createGame();s.ads=ads;assert.equal(validateState(s).ok,false);}
});
test('old callbacks cannot settle a later request and cancellation during load cannot show again',async()=>{
 const t=setup();t.ads.request('coins');await flush();const old=t.instances[0];t.ads.cancel();t.ads.request('ingredients');await flush();old.close({isEnded:true});old.error();assert.equal(t.busy,true);assert.equal(t.state.coins,160);t.instances[1].close({isEnded:true});assert.equal(t.state.inventory.mushroom,14);
 const u=setup();let release;u.ads.request('coins');u.instances[0].show=function(){this.shows++;return Promise.reject(Error('retry'));};u.instances[0].load=function(){this.loads++;return new Promise(r=>release=r);};await flush();u.ads.cancel();release();await flush();assert.equal(u.instances[0].shows,1);assert.equal(u.state.coins,160);
});
test('load rejection clears busy and retries never award by themselves',async()=>{
 const t=setup();t.ads.request('coins');t.instances[0].show=()=>Promise.reject(Error('no fill'));t.instances[0].load=()=>Promise.reject(Error('network'));await flush();assert.equal(t.busy,false);assert.equal(t.state.coins,160);assert.equal(t.instances[0].destroyed,1);
});
test('overwrite during storage write is detected before an award is announced',async()=>{
 const t=setup();t.ads.request('coins');await flush();const set=localStorage.setItem;const other=JSON.stringify({...t.state,coins:180});localStorage.setItem=(k,v)=>{set(k,v);if(k===SAVE_KEY)memory.set(k,other);};try{t.instances[0].close({isEnded:true});assert.equal(t.state.coins,160);assert.equal(t.results.at(-1).error,true);assert.equal(loadGame().state.coins,180);}finally{localStorage.setItem=set;}
});
