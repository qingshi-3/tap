// 备战界面：货架（单位 + 补给）、队列、HUD；开战后交给 battle.ts 播放
import '../qb/css/prep-battle.css';
import '../qb/css/shop-layout.css';
import '../qb/css/v08.css';
import '../qb/css/economy-bindings.css';
import '../qb/css/v05.css';
import { ALL, ATOM_INFO, BOSSES, card, EQUIP, EVENT_INFO, FOOD, fxFood, LINE_INFO, Q_INFO, RELIC, type RelicId } from '../core/data';
import {
  AD_RETRY_MAX, AD_SAVE_MAX, adRelic, adRetry, trialFight, adReroll, adSaveHeart, adUpgradeChest, autoSlot, BAG_MAX, buy, chestPick, discardBag, endTurn, enemyLossCost, equipFromBag, fight, foodNeedsTarget, foodPrice, foodStats,
  FORM_INFO, lvlOf, MAX_COPIES, maxLives, maxTier, MERC_FIGHTS, mercTier, morphPool, moveOwned, pickRelic, resolveEvent, orangeCapped, ORANGE_MAX, chestCanUp, pickBranch, PRICE, REROLL, reroll, save, sell, sellPrice, settleBattle, shownStats, toggleLock, unequip, useFood,
  WIN_GOAL, type Enemy, type Owned, type RunState, type ShopFx, type ShopItem,
} from '../core/run';
import { QUEUE_MAX, type BattleOut } from '../core/engine';
import { setMusicRun, sfx } from '../qb/audio';
import { Board, bodyPos, headPos, keywordsOf, slotX, SLOT_SPACING, UNIT_Y, UnitView } from '../qb/board';
import { draftCard, foodCard, tierBadge } from '../qb/card';
import { codexScreen } from './codex';
import { h, toStage, wait } from '../qb/dom';
import { icon } from '../qb/icons';
import { kwRich } from '../qb/kwtext';
import { itemIcon } from '../qb/pixelItems';
import { equipIcon, equipTip, foodTip, hideTip, setTipHideHook, showTip, unitTip } from '../qb/tip';
import { showRewardedAd } from './ads';
import type { Side } from '../qb/shim';
import { computeLinks } from './links';
import { unitSvg } from '../qb/unitArt';
import { audioSettings } from '../qb/audioSettings';
import type { App } from './app';
import { BattlePlayer } from './battle';

type DragKind = 'card' | 'unit' | 'bag';
interface Drag { kind: DragKind; idx: number; startX: number; startY: number; ghost: HTMLElement | null; src: HTMLElement; pid: number }

const relicTip = (id: RelicId) => h('div', { class: 'tip-unit', style: '--fc:#ffd36b' },
  h('div', { class: 'tip-head' }, h('div', { class: 'tip-name' }, RELIC[id].name), h('span', { class: 'tip-fac' }, '遗物')),
  h('div', { class: 'tip-text' }, RELIC[id].text));
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lineColor = (def: string) => LINE_INFO[card(def).line].color;

export class Game {
  el: HTMLElement;
  board = new Board();
  private hud = h('div', { class: 'hud' });
  private banner = h('div', { class: 'stage-banner' });
  private tray = h('div', { class: 'tray paid-shelf' });
  private bar = h('div', { class: 'battle-bar' });
  private bagEl = h('div', { class: 'bag-strip' });
  /** 刚锁定 / 解锁的货架格，下一次 renderTray 播锁链动画 */
  private lockFx: { sid: number; on: boolean } | null = null;
  private drag: Drag | null = null;
  private releaseDrag: (() => void) | null = null;
  private sellZone: { el: HTMLElement; rect: { x: number; y: number; w: number; h: number } } | null = null;
  private busy = false;
  private disposed = false;
  private player: BattlePlayer | null = null;
  /** 播放商店效果时，每个单位当前显示的攻血（效果逐条加上去） */
  private shown = new Map<number, { atk: number; hp: number }>();
  /** 点选中的单位：画出它技能相关的连线 */
  private focus: { side: Side; slot: number } | null = null;

  constructor(private app: App, public run: RunState) {
    this.el = h('div', { class: 'screen game' }, this.board.el, this.banner, this.hud, this.bagEl, this.tray, this.bar);
    setTipHideHook(() => { if (this.focus) this.setFocus(null); });
  }

  get fx() { return this.app.fx; }
  private get editable() { return !this.busy && !this.disposed && this.run.phase === 'prep'; }

  dispose() {
    this.disposed = true;
    setTipHideHook(null);
    this.releaseDrag?.();
    this.player?.skip();
  }

  start() {
    setMusicRun('pdqs', Math.min(2, Math.floor((this.run.turn - 1) / 4)));
    this.renderAll(this.run.pendingFx);
    this.cardsIn();
    this.board.views.forEach((v, i) => v.appear(Number(i.slice(1)) % 5 * 60));
    void this.intro();
  }

  /** 回合开始：先开装备箱，再选岔路，最后播放商店效果 */
  private async intro() {
    this.busy = true;
    while (this.run.relicPick && !this.disposed) await this.showRelic();
    if (this.disposed) return;
    if (this.run.chest) await this.showChest();
    if (this.disposed) return;
    if (this.run.event) await this.showEvent();
    if (this.disposed) return;
    if (this.run.branch) await this.showBranch();
    if (this.disposed) return;
    this.busy = false;
    await this.playPending();
  }

  private async playPending() {
    const fx = this.run.pendingFx;
    if (!fx.length) return;
    this.run.pendingFx = [];
    save(this.run);
    this.busy = true;
    await wait(500);
    await this.playFx(fx);
    this.busy = false;
  }

  // ───────────── 渲染 ─────────────

  private renderAll(pending: ShopFx[] = []) {
    this.renderHud();
    this.renderBanner();
    this.renderTray();
    this.renderBoard(pending);
  }

  private renderHud() {
    const r = this.run;
    const lives = h('div', { class: 'hud-lives' }, Array.from({ length: maxLives(r) }, (_, i) => h('span', { class: `life${i < r.lives ? ' on' : ''}` }, icon('heart'))));
    const relics = r.relics.length ? h('div', { class: 'hud-relics' }, ...r.relics.map((id) => {
      const b = h('button', { class: 'hud-relic', 'aria-label': RELIC[id].name }, itemIcon(`rl_${id.slice(2)}`, 'spell'));
      b.addEventListener('click', () => {
        sfx.click();
        const rc = b.getBoundingClientRect(), sc = this.el.getBoundingClientRect();
        const k = 1280 / sc.width;
        showTip(relicTip(id), (rc.left + rc.width / 2 - sc.left) * k, (rc.bottom - sc.top) * k + 6, 'below');
      });
      return b;
    })) : null;
    const route = h('div', { class: 'route' },
      h('div', { class: 'route-line' }, h('div', { class: 'route-fill', style: `width:${(Math.min(r.wins, WIN_GOAL - 1) / (WIN_GOAL - 1)) * 100}%` })),
      Array.from({ length: WIN_GOAL }, (_, i) => {
        const last = i === WIN_GOAL - 1;
        return h('button', { class: `rnode k-${last ? 'boss' : 'normal'}${i === r.wins ? ' cur' : ''}${i < r.wins ? ' done r-win' : ''}`, title: last ? BOSSES.final.name : `第 ${i + 1} 胜` },
          last ? icon('crown') : h('b', null, i + 1), i < r.wins ? h('span', { class: 'rn-ok' }, icon('check')) : null);
      }));
    const menu = h('button', { class: 'icon-btn', 'aria-label': '菜单' }, icon('menu'));
    menu.addEventListener('click', () => { sfx.click(); this.showMenu(); });
    const book = h('button', { class: 'icon-btn hud-book', 'aria-label': '图鉴' }, icon('book'));
    book.addEventListener('click', () => { sfx.click(); this.showCodex(); });
    const tierNow = h('div', { class: 'hud-tier', title: '商店当前能刷到的最高阶' }, h('span', null, '可刷'), tierBadge(maxTier(r.turn)));
    this.hud.replaceChildren(
      h('div', { class: 'hud-left' }, lives, relics),
      route,
      h('div', { class: 'hud-right' }, tierNow, h('div', { class: 'hud-wins' }, h('span', null, '回合'), h('b', null, r.turn)), book, menu),
    );
  }

