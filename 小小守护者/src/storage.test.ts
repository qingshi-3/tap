import {afterEach,describe,it,expect,vi} from 'vitest';
import {createGame,applyAction,step,hashState,MAP_DEFS,makeMap} from './core/index.ts';
import {loadRun,saveRun,startFreshRun,exportReplay,importReplay,RUN_KEY,activeRunId,type StoragePort} from './storage.ts';

class MemoryPort implements StoragePort {
 values=new Map<string,string>();
 getItem(key:string){return this.values.get(key)??null}
 setItem(key:string,value:string){this.values.set(key,value)}
 removeItem(key:string){this.values.delete(key)}
}
afterEach(()=>vi.unstubAllGlobals());
describe('checkpoint persistence',()=>{
 it('reports restricted storage without throwing during startup or saving',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('宿主拒绝存储')}});
  try{expect(loadRun()).toMatchObject({state:null,error:'宿主拒绝存储'});expect(saveRun(createGame())).toMatchObject({ok:false,message:'宿主拒绝存储'})}
  finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage')}
 });
 it('loads, continues playing, saves and reloads at the same storage key',()=>{
  const port=new MemoryPort(),original=startFreshRun(77,port);
  const loaded=loadRun(port).state!;
  expect(activeRunId(loaded)).toBe(activeRunId(original));
  expect(applyAction(loaded,{type:'buySpell',kind:'heal'}).ok).toBe(true);
  expect(saveRun(loaded,port).ok).toBe(true);
  const again=loadRun(port).state!;
  expect(again.spells.heal).toBe(1);
  expect(applyAction(again,{type:'buySpell',kind:'freeze'}).ok).toBe(true);
  expect(saveRun(again,port).ok).toBe(true);
  expect(loadRun(port).state!.spells).toEqual({heal:1,freeze:1});
  expect([...port.values.keys()]).toEqual([RUN_KEY]);
 });
 it('preserves an unknown version and rejects implicit replacement',()=>{
  const port=new MemoryPort(),raw=JSON.stringify({version:99,runId:'future',snapshot:'{}'});port.setItem(RUN_KEY,raw);
  expect(loadRun(port).error).toBeTruthy();expect(saveRun(createGame(),port).ok).toBe(false);
  expect(port.getItem(RUN_KEY)).toBe(raw);
 });
 it('never replaces the current run when the backup cannot be confirmed',()=>{
  const port=new MemoryPort();startFreshRun(1,port);const old=port.getItem(RUN_KEY);
  const write=port.setItem.bind(port);port.setItem=(key,value)=>{if(!key.includes('.backup.'))write(key,value)};
  expect(()=>startFreshRun(2,port)).toThrow('旧档备份失败');expect(port.getItem(RUN_KEY)).toBe(old);
 });
 it('backs up exact unknown data before an explicit fresh start',()=>{
  const port=new MemoryPort(),old='unrecognized original bytes';port.setItem(RUN_KEY,old);
  startFreshRun(2,port);
  expect([...port.values.entries()].find(([key])=>key.includes('.backup.'))?.[1]).toBe(old);
  expect(loadRun(port).state?.seed).toBe(2);
 });
 it('refuses the second page after the first page changes progress',()=>{
  const port=new MemoryPort();startFreshRun(1,port);const first=loadRun(port).state!,second=loadRun(port).state!;
  applyAction(first,{type:'buySpell',kind:'heal'});expect(saveRun(first,port).ok).toBe(true);const latest=port.getItem(RUN_KEY);
  applyAction(second,{type:'buySpell',kind:'freeze'});expect(saveRun(second,port)).toMatchObject({ok:false});expect(port.getItem(RUN_KEY)).toBe(latest);
 });
 it('reports silent failed writes and leaves old progress readable',()=>{
  const port=new MemoryPort();const state=startFreshRun(1,port),old=port.getItem(RUN_KEY);port.setItem=()=>{};
  applyAction(state,{type:'buySpell',kind:'heal'});expect(saveRun(state,port)).toMatchObject({ok:false,message:'存档写入未确认，请保留当前页面'});expect(port.getItem(RUN_KEY)).toBe(old);
 });
 it('keeps the beginning-of-wave checkpoint during combat',()=>{
  const port=new MemoryPort(),state=startFreshRun(1,port),old=port.getItem(RUN_KEY);
  applyAction(state,{type:'startWave'});step(state,90);expect(saveRun(state,port).ok).toBe(true);expect(port.getItem(RUN_KEY)).toBe(old);
 });
 it('does not lend one saved run identity to an unrelated state',()=>{
  const port=new MemoryPort();startFreshRun(1,port);expect(activeRunId(createGame(1))).toBe('');
 });
});
describe('replay endpoint',()=>{
 it('restores a registered nondefault map instead of replacing it with the default',()=>{
  const id='replay-test-map';MAP_DEFS[id]={...MAP_DEFS['fork-camp'],map:()=>({...makeMap(),id,core:{x:24,y:10}})};
  try{const state=createGame(19,id);applyAction(state,{type:'startWave'});step(state,30);const restored=importReplay(exportReplay(state));expect(restored.mapId).toBe(id);expect(hashState(restored)).toBe(hashState(state))}
  finally{delete MAP_DEFS[id]}
 });
 it('reproduces combat ticks after the final player action',()=>{
  const state=createGame(19);applyAction(state,{type:'startWave'});step(state,120);
  const restored=importReplay(exportReplay(state));expect(restored.tick).toBe(120);expect(hashState(restored)).toBe(hashState(state));
 });
 it('rejects an endpoint that cannot be reached in the preparation phase',()=>{
  const replay=JSON.parse(exportReplay(createGame()));replay.tick=30;
  expect(()=>importReplay(JSON.stringify(replay))).toThrow('回放无法到达终点');
 });
 it('rejects incompatible rules and invalid actions',()=>{
  const replay=JSON.parse(exportReplay(createGame()));replay.rulesVersion='future';expect(()=>importReplay(JSON.stringify(replay))).toThrow('版本不匹配');
  replay.rulesVersion=createGame().rulesVersion;replay.actions=[{tick:0,action:{type:'not-an-action'}}];expect(()=>importReplay(JSON.stringify(replay))).toThrow();
 });
});
