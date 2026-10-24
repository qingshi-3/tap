// 备战界面：货架（单位 + 补给）、队列、HUD；开战后交给 battle.ts 播放
import '../qb/css/prep-battle.css';
import '../qb/css/shop-layout.css';
import '../qb/css/v08.css';
import '../qb/css/economy-bindings.css';
import { BOSSES, card, FOOD, LINE_INFO } from '../core/data';
import {
  autoSlot, buy, endTurn, fight, foodNeedsTarget, lossCost, lvlOf, MAX_COPIES, MAX_LIVES, moveOwned, ownedAtk, ownedHp, PRICE, REROLL,
  reroll, save, sell, sellPrice, settleBattle, toggleLock, useFood, WIN_GOAL, type Owned, type RunState, type ShopFx, type ShopItem,
} from '../core/run';
import { QUEUE_MAX } from '../core/engine';
import { setMusicRun, sfx } from '../qb/audio';
import { Board, bodyPos, headPos, keywordsOf, slotX, SLOT_SPACING, UNIT_Y, UnitView } from '../qb/board';
import { draftCard, foodCard } from '../qb/card';
import { h, toStage, wait } from '../qb/dom';
import { icon } from '../qb/icons';
import { itemIcon } from '../qb/pixelItems';
import { foodOfEnch, foodTip, hideTip, setTipHideHook, showTip, unitTip } from '../qb/tip';
import type { Side } from '../qb/shim';
import { computeLinks } from './links';
import { unitSvg } from '../qb/unitArt';
import { audioSettings } from '../qb/audioSettings';
import type { App } from './app';
import { BattlePlayer } from './battle';

type DragKind = 'card' | 'unit';
interface Drag { kind: DragKind; idx: number; startX: number; startY: number; ghost: HTMLElement | null; src: HTMLElement; pid: number }

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lineColor = (def: string) => LINE_INFO[card(def).line].color;

