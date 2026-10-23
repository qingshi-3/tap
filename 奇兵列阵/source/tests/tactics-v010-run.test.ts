import { afterEach, expect, it, vi } from 'vitest';
import { UNIT_MAP } from '../src/core/data';
import { TACTIC_IDS } from '../src/core/content';
import { generalChoices,newRun,modernTactics,setGeneralOrder,takeDraft,moveSlot,sell,cloneRun,buildBattle,canTrainGeneral,allocPoint,applyResult,leaveShop,choosePromo,pickFork,beginBattle,finishBattle,type RunState } from '../src/core/run';
import { benefitsFromSpellPower } from '../src/core/preparation';
import { loadRun,saveRun,SAVE_KEY } from '../src/core/save';
import { simulate } from '../src/core/engine';
function store(){const data=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,String(v)),removeItem:(k:string)=>data.delete(k)});return data;}
afterEach(()=>vi.unstubAllGlobals());
it('current entry draws three distinct of four generals; legacy invocation remains explicit',()=>{
 const found=new Set<string>();for(let seed=1;seed<=40;seed++){const ids=generalChoices(seed);expect(ids).toHaveLength(3);expect(new Set(ids).size).toBe(3);ids.forEach(id=>{expect(['reva','zilan','sajj','kaleos']).toContain(id);found.add(id);});}expect(found.size).toBe(4);
 for(const id of ['reva','zilan','sajj','kaleos']){expect(modernTactics(newRun(id,1))).toBe(true);expect(modernTactics(newRun(id,1,{legacyRules:true}))).toBe(false);expect(modernTactics(newRun(id,1,{legacyEconomy:true}))).toBe(false);}
 expect(modernTactics(newRun('hank',1))).toBe(false);
});
it('target order persists by identity, follows a merge and clears on sale; bench cannot be selected',()=>{
 const r=newRun('zilan',2);r.slots[0]={defId:'n_merc',ownedId:10,copies:1};r.slots[1]={defId:'n_merc',ownedId:11,copies:1};r.bench[0]={defId:'n_medic',ownedId:12,copies:1};
 expect(setGeneralOrder(r,11)).toBe(true);expect(moveSlot(r,1,0)).toBe('merge');expect(r.commandTarget).toBe(10);expect(buildBattle(r).general).toMatchObject({tacticsVersion:1,commandTarget:10});
 expect(moveSlot(r,0,6)).toBe('move');expect(r.commandTarget).toBe(10);const before=cloneRun(r);expect(setGeneralOrder(r,10)).toBe(false);expect(r).toEqual(before);expect(setGeneralOrder(r,12)).toBe(false);
 expect(setGeneralOrder(r,null)).toBe(true);expect(r.commandTarget).toBeUndefined();moveSlot(r,6,0);setGeneralOrder(r,10);expect(sell(r,0)).toBe(true);expect(r.commandTarget).toBeUndefined();
});
it.each(['general','legacy','pending','over','shop','promo','unknown'] as const)('rejected %s order mutates nothing',state=>{
 const r=newRun('kaleos',3);r.slots[0]={defId:'n_merc',ownedId:10,copies:1};if(state==='general')r.general='reva';if(state==='legacy')delete r.tacticsVersion;if(state==='pending')r.pending={result:'win',gold:0};if(state==='over')r.over='defeat';if(state==='shop')r.node=3;if(state==='promo')r.promo=['g_pay'];const before=cloneRun(r);expect(setGeneralOrder(r,state==='unknown'?999:10)).toBe(false);expect(r).toEqual(before);
});
it('new generals reject useless general power investments while old contracts still accept them',()=>{
 for(const id of ['reva','zilan','sajj','kaleos']){const r=newRun(id,4);r.stash.power=1;const before=cloneRun(r);expect(canTrainGeneral(r)).toBe(false);expect(allocPoint(r,'general','power')).toBe(false);expect(r).toEqual(before);}
 const old=newRun('kaleos',4,{legacyRules:true});expect(canTrainGeneral(old)).toBe(true);
});
it('spell-benefit filter uses actual positive powered spell operations rather than tags',()=>{
 const def=UNIT_MAP.n_merc,oldCast=def.cast,oldCharge=def.chargeSkill;
 try{for(const op of ['freeze','summon','extraAct','rotate','addAction'] as const){def.cast=[{op,to:'enemyFront',v:[2,2,2]}];delete def.chargeSkill;expect(benefitsFromSpellPower(def.id)).toBe(false);}for(const op of ['dmg','heal','burn','chill'] as const){def.cast=[{op,to:'enemyFront',v:[1,1,1]}];expect(benefitsFromSpellPower(def.id)).toBe(true);}def.cast=[{op:'dmg',to:'enemyFront',v:[0,0,0]}];expect(benefitsFromSpellPower(def.id)).toBe(false);def.chargeSkill=[{op:'dmg',to:'enemyAll',v:[1,1,1]}];expect(benefitsFromSpellPower(def.id)).toBe(true);}finally{def.cast=oldCast;def.chargeSkill=oldCharge;}
});
it('new special shop has no boon or hourglass, old shop and inventories remain supported',()=>{
 const modern=newRun('reva',5);modern.node=2;applyResult(modern,'win');expect(modern.shop!.boon).toBeUndefined();expect(modern.shop!.equips.some(e=>e.id==='eq_hourglass')).toBe(false);expect(modern.shop!.spells).toHaveLength(3);expect(modern.shop!.order).toBeNull();
 const old=newRun('reva',5,{legacyRules:true});old.node=2;applyResult(old,'win');expect(old.shop).not.toBeNull();expect('boon'in old.shop!).toBe(true);
});
it('new and legacy runs trade, play a real battle, save and reload with unchanged rules',()=>{
 for(const legacyRules of [false,true]){store();const r=newRun('zilan',8,{legacyRules});takeDraft(r,0,0);if(!legacyRules)expect(setGeneralOrder(r,r.slots[0]!.ownedId)).toBe(true);expect(saveRun(r)).toBe(true);let result=loadRun();if(result.kind!=='ok')throw Error();const loaded=result.run;expect(modernTactics(loaded)).toBe(!legacyRules);expect(loaded.gold).toBe(7);const out=simulate(buildBattle(loaded));expect(out.fault).toBeUndefined();beginBattle(loaded,out.result,out.gold,out.eggStats);expect(saveRun(loaded)).toBe(true);result=loadRun();if(result.kind!=='ok')throw Error();expect(result.run.history).toHaveLength(1);expect(modernTactics(result.run)).toBe(!legacyRules);expect(saveRun(result.run)).toBe(true);}
});
it('unknown rule markers reject without overwriting durable raw data',()=>{
 const data=store(),r=newRun('reva',9),raw=JSON.stringify({...r,tacticsVersion:99});data.set(SAVE_KEY,raw);expect(loadRun().kind).toBe('incompatible');expect(data.get(SAVE_KEY)).toBe(raw);
});

