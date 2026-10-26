import { CARDS, FOODS, card } from '../../src/core/data';
import {
  GOLD_PER_ROUND,
  MAX_COPIES,
  PRICE,
  buy,
  endTurn,
  lvlOf,
  moveOwned,
  ownedAtk,
  ownedHp,
  playerTeam,
  reroll,
  sell,
  sellPrice,
  settleBattle,
  useFood,
  type Owned,
  type RunState,
  type ShopItem,
} from '../../src/core/run';
import { QUEUE_MAX, simulate } from '../../src/core/engine';

export type EconomyCheck = {
  id: string;
  unitIds: string[];
  level: number | null;
  status: 'pass' | 'fail';
  expected: string;
  observed: string;
};

export type EconomyAudit = {
  checks: EconomyCheck[];
  covered: string[];
  measurements: unknown[];
};

const copiesFor = (level: number) => ([1, 3, 6] as const)[level - 1];
const valueAt = (id: string, level: number) => card(id).v?.[level - 1] ?? 0;

/** A storage-free state. In particular, this does not call newRun or select a ghost. */
function state(seed = 17): RunState {
  return {
    v: 2,
    seed,
    turn: 3,
    lives: 10,
    wins: 0,
    gold: GOLD_PER_ROUND,
    queue: Array(QUEUE_MAX).fill(null),
    shop: [],
    nextId: 100,
    phase: 'prep',
    history: [],
    canned: 0,
    rerolls: 0,
    finalLosses: 0,
    enemy: { boss: 'wall', units: [] },
    pendingFx: [],
  };
}

function owned(def: string, level = 1, oid = 1, atkBonus = 0, hpBonus = 0): Owned {
  return { oid, def, copies: copiesFor(level), atkBonus, hpBonus };
}

function item(r: RunState, kind: 'unit' | 'food', def: string, free = false): ShopItem {
  const s: ShopItem = { sid: r.nextId++, kind, def, locked: false, free };
  r.shop.push(s);
  return s;
}

const stats = (o: Owned | null) => o ? [ownedAtk(o), ownedHp(o)] : null;
const json = (x: unknown) => {
  try { return JSON.stringify(x); } catch { return String(x); }
};

