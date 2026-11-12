import { SHOP_POOL, STAT_CAP } from '../src/core/data';
import { newRun, type Owned } from '../src/core/run';
import { formationConditions, formationFeedback, previewPlacement } from '../src/qb/formationFeedback';

function fixture(cells: (string | null)[]) {
  const r = newRun(42, { solo: true });
  r.queue = Array.from({ length: 5 }, (_, i): Owned | null => cells[i]
    ? { oid: r.nextId++, def: cells[i]!, copies: 1, atkBonus: 0, hpBonus: 0 } : null);
  r.enemy = { boss: null, units: [{ def: 't_wolf', atk: 2, hp: 70, lvl: 1 }] };
  return r;
}
function check(ok: unknown, note: string) { if (!ok) throw Error(note); }
function view(r: ReturnType<typeof fixture>, slot: number) {
  const before = JSON.stringify(r);
  const result = formationFeedback(r, slot);
  check(before === JSON.stringify(r), 'preview changed the run');
  check(result.lines.length <= 3, 'overflow');
  return { ...result, text: result.lines.map(x => x.label + ' ' + x.text).join(' / ') };
}
const T = 't_wisp';
const runner = fixture(['rw_wheel_runner', null, T]);
check(view(runner, 0).text.includes('第3位格挡+1'), 'sparse runner');
const saved = JSON.stringify(runner);
const swapped = previewPlacement(runner, 0, 2);
check(JSON.stringify(runner) === saved && !swapped.beneficiaryOids.includes(runner.queue[0]!.oid), 'swap purity');
const pair = fixture(['rw_pair_cadet', null, 'rw_pair_cadet', T]);
check(view(pair, 0).text.includes('第3位+2/+1') && view(pair, 0).beneficiaries[0].slot === 2, 'gold partners');
check(previewPlacement(pair, 2, 3).lines.some(x => x.text.includes('缺少同名')), 'split the pair by swapping');
check(previewPlacement(pair, 2, 0).lines.some(x => x.text.includes('合为2份')), 'actual merge');
pair.queue[2]!.copies = 2;
check(previewPlacement(pair, 2, 0).lines.some(x => x.text.includes('升为金色')) && !pair.discover?.length, 'gold merge and pending choice stay on the copy');
const cannon = fixture(['rw_charge_gunner', T]);
cannon.queue[0]!.startCharge = 2;
cannon.queue[1]!.hpBonus = 10;
check(view(cannon, 0).text.includes('受到4伤害'), 'front release');
const rear = previewPlacement(cannon, 0, 1);
check(rear.lines.some(x => x.text.includes('每次交锋后自身蓄能+2')) && rear.beneficiaryOids.includes(cannon.queue[0]!.oid), 'rear charging and original oid');
const egg = fixture(['rw_nest_hatch', T, T, T, T]);
check(view(egg, 0).text.includes('队伍满员'), 'full summon');
egg.queue[1] = null;
check(view(egg, 0).text.includes('队首召唤2/2幼兽'), 'legal summon');
const gear = fixture([T, T, null, T]);
gear.queue[1]!.ench = 'e_loader';
gear.queue[0]!.hpBonus = 8;
const loader = view(gear, 1);
check(loader.text.includes('递弹臂环') && loader.text.includes('第4位蓄能+1') && loader.beneficiaryOids.includes(gear.queue[3]!.oid), 'equipment rear support');
const factor = fixture([T, 'rw_trade_factor', null, 'rw_trade_factor']);
factor.tc.bought = 4;
const seals = view(factor, 3);
check(seals.text.includes('回合末 第2位首击追加4伤害') && !seals.text.includes('第1位首击'), 'same-name seal provenance');
const growth = fixture([T, null, 'n_tether']);
check(view(growth, 2).text.includes('第1位永久生命+1'), 'permanent hp');
const ember = fixture(['rw_ember_tinder', null, T]);
ember.queue[0]!.atkBonus = 5;
check(view(ember, 0).text.includes('阵亡传承') && view(ember, 0).beneficiaryOids.includes(ember.queue[2]!.oid), 'faint recipient');
const mark = fixture(['rw_hunt_spotter']);
mark.enemy.units.push({ def: T, atk: 2, hp: 90, lvl: 1 }); mark.quarry = 1;
check(view(mark, 0).text.includes('敌方第2位猎标+1'), 'selected quarry');
const support = fixture([T, T]);
support.queue[0]!.supportFoods = ['f_twincake'];
support.relics = ['r_nest_roll'];
check(view(support, 0).text.includes('育兽名册') && view(support, 0).text.includes('第2位生命+1'), 'relic recipient');
check(view(support, 0).text.includes('对半饼') && view(support, 0).text.includes('第2位格挡+1'), 'consumed food');
support.queue[1]!.ench = 'e_twin_knot'; support.relics.push('r_pair_pennant');
const received = view(support, 0);
check(!received.lines.some(line => line.label.endsWith('·魂火')), 'equipment and relics are not attributed to the unit body');
const capped = fixture(['rw_formation_banner', T]);
capped.queue[1]!.hpBonus = STAT_CAP; capped.queue[1]!.atkBonus = STAT_CAP;
check(!view(capped, 0).text.includes('第2位+'), 'capped stats');
const protectedFoe = fixture(['rw_trade_tycoon']);
protectedFoe.gold = 13; protectedFoe.enemy.units[0] = { def: 'rw_blood_immortal', atk: 1, hp: 1, lvl: 1 };
check(!view(protectedFoe, 0).text.includes('受到13伤害'), 'actual damage after survival');
const guard = fixture([T, null, 'rw_formation_guard']);
check(view(guard, 2).text.includes('替第1位分担伤害'), 'guard');
const negative = fixture([T, T]);
negative.relics = ['r_heavy']; negative.queue[1]!.atkBonus = 5;
check(!view(negative, 1).beneficiaries.length, 'negative relic effects');
for (const def of SHOP_POOL) {
  const r = fixture([T, null, def.id, null, T]);
  const feedback = view(r, 2);
  check(feedback.lines.length > 0, def.name);
  check(feedback.beneficiaries.every(pos => feedback.beneficiaryOids.includes(r.queue[pos.slot]!.oid)), 'recipient identity ' + def.id);
}
const practice = fixture(['rw_pair_cadet', null, 'rw_pair_cadet']);
practice.endTurnCommitted = true;
const initial = JSON.stringify(practice);
const conditions = formationConditions(practice, 0);
check(conditions.beneficiaryOids.includes(practice.queue[2]!.oid) && !conditions.damageTargets.length && JSON.stringify(practice) === initial, 'rehearsal reads sparse pairing without changing the snapshot');
practice.seed++; practice.enemy.units = [];
check(JSON.stringify(formationConditions(practice, 0)) === JSON.stringify(conditions), 'rehearsal ignores enemy and battle seed');
check(formationConditions(fixture(['rw_nest_hatch', T, T, T, T]), 0).lines.some(line => line.text.includes('当前满员')), 'rehearsal reports current summoning space');
runner.endTurnCommitted = true;
check(!view(runner, 0).lines.length && !previewPlacement(runner, 0, 2).lines.length, 'locked state');
console.log('Formation feedback passed sparse slots, swaps, pair, prepared charge, summons, equipment, quarry, relics, end-turn sources, inheritance, guards, caps, survival, and preview purity.');
