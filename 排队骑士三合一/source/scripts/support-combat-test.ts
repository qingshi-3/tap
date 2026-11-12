import { card, EQUIP, FOOD, RELIC, type CardDef } from '../src/core/data';
import type { BattleRule } from '../src/core/archetypes';
import { simulate, type BattleOut, type UnitSpec } from '../src/core/engine';
const ok = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const unit = (def = 't_wisp', extra: Partial<UnitSpec> = {}): UnitSpec => ({ def, lvl: 1, atk: 2, hp: 80, ...extra });
const B = (on: BattleRule['on'], effect: BattleRule['effect'], target: BattleRule['target'], n: number, extra: Partial<BattleRule> = {}): BattleRule => ({ phase: 'battle', on, effect, target, n, ...extra });
const snapshots = ['t_wisp', 't_bonelet', 't_drakelet'].map(id => ({ def: card(id), rules: card(id).rules }));
const set = (id: string, rules: BattleRule[]) => { card(id).rules = rules; };
const reset = () => snapshots.forEach(({ def }) => { def.rules = []; });
const equipment = (rules: BattleRule[], extra = {}) => { EQUIP.test_support = { id: 'test_support', name: '测试装备', q: 1, icon: 'eq_guard', text: '', rules, ...extra }; };
const food = (rules: BattleRule[]) => { FOOD.test_support = { id: 'test_support', name: '测试补给', tier: 1, icon: 'eq_guard', text: '', battleRules: rules }; };
const relic = (rules: BattleRule[], counterScope: 'team' | 'holder' = 'team') => { RELIC.test_support = { id: 'r_relay_bell', name: '测试遗物', icon: 'eq_guard', text: '', battleRules: rules, counterScope }; };
const foes = () => [unit('t_drakelet', { atk: 6, hp: 2000 })];
const triggers = (out: BattleOut, label: string) => out.events.filter(e => e.t === 'trigger' && e.label.includes(label));
let scenarios = 0;
function trace(out: BattleOut) {
  for (const e of out.events) if (e.t === 'move' || e.t === 'summon' || e.t === 'die') {
    ok(e.order.every(line => line.length <= 5), 'five slot capacity');
    ok(new Set(e.order.flat()).size === e.order.flat().length, 'unique runtime IDs');
  }
  ok(out.events.length < 30000 && out.events.at(-1)?.t === 'end', 'bounded event dispatch');
  const dealt = out.stats.units.reduce((n, r) => n + r.damageDealt, 0);
  const taken = out.stats.units.reduce((n, r) => n + r.damageTaken, 0);
  ok(dealt === taken, `damage conserved: ${dealt} / ${taken}`);
  scenarios++;
}
try {
  reset();
  equipment([B('start', 'damage', 'enemyFront', 5)]);
  food([B('start', 'damage', 'enemyFront', 7)]);
  relic([B('start', 'damage', 'enemyFront', 11, { limit: 1 })]);
  const sources = simulate([unit('t_wisp', { ench: 'test_support', supportFoods: ['test_support', 'test_support'], lvl: 3 }), unit('t_bonelet')], foes(), 19, ['test_support']);
  const first = sources.stats.units.find(r => r.uid === 1)!;
  ok(first.damageBySource.some(s => s.kind === 'equipment' && s.damage === 5), 'equipment attributed to bearer');
  ok(first.damageBySource.some(s => s.kind === 'supply' && s.damage === 7), 'consumed supply attributed once to bearer');
  ok(sources.stats.units.some(r => r.kind === 'relic' && r.def === 'test_support' && r.damageDealt === 11), 'relic has independent contribution row');
  ok(triggers(sources, '测试遗物').length === 1, 'team start budget shared among holders');
  trace(sources);

  equipment([B('faint', 'damage', 'enemyFront', 5)], { sp: 'crown' });
  set('t_wisp', [B('faint', 'damage', 'enemyFront', 2)]);
  const amp = simulate([unit('t_wisp', { hp: 1, ench: 'test_support' }), unit('l_archon', { lvl: 2 })], foes());
  ok(triggers(amp, '测试装备').length === 1, 'crown and tiger execute support faint once');
  ok(amp.events.filter(e => e.t === 'dmg' && e.src === 1 && e.kind === 'shot' && e.n === 2).length === 3, 'crown and tiger preserve native repetition');
  trace(amp);

  reset();
  equipment([B('faint', 'damage', 'enemyFront', 9)]);
  set('t_wisp', [B('faint', 'inherit', 'behind', 25)]);
  const inheritance = simulate([unit('t_wisp', { hp: 1, ench: 'test_support' }), unit('t_bonelet', { hp: 1 })], foes());
  ok(triggers(inheritance, '测试装备').length === 1, 'equipment faint stays with original owner');
  trace(inheritance);

  reset();
  relic([B('enter', 'damage', 'enemyFront', 3, { limit: 2 })]);
  const revival = simulate([unit('t_wisp', { hp: 1, lamp: true }), unit('t_bonelet', { hp: 1 }), unit('t_bonelet', { hp: 1 })], foes(), 19, ['test_support']);
  ok(triggers(revival, '测试遗物').length === 2, 'team limit retained through revival and later entrants');
  trace(revival);
  relic([B('enter', 'damage', 'enemyFront', 3, { limit: 1 })], 'holder');
  const holder = simulate([unit('t_wisp', { hp: 1, lamp: true }), unit('t_bonelet', { hp: 1 })], foes(), 19, ['test_support']);
  ok(triggers(holder, '测试遗物').length === 2, 'holder limit retained on revive and separate across initial owners');
  trace(holder);

  reset();
  set('t_wisp', [B('faint', 'summon', 'self', 2)]);
  relic([B('enter', 'damage', 'enemyFront', 3, { limit: 2 })]);
  const summoned = simulate([unit('t_wisp', { hp: 1 })], foes(), 19, ['test_support']);
  ok(triggers(summoned, '测试遗物').length === 2, 'summoned unit binds existing team relic ledger');
  trace(summoned);

  reset();
  set('t_wisp', [B('afterAttack', 'rotate', 'self', 1)]);
  set('t_bonelet', [B('afterAttack', 'rotate', 'self', 1)]);
  equipment([B('move', 'charge', 'self', 2, { limit: 1 })]);
  food([B('move', 'block', 'front', 1, { limit: 1 })]);
  relic([B('move', 'buff', 'front', 1, { hp: 2, limit: 3 })]);
  const moved = simulate([unit('t_wisp', { ench: 'test_support', supportFoods: ['test_support'] }), unit('t_bonelet')], foes(), 19, ['test_support']);
  ok(moved.events.some(e => e.t === 'counter' && e.uid === 1 && e.charge === 2), 'move resource belongs to actual moved holder');
  ok(triggers(moved, '测试遗物').length === 3, 'move team budget limited over repeated laps');
  trace(moved);

  reset();
  set('t_wisp', [B('enter', 'release', 'enemyFront', 3)]);
  equipment([B('released', 'charge', 'behind', 2, { limit: 2 })]);
  const released = simulate([unit('t_wisp', { startCharge: 2, ench: 'test_support' }), unit('t_bonelet')], foes());
  ok(released.init[0].charge === 2 && released.events.some(e => e.t === 'dmg' && e.src === 1 && e.kind === 'shot' && e.n === 6), 'preloaded supply charge enters native release');
  ok(released.events.some(e => e.t === 'counter' && e.uid === 2 && e.charge === 2), 'successful release feeds next holder');
  const empty = simulate([unit('t_wisp', { ench: 'test_support' }), unit('t_bonelet')], foes());
  ok(triggers(empty, '测试装备').length === 0, 'empty release skips released event');
  trace(released); trace(empty);

  reset();
  set('t_wisp', [B('faint', 'inherit', 'behind', 50)]);
  equipment([B('inherited', 'block', 'self', 1, { limit: 1 })]);
  const inherited = simulate([unit('t_wisp', { hp: 1 }), unit('t_bonelet', { ench: 'test_support' })], foes());
  ok(triggers(inherited, '测试装备').length === 1, 'effective inheritance triggers on recipient');
  trace(inherited);

  reset();
  equipment([B('start', 'summon', 'self', 2)]);
  const full = simulate([unit('t_wisp', { ench: 'test_support' }), ...Array.from({ length: 4 }, () => unit('t_bonelet'))], foes());
  ok(full.events.some(e => e.t === 'fizzle' && e.reason === 'full'), 'support summon respects capacity');
  trace(full);

  equipment([B('start', 'mark', 'quarry', 2)]);
  food([B('start', 'mark', 'quarry', 1)]);
  relic([B('start', 'mark', 'quarry', 1, { limit: 1 })]);
  const marks = simulate([unit('t_wisp', { ench: 'test_support', supportFoods: ['test_support'] })], [unit('t_bonelet', { hp: 3 }), unit('t_drakelet', { hp: 300 })], 19, ['test_support']);
  ok(marks.stats.units[0].damageBySource.some(s => s.kind === 'equipment'), 'equipment marks retain source');
  ok(marks.stats.units.some(r => r.kind === 'relic' && r.damageDealt > 0), 'relic marks retain independent source through transfer');
  trace(marks);

  equipment([B('start', 'damage', 'enemyFront', 5)]);
  const replaced = simulate([unit('t_wisp', { ench: 'w_sword' })], foes());
  ok(triggers(replaced, '测试装备').length === 0, 'replacing equipment discards old rules');
  trace(replaced);
  const enemy = simulate([unit('t_wisp')], [unit('t_bonelet', { ench: 'test_support', supportFoods: ['test_support'] })], 19, ['test_support']);
  ok(enemy.stats.units.some(r => r.uid === 2 && r.damageBySource.some(s => s.kind === 'equipment')), 'enemy owns its equipment rules');
  ok(enemy.stats.units.filter(r => r.kind === 'relic').every(r => r.side === 0), 'relics isolated to player side');
  trace(enemy);
  ok(JSON.stringify(simulate([unit('t_wisp')], foes(), 41)) === JSON.stringify(simulate([unit('t_wisp')], foes(), 41)), 'same seed deterministic');
  reset(); equipment([]); food([]); relic([]);
  const sealed: UnitSpec = unit('t_wisp', { seal: 20, sealSources: { 'supply:test_support': 3, 'equipment:test_support': 4, 'relic:test_support': 5 }, lamp: true, hp: 1 });
  const mixedSeal = simulate([sealed], foes());
  const sealRow = mixedSeal.stats.units.find(r => r.uid === 1)!;
  ok(sealRow.damageBySource.some(s => s.kind === 'skill' && s.label === '封印首击' && s.damage === 8), 'native seal keeps skill balance');
  ok(sealRow.damageBySource.some(s => s.kind === 'supply' && s.damage === 3), 'supply seal contribution');
  ok(sealRow.damageBySource.some(s => s.kind === 'equipment' && s.damage === 4), 'equipment seal contribution');
  ok(mixedSeal.stats.units.some(r => r.kind === 'relic' && r.damageDealt === 5), 'relic seal independent contribution');
  ok(triggers(mixedSeal, '封印首击').length === 1, 'revival preserves spent seal');
  ok(sealed.seal === 20 && sealed.sealSources?.['supply:test_support'] === 3, 'input seal sources preserved');
  trace(mixedSeal);
  const copiedSeal = simulate([sealed, sealed], foes());
  ok(triggers(copiedSeal, '封印首击').length === 2, 'copies consume seal independently once');
  trace(copiedSeal);
  const cappedSeal = simulate([unit('t_wisp', { seal: 999999, sealSources: { 'supply:test_support': 999999, 'equipment:test_support': 9 } })], [unit('t_drakelet', { hp: 20000 })]);
  ok(cappedSeal.events.some(e => e.t === 'dmg' && e.kind === 'shot' && e.n === 9999), 'seal and provenance capped together at 9999');
  ok(cappedSeal.stats.units[0].damageBySource.some(s => s.kind === 'supply' && s.damage === 9999), 'capped provenance matches actual damage');
  trace(cappedSeal);
  const execSeal = simulate([unit('t_wisp', { ...sealed, hp: 80, ench: 'b_axe', lamp: false })], [unit('t_drakelet', { hp: 400, wounds: 300 })]);
  ok(execSeal.events.some(e => e.t === 'dmg' && e.kind === 'shot' && e.n === 30), 'execution multiplier scales mixed seal damage');
  trace(execSeal);
  reset();
  equipment([B('faint', 'damage', 'enemyFront', 3, { limit: 1 })]);
  food([B('faint', 'summon', 'front', 2, { hp: 2, limit: 1 })]);
  const simultaneousSupports = simulate([unit('t_wisp', { hp: 2, lamp: true, ench: 'test_support', supportFoods: ['test_support'] }), unit('t_bonelet', { hp: 2, ench: 'test_support', supportFoods: ['test_support'] }), ...Array.from({ length: 3 }, () => unit('t_bonelet'))], [unit('t_drakelet', { hp: 3000, atk: 10, tfx: ['thunder'] })]);
  ok(triggers(simultaneousSupports, '测试装备').length === 2, 'same-batch deaths each consume one equipment faint charge');
  ok(simultaneousSupports.events.some(e => e.t === 'fizzle' && e.reason === 'full'), 'same-batch support summons and revive respect shared capacity');
  trace(simultaneousSupports);
  reset();
  for (const kind of ['equipment', 'supply', 'relic', 'unit'] as const) {
    equipment([]); food([]); relic([]);
    const summonRule = B('faint', 'summon', 'front', 3, { hp: 3, limit: 1 });
    const holder = unit('t_wisp', { hp: 1 });
    if (kind === 'equipment') { equipment([summonRule]); holder.ench = 'test_support'; }
    if (kind === 'supply') { food([summonRule]); holder.supportFoods = ['test_support']; }
    if (kind === 'relic') relic([summonRule]);
    if (kind === 'unit') set('t_wisp', [summonRule]);
    const out = simulate([holder], foes(), 83, kind === 'relic' ? ['test_support'] : []);
    const expectedKind = kind === 'unit' ? 'summon' : kind;
    const contribution = out.stats.units.find(r => kind === 'relic' ? r.kind === 'relic' : r.uid === 1)!;
    ok(contribution.damageBySource.some(s => s.kind === expectedKind && s.damage === 3), `${kind} summoned attack retains creation source`);
    if (kind !== 'relic') ok(contribution.summons === 1 && contribution.damageBySource.some(s => s.label.includes('召唤物')), `${kind} summoned contribution stays on owner row`);
    if (kind === 'relic') ok(contribution.label === '测试遗物', 'relic summon row retains clean relic name');
    trace(out);
  }
  reset();
  const relayChargeRules = [B('enter', 'release', 'enemyFront', 1), B('afterAttack', 'rotate', 'self', 1), B('clashEnd', 'charge', 'self', 1, { when: 'rear' })];
  set('t_wisp', relayChargeRules); set('t_bonelet', relayChargeRules);
  const saturatedRelay = simulate([unit('t_wisp', { hp: 2000, startCharge: 2, ench: 'e_chamber' }), unit('t_bonelet', { hp: 2000, startCharge: 999 })], [unit('t_drakelet', { hp: 20000, atk: 1 })], 101, ['r_shot_chain']);
  const firstMove = saturatedRelay.events.findIndex(e => e.t === 'move');
  ok(!saturatedRelay.events.slice(0, firstMove).some(e => e.t === 'trigger' && (e.label.includes('回压弹膛') || e.label.includes('联膛管'))), 'saturated initial recipient preserves equipment and team charge budgets');
  ok(triggers(saturatedRelay, '回压弹膛').length === 2 && triggers(saturatedRelay, '联膛管').length === 2, 'preserved charge budgets execute after recipients release their saturated charge');
  trace(saturatedRelay);
  console.log(`support combat: ${scenarios} source, ledger, event and capacity scenarios passed`);
} finally {
  for (const { def, rules } of snapshots) (def as CardDef).rules = rules;
  delete EQUIP.test_support; delete FOOD.test_support; delete RELIC.test_support;
}

