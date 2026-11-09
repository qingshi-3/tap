// @ts-ignore Node's runtime assertion module is available to the test runner.
import assert from 'node:assert/strict';
import { FOOD, FOODS, FOOD_POOL, SPELL_POOL, RELICS, STAT_CAP, CARD, card } from '../src/core/data';
import { simulate, motleyCount, type UnitSpec, type GrantedAbility } from '../src/core/engine';
import { newRun, useFood, endTurn, save, load, SAVE_KEY, HAND_BASE, moveOwned, sell, discardHandCard, settleBattle, trialFight, openRelic, adRelic, pickRelic, ownedHp, ownedAtk, spellTargetOk, castHandSpell, fight, type Owned, type ShopItem, type RunState } from '../src/core/run';
const mk = (oid:number, def='s_fox'):Owned => ({oid,def,copies:1,atkBonus:0,hpBonus:0});
const unit = (def:string, atk:number, hp:number, extra:Partial<UnitSpec>={}):UnitSpec => ({def,atk,hp,lvl:1,...extra});
const ability = (id:GrantedAbility['id'], value:number, tempered=false):GrantedAbility => ({id,value,duration:id==='blood'?'battle':'permanent',source:'test',tempered});
const setup = (seed=1) => { const r=newRun(seed,{solo:true}); r.gold=99; r.nextId=1000; r.queue[0]=mk(100); return r; };
const cast = (r:RunState, def:string, target:number|null=0, replace=false, source?:number) => { const item:ShopItem={sid:r.nextId++,kind:'food',def,locked:false,free:false}; r.shop.push(item); return useFood(r,item.sid,target,replace,source); };
const storage=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)}});
assert.equal(FOOD.x_ready.tier,4); assert.equal(FOODS.some(f=>f.id==='f_elixir'),false); assert.equal([...FOOD_POOL,...SPELL_POOL].some(f=>f.id==='f_elixir'),false);
const legacy=setup(); legacy.hand[0]={kind:'spell',oid:200,def:'f_elixir',val:[7,8],source:'old',obtainedTurn:1}; legacy.shop.push({sid:201,kind:'food',def:'f_elixir',val:[3,4],locked:false,free:false}); legacy.discover=[{opts:['f_elixir'],src:'old',mode:'spell',price:0,val:[5,6]}]; legacy.rewards=[{id:202,source:'old',card:{kind:'spell',oid:203,def:'f_elixir',val:[9,10],source:'old',obtainedTurn:1}}]; delete legacy.firstRelicGiven;
storage.set(SAVE_KEY,JSON.stringify(legacy)); const migrated=load()!; assert.ok(migrated); assert.equal(migrated.firstRelicGiven,true); assert.equal(migrated.hand[0]!.def,'x_copy'); assert.deepEqual((migrated.hand[0] as any).val,[7,8]); assert.deepEqual(migrated.shop.find(x=>x.sid===201)?.val,[3,4]); assert.equal(migrated.shop.find(x=>x.sid===201)?.def,'x_copy'); assert.deepEqual(migrated.discover![0].val,[5,6]); assert.equal(migrated.discover![0].opts[0],'x_copy'); assert.equal(migrated.rewards![0].card.def,'x_copy'); assert.deepEqual((migrated.rewards![0].card as any).val,[9,10]);
for (const [id,val] of [['bone',2],['spark',2],['thorn',2],['sprout',1]] as const) { const r=setup(); r.queue[0]!.granted=ability(id,val); assert.equal(cast(r,'x_temper').ok,true); assert.equal(r.queue[0]!.granted!.value,val*2); assert.equal(r.queue[0]!.granted!.tempered,true); const gold=r.gold; assert.equal(cast(r,'x_temper').ok,false); assert.equal(r.gold,gold); }
const blood=setup(); blood.queue[0]!.granted=ability('blood',2); assert.equal(cast(blood,'x_temper').ok,false);
const transfer=setup(); transfer.queue[0]!.granted=ability('thorn',4,true); transfer.queue[1]=mk(101); assert.equal(cast(transfer,'x_transfer',1,false,0).ok,true); assert.equal(transfer.queue[1]!.granted!.tempered,true); assert.equal(transfer.queue[1]!.granted!.value,4);
const merge=setup(); merge.queue[0]!.granted=ability('thorn',2); merge.hand[0]=mk(101); (merge.hand[0] as Owned).granted=ability('thorn',4,true); assert.ok(moveOwned(merge,HAND_BASE,0)); assert.equal(merge.queue[0]!.granted!.value,4); assert.equal(merge.queue[0]!.granted!.tempered,true);
const replace=setup(); replace.queue[0]!.granted=ability('bone',2); const beforeGold=replace.gold; assert.equal(cast(replace,'x_thorn').ok,false); assert.equal(replace.gold,beforeGold); assert.equal(replace.queue[0]!.granted!.id,'bone'); assert.equal(cast(replace,'x_thorn',0,true).ok,true); assert.equal(replace.queue[0]!.granted!.value,2);
const sprout=setup(); assert.equal(cast(sprout,'x_sprout').ok,true); endTurn(sprout); assert.equal(sprout.queue[0]!.atkBonus,0); assert.equal(sprout.queue[0]!.hpBonus,1); save(sprout); const resumed=load()!; endTurn(resumed); assert.equal(resumed.queue[0]!.atkBonus,0); assert.equal(resumed.queue[0]!.hpBonus,1);
const crown=setup(); crown.queue[0]!.copies=2; assert.equal(cast(crown,'x_crown').ok,true); assert.equal(crown.queue[0]!.copies,3); assert.equal(cast(crown,'x_crown').ok,false); const high=setup(); high.queue[0]=mk(100,'d_pharaoh'); assert.ok(card('d_pharaoh').tier>4); assert.equal(cast(high,'x_crown').ok,false);
const repeat=setup(); repeat.queue[1]=mk(101,'d_pharaoh'); assert.equal(cast(repeat,'x_crown').ok,true); assert.equal(repeat.queue[0]!.copies,3); assert.equal(repeat.discover?.filter(d=>d.src.startsWith('金色')).length,1);
const thorn=ability('thorn',2); const duel=simulate([unit('s_fox',1,30,{granted:thorn})],[unit('e_skel',1,30,{granted:thorn})],2); assert.ok(duel.events.some(e=>e.t==='dmg'&&e.src===1&&e.tgt===2&&e.n===2)); assert.ok(duel.events.length<500);
const blocked=simulate([unit('s_fox',1,10,{granted:thorn,startBlock:1})],[unit('e_skel',1,10)],2); const firstBlocked=blocked.events.findIndex(e=>e.t==='dmg'&&e.tgt===1&&e.blocked); assert.ok(firstBlocked>=0); assert.notEqual(blocked.events[firstBlocked+1]?.t,'dmg');
const vg=simulate([unit('s_fox',1,1,{oid:100,lamp:true})],[unit('e_skel',10,100)],1,['r_vanguard']); assert.deepEqual(vg.perm[100],{atk:0,hp:1}); const capped=setup(); capped.queue[0]!.hpBonus=STAT_CAP; settleBattle(capped,{result:'win',perm:{100:{atk:0,hp:1}},settlementId:'cap'}); assert.equal(ownedHp(capped.queue[0]!),STAT_CAP);
assert.ok(motleyCount(['s_fox','e_skel'])<3); const defs=Object.values(CARD).filter(x=>!x.enemy&&!x.token); const distinct=defs.filter((x,i,a)=>x.line!=='any'&&a.findIndex(y=>y.line===x.line)===i).slice(0,3).map(x=>x.id); assert.equal(motleyCount(distinct),3);
const pouch=setup(); pouch.relics=['r_pouch']; pouch.hand[0]=mk(101); const g=pouch.gold; assert.equal(sell(pouch,0)!.gold,2); assert.equal(sell(pouch,HAND_BASE)!.gold,2); assert.equal(pouch.gold,g+4); pouch.hand[0]=mk(102); const g2=pouch.gold; assert.equal(discardHandCard(pouch,HAND_BASE),true); assert.equal(pouch.gold,g2); pouch.queue[0]=mk(103); const g3=pouch.gold; assert.equal(cast(pouch,'x_dismiss').ok,true); assert.equal(pouch.gold,g3-(FOOD.x_dismiss.price??3)+3);
for (const result of ['win','lose'] as const) { const r=setup(); r.relics=['r_runebox']; r.tavern=3; r.hand=[mk(1),mk(2),mk(3),mk(4),null]; const trial=JSON.stringify(r); trialFight(r); assert.equal(JSON.stringify(r),trial); settleBattle(r,{result,perm:{},settlementId:'one'}); const rewards=r.rewards!.filter(x=>x.source==='符文匣'); assert.equal(rewards.length,result==='win'?1:0); if (rewards.length) assert.ok(FOOD[rewards[0].card.def].tier<=3); const snap=JSON.stringify(r); settleBattle(r,{result,perm:{},settlementId:'one'}); assert.equal(JSON.stringify(r),snap); }
const ember=setup(); ember.relics=['r_ember']; assert.equal(cast(ember,'x_ignite').ok,true); assert.equal(ember.queue[0]!.atkBonus,1); assert.equal(ember.queue[0]!.hpBonus,1); const permanent=setup(); permanent.relics=['r_ember']; assert.equal(cast(permanent,'f_bread').ok,true); assert.equal(permanent.queue[0]!.atkBonus,FOOD.f_bread.atk); 
for (const result of ['win','lose'] as const) { const r=setup(); settleBattle(r,{result,perm:{},settlementId:'first'}); assert.equal(r.firstRelicGiven,true); assert.ok(r.relicPick); const first=r.relicPick!.opts; assert.equal(new Set(first).size,first.length); assert.ok(first.every(x=>['r_share','r_vanguard','r_relay','r_reserve','r_runebox','r_ember','r_motley','r_training'].includes(x))); const snap=JSON.stringify(r); settleBattle(r,{result,perm:{},settlementId:'first'}); assert.equal(JSON.stringify(r),snap); assert.equal(adRelic(r),true); assert.equal(new Set(r.relicPick!.opts).size,r.relicPick!.opts.length); }
const dead=setup(); dead.lives=1; settleBattle(dead,{result:'lose',perm:{},settlementId:'death'}); assert.equal(dead.phase,'lost'); assert.equal(dead.firstRelicGiven,true); assert.equal(dead.relicPick,null);
const deterministic=(seed:number)=>{const r=setup(seed); r.relicDue=1; r.firstRelicPending=true; openRelic(r); return r.relicPick!.opts;}; assert.deepEqual(deterministic(77),deterministic(77));
const scarce=setup(); scarce.relics=RELICS.map(x=>x.id).filter(x=>x!=='r_share'); scarce.relicDue=1; scarce.firstRelicPending=true; openRelic(scarce); assert.deepEqual(scarce.relicPick!.opts,['r_share']);
// When the only unowned legal first choices are a common and the rare flag, both remain eligible.
assert.equal(RELICS.find(x=>x.id==='r_training')?.rarity,'rare'); const rareFirst=setup(); rareFirst.relics=RELICS.map(x=>x.id).filter(x=>x!=='r_share'&&x!=='r_training'); rareFirst.relicDue=1; rareFirst.firstRelicPending=true; openRelic(rareFirst); assert.deepEqual(rareFirst.relicPick!.opts,['r_share','r_training']);



