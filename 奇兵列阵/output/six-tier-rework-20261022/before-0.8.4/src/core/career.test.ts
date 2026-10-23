import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BattleOutput } from './types';

class MemoryStorage implements Storage {
 private values = new Map<string,string>(); failCareer = false; failRun = false;
 get length() { return this.values.size; }
 clear() { this.values.clear(); }
 getItem(k:string) { return this.values.get(k) ?? null; }
 key(i:number) { return [...this.values.keys()][i] ?? null; }
 removeItem(k:string) { this.values.delete(k); }
 setItem(k:string,v:string) { if ((this.failCareer && k === 'zl_career_v1') || (this.failRun && k === 'zl_expedition_v1')) throw new Error('quota'); this.values.set(k,v); }
}
const output = (metrics: Record<string,number> = {}, beats=8) => ({ result:'win', beats, metrics } as unknown as BattleOutput);
let storage:MemoryStorage;
beforeEach(() => { vi.resetModules(); storage = new MemoryStorage(); vi.stubGlobal('localStorage',storage); });
async function api() { return { ...(await import('./run')), ...(await import('./save')), ...(await import('./career')), ...(await import('./leaderboards')) }; }
describe('persistent official career', () => {
 it('keeps seeded expeditions distinct and does not infer old battle history',async () => {
  const a=await api(), r=a.newRun('argeon',17), other=a.newRun('argeon',17);
  expect(r.runId).not.toBe(other.runId); r.history=['win','win','win']; a.saveRun(r);
  expect(a.loadCareer().totals.played).toBe(0); expect(a.loadCareer().battleKeys).toHaveLength(0);
 });
 it('uses one outcome per expedition and corrects a failed final result after rescue',async () => {
  const a=await api(),r=a.newRun('argeon',1); a.saveRun(r);
  r.over='defeat';a.saveRun(r);a.saveRun(r); expect(a.loadCareer().totals.played).toBe(1);
  r.over=null;a.saveRun(r);expect(a.loadCareer().totals.played).toBe(0);
  r.over='victory';a.saveRun(r);a.saveRun(r);
  expect(a.loadCareer().totals).toMatchObject({played:1,wins:1,losses:0,streak:1,bestStreak:1});
 });
 it('deduplicates retries, accepts zero-beat boss victory and excludes losing metrics',async () => {
  const a=await api(),r=a.newRun('faie',1);r.node=8;a.saveRun(r);const checkpoint=a.cloneRun(r);
  a.recordOfficialBattle(r,{...output({singleHit:999}),result:'lose'},checkpoint);a.saveRun(r);expect(a.loadCareer().best.singleHit).toBeUndefined();
  a.recordOfficialBattle(r,output({singleHit:24,freezes:3},0),checkpoint);a.saveRun(r);
  a.recordOfficialBattle(r,output({singleHit:99,freezes:8},0),checkpoint);a.saveRun(r);
  expect(a.loadCareer().best.singleHit).toBe(24);expect(a.loadCareer().battleKeys).toHaveLength(1);
  expect(a.getBoardScores(a.loadCareer()).find(b=>b.key==='boss_0')?.value).toBe(0);
 });
 it('recovers a saved pending outbox after profile write failure and reload',async () => {
  const a=await api(),r=a.newRun('vulkan',1);a.saveRun(r);const checkpoint=a.cloneRun(r);
  a.beginBattle(r,'win');a.recordOfficialBattle(r,output({burnDamage:35}),checkpoint);storage.failCareer=true;
  expect(a.saveRun(r)).toBe(false);expect(a.clearRun()).toBe(false);
  storage.failCareer=false;vi.resetModules();const next=await api();const loaded=next.loadRun();
  expect(loaded.kind).toBe('ok');expect(next.loadCareer().best.burnDamage).toBe(35);expect(next.loadCareer().battleKeys).toHaveLength(1);
 });
 it('does not abandon the old run when replacement save fails; rejects old callbacks after success',async () => {
  const a=await api(),old=a.newRun('argeon',2);a.saveRun(old);const next=a.newRun('faie',3);a.stageRunReplacement(old,next);
  storage.failRun=true;expect(a.saveRun(next)).toBe(false);expect(a.loadCareer().totals.played).toBe(0);
  storage.failRun=false;expect(a.saveRun(next)).toBe(true);expect(a.loadCareer().totals).toMatchObject({played:1,wins:0,losses:1});
  old.over='victory';expect(a.saveRun(old)).toBe(false);a.recordRunOutcome(old,'victory');
  expect(a.loadCareer().totals.wins).toBe(0);expect(JSON.parse(storage.getItem(a.SAVE_KEY)!).runId).toBe(next.runId);
 });
 it('only qualifies rates after three victories and keeps absolute counts after compaction',async () => {
  const a=await api(); let previous:ReturnType<typeof a.newRun>|null=null;
  for(let i=0;i<140;i++){const r=a.newRun('hank',i);a.stageRunReplacement(previous,r);a.saveRun(r);r.over='victory';a.saveRun(r);previous=r;}
  const p=a.loadCareer();expect(p.outcomes.length).toBeLessThanOrEqual(128);expect(p.totals.wins).toBe(140);expect(p.totals.bestStreak).toBe(140);
  const scores=a.getBoardScores(p);expect(scores.find(b=>b.key==='totalWins')?.value).toBe(140);expect(scores.find(b=>b.key==='general_hank')?.value).toBe(100);
 });
 it('starts a new official expedition after the completed save was cleared',async () => {
  const a=await api(),old=a.newRun('argeon',7);a.saveRun(old);old.over='victory';a.saveRun(old);expect(a.clearRun()).toBe(true);
  const next=a.newRun('faie',8);a.stageRunReplacement(null,next);expect(a.saveRun(next)).toBe(true);
  expect(a.loadCareer().totals.wins).toBe(1);old.over='defeat';expect(a.saveRun(old)).toBe(false);
 });
 it('requires an explicit opt-in to discard an incompatible run',async () => {
  const a=await api();storage.setItem(a.SAVE_KEY,JSON.stringify({saveVersion:-1}));
  expect(a.clearRun()).toBe(false);expect(storage.getItem(a.SAVE_KEY)).not.toBeNull();
  expect(a.clearRun({discardIncompatible:true})).toBe(true);expect(storage.getItem(a.SAVE_KEY)).toBeNull();
 });
 it('does not overwrite a corrupt career record',async () => {
  storage.setItem('zl_career_v1','{broken');const a=await api(),r=a.newRun('faie',5);r.over='victory';expect(a.saveRun(r)).toBe(false);
  expect(storage.getItem('zl_career_v1')).toBe('{broken');expect(a.loadCareer().storageStatus).toBe('corrupt');
 });
});