// 用真实目录逐件交叉十一派；验证至少一个组合实际改变资源、身材或伤害。
const { SUPPORT_FOODS, SUPPORT_EQUIPS, SUPPORT_RELICS } = await import('../src/core/supportCatalog');
const heroes = ['rw_wheel_courier', 'rw_charge_gunner', 'rw_ember_tinder', 'rw_nest_den', 'rw_blood_razor', 'rw_trade_tycoon', 'rw_rune_chorus', 'rw_pair_cadet', 'rw_hunt_spotter', 'rw_formation_guard', 'rw_supply_cook'];
const lineup = (hero: string): UnitSpec[] => [unit('rw_ember_tinder', { hp: 1 }), unit(hero, { hp: 28, startCharge: 2 }), unit(hero, { hp: 32, lvl: 2, startCharge: 2 }), unit('rw_charge_gunner', { hp: 40, startCharge: 2 })];
const opponents = () => [unit('t_wisp', { hp: 3000, atk: 9 }), unit('t_bonelet', { hp: 3000, atk: 9 })];
const mechanical = (out: BattleOut) => JSON.stringify([out.init, out.events.filter(e => e.t !== 'trigger' && e.t !== 'fizzle')]);
const baselines = new Map(heroes.map(hero => [hero, mechanical(simulate(lineup(hero), opponents(), 67, [], { gold: 7, spells: 3, quarry: 1 }))]));
let matrix = 0, affectedItems = 0;
for (const item of SUPPORT_FOODS.filter(f => f.battleRules?.length || f.resources)) {
  let affected = false;
  for (const hero of heroes) {
    const team = lineup(hero);
    for (const u of team.slice(1, 3)) {
      u.supportFoods = [item.id];
      if (item.resources) {
        u.startCharge = (u.startCharge ?? 0) + (item.resources.charge ?? 0);
        u.startBlock = item.resources.block;
        u.wounds = item.resources.wounds;
        u.seal = item.resources.seal;
        if (u.seal) u.sealSources = { [`supply:${item.id}`]: u.seal };
      }
    }
    const out = simulate(team, opponents(), 67, [], { gold: 7, spells: 3, quarry: 1 });
    trace(out); matrix++;
    affected ||= mechanical(out) !== baselines.get(hero);
  }
  ok(affected, `${item.id} produces a mechanical combat effect across archetypes`); affectedItems++;
}
for (const item of SUPPORT_EQUIPS.filter(e => e.rules?.some(r => r.phase === 'battle'))) {
  let affected = false;
  for (const hero of heroes) {
    const team = lineup(hero);
    team[1].ench = team[2].ench = item.id;
    const out = simulate(team, opponents(), 67, [], { gold: 7, spells: 3, quarry: 1 });
    trace(out); matrix++;
    // 装备ID本身排除于机械差异比较，检查实际事件改变。
    const events = JSON.stringify(out.events.filter(e => e.t !== 'trigger' && e.t !== 'fizzle'));
    const plain = simulate(lineup(hero), opponents(), 67, [], { gold: 7, spells: 3, quarry: 1 });
    affected ||= events !== JSON.stringify(plain.events.filter(e => e.t !== 'trigger' && e.t !== 'fizzle'));
  }
  ok(affected, `${item.id} produces a mechanical combat effect across archetypes`); affectedItems++;
}
for (const item of SUPPORT_RELICS.filter(r => r.battleRules?.length)) {
  let affected = false;
  for (const hero of heroes) {
    const out = simulate(lineup(hero), opponents(), 67, [item.id], { gold: 7, spells: 3, quarry: 1 });
    trace(out); matrix++;
    affected ||= mechanical(out) !== baselines.get(hero);
  }
  ok(affected, `${item.id} produces a mechanical combat effect across archetypes`); affectedItems++;
}
ok(matrix > 300 && affectedItems >= 30, 'active catalog supplies broad combat coverage');
console.log(`support catalog: ${affectedItems} combat support items × eleven archetypes = ${matrix} checked battles`);

