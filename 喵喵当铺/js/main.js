// 界面与流程：标题 → 白天（逐位客人）→ 房租 → 夜晚 → 睡觉 → …… → 结局
import { ITEMS, CATS, FACS, CATS_CAT, SPOTS, MACHINES, UPGRADES, ACHS, BUYOUT, WEEKDAYS, DAYS_PER_WEEK, WG, SIGNS, OBS, rentOf } from './data.js';
import * as G from './game.js';
import { ads, board, store } from './platform.js';
import { sfx, music, sound, unlockAudio } from './audio.js';

const RUN_KEY = 'mmdp_run', META_KEY = 'mmdp_meta', VER = 'v1.1.1';
const meta = Object.assign({ ach: {}, best: 0, fastest: 0, runs: 0, tut: false, sfx: true, music: true }, store.get(META_KEY, {}));
sound.sfx = meta.sfx; sound.music = meta.music;
const saveMeta = () => store.set(META_KEY, meta);
const saveRun = () => G.S && store.set(RUN_KEY, G.S);

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
    if (k.startsWith('on')) el.addEventListener(k.slice(2), (e) => { if (k === 'onclick') { sfx('tap'); unlockAudio(); } v(e); });
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
  const mask = h('div.mask' + (center ? '.center' : ''));
  const close = () => { mask.remove(); onClose?.(); };
  mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
  mask.append(build(close));
  stage.append(mask);
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
  const W = innerWidth, H = innerHeight;
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
  music('night');
  const hasRun = store.get(RUN_KEY, null)?.v === 2;
  fill(stage, h('div.screen.title',
    h('div.title-bg', { style: `background-image:url(assets/bg/title.jpg)` }),
    h('div.logo', h('h1', '喵喵当铺'), h('p', '可能是偷来的')),
    h('div.title-cat', { style: 'top:calc(50% - 150px)' }, img(catImg('player'))),
    h('div.title-menu',
      hasRun && h('button.btn.big.mint', { onclick: continueRun }, '继续营业'),
      h('button.btn.big', { onclick: () => (hasRun ? confirmNew() : newGame()) }, hasRun ? '重新开张' : '开张营业'),
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
function newGame() {
  G.newRun();
  G.S.tutorial = meta.tut;
  meta.runs++; saveMeta();
  beginDay(true);
}
function continueRun() {
  const s = store.get(RUN_KEY, null);
  if (!s || s.v !== 2) return newGame();
  G.setState(s);
  if (s.phase === 'night') renderNight();
  else renderDay();
}

// ───── 白天 ─────
let D = {}; // 当前白天界面的节点
let busy = false;

function beginDay(first) {
  const S = G.S;
  const expired = G.expireOrders();
  const lost = first ? 0 : G.voidFakeCash();
  G.startDay();
  saveRun();
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
    G.rentToday() && h('div.label', { style: 'color:var(--red)' }, `今天打烊后要交房租 ${G.rentAmount()} 鱼币`),
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
  const daysLeft = DAYS_PER_WEEK - 1 - G.weekday();
  return h('div.hud',
    h('div.money', img(fishIcon), h('span.m', String(S.money))),
    h('div.date', h('b', `第 ${G.week()} 周 · ${WEEKDAYS[G.weekday()]}`),
      h('small', `房租 ${G.rentAmount()} · ${daysLeft ? daysLeft + ' 天后' : '今天'}`)),
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
  D.scene = h('div.scene', { style: 'background-image:url(assets/bg/shop.jpg);height:var(--sh)' });
  D.panel = h('div.panel');
  const n = G.newsObj();
  fill(stage, h('div.screen',
    hud(),
    h('div.news', h('b', '今日'), `${n.t} · ${n.d}`),
    D.scene, D.panel,
    h('div.bar',
      D.shelfBtn = h('button.btn.paper', { onclick: openShelf }, `货架 ${S.shelf.length}/${S.shelfCap}`),
      D.orderBtn = h('button.btn.paper', { onclick: openOrders }, `订单 ${S.orders.length}`),
    ),
  ));
  if (S.queue.length && S.qi < S.queue.length && !document.querySelector('.mask')) showCustomer();
  else if (S.qi >= S.queue.length) endOfDay();
}
function refreshBar() {
  const S = G.S;
  if (D.shelfBtn) D.shelfBtn.textContent = `货架 ${S.shelf.length}/${S.shelfCap}`;
  if (D.orderBtn) {
    const ready = S.orders.some(G.canDeliver);
    D.orderBtn.textContent = `订单 ${S.orders.length}` + (ready ? ' · 可交付' : '');
    D.orderBtn.className = 'btn ' + (ready ? 'pink' : 'paper');
  }
}

function setScene(who, item) {
  clear(D.scene);
  D.cust = h('div.cust.enter', img(catImg(who)));
  D.scene.append(D.cust);
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
  fill(D.bubble, 
    h('div.who', c.name, c.title && h('span', '· ' + c.title), c.fac && h('span.fac', { style: `background:${FACS[c.fac].color}` }, FACS[c.fac].name)),
    h('div', text),
  );
}
function coach(text) {
  return h('div.coach.px', img(catImg('player')), h('div', text));
}

function showCustomer() {
  const c = G.current();
  busy = false;
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
  if (text) say(c.who, text);
  D.panel.querySelectorAll('button').forEach((b) => (b.disabled = true));
  if (mood === 'bad') { sfx('hiss'); D.cust?.classList.add('shake'); }
  if (mood === 'good') sfx('good');
  refreshHud(); refreshBar();
  await wait(1100);
  D.cust?.classList.remove('idle', 'shake'); D.cust?.classList.add('exit');
  await wait(380);
  G.S.qi++;
  saveRun();
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
const heartsEl = (n, max = 3) => h('span.hearts', Array.from({ length: Math.max(max, n) }, (_, i) => h('span' + (i < n ? '' : '.off'), '♥')));

function itemTags(it, { known = false, showStolen = false } = {}) {
  const t = [h('span.tag.cat', CATS_CAT[ITEMS[it.id].cat])];
  if (ITEMS[it.id].ban) t.push(h('span.tag.ban', '禁'));
  if (it.stolen && (showStolen || it.stolenKnown)) t.push(h('span.tag.stolen', '赃🔥' + (it.heat || 1)));
  if (it.fake && (known || it.known)) t.push(h('span.tag.fake', '赝'));
  if (G.isWater(it) && it.selfLab) t.push(h('span.tag.lab', '贴标'));
  else if (G.isWater(it) && !it.gk && !WG[G.grade(it)].eye) t.push(h('span.tag.cat', '未验'));
  if (G.S.win.includes(it.uid)) t.push(h('span.tag.win', '窗'));
  return h('span.tags', t);
}
function itemCard(it, opts = {}) {
  const e = G.estimate(it);
  return h('div.card.px',
    h('div.icon', img(icon(it))),
    h('div.grow',
      h('div.nm', nm(it), ' ', itemTags(it, opts)),
      h('div.meta', opts.exposed ? `识破了！${opts.claimed != null ? `说是${WG[opts.claimed].n}，` : ''}实价约 ${G.trueValue(it)}` : `行情 ${e.lo} ~ ${e.hi}` + (it.selfLab ? `（真身：${WG[G.grade(it)].n}）` : '')),
    ),
    opts.right,
  );
}

const SELL_LINES = [(n, p) => `我有件${n}，${p} 鱼币收不收？`, (n, p) => `看看这个${n}！${p} 鱼币就归你。`, (n, p) => `${n}，成色不错哦，${p} 鱼币。`];
function panelSell(c) {
  const name = c.claimed != null ? WG[c.claimed].n : nm(c.item);
  if (!c.said) {
    c.said = true;
    c.glitch = c.robo && Math.random() < 0.5;
    if (c.who === 'thief') c.line = `嘘……这${name}别问来路，${c.ask} 就给你。`;
    else if (c.who === 'lady' && c.story === 0) c.line = `这是母亲留下的${name}……${c.ask} 鱼币，求您了。我以后一定来赎回它。`;
    else if (c.who === 'lady') c.line = `又是我……这块${name}，${c.ask} 鱼币可以吗？`;
    else c.line = G.pick(SELL_LINES)(name, c.ask);
    if (c.glitch) c.line += G.pick(['（哔）', '喵。喵。喵。', '……（滋滋）']);
  }
  if (c.who === 'thief') c.item.stolenKnown = true;
  say(c.who, c.line);
  drawSell(c);
}
function drawSell(c) {
  const S = G.S, it = c.item, fac = CATS[c.who].fac;
  const full = S.shelf.length >= S.shelfCap;
  const e = G.estimate(it);
  const picker = pricePicker(c.exposed ? G.trueValue(it) * 0.7 : Math.min(c.ask, e.lo), 1, Math.max(c.ask, 10), (v) => { offerBtn.lastChild.textContent = v; offerBtn.disabled = v > S.money || full; });
  const spotNames = SPOTS[ITEMS[it.id].cat];
  const lensFree = S.up.lens && !c.lensUsed;
  const spots = h('div.spots', spotNames.map((n, i) => {
    const r = c.checks[i];
    const glyph = r === 'ok' ? '✓' : r === 'fake' ? '✗' : r === 'stolen' ? '⚠' : '？';
    return h('button.btn.paper.spot' + (r ? '.' + r : ''), {
      disabled: !r && c.pat <= 1 && !lensFree ? true : null,
      onclick: () => doCheck(c, i),
    }, h('b', glyph), n + (r ? '' : lensFree ? ' 免费' : ' −1♥'));
  }));
  const offerBtn = h('button.btn', { onclick: () => doOffer(c, picker.get()) }, '出价 ', h('span', String(picker.get())));
  offerBtn.disabled = picker.get() > S.money || full;
  const dealBtn = h('button.btn.mint', { onclick: () => doDeal(c, c.ask), disabled: c.ask > S.money || full ? true : null }, `成交 ${c.ask}`);
  const canCharm = fac && S.rep[fac] >= 2 && !c.charmed;
  fill(D.panel, 
    c.tut === 'haggle' && coach('客人开价偏高。用 −/+ 调价后点「出价」砍价，♥ 用完客人就走啦。'),
    c.tut === 'check' && coach('这罐头有点可疑……点下面三处「鉴定」，出现 ✗ 就是赝品！'),
    itemCard(it, { exposed: c.exposed, known: c.exposed, claimed: c.claimed, showStolen: c.who === 'thief' || c.checks[0] === 'stolen', right: h('div', { style: 'text-align:right' }, heartsEl(c.pat), h('div.label', `开价 ${c.ask}`)) }),
    spots,
    picker.node,
    full && h('div.label', { style: 'color:var(--red)' }, '货架满了，先整理一下货架'),
    h('div.row', offerBtn, dealBtn),
    h('div.row',
      fac && h('button.btn.small.pink', { disabled: canCharm ? null : true, onclick: () => { G.charm(c); say(c.who, `看在老熟人的份上……最低 ${c.ask}。`); drawSell(c); } }, `刷脸 −2 ${FACS[fac].name}好感`),
      full ? h('button.btn.small.paper', { onclick: openShelf }, '整理货架') : null,
      h('button.btn.small.paper', { onclick: () => leave(c.exposed ? '哼，算你厉害。' : '那我去别家看看。') }, '不收了'),
    ),
  );
}
function doCheck(c, i) {
  const r = G.checkSpot(c, i);
  sfx(r.res === 'ok' ? 'check' : 'bad');
  const name = SPOTS[ITEMS[c.item.id].cat][i];
  if (r.res === 'fake' && G.isWater(c.item)) say(c.who, `试纸变色了……这其实是${nm(c.item)}。好吧，按实价。`);
  else if (r.res === 'fake') say(c.who, '被、被发现了喵……那就按实价算你吧。');
  else if (G.isWater(c.item) && i === 2 && !r.free) say(c.who, `试纸显示：${nm(c.item)}。没骗你吧？`);
  else if (r.res === 'stolen') { c.item.stolenKnown = true; say(c.who, `${name}上刻着别人的名字……啊这个，我捡的！`); }
  else if (!r.free) say(c.who, c.pat <= 1 ? '你到底收不收啊？' : '看吧看吧，随便看。');
  if (c.pat <= 0) return leave('我没那么多时间陪你耗！', 'bad');
  checkAch();
  drawSell(c);
}
function doOffer(c, p) {
  const r = G.offerToSeller(c, p);
  if (r.r === 'deal') return doDeal(c, r.price);
  if (r.r === 'leave') return leave(r.angry ? '太过分了，不卖了！' : '谈不拢，我走了。', 'bad');
  say(c.who, r.angry ? `太过分了喵！最少 ${r.price}。` : G.pick([`那……${r.price} 怎么样？`, `${r.price}，不能再低了。`, `唔……${r.price} 吧。`]));
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
      : c.iceFan ? '昨天那杯冰水太爽了！今天带够钱了，还有水吗？'
      : c.collector ? '你橱窗里的宝贝，我在街口就看见了。价钱好商量。'
      : c.want === 'ban' ? '有没有……那种货？你懂的。价钱好说。' : c.who === 'kitten' ? `我攒了零花钱！想买${w}～` : G.pick([`有没有${w}？我想买一件。`, `我在找${w}，你这有吗？`]);
    if (c.robo && Math.random() < 0.5) c.line += G.pick(['（哔）', '喵。喵。喵。', '……（滋滋）']);
  }
  say(c.who, c.line);
  if (c.item && G.allItems().includes(c.item)) drawBuyHaggle(c); else drawBuyPick(c);
}
function drawBuyPick(c) {
  const S = G.S, all = G.allItems();
  const ok = all.filter((it) => G.wants(c, it));
  const grid = h('div.shelf-grid', all.map((it) => {
    const m = G.wants(c, it);
    return h('button.slot.px' + (m ? '' : '.dim') + (S.hidden.includes(it) ? '.hid' : ''), {
      disabled: m ? null : true,
      onclick: () => pickForBuyer(c, it),
    }, itemTags(it), img(icon(it)), nm(it));
  }));
  fill(D.panel, 
    c.tut === 'sell' && coach('小豆想要玩具。从货架选一件，再报个价。'),
    h('div.row', h('span.label.grow', `想要：${WANT_NAME(c.want, c.minG)}`), heartsEl(c.pat)),
    ok.length ? grid : h('div.card.px', h('div.grow', h('div.nm', '没有合适的货'), h('div.meta', '货架上没有对方想要的东西'))),
    h('div.row', h('button.btn.paper', { onclick: () => leave(G.pick(['好吧，下次再来。', '唔，那算了。'])) }, ok.length ? '不卖了' : '抱歉，没有')),
  );
}
function pickForBuyer(c, it) {
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
  const S = G.S, it = c.item, fac = CATS[c.who].fac, e = G.estimate(it);
  const picker = pricePicker(Math.max(e.hi, c.bid + 1), c.bid, Math.max(c.bid + 10, Math.round(e.hi * 2.2)), (v) => { askBtn.lastChild.textContent = v; });
  const askBtn = h('button.btn', { onclick: () => doAsk(c, picker.get()) }, '报价 ', h('span', String(picker.get())));
  const canCharm = fac && S.rep[fac] >= 2 && !c.charmed;
  fill(D.panel, 
    c.tut === 'sell' && coach('报个价试试。对方出价就是保底，点「成交」直接卖。'),
    itemCard(it, { known: it.known, showStolen: it.stolenKnown, right: h('div', { style: 'text-align:right' }, heartsEl(c.pat), h('div.label', `出价 ${c.bid}`)) }),
    it.cost ? h('div.label', `进价 ${it.cost}`) : null,
    picker.node,
    S.up.fridge && G.isWater(it) && h('button.btn.small.sky', { disabled: c.iced ? true : null, onclick: () => {
      c.iced = true; c.max = Math.round(c.max * 1.12); c.bid = Math.round(c.bid * 1.12); unlock('ice');
      say(c.who, '哇，冰的！好爽～明天我还来，多带点钱！'); drawBuyHaggle(c);
    } }, c.iced ? '已加冰 🧊' : '🧊 加冰块（客人更舍得花，明天还来）'),
    h('div.row', askBtn, h('button.btn.mint', { onclick: () => doSell(c, c.bid) }, `成交 ${c.bid}`)),
    h('div.row',
      fac && h('button.btn.small.pink', { disabled: canCharm ? null : true, onclick: () => { G.charm(c); say(c.who, `好吧好吧，给你 ${c.bid}。`); drawBuyHaggle(c); } }, `刷脸 −2 ${FACS[fac].name}好感`),
      h('button.btn.small.paper', { onclick: () => { c.item = null; c.iced = false; drawBuyPick(c); } }, '换一件'),
      h('button.btn.small.paper', { onclick: () => leave('那算了。') }, '不卖了'),
    ),
  );
}
function doAsk(c, p) {
  const r = G.askBuyer(c, p);
  if (r.r === 'deal') return doSell(c, r.price);
  if (r.r === 'leave') return leave(r.angry ? '抢钱啊！不买了！' : '太贵了，我走了。', 'bad');
  say(c.who, r.angry ? `你在开玩笑吧？最多 ${r.price}！` : G.pick([`${r.price}，不能再多了喵。`, `那……${r.price}？`, `咬咬牙，${r.price}！`]));
  if (r.angry) sfx('hiss');
  drawBuyHaggle(c);
}
function doSell(c, price) {
  const it = c.item;
  G.sellItem(c, price);
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
  modal((close) => {
    const host = h('div.dialog.px');
    const draw = () => fill(host,
      h('h2', '仔细观察', closeX(close)),
      h('div.label', '听说有机器人伪装成猫混进太空站……每看一处 −1♥'),
      h('div.row', { style: 'justify-content:flex-end' }, heartsEl(c.pat)),
      h('div.list', OBS.map((o, i) => h('div.li.px', h('div.grow', h('div.t', o.n), h('div.d', c.obs[i] || '……')),
        !c.obs[i] && h('button.btn.small', { disabled: c.pat <= 1 ? true : null, onclick: () => { const r = G.observe(c, i); sfx(r.bad ? 'bad' : 'check'); draw(); } }, '看看')))),
      h('div.row',
        h('button.btn.paper', { onclick: close }, '没问题'),
        h('button.btn.red', { onclick: () => { close(); doReport(c); } }, '🤖 举报伪猫')),
    );
    draw();
    return host;
  }, { center: true, onClose: () => { if (G.current() === c && !busy) { redraw(); refreshHud(); } } });
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
      h('div.row', h('button.btn.mint', { onclick: () => { S.st.clean++; G.addRep('law', 1); leave('继续保持！', 'good'); } }, '辛苦了')),
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
  say(c.who, `哔——订单：${o.qty} 份${G.orderName(o)}，${o.due - S.day} 天内送达，报酬 ${o.reward}。`);
  fill(D.panel, 
    h('div.card.px', h('div.icon', img(itemImg(o.id))), h('div.grow', h('div.nm', `${G.orderName(o)} ×${o.qty}`), h('div.meta', `第 ${o.due} 天前交付 · 报酬 ${o.reward}`)), h('div.label', '机器人会识破赝品')),
    h('div.row',
      h('button.btn.paper', { onclick: () => leave('哔……已取消。') }, '不接'),
      h('button.btn.mint', { disabled: S.orders.length >= 3 ? true : null, onclick: () => { G.acceptOrder(o); leave('哔！订单已登记。随时在「订单」里交付。', 'good'); } }, '接单')),
  );
}
function panelLady(c) {
  const S = G.S;
  const pearl = G.allItems().find((it) => it.uid === S.story.pearl);
  if (!pearl) {
    say(c.who, '我想赎回那串珍珠项圈……已经卖掉了吗。没关系，谢谢你。');
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
        G.removeItem(pearl); S.money += price; floatMoney(price); G.addRep('elite', 3);
        const t = G.mkItem('ticket', { q: 1 });
        const gift = S.shelf.length < S.shelfCap ? (S.shelf.push(t), true) : false;
        unlock('lady');
        leave(gift ? '谢谢你替我保管它……这张船票送给你，愿你也能去想去的地方。' : '谢谢你替我保管它……我会记住你的。', 'good');
      } }, `还给她 +${price}`)),
  );
}

