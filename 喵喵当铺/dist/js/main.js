// 界面与流程：标题 → 白天（逐位客人）→ 房租 → 夜晚 → 睡觉 → …… → 结局
import { ITEMS, CATS, FACS, CATS_CAT, SPOTS, SELLERS, MACHINES, UPGRADES, ACHS, BUYOUT, WEEKDAYS, DAYS_PER_WEEK, WG, SIGNS, OBS, rentOf } from './data.js';
import * as Rules from './game.js';
import { createCommittedGame, publishState } from './committed-game.js';
import { ads, board, store } from './platform.js';
import { sfx, music, sound, unlockAudio } from './audio.js';
import { createPersistence, normalizeRun } from './persistence.js';
import { createBusinessUI } from './business-ui.js';
import { createNetworkUI } from './network-ui.js';

const RUN_KEY = 'mmdp_run', META_KEY = 'mmdp_meta', VER = 'v1.4.2';
const defaultMeta = () => ({ ach: {}, best: 0, fastest: 0, runs: 0, tut: false, sfx: true, music: true });
let meta, startupStorageError = null;
function readStartupMeta() {
  startupStorageError = null;
  meta = defaultMeta();
  try {
    const saved = store.get(META_KEY, defaultMeta());
    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    if (!object(saved) || saved.ach !== undefined && !object(saved.ach) ||
      ['best','fastest','runs'].some(key => saved[key] !== undefined && (!Number.isFinite(saved[key]) || saved[key] < 0)) ||
      ['tut','sfx','music'].some(key => saved[key] !== undefined && typeof saved[key] !== 'boolean')) throw new Error('元信息损坏，原件已保留');
    Object.assign(meta, saved);
  } catch (error) { startupStorageError = error; }
  sound.sfx = meta.sfx; sound.music = meta.music;
}
readStartupMeta();
const saveMeta = () => { if (startupStorageError) throw startupStorageError; return store.set(META_KEY, meta); };
const session = createPersistence({ initialize: state => Rules.ensureGrowthState(state) });
let saveFailure = null, transactionBusy = false;
let screenEpoch = 0;
const G = createCommittedGame(Rules, session, () => transactionBusy);
const saveRun = () => { if (!G.S) return true; session.save(G.S); saveFailure = null; return true; };
function mutateRun(type, mutate) {
  const live = G.S;
  const commit = session.transactSync(live, `${live.runId}:${live.day}:${type}:${live.persistence.revision}`, draft => {
    Rules.setState(draft);
    try { return {value:mutate(draft)}; } finally { Rules.setState(live); }
  });
  Rules.setState(publishState(live,commit.state));
  return commit.result?.value;
}
async function transactRun(id, mutate) {
  if (transactionBusy) return { ok: false, reason: '正在保存，请稍候' };
  transactionBusy = true;
  const live = G.S;
  try {
    const commit = await session.transact(live, id, draft => {
      G.setState(draft);
      try { return mutate(draft); } finally { G.setState(live); }
    });
    if (commit.rejected) { toast(commit.result.reason); return commit.result; }
    G.setState(publishState(live, commit.state)); saveFailure = null;
    return commit.result || { ok: true };
  } catch (error) { saveFailure = error; toast(error.message); return { ok: false, reason: error.message }; }
  finally { transactionBusy = false; }
}
let commandNumber = 0;
const commandId = type => `${G.S.runId}:${G.S.day}:${type}:${Date.now()}:${++commandNumber}`;
async function executeBusiness(action, args) {
  const result = await transactRun(commandId(action), () => { const r=G.businessCommand(action,args); return action==='collectMachine'&&r.ok&&!r.count?{ok:false,reason:'货架已满，成品仍留在机器'}:r; });
  if (result.ok) { refreshCurrentTrade(); refreshHud(); sfx('good'); if (result.revenue) floatMoney(result.revenue);
    if(action==='deliverContract'&&G.businessView().contracts.some(c=>c.id===args.id&&c.kind==='trial'&&c.status==='completed'))toast('试单完成，已开放固定客户合作');
  }
  return result;
}
function refreshCurrentTrade() {
  if (G.S?.phase !== 'day' || busy || !D.panel?.isConnected) return;
  const c = G.current();
  if (!c || c.resolved) return;
  const scroll = D.panel.querySelector('.trade-scroll')?.scrollTop || 0;
  if (c.kind === 'sell') drawSell(c);
  else if (c.kind === 'buy') c.item ? drawBuyHaggle(c) : drawBuyPick(c);
  const area = D.panel.querySelector('.trade-scroll'); if (area) area.scrollTop = scroll;
}
const refreshBusiness = () => { if (G.S?.phase === 'night') renderNight(); else { refreshCurrentTrade(); refreshHud(); refreshBar(); } };
const networkUI = createNetworkUI({h,img:(...args)=>img(...args),modal,closeX:(...args)=>closeX(...args),execute:executeBusiness,refresh:refreshBusiness,toast});
const businessUI = createBusinessUI({ h, img: (...args) => img(...args), modal, closeX: (...args) => closeX(...args), toast, execute: executeBusiness, refresh: refreshBusiness, finish, advance:advanceManaged, sleep:()=>goSleep() });

const stage = document.getElementById('stage');
const fishIcon = 'assets/items/dryfish.png';
const catImg = (who) => `assets/cats/${who}.png`;
const itemImg = (id) => `assets/items/${id}.png`;
// 水按看上去的档位换图：浑的用脏水瓶
const icon = (it) => itemImg(G.isWater(it) && G.shownG(it) <= 2 ? 'dirtywater' : it.id);
const nm = (it) => G.itemName(it);

// ───── 小工具 ─────
function h(sel, attrs, ...kids) {
  const [tag, ...cls] = sel.split('.');
  const el = document.createElement(tag || 'div');
  if (cls.length) el.className = cls.join(' ');
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), (e) => {
      if (k === 'onclick') { sfx('tap'); unlockAudio(); }
      const failed = error => { saveFailure = error; toast(error.message || '操作未完成，请重试'); };
      try { const result = v(e); if (result?.catch) result.catch(failed); } catch(error) { failed(error); }
    });
    else if (k === 'style') el.style.cssText = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (k) => { if (k == null || k === false) return; if (Array.isArray(k)) k.forEach(add); else el.append(k instanceof Node ? k : document.createTextNode(String(k))); };
  kids.forEach(add);
  return el;
}
const img = (src, cls = '') => h('img' + (cls ? '.' + cls : ''), { src, alt: '' });
const fish = (n) => h('span', { style: 'display:inline-flex;align-items:center;gap:2px' }, img(fishIcon, ''), String(n));
const clear = (el) => { while (el.firstChild) el.firstChild.remove(); return el; };
// 清空后填入子节点（跳过 false/null）
const fill = (el, ...kids) => { clear(el); el.append(...h('div', {}, ...kids).childNodes); return el; };
const appendContent = (el, ...kids) => el.append(...h('div', {}, ...kids).childNodes);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function toast(text, cls = '') {
  let wrap = stage.querySelector('.toast-wrap');
  if (!wrap) wrap = stage.appendChild(h('div.toast-wrap'));
  const t = h('div.toast.px' + (cls ? '.' + cls : ''), text);
  wrap.append(t);
  setTimeout(() => t.remove(), 2500);
}
function floatMoney(d) {
  if (!d) return;
  const f = h('div.float.' + (d > 0 ? 'plus' : 'minus'), (d > 0 ? '+' : '') + d);
  f.style.left = '40px'; f.style.top = '48px';
  stage.append(f); setTimeout(() => f.remove(), 1200);
  sfx(d > 0 ? 'coin' : 'pay');
}
function modal(build, { center = false, onClose } = {}) {
  const previousFocus = document.activeElement;
  const mask = h('div.mask' + (center ? '.center' : ''));
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true; mask.remove(); onClose?.();
    if (previousFocus?.isConnected) previousFocus.focus();
  };
  mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
  mask.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    if (e.key !== 'Tab') return;
    const controls = [...mask.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex="0"]')];
    const first = controls[0], last = controls.at(-1);
    if (!first) return;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  const content = build(close);
  content.setAttribute('role', 'dialog'); content.setAttribute('aria-modal', 'true');
  const title = content.querySelector('h2');
  if (title) content.setAttribute('aria-label', title.firstChild?.textContent || title.textContent);
  mask.append(content);
  stage.append(mask);
  queueMicrotask(() => { if (!closed) mask.querySelector('button:not([disabled]), input:not([disabled])')?.focus(); });
  return close;
}
const closeX = (close) => h('button.x', { onclick: close, 'aria-label': '关闭' }, '✕');

function unlock(id) {
  if (meta.ach[id]) return;
  meta.ach[id] = Date.now(); saveMeta();
  const a = ACHS.find((x) => x.id === id);
  sfx('ach');
  toast([h('b', '成就'), a.name], 'ach');
}
function checkAch() {
  const S = G.S; if (!S) return;
  if (S.money >= 1000) unlock('money1k');
  if (S.money >= 3000) unlock('money3k');
  if (S.st.ingots >= 5) unlock('furnace');
  if (S.st.waters >= 10) unlock('water');
  if (S.st.fakeSpot >= 1) unlock('spot_fake');
  if (S.st.fakeSpot >= 5) unlock('spot_fake5');
  if (S.st.clean >= 3) unlock('law');
  if (S.st.orders >= 5) unlock('robot');
  if (S.rep.gang >= 5) unlock('gang');
  if (S.st.pure) unlock('pure');
  if (S.st.scamRival) unlock('scam_rival');
  if (S.st.cooled >= 1) unlock('cool');
  if (S.st.robo >= 1) unlock('robo');
  if (S.st.robo >= 3) unlock('robo3');
  if (G.allUpgrades()) unlock('allup');
  const tre = new Set(G.allItems().filter((it) => ITEMS[it.id].cat === 'treasure' && !it.fake).map((it) => it.id));
  if (tre.size >= 4) unlock('collector');
  G.trackPeak();
}

// 舞台按 390 宽缩放，高度随屏幕
function fit() {
  const W = document.documentElement.clientWidth, H = document.documentElement.clientHeight;
  const s = Math.min(W / 390, H / 680);
  const sh = H / s;
  stage.style.left = (W - 390 * s) / 2 + 'px';
  stage.style.transform = `scale(${s})`;
  stage.style.height = sh + 'px';
  stage.style.setProperty('--sh', Math.max(200, Math.min(300, sh - 600)) + 'px');
}
addEventListener('resize', fit);