export class Game {
  el: HTMLElement;
  board = new Board();
  private hud = h('div', { class: 'hud' });
  private banner = h('div', { class: 'stage-banner' });
  private tray = h('div', { class: 'tray paid-shelf' });
  private bar = h('div', { class: 'battle-bar' });
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
    this.el = h('div', { class: 'screen game' }, this.board.el, this.banner, this.hud, this.tray, this.bar);
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
    void this.playPending();
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
    const lives = h('div', { class: 'hud-lives' }, Array.from({ length: MAX_LIVES }, (_, i) => h('span', { class: `life${i < r.lives ? ' on' : ''}` }, icon('heart'))));
    const route = h('div', { class: 'route' },
      h('div', { class: 'route-line' }, h('div', { class: 'route-fill', style: `width:${(Math.min(r.wins, WIN_GOAL - 1) / (WIN_GOAL - 1)) * 100}%` })),
      Array.from({ length: WIN_GOAL }, (_, i) => {
        const last = i === WIN_GOAL - 1;
        return h('button', { class: `rnode k-${last ? 'boss' : 'normal'}${i === r.wins ? ' cur' : ''}${i < r.wins ? ' done r-win' : ''}`, title: last ? BOSSES.final.name : `第 ${i + 1} 胜` },
          last ? icon('crown') : h('b', null, i + 1), i < r.wins ? h('span', { class: 'rn-ok' }, icon('check')) : null);
      }));
    const menu = h('button', { class: 'icon-btn', 'aria-label': '菜单' }, icon('menu'));
    menu.addEventListener('click', () => { sfx.click(); this.showMenu(); });
    this.hud.replaceChildren(
      h('div', { class: 'hud-left' }, lives),
      route,
      h('div', { class: 'hud-right' }, h('div', { class: 'hud-wins' }, h('span', null, '回合'), h('b', null, r.turn)), menu),
    );
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
    const hint: Record<string, string> = {
      wall: '叠满格挡的铁壁，拖长交锋',
      tide: '亡者不断复生、召唤',
      wheel: '五名精英轮番上前',
      final: '吞噬阵亡者越战越强',
    };
    this.banner.replaceChildren(
      h('div', { class: 'sb-title' },
        boss ? h('span', { class: 'sb-kind' }, 'Boss') : null,
        h('span', { class: 'sb-no' }, `第 ${r.turn} 回合 · 输掉扣 ${lossCost(r.turn)} 心`),
        h('b', null, boss ? BOSSES[boss].name : '对手阵容')),
      ...(boss ? [h('div', { class: 'sb-hint' }, hint[boss])] : []),
    );
  }

  private ownedStats(o: Owned) {
    return { atk: ownedAtk(o), hp: ownedHp(o) };
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
      v.el.addEventListener('click', () => {
        if (this.busy) return;
        sfx.click();
        this.setFocus({ side: 1, slot: i });
        showTip(unitTip(u.def, u.lvl, { atk: u.atk, hp: u.hp, kws: d.kws }, false), slotX(1, i), UNIT_Y + 62, 'below', headPos(1, i).y - 30);
      });
    });
    this.dropHints();
  }

  /** 只画与焦点单位相关的箭头（发出 + 指向它），其余单位压暗；箭头按跨度分车道避免交叠 */
  private setFocus(f: { side: Side; slot: number } | null) {
    this.focus = f;
    const b = this.board;
    b.clearArrows();
    b.el.classList.toggle('focusing', !!f);
    for (const v of b.views.values()) v.el.classList.remove('focus', 'linked');
    if (!f) return;
    const r = this.run;
    const links = computeLinks([
      r.queue.map((o) => (o ? { def: o.def, lvl: lvlOf(o.copies), rotate: o.ench === 'rotate' } : null)),
      r.enemy.units.slice(0, QUEUE_MAX).map((u) => ({ def: u.def, lvl: u.lvl })),
    ]).filter((l) => (l.from.side === f.side && l.from.slot === f.slot) || (l.to.side === f.side && l.to.slot === f.slot));
    const at = (p: { side: Side; slot: number }) => ({ x: Math.max(30, Math.min(1250, slotX(p.side, p.slot))), y: headPos(p.side, p.slot).y + 4 });
    const linked = new Set<string>();
    const lanes: { lo: number; hi: number; lane: number }[] = [];
    links
      .map((l) => ({ l, p0: at(l.from), p1: at(l.to) }))
      .sort((a, z) => Math.abs(a.p1.x - a.p0.x) - Math.abs(z.p1.x - z.p0.x))
      .forEach(({ l, p0, p1 }, k) => {
        linked.add(`${l.from.side}-${l.from.slot}`).add(`${l.to.side}-${l.to.slot}`);
        const lo = Math.min(p0.x, p1.x) - 20, hi = Math.max(p0.x, p1.x) + 20;
        let lane = 0;
        while (lanes.some((x) => x.lane === lane && x.lo < hi && lo < x.hi)) lane++;
        lanes.push({ lo, hi, lane });
        b.arrow(p0, p1, l.kind, {
          label: l.label,
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
    const kws = [...card(o.def).kws, ...(o.ench === 'rotate' ? ['rotate'] : []), ...(o.lamp ? ['reborn'] : [])];
    v.setStats({ atk: s.atk + (o.drum ?? 0), hp: s.hp + (o.drum ?? 0), maxHp: s.hp + (o.drum ?? 0), block: 0, chill: 0, burn: 0, kw: keywordsOf(kws) }, { pop });
    v.setExp(o.copies);
    v.setEquips([...(o.ench ? [foodOfEnch(o.ench)] : []), ...(o.drum ? ['f_drum'] : []), ...(o.lamp ? ['f_lamp'] : [])]);
    if (card(o.def).ab === 'egg') v.setTag(`幼龙 ${1 + (o.bank ?? 0)}/${1 + (o.bank ?? 0)}`, 'bank'); else v.setTag(null);
  }

  private viewOf(oid: number) {
    return this.board.views.get(`o${oid}`);
  }

  private renderTray() {
    const r = this.run;
    this.tray.classList.remove('hidden');
    const rerollBtn = h('button', { class: 'btn ghost reroll', disabled: r.gold < REROLL }, h('span', { class: 'rr-main' }, icon('refresh'), h('span', null, '刷新')), h('i', null, `${REROLL} 金`));
    rerollBtn.addEventListener('click', () => void this.doReroll());
    const left = h('div', { class: 'tray-left' },
      h('div', { class: 'tl-gold', role: 'status', 'aria-label': `金币 ${r.gold}` }, itemIcon('coin', 'coin'), h('b', null, r.gold)), rerollBtn);
    const units = r.shop.map((it, i) => ({ it, i })).filter((x) => x.it.kind === 'unit');
    const foods = r.shop.map((it, i) => ({ it, i })).filter((x) => x.it.kind === 'food');
    const cards = h('div', { class: 'cards', 'data-count': units.length });
    for (const { it, i } of units) cards.appendChild(this.shopCard(it, i));
    const supplies = h('div', { class: 'supplies' }, h('div', { class: 'sp-head' }, '补给'),
      h('div', { class: 'sp-list' }, ...foods.map(({ it, i }) => this.foodTile(it, i))));
    const size = r.queue.filter(Boolean).length;
    const fightBtn = h('button', { class: `btn primary fight${size ? '' : ' disabled'}`, disabled: !size }, h('span', null, '开 战'), icon('play'));
    fightBtn.addEventListener('click', () => { if (size && this.editable) void this.startBattle(); });
    this.tray.replaceChildren(left, cards, supplies, h('div', { class: 'tray-right' }, h('div', { class: 'fight-controls' }, h('div', { class: 'tr-team' }, `${size}/${QUEUE_MAX}`), fightBtn)));
  }

  /** 补给单独一栏：小方块（图标 + 名字 + 价格），点开详情，拖到单位身上使用 */
  private foodTile(it: ShopItem, i: number) {
    const f = FOOD[it.def];
    const c = h('div', { class: `food-tile${it.locked ? ' locked' : ''}${this.run.gold < PRICE ? ' unaffordable' : ''}`, role: 'button', 'aria-label': `补给 ${f.name}`, 'data-idx': i },
      h('div', { class: 'ft-ico' }, itemIcon(it.def, 'pack')),
      h('b', { class: 'ft-name' }, f.name),
      h('span', { class: 'ft-price' }, itemIcon('coin', 'coin'), String(PRICE)),
      it.locked ? h('span', { class: 'ft-lock' }, '锁') : null);
    c.addEventListener('pointerdown', (e) => this.dragStart(e, 'card', i, c));
    return c;
  }

  private shopCard(it: ShopItem, i: number) {
    const r = this.run;
    let c: HTMLElement;
    if (it.kind === 'food') c = foodCard(it.def);
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
      c.append(h('span', { class: 'bonus-tag' }, icon('star'), extra ? `升星奖励 · ${extra}` : '升星奖励'));
    }
    if (it.locked) { c.classList.add('locked'); c.append(h('span', { class: 'lock-chip' }, '已锁定')); }
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
    return d.kind === 'card' ? this.run.shop[d.idx]?.def : this.run.queue[d.idx]?.def;
  }

  private dragMove(e: PointerEvent) {
    const d = this.drag;
    if (!d) return;
    if (!d.ghost) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return;
      const def = this.dragDef(d);
      if (!def) { this.drag = null; this.releaseDrag?.(); return; }
      const food = d.kind === 'card' && this.run.shop[d.idx].kind === 'food';
      d.ghost = food ? h('div', { class: 'drag-ghost food' }, itemIcon(def, 'pack')) : h('div', { class: 'drag-ghost', html: unitSvg(def) });
      this.el.appendChild(d.ghost);
      d.src.classList.add('lifted');
      if (d.kind === 'unit') this.openSellZone(d.idx);
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
    const sellDrop = d.kind === 'unit' && !!d.ghost && this.overSell(p);
    d.src.classList.remove('lifted');
    this.sellZone?.el.remove();
    this.sellZone = null;
    this.dropHints();
    if (e.type === 'pointercancel') { d.ghost?.remove(); return; }
    if (!d.ghost) { this.tap(d.kind, d.idx); return; }
    const ghost = d.ghost;
    if (sellDrop) { ghost.remove(); void this.doSell(d.idx); return; }
    const slot = this.slotAt(p.x, p.y);
    let ok = false;
    if (d.kind === 'card') {
      const it = this.run.shop[d.idx];
      if (it?.kind === 'food') {
        if (slot != null) ok = this.doFood(d.idx, slot);
        else if (!foodNeedsTarget(it.def) && p.y < 520) ok = this.doFood(d.idx, null);
      } else if (slot != null) ok = this.doBuy(d.idx, slot);
    } else if (slot != null) ok = this.doMove(d.idx, slot);
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

  private openSellZone(slot: number) {
    const o = this.run.queue[slot];
    const cards = this.tray.querySelector<HTMLElement>('.cards');
    if (!o || !cards) return;
    const b = cards.getBoundingClientRect();
    const a = toStage(b.left, b.top), z = toStage(b.right, b.bottom);
    const rect = { x: a.x, y: a.y, w: z.x - a.x, h: z.y - a.y };
    const el = h('div', { class: 'sell-zone', style: `left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px` },
      h('b', null, '拖到这里出售'), h('span', null, `+${sellPrice(o)} 金`));
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
      const tip = unitTip(o.def, lvlOf(o.copies), { ...s, ench: o.ench, drum: o.drum, lamp: o.lamp, copies: o.copies, kws: card(o.def).kws }, true);
      const sellBtn = h('button', { class: 'btn ghost shelf-lock' }, `出售 +${sellPrice(o)} 金`);
      sellBtn.addEventListener('click', () => { hideTip(); void this.doSell(idx); });
      tip.appendChild(h('div', { class: 'shelf-acts' }, sellBtn));
      this.board.views.get(`o${o.oid}`)?.el.classList.add('inspected');
      this.setFocus({ side: 0, slot: idx });
      showTip(tip, slotX(0, idx), UNIT_Y + 62, 'below', headPos(0, idx).y - 30);
      return;
    }
    const it = r.shop[idx];
    if (!it) return;
    const c0 = card(it.def);
    const tip = it.kind === 'food' ? foodTip(it.def) : unitTip(it.def, 1, r.canned ? { atk: c0.atk + r.canned, hp: c0.hp + r.canned, kws: c0.kws } : null, false);
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
      const go = h('button', { class: 'btn primary shelf-recruit' }, `使用 ${PRICE} 金`);
      go.addEventListener('click', () => { hideTip(); this.doFood(idx, null); });
      acts.appendChild(go);
    } else acts.appendChild(h('span', { class: 'shelf-note' }, '拖到单位身上使用'));
    {
      const lock = h('button', { class: 'btn ghost shelf-lock' }, it.locked ? '解锁' : '锁定');
      lock.addEventListener('click', () => { toggleLock(r, it.sid); hideTip(); sfx.click(); save(r); this.renderTray(); });
      acts.appendChild(lock);
    }
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
      } else if (f.kind === 'gold') {
        if (from) { this.viewOf(f.src)?.castMotion('#ffd36b'); this.fx.float(from.x, from.y - 70, `+${f.n} 金`, 'levelup', 900); }
        sfx.reward();
        this.renderTray();
        await wait(380);
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
    this.player = new BattlePlayer(this.board, this.fx, this.bar);
    await this.player.play(out);
    this.player = null;
    if (this.disposed) return;
    await wait(400);
    this.showResult(out.result, before);
  }

  private showResult(result: 'win' | 'lose' | 'draw', before: { lives: number; wins: number; turn: number; boss: string | null }) {
    const r = this.run;
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
        h('div', { class: 'res-lives' }, Array.from({ length: MAX_LIVES }, (_, i) => h('span', { class: `life${i < r.lives ? ' on' : i < before.lives ? ' lost' : ''}` }, icon('heart')))),
        h('div', { class: 'res-btns' }, go)));
    this.el.appendChild(ov);
    if (!reduced()) ov.querySelector('.res-card')!.animate([{ transform: 'scale(.8)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,1.4,.4,1)' });
    if (result === 'win') this.fx.burst(640, 260, '#ffd36b', { n: 40, speed: 8 });
    go.addEventListener('click', () => {
      sfx.click();
      ov.remove();
      if (r.phase !== 'prep') { this.app.endRun(r); return; }
      this.el.classList.remove('in-battle');
      this.bar.classList.remove('on');
      this.busy = false;
      this.board.clearArrows();
      setMusicRun('pdqs', Math.min(2, Math.floor((r.turn - 1) / 4)));
      this.renderAll(r.pendingFx);
      this.cardsIn();
      void this.playPending();
    });
  }
}
