// 界面与流程：标题 → 白天（逐位客人）→ 房租 → 夜晚 → 睡觉 → …… → 结局
import { ITEMS, CATS, FACS, CATS_CAT, SPOTS, SELLERS, MACHINES, MACHINE_MODS, UPGRADES, ACHS, BUYOUT, WEEKDAYS, DAYS_PER_WEEK, WG, SIGNS, OBS, rentOf } from './data.js';
import * as G from './game.js';
import { EQUIPMENT } from './equipment.js';
import { ads, board, store } from './platform.js';
import { sfx, music, sound, unlockAudio } from './audio.js';
import { MECHANIC_LESSONS, itemLessonKeys } from './lessons.js';

const RUN_KEY = 'mmdp_run', META_KEY = 'mmdp_meta', VER = 'v1.6.4';
const meta = Object.assign({ ach: {}, best: 0, fastest: 0, runs: 0, tut: false, sfx: true, music: true, mechanicSeen: {} }, store.get(META_KEY, {}));
sound.sfx = meta.sfx; sound.music = meta.music;
const saveMeta = () => { const ok = store.set(META_KEY, meta); metaSaveIssue = ok ? '' : '成就与设置未能保存，请重试。'; showSaveIssue(); return ok; };
let saveIssue = '', metaSaveIssue = '', protectedRun = false;
const runRecord = () => store.read(RUN_KEY);
function usableRun(v) {
  try {
    const nat = (x) => Number.isSafeInteger(x) && x >= 0;
    if (v?.v !== 2 || !nat(v.day) || v.day < 1 || !Number.isFinite(v.money) || !nat(v.uid) || !nat(v.shelfCap) || !nat(v.hiddenCap) || !nat(v.qi)) return false;
    if (![v.shelf, v.hidden, v.queue, v.win, v.orders].every(Array.isArray) || v.qi > v.queue.length || !v.up || !v.st || !v.rep || !v.story || !v.owned || !v.machines || !['day', 'night'].includes(v.phase)) return false;
    const validItem = (it) => it && ITEMS[it.id] && nat(it.uid) && (it.g === undefined || nat(it.g) && !!WG[it.g]);
    if (![...v.shelf, ...v.hidden].every(validItem)) return false;
    if (!v.queue.every((c) => c && ['sell', 'buy', 'fence', 'police', 'order', 'lady', 'appraisal'].includes(c.kind) && CATS[c.who] && (!c.item || validItem(c.item)))) return false;
    if (v.growth !== undefined) G.validateGrowth(v.growth);
    if (v.variety !== undefined) G.validateVariety(v.variety);
    G.validateNightGround(v);
    return true;
  } catch { return false; }
}
function exportProgress(value = G.S, raw = false) {
  const text = raw ? String(value) : JSON.stringify(value, null, 2);
  modal(close => {
    const field = h('textarea.backup-text', { readonly: true, 'aria-label': '存档备份原文', spellcheck: false });
    field.value = text;
    const status = h('p', { role: 'status', 'aria-live': 'polite' }, '可复制下方原文，保存到备忘录。');
    return h('div.dialog.px.backup-dialog', h('h2', raw ? '原存档备份' : '进度备份'), field, status,
      h('div.row', h('button.btn.paper', { onclick: close }, '返回'),
        h('button.btn', { onclick: async () => {
          try {
            if (!navigator.clipboard?.writeText) throw new Error('manual copy');
            await navigator.clipboard.writeText(text); status.textContent = '已复制。';
          } catch { field.focus(); field.select(); status.textContent = '请长按或选择原文复制。'; }
        } }, '复制原文')));
  }, { center: true });
}
function showSaveIssue() {
  stage.querySelector('.save-issue')?.remove();
  const issue = saveIssue || metaSaveIssue;
  if (!issue) return;
  stage.append(h('div.save-issue', { role: 'alert' }, h('span', issue),
    h('button.btn.small', { onclick: () => { saveMeta(); saveRun(); } }, '重试'),
    G.S && h('button.btn.small.paper', { onclick: () => exportProgress() }, '导出进度')));
}
let recoveredGround = [], groundToastQueued = false;
function saveRun() {
  if (!G.S || protectedRun) return false;
  const recovered = G.collectNightGround();
  if (recovered.length) {
    recoveredGround.push(...recovered);
    if (!groundToastQueued) {
      groundToastQueued = true;
      // Save callers often redraw the whole stage; announce after that redraw.
      queueMicrotask(() => {
        const items = recoveredGround; recoveredGround = []; groundToastQueued = false;
        if (items.length) toast(`腾出空位，已收回：${groundItemNames(items)}`);
      });
    }
  }
  const ok = store.set(RUN_KEY, G.S);
  saveIssue = ok ? '' : '进度未能保存，请重试或导出备份。'; showSaveIssue(); return ok;
}