// ───── 标题 ─────
function renderTitle() {
  screenEpoch++;
  music('night');
  let hasRun = false;
  try { hasRun = store.has(RUN_KEY); } catch (error) { startupStorageError = error; }
  fill(stage, h('div.screen.title',
    h('div.title-bg', { style: `background-image:url(assets/bg/title.jpg)` }),
    h('div.logo', h('h1', '喵喵当铺')),
    h('div.title-cat', { style: 'top:calc(50% - 150px)' }, img(catImg('player'))),
    h('div.title-menu',
      hasRun && h('button.btn.big.mint', { disabled: !!startupStorageError, onclick: continueRun }, '继续营业'),
      h('button.btn.big', { disabled: !!startupStorageError, onclick: () => (hasRun ? confirmNew() : newGame()) }, hasRun ? '重新开张' : '开张营业'),
      startupStorageError && h('div.startup-storage-error', {role:'alert'}, h('span','存档读取异常，原件已保留。'), h('button.btn.mint', {onclick:()=>{readStartupMeta();renderTitle();}}, '重试')),
      h('div.row',
        h('button.btn.paper', { onclick: openAch }, '成就'),
        h('button.btn.paper', { onclick: openBoard }, '排行榜'),
        h('button.btn.paper', { onclick: openHelp }, '玩法')),
    ),
    h('div.ver', `${VER} · 最高身家 ${meta.best}` + (meta.fastest ? ` · 最快赎店 ${meta.fastest} 天` : '')),
  ));
}
function confirmNew() {
  modal((close) => h('div.dialog.px',
    h('h2', '重新开张？'),
    h('p', { style: 'font-size:16px' }, '当前的存档会被覆盖。'),
    h('div.row', h('button.btn.paper', { onclick: close }, '再想想'), h('button.btn.red', { onclick: () => { close(); newGame(); } }, '重新开张')),
  ), { center: true });
}
async function newGame() {
  if (startupStorageError) { toast('存档读取异常，请先重试'); return; }
  screenEpoch++;
  if (transactionBusy) return;
  const previous = G.S;
  try {
    if (!session.writable && !await session.acquire()) throw new Error('另一个页面正在营业，请关闭后重试');
    session.load();
    G.newRun(); G.S.tutorial = meta.tut;
    const next = normalizeRun(G.S, state => G.ensureGrowthState(state));
    G.setState(next);
    const expired = Rules.expireOrders(); Rules.startDay();
    session.save(G.S);
    meta.runs++; saveMeta(); showMorning(true, expired, 0);
  } catch (error) { G.setState(previous); toast(error.message); }
}
async function continueRun() {
  if (startupStorageError) { toast('存档读取异常，请先重试'); return; }
  try {
    if (!session.writable && !await session.acquire()) throw new Error('另一个页面正在营业，请关闭后重试');
    const s = session.load();
    if (!s) { toast('没有可继续的存档'); return; }
    G.setState(s);
    if (s.phase === 'night') renderNight(); else renderDay();
  } catch (error) { toast(error.message); }
}

// ───── 白天 ─────
const tradePrices = new WeakMap();
let D = {}; // 当前白天界面的节点
let busy = false;

function beginDay(first) {
  const expired = G.expireOrders(), lost = first ? 0 : G.voidFakeCash();
  G.startDay(); if (!saveRun()) return; showMorning(first, expired, lost);
}
function showMorning(first, expired = [], lost = 0) {
  const S = G.S;
  renderDay();
  const n = G.newsObj();
  const out = S.morningOut || [];
  S.morningOut = null;
  modal((close) => h('div.dialog.px',
    h('h2', `第 ${S.day} 天 · ${WEEKDAYS[G.weekday()]}`),
    h('div.card.px', { style: 'background:#fff1c9' }, h('div.grow', h('div.nm', '📰 ' + n.t), h('div.meta', n.d))),
    out.length > 0 && h('div.label', '作坊产出：' + summarize(out)),
    lost > 0 && h('div.label', { style: 'color:var(--red)' }, `🤖 钱箱里有 ${lost} 鱼币是全息假币，一早就消失了！昨天有伪猫混进来过……`),
    expired.length > 0 && h('div.label', { style: 'color:var(--red)' }, `订单过期：${expired.map(G.orderName).join('、')}`),
    G.rentToday() && !S.business.ownership.owned && h('div.label', { style: 'color:var(--red)' }, `今天打烊后要交房租 ${G.rentAmount()} 鱼币`),
    h('button.btn.big', { onclick: close }, first ? '开张！' : '开门营业'),
  ), { center: true, onClose: () => { sfx('bell'); showCustomer(); } });
}
const summarize = (items) => {
  const m = {};
  for (const it of items) m[nm(it)] = (m[nm(it)] || 0) + 1;
  return Object.entries(m).map(([k, n]) => `${k}×${n}`).join('、');
};

function hud() {
  const S = G.S;
  const rent = G.rentInfo();
  return h('div.hud',
    h('div.money', img(fishIcon), h('span.m', String(S.money))),
    h('div.date', h('b', `第 ${G.week()} 周 · ${WEEKDAYS[G.weekday()]}`),
      h('small', S.business.ownership.owned?'自有店铺 · 永久免租':`${rent.paid ? '下次租金' : '房租'} ${rent.amount} · ${rent.days ? rent.days + '天后' : '今天'}`)),
    h('button.menu', { onclick: openMenu, 'aria-label': '菜单' }, '☰'),
  );
}
function refreshHud() {
  const old = stage.querySelector('.hud');
  if (old) old.replaceWith(hud());
  checkAch();
}

function renderDay() {
  music('day');
  const S = G.S;
  D = {};
  D.scene = h('div.scene', { style: 'background-image:url(assets/bg/shop.jpg);height:calc(var(--sh) + 84px)' });
  D.panel = h('div.panel');
  const n = G.newsObj();
  fill(stage, h('div.screen.day-screen',
    h('div.news', h('b', '今日'), `${n.t} · ${n.d}`),
    D.scene, hud(), D.panel,
    h('div.bar',
      D.shelfBtn = h('button.btn.paper', { onclick: openShelf }, `货架 ${S.shelf.length}/${S.shelfCap}`),
      D.orderBtn = h('button.btn.paper', { onclick: openOrders }, `订单 ${S.orders.length}`),
      dayBusinessButton(),
    ),
  ));
  if (S.queue.length && S.qi < S.queue.length && !document.querySelector('.mask')) showCustomer();
  else if (S.qi >= S.queue.length) endOfDay();
}
function managedEnabled(){const v=G.businessView();return !!(v.operations?.enabled||v.network?.enabled||v.network?.managerActive);}
function dayBusinessButton(){
  D.employeeBtn=null;D.managedBtn=null;
  if(managedEnabled())return D.managedBtn=h('button.btn.mint',{onclick:advanceManaged},'继续经营');
  if(!G.S.business.employee.hired)return null;
  return D.employeeBtn=h('button.btn.mint',{onclick:()=>{
    if(busy)return;
    const enabled=!G.S.business.employee.reception;
    mutateRun('reception-mode',draft=>{draft.business.employee.reception=enabled;});
    if(enabled)toast('普通买卖交给店员，有异常再叫你');
    showCustomer();
  }},'店员接待');
}
function refreshBar() {
  const S = G.S;
  if(managedEnabled()!==!!D.managedBtn){const previous=D.managedBtn||D.employeeBtn;const next=dayBusinessButton();if(next){if(previous?.isConnected)previous.replaceWith(next);else stage.querySelector('.day-screen > .bar')?.append(next);}else previous?.remove();}
  if(D.managedBtn)D.managedBtn.disabled=busy||transactionBusy||tradeInProgress(G.current());
  if (D.shelfBtn) D.shelfBtn.textContent = `货架 ${S.shelf.length}/${S.shelfCap}`;
  if (D.orderBtn) {
    const contracts=G.businessView().contracts.filter(c=>c.status==='active');
    const ready = S.orders.some((o) => G.orderPlan(o).ok)||contracts.some(c=>c.start<=S.day&&c.available>0);
    D.orderBtn.textContent = `订单 ${S.orders.length+contracts.length}` + (ready ? ' · 可交' : '');
    D.orderBtn.className = 'btn ' + (ready ? 'pink' : 'paper');
  }
  if(D.employeeBtn){const employee=S.business.employee;D.employeeBtn.textContent=employee.reception?'亲自接待':'店员接待';D.employeeBtn.disabled=busy||!(employee.active&&employee.days>0);}
}

function setScene(who, item) {
  clear(D.scene);
  D.cust = h('div.cust.enter', img(catImg(who)));
  D.scene.append(D.cust);
  const manager=G.businessView().network?.managerActive,employee=G.S.business.employee;
  if(manager||employee.hired)D.scene.append(h('div.shop-employee'+(manager||employee.active&&employee.days>0?'':'.resting'),{'aria-label':manager?'店长在岗':employee.active&&employee.days>0?'店员接待中':'店员休息'},img(catImg('worker'))));
  D.cust.addEventListener('animationend', () => D.cust.classList.replace('enter', 'idle'), { once: true });
  if (item) D.scene.append(h('div.counter-item', img(icon(item))));
  const win = G.winItems();
  if (win.length) D.scene.append(h('div.window-strip.px', h('b', '橱窗'), win.map((it) => img(icon(it)))));
  const dots = h('div.queue-dots');
  G.S.queue.forEach((_, i) => dots.append(h('i' + (i < G.S.qi ? '.done' : i === G.S.qi ? '.now' : ''))));
  D.scene.append(dots);
  D.bubble = h('div.bubble.px');
  D.scene.append(D.bubble);
}
function say(who, text) {
  const c = CATS[who];
  const customer = G.current();
  const clue = customer?.who === who && G.S.day >= 4 && !customer.tut && who !== 'lady' && (customer.kind === 'sell' || customer.kind === 'buy') ? G.observationClue(customer) : null;
  fill(D.bubble, 
    h('div.who', c.name, c.title && h('span', '· ' + c.title), c.fac && h('span.fac', { style: `background:${FACS[c.fac].color}` }, FACS[c.fac].name)),
    h('div', text),
    clue && !customer.obs?.[clue.index] && h('div.customer-clue', clue.text),
  );
}
function coach(text) {
  return h('div.coach.px', img(catImg('player')), h('div', text));
}

function showCustomer() {
  if((G.S.business.employee.reception||G.S.business.operations?.enabled||G.businessView().network?.managerActive)&&!tradeInProgress(G.current())&&G.canDelegateReception())mutateRun('auto-reception',()=>Rules.delegateReception());
  let c = G.current(), skipped = false;
  // A save taken during the existing departure delay may still point at the
  // exhausted customer. Resume after that visit, without replaying any reward.
  while (c && (c.resolved || ((c.kind === 'sell' || c.kind === 'buy') && Number.isFinite(c.pat) && c.pat <= 0))) {
    G.S.qi++; skipped = true; c = G.current();
  }
  if (skipped) saveRun();
  busy = false;
  D.panel.classList.remove('trade-panel');
  D.panel.scrollTop = 0;
  refreshBar();
  if (!c) return endOfDay();
  if (c.who === 'lady' && c.story === G.S.story.lady) G.S.story.lady++;
  sfx('meow');
  setScene(c.who, c.kind === 'sell' ? c.item : null);
  ({ sell: panelSell, buy: panelBuy, fence: panelFence, police: panelPolice, order: panelOrder, lady: panelLady }[c.kind])(c);
  const eb = eyeBtn(c);
  if (eb) D.scene.append(eb);
}

