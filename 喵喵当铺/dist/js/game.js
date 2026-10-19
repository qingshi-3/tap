// 核心规则：状态、行情、客人生成、交易判定、夜晚结算。不碰 DOM。
import { ITEMS, SELLERS, BUYERS, NEWS, CRATES, MACHINES, UPGRADES, CATS, WG, SIGNS, OBS, rentOf, DAYS_PER_WEEK, BUYOUT } from './data.js';

export const rnd = (a, b) => a + Math.random() * (b - a);
export const ri = (a, b) => Math.floor(rnd(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r5 = (v) => Math.max(1, Math.round(v));

export let S = null;
export const setState = (s) => { S = s; };

export function newRun() {
  S = {
    v: 2, day: 1, money: 100, uid: 1,
    sign: 'warm', win: [], filter: 0, ice: 0, fakeCash: 0,
    shelf: [], hidden: [], shelfCap: 6, hiddenCap: 0,
    up: {}, machines: { furnace: null }, owned: { furnace: true },
    rep: { elite: 0, folk: 0, law: 0, gang: 0 },
    orders: [], queue: [], qi: 0,
    news: 'calm', nextNews: pick(NEWS.slice(1)).id, newsPeek: false,
    mkt: {}, phase: 'day', night: { crate: 0, crates: [], extra: false, peek: false },
    rentDue: 0, graceUsed: false, rentPaid: 0,
    story: { lady: 0, pearl: null },
    st: { buy: 0, sell: 0, fakeSpot: 0, fakeSold: 0, ingots: 0, waters: 0, clean: 0, orders: 0, peakWorth: 0, robo: 0, cooled: 0 },
    tutorial: false,
  };
  ['dryfish', 'dryfish', 'can', 'scrap', 'scrap'].forEach((id) => S.shelf.push(mkItem(id)));
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

// ───── 客人 ─────
const sellerTypes = Object.keys(SELLERS), buyerTypes = Object.keys(BUYERS);
const WATER_G = { scav: [0, 1], worker: [1, 3], doctor: [3, 4], granny: [2, 3] };
function sellerSpec(type, forceId) {
  const cfg = SELLERS[type];
  const id = forceId || pick(cfg.pool);
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
  let want = pick(cfg.wants);
  // 优先选货架上有的品类，减少「没货」空转
  const have = allItems().filter((it) => wantMatch(want, it, want === 'drink' && cfg.minG));
  if (!have.length && Math.random() < 0.6) {
    const alt = cfg.wants.find((w) => allItems().some((it) => wantMatch(w, it, w === 'drink' && cfg.minG)));
    if (alt) want = alt;
  }
  return { kind: 'buy', who: type, want, minG: want === 'drink' ? cfg.minG : undefined, rich: rnd(...cfg.rich), eye: cfg.eye, pat: 3 };
}
export const wantMatch = (want, it, minG) => (want === 'ban' ? isBan(it) : ITEMS[it.id].cat === want && !isBan(it) && (!minG || (isWater(it) && shownG(it) >= minG)));
export const wants = (c, it) => wantMatch(c.want, it, c.minG);
export const winItems = () => { S.win = S.win.filter((u) => S.shelf.some((it) => it.uid === u)); return S.win.map((u) => S.shelf.find((it) => it.uid === u)); };
export function toggleWin(it) {
  if (S.win.includes(it.uid)) S.win = S.win.filter((u) => u !== it.uid);
  else if (S.win.length < 3 && S.shelf.includes(it)) S.win.push(it.uid);
  else return false;
  return true;
}
const hoarderSpec = () => ({ kind: 'buy', who: 'noble', want: 'drink', minG: 4, rich: rnd(1.5, 1.9), eye: 1, pat: 3, hoarder: true });
function waterSeller() {
  const type = pick(['scav', 'worker', 'granny', 'doctor']);
  return sellerSpec(type, 'water');
}

function genQueue() {
  const n = 6 + (S.up.lucky ? 1 : 0);
  const sign = SIGNS[S.sign] || SIGNS.warm;
  const win = winItems();
  const sellW = sellerTypes.map((t) => (t === 'thief' ? 1 + (sign.thief || 0) : 1));
  const q = [];
  for (let i = 0; i < n; i++) {
    if (Math.random() < sign.sell) {
      if (sign.water && Math.random() < 0.5) { q.push(waterSeller()); continue; }
      let r = Math.random() * sellW.reduce((a, b) => a + b), k = 0;
      while ((r -= sellW[k]) > 0) k++;
      q.push(sellerSpec(sellerTypes[k]));
    } else if (win.length && Math.random() < 0.22 * win.length) {
      // 橱窗：照着摆出来的货引来买家
      const it = pick(win), cat = isBan(it) ? 'ban' : ITEMS[it.id].cat;
      const types = buyerTypes.filter((t) => BUYERS[t].wants.includes(cat));
      const b = buyerSpec(types.length ? pick(types) : pick(buyerTypes));
      if (types.length) { b.want = cat; b.minG = cat === 'drink' ? BUYERS[b.who].minG : undefined; }
      q.push(b);
    } else q.push(buyerSpec(pick(buyerTypes)));
  }
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
    const cand = q.filter((c) => (c.kind === 'buy' && !c.hoarder) || (c.kind === 'sell' && !isBan(c.item) && !c.item.stolen));
    if (cand.length) {
      const c = pick(cand);
      Object.assign(c, { robo: true, roboBad: ri(0, 2), obs: [null, null, null] });
      if (c.kind === 'sell') { if (isWater(c.item)) { c.item.g = Math.min(c.item.g, 2); c.item.lab = 4; c.bad = 2; } else { c.item.fake = true; c.bad = ri(0, 2); } }
    }
  }
  // 特殊客人
  if (S.day >= 2 && Math.random() < 0.35 && S.orders.length < 2) q.splice(ri(0, q.length), 0, robotSpec());
  if (S.day >= 3 && Math.random() < 0.18 && !rentToday()) q.splice(ri(1, q.length), 0, { kind: 'fence', who: 'rival' });
  const heat = S.shelf.reduce((a, it) => a + (it.stolen ? it.heat || 1 : 0) + (isBan(it) ? 1 : 0), 0);
  const pol = (0.12 + 0.035 * heat - 0.025 * S.rep.law + (sign.police || 0)) * (newsObj().police || 1);
  if (S.day >= 3 && Math.random() < pol) q.splice(ri(1, q.length), 0, { kind: 'police', who: 'police' });
  const ladyDays = [3, 9, 16];
  if (S.story.lady < 3 && S.day === ladyDays[S.story.lady]) q.splice(1, 0, ladySpec());
  if (S.day === 1 && !S.tutorial) return tutorialQueue();
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
  S.phase = 'day';
  S.queue = genQueue();
  S.qi = 0;
  S.rentDone = false;
  return S.queue;
}
export const current = () => S.queue[S.qi];

// ───── 收货 ─────
// 返回 {r:'deal'|'counter'|'leave', price, angry}
export function offerToSeller(c, p) {
  if (p >= c.ask || p >= c.res) return { r: 'deal', price: Math.min(p, c.ask) };
  const angry = p < c.res * 0.5;
  c.pat -= angry ? 2 : 1;
  if (c.pat <= 0) return { r: 'leave', angry };
  c.ask = Math.max(c.res, r5(c.ask - (c.ask - p) * rnd(0.3, 0.45)));
  return { r: 'counter', price: c.ask, angry };
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
  if (S.shelf.length >= S.shelfCap) return false;
  S.money -= price;
  c.item.cost = price;
  if (c.exposed) c.item.known = true;
  S.shelf.push(c.item);
  S.st.buy++;
  if (c.who === 'lady' && c.story === 0) S.story.pearl = c.item.uid;
  return true;
}

// ───── 卖货 ─────
export function buyerLooks(c, it) {
  const v = lookValue(it), fac = CATS[c.who].fac;
  const repAdj = fac ? 1 + 0.03 * S.rep[fac] : 1;
  c.item = it;
  c.max = r5(v * c.rich * repAdj);
  c.bid = r5(v * rnd(0.6, 0.78));
  c.bid0 = c.bid;
  c.caught = fakeish(it) && Math.random() < c.eye;
  return c;
}
export function askBuyer(c, p) {
  if (p <= c.max) return { r: 'deal', price: p };
  const angry = p > c.max * 1.6;
  c.pat -= angry ? 2 : 1;
  if (c.pat <= 0) return { r: 'leave', angry };
  c.bid = Math.min(c.max, r5(c.bid + (p - c.bid) * rnd(0.3, 0.45)));
  return { r: 'counter', price: c.bid, angry };
}
export function sellItem(c, price) {
  removeItem(c.item);
  S.money += price;
  S.st.sell++;
  if (fakeish(c.item)) S.st.fakeSold++;
  if (c.iced) S.ice++;
  if (c.robo) S.fakeCash += price;
  const fac = CATS[c.who].fac;
  if (fac && price <= lookValue(c.item) * 1.05) addRep(fac, 1);
}
export function removeItem(it) {
  S.shelf = S.shelf.filter((x) => x !== it);
  S.hidden = S.hidden.filter((x) => x !== it);
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
export function acceptOrder(o) { S.orders.push(o); }
export function canDeliver(o) { return allItems().filter((it) => orderOk(o, it)).length >= o.qty; }
export function deliver(o) {
  let n = o.qty;
  for (const it of [...S.shelf, ...S.hidden]) if (n > 0 && orderOk(o, it)) { removeItem(it); n--; }
  S.money += o.reward;
  S.orders = S.orders.filter((x) => x !== o);
  S.st.orders++;
}
export function expireOrders() {
  const gone = S.orders.filter((o) => S.day > o.due);
  S.orders = S.orders.filter((o) => S.day <= o.due);
  return gone;
}

// ───── 夜晚 ─────
export function startNight() {
  S.phase = 'night';
  const ids = CRATES.map((c) => c.id).sort(() => Math.random() - 0.5).slice(0, 3);
  S.night = { crates: ids, opened: [], extra: false, peek: false, free: 1 };
}
export function openCrate(idx) {
  const cr = CRATES.find((c) => c.id === S.night.crates[idx]);
  let [id, n] = pick(cr.pool);
  if (cr.rare && cr.rare.includes(id) && Math.random() < 0.55) [id, n] = pick(cr.pool.filter((p) => !cr.rare.includes(p[0])));
  const got = [], lost = [];
  for (let i = 0; i < n; i++) {
    const it = mkItem(id, id === 'water' ? { g: cr.id === 'wet' ? ri(0, 2) : 0, gk: true } : {});
    if (S.shelf.length < S.shelfCap) { S.shelf.push(it); got.push(it); } else lost.push(it);
  }
  S.night.opened.push(idx);
  return { id, got, lost, rare: !!(cr.rare && cr.rare.includes(id)) };
}
// 净水器：每份 +2 档，上限山泉水（有紫外线灯到纯净水）；脏水耗滤芯 3 点
export const pureMax = () => (S.up.uv ? 5 : 4);
const filterCost = (it) => (grade(it) <= 1 ? 3 : 1);
function pureQueue() {
  const list = S.shelf.filter((it) => isWater(it) && grade(it) < pureMax()).sort((a, b) => grade(b) - grade(a));
  const take = []; let f = S.filter;
  for (const it of list) { if (take.length >= MACHINES.purifier.cap) break; if (filterCost(it) <= f) { take.push(it); f -= filterCost(it); } }
  return take;
}
// 酿酒要白开水或山泉水：山泉水酿得更香，纯净水太干净发不了酵
const brewWater = () => S.shelf.filter((it) => isWater(it) && grade(it) >= 3 && grade(it) <= 4).sort((a, b) => grade(b) - grade(a));
export function machineInputs(mid) {
  const m = MACHINES[mid];
  if (mid === 'purifier') return pureQueue().length;
  const have = S.shelf.filter((it) => it.id === m.in[0] && !it.fake).length;
  let n = Math.min(m.cap, Math.floor(have / m.in[1]));
  if (m.water) n = Math.min(n, brewWater().length);
  return n;
}
export function runMachine(mid) {
  const m = MACHINES[mid], batches = machineInputs(mid);
  if (!batches || S.machines[mid]) return 0;
  if (mid === 'purifier') {
    const take = pureQueue();
    const items = take.map((it) => { S.filter -= filterCost(it); removeItem(it); return { g: Math.min(pureMax(), grade(it) + 2), gk: true }; });
    S.machines[mid] = { left: m.days, n: items.length, items };
    return batches;
  }
  let need = batches * m.in[1];
  for (const it of [...S.shelf]) if (need > 0 && it.id === m.in[0] && !it.fake) { removeItem(it); need--; }
  let items;
  if (m.water) items = brewWater().slice(0, batches).map((w) => { removeItem(w); return { q: grade(w) === 4 ? rnd(1.3, 1.45) : rnd(0.95, 1.1) }; });
  S.machines[mid] = { left: m.days, n: batches * m.out[1], items };
  return batches;
}
// 睡觉：机器推进一晚、换日
export function sleep() {
  const out = [];
  for (const [mid, job] of Object.entries(S.machines)) {
    if (!job) continue;
    if (job.left > 0) job.left--;
    if (job.left <= 0 && !job.ready) job.ready = true;
  }
  collectMachines(out);
  if (S.up.dew && S.shelf.length < S.shelfCap) { const w = mkItem('water', { g: 2, gk: true }); S.shelf.push(w); out.push(w); }
  // 赃物热度每晚降一点，降到零就不算赃物了
  for (const it of allItems()) {
    if (!it.stolen) continue;
    it.heat = (it.heat || 1) - 1;
    if (it.heat <= 0) { it.stolen = false; it.heat = 0; it.cooled = true; S.st.cooled++; }
  }
  S.day++;
  S.news = S.nextNews;
  S.nextNews = pick(NEWS).id;
  rollMarket();
  return out;
}
// 机器产出放进货架，放不下的留在机器里等明晚
export function collectMachines(out = []) {
  for (const [mid, job] of Object.entries(S.machines)) {
    if (!job || !job.ready) continue;
    const m = MACHINES[mid];
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
  if (S.money < u.cost) return false;
  if (!u.repeat && S.up[u.id]) return false;
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
  const amt = rentAmount();
  if (S.money < amt) return false;
  S.money -= amt; S.rentDue = 0; S.rentPaid++;
  return true;
}
export function graceRent() { S.rentDue += rentOf(week()); S.graceUsed = true; }

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
