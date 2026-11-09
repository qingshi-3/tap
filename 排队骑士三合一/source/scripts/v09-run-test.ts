const assert = { equal(a: unknown, b: unknown) { if (a !== b) throw new Error(`Expected ${a} === ${b}`); }, ok(a: unknown) { if (!a) throw new Error('Assertion failed'); }, deepEqual(a: unknown, b: unknown) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('Values differ'); } }; 
import { newRun, buyToHand, castHandSpell, useFood, pickDiscover, claimReward, discardReward, save, load, saveStatus, endTurn, fight, settleBattle, pickNode, discardHandCard, buy, moveOwned, inspectPlayConflict, searchPool, SAVE_KEY, LEGACY_SAVE_KEY, HAND_BASE, type Owned, type ShopItem } from '../src/core/run';
const mk = (oid: number, def: string): Owned => ({oid, def, copies: 1, atkBonus: 0, hpBonus: 0});
const r = newRun(2468, {solo:true});
r.gold = 99;
r.queue[0] = mk(100, 's_fox'); r.queue[1] = mk(101, 'd_keeper');
const add = (def: string): ShopItem => { const x: ShopItem = {sid: r.nextId++,kind:'food',def,locked:false,free:false}; r.shop.push(x); return x; };
const echo = add('x_echo');
assert.equal(buyToHand(r, echo.sid).ok, true);
const before = r.gold;
assert.equal(castHandSpell(r, HAND_BASE, 0).ok, true);
assert.equal(r.gold, before); assert.ok(r.discover?.length);
assert.equal(r.queue[0]!.atkBonus, 1);
assert.ok(pickDiscover(r,0)); assert.ok(r.hand.some(x => x?.kind === 'spell'));
const held = r.hand.findIndex(x => x?.kind === 'spell');
assert.equal(castHandSpell(r, HAND_BASE + held, 0).ok, true);
assert.equal(r.queue[0]!.atkBonus >= 2, true);
r.hand = Array(5).fill(null).map((_,i) => i < 4 ? mk(200+i,'s_fox') : null);
const invalid = add('x_echo'); const snap = JSON.stringify(r);
assert.equal(buyToHand(r, invalid.sid).ok, false); assert.equal(JSON.stringify(r), snap);
assert.equal(useFood(r, invalid.sid, 0).ok, true); assert.ok(r.discover?.length);
pickDiscover(r, 0); assert.equal(r.rewards?.length, 1);
const pending = r.rewards![0].id; assert.equal(claimReward(r,pending),false);
r.hand[0] = null; assert.equal(claimReward(r,pending),true); assert.equal(discardReward(r,pending),false);
const a = newRun(6677,{solo:true}); const b = newRun(6677,{solo:true});
a.gold = 100; a.queue[0] = mk(999,'s_fox');
assert.deepEqual(a.map,b.map);

const storage = new Map<string,string>();
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k:string) => storage.get(k) ?? null, setItem: (k:string,v:string) => storage.set(k,v), removeItem: (k:string) => storage.delete(k) }, configurable:true });
storage.set(LEGACY_SAVE_KEY, '{"v":2}'); assert.equal(saveStatus(), 'unsupported');
r.hand = Array(5).fill(null).map((_,i) => i < 4 ? mk(300+i,'s_fox') : null);
r.nextId = 1000; r.discover = [{opts:['f_bread'],src:'test',mode:'spell',price:0}]; pickDiscover(r,0);
save(r); const restored = load(); assert.ok(restored); assert.equal(restored!.rewards!.length, 1);
assert.equal(storage.get(LEGACY_SAVE_KEY), '{"v":2}'); assert.ok(storage.get(SAVE_KEY));

