import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as G from "../js/game.js";
import { validateRun } from "../js/persistence.js";
const C = (action, args = {}) => G.businessCommand(action, args);
const set = (
  routes = { water: "regular", fish: "regular" },
  reserve = 0,
  enabled = true,
) => C("setOperations", { enabled, reserve, routes });
const snap = () => JSON.stringify(G.S);
let count = 0;
function test(name, fn) {
  fn();
  count++;
  console.log(`PASS ${name}`);
}
const original = JSON.parse(
  readFileSync(
    new URL("./fixtures/growth-v3/hands-on-day17.json", import.meta.url),
  ),
);
const real = () => {
  G.setState(structuredClone(original));
  return G.S;
};
const handleVisitors = () => {
  while (G.current()) {
    if (G.canDelegateReception()) G.delegateReception();
    else {
      G.current().resolved = true;
      G.S.qi++;
    }
  }
};
function next() {
  if (G.S.phase === "day") {
    handleVisitors();
    if (G.rentToday() && !G.S.business.ownership.owned && !G.S.rentDone)
      assert(G.payRent());
    G.startNight();
  }
  G.sleep();
  G.expireOrders();
  G.voidFakeCash();
  G.startDay();
  validateRun(G.S);
}
function fixture(day = 20) {
  G.newRun();
  Object.assign(G.S, {
    day,
    money: 5000,
    phase: "night",
    queue: [],
    qi: 0,
    shelf: [],
    filter: 0,
  });
  Object.assign(G.S.owned, { purifier: true, tank: true });
  Object.assign(G.S.up, { purifier: true, tank: true });
  Object.assign(G.S.business.employee, { hired: true, active: true, days: 5 });
  G.S.business.routes.water.trial = true;
  G.S.business.routes.fish.trial = true;
  G.S.business.mainRoute = "water";
  G.S.business.routes.water.level = 2;
  G.S.business.capacity = 24;
  return G.S;
}
test("old saves default disabled and preserve money, stock and unknown truth", () => {
  const s = real(),
    cash = s.money,
    uid = s.uid;
  assert.equal(s.business.operations.enabled, false);
  assert.equal(s.business.operations.reserve, 150);
  assert.equal(G.advanceManaged().ok, false);
  assert.equal(s.money, cash);
  assert.equal(s.uid, uid);
});
test("invalid policy is atomic and no-work policy is refused", () => {
  fixture();
  let before = snap();
  assert.equal(set({ water: "harbor", fish: "regular" }).ok, false);
  assert.equal(snap(), before);
  assert.equal(set({ water: "regular", fish: "regular" }, -1).ok, false);
  assert.equal(snap(), before);
  assert.equal(set({ water: "off", fish: "off" }).ok, false);
});
test("real day17 state runs two complete dual-line periods with two-delivery limits", () => {
  real();
  assert.equal(set().ok, true);
  const cash = G.S.money;
  for (let i = 0; i < 13; i++) next();
  const complete = G.S.business.contracts.filter(
    (c) => c.managed && [21, 26].includes(c.start),
  );
  assert.equal(complete.length, 4);
  assert(complete.every((c) => c.status === "completed"));
  assert.equal(G.S.day, 30);
  assert(G.S.money > cash);
  for (const route of ["water", "fish"])
    for (const period of [5, 6]) {
      const orders = G.S.business.purchases.filter(
        (p) =>
          p.route === route && p.period === period && p.status !== "cancelled",
      );
      assert(new Set(orders.map((o) => o.arrivalDay)).size <= 2);
    }
  assert.deepEqual(
    G.S.business.purchases
      .filter((p) => p.period === 5)
      .map((p) => [p.route, p.qty]),
    [
      ["fish", 4],
      ["water", 19],
      ["water", 5],
    ],
  );
  assert(Object.keys(G.S.business.operations.reports).length <= 2);
});
test("repeated operations morning does not duplicate money, production, UID or reports", () => {
  fixture();
  set();
  G.operateManaged("night");
  next();
  G.operateManaged("morning");
  const before = snap();
  G.operateManaged("morning");
  assert.equal(snap(), before);
});
test("cash floor protects reserve, next rent and arrears with no future-income borrowing", () => {
  fixture();
  G.S.money = 220;
  G.S.rentDue = 30;
  set({ water: "regular", fish: "regular" }, 100);
  G.operateManaged("night");
  assert.equal(G.S.business.purchases.length, 0);
  assert.equal(G.S.money, 220);
  assert(G.businessView().operations.issues.some((i) => i.code === "cash"));
});
test("global off stops supply automation and does not restore captured old machine plans", () => {
  fixture();
  G.S.business.plans = [
    { machine: "purifier", qty: 1, enabled: true },
    { machine: "furnace", qty: 1, enabled: true },
  ];
  set();
  assert.equal(G.S.business.plans[0].enabled, false);
  assert.equal(G.S.business.plans[1].enabled, true);
  set({ water: "off", fish: "off" }, 0, false);
  const cash = G.S.money;
  next();
  assert.equal(G.S.money, cash);
  assert.equal(G.S.business.purchases.length, 0);
  assert.equal(G.S.business.plans[0].enabled, false);
});
test("route off fulfills already-managed contracts without renewing or idle payroll", () => {
  fixture();
  set({ water: "regular", fish: "off" });
  G.operateManaged("night");
  assert.equal(set({ water: "off", fish: "off" }).ok, true);
  for (let i = 0; i < 5; i++) next();
  assert.equal(G.S.business.contracts.filter((c) => c.managed).length, 1);
  assert.equal(
    G.S.business.contracts.find((c) => c.managed).status,
    "completed",
  );
  G.S.business.employee.days = 0;
  const cash = G.S.money;
  G.operateManaged("night");
  assert.equal(G.S.money, cash);
  assert.equal(G.businessView().operations.reason, "待安排客户");
});
test("boutique honors both windows, preserves premium water and other contract reservations", () => {
  fixture();
  G.S.business.routes.water.level = 3;
  G.S.business.routes.water.level2Completed = 1;
  G.S.business.capacity = 36;
  set({ water: "boutique", fish: "off" });
  G.operateManaged("night");
  const c = G.S.business.contracts.find((c) => c.managed);
  const premium = G.mkItem("water", { g: 5, gk: true, known: true, cost: 30 });
  G.S.shelf.push(premium);
  for (let i = 0; i < 3; i++) next();
  assert.equal(c.windows[0], 9);
  assert.equal(c.windows[1], 0);
  next();
  assert.equal(c.windows[1], 9);
  assert.equal(c.status, "completed");
  assert(G.S.shelf.some((i) => i.uid === premium.uid));
});
test("expired unpaid and paused employees cannot work; disabling unavailable market remains legal", () => {
  fixture();
  set();
  G.S.business.employee.days = 0;
  G.S.money = 140;
  G.operateManaged("night");
  assert.equal(G.S.business.contracts.filter((c) => c.managed).length, 0);
  assert.equal(G.S.business.purchases.length, 0);
  G.S.business.operations.routes.water = "boutique";
  G.S.business.routes.water.recovery = true;
  assert.equal(set({ water: "boutique", fish: "off" }, 0, false).ok, true);
});
test("managed advance stops at important visitor and after a genuine period transition", () => {
  fixture(19);
  set({ water: "regular", fish: "off" });
  G.S.phase = "day";
  G.S.queue = [{ kind: "police", who: "police" }];
  let r = G.advanceManaged();
  assert.equal(r.stop, "important");
  assert.equal(G.S.day, 19);
  assert.equal(G.S.qi, 0);
  G.S.queue = [];
  const random = Math.random;
  try {
    Math.random = () => 0.99;
    r = G.advanceManaged();
    if (r.stop === "important") {
      handleVisitors();
      r = G.advanceManaged();
    }
    assert.equal(G.S.day, 20);
    assert.equal(r.stop, "planning");
    assert(r.daysAdvanced <= 1);
    assert.equal(G.S.phase, "night");
    assert.equal(G.S.business.contracts.length, 0);
    r = G.advanceManaged();
    assert.equal(G.S.day, 21);
    assert.equal(r.stop, "period");
    assert.equal(r.daysAdvanced, 1);
  } finally {
    Math.random = random;
  }
});
test("owned shop never stops for phantom rent and fake-cash loss remains visible", () => {
  fixture(20);
  G.S.business.ownership = { owned: true, day: 17 };
  set({ water: "regular", fish: "off" });
  G.S.fakeCash = 7;
  const r = G.advanceManaged();
  assert.equal(r.stop, "operations");
  assert.match(r.reason, /假币损失7/);
  assert.equal(G.S.day, 21);
});
test("managed reports are real cash deltas and exclude manual investment", () => {
  fixture();
  set();
  G.operateManaged("night");
  const report = G.businessView().operations.period;
  const spending = G.S.business.ledger
    .filter((e) => e.managed && e.period === 4 && e.amount < 0)
    .reduce((n, e) => n - e.amount, 0);
  assert.equal(report.spending, spending);
  const before = report.spending;
  assert.equal(C("invest", { id: "warehouse" }).ok, false);
  assert.equal(G.businessView().operations.period.spending, before);
});
test("same-day budget repair retries without duplicating earlier commitments", () => {
  fixture();
  set({ water: "regular", fish: "off" }, 5000);
  G.operateManaged("night");
  assert.equal(G.S.business.purchases.length, 0);
  set({ water: "regular", fish: "off" }, 0);
  G.operateManaged("night");
  assert.equal(G.S.business.purchases.length, 1);
  assert.equal(G.S.business.contracts.length, 1);
  const before = snap();
  G.operateManaged("night");
  assert.equal(snap(), before);
});
test("last paid day can use real contract proceeds before wage renewal", () => {
  fixture(22);
  G.S.business.employee.days = 1;
  G.S.money = 140;
  set({ water: "regular", fish: "off" });
  const c = G.businessCommand("acceptContract", {
    route: "water",
    kind: "trial",
  });
  assert.equal(c.ok, false);
  const customer = {
    id: "existing",
    route: "water",
    kind: "regular",
    qty: 3,
    price: 44,
    start: 21,
    due: 25,
    status: "active",
    delivered: 0,
    windows: [0, 0],
    level: 2,
    managed: true,
  };
  G.S.business.contracts.push(customer);
  G.S.shelf = Array.from({ length: 3 }, () =>
    G.mkItem("water", { g: 4, gk: true, known: true, cost: 11 }),
  );
  G.operateManaged("morning");
  assert.equal(customer.status, "completed");
  assert.equal(G.S.business.employee.days, 6);
  assert(!G.businessView().operations.issues.some((i) => i.code === "cash"));
});
test("zero-work enabled policy does not renew payroll after its final managed delivery", () => {
  fixture(22);
  G.S.business.employee.days = 1;
  const c = {
    id: "last",
    route: "water",
    kind: "regular",
    qty: 1,
    price: 44,
    start: 21,
    due: 25,
    status: "active",
    delivered: 0,
    windows: [0, 0],
    level: 2,
    managed: true,
  };
  G.S.business.contracts.push(c);
  set({ water: "off", fish: "off" });
  G.S.shelf = [G.mkItem("water", { g: 4, gk: true, known: true })];
  const cash = G.S.money;
  G.operateManaged("morning");
  assert.equal(G.S.money, cash + 44);
  assert.equal(G.S.business.employee.days, 1);
  assert.equal(G.businessView().operations.reason, "待安排客户");
});
test("recovery options quote the actual base commitment while preserving market preference", () => {
  fixture();
  G.S.business.routes.water.level = 3;
  G.S.business.routes.water.recovery = true;
  G.S.business.routes.water.firstRegular = true;
  const q = G.businessView().operations.options.water.find(
    (q) => q.kind === "boutique",
  );
  assert.equal(q.qty, 6);
  assert.equal(q.price, 44);
  assert.equal(q.fee, 0);
  assert.equal(q.quotedKind, "regular");
  assert.match(q.text, /恢复期按固定客户/);
  assert.equal(set({ water: "boutique", fish: "off" }).ok, true);
  G.operateManaged("night");
  const c = G.S.business.contracts.find((c) => c.managed);
  assert.equal(c.kind, "regular");
  assert.equal(c.qty, 6);
  assert.match(G.businessView().operations.options.water[0].text, /下期已签/);
});
console.log(`${count} operations regression groups passed`);
