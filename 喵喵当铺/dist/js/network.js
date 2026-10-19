// Regional production is a separate quantity ledger; it never creates or consumes legacy item UIDs.
const clone = (value) => JSON.parse(JSON.stringify(value));
export const networkPeriod = (day) => ({
  id: Math.floor((day - 1) / 5) + 1,
  start: Math.floor((day - 1) / 5) * 5 + 1,
  end: Math.floor((day - 1) / 5) * 5 + 5,
});
export const NETWORK_BUILDS = {
  workshop: { name: "中央作坊", cost: 1400 },
  harbor: { name: "港区分店", cost: 1800 },
  boutique: { name: "精品街分店", cost: 2200 },
  capacity: { name: "中央扩产", cost: 900 },
};
export const NETWORK_PRICES = {
  ordinaryWater: 44,
  boutiqueWater: 70,
  fish: 56,
};
const DEMAND = [
  {
    id: "normal",
    name: "普通期",
    old: [4, 2],
    harbor: [20, 8],
    boutique: [10, 2],
  },
  {
    id: "harbor",
    name: "港区忙季",
    old: [4, 2],
    harbor: [28, 10],
    boutique: [8, 2],
  },
  {
    id: "boutique",
    name: "精品活动",
    old: [4, 2],
    harbor: [16, 6],
    boutique: [16, 3],
  },
  {
    id: "fish",
    name: "鱼市旺季",
    old: [4, 3],
    harbor: [12, 14],
    boutique: [8, 3],
  },
];
const fresh = () => ({
  v: 1,
  reception: "all",
  builds: { workshop: null, harbor: null, boutique: null, capacity: null },
  policy: {
    enabled: false,
    production: "balanced",
    quality: "standard",
    priority: "harbor",
    reserve: 150,
  },
  current: null,
  history: [],
  streak: 0,
  completedDay: null,
  goalReason: "",
  marks: { opened: 0, settled: 0 },
  legacyMargins: {},
  profitable: { workshop: false, harbor: false, boutique: false },
});
export function ensureNetworkState(s) {
  if (!Object.prototype.hasOwnProperty.call(s.business, "network"))
    s.business.network = fresh();
  return s;
}
const state = (s) => s.business.network;
const effective = (n, id, day) =>
  !!n.builds[id] && n.builds[id].effectiveDay <= day;
