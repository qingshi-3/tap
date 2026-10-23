import { legacyRun } from './legacyRun';
import { describe,expect,it } from 'vitest';
import { LEGACY_TIERS } from '../src/core/preparation';
import { ALL_FACTIONS, unitDef } from '../src/core/data';
import { allOwned, applyResult, battleNo, cloneRun, currentNode, getOwned, moveSlot,  placeKind, reroll, rollDraft, settleRewardedRetry, takeDraft } from '../src/core/run';
import { CHAPTER_COUNT, STAGES_PER_CHAPTER } from '../src/core/route';
import { unitLevel, type ActiveFaction, type Copies, type Slotted } from '../src/core/types';
const owned=(id:string,copies:Copies=1,ownedId=1):Slotted=>({defId:id,copies,ownedId});

describe('run failure paths',()=>{
  it('natural seeds cover every four-of-six faction pool and every draft obeys faction/rarity eligibility',()=>{
    const pools=new Set<string>();
    for(let seed=1;seed<=250;seed++){
      const r=legacyRun('lilithe',seed),key=r.activeFactions.join('+');pools.add(key);
      expect(new Set(r.activeFactions).size).toBe(4);
      for(let ch=0;ch<CHAPTER_COUNT;ch++)for(let node=0;node<STAGES_PER_CHAPTER;node++){
        r.chapter=ch;r.node=node;
        for(let n=0;n<2;n++){
          expect(rollDraft(r)).toBe(true);expect(new Set(r.draft).size).toBe(3);
          for(const id of r.draft){const d=unitDef(id);expect(LEGACY_TIERS[id]).toBeLessThanOrEqual(Math.min(4, battleNo(r)<2?1:battleNo(r)<5?2:battleNo(r)<8?3:4));expect(d.faction==='neutral' || r.activeFactions.includes(d.faction as ActiveFaction)).toBe(true);}
        }
      }
      expect(r.activeFactions.join('+')).toBe(key);
    }
    expect(ALL_FACTIONS).toHaveLength(6);
    expect(pools.size).toBe(15);
  },20000); // 250 局 × 全章抽卡，单跑约 5 秒，全量并行时会超默认 5 秒
  it('refresh spends exactly one reroll and keeps the draft eligible',()=>{
    const r=legacyRun('faie',8);
    expect(r.rerolls).toBe(1);
    expect(reroll(r)).toBe(true);expect(r.rerolls).toBe(0);
    expect(new Set(r.draft).size).toBe(3);
    for(const id of r.draft)expect(LEGACY_TIERS[id]).toBe(1);
  });
  it('refresh without rerolls and invalid placement leave every field and RNG untouched',()=>{
    const r=legacyRun('faie',8);r.rerolls=0;const before=cloneRun(r);
    expect(reroll(r)).toBe(false);
    for(const [draft,to] of [[-1,0],[0,-1],[0,8],[3,0],[0,1.2]])expect(takeDraft(r,draft,to)).toBe('invalid');
    expect(r).toEqual(before);
  });
  for(const [a,b] of [[1,1],[2,2]] as const)it(`${a}+${b} copies merge exactly and preserve destination identity`,()=>{
    const r=legacyRun('argeon',1);r.slots[0]=owned('n_merc',a,1);r.bench[0]=owned('n_merc',b,2);
    expect(moveSlot(r,5,0)).toBe('merge');expect(getOwned(r,0)).toEqual({...owned('n_merc',a===1?2:4,1),equips:[]});expect(getOwned(r,5)).toBeNull();
    expect(unitLevel(getOwned(r,0)!)).toBe(a+b===4?3:2);
  });
  for(const [a,b] of [[2,1],[4,1],[4,2],[4,4]] as const)it(`${a} and ${b} copies swap intact rather than merge`,()=>{
    const r=legacyRun('argeon',1);r.slots[0]=owned('n_merc',a,1);r.bench[0]=owned('n_merc',b,2);
    const before=cloneRun(r);expect(moveSlot(r,5,0)).toBe('swap');
    expect(r.slots[0]).toEqual(before.bench[0]);expect(r.bench[0]).toEqual(before.slots[0]);
    expect({...r,slots:before.slots,bench:before.bench}).toEqual(before);
  });
  it('sandbox force-swap preserves equal-star individuals without merging',()=>{
    const r=legacyRun('argeon',1);r.slots[0]=owned('n_merc',2,1);r.bench[0]=owned('n_merc',2,2);
    expect(moveSlot(r,5,0,'swap')).toBe('swap');expect(r.slots[0]!.ownedId).toBe(2);expect(r.bench[0]!.ownedId).toBe(1);
    expect(allOwned(r).filter(Boolean).map(u=>u!.copies)).toEqual([2,2]);
  });
  for(const copies of [2,4] as const)it(`candidate L1 cannot feed a ${unitLevel({copies})}-star individual or reserve it`,()=>{
    const r=legacyRun('argeon',1);r.slots[0]=owned('n_merc',copies,10);r.draft=['n_merc','n_bulwark','n_medic'];
    const before=cloneRun(r);
    expect(placeKind(r,'n_merc',0)).toBe('invalid');
    expect(takeDraft(r,0,0)).toBe('invalid');expect(takeDraft(r,0,0,true)).toBe('invalid');expect(r).toEqual(before);
    expect(takeDraft(r,0,5)).toBe('place');expect(r.slots[0]).toEqual(before.slots[0]);expect(r.bench[0]!.copies).toBe(1);
  });
  it('two recruited bench L1s become L2 before they can merge with the battlefield L2',()=>{
    const r=legacyRun('argeon',1);r.slots[0]=owned('n_merc',2,10);r.draft=['n_merc','n_medic','n_bulwark'];
    expect(takeDraft(r,0,5)).toBe('place');expect(r.bench[0]!.copies).toBe(1);
    r.draft=['n_merc','n_medic','n_bulwark'];
    expect(takeDraft(r,0,5)).toBe('merge');expect(r.bench[0]!.copies).toBe(2);
    const rng=r.rngState,picks=r.picks;
    expect(moveSlot(r,5,0)).toBe('merge');expect(r.slots[0]).toEqual({...owned('n_merc',4,10),equips:[],growth:{atk:2,hp:0,power:0}});expect(r.bench[0]).toBeNull();
    expect(r.rngState).toBe(rng);expect(r.picks).toBe(picks);
  });
  it('retry settlement preserves legal paired individuals and rejects a fabricated merge or illegal intermediate state',()=>{
    const checkpoint=legacyRun('argeon',1);checkpoint.slots[0]=owned('n_merc',2,10);checkpoint.bench[0]=owned('n_merc',2,11);
    const r=cloneRun(checkpoint);applyResult(r,'lose');const before=cloneRun(r);
    const retry=cloneRun(checkpoint);moveSlot(retry,0,5,'swap');
    expect(()=>settleRewardedRetry(r,checkpoint,retry.slots,'win',retry.bench)).not.toThrow();
    expect(allOwned(r).filter(Boolean).map(u=>u!.copies)).toEqual([2,2]);
    const invalid=cloneRun(checkpoint);invalid.slots[0]={...invalid.slots[0]!,copies:3} as unknown as Slotted;
    expect(()=>settleRewardedRetry(before,checkpoint,invalid.slots,'win',invalid.bench)).toThrow();
    expect(before.lives).toBe(2);expect(before.history).toEqual(['lose']);
    const merged=cloneRun(checkpoint);moveSlot(merged,5,0);
    expect(()=>settleRewardedRetry(before,checkpoint,merged.slots,'win',merged.bench)).toThrow();
  });
  it('replacement confirmation with seven occupied positions is a read-only decision',()=>{
    const r=legacyRun('argeon',1);r.slots=Array.from({length:5},(_,i)=>owned('n_merc',1,i+1));r.bench=[owned('n_merc',1,6),owned('n_merc',1,7)];r.draft=['n_medic','n_bulwark','n_merc'];
    const before=cloneRun(r);expect(takeDraft(r,0,0)).toBe('confirm');expect(r).toEqual(before);
    expect(takeDraft(r,0,0,true)).toBe('replace');expect(r.picks).toBe(before.picks-1);expect(r.slots[0]!.defId).toBe('n_medic');
  });
  it('occupied battlefield recruitment first preserves the previous individual on free bench',()=>{
    const r=legacyRun('argeon',1);r.slots[0]=owned('n_merc',2,10);r.draft=['n_medic','n_bulwark','n_merc'];
    expect(takeDraft(r,0,0)).toBe('reserve');expect(r.bench[0]).toEqual(owned('n_merc',2,10));expect(r.slots[0]!.defId).toBe('n_medic');
  });
  it('full-star merge refusal does not globally ban recruiting another individual',()=>{
    const r=legacyRun('argeon',1);r.slots[0]=owned('n_merc',4,10);r.draft=['n_merc','n_bulwark','n_medic'];
    const before=cloneRun(r);expect(takeDraft(r,0,0)).toBe('invalid');expect(r).toEqual(before);
    expect(takeDraft(r,0,5)).toBe('place');expect(r.bench[0]!.ownedId).not.toBe(10);
  });
  it('boss draw consumes no life and grants no recruits, refresh, reroll or RNG advance',()=>{
    const r=legacyRun('argeon',2);r.chapter=0;r.node=STAGES_PER_CHAPTER-1;r.picks=0;r.rerolls=0;const before=cloneRun(r);
    expect(currentNode(r).kind).toBe('boss');applyResult(r,'draw');
    expect({...r,history:[],prepCommitted:false}).toEqual({...before,history:[],prepCommitted:false});expect(r.history).toEqual(['draw']);
  });
  it('bench identities never enter battle input through the battlefield API',()=>{
    const r=legacyRun('lilithe',4);const before=r.rngState;
    expect(takeDraft(r,0,5)).toBe('place');expect(allOwned(r).filter(Boolean)).toHaveLength(1);expect(r.slots.some(Boolean)).toBe(false);expect(r.rngState).not.toBe(before);
  });
});
