import { simulate } from '../src/core/engine';
import { afterEach, expect, it, vi } from 'vitest';
import { UNIT_MAP, tagFamily } from '../src/core/data';
import { applyResult, beginBattle, buildBattle, cloneRun, commitPreparation, freezeDraft, newRun, reroll, rollDraft, sell, takeDraft, allocPoint, undoAlloc, moveSlot, sellPrice, tierCap, leaveShop, refreshShop, buy, canRewardedReroll, applyRewardedReroll, useOrder, orderOptions, draftPool, finishBattle, hireMerc, signMerc } from '../src/core/run';
import { loadRun, saveRun, SAVE_KEY } from '../src/core/save';
import { LEGACY_TIERS } from '../src/core/preparation';
import type { PrepEffect } from '../src/core/types';
const original = new Map<string, PrepEffect[] | undefined>();
function hook(id: string, prep: PrepEffect[]) { original.set(id, UNIT_MAP[id].prep); UNIT_MAP[id].prep = prep; }
afterEach(() => { for (const [id, prep] of original) UNIT_MAP[id].prep = prep; original.clear(); vi.unstubAllGlobals(); });
function storage() { const data = new Map<string,string>(); vi.stubGlobal('localStorage', {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v),removeItem:(k:string)=>data.delete(k)}); return data; }
it('new shelf uses five stable positions, paid purchases, refresh and freezing', () => {
 const r = newRun('lilithe',301); expect(r.gold).toBe(10); expect(r.activeFactions).toHaveLength(6); expect(r.draft).toHaveLength(5);
 const locked=r.draft[3]; expect(freezeDraft(r,3)).toBe(true); expect(takeDraft(r,0,0)).toBe('place'); expect(r.gold).toBe(7); expect(r.draft[0]).toBe('');
 expect(reroll(r)).toBe(true); expect(r.gold).toBe(6); expect(r.draft[3]).toBe(locked);
 r.gold=2; const before=cloneRun(r); expect(takeDraft(r,1,1)).toBe('invalid'); expect(r).toEqual(before);
});
it('unspent money expires, settlement bonuses enter only the next budget',()=>{
 const r=newRun('hank',302); r.gold=99; r.passives.push('g_pay'); applyResult(r,'win',4); expect(r.gold).toBe(17); expect(r.budgetBonus).toBe(0);
 const gold=r.gold; expect(r.pending).toBe(null); expect(r.gold).toBe(gold);
 expect([0,2,5,8,11,14].map(tierCap)).toEqual([1,2,3,4,5,6]);
});
it('deployed ally engines grow only after successful trades; growth survives merges and never refunds',()=>{
 hook('l_shield',[{event:'buy',scope:'ally',target:'self',atk:[2,2,2],cap:1}]);
 const r=newRun('lilithe',303); r.slots[0]={defId:'l_shield',ownedId:20,copies:1}; r.bench[0]={defId:'l_shield',ownedId:21,copies:1}; r.nextOwnedId=30;
 r.draft[0]='n_merc'; takeDraft(r,0,1); expect(r.slots[0]!.growth?.atk).toBe(2); expect(r.bench[0]!.growth).toBeUndefined();
 r.draft[1]='n_merc'; takeDraft(r,1,2); expect(r.slots[0]!.growth?.atk).toBe(2);
 expect(moveSlot(r,5,0)).toBe('merge'); expect(r.slots[0]!.growth?.atk).toBe(2);
 expect(sell(r,0)).toBe(true); expect(r.stash).toEqual({}); expect(sellPrice({defId:'l_shield',ownedId:2,copies:4},r)).toBe(3);
});
it('training is net committed once; battle previews predict without modifying the save',()=>{
 hook('l_shield',[{event:'train',scope:'self',target:'self',hp:[2,2,2]},{event:'endPrep',scope:'self',target:'self',atk:[1,1,1]}]);
 const r=newRun('lilithe',304); r.slots[0]={defId:'l_shield',ownedId:20,copies:1}; r.stash.atk=2;
 allocPoint(r,0,'atk'); undoAlloc(r); const initial=cloneRun(r); const preview=buildBattle(r); expect(r).toEqual(initial); expect(preview.player[0]!.growth).toEqual({atk:1});
 allocPoint(r,0,'atk'); const predicted=buildBattle(r); beginBattle(r,'win'); expect(buildBattle(r)).toEqual(predicted); const committed=cloneRun(r); beginBattle(r,'lose'); expect(r).toEqual(committed);
 expect(r.slots[0]!.growth).toEqual({hp:2,atk:1}); commitPreparation(r); expect(r.slots[0]!.growth).toEqual({hp:2,atk:1});
});
it('current save reload retains empty shelf, locks and economy without issuing money',()=>{
 storage(); const r=newRun('lilithe',305); takeDraft(r,0,0); freezeDraft(r,2); expect(saveRun(r)).toBe(true); const loaded=loadRun(); expect(loaded.kind).toBe('ok'); if(loaded.kind!=='ok')throw Error(); expect(loaded.run.gold).toBe(7); expect(loaded.run.draft[0]).toBe(''); expect(loaded.run.draftLocked![2]).toBe(true); expect(saveRun(loaded.run)).toBe(true);
});
it('legacy recruitment keeps frozen four-tier membership and free picks',()=>{
 const r=newRun('lilithe',306); delete r.economyVersion; r.gold=41; r.picks=2; r.draft=[]; rollDraft(r); expect(r.draft).toHaveLength(3); expect(r.draft.every(id=>LEGACY_TIERS[id]===1)).toBe(true); takeDraft(r,0,0); expect(r.gold).toBe(41); expect(r.picks).toBe(1);
});
it('malformed modern economy rejects the save and preserves raw data',()=>{
 const data=storage(),r=newRun('lilithe',307); const raw=JSON.stringify({...r,draftLocked:[true]}); data.set(SAVE_KEY,raw); expect(loadRun().kind).toBe('incompatible'); expect(data.get(SAVE_KEY)).toBe(raw);
});

