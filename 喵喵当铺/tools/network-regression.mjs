import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as G from "../js/game.js";
import * as N from "../js/network.js";
const clone = (x) => JSON.parse(JSON.stringify(x));
let tests = 0;
const test = (name, fn) => {
  fn();
  tests++;
  console.log(`PASS ${name}`);
};
const command = (action, args = {}) => G.businessCommand(action, args);
const configure = (opts = {}) =>
  command("networkPolicy", {
    enabled: true,
    production: "balanced",
    quality: "mixed",
    priority: "harbor",
    reserve: 150,
    ...opts,
  });
function fixture(day = 81) {
  G.newRun();
  Object.assign(G.S, {
    day,
    money: 20000,
    phase: "day",
    queue: [],
    qi: 0,
    shelf: [],
  });
  G.S.business.ownership = { owned: true, day: 70 };
  G.S.business.mainRoute = "water";
  G.S.business.routes.water.level = 2;
  const n = G.S.business.network;
  for (const id of ["workshop", "harbor", "boutique"])
    n.builds[id] = {
      cost: N.NETWORK_BUILDS[id].cost,
      builtDay: 70,
      effectiveDay: 76,
    };
  configure();
  return G.S;
}
const networkMorning = () => N.networkMorning(G.S, { record: G.recordCash });
const networkEvening = () => N.networkEvening(G.S, { record: G.recordCash });
function settlePeriod() {
  const n = G.S.business.network;
  const start = G.S.day;
  networkMorning();
  G.S.day = N.networkPeriod(start).end;
  networkEvening();
  return n.history.at(-1);
}
test("legacy saves default unbuilt and disabled without funds or UID changes", () => {
  G.newRun();
  const s = clone(G.S);
  delete s.business.network;
  const cash = s.money,
    uid = s.uid;
  G.setState(s);
  assert.equal(G.S.business.network.policy.enabled, false);
  assert.equal(G.S.money, cash);
  assert.equal(G.S.uid, uid);
  assert(Object.values(G.S.business.network.builds).every((v) => v === null));
});
test("all public previews conserve hours, quality, quantity and exact store accounting", () => {
  fixture();
  const before = JSON.stringify(G.S);
  for (let p = 17; p <= 20; p++)
    for (const production of ["water", "balanced", "fish"])
      for (const quality of ["standard", "mixed", "premium"])
        for (const priority of ["harbor", "boutique"]) {
          const view = G.networkPreview(
            { ...G.S.business.network.policy, production, quality, priority },
            p,
          );
          assert(view.hoursUsed <= view.capacity);
          assert.equal(
            view.materials,
            view.production.standard * 11 +
              view.production.premium * 17 +
              view.production.fish * 12,
          );
          for (const kind of ["standard", "premium", "fish"])
            assert.equal(
              view.stores.reduce((n, s) => n + s.units[kind], 0) +
                view.waste[kind],
              view.production[kind],
            );
          assert.equal(
            view.stores.find((s) => s.id === "boutique").units.standard,
            0,
          );
          assert(
            Math.abs(
              view.stores.reduce((n, s) => n + s.profit, 0) - view.profit,
            ) < 1e-6,
          );
          assert(
            Math.abs(
              view.stores.reduce((n, s) => n + s.spending, 0) - view.spending,
            ) < 1e-6,
          );
          assert(
            view.stores.every(
              (s) =>
                s.units.standard + s.units.premium <= s.demand.water &&
                s.units.fish <= s.demand.fish,
            ),
          );
        }
  assert.equal(JSON.stringify(G.S), before);
});
test("delivery priority changes real fish allocation and low quality cannot earn boutique water sales", () => {
  fixture();
  const p = G.S.business.network.policy;
  const harbor = G.networkPreview(
      { ...p, production: "water", quality: "standard", priority: "harbor" },
      19,
    ),
    boutique = G.networkPreview(
      { ...p, production: "water", quality: "standard", priority: "boutique" },
      19,
    );
  assert(
    harbor.stores.find((s) => s.id === "boutique").units.fish <
      boutique.stores.find((s) => s.id === "boutique").units.fish,
  );
  assert.equal(harbor.stores.find((s) => s.id === "boutique").units.premium, 0);
  assert(harbor.stores.find((s) => s.id === "boutique").profit < 0);
});
test("construction uses real natural money, same protected preview and next-period activation", () => {
  const s = JSON.parse(
    readFileSync(
      new URL(
        "../../../output/miaomiao-pawnshop/expansion-20261019/natural/post-buyout.json",
        import.meta.url,
      ),
    ),
  );
  G.setState(s);
  const uid = G.S.uid,
    cash = G.S.money;
  const offer = G.businessView().network.builds.find(
    (b) => b.id === "workshop",
  );
  assert(offer.eligible);
  const r = command("networkBuild", { id: "workshop" });
  assert.equal(r.ok, true);
  assert.equal(G.S.money, cash - 1400);
  assert.equal(G.S.uid, uid);
  assert.equal(r.effectiveDay, 81);
  assert.equal(
    G.businessView().network.builds.find((b) => b.id === "workshop").effective,
    false,
  );
  assert.equal(command("networkBuild", { id: "workshop" }).ok, false);
});
test("insufficient construction and operating funds never partially debit money", () => {
  fixture();
  G.S.business.network.builds.capacity = null;
  G.S.money = 900;
  const before = JSON.stringify(G.S);
  assert.equal(command("networkBuild", { id: "capacity" }).ok, false);
  assert.equal(JSON.stringify(G.S), before);
  G.S.money = 150;
  const uid = G.S.uid;
  const r = networkMorning();
  assert.equal(r.ok, false);
  assert.equal(G.S.money, 150);
  assert.equal(G.S.uid, uid);
  assert.equal(G.S.business.network.current, null);
  assert.equal(G.networkManagerActive(), false);
});
test("opening pays once; locking survives policy changes and closing while paid still settles once", () => {
  fixture();
  const cash = G.S.money,
    uid = G.S.uid;
  networkMorning();
  const c = clone(G.S.business.network.current),
    paid = G.S.money;
  assert.equal(paid, cash - c.costs.total);
  networkMorning();
  assert.equal(G.S.money, paid);
  configure({ enabled: false, quality: "premium", production: "fish" });
  assert.deepEqual(G.S.business.network.current, c);
  assert.equal(G.networkManagerActive(), true);
  G.S.day = c.end;
  networkEvening();
  const after = G.S.money;
  assert.equal(after, paid + c.plan.income);
  networkEvening();
  assert.equal(G.S.money, after);
  assert.equal(G.S.uid, uid);
  G.S.day++;
  networkMorning();
  assert.equal(G.S.business.network.current, null);
  assert.equal(G.S.business.network.streak, 0);
});
test("old inventory is neither consumed nor cloned and capitalized goods count once in worth", () => {
  fixture();
  const item = G.mkItem("fish", { cost: 12, known: true });
  G.S.shelf.push(item);
  const before = clone(item),
    base = G.netWorth();
  networkMorning();
  const current = G.S.business.network.current;
  assert.deepEqual(item, before);
  assert.equal(G.S.shelf.length, 1);
  assert.equal(G.netWorth(), base - current.costs.wages);
  assert.equal(G.S.uid, item.uid + 1);
});
test("legacy profit excludes investment and one-off reward but includes wages and logistics", () => {
  fixture();
  networkMorning();
  G.recordCash("contract", 200, 80);
  G.recordCash("wage", -30);
  G.recordCash("logistics", -60);
  G.recordCash("reward", 500);
  G.recordCash("investment", -900);
  G.recordCash("supplies", -200);
  G.recordCash("consumable", -30);
  G.S.day = 85;
  networkEvening();
  const r = G.S.business.network.history.at(-1);
  assert.equal(r.legacyProfit, 30);
  assert.equal(
    r.oldStoreProfit,
    r.stores.find((s) => s.id === "old").profit + 30,
  );
});
test("three consecutive profitable periods unlock once and gaps reset streak but retain achievement", () => {
  fixture();
  for (let p = 17; p < 20; p++) {
    G.S.day = (p - 1) * 5 + 1;
    const r = settlePeriod();
    assert.equal(r.goalQualified, true, r.goalReason);
  }
  const n = G.S.business.network;
  assert.equal(n.streak, 3);
  assert.equal(n.completedDay, 95);
  G.S.day = 96;
  configure({ enabled: false });
  networkMorning();
  assert.equal(n.streak, 0);
  assert.equal(n.completedDay, 95);
  G.S.day = 101;
  configure();
  settlePeriod();
  assert.equal(n.streak, 1);
  assert.equal(n.completedDay, 95);
});
test("nonconsecutive reports cannot accidentally complete goal and old contract cancellation resets", () => {
  fixture();
  settlePeriod();
  G.S.day = 91;
  settlePeriod();
  assert.equal(G.S.business.network.streak, 1);
  G.S.day = 96;
  G.S.business.contracts.push({
    id: "c-failed",
    route: "fish",
    kind: "regular",
    qty: 4,
    price: 56,
    start: 101,
    due: 105,
    status: "cancelled",
    closedDay: 98,
    delivered: 0,
    windows: [0, 0],
    level: 0,
  });
  settlePeriod();
  assert.equal(G.S.business.network.streak, 0);
  assert.match(G.S.business.network.goalReason, /合同/);
});
test("unprofitable original shop cannot hide behind a profitable network counter", () => {
  fixture();
  networkMorning();
  G.recordCash("fine", -1000);
  G.S.day = 85;
  networkEvening();
  const report = G.S.business.network.history.at(-1);
  assert(report.stores.find((s) => s.id === "old").profit > 0);
  assert(report.oldStoreProfit < 0);
  assert.equal(report.goalQualified, false);
});
test("paid manager refuses suspicious ordinary visits but respects all important or started visits", () => {
  fixture();
  networkMorning();
  G.S.queue = [{ kind: "buy", who: "worker", robo: true, roboBad: 1, pat: 3 }];
  G.S.qi = 0;
  assert(G.observationClue(G.current()));
  assert.equal(G.canDelegateReception(), true);
  assert.equal(G.delegateReception().count, 1);
  for (const extra of [
    { kind: "police", who: "police" },
    { kind: "order", who: "robot" },
    { kind: "buy", who: "noble", collector: true },
    { kind: "sell", who: "lady", story: 0 },
    { kind: "buy", who: "worker", item: { uid: 999 } },
    { kind: "sell", who: "worker", checks: ["ok", null, null] },
  ]) {
    G.S.queue = [extra];
    G.S.qi = 0;
    assert.equal(G.canDelegateReception(), false);
  }
  configure({ enabled: false });
  G.S.business.network.current = null;
  assert.equal(G.networkManagerActive(), false);
});
test("raw water still reserves filter cash and protected stock never masquerades as usable inputs", () => {
  fixture();
  const b = G.S.business;
  Object.assign(b.employee, { hired: true, active: true, days: 5 });
  b.operations.enabled = true;
  b.operations.reserve = 150;
  b.operations.routes = { water: "regular", fish: "off" };
  b.routes.water.trial = true;
  b.routes.water.firstRegular = true;
  b.contracts.push({
    id: "known",
    route: "water",
    kind: "regular",
    status: "active",
    managed: true,
    start: 81,
    due: 85,
    qty: 24,
    delivered: 0,
    windows: [0, 0],
    level: 2,
    price: 44,
  });
  b.warehouse = Array.from({ length: 24 }, () =>
    G.mkItem("water", { g: 2, gk: true, known: true, cost: 8 }),
  );
  const held = G.networkPreview(undefined, 17);
  assert.equal(held.requiredCash - held.spending - held.reserve, 120);
  const premium = G.mkItem("water", { g: 4, gk: true, known: true });
  G.S.shelf = [premium];
  G.S.win = [premium.uid];
  const protectedPlan = G.networkPreview(undefined, 17);
  assert.equal(
    protectedPlan.requiredCash - protectedPlan.spending - protectedPlan.reserve,
    120,
  );
  G.S.win = [];
  b.reservations[premium.uid] = "foreign";
  assert.equal(
    G.networkPreview(undefined, 17).requiredCash - held.requiredCash,
    0,
  );
  b.reservations = {};
  G.S.filter = 3;
  assert(G.networkPreview(undefined, 17).requiredCash < held.requiredCash);
});
test("selected unsigned next customer costs are protected without duplicating a signed offer", () => {
  fixture();
  const b = G.S.business;
  b.operations.enabled = true;
  b.operations.routes = { water: "regular", fish: "off" };
  b.routes.water.trial = true;
  b.routes.water.firstRegular = true;
  Object.assign(b.employee, { hired: true, active: true, days: 5 });
  const future = G.networkPreview(undefined, 18);
  assert.equal(
    future.requiredCash - future.spending - future.reserve,
    24 * 8 + 90 + 30,
  );
  b.contracts.push({
    id: "future",
    route: "water",
    kind: "regular",
    status: "active",
    managed: true,
    start: 86,
    due: 90,
    qty: 24,
    delivered: 0,
    windows: [0, 0],
    level: 2,
    price: 44,
  });
  assert.equal(
    G.networkPreview(undefined, 18).requiredCash,
    future.requiredCash,
  );
});
test("legacy margin summary survives journal trimming and regional-only advance uses paid manager", () => {
  fixture();
  networkMorning();
  for (let i = 0; i < 510; i++) G.recordCash("retail", 1, 0);
  G.recordCash("fine", -7);
  assert.equal(G.S.business.network.legacyMargins[17], 503);
  assert.equal(G.S.business.ledger.length, 500);
  G.S.business.operations.enabled = false;
  G.S.queue = [{ kind: "buy", who: "worker", robo: true, roboBad: 1, pat: 3 }];
  const random = Math.random;
  try {
    Math.random = () => 0.99;
    const r = G.advanceManaged();
    assert.equal(r.ok, true);
    assert.equal(r.stop, "planning");
    assert.equal(G.S.day, 85);
    assert.equal(G.S.phase, "night");
    assert.equal(G.S.business.operations.enabled, false);
  } finally {
    Math.random = random;
  }
});
test("acknowledged opening-budget stop can advance while the unpaid period stays closed", () => {
  const natural = JSON.parse(
    readFileSync(
      new URL(
        "../../../output/miaomiao-pawnshop/expansion-20261019/natural/before-goal-settlement.json",
        import.meta.url,
      ),
    ),
  );
  G.setState(natural);
  assert.equal(G.S.day, 120);
  assert.equal(G.S.phase, "night");
  const policy = { ...G.S.business.network.policy };
  assert.equal(
    command("networkPolicy", { ...policy, reserve: 100000 }).ok,
    true,
  );
  const first = G.advanceManaged();
  assert.equal(first.stop, "operations");
  assert.match(first.reason, /运营资金不足/);
  assert.equal(G.S.day, 121);
  assert.equal(G.S.business.network.current, null);
  assert.equal(command("networkPolicy", { ...policy, reserve: 300 }).ok, true);
  const networkCharges = (period) =>
    G.S.business.ledger.filter(
      (entry) =>
        entry.period === period &&
        ["networkMaterials", "networkWages"].includes(entry.type),
    );
  assert.equal(networkCharges(25).length, 0);
  // A selected transaction is still a player decision, even after acknowledging the stoppage.
  const savedQueue = G.S.queue,
    savedQi = G.S.qi;
  G.S.queue = [
    { kind: "buy", who: "worker", pat: 3, item: G.S.shelf[0] || { uid: 999 } },
  ];
  G.S.qi = 0;
  const selectedStop = G.advanceManaged();
  assert.equal(selectedStop.stop, "important");
  assert.equal(G.S.day, 121);
  assert.equal(G.S.qi, 0);
  G.S.queue = savedQueue;
  G.S.qi = savedQi;
  let attempts = 0;
  while (G.S.day < 126 && attempts++ < 80) {
    const result = G.advanceManaged();
    assert.equal(result.ok, true);
    if (result.stop === "important") {
      const visitor = G.current();
      assert(visitor);
      if (visitor.kind === "police") G.acceptFine(G.inspect());
      // The same explicit decline/leave action used by the UI; no guest is silently skipped.
      G.S.qi++;
    }
    assert(
      !(
        result.stop === "operations" &&
        result.daysAdvanced === 0 &&
        /运营资金不足/.test(result.reason)
      ),
    );
    assert.equal(networkCharges(25).length, 0);
    if (G.S.day < 126) assert.equal(G.S.business.network.current, null);
  }
  assert.equal(G.S.day, 126);
  assert.equal(G.S.business.network.current.period, 26);
  assert.equal(networkCharges(26).length, 2);
  const paid = networkCharges(26).reduce((sum, entry) => sum - entry.amount, 0),
    cash = G.S.money;
  assert.equal(paid, G.S.business.network.current.costs.total);
  networkMorning();
  assert.equal(G.S.money, cash);
  assert.equal(networkCharges(26).length, 2);
});
console.log(`${tests} network regression groups passed`);