export function runEconomyContracts(): EconomyAudit {
  const checks: EconomyCheck[] = [];
  const covered = new Set<string>();
  const measurements: unknown[] = [];
  CARDS.filter((c) => !c.token && !c.enemy).forEach((c) => covered.add(c.id));

  const check = (
    id: string,
    unitIds: string[],
    level: number | null,
    expected: unknown,
    run: () => unknown,
    equals: (actual: unknown, expected: unknown) => boolean = (a, e) => json(a) === json(e),
  ) => {
    unitIds.forEach((unitId) => covered.add(unitId));
    try {
      const observed = run();
      checks.push({
        id,
        unitIds,
        level,
        status: equals(observed, expected) ? 'pass' : 'fail',
        expected: json(expected),
        observed: json(observed),
      });
    } catch (error) {
      checks.push({
        id,
        unitIds,
        level,
        status: 'fail',
        expected: json(expected),
        observed: `threw: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  };

  // Baseline purchase, merging and sale value. These are the economic breakpoints every unit uses.
  for (const copies of [1, 2, 3, 5, 6]) {
    const level = lvlOf(copies);
    check(`baseline.sell-price.c${copies}`, ['all-shop-units'], level, level, () =>
      sellPrice({ ...owned('l_shield'), copies }));
  }
  for (const before of [1, 2, 3, 5]) {
    check(`baseline.buy-merge.c${before}-to-${before + 1}`, ['all-shop-units'], lvlOf(before), {
      ok: true,
      copies: before + 1,
      level: lvlOf(before + 1),
      gold: 7,
      reward: before + 1 === 3 || before + 1 === 6,
    }, () => {
      const r = state();
      r.queue[0] = { ...owned('l_shield'), copies: before };
      const s = item(r, 'unit', 'l_shield');
      const out = buy(r, s.sid, 0);
      return {
        ok: out.ok,
        copies: r.queue[0]?.copies,
        level: r.queue[0] ? lvlOf(r.queue[0]!.copies) : null,
        gold: r.gold,
        reward: r.shop.some((x) => x.free),
      };
    });
  }
  check('baseline.buy-max-no-charge', ['all-shop-units'], 3, { why: 'max', gold: 10, shop: 1 }, () => {
    const r = state();
    r.queue[0] = owned('l_shield', 3);
    const s = item(r, 'unit', 'l_shield');
    const out = buy(r, s.sid, 0);
    return { why: out.ok ? 'ok' : out.why, gold: r.gold, shop: r.shop.length };
  });
  check('baseline.buy-no-gold-no-charge', ['all-shop-units'], 1, { why: 'gold', gold: 2, shop: 1 }, () => {
    const r = state(); r.gold = 2;
    const s = item(r, 'unit', 'l_shield');
    const out = buy(r, s.sid, 0);
    return { why: out.ok ? 'ok' : out.why, gold: r.gold, shop: r.shop.length };
  });
  check('baseline.move-merge-preserves-growth', ['all-shop-units'], 2, {
    copies: 2, atkBonus: 5, hpBonus: 7, ench: 'iron', bank: 3, drum: 4, lamp: true,
  }, () => {
    const r = state();
    r.queue[0] = { ...owned('m_egg', 1, 1, 2, 3), ench: 'iron', bank: 1, drum: 1, lamp: true };
    r.queue[1] = { ...owned('m_egg', 1, 2, 3, 4), bank: 2, drum: 3 };
    moveOwned(r, 0, 1);
    const o = r.queue[1]!;
    return { copies: o.copies, atkBonus: o.atkBonus, hpBonus: o.hpBonus, ench: o.ench, bank: o.bank, drum: o.drum, lamp: o.lamp };
  });

  // Exercise the shared economic action with every purchasable definition at every star.
  for (const def of CARDS.filter((c) => !c.token && !c.enemy)) for (const level of [1, 2, 3]) {
    check(`catalog.${def.id}.sell.l${level}`, [def.id], level, { gold: level, removed: true }, () => {
      const r = state(); r.gold = 0; r.queue[0] = owned(def.id, level);
      const out = sell(r, 0)!; return { gold: out.gold, removed: r.queue[0] === null };
    });
    check(`catalog.${def.id}.purchase-at-star.l${level}`, [def.id], level,
      level === 3 ? { ok: false, why: 'max', gold: 10, copies: 6 } : { ok: true, why: null, gold: 7, copies: copiesFor(level) + 1 },
      () => {
        const r = state(); r.queue[0] = owned(def.id, level); const s = item(r, 'unit', def.id); const out = buy(r, s.sid, 0);
        return { ok: out.ok, why: out.ok ? null : out.why, gold: r.gold, copies: r.queue[0]!.copies };
      });
  }

  // Sale-triggered permanent units and their positional/recipient contracts.
  for (const level of [1, 2, 3]) {
    const v = valueAt('d_artificer', level);
    check(`d_artificer.sell.l${level}`, ['d_artificer'], level, { gold: level, delta: [v, v], sellerGone: true }, () => {
      const r = state(); r.gold = 0;
      r.queue[0] = owned('d_artificer', level, 1); r.queue[1] = owned('l_shield', 1, 2);
      const before = stats(r.queue[1]); const out = sell(r, 0)!; const after = stats(r.queue[1]);
      return { gold: out.gold, delta: [after![0] - before![0], after![1] - before![1]], sellerGone: !r.queue[0] };
    });
    check(`d_artificer.no-recipient.l${level}`, ['d_artificer'], level, { gold: level, fx: 0 }, () => {
      const r = state(); r.queue[0] = owned('d_artificer', level);
      const out = sell(r, 0)!; return { gold: out.gold, fx: out.fx.length };
    });

    const dv = valueAt('d_dunecaster', level);
    check(`d_dunecaster.ally-sold.l${level}`, ['d_dunecaster'], level, [dv, dv], () => {
      const r = state(); r.queue[0] = owned('l_shield'); r.queue[1] = owned('d_dunecaster', level, 2);
      const before = stats(r.queue[1])!; sell(r, 0); const after = stats(r.queue[1])!;
      return [after[0] - before[0], after[1] - before[1]];
    });
    check(`d_dunecaster.self-sold-no-trigger.l${level}`, ['d_dunecaster'], level, 0, () => {
      const r = state(); r.queue[0] = owned('d_dunecaster', level);
      return sell(r, 0)!.fx.filter((x) => x.kind === 'buff').length;
    });

    const pct = valueAt('d_worm', level);
    check(`d_worm.split.l${level}`, ['d_worm'], level, {
      gold: level,
      each: [Math.max(1, Math.floor((20 * pct) / 100 / 2)), Math.max(1, Math.floor((18 * pct) / 100 / 2))],
    }, () => {
      const r = state(); r.gold = 0;
      const worm = owned('d_worm', level, 1);
      worm.atkBonus = 20 - (card('d_worm').atk + worm.copies - 1);
      worm.hpBonus = 18 - (card('d_worm').hp + worm.copies - 1);
      r.queue[0] = worm; r.queue[1] = owned('l_shield', 1, 2); r.queue[2] = owned('s_dart', 1, 3);
      const before = stats(r.queue[1])!; const out = sell(r, 0)!; const after = stats(r.queue[1])!;
      return { gold: out.gold, each: [after[0] - before[0], after[1] - before[1]] };
    });
    const wormAtk = ownedAtk(owned('d_worm', level));
    const wormHp = ownedHp(owned('d_worm', level));
    const atkBudget = Math.floor((wormAtk * pct) / 100);
    const hpBudget = Math.floor((wormHp * pct) / 100);
    const expectedShare = [Math.floor(atkBudget / 4), Math.floor(hpBudget / 4)];
    check(`d_worm.low-stat-no-overallocation.l${level}`, ['d_worm'], level, {
      recipients: 4,
      each: Array.from({ length: 4 }, () => expectedShare),
      totalAtk: expectedShare[0] * 4,
      totalHp: expectedShare[1] * 4,
    }, () => {
      const r = state();
      r.queue[0] = owned('d_worm', level, 1);
      for (let i = 1; i < QUEUE_MAX; i++) r.queue[i] = owned('l_shield', 1, i + 1);
      const before = r.queue.slice(1).map((o) => stats(o)!);
      sell(r, 0);
      const deltas = r.queue.slice(1).map((o, i) => {
        const after = stats(o)!; return [after[0] - before[i][0], after[1] - before[i][1]];
      });
      return {
        recipients: deltas.length,
        each: deltas,
        totalAtk: deltas.reduce((n, d) => n + d[0], 0),
        totalHp: deltas.reduce((n, d) => n + d[1], 0),
      };
    });
  }

  // End-of-turn growth: one positive and the material invalid-position condition at every star.
  const endSpecs: Array<{
    id: string; setup: (r: RunState, level: number) => { target: Owned; expected: (v: number) => [number, number] };
  }> = [
    { id: 's_backstab', setup: (r, l) => { r.queue[0] = owned('l_shield', 1, 10); r.queue[1] = owned('s_backstab', l, 11); return { target: r.queue[0]!, expected: (v) => [v, 0] }; } },
    { id: 's_ninja', setup: (r, l) => { r.queue[0] = owned('l_shield', 1, 10); r.queue[1] = owned('s_ninja', l, 11); return { target: r.queue[1]!, expected: (v) => [v, v] }; } },
    { id: 'v_mage', setup: (r, l) => { r.queue[0] = owned('l_shield', 1, 10); r.queue[1] = owned('v_mage', l, 11); return { target: r.queue[0]!, expected: (v) => [0, v] }; } },
    { id: 'd_howler', setup: (r, l) => { r.queue[0] = owned('l_shield', 1, 10); r.queue[1] = owned('s_dart', 1, 12); r.queue[2] = owned('d_howler', l, 11); return { target: r.queue[0]!, expected: (v) => [v, v] }; } },
    { id: 'd_onyx', setup: (r, l) => { r.queue[0] = owned('l_shield', 1, 10); r.queue[1] = owned('d_onyx', l, 11); return { target: r.queue[0]!, expected: (v) => [v, v] }; } },
  ];
  for (const spec of endSpecs) for (const level of [1, 2, 3]) {
    const v = valueAt(spec.id, level);
    check(`${spec.id}.end-turn.l${level}`, [spec.id], level, spec.setup(state(), level).expected(v), () => {
      const r = state(); const { target } = spec.setup(r, level); const before = stats(target)!;
      endTurn(r); const after = stats(target)!;
      return [after[0] - before[0], after[1] - before[1]] satisfies [number, number];
    });
  }
  for (const level of [1, 2, 3]) {
    const v = valueAt('l_warden', level);
    check(`l_warden.rotate-only.l${level}`, ['l_warden'], level, { rotate: [0, v], plain: [0, 0] }, () => {
      const r = state(); r.queue[0] = owned('l_shield', 1, 1); r.queue[1] = owned('s_dart', 1, 2); r.queue[2] = owned('l_warden', level, 3);
      const a = stats(r.queue[0])!, b = stats(r.queue[1])!; endTurn(r); const aa = stats(r.queue[0])!, bb = stats(r.queue[1])!;
      return { rotate: [aa[0] - a[0], aa[1] - a[1]], plain: [bb[0] - b[0], bb[1] - b[1]] };
    });
    check(`l_warden.enchanted-rotate.l${level}`, ['l_warden'], level, [0, v], () => {
      const r = state(); r.queue[0] = { ...owned('s_dart'), ench: 'rotate' }; r.queue[1] = owned('l_warden', level, 2);
      const before = stats(r.queue[0])!; endTurn(r); const after = stats(r.queue[0])!; return [after[0] - before[0], after[1] - before[1]];
    });
    const eggGrowth = valueAt('m_egg', level);
    check(`m_egg.bank.l${level}`, ['m_egg'], level, { bank: eggGrowth, hatchlingStats: [1 + eggGrowth, 1 + eggGrowth] }, () => {
      const r = state(); r.queue[0] = { ...owned('m_egg', level), bank: 0 }; endTurn(r);
      const bank = r.queue[0]!.bank ?? 0;
      const out = simulate([{ def: 'm_egg', lvl: level as 1 | 2 | 3, atk: 1, hp: 1, bank }], [{ def: 't_wolf', lvl: 1, atk: 50, hp: 50 }]);
      const hatch = out.events.find((e) => e.t === 'summon' && e.unit.def === 't_drakelet');
      return { bank, hatchlingStats: hatch?.t === 'summon' ? [hatch.unit.atk, hatch.unit.hp] : null };
    });
  }
  check('s_ninja.not-tail', ['s_ninja'], 1, [0, 0], () => {
    const r = state(); r.queue[0] = owned('s_ninja'); r.queue[1] = owned('l_shield', 1, 2);
    const before = stats(r.queue[0])!; endTurn(r); const after = stats(r.queue[0])!; return [after[0] - before[0], after[1] - before[1]];
  });
  check('s_backstab.no-unit-ahead', ['s_backstab'], 1, 0, () => {
    const r = state(); r.queue[0] = owned('s_backstab'); return endTurn(r).length;
  });

  // Upgrade-triggered keeper contract at both star breakpoints.
  for (const levelAfter of [2, 3]) {
    const beforeCopies = levelAfter === 2 ? 2 : 5;
    const expected = valueAt('d_keeper', levelAfter);
    check(`d_keeper.upgrade-to-${levelAfter}`, ['d_keeper'], levelAfter, [expected, expected], () => {
      const r = state(); r.queue[0] = { ...owned('d_keeper'), copies: beforeCopies }; r.queue[1] = owned('l_shield', 1, 2);
      const s = item(r, 'food', 'f_elixir'); const before = stats(r.queue[1])!; useFood(r, s.sid, 0); const after = stats(r.queue[1])!;
      return [after[0] - before[0], after[1] - before[1]];
    });
  }
  check('d_keeper.full-star-elixir-no-charge', ['d_keeper'], 3, { why: 'target', gold: 10 }, () => {
    const r = state(); r.queue[0] = owned('d_keeper', 3); const s = item(r, 'food', 'f_elixir');
    const out = useFood(r, s.sid, 0); return { why: out.ok ? 'ok' : out.why, gold: r.gold };
  });

  // Refresh limit is per construct, star-scaled, and a failed refresh spends nothing.
  for (const level of [1, 2, 3]) {
    const limit = valueAt('d_hourglass', level);
    check(`d_hourglass.refresh-limit.l${level}`, ['d_hourglass'], level, { buffs: limit, rerolls: limit + 1, gold: 1 }, () => {
      const r = state(); r.gold = limit + 2; r.turn = 12; r.queue[0] = owned('d_hourglass', level); r.queue[1] = owned('l_shield', 1, 2);
      let buffs = 0; for (let i = 0; i < limit + 1; i++) buffs += (reroll(r) ?? []).filter((x) => x.kind === 'buff').length;
      return { buffs, rerolls: r.rerolls, gold: r.gold };
    });
  }
  check('reroll.no-gold-no-state-change', ['d_hourglass'], 1, { out: null, gold: 0, rerolls: 0 }, () => {
    const r = state(); r.gold = 0; r.queue[0] = owned('d_hourglass'); const out = reroll(r);
    return { out, gold: r.gold, rerolls: r.rerolls };
  });

  // Gold at round boundaries. Turn 3 settles into boss turn 4, so no ghost selection is exercised.
  for (const level of [1, 2, 3]) {
    const v = valueAt('d_dune', level);
    check(`d_dune.turn-start.l${level}`, ['d_dune'], level, { gold: GOLD_PER_ROUND + v, fx: v }, () => {
      const r = state(); r.queue[0] = owned('d_dune', level); settleBattle(r, { result: 'draw', perm: {} });
      const fx = r.pendingFx.find((x) => x.kind === 'gold'); return { gold: r.gold, fx: fx?.kind === 'gold' ? fx.n : 0 };
    });
  }
  for (const level of [1, 2, 3]) {
    const v = valueAt('d_goldob', level);
    check(`d_goldob.spend-all.l${level}`, ['d_goldob'], level, { gold: 0, totalAtkGrowth: 4 * v }, () => {
      const r = state(); r.gold = 4; r.queue[0] = owned('d_goldob', level); r.queue[1] = owned('l_shield', 1, 2);
      const before = playerTeam(r).reduce((n, u) => n + u.atk, 0); endTurn(r); const after = playerTeam(r).reduce((n, u) => n + u.atk, 0);
      return { gold: r.gold, totalAtkGrowth: after - before };
    });
  }
  check('d_goldob.multiple-first-spends-balance', ['d_goldob'], 1, { gold: 0, first: 3, second: 0 }, () => {
    const r = state(); r.gold = 3; r.queue[0] = owned('d_goldob', 1, 1); r.queue[1] = owned('d_goldob', 1, 2);
    const fx = endTurn(r); return { gold: r.gold, first: fx.filter((x) => x.kind === 'buff' && x.src === 1).length, second: fx.filter((x) => x.kind === 'buff' && x.src === 2).length };
  });

  // All fifteen supplies: at least one observable effect plus insufficient-gold atomicity.
  const foodExpected: Record<string, (r: RunState, target: Owned) => unknown> = {
    f_bread: (_r, o) => ({ stats: stats(o) }),
    f_lamp: (_r, o) => ({ lamp: o.lamp }),
    f_drum: (_r, o) => ({ drum: o.drum }),
    f_scroll: (_r, o) => ({ ench: o.ench }),
    f_stew: (r) => ({ total: r.queue.filter(Boolean).reduce((n, o) => n + (o!.atkBonus + o!.hpBonus), 0) }),
    f_iron: (_r, o) => ({ ench: o.ench }),
    f_whet: (_r, o) => ({ stats: stats(o) }),
    f_chili: (_r, o) => ({ ench: o.ench }),
    f_elixir: (_r, o) => ({ copies: o.copies }),
    f_sushi: (r) => ({ total: r.queue.filter(Boolean).reduce((n, o) => n + (o!.atkBonus + o!.hpBonus), 0) }),
    f_amulet: (_r, o) => ({ ench: o.ench }),
    f_shroom: (_r, o) => ({ ench: o.ench }),
    f_roast: (r) => ({ total: r.queue.filter(Boolean).reduce((n, o) => n + (o!.atkBonus + o!.hpBonus), 0) }),
    f_wine: (_r, o) => ({ ench: o.ench }),
    f_can: (r) => ({ canned: r.canned }),
  };
  const foodWant: Record<string, unknown> = {
    f_bread: { stats: [2, 5] }, f_lamp: { lamp: true }, f_drum: { drum: 3 }, f_scroll: { ench: 'rotate' },
    f_stew: { total: 8 }, f_iron: { ench: 'iron' }, f_whet: { stats: [4, 5] }, f_chili: { ench: 'chili' },
    f_elixir: { copies: 2 }, f_sushi: { total: 12 }, f_amulet: { ench: 'amulet' }, f_shroom: { ench: 'shroom' },
    f_roast: { total: 16 }, f_wine: { ench: 'wine' }, f_can: { canned: 1 },
  };
  for (const f of FOODS) {
    check(`food.${f.id}.observable`, [f.id], null, foodWant[f.id], () => {
      const r = state(23); r.queue[0] = owned('l_shield', 1, 1); r.queue[1] = owned('s_dart', 1, 2); r.queue[2] = owned('a_imp', 1, 3);
      const s = item(r, 'food', f.id); const slot = ['f_stew', 'f_sushi', 'f_roast', 'f_can'].includes(f.id) ? null : 0;
      const out = useFood(r, s.sid, slot); if (!out.ok) return out; return foodExpected[f.id](r, r.queue[0]!);
    });
    check(`food.${f.id}.insufficient-gold-atomic`, [f.id], null, { why: 'gold', gold: 2, shop: true, unchanged: true }, () => {
      const r = state(); r.gold = 2; r.queue[0] = owned('l_shield');
      const before = json(r.queue[0]); const s = item(r, 'food', f.id); const slot = ['f_stew', 'f_sushi', 'f_roast', 'f_can'].includes(f.id) ? null : 0;
      const out = useFood(r, s.sid, slot);
      return { why: out.ok ? 'ok' : out.why, gold: r.gold, shop: r.shop.some((x) => x.sid === s.sid), unchanged: json(r.queue[0]) === before };
    });
  }
  check('food.enchantment-overwrites', ['f_iron', 'f_wine'], null, 'wine', () => {
    const r = state(); r.gold = 6; r.queue[0] = owned('l_shield');
    let s = item(r, 'food', 'f_iron'); useFood(r, s.sid, 0); s = item(r, 'food', 'f_wine'); useFood(r, s.sid, 0);
    return r.queue[0]!.ench;
  });
  check('food.canned-per-purchased-copy', ['f_can'], null, { first: [2, 5], merged: [4, 7] }, () => {
    const r = state(); r.gold = 9; r.canned = 1;
    let s = item(r, 'unit', 'l_shield'); buy(r, s.sid, 0); const first = stats(r.queue[0]);
    s = item(r, 'unit', 'l_shield'); buy(r, s.sid, 0); const merged = stats(r.queue[0]); return { first, merged };
  });

  // Pharaoh uses the strongest aura only, including at all three levels.
  for (const level of [1, 2, 3]) {
    const n = Math.round(1 * (1 + valueAt('d_pharaoh', level) / 100));
    check(`d_pharaoh.bread.l${level}`, ['d_pharaoh'], level, [n, n], () => {
      const r = state(); r.queue[0] = owned('l_shield'); r.queue[1] = owned('d_pharaoh', level, 2);
      const before = stats(r.queue[0])!; const s = item(r, 'food', 'f_bread'); useFood(r, s.sid, 0); const after = stats(r.queue[0])!;
      return [after[0] - before[0], after[1] - before[1]];
    });
  }
  check('d_pharaoh.auras-do-not-stack', ['d_pharaoh'], 3, [3, 3], () => {
    const r = state(); r.queue[0] = owned('l_shield'); r.queue[1] = owned('d_pharaoh', 3, 2); r.queue[2] = owned('d_pharaoh', 2, 3);
    const before = stats(r.queue[0])!; const s = item(r, 'food', 'f_bread'); useFood(r, s.sid, 0); const after = stats(r.queue[0])!;
    return [after[0] - before[0], after[1] - before[1]];
  });

  // Cap applies to shop growth and combat writeback.
  check('growth-cap.shop', ['d_onyx'], 3, [50, 50], () => {
    const r = state(); r.queue[0] = owned('l_shield', 1, 1, 48, 45); r.queue[1] = owned('d_onyx', 3, 2); endTurn(r); return stats(r.queue[0]);
  });

  // Engulf: genuine combat deaths, three-use ceiling, and persistence through settleBattle.
  for (const level of [1, 2, 3]) {
    const v = valueAt('a_engulf', level);
    check(`a_engulf.combat-writeback.l${level}`, ['a_engulf'], level, { perm: [3 * v, 3 * v], stored: [3 * v, 3 * v] }, () => {
      const r = state(); r.queue[0] = owned('a_engulf', level, 41);
      const out = simulate(
        [{ def: 'a_engulf', lvl: level as 1 | 2 | 3, atk: 20, hp: 40, oid: 41 }],
        Array.from({ length: 5 }, () => ({ def: 'l_shield', lvl: 1 as const, atk: 1, hp: 1 })),
        7,
      );
      const p = out.perm[41] ?? { atk: 0, hp: 0 }; settleBattle(r, { result: out.result, perm: out.perm });
      return { perm: [p.atk, p.hp], stored: [r.queue[0]!.atkBonus, r.queue[0]!.hpBonus] };
    });
  }
  check('a_engulf.writeback-respects-cap', ['a_engulf'], 3, [50, 50], () => {
    const r = state(); r.queue[0] = owned('a_engulf', 3, 41, 40, 39);
    settleBattle(r, { result: 'draw', perm: { 41: { atk: 20, hp: 20 } } }); return stats(r.queue[0]);
  });

  // Multi-round measurements execute the real APIs. Values are gross effects and explicit costs,
  // never a claim about net power or gold carried between rounds.
  const totals = (r: RunState) => playerTeam(r).reduce((a, u) => [a[0] + u.atk, a[1] + u.hp] as [number, number], [0, 0] as [number, number]);
  const periodicSetups: Record<string, (r: RunState, level: number) => void> = {
    m_egg: (r, l) => { r.queue[0] = { ...owned('m_egg', l), bank: 0 }; },
    s_backstab: (r, l) => { r.queue[0] = owned('l_shield', 1, 10); r.queue[1] = owned('s_backstab', l, 11); },
    l_warden: (r, l) => { r.queue[0] = owned('l_shield', 1, 10); r.queue[1] = owned('l_warden', l, 11); },
    s_ninja: (r, l) => { r.queue[0] = owned('l_shield', 1, 10); r.queue[1] = owned('s_ninja', l, 11); },
    v_mage: (r, l) => { r.queue[0] = owned('l_shield', 1, 10); r.queue[1] = owned('v_mage', l, 11); },
    d_howler: (r, l) => { r.queue[0] = owned('l_shield', 1, 10); r.queue[1] = owned('s_dart', 1, 12); r.queue[2] = owned('d_howler', l, 11); },
    d_goldob: (r, l) => { r.queue[0] = owned('d_goldob', l, 11); r.queue[1] = owned('l_shield', 1, 10); },
    d_onyx: (r, l) => { r.queue[0] = owned('d_onyx', l, 11); r.queue[1] = owned('l_shield', 1, 10); },
  };
  for (const [unitId, setup] of Object.entries(periodicSetups)) for (const level of [1, 2, 3]) for (const rounds of [3, 5]) {
    const r = state(31); setup(r, level);
    const before = totals(r); const beneficiaries = new Set<number>(); let goldSpent = 0; let triggerCount = 0;
    for (let round = 0; round < rounds; round++) {
      r.gold = GOLD_PER_ROUND;
      const fx = endTurn(r); triggerCount += fx.length;
      for (const f of fx) if (f.kind === 'buff') beneficiaries.add(f.tgt); else if (f.kind === 'bank') beneficiaries.add(f.src);
      goldSpent += GOLD_PER_ROUND - r.gold;
    }
    const after = totals(r);
    measurements.push({ kind: 'actual-round-actions', unitId, level, rounds, action: 'endTurn', grossStatGain: [after[0] - before[0], after[1] - before[1]], goldSpent, beneficiaries: beneficiaries.size, occupiedSlots: r.queue.filter(Boolean).length, triggerCount });
  }

  for (const level of [1, 2, 3]) for (const rounds of [3, 5]) {
    // One sale opportunity per round; the acquisition basis is reported separately from the API sale/refund.
    for (const unitId of ['d_artificer', 'd_worm'] as const) {
      const r = state(37); for (let i = 1; i < QUEUE_MAX; i++) r.queue[i] = owned('l_shield', 1, i + 10);
      const before = totals(r); const beneficiaries = new Set<number>(); let refunds = 0; let triggerCount = 0;
      for (let round = 0; round < rounds; round++) {
        r.queue[0] = owned(unitId, level, 1000 + round);
        const out = sell(r, 0)!; refunds += out.gold; triggerCount += out.fx.length;
        out.fx.forEach((f) => { if (f.kind === 'buff') beneficiaries.add(f.tgt); });
      }
      const after = totals(r);
      measurements.push({ kind: 'actual-round-actions', unitId, level, rounds, action: 'sell', grossStatGain: [after[0] - before[0], after[1] - before[1]], acquisitionBasis: rounds * copiesFor(level) * PRICE, saleRefund: refunds, beneficiaries: beneficiaries.size, occupiedSlots: r.queue.filter(Boolean).length, triggerCount });
    }

    {
      const r = state(41); r.queue[1] = owned('d_dunecaster', level, 2); const before = totals(r); let refunds = 0; let triggerCount = 0;
      for (let round = 0; round < rounds; round++) { r.queue[0] = owned('l_shield', 1, 1000 + round); const out = sell(r, 0)!; refunds += out.gold; triggerCount += out.fx.length; }
      const after = totals(r);
      measurements.push({ kind: 'actual-round-actions', unitId: 'd_dunecaster', level, rounds, action: 'sell-ally', grossStatGain: [after[0] - before[0], after[1] - before[1]], allyAcquisitionBasis: rounds * PRICE, saleRefund: refunds, beneficiaries: 1, occupiedSlots: 1, triggerCount });
    }

    {
      const r = state(43); r.turn = 12; r.queue[0] = owned('d_hourglass', level, 1); r.queue[1] = owned('l_shield', 1, 2);
      const before = totals(r); const beneficiaries = new Set<number>(); let goldSpent = 0; let triggerCount = 0;
      for (let round = 0; round < rounds; round++) {
        r.gold = GOLD_PER_ROUND; r.rerolls = 0;
        for (let n = 0; n < valueAt('d_hourglass', level); n++) { const fx = reroll(r) ?? []; triggerCount += fx.length; fx.forEach((f) => { if (f.kind === 'buff') beneficiaries.add(f.tgt); }); }
        goldSpent += GOLD_PER_ROUND - r.gold;
      }
      const after = totals(r);
      measurements.push({ kind: 'actual-round-actions', unitId: 'd_hourglass', level, rounds, action: 'reroll', grossStatGain: [after[0] - before[0], after[1] - before[1]], goldSpent, beneficiaries: beneficiaries.size, occupiedSlots: 2, triggerCount });
    }

    {
      const r = state(47); r.queue[0] = { ...owned('d_keeper'), copies: level === 1 ? 1 : level === 2 ? 2 : 5 }; r.queue[1] = owned('l_shield', 1, 2);
      const before = totals(r); let goldSpent = 0; let triggerCount = 0;
      if (level > 1) { const s = item(r, 'food', 'f_elixir'); const out = useFood(r, s.sid, 0); goldSpent += PRICE; if (out.ok) triggerCount += out.fx.length; }
      for (let round = 0; round < rounds; round++) endTurn(r);
      const after = totals(r);
      measurements.push({ kind: 'actual-round-actions', unitId: 'd_keeper', level, rounds, action: level === 1 ? 'hold-without-upgrade' : 'upgrade-once-then-hold', grossStatGain: [after[0] - before[0], after[1] - before[1]], goldSpent, beneficiaries: triggerCount ? 1 : 0, occupiedSlots: 2, triggerCount });
    }

    {
      const r = state(53); r.queue[0] = owned('a_engulf', level, 41); const before = totals(r); let triggerCount = 0;
      for (let round = 0; round < rounds; round++) {
        const out = simulate(playerTeam(r), Array.from({ length: 3 }, () => ({ def: 'l_shield', lvl: 1 as const, atk: 1, hp: 1 })), 50 + round);
        triggerCount += out.events.filter((e) => e.t === 'trigger' && e.label === '敌方阵亡').length;
        r.turn = 3; r.wins = 0; settleBattle(r, { result: 'draw', perm: out.perm });
      }
      const after = totals(r);
      measurements.push({ kind: 'actual-round-actions', unitId: 'a_engulf', level, rounds, action: 'simulate-and-settle', grossStatGain: [after[0] - before[0], after[1] - before[1]], goldSpent: 0, beneficiaries: triggerCount ? 1 : 0, occupiedSlots: 1, triggerCount });
    }

    {
      const r = state(59); r.queue[0] = owned('d_dune', level); let bonusGold = 0; let triggerCount = 0;
      for (let round = 0; round < rounds; round++) { r.turn = 3; r.wins = 0; settleBattle(r, { result: 'draw', perm: {} }); bonusGold += r.gold - GOLD_PER_ROUND; triggerCount += r.pendingFx.length; }
      measurements.push({ kind: 'actual-round-actions', unitId: 'd_dune', level, rounds, action: 'settleBattle-turnStart', grossBonusGold: bonusGold, goldSpent: 0, beneficiaries: 1, occupiedSlots: 1, triggerCount });
    }

    {
      const r = state(61); r.queue[0] = owned('l_shield', 1, 1); r.queue[1] = owned('d_pharaoh', level, 2); const before = totals(r); let goldSpent = 0; let triggerCount = 0;
      for (let round = 0; round < rounds; round++) { r.gold = GOLD_PER_ROUND; const s = item(r, 'food', 'f_bread'); const out = useFood(r, s.sid, 0); if (out.ok) { goldSpent += PRICE; triggerCount += out.fx.length; } }
      const after = totals(r);
      measurements.push({ kind: 'actual-round-actions', unitId: 'd_pharaoh', level, rounds, action: 'useFood-bread', grossStatGain: [after[0] - before[0], after[1] - before[1]], goldSpent, beneficiaries: triggerCount ? 1 : 0, occupiedSlots: 2, triggerCount });
    }
  }
  measurements.push({
    kind: 'catalog-coverage',
    shopUnits: CARDS.filter((c) => !c.token && !c.enemy).length,
    permanentUnits: CARDS.filter((c) => !c.token && !c.enemy && c.perm).map((c) => c.id),
    foods: FOODS.map((f) => f.id),
    starBreakpoints: [{ copies: 1, level: 1 }, { copies: 3, level: 2 }, { copies: MAX_COPIES, level: 3 }],
  });

  return { checks, covered: [...covered].filter((id) => id !== 'all-shop-units').sort(), measurements };
}