const relayReal = simulate([unit('rw_wheel_courier', { supportFoods: ['f_relay_ribbon'] }), unit('rw_wheel_courier')], opponents(), 71, ['r_relay_bell']);
ok(relayReal.events.some(e => e.t === 'block' && e.src === 1 && e.tgt === 2 && e.n === 1), 'relay ribbon protects actual new front');
ok(triggers(relayReal, '接棒钟').length === 3, 'real relay bell uses three team charges'); trace(relayReal);
const chamberReal = simulate([unit('rw_charge_gunner', { hp: 1, startCharge: 2, ench: 'e_chamber', supportFoods: ['f_siege_fuse'] }), unit('rw_charge_gunner', { startCharge: 0 })], opponents(), 71, ['r_shot_chain']);
ok(chamberReal.events.some(e => e.t === 'counter' && e.uid === 2 && e.charge === 4), 'chamber and team shot chain load actual next gunner');
ok(chamberReal.stats.units[0].damageBySource.some(s => s.kind === 'supply' && s.label.includes('散弹引信')), 'real release supply keeps own damage contribution'); trace(chamberReal);
const heirReal = simulate([unit('rw_ember_tinder', { hp: 1 }), unit('rw_common_veteran', { ench: 'e_ember_clasp', supportFoods: ['f_heir_wax'] }), unit('rw_common_veteran')], opponents(), 71, ['r_ash_vow']);
ok(triggers(heirReal, '承火搭扣').length === 1 && triggers(heirReal, '守火蜡').length === 1, 'clasp and wax trigger on actual heir once');
ok(heirReal.events.some(e => e.t === 'block' && e.src === 2 && e.tgt === 3), 'ash vow protects the heir successor'); trace(heirReal);
const quarryReal = simulate([unit('rw_hunt_spotter'), unit('rw_hunt_spotter', { lvl: 2 })], opponents(), 71, ['r_quarry_writ'], { quarry: 1 });
ok(quarryReal.events.some(e => e.t === 'dmg' && e.src === 1 && e.tgt === 4 && e.kind === 'shot' && e.n === 3), 'quarry writ scales selected quarry marks while front remains unmarked');
ok(quarryReal.stats.units.some(r => r.def === 'r_quarry_writ' && r.damageDealt > 0), 'quarry writ damage has independent row'); trace(quarryReal);
console.log('support real cards: relay, chamber, heir and selected-quarry combinations passed');

const frozenHeir = simulate([unit('rw_nest_den', { hp: 3, atk: 10, ench: 'e_testament' }), unit('rw_common_veteran', { supportFoods: ['f_heir_wax'] })], [unit('t_wisp', { hp: 1000, atk: 60 })]);
ok(frozenHeir.events.some(e => e.t === 'buff' && e.src === 1 && e.tgt === 2 && e.atk === 3), 'testament retains original heir after native den summon inserts ahead');
ok(triggers(frozenHeir, '守火蜡').length === 1, 'original heir receives wax interaction');
ok(!frozenHeir.events.some(e => e.t === 'buff' && e.src === 1 && e.tgt > 3), 'newly summoned den token receives separate summon body'); trace(frozenHeir);
console.log('support audit regressions: frozen faint heir and saturated relay budgets passed');