// Six or more summons still activate brood only five times.
const brood=simulate(Array.from({length:5},(_,i)=>unit('a_imp',1,1,{granted:ability('bone',2),oid:300+i})),[unit('e_skel',30,500)],11,['r_brood']);
assert.ok((brood.summons??0)>=6); assert.equal(brood.events.filter(e=>e.t==='trigger'&&e.label==='繁衍号').length,5);
// Friendly damage cannot reflect; enemy thorn and native thornback share the recursion guard.
const friendly=simulate([unit('l_caliber',1,30),unit('s_fox',1,30,{granted:thorn})],[unit('e_skel',1,30)],12);
const friendlyHit=friendly.events.findIndex(e=>e.t==='dmg'&&e.src===1&&e.tgt===2); assert.ok(friendlyHit>=0); assert.ok(!friendly.events.slice(friendlyHit+1,friendlyHit+3).some(e=>e.t==='dmg'&&e.src===2&&e.tgt===1));
const spider=simulate([unit('d_dune',1,30,{granted:thorn})],[unit('d_dune',1,30,{granted:thorn})],13); assert.ok(spider.events.length<500); assert.ok(spider.events.some(e=>e.t==='dmg'&&e.kind==='shot'));
const vgBlocked=simulate([unit('s_fox',1,10,{oid:301,startBlock:100})],[unit('s_fox',1,10)],1,['r_vanguard']); assert.equal(vgBlocked.perm[301],undefined);
assert.equal(vg.events.filter(e=>e.t==='trigger'&&e.label==='先锋徽章').length,1); assert.ok(vg.events.some(e=>e.t==='summon'&&e.revive));
// Repeated execution by pharaoh does not repeat the relic grant or add an eat.
const embMulti=setup(); embMulti.relics=['r_ember']; embMulti.queue[1]=mk(101,'s_fox'); embMulti.queue[2]=mk(102,'d_pharaoh'); assert.equal(cast(embMulti,'f_horn',null).ok,true); for(const o of embMulti.queue.filter(Boolean)) { assert.equal(o!.atkBonus,1); assert.equal(o!.hpBonus,1); } assert.equal(embMulti.tc.foods,6);
const embNoop=setup(); embNoop.relics=['r_ember']; assert.equal(cast(embNoop,'f_lamp').ok,true); const old=embNoop.queue[0]!.atkBonus; assert.equal(cast(embNoop,'f_lamp').ok,true); assert.equal(embNoop.queue[0]!.atkBonus,old);
const embCap=setup(); embCap.relics=['r_ember']; embCap.queue[0]!.atkBonus=STAT_CAP; embCap.queue[0]!.hpBonus=STAT_CAP; assert.equal(cast(embCap,'f_drum').ok,true); assert.equal(ownedHp(embCap.queue[0]!),STAT_CAP); assert.ok(embCap.queue[0]!.atkBonus<=STAT_CAP);
const oldFirst=setup(); delete oldFirst.firstRelicGiven; save(oldFirst); const oldRestored=load()!; settleBattle(oldRestored,{result:'win',perm:{},settlementId:'old'}); assert.equal(oldRestored.firstRelicGiven,true); assert.equal(oldRestored.relicPick,null);
const pending=setup(); pending.relicDue=1; openRelic(pending); const previous=pending.relicPick!.opts.slice(); settleBattle(pending,{result:'lose',perm:{},settlementId:'pending'}); assert.deepEqual(pending.relicPick!.opts,previous); assert.equal(pending.firstRelicPending,true); save(pending); const pendingRestored=load()!; assert.equal(pendingRestored.firstRelicPending,true); pickRelic(pendingRestored,0); assert.ok(pendingRestored.relicPick); assert.ok(pendingRestored.relicPick!.opts.every(x=>['r_share','r_vanguard','r_relay','r_reserve','r_runebox','r_ember','r_motley','r_training'].includes(x)));
// Weighted selection uses rarity and is deterministic, without replacement; restore shared data afterwards.
const raritySnapshot=RELICS.map(x=>x.rarity); try { for(const x of RELICS) x.rarity=x.id==='r_pouch'?'common':'rare'; let hits=0; for(let seed=1;seed<=300;seed++){const r=setup(seed); r.relicDue=1; r.firstRelicGiven=true; openRelic(r); assert.equal(new Set(r.relicPick!.opts).size,r.relicPick!.opts.length); if(r.relicPick!.opts.includes('r_pouch')) hits++;} assert.ok(hits>65,`weighted common appeared ${hits} times`); } finally { RELICS.forEach((x,i)=>{x.rarity=raritySnapshot[i];}); }