// ───── 打烊 / 房租 ─────
function endOfDay() {
  const S = G.S;
  if (G.rentToday() && !S.rentDone) return rentScene();
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
    S.rentDone = true;
    say('landlord', text);
    refreshHud(); saveRun();
    D.panel.querySelectorAll('button').forEach((b) => (b.disabled = true));
    setTimeout(() => { D.cust?.classList.add('exit'); setTimeout(closeShop, 400); }, 1100);
  };
  fill(D.panel, 
    h('div.card.px', h('div.grow', h('div.nm', `房租 ${amt}`), h('div.meta', `手头 ${S.money} · 下周房租 ${rentOf(G.week() + 1)}`))),
    h('button.btn.big.mint', { disabled: S.money < amt ? true : null, onclick: () => {
      G.payRent(); floatMoney(-amt);
      if (S.rentPaid >= 1) unlock('week1');
      if (S.rentPaid >= 4) unlock('week4');
      if (S.money < 10) unlock('near');
      done('收到啦，下周见喵～');
    } }, `付房租 ${amt}`),
    h('button.btn', { onclick: () => modal((close) => {
      const host = h('div.sheet');
      fenceUI(host, close, () => { close(); rentScene(); }, h('h2', '找三花姐变现', closeX(close)));
      return host;
    }) }, '找三花姐变现'),
    ads.available && !S.graceUsed && h('button.btn.sky', { onclick: async () => {
      if (await playAd()) { G.graceRent(); done(`好吧，宽限一周。下周一起交 ${G.rentAmount()} 哦。`); }
    } }, '求房东宽限一周 ', h('span.ad', '看视频')),
    S.money < amt && h('button.btn.small.red', { onclick: () => gameOver() }, '交不起了……'),
  );
}