const marginTypes = new Set([
  "retail",
  "fence",
  "contract",
  "temporaryOrder",
  "storyReceipt",
]);
const expenseTypes = new Set([
  "wage",
  "rent",
  "fine",
  "bribe",
  "fakeCash",
  "logistics",
]);
export function recordLegacyMargin(s, type, amount, cost) {
  const n = state(s);
  if (!n) return;
  const p = networkPeriod(s.day).id;
  if (marginTypes.has(type) || expenseTypes.has(type)) {
    n.legacyMargins[p] =
      (n.legacyMargins[p] || 0) +
      (marginTypes.has(type) ? amount - cost : amount);
  }
  for (const key of Object.keys(n.legacyMargins))
    if (Number(key) < p - 1) delete n.legacyMargins[key];
}
// Reserve existing, already accepted commitments without double-purchasing their stock.
function legacyWorkingCash(s, targetPeriod) {
  const b = s.business,
    o = b.operations;
  if (!o?.enabled) return 0;
  const current = networkPeriod(s.day),
    targetStart = (targetPeriod - 1) * 5 + 1,
    active = b.contracts.filter((c) => c.managed && c.status === "active");
  if (!active.length && Object.values(o.routes).every((kind) => kind === "off"))
    return 0;
  const demand = { water: 0, fish: 0 };
  let fees = 0;
  for (const c of active) demand[c.route] += c.qty - c.delivered;
  if (targetPeriod > current.id)
    for (const route of ["water", "fish"]) {
      const kind = o.routes[route];
      if (
        kind === "off" ||
        active.some((c) => c.route === route && c.start === targetStart)
      )
        continue;
      const r = b.routes[route];
      if (!r.trial) continue;
      const level =
        b.mainRoute === route && !r.recovery
          ? r.levelHistory
            ? Math.max(
                0,
                ...r.levelHistory
                  .filter((h) => h.day <= targetStart)
                  .map((h) => h.level),
              )
            : r.level
          : 0;
      const channel = r.recovery ? "regular" : kind;
      demand[route] +=
        channel === "harbor"
          ? route === "water"
            ? 36
            : 24
          : channel === "boutique"
            ? route === "water"
              ? 18
              : 12
            : !r.firstRegular
              ? route === "water"
                ? 3
                : 2
              : (route === "water" ? 6 : 4) *
                (level >= 2 ? 4 : level >= 1 ? 2 : 1);
      if (channel !== "regular") fees += 60;
    }
  const selected =
    s.queue[s.qi]?.kind === "buy" ? s.queue[s.qi].item?.uid : null;
  const usable = (i) =>
    i.known &&
    !i.fake &&
    !i.stolen &&
    !s.win.includes(i.uid) &&
    i.uid !== selected &&
    (!b.reservations[i.uid] ||
      active.some((c) => c.id === b.reservations[i.uid])) &&
    !(i.id === "water" && i.lab != null && i.lab > i.g);
  const stock = [
    ...s.shelf,
    ...b.warehouse,
    ...Object.values(s.machines).flatMap((j) =>
      j?.ready ? j.products || [] : [],
    ),
  ].filter(usable);
  const inputs = stock.filter((i) => !b.reservations[i.uid]);
  const inbound = (route) =>
    b.purchases
      .filter(
        (p) => p.route === route && ["ordered", "blocked"].includes(p.status),
      )
      .reduce((a, p) => a + p.qty, 0);
  const waterJob = s.machines.purifier,
    fishJob = s.machines.tank;
  const waterUnderway =
    waterJob && !waterJob.ready
      ? (waterJob.items || []).filter((i) => i.g === 4).length
      : 0;
  const fishUnderway = fishJob && !fishJob.ready ? fishJob.n : 0;
  const waterProduction = Math.max(
    0,
    demand.water -
      stock.filter((i) => i.id === "water" && i.gk && i.g === 4).length -
      waterUnderway,
  );
  const rawWater = inputs.filter(
    (i) => i.id === "water" && i.gk && i.g === 2,
  ).length;
  const rawPurchase = Math.max(
    0,
    waterProduction - rawWater - inbound("water"),
  );
  const fishPurchase = Math.max(
    0,
    demand.fish -
      stock.filter((i) => i.id === "fish").length -
      inputs.filter((i) => i.id === "fry").length -
      inbound("fish") -
      fishUnderway,
  );
  const filterPacks = Math.ceil(Math.max(0, waterProduction - s.filter) / 10);
  return (
    rawPurchase * 8 +
    fishPurchase * 12 +
    filterPacks * 30 +
    fees +
    (b.employee.hired && b.employee.active && b.employee.days <= 5 ? 30 : 0)
  );
}
function reserveOf(s, policy) {
  return Math.max(
    policy.reserve,
    s.business.operations?.enabled ? s.business.operations.reserve : 0,
  );
}
// This function is pure: callers can compare all public strategies without changing state or RNG.
export function previewNetwork(
  s,
  policy = state(s)?.policy,
  periodId = networkPeriod(s.day).id + 1,
  extraBuild = null,
) {
  const n = state(s) || fresh(),
    p = { id: periodId, start: (periodId - 1) * 5 + 1, end: periodId * 5 },
    builds = clone(n.builds);
  if (extraBuild) builds[extraBuild] = { effectiveDay: p.start };
  const future = { ...n, builds },
    market = DEMAND[(periodId - 1) % DEMAND.length],
    capacity = effective(future, "capacity", p.start) ? 72 : 48;
  const ids = effective(future, "workshop", p.start)
    ? [
        "old",
        ...["harbor", "boutique"].filter((id) =>
          effective(future, id, p.start),
        ),
      ]
    : [];
  const waterHours = Math.floor(
    capacity *
      { water: 2 / 3, balanced: 1 / 2, fish: 1 / 3 }[policy.production],
  );
  let production = {
    standard: 0,
    premium: 0,
    fish: Math.floor((capacity - waterHours) / 2),
  };
  if (policy.quality === "standard") production.standard = waterHours;
  else if (policy.quality === "premium")
    production.premium = Math.floor(waterHours / 2);
  else {
    production.standard =
      Math.floor(waterHours / 3) + (waterHours % 3 === 1 ? 1 : 0);
    production.premium =
      Math.floor(waterHours / 3) + (waterHours % 3 === 2 ? 1 : 0);
  }
  const ordinaryDemand = ids
      .filter((id) => id !== "boutique")
      .reduce((n, id) => n + market[id][0], 0),
    premiumDemand = ids.includes("boutique") ? market.boutique[0] : 0,
    fishDemand = ids.reduce((n, id) => n + market[id][1], 0);
  production.standard = Math.min(production.standard, ordinaryDemand);
  production.premium = Math.min(
    production.premium,
    premiumDemand + Math.max(0, ordinaryDemand - production.standard),
  );
  production.fish = Math.min(production.fish, fishDemand);
  const remaining = { ...production },
    stores = ids.map((id) => ({
      id,
      name: id === "old" ? "老店日用品柜台" : NETWORK_BUILDS[id].name,
      demand: { water: market[id][0], fish: market[id][1] },
      units: { standard: 0, premium: 0, fish: 0 },
      income: 0,
      materials: 0,
      wages: 0,
      wasteCost: 0,
      spending: 0,
      profit: 0,
    }));
  const by = (id) => stores.find((store) => store.id === id),
    order = [
      "old",
      policy.priority,
      ...["harbor", "boutique"].filter((id) => id !== policy.priority),
    ].filter((id) => ids.includes(id));
  // Standard water and fish protect the old counter first; premium units first meet premium demand.
  for (const id of order) {
    const st = by(id);
    if (id !== "boutique") {
      st.units.standard = Math.min(remaining.standard, st.demand.water);
      remaining.standard -= st.units.standard;
    }
    st.units.fish = Math.min(remaining.fish, st.demand.fish);
    remaining.fish -= st.units.fish;
  }
  if (by("boutique")) {
    by("boutique").units.premium = Math.min(
      remaining.premium,
      by("boutique").demand.water,
    );
    remaining.premium -= by("boutique").units.premium;
  }
  for (const id of order.filter((id) => id !== "boutique")) {
    const st = by(id);
    st.units.premium = Math.min(
      remaining.premium,
      st.demand.water - st.units.standard,
    );
    remaining.premium -= st.units.premium;
  }
  const materials =
      production.standard * 11 + production.premium * 17 + production.fish * 12,
    wages = ids.length
      ? 90 +
        30 +
        (ids.includes("harbor") ? 90 : 0) +
        (ids.includes("boutique") ? 120 : 0)
      : 0,
    hoursUsed =
      production.standard + production.premium * 2 + production.fish * 2,
    waste = { ...remaining },
    wasteCost = waste.standard * 11 + waste.premium * 17 + waste.fish * 12;
  const deliveredHours = stores.reduce(
    (sum, st) =>
      sum + st.units.standard + st.units.premium * 2 + st.units.fish * 2,
    0,
  );
  const weights = stores.map((st) =>
    deliveredHours
      ? (st.units.standard + st.units.premium * 2 + st.units.fish * 2) /
        deliveredHours
      : 1 / stores.length,
  );
  const split = (total) => {
    const amounts = weights.map((weight) => Math.floor(total * weight));
    let remaining = total - amounts.reduce((n, value) => n + value, 0);
    const order = weights
      .map((weight, index) => ({ weight, index }))
      .sort(
        (a, b) =>
          (b.weight > 0 ? 1 : 0) - (a.weight > 0 ? 1 : 0) || a.index - b.index,
      );
    for (let i = 0; remaining > 0; i++, remaining--)
      amounts[order[i % order.length].index]++;
    return amounts;
  };
  const centralWages = split(stores.length ? 90 : 0),
    wasteShares = split(wasteCost);
  for (const [index, st] of stores.entries()) {
    st.materials =
      st.units.standard * 11 + st.units.premium * 17 + st.units.fish * 12;
    st.wages =
      (st.id === "old" ? 30 : st.id === "harbor" ? 90 : 120) +
      centralWages[index];
    st.wasteCost = wasteShares[index];
    st.income =
      (st.units.standard + st.units.premium) *
        (st.id === "boutique"
          ? NETWORK_PRICES.boutiqueWater
          : NETWORK_PRICES.ordinaryWater) +
      st.units.fish * NETWORK_PRICES.fish;
    st.spending = st.materials + st.wages + st.wasteCost;
    st.profit = st.income - st.spending;
  }
  const income = stores.reduce((sum, st) => sum + st.income, 0),
    spending = materials + wages,
    reserve = reserveOf(s, policy),
    requiredCash = spending + reserve + legacyWorkingCash(s, periodId);
  return {
    period: p,
    market: { id: market.id, name: market.name },
    capacity,
    hoursUsed,
    production,
    stores,
    income,
    materials,
    wages,
    spending,
    profit: income - spending,
    waste,
    requiredCash,
    reserve,
    affordable: s.money >= requiredCash,
    shortfall: Math.max(0, requiredCash - s.money),
  };
}
function construction(s, id) {
  const n = state(s),
    def = NETWORK_BUILDS[id],
    p = networkPeriod(s.day),
    next = p.id + 1,
    plan = previewNetwork(s, n.policy, next, id);
  let reason = "";
  if (n.builds[id]) reason = "已建设";
  else if (!s.business.ownership.owned) reason = "先赎回老店";
  else if (
    id === "workshop" &&
    !Object.values(s.business.routes).some(
      (r) =>
        (r.levelHistory
          ? Math.max(
              0,
              ...r.levelHistory
                .filter((h) => h.day <= s.day)
                .map((h) => h.level),
            )
          : r.level) >= 2,
    )
  )
    reason = "主营扩产II生效后建设";
  else if (id !== "workshop" && !effective(n, "workshop", s.day))
    reason = "先让中央作坊营业";
  else if (["harbor", "boutique"].includes(id)) {
    const existing = ["harbor", "boutique"].filter((key) => n.builds[key]);
    if (!existing.length && !n.profitable.workshop)
      reason = "中央作坊先盈利一期";
    else if (existing.length && !existing.some((key) => n.profitable[key]))
      reason = "第一家分店先盈利一期";
  } else if (
    id === "capacity" &&
    !["harbor", "boutique"].some((key) => effective(n, key, s.day))
  )
    reason = "先开一家分店";
  const requiredCash = def.cost + plan.requiredCash;
  if (!reason && s.money < requiredCash)
    reason = `还需${Math.ceil(requiredCash - s.money)}鱼币，保留运营周转`;
  return {
    id,
    name: def.name,
    cost: def.cost,
    built: !!n.builds[id],
    effective: effective(n, id, s.day),
    effectiveDay: n.builds[id]?.effectiveDay || p.end + 1,
    eligible: !reason,
    reason,
    requiredCash,
    balanceAfter: s.money - def.cost,
  };
}
export function networkView(s) {
  const n = state(s),
    preview = previewNetwork(s),
    builds = Object.keys(NETWORK_BUILDS).map((id) => construction(s, id));
  let reason = !n.builds.workshop
    ? "先建设中央作坊"
    : !effective(n, "workshop", s.day)
      ? "中央作坊次期营业"
      : n.policy.enabled &&
          n.marks.opened === networkPeriod(s.day).id &&
          !n.current
        ? n.goalReason || "本期未开工，下期按新安排营业"
        : "";
  const managerActive = networkManagerActive(s);
  return {
    enabled: n.policy.enabled,
    policy: n.policy,
    available: !!(n.policy.enabled || n.current) && !!n.builds.workshop,
    reason,
    managerActive,
    reception: n.reception === undefined ? "all" : n.reception,
    builds,
    status: reason || (n.current ? "本期已付费开工" : "待下期开工"),
    current: n.current,
    last: n.history.at(-1) || null,
    history: n.history,
    preview,
    goal: {
      streak: n.streak,
      required: 3,
      completedDay: n.completedDay,
      reason: n.goalReason,
    },
    nextTarget: !n.builds.workshop
      ? "建设中央作坊"
      : !n.profitable.workshop
        ? "作坊盈利一期"
        : !n.builds.harbor && !n.builds.boutique
          ? "开第一家分店"
          : !n.builds.harbor || !n.builds.boutique
            ? "开第二家分店"
            : n.completedDay
              ? "继续经营"
              : "三店连续三期稳健经营",
  };
}
export function networkCommand(s, action, args, api) {
  const n = state(s);
  if (action === "networkReception") {
    if (!["all", "stock"].includes(args.mode)) return { ok: false, reason: "接待安排无效" };
    if (!n.builds.workshop) return { ok: false, reason: "先建设中央作坊" };
    n.reception = args.mode;
    return { ok: true };
  }
  if (action === "networkBuild") {
    if (!NETWORK_BUILDS[args.id]) return { ok: false, reason: "建设项目无效" };
    const offer = construction(s, args.id);
    if (!offer.eligible) return { ok: false, reason: offer.reason };
    s.money -= offer.cost;
    api.record("networkBuild", -offer.cost, 0, args.id);
    n.builds[args.id] = {
      cost: offer.cost,
      builtDay: s.day,
      effectiveDay: networkPeriod(s.day).end + 1,
    };
    return {
      ok: true,
      cost: offer.cost,
      effectiveDay: n.builds[args.id].effectiveDay,
    };
  }
  if (action === "networkPolicy") {
    if (
      typeof args.enabled !== "boolean" ||
      !["water", "balanced", "fish"].includes(args.production) ||
      !["standard", "mixed", "premium"].includes(args.quality) ||
      !["harbor", "boutique"].includes(args.priority) ||
      !Number.isSafeInteger(args.reserve) ||
      args.reserve < 0
    )
      return { ok: false, reason: "区域经营安排无效" };
    if (args.enabled && !n.builds.workshop)
      return { ok: false, reason: "先建设中央作坊" };
    n.policy = {
      enabled: args.enabled,
      production: args.production,
      quality: args.quality,
      priority: args.priority,
      reserve: args.reserve,
    };
    return { ok: true };
  }
  return { ok: false, reason: "未知区域经营操作" };
}
export function networkMorning(s, api) {
  const n = state(s),
    p = networkPeriod(s.day);
  if (s.day !== p.start || n.marks.opened >= p.id) return { ok: true };
  n.marks.opened = p.id;
  if (!n.policy.enabled || !effective(n, "workshop", s.day)) {
    n.streak = 0;
    if (n.builds.workshop) n.goalReason = "本期停工";
    return { ok: true };
  }
  const plan = previewNetwork(s, n.policy, p.id);
  if (!plan.affordable) {
    n.streak = 0;
    n.goalReason = `运营资金不足，还需${Math.ceil(plan.shortfall)}鱼币`;
    return { ok: false, reason: n.goalReason };
  }
  s.money -= plan.spending;
  api.record("networkMaterials", -plan.materials);
  api.record("networkWages", -plan.wages);
  n.current = {
    id: `network:${p.id}`,
    period: p.id,
    start: p.start,
    end: p.end,
    policy: clone(n.policy),
    plan,
    costs: {
      materials: plan.materials,
      wages: plan.wages,
      total: plan.spending,
    },
  };
  return { ok: true };
}
export function networkEvening(s, api) {
  const n = state(s),
    c = n.current;
  if (!c || s.day < c.end || n.marks.settled >= c.period) return { ok: true };
  const report = clone(c.plan);
  report.id = c.id;
  report.settledDay = s.day;
  report.legacyProfit = n.legacyMargins[c.period] || 0;
  report.oldStoreProfit =
    (report.stores.find((st) => st.id === "old")?.profit || 0) +
    report.legacyProfit;
  s.money += report.income;
  api.record("networkIncome", report.income, report.materials, c.id);
  n.marks.settled = c.period;
  n.current = null;
  const next = previewNetwork(s, n.policy, c.period + 1),
    allOpen = ["workshop", "harbor", "boutique"].every((id) =>
      effective(n, id, c.start),
    ),
    failed = s.business.contracts.some(
      (contract) =>
        ["failed", "cancelled"].includes(contract.status) &&
        (contract.closedDay ?? contract.due) >= c.start &&
        (contract.closedDay ?? contract.due) <= c.end,
    ),
    loss = report.stores.find(
      (st) => (st.id === "old" ? report.oldStoreProfit : st.profit) <= 0,
    );
  report.goalReason = !allOpen
    ? "尚未三店齐营"
    : failed
      ? "本期既有合同未履约"
      : loss
        ? `${loss.name}未盈利`
        : s.money < next.requiredCash
          ? "下期周转资金不足"
          : "";
  report.goalQualified = !report.goalReason;
  if (report.profit > 0) n.profitable.workshop = true;
  for (const st of report.stores)
    if (st.id !== "old" && st.profit > 0) n.profitable[st.id] = true;
  n.streak = report.goalQualified
    ? n.history.at(-1)?.period.id === c.period - 1
      ? n.streak + 1
      : 1
    : 0;
  n.goalReason = report.goalReason;
  if (n.streak >= 3 && !n.completedDay) n.completedDay = s.day;
  n.history.push(report);
  n.history = n.history.slice(-2);
  return { ok: true, settled: true };
}
export function networkManagerActive(s) {
  const c = state(s)?.current;
  return !!c && s.day >= c.start && s.day <= c.end && c.costs.wages >= 120;
}
export const networkInventoryValue = (s) =>
  state(s)?.current?.costs.materials || 0;