// 结束当前客人：说完最后一句话后离场
async function leave(text, mood) {
  if (busy) return;
  busy = true;
  const c = G.current();
  const token = ads.captureGuard(G.S), queueIndex = G.S.qi, epoch = screenEpoch;
  refreshPatience(c);
  if (text) say(c.who, text);
  D.panel.querySelectorAll('button, input, select, textarea').forEach((b) => (b.disabled = true));
  D.scene.querySelectorAll('.eye-btn').forEach((b) => (b.disabled = true));
  if (mood === 'bad') { sfx('hiss'); D.cust?.classList.add('shake'); }
  if (mood === 'good') sfx('good');
  refreshHud(); refreshBar();
  await wait(1100);
  if (epoch!==screenEpoch || !ads.isCurrent(token,G.S) || G.S.qi !== queueIndex) return;
  D.cust?.classList.remove('idle', 'shake'); D.cust?.classList.add('exit');
  await wait(380);
  if (epoch!==screenEpoch || !ads.isCurrent(token,G.S) || G.S.qi !== queueIndex) return;
  mutateRun('leave', draft => { draft.qi++; });
  showCustomer();
}

// 价格选择器：返回节点和取值函数
function pricePicker(init, min, max, onChange) {
  let v = Math.max(min, Math.min(max, Math.round(init)));
  const val = h('div.val.px', img(fishIcon), h('span', String(v)));
  const range = h('input', { type: 'range', min, max, value: v });
  const set = (n) => { v = Math.max(min, Math.min(max, Math.round(n))); val.lastChild.textContent = v; range.value = v; onChange?.(v); };
  range.addEventListener('input', () => set(Number(range.value)));
  const step = (d) => h('button.btn.paper.step', { onclick: () => set(v + d) }, (d > 0 ? '+' : '−') + Math.abs(d));
  const node = h('div', h('div.price', step(-10), step(-1), val, step(1), step(10)), range);
  return { node, get: () => v, set };
}
function heartGlyph(active) {
  // SVG keeps its fill on iOS; a heart text glyph may be rendered as color emoji.
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', `heart-icon${active ? '' : ' off'}`);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', 'M12 21 3.6 12.8C-1.8 7.6 5.8-.9 12 5.4 18.2-.9 25.8 7.6 20.4 12.8Z');
  svg.append(path);
  return svg;
}
function heartsEl(n, max = 3) {
  const remaining = Math.max(0, Number.isFinite(n) ? Math.floor(n) : 0);
  const total = Math.max(1, remaining, Number.isFinite(max) ? Math.floor(max) : 3);
  return h('span.hearts', { role: 'img', 'aria-label': `耐心剩余${remaining}，共${total}` },
    h('span.hearts-icons', { 'aria-hidden': 'true' }, Array.from({ length: total }, (_, i) => heartGlyph(i < remaining))),
    h('span.heart-count', { 'aria-hidden': 'true' }, `${remaining}/${total}`));
}
const seenPatience = new WeakMap();
const heartsFor = (c) => {
  const initial = c.kind === 'sell' ? SELLERS[c.who]?.pat || 3 : 3;
  const max = Math.max(initial, c.pat, seenPatience.get(c) || 0);
  seenPatience.set(c, max);
  return heartsEl(c.pat, max);
};
function refreshPatience(c) {
  if (!c || !Number.isFinite(c.pat)) return;
  stage.querySelectorAll('.hearts').forEach((el) => el.replaceWith(heartsFor(c)));
  stage.querySelectorAll('.trade-feedback').forEach((el) => el.replaceWith(negotiationHint(c, c.kind === 'sell')));
}
const negotiationHint = (c) => h('div.trade-feedback', { role: 'status', 'aria-live': 'polite' },
  c.negotiation && h('span' + (c.negotiation.near ? '.near' : ''), `${c.negotiation.price}：${c.negotiation.near ? '接近了' : '差距大'}`));

function itemTags(it, { known = false, showStolen = false, unverified = false } = {}) {
  const t = [h('span.tag.cat', CATS_CAT[ITEMS[it.id].cat])];
  if (ITEMS[it.id].ban) t.push(h('span.tag.ban', '禁'));
  if (it.stolen && (showStolen || it.stolenKnown)) t.push(h('span.tag.stolen', '赃🔥' + (it.heat || 1)));
  if (it.fake && (known || it.known)) t.push(h('span.tag.fake', '赝'));
  if (G.isWater(it) && it.selfLab) t.push(h('span.tag.lab', '贴标'));
  else if (G.isWater(it) && !it.gk && !WG[G.grade(it)].eye) t.push(h('span.tag.cat', '未验水'));
  else if (unverified) t.push(h('span.tag.cat', '未鉴定'));
  if (G.S.win.includes(it.uid)) t.push(h('span.tag.win', '窗'));
  return h('span.tags', t);
}
function itemCard(it, opts = {}) {
  const stockWater=opts.stock&&G.isWater(it)&&it.gk;
  const e = G.estimate(it);
  return h('div.card.px.item-card',
    h('div.icon', img(stockWater&&G.grade(it)<=2?itemImg('dirtywater'):icon(it))),
    h('div.grow',
      h('div.nm', stockWater?WG[G.grade(it)].n:nm(it), ' ', itemTags(it, opts)),
      h('div.meta.market-price', stockWater ? (it.lab>G.grade(it)?`标签：${WG[it.lab].n}（虚标）`:'水质已验') : opts.exposed ? `识破了！${opts.claimed != null ? `说是${WG[opts.claimed].n}，` : ''}实价约 ${G.trueValue(it)}` : `估价 ${e.lo} ~ ${e.hi}` + (it.selfLab ? `（真身：${WG[G.grade(it)].n}）` : '')),
    ),
    opts.right,
  );
}

const SELL_LINES = [(n, p) => `我有件${n}，${p} 鱼币收不收？`, (n, p) => `看看这个${n}！${p} 鱼币就归你。`, (n, p) => `${n}，成色不错哦，${p} 鱼币。`];
// Old v2 saves can contain an already-generated greeting. Strip its legacy
// robot-only suffix for every speaker; clues now require an actual observation.
const greeting = (line) => String(line || '').replace(/(?:（哔）|喵。喵。喵。|……（滋滋）)$/, '');
function panelSell(c) {
  const name = c.claimed != null ? WG[c.claimed].n : nm(c.item);
  if (!c.said) {
    c.said = true;
    if (c.who === 'thief') c.line = `嘘……这${name}别问来路，${c.ask} 就给你。`;
    else if (c.who === 'lady' && c.story === 0) c.line = `这是母亲留下的${name}……${c.ask} 鱼币，求您了。我以后一定来赎回它。`;
    else if (c.who === 'lady') c.line = `又是我……这块${name}，${c.ask} 鱼币可以吗？`;
    else c.line = G.pick(SELL_LINES)(name, c.ask);
  }
  if (c.who === 'thief') c.item.stolenKnown = true;
  say(c.who, greeting(c.line));
  drawSell(c);
}
function drawSell(c) {
  const S = G.S, it = c.item, fac = CATS[c.who].fac;
  const full = S.shelf.length >= S.shelfCap;
  const e = G.estimate(it);
  const remembered = tradePrices.get(c), start = remembered?.uid === it.uid ? remembered.value : c.exposed ? G.trueValue(it) * 0.7 : Math.min(c.ask, e.lo);
  const picker = pricePicker(start, 1, Math.max(c.ask, start, 10), (v) => { tradePrices.set(c,{uid:it.uid,value:v,touched:true}); refreshBar(); offerBtn.lastChild.textContent = v; offerBtn.disabled = v > S.money || full; });
  tradePrices.set(c,{uid:it.uid,value:picker.get(),touched:remembered?.uid===it.uid&&remembered.touched});
  const spotNames = SPOTS[ITEMS[it.id].cat];
  const lensFree = S.up.lens && !c.lensUsed;
  const clue = G.itemClue(c);
  const spots = h('div.spots', spotNames.map((n, i) => {
    const r = c.checks[i];
    const glyph = r === 'ok' ? '✓' : r === 'fake' ? '✗' : r === 'stolen' ? '⚠' : '？';
    return h('button.btn.paper.spot' + (r ? '.' + r : clue?.index === i ? '.hint' : ''), {
      disabled: !r && c.pat <= 1 && !lensFree ? true : null,
      onclick: () => doCheck(c, i),
      'aria-label': `${n}${r === 'ok' ? '，此处正常' : r === 'fake' ? '，发现赝品' : r === 'stolen' ? '，发现赃物' : `，${lensFree ? '免费' : '消耗1耐心'}${clue?.index === i ? '，' + clue.text : ''}`}`,
    }, h('b', glyph), h('span', n));
  }));
  const offerBtn = h('button.btn', { onclick: () => doOffer(c, picker.get()) }, '出价 ', h('span', String(picker.get())));
  offerBtn.disabled = picker.get() > S.money || full;
  const dealBtn = h('button.btn.mint', { onclick: () => doDeal(c, c.ask), disabled: c.ask > S.money || full ? true : null }, `成交 ${c.ask}`);
  const canCharm = fac && S.rep[fac] >= 2 && !c.charmed;
  D.panel.classList.add('trade-panel');
  fill(D.panel, h('div.trade-scroll',
    c.tut === 'haggle' && coach('用 −/+ 调价，再点「出价」。'),
    c.tut === 'check' && coach('按线索选一处查验。'),
    itemCard(it, { exposed: c.exposed, known: c.exposed, claimed: c.claimed, unverified: !c.exposed && (G.isWater(it) ? !it.gk && !WG[G.grade(it)].eye : !c.checks.every(Boolean)), showStolen: c.who === 'thief' || c.checks[0] === 'stolen', right: h('div.customer-quote', heartsFor(c), h('div.quote-price', `开价 ${c.ask}`)) }),
    h('div.check-controls', spots, h('div.check-summary',
      clue && !c.checks[clue.index] && h('span.item-clue', clue.text),
      !c.checks.every(Boolean) && h('span.check-cost', lensFree ? '免费首查' : '未查处 −1♥'))),
    negotiationHint(c, true),
    picker.node,
    h('div.row',
      canCharm && h('button.btn.small.pink', { onclick: () => { G.charm(c); say(c.who, `看在老熟人的份上，${c.ask} 怎么样？`); drawSell(c); } }, '刷脸 −2好感'),
      full ? h('button.btn.small.paper', { onclick: openShelf }, '整理货架') : null,
      h('button.btn.small.paper', { onclick: () => leave(c.exposed ? '哼，算你厉害。' : '那我去别家看看。') }, '不收了'),
    ),
  ), h('div.trade-actions', h('div.row', offerBtn, dealBtn)));
  D.panel.scrollTop = 0;
}
function doCheck(c, i) {
  const r = G.checkSpot(c, i);
  refreshPatience(c);
  sfx(r.res === 'ok' ? 'check' : 'bad');
  const name = SPOTS[ITEMS[c.item.id].cat][i];
  if (r.res === 'fake' && G.isWater(c.item)) say(c.who, `试纸变色了……这其实是${nm(c.item)}。好吧，按实价。`);
  else if (r.res === 'fake') say(c.who, '被、被发现了喵……那就按实价算你吧。');
  else if (G.isWater(c.item) && i === 2) say(c.who, `试纸显示：${nm(c.item)}。`);
  else if (r.res === 'stolen') { c.item.stolenKnown = true; say(c.who, `${name}上刻着别人的名字……啊这个，我捡的！`); }
  else say(c.who, `${name}这处正常。`);
  if (c.pat <= 0) return leave('我没那么多时间陪你耗！', 'bad');
  checkAch();
  drawSell(c);
}
function doOffer(c, p) {
  const r = G.offerToSeller(c, p);
  refreshPatience(c);
  if (r.r === 'deal') return doDeal(c, r.price);
  if (r.r === 'leave') return leave(r.angry ? '太过分了，不卖了！' : '谈不拢，我走了。', 'bad');
  say(c.who, r.angry ? `差得太远了喵！我先改到 ${r.price}。` : `那……${r.price} 怎么样？`);
  if (r.angry) { sfx('hiss'); D.cust.classList.remove('shake'); void D.cust.offsetWidth; D.cust.classList.add('shake'); }
  drawSell(c);
}
function doDeal(c, price) {
  if (!G.buyItem(c, price)) return toast('货架满了');
  floatMoney(-price);
  unlock('first_buy');
  if (price <= c.ask0 * 0.6 && !c.exposed) unlock('haggle');
  leave(c.who === 'lady' ? '谢谢您……请替我好好保管它。' : G.pick(['成交喵！', '合作愉快～', '嘿嘿，谢啦！']), 'good');
}

