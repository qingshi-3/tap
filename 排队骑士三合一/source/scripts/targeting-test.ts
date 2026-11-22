import { canSelectQuarry, previewTargets } from '../src/qb/targeting';
import { newRun, endTurn, fight, type Owned, type RunState } from '../src/core/run';
import type { UnitSpec } from '../src/core/engine';

function equal(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error(message);
}
function own(r: RunState, def: string, extra: Partial<Owned> = {}): Owned {
  return { oid:r.nextId++, def, copies:1, atkBonus:0, hpBonus:10, ...extra };
}
const enemy = (def: string, extra: Partial<UnitSpec> = {}): UnitSpec => ({ def, atk:5, hp:22, lvl:1, ...extra });
function fixture(seed = 42) {
  const r = newRun(seed, { solo:true });
  r.queue = Array.from({ length:5 }, () => null);
  r.enemy = { boss:null, units:[enemy('t_wisp')] };
  return r;
}

const gates: [string, (r: RunState) => void, boolean][] = [
  ['no ability', () => {}, false],
  ['untargeted hunt ability', r => { r.queue[0] = own(r,'rw_hunt_executioner'); }, false],
  ['native ability', r => { r.queue[0] = own(r,'rw_hunt_spotter'); }, true],
  ['consumed food', r => { r.queue[0]!.supportFoods = ['f_siege_fuse']; }, true],
  ['equipped item', r => { r.queue[0]!.ench = 'e_quarry_hammer'; }, true],
  ['relic', r => { r.relics = ['r_quarry_writ']; }, true],
  ['inventory only', r => { r.hand[0] = own(r,'rw_hunt_spotter'); r.bag = ['e_hunting_scope']; }, false],
];
for (const [name, arrange, expected] of gates) {
  const r = fixture(); r.queue[0] = own(r,'t_wisp'); arrange(r);
  equal(canSelectQuarry(r), expected, name);
}

const guarded = fixture();
guarded.queue = [own(guarded,'t_wisp'),own(guarded,'rw_charge_brake'),own(guarded,'rw_charge_brake'),null,null];
equal(previewTargets(guarded).focused.filter(t => t.source?.side === 1).map(t => t.target.slot), [1,2,0], 'both guards and the remaining front damage must retain their targets');

const aoe = fixture(); aoe.queue[0] = own(aoe,'rw_wheel_marshal');
aoe.enemy.units = ['e_golem','t_wolf','t_wisp'].map(id => enemy(id));
equal(previewTargets(aoe).focused.filter(t => t.source?.side === 0).map(t => t.target.slot), [0,1,2], 'hurt reactions must preserve all area targets');

const spawn = fixture(); spawn.queue[2] = own(spawn,'rw_nest_hatch');
spawn.enemy.units = [enemy('t_wolf',{ granted:{ id:'spark', source:'grant', value:1, duration:'battle' } })];
equal(previewTargets(spawn).focused.filter(t => t.source?.side === 1), [], 'an unborn summon has no original board position');

const units = ['rw_wheel_marshal','rw_hunt_spotter','rw_hunt_powder','rw_charge_mortar','rw_nest_hatch','t_wisp','l_caliber','rw_charge_brake','s_dart','s_viper','rw_blood_razor'];
for (let i = 0; i < 33; i++) {
  const r = fixture(101 + i);
  r.queue[1] = own(r,units[i % units.length], { ench:i % 3 === 0 ? 'e_field_cannon' : null, startCharge:i % 3 });
  r.queue[3] = own(r,units[(i * 3 + 4) % units.length]);
  r.queue[4] = own(r,units[(i * 7 + 2) % units.length]);
  r.enemy.units = [1,2,7].map((n,j) => enemy(units[(i * (j < 2 ? 5 : 3) + n) % units.length]));
  r.quarry = i % 3; if (i % 4 === 0) r.relics = ['r_volley'];
  const saved = JSON.stringify(r), preview = previewTargets(r);
  equal(JSON.stringify(r), saved, 'preview must preserve the complete live run');
  const formal = structuredClone(r); endTurn(formal); const out = fight(formal);
  const positions = new Map(out.init.map(u => {
    const at = out.initOrder[u.side].indexOf(u.uid);
    return [u.uid, { side:u.side, slot:u.side === 0 ? [1,3,4][at] : at }] as const;
  }));
  const sides = new Map(out.init.map(u => [u.uid,u.side]));
  let phase = 0;
  const expected = [];
  for (const e of out.events) {
    if (e.t === 'summon') sides.set(e.unit.uid,e.unit.side);
    if (e.t === 'clash') phase = e.n;
    if (e.t !== 'dmg' || e.src === null || e.kind === 'burn' || sides.get(e.src) === sides.get(e.tgt) || !positions.has(e.tgt)) continue;
    if (phase === 0 || phase === 1 && e.kind === 'melee') expected.push({ source:positions.get(e.src) ?? null, target:positions.get(e.tgt), kind:e.kind === 'melee' ? 'melee' : 'opening' });
  }
  equal(preview.opening,expected,`formal battle targets and sparse layout ${i}`);
}
console.log('targeting: 7 availability gates, 3 reaction regressions, 33 formal battles and complete preview purity passed');
