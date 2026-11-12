import { ARCHETYPE_IDS, type ArchetypeId } from '../src/core/archetypes';
import { FOOD, RELICS, SHOP_POOL } from '../src/core/data';
import { SUPPORT_FOODS } from '../src/core/supportCatalog';
import { newRun, activeCardPool, foodTargetOk, useFood, type Owned, type RunState } from '../src/core/run';
import { buyBestFood, chooseLineup, chooseRelic, equipmentValue, equipBag, foodTarget, foodValue, relicValue, tradeTurn } from './bot';
function ok(value: unknown, label: string): asserts value { if (!value) throw Error(label); }
function equal(actual: unknown, expected: unknown, label: string) { ok(JSON.stringify(actual) === JSON.stringify(expected),label); }
function fixture(a: ArchetypeId): RunState {
  for (let seed = 1; seed < 500; seed++) { const r = newRun(seed); if (r.activeArchetypes.includes(a)) { r.gold = 12; r.tavern = 6; r.act = 2; r.shop = []; return r; } }
  throw Error(a);
}
const owned = (r: RunState, def: string): Owned => ({oid:r.nextId++,def,copies:1,atkBonus:0,hpBonus:0});
let checks = 0;
function test(name: string, fn: () => void) { fn(); checks++; console.log(`PASS ${name}`); }

test('resource gate, actual price, and separate food/spell counters',() => {
  const r = fixture('charge');
  r.queue[0] = owned(r,SHOP_POOL.find(c => !c.archetype)!.id);
  const before = JSON.stringify(r);
  equal(foodTarget(r,'f_powder'),undefined,'unsupported cannon target');
  ok(foodValue(r,'f_powder') < 0,'unusable food value');
  equal(JSON.stringify(r),before,'score mutated state');
  r.shop.push({sid:r.nextId++,kind:'food',def:'f_powder',locked:false,free:false});
  const rejected = JSON.stringify(r);
  equal(buyBestFood(r),false,'shop attempted unsupported charge');
  equal(JSON.stringify(r),rejected,'rejected buy mutated state');
  r.queue[0]!.ench = 'e_field_cannon';
  ok(foodTarget(r,'f_powder') === r.queue[0],'gear release recipient');
  const gold = r.gold;
  ok(buyBestFood(r),'legal paid charge supply');
  equal(r.gold,gold - FOOD.f_powder.price!,'price paid');
  equal(r.queue[0]!.startCharge,2,'charge granted');
  equal([r.tc.foods,r.tc.spells],[1,0],'natural supply counters');
  const sid = r.nextId++; r.shop.push({sid,kind:'food',def:'x_inscribe',locked:false,free:false});
  ok(useFood(r,sid,0).ok,'real spell intake');
  equal([r.tc.foods,r.tc.spells],[1,1],'spell counters');
});

test('eleven routes score valid support recipients without state mutation',() => {
  for (const a of ARCHETYPE_IDS) {
    const r = fixture(a), pool = activeCardPool(r).filter(c => c.archetype === a);
    const rank = (d: typeof pool[number]) => Number(!!d.rules?.some(z => z.phase === 'battle' && ['rotate','release','inherit','summon'].includes(z.effect)));
    const chosen = [...pool].sort((x,y) => rank(y) - rank(x));
    r.queue = [...chosen.slice(0,5).map(d => owned(r,d.id))];
    if (a === 'pair') r.queue[1] = owned(r,r.queue[0]!.def);
    const before = JSON.stringify(r); let legal = 0;
    for (const f of SUPPORT_FOODS.filter(f => f.archetypes?.includes(a))) {
      const target = foodTarget(r,f.id,a);
      if (target) { ok(foodTargetOk(r,f.id,target),`illegal ${a}/${f.id}`); ok(foodValue(r,f.id,a) > 0,`positive ${a}/${f.id}`); legal++; }
    }
    ok(legal > 0,`${a} legal support`);
    for (const relic of RELICS) ok(Number.isFinite(relicValue(r,relic.id,a)),`finite relic ${relic.id}`);
    equal(JSON.stringify(r),before,`${a} scoring mutated state`);
  }
});

test('equipment chooses a working holder and reaches stable distribution',() => {
  const r = fixture('wheel'), pool = activeCardPool(r);
  const rider = pool.find(c => c.rules?.some(z => z.phase === 'battle' && z.effect === 'rotate'))!;
  const plain = SHOP_POOL.find(c => !c.archetype)!;
  r.queue[0] = owned(r,plain.id); r.queue[1] = owned(r,rider.id);
  ok(equipmentValue(r,'e_courier_spurs',r.queue[1]!) > equipmentValue(r,'e_courier_spurs',r.queue[0]!) + 4,'rotation synergy');
  r.bag = ['e_courier_spurs']; equal(equipBag(r,'wheel'),1,'equip count');
  equal(r.queue[1]!.ench,'e_courier_spurs','rider gets spurs'); equal(equipBag(r,'wheel'),0,'stable distribution');
});

test('relic choice follows pair engine after reordering options',() => {
  const r = fixture('pair'), d = activeCardPool(r).find(c => c.archetype === 'pair')!;
  r.queue[0] = owned(r,d.id); r.queue[1] = owned(r,d.id);
  const opts = ['r_ink_well','r_pair_pennant','r_relay_bell'] as const;
  equal(opts[chooseRelic(r,opts,'pair')],'r_pair_pennant','matched relic');
  const reversed = [...opts].reverse(); equal(reversed[chooseRelic(r,reversed,'pair')],'r_pair_pennant','order invariant');
});

test('lineup evaluation preserves support resources',() => {
  const r = fixture('charge'), defs = activeCardPool(r).slice(0,3);
  r.queue = [...defs.map(d => owned(r,d.id)),null,null];
  r.queue[2]!.ench = 'e_field_cannon'; r.queue[2]!.startCharge = 2;
  const before = JSON.stringify(r), out = chooseLineup(r,4);
  ok(out.trials > 0 && out.trials <= 4,'bounded candidates'); equal(JSON.stringify(r),before,'trial state leak');
});

test('extra trade pays real costs and respects the remaining purchase budget',() => {
  const r = fixture('trade'), pool = activeCardPool(r);
  const find = (suffix: string) => pool.find(c => c.id.endsWith('_' + suffix))!;
  r.queue = ['teller','hawker','bailiff'].map(suffix => owned(r,find(suffix).id));
  r.queue.push(null,null);
  r.shop = [{sid:r.nextId++,kind:'unit',def:find('porter').id,locked:false,free:false}];
  const before = JSON.stringify(r); equal(tradeTurn(r,0),0,'zero budget'); equal(JSON.stringify(r),before,'zero budget mutation');
  equal(tradeTurn(r,2),0,'insufficient purchase budget'); equal(JSON.stringify(r),before,'small budget mutation');
  const gold = r.gold;
  equal(tradeTurn(r,4),3,'real transaction cost');
  equal(r.gold,gold - 2,'purchase and resale gold');
  equal([r.tc.bought,r.tc.sold],[1,1],'real unit trade counters');
  ok(r.hand.every(x => !x),'temporary worker sold');
  equal(tradeTurn(r,1),0,'remaining turn budget');
});
console.log(`${checks} bot support checks passed`);