async function playAd() {
  const cover = h('div.adplay', '视频加载中……');
  stage.append(cover);
  music(null);
  const r = await ads.show();
  cover.remove();
  music(G.S?.phase === 'night' ? 'night' : 'day');
  if (!r.ok) toast(r.msg || '视频未完成');
  return r.ok;
}

// ───── 夜晚 ─────
let nightTab = 'scav';
function renderNight() {
  music('night');
  const S = G.S;
  const tabs = [['scav', '拾荒'], ['work', '作坊'], ['front', '门面'], ['shop', '小铺'], ['book', '账本']];
  const body = h('div.panel', { style: 'padding-top:14px' });
  const bg = nightTab === 'work' ? 'workshop' : 'night';
  const workReady = Object.keys(S.owned).some((m) => !S.machines[m] && G.machineInputs(m) > 0);
  fill(stage, h('div.screen',
    hud(),
    h('div.scene', { style: `background-image:url(assets/bg/${bg}.jpg);height:calc(var(--sh) - 90px)` },
      h('div.bubble.px', { style: 'right:auto;max-width:260px' }, h('div.who', '夜晚 · 打烊后'), h('div', nightTab === 'scav' ? '去垃圾场碰碰运气吧。' : nightTab === 'work' ? '叮叮当当，开工！' : nightTab === 'shop' ? '乔伊的小铺还亮着灯。' : nightTab === 'front' ? '明天橱窗摆点什么呢？' : '盘点一下今天的账。')),
      h('div.cust', { style: 'left:auto;right:4px;margin:0' }, img(catImg(nightTab === 'shop' ? 'joe' : 'player'))),
    ),
    h('div.tabs', tabs.map(([k, n]) => h('button.tab' + (nightTab === k ? '.on' : ''), { onclick: () => { nightTab = k; renderNight(); } }, n,
      (k === 'scav' && S.night.opened.length < S.night.free) || (k === 'work' && workReady) ? h('span.dot') : null))),
    body,
    h('div.bar',
      h('button.btn.paper', { onclick: openShelf }, `货架 ${S.shelf.length}/${S.shelfCap}`),
      h('button.btn.big', { onclick: goSleep }, '💤 睡觉'),
    ),
  ));
  if (S.nightTut) body.append(coach('夜晚：先选一个箱子拾荒，再去作坊开工、小铺升级，最后点「睡觉」。'));
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
  body.append(
    h('div.label', canOpen ? '选一个箱子打开（每晚一次）' : '今晚已经翻过了'),
    h('div.crates', N.crates.map(crate)),
    !canOpen && N.opened.length < 3 && ads.available && !N.extra && h('button.btn.sky', { onclick: async () => { if (await playAd()) { N.extra = true; N.free++; saveRun(); renderNight(); } } }, '再翻一个箱子 ', h('span.ad', '看视频')),
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
function nightWork(body) {
  const S = G.S;
  const list = h('div.list');
  for (const [mid, m] of Object.entries(MACHINES)) {
    const owned = S.owned[mid], job = S.machines[mid];
    const recipe = mid === 'purifier' ? `水质 +2 档，最高${WG[G.pureMax()].n} · 滤芯剩 ${S.filter} · ${m.days} 晚`
      : `${m.in[1]} ${ITEMS[m.in[0]].name}${m.water ? ' + 白开水/山泉水' : ''} → ${m.out[1]} ${ITEMS[m.out[0]].name}${m.out[2] ? '（赝品）' : ''} · ${m.days} 晚`;
    let right;
    if (!owned) right = h('span.label', '小铺有售');
    else if (job && job.ready) right = h('span.label', `待取 ${job.n}`);
    else if (job) right = h('span.label', `还要 ${job.left} 晚`);
    else {
      const b = G.machineInputs(mid);
      right = h('button.btn.small.mint', { disabled: b ? null : true, onclick: () => { G.runMachine(mid); sfx('good'); saveRun(); renderNight(); } }, b ? `开工 ×${b}` : '缺材料');
    }
    list.append(h('div.li.px' + (owned ? '' : '.done'), h('div.icon', img(itemImg(m.icon))), h('div.grow', h('div.t', m.name), h('div.d', recipe + `（每批最多 ${m.cap}）`)), right));
  }
  body.append(h('div.label', '开工后，睡一觉产物就放上货架'), list);
}
function nightShop(body) {
  const S = G.S;
  const list = h('div.list');
  for (const u of UPGRADES) {
    if (u.need && !S.up[u.need]) continue;
    const has = !u.repeat && S.up[u.id];
    list.append(h('div.li.px' + (has ? '.done' : ''),
      h('div.icon', img(itemImg({ shelf1: 'yarn', shelf2: 'yarn', hide1: 'chip', hide2: 'chip', lens: 'watch', guide: 'ticket', lucky: 'bell', lawfee: 'dryfish', gangfee: 'dryfish', filter: 'dirtywater', uv: 'water', dew: 'dirtywater', fridge: 'water', dark: 'claw', wsign: 'water' }[u.id] || MACHINES[u.id]?.icon || 'scrap'))),
      h('div.grow', h('div.t', u.name), h('div.d', u.d)),
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
  body.append(
    h('div.label', '灯牌（决定明天来的客人）'),
    h('div.list', signs.map(([k, g]) => h('button.li.px.sign' + (S.sign === k ? '.on' : ''), { onclick: () => { S.sign = k; saveRun(); renderNight(); } },
      h('div.grow', h('div.t', g.name), h('div.d', g.d)), S.sign === k ? h('span.label', '亮着') : null))),
    signs.length < 4 && h('div.label', '乔伊小铺还有别的灯牌'),
    h('div.label', `橱窗 ${win.length}/3 · 摆出来的货会吸引对应的买家`),
    h('div.shelf-grid', S.shelf.map((it) => h('button.slot.px' + (S.win.includes(it.uid) ? '.sel' : ''), {
      onclick: () => { if (!G.toggleWin(it)) toast('橱窗最多摆 3 件'); saveRun(); renderNight(); },
    }, itemTags(it), img(icon(it)), nm(it)))),
    h('div.label', '听说珍珠夫人只认好水；摆两件宝贝，收藏家也会闻讯而来。'),
  );
}
function nightBook(body) {
  const S = G.S;
  const daysLeft = DAYS_PER_WEEK - 1 - G.weekday();
  const rep = (k) => {
    const v = S.rep[k];
    return h('div.rep', h('span', { style: 'width:62px' }, FACS[k].name), h('div.bar5', Array.from({ length: 5 }, (_, i) => h('i', { style: v > i ? `background:${FACS[k].color}` : '' + (v < 0 && i < -v ? 'background:var(--red)' : '') }))), h('span', { style: 'width:28px;text-align:right' }, String(v)));
  };
  const next = G.newsObj(S.nextNews);
  body.append(
    h('div.card.px', { style: 'flex-direction:column;align-items:stretch;gap:0' },
      h('div.stat', h('span', '手头鱼币'), h('b', String(S.money))),
      h('div.stat', h('span', '身家（含存货）'), h('b', String(G.netWorth()))),
      h('div.stat', h('span', `下次房租（${daysLeft + 1} 天后）`), h('b', String(G.rentAmount()))),
      h('div.stat', h('span', '赎店价格'), h('b', String(BUYOUT))),
    ),
    h('div.card.px', { style: 'flex-direction:column;align-items:stretch;gap:6px' }, h('div.label', '阵营好感（≥2 可以刷脸）'), Object.keys(FACS).map(rep)),
    S.night.peek ? h('div.card.px', { style: 'background:#fff1c9' }, h('div.grow', h('div.nm', '明日：' + next.t), h('div.meta', next.d)))
      : ads.available && h('button.btn.sky', { onclick: async () => { if (await playAd()) { S.night.peek = true; saveRun(); renderNight(); } } }, '打听明日行情 ', h('span.ad', '看视频')),
    h('button.btn.big.pink', { disabled: G.canBuyout() ? null : true, onclick: confirmBuyout }, `赎回店铺 ${BUYOUT}`),
  );
}
function confirmBuyout() {
  modal((close) => h('div.dialog.px',
    h('h2', '赎回店铺？'),
    h('p', { style: 'font-size:16px;line-height:1.5' }, `付给胖大海 ${BUYOUT} 鱼币，当铺从此归你。本局结束。`),
    h('div.row', h('button.btn.paper', { onclick: close }, '再攒攒'), h('button.btn.pink', { onclick: () => { close(); victory(); } }, '赎回！')),
  ), { center: true });
}
function goSleep() {
  const S = G.S;
  if (S.night.opened.length < S.night.free && !S.nightWarned) {
    S.nightWarned = true;
    return toast('还没翻箱子哦，再点一次「睡觉」就直接睡');
  }
  S.nightWarned = false; S.nightTut = false;
  S.morningOut = G.sleep();
  nightTab = 'scav';
  checkAch();
  beginDay();
}

// ───── 货架 / 订单 / 菜单 ─────
function openShelf() {
  modal((close) => {
    const host = h('div.sheet');
    const draw = (sel) => {
      const S = G.S;
      const slot = (it, hid) => h('button.slot.px' + (hid ? '.hid' : '') + (sel === it ? '.sel' : ''), { onclick: () => draw(it) }, itemTags(it), img(icon(it)), nm(it));
      const empty = (n) => Array.from({ length: n }, () => h('div.slot.empty'));
      fill(host, 
        h('h2', '货架', h('span.label', `${S.shelf.length}/${S.shelfCap}`), closeX(close)),
        h('div.scroll',
          h('div.shelf-grid', S.shelf.map((it) => slot(it, false)), empty(S.shelfCap - S.shelf.length)),
          S.hiddenCap > 0 && h('div', { style: 'margin-top:14px' }, h('div.label', `暗格 ${S.hidden.length}/${S.hiddenCap} · 查店查不到`), h('div.shelf-grid', { style: 'margin-top:6px' }, S.hidden.map((it) => slot(it, true)), empty(S.hiddenCap - S.hidden.length))),
        ),
        sel && h('div', { style: 'display:flex;flex-direction:column;gap:10px' },
          itemCard(sel, { showStolen: sel.stolenKnown, right: sel.cost ? h('div.label', `进价 ${sel.cost}`) : null }),
          h('div.row',
            G.canLabel(sel) && h('button.btn.small.pink', { disabled: S.money < 2 ? true : null, onclick: () => { if (G.labelWater(sel)) { sel.selfLab = true; sfx('good'); saveRun(); } draw(sel); } }, '贴「纯净水」标 −2'),
            sel.selfLab && h('button.btn.small.paper', { onclick: () => { G.unlabel(sel); sel.selfLab = false; saveRun(); draw(sel); } }, '撕标签'),
            S.hiddenCap > 0 && h('button.btn.small', { onclick: () => { if (!G.moveItem(sel)) toast(S.hidden.includes(sel) ? '货架满了' : '暗格满了'); else saveRun(); draw(); } }, S.hidden.includes(sel) ? '摆上货架' : '藏进暗格'),
            h('button.btn.small.red', { onclick: () => { G.removeItem(sel); saveRun(); draw(); } }, '丢掉'))),
      );
    };
    draw();
    return host;
  }, { onClose: () => { if (G.S.phase === 'night') renderNight(); else { refreshBar(); refreshHud(); const c = G.current(); if (c && !busy) ({ sell: drawSell, buy: (x) => (x.item ? drawBuyHaggle(x) : drawBuyPick(x)) }[c.kind])?.(c); } } });
}
function openOrders() {
  modal((close) => {
    const S = G.S;
    return h('div.sheet',
      h('h2', '送货订单', closeX(close)),
      S.orders.length ? h('div.list', S.orders.map((o) => h('div.li.px',
        h('div.icon', img(itemImg(o.id))),
        h('div.grow', h('div.t', `${G.orderName(o)} ×${o.qty}`), h('div.d', `第 ${o.due} 天前 · 报酬 ${o.reward}`)),
        h('button.btn.small.mint', { disabled: G.canDeliver(o) ? null : true, onclick: () => { G.deliver(o); floatMoney(o.reward); sfx('good'); checkAch(); saveRun(); close(); openOrders(); } }, '交付'),
      ))) : h('div.label', '还没有订单。送货机器人 MEOW-7 偶尔会来下单。'),
    );
  }, { onClose: () => { refreshBar(); refreshHud(); if (G.S.phase === 'day') { const c = G.current(); if (c && !busy && c.kind === 'buy') c.item ? drawBuyHaggle(c) : drawBuyPick(c); } } });
}
function openMenu() {
  modal((close) => h('div.dialog.px',
    h('h2', '菜单', closeX(close)),
    h('div.row', h('button.btn.paper', { onclick: openAch }, '成就'), h('button.btn.paper', { onclick: openBoard }, '排行榜')),
    h('button.btn.paper', { onclick: openHelp }, '玩法说明'),
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
      h('p', '你是橘子，太空站上一家小当铺的店主。每周五要给房东胖大海交房租，交不上就得关门。攒够 ', h('b', `${BUYOUT} 鱼币`), ' 就能赎回店铺！'),
      h('p', h('b', '收货：'), '客人开价往往偏高。调价后「出价」砍价，每砍一次掉一颗 ♥，♥ 没了客人就走。'),
      h('p', h('b', '鉴定：'), '可疑的货点三处细节查看。出现 ✗ 是赝品，⚠ 是赃物。每查一处也要掉 ♥。'),
      h('p', h('b', '卖货：'), '客人说想要什么，就从货架挑一件报价。眼尖的客人会识破赝品。'),
      h('p', h('b', '赃物和违禁品：'), '警长查店会没收货架上的，藏进暗格就安全了。野猫帮最爱收违禁品。'),
      h('p', h('b', '阵营好感：'), '公道交易会涨好感，≥2 可以「刷脸」让对方让步。'),
      h('p', h('b', '卖水：'), '水分六档：水沟水、铁锈水、怪味水、白开水、山泉水、纯净水。只有前两种肉眼能看出来，其余要用「试纸」验。净水器每晚把水提两档（脏水费滤芯）；贴标台能给水贴「纯净水」标签——骗得过一般客人，骗不过自带试纸的珍珠夫人。有制冰盒的话，卖水时加冰，客人第二天会带更多钱回来。'),
      h('p', h('b', '门面：'), '夜里在「门面」挑灯牌和橱窗。霓虹招来卖家，暗灯招来销赃的流浪猫（警长也更爱来），水牌招来卖水的。橱窗摆什么，就来想买什么的客人。'),
      h('p', h('b', '赃物热度：'), '🔥 越高越便宜，警长也越容易上门。每过一晚降 1，降到 0 就洗白了。'),
      h('p', h('b', '伪猫：'), '第 4 天起，偶尔有机器人伪装成猫。点「👀 观察」看眼睛、胡须、呼噜，有破绽就「举报」领赏金。它卖的货是假的，付的钱第二天会消失；冤枉好猫会掉好感。'),
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
  if (win) { meta.fastest = meta.fastest ? Math.min(meta.fastest, days) : days; unlock('buyout'); if (days <= 25) unlock('fast'); }
  saveMeta();
  board.submit(worth, win ? days : 0);
  store.del(RUN_KEY);
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
const victory = () => { G.S.money -= BUYOUT; G.S.money += BUYOUT; finish(true); };
function gameOver() {
  modal((close) => h('div.dialog.px',
    h('h2', '真的交不起了？'),
    h('p', { style: 'font-size:16px;line-height:1.5' }, '可以先把货卖给三花姐凑钱。确定的话，当铺就要关门了。'),
    h('div.row', h('button.btn.paper', { onclick: close }, '再想想'), h('button.btn.red', { onclick: () => { close(); finish(false); } }, '关门')),
  ), { center: true });
}

// ───── 启动 ─────
fit();
document.addEventListener('pointerdown', unlockAudio, { once: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) saveRun(); });
renderTitle();
ads.preload();
// 预载图片，减少首次出场闪烁
for (const id of Object.keys(CATS)) new Image().src = catImg(id);
for (const id of Object.keys(ITEMS)) new Image().src = itemImg(id);
