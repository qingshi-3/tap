import {it,expect} from 'vitest';
import frozen from './fixtures/run-v1-wave1.json';
import {loadRun,saveRun,type StoragePort} from './storage';
import {applyAction} from './core/index';

it('continues the frozen 0.1.0 wave-one checkpoint through two saves and reloads',()=>{
 const key='little-guardians-h5.run.v1';
 const data=new Map([[key,JSON.stringify(frozen)]]);
 const port:StoragePort={getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v)},removeItem:k=>{data.delete(k)}};
 const loaded=loadRun(port);expect(loaded.error).toBeUndefined();const state=loaded.state!;
 expect(state.wave).toBe(1);expect(state.phase).toBe('prep');const gold=state.gold;
 expect(applyAction(state,{type:'buyBuilding',kind:'wall',x:20,y:10}).ok).toBe(true);
 expect(saveRun(state,port).ok).toBe(true);
 const continued=loadRun(port).state!;expect(continued.gold).toBe(gold-12);
 expect(applyAction(continued,{type:'buySpell',kind:'heal'}).ok).toBe(true);
 expect(saveRun(continued,port).ok).toBe(true);
 const final=loadRun(port).state!;expect(final.spells.heal).toBe(1);expect(final.gold).toBe(gold-30);
 expect(JSON.parse(data.get(key)!).runId).toBe(frozen.runId);
});