const stage = document.getElementById('stage');
const fishIcon = 'assets/items/dryfish.png';
const catImg = (who) => `assets/cats/${who === 'player' ? 'player-qipao' : CATS[who]?.portrait || who}.png`;
const itemImg = (id) => `assets/items/${ITEMS[id]?.icon || id}.png`;
const equipmentSeat = (id) => {
  const entry = EQUIPMENT[id];
  if (!entry) throw new Error(`Missing equipment catalog entry: ${id}`);
  return h('div.equipment-seat', { 'data-equipment': id }, h('img', { src: `assets/equipment/${entry.image}.png`, alt: entry.name }));
};
const equipmentOwned = (id) => !!(G.S.up[id] || G.S.owned[id]);
const equipmentIdentity = (id) => `${EQUIPMENT[id].category} · ${equipmentOwned(id) ? '已拥有' : '尚未购买'}`;
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
const fill = (el, ...kids) => { clear(el); el.append(...h('div', {}, ...kids).childNodes); if (el === stage) queueMicrotask(showSaveIssue); return el; };
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
  const underlay = [...stage.querySelectorAll('.mask')].at(-1);
  if (underlay) underlay.inert = true;
  const mask = h('div.mask' + (center ? '.center' : ''));
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true; mask.remove();
    if (underlay?.isConnected) underlay.inert = false;
    onClose?.();
    if (previousFocus?.isConnected) previousFocus.focus();
  };
  mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
  mask.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    if (e.key !== 'Tab') return;
    const controls = [...mask.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex="0"]')];
    const first = controls[0], last = controls.at(-1);
    if (!first) return;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  const content = build(close);
  content.setAttribute('role', 'dialog'); content.setAttribute('aria-modal', 'true');
  const title = content.querySelector('h2');
  if (title) content.setAttribute('aria-label', title.getAttribute('data-dialog-title') || title.firstChild?.textContent || title.textContent);
  mask.append(content);
  stage.append(mask);
  queueMicrotask(() => { if (!closed) mask.querySelector('button:not([disabled]), input:not([disabled])')?.focus(); });
  return close;
}
const closeX = (close) => h('button.x', { onclick: close, 'aria-label': '关闭' }, '✕');
const equipmentDetailsButton = (action) => h('button.equipment-details', { onclick: action }, h('span', '详情'));
const ruleButton = (label, action) => h('button.btn.small.paper.rule-entry', { onclick: action }, label);
function openRuleDetails(title, content) {
  modal(close => h('div.sheet.rule-sheet', h('h2', title, closeX(close)),
    h('div.scroll.rule-content', ...content), h('button.btn.paper', { onclick: close }, '返回')));
}
function openWaterDetails() {
  openWaterDiagram('水质与净化');
}
function openWaterDiagram(title = '净水器', onChanged) {
  let selected = 2, changed = false;
  const uv = UPGRADES.find(u => u.id === 'uv');
  const bottle = (grade) => img(itemImg(grade <= 2 ? 'dirtywater' : 'water'), `water-bottle.grade-${grade}`);
  modal(close => {
    const host = h('div.sheet.water-sheet');
    const draw = (restoreFocus = false) => {
      const cap = G.pureMax(), spec = G.machineSpec('purifier');
      const canPurify = selected < cap, result = Math.min(cap, selected + 2);
      fill(host, h('h2', { 'data-dialog-title': title }, equipmentSeat('purifier'), title, closeX(close)),
        h('div.scroll.water-diagram',
          !G.S.owned.purifier && equipmentPurchaseButton(UPGRADES.find(u => u.id === 'purifier'), () => { changed = true; draw(true); }),
          !G.S.owned.purifier && h('div.equipment-state', equipmentPurchaseStatus(UPGRADES.find(u => u.id === 'purifier'))),
          h('div.water-prompt', '选择一种水，查看净化效果。'),
          h('div.water-ladder', { role: 'group', 'aria-label': '六档水质，由低到高' }, WG.map((w, i) =>
            h('button.water-grade' + (i === selected ? '.source' : '') + (canPurify && i === result ? '.result' : ''), {
              'data-grade': i, 'aria-pressed': String(i === selected),
              'aria-label': `${w.n}，第${i + 1}档${i === cap ? '，当前净化上限' : ''}`,
              style: `--level:${i}`, onclick: () => { selected = i; draw(true); },
            }, bottle(i), h('span', w.n), h('small', i === selected ? '原水' : canPurify && i === result ? '产物' : i === cap ? '上限' : '\u00a0')))),
          h('div.water-transform', { role: 'status', 'aria-live': 'polite' },
            h('div.water-object', bottle(selected), h('b', WG[selected].n)),
            canPurify ? h('div.water-arrow', h('b', '→'), h('span', `需要${spec.days}晚`)) : h('div.water-stop', selected === 5 ? '最高水质' : '已达设备上限'),
            canPurify && h('div.water-object.output', bottle(result), h('b', WG[result].n))),
          h('div.water-facts',
            h('span', canPurify ? `每净化1瓶水，消耗${selected <= 1 ? 3 : 1}点滤芯耐久。` : selected === 5 ? '已是纯净水，无需净化。' : '当前设备无法继续净化。'),
            h('span', `一轮最多净化${spec.cap}瓶。`)),
          h('div.water-cap', h('span', '净化上限'), bottle(cap), h('b', WG[cap].n)),
          h('div.water-equipment', equipmentSeat('uv'),
            h('div.grow', h('b', '紫外线灯'), h('div.equipment-state', '净水器配件'), h('div.equipment-state', G.S.up.uv ? '✓ 已装' : '未装')),
            h('div.equipment-output', h('div', h('span', '→'), bottle(5)), h('span', '纯净水')),
            G.S.up.uv ? null
              : h('button.btn.small', { onclick: () => openEquipmentPurchase(uv, () => { changed = true; draw(true); }) }, '小铺购买', fish(uv.cost)))),
        h('button.btn.paper', { onclick: close }, '返回'));
      if (restoreFocus) host.querySelector(`[data-grade="${selected}"]`)?.focus();
    };
    draw(); return host;
  }, { onClose: () => {
    if (!changed) return;
    if (onChanged) onChanged();
    else if (G.S.phase === 'night' && !stage.querySelector('.mask')) renderNight();
  } });
}
function equipmentPurchaseButton(u, onPurchased) {
  const gate = G.upgradeAvailable(u.id), night = G.S.phase === 'night';
  const label = ({ 设备: '购买设备', 招牌: '购买招牌', 配件: '安装配件' })[EQUIPMENT[u.id].category] || '购买';
  return h('button.btn', { disabled: !night || !gate.ok, onclick: () => {
    if (G.S.phase !== 'night' || !G.upgradeAvailable(u.id).ok || !G.buyUpgrade(u)) return;
    floatMoney(-u.cost); refreshHud(); checkAch(); saveRun(); onPurchased?.();
  } }, label, fish(u.cost));
}
function equipmentPurchaseStatus(u) {
  if (!u.repeat && equipmentOwned(u.id)) return '已拥有';
  const gate = G.upgradeAvailable(u.id);
  if (gate.reason === '尚缺前置装备') return `需要先购买【${EQUIPMENT[u.need].name}】。`;
  if (gate.reason && gate.reason !== '鱼币不足') return gate.reason;
  return G.S.phase !== 'night' ? '夜晚可在小铺购买。' : gate.reason || `现有 ${G.S.money} 鱼币`;
}
function equipmentEffect(u) {
  const line = (id, text) => h('div.equipment-purchase-effect', id && img(itemImg(id)), h('span', text));
  if (u.id === 'uv') return line('water', '安装后，净化上限提高至【纯净水】。');
  if (u.id === 'filter') return [line(null, shopSummary(u)), line('dirtywater', '每瓶【水沟水】或【铁锈水】会消耗3点滤芯耐久。'), line('water', '其他可净化的水，每瓶消耗1点滤芯耐久。')];
  if (u.id === 'dew') return [line('dirtywater', '每晚收集1瓶怪味水'), line(null, '货架已满时暂停收集。')];
  if (u.id === 'fridge') return [line('water', '饮用水可免费加冰'), line(null, '成交后吸引次日饮品客')];
  if (u.id === 'premium_window') return [line(null, shopSummary(u)), line(null, '上流好感≥2 · 每日+1客')];
  return line(null, shopSummary(u));
}
function openEquipmentPurchase(u, onPurchased) {
  modal(close => h('div.dialog.px.equipment-purchase',
    h('h2', u.name, closeX(close)),
    h('div.equipment-preview', equipmentSeat(u.id), h('div', h('b', EQUIPMENT[u.id].category),
      h('div.equipment-state', equipmentPurchaseStatus(u)),
      equipmentEffect(u))),
    !u.repeat && equipmentOwned(u.id) ? h('button.btn.paper', { onclick: close }, '返回')
      : equipmentPurchaseButton(u, () => { close(); onPurchased?.(); })
  ), { center: true });
}
function openOrderRules() {
  openRuleDetails('交货规则', [h('p', '截止当天仍可交货。先选货，确认后才交出物品并领取报酬。'),
    h('p', '候选数量包含未鉴定货物，交付时会核验；不合格时不扣货。'),
    h('p', '水的品质不额外加价，默认优先选择已验的低档水。')]);
}

let lessonQueued = false;
function showMechanicLesson(key, after) {
  const lesson = MECHANIC_LESSONS[key];
  if (!lesson || meta.mechanicSeen?.[key] === true || protectedRun || !G.S || busy || stage.querySelector('.mask')) return false;
  modal(close => h('div.dialog.px.mechanic-lesson',
    h('h2', lesson.title),
    h('ul', lesson.points.map(point => h('li', point))),
    h('button.btn', { onclick: close }, '知道了')),
  { center: true, onClose: () => {
    // Acknowledgement belongs to the player, not this run. Closing counts as read.
    meta.mechanicSeen = { ...meta.mechanicSeen, [key]: true };
    saveMeta();
    if (after) queueMicrotask(after);
  } });
  return true;
}
function queueMechanicLesson(keys) {
  if (lessonQueued || !keys.some(key => meta.mechanicSeen?.[key] !== true)) return;
  const run = G.S, screen = stage.querySelector('.screen'), day = run?.day, qi = run?.qi;
  lessonQueued = true;
  queueMicrotask(() => {
    lessonQueued = false;
    // Do not overlay a morning report, another modal, or a different customer.
    if (G.S !== run || G.S?.day !== day || G.S?.qi !== qi || stage.querySelector('.screen') !== screen || stage.querySelector('.title')) return;
    const key = keys.find(id => meta.mechanicSeen?.[id] !== true);
    if (key) showMechanicLesson(key);
  });
}

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
  const safe = getComputedStyle(document.documentElement);
  const top = parseFloat(safe.getPropertyValue('--safe-top')) || 0;
  const bottom = parseFloat(safe.getPropertyValue('--safe-bottom')) || 0;
  const W = innerWidth, H = Math.max(1, innerHeight - top - bottom);
  const s = Math.min(W / 390, H / 680);
  const sh = H / s;
  stage.style.left = (W - 390 * s) / 2 + 'px';
  stage.style.top = top + 'px';
  stage.style.transform = `scale(${s})`;
  stage.style.height = sh + 'px';
  stage.style.setProperty('--sh', Math.max(200, Math.min(300, sh - 600)) + 'px');
}
addEventListener('resize', fit);