// A repeated food effect locks both recipients and broadcasts one cast, but one eat per recipient/effect.
const f = newRun(123,{solo:true}); f.gold = 99;
f.queue[0] = mk(1,'v_guard'); f.queue[1] = mk(2,'v_guard'); f.queue[2] = mk(3,'d_keeper'); f.queue[3] = mk(4,'d_pharaoh');
const stew: ShopItem = {sid:999,kind:'food',def:'f_stew',free:false,locked:false}; f.shop.push(stew);
assert.equal(useFood(f,999,0).ok,true); assert.equal(f.tc.foods,4); assert.equal(f.queue[0]!.atkBonus,4); assert.equal(f.queue[1]!.atkBonus,5);
const next: ShopItem = {sid:998,kind:'food',def:'f_bread',free:false,locked:false}; f.shop.push(next);
assert.equal(useFood(f,998,0).ok,true); assert.equal(f.tc.foods,5); assert.equal(f.queue[0]!.atkBonus,6);
// Admission replacement requires explicit acceptance and leaves resources untouched on rejection.
const m = newRun(321,{solo:true}); m.gold=20; m.queue[0]=mk(10,'s_fox'); m.queue[0]!.granted={id:'bone',duration:'permanent',value:2,source:'test'};
const mentor: ShopItem={sid:888,kind:'unit',def:'n_medic',locked:false,free:false}; m.shop.push(mentor);
assert.ok(inspectPlayConflict(m,'n_medic',1)); const old=JSON.stringify(m);
assert.equal(buy(m,888,1).ok,false); assert.equal(JSON.stringify(m),old);
assert.equal(buy(m,888,1,undefined,true).ok,true); assert.equal(m.queue[0]!.granted!.id,'blood');
// Search combines the real event times, including both of egg's native triggers.
m.tavern=3; const egg=mk(90,'m_egg'); const found=searchPool(m,egg).map(x=>x.id);
assert.ok(found.includes('a_imp')); assert.ok(found.includes('n_tether')); assert.equal(found.includes('m_egg'),false); assert.equal(found.includes('s_dart'),false);
// Once end-of-turn effects create a pending discovery, actions cannot repeat income;
// resolving it after save/restore unlocks combat without re-running end effects.
const e=newRun(887,{solo:true}); e.nextId=1000; e.queue[0]=mk(201,'d_goldob'); e.hand=[mk(211,'s_fox'),mk(212,'s_fox'),mk(213,'s_fox'),mk(214,'s_fox'),null];
endTurn(e); assert.equal(e.endTurnCommitted,true); assert.ok(e.discover?.length); save(e);
const resumed=load()!; assert.ok(resumed); const snapshot=JSON.stringify(resumed);
assert.equal(buyToHand(resumed, resumed.shop[0].sid).ok,false); endTurn(resumed); assert.equal(JSON.stringify(resumed),snapshot);
pickDiscover(resumed,0); assert.ok(resumed.rewards?.length); assert.equal(discardHandCard(resumed,HAND_BASE),true);
assert.equal(claimReward(resumed,resumed.rewards![0].id),true); assert.ok(fight(resumed));
// Invalid same-key content is retained exactly before overwrite.
storage.set(SAVE_KEY, '{broken'); assert.equal(saveStatus(),'invalid'); save(e);
assert.ok([...storage.entries()].some(([k,v])=>k.startsWith(SAVE_KEY+'_backup_') && v === '{broken'));

// A previously entered unit that becomes golden in hand executes its deferred
// golden entry once on return, without broadcasting a fresh summon.
const re=newRun(190,{solo:true}); re.queue[0]=mk(1,'m_incubator');
const entered=mk(2,'s_fox'); entered.copies=2; re.hand[0]=entered;
const duplicate=mk(3,'s_fox'); duplicate.fresh=true; re.hand[1]=duplicate;
assert.ok(moveOwned(re,HAND_BASE+1,HAND_BASE)); assert.ok(re.hand[0]);
assert.ok(moveOwned(re,HAND_BASE,1)); assert.equal(re.queue[0]!.atkBonus,0); assert.equal(re.discover?.filter(d => d.mode === 'spell').length,1);

