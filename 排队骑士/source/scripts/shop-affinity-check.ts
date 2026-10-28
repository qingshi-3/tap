import { card, hasTag, SHOP_POOL } from '../src/core/data';
import { adReroll, maxTier, newRun, reroll, type Diff, type Owned } from '../src/core/run';

const check = (condition: unknown, message: string) => { if (!condition) throw Error(message); };
const unit = (def: string, oid: number): Owned => ({ def, oid, copies: 1, atkBonus: 0, hpBonus: 0 });
const related = (def: string, team: Owned[]) => team.some((o) => {
  const d = card(o.def);
  return d.id === def || [d.line, d.tag2].some(t => t && t !== 'any' && t !== 'enemy' && hasTag(card(def), t));
});
let checked = 0;
for (const diff of [0, 1, 2] as Diff[]) for (const turn of [1, 5, 9, 15]) {
  for (const defs of [['l_windblade'], ['l_windblade', 'm_egg'], ['l_archon'], []]) {
    for (let seed = 1; seed <= 80; seed++) {
      const r = newRun(seed * 7919, { diff });
      r.turn = turn;
      const team = defs.map((d, i) => unit(d, 1000 + i));
      r.queue = [...team, ...Array(5 - team.length).fill(null)];
      r.gold = 10;
      // Existing matching locked unit must not satisfy the NEW-card guarantee.
      const locked = { sid: 9000, kind: 'unit' as const, def: 'l_windblade', locked: true, free: false };
      const milk = { sid: 9001, kind: 'food' as const, def: 'f_milk', locked: false, free: true, val: [2, 2] as [number, number] };
      r.shop = [locked, milk];
      const before = structuredClone(r);
      check(reroll(r) !== null && r.gold === 9, 'paid refresh costs exactly one');
      const repeat = structuredClone(before);
      reroll(repeat);
      check(JSON.stringify(r) === JSON.stringify(repeat), 'seed/save snapshot deterministic');
      const eligible = SHOP_POOL.some(d => d.tier <= maxTier(turn) && related(d.id, team));
      const verify = () => {
        const fresh = r.shop.filter(s => s.kind === 'unit' && !s.locked);
        check(r.shop.find(s => s.sid === 9000)?.def === locked.def, 'locked unit preserved');
        check(JSON.stringify(r.shop.find(s => s.sid === 9001)) === JSON.stringify(milk), 'milk preserved');
        check(fresh.every(s => card(s.def).tier <= maxTier(turn)), 'no locked-tier bypass');
        if (eligible) check(fresh.some(s => related(s.def, team)), 'fresh related unit guaranteed');
        check(new Set(r.shop.map(s => s.sid)).size === r.shop.length, 'unique shop IDs');
      };
      verify();
      check(adReroll(r) !== null && r.gold === 9, 'ad refresh free');
      verify();
      const afterAd = JSON.stringify(r);
      check(adReroll(r) === null && JSON.stringify(r) === afterAd, 'no repeated ad refresh');
      r.shop.filter(s => s.kind === 'unit').forEach(s => { s.locked = true; });
      const lockedUnits = JSON.stringify(r.shop.filter(s => s.kind === 'unit'));
      reroll(r);
      check(JSON.stringify(r.shop.filter(s => s.kind === 'unit')) === lockedUnits, 'all locked: no extra units');
      // Locked promotion reward also consumes a seat, not the affinity guarantee.
      const first = r.shop.find(s => s.kind === 'unit')!;
      first.free = true;
      const reward = JSON.stringify(first);
      const other = r.shop.find(s => s.kind === 'unit' && s !== first)!;
      other.locked = false;
      reroll(r);
      check(JSON.stringify(r.shop.find(s => s.sid === first.sid)) === reward, 'promotion reward preserved');
      if (eligible) check(r.shop.some(s => s.kind === 'unit' && !s.locked && related(s.def, team)), 'one free slot still guaranteed');
      r.gold = 0;
      const broke = JSON.stringify(r);
      check(reroll(r) === null && JSON.stringify(r) === broke, 'no funds: no mutation');
      checked++;
    }
  }
}
console.log(`Shop affinity: ${checked} seeded scenarios passed across all difficulties, early/late tiers, mixed/any/empty teams, paid/ad refresh, locks, reward slots, milk and snapshot replay.`);