  private showCodex() {
    const ov = codexScreen(() => ov.remove(), maxTier(this.run.turn));
    ov.classList.add('cx-ingame');
    this.el.appendChild(ov);
  }

  private showMenu() {
    const home = h('button', { class: `btn ghost${this.busy ? ' disabled' : ''}`, disabled: this.busy }, icon('menu'), h('span', null, this.busy ? '战斗中无法返回' : '保存并返回标题'));
    const quit = h('button', { class: 'btn danger' }, icon('flag'), h('span', null, '放弃本局'));
    const close = this.app.modal(h('div', { class: 'confirm game-menu', 'aria-label': '菜单' }, h('h3', null, '菜单'), audioSettings(), h('div', { class: 'menu-btns' }, home, quit)), 'audio-dialog', document.body);
    home.addEventListener('click', () => { if (this.busy) return; close(); save(this.run); this.app.toTitle(); });
    quit.addEventListener('click', () => {
      close();
      this.app.confirm('放弃本局？', '本局计为失败，无法恢复。', '放弃', () => { this.run.phase = 'lost'; this.app.endRun(this.run); });
    });
  }

  private renderBanner() {
    const r = this.run;
    const boss = r.enemy.boss;
    this.banner.className = `stage-banner k-${boss ? 'boss' : 'normal'}`;

    const elite = r.enemy.elite ?? [];
    const form = r.enemy.form;
    if (elite.length) this.banner.classList.add('k-elite');
    this.banner.replaceChildren(
      h('div', { class: 'sb-title' },
        boss ? h('span', { class: 'sb-kind' }, 'Boss') : elite.length ? h('span', { class: 'sb-kind elite' }, '精英') : null,
        h('span', { class: 'sb-no' }, `第 ${r.turn} 回合 · 输掉扣 ${enemyLossCost(r)} 心`),
        h('b', null, boss ? BOSSES[boss].name : form ? FORM_INFO[form].name : '对手阵容'),
        ...elite.map((a) => h('span', { class: 'sb-ax', title: ATOM_INFO[a].name }, itemIcon(ATOM_INFO[a].icon, 'spell'), ATOM_INFO[a].name))),
      ...(boss ? [h('div', { class: 'sb-hint' }, BOSSES[boss].desc)] : form ? [h('div', { class: 'sb-hint' }, FORM_INFO[form].hint)] : []),
    );
  }

  private ownedStats(o: Owned) {
    const [atk, hp] = shownStats(o);
    return { atk, hp };
  }

  private renderBoard(pending: ShopFx[] = []) {
    const b = this.board;
    const r = this.run;
    this.setFocus(null);
    b.clearUnits();
    b.setCenter('VS', '', '');
    // 待播放的效果先从显示数值里扣掉，播放时逐条加回
    this.shown.clear();
    for (const o of r.queue) if (o) this.shown.set(o.oid, this.ownedStats(o));
    for (const f of pending) if (f.kind === 'buff') { const s = this.shown.get(f.tgt); if (s) { s.atk -= f.atk; s.hp -= f.hp; } }
    r.queue.forEach((o, i) => {
      if (!o) return;
      const v = new UnitView(o.def, 0, i, lvlOf(o.copies));
      b.add(`o${o.oid}`, v);
      this.paintOwned(v, o);
      v.el.addEventListener('pointerdown', (e) => this.dragStart(e, 'unit', i, v.el));
    });
    r.enemy.units.forEach((u, i) => {
      if (i >= QUEUE_MAX) return;
      const d = card(u.def);
      const v = new UnitView(u.def, 1, i, u.lvl, { token: !!d.token });
      b.add(`e${i}`, v);
      v.setStats({ atk: u.atk, hp: u.hp, maxHp: u.hp, block: 0, chill: 0, burn: 0, kw: keywordsOf(d.kws) });
      v.setEquips([...(u.ench ? [u.ench] : []), ...(u.ax ?? []).map((a) => ATOM_INFO[a].icon)]);
      v.el.addEventListener('click', () => {
        if (this.busy) return;
        sfx.click();
        this.setFocus({ side: 1, slot: i });
        const tip = unitTip(u.def, u.lvl, { atk: u.atk, hp: u.hp, kws: d.kws, ench: u.ench }, false);
        if (u.ax?.length) tip.appendChild(h('div', { class: 'tip-text tip-ench' }, h('b', { class: 'tip-elite' }, '精英词缀'),
          ...u.ax.flatMap((a) => [h('br'), itemIcon(ATOM_INFO[a].icon, 'spell', 'tip-item'), `${ATOM_INFO[a].name}：${ATOM_INFO[a].desc}`])));
        showTip(tip, slotX(1, i), UNIT_Y + 62, 'below', headPos(1, i).y - 30, this.arrowBox());
      });
    });
    this.dropHints();
  }