it('special shop has a separate budget, one-gold refresh and frozen goods persist across it',()=>{
 const r=newRun('lilithe',401); r.node=2; r.draft[2]='n_merc'; freezeDraft(r,2); r.gold=44;
 applyResult(r,'win'); expect(r.shop).not.toBeNull(); expect(r.gold).toBe(10);
 const shop=r.shop!; expect(shop.units.every(u=>u.price===3)).toBe(true);
 expect(refreshShop(r)).toBe(true); expect(r.gold).toBe(9); expect(r.shop!.refreshCost).toBe(1);
 r.gold=0; const before=cloneRun(r); expect(buy(r,'units')).toBe(false); expect(r).toEqual(before);
 r.gold=88; expect(leaveShop(r)).toBe(true); expect(r.gold).toBe(10); expect(r.draft[2]).toBe('n_merc'); expect(r.draftLocked![2]).toBe(true);
});
it('legacy save continues trade, battle, save and reload without adopting modern economy',()=>{
 storage(); const r=newRun('lilithe',402); delete r.economyVersion; delete r.draftLocked; r.picks=2; r.draft=[]; rollDraft(r); r.gold=41;
 expect(saveRun(r)).toBe(true); const first=loadRun(); if(first.kind!=='ok')throw Error(); expect(first.run.economyVersion).toBeUndefined(); takeDraft(first.run,0,0); beginBattle(first.run,'win'); expect(saveRun(first.run)).toBe(true);
 const settled=loadRun(); if(settled.kind!=='ok')throw Error(); expect(settled.run.gold).toBe(44); expect(settled.run.economyVersion).toBeUndefined(); expect(saveRun(settled.run)).toBe(true);
 const again=loadRun(); expect(again.kind).toBe('ok'); if(again.kind==='ok')expect(again.run.gold).toBe(44);
});

it('modern ads only unlock after wallet exhaustion and never consume a fully frozen shelf',()=>{
 const r=newRun('lilithe',501); expect(canRewardedReroll(r)).toBe(false); r.gold=0; expect(canRewardedReroll(r)).toBe(true); expect(applyRewardedReroll(r)).toBe(true); expect(r.gold).toBe(0); expect(r.rewardedRerollCount).toBe(1);
 r.draftLocked=Array(5).fill(true); const before=cloneRun(r); expect(applyRewardedReroll(r)).toBe(false); expect(r).toEqual(before);
});
it('recipient tags and full persistent stats govern preparation targeting',()=>{
 hook('l_shield',[{event:'endPrep',scope:'self',target:'others',targetTag:'亡语',hp:[2,2,2]},{event:'endPrep',scope:'self',target:'lowestHp',atk:[3,3,3]}]);
 const r=newRun('lilithe',502); r.slots=[{defId:'l_shield',ownedId:10,copies:1},{defId:'l_martyr',ownedId:11,copies:4,train:{hp:8}},{defId:'n_merc',ownedId:12,copies:1},null,null];
 commitPreparation(r); expect(r.slots[1]!.growth?.hp).toBe(2); expect(r.slots[2]!.growth?.hp).toBeUndefined(); expect(r.slots[2]!.growth?.atk).toBe(3);
});