// Use actual opening buffs, not just the count helper, to verify motley's threshold.
const motleyDefs = ['s_fox', 'n_medic', 'a_spine'];
assert.equal(motleyCount([...motleyDefs, 'l_knight', 'e_skel', 's_fox']), 3);
assert.equal(motleyCount(['l_knight', 'e_skel']), 0);
for (const count of [2, 3]) {
  const left = motleyDefs.slice(0, count).map(def => unit(def, 2, 50));
  const battle = simulate(left, [unit('e_skel', 1, 100)], 17, ['r_motley']);
  const opening = battle.events.slice(0, battle.events.findIndex(e => e.t === 'clash'));
  const buffs = opening.filter(e => e.t === 'buff');
  assert.equal(buffs.length, count === 3 ? 3 : 0, `${count} lines opening buffs`);
  for (const e of buffs) if (e.t === 'buff') assert.deepEqual([e.atk, e.hp, e.nowAtk, e.nowHp], [2, 2, 4, 52]);
}

// A full first clash has at most one retaliation per ordinary hit, even with two reflectors.
const firstClash = (out: ReturnType<typeof simulate>) => {
  const at = out.events.findIndex(e => e.t === 'clash');
  const next = out.events.findIndex((e, i) => i > at && e.t === 'clash');
  return out.events.slice(at, next < 0 ? undefined : next);
};
assert.equal(firstClash(duel).filter(e => e.t === 'dmg' && e.kind === 'shot').length, 2);
assert.equal(firstClash(spider).filter(e => e.t === 'dmg' && e.kind === 'shot').length, 4);
const thornBlocked = simulate([unit('s_fox', 1, 20, { granted: thorn })],
  [unit('s_fox', 1, 20, { granted: ability('spark', 1), startBlock: 2 })], 18);