  /** 只画与焦点单位相关的箭头（发出 + 指向它），其余单位压暗；箭头按跨度分车道避免交叠 */
  /** 当前关系箭头 + 标签的外框（舞台坐标），详情要让开 */
  private arrowBox() {
    const els = [...this.el.querySelectorAll<Element>('.arrows .arw-g, .arrow-labels .arw-lbl')];
    if (!els.length) return null;
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const e of els) {
      const rc = e.getBoundingClientRect();
      if (!rc.width && !rc.height) continue;
      const a = toStage(rc.left, rc.top), z = toStage(rc.right, rc.bottom);
      l = Math.min(l, a.x); t = Math.min(t, a.y); r = Math.max(r, z.x); b = Math.max(b, z.y);
    }
    return l < r ? { l, t, r, b } : null;
  }

  private setFocus(f: { side: Side; slot: number } | null) {
    this.focus = f;
    const b = this.board;
    b.clearArrows();
    b.el.classList.toggle('focusing', !!f);
    for (const v of b.views.values()) v.el.classList.remove('focus', 'linked');
    if (!f) return;
    const r = this.run;
    const links = computeLinks([
      r.queue.map((o) => (o ? { def: o.def, lvl: lvlOf(o.copies) } : null)),
      r.enemy.units.slice(0, QUEUE_MAX).map((u) => ({ def: u.def, lvl: u.lvl })),
    ]).filter((l) => (l.from.side === f.side && l.from.slot === f.slot) || (l.to.side === f.side && l.to.slot === f.slot));
    const at = (p: { side: Side; slot: number }) => ({ x: Math.max(30, Math.min(1250, slotX(p.side, p.slot))), y: headPos(p.side, p.slot).y + 4 });
    const linked = new Set<string>();
    const lanes: { lo: number; hi: number; lane: number }[] = [];
    // 同一句时机只标一次（标在跨度最短的那条上），避免一排「阵亡时」
    const said = new Set<string>();
    links
      .map((l) => {
        const p0 = at(l.from);
        const p1 = at(l.to);
        // 原位召唤：箭头绕回自己头顶
        if (p0.x === p1.x && l.from.side === l.to.side) p1.x += l.from.side === 0 ? -34 : 34;
        return { l, p0, p1 };
      })
      .sort((a, z) => Math.abs(a.p1.x - a.p0.x) - Math.abs(z.p1.x - z.p0.x))
      .forEach(({ l, p0, p1 }, k) => {
        linked.add(`${l.from.side}-${l.from.slot}`).add(`${l.to.side}-${l.to.slot}`);
        const lo = Math.min(p0.x, p1.x) - 20, hi = Math.max(p0.x, p1.x) + 20;
        let lane = 0;
        while (lanes.some((x) => x.lane === lane && x.lo < hi && lo < x.hi)) lane++;
        lanes.push({ lo, hi, lane });
        const label = l.label && !said.has(l.label) ? l.label : undefined;
        if (l.label) said.add(l.label);
        b.arrow(p0, p1, l.kind, {
          label,
          lift: 40 + Math.abs(p1.x - p0.x) * 0.14 + lane * 30,
          labelDx: lane === 0 ? 0 : (lane % 2 ? 1 : -1) * 28 * Math.ceil(lane / 2),
          delay: k * 70,
          ...(l.broken ? { color: '#ff3b5c', cls: 'broken' } : {}),
        });
      });
    for (const v of b.views.values()) {
      const isF = v.side === f.side && v.slot === f.slot;
      v.el.classList.toggle('focus', isF);
      v.el.classList.toggle('linked', !isF && linked.has(`${v.side}-${v.slot}`));
    }
  }

  private paintOwned(v: UnitView, o: Owned, pop = false) {
    const s = this.shown.get(o.oid) ?? this.ownedStats(o);
    const kws = [...card(o.def).kws, ...(o.lamp ? ['reborn'] : []), ...(o.tfx?.includes('splash') ? ['splash'] : [])];
    v.setStats({ atk: s.atk + (o.tmpAtk ?? 0), hp: s.hp + (o.tmpHp ?? 0), maxHp: s.hp + (o.tmpHp ?? 0), block: 0, chill: 0, burn: 0, kw: keywordsOf(kws) }, { pop });
    v.setExp(o.copies);
    v.setEquips([...(o.ench ? [o.ench] : []), ...(o.tmpAtk || o.tmpHp ? ['f_drum'] : []), ...(o.lamp ? ['f_lamp'] : []), ...(o.tfx ?? []).map((x) => fxFood(x).id)]);
    v.setFoodHistory(card(o.def).inherit ? (o.foodHistory?.length ?? 0) : null);
    if (o.merc) v.setTag(`雇佣 剩${o.merc}场`, 'merc');
    else if (card(o.def).ab === 'egg') v.setTag(`幼龙 ${1 + (o.bank ?? 0)}/${1 + (o.bank ?? 0)}`, 'bank'); else v.setTag(null);
  }

  private viewOf(oid: number) {
    return this.board.views.get(`o${oid}`);
  }

  private renderTray() {
    const r = this.run;
    this.tray.classList.remove('hidden');
    const rerollBtn = h('button', { class: 'btn ghost reroll', disabled: r.gold < REROLL }, h('span', { class: 'rr-main' }, icon('refresh'), h('span', null, '刷新')), h('i', null, `${REROLL} 金`));
    rerollBtn.addEventListener('click', () => void this.doReroll());
    const adUsed = r.adRr === r.turn;
    const adBtn = h('button', { class: 'btn ghost reroll rewarded', disabled: adUsed }, h('span', { class: 'rr-main' }, icon('play'), h('span', null, '刷新')), h('i', null, adUsed ? '已用' : '广告'));
    adBtn.addEventListener('click', () => void this.doAdReroll());
    const left = h('div', { class: 'tray-left' },
      h('div', { class: 'tl-gold', role: 'status', 'aria-label': `金币 ${r.gold}` }, itemIcon('coin', 'coin'), h('b', null, r.gold)), rerollBtn, adBtn);
    const units = r.shop.map((it, i) => ({ it, i })).filter((x) => x.it.kind === 'unit');
    const foods = r.shop.map((it, i) => ({ it, i })).filter((x) => x.it.kind === 'food');
    const cards = h('div', { class: 'cards', 'data-count': units.length });
    for (const { it, i } of units) cards.appendChild(this.shopCard(it, i));
    const supplies = h('div', { class: 'supplies', 'aria-label': '补给' },
      h('div', { class: 'sp-list' }, ...foods.map(({ it, i }) => this.foodTile(it, i))));
    const size = r.queue.filter(Boolean).length;
    const fightBtn = h('button', { class: `btn primary fight${size ? '' : ' disabled'}`, disabled: !size }, h('span', null, '开 战'), icon('play'));
    fightBtn.addEventListener('click', () => { if (size && this.editable) void this.startBattle(); });
    const trialBtn = h('button', { class: 'btn ghost trial', disabled: !size }, icon('eye'), h('span', null, '试打'));
    trialBtn.addEventListener('click', () => { if (size && this.editable) void this.startTrial(); });
    this.el.querySelector('.btn.trial')?.remove();
    this.el.appendChild(trialBtn);
    this.tray.replaceChildren(left, cards, supplies, h('div', { class: 'tray-right' }, h('div', { class: 'fight-controls' }, h('div', { class: 'tr-team' }, `${size}/${QUEUE_MAX}`), fightBtn)));
    this.renderBag();
    this.lockFx = null;
  }

  /** 锁定：四方锁链包围；刚锁上从四边缠绕落锁，刚解开反向退回 */
  private chainsFor(it: ShopItem, c: HTMLElement) {
    const fx = this.lockFx?.sid === it.sid ? this.lockFx : null;
    if (!it.locked && !fx) return null;
    const mode = it.locked ? (fx ? 'in' : '') : 'out';
    if (mode === 'in') c.classList.add('locked-shake');
    return h('div', { class: `chains ${mode}`, 'aria-hidden': 'true' },
      ...['t', 'r', 'b', 'l'].map((k) => h('span', { class: `ch-side ch-${k}` }, h('i'))), h('i', { class: 'ch-lock' }));
  }

  /** 背包：3 格装备，拖到单位身上装备，拖到货架丢弃，点开看说明 */
  private renderBag() {
    const r = this.run;
    this.bagEl.classList.toggle('hidden', !r.bag.length && !r.queue.some((o) => o?.ench));
    this.bagEl.replaceChildren(h('span', { class: 'bag-head' }, '背包'),
      ...Array.from({ length: BAG_MAX }, (_, i) => {
        const id = r.bag[i];
        if (!id) return h('div', { class: 'bag-slot empty' });
        const el = h('div', { class: `bag-slot eq-q${EQUIP[id].q}`, role: 'button', 'aria-label': EQUIP[id].name }, equipIcon(id));
        el.addEventListener('pointerdown', (e) => this.dragStart(e, 'bag', i, el));
        return el;
      }));
  }

  /** 补给单独一栏：小方块（图标 + 名字 + 价格），点开详情，拖到单位身上使用 */
  private foodTile(it: ShopItem, i: number) {
    const f = FOOD[it.def];
    const c = h('div', { class: `food-tile${it.locked ? ' locked' : ''}${this.run.gold < foodPrice(it) ? ' unaffordable' : ''}`, role: 'button', tabindex: 0, 'aria-label': `补给 ${f.name}`, 'data-idx': i },
      h('div', { class: 'ft-ico' }, itemIcon(it.def, 'pack'),
        f.n || f.behind ? h('span', { class: `ft-tgt${f.n === ALL ? ' all' : ''}` }, f.n === ALL ? icon('flag') : '×2') : null,
        f.tmp ? h('span', { class: 'ft-tmp' }, icon('hourglass')) : null),
      h('b', { class: 'ft-name' }, f.name),
      (() => { const [a, hp] = foodStats(it); return a || hp ? h('span', { class: 'ft-stat' }, h('em', null, `+${a}`), '/', h('i', null, `+${hp}`)) : null; })(),
      it.def === 'f_milk' ? h('span', { class: 'ft-turn' }, '免费') : h('span', { class: 'ft-price' }, itemIcon('coin', 'coin'), String(foodPrice(it))));
    if (it.locked) c.append(h('span', { class: 'ft-locked', 'aria-label': '已锁定' }, icon('lock')));
    c.addEventListener('pointerdown', (e) => this.dragStart(e, 'card', i, c));
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.tap('card', i); } });
    return c;
  }

  private shopCard(it: ShopItem, i: number) {
    const r = this.run;
    let c: HTMLElement;
    if (it.kind === 'food') c = foodCard(it.def, it.val);
    else {
      const same = r.queue.filter((o): o is Owned => !!o && o.def === it.def);
      const target = same.filter((o) => o.copies < MAX_COPIES).sort((a, b) => b.copies - a.copies)[0];
      const next = target ? target.copies + 1 : 0;
      const goal = next <= 3 ? 3 : 6;
      c = draftCard(it.def, {
        mergeTo: target && next === goal ? lvlOf(target.copies) + 1 : undefined,
        stack: target && next !== goal ? `叠加 ${next}/${goal}` : undefined,
        maxed: !target && same.length > 0,
        plus: r.canned,
      });
    }
    // 顶部只放一条标签：奖励卡把「叠加 / 升星」并进去；锁定改成右上角小角标
    if (it.free) {
      const badge = c.querySelector(':scope > .card-badge');
      const extra = badge?.textContent?.trim();
      badge?.remove();
      c.classList.add('bonus-card');
      c.append(h('span', { class: 'bonus-tag' }, icon('star'), extra ? `升星奖励 · ${extra}` : '升星奖励', h('i', { class: 'bonus-price' }, itemIcon('coin', 'coin', 'sm'), String(PRICE))));
    }
    if (it.locked) c.classList.add('locked');
    const ch = this.chainsFor(it, c);
    if (ch) c.append(ch);
    if (r.gold < PRICE) c.classList.add('unaffordable');
    c.dataset.idx = String(i);
    c.setAttribute('role', 'button');
    c.addEventListener('pointerdown', (e) => this.dragStart(e, 'card', i, c));
    return c;
  }

  private cardsIn() {
    if (reduced()) return;
    this.tray.querySelectorAll('.card, .food-tile').forEach((c, i) =>
      c.animate([{ transform: 'translateY(60px) rotate(4deg)', opacity: 0 }, { transform: 'translateY(0) rotate(0)', opacity: 1 }],
        { duration: 380, delay: i * 70, easing: 'cubic-bezier(.2,.9,.3,1.15)', fill: 'backwards' }));
  }

  // ───────────── 拖拽 ─────────────

  private dragStart(e: PointerEvent, kind: DragKind, idx: number, src: HTMLElement) {
    if (!this.editable || e.button > 0 || this.drag || !e.isPrimary) return;
    e.preventDefault();
    hideTip();
    this.drag = { kind, idx, startX: e.clientX, startY: e.clientY, ghost: null, src, pid: e.pointerId };
    const move = (ev: PointerEvent) => { if (ev.pointerId === this.drag?.pid) this.dragMove(ev); };
    const up = (ev: PointerEvent) => { if (ev.pointerId !== this.drag?.pid) return; this.releaseDrag?.(); this.dragEnd(ev); };
    this.releaseDrag = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      this.releaseDrag = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  private dragDef(d: Drag) {
    return d.kind === 'card' ? this.run.shop[d.idx]?.def : d.kind === 'bag' ? this.run.bag[d.idx] : this.run.queue[d.idx]?.def;
  }

  private dragMove(e: PointerEvent) {
    const d = this.drag;
    if (!d) return;
    if (!d.ghost) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return;
      const def = this.dragDef(d);
      if (!def) { this.drag = null; this.releaseDrag?.(); return; }
      const food = d.kind === 'card' && this.run.shop[d.idx].kind === 'food';
      d.ghost = d.kind === 'bag' ? h('div', { class: 'drag-ghost food' }, equipIcon(def)) : food ? h('div', { class: 'drag-ghost food' }, itemIcon(def, 'pack')) : h('div', { class: 'drag-ghost', html: unitSvg(def) });
      this.el.appendChild(d.ghost);
      d.src.classList.add('lifted');
      if (d.kind === 'unit') this.openSellZone(d.idx);
      if (d.kind === 'bag') this.openSellZone(-1);
      sfx.pick();
    }
    const p = toStage(e.clientX, e.clientY);
    this.sellZone?.el.classList.toggle('hot', this.overSell(p));
    d.ghost.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-60%) rotate(${Math.max(-12, Math.min(12, (e.movementX || 0) * 1.5))}deg)`;
    this.dropHints(this.slotAt(p.x, p.y));
  }

  private dragEnd(e: PointerEvent) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    const p = toStage(e.clientX, e.clientY);
    const sellDrop = d.kind !== 'card' && !!d.ghost && this.overSell(p);
    d.src.classList.remove('lifted');
    this.sellZone?.el.remove();
    this.sellZone = null;
    this.dropHints();
    if (e.type === 'pointercancel') { d.ghost?.remove(); return; }
    if (!d.ghost) { this.tap(d.kind, d.idx); return; }
    const ghost = d.ghost;
    if (sellDrop) { ghost.remove(); if (d.kind === 'bag') this.doDiscard(d.idx); else void this.doSell(d.idx); return; }
    const slot = this.slotAt(p.x, p.y);
    let ok = false;
    if (d.kind === 'card') {
      const it = this.run.shop[d.idx];
      if (it?.kind === 'food') {
        if (slot != null) ok = this.doFood(d.idx, slot);
        else if (!foodNeedsTarget(it.def) && p.y < 520) ok = this.doFood(d.idx, null);
      } else if (slot != null) ok = this.doBuy(d.idx, slot);
    } else if (d.kind === 'bag') { if (slot != null) ok = this.doEquip(d.idx, slot); }
    else if (slot != null) ok = this.doMove(d.idx, slot);
    if (ok) ghost.remove();
    else this.returnGhost(ghost, d.src);
  }

  private returnGhost(ghost: HTMLElement, source: HTMLElement) {
    if (reduced() || !source.isConnected) { ghost.remove(); return; }
    const r = source.getBoundingClientRect();
    const home = toStage(r.left + r.width / 2, r.top + r.height / 2);
    const a = ghost.animate([
      { transform: ghost.style.transform, opacity: 1 },
      { transform: `translate(${home.x}px,${home.y}px) translate(-50%,-60%) scale(.6)`, opacity: 0 },
    ], { duration: 220, easing: 'ease-in' });
    const done = () => ghost.remove();
    void a.finished.then(done, done);
  }

  private slotAt(x: number, y: number): number | null {
    if (y < UNIT_Y - 110 || y > UNIT_Y + 90) return null;
    for (let s = 0; s < QUEUE_MAX; s++) if (Math.abs(x - slotX(0, s)) < SLOT_SPACING / 2) return s;
    return null;
  }

  private dropKind(slot: number): string {
    const d = this.drag;
    if (!d?.ghost) return '';
    const r = this.run;
    const at = r.queue[slot];
    if (d.kind === 'card') {
      const it = r.shop[d.idx];
      if (!it) return '';
      if (it.kind === 'food') return foodNeedsTarget(it.def) ? (at ? 'merge' : 'invalid') : 'place';
      if (!at) return 'place';
      return at.def === it.def && at.copies < MAX_COPIES ? 'merge' : 'invalid';
    }
    if (d.kind === 'bag') return at ? 'merge' : 'invalid';
    if (slot === d.idx) return '';
    const from = r.queue[d.idx];
    if (!at) return 'move';
    return from && at.def === from.def && at.copies < MAX_COPIES && from.copies < MAX_COPIES ? 'merge' : 'swap';
  }

  private dropHints(hover: number | null = null) {
    const active = !!this.drag?.ghost;
    for (let s = 0; s < QUEUE_MAX; s++) {
      const el = this.board.slotEl(0, s);
      const k = active ? this.dropKind(s) : '';
      el.dataset.drop = k;
      el.classList.toggle('drop-hover', active && hover === s && !!k && k !== 'invalid');
    }
    this.board.el.classList.toggle('dropping', active);
  }

  /** slot = -1：丢弃背包里的装备 */
  private openSellZone(slot: number) {
    const o = this.run.queue[slot];
    const cards = this.tray.querySelector<HTMLElement>('.cards');
    if ((!o && slot >= 0) || !cards) return;
    const b = cards.getBoundingClientRect();
    const a = toStage(b.left, b.top), z = toStage(b.right, b.bottom);
    const rect = { x: a.x, y: a.y, w: z.x - a.x, h: z.y - a.y };
    const el = h('div', { class: 'sell-zone', style: `left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px` },
      h('b', null, o ? '拖到这里出售' : '拖到这里丢弃'), h('span', null, `+${o ? sellPrice(o) : 1} 金`));
    this.el.appendChild(el);
    this.sellZone = { el, rect };
  }

  private overSell(p: { x: number; y: number }) {
    const r = this.sellZone?.rect;
    return !!r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  // ───────────── 点击：详情 + 按钮 ─────────────

  private tap(kind: DragKind, idx: number) {
    sfx.click();
    const r = this.run;
    if (kind === 'unit') {
      const o = r.queue[idx];
      if (!o) return;
      const s = this.ownedStats(o);
      const tip = unitTip(o.def, lvlOf(o.copies), { ...s, ench: o.ench, tmpAtk: o.tmpAtk, tmpHp: o.tmpHp, lamp: o.lamp, tfx: o.tfx, copies: o.copies, kws: card(o.def).kws, foodHistory: o.foodHistory }, true);
      const sellBtn = h('button', { class: 'btn ghost shelf-lock' }, `出售 +${sellPrice(o)} 金`);
      sellBtn.addEventListener('click', () => { hideTip(); void this.doSell(idx); });
      const acts = h('div', { class: 'shelf-acts' }, sellBtn);
      if (o.ench) {
        const off = h('button', { class: 'btn ghost shelf-lock', disabled: r.bag.length >= BAG_MAX }, r.bag.length >= BAG_MAX ? '背包已满' : '卸下装备');
        off.addEventListener('click', () => { if (!this.editable || !unequip(r, idx)) return; hideTip(); sfx.swap(); save(r); this.afterChange(); });
        acts.prepend(off);
      }
      tip.appendChild(acts);
      this.board.views.get(`o${o.oid}`)?.el.classList.add('inspected');
      this.setFocus({ side: 0, slot: idx });
      showTip(tip, slotX(0, idx), UNIT_Y + 62, 'below', headPos(0, idx).y - 30, this.arrowBox());
      return;
    }
    if (kind === 'bag') {
      const id = r.bag[idx];
      if (!id) return;
      const tip = equipTip(id, '拖到单位身上装备；原装备会退回背包。');
      const del = h('button', { class: 'btn ghost shelf-lock' }, '丢弃 +1 金');
      del.addEventListener('click', () => { hideTip(); this.doDiscard(idx); });
      tip.appendChild(h('div', { class: 'shelf-acts' }, del));
      const b = this.bagEl.getBoundingClientRect();
      const at = toStage(b.left + b.width / 2, b.top);
      showTip(tip, at.x, at.y, 'above');
      return;
    }
    const it = r.shop[idx];
    if (!it) return;
    const c0 = card(it.def);
    const tip = it.kind === 'food' ? foodTip(it.def, it.val) : unitTip(it.def, 1, r.canned ? { atk: c0.atk + r.canned, hp: c0.hp + r.canned, kws: c0.kws } : null, false);
    const acts = h('div', { class: 'shelf-acts' });
    if (it.kind === 'unit') {
      const go = h('button', { class: 'btn primary shelf-recruit' }, `招募 ${PRICE} 金`);
      go.addEventListener('click', () => {
        const slot = autoSlot(r, it.def);
        if (slot < 0) { this.notice('没有空位：拖到同名单位上叠加，或先卖掉一个'); return; }
        hideTip();
        this.doBuy(idx, slot);
      });
      acts.appendChild(go);
    } else if (!foodNeedsTarget(it.def)) {
      const go = h('button', { class: 'btn primary shelf-recruit' }, `使用 ${foodPrice(it)} 金`);
      go.addEventListener('click', () => { hideTip(); this.doFood(idx, null); });
      acts.appendChild(go);
    } else acts.appendChild(h('span', { class: 'shelf-note' }, '拖到单位身上使用'));
    if (it.def !== 'f_milk') {
      const lock = h('button', { class: 'btn ghost shelf-lock' }, it.locked ? '解锁' : '锁定');
      lock.addEventListener('click', () => {
        toggleLock(r, it.sid); hideTip(); save(r);
        this.lockFx = { sid: it.sid, on: it.locked };
        (it.locked ? sfx.chain : sfx.unchain)();
        this.renderTray();
      });
      acts.appendChild(lock);
    } else acts.appendChild(h('span', { class: 'shelf-note' }, '免费·本回合'));
    tip.appendChild(acts);
    showTip(tip, 690, 440, 'above');
  }

  private notice(text: string) {
    sfx.fizzle();
    this.fx.float(640, 200, text, 'fizzle', 1400);
  }

  // ───────────── 操作 ─────────────

  private async doReroll() {
    if (!this.editable) return;
    const fx = reroll(this.run);
    if (!fx) { this.notice('金币不够'); return; }
    sfx.swap();
    hideTip();
    save(this.run);
    this.renderTray();
    this.cardsIn();
    if (fx.length) await this.runFx(fx);
  }

  private async doAdReroll() {
    if (!this.editable || this.run.adRr === this.run.turn) return;
    this.busy = true;
    hideTip();
    const ok = await showRewardedAd(this.el, '免费刷新', '看完广告，免费刷新一次货架');
    this.busy = false;
    if (!ok || this.disposed || !adReroll(this.run)) return;
    sfx.swap();
    save(this.run);
    this.renderTray();
    this.cardsIn();
  }

  private doEquip(i: number, slot: number): boolean {
    if (!this.editable) return false;
    const r = this.run;
    const id = r.bag[i];
    if (!id || !equipFromBag(r, i, slot)) return false;
    save(r);
    this.afterChange();
    const p = bodyPos(0, slot);
    const c = Q_INFO[EQUIP[id].q].color;
    sfx.buff();
    this.fx.ring(p.x, p.y, c, 64, 26);
    this.fx.statPop(p.x, p.y - 70, '', EQUIP[id].name, 'pt-block');
    this.viewOf(r.queue[slot]!.oid)?.pulse(c);
    return true;
  }

  private doDiscard(i: number) {
    if (!this.editable) return;
    if (!discardBag(this.run, i)) return;
    save(this.run);
    sfx.reward();
    this.fx.float(120, 420, '+1 金', 'levelup', 800);
    this.afterChange();
  }

  // ───────────── 岔路 / 装备箱 / 遗物 / 事件 ─────────────

  /** 遗物：3 选 1，广告多一选（每次 1 次）。先点选再确认，手机上不会误触 */
  private showRelic(): Promise<void> {
    const r = this.run;
    return new Promise((done) => {
      const ov = h('div', { class: 'chest-ov relic-ov' });
      let sel = -1;
      const paint = (fresh: number) => {
        const p = r.relicPick!;
        const take = h('button', { class: 'btn primary rl-take', disabled: true }, '先选一件');
        const items = p.opts.map((id, i) => {
          const d = RELIC[id];
          const el = h('button', { class: 'rl-card' },
            h('div', { class: 'rl-art' }, h('i', { class: 'rl-rays' }), h('i', { class: 'rl-ped' }), itemIcon(`rl_${id.slice(2)}`, 'spell', 'rl-ico')),
            h('b', { class: 'rl-name' }, d.name),
            h('i', { class: 'rl-rule' }),
            h('p', { class: 'rl-text' }, ...kwRich(d.text)));
          el.addEventListener('click', () => {
            sfx.click();
            sel = i;
            items.forEach((x, j) => { x.classList.toggle('on', j === i); x.classList.toggle('off', j !== i); });
            take.disabled = false;
            take.replaceChildren(`拿走「${d.name}」`);
          });
          if (i >= fresh && !reduced()) el.animate([{ transform: 'rotateY(90deg) scale(.8)', opacity: 0 }, { transform: 'rotateY(0) scale(1)', opacity: 1 }],
            { duration: 420, delay: 150 + (i - fresh) * 220, easing: 'cubic-bezier(.2,1.3,.4,1)', fill: 'backwards' });
          return el;
        });
        take.addEventListener('click', () => {
          if (sel < 0) return;
          sfx.reward();
          pickRelic(r, sel);
          save(r);
          ov.remove();
          this.renderHud();
          done();
        });
        const ad = h('button', { class: 'btn ghost reroll rewarded chest-ad', disabled: p.ad }, h('span', { class: 'rr-main' }, icon('play'), h('span', null, '多翻一件')), h('i', null, p.ad ? '已用' : '广告'));
        ad.addEventListener('click', async () => {
          if (p.ad) return;
          const ok = await showRewardedAd(this.el, '遗物多一选', '再多翻开一件遗物');
          if (!ok) return;
          const n = p.opts.length;
          if (!adRelic(r)) return;
          save(r);
          sel = -1;
          paint(n);
        });
        const owned = r.relics.length ? h('div', { class: 'rl-owned' }, h('span', null, '已有'), ...r.relics.map((id) => itemIcon(`rl_${id.slice(2)}`, 'spell'))) : null;
        ov.replaceChildren(h('div', { class: 'chest-card rl-wrap' },
          h('div', { class: 'rl-ribbon' }, '战利品'),
          h('h2', null, '选一件遗物'),
          h('p', null, '整局生效'),
          h('div', { class: 'rl-cards' }, ...items),
          h('div', { class: 'rl-acts' }, ...(owned ? [owned] : []), take, ad)));
      };
      paint(0);
      this.el.appendChild(ov);
      sfx.start();
    });
  }

  /** 事件：替代岔路的一次奇遇；需要选单位的选项先选人 */
  private showEvent(): Promise<void> {
    const r = this.run;
    const ev = r.event!;
    const info = EVENT_INFO[ev];
    type Opt = { label: string; sub: string; unit?: (o: Owned) => boolean; choice: number };
    const filled = r.queue.filter((o): o is Owned => !!o);
    const opts: Opt[] = ev === 'camp' ? [
      { label: '加练', sub: '选一个友军永久 +3/+3', unit: () => true, choice: 0 },
      { label: '领装备', sub: '随机一件蓝色装备进背包', choice: 1 },
    ] : ev === 'smith' ? [
      { label: '锻造', sub: '选一个友军直接升一星，随机另一个友军离队', unit: (o) => !o.merc && o.copies < MAX_COPIES, choice: 0 },
    ] : ev === 'morph' ? [
      { label: '跳进去', sub: '选一个友军，变成同阶同标签的另一张卡，成长和装备保留', unit: (o) => !o.merc && morphPool(o).length > 0, choice: 0 },
    ] : ev === 'merc' ? [
      { label: '雇佣', sub: `一个 ${mercTier(r)} 阶 2 星单位免费入队 ${MERC_FIGHTS} 场，不能出售和合并`, choice: 0 },
    ] : [
      { label: '签约', sub: '接下来 3 场敌人更强（含本场），熬过去选一件遗物', choice: 0 },
    ];
    const usable = (o: Opt) => {
      if (o.unit) {
        const ok = filled.filter(o.unit);
        if (!ok.length) return false;
        if (ev === 'smith') return filled.filter((x) => !x.merc).length >= 2;
        return true;
      }
      if (ev === 'merc') return filled.length < QUEUE_MAX;
      return true;
    };
    return new Promise((done) => {
      const ov = h('div', { class: 'branch-ov event-ov' });
      const finish = async (choice: number, slot: number | null) => {
        const res = resolveEvent(r, choice, slot);
        if (!res.ok) { this.notice('现在不行'); return; }
        sfx.reward();
        save(r);
        ov.remove();
        this.renderAll();
        if (res.ok && res.lost) this.notice(`${card(res.lost.def).name} 离队了`);
        if (res.ok && res.morphed) this.notice(`变成了 ${card(res.morphed).name}`);
        if (res.ok && res.fx.length) await this.runFx(res.fx);
        done();
      };
      const pickUnit = (o: Opt) => {
        const units = r.queue.map((u, i) => ({ u, i })).filter((x): x is { u: Owned; i: number } => !!x.u && o.unit!(x.u));
        const back = h('button', { class: 'btn ghost' }, h('span', null, '返回'));
        back.addEventListener('click', () => { sfx.click(); main(); });
        ov.replaceChildren(h('div', { class: 'branch-card' }, h('h2', null, o.label), h('p', null, o.sub),
          h('div', { class: 'ev-units' }, ...units.map(({ u, i }) => {
            const b = h('button', { class: 'ev-unit' }, h('span', { class: 'bo-art', html: unitSvg(u.def) }),
              h('b', null, card(u.def).name), h('span', { class: 'ev-lv' }, '★'.repeat(lvlOf(u.copies))));
            b.addEventListener('click', () => void finish(o.choice, i));
            return b;
          })), back));
      };
      const main = () => {
        const btns = opts.map((o) => {
          const ok = usable(o);
          const b = h('button', { class: `branch-opt ev-opt${ok ? '' : ' disabled'}`, disabled: !ok },
            h('div', { class: 'bo-head' }, h('b', null, o.label)), h('div', { class: 'ev-sub' }, ok ? o.sub : `${o.sub}（现在不满足条件）`));
          b.addEventListener('click', () => { if (!ok) return; sfx.click(); if (o.unit) pickUnit(o); else void finish(o.choice, null); });
          return b;
        });
        const leave = h('button', { class: 'btn ghost' }, h('span', null, '离开'));
        leave.addEventListener('click', () => void finish(-1, null));
        ov.replaceChildren(h('div', { class: 'branch-card ev-card' },
          h('div', { class: 'ev-ico' }, itemIcon(`ev_${ev}`, 'spell')), h('h2', null, info.name), h('p', null, info.text),
          h('div', { class: 'branch-opts ev-opts' }, ...btns), leave));
      };
      main();
      this.el.appendChild(ov);
      sfx.whoosh();
    });
  }

  /** 岔路：两个敌阵预览二选一 */
  private showBranch(): Promise<void> {
    const r = this.run;
    const opts = r.branch!;
    return new Promise((done) => {
      const pickIt = (i: number) => {
        sfx.click();
        pickBranch(r, i);
        save(r);
        ov.remove();
        this.renderBanner();
        this.renderBoard();
        done();
      };
      const optEl = (e: Enemy, i: number) => {
        const elite = e.elite ?? [];
        const btn = h('button', { class: `branch-opt${elite.length ? ' elite' : ''}` },
          h('div', { class: 'bo-head' },
            elite.length ? h('span', { class: 'bo-tag' }, '精英') : h('span', { class: 'bo-tag normal' }, '普通'),
            h('b', null, e.form ? FORM_INFO[e.form].name : '对手')),
          h('div', { class: 'bo-units' }, ...e.units.slice(0, QUEUE_MAX).map((u) => h('span', { class: 'bo-u' }, h('span', { class: 'bo-art', html: unitSvg(u.def) }),
            h('span', { class: 'bo-st' }, h('b', { class: 'a' }, u.atk), h('b', { class: 'h' }, u.hp))))),
          elite.length ? h('div', { class: 'bo-ax' }, ...elite.map((a) => h('span', null, itemIcon(ATOM_INFO[a].icon, 'spell'), ATOM_INFO[a].name))) : null,
          h('div', { class: 'bo-foot' }, elite.length ? h('span', { class: 'bo-risk' }, `输掉扣 2 心`) : h('span', null, `输掉扣 ${enemyLossCost({ turn: r.turn, enemy: e })} 心`),
            elite.length ? h('span', { class: 'bo-reward' }, '胜利开装备箱') : null));
        btn.addEventListener('click', () => pickIt(i));
        return btn;
      };
      const ov = h('div', { class: 'branch-ov' },
        h('div', { class: 'branch-card' }, h('h2', null, '岔路'), h('p', null, '选一个对手'),
          h('div', { class: 'branch-opts' }, ...opts.map(optEl))));
      this.el.appendChild(ov);
      sfx.whoosh();
    });
  }

  /** 装备箱：3 件翻牌，选 1；看广告升一品重抽，不限次（紫→橙每局限 2 次） */
  private showChest(): Promise<void> {
    const r = this.run;
    return new Promise((done) => {
      const ov = h('div', { class: 'chest-ov' });
      const paint = (flip: boolean) => {
        const c = r.chest!;
        const capped = orangeCapped(r);
        const left = ORANGE_MAX - (r.adOrange ?? 0);
        const up = chestCanUp(r);
        const items = c.items.map((id, i) => {
          const e = EQUIP[id];
          const el = h('button', { class: `chest-item eq-q${e.q}` },
            h('div', { class: 'ci-beam' }),
            h('div', { class: 'ci-ico' }, equipIcon(id)),
            h('b', { class: 'ci-name', style: `color:${Q_INFO[e.q].color}` }, e.name),
            h('span', { class: 'ci-q' }, Q_INFO[e.q].name, e.curse ? ' · 诅咒' : ''),
            h('div', { class: 'ci-text' }, e.text),
            e.q === 2 && (capped || left <= 0) ? h('span', { class: 'ci-cap' }, '橙装已达上限') : null);
          el.addEventListener('click', () => {
            sfx.reward();
            chestPick(r, i);
            save(r);
            ov.remove();
            this.renderTray();
            done();
          });
          if (flip && !reduced()) el.animate([{ transform: 'rotateY(90deg) scale(.8)', opacity: 0 }, { transform: 'rotateY(0) scale(1)', opacity: 1 }],
            { duration: 420, delay: 200 + i * 260, easing: 'cubic-bezier(.2,1.3,.4,1)', fill: 'backwards' });
          if (flip) setTimeout(() => { if (e.q >= 2) sfx.reward(); else sfx.place(); if (e.q === 3) this.fx.flash('#ffa23a', 0.25, 300); }, 200 + i * 260);
          return el;
        });
        const ad = h('button', { class: 'btn ghost reroll rewarded chest-ad', disabled: !up }, h('span', { class: 'rr-main' }, icon('play'), h('span', null, '升一品重抽')),
          h('i', null, up ? `紫→橙 ${Math.max(0, left)}/${ORANGE_MAX}` : '已满'));
        ad.addEventListener('click', async () => {
          if (!chestCanUp(r)) return;
          const ok = await showRewardedAd(this.el, '升品重抽', '装备全部提升一个品质后重新抽取');
          if (!ok || !adUpgradeChest(r)) return;
          save(r);
          paint(true);
        });
        ov.replaceChildren(h('div', { class: 'chest-card' },
          h('h2', null, c.src === 'boss' ? 'Boss 宝箱' : '精英宝箱'), h('p', null, '选 1 件放进背包'),
          h('div', { class: 'chest-items' }, ...items), h('div', { class: 'chest-acts' }, ad)));
      };
      paint(true);
      this.el.appendChild(ov);
      sfx.start();
    });
  }

  private doBuy(idx: number, slot: number): boolean {
    if (!this.editable) return false;
    const r = this.run;
    const it = r.shop[idx];
    if (!it) return false;
    const before = r.queue[slot]?.copies ?? 0;
    const res = buy(r, it.sid, slot);
    if (!res.ok) { this.notice(res.why === 'gold' ? '金币不够' : res.why === 'max' ? '已满 6 份' : '这里有别的单位'); return false; }
    save(r);
    this.afterChange();
    const o = r.queue[slot]!;
    const v = this.viewOf(o.oid);
    const p = bodyPos(0, slot);
    if (res.merged) {
      sfx.merge();
      this.fx.ring(p.x, p.y, lineColor(o.def), 70, 30);
      this.fx.statPop(p.x, p.y - 70, `+${o.copies - before}/+${o.copies - before}`, res.levelUp ? `升 ${lvlOf(o.copies)} 星` : '叠加', res.levelUp ? 'pt-power' : 'pt-hp');
      v?.pulse(lineColor(o.def));
    } else {
      sfx.place();
      v?.appear();
      this.fx.burst(p.x, UNIT_Y + 10, lineColor(o.def), { n: 14, speed: 4 });
    }
    if (res.levelUp) { sfx.reward(); this.cardsIn(); }
    if (res.fx.length) void this.runFx(res.fx);
    return true;
  }

  private doFood(idx: number, slot: number | null): boolean {
    if (!this.editable) return false;
    const r = this.run;
    const it = r.shop[idx];
    if (!it) return false;
    const res = useFood(r, it.sid, slot);
    if (!res.ok) { this.notice(res.why === 'gold' ? '金币不够' : '这里不能用'); return false; }
    save(r);
    const f = FOOD[it.def];
    const tgt = slot != null ? r.queue[slot] : null;
    // 指定目标的成长先扣掉再播
    this.afterChange(res.fx);
    sfx.buff();
    if (tgt) {
      const p = bodyPos(0, slot!);
      this.fx.ring(p.x, p.y, '#ffd36b', 60, 26);
      if (!res.fx.length) this.fx.statPop(p.x, p.y - 70, '', f.name, 'pt-block');
      this.viewOf(tgt.oid)?.pulse('#ffd36b');
    } else if (!res.fx.length) this.fx.statPop(640, 220, '', f.name, 'pt-block');
    if (res.levelUp) { sfx.reward(); this.cardsIn(); }
    void this.runFx(res.fx);
    return true;
  }

  private doMove(from: number, to: number): boolean {
    if (!this.editable) return false;
    const r = this.run;
    const res = moveOwned(r, from, to);
    if (!res) return false;
    save(r);
    this.afterChange();
    if (res.merged) {
      const o = r.queue[to]!;
      const p = bodyPos(0, to);
      sfx.merge();
      this.fx.ring(p.x, p.y, lineColor(o.def), 70, 30);
      if (res.levelUp) { this.fx.statPop(p.x, p.y - 70, '', `升 ${lvlOf(o.copies)} 星`, 'pt-power'); sfx.reward(); this.cardsIn(); }
      if (res.fx.length) void this.runFx(res.fx);
    } else sfx.swap();
    return true;
  }

  private async doSell(slot: number) {
    if (!this.editable) return;
    const r = this.run;
    const o = r.queue[slot];
    if (!o) return;
    const p = bodyPos(0, slot);
    const res = sell(r, slot);
    if (!res) return;
    save(r);
    hideTip();
    sfx.reward();
    const v = this.viewOf(o.oid);
    void v?.die();
    this.fx.float(p.x, p.y - 60, `+${res.gold} 金`, 'levelup', 900);
    this.fx.burst(p.x, p.y, '#ffd36b', { n: 16, speed: 5 });
    await wait(260);
    this.afterChange(res.fx);
    await this.runFx(res.fx, { [o.oid]: p });
  }

  /** 状态变了：重绘货架 / HUD / 队列（可指定待播的效果，先扣数值） */
  private afterChange(pending: ShopFx[] = []) {
    this.renderHud();
    this.renderTray();
    this.renderBoard(pending);
  }

  private async runFx(fx: ShopFx[], gone: Record<number, { x: number; y: number }> = {}) {
    if (!fx.length) return;
    this.busy = true;
    try { await this.playFx(fx, gone); } finally { this.busy = false; }
  }

  /** 逐条播放商店效果：箭头 + 数字弹出 */
  private async playFx(fx: ShopFx[], gone: Record<number, { x: number; y: number }> = {}) {
    const posOf = (oid: number | null) => {
      if (oid == null) return null;
      const v = this.viewOf(oid);
      return v ? bodyPos(0, v.slot) : gone[oid] ?? null;
    };
    for (const f of fx) {
      if (this.disposed) return;
      const from = posOf(f.src);
      if (f.kind === 'buff') {
        const to = posOf(f.tgt);
        const o = this.run.queue.find((x) => x?.oid === f.tgt);
        if (!to || !o) continue;
        if (from && f.src !== f.tgt) {
          this.board.arrow({ x: from.x, y: from.y - 50 }, { x: to.x, y: to.y - 50 }, 'buff', { label: f.label, lift: 40 + Math.abs(to.x - from.x) * 0.14 });
          this.fx.orb({ x: from.x, y: from.y - 30 }, { x: to.x, y: to.y - 30 }, lineColor(o.def), 320);
          await wait(320);
        } else if (from) {
          this.viewOf(f.src!)?.castMotion(lineColor(o.def));
          await wait(160);
        }
        const s = this.shown.get(f.tgt);
        if (s) { s.atk += f.atk; s.hp += f.hp; }
        const v = this.viewOf(f.tgt);
        if (v) this.paintOwned(v, o, true);
        sfx.buff();
        this.fx.statPop(to.x, to.y - 74, `+${f.atk}/+${f.hp}`, f.label, f.atk >= f.hp ? 'pt-atk' : 'pt-hp', 820);
        await wait(300);
        this.board.clearArrows();
      } else {
        if (from) { this.viewOf(f.src)?.castMotion('#ffb36b'); this.fx.statPop(from.x, from.y - 74, `+${f.n}/+${f.n}`, '蛋里的幼龙', 'pt-power', 820); }
        const o = this.run.queue.find((x) => x?.oid === f.src);
        const v = o && this.viewOf(o.oid);
        if (o && v) this.paintOwned(v, o);
        sfx.buff();
        await wait(380);
      }
    }
  }

  // ───────────── 战斗 ─────────────

  private async startBattle() {
    if (!this.editable) return;
    const r = this.run;
    this.busy = true;
    hideTip();
    sfx.start();
    const snap = structuredClone(r);
    const turnFx = endTurn(r);
    this.renderHud();
    this.renderTray();
    this.renderBoard(turnFx);
    await this.playFx(turnFx);
    if (this.disposed) return;
    const out = fight(r);
    const before = { lives: r.lives, wins: r.wins, turn: r.turn, boss: r.enemy.boss };
    settleBattle(r, out);
    save(r);
    // 战斗表现
    this.el.classList.add('in-battle');
    this.tray.classList.add('hidden');
    this.bar.classList.add('on');
    await this.playOut(out);
    if (this.disposed) return;
    await wait(400);
    this.showResult(out, before, snap);
  }

  private async playOut(out: BattleOut) {
    this.el.classList.add('in-battle');
    this.tray.classList.add('hidden');
    this.bar.classList.add('on');
    this.player = new BattlePlayer(this.board, this.fx, this.bar);
    await this.player.play(out);
    this.player = null;
  }

  /** 复盘：关掉结算框重播一遍，播完再弹回来 */
  private replayBtn(out: BattleOut, ov: HTMLElement) {
    const b = h('button', { class: 'btn ghost res-replay' }, icon('replay'), h('span', null, '复盘'));
    b.addEventListener('click', async () => {
      sfx.click();
      ov.remove();
      await this.playOut(out);
      if (this.disposed) return;
      await wait(300);
      this.el.appendChild(ov);
    });
    return b;
  }

  /** 回到备战（结算/试打/重打之后） */
  private backToPrep(intro: boolean) {
    const r = this.run;
    this.el.classList.remove('in-battle');
    this.bar.classList.remove('on');
    this.busy = false;
    this.board.clearArrows();
    setMusicRun('pdqs', Math.min(2, Math.floor((r.turn - 1) / 4)));
    this.renderAll(intro ? r.pendingFx : []);
    this.cardsIn();
    if (intro) void this.intro();
  }

  /** 试打：副本上打一场，不计结果、不改存档 */
  private async startTrial() {
    if (!this.editable) return;
    this.busy = true;
    hideTip();
    sfx.start();
    const out = trialFight(this.run);
    await this.playOut(out);
    if (this.disposed) return;
    await wait(300);
    const title = out.result === 'win' ? '试打：胜' : out.result === 'lose' ? '试打：负' : '试打：平';
    const back = h('button', { class: 'btn primary' }, h('span', null, '回去调整'), icon('play'));
    const ov = h('div', { class: `result-ov r-trial r-${out.result}` },
      h('div', { class: 'res-card' }, h('div', { class: 'res-title' }, title), h('div', { class: 'res-sub' }, '不计胜负 · 正式开战有随机'),
        h('div', { class: 'res-btns' })));
    ov.querySelector('.res-btns')!.append(this.replayBtn(out, ov), back);
    back.addEventListener('click', () => { sfx.click(); ov.remove(); this.backToPrep(false); });
    this.el.appendChild(ov);
  }

  private showResult(out: BattleOut, before: { lives: number; wins: number; turn: number; boss: string | null }, snap: RunState) {
    const r = this.run;
    const result = out.result;
    if (result === 'win') sfx.win(); else if (result === 'lose') sfx.lose(); else sfx.fizzle();
    const lost = before.lives - r.lives;
    const title = result === 'win' ? (before.boss ? 'Boss 击破' : '胜利') : result === 'lose' ? '失败' : '平局';
    const sub = result === 'win' ? `${r.wins}/${WIN_GOAL} 胜` : result === 'lose' ? `失去 ${lost} 心` : '不扣心，也不算胜场';
    const go = h('button', { class: 'btn primary' }, h('span', null, '继续'), icon('play'));
    const ov = h('div', { class: `result-ov r-${result}` },
      h('div', { class: 'res-card' },
        h('div', { class: 'res-rays' }),
        h('div', { class: 'res-title' }, title),
        h('div', { class: 'res-sub' }, sub),
        h('div', { class: 'res-lives' }, Array.from({ length: maxLives(r) }, (_, i) => h('span', { class: `life${i < r.lives ? ' on' : i < before.lives ? ' lost' : ''}` }, icon('heart')))),
        h('div', { class: 'res-btns' }, go)));
    if (result === 'lose' && r.lastLoss && r.adSave < AD_SAVE_MAX) {
      const ad = h('button', { class: 'btn ghost reroll rewarded res-ad' }, h('span', { class: 'rr-main' }, icon('play'), h('span', null, '看广告保心')), h('i', null, `${AD_SAVE_MAX - r.adSave}/${AD_SAVE_MAX}`));
      ad.addEventListener('click', async () => {
        ad.setAttribute('disabled', '');
        const ok = await showRewardedAd(this.el, '保住心', '看完广告，这场失败不扣心');
        if (!ok || !adSaveHeart(r)) { ad.removeAttribute('disabled'); return; }
        save(r);
        ad.remove();
        ov.querySelector('.res-retry')?.remove();
        ov.querySelector('.res-sub')!.textContent = '已保住，不扣心';
        ov.querySelectorAll('.res-lives .life').forEach((el, i) => { el.className = `life${i < r.lives ? ' on' : ''}`; });
      });
      ov.querySelector('.res-btns')!.prepend(ad);
    }
    // 看广告重打：退回开战前，重新调整再打（和保心二选一）
    if (result === 'lose' && (r.adRetry ?? 0) < AD_RETRY_MAX) {
      const ad = h('button', { class: 'btn ghost reroll rewarded res-ad res-retry' }, h('span', { class: 'rr-main' }, icon('play'), h('span', null, '看广告重打')), h('i', null, `${AD_RETRY_MAX - (r.adRetry ?? 0)}/${AD_RETRY_MAX}`));
      ad.addEventListener('click', async () => {
        ad.setAttribute('disabled', '');
        const ok = await showRewardedAd(this.el, '重打', '看完广告，回到开战前重新调整阵容');
        if (!ok || !adRetry(r, snap)) { ad.removeAttribute('disabled'); return; }
        save(r);
        ov.remove();
        this.backToPrep(false);
      });
      ov.querySelector('.res-btns')!.prepend(ad);
    }
    ov.querySelector('.res-btns')!.prepend(this.replayBtn(out, ov));
    this.el.appendChild(ov);
    if (!reduced()) ov.querySelector('.res-card')!.animate([{ transform: 'scale(.8)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,1.4,.4,1)' });
    if (result === 'win') this.fx.burst(640, 260, '#ffd36b', { n: 40, speed: 8 });
    go.addEventListener('click', () => {
      sfx.click();
      ov.remove();
      if (r.phase !== 'prep') { this.app.endRun(r); return; }
      this.backToPrep(true);
    });
  }
}
