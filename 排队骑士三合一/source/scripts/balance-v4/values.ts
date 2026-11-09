// @ts-ignore node builtin
import { writeFileSync } from 'node:fs';
import { CARDS as OLD_CARDS, FOODS as OLD_FOODS } from './baseline/data';
import { CARDS as NEW_CARDS, FOODS as NEW_FOODS } from '../../src/core/data';
const changedUnits = NEW_CARDS.filter((n) => {
  const o = OLD_CARDS.find((x) => x.id === n.id);
  return o && !n.token && !n.enemy && (o.atk !== n.atk || o.hp !== n.hp);
}).map((n) => { const o = OLD_CARDS.find((x) => x.id === n.id)!; return { id: n.id, name: n.name, tier: n.tier, oldAtk: o.atk, oldHp: o.hp, newAtk: n.atk, newHp: n.hp }; });
const foodShape = (f: any) => ({ atk: f.atk ?? 0, hp: f.hp ?? 0, n: f.n ?? 1, behind: !!f.behind, around: !!f.around, tmp: !!f.tmp, text: f.text });
const changedFoods = NEW_FOODS.filter((n) => {
  const o = OLD_FOODS.find((x) => x.id === n.id);
  return o && JSON.stringify(foodShape(o)) !== JSON.stringify(foodShape(n));
}).map((n) => { const o = OLD_FOODS.find((x) => x.id === n.id)!; return { id: n.id, name: n.name, tier: n.tier, old: foodShape(o), new: foodShape(n) }; });
if (changedUnits.length !== 30) throw new Error(`expected 30 changed non-token units, got ${changedUnits.length}`);
if (changedFoods.length !== 5) throw new Error(`expected 5 changed foods, got ${changedFoods.length}`);
const out = { basis: 'scripts/balance-v4/baseline/data.ts versus current src/core/data.ts', changedUnits, changedFoods };
const dir = new URL('../../output/balance-v4/', import.meta.url);
writeFileSync(new URL('value-changes.json', dir), JSON.stringify(out, null, 2));
const target = (x: any) => x.around ? 'target + actual front/back neighbors' : x.behind ? 'target + actual behind neighbor' : x.n === 99 ? 'all allies' : x.n > 1 ? `${x.n} random allies` : 'one ally';
const stat = (x: any) => `${x.atk}/${x.hp}${x.tmp ? ' (battle)' : ' (permanent)'}`;
const md = ['# Balance v3 final production B value changes', '', 'Final production B compared directly against the frozen working-tree baseline, not Git HEAD. Candidate A is abandoned.', '',
  '## Units (30)', '', '| Tier | ID | Unit | Baseline | Final B | Delta |', '|---:|---|---|---:|---:|---:|',
  ...changedUnits.map((x) => `| ${x.tier} | ${x.id} | ${x.name} | ${x.oldAtk}/${x.oldHp} | ${x.newAtk}/${x.newHp} | +${x.newAtk - x.oldAtk}/+${x.newHp - x.oldHp} |`), '',
  '## Supplies (5)', '', '| Tier | ID | Supply | Baseline | Final B |', '|---:|---|---|---|---|',
  ...changedFoods.map((x) => `| ${x.tier} | ${x.id} | ${x.name} | ${target(x.old)}; ${stat(x.old)} | ${target(x.new)}; ${stat(x.new)} |`), ''];
writeFileSync(new URL('value-changes.md', dir), md.join('\n'));
console.log(`VALUE_CHANGES_OK units=${changedUnits.length} foods=${changedFoods.length}`);
