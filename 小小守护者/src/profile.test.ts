import {describe,it,expect} from 'vitest';
import {createGame,applyAction} from './core/index.ts';
import {startFreshRun,saveRun,loadRun,type StoragePort} from './storage.ts';
import {getProfile,observeRun,recordOutcome,PROFILE_KEY} from './profile.ts';
class MemoryPort implements StoragePort {
 values=new Map<string,string>();
 getItem(key:string){return this.values.get(key)??null}
 setItem(key:string,value:string){this.values.set(key,value)}
 removeItem(key:string){this.values.delete(key)}
}
describe('persistent archive',()=>{
 it('reports a restricted default storage accessor without startup exceptions',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('宿主拒绝档案')}});
  try{expect(getProfile().blockedMessage).toBe('宿主拒绝档案');expect(observeRun(createGame())).toMatchObject({ok:false,message:'宿主拒绝档案'})}
  finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage')}
 });
 it('saves observed discoveries and reads them back',()=>{
  const port=new MemoryPort(),state=createGame();applyAction(state,{type:'buyLegion',kind:'shield',x:8,y:8});
  expect(state.legions).toHaveLength(1);expect(observeRun(state,port).ok).toBe(true);expect(getProfile(port).discovered).toContain('shield-1');
 });
 it('reports quota failures and silent write failures',()=>{
  const port=new MemoryPort();port.setItem=()=>{throw new Error('quota')};expect(observeRun(createGame(),port)).toMatchObject({ok:false,message:'quota'});
  port.setItem=()=>{};expect(observeRun(createGame(),port)).toMatchObject({ok:false,message:'档案写入未确认，请保留当前页面'});
 });
 it('preserves unknown archives, including missing required statistics',()=>{
  for(const raw of [JSON.stringify({version:2}),JSON.stringify({version:1,stats:{},discovered:[],achievements:[],history:[],completedRunIds:[]})]){
   const port=new MemoryPort();port.setItem(PROFILE_KEY,raw);expect(getProfile(port).blockedMessage).toBeTruthy();expect(observeRun(createGame(),port).ok).toBe(false);expect(port.getItem(PROFILE_KEY)).toBe(raw);
  }
 });
 it('refuses an intervening page write before committing',()=>{
  const port=new MemoryPort();observeRun(createGame(),port);const initial=port.getItem(PROFILE_KEY)!;
  const replacement=JSON.parse(initial);replacement.stats.runs=9;const latest=JSON.stringify(replacement);let reads=0;
  port.getItem=(key)=>{if(key===PROFILE_KEY&&++reads===2)port.values.set(key,latest);return port.values.get(key)??null};
  expect(observeRun(createGame(),port)).toMatchObject({ok:false,message:'档案已被其他页面改变，未覆盖'});expect(port.values.get(PROFILE_KEY)).toBe(latest);
 });
 it('records a settled run once, including a reload and later observation',()=>{
  const port=new MemoryPort(),state=startFreshRun(15,port);state.phase='lost';state.wave=2;state.stats.kills=7;state.stats.wavesCleared=1;
  expect(recordOutcome(state,port).ok).toBe(true);expect(saveRun(state,port).ok).toBe(true);const reloaded=loadRun(port).state!;
  expect(recordOutcome(reloaded,port).ok).toBe(true);expect(observeRun(reloaded,port).ok).toBe(true);
  expect(getProfile(port).stats).toEqual({runs:1,wins:0,kills:7,maxWave:1});expect(getProfile(port).history).toHaveLength(1);
 });
 it('rejects settlement from an unrelated unsaved state',()=>{
  const port=new MemoryPort();startFreshRun(2,port);const unrelated=createGame();unrelated.phase='won';
  expect(recordOutcome(unrelated,port).ok).toBe(false);expect(getProfile(port).stats.runs).toBe(0);
 });
});