it('repeated boss draws cannot mint budgets, engine growth, battle gold or Hank extras',()=>{
 hook('l_shield',[{event:'endPrep',scope:'self',target:'self',atk:[1,1,1]}]);
 const r=newRun('hank',601); r.node=8; r.slots[0]={defId:'l_shield',ownedId:20,copies:1}; r.passives.push('hank_4'); r.gold=2; r.merc={id:'n_merc',price:0,sold:true};
 const spells=[...r.spells],merc={...r.merc};
 for(let i=0;i<3;i++){beginBattle(r,'draw',50); const pending=r.pending!; expect(pending).toBeTruthy(); applyResult(r,'draw',50); r.pending=null;}
 expect(r.gold).toBe(2); expect(r.budgetBonus).toBe(0); expect(r.slots[0]!.growth?.atk).toBe(1); expect(r.spells).toEqual(spells); expect(r.merc).toEqual(merc);
});
it('recruitment orders retain five positions with small pools and protect named goods from locks',()=>{
 storage(); const r=newRun('lilithe',602); r.slots[0]={defId:'n_merc',ownedId:20,copies:1}; r.orders=['o_named']; r.draftLocked=[true,true,true,true,false]; const locked=r.draft.slice(0,4);
 expect(useOrder(r,0,'n_merc')).toBe(true); expect(r.draft.slice(0,4)).toEqual(locked); expect(r.draft[4]).toBe('n_merc'); expect(r.draft).toHaveLength(5); expect(saveRun(r)).toBe(true); expect(loadRun().kind).toBe('ok');
 r.orders=['o_named']; r.draftLocked=Array(5).fill(true); const before=cloneRun(r); expect(useOrder(r,0,'n_merc')).toBe(false); expect(r).toEqual(before);
 r.draftLocked=Array(5).fill(false); expect(useOrder(r,0,'n_merc')).toBe(true); expect(r.draft.filter(Boolean)).toHaveLength(5);
});
it('buy-merge runs one-star self buy before upgraded self hooks, with no ghost source',()=>{
 hook('l_shield',[{event:'buy',scope:'self',target:'self',atk:[1,20,30]},{event:'upgrade',scope:'ally',target:'event',hp:[1,20,30]},{event:'upgrade',scope:'self',target:'self',atk:[2,4,6]}]);
 const r=newRun('lilithe',603); r.slots[0]={defId:'l_shield',ownedId:20,copies:1}; r.nextOwnedId=30; r.draft[0]='l_shield';
 expect(takeDraft(r,0,0)).toBe('merge'); expect(r.slots[0]!.copies).toBe(2); expect(r.slots[0]!.growth).toEqual({atk:5,hp:0,power:0}); expect(Object.keys(r.prepUses!).some(k=>k.startsWith('30:'))).toBe(false);
 const x=newRun('lilithe',604); x.slots[0]={defId:'l_shield',ownedId:10,copies:1}; x.slots[1]={defId:'l_shield',ownedId:11,copies:1};
 expect(moveSlot(x,1,0)).toBe('merge'); expect(x.slots[0]!.growth?.hp).toBeUndefined(); expect(x.slots[0]!.growth?.atk).toBe(4);
});
it('legacy free economy still receives new preparation hooks, while historical pending results do not backfill growth',()=>{
 const data=storage(); hook('l_shield',[{event:'buy',scope:'self',target:'self',atk:[1,2,3]},{event:'endPrep',scope:'self',target:'self',hp:[2,4,6]}]);
 const r=newRun('lilithe',605); delete r.economyVersion; r.picks=2; r.draft=['l_shield','n_merc','l_martyr']; r.gold=40; takeDraft(r,0,0); expect(r.gold).toBe(40); expect(r.slots[0]!.growth?.atk).toBe(1);
 const preview=buildBattle(r); expect(preview.player[0]!.growth?.hp).toBe(2); expect(r.slots[0]!.growth?.hp).toBeUndefined();
 delete r.prepCommitted; r.pending={result:'win',gold:0}; data.set(SAVE_KEY,JSON.stringify(r)); const loaded=loadRun(); if(loaded.kind!=='ok')throw Error(); expect(loaded.run.slots[0]!.growth?.hp).toBeUndefined(); expect(loaded.run.gold).toBe(43); expect(loaded.run.prepCommitted).toBe(false);
 beginBattle(loaded.run,'win'); expect(loaded.run.slots[0]!.growth?.hp).toBe(2);
});

