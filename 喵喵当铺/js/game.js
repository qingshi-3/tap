// 核心规则：状态、行情、客人生成、交易判定、夜晚结算。不碰 DOM。
import { ITEMS, SELLERS, BUYERS, NEWS, CRATES, MACHINES, UPGRADES, CATS, WG, SIGNS, OBS, rentOf, DAYS_PER_WEEK, BUYOUT, PHONE_CONTACTS, MACHINE_MODS, FEATURED_VISITS } from './data.js';

export const rnd = (a, b) => a + Math.random() * (b - a);
export const ri = (a, b) => Math.floor(rnd(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r5 = (v) => Math.max(1, Math.round(v));

export let S = null;
export const setState = (s) => { validateNightGround(s); S = s; };

export function newRun() {
  S = {
    v: 2, day: 1, money: 100, uid: 1,
    sign: 'warm', win: [], filter: 0, ice: 0, fakeCash: 0,
    shelf: [], hidden: [], shelfCap: 6, hiddenCap: 0,
    up: {}, machines: { furnace: null }, owned: { furnace: true },
    rep: { elite: 0, folk: 0, law: 0, gang: 0 },
    orders: [], queue: [], qi: 0,
    news: 'calm', nextNews: pick(NEWS.filter(n => n.id !== 'calm' && (n.tier || 1) === 1)).id, newsPeek: false,
    mkt: {}, phase: 'day', night: { crate: 0, crates: [], extra: false, peek: false },
    rentDue: 0, graceUsed: false, rentPaid: 0,
    story: { lady: 0, pearl: null },
    st: { buy: 0, sell: 0, fakeSpot: 0, fakeSold: 0, ingots: 0, waters: 0, clean: 0, orders: 0, peakWorth: 0, robo: 0, cooled: 0 },
    tutorial: false,
  };
  ['dryfish', 'dryfish', 'can', 'scrap', 'scrap'].forEach((id) => S.shelf.push(mkItem(id)));
  ensureVariety();
  rollMarket();
  return S;
}

export const mkItem = (id, o = {}) => ({ uid: S.uid++, id, fake: false, stolen: false, cost: 0, q: o.q ?? rnd(0.9, 1.12), ...(id === 'water' ? { g: ri(0, 2), lab: null } : {}), ...o });
// 水：g=真实档位，lab=标签上写的档位（贴标或卖家吹的）
export const grade = (it) => it.g ?? 3;
export const shownG = (it) => (it.lab != null ? it.lab : grade(it));
export const isWater = (it) => it.id === 'water';
export const fakeish = (it) => it.fake || (it.lab != null && it.lab > grade(it));
export const itemName = (it) => (isWater(it) ? WG[shownG(it)].n : ITEMS[it.id].name);
const baseV = (it, g) => ITEMS[it.id].v * (isWater(it) ? WG[g].m : 1);
export const week = () => Math.floor((S.day - 1) / DAYS_PER_WEEK) + 1;
export const weekday = () => (S.day - 1) % DAYS_PER_WEEK;
export const rentToday = () => weekday() === DAYS_PER_WEEK - 1;
export const rentAmount = () => rentOf(week()) + S.rentDue;
// On a settled rent day, planning must point to next week, including any deferred debt.
export function rentInfo() {
  const paid = rentToday() && (!!S.rentDone || S.phase === 'night');
  return { amount: rentOf(week() + (paid ? 1 : 0)) + (S.rentDue || 0), days: DAYS_PER_WEEK - 1 - weekday() + (paid ? DAYS_PER_WEEK : 0), paid };
}
export const isBan = (it) => !!ITEMS[it.id].ban;
export const allItems = () => [...S.shelf, ...S.hidden];

// ───── 行情 ─────
function rollMarket() {
  const n = NEWS.find((x) => x.id === S.news);
  const m = {};
  for (const c of ['food', 'drink', 'material', 'tech', 'treasure', 'toy', 'ban']) m[c] = rnd(0.9, 1.1);
  for (const [k, v] of Object.entries(n.mul)) m[k] = (m[k] || 1) * v;
  S.mkt = m;
}
export const newsObj = (id = S.news) => NEWS.find((x) => x.id === id);
export function mult(id) {
  const it = ITEMS[id];
  let m = S.mkt[it.cat] ?? 1;
  if (S.mkt[id]) m *= S.mkt[id];
  if (it.ban) m *= S.mkt.ban ?? 1;
  return m;
}
// 真实价值（赝品只值一成五）
export const trueValue = (it) => r5(baseV(it, grade(it)) * it.q * mult(it.id) * (it.fake ? 0.15 : 1));
// 看上去的价值（不知道真假时）
export const lookValue = (it) => r5(baseV(it, shownG(it)) * it.q * mult(it.id));
// 给玩家看的估价区间：真值落在区间内，但不一定在中间
export function estimate(it) {
  if (!it.est || it.est.day !== S.day) {
    const v = lookValue(it), s = S.up.guide ? 0.1 : 0.25, off = rnd(-s * 0.6, s * 0.6);
    it.est = { day: S.day, lo: r5(v * (1 - s + off)), hi: r5(v * (1 + s + off)) };
  }
  return it.est;
}
export const netWorth = () => S.money + allItems().reduce((a, it) => a + trueValue(it), 0);

// Optional v2 content extension. A booked visit is a promise, independent of later stock changes.
const CONTENT_STAGES = [
  { tier: 2, day: 3, trades: 6, label: '码头与夜市的新客、新货' },
  { tier: 3, day: 6, trades: 12, label: '星港旧物与修复台' },
  { tier: 4, day: 10, trades: 20, label: '远航珍宝与宝石台' },
];
const tierOf = x => x?.tier || 1;
export function ensureVariety() {
  if (!S || S.v !== 2) throw Error('不支持的营业存档版本');
  if (S.variety !== undefined) validateVariety(S.variety);
  else S.variety = { v: 1, tier: 1, recentVisitors: [], recentGoods: [], recentVisits: [], rotation: 0,
    next: null, current: null, dayStarted: S.queue?.length ? S.day : 0 };
  return S.variety;
}
export function contentTier() {
  const v = ensureVariety(), trades = (S.st.buy || 0) + (S.st.sell || 0);
  for (const stage of CONTENT_STAGES) if (S.day >= stage.day && trades >= stage.trades) v.tier = Math.max(v.tier, stage.tier);
  return v.tier;
}
export function nextContentUnlock() {
  const next = CONTENT_STAGES.find(s => s.tier > contentTier());
  return next ? { ...next, remainingTrades: Math.max(0, next.trades - (S.st.buy || 0) - (S.st.sell || 0)) } : null;
}
const availableItem = id => !!ITEMS[id] && tierOf(ITEMS[id]) <= contentTier();
const activeSellers = () => sellerTypes.filter(t => tierOf(CATS[t]) <= contentTier() && tierOf(SELLERS[t]) <= contentTier());
const activeBuyers = () => buyerTypes.filter(t => tierOf(CATS[t]) <= contentTier() && tierOf(BUYERS[t]) <= contentTier());
const marketChoices = exclude => NEWS.filter(n => n.id !== exclude && tierOf(n) <= contentTier());
function bookVisit(day) {
  const v = ensureVariety(), tier = contentTier(), kind = ['sell', 'buy', 'order'][v.rotation % 3];
  let pool = FEATURED_VISITS.filter(x => x.kind === kind && tierOf(x) <= tier && tierOf(CATS[x.who]) <= tier && availableItem(x.item));
  const fresh = pool.filter(x => !v.recentVisits.includes(x.id));
  if (fresh.length) pool = fresh;
  else { const different = pool.filter(x => x.id !== v.recentVisits.at(-1)); if (different.length) pool = different; }
  const template = pick(pool);
  if (!template) throw Error('缺少当前阶段的预约来客');
  const { id, who, item, line, premium } = template;
  const visit = { day, id, kind, who, item, qty: template.qty || 1, line, ...(premium !== undefined ? { premium } : {}) };
  v.rotation++; v.recentVisits = [...v.recentVisits, id].slice(-6);
  return visit;
}
export function nextVisit() {
  const v = ensureVariety(), day = S.day + 1;
  if (!v.next || v.next.day !== day) v.next = bookVisit(day);
  return { ...v.next };
}
function visitToday() {
  const v = ensureVariety();
  if (v.current?.day !== S.day) {
    v.current = v.next?.day === S.day ? v.next : bookVisit(S.day);
    if (v.next?.day === S.day) v.next = null;
  }
  return v.current;
}
function featuredSpec(visit) {
  const meta = { visitId: visit.id, visitDay: visit.day, line: visit.line };
  if (visit.kind === 'sell') return { ...sellerSpec(visit.who, visit.item), ...meta };
  if (visit.kind === 'buy') return { ...buyerSpec(visit.who), want: isBan({ id: visit.item }) ? 'ban' : ITEMS[visit.item].cat,
    minG: visit.item === 'water' ? BUYERS[visit.who].minG : undefined, wantId: visit.item,
    rich: visit.premium || 1.35, ...meta };
  return { kind: 'order', who: visit.who, ...meta, order: { id: visit.item, qty: visit.qty,
    due: S.day + 3, reward: r5(ITEMS[visit.item].v * visit.qty * (visit.premium || 1.5)),
    who: visit.who, visitId: visit.id, visitDay: visit.day } };
}

// ───── 客人 ─────
const sellerTypes = Object.keys(SELLERS), buyerTypes = Object.keys(BUYERS);
const WATER_G = { scav: [0, 1], worker: [1, 3], doctor: [3, 4], granny: [2, 3] };
function sellerSpec(type, forceId, offered = []) {
  const cfg = SELLERS[type];
  const pool = (type === 'thief' && S.rep.gang >= 2 ? [...cfg.pool, 'chip', 'painting', 'ticket'] : cfg.pool).filter(availableItem);
  const recent = ensureVariety().recentGoods;
  const weights = pool.map(id => 1 / (1 + recent.filter(x => x === id).length * 2 + offered.filter(x => x === id).length * 5));
  let roll = Math.random() * weights.reduce((a, b) => a + b, 0), index = 0;
  while (index < weights.length - 1 && (roll -= weights[index]) > 0) index++;
  const id = forceId || pool[index];
  const it = mkItem(id);
  const early = S.day < 3 ? 0.5 : 1;
  if (isWater(it)) {
    it.g = ri(...(WATER_G[type] || [0, 2]));
    // 肉眼看不出的水，卖家常往高了吹
    if (it.g >= 2 && it.g < 5 && Math.random() < (cfg.fake + 0.3) * early) it.lab = Math.min(5, it.g + ri(1, 2));
  } else if (!ITEMS[id].ban && Math.random() < cfg.fake * early) it.fake = true;
  if (!isWater(it) && Math.random() < cfg.stolen) { it.stolen = true; it.heat = type === 'thief' ? ri(1, 3) : ri(1, 2); }
  const v = lookValue(it), fac = CATS[type].fac;
  const repAdj = fac ? 1 - 0.03 * S.rep[fac] : 1;
  // 越烫手的赃物，卖家越急着出手
  const hot = it.stolen ? 1 - 0.1 * (it.heat - 1) : 1;
  const ask = r5(v * rnd(...cfg.ask) * hot);
  const res = r5(v * rnd(...cfg.res) * repAdj * hot);
  return { kind: 'sell', who: type, item: it, ask, ask0: ask, res: Math.min(res, ask), pat: cfg.pat || 3, checks: [null, null, null], bad: isWater(it) ? (fakeish(it) ? 2 : -1) : it.fake ? ri(0, 2) : -1 };
}
function buyerSpec(type) {
  const cfg = BUYERS[type];
  const stocked = cfg.wants.filter(w => allItems().some(it => wantMatch(w, it, w === 'drink' ? cfg.minG : undefined)));
  const want = pick(stocked.length ? stocked : cfg.wants);
  return { kind: 'buy', who: type, want, minG: want === 'drink' ? cfg.minG : undefined, rich: rnd(...cfg.rich), eye: cfg.eye, pat: 3 };
}
export const wantMatch = (want, it, minG) => (want === 'ban' ? isBan(it) : ITEMS[it.id].cat === want && !isBan(it) && (!minG || (isWater(it) && shownG(it) >= minG)));
export const wants = (c, it) => (!c.wantId || c.wantId === it.id) && wantMatch(c.want, it, c.minG);
export const winItems = () => { S.win = S.win.filter((u) => S.shelf.some((it) => it.uid === u)); return S.win.map((u) => S.shelf.find((it) => it.uid === u)); };
export function toggleWin(it) {
  if (S.win.includes(it.uid)) S.win = S.win.filter((u) => u !== it.uid);
  else if (S.win.length < 3 && S.shelf.includes(it)) S.win.push(it.uid);
  else return false;
  return true;
}
const hoarderSpec = () => ({ kind: 'buy', who: 'noble', want: 'drink', minG: 4, rich: rnd(1.5, 1.9), eye: 1, pat: 3, hoarder: true });
function waterSeller(types = activeSellers()) {
  const candidates = types.filter(t => SELLERS[t].pool.includes('water'));
  const type = pick(candidates.length ? candidates : ['scav', 'worker', 'granny', 'doctor']);
  return sellerSpec(type, 'water');
}

function chooseVisitor(types, used, weight = () => 1) {
  const unique = types.filter(t => !used.has(t));
  let pool = unique.length ? unique : types;
  const fresh = pool.filter(t => !ensureVariety().recentVisitors.slice(-5).includes(t));
  if (fresh.length) pool = fresh;
  const weights = pool.map(weight);
  let roll = Math.random() * weights.reduce((a, b) => a + b, 0), index = 0;
  while (index < pool.length - 1 && (roll -= weights[index]) > 0) index++;
  const type = pool[index]; used.add(type); return type;
}
const buyerCanUse = (type, it) => BUYERS[type].wants.some(w => wantMatch(w, it, w === 'drink' ? BUYERS[type].minG : undefined));
function ordinaryBuyer(types, used, target) {
  const have = allItems();
  const matched = types.filter(t => target ? buyerCanUse(t, target) : have.some(it => buyerCanUse(t, it)));
  const freshMatch = matched.filter(t => !used.has(t));
  const candidates = target ? (matched.length ? matched : types) : freshMatch.length ? freshMatch : types.some(t => !used.has(t)) ? types : matched.length ? matched : types;
  const type = chooseVisitor(candidates, used), c = buyerSpec(type);
  if (target && buyerCanUse(type, target)) {
    c.want = isBan(target) ? 'ban' : ITEMS[target.id].cat;
    c.minG = c.want === 'drink' ? BUYERS[type].minG : undefined;
  }
  return c;
}

// Correct dead-end queues by replacing ordinary slots, never the booked visitor or extra traffic.
function keepTradeOpportunities(q, buyers, sellers) {
  const ordinary = c => !c.visitId && !c.hoarder && !c.collector && !c.iceFan && ['sell', 'buy'].includes(c.kind);
  const stock = allItems(), hot = [...stock].sort((a, b) => mult(b.id) - mult(a.id))[0];
  const matched = q.some(c => c.kind === 'buy' && stock.some(it => wants(c, it)));
  const hotMatched = hot && q.some(c => c.kind === 'buy' && wants(c, hot));
  if (stock.length && (!matched || (mult(hot.id) >= 1.15 && !hotMatched))) {
    const index = q.findLastIndex(ordinary), used = new Set(q.filter((_, i) => i !== index).map(c => c.who));
    if (index >= 0) q[index] = ordinaryBuyer(buyers, used, hot);
  }
  if (!stock.length && S.money >= 1 && !q.some(c => c.kind === 'sell' && !fakeish(c.item) && !c.item.stolen && c.ask <= S.money)) {
    const candidates = sellers.flatMap(who => SELLERS[who].pool.filter(id => availableItem(id) && !ITEMS[id].ban).map(id => ({ who, id, value: id === 'water' ? 3 : ITEMS[id].v })));
    candidates.sort((a, b) => a.value - b.value);
    const index = q.findIndex(ordinary), best = candidates[0];
    if (best && index >= 0) {
      const c = sellerSpec(best.who, best.id);
      Object.assign(c.item, { fake: false, stolen: false, q: 1, ...(best.id === 'water' ? { g: 0, lab: null } : {}) });
      c.bad = -1; c.ask = c.ask0 = Math.min(S.money, r5(lookValue(c.item) * 1.1)); c.res = Math.min(c.ask, r5(lookValue(c.item) * .7));
      q[index] = c;
    }
  }
}

function genQueue() {
  if (S.day === 1 && !S.tutorial) return tutorialQueue();
  const n = 6 + (S.up.lucky ? 1 : 0);
  const sign = SIGNS[S.sign] || SIGNS.warm;
  const win = winItems();
  const sellers = activeSellers(), buyers = activeBuyers(), used = new Set(), offered = [];
  const q = [];
  for (let i = 0; i < n; i++) {
    if (Math.random() < sign.sell) {
      const waterTypes = sign.water && Math.random() < 0.5 ? sellers.filter(t => !used.has(t) && SELLERS[t].pool.includes('water')) : [];
      const type = chooseVisitor(waterTypes.length ? waterTypes : sellers, used, t => t === 'thief' ? 1 + (sign.thief || 0) : 1);
      const c = sellerSpec(type, waterTypes.length ? 'water' : undefined, offered);
      offered.push(c.item.id); q.push(c);
    } else if (win.length && Math.random() < 0.22 * win.length) {
      // 橱窗：照着摆出来的货引来买家
      q.push(ordinaryBuyer(buyers, used, pick(win)));
    } else q.push(ordinaryBuyer(buyers, used));
  }
  q[Math.min(2, q.length - 1)] = featuredSpec(visitToday());
  // 橱窗里摆着好水 → 屯水的夫人；摆着珍宝 → 收藏家
  const goodWater = win.filter((it) => isWater(it) && shownG(it) >= 4).length;
  if (goodWater >= 2) q.splice(ri(1, q.length), 0, hoarderSpec());
  if (goodWater >= 3 && Math.random() < 0.5) q.splice(ri(1, q.length), 0, hoarderSpec());
  if (win.filter((it) => ITEMS[it.id].cat === 'treasure').length >= 2) { const b = buyerSpec('noble'); b.want = 'treasure'; b.minG = undefined; b.rich += 0.3; b.collector = true; q.splice(ri(1, q.length), 0, b); }
  // 昨天喝过冰水的客人带着钱回来
  for (let i = 0; i < Math.min(2, S.ice); i++) { const b = buyerSpec(pick(['worker', 'granny'])); b.want = 'drink'; b.minG = undefined; b.rich *= 1.45; b.iceFan = true; q.splice(ri(0, q.length), 0, b); }
  S.ice = 0;
  // 伪猫：混进普通客人里
  if (S.day >= 4 && Math.random() < 0.3) {
    const cand = q.filter((c) => !c.visitId && ((c.kind === 'buy' && !c.hoarder) || (c.kind === 'sell' && !isBan(c.item) && !c.item.stolen)));
    if (cand.length) {
      const c = pick(cand);
      Object.assign(c, { robo: true, roboBad: ri(0, 2), obs: [null, null, null] });
      if (c.kind === 'sell') { if (isWater(c.item)) { c.item.g = Math.min(c.item.g, 2); c.item.lab = 4; c.bad = 2; } else { c.item.fake = true; c.bad = ri(0, 2); } }
    }
  }
  keepTradeOpportunities(q, buyers, sellers);
  // 特殊客人
  if (S.day >= 2 && Math.random() < 0.35 && S.orders.length < 2) q.splice(ri(0, q.length), 0, robotSpec());
  if (S.day >= 3 && Math.random() < 0.18 && !rentToday()) q.splice(ri(1, q.length), 0, { kind: 'fence', who: 'rival' });
  const heat = S.shelf.reduce((a, it) => a + (it.stolen ? it.heat || 1 : 0) + (isBan(it) ? 1 : 0), 0);
  const pol = (0.12 + 0.035 * heat - 0.025 * S.rep.law + (sign.police || 0)) * (newsObj().police || 1);
  if (S.day >= 3 && Math.random() < pol) q.splice(ri(1, q.length), 0, { kind: 'police', who: 'police' });
  const ladyDays = [3, 9, 16];
  if (S.story.lady < 3 && S.day === ladyDays[S.story.lady]) q.splice(1, 0, ladySpec());
  if (ensureGrowth().appraisalDisplay && S.up.appraisal_certificate) q.push(appraisalSpec());
  if (S.up.premium_window && S.rep.elite >= 2 && win.some(it => ITEMS[it.id].cat === 'treasure')) { const b=buyerSpec('noble'); b.want='treasure'; b.minG=undefined; b.rich=2; b.premium=true; q.push(b); }
  const variety = ensureVariety();
  variety.recentVisitors = [...variety.recentVisitors, ...q.filter(c => !c.visitId && ['sell', 'buy'].includes(c.kind)).map(c => c.who)].slice(-12);
  variety.recentGoods = [...variety.recentGoods, ...q.filter(c => c.kind === 'sell').map(c => c.item.id)].slice(-10);
  return q;
}
function tutorialQueue() {
  const a = sellerSpec('granny', 'yarn'); a.item.q = 1; a.ask = a.ask0 = 30; a.res = 14; a.tut = 'haggle';
  const b = buyerSpec('kitten'); b.want = 'toy'; b.rich = 1.15; b.tut = 'sell';
  const c = sellerSpec('trader', 'tuna'); c.item.fake = true; c.item.stolen = false; c.bad = 1; c.ask = c.ask0 = 70; c.res = 42; c.tut = 'check';
  const d = buyerSpec('worker'); d.want = 'food';
  const e = sellerSpec('scav', 'radio'); e.item.fake = false;
  const f = buyerSpec('granny'); f.want = 'material';
  return [a, b, c, d, e, f];
}
function robotSpec() {
  const id = pick(['ingot', 'water', 'water', 'fish', 'can', 'battery', 'stick', 'yarn']);
  const qty = ITEMS[id].v > 30 ? ri(1, 2) : ri(2, 3);
  return { kind: 'order', who: 'robot', order: { id, qty, due: S.day + ri(2, 4), reward: r5(ITEMS[id].v * qty * rnd(1.6, 2)) } };
}
// 订单收的水要白开水以上（机器人会检测）
const orderOk = (o, it) => it.id === o.id && !it.fake && (!isWater(it) || grade(it) >= 3);
export const orderName = (o) => (o.id === 'water' ? '白开水以上的水' : ITEMS[o.id].name);
function ladySpec() {
  const step = S.story.lady;
  if (step === 0) { const s = sellerSpec('gent', 'pearl'); Object.assign(s, { who: 'lady', story: 0, ask: 170, ask0: 170, res: 125, pat: 3 }); s.item.fake = false; s.item.stolen = false; s.bad = -1; s.item.q = 1; return s; }
  if (step === 1) { const s = sellerSpec('gent', 'watch'); Object.assign(s, { who: 'lady', story: 1, ask: 140, ask0: 140, res: 100, pat: 3 }); s.item.fake = false; s.item.stolen = false; s.bad = -1; return s; }
  return { kind: 'lady', who: 'lady', story: 2 };
}

export function startDay() {
  const variety = ensureVariety();
  if (variety.dayStarted === S.day) return S.queue;
  contentTier();
  growthStatus();
  S.phase = 'day';
  S.queue = genQueue();
  S.qi = 0;
  S.rentDone = false;
  variety.dayStarted = S.day;
  return S.queue;
}
export const current = () => S.queue[S.qi];

// Clues are derived from existing v2 fields: no rerolls, new save fields or RNG consumption.
function clueKey(c) {
  let hash = 2166136261;
  const itemKey = c.kind === 'sell' ? c.item?.uid ?? '' : '';
  for (const ch of `${c.kind}|${c.who}|${itemKey}|${S.day}|${S.qi}`) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  return hash;
}
const ITEM_DETAILS = {
  food: ['包装封口有些皱褶', '气味有些难分辨', '日期印字有些浅'],
  drink: ['颜色看着不太均匀', '气味有些难分辨', '成分需要试纸核实'],
  material: ['纹理有一处不均', '拿在手里有点坠手', '断口处有些磨痕'],
  tech: ['铭牌有些磨损', '接线处有些旧', '外壳上有一道浅痕'],
  treasure: ['印记边缘有些浅', '材质光泽不太均匀', '做工细节值得看看'],
  toy: ['缝线有些不整齐', '材质手感有点特别', '标签字迹有些浅'],
};
export function itemClue(c) {
  if (!c || c.kind !== 'sell' || !c.item || !ITEMS[c.item.id]) return null;
  if (isWater(c.item)) return { index: 2, text: '试纸能确认水质' };
  const index = c.item.fake && Number.isInteger(c.bad) && c.bad >= 0 && c.bad < 3 ? c.bad : c.item.stolen ? 0 : clueKey(c) % 3;
  return { index, text: (ITEM_DETAILS[ITEMS[c.item.id].cat] || ITEM_DETAILS.tech)[index] };
}
export function observationClue(c) {
  if (!c || !['sell', 'buy'].includes(c.kind) || S.day < 4 || c.tut || c.who === 'lady') return null;
  const key = clueKey(c);
  if (!c.robo && key % 4 !== 0) return null;
  const index = c.robo && Number.isInteger(c.roboBad) && c.roboBad >= 0 && c.roboBad < 3 ? c.roboBad : (key >>> 2) % 3;
  return { index, text: ['眨眼节奏有点奇怪', '胡须看着有些僵', '呼噜声忽然停了一下'][index] };
}

// ───── 收货 ─────
// 返回 {r:'deal'|'counter'|'leave', price, angry}
export function offerToSeller(c, p) {
  if (p >= c.ask || p >= c.res) return { r: 'deal', price: Math.min(p, c.ask) };
  const angry = p < c.res * 0.5, near = p >= c.res * 0.85;
  c.pat -= angry ? 2 : 1;
  if (c.pat <= 0) { c.negotiation = { price: p, counter: c.ask, near, angry }; return { r: 'leave', angry, near }; }
  c.ask = Math.max(c.res, r5(c.ask - (c.ask - p) * rnd(0.3, 0.45)));
  c.negotiation = { price: p, counter: c.ask, near, angry };
  return { r: 'counter', price: c.ask, angry, near };
}
export function checkSpot(c, i) {
  if (c.checks[i]) return { res: c.checks[i], free: true };
  const free = S.up.lens && !c.lensUsed;
  if (free) c.lensUsed = true; else c.pat -= 1;
  let res = 'ok';
  if (fakeish(c.item) && i === c.bad) res = 'fake';
  else if (c.item.stolen && c.who !== 'thief' && i === 0) res = 'stolen';
  c.checks[i] = res;
  if (isWater(c.item) && i === 2) c.item.gk = true;
  if (res === 'fake') {
    c.exposed = true;
    S.st.fakeSpot++;
    if (isWater(c.item)) { c.claimed = c.item.lab; c.item.lab = null; c.item.est = null; }
    // 被拆穿的卖家改按实价出货
    const fv = trueValue(c.item);
    c.ask = r5(fv * 1.3); c.res = r5(fv * 0.8);
  }
  return { res, free, left: c.pat };
}
export function buyItem(c, price) {
  ensureVariety();
  if (!c?.item || c.settled || !Number.isFinite(price) || price < 0 || price > S.money || S.shelf.length >= S.shelfCap || allItems().some(it => it.uid === c.item.uid)) return false;
  S.money -= price;
  c.item.cost = price;
  if (c.exposed) c.item.known = true;
  S.shelf.push(c.item);
  S.st.buy++;
  c.settled = true;
  if (c.who === 'lady' && c.story === 0) S.story.pearl = c.item.uid;
  return true;
}

// ───── 卖货 ─────
export function buyerLooks(c, it) {
  if (c.settled || !allItems().some(x => x.uid === it?.uid) || !wants(c, it)) return null;
  const v = lookValue(it), fac = CATS[c.who].fac;
  const repAdj = fac ? 1 + 0.03 * S.rep[fac] : 1;
  c.item = it;
  delete c.negotiation;
  c.max = r5(v * c.rich * repAdj);
  c.bid = r5(v * rnd(0.6, 0.78));
  c.bid0 = c.bid;
  c.caught = fakeish(it) && Math.random() < c.eye;
  return c;
}
export function askBuyer(c, p) {
  if (p <= c.max) return { r: 'deal', price: p };
  const angry = p > c.max * 1.6, near = p <= c.max * 1.15;
  c.pat -= angry ? 2 : 1;
  if (c.pat <= 0) { c.negotiation = { price: p, counter: c.bid, near, angry }; return { r: 'leave', angry, near }; }
  c.bid = Math.min(c.max, r5(c.bid + (p - c.bid) * rnd(0.3, 0.45)));
  c.negotiation = { price: p, counter: c.bid, near, angry };
  return { r: 'counter', price: c.bid, angry, near };
}
export function sellItem(c, price) {
  ensureVariety();
  if (!c?.item || c.settled || c.caught || !Number.isFinite(price) || price < 0 || !allItems().some(it => it.uid === c.item.uid) || (c.want && !wants(c, c.item))) return false;
  removeItem(c.item);
  S.money += price;
  S.st.sell++;
  if (fakeish(c.item)) S.st.fakeSold++;
  if (c.iced) S.ice++;
  if (c.robo) S.fakeCash += price;
  const fac = CATS[c.who].fac;
  if (fac && price <= lookValue(c.item) * 1.05) addRep(fac, 1);
  c.settled = true;
  return true;
}
export function removeItem(it) {
  S.shelf = S.shelf.filter((x) => x.uid !== it.uid);
  S.hidden = S.hidden.filter((x) => x.uid !== it.uid);
  S.win = S.win.filter((u) => u !== it.uid);
}
export const addRep = (f, d) => { S.rep[f] = clamp(S.rep[f] + d, -5, 5); };
// 刷脸：花 2 点好感让对方让步
export function charm(c) {
  const fac = CATS[c.who].fac;
  if (!fac || S.rep[fac] < 2 || c.charmed) return false;
  addRep(fac, -2); c.charmed = true;
  if (c.kind === 'sell') { c.res = r5(c.res * 0.82); c.ask = Math.max(c.res, r5(c.ask * 0.88)); }
  else { c.max = r5(c.max * 1.18); c.bid = Math.min(c.max, r5(c.bid * 1.15)); }
  return true;
}

// ───── 三花姐 / 警长 / 机器人 ─────
// 三花姐不验水：贴了标签的水按标签价收
export const fencePrice = (it) => r5((isWater(it) ? lookValue(it) : trueValue(it)) * (it.fake ? 0.5 : 0.62));
export function fenceSell(list) {
  let sum = 0;
  for (const it of list) { sum += fencePrice(it); if (isWater(it) && fakeish(it)) S.st.scamRival = 1; removeItem(it); }
  S.money += sum;
  return sum;
}
export function inspect() {
  const found = S.shelf.filter((it) => it.stolen || isBan(it));
  const value = found.reduce((a, it) => a + lookValue(it), 0);
  const fine = found.reduce((a, it) => a + 25 + (it.stolen ? 15 * (it.heat || 1) : 15), 0);
  return { found, fine, bribe: r5(30 + value * 0.3) };
}
export function acceptFine(res) {
  res.found.forEach(removeItem);
  S.money -= res.fine;
}
export function tryBribe(res) {
  const ok = Math.random() < clamp(0.75 + 0.05 * S.rep.law, 0.35, 0.95);
  if (ok) { S.money -= res.bribe; addRep('law', -1); return true; }
  res.found.forEach(removeItem);
  S.money -= res.fine * 2; addRep('law', -2);
  return false;
}
export function acceptOrder(o) {
  ensureVariety();
  const c = S.queue.find(c => c.kind === 'order' && c.order === o);
  const key = x => x.visitId ? `${x.visitDay}:${x.visitId}` : `${x.id}:${x.qty}:${x.due}:${x.reward}`;
  if (!o || !ITEMS[o.id] || !Number.isSafeInteger(o.qty) || o.qty < 1 || !Number.isSafeInteger(o.due) || o.due < S.day || !Number.isFinite(o.reward) || o.reward < 0 || o.accepted || c?.settled || S.orders.length >= 3 || S.orders.some(x => key(x) === key(o))) return false;
  o.accepted = true;
  if (c) c.settled = true;
  S.orders.push(o);
  return true;
}
const knownWaterGrade = (it) => isWater(it) && (it.gk || WG[grade(it)]?.eye) ? grade(it) : null;
function publicInput(it) {
  return { uid: it.uid, id: it.id, name: itemName(it), qty: 1, knownGrade: knownWaterGrade(it), shownGrade: isWater(it) ? shownG(it) : null,
    cost: it.cost || 0, fakeKnown: !!(it.fake && it.known) };
}
const validUids = (uids) => Array.isArray(uids) && uids.every(Number.isSafeInteger) && new Set(uids).size === uids.length;
const orderCandidate = (o, it) => it.id === o.id && !(it.fake && it.known) && (!isWater(it) || knownWaterGrade(it) === null || knownWaterGrade(it) >= 3);
export function orderPlan(o, uids) {
  const candidates = o && ITEMS[o.id] ? allItems().filter(it => orderCandidate(o, it)) : [];
  const plan = { ok: false, reason: null, eligibleUids: candidates.map(it => it.uid), inputUids: [], inputs: [], qty: o?.qty || 0, have: candidates.length };
  const fail = (reason) => ({ ...plan, reason });
  if (!o || !ITEMS[o.id] || !Number.isSafeInteger(o.qty) || o.qty < 1 || !Number.isFinite(o.reward) || o.reward < 0) return fail('订单无效');
  if (!S.orders.includes(o)) return fail('订单尚未接取');
  if (!Number.isFinite(o.due) || S.day > o.due) return fail('订单已过期');
  let take;
  if (uids !== undefined) {
    if (!validUids(uids)) return fail('选择重复或无效');
    take = uids.map(uid => allItems().find(it => it.uid === uid));
    if (take.some(it => !it)) return fail('所选货物已不在库存');
  } else {
    // Known, low-grade qualifying water comes first. Unknown labels are not evidence of quality.
    take = [...candidates].sort((a, b) => {
      if (!isWater(a)) return 0;
      return (knownWaterGrade(a) ?? 99) - (knownWaterGrade(b) ?? 99);
    }).slice(0, o.qty);
  }
  plan.inputUids = take.map(it => it.uid); plan.inputs = take.map(publicInput);
  if (take.length !== o.qty) return fail(take.length < o.qty ? `还缺 ${o.qty - take.length} 份货物` : `请选择 ${o.qty} 份货物`);
  // Planning uses public eligibility only. Unknown merchandise is verified at delivery.
  if (take.some(it => !orderCandidate(o, it))) return fail('所选货物不符合订单要求');
  return { ...plan, ok: true };
}
// Also usable for a visitor's not-yet-accepted offer; actual delivery is stricter.
export function canDeliver(o) { return !!(o && ITEMS[o.id] && Number.isSafeInteger(o.qty) && o.qty > 0 && S.day <= o.due && allItems().filter(it => orderOk(o, it)).length >= o.qty); }
export function deliver(o, uids) {
  if (S.variety !== undefined) validateVariety(S.variety);
  const plan = orderPlan(o, uids);
  if (!plan.ok) return false;
  const take = plan.inputUids.map(uid => allItems().find(it => it.uid === uid));
  if (take.some(it => !it || !orderOk(o, it))) return false;
  take.forEach(removeItem);
  S.money += o.reward;
  S.orders = S.orders.filter((x) => x !== o);
  S.st.orders++;
  const fac = o.who && CATS[o.who]?.fac;
  if (fac) addRep(fac, 1);
  return true;
}
export function expireOrders() {
  const gone = S.orders.filter((o) => S.day > o.due);
  S.orders = S.orders.filter((o) => S.day <= o.due);
  return gone;
}

// ───── 夜晚 ─────
export function startNight() {
  ensureVariety();
  nextVisit();
  if (S.phase === 'night') return S.night;
  if (!S.nextNews || S.nextNews === S.news) S.nextNews = pick(marketChoices(S.news)).id;
  S.phase = 'night';
  const ids = CRATES.map((c) => c.id).sort(() => Math.random() - 0.5).slice(0, 3);
  S.night = { crates: ids, opened: [], extra: false, peek: false, free: 1 };
  return S.night;
}
export function openCrate(idx) {
  const no = () => ({ id: null, got: [], lost: [], rare: false });
  const night = S?.night;
  if (S?.phase !== 'night' || !Number.isSafeInteger(idx) || idx < 0 || !Array.isArray(night?.crates) || idx >= night.crates.length ||
    !Array.isArray(night.opened) || !Number.isSafeInteger(night.free) || night.free < 1 || night.free > night.crates.length ||
    night.opened.length >= night.free || night.opened.includes(idx) || Object.hasOwn(night.results || {}, idx)) return no();
  validateNightGround(S);
  const cr = CRATES.find((c) => c.id === night.crates[idx]);
  if (!cr) return no();
  const pool = cr.pool.filter(([id]) => availableItem(id));
  if (!pool.length) return no();
  let [id, n] = pick(pool);
  const common = pool.filter(([id]) => !cr.rare?.includes(id));
  if (cr.rare?.includes(id) && common.length && Math.random() < 0.55) [id, n] = pick(common);
  const got = [], lost = [];
  for (let i = 0; i < n; i++) {
    const it = mkItem(id, id === 'water' ? { g: cr.id === 'wet' ? ri(0, 2) : 0, gk: true } : {});
    if (S.shelf.length < S.shelfCap) { S.shelf.push(it); got.push(it); } else lost.push(it);
  }
  // Preserve generated instances, including quality and water grade. Reopening or
  // collecting never rolls a replacement item or consumes another UID.
  night.ground ||= { v: 1, day: S.day, items: [] };
  night.ground.items.push(...lost);
  night.opened.push(idx);
  night.results ||= {};
  night.results[idx] = { id, n, lost: lost.length };
  return { id, got, lost, rare: !!(cr.rare && cr.rare.includes(id)) };
}

// Ground belongs to one evening. Old v2 saves have no extension; unsupported
// records must be rejected before a caller changes inventory or overwrites them.
export function validateNightGround(run) {
  const ground = run?.night?.ground;
  if (ground === undefined) return true;
  const obj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const nat = x => Number.isSafeInteger(x) && x >= 0;
  const fail = () => { throw Error('拾荒地面记录损坏或版本不支持'); };
  if (!obj(ground) || Object.keys(ground).length !== 3 || !['v', 'day', 'items'].every(k => Object.hasOwn(ground, k)) || ground.v !== 1 || run.v !== 2 ||
    run.phase !== 'night' || !nat(ground.day) || ground.day < 1 || ground.day !== run.day || !Array.isArray(ground.items) ||
    !Array.isArray(run.shelf) || !Array.isArray(run.hidden) || !nat(run.uid)) fail();
  const ids = new Set([...run.shelf, ...run.hidden].map(it => it?.uid));
  for (const it of ground.items) {
    if (!obj(it) || !Object.hasOwn(ITEMS, it.id) || !nat(it.uid) || it.uid >= run.uid || ids.has(it.uid) ||
      !Number.isFinite(it.q) || it.q <= 0 || !Number.isFinite(it.cost) || it.cost < 0 || typeof it.fake !== 'boolean' || typeof it.stolen !== 'boolean' ||
      (it.g !== undefined && (!nat(it.g) || !WG[it.g])) || (it.lab != null && (!nat(it.lab) || !WG[it.lab])) ||
      ['gk', 'known', 'stolenKnown', 'cooled'].some(k => it[k] !== undefined && typeof it[k] !== 'boolean') ||
      (it.heat !== undefined && (!nat(it.heat)))) fail();
    ids.add(it.uid);
  }
  return true;
}

export function nightGround() {
  validateNightGround(S);
  return S?.night?.ground?.items.slice() || [];
}

// Called only at completed UI transactions, never from removeItem: production
// and modifications must finish consuming their selected inputs before refill.
export function collectNightGround() {
  const items = nightGround();
  const count = Math.min(items.length, Math.max(0, S.shelfCap - S.shelf.length));
  if (!count) return [];
  const got = items.slice(0, count);
  S.night.ground.items = items.slice(count);
  S.shelf.push(...got);
  return got;
}

export function swapNightGround(groundUid, shelfUid) {
  const items = nightGround();
  const gi = items.findIndex(it => it.uid === groundUid), si = S.shelf.findIndex(it => it.uid === shelfUid);
  if (gi < 0 || si < 0) return { ok: false, reason: '物品已不在地面或货架' };
  const taken = items[gi], left = S.shelf[si];
  S.shelf[si] = taken;
  S.night.ground.items = [...items.slice(0, gi), ...items.slice(gi + 1), left];
  S.win = S.win.filter(uid => uid !== left.uid);
  return { ok: true, taken, left };
}
// 净水器：每份 +2 档，上限山泉水（有紫外线灯到纯净水）；脏水耗滤芯 3 点
export const pureMax = () => (S.up.uv ? 5 : 4);
const filterCost = (it) => (grade(it) <= 1 ? 3 : 1);
function pureQueue() {
  const list = S.shelf.filter((it) => isWater(it) && grade(it) < pureMax()).sort((a, b) => grade(b) - grade(a));
  const take = []; let f = S.filter;
  for (const it of list) { if (take.length >= machineSpec('purifier').cap) break; if (filterCost(it) <= f) { take.push(it); f -= filterCost(it); } }
  return take;
}
// 酿酒要白开水或山泉水：山泉水酿得更香，纯净水太干净发不了酵
const brewWater = () => S.shelf.filter((it) => isWater(it) && grade(it) >= 3 && grade(it) <= 4).sort((a, b) => grade(b) - grade(a));
export function machineInputs(mid) {
  const m = machineSpec(mid);
  if (!m) return 0;
  if (mid === 'purifier') return pureQueue().length;
  const have = S.shelf.filter((it) => it.id === m.in[0] && !it.fake).length;
  let n = Math.min(m.cap, Math.floor(have / m.in[1]));
  if (m.water) n = Math.min(n, brewWater().length);
  return n;
}
function resolveProduction(mid, selection, execute = false) {
  const m = machineSpec(mid);
  const publicCandidates = m ? S.shelf.filter(it => mid === 'purifier' ? isWater(it) && (knownWaterGrade(it) === null || knownWaterGrade(it) < pureMax())
    : (it.id === m.in[0] && !(it.fake && it.known)) || (m.water && isWater(it) && (knownWaterGrade(it) === null || (knownWaterGrade(it) >= 3 && knownWaterGrade(it) <= 4)))) : [];
  const plan = { ok: false, reason: null, inputUids: [], inputs: [], outputs: [], outputCount: 0, days: m?.days || 0,
    filterCost: 0, filterAfter: S.filter, batches: 0, eligibleUids: publicCandidates.map(it => it.uid) };
  const fail = reason => ({ plan: { ...plan, reason }, take: [] });
  if (!m) return fail('机器不存在');
  if (!S.owned?.[mid]) return fail('尚未购买机器');
  if (S.machines[mid]) return fail(S.machines[mid].ready ? '成品尚未入库' : '机器正在加工');
  let take, batches;
  if (selection !== undefined) {
    if (!selection || !validUids(selection.uids)) return fail('选择重复或无效');
    take = selection.uids.map(uid => S.shelf.find(it => it.uid === uid));
    if (take.some(it => !it)) return fail('所选原料已不在货架');
  } else if (mid === 'purifier') {
    if (execute) take = pureQueue();
    else {
      let availableFilter = S.filter;
      take = [];
      for (const it of [...publicCandidates].sort((a, b) => (knownWaterGrade(b) ?? -1) - (knownWaterGrade(a) ?? -1))) {
        const cost = knownWaterGrade(it) !== null && knownWaterGrade(it) <= 1 ? 3 : 1;
        if (take.length < m.cap && cost <= availableFilter) { take.push(it); availableFilter -= cost; }
      }
    }
  }
  else {
    const materials = S.shelf.filter(it => it.id === m.in[0] && !(it.fake && (execute || it.known)));
    const waters = m.water ? (execute ? brewWater() : publicCandidates.filter(isWater).sort((a, b) => (knownWaterGrade(b) ?? -1) - (knownWaterGrade(a) ?? -1))) : [];
    batches = Math.min(m.cap, Math.floor(materials.length / m.in[1]), m.water ? waters.length : Infinity);
    take = materials.slice(0, batches * m.in[1]);
    if (m.water) take.push(...waters.slice(0, batches));
  }
  plan.inputUids = take.map(it => it.uid); plan.inputs = take.map(publicInput);
  if (!take.length) {
    if (mid === 'purifier') return fail(publicCandidates.length ? '滤芯不足' : '缺待净化的原水');
    if (m.water && publicCandidates.filter(it => it.id === m.in[0]).length >= m.in[1]) return fail('缺白开水或山泉水');
    return fail(`缺${ITEMS[m.in[0]].name}，每批需 ${m.in[1]} 份`);
  }
  if (mid === 'purifier') {
    if (take.length > m.cap) return fail(`每批最多 ${m.cap} 份`);
    if (take.some(it => !isWater(it) || (execute ? grade(it) >= pureMax() : knownWaterGrade(it) !== null && knownWaterGrade(it) >= pureMax()))) return fail('所选原水不符合净化要求');
    batches = take.length; plan.filterCost = take.reduce((sum, it) => sum + (execute ? filterCost(it) : knownWaterGrade(it) !== null && knownWaterGrade(it) <= 1 ? 3 : 1), 0); plan.filterAfter = S.filter - plan.filterCost;
    if (plan.filterAfter < 0) return fail('滤芯不足');
    plan.outputs = take.map(it => {
      const before = knownWaterGrade(it), after = before === null ? null : Math.min(pureMax(), before + 2);
      return { id: 'water', name: after === null ? '净化后的水（档位待验）' : WG[after].n, qty: 1, knownGrade: after, shownGrade: after, fakeKnown: false };
    });
  } else {
    const material = take.filter(it => it.id === m.in[0]), waters = m.water ? take.filter(it => isWater(it)) : [];
    if (take.length !== material.length + waters.length || material.some(it => it.fake && (execute || it.known))) return fail('所选原料不符合配方');
    if (!material.length || material.length % m.in[1]) return fail(`原料需按 ${m.in[1]} 份成批选择`);
    batches = material.length / m.in[1];
    if (batches > m.cap) return fail(`每批最多 ${m.cap} 批次`);
    if (m.water && (waters.length !== batches || waters.some(it => execute ? grade(it) < 3 || grade(it) > 4 : knownWaterGrade(it) !== null && (knownWaterGrade(it) < 3 || knownWaterGrade(it) > 4)))) return fail('每批需一份白开水或山泉水');
    plan.outputs = [{ id: m.out[0], name: ITEMS[m.out[0]].name, qty: batches * m.out[1], knownGrade: null, shownGrade: null, fakeKnown: m.out[2] === 'fake' }];
  }
  plan.batches = batches; plan.outputCount = batches * m.out[1]; plan.ok = true;
  return { plan, take };
}
export function productionPlan(mid, selection) { return resolveProduction(mid, selection).plan; }
export function runMachine(mid, selection) {
  const { plan, take } = resolveProduction(mid, selection, true);
  if (!plan.ok) return 0;
  const m = machineSpec(mid), batches = plan.batches;
  if (mid === 'purifier') {
    const items = take.map((it) => { S.filter -= filterCost(it); removeItem(it); return { g: Math.min(pureMax(), grade(it) + 2), gk: true }; });
    S.machines[mid] = { left: m.days, n: items.length, items };
    return batches;
  }
  const materials = take.filter(it => it.id === m.in[0]), waters = m.water ? take.filter(isWater) : [];
  materials.forEach(removeItem);
  let items;
  if (m.water) items = waters.map((w) => { removeItem(w); return { q: grade(w) === 4 ? rnd(1.3, 1.45) : rnd(0.95, 1.1) }; });
  S.machines[mid] = { left: m.days, n: batches * m.out[1], items };
  return batches;
}
// 睡觉：机器推进一晚、换日
export function sleep() {
  ensureVariety();
  validateNightGround(S);
  if (!S.nextNews) S.nextNews = pick(marketChoices(S.news)).id;
  const out = [];
  for (const [mid, job] of Object.entries(S.machines)) {
    if (!job) continue;
    if (job.left > 0) job.left--;
    if (job.left <= 0 && !job.ready) job.ready = true;
  }
  collectMachines(out);
  if (S.up.dew && S.shelf.length < S.shelfCap) { const w = mkItem('water', { g: 2, gk: true }); S.shelf.push(w); out.push(w); }
  // Morning production keeps its established priority. Any remaining space can
  // take last night's ground, and the rest expires before the next day begins.
  out.push(...collectNightGround());
  if (S.night) delete S.night.ground;
  // 赃物热度每晚降一点，降到零就不算赃物了
  for (const it of allItems()) {
    if (!it.stolen) continue;
    it.heat = (it.heat || 1) - 1;
    if (it.heat <= 0) { it.stolen = false; it.heat = 0; it.cooled = true; S.st.cooled++; }
  }
  S.day++;
  S.news = S.nextNews;
  S.nextNews = pick(marketChoices(S.news)).id;
  rollMarket();
  return out;
}
// 机器产出放进货架，放不下的留在机器里等明晚
export function collectMachines(out = []) {
  for (const [mid, job] of Object.entries(S.machines)) {
    if (!job || !job.ready) continue;
    const m = machineSpec(mid);
    while (job.n > 0 && S.shelf.length < S.shelfCap) {
      const it = mkItem(m.out[0], { fake: m.out[2] === 'fake', ...(job.items ? job.items.shift() : {}) });
      S.shelf.push(it); out.push(it); job.n--;
      if (mid === 'furnace') S.st.ingots++;
      if (mid === 'purifier') { S.st.waters++; if (grade(it) >= 5) S.st.pure = 1; }
    }
    if (job.n <= 0) S.machines[mid] = null;
  }
  return out;
}
export function buyUpgrade(u) {
  u = UPGRADES.find(x => x.id === (typeof u === 'string' ? u : u?.id));
  if (!u || !upgradeAvailable(u.id).ok) return false;
  S.money -= u.cost;
  if (u.id === 'lawfee') { addRep('law', 2); return true; }
  if (u.id === 'gangfee') { addRep('gang', 2); return true; }
  if (u.id === 'filter') { S.filter += 10; return true; }
  S.up[u.id] = true;
  if (u.id === 'shelf1' || u.id === 'shelf2') S.shelfCap += 3;
  if (u.id === 'hide1' || u.id === 'hide2') S.hiddenCap += 2;
  if (u.machine) { S.owned[u.id] = true; S.machines[u.id] = null; }
  if (u.id === 'purifier' || u.id === 'filter') S.filter += 10;
  return true;
}
export const allUpgrades = () => UPGRADES.filter((u) => !u.repeat).every((u) => S.up[u.id]);
export const canBuyout = () => S.money >= BUYOUT;

export function payRent() {
  if (!rentToday() || S.rentDone || S.phase === 'night') return false;
  const amt = rentAmount();
  if (S.money < amt) return false;
  S.money -= amt; S.rentDue = 0; S.rentPaid++; S.rentDone = true;
  return true;
}
export function waiveRent() {
  if (!rentToday() || S.rentDone || S.phase === 'night' || S.graceUsed) return false;
  // Clear the whole current bill; waived rent is not a cash-payment achievement.
  S.rentDue = 0; S.graceUsed = true; S.rentDone = true;
  return true;
}

export function moveItem(it) {
  if (S.hidden.includes(it)) {
    if (S.shelf.length >= S.shelfCap) return false;
    S.hidden = S.hidden.filter((x) => x !== it); S.shelf.push(it); return true;
  }
  if (S.hidden.length >= S.hiddenCap) return false;
  S.shelf = S.shelf.filter((x) => x !== it); S.hidden.push(it); return true;
}
export const trackPeak = () => { S.st.peakWorth = Math.max(S.st.peakWorth, netWorth()); };

// ───── 水：贴标 ─────
export const canLabel = (it) => S.owned.labeler && isWater(it) && grade(it) >= 2 && it.lab == null;
export function labelWater(it) {
  if (!canLabel(it) || S.money < 2) return false;
  S.money -= 2; it.lab = 5; it.est = null;
  return true;
}
export function unlabel(it) { it.lab = null; it.est = null; }

// ───── 伪猫 ─────
export function observe(c, i) {
  if (c.obs[i]) return { free: true };
  c.pat -= 1;
  const bad = c.robo && i === c.roboBad;
  c.obs[i] = bad ? OBS[i].bad : pick(OBS[i].ok);
  return { bad, left: c.pat };
}
export function report(c) {
  if (c.robo) {
    const bounty = r5(50 + S.day * 5);
    S.money += bounty; addRep('law', 2); S.st.robo++;
    let drop = null;
    if (S.shelf.length < S.shelfCap) { drop = mkItem(pick(['battery', 'battery', 'chip', 'claw'])); S.shelf.push(drop); }
    return { ok: true, bounty, drop };
  }
  const fac = CATS[c.who].fac;
  if (fac) addRep(fac, -2);
  addRep('law', -1);
  return { ok: false, fac };
}
// 伪猫付的是全息假币，第二天早上消失
export function voidFakeCash() {
  const lost = Math.min(S.fakeCash, Math.max(0, S.money));
  S.money -= lost; S.fakeCash = 0;
  return lost;
}

// Optional v2 extension: old saves retain their goods, machines and active jobs.
export function ensureGrowth() {
  if (!S || S.v !== 2) throw Error('不支持的营业存档版本');
  if (S.variety !== undefined) validateVariety(S.variety);
  if (S.growth !== undefined) validateGrowth(S.growth);
  if (!S.growth) S.growth = {v:1,unlocked:{},seen:{},phone:{orders:[],last:{}},mods:{},appraisalDisplay:false,seq:0};
  const g=S.growth;
  if(g.v!==1) throw Error('不支持的成长记录版本');
  g.unlocked ||= {}; g.seen ||= {}; g.phone ||= {orders:[],last:{}}; g.mods ||= {}; g.seq ||= 0;
  return g;
}
const MILESTONES={phone:[2,4],appraisal:[3,6],workshop:[4,8],premium:[6,12]};
export function growthStatus() {
  const g=ensureGrowth(), trades=(S.st.buy||0)+(S.st.sell||0);
  for(const [id,[day,n]] of Object.entries(MILESTONES)) if(S.day>=day&&trades>=n) g.unlocked[id]=true;
  if(S.up.appraisal_certificate) g.unlocked.appraisal=true;
  if(S.up.premium_window) g.unlocked.premium=true;
  if(Object.keys(g.mods).some(k=>g.mods[k])) g.unlocked.workshop=true;
  return Object.fromEntries(Object.keys(MILESTONES).map(k=>[k,!!g.unlocked[k]]));
}
export function progressGuide() {
  const status = growthStatus(), tier = contentTier();
  return [
    ...Object.entries(MILESTONES).map(([id, [day, trades]]) => ({ id, day, trades, unlocked: status[id] })),
    ...CONTENT_STAGES.map(({ tier: stage, day, trades }) => ({ id: `content${stage}`, day, trades, unlocked: tier >= stage })),
  ].sort((a, b) => a.day - b.day || a.trades - b.trades);
}
export function growthMessages() {
  const g=ensureGrowth(),status=growthStatus(),texts={phone:'电话订货已开启：先付款，明日到货。',appraisal:'可在小铺购买鉴定证书，展示后接待鉴定。',workshop:'作坊可用真实材料改装设备。',premium:'可购买精品橱窗；上流好感达到2后吸引高预算买家。'};
  return Object.keys(status).filter(k=>status[k]&&!g.seen[k]).map(id=>{g.seen[id]=true;return{id,text:texts[id]};});
}
function contactVisible(c) {return growthStatus().phone&&tierOf(c)<=contentTier()&&S.day>=c.day&&(!c.machine||S.owned[c.machine])&&(!c.rep||S.rep[c.rep]>=c.minRep);}
const packageVisible = p => tierOf(p) <= contentTier() && p.items.every(x => availableItem(x.id));
export function phoneContacts() {
  const g=ensureGrowth();
  return PHONE_CONTACTS.filter(contactVisible).map(c=>{const pending=g.phone.orders.find(o=>o.contact===c.id),lastDay=g.phone.last[c.id];return {...c,pending,lastDay,packages:c.packages.filter(packageVisible).map(p=>({...p,due:S.day+1,available:!pending&&lastDay!==S.day&&S.money>=p.price,reason:pending?'上笔订货尚未领完':lastDay===S.day?'今天已经订过货':S.money<p.price?'鱼币不足':null}))};});
}
export function placePhoneOrder(contactId,packageId) {
  const c=PHONE_CONTACTS.find(c=>c.id===contactId),p=c?.packages.find(p=>p.id===packageId);
  if(!c||!p||!contactVisible(c)||!packageVisible(p)) return{ok:false,reason:'联系人或这批货尚未开放'};
  const g=ensureGrowth();
  if(g.phone.orders.some(o=>o.contact===c.id)||g.phone.last[c.id]===S.day) return{ok:false,reason:'今天已订货或尚有待领货物'};
  if(S.money<p.price)return{ok:false,reason:'鱼币不足'};
  const order={id:`phone-${++g.seq}`,contact:c.id,name:p.name,price:p.price,due:S.day+1,items:p.items.map(x=>({...x})),remaining:p.items.map(x=>({...x}))};
  S.money-=p.price;g.phone.last[c.id]=S.day;g.phone.orders.push(order);return{ok:true,order};
}
export function phoneDeliveries(){return ensureGrowth().phone.orders.filter(o=>o.due<=S.day);}
export function collectPhoneDelivery(id){
  const g=ensureGrowth(),o=g.phone.orders.find(o=>o.id===id);
  if(!o||o.due>S.day)return{ok:false,got:[],remaining:0,reason:'货物尚未到达或已领取'};
  const got=[];
  for(const entry of o.remaining) while(entry.qty>0&&S.shelf.length<S.shelfCap){const it=mkItem(entry.id,{q:1,cost:o.price/o.items.reduce((n,x)=>n+x.qty,0),...(entry.g!=null?{g:entry.g,gk:true}:{})});S.shelf.push(it);entry.qty--;got.push(it);}
  const remaining=o.remaining.reduce((n,x)=>n+x.qty,0);if(!remaining)g.phone.orders=g.phone.orders.filter(x=>x!==o);
  return{ok:true,got,remaining};
}
export function setAppraisalDisplay(on){if(!S.up.appraisal_certificate)return false;ensureGrowth().appraisalDisplay=!!on;return true;}
export const appraisalValue=it=>r5(baseV(it,grade(it))*it.q*(it.fake?0.15:1));
function appraisalSpec(){const item=mkItem(pick(Object.keys(ITEMS).filter(availableItem)),{q:rnd(.85,1.2),fake:Math.random()<.2});return{kind:'appraisal',who:'trader',item,checks:[null,null,null],bad:item.fake?ri(0,2):-1,impatience:0,settled:false};}
function activeAppraisal(c){return c&&c.kind==='appraisal'&&!c.settled&&current()===c;}
export function appraisalCheck(c,i){
  if(!activeAppraisal(c)||!Number.isInteger(i)||i<0||i>2)return{ok:false,reason:'鉴定已结束'};
  if(c.checks[i])return{ok:true,res:c.checks[i],free:true};
  const res=c.item.fake&&c.bad===i?'fake':'ok';c.checks[i]=res;
  if(isWater(c.item)&&i===2)c.item.gk=true;
  if(res==='fake')c.item.known=true;
  return{ok:true,res};
}
export function appraisalQuote(c,price){
  if(!activeAppraisal(c)||!Number.isFinite(price)||price<0)return{ok:false,reason:'报价无效或鉴定已结束'};
  const value=appraisalValue(c.item),error=Math.abs(price-value)/value;
  if(price<value*.5||price>value*1.5){c.impatience=Math.min(100,c.impatience+49);if(c.impatience>=100)c.settled=true;return{ok:true,accepted:false,left:c.impatience>=100,reward:0,impatience:c.impatience};}
  const tier=error<=.05+1e-10?15:error<=.09+1e-10?12:error<=.14+1e-10?10:error<=.24+1e-10?8:5;
  const reward=6+Math.round(price*tier/100);
  c.settled=true;c.reward=reward;S.money+=reward;return{ok:true,accepted:true,reward,tier,error,impatience:c.impatience};
}
export function machineSpec(mid){const base=MACHINES[mid];if(!base)return null;const mod=S.growth?.mods?.[mid]?MACHINE_MODS[mid]:null;return{...base,...(mod?.cap?{cap:mod.cap}:{}),...(mod?.days?{days:mod.days}:{})};}
export function machineModificationPlan(mid){
  const m=MACHINE_MODS[mid],g=ensureGrowth();if(!m)return{ok:false,reason:'设备不存在',inputs:[]};
  const inputs=m.inputs.map(x=>({...x,have:S.shelf.filter(it=>it.id===x.id&&!(it.fake&&it.known)&&!(it.stolen&&it.stolenKnown)).length}));
  const reason=!growthStatus().workshop?'第4天且完成8次买卖后开放':!S.owned[mid]?'尚未拥有设备':g.mods[mid]?'已经改装':S.machines[mid]?'设备忙碌或成品未取':S.money<m.cost?'鱼币不足':inputs.some(x=>x.have<x.qty)?'货架上的真实合法材料不足':null;
  return{...m,inputs,ok:!reason,reason};
}
export function modifyMachine(mid){const p=machineModificationPlan(mid);if(!p.ok)return{ok:false,reason:p.reason};const take=p.inputs.flatMap(x=>S.shelf.filter(it=>it.id===x.id&&!(it.fake&&it.known)&&!(it.stolen&&it.stolenKnown)).slice(0,x.qty));if(take.some(it=>it.fake||it.stolen))return{ok:false,reason:'原料未通过真伪或来源核验，未扣材料和鱼币'};S.money-=p.cost;take.forEach(removeItem);ensureGrowth().mods[mid]=true;return{ok:true};}
const UPGRADE_GATES={purifier:'phone',tank:'phone',wsign:'phone',dew:'phone',lens:'appraisal',guide:'appraisal',dark:'appraisal',labeler:'appraisal',hide1:'appraisal',brewery:'workshop',uv:'workshop',shelf2:'workshop',hide2:'workshop',fridge:'workshop',lucky:'workshop',lawfee:'workshop',gangfee:'workshop'};
export function upgradeAvailable(id){const u=UPGRADES.find(u=>u.id===id);if(!u)return{ok:false,reason:'商品不存在'};if(!u.repeat&&(S.up[id]||(u.machine&&S.owned[id])))return{ok:false,reason:'已拥有'};if(u.need&&!S.up[u.need]&&!S.owned[u.need])return{ok:false,reason:'尚缺前置装备'};const legacySupport=['filter','uv'].includes(id)&&u.need&&(S.up[u.need]||S.owned[u.need]);if(tierOf(u)>contentTier()&&!legacySupport){const stage=CONTENT_STAGES.find(s=>s.tier===tierOf(u));return{ok:false,reason:`第${stage.day}天且完成${stage.trades}次买卖后开放`};}const gate=u.gate||UPGRADE_GATES[id];if(gate&&!growthStatus()[gate]&&!legacySupport)return{ok:false,reason:({phone:'第2天且完成4次买卖后开放',appraisal:'第3天且完成6次买卖后开放',workshop:'第4天且完成8次买卖后开放',premium:'第6天且完成12次买卖后开放'})[gate]};if(S.money<u.cost)return{ok:false,reason:'鱼币不足'};return{ok:true,reason:null};}

// Validate before adding defaults: future or malformed content records must remain recoverable.
export function validateVariety(v) {
  const obj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const nat = x => Number.isSafeInteger(x) && x >= 0;
  const exact = (x, keys) => Object.keys(x).every(k => keys.includes(k)) && keys.every(k => Object.hasOwn(x, k));
  const fail = () => { throw Error('来客记录损坏或版本不支持'); };
  const keys = ['v', 'tier', 'recentVisitors', 'recentGoods', 'recentVisits', 'rotation', 'next', 'current', 'dayStarted'];
  if (!obj(v) || !exact(v, keys) || v.v !== 1 || !Number.isSafeInteger(v.tier) || v.tier < 1 || v.tier > 4 || !nat(v.rotation) || !nat(v.dayStarted)) fail();
  for (const [key, max, exists] of [['recentVisitors', 12, id => Object.hasOwn(CATS, id)], ['recentGoods', 10, id => Object.hasOwn(ITEMS, id)], ['recentVisits', 6, id => FEATURED_VISITS.some(x => x.id === id)]]) {
    if (!Array.isArray(v[key]) || v[key].length > max || v[key].some(id => typeof id !== 'string' || !exists(id))) fail();
  }
  for (const key of ['next', 'current']) {
    const visit = v[key];
    if (visit === null) continue;
    if (!obj(visit)) fail();
    const t = FEATURED_VISITS.find(x => x.id === visit.id);
    // Dialogue, quantities and budgets are saved promises, not live template references.
    if (!t || !exact(visit, ['day', 'id', 'kind', 'who', 'item', 'qty', 'line', ...(Object.hasOwn(visit, 'premium') ? ['premium'] : [])]) || !nat(visit.day) || visit.day < 1 || visit.kind !== t.kind || visit.who !== t.who || visit.item !== t.item || !Number.isSafeInteger(visit.qty) || visit.qty < 1 || visit.qty > 99 || (visit.kind !== 'order' && visit.qty !== 1) || typeof visit.line !== 'string' || !visit.line.trim() || visit.line.length > 600 || (Object.hasOwn(visit, 'premium') && (!Number.isFinite(visit.premium) || visit.premium <= 0 || visit.premium > 5)) || tierOf(t) > v.tier) fail();
  }
  if (v.next && v.current && v.next.day <= v.current.day) fail();
  return true;
}





// Reject unsupported extensions before adding defaults; malformed records are never reset.
export function validateGrowth(g){
  const obj=x=>x&&typeof x==='object'&&!Array.isArray(x),nat=x=>Number.isSafeInteger(x)&&x>=0;
  const fail=()=>{throw Error('成长记录损坏或版本不支持');};
  if(!obj(g)||g.v!==1||!obj(g.unlocked)||!obj(g.seen)||!obj(g.phone)||!Array.isArray(g.phone.orders)||!obj(g.phone.last)||!obj(g.mods)||typeof g.appraisalDisplay!=='boolean'||!nat(g.seq))fail();
  for(const map of [g.unlocked,g.seen])if(Object.entries(map).some(([k,v])=>!Object.hasOwn(MILESTONES,k)||typeof v!=='boolean'))fail();
  if(Object.entries(g.mods).some(([k,v])=>!Object.hasOwn(MACHINE_MODS,k)||typeof v!=='boolean'))fail();
  if(Object.entries(g.phone.last).some(([k,v])=>!PHONE_CONTACTS.some(c=>c.id===k)||!nat(v)||v<1))fail();
  const ids=new Set(),contacts=new Set();
  for(const o of g.phone.orders){
    if(!obj(o)||typeof o.id!=='string'||!/^phone-[1-9]\d*$/.test(o.id)||Number(o.id.slice(6))>g.seq||ids.has(o.id)||contacts.has(o.contact)||!PHONE_CONTACTS.some(c=>c.id===o.contact)||typeof o.name!=='string'||!nat(o.price)||!nat(o.due)||o.due<1||!Array.isArray(o.items)||!o.items.length||!Array.isArray(o.remaining)||o.remaining.length!==o.items.length)fail();
    ids.add(o.id);contacts.add(o.contact);
    for(let i=0;i<o.items.length;i++){const a=o.items[i],b=o.remaining[i];if(!obj(a)||!obj(b)||!ITEMS[a.id]||b.id!==a.id||!nat(a.qty)||a.qty<1||!nat(b.qty)||b.qty>a.qty||a.g!==b.g||a.g!==undefined&&(!nat(a.g)||a.g>5))fail();}
    if(!o.remaining.some(x=>x.qty>0))fail();
  }
  return true;
}




// Service appraisal uses a public, market-free estimate. Unknown fraud stays unknown.
// Cache keys include revealed facts, so a completed check cannot leave a stale high estimate.
export function appraisalEstimate(it) {
  const waterGrade=isWater(it)?(it.gk?grade(it):shownG(it)):null;
  const knownFake=!!(it.fake&&it.known),spread=S.up.guide ? 0.1 : 0.25;
  const key=JSON.stringify([S.day,it.id,it.q,waterGrade,knownFake,spread]);
  if(it.appraisalEst?.key===key)return{lo:it.appraisalEst.lo,hi:it.appraisalEst.hi};
  const publicValue=baseV(it,waterGrade??grade(it))*it.q*(knownFake ? 0.15 : 1);
  const lo=r5(publicValue*(1-rnd(spread*.5,spread))),hi=r5(publicValue*(1+rnd(spread*.5,spread)));
  it.appraisalEst={key,lo,hi};return{lo,hi};
}