it('pyro buy growth accepts real spell scaling but rejects control-only and action-only spell labels',()=>{
 const r=newRun('reva',17);r.slots[0]={defId:'d_pyro',ownedId:20,copies:1};r.nextOwnedId=30;
 const d=UNIT_MAP.n_archer,old=d.cast,oldCharge=d.chargeSkill;
 try{delete d.chargeSkill;d.cast=[{op:'freeze',to:'enemyFront',v:[1,1,1]}];r.draft[0]=d.id;takeDraft(r,0,1);expect(r.slots[1]!.growth?.power).toBeUndefined();
 d.cast=[{op:'extraAct',to:'self',v:[1,1,1]}];r.draft[1]=d.id;takeDraft(r,1,2);expect(r.slots[2]!.growth?.power).toBeUndefined();
 d.cast=[{op:'dmg',to:'enemyFront',v:[1,1,1]}];r.draft[2]=d.id;takeDraft(r,2,3);expect(r.slots[3]!.growth?.power).toBe(1);expect(r.slots[3]!.growth?.atk??0).toBe(0);
 }finally{d.cast=old;d.chargeSkill=oldCharge;}
});

it('exactly two shared tactics are offered after the fourth fight of chapters one and two, never shop or boss',()=>{
 const r=newRun('zilan',22);r.slots[0]={defId:'n_archer',ownedId:10,copies:1};
 for(let battle=0;battle<3;battle++)applyResult(r,'win');expect(r.node).toBe(3);expect(r.promo).toBeNull();leaveShop(r);expect(r.node).toBe(4);expect(r.promo).toBeNull();
 beginBattle(r,'lose');finishBattle(r);expect(r.node).toBe(5);expect(r.promo).toHaveLength(3);expect(r.promo!.every(id=>(TACTIC_IDS as readonly string[]).includes(id))).toBe(true);expect(finishBattle(r)).toBe(false);
 const offer=[...r.promo!];expect(choosePromo(r,99)).toBe(false);expect(r.promo).toEqual(offer);expect(choosePromo(r,0)).toBe(true);expect(r.promoCount).toBe(1);expect(choosePromo(r,0)).toBe(false);
 r.node=8;applyResult(r,'win');expect(r.chapter).toBe(1);expect(r.promo).toBeNull();
 r.node=4;beginBattle(r,'win');finishBattle(r);expect(r.promo).toHaveLength(3);expect(r.promo!.some(id=>r.passives.includes(id))).toBe(false);expect(choosePromo(r,0)).toBe(true);expect(r.promoCount).toBe(2);
 r.node=8;applyResult(r,'win');expect(r.promo).toBeNull();r.node=4;applyResult(r,'win');expect(r.promo).toBeNull();expect(r.promoCount).toBe(2);
});
it('shared tactics accept real non-scaling spells and charged spells, but not attack-only actors',()=>{
 const def=UNIT_MAP.n_archer,old=def.cast,oldCharge=def.chargeSkill;
 const offered=()=>{let found=false;for(let seed=1;seed<=40;seed++){const r=newRun('reva',seed);r.slots[0]={defId:def.id,ownedId:10,copies:1};r.node=4;applyResult(r,'win');found ||=r.promo!.includes('g_surge');}return found;};
 try{delete def.cast;delete def.chargeSkill;expect(offered()).toBe(false);
 def.cast=[{op:'extraAct',to:'self',v:[1,1,1]}];expect(offered()).toBe(true);
 delete def.cast;def.chargeSkill=[{op:'dmg',to:'enemyFront',v:[1,1,1]}];expect(offered()).toBe(true);
 }finally{def.cast=old;def.chargeSkill=oldCharge;}
});