const reflected = thornBlocked.events.find(e => e.t === 'dmg' && e.src === 1 && e.kind === 'shot');
assert.ok(reflected && reflected.t === 'dmg' && reflected.n === 2 && reflected.blocked, 'reflection respects block');
const thornRevived = simulate([unit('s_fox', 1, 1, { granted: thorn, lamp: true })], [unit('s_fox', 10, 50)], 19);
assert.equal(thornRevived.events.filter(e => e.t === 'dmg' && e.kind === 'shot' && e.n === 2).length, 2, 'revival inherits thorn');
const undyingThorn = simulate([unit('s_fox', 1, 5, { granted: thorn, ax: ['undying'] })], [unit('s_fox', 10, 50)], 20);
assert.equal(firstClash(undyingThorn).filter(e => e.t === 'dmg' && e.kind === 'shot' && e.n === 2).length, 1, 'actual loss to undying reflects');
const deadSource = simulate([unit('s_fox', 1, 50, { granted: thorn })], [unit('a_reaper', 1, 1)], 21);
assert.equal(deadSource.events.filter(e => e.t === 'dmg' && e.src === 1 && e.kind === 'shot').length, 0, 'dead damage source cannot be reflected');

// Vanguard changes only post-battle permanent HP, independently for each persisted identity.
const bothHurt = simulate([unit('l_caliber', 1, 20, { oid: 401 }), unit('s_fox', 1, 20, { oid: 402 })],
  [unit('s_fox', 1, 50)], 22, ['r_vanguard']);