const WANT_NAME = (w, minG) => (w === 'ban' ? '那种货' : minG ? `${WG[minG].n}以上的好水` : CATS_CAT[w]);
function panelBuy(c) {
  if (!c.said) {
    c.said = true;
    const w = WANT_NAME(c.want, c.minG);
    c.line = c.hoarder ? '橱窗里那几瓶水……我全都要看看。别拿贴牌货糊弄我，我自带试纸。'
      : c.iceFan ? '听说这里冰水不错，我带钱来了，还有水吗？'
      : c.collector ? '你橱窗里的宝贝，我在街口就看见了。价钱好商量。'
      : c.want === 'ban' ? '有没有……那种货？你懂的。价钱好说。' : c.who === 'kitten' ? `我攒了零花钱！想买${w}～` : G.pick([`有没有${w}？我想买一件。`, `我在找${w}，你这有吗？`]);
  }
  say(c.who, greeting(c.line));
  if (c.item && G.allItems().includes(c.item)) drawBuyHaggle(c); else drawBuyPick(c);
}
function drawBuyPick(c) {
  D.panel.classList.remove('trade-panel');
  const S = G.S, all = G.allItems();
  const reserved = G.businessView().reservations;
  const ok = all.filter((it) => G.wants(c, it)&&!reserved[it.uid]);
  const grid = h('div.shelf-grid', all.map((it) => {
    const m = G.wants(c, it)&&!reserved[it.uid];
    return h('button.slot.px' + (m ? '' : '.dim') + (S.hidden.includes(it) ? '.hid' : ''), {
      disabled: m ? null : true,
      onclick: () => pickForBuyer(c, it),
    }, itemTags(it), img(icon(it)), nm(it));
  }));
  fill(D.panel, 
    c.tut === 'sell' && coach('从货架选一件玩具。'),
    h('div.row', h('span.label.grow', `想要：${WANT_NAME(c.want, c.minG)}`), heartsFor(c)),
    ok.length ? grid : h('div.card.px', h('div.grow', h('div.nm', '没有合适的货'), h('div.meta', '货架上没有对方想要的东西'))),
    h('div.row', h('button.btn.paper', { onclick: () => leave(G.pick(['好吧，下次再来。', '唔，那算了。'])) }, ok.length ? '不卖了' : '抱歉，没有')),
  );
}
function pickForBuyer(c, it) {
  if(G.businessView().reservations[it.uid])return toast('这件货物已预留给合同');
  tradePrices.delete(c);
  G.buyerLooks(c, it);
  if (c.caught) {
    G.removeItem(it); // 被识破的赝品当场被扔掉
    const fac = CATS[c.who].fac; if (fac) G.addRep(fac, -2);
    const water = G.isWater(it);
    return leave(water ? `（试纸一沾）这根本不是${nm(it)}！骗子！` : '这是假货！别想骗我！我要告诉大家！', 'bad');
  }
  say(c.who, `${nm(it)}啊……${c.bid} 鱼币怎么样？`);
  drawBuyHaggle(c);
}
function drawBuyHaggle(c) {
  if (!c.item || !G.allItems().includes(c.item) || G.businessView().reservations[c.item.uid]) { c.item = null; c.iced = false; tradePrices.delete(c); return drawBuyPick(c); }
  const S = G.S, it = c.item, fac = CATS[c.who].fac, e = G.estimate(it);
  const remembered = tradePrices.get(c), start = remembered?.uid === it.uid ? remembered.value : Math.max(e.hi, c.bid + 1);
  const picker = pricePicker(start, Math.min(c.bid,start), Math.max(start,c.bid + 10, Math.round(e.hi * 2.2)), (v) => { tradePrices.set(c,{uid:it.uid,value:v,touched:true}); refreshBar(); askBtn.lastChild.textContent = v; });
  tradePrices.set(c,{uid:it.uid,value:picker.get(),touched:remembered?.uid===it.uid&&remembered.touched});
  const askBtn = h('button.btn', { onclick: () => doAsk(c, picker.get()) }, '报价 ', h('span', String(picker.get())));
  const canCharm = fac && S.rep[fac] >= 2 && !c.charmed;
  D.panel.classList.add('trade-panel');
  fill(D.panel, h('div.trade-scroll',
    c.tut === 'sell' && coach('调价后点「报价」，或直接「成交」。'),
    itemCard(it, { known: it.known, showStolen: it.stolenKnown, right: h('div.customer-quote', heartsFor(c), h('div.quote-price', `出价 ${c.bid}`)) }),
    it.cost ? h('div.label', `进价 ${it.cost}`) : null,
    negotiationHint(c),
    picker.node,
    S.up.fridge && G.isWater(it) && h('button.btn.small.sky', { disabled: c.iced ? true : null, onclick: () => {
      mutateRun('ice', draft => { const buyer=draft.queue[draft.qi]; if(buyer.iced)return;buyer.iced=true;buyer.max=Math.round(buyer.max*1.12);buyer.bid=Math.round(buyer.bid*1.12); }); unlock('ice');
      say(c.who, `冰的！我现在出 ${c.bid}。`); drawBuyHaggle(c);
    } }, c.iced ? '已加冰 🧊' : '🧊 免费加冰'),
    h('div.row',
      canCharm && h('button.btn.small.pink', { onclick: () => { G.charm(c); say(c.who, `好吧好吧，给你 ${c.bid}。`); drawBuyHaggle(c); } }, '刷脸 −2好感'),
      h('button.btn.small.paper', { onclick: () => { c.item = null; c.iced = false; tradePrices.delete(c); drawBuyPick(c); } }, '换一件'),
      h('button.btn.small.paper', { onclick: () => leave('那算了。') }, '不卖了'),
    ),
  ), h('div.trade-actions', h('div.row', askBtn, h('button.btn.mint', { onclick: () => doSell(c, c.bid) }, `成交 ${c.bid}`))));
  D.panel.scrollTop = 0;
  refreshBar();
}
function doAsk(c, p) {
  const r = G.askBuyer(c, p);
  refreshPatience(c);
  if (r.r === 'deal') return doSell(c, r.price);
  if (r.r === 'leave') return leave(r.angry ? '抢钱啊！不买了！' : '太贵了，我走了。', 'bad');
  say(c.who, r.angry ? `差得太多啦！我先出 ${r.price}。` : `我可以出 ${r.price}。`);
  if (r.angry) sfx('hiss');
  drawBuyHaggle(c);
}
function doSell(c, price) {
  if (!c.item || !G.allItems().includes(c.item)) { c.item = null; c.iced = false; drawBuyPick(c); return toast('货物已不在库存，请重新选货'); }
  const it = c.item;
  if(G.sellItem(c, price)===false)return toast('货物已预留或不再可售，请重新选货');
  floatMoney(price);
  unlock('first_sell');
  if (G.fakeish(it)) unlock('sell_fake');
  if (c.hoarder) unlock('hoarder');
  if (c.who === 'kitten' && price <= G.lookValue(it) * 0.7) unlock('kind');
  leave(c.who === 'kitten' ? '谢谢姐姐！我会好好珍惜的！' : G.pick(['好耶，成交！', '眼光不错吧？谢啦！', '下次还来喵～']), 'good');
}

// ───── 伪猫：观察三处细节，举报 ─────
const redrawCust = (c) => (c.kind === 'sell' ? drawSell(c) : c.item ? drawBuyHaggle(c) : drawBuyPick(c));
const eyeBtn = (c) => G.S.day >= 4 && !c.tut && c.who !== 'lady' && (c.kind === 'sell' || c.kind === 'buy') && h('button.eye-btn.px', { onclick: () => openObserve(c, () => redrawCust(c)), 'aria-label': '观察' }, '👀', h('small', '观察'));
function openObserve(c, redraw) {
  c.obs = c.obs || [null, null, null];
  const clue = G.observationClue(c);
  modal((close) => {
    const host = h('div.dialog.px');
    const draw = () => fill(host,
      h('h2', '仔细观察', closeX(close)),
      h('div.row', { style: 'justify-content:flex-end' }, heartsFor(c)),
      h('div.list', OBS.map((o, i) => h('div.li.px', h('div.grow', h('div.t', o.n), h('div.d', c.obs[i] || (clue?.index === i ? clue.text : '未观察'))),
        !c.obs[i] && h('button.btn.small', { disabled: c.pat <= 1 ? true : null, onclick: () => { const r = G.observe(c, i); refreshPatience(c); sfx(r.bad ? 'bad' : 'check'); draw(); } }, '看 −1♥')))),
      h('div.row',
        h('button.btn.paper', { onclick: close }, '返回交易'),
        h('button.btn.red.report-btn', { onclick: () => { close(); doReport(c); } }, '举报伪猫', h('small', '误报扣好感'))),
    );
    draw();
    return host;
  }, { center: true, onClose: () => {
    if (G.current() === c && !busy) {
      if (clue && c.obs[clue.index]) D.bubble?.querySelector('.customer-clue')?.remove();
      redraw(); refreshHud();
    }
  } });
}
function doReport(c) {
  const r = G.report(c);
  if (r.ok) {
    D.cust?.classList.add('glitch');
    floatMoney(r.bounty);
    toast(`治安局赏金 +${r.bounty}` + (r.drop ? `，捡到零件：${nm(r.drop)}` : ''));
    checkAch();
    return leave('ERR——猫格模块……离、离线……', 'good');
  }
  leave('你说谁是机器？！我要告诉所有人！', 'bad');
}