it('small tagged order pools fill remaining fixed positions with empty goods and save correctly',()=>{
 storage(); const r=newRun('lilithe',607); r.orders=['o_tag']; const pool=draftPool(r);
 const choice=orderOptions(r,'o_tag').find(tag=>{ const n=pool.filter(d=>(d.tags??[]).some(t=>t===tag||tagFamily(t)===tag)).length; return n>0&&n<5; });
 expect(choice).toBeTruthy(); expect(useOrder(r,0,choice!)).toBe(true); expect(r.draft).toHaveLength(5); expect(r.draft.filter(Boolean).length).toBeLessThan(5); expect(saveRun(r)).toBe(true); expect(loadRun().kind).toBe('ok');
});

it('special shop global boon buys once, powers the next battle and survives save/reload',()=>{
 storage(); const r=newRun('reva',701,{legacyRules:true}); r.passives=['g_drill','g_horde','g_store','g_relay','g_ember','g_tide','g_martyr']; r.slots[0]={defId:'n_merc',ownedId:10,copies:1};
 r.node=2; applyResult(r,'win'); expect(r.shop!.boon).toEqual({id:'g_wall',price:6,sold:false}); expect(r.shop!.spells).toHaveLength(1); expect(r.shop!.equips.length+r.shop!.spells.length+1+1+1).toBe(6); const before=r.gold;
 expect(buy(r,'boon')).toBe(true); expect(r.gold).toBe(before-6); expect(r.passives.filter(id=>id==='g_wall')).toHaveLength(1);
 r.shop!.boon!.sold=false; r.gold=10; const duplicate=cloneRun(r); expect(buy(r,'boon')).toBe(false); expect(r).toEqual(duplicate);
 expect(saveRun(r)).toBe(true); const loaded=loadRun(); if(loaded.kind!=='ok')throw Error(); expect(loaded.run.passives).toContain('g_wall');
 expect(leaveShop(loaded.run)).toBe(true); const out=simulate(buildBattle(loaded.run)); expect(out.fault).toBeUndefined(); expect(out.afterStart.filter(u=>u.side===0)).toHaveLength(1); expect(out.afterStart.filter(u=>u.side===0).every(u=>u.block===1)).toBe(true);
 expect(saveRun(loaded.run)).toBe(true); const again=loadRun(); if(again.kind!=='ok')throw Error(); expect(again.run.passives.filter(id=>id==='g_wall')).toHaveLength(1);
});
it('invalid global boon references and unsafe prices reject the save without rewriting it',()=>{
 const data=storage(); for(const boon of [{id:'missing',price:6,sold:false},{id:'argeon_1',price:6,sold:false},{id:'g_wall',price:-1,sold:false},{id:'g_wall',price:0.5,sold:false}]) {
  const r=newRun('lilithe',702); r.node=2; applyResult(r,'win'); r.shop!.boon=boon; const raw=JSON.stringify(r); data.set(SAVE_KEY,raw); expect(loadRun().kind).toBe('incompatible'); expect(data.get(SAVE_KEY)).toBe(raw);
 }
});