assert.deepEqual(bothHurt.perm, { 401: { atk: 0, hp: 1 }, 402: { atk: 0, hp: 1 } });
const vgRun = setup();
vgRun.queue[0]!.granted = ability('blood', 0);
vgRun.queue[0]!.hpBonus = 10;
vgRun.relics = ['r_vanguard'];
const vgOut = fight(vgRun), hpBefore = ownedHp(vgRun.queue[0]!);
settleBattle(vgRun, vgOut);
assert.equal(ownedHp(vgRun.queue[0]!), hpBefore + 1);
settleBattle(vgRun, vgOut);
assert.equal(ownedHp(vgRun.queue[0]!), hpBefore + 1, 'settlement is idempotent');

// Brood buffs the actual surviving team, while enemy summons do not consume our limit.
const oneBrood = simulate([unit('a_imp', 1, 1), unit('s_fox', 1, 50)], [unit('s_fox', 10, 100)], 23, ['r_brood']);
const summonAt = oneBrood.events.findIndex(e => e.t === 'summon');
const nextClash = oneBrood.events.findIndex((e, i) => i > summonAt && e.t === 'clash');
const summonBuffs = oneBrood.events.slice(summonAt, nextClash).filter(e => e.t === 'buff');
assert.equal(summonBuffs.length, 2);
for (const e of summonBuffs) if (e.t === 'buff') assert.deepEqual([e.atk, e.hp], [1, 0]);
const enemyBrood = simulate([unit('s_fox', 10, 100)], [unit('a_imp', 1, 1)], 24, ['r_brood']);
assert.equal(enemyBrood.events.some(e => e.t === 'trigger' && e.label === '繁衍号'), false);