// 三花姐：什么都收，按六折上下
function panelFence(c) {
  say(c.who, '三花收货啦～什么都收，价钱嘛，六折上下。');
  fenceUI(D.panel, () => leave('下次再来照顾你生意～'), (sum) => leave(`一共 ${sum}，爽快！`, 'good'));
}
function fenceUI(host, onCancel, onDone, title) {
  const S = G.S, picked = new Set();
  const draw = () => {
    const sum = [...picked].reduce((a, it) => a + G.fencePrice(it), 0);
    fill(host, 
      title,
      h('div.label', '点选要卖给三花姐的货'),
      h('div.shelf-grid', G.allItems().map((it) => h('button.slot.px' + (picked.has(it) ? '.sel' : '') + (S.hidden.includes(it) ? '.hid' : ''), {
        onclick: () => { picked.has(it) ? picked.delete(it) : picked.add(it); draw(); },
      }, itemTags(it), img(icon(it)), `${G.fencePrice(it)}`))),
      h('div.row',
        h('button.btn.paper', { onclick: onCancel }, '不卖了'),
        h('button.btn.mint', { disabled: picked.size ? null : true, onclick: () => { const s = G.fenceSell([...picked]); floatMoney(s); refreshHud(); refreshBar(); onDone(s); } }, `卖出 ${sum}`)),
    );
  };
  draw();
}

function panelPolice(c) {
  const res = G.inspect();
  const S = G.S;
  if (!res.found.length) {
    say(c.who, '例行检查喵！……嗯，很好，守法商户。');
    fill(D.panel, 
      h('div.card.px', h('div.grow', h('div.nm', '✓ 检查通过'), h('div.meta', '治安局好感 +1'))),
      h('div.row', h('button.btn.mint', { onclick: () => { mutateRun('inspection',draft=>{if(draft.queue[draft.qi].resolved)return;draft.st.clean++;Rules.addRep('law',1);draft.queue[draft.qi].resolved=true;}); leave('继续保持！', 'good'); } }, '辛苦了')),
    );
    return;
  }
  say(c.who, '例行检查喵！……这些是什么？赃物和违禁品统统没收！');
  fill(D.panel, 
    h('div.label', `货架上被查出 ${res.found.length} 件（暗格里的查不到）`),
    h('div.shelf-grid', res.found.map((it) => h('div.slot.px', itemTags(it, { showStolen: true }), img(icon(it)), nm(it)))),
    h('div.row',
      h('button.btn.red', { onclick: () => { G.acceptFine(res); S.money = Math.max(0, S.money); floatMoney(-res.fine); leave('下不为例！', 'bad'); } }, `认罚 −${res.fine}`, h('span.sub', '没收')),
      h('button.btn.pink', { disabled: S.money < res.bribe ? true : null, onclick: () => {
        if (G.tryBribe(res)) { floatMoney(-res.bribe); unlock('bribe'); leave('咳……我什么都没看见喵。', 'good'); }
        else { S.money = Math.max(0, S.money); floatMoney(-res.fine * 2); leave('想贿赂我？罚款加倍！', 'bad'); }
      } }, `塞小鱼干 −${res.bribe}`)),
  );
}
function panelOrder(c) {
  const o = c.order, S = G.S;
  const plan = G.orderPlan(o);
  say(c.who, `${o.qty}份${G.orderName(o)}，第${o.due}天截止（含当天），总报酬${o.reward}。`);
  fill(D.panel, 
    h('div.card.px', h('div.icon', img(itemImg(o.id))), h('div.grow', h('div.nm', `${G.orderName(o)} ×${o.qty}`), h('div.meta', `候选 ${Math.min(plan.have, o.qty)}/${o.qty} · 缺 ${Math.max(0, o.qty - plan.have)}`), h('div.meta', o.id === 'water' ? '品质不加价；交付时核验' : '只收真货；交付时核验'))),
    h('div.row',
      h('button.btn.paper', { onclick: () => leave('哔……已取消。') }, '不接'),
      h('button.btn.mint', { disabled: S.orders.length >= 3 ? true : null, onclick: () => { G.acceptOrder(o); leave('哔！订单已登记。随时在「订单」里交付。', 'good'); } }, '接单')),
  );
}
function panelLady(c) {
  const S = G.S;
  const pearl = G.allItems().find((it) => it.uid === S.story.pearl);
  if (!pearl) {
    say(c.who, S.story.pearl == null ? '上次没能留下那串珍珠项圈……我再想想别的办法。' : '我想赎回那串珍珠项圈……已经不在店里了吗。谢谢你告诉我。');
    fill(D.panel, h('div.row', h('button.btn.paper', { onclick: () => leave('祝你生意兴隆。') }, '送客')));
    return;
  }
  const price = Math.round((pearl.cost || 150) * 1.1);
  say(c.who, `我……我想赎回那串珍珠项圈。我攒了 ${price} 鱼币，够吗？`);
  fill(D.panel, 
    itemCard(pearl),
    h('div.row',
      h('button.btn.paper', { onclick: () => leave('……我明白了。打扰了。', 'bad') }, '舍不得'),
      h('button.btn.mint', { onclick: () => {
        const gift = mutateRun('return-pearl',draft=>{
          if(draft.queue[draft.qi].resolved)throw new Error('已经归还');
          const item=Rules.allItems().find(it=>it.uid===pearl.uid);if(!item)throw new Error('物品已不在库存');
          Rules.removeItem(item);draft.money+=price;Rules.recordCash('storyReceipt',price,item.cost||0,'return-pearl');Rules.addRep('elite',3);draft.queue[draft.qi].resolved=true;
          if(draft.shelf.length>=draft.shelfCap)return false;
          draft.shelf.push(Rules.mkItem('ticket',{q:1}));return true;
        });floatMoney(price);
        unlock('lady');
        leave(gift ? '谢谢你替我保管它……这张船票送给你，愿你也能去想去的地方。' : '谢谢你替我保管它……我会记住你的。', 'good');
      } }, `还给她 +${price}`)),
  );
}

// ───── 打烊 / 房租 ─────
function endOfDay() {
  const S = G.S;
  if (G.rentToday() && !S.rentDone && !S.business.ownership.owned) return rentScene();
  closeShop();
}
function closeShop() {
  G.startNight();
  if (!G.S.tutorial) { G.S.tutorial = true; meta.tut = true; saveMeta(); G.S.nightTut = true; }
  saveRun();
  renderNight();
}
function rentScene() {
  const S = G.S;
  busy = false;
  setScene('landlord');
  const amt = G.rentAmount();
  say('landlord', `周五啦～本周房租 ${amt} 鱼币喵。` + (S.rentDue ? '（含上周欠的）' : ''));
  sfx('meow');
  const done = (text) => {
    const token=ads.captureGuard(G.S),epoch=screenEpoch;
    S.rentDone = true;
    say('landlord', typeof text === 'function' ? text() : text);
    refreshHud(); saveRun();
    D.panel.querySelectorAll('button').forEach((b) => (b.disabled = true));
    setTimeout(() => {
      if(epoch!==screenEpoch||!ads.isCurrent(token,G.S))return;
      D.cust?.classList.add('exit');setTimeout(()=>{if(epoch===screenEpoch&&ads.isCurrent(token,G.S))closeShop();},400);
    }, 1100);
  };
  fill(D.panel, 
    h('div.card.px', h('div.grow', h('div.nm', `房租 ${amt}`), h('div.meta', `手头 ${S.money} · 下周房租 ${rentOf(G.week() + 1)}`))),
    h('button.btn.big.mint', { disabled: S.money < amt ? true : null, onclick: () => {
      if (!G.payRent()) { toast('鱼币不足，房租尚未支付'); return rentScene(); }
      floatMoney(-amt);
      if (S.rentPaid >= 1) unlock('week1');
      if (S.rentPaid >= 4) unlock('week4');
      if (S.money < 10) unlock('near');
      done(() => `已收。下次${G.rentInfo().amount}鱼币，${G.rentInfo().days}天后交。`);
    } }, `付房租 ${amt}`),
    h('button.btn', { onclick: () => modal((close) => {
      const host = h('div.sheet');
      fenceUI(host, close, () => { close(); rentScene(); }, h('h2', '找三花姐变现', closeX(close)));
      return host;
    }) }, '找三花姐变现'),
    ads.available && !S.graceUsed && h('button.btn.sky', { onclick: async () => {
      if (await playAd()) { G.graceRent(); S.rentDone = true; done(`宽限至${G.rentInfo().days}天后，共${G.rentInfo().amount}鱼币。`); }
    } }, '求房东宽限一周 ', h('span.ad', '看视频')),
    S.money < amt && h('button.btn.small.red', { onclick: () => gameOver() }, '交不起了……'),
  );
}

async function playAd() {
  const token = ads.captureGuard(G.S),epoch=screenEpoch;
  const cover = h('div.adplay', '视频加载中……');
  stage.append(cover);
  music(null);
  const r = await ads.show();
  cover.remove();
  music(G.S?.phase === 'night' ? 'night' : 'day');
  if (!r.ok) toast(r.msg || '视频未完成');
  return r.ok && epoch===screenEpoch && ads.isCurrent(token,G.S);
}