it('boss draw accepts new training and end-prep sources without replaying consumed growth across preview, commit or reload',()=>{
 storage();
 hook('l_shield',[{event:'endPrep',scope:'self',target:'self',hp:[1,1,1]},{event:'train',scope:'ally',target:'event',atk:[2,2,2],cap:2}]);
 const r=newRun('hank',801); r.node=8; r.gold=9; r.passives=['hank_4']; r.slots[0]={defId:'l_shield',ownedId:10,copies:1}; r.slots[1]={defId:'n_merc',ownedId:11,copies:1}; r.nextOwnedId=20;
 for(let i=0;i<2;i++){ beginBattle(r,'draw',30); expect(finishBattle(r)).toBe(true); }
 expect(r.gold).toBe(9); expect(r.slots[0]!.growth?.hp).toBe(1); const spells=[...r.spells];
 r.stash.atk=1; expect(allocPoint(r,1,'atk')).toBe(true); expect(r.prepCommitted).toBe(false);
 const before=cloneRun(r),preview=buildBattle(r); expect(r).toEqual(before); expect(buildBattle(r)).toEqual(preview); expect(preview.player[1]!.growth?.atk).toBe(2); expect(preview.player[0]!.growth?.hp).toBe(1);
 beginBattle(r,'draw',30); expect(buildBattle(r)).toEqual(preview); expect(saveRun(r)).toBe(true);
 const loaded=loadRun(); if(loaded.kind!=='ok')throw Error(); expect(loaded.run.slots[1]!.growth?.atk).toBe(2); expect(loaded.run.gold).toBe(9); expect(loaded.run.spells).toEqual(spells); expect(saveRun(loaded.run)).toBe(true);
 const again=loadRun(); if(again.kind!=='ok')throw Error(); expect(again.run.slots[1]!.growth?.atk).toBe(2);
 again.run.draft[0]='l_shield'; expect(takeDraft(again.run,0,2)).toBe('place'); const fresh=buildBattle(again.run); expect(fresh.player[0]!.growth?.hp).toBe(1); expect(fresh.player[2]!.growth?.hp).toBe(1);
 beginBattle(again.run,'draw',30); finishBattle(again.run); expect(again.run.slots[0]!.growth?.hp).toBe(1); expect(again.run.slots[2]!.growth?.hp).toBe(1); expect(again.run.gold).toBe(6);
 const rejected=cloneRun(again.run); expect(takeDraft(again.run,0,2)).toBe('invalid'); expect(again.run).toEqual(rejected);
});

it('shops without eligible boons retain two spells and legacy shops do not offer boons',()=>{
 const r=newRun('lilithe',802); r.passives=['g_wall','g_drill','g_horde','g_store','g_relay','g_ember','g_tide','g_martyr']; r.node=2; applyResult(r,'win'); expect(r.shop!.boon).toBeNull(); expect(r.shop!.spells).toHaveLength(2);
 const legacy=newRun('lilithe',803,{legacyEconomy:true}); legacy.node=2; applyResult(legacy,'win'); expect(legacy.shop!.boon).toBeUndefined(); expect(legacy.shop!.spells).toHaveLength(2);
});

it('Hank signing is exactly one paid permanent purchase, while temporary hiring never fires buy hooks',()=>{
 hook('n_merc',[{event:'buy',scope:'self',target:'self',atk:[1,2,3]}]); hook('l_shield',[{event:'buy',scope:'ally',target:'self',hp:[2,2,2]}]);
 const r=newRun('hank',901); r.slots[0]={defId:'l_shield',ownedId:20,copies:1}; r.merc={id:'n_merc',price:0,sold:false}; r.passives=['hank_1']; r.nextOwnedId=30;
 expect(hireMerc(r)).toBe(true); expect(r.slots[1]!.temp).toBe(true); expect(r.slots[1]!.growth).toBeUndefined(); expect(r.slots[0]!.growth).toBeUndefined();
 expect(signMerc(r,1)).toBe(true); expect(r.gold).toBe(7); expect(r.slots[1]!.temp).toBeUndefined(); expect(r.slots[1]!.growth?.atk).toBe(1); expect(r.slots[0]!.growth?.hp).toBe(2);
 const signed=cloneRun(r); expect(signMerc(r,1)).toBe(false); expect(r).toEqual(signed);
});
it('invalid signing phases and unaffordable contracts have no purchase growth or other mutations',()=>{
 hook('n_merc',[{event:'buy',scope:'self',target:'self',atk:[1,2,3]}]);
 for(const state of ['pending','over','shop','promo','fork','gold','passive','general','slot']){
  const r=newRun('hank',902); r.slots[0]={defId:'n_merc',ownedId:20,copies:1,temp:true}; r.passives=['hank_1'];
  if(state==='pending')r.pending={result:'win',gold:0}; if(state==='over')r.over='defeat'; if(state==='shop')r.node=3; if(state==='promo')r.promo=['g_wall']; if(state==='fork')r.node=5; if(state==='gold')r.gold=2; if(state==='passive')r.passives=[]; if(state==='general')r.general='reva';
  const before=cloneRun(r); expect(signMerc(r,state==='slot'?-1:0)).toBe(false); expect(r).toEqual(before);
 }
});