// Invalid targets preserve the whole transaction, and accepted casts notify observers once.
for (const def of ['l_storm', 'd_pharaoh']) {
  const r = setup(); r.queue[0] = mk(100, def);
  assert.equal(spellTargetOk(r, 'x_crown', r.queue[0]), false);
}
for (const spell of ['x_thorn', 'x_sprout', 'x_temper', 'x_crown']) {
  const r = setup(); r.queue[1] = mk(101, 'd_keeper'); r.queue[2] = mk(102, 'v_mage');
  if (spell === 'x_temper') r.queue[0]!.granted = ability('sprout', 1);
  const before = r.gold;
  const result = cast(r, spell);
  assert.equal(result.ok, true, spell);
  assert.equal(r.gold, before - FOOD[spell].price!);
  assert.equal(r.queue[0]!.atkBonus, 1, `${spell} notifies keeper once`);
  assert.ok(r.queue.some(o => (o?.startBlock ?? 0) === 1), `${spell} notifies frost mage`);
}
const rejected = setup(); rejected.queue[0]!.granted = ability('bone', 2);
const rejectedItem: ShopItem = { sid: rejected.nextId++, kind: 'food', def: 'x_thorn', locked: false, free: false };
rejected.shop.push(rejectedItem);
const rejectionSnapshot = JSON.stringify(rejected);
assert.equal(useFood(rejected, rejectedItem.sid, 0).ok, false);
assert.equal(JSON.stringify(rejected), rejectionSnapshot);
const heldCrown = setup(); heldCrown.hand[0] = mk(201, 'n_tether');
heldCrown.hand[1] = { kind: 'spell', oid: 202, def: 'x_crown', source: 'test', obtainedTurn: 1 };
const heldGold = heldCrown.gold;
assert.equal(castHandSpell(heldCrown, HAND_BASE + 1, HAND_BASE).ok, true);
assert.equal(heldCrown.gold, heldGold);
assert.equal((heldCrown.hand[0] as Owned).copies, 3);
assert.equal((heldCrown.hand[0] as Owned).pendingGoldPlay, true);

// Grant persistence rejects malformed optional fields, but keeps valid tempered abilities.
const savedAbility = setup(); savedAbility.queue[0]!.granted = ability('sprout', 2, true);
save(savedAbility); assert.deepEqual(load()!.queue[0]!.granted, savedAbility.queue[0]!.granted);
(savedAbility.queue[0]!.granted as any).tempered = 'true';
storage.set(SAVE_KEY, JSON.stringify(savedAbility)); assert.equal(load(), null);
const sproutCap = setup(); sproutCap.queue[0]!.hpBonus = STAT_CAP - card('s_fox').hp - 1;
sproutCap.queue[0]!.granted = ability('sprout', 2, true);
const sproutFx = endTurn(sproutCap);
assert.equal(ownedHp(sproutCap.queue[0]!), STAT_CAP);
assert.ok(sproutFx.some(e => e.kind === 'buff' && e.label === '萌芽印' && e.hp === 1 && e.atk === 0));