// ───── 标题 ─────
function renderTitle(failedRecord = null) {
  if (!['ok', 'invalid', 'unavailable', 'empty'].includes(failedRecord?.status)) failedRecord = null;
  music('night');
  const record = failedRecord || runRecord();
  const hasRun = !failedRecord && record.status === 'ok' && usableRun(record.value);
  protectedRun = record.status !== 'empty' && !hasRun;
  fill(stage, h('div.screen.title',
    h('div.title-bg', { style: `background-image:url(assets/bg/title.jpg)` }),
    h('div.logo', h('h1', '喵喵当铺')),
    h('div.title-cat', img(catImg('player'))),
    h('div.title-menu',
      hasRun && h('button.btn.big.mint', { onclick: continueRun }, '继续营业'),
      !protectedRun && h('button.btn.big', { onclick: () => (hasRun ? confirmNew() : newGame()) }, hasRun ? '重新开张' : '开张营业'),
      protectedRun && recoveryControls(record),
      h('div.row',
        h('button.btn.paper', { onclick: openAch }, '成就'),
        h('button.btn.paper', { onclick: openBoard }, '排行榜'),
        h('button.btn.paper', { onclick: openHelp }, '玩法')),
    ),
  ));
}
// A failed read is not evidence of a damaged record: retry before offering deletion.
function recoveryControls(record) {
  const unavailable = record.status === 'unavailable';
  return h('div.archive-recovery',
    h('div.archive-warning', unavailable ? '暂时无法读取存档，请恢复存储权限后重试。' : '存档无法续玩，原件已保留。'),
    h('button.btn.big', { onclick: unavailable ? () => renderTitle() : confirmRecovery }, unavailable ? '重试读取' : '清档重新开始'),
    record.raw != null && h('button.btn.paper', { onclick: () => exportProgress(record.raw, true) }, '备份原存档'));
}
function confirmRecovery() {
  const expected = runRecord();
  modal(close => {
    const status = h('p', { role: 'alert' });
    return h('div.dialog.px', h('h2', '清档重新开始？'),
      h('p', '仅清除当前经营进度，成就与设置保留。'), status,
      h('div.row', h('button.btn.paper', { onclick: close }, '取消'),
        h('button.btn.red', { onclick: () => {
          const current = runRecord(), latestMeta = store.read(META_KEY);
          if (current.status === 'unavailable') { status.textContent = '无法读取存档，请恢复存储权限后重试。'; return; }
          if (current.status !== expected.status || current.raw !== expected.raw) { status.textContent = '存档已变化，请取消后重试读取。'; return; }
          if (latestMeta.status !== 'empty' && (latestMeta.status !== 'ok' || !latestMeta.value || typeof latestMeta.value !== 'object' || Array.isArray(latestMeta.value) || !latestMeta.value.ach || typeof latestMeta.value.ach !== 'object' || Array.isArray(latestMeta.value.ach))) {
            status.textContent = '无法确认成就与设置，请恢复存储后重试。'; return;
          }
          if (!store.del(RUN_KEY)) { status.textContent = '清档失败，未能确认清除，请重试。'; return; }
          if (latestMeta.status === 'ok') Object.assign(meta, latestMeta.value);
          sound.sfx = meta.sfx; sound.music = meta.music;
          protectedRun = false; saveIssue = ''; G.setState(null); close(); newGame(true);
        } }, '确认清档')));
  }, { center: true });
}
function confirmNew() {
  modal((close) => h('div.dialog.px',
    h('h2', '重新开张？'),
    h('p', { style: 'font-size:16px' }, '当前的存档会被覆盖。'),
    h('div.row', h('button.btn.paper', { onclick: close }, '再想想'), h('button.btn.red', { onclick: () => { close(); newGame(); } }, '重新开张')),
  ), { center: true });
}
function newGame(preserveMeta = false) {
  if (protectedRun) return;
  G.newRun();
  G.S.tutorial = meta.tut;
  meta.runs++; if (preserveMeta !== true) saveMeta();
  beginDay(true);
}
function continueRun() {
  const record = runRecord(), s = record.value;
  if (record.status !== 'ok' || !usableRun(s)) return renderTitle();
  try {
    G.setState(s);
    if (s.phase === 'night') renderNight();
    else renderDay();
  } catch {
    G.setState(null);
    renderTitle(record);
  }
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
  const growth = G.growthMessages();
  if (growth.length) saveRun();
  const out = S.morningOut || [];
  const visit = S.queue.find((c) => c.visitId);
  S.morningOut = null;
  modal((close) => h('div.dialog.px',
    h('h2', `第 ${S.day} 天 · ${WEEKDAYS[G.weekday()]}`),
    h('div.card.px', { style: 'background:#fff1c9' }, h('div.grow', h('div.nm', '📰 ' + n.t), h('div.meta', n.d))),
    visit && h('div.label', `今日约客：${CATS[visit.who].name} · ${visit.kind === 'sell' ? '带来' + nm(visit.item) : visit.kind === 'buy' ? '收购' + ITEMS[visit.wantId].name : '委托备货' + G.orderName(visit.order)}`),
    growth.map((msg) => h('div.label', msg.id === 'phone' ? '电话订货已开启：从菜单或夜晚小铺拨打，付款后次日到货。' : msg.text)),
    G.phoneDeliveries().length > 0 && h('div.label', `订货到达：${G.phoneDeliveries().reduce((n, order) => n + order.remaining.reduce((sum, it) => sum + it.qty, 0), 0)}件，可从菜单电话领取`),
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
  const rent = G.rentInfo();
  return h('div.hud',
    h('div.money', img(fishIcon), h('span.m', String(S.money))),
    h('div.date', h('b', `第 ${G.week()} 周 · ${WEEKDAYS[G.weekday()]}`),
      h('small', `${rent.paid ? '下次租金' : '房租'} ${rent.amount} · ${rent.days ? rent.days + '天后' : '今天'}`)),
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
  D.scene = h('div.scene', { style: 'background-image:url(assets/bg/shop.jpg);height:calc(var(--sh) + 52px)' });
  D.panel = h('div.panel');
  const n = G.newsObj();
  fill(stage, h('div.screen.day-screen',
    h('div.news', h('b', '今日'), `${n.t} · ${n.d}`),
    D.scene, hud(), D.panel,
    h('div.bar.day-tools',
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
    const ready = S.orders.some((o) => G.orderPlan(o).ok);
    D.orderBtn.textContent = `订单 ${S.orders.length}` + (ready ? ' · 可选货' : '');
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
  const customer = G.current();
  const clue = customer?.who === who && G.S.day >= 4 && !customer.tut && who !== 'lady' && (customer.kind === 'sell' || customer.kind === 'buy') ? G.observationClue(customer) : null;
  fill(D.bubble, 
    h('div.who', c.name, c.title && h('span', '· ' + c.title), c.fac && h('span.fac', { style: `background:${FACS[c.fac].color}` }, FACS[c.fac].name)),
    h('div', text),
    clue && !customer.obs?.[clue.index] && h('div.customer-clue', clue.text),
  );
}
function coach(text) {
  return h('div.coach.px', h('span.coach-face', img(catImg('player'))), h('div', text));
}

function showCustomer() {
  let c = G.current(), skipped = false;
  // A save taken during the existing departure delay may still point at the
  // exhausted customer. Resume after that visit, without replaying any reward.
  while (c && ((['sell', 'buy'].includes(c.kind) && (c.settled || Number.isFinite(c.pat) && c.pat <= 0)) || (['appraisal', 'order'].includes(c.kind) && c.settled))) {
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
  setScene(c.who, ['sell', 'appraisal'].includes(c.kind) ? c.item : null);
  ({ sell: panelSell, buy: panelBuy, fence: panelFence, police: panelPolice, order: panelOrder, lady: panelLady, appraisal: panelAppraisal }[c.kind])(c);
  const eb = eyeBtn(c);
  if (eb) D.scene.append(eb);
}

// 结束当前客人：说完最后一句话后离场
async function leave(text, mood) {
  if (busy) return;
  busy = true;
  const c = G.current();
  refreshPatience(c);
  if (text) say(c.who, text);
  D.panel.querySelectorAll('button, input, select, textarea').forEach((b) => (b.disabled = true));
  D.scene.querySelectorAll('.eye-btn').forEach((b) => (b.disabled = true));
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
  const range = h('input', { type: 'range', min, max, value: v, 'aria-label': '调整报价' });
  const set = (n) => { v = Math.max(min, Math.min(max, Math.round(n))); val.lastChild.textContent = v; range.value = v; onChange?.(v); };
  range.addEventListener('input', () => set(Number(range.value)));
  const step = (d) => h('button.btn.paper.step', { onclick: () => set(v + d) }, (d > 0 ? '+' : '−') + Math.abs(d));
  const node = h('div.price-picker', h('div.price', step(-10), step(-1), val, range, step(1), step(10)));
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
const purchasePrice = (it) => Number.isFinite(it.cost) && it.cost > 0 ? `进价 ${Number(it.cost.toFixed(2))}` : '无买入价';
function itemCard(it, opts = {}) {
  const e = G.estimate(it);
  const use = Object.entries(MACHINES).find(([mid, m]) => m.in[0] === it.id && mid !== 'purifier' && (G.S.owned[mid] || G.upgradeAvailable(mid).ok || G.upgradeAvailable(mid).reason === '鱼币不足'));
  return h('div.card.px.item-card',
    h('div.icon', img(icon(it))),
    h('div.grow',
      h('div.nm', nm(it), ' ', itemTags(it, opts)),
      opts.showCost && h('div.meta.purchase-price', purchasePrice(it)),
      h('div.meta.market-price', opts.exposed ? `识破了！${opts.claimed != null ? `说是${WG[opts.claimed].n}，` : ''}实价约 ${G.trueValue(it)}` : `估价 ${e.lo} ~ ${e.hi}` + (it.selfLab ? `（真身：${WG[G.grade(it)].n}）` : '')),
      use && h('div.meta', `${use[1].name}：${ITEMS[use[1].out[0]].name} · ${G.machineSpec(use[0]).days}晚`),
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
    if (c.visitId && c.line) c.line = `${c.line} 开价${c.ask}。`;
    else if (c.who === 'thief') c.line = `嘘……这${name}别问来路，${c.ask} 就给你。`;
    else if (c.who === 'lady' && c.story === 0) c.line = `这是母亲留下的${name}……${c.ask} 鱼币，求您了。我以后一定来赎回它。`;
    else if (c.who === 'lady') c.line = `又是我……这块${name}，${c.ask} 鱼币可以吗？`;
    else c.line = CATS[c.who].intro ? `${CATS[c.who].intro} ${name}，${c.ask}鱼币。` : G.pick(SELL_LINES)(name, c.ask);
  }
  if (c.who === 'thief') c.item.stolenKnown = true;
  say(c.who, greeting(c.line));
  drawSell(c);
}
function drawSell(c) {
  const S = G.S, it = c.item, fac = CATS[c.who].fac;
  const full = S.shelf.length >= S.shelfCap;
  const e = G.estimate(it);
  const picker = pricePicker(c.exposed ? G.trueValue(it) * 0.7 : Math.min(c.ask, e.lo), 1, Math.max(c.ask, 10), (v) => { offerBtn.lastChild.textContent = v; offerBtn.disabled = v > S.money || full; });
  const spotNames = SPOTS[ITEMS[it.id].cat];
  const lensFree = S.up.lens && !c.lensUsed;
  const clue = G.itemClue(c);
  const spots = h('div.spots', spotNames.map((n, i) => {
    const r = c.checks[i];
    const glyph = r === 'ok' ? '✓' : r === 'fake' ? '✗' : r === 'stolen' ? '⚠' : '？';
    return h('button.btn.paper.spot' + (r ? '.' + r : ''), {
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
    canCharm && h('div.row.trade-extras',
      canCharm && h('button.btn.small.pink', { onclick: () => { G.charm(c); say(c.who, `看在老熟人的份上，${c.ask} 怎么样？`); drawSell(c); } }, '刷脸 −2好感'),
    ),
  ), h('div.trade-actions.negotiation-actions', picker.node, h('div.row', h('button.btn.small.paper.decline', { onclick: () => leave(c.exposed ? '哼，算你厉害。' : '那我去别家看看。') }, '拒收'), offerBtn, dealBtn)));
  D.panel.scrollTop = 0;
  queueMechanicLesson([...itemLessonKeys({ ...it, known: it.known || c.exposed }, { stolenVisible: c.who === 'thief' || c.checks[0] === 'stolen' }), 'inspection']);
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

const WANT_NAME = (w, minG, id) => (id ? ITEMS[id].name : w === 'ban' ? '那种货' : minG ? `${WG[minG].n}以上的好水` : CATS_CAT[w]);
function panelBuy(c) {
  if (!c.said) {
    c.said = true;
    const w = WANT_NAME(c.want, c.minG, c.wantId);
    c.line = c.visitId && c.line ? c.line : c.hoarder ? '橱窗里那几瓶水……我全都要看看。别拿贴牌货糊弄我，我自带试纸。'
      : c.iceFan ? '听说这里冰水不错，我带钱来了，还有水吗？'
      : c.collector ? '你橱窗里的宝贝，我在街口就看见了。价钱好商量。'
      : c.want === 'ban' ? '有没有……那种货？你懂的。价钱好说。' : c.who === 'kitten' ? `我攒了零花钱！想买${w}～` : CATS[c.who].intro ? `${CATS[c.who].intro} 今天找${w}。` : G.pick([`有没有${w}？我想买一件。`, `我在找${w}，你这有吗？`]);
  }
  say(c.who, greeting(c.line));
  if (c.item && G.allItems().includes(c.item)) drawBuyHaggle(c); else drawBuyPick(c);
}
function drawBuyPick(c) {
  D.panel.classList.remove('trade-panel');
  const S = G.S, all = G.allItems();
  const ok = all.filter((it) => G.wants(c, it));
  const grid = h('div.shelf-grid', all.map((it) => {
    const m = G.wants(c, it);
    return h('button.slot.px.buy-stock' + (m ? '' : '.dim') + (S.hidden.includes(it) ? '.hid' : ''), {
      disabled: m ? null : true,
      onclick: () => pickForBuyer(c, it),
    }, itemTags(it), img(icon(it)), nm(it), h('span.slot-cost', purchasePrice(it)));
  }));
  fill(D.panel, 
    c.tut === 'sell' && coach('从货架选一件玩具。'),
    h('div.row', h('span.label.grow', `想要：${WANT_NAME(c.want, c.minG, c.wantId)}`), heartsFor(c)),
    ok.length ? h('div.scroll.stock-scroll', grid) : h('div.card.px', h('div.grow', h('div.nm', '没有合适的货'), h('div.meta', '货架上没有对方想要的东西'))),
    h('div.row', h('button.btn.paper', { onclick: () => leave(G.pick(['好吧，下次再来。', '唔，那算了。'])) }, ok.length ? '不卖了' : '抱歉，没有')),
  );
  queueMechanicLesson(ok.flatMap(it => itemLessonKeys(it)));
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
  if (!c.item || !G.allItems().includes(c.item)) { c.item = null; c.iced = false; return drawBuyPick(c); }
  const S = G.S, it = c.item, fac = CATS[c.who].fac, e = G.estimate(it);
  const picker = pricePicker(Math.max(e.hi, c.bid + 1), c.bid, Math.max(c.bid + 10, Math.round(e.hi * 2.2)), (v) => { askBtn.lastChild.textContent = v; });
  const askBtn = h('button.btn', { onclick: () => doAsk(c, picker.get()) }, '报价 ', h('span', String(picker.get())));
  const canCharm = fac && S.rep[fac] >= 2 && !c.charmed;
  D.panel.classList.add('trade-panel');
  fill(D.panel, h('div.trade-scroll',
    c.tut === 'sell' && coach('调价后点「报价」，或直接「成交」。'),
    itemCard(it, { showCost: true, known: it.known, showStolen: it.stolenKnown, right: h('div.customer-quote', heartsFor(c), h('div.quote-price', `出价 ${c.bid}`)) }),
    negotiationHint(c),
    h('div.row.trade-extras',
    S.up.fridge && G.isWater(it) && h('button.btn.small.sky', { disabled: c.iced ? true : null, onclick: () => {
      c.iced = true; c.max = Math.round(c.max * 1.12); c.bid = Math.round(c.bid * 1.12); unlock('ice');
      say(c.who, `冰的！我现在出 ${c.bid}。`); drawBuyHaggle(c);
    } }, c.iced ? '已加冰 🧊' : '🧊 免费加冰'),
      canCharm && h('button.btn.small.pink', { onclick: () => { G.charm(c); say(c.who, `好吧好吧，给你 ${c.bid}。`); drawBuyHaggle(c); } }, '刷脸 −2好感'),
      h('button.btn.small.paper', { onclick: () => { c.item = null; c.iced = false; drawBuyPick(c); } }, '换一件'),
    ),
  ), h('div.trade-actions.negotiation-actions', picker.node, h('div.row', h('button.btn.small.paper.decline', { onclick: () => leave('那算了。') }, '不卖'), askBtn, h('button.btn.mint', { onclick: () => doSell(c, c.bid) }, `成交 ${c.bid}`))));
  D.panel.scrollTop = 0;
  queueMechanicLesson(itemLessonKeys(it));
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
  if (showMechanicLesson('impostor', () => { if (G.current() === c && !busy) openObserve(c, redraw); })) return;
  c.obs = c.obs || [null, null, null];
  const clue = G.observationClue(c);
  modal((close) => {
    const host = h('div.dialog.px');
    const draw = () => fill(host,
      h('h2', '仔细观察', closeX(close)),
      h('div.row', { style: 'justify-content:flex-end' }, heartsFor(c)),
      h('div.list', OBS.map((o, i) => h('div.li', h('div.grow', h('div.t', o.n), h('div.d', c.obs[i] || (clue?.index === i ? clue.text : '未观察'))),
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
// 鉴定服务只检查客人物件并收取服务费，不进入玩家货架。
function panelAppraisal(c) {
  say(c.who, c.line || '请帮我看看这件东西值多少。');
  const draw = () => {
    const e = G.appraisalEstimate(c.item);
    c.quoteDraft ??= Math.round((e.lo + e.hi) / 2);
    const picker = pricePicker(c.quoteDraft, 1, Math.max(500, e.hi * 4, c.quoteDraft), (value) => { c.quoteDraft = value; });
    const spots = SPOTS[ITEMS[c.item.id].cat].map((name, i) => h('button.btn.paper.spot', {
      disabled: !!c.checks[i], onclick: () => {
        const r = G.appraisalCheck(c, i);
        if (!r.ok) return toast(r.reason || '无法继续检查');
        say(c.who, G.isWater(c.item) && i === 2 ? `试纸显示：${WG[G.grade(c.item)].n}。` : r.res === 'fake' ? '这处有赝品痕迹。' : r.res === 'stolen' ? '这处留下了原主人的记号。' : '这处正常。');
        saveRun(); draw();
      } }, c.checks[i] ? (c.checks[i] === 'ok' ? '✓ ' : '！ ') + name : name));
    D.panel.classList.add('trade-panel');
    fill(D.panel, h('div.trade-scroll', h('div.card', h('div.icon', img(icon(c.item))), h('div.grow', h('div.nm', nm(c.item)), itemTags(c.item, { unverified: !c.item.known && !c.checks.every(Boolean) }))),
      h('div.machine-status', `日常参考 ${e.lo}–${e.hi}（不含今日行情）`),
      G.isWater(c.item) && c.item.gk && h('div.label', `试纸：${WG[G.grade(c.item)].n}`),
      h('div.check-controls', h('div.spots', spots)),
      h('div.machine-status', '鉴定费 6＋估价的5%～15%'),
      c.impatience > 0 && h('div.label', `客人已有些不耐烦（${c.impatience}/100）`)),
      h('div.trade-actions', picker.node, h('div.row',
        h('button.btn.paper', { onclick: () => leave('下次再来。') }, '不接鉴定'),
        h('button.btn.mint', { onclick: () => {
          const r = G.appraisalQuote(c, picker.get());
          if (!r.ok) return toast(r.reason || '暂时无法估价');
          saveRun(); refreshHud();
          if (r.accepted || r.left) return leave(r.accepted ? `谢谢，鉴定费 ${r.reward || 0} 鱼币。` : '这估价我不太认可，下次再说吧。', r.accepted ? 'good' : undefined);
          say(c.who, '再仔细看看吧。'); draw();
        } }, '给出估价'))));
    queueMechanicLesson(itemLessonKeys(c.item));
  };
  draw();
}

function panelFence(c) {
  say(c.who, '三花收货啦～什么都收，价钱嘛，六折上下。');
  fenceUI(D.panel, () => leave('下次再来照顾你生意～'), (sum) => leave(`一共 ${sum}，爽快！`, 'good'));
}
function fenceUI(host, onCancel, onDone, title) {
  const S = G.S, picked = new Set();
  const draw = () => {
    const scrollTop = host.querySelector('.fence-stock')?.scrollTop || 0;
    const sum = [...picked].reduce((a, it) => a + G.fencePrice(it), 0);
    fill(host, 
      title,
      h('div.label', '点选要卖给三花姐的货'),
      h('div.scroll.fence-stock', h('div.shelf-grid', G.allItems().map((it) => h('button.slot.px' + (picked.has(it) ? '.sel' : '') + (S.hidden.includes(it) ? '.hid' : ''), {
        onclick: () => { picked.has(it) ? picked.delete(it) : picked.add(it); draw(); },
      }, itemTags(it), img(icon(it)), `${G.fencePrice(it)}`)))),
      h('div.row',
        h('button.btn.paper', { onclick: onCancel }, '不卖了'),
        h('button.btn.mint', { disabled: picked.size ? null : true, onclick: () => { const s = G.fenceSell([...picked]); floatMoney(s); refreshHud(); refreshBar(); onDone(s); } }, `卖出 ${sum}`)),
    );
    host.querySelector('.fence-stock').scrollTop = scrollTop;
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
    h('div.scroll.stock-scroll', h('div.shelf-grid', res.found.map((it) => h('div.slot.px', itemTags(it, { showStolen: true }), img(icon(it)), nm(it))))),
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
  say(c.who, c.visitId ? c.line : `需要${o.qty}份${G.orderName(o)}，能帮我备齐吗？`);
  fill(D.panel, 
    h('div.card.px', h('div.icon', img(itemImg(o.id))), h('div.grow', h('div.nm', `${G.orderName(o)} ×${o.qty}`), h('div.meta', `第${o.due}天截止（含当天） · 报酬${o.reward}`), h('div.meta', `候选 ${Math.min(plan.have, o.qty)}/${o.qty} · 缺 ${Math.max(0, o.qty - plan.have)}`))),
    ruleButton('交货规则', openOrderRules),
    h('div.row',
      h('button.btn.paper', { onclick: () => leave(c.who === 'robot' ? '哔……已取消。' : '那我再找找，下次再来。') }, '不接'),
      h('button.btn.mint', { disabled: S.orders.length >= 3 || S.orders.includes(o) ? true : null, onclick: () => { if (!G.acceptOrder(o)) return toast('订单已接取或已满'); saveRun(); leave('订单已登记，在「订单」里交付。', 'good'); } }, '接单')),
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
  const amt = G.rentAmount(), day = S.day, panel = D.panel;
  let adPending = false;
  const current = () => G.S === S && S.day === day && S.phase !== 'night' && D.panel === panel;
  const unsettled = () => current() && G.rentToday() && !S.rentDone;
  say('landlord', `周五啦～本周房租 ${amt} 鱼币喵。` + (S.rentDue ? '（含上周欠的）' : ''));
  sfx('meow');
  const done = (text) => {
    if (!current() || !S.rentDone) return;
    say('landlord', typeof text === 'function' ? text() : text);
    refreshHud(); saveRun();
    D.panel.querySelectorAll('button').forEach((b) => (b.disabled = true));
    setTimeout(() => {
      if (!current()) return;
      D.cust?.classList.add('exit');
      setTimeout(() => { if (current()) closeShop(); }, 400);
    }, 1100);
  };
  fill(D.panel, 
    h('div.card.px', h('div.grow', h('div.nm', `房租 ${amt}`), h('div.meta', `手头 ${S.money} · 下周房租 ${rentOf(G.week() + 1)}`))),
    h('button.btn.big.mint', { disabled: S.money < amt ? true : null, onclick: () => {
      if (!unsettled() || adPending) return;
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
    ads.available && !S.graceUsed && h('button.btn.sky', { onclick: async (event) => {
      if (adPending || !unsettled() || S.graceUsed) return;
      adPending = true;
      const button = event?.currentTarget;
      if (button) button.disabled = true;
      try {
        if (await playAd() && unsettled() && G.waiveRent()) {
          done(`本次房租已免交。下次${G.rentInfo().amount}鱼币，${G.rentInfo().days}天后交。`);
        }
      } finally {
        adPending = false;
        if (button && unsettled() && !S.graceUsed) button.disabled = false;
      }
    } }, '免交本次房租 ', h('span.ad', '看视频')),
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
const visitSummary = (v) => `${CATS[v.who].name}${v.kind === 'sell' ? '带来' : v.kind === 'buy' ? '想买' : '委托收集'}【${ITEMS[v.item].name}】${v.qty > 1 ? '×' + v.qty : ''}`;
function renderNight() {
  music('night');
  const S = G.S;
  const visit = G.nextVisit();
  // Persist the promised visit before rendering it; reopening cannot reroll it.
  saveRun();
  const tomorrow = G.newsObj(S.nextNews);
  const tabs = [['scav', '拾荒'], ['work', '作坊'], ['front', '门面'], ['shop', '小铺'], ['book', '账本']];
  const body = h('div.panel', { style: 'padding-top:14px' });
  const bg = nightTab === 'work' ? 'workshop' : 'night';
  const workReady = Object.keys(S.owned).some((m) => !S.machines[m] && G.productionPlan(m).ok);
  fill(stage, h('div.screen.night-screen',
    h('div.scene', { style: `background-image:url(assets/bg/${bg}.jpg);height:calc(var(--sh) - 36px)` },
      h('div.bubble.px.night-outlook', h('div.who', `明日 · ${tomorrow.t}`), h('div', visit ? visitSummary(visit) : tomorrow.d)),
      h('div.cust' + (nightTab === 'shop' ? '' : '.player-night'), { style: 'left:auto;right:4px;margin:0' }, img(catImg(nightTab === 'shop' ? 'joe' : 'player'))),
    ),
    hud(),
    h('div.tabs', tabs.map(([k, n]) => h('button.tab' + (nightTab === k ? '.on' : ''), { onclick: () => { nightTab = k; renderNight(); } }, n,
      (k === 'scav' && S.night.opened.length < S.night.free) || (k === 'work' && workReady) ? h('span.dot') : null))),
    body,
    h('div.bar',
      h('button.btn.paper', { onclick: openShelf }, `货架 ${S.shelf.length}/${S.shelfCap}`),
      h('button.btn.big', { onclick: goSleep }, '💤 睡觉'),
    ),
  ));
  if (S.nightTut) body.append(coach(nightTab === 'scav' ? '选一个箱子拾荒。' : nightTab === 'work' ? '选机器开工。' : nightTab === 'shop' ? '点价格购买。' : '准备好就点「睡觉」。'));
  ({ scav: nightScav, work: nightWork, front: nightFront, shop: nightShop, book: nightBook })[nightTab](body);
  showSaveIssue();
  queueMechanicLesson(G.allItems().flatMap(it => itemLessonKeys(it)));
}
function nightScav(body) {
  const S = G.S, N = S.night;
  const canOpen = N.opened.length < N.free;
  const crate = (id, i) => {
    const c = (N.results || {})[i];
    const cfg = { heavy: '沉甸甸', wet: '湿漉漉', smell: '香喷喷', jingle: '叮当响', myst: '神秘' }[id];
    if (c) return h('div.crate.px.open', img(itemImg(c.id === 'water' ? 'dirtywater' : c.id)), h('b', `${c.id === 'water' ? '脏水' : ITEMS[c.id].name} ×${c.n}`), !N.ground && c.lost ? h('span.label', `当晚未取 ${c.lost} 件`) : null);
    return h('button.crate.px', { disabled: canOpen ? null : true, onclick: () => openCrate(i) }, h('div.box'), h('b', cfg + '的箱子'));
  };
  appendContent(body,
    h('div.label', canOpen ? '选一个箱子打开（每晚一次）' : '今晚已经翻过了'),
    h('div.crates', N.crates.map(crate)),
    G.nightGround().length ? h('div.ground-summary',
      h('div', `地上还有：${groundItemNames(G.nightGround())}`),
      h('button.btn.paper', { onclick: openGroundExchange }, `整理地上物品 · ${G.nightGround().length}件`),
      h('div.label', '本晚腾出空位会自动收回；睡觉后清理。')) : null,
    !canOpen && N.opened.length < 3 && ads.available && !N.extra && h('button.btn.sky', { onclick: async () => { if (await playAd()) { N.extra = true; N.free++; saveRun(); renderNight(); } } }, '再翻一个箱子 ', h('span.ad', '看视频')),
  );
}
function openCrate(i) {
  const r = G.openCrate(i);
  if (!r.id) return;
  sfx(r.rare ? 'good' : 'coin');
  if (r.rare) unlock('treasure');
  checkAch(); saveRun(); renderNight();
  if (r.lost.length) openGroundExchange();
}
function groundItemNames(items) {
  const counts = new Map();
  for (const it of items) counts.set(nm(it), (counts.get(nm(it)) || 0) + 1);
  const names = [...counts].map(([name, qty]) => `${name}×${qty}`);
  return names.length > 2 ? `${names.slice(0, 2).join('、')}等${items.length}件` : names.join('、');
}
function openGroundExchange() {
  saveRun();
  if (!G.nightGround().length) { renderNight(); return; }
  let groundUid = G.nightGround()[0].uid, shelfUid = null;
  modal((close) => {
    const host = h('div.sheet.selection-sheet.ground-sheet');
    const draw = (focusUid = null, error = '') => {
      const ground = G.nightGround(), shelf = G.S.shelf;
      const incoming = ground.find(it => it.uid === groundUid), outgoing = shelf.find(it => it.uid === shelfUid);
      const tile = (it, selected, choose) => h('button.choice' + (selected ? '.sel' : ''), {
        'data-ground-choice': it.uid, 'aria-pressed': String(selected), onclick: choose,
      }, img(icon(it)), h('span.choice-name', nm(it)), itemTags(it),
        selected && h('span.choice-mark', { 'aria-hidden': 'true' }, '✓'));
      fill(host,
        h('h2', '拾荒换货', closeX(close)),
        h('div.label', `货架 ${shelf.length}/${G.S.shelfCap} · 地上 ${ground.length}件`),
        h('div.scroll',
          h('h3', '想拿哪件'),
          h('div.selection-grid', ground.map(it => tile(it, it.uid === groundUid, () => { groundUid = it.uid; draw(it.uid); }))),
          h('h3', '换出货架上的一件'),
          h('div.selection-grid', shelf.map(it => tile(it, it.uid === shelfUid, () => { shelfUid = it.uid; draw(it.uid); })))),
        h('div.selection-status', { role: 'status', 'aria-live': 'polite' }, error || (incoming && outgoing ? `换出${nm(outgoing)}，拿回${nm(incoming)}` : '选一件货架物品来交换，也可以暂不拾取。')),
        h('div.label', '换出物也留在地上，本晚有空位自动收回；睡觉后清理。'),
        h('div.row',
          h('button.btn.paper', { onclick: () => { saveRun(); close(); } }, '暂不拾取'),
          h('button.btn.mint', { disabled: !incoming || !outgoing, onclick: () => {
            const r = G.swapNightGround(groundUid, shelfUid);
            if (!r.ok) { draw(null, r.reason); return; }
            saveRun(); close();
            toast(`已拿回${nm(r.taken)}；${nm(r.left)}暂留地上`);
          } }, '交换')));
      if (focusUid != null) host.querySelector(`[data-ground-choice="${focusUid}"]`)?.focus();
    };
    draw(); return host;
  }, { onClose: () => {
    if (G.S.phase !== 'night') return;
    renderNight();
    (stage.querySelector('.ground-summary .btn') || stage.querySelector('.night-screen .bar .btn.paper'))?.focus();
  } });
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
function recipeObject(id, count, name = ITEMS[id].name) {
  return h('div.recipe-object', img(itemImg(id)), h('span', `${name} ×${count}`));
}
function openMachineDetails(mid, onChanged) {
  if (mid === 'purifier') return openWaterDiagram('净水器', onChanged);
  const m = G.machineSpec(mid), u = UPGRADES.find(u => u.id === mid);
  modal(close => h('div.sheet.equipment-sheet',
    h('h2', m.name, closeX(close)),
    h('div.scroll',
      h('div.equipment-state', equipmentIdentity(mid)),
      h('div.recipe-flow',
        h('div.recipe-inputs', recipeObject(m.in[0], m.in[1]), m.water && h('div.recipe-water',
          h('span', '再加1瓶水，任选一种'), h('div.recipe-water-options', [3, 4].map(grade =>
            h('div.recipe-object', img(itemImg('water'), `water-bottle.grade-${grade}`), h('span', WG[grade].n)))))),
        h('span.flow-arrow', '→'), equipmentSeat(mid), h('span.flow-arrow', '→'), recipeObject(m.out[0], m.out[1])),
      h('div.water-facts', h('span', '加工需要', h('b', String(m.days)), '晚。'), h('span', '每次最多制作', h('b', String(m.cap * m.out[1])), `份【${ITEMS[m.out[0]].name}】。`)),
      mid === 'labeler' && h('p.machine-status', '做出的【金枪鱼罐】是贴标赝品。'),
      mid === 'brewery' && h('p.machine-status', '不能使用【纯净水】酿酒。'),
      h('p.machine-status', '加工完成后，成品会在早上放上货架。货架已满时，暂存在设备里。'),
      mid === 'labeler' && h('div',
        h('div.recipe-flow', recipeObject('water', 1, '怪味水及以上'),
          h('span.flow-arrow', '→'), equipmentSeat(mid), h('span.flow-arrow', '→'), recipeObject('water', 1, '贴「纯净水」标')),
        h('div.water-facts', h('span', '每瓶消耗', h('b', '2'), '鱼币，立即完成。'), h('span', '实际水质不变')),
        h('p.machine-status', '在货架选中还没贴标的水，就能贴上标签。')),
      u && !equipmentOwned(mid) && h('div.equipment-purchase-status', equipmentPurchaseStatus(u))),
    u && !equipmentOwned(mid) ? equipmentPurchaseButton(u, () => { close(); if (onChanged) onChanged(); else if (G.S.phase === 'night') renderNight(); })
      : h('button.btn.paper', { onclick: close }, '返回')));
}
function productionReason(mid, reason) {
  const m = G.machineSpec(mid);
  const messages = {
    '成品尚未入库': '成品还在设备里，要等明早放上货架。',
    '滤芯不足': '滤芯耐久不够了，可以去小铺补充。',
    '缺待净化的原水': '货架上没有需要净化的水。',
    '缺白开水或山泉水': '还需要1瓶【白开水】或【山泉水】才能酿酒。',
    '每批需一份白开水或山泉水': '每做1份酒，都要搭配1瓶【白开水】或【山泉水】。',
    '尚未购买机器': '尚未购买这台设备，可在小铺购买。',
  };
  if (messages[reason]) return messages[reason];
  if (/^每批最多/.test(reason)) return mid === 'purifier' ? `一轮最多净化${m.cap}瓶水。` : `一轮最多做${m.cap * m.out[1]}份【${ITEMS[m.out[0]].name}】。`;
  if (/^原料需按/.test(reason)) return `每做${m.out[1]}份【${ITEMS[m.out[0]].name}】，要选${m.in[1]}份【${ITEMS[m.in[0]].name}】。`;
  return reason;
}
function productionState(mid, plan) {
  const m = G.machineSpec(mid);
  if (plan.ok) return `能做${plan.outputCount}${mid === 'purifier' ? '瓶水' : '份【' + ITEMS[m.out[0]].name + '】'}，${arrivalText(plan.days)}。`;
  if (mid !== 'purifier' && plan.reason?.startsWith('缺')) {
    const have = G.S.shelf.filter(it => it.id === m.in[0] && !(it.fake && it.known)).length;
    if (have < m.in[1]) return `还缺${m.in[1] - have}份【${ITEMS[m.in[0]].name}】，每次加工需要${m.in[1]}份。`;
  }
  return productionReason(mid, plan.reason);
}
function openProduction(mid) {
  const m = G.machineSpec(mid);
  const selected = new Set(G.productionPlan(mid).inputUids);
  modal((close) => {
    const host = h('div.sheet.selection-sheet');
    const draw = (focusUid = null, error = '') => {
      const plan = G.productionPlan(mid, { uids: [...selected] });
      const eligible = new Set(plan.eligibleUids);
      const candidates = G.S.shelf.filter((it) => eligible.has(it.uid)).map((it) => G.productionPlan(mid, { uids: [it.uid] }).inputs[0]).filter(Boolean);
      fill(host,
        h('h2', m.name, closeX(close)),
        h('div.context-line', h('span', `已选 ${selected.size} 件`), ruleButton('加工说明', () => openMachineDetails(mid, () => draw()))),
        h('div.scroll', candidates.length ? h('div.selection-grid', candidates.map((it) => choiceTile(it, selected,
          () => { selected.has(it.uid) ? selected.delete(it.uid) : selected.add(it.uid); draw(it.uid); }))) : h('div.empty-state', '货架上没有可用原料')),
        productionFlow(plan),
        h('div.selection-status', { role: 'status', 'aria-live': 'polite' },
          error || (!plan.ok ? productionReason(mid, plan.reason) : `${arrivalText(plan.days)}，做好后要用${plan.outputCount}格货架${mid === 'purifier' ? `；滤芯耐久用掉${plan.filterCost}点，还剩${plan.filterAfter}点` : ''}`)),
        h('div.row',
          h('button.btn.paper', { onclick: close }, '取消'),
          h('button.btn.mint', { disabled: !plan.ok || !!error, onclick: () => {
            const current = G.productionPlan(mid, { uids: [...selected] });
            if (!current.ok) { draw(null, productionReason(mid, current.reason)); return; }
            if (!G.runMachine(mid, { uids: [...selected] })) { draw(null, productionReason(mid, G.productionPlan(mid, { uids: [...selected] }).reason) || '所选原料不符合配方，请改选'); return; }
            sfx('good'); saveRun(); close(); renderNight();
            toast(`${m.name}已开工，${arrivalText(current.days)}`);
            stage.querySelector('.night-screen .bar .btn.big')?.focus();
          } }, `开始加工${plan.outputCount ? '（' + plan.outputCount + (mid === 'purifier' ? '瓶）' : '份）') : ''}`)),
      );
      if (focusUid != null) host.querySelector(`[data-choice="${focusUid}"]`)?.focus();
      else if (host.isConnected) (host.querySelector('.choice') || host.querySelector('button'))?.focus();
    };
    draw();
    return host;
  });
}
function nightWork(body) {
  const S = G.S;
  const list = h('div.machine-list');
  for (const mid of Object.keys(MACHINES)) {
    const m = G.machineSpec(mid);
    const owned = S.owned[mid], job = S.machines[mid];
    const gate = G.upgradeAvailable(mid);
    if (!owned && !gate.ok && gate.reason !== '鱼币不足') continue;
    const plan = owned && !job ? G.productionPlan(mid) : null;
    const state = job?.ready ? S.shelf.length >= S.shelfCap ? `货架满了，做好的${job.n}份先存在设备里` : `${job.n}份已做好，明早放上货架`
      : job ? `正在加工，还要${job.left}晚` : !owned ? '尚未购买，可在小铺购买。' : productionState(mid, plan);
    list.append(h('div.machine-row',
      h('div.machine-head', equipmentSeat(mid), h('div.grow', h('div.equipment-heading', h('div.t', m.name), equipmentDetailsButton(() => openMachineDetails(mid))), h('div.equipment-state', equipmentIdentity(mid)), owned && mid === 'purifier' && h('div.machine-status', `滤芯耐久剩余${S.filter}点`)),
        !owned ? h('button.btn.small.paper', { onclick: () => { nightTab = 'shop'; renderNight(); } }, '去小铺')
          : !job ? h('button.btn.small.mint', { 'data-machine': mid, disabled: !plan.ok, onclick: () => openProduction(mid) }, '选料') : null),
      owned && h('div.context-line', h('div.machine-status', state),
        owned && MACHINE_MODS[mid] && G.growthStatus().workshop && h('button.btn.small.paper.rule-entry', { onclick: () => openModification(mid) }, S.growth?.mods?.[mid] ? '查看改装' : '改装')),
    ));
  }
  body.append(list);
}
function nightShop(body) {
  const S = G.S;
  const list = h('div.list');
  for (const u of UPGRADES) {
    const has = !u.repeat && (S.up[u.id] || (u.machine && S.owned[u.id]));
    const gate = G.upgradeAvailable(u.id);
    if (!has && !gate.ok && gate.reason !== '鱼币不足') continue;
    list.append(h('div.li.px' + (has ? '.done' : ''),
      equipmentSeat(u.id),
      h('div.grow', h('div.equipment-heading', h('div.t', u.name), equipmentDetailsButton(() => openUpgradeDetails(u))), h('div.equipment-state', EQUIPMENT[u.id].category), h('div.d', shopSummary(u))),
      has ? h('span.label', '已拥有') : h('button.btn.small', { disabled: !gate.ok ? true : null, onclick: () => { if (G.buyUpgrade(u)) { floatMoney(-u.cost); checkAch(); saveRun(); renderNight(); } } }, img(fishIcon), String(u.cost)),
    ));
  }
  list.querySelectorAll('.li .btn img').forEach((i) => (i.style.cssText = 'width:20px;height:20px'));
  body.append(list);
  if (G.growthStatus().phone) body.prepend(h('button.btn.phone-entry', { onclick: openPhone }, '拨电话订货', G.phoneDeliveries().length ? ' · 有货待领' : ''));
  body.prepend(h('button.btn.paper.guide-entry', { onclick: openProgressGuide }, '经营指引'));
}
function shopSummary(u) {
  return ({ purifier: '净化水质，附带10点滤芯耐久。', filter: `补充10点滤芯耐久，补完有${G.S.filter + 10}点`,
    uv: '可制纯净水', dew: '每晚收集1瓶怪味水', fridge: '可给饮用水加冰',
    hide1: '暗格 +2格', lens: '每客首查不耗耐心', brewery: '酿制猫薄荷酒',
    dark: '引来销赃客，警长也更多', wsign: '引来卖水的猫',
    premium_window: '陈列珍宝可招来高预算买家',
    labeler: '制作贴标赝品', tank: '鱼苗养成鲜鱼', smoker: '鲜鱼制成烟熏鱼',
    repairbench: '修好故障游戏机', gemtable: '打磨宝石吊坠' })[u.id] || u.d;
}
function openUpgradeDetails(u) {
  if (u.id === 'uv') return openEquipmentPurchase(u, () => renderNight());
  if (u.machine) return openMachineDetails(u.id);
  openEquipmentPurchase(u, () => renderNight());
}
function openProgressGuide() {
  const S = G.S, trades = (S.st.buy || 0) + (S.st.sell || 0);
  const details = {
    phone: ['电话订货', '净水器 · 鱼缸'],
    appraisal: ['鉴定证书', ''],
    workshop: ['设备改装', '烟熏炉 · 酿酒桶'],
    premium: ['精品橱窗', ''],
    content2: ['码头夜市 · 8种新货', ''],
    content3: ['修复台 · 8种新货', ''],
    content4: ['宝石台 · 8种新货', ''],
  };
  const groups = new Map();
  for (const step of G.progressGuide()) {
    const key = `${step.day}:${step.trades}`;
    if (!groups.has(key)) groups.set(key, { day: step.day, trades: step.trades, items: [] });
    groups.get(key).items.push(step);
  }
  saveRun();
  modal(close => h('div.sheet.guide-sheet',
    h('h2', '经营指引', closeX(close)),
    h('div.guide-current', h('span', '第 ', h('b', String(S.day)), ' 天'), h('span', '买卖 ', h('b', String(trades)), ' 次')),
    h('div.scroll', h('table.guide-table', { 'aria-label': '经营内容开放条件' },
      h('thead', h('tr', h('th', { scope: 'col' }, '开放内容'), h('th', { scope: 'col' }, '天数'), h('th', { scope: 'col' }, '买卖次数'))),
      h('tbody', [...groups.values()].map(group => {
      const done = group.items.every(x => x.unlocked);
      const condition = (now, target, unit) => {
        const met = done || now >= target;
        return h('td.guide-condition' + (met ? '.met' : ''),
          h('b', met ? '✓ ' : '', `${target}${unit}`),
          !met && h('span', `差${target - now}${unit}`));
      };
      return h('tr' + (done ? '.done' : ''),
        h('th.guide-content', { scope: 'row' }, group.items.map(step =>
          h('div.guide-unlock', h('b', step.unlocked && !done ? '✓ ' : '', details[step.id][0]), details[step.id][1] && h('span', details[step.id][1])))),
        condition(S.day, group.day, '天'), condition(trades, group.trades, '次'));
    })))),
    h('div.guide-note', '两项达标即开放，设备需另购。'),
  ));
}
function openPhone() {
  modal((close) => {
    const host = h('div.sheet.phone-sheet');
    const draw = () => {
      const pending = G.phoneDeliveries();
      fill(host, h('h2', '电话订货', closeX(close)),
        h('div.context-line', h('span', `现在下单：第${G.S.day + 1}天到货`), ruleButton('订货规则', () => openRuleDetails('订货规则', [
          h('p', '付款后次日送达，每位联系人每天一单。'), h('p', '放不下的货会继续保留；领完上笔订货后才能再下单。')]))), h('div.scroll',
        pending.map((o) => h('div.supply-row', h('div.grow', h('b', o.name || '待领货物'), h('div.machine-status', `${o.remaining.reduce((n, it) => n + it.qty, 0)}件待领 · 货架空${Math.max(0, G.S.shelfCap - G.S.shelf.length)}格`)),
          h('button.btn.small.mint', { disabled: G.S.shelf.length >= G.S.shelfCap, onclick: () => {
            const r = G.collectPhoneDelivery(o.id); saveRun(); refreshHud(); draw();
            toast(r.ok && r.got.length ? `已领取 ${r.got.length} 件` : r.reason || '货架已满，货物继续保留');
          } }, '领货'))),
        G.phoneContacts().map((contact) => h('section.supply-contact', h('h3', contact.name),
          contact.pending ? h('p.machine-status', contact.pending.due > G.S.day ? `${contact.pending.name} · 明日送达` : '上笔订货尚未领完') : contact.lastDay === G.S.day ? h('p.machine-status', '今天已经订过货') : null,
          contact.packages.map((pkg) => h('div.supply-row', h('div.grow', h('b', pkg.name),
            h('div.machine-status', pkg.items.map((it) => `${ITEMS[it.id]?.name || it.id}×${it.qty}`).join('、')),
            !pkg.available && pkg.reason === '鱼币不足' && h('div.machine-status', pkg.reason)),
            h('button.btn.small', { disabled: !pkg.available, onclick: () => {
              const r = G.placePhoneOrder(contact.id, pkg.id);
              if (!r.ok) return toast(r.reason || '订货失败');
              saveRun(); refreshHud(); draw(); toast('已订货，明日送达');
            } }, `${pkg.price} 订货`)))))));
    };
    draw(); return host;
  }, { onClose: () => {
    if (stage.querySelector('.day-screen')) {
      refreshBar(); refreshHud();
      const c = G.current();
      if (c?.kind === 'buy' && !busy) {
        if (c.item && G.allItems().includes(c.item)) drawBuyHaggle(c); else drawBuyPick(c);
      }
    } else if (stage.querySelector('.night-screen')) renderNight();
  } });
}
function openModification(mid) {
  modal((close) => {
    const plan = G.machineModificationPlan(mid);
    return h('div.dialog.px', h('h2', plan.name || MACHINES[mid].name + '改装', closeX(close)),
      h('p', plan.effect || ''),
      h('div.mod-materials', (plan.inputs || []).map((it) => h('span.mod-material', img(itemImg(it.id)), h('span', `${ITEMS[it.id]?.name || it.id} ${it.have}/${it.qty}`)))),
      !plan.ok && h('p.machine-status', plan.reason),
      h('button.btn.mint', { disabled: !plan.ok, onclick: () => {
        const r = G.modifyMachine(mid); if (!r.ok) return toast(r.reason || '无法改装');
        saveRun(); close(); renderNight(); toast('改装完成');
      } }, `改装 ${plan.cost || 0} 鱼币`));
  }, { center: true });
}

function nightFront(body) {
  const S = G.S;
  const signs = Object.entries(SIGNS).filter(([, g]) => !g.need || S.up[g.need]);
  const win = G.winItems();
  appendContent(body,
    h('div.label', '灯牌（决定明天来的客人）'),
    h('div.list', signs.map(([k, g]) => h('button.li.px.sign' + (S.sign === k ? '.on' : ''), { onclick: () => { S.sign = k; saveRun(); renderNight(); } },
      equipmentSeat(k), h('div.grow', h('div.t', g.name), h('div.d', g.d)), S.sign === k ? h('span.label', '亮着') : null))),
    signs.length < 4 && h('div.label', '乔伊小铺还有别的灯牌'),
    h('div.label', `橱窗 ${win.length}/3 · 摆出来的货会吸引对应的买家`),
    h('div.shelf-grid', S.shelf.map((it) => h('button.slot.px' + (S.win.includes(it.uid) ? '.sel' : ''), {
      onclick: () => { if (!G.toggleWin(it)) toast('橱窗最多摆 3 件'); saveRun(); renderNight(); },
    }, itemTags(it), img(icon(it)), nm(it)))),
    S.up.appraisal_certificate && h('button.btn.paper', { 'aria-pressed': String(!!S.growth?.appraisalDisplay), onclick: () => { G.setAppraisalDisplay(!S.growth?.appraisalDisplay); saveRun(); renderNight(); } }, equipmentSeat('appraisal_certificate'), S.growth?.appraisalDisplay ? '收起鉴定招牌' : '摆出鉴定招牌'),
  );
}
function nightBook(body) {
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
      h('div.stat', h('span', `下次房租（${rent.days ? rent.days + '天后' : '今天'}）`), h('b', String(rent.amount))),
      h('div.stat', h('span', '赎店价格'), h('b', String(BUYOUT))),
    ),
    h('div.card.px', { style: 'flex-direction:column;align-items:stretch;gap:6px' }, h('div.label', '阵营好感（≥2 可以刷脸）'), Object.keys(FACS).map(rep)),
    h('div.market-outlook', h('b', '明日：' + next.t), h('div', next.d), G.nextVisit() && h('div', visitSummary(G.nextVisit()))),
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
  saveRun();
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
          S.hiddenCap > 0 && h('div', { style: 'margin-top:14px' }, h('div.context-line', h('span', `暗格 ${S.hidden.length}/${S.hiddenCap}`), ruleButton('存放规则', () => openRuleDetails('存放规则', [h('p', '警长只查货架，暗格中的货物不参与查店。'), h('p', '赃物在货架或暗格中每晚都会降1点热度；违禁品不会随过夜洗白。')]))), h('div.shelf-grid', { style: 'margin-top:6px' }, S.hidden.map((it) => slot(it, true)), empty(S.hiddenCap - S.hidden.length))),
        ),
        sel && h('div', { style: 'display:flex;flex-direction:column;gap:10px' },
          itemCard(sel, { showStolen: sel.stolenKnown, right: sel.cost ? h('div.label', `进价 ${sel.cost}`) : null }),
          G.isWater(sel) && ruleButton('水质说明', openWaterDetails),
          h('div.row',
            G.canLabel(sel) && h('button.btn.small.pink', { disabled: S.money < 2 ? true : null, onclick: () => { if (G.labelWater(sel)) { sel.selfLab = true; sfx('good'); saveRun(); } draw(sel); } }, '贴「纯净水」标 −2'),
            sel.selfLab && h('button.btn.small.paper', { onclick: () => { G.unlabel(sel); sel.selfLab = false; saveRun(); draw(sel); } }, '撕标签'),
            S.hiddenCap > 0 && h('button.btn.small', { disabled: S.hidden.includes(sel) ? S.shelf.length >= S.shelfCap : S.hidden.length >= S.hiddenCap, onclick: () => { if (!G.moveItem(sel)) toast(S.hidden.includes(sel) ? '货架满了' : '暗格满了'); else saveRun(); draw(); } }, S.hidden.includes(sel) ? (S.shelf.length >= S.shelfCap ? '货架已满' : '摆上货架') : (S.hidden.length >= S.hiddenCap ? '暗格已满' : '藏进暗格')),
            h('button.btn.small.red', { onclick: () => { G.removeItem(sel); saveRun(); draw(); } }, '丢掉'))),
      );
    };
    draw();
    return host;
  }, { onClose: () => { if (G.S.phase === 'night') renderNight(); else { refreshBar(); refreshHud(); const c = G.current(); if (c && !busy) ({ sell: drawSell, buy: (x) => (x.item ? drawBuyHaggle(x) : drawBuyPick(x)) }[c.kind])?.(c); } } });
}
const deadlineText = (o) => o.due === G.S.day ? '今天截止（含今天）' : `第${o.due}天截止（含当天） · 剩${Math.max(0, o.due - G.S.day)}天`;
function openOrders() {
  modal((close) => {
    const host = h('div.sheet.selection-sheet');
    const drawOrders = () => {
      fill(host,
        h('h2', '送货订单', closeX(close)), ruleButton('交货规则', openOrderRules),
        G.S.orders.length ? h('div.scroll', h('div.list', G.S.orders.map((o) => {
          const plan = G.orderPlan(o);
          return h('div.order-row',
            h('div.order-heading', img(itemImg(o.id)), h('div.grow', h('div.t', `${G.orderName(o)} ×${o.qty}`), h('div.d', deadlineText(o)))),
            h('div.order-status', h('span', `候选 ${Math.min(o.qty, plan.have)}/${o.qty} · 缺${Math.max(0, o.qty - plan.have)}`), h('b', `报酬 ${o.reward}`)),
            h('button.btn.small.mint', { 'data-order': o.uid || `${o.id}-${o.due}`, onclick: () => drawDelivery(o) }, '选货交付'),
          );
        }))) : h('div.empty-state', '还没有订单，留意来客的备货需求。'),
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
        ruleButton('交货规则', openOrderRules),
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
    h('button.btn.paper', { onclick: () => { close(); openProgressGuide(); } }, '经营指引'),
    G.growthStatus().phone && h('button.btn', { onclick: () => { close(); openPhone(); } }, '电话订货', G.phoneDeliveries().length ? ' · 有货待领' : ''),
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
  if (win) { meta.fastest = meta.fastest ? Math.min(meta.fastest, days) : days; unlock('buyout'); if (days <= 25) unlock('fast'); }
  saveMeta();
  board.submit(worth, win ? days : 0);
  if (!store.del(RUN_KEY)) saveIssue = '本局已结束，但旧存档未能清除。请恢复存储后重试。';
  music(win ? 'day' : 'night');
  if (win) sfx('ach'); else sfx('bad');
  fill(stage, h('div.screen.end-screen',
    h('div.panel.end-panel',
      h('div.end-hero', img(catImg(win ? 'player' : 'landlord')),
        h('h2', win ? '店铺是我的啦！' : '当铺关门了……'),
        h('div.label', win ? `第 ${days} 天，橘子赎回了喵喵当铺。` : `第 ${days} 天，交不起房租的橘子收拾起行李。`)),
      h('div.card.px', { style: 'flex-direction:column;align-items:stretch;gap:0' },
        h('div.stat', h('span', '营业天数'), h('b', String(days))),
        h('div.stat', h('span', '最终身家'), h('b', String(worth))),
        h('div.stat', h('span', '收货 / 卖货'), h('b', `${S.st.buy} / ${S.st.sell}`)),
        h('div.stat', h('span', '识破赝品'), h('b', String(S.st.fakeSpot))),
        h('div.stat', h('span', '历史最高身家'), h('b', String(meta.best)))),
      h('div.row', h('button.btn.paper', { onclick: openBoard }, '排行榜'), h('button.btn.paper', { onclick: openAch }, '成就')),
      h('button.btn.big', { onclick: newGame }, '再开一家'),
      h('button.btn.small.paper', { onclick: () => renderTitle() }, '回到标题'),
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
// Retry inside every activation: returning from a phone interruption may require
// a fresh touchend (pointerdown alone is not an activation on mobile browsers).
for (const event of ['pointerdown', 'pointerup', 'touchend', 'keydown']) {
  document.addEventListener(event, unlockAudio, { capture: true, passive: true });
}
window.addEventListener('pageshow', unlockAudio);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveRun(); else unlockAudio();
});
renderTitle();
ads.preload();
// 预载图片，减少首次出场闪烁
for (const id of Object.keys(CATS)) new Image().src = catImg(id);
for (const id of Object.keys(ITEMS)) new Image().src = itemImg(id);