// ───── 夜晚 ─────
let nightTab = 'scav';
function renderNight() {
  music('night');
  const S = G.S;
  const supplierNames={water:'怪味水',fish:'鱼苗'};
  const unseen=G.businessView().suppliers.filter(s=>s.unlocked&&!(S.business.marks.suppliersSeen||[]).includes(s.route));
  if(unseen.length){mutateRun('supplier-invitation',draft=>{draft.business.marks.suppliersSeen=[...(draft.business.marks.suppliersSeen||[]),...unseen.map(s=>s.route)];});queueMicrotask(()=>toast(`小铺新增固定供货：${unseen.map(s=>supplierNames[s.route]).join('、')}`));}
  const tabs = [['scav', '拾荒'], ['work', '作坊'], ['front', '门面'], ['shop', '小铺'], ['book', '账本']];
  const body = h('div.panel', { style: 'padding-top:14px' });
  const bg = nightTab === 'work' ? 'workshop' : 'night';
  const workReady = Object.keys(S.owned).some((m) => !S.machines[m] && G.productionPlan(m).ok);
  fill(stage, h('div.screen.night-screen',
    h('div.scene', { style: `background-image:url(assets/bg/${bg}.jpg);height:calc(var(--sh) - 36px)` },
      h('div.bubble.px', { style: 'right:auto;max-width:260px' }, h('div.who', '夜晚 · 打烊后'), h('div', nightTab === 'scav' ? '去垃圾场碰碰运气吧。' : nightTab === 'work' ? '叮叮当当，开工！' : nightTab === 'shop' ? '乔伊的小铺还亮着灯。' : nightTab === 'front' ? '明天橱窗摆点什么呢？' : '盘点一下今天的账。')),
      h('div.cust', { style: 'left:auto;right:4px;margin:0' }, img(catImg(nightTab === 'shop' ? 'joe' : 'player'))),
    ),
    hud(),
    h('div.tabs', tabs.map(([k, n]) => h('button.tab' + (nightTab === k ? '.on' : ''), { onclick: () => { nightTab = k; renderNight(); } }, n,
      (k === 'scav' && S.night.opened.length < S.night.free) || (k === 'work' && workReady) ? h('span.dot') : null))),
    body,
    h('div.bar',
      h('button.btn.paper', { onclick: openShelf }, `货架 ${S.shelf.length}/${S.shelfCap}`),
      h('button.btn.paper', { onclick: openOrders }, '订单'),
      h('button.btn.big', { onclick: managedEnabled()?advanceManaged:()=>goSleep() }, managedEnabled()?'继续经营':'💤 睡觉'),
    ),
  ));
  if (S.nightTut) body.append(coach(nightTab === 'scav' ? '选一个箱子拾荒。' : nightTab === 'work' ? '选机器开工。' : nightTab === 'shop' ? '点价格购买。' : '准备好就点「睡觉」。'));
  ({ scav: nightScav, work: nightWork, front: nightFront, shop: nightShop, book: nightBook })[nightTab](body);
}
function nightScav(body) {
  const S = G.S, N = S.night;
  const canOpen = N.opened.length < N.free;
  const crate = (id, i) => {
    const c = (N.results || {})[i];
    const cfg = { heavy: '沉甸甸', wet: '湿漉漉', smell: '香喷喷', jingle: '叮当响', myst: '神秘' }[id];
    if (c) return h('div.crate.px.open', img(itemImg(c.id === 'water' ? 'dirtywater' : c.id)), h('b', `${c.id === 'water' ? '脏水' : ITEMS[c.id].name} ×${c.n}`), c.lost ? h('span.label', `放不下 ${c.lost} 件`) : null);
    return h('button.crate.px', { disabled: canOpen ? null : true, onclick: () => openCrate(i) }, h('div.box'), h('b', cfg + '的箱子'));
  };
  appendContent(body,
    h('div.label', canOpen ? '选一个箱子打开（每晚一次）' : '今晚已经翻过了'),
    h('div.crates', N.crates.map(crate)),
    !canOpen && N.opened.length < 3 && ads.available && !N.extra && h('button.btn.sky', { onclick: async () => { if (await playAd()) { mutateRun('extra-crate',draft=>{if(!draft.night.extra){draft.night.extra=true;draft.night.free++;}});renderNight(); } } }, '再翻一个箱子 ', h('span.ad', '看视频')),
  );
}
function openCrate(i) {
  const S = G.S, N = S.night;
  const r = G.openCrate(i);
  N.results = N.results || {};
  N.results[i] = { id: r.id, n: r.got.length + r.lost.length, lost: r.lost.length };
  sfx(r.rare ? 'good' : 'coin');
  if (r.rare) unlock('treasure');
  if (r.lost.length) toast(`货架满了，丢下了 ${r.lost.length} 件`);
  checkAch(); saveRun(); renderNight();
}
const publicName = (it) => it.id === 'water' && it.knownGrade != null ? WG[it.knownGrade].n : it.name;
const publicIcon = (it) => itemImg(it.id === 'water' && (it.knownGrade ?? it.shownGrade) != null && (it.knownGrade ?? it.shownGrade) <= 2 ? 'dirtywater' : it.id);
function choiceTile(it, selected, choose, hidden = false) {
  return h('button.choice' + (selected.has(it.uid) ? '.sel' : ''), {
    'data-choice': it.uid, 'aria-pressed': selected.has(it.uid) ? 'true' : 'false', onclick: choose,
  }, img(publicIcon(it)), h('span.choice-name', publicName(it)),
  it.id === 'water' && it.knownGrade == null && h('small', '未验'),
  hidden && h('small', '暗格'), selected.has(it.uid) && h('span.choice-mark', { 'aria-hidden': 'true' }, '✓'));
}
function planItems(items, empty = '尚未选料') {
  const groups = new Map();
  for (const it of items) {
    const key = `${it.id}:${publicName(it)}:${it.knownGrade}:${it.fakeKnown}`;
    if (!groups.has(key)) groups.set(key, { ...it, qty: 0 });
    groups.get(key).qty += it.qty || 1;
  }
  return h('div.plan-items', groups.size ? [...groups.values()].map((it) => h('span.plan-object', img(publicIcon(it)), h('span', `${publicName(it)} ×${it.qty}${it.id === 'water' && it.knownGrade == null && !it.name.includes('待验') ? '（未验）' : ''}`))) : h('span.label', empty));
}
const arrivalText = (days) => days === 1 ? '明早完成' : `第${G.S.day + days}天早上完成`;
const productionFlow = (plan) => h('div.batch-flow', planItems(plan.inputs),
  plan.outputs.length ? h('span.flow-arrow', { 'aria-label': '加工为' }, '→') : null,
  plan.outputs.length ? planItems(plan.outputs) : null);
const recipeText = (mid) => {
  const m = MACHINES[mid];
  return mid === 'purifier' ? `原水提升2档，最高${WG[G.pureMax()].n} · ${m.days}晚`
    : `${m.in[1]}${ITEMS[m.in[0]].name}${m.water ? '＋1份白开水或山泉水' : ''} → ${m.out[1]}${ITEMS[m.out[0]].name}${m.out[2] ? '（赝品）' : ''} · ${m.days}晚${m.water ? '；纯净水不可用' : ''}`;
};
function openProduction(mid) {
  const m = MACHINES[mid];
  const selected = new Set(G.productionPlan(mid).inputUids);
  modal((close) => {
    const host = h('div.sheet.selection-sheet');
    const draw = (focusUid = null, error = '') => {
      const plan = G.productionPlan(mid, { uids: [...selected] });
      const eligible = new Set(plan.eligibleUids);
      const candidates = [...G.S.shelf, ...G.businessView().warehouse.items].filter((it) => eligible.has(it.uid)).map((it) => G.productionPlan(mid, { uids: [it.uid] }).inputs[0]).filter(Boolean);
      fill(host,
        h('h2', m.name, closeX(close)),
        h('div.label', `${recipeText(mid)} · 最多${G.machineCapacity(mid)}批`),
        h('div.scroll', candidates.length ? h('div.selection-grid', candidates.map((it) => choiceTile(it, selected,
          () => { selected.has(it.uid) ? selected.delete(it.uid) : selected.add(it.uid); draw(it.uid); }))) : h('div.empty-state', '货架与原料仓中没有可用原料')),
        productionFlow(plan),
        h('div.selection-status', { role: 'status', 'aria-live': 'polite' },
          error || (!plan.ok ? plan.reason : `${arrivalText(plan.days)} · 入库需${plan.outputCount}格${mid === 'purifier' ? ` · 耗滤芯${plan.filterCost}点，余${plan.filterAfter}点` : ''}`)),
        h('div.row',
          h('button.btn.paper', { onclick: close }, '取消'),
          h('button.btn.mint', { disabled: !plan.ok || !!error, onclick: async () => {
            const current = G.productionPlan(mid, { uids: [...selected] });
            if (!current.ok) { draw(null, current.reason); return; }
            const started = await transactRun(commandId('production'), () => ({ok:G.runMachine(mid,{uids:[...selected]})}));
            if (!started.ok) { draw(null, G.productionPlan(mid, { uids: [...selected] }).reason || '所选原料不符合配方，请改选'); return; }
            sfx('good'); close(); renderNight();
            toast(`${m.name}已开工，${arrivalText(current.days)}`);
            stage.querySelector('.night-screen .bar .btn.big')?.focus();
          } }, `开工${plan.batches ? ' ×' + plan.batches : ''}`)),
      );
      if (focusUid != null) host.querySelector(`[data-choice="${focusUid}"]`)?.focus();
      else if (host.isConnected) (host.querySelector('.choice') || host.querySelector('button'))?.focus();
    };
    draw();
    return host;
  });
}
function nightWork(body) {
  businessUI.workshop(body);
  const S = G.S;
  const list = h('div.machine-list');
  for (const [mid, m] of Object.entries(MACHINES)) {
    const owned = S.owned[mid], job = S.machines[mid];
    const plan = owned && !job ? G.productionPlan(mid) : null;
    const state = job?.ready ? S.shelf.length >= S.shelfCap ? `货架满，${job.n}份成品留机` : `${job.n}份成品待收`
      : job ? `还需${job.left}晚` : !owned ? recipeText(mid) : plan.ok ? `${arrivalText(plan.days)} · 入库需${plan.outputCount}格` : plan.reason;
    list.append(h('div.machine-row',
      h('div.machine-head', h('div.machine-icon', img(itemImg(m.icon))), h('div.grow', h('div.t', m.name), owned&&h('div.machine-status',`最多${G.machineCapacity(mid)}批 · ${m.days}晚`), owned && mid === 'purifier' && h('div.machine-status', `滤芯 ${S.filter}点`)),
        !owned ? h('span.label', '小铺有售') : job?.ready ? h('button.btn.small.mint', {disabled:S.shelf.length>=S.shelfCap,onclick:async()=>{const r=await executeBusiness('collectMachine',{machine:mid});if(r.ok){renderNight();toast(`收取${r.count}份${r.remaining?'，机器余'+r.remaining+'份':''}`);}}}, '收取') : !job ? h('button.btn.small.mint', { 'data-machine': mid, disabled: !plan.ok, onclick: () => openProduction(mid) }, '选料') : null),
      plan?.inputs.length ? productionFlow(plan) : null,
      h('div.machine-status', state),
      owned && businessUI.machineActions(mid),
    ));
  }
  body.append(list);
}
function nightShop(body) {
  businessUI.suppliers(body);
  const S = G.S;
  const list = h('div.list');
  for (const u of UPGRADES) {
    if (u.need && !S.up[u.need]) continue;
    const has = !u.repeat && S.up[u.id];
    list.append(h('div.li.px' + (has ? '.done' : ''),
      h('div.icon', img(itemImg({ shelf1: 'yarn', shelf2: 'yarn', hide1: 'chip', hide2: 'chip', lens: 'watch', guide: 'ticket', lucky: 'bell', lawfee: 'dryfish', gangfee: 'dryfish', filter: 'dirtywater', uv: 'water', dew: 'dirtywater', fridge: 'water', dark: 'claw', wsign: 'water' }[u.id] || MACHINES[u.id]?.icon || 'scrap'))),
      h('div.grow', h('div.t', u.name), h('div.d', u.id === 'filter' ? `${S.filter} → ${S.filter + 10}点（+10） · ${u.d}` : u.d)),
      has ? h('span.label', '已拥有') : h('button.btn.small', { disabled: S.money < u.cost ? true : null, onclick: () => { if (G.buyUpgrade(u)) { floatMoney(-u.cost); checkAch(); saveRun(); renderNight(); } } }, img(fishIcon), String(u.cost)),
    ));
  }
  list.querySelectorAll('.li .btn img').forEach((i) => (i.style.cssText = 'width:20px;height:20px'));
  body.append(h('div.label', '乔伊：「好东西，童叟无欺～」'), list);
}
function nightFront(body) {
  const S = G.S;
  const signs = Object.entries(SIGNS).filter(([, g]) => !g.need || S.up[g.need]);
  const win = G.winItems();
  appendContent(body,
    h('div.label', `橱窗 ${win.length}/3 · 摆出来的货会吸引对应的买家`),
    h('div.shelf-grid', S.shelf.map((it) => h('button.slot.px' + (S.win.includes(it.uid) ? '.sel' : ''), {
      onclick: () => { if (!G.toggleWin(it)) toast('橱窗最多摆 3 件'); saveRun(); renderNight(); },
    }, itemTags(it), img(icon(it)), nm(it)))),
    h('div.label', '听说珍珠夫人只认好水；摆两件宝贝，收藏家也会闻讯而来。'),
    h('div.label', '灯牌（决定明天来的客人）'),
    h('div.list', signs.map(([k, g]) => h('button.li.px.sign' + (S.sign === k ? '.on' : ''), { onclick: () => { mutateRun('sign',draft=>{draft.sign=k;});renderNight(); } },
      h('div.grow', h('div.t', g.name), h('div.d', g.d)), S.sign === k ? h('span.label', '亮着') : null))),
    signs.length < 4 && h('div.label', '乔伊小铺还有别的灯牌'),
  );
  businessUI.frontage(body);
  networkUI.frontage(body);
}
function nightBook(body) {
  businessUI.ledger(body);
  const S = G.S;
  const rent = G.rentInfo();
  const rep = (k) => {
    const v = S.rep[k];
    return h('div.rep', h('span', { style: 'width:62px' }, FACS[k].name), h('div.bar5', Array.from({ length: 5 }, (_, i) => h('i', { style: v > i ? `background:${FACS[k].color}` : '' + (v < 0 && i < -v ? 'background:var(--red)' : '') }))), h('span', { style: 'width:28px;text-align:right' }, String(v)));
  };
  const next = G.newsObj(S.nextNews);
  appendContent(body,
    h('div.card.px', { style: 'flex-direction:column;align-items:stretch;gap:0' },
      h('div.stat', h('span', '手头鱼币'), h('b', String(S.money))),
      h('div.stat', h('span', '身家（含存货）'), h('b', String(G.netWorth()))),
      h('div.stat', h('span',S.business.ownership.owned?'店铺产权':`下次房租（${rent.days ? rent.days + '天后' : '今天'}）`), h('b',S.business.ownership.owned?'永久免租':String(rent.amount))),
      !S.business.ownership.owned&&h('div.stat', h('span', '赎店价格'), h('b', String(BUYOUT))),
    ),
    h('div.card.px', { style: 'flex-direction:column;align-items:stretch;gap:6px' }, h('div.label', '阵营好感（≥2 可以刷脸）'), Object.keys(FACS).map(rep)),
    S.night.peek ? h('div.card.px', { style: 'background:#fff1c9' }, h('div.grow', h('div.nm', '明日：' + next.t), h('div.meta', next.d)))
      : ads.available && h('button.btn.sky', { onclick: async () => { if (await playAd()) { mutateRun('peek',draft=>{draft.night.peek=true;});renderNight(); } } }, '打听明日行情 ', h('span.ad', '看视频')),
    h('button.btn.big.pink', { disabled: G.businessView().ownership.owned || G.canBuyout() ? null : true, onclick: ()=>G.businessView().ownership.owned?networkUI.open():confirmBuyout() }, G.businessView().ownership.owned ? '生意版图' : `赎回店铺 ${BUYOUT}`),
  );
}
function confirmBuyout() {
  const v = G.businessView(), debt = G.S.rentDue || 0, total = BUYOUT + debt;
  if (v.ownership.owned) return modal(close => h('div.dialog.px', h('h2', '老店已赎回', closeX(close)), h('p.machine-status','永久免租。下一步建设中央作坊，开拓港区与精品街。'),h('div.row', h('button.btn.paper', { onclick: close }, '继续经营'), h('button.btn.mint', { onclick: () => { close(); networkUI.open(); } }, '生意版图'))), {center:true});
  modal(close => h('div.dialog.px', h('h2', '赎回店铺', closeX(close)),
    h('div.stat', h('span', '产权款'), h('b', String(BUYOUT))),
    h('div.stat', h('span', '已发生欠租'), h('b', String(debt))),
    h('div.stat', h('span', '支付后余额'), h('b', String(G.S.money-total))),
    h('button.btn.pink', { disabled:G.S.money<total, onclick:async()=>{const r=await executeBusiness('buyout',{});if(!r.ok)return;unlock('buyout');close();refreshBusiness();confirmBuyout();}}, '支付并永久免租')), {center:true});
}
function tradeInProgress(c){return !!(c&&(c.kind==='buy'&&c.item||c.kind==='sell'&&(tradePrices.get(c)?.touched||c.negotiation||c.checks?.some(Boolean)||c.charmed||c.obs?.some(Boolean))));}
async function advanceManaged() {
  if (busy || transactionBusy || !G.S) return;
  if(G.S.phase==='day'&&tradeInProgress(G.current()))return toast('先完成当前交易');
  const completedBefore=G.businessView().network?.goal.completedDay;
  const result=await transactRun(commandId('managed-advance'),()=>Rules.advanceManaged());
  if(!result.ok)return;
  if(G.S.phase==='day')renderDay();
  else if(G.S.phase==='night')renderNight();
  if(result.reason)toast(result.reason+(result.filteredOrders?` · 已婉拒${result.filteredOrders}份缺货新单`:''));
  if(!completedBefore&&G.businessView().network?.goal.completedDay)networkUI.review();
}
async function goSleep(confirmed = false) {
  if(G.S?.phase!=='night')return;
  const S = G.S;
  const due = G.businessView().contracts.filter(c => c.status === 'active' && c.due === S.day && c.delivered < c.qty);
  if (due.length && !confirmed) return modal(close => h('div.dialog.px', h('h2', '还有到期货物', closeX(close)), h('p', `今天还缺${due.reduce((n,c)=>n+c.qty-c.delivered,0)}份，睡觉后截止。`), h('div.row', h('button.btn.mint',{onclick:()=>{close();openOrders();}},'去交付'),h('button.btn.paper',{onclick:()=>{close();goSleep(true);}},'仍然睡觉'))), {center:true});
  if (S.night.opened.length < S.night.free && !S.nightWarned) { S.nightWarned = true; return toast('还没翻箱子哦，再点一次「睡觉」就直接睡'); }
  const result = await transactRun(`${S.runId}:sleep:${S.day}`, draft => {
    draft.nightWarned=false;draft.nightTut=false;draft.morningOut=G.sleep();
    const expired=G.expireOrders(), lost=G.voidFakeCash();G.startDay();return {ok:true,expired,lost};
  });
  if (!result.ok) return;
  nightTab='scav';checkAch();showMorning(false,result.expired,result.lost);
}

