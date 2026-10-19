import { describe,expect,it } from 'vitest';
import { DRAFT_POOL, unitDef } from '../src/core/data';
import { allOwned, applyResult, cloneRun, currentNode, getOwned, moveSlot, newRun, placeKind, reroll, rollDraft, settleRewardedRetry, takeDraft, tierCap } from '../src/core/run';
import { unitLevel, type ActiveFaction, type Copies, type Slotted } from '../src/core/types';
const owned=(id:string,copies:Copies=1,ownedId=1):Slotted=>({defId:id,copies,ownedId});

describe('run failure paths',()=>{
  it('natural seeds cover all 5 four-faction pools and every draft obeys faction/rarity eligibility',()=>{
    const pools=new Set<string>();
    for(let seed=1;seed<=250;seed++){
      const r=newRun('argeon',seed),key=r.activeFactions.join('+');pools.add(key);
      expect(new Set(r.activeFactions).size).toBe(4);
      for(let stage=0;stage<10;stage++){
        r.stage=stage;
        for(let n=0;n<5;n++){
          expect(rollDraft(r)).toBe(true);expect(new Set(r.draft).size).toBe(3);
          for(const id of r.draft){const d=unitDef(id);expect(d.tier).toBeLessThanOrEqual(tierCap(stage));expect(d.faction==='neutral' || r.activeFactions.includes(d.faction as ActiveFaction)).toBe(true);}
        }
      }
      expect(r.activeFactions.join('+')).toBe(key);
    }
    expect(pools.size).toBe(5);
  });
  it('early targeted refresh exposes exactly that faction’s three commons',()=>{
    const r=newRun('faie',8),focus=r.activeFactions[0];
    expect(reroll(r,focus)).toBe(true);
    expect([...r.draft].sort()).toEqual(DRAFT_POOL.filter(d=>d.faction===focus && d.tier===1).map(d=>d.id).sort());
  });
  it('illegal faction refresh and invalid placement leave every field and RNG untouched',()=>{
    const r=newRun('faie',8),before=cloneRun(r);
    const unavailable=(['light','shadow','abyss','magma','frost','desert'] as ActiveFaction[]).find(f=>!r.activeFactions.includes(f))!;
    expect(reroll(r,unavailable)).toBe(false);
    for(const [draft,to] of [[-1,0],[0,-1],[0,7],[3,0],[0,1.2]])expect(takeDraft(r,draft,to)).toBe('invalid');
    expect(r).toEqual(before);
  });
  for(const [a,b] of [[1,1],[2,2]] as const)it(`${a}+${b} copies merge exactly and preserve destination identity`,()=>{
    const r=newRun('argeon',1);r.slots[0]=owned('n_merc',a,1);r.bench[0]=owned('n_merc',b,2);
    expect(moveSlot(r,5,0)).toBe('merge');expect(getOwned(r,0)).toEqual(owned('n_merc',a===1?2:4,1));expect(getOwned(r,5)).toBeNull();
    expect(unitLevel(getOwned(r,0)!)).toBe(a+b===4?3:2);
  });
  for(const [a,b] of [[2,1],[4,1],[4,2],[4,4]] as const)it(`${a} and ${b} copies swap intact rather than merge`,()=>{
    const r=newRun('argeon',1);r.slots[0]=owned('n_merc',a,1);r.bench[0]=owned('n_merc',b,2);
    const before=cloneRun(r);expect(moveSlot(r,5,0)).toBe('swap');
    expect(r.slots[0]).toEqual(before.bench[0]);expect(r.bench[0]).toEqual(before.slots[0]);
    expect({...r,slots:before.slots,bench:before.bench}).toEqual(before);
  });
  it('sandbox force-swap preserves equal-star individuals without merging',()=>{
    const r=newRun('argeon',1);r.slots[0]=owned('n_merc',2,1);r.bench[0]=owned('n_merc',2,2);
    expect(moveSlot(r,5,0,'swap')).toBe('swap');expect(r.slots[0]!.ownedId).toBe(2);expect(r.bench[0]!.ownedId).toBe(1);
    expect(allOwned(r).filter(Boolean).map(u=>u!.copies)).toEqual([2,2]);
  });
  for(const copies of [2,4] as const)it(`candidate L1 cannot feed a ${unitLevel({copies})}-star individual or reserve it`,()=>{
    const r=newRun('argeon',1);r.slots[0]=owned('n_merc',copies,10);r.draft=['n_merc','n_bulwark','n_medic'];
    const before=cloneRun(r);
    expect(placeKind(r,'n_merc',0)).toBe('invalid');
    expect(takeDraft(r,0,0)).toBe('invalid');expect(takeDraft(r,0,0,true)).toBe('invalid');expect(r).toEqual(before);
    expect(takeDraft(r,0,5)).toBe('place');expect(r.slots[0]).toEqual(before.slots[0]);expect(r.bench[0]!.copies).toBe(1);
  });
  it('two recruited bench L1s become L2 before they can merge with the battlefield L2',()=>{
    const r=newRun('argeon',1);r.slots[0]=owned('n_merc',2,10);r.draft=['n_merc','n_medic','n_bulwark'];
    expect(takeDraft(r,0,5)).toBe('place');expect(r.bench[0]!.copies).toBe(1);
    r.draft=['n_merc','n_medic','n_bulwark'];
    expect(takeDraft(r,0,5)).toBe('merge');expect(r.bench[0]!.copies).toBe(2);
    const rng=r.rngState,picks=r.picks;
    expect(moveSlot(r,5,0)).toBe('merge');expect(r.slots[0]).toEqual(owned('n_merc',4,10));expect(r.bench[0]).toBeNull();
    expect(r.rngState).toBe(rng);expect(r.picks).toBe(picks);
  });
  it('retry settlement preserves legal paired individuals and rejects a fabricated merge or illegal intermediate state',()=>{
    const checkpoint=newRun('argeon',1);checkpoint.slots[0]=owned('n_merc',2,10);checkpoint.bench[0]=owned('n_merc',2,11);
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
    const r=newRun('argeon',1);r.slots=Array.from({length:5},(_,i)=>owned('n_merc',1,i+1));r.bench=[owned('n_merc',1,6),owned('n_merc',1,7)];r.draft=['n_medic','n_bulwark','n_merc'];
    const before=cloneRun(r);expect(takeDraft(r,0,0)).toBe('confirm');expect(r).toEqual(before);
    expect(takeDraft(r,0,0,true)).toBe('replace');expect(r.picks).toBe(before.picks-1);expect(r.slots[0]!.defId).toBe('n_medic');
  });
  it('occupied battlefield recruitment first preserves the previous individual on free bench',()=>{
    const r=newRun('argeon',1);r.slots[0]=owned('n_merc',2,10);r.draft=['n_medic','n_bulwark','n_merc'];
    expect(takeDraft(r,0,0)).toBe('reserve');expect(r.bench[0]).toEqual(owned('n_merc',2,10));expect(r.slots[0]!.defId).toBe('n_medic');
  });
  it('full-star merge refusal does not globally ban recruiting another individual',()=>{
    const r=newRun('argeon',1);r.slots[0]=owned('n_merc',4,10);r.draft=['n_merc','n_bulwark','n_medic'];
    const before=cloneRun(r);expect(takeDraft(r,0,0)).toBe('invalid');expect(r).toEqual(before);
    expect(takeDraft(r,0,5)).toBe('place');expect(r.bench[0]!.ownedId).not.toBe(10);
  });
  it('boss draw consumes no life and grants no recruits, refresh, reroll or RNG advance',()=>{
    const r=newRun('argeon',2);r.stage=9;r.picks=0;r.rerolls=0;const before=cloneRun(r);
    expect(currentNode(r).kind).toBe('boss');applyResult(r,'draw');
    expect({...r,history:[]}).toEqual({...before,history:[]});expect(r.history).toEqual(['draw']);
  });
  it('bench identities never enter battle input through the battlefield API',()=>{
    const r=newRun('argeon',4);const before=r.rngState;
    expect(takeDraft(r,0,5)).toBe('place');expect(allOwned(r).filter(Boolean)).toHaveLength(1);expect(r.slots.some(Boolean)).toBe(false);expect(r.rngState).not.toBe(before);
  });
});
