const assert = { ok(value: unknown) { if (!value) throw new Error('assertion failed'); }, equal(a: unknown, b: unknown) { if (a !== b) throw new Error(`expected ${String(b)}, got ${String(a)}`); } };
import { FOOD, FOOD_POOL, card } from '../src/core/data';
import { simulate } from '../src/core/engine';
import { newRun, settleBattle, useFood, resolveDiscover, reroll, moveOwned, buy, type Owned } from '../src/core/run';
const o = (oid: number, def: string): Owned => ({ oid, def, copies: 1, atkBonus: 0, hpBonus: 0 });
const r = newRun(7); r.queue = [o(101, 'l_warden'), o(102, 'l_shield'), null, null, null]; r.enemy = {boss:null, units:[]};
settleBattle(r, { result: 'draw', perm: {}, hurtCounts: {101: 6, 102: 6}, summons: 6 });
assert.equal(r.queue[0]!.scar, 1); assert.equal(r.queue[1]!.scar, undefined); assert.equal(r.legion, 2);
for (let i=0; i<5; i++) settleBattle(r, {result:'draw',perm:{},hurtCounts:{101:2},summons:6});
assert.equal(r.queue[0]!.scar, 4); assert.equal(r.legion, 8);
const q = newRun(8); q.queue=[o(201,'l_warden'),null,null,null,null]; q.turn=8; q.gold=10;
q.shop=[{sid:301,kind:'food',def:'s_war',locked:false,free:false}]; assert.equal(useFood(q,301,null).ok,true); assert.equal(q.gold,7); assert.equal(q.freeRerolls,2); reroll(q); reroll(q); assert.equal(q.gold,7); reroll(q); assert.equal(q.gold,6);
q.shop=[{sid:302,kind:'food',def:'s_recruit',locked:false,free:false}]; assert.equal(useFood(q,302,0).ok,true); assert.ok(q.discoverQueue?.length); assert.equal(reroll(q),null); assert.equal(moveOwned(q,0,1),null); assert.ok(resolveDiscover(q,0)); assert.equal(q.discoverQueue!.length,0); assert.equal(q.shop.at(-1)!.free,true); assert.equal(q.shop.at(-1)!.discovered,true);
q.shop=[{sid:303,kind:'food',def:'s_bank',locked:false,free:false}]; q.gold=10; assert.equal(useFood(q,303,null).ok,true); settleBattle(q,{result:'draw',perm:{}}); assert.equal(q.gold,15);
assert.ok(!FOOD_POOL.some(f=>['f_bomb','f_elixir','f_fury','f_undy','f_thunder'].includes(f.id))); assert.equal(FOOD.s_copy.price,undefined);
const battle=simulate([{def:'a_imp',lvl:1,atk:1,hp:1},{def:'m_whelp',lvl:1,atk:3,hp:2}], [{def:'e_golem',lvl:1,atk:1,hp:30}], 1, [], 3);
const summon=battle.events.find(e=>e.t==='summon' && e.unit.side===0); if (!summon || summon.t !== 'summon') throw new Error('missing summon'); assert.equal(summon.unit.atk,5); assert.equal(summon.unit.hp,5); assert.ok((battle.summons ?? 0)>=1);

const pr = newRun(42); pr.turn=8; pr.gold=10; pr.queue=[o(501,'l_warden'),null,null,null,null];
pr.shop=[{sid:601,kind:'food',def:'s_prophecy',locked:false,free:false}]; assert.ok(useFood(pr,601,null).ok); reroll(pr); assert.equal(pr.prophecy,true); settleBattle(pr,{result:'draw',perm:{}}); assert.equal(pr.prophecy,false); assert.ok(pr.shop.some(x=>x.kind==='unit' && !x.locked && x.def && FOOD[x.def] === undefined && card(x.def).tier===6));
const tr = newRun(43); tr.turn=8; tr.gold=10; tr.queue=[{...o(701,'l_warden'),copies:3,atkBonus:4,hpBonus:4,scar:1,ench:'b_buckler'},null,null,null,null]; tr.shop=[{sid:801,kind:'food',def:'s_rebirth',locked:false,free:false}]; assert.ok(useFood(tr,801,0).ok); assert.ok(resolveDiscover(tr,0)); assert.equal(tr.queue[0]!.copies,3); assert.equal(tr.queue[0]!.atkBonus,4); assert.equal(tr.queue[0]!.scar,1); assert.equal(tr.queue[0]!.ench,'b_buckler');

for (const [def, hp] of [['l_warden', 7], ['d_dune', 6]] as const) {
  const b=simulate([{def,lvl:1,atk:1,hp}], [{def:'v_guard',lvl:1,atk:1,hp:30}], 5);
  assert.ok(b.events.some(e=>e.t==='dmg' && e.kind==='shot' && e.n===4));
}
const shield=simulate([{def:'l_shield',lvl:1,atk:1,hp:10,ench:'b_buckler'}], [{def:'v_guard',lvl:1,atk:1,hp:20}], 5);
assert.ok(shield.events.some(e=>e.t==='stat' && e.shield===2));
assert.ok(shield.events.some(e=>e.t==='dmg' && e.kind==='melee' && e.blocked && e.shield===1));

assert.ok(FOOD.s_recruit.spell && !FOOD.f_bread.spell);
const emptyRecruit = newRun(55); emptyRecruit.gold=10; emptyRecruit.queue=[o(900,'l_archon'),null,null,null,null]; emptyRecruit.shop=[{sid:901,kind:'food',def:'s_recruit',locked:false,free:false}]; assert.equal(useFood(emptyRecruit,901,0).ok,false); assert.equal(emptyRecruit.gold,10); assert.equal(emptyRecruit.shop.length,1); assert.ok(!emptyRecruit.discoverQueue?.length);
const merc = newRun(56); merc.gold=10; merc.queue=[{...o(910,'l_warden'),merc:2},null,null,null,null]; merc.shop=[{sid:911,kind:'food',def:'s_dismiss',locked:false,free:false}]; assert.equal(useFood(merc,911,0).ok,false); assert.equal(merc.gold,10); assert.equal(merc.queue[0]?.oid,910); assert.ok(!merc.discoverQueue?.length);
const fox = newRun(57); fox.gold=10; fox.queue=[o(920,'s_fox'),null,null,null,null]; fox.shop=[{sid:921,kind:'unit',def:'s_fox',locked:false,free:false}]; assert.ok(buy(fox,921,0).ok); assert.equal(fox.discoverQueue?.[0].source,'灯笼狐');
const rounds = newRun(58); rounds.queue=[o(930,'l_warden'),null,null,null,null]; rounds.enemy={boss:null,units:[]}; assert.equal(settleBattle(rounds,{result:'draw',perm:{},hurtCounts:{930:1},summons:6}),2); assert.equal(settleBattle(rounds,{result:'draw',perm:{},hurtCounts:{930:1},summons:0}),0); assert.equal(rounds.queue[0]?.scar,undefined);
rounds.legion=7; assert.equal(settleBattle(rounds,{result:'draw',perm:{},summons:6}),1);

const reward=newRun(59); reward.gold=10; reward.discoverQueue=[{source:'升星奖励',title:'升星奖励',free:false,options:[{def:'l_shield'}]}]; assert.ok(resolveDiscover(reward,0)); const paid=reward.shop.at(-1)!; assert.equal(paid.discovered,true); assert.equal(paid.free,false); paid.locked=true; reroll(reward); assert.ok(reward.shop.includes(paid));
console.log('v0.7 behavior checks passed');