// ───── 货架 / 订单 / 菜单 ─────
function openShelf() {
  modal((close) => {
    const host = h('div.sheet.inventory-sheet');
    const draw = (sel, inspection = '') => {
      const S = G.S;
      if(sel) sel = G.allItems().find(it=>it.uid===sel.uid);
      const slot = (it, hid) => h('button.slot.px' + (hid ? '.hid' : '') + (sel === it ? '.sel' : ''), { onclick: () => draw(it) }, itemTags(it), img(G.isWater(it)&&it.gk&&G.grade(it)<=2?itemImg('dirtywater'):icon(it)), G.isWater(it)&&it.gk?WG[G.grade(it)].n:nm(it));
      const empty = (n) => Array.from({ length: n }, () => h('div.slot.empty'));
      fill(host, 
        h('h2', '货架', h('span.label', `${S.shelf.length}/${S.shelfCap}`), closeX(close)),
        h('div.scroll',
          h('div.shelf-grid', S.shelf.map((it) => slot(it, false)), empty(S.shelfCap - S.shelf.length)),
          S.hiddenCap > 0 && h('div', { style: 'margin-top:14px' }, h('div.label', `暗格 ${S.hidden.length}/${S.hiddenCap} · 查店查不到`), h('div.shelf-grid', { style: 'margin-top:6px' }, S.hidden.map((it) => slot(it, true)), empty(S.hiddenCap - S.hidden.length))),
        ),
        sel && h('div', { style: 'display:flex;flex-direction:column;gap:10px' },
          inspection && h('div.selection-status',{role:'status'},inspection),
          itemCard(sel, { stock:true,known:sel.known,showStolen: sel.stolenKnown, right: sel.cost ? h('div.label', `进价 ${sel.cost}`) : null }),
          h('div.row.inventory-actions',
            S.phase === 'night' && h('button.btn.small.mint',{onclick:async()=>{const r=await executeBusiness('inspectStock',{uid:sel.uid});if(r.ok)draw(sel,r.inspection.text);}},'验货'),
            G.canLabel(sel) && h('button.btn.small.pink', { disabled: S.money < 2 ? true : null, onclick: () => { if (G.labelWater(sel)) { sel.selfLab = true; sfx('good'); saveRun(); } draw(sel); } }, '贴「纯净水」标 −2'),
            sel.selfLab && h('button.btn.small.paper', { onclick: () => { G.unlabel(sel); sel.selfLab = false; saveRun(); draw(sel); } }, '撕标签'),
            S.hiddenCap > 0 && h('button.btn.small', { onclick: () => { if (!G.moveItem(sel)) toast(S.hidden.includes(sel) ? '货架满了' : '暗格满了'); else saveRun(); draw(); } }, S.hidden.includes(sel) ? '摆上货架' : '藏进暗格'),
            h('button.btn.small.paper', { onclick: () => { close(); businessUI.delegate(sel); } }, '交给店员'),
            h('button.btn.small.red', { disabled:!!G.businessView().reservations[sel.uid], onclick: () => { G.removeItem(sel); saveRun(); draw(); } }, '丢掉'))),
      );
    };
    draw();
    return host;
  }, { onClose: refreshBusiness });
}
const deadlineText = (o) => o.due === G.S.day ? '今天截止（含今天）' : `第${o.due}天截止（含当天） · 剩${Math.max(0, o.due - G.S.day)}天`;
function openOrders() {
  modal(close => { const host = h('div.sheet.selection-sheet'); businessUI.orders(host, close, openLegacyOrders); return host; }, { onClose: refreshBusiness });
}
function openLegacyOrders() {
  modal((close) => {
    const host = h('div.sheet.selection-sheet');
    const drawOrders = () => {
      fill(host,
        h('h2', '送货订单', closeX(close)),
        G.S.orders.length ? h('div.scroll', h('div.list', G.S.orders.map((o) => {
          const plan = G.orderPlan(o);
          return h('div.order-row',
            h('div.order-heading', img(itemImg(o.id)), h('div.grow', h('div.t', `${G.orderName(o)} ×${o.qty}`), h('div.d', deadlineText(o)))),
            h('div.order-status', h('span', `候选 ${Math.min(o.qty, plan.have)}/${o.qty} · 缺${Math.max(0, o.qty - plan.have)}`), h('b', `报酬 ${o.reward}`)),
            h('div.label', o.id === 'water' ? '品质不加价；未验货物交付时核验' : '未鉴定货物交付时核验'),
            h('button.btn.small.mint', { 'data-order': o.uid || `${o.id}-${o.due}`, onclick: () => drawDelivery(o) }, '选货交付'),
          );
        }))) : h('div.empty-state', '还没有订单，机器人偶尔会来下单。'),
      );
      if (host.isConnected) (host.querySelector('[data-order]') || host.querySelector('button'))?.focus();
    };
    const drawDelivery = (o, selected = new Set(G.orderPlan(o).inputUids), focusUid = null, error = '') => {
      const plan = G.orderPlan(o, [...selected]);
      const eligible = new Set(plan.eligibleUids);
      const candidates = G.allItems().filter((it) => eligible.has(it.uid)).map((it) => G.orderPlan(o, [it.uid]).inputs[0]).filter(Boolean);
      fill(host,
        h('h2', `${G.orderName(o)} ×${o.qty}`, closeX(close)),
        h('div.label', deadlineText(o)),
        h('div.order-status', h('span', `已选 ${selected.size}/${o.qty}`), h('b', `总报酬 ${o.reward}`)),
        h('div.label', o.id === 'water' ? '品质不加价，默认优先已验低档水' : '未鉴定货物交付时核验'),
        h('div.scroll', candidates.length ? h('div.selection-grid', candidates.map((it) => choiceTile(it, selected,
          () => { selected.has(it.uid) ? selected.delete(it.uid) : selected.add(it.uid); drawDelivery(o, selected, it.uid); },
          G.S.hidden.some((item) => item.uid === it.uid)))) : h('div.empty-state', '没有可交付的货物')),
        planItems(plan.inputs, '尚未选货'),
        h('div.selection-status', { role: 'status', 'aria-live': 'polite' }, error || (plan.ok ? '确认后交出所选货物' : plan.reason)),
        h('div.row', h('button.btn.paper', { onclick: drawOrders }, '返回订单'),
          h('button.btn.mint', { disabled: !plan.ok || !!error, onclick: () => {
            const current = G.orderPlan(o, [...selected]);
            if (!current.ok) { drawDelivery(o, selected, null, current.reason); return; }
            if (!G.deliver(o, [...selected])) { drawDelivery(o, selected, null, G.orderPlan(o, [...selected]).reason || '所选货物不符合要求，未交付'); return; }
            floatMoney(o.reward); sfx('good'); checkAch(); saveRun(); refreshBar(); refreshHud(); drawOrders();
            host.querySelector('button:not([disabled])')?.focus();
          } }, `确认交付 +${o.reward}`)),
      );
      if (focusUid != null) host.querySelector(`[data-choice="${focusUid}"]`)?.focus();
      else if (host.isConnected) (host.querySelector('.choice') || host.querySelector('button'))?.focus();
    };
    drawOrders();
    return host;
  }, { onClose: () => { refreshBar(); refreshHud(); if (G.S.phase === 'day') { const c = G.current(); if (c && !busy && c.kind === 'buy') c.item ? drawBuyHaggle(c) : drawBuyPick(c); } } });
}
function openMenu() {
  modal((close) => h('div.dialog.px',
    h('h2', '菜单', closeX(close)),
    h('div.row', h('button.btn.paper', { onclick: openAch }, '成就'), h('button.btn.paper', { onclick: openBoard }, '排行榜')),
    h('button.btn.paper', { onclick: openHelp }, '玩法说明'),
    h('button.btn.paper',{onclick:()=>{close();businessUI.operations();}},'经营安排'),
    h('div.row',
      h('button.btn.small.paper', { onclick: (e) => { meta.music = sound.music = !sound.music; saveMeta(); e.target.textContent = `音乐：${sound.music ? '开' : '关'}`; music(sound.music ? (G.S?.phase === 'night' ? 'night' : 'day') : null); } }, `音乐：${sound.music ? '开' : '关'}`),
      h('button.btn.small.paper', { onclick: (e) => { meta.sfx = sound.sfx = !sound.sfx; saveMeta(); e.target.textContent = `音效：${sound.sfx ? '开' : '关'}`; } }, `音效：${sound.sfx ? '开' : '关'}`)),
    h('button.btn.red', { onclick: () => { close(); saveRun(); renderTitle(); } }, '回到标题（自动存档）'),
  ), { center: true });
}
function openAch() {
  const n = ACHS.filter((a) => meta.ach[a.id]).length;
  modal((close) => h('div.sheet',
    h('h2', '成就', h('span.label', `${n}/${ACHS.length}`), closeX(close)),
    h('div.scroll', h('div.ach-grid', ACHS.map((a) => h('div.ach.px' + (meta.ach[a.id] ? '' : '.lock'), h('div.t', a.name), h('div.d', a.d))))),
  ));
}
function openBoard() {
  modal((close) => h('div.dialog.px',
    h('h2', '排行榜', closeX(close)),
    h('div.card.px', { style: 'flex-direction:column;align-items:stretch;gap:0' },
      h('div.stat', h('span', '我的最高身家'), h('b', String(meta.best))),
      h('div.stat', h('span', '我的最快赎店'), h('b', meta.fastest ? meta.fastest + ' 天' : '—'))),
    board.available ? h('div.row',
      h('button.btn', { onclick: () => board.open('worth') }, '身家榜'),
      h('button.btn', { onclick: () => board.open('fast') }, '赎店榜'))
      : h('div.label', '在 TapTap 中打开即可查看全服排行'),
  ), { center: true });
}
function openHelp() {
  modal((close) => h('div.sheet',
    h('h2', '玩法说明', closeX(close)),
    h('div.scroll.help',
      h('p', '你是橘子，太空站上一家小当铺的店主。每周五要给房东胖大海交房租，交不上就得关门。攒够 ', h('b', `${BUYOUT} 鱼币`), ' 先赎回老店，再建中央作坊与两家分店，连续三期全部盈利。'),
      h('p', h('b', '收货：'), '估价仅供参考。调价后「出价」砍价，未谈成会耗♥，差距过大多耗；♥用完客人就走。'),
      h('p', h('b', '鉴定：'), '按线索选部位查验。✓仅说明此处正常，未查处仍有风险；✗确认赝品，⚠表示赃物。查验、观察、议价共用♥，放大镜首查免费。'),
      h('p', h('b', '卖货：'), '选货后看「客人出价」，可报价或直接成交。未鉴定的货仍有真假风险。'),
      h('p', h('b', '赃物和违禁品：'), '警长查店会没收货架上的，藏进暗格就安全了。野猫帮最爱收违禁品。'),
      h('p', h('b', '阵营好感：'), '公道交易会涨好感，≥2 可以「刷脸」让对方让步。'),
      h('p', h('b', '卖水：'), '集露得到怪味水，净水提升2档，紫外线灯把上限升到纯净水。作坊先选料看产物、滤芯和工期，再开工。收水时用试纸确认水质；贴标不改变真实水质。制冰盒免费加冰，冰水成交吸引次日饮品客。'),
      h('p', h('b', '门面：'), '夜里挑灯牌和橱窗。霓虹招来卖家，暗灯招销赃客也更招警长，水牌招卖水客；橱窗吸引同类买家，不保证每件当天卖出。'),
      h('p', h('b', '赃物热度：'), '🔥 越高越便宜，警长也越容易上门。每过一晚降 1，降到 0 就洗白了。'),
      h('p', h('b', '伪猫：'), '第4天起留意眼睛、胡须、呼噜的细节；真猫也会有线索。观察发现代码、金属丝、电流声等证据再举报，一处正常不能排除其余。误报掉好感，假钱次晨消失。'),
      h('p', h('b', '订单：'), '按候选选货，交付前可改；截止日当天有效。水需白开水以上，品质高不加价，未验货交付时核验。'),
      h('p', h('b', '夜晚：'), '拾荒翻箱子、作坊加工（废铁炼铁锭、净水、酿酒……）、乔伊小铺买升级。'),
      h('p', h('b', '行情：'), '每天的新闻会让某些货涨价或跌价，看准时机进货出货。'),
    ),
  ));
}