const battle=newRun(998,{solo:true}); battle.queue[0]=mk(900,'l_shield'); battle.nextId=1000;
const outcome=fight(battle); settleBattle(battle,outcome); const settled=JSON.stringify(battle);
settleBattle(battle,outcome); assert.equal(JSON.stringify(battle),settled);
const damaged=structuredClone(e); damaged.rewards=[{id: 2000, source:'bad', card:mk(2001,'s_fox')}];
storage.set(SAVE_KEY,JSON.stringify(damaged)); assert.equal(load(),null); assert.equal(saveStatus(),'invalid');
// Purchased milk expires at the next operating round, including overflow rewards.
const milkRun = newRun(427,{solo:true}); milkRun.gold=50;
const milkShop: ShopItem = {sid:800,kind:'food',def:'f_milk',val:[1,2],free:true,locked:false};
milkRun.shop.push(milkShop); assert.equal(buyToHand(milkRun,800).ok,true);
const milkHeld = milkRun.hand.find(x => x?.kind === 'spell'); assert.ok(milkHeld && milkHeld.kind === 'spell');
if (milkHeld?.kind === 'spell') assert.equal(milkHeld.expiresTurn,milkRun.turn);
milkRun.rewards!.push({id:802,source:'test',card:{kind:'spell',oid:803,def:'f_milk',source:'test',obtainedTurn:milkRun.turn,expiresTurn:milkRun.turn}});
settleBattle(milkRun,{result:'win',perm:{}}); assert.equal(milkRun.hand.some(x => x?.def === 'f_milk'),false); assert.equal(milkRun.rewards!.length,0);
const expired = newRun(428,{solo:true}); expired.queue[0]=mk(910,'s_fox');
expired.hand[0]={kind:'spell',oid:911,def:'f_milk',source:'test',obtainedTurn:1,expiresTurn:1}; expired.turn=2;
const expiredSnapshot=JSON.stringify(expired); assert.equal(castHandSpell(expired,HAND_BASE,0).ok,false); assert.equal(JSON.stringify(expired),expiredSnapshot);
// Rebirth resolves on a hand unit while retaining its identity and granted ability.
const morph=newRun(429,{solo:true}); morph.gold=50; const target=mk(920,'s_fox');
target.granted={id:'bone',duration:'permanent',value:2,source:'test'}; morph.hand[0]=target;
const rebirth: ShopItem={sid:921,kind:'food',def:'x_reborn',free:false,locked:false}; morph.shop.push(rebirth);
assert.equal(useFood(morph,921,HAND_BASE).ok,true); const choice=pickDiscover(morph,0)!;
assert.equal(choice.oid,920); assert.equal(choice.hand,HAND_BASE); assert.equal(morph.hand[0]!.oid,920);
assert.equal(morph.hand[0]!.def,choice.def); assert.equal((morph.hand[0] as Owned).granted!.id,'bone');
morph.discover=[{opts:['s_dart'],src:'test',mode:'morph',price:0,oid:9999}];
assert.equal(pickDiscover(morph,0)!.missing,true); assert.equal(morph.discover.length,0);
// Chaos modifies a cloned encounter, never the fixed map template or the next retry's base.
const chaosRun=newRun(814,{solo:true}); chaosRun.map[0][0].enemy!.units[0].atk=20;
const baseline=JSON.stringify(chaosRun.map[0][0].enemy);
chaosRun.chaos=2; chaosRun.path=[]; assert.equal(pickNode(chaosRun,0),true);
const chaosEnemy=JSON.stringify(chaosRun.enemy); assert.equal(JSON.stringify(chaosRun.map[0][0].enemy),baseline);
assert.ok(chaosRun.enemy.units.some((u,i)=>u.atk > chaosRun.map[0][0].enemy!.units[i].atk || u.hp > chaosRun.map[0][0].enemy!.units[i].hp));
chaosRun.path=[]; assert.equal(pickNode(chaosRun,0),true); assert.equal(JSON.stringify(chaosRun.enemy),chaosEnemy);
console.log('v0.9 run checks passed');