// Ember adds permanent growth once, never a second eat, and ignores capped/no-op effects.
const fed = setup(); fed.relics = ['r_ember']; fed.queue[1] = mk(101, 'v_scout');
assert.equal(cast(fed, 'f_drum').ok, true);
assert.deepEqual([fed.queue[0]!.atkBonus, fed.queue[0]!.hpBonus, fed.tc.foods], [1, 2, 1]);
const tempCap = setup(); tempCap.relics = ['r_ember']; tempCap.queue[0]!.ench = 'b_buckler'; tempCap.queue[0]!.tmpAtk = STAT_CAP; tempCap.queue[0]!.tmpHp = STAT_CAP;
assert.equal(cast(tempCap, 'f_drum').ok, true);
assert.deepEqual([tempCap.queue[0]!.atkBonus, tempCap.queue[0]!.hpBonus], [0, 0]);
const igniteEcho = setup(); igniteEcho.relics = ['r_ember']; igniteEcho.queue[1] = mk(101, 'd_pharaoh'); igniteEcho.queue[1]!.copies = 3;
assert.equal(cast(igniteEcho, 'x_ignite').ok, true);
assert.deepEqual([igniteEcho.queue[0]!.atkBonus, igniteEcho.queue[0]!.hpBonus, igniteEcho.tc.foods], [1, 1, 0]);
assert.equal(cast(igniteEcho, 'x_ignite').ok, false);
const transferredBlood = setup(); transferredBlood.relics = ['r_ember']; transferredBlood.queue[0]!.granted = ability('blood', 2); transferredBlood.queue[1] = mk(101);
assert.equal(cast(transferredBlood, 'x_transfer', 1, false, 0).ok, true);
assert.deepEqual([transferredBlood.queue[0]!.atkBonus, transferredBlood.queue[1]!.atkBonus], [0, 1]);
const share = setup(); share.relics = ['r_ember', 'r_share']; share.queue[1] = mk(101); share.queue[2] = mk(102);
assert.equal(cast(share, 'f_drum', 1).ok, true);
assert.deepEqual(share.queue.slice(0, 3).map(o => o!.atkBonus), [1, 1, 1]);
assert.equal(share.tc.foods, 3);

// Formal wins reward both an empty hand and overflow; previews and draws never settle.
const previewRun = setup(); previewRun.relics = ['r_runebox']; const previewBefore = JSON.stringify(previewRun);
settleBattle(previewRun, trialFight(previewRun)); assert.equal(JSON.stringify(previewRun), previewBefore);
const wonRune = setup(); wonRune.relics = ['r_runebox']; wonRune.tavern = 1;
settleBattle(wonRune, { result: 'win', perm: {}, settlementId: 'rune-hand' });
assert.ok(wonRune.hand.some(o => o?.kind === 'spell' && o.def === 'f_bread' && o.source === '符文匣'));
const drawRune = setup(); drawRune.relics = ['r_runebox'];
settleBattle(drawRune, { result: 'draw', perm: {}, settlementId: 'rune-draw' });
assert.equal(drawRune.hand.filter(Boolean).length, 0);
assert.equal(drawRune.rewards!.length, 0);
const onlyOnce = setup(); settleBattle(onlyOnce, { result: 'win', perm: {}, settlementId: 'once-1' }); pickRelic(onlyOnce, 0);
settleBattle(onlyOnce, { result: 'draw', perm: {}, settlementId: 'once-2' });
assert.equal(onlyOnce.relicDue, 0); assert.equal(onlyOnce.relicPick, null);
const exhausted = setup(); exhausted.relics = ['r_share', 'r_vanguard', 'r_relay', 'r_reserve', 'r_runebox', 'r_ember', 'r_motley', 'r_training'];
exhausted.firstRelicPending = true; exhausted.relicDue = 2; openRelic(exhausted);
assert.equal(exhausted.relicDue, 1); assert.equal(exhausted.relicPick!.opts.length, 3);
assert.ok(exhausted.relicPick!.opts.every(id => !exhausted.relics.includes(id)));
assert.equal(ownedAtk(fed.queue[0]!), card('s_fox').atk + 1);

console.log('batch III behavior checks passed');