// ───── 结局 ─────
function finish(win) {
  const S = G.S;
  const worth = G.netWorth();
  const days = S.day;
  meta.best = Math.max(meta.best, worth);
  if (win && S.rulesetVersion !== 'growth-v1') { meta.fastest = meta.fastest ? Math.min(meta.fastest, days) : days; unlock('buyout'); if (days <= 25) unlock('fast'); }
  saveMeta();
  board.submit(worth, win ? (S.business?.ownership?.day || days) : 0, S.rulesetVersion);
  try { session.remove(); } catch(error) { toast(error.message); return; }
  music(win ? 'day' : 'night');
  if (win) sfx('ach'); else sfx('bad');
  fill(stage, h('div.screen', { style: `background:${win ? '#ffe9c4' : '#3b2a33'}` },
    h('div.panel', { style: 'justify-content:center;gap:14px;padding:24px 22px' },
      h('div.end-hero', img(catImg(win ? 'player' : 'landlord')),
        h('h2', { style: win ? '' : 'color:var(--cream)' }, win ? '店铺是我的啦！' : '当铺关门了……'),
        h('div.label', { style: win ? '' : 'color:#f5d2a8' }, win ? `第 ${days} 天，橘子赎回了喵喵当铺。` : `第 ${days} 天，交不起房租的橘子收拾起行李。`)),
      h('div.card.px', { style: 'flex-direction:column;align-items:stretch;gap:0' },
        h('div.stat', h('span', '营业天数'), h('b', String(days))),
        h('div.stat', h('span', '最终身家'), h('b', String(worth))),
        h('div.stat', h('span', '收货 / 卖货'), h('b', `${S.st.buy} / ${S.st.sell}`)),
        h('div.stat', h('span', '识破赝品'), h('b', String(S.st.fakeSpot))),
        h('div.stat', h('span', '历史最高身家'), h('b', String(meta.best)))),
      h('div.row', h('button.btn.paper', { onclick: openBoard }, '排行榜'), h('button.btn.paper', { onclick: openAch }, '成就')),
      h('button.btn.big', { onclick: newGame }, '再开一家'),
      h('button.btn.small.paper', { onclick: renderTitle }, '回到标题'),
    )));
  G.setState(null);
}
const victory = () => confirmBuyout();
function gameOver() {
  modal((close) => h('div.dialog.px',
    h('h2', '真的交不起了？'),
    h('p', { style: 'font-size:16px;line-height:1.5' }, '可以先把货卖给三花姐凑钱。确定的话，当铺就要关门了。'),
    h('div.row', h('button.btn.paper', { onclick: close }, '再想想'), h('button.btn.red', { onclick: () => { close(); finish(false); } }, '关门')),
  ), { center: true });
}

// ───── 启动 ─────
fit();
// Retry inside every activation: returning from a phone interruption may require
// a fresh touchend (pointerdown alone is not an activation on mobile browsers).
for (const event of ['pointerdown', 'pointerup', 'touchend', 'keydown']) {
  document.addEventListener(event, unlockAudio, { capture: true, passive: true });
}
window.addEventListener('pageshow', unlockAudio);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && session.writable) { try { saveRun(); } catch(error) {saveFailure=error;toast(error.message);} } else unlockAudio();
});
renderTitle();
globalThis.mmdpBoot?.ready();
document.getElementById('boot')?.setAttribute('hidden','');
ads.preload();
// 预载图片，减少首次出场闪烁
for (const id of Object.keys(CATS)) new Image().src = catImg(id);
for (const id of Object.keys(ITEMS)) new Image().src = itemImg(id);
