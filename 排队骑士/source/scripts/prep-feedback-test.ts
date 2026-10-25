import { card } from '../src/core/data';
import { simulate } from '../src/core/engine';
import { battleTimeline } from '../src/ui/battleTimeline';
import { previewEndTurn, previewInheritance } from '../src/core/previews';
import { endTurn, load, newRun, ownedAtk, ownedHp, playerTeam, SAVE_KEY, sell, shownStats, useFood, type Owned, type RunState } from '../src/core/run';

let checks = 0;
function eq(a: unknown, b: unknown, label: string) {
  checks++;
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${label}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
}
const unit = (def: string, oid: number, copies = 1): Owned => ({ def, oid, copies, atkBonus: 0, hpBonus: 0 });
function fixture() {
  const r = newRun(890123); r.gold = 100; r.nextId = 200;
  r.queue = [unit('d_artificer', 101), unit('d_artificer', 102), unit('d_artificer', 103), null, null];
  r.shop = []; r.relics = ['r_share']; return r;
}
function eat(r: RunState, def: string, slot: number | null) {
  const sid = r.nextId++;
  r.shop.push({ sid, kind: 'food', def, locked: false, free: false });
  return useFood(r, sid, slot);
}
for (const before of ['f_dragon', 'f_sushi', 'f_stew', 'f_elixir', 'f_can']) {
  const r = fixture();
  eat(r, before, before === 'f_elixir' || before === 'f_stew' ? 1 : null);
  eq(r.tc.shareUsed, false, `${before} preserves share`);
  const stats = r.queue.slice(0, 3).map((o) => [ownedAtk(o!), ownedHp(o!)]);
  eat(r, 'f_bread', 1);
  eq(r.queue.slice(0, 3).map((o, i) => [ownedAtk(o!) - stats[i][0], ownedHp(o!) - stats[i][1]]), [[1,1],[1,1],[1,1]], `${before} then bread shares`);
  eq(r.tc.shareUsed, true, 'eligible supply consumes share');
  const left = ownedAtk(r.queue[0]!);
  eat(r, 'f_bread', 1);
  eq(ownedAtk(r.queue[0]!), left, 'only first eligible supply shares');
}
{
  const r = fixture(); r.gold = 0;
  eq(eat(r, 'f_bread', 1).ok, false, 'failed buy'); eq(r.tc.shareUsed, false, 'failed buy does not consume');
}
{
  const r = fixture();
  r.queue = [unit('v_guard', 101), unit('v_keeper', 102), unit('v_mage', 103), unit('v_wyvern', 104), null];
  r.queue[0]!.foodHistory = [{ id: 'f_roast', atk: 5, hp: 5, sourceId: 190 }];
  const original = JSON.stringify(r);
  const preview = previewInheritance(r, 0)!;
  eq(JSON.stringify(r), original, 'inheritance preview does not mutate');
  eq(preview.receiver?.oid, 102, 'inheritance receiver');
  const clone = structuredClone(r); sell(clone, 0);
  for (const item of preview.changes) eq(item.after, shownStats(clone.queue.find((o) => o?.oid === item.oid)!), 'inheritance matches actual including chains');
  r.queue = [null, unit('v_guard', 101), null, null, null]; r.queue[1]!.foodHistory = [{ id: 'f_bread', atk: 1, hp: 1, sourceId: 191 }];
  eq(previewInheritance(r, 1)?.receiver, null, 'no false receiver');
}
{
  const r = fixture();
  r.queue = [unit('l_vigil', 101, 3), unit('n_tether', 102), unit('d_hourglass', 103, 3), unit('d_pharaoh', 104, 3), null];
  // Use ability IDs from shipped data rather than alternate names.
  for (const o of r.queue) if (o && !card(o.def)) throw new Error(`unknown fixture ${o.def}`);
  const original = JSON.stringify(r), projected = previewEndTurn(r);
  eq(JSON.stringify(r), original, 'endTurn preview does not mutate seed or growth');
  const clone = structuredClone(r); endTurn(clone);
  for (const item of projected) eq(item.after, shownStats(clone.queue.find((o) => o?.oid === item.oid)!), 'growth matches formal rule');
  r.queue[0]!.ench = 'c_rage'; r.queue[0]!.tmpHp = 8; r.queue[0]!.tmpAtk = 8; r.queue[0]!.atkBonus = 44;
  const projectedGear = previewEndTurn(r), actualGear = structuredClone(r); endTurn(actualGear);
  for (const item of projectedGear) {
    const formal = playerTeam(actualGear).find((o) => o.oid === item.oid)!;
    eq(item.after, [formal.atk, formal.hp], 'temporary growth before gear and cap');
  }
}
{
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) } });
  const r = fixture(); delete r.tc.shareUsed; r.tc.foods = 1;
  store.set(SAVE_KEY, JSON.stringify(r));
  const old = load()!; eq(old.tc.shareUsed, true, 'legacy same-turn conservative');
  r.tc.shareUsed = false; store.set(SAVE_KEY, JSON.stringify(r));
  eq(load()!.tc.shareUsed, false, 'new share availability persists');
}
{
  const out = simulate([{ def: 'd_artificer', lvl: 1, atk: 49, hp: 50 }], [{ def: 'd_artificer', lvl: 1, atk: 1, hp: 1 }]);
  const [a, b] = out.init;
  out.events = [
    { t: 'buff', src: a.uid, tgt: a.uid, atk: 4, hp: 4, nowAtk: 50, nowHp: 50 },
    { t: 'buff', src: a.uid, tgt: a.uid, atk: 4, hp: 4, nowAtk: 50, nowHp: 50 },
    { t: 'clash', a: a.uid, b: b.uid, n: 1 },
  ];
  const pages = battleTimeline(out);
  eq(pages[0].title, '开战至首次交锋前', 'opening includes beforeAttack phase');
  eq(pages[0].lines[0].endsWith('：+1/0'), true, 'timeline reports capped actual growth');
  eq(pages[0].lines[1].endsWith('：0/0（未增加属性）'), true, 'timeline reports blocked growth');
  eq(pages[1].title, '交锋 1 及随后效果', 'clash page includes following effects');
}
console.log(`PREP_FEEDBACK_OK ${checks} assertions`);
