import { createRehearsal, type Rehearsal } from '../core/rehearsal';
import { Tutorial } from './tutorial';
// 备战界面：货架（单位 + 补给）、队列、HUD；开战后交给 battle.ts 播放
import '../qb/css/prep-battle.css';
import '../qb/css/shop-layout.css';
import '../qb/css/v08.css';
import '../qb/css/economy-bindings.css';
import '../qb/css/v05.css';
import '../qb/css/v07-ops.css';
import '../qb/css/fusion.css';
import './mixedHand.css';
import '../qb/css/battle-redesign.css';
import { spellFeedback } from './spellFeedback';
import { ATOM_INFO, BOSSES, card, EQUIP, equipOf, equipStats, EVENT_INFO, FOOD, fxFood, HERO, LINE_INFO, Q_INFO, QUEST_INFO, RELIC, type RelicId } from '../core/data';
import {
  AD_SAVE_MAX, adSaveHeart, adRelic, trialFight, adReroll, adUpgradeChest, autoSlot, BAG_MAX, buy, chestPick, discardBag, endTurn, enemyLossCost, equipFromBag, fight, foodNeedsTarget, foodPrice, foodStats,
  FORM_INFO, tierOf, upgradeTavern, cellAt, isHand, HAND_BASE, HAND_MAX, lvlOf, MAX_COPIES, maxLives, MERC_FIGHTS, mercTier, morphPool, moveOwned, pickRelic, resolveEvent, orangeCapped, ORANGE_MAX, chestCanUp, PRICE, REROLL, reroll, save, sell, sellPrice, settleBattle, shownStats, toggleLock, unequip, useFood,
  ACTS, LAYERS, bossOf, curNode, nodeOpts, pickNode, leaveNode, passNode, isCombat, handCap, tavernPrice, buyGoods, heroReady, useHero, fireCopyOk, fireSmithOk, QUESTS, SHARD_NEED, type NodeKind,
  ownedAtk, ownedHp, prepFoodUses, pickDiscover, itemPrice, spellTargetOk, scarCap, hasScar, GUARD_N, LEGION_MAX, type Owned, type RunState, type ShopFx, type ShopItem,
  handAt, isHeldSpell, buyToHand, castHandSpell, discardHandSpell, discardHandUnit, claimReward, discardReward, inspectPlayConflict,
} from '../core/run';
import { QUEUE_MAX, type BattleOut } from '../core/engine';
import { setMusicRun, sfx } from '../qb/audio';
import { Board, bodyPos, headPos, keywordsOf, slotX, SLOT_SPACING, statArt, UNIT_Y, UnitView } from '../qb/board';
import { cardText, draftCard, foodCard } from '../qb/card';
import { codexScreen } from './codex';
import { h, toStage, wait } from '../qb/dom';
import { icon } from '../qb/icons';
import { kwRich } from '../qb/kwtext';
import { itemIcon } from '../qb/pixelItems';
import { equipIcon, equipTip, foodTip, hideTip, setTipHideHook, showDockTip, showTip, unitTip, grantedText } from '../qb/tip';
import { showRewardedAd } from './ads';
import type { Side } from '../qb/shim';
import { computeLinks } from './links';
import { unitSvg } from '../qb/unitArt';
import { audioSettings } from '../qb/audioSettings';
import type { App } from './app';
import { BattlePlayer } from './battle';
import { battleReport } from './battleReport';
import { inheritancePreview } from './prepPreview';
import { morphOutcomePreview, morphUnitPicker } from './morphPreview';

type DragKind = 'card' | 'unit' | 'bag' | 'spell';
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
  private dim = h('div', { class: 'stage-dim' });
  private bannerKey = '';
  private bannerPhase: 'none' | 'modal' | 'fly' | 'done' = 'none';
  private introTimer = 0;
  private tray = h('div', { class: 'tray paid-shelf' });
  private bar = h('div', { class: 'battle-bar' });
  private bagEl = h('div', { class: 'bag-strip' });
  private handEl = h('div', { class: 'hand-strip', 'aria-label': '手牌' });
  private tavernEl = h('div', { class: 'tavern-box', 'aria-label': '酒馆' });
  /** 刚锁定 / 解锁的货架格，下一次 renderTray 播锁链动画 */
  private lockFx: { sid: number; on: boolean } | null = null;
  private drag: Drag | null = null;
  private releaseDrag: (() => void) | null = null;
  private sellZone: { el: HTMLElement; rect: { x: number; y: number; w: number; h: number } } | null = null;
  private buyZone: HTMLElement | null = null;
  /** 入手的真实起点（客户端坐标）：拖动释放的 ghost 或点击的商店卡，仅供紧随其后的一次手牌渲染使用 */
  private flyOrigin: { x: number; y: number } | null = null;
  private handFrom: { x: number; y: number; cell?: number } | null = null;
  private _busy = false;
  private get busy() { return this._busy; }
  private set busy(value: boolean) { this._busy = value; this.syncBusy(); }
  private settling = h('div', { class: 'prep-settling', role: 'status', 'aria-live': 'polite' });
  private fastFx = false;
  private releaseFxWait: (() => void) | null = null;
  private disposed = false;
  private player: BattlePlayer | null = null;
  /** 播放商店效果时，每个单位当前显示的攻血（效果逐条加上去） */
  private shown = new Map<number, { atk: number; hp: number }>();
  /** 点选中的单位：画出它技能相关的连线 */
  private focus: { side: Side; slot: number } | null = null;

  constructor(private app: App, public run: RunState, private teaching = false) {
    this.el = h('div', { class: 'screen game' }, this.board.el, this.dim, this.banner, this.hud, this.handEl, this.tavernEl, this.bagEl, this.tray, this.bar, this.settling);
    setTipHideHook(() => { if (this.focus) this.setFocus(null); });
    this.banner.addEventListener('click', () => this.dismissStageIntro());
    this.dim.addEventListener('click', () => this.dismissStageIntro());
  }

  private tutorial: Tutorial | null = null;
  private growthPreview: RunState | null = null;
  private rehearsal: { session: Rehearsal; report: HTMLElement } | null = null;
  private persist(r: RunState) { if (!this.teaching && !this.rehearsal) save(r); }
  private allowed(a: Parameters<Tutorial['allows']>[0]) { return !this.tutorial || this.tutorial.allows(a); }

  get fx() { return this.app.fx; }
  private get editable() { return !this.busy && !this.disposed && this.run.phase === 'prep'; }

  private syncBusy() {
    if (!this.el) return;
    this.el.classList.toggle('prep-busy', this.busy);
    this.tray.setAttribute('aria-busy', String(this.busy));
    for (const b of this.el.querySelectorAll<HTMLButtonElement>('.tray button, .prep-actions button')) {
      if (this.busy && !b.disabled) { b.dataset.busyDisabled = '1'; b.disabled = true; }
      else if (!this.busy && b.dataset.busyDisabled) { delete b.dataset.busyDisabled; b.disabled = false; }
    }
    this.tray.querySelectorAll('[role="button"]').forEach((e) => e.setAttribute('aria-disabled', String(this.busy)));
  }

  private fxWait(ms: number) {
    if (this.fastFx || reduced()) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const timer = setTimeout(done, ms);
      const self = this;
      function done() { clearTimeout(timer); self.releaseFxWait = null; resolve(); }
      this.releaseFxWait = done;
    });
  }

  dispose() {
    this.disposed = true;
    this.tutorial?.dispose();
    this.fastFx = true;
    this.releaseFxWait?.();
    setTipHideHook(null);
    this.releaseDrag?.();
    this.drag?.ghost?.remove();
    this.drag = null;
    this.supplyPreview(null);
    this.buyZone?.remove();
    this.buyZone = null;
    this.flyOrigin = this.handFrom = null;
    this.handEl.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    this.player?.skip();
  }

  start() {
    setMusicRun('pdqs', Math.min(2, Math.floor((this.run.turn - 1) / 4)));
    this.renderAll(this.run.pendingFx);
    this.cardsIn();
    this.board.views.forEach((v, i) => v.appear(Number(i.slice(1)) % 5 * 60));
    if (this.teaching) this.tutorial = new Tutorial({
      el: this.el, run: this.run, busy: () => this.busy,
      render: () => this.renderAll(), finish: () => this.app.toTitle(),
    });
    void this.intro();
  }

  /** 回合开始：先开装备箱，再选岔路，最后播放商店效果 */
  private async intro() {
    this.busy = true;
    while (this.run.relicPick && !this.disposed) await this.showRelic();
    if (this.disposed) return;
    if (this.run.chest) await this.showChest();
    if (this.disposed) return;
    if (this.run.leaving) { await this.finishNode(); return; }
    if (this.run.event) await this.showEvent();
    if (this.disposed) return;
    await this.drainDiscover();
    if (this.disposed) return;
    if (this.run.path[this.run.layer] === undefined) await this.showMap(true);
    if (this.disposed) return;
    if (this.run.merchant?.some((g) => !g.sold) && !this.merchantSeen) { this.merchantSeen = true; await this.showMerchant(); }
    if (this.disposed) return;
    this.busy = false;
    if (this.run.questDone) {
      const q = QUEST_INFO[this.run.questDone];
      this.run.questDone = null;
      this.persist(this.run);
      sfx.reward();
      this.fx.statPop(640, 200, '', `委托完成 · ${q.reward}`, 'pt-power');
    }
    if (this.run.legionUp) {
      const n = this.run.legionUp;
      this.run.legionUp = 0;
      this.persist(this.run);
      sfx.reward();
      this.fx.statPop(150, 120, `+${n}`, '军团', 'pt-power');
    }
    await this.playPending();
  }

  private async playPending() {
    const fx = this.run.pendingFx;
    if (!fx.length) return;
    this.run.pendingFx = [];
    this.persist(this.run);
    this.busy = true;
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
    const actLabel = h('button', { class: 'hud-act', 'aria-label': `第${'一二三'[r.act]}幕` }, `第${'一二三'[r.act]}幕`);
    actLabel.addEventListener('click', () => {
      if (this.el.classList.contains('in-battle')) return;
      sfx.click(); hideTip();
      this.startStageIntro();
      clearTimeout(this.introTimer);
      this.applyBannerPhase();
    });
    const mapBtn = h('button', { class: 'icon-btn hud-map', 'aria-label': '地图' }, icon('map'));
    mapBtn.addEventListener('click', () => { if (this.busy || this.rehearsal) return; sfx.click(); void this.showMap(false); });
    const helpBtn = h('button', { class: 'icon-btn hud-help', 'aria-label': '当前节点详情' }, icon('help'));
    helpBtn.addEventListener('click', () => {
      sfx.click();
      const node = curNode(r);
      const info = node && !isCombat(node.k) && !this.rehearsal ? NODE_INFO[node.k] : null;
      const rc = helpBtn.getBoundingClientRect(), at = toStage(rc.left + rc.width / 2, rc.bottom);
      showTip(h('div', { class: 'tip-unit', style: '--fc:#ffd166' },
        h('div', { class: 'tip-head' }, h('div', { class: 'tip-name' }, info ? info.name : `${this.where()} · 战斗`)),
        h('div', { class: 'tip-text' }, info ? info.hint : `输掉扣 ${enemyLossCost(r)} 心`)), at.x, at.y + 6, 'below');
    });
    const hero = HERO[r.hero];
    const heroBtn = h('button', { class: `hud-hero${heroReady(r) ? ' ready' : ''}`, 'aria-label': hero.name }, h('span', { class: 'hh-art', html: unitSvg(hero.art) }),
      hero.cost ? h('i', { class: 'hh-cost' }, r.heroUsed === r.turn ? icon('check') : String(hero.cost)) : null);
    heroBtn.addEventListener('click', () => { if (this.busy || this.rehearsal || !this.editable) return; sfx.click(); void this.showHero(); });
    const quest = r.quest ? h('button', { class: 'hud-quest', 'aria-label': QUEST_INFO[r.quest.id].name }, itemIcon('ev_quest', 'spell'), h('b', null, `${r.quest.n}/${QUEST_INFO[r.quest.id].goal}`)) : null;
    quest?.addEventListener('click', () => {
      const q = QUEST_INFO[r.quest!.id];
      sfx.click();
      const rc = quest.getBoundingClientRect(), at = toStage(rc.left + rc.width / 2, rc.bottom);
      showTip(h('div', { class: 'tip-unit', style: '--fc:#c58bff' }, h('div', { class: 'tip-head' }, h('div', { class: 'tip-name' }, `委托 · ${q.name}`)),
        h('div', { class: 'tip-text' }, q.text, h('br'), `奖励：${q.reward}`)), at.x, at.y + 6, 'below');
    });
    const menu = h('button', { class: 'icon-btn', 'aria-label': '菜单' }, icon('menu'));
    menu.addEventListener('click', () => { sfx.click(); this.showMenu(); });
    const book = h('button', { class: 'icon-btn hud-book', 'aria-label': '图鉴' }, icon('book'));
    book.addEventListener('click', () => { sfx.click(); this.showCodex(); });
    this.renderTavern();
    this.hud.replaceChildren(
      h('div', { class: 'hud-left' }, heroBtn, lives, r.legion ? this.legionBadge(r.legion) : null, quest),
      actLabel,
      h('div', { class: 'hud-right' }, relics, h('div', { class: 'hud-wins' }, h('span', null, '回合'), h('b', null, r.turn)), mapBtn, helpBtn, book, menu),
    );
  }

  /** 酒馆：等级（货架只出 ≤ 此阶的卡）+ 升级按钮；不升级每回合便宜 1 */
  private renderTavern() {
    const r = this.run;
    const max = r.tavern >= 6;
    const cost = tavernPrice(r);
    const can = !r.endTurnCommitted && !max && r.gold >= cost;
    const btn = h('button', { class: `btn primary tv-up${can ? ' ready' : ''}`, disabled: !can, 'aria-label': `升级酒馆 ${cost} 金` },
      h('span', null, '升级'), h('i', null, itemIcon('coin', 'coin', 'sm'), String(cost)));
    btn.addEventListener('click', () => this.doTavern());
    const lv = h('div', { class: 'tv-lv', 'aria-label': `酒馆 ${r.tavern} 级` }, itemIcon('tavern', 'spell'), h('b', null, r.tavern));
    lv.addEventListener('click', () => {
      sfx.click();
      const rc = lv.getBoundingClientRect(), at = toStage(rc.left + rc.width / 2, rc.bottom);
      showTip(h('div', { class: 'tip-unit', style: '--fc:#ffd36b' },
        h('div', { class: 'tip-head' }, h('div', { class: 'tip-name' }, `酒馆 ${r.tavern} 级`)),
        h('div', { class: 'tip-text' }, `货架只出 ≤${r.tavern} 阶的卡。`, h('br'), max ? '已满级' : `升到 ${r.tavern + 1} 级：${cost} 金，每回合不升便宜 1`)),
      at.x, at.y + 6, 'below');
    });
    this.tavernEl.classList.toggle('hidden', !!this.rehearsal);
    this.tavernEl.replaceChildren(lv, ...(max ? [] : [btn]));
  }

  private legionBadge(n: number) {
    const b = h('button', { class: `hud-legion${n >= LEGION_MAX ? ' full' : ''}`, 'aria-label': `军团 ${n}` }, icon('flag'), h('b', null, n));
    b.addEventListener('click', () => {
      sfx.click();
      const rc = b.getBoundingClientRect(), sc = this.el.getBoundingClientRect();
      const k = 1280 / sc.width;
      showTip(h('div', { class: 'tip-unit', style: '--fc:#ff9a5b' },
        h('div', { class: 'tip-head' }, h('div', { class: 'tip-name' }, `军团 ${n}/${LEGION_MAX}`), h('span', { class: 'tip-fac' }, '本局')),
        h('div', { class: 'tip-text' }, ...kwRich(`我方召唤物入场时 +${n}/+${n}。一场战斗召唤满 3 次 +1，满 6 次 +2`))),
      (rc.left + rc.width / 2 - sc.left) * k, (rc.bottom - sc.top) * k + 6, 'below');
    });
    return b;
  }

  private showCodex() {
    const ov = codexScreen(() => ov.remove(), tierOf(this.run));
    ov.classList.add('cx-ingame');
    this.el.appendChild(ov);
  }

  private showMenu() {
    if (this.rehearsal) {
      const leave = h('button', { class: 'btn primary', disabled: this.busy }, h('span', null, this.busy ? '播放中' : '返回结算'));
      const close = this.app.modal(h('div', { class: 'confirm game-menu', 'aria-label': '菜单' }, h('h3', null, '菜单'), audioSettings(), leave), 'audio-dialog', document.body);
      leave.addEventListener('click', () => { if (this.busy) return; close(); this.leaveRehearsal(); });
      return;
    }
    if (this.teaching) {
      const leave = h('button', { class: 'btn primary' }, h('span', null, '退出教学'));
      const close = this.app.modal(h('div', { class: 'confirm game-menu', 'aria-label': '菜单' }, h('h3', null, '菜单'), audioSettings(), leave), 'audio-dialog', document.body);
      leave.addEventListener('click', () => { close(); this.app.toTitle(); });
      return;
    }
    const home = h('button', { class: `btn ghost${this.busy ? ' disabled' : ''}`, disabled: this.busy }, icon('menu'), h('span', null, this.busy ? '战斗中无法返回' : '保存并返回标题'));
    const quit = h('button', { class: 'btn danger' }, icon('flag'), h('span', null, '放弃本局'));
    const close = this.app.modal(h('div', { class: 'confirm game-menu', 'aria-label': '菜单' }, h('h3', null, '菜单'), audioSettings(), h('div', { class: 'menu-btns' }, home, quit)), 'audio-dialog', document.body);
    home.addEventListener('click', () => { if (this.busy) return; close(); this.persist(this.run); this.app.toTitle(); });
    quit.addEventListener('click', () => {
      close();
      this.app.confirm('放弃本局？', '本局计为失败，无法恢复。', '放弃', () => { this.run.phase = 'lost'; this.app.endRun(this.run); });
    });
  }

  /** 关卡信息：进入新关卡时置灰屏幕弹出一次，点击或 3.8s 后飞向顶部幕次标题；点标题可再次展开 */
  private renderBanner() {
    const r = this.run;
    const node = curNode(r);
    const key = `${this.where()}|${node?.k ?? ''}|${r.enemy.boss ?? ''}|${r.enemy.encounter?.name ?? ''}|${r.enemy.form ?? ''}`;
    const fresh = key !== this.bannerKey;
    this.bannerKey = key;
    this.renderBannerContent();
    if (this.banner.querySelector('.sb-shop')) {
      clearTimeout(this.introTimer);
      this.bannerPhase = 'none';
      this.dim.classList.remove('on');
      return;
    }
    if (fresh) this.startStageIntro();
    this.applyBannerPhase();
  }

  private startStageIntro() {
    clearTimeout(this.introTimer);
    this.bannerPhase = 'modal';
    this.banner.classList.remove('sb-modal', 'sb-fly', 'sb-open');
    void this.banner.offsetWidth;
    this.dim.classList.add('on');
    this.introTimer = window.setTimeout(() => this.dismissStageIntro(), 3800);
  }

  private dismissStageIntro() {
    if (this.bannerPhase !== 'modal') return;
    clearTimeout(this.introTimer);
    this.bannerPhase = 'fly';
    this.dim.classList.remove('on');
    this.applyBannerPhase();
    this.introTimer = window.setTimeout(() => { if (this.bannerPhase === 'fly') this.bannerPhase = 'done'; }, 700);
  }

  private applyBannerPhase() {
    const p = this.bannerPhase;
    this.banner.classList.toggle('sb-modal', p === 'modal' || p === 'fly');
    this.banner.classList.toggle('sb-fly', p === 'fly' || p === 'done');
  }

  private renderBannerContent() {
    const r = this.run;
    const node = curNode(r);
    if (node && !isCombat(node.k) && !this.rehearsal) {
      const nk = NODE_INFO[node.k];
      this.banner.className = 'stage-banner k-normal k-node';
      const shop = node.k === 'shop' ? h('button', { class: 'btn primary sb-shop' }, itemIcon('n_shop', 'spell'), h('span', null, '看货')) : null;
      shop?.addEventListener('click', () => { if (this.busy || !this.editable) return; sfx.click(); void this.showMerchant(); });
      this.banner.replaceChildren(
        h('div', { class: 'sb-title' }, h('span', { class: 'sb-no' }, this.where()), itemIcon(nodeIco(node.k), 'spell', 'sb-nico'), h('b', null, nk.name)),
        h('div', { class: 'sb-hint' }, nk.hint), ...(shop ? [shop] : []), h('div', { class: 'sb-foot' }, '点击任意位置继续'));
      return;
    }
    const boss = r.enemy.boss;
    this.banner.className = `stage-banner k-${boss ? 'boss' : 'normal'}`;

    const elite = r.enemy.elite ?? [];
    const form = r.enemy.form;
    if (elite.length) this.banner.classList.add('k-elite');
    this.banner.replaceChildren(
      h('div', { class: 'sb-title' },
        boss ? h('span', { class: 'sb-kind' }, 'Boss') : elite.length ? h('span', { class: 'sb-kind elite' }, '精英') : null,
        h('span', { class: 'sb-no' }, this.rehearsal ? '调整站位' : `${this.where()} · 输掉扣 ${enemyLossCost(r)} 心`),
        h('b', null, boss ? BOSSES[boss].name : r.enemy.encounter?.name ?? (form ? FORM_INFO[form].name : '对手阵容')),
        ...elite.map((a) => h('span', { class: 'sb-ax', title: ATOM_INFO[a].name }, itemIcon(ATOM_INFO[a].icon, 'spell'), ATOM_INFO[a].name))),
      ...(boss ? [h('div', { class: 'sb-hint' }, BOSSES[boss].desc)] : r.enemy.encounter ? [h('div', { class: 'sb-hint' }, r.enemy.encounter.hint)] : form ? [h('div', { class: 'sb-hint' }, FORM_INFO[form].hint)] : []),
      h('div', { class: 'sb-foot' }, '点击任意位置继续'),
    );
  }

  private ownedStats(o: Owned) {
    const projected = this.growthPreview?.queue.find(unit => unit?.oid === o.oid);
    const [atk, hp] = shownStats(projected ?? o);
    return { atk, hp };
  }

  private ownedBaseStats(o: Owned) {
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
    for (const o of r.queue) if (o) this.shown.set(o.oid, this.ownedBaseStats(o));
    for (const f of pending) if (f.kind === 'buff' && !f.tmp) { const s = this.shown.get(f.tgt); if (s) { s.atk -= f.atk; s.hp -= f.hp; } }
    r.queue.forEach((o, i) => {
      if (!o) return;
      const v = new UnitView(o.def, 0, i, lvlOf(o.copies));
      b.add(`o${o.oid}`, v);
      this.paintOwned(v, o);
      v.el.addEventListener('pointerdown', (e) => this.dragStart(e, 'unit', i, v.el));
      v.el.setAttribute('tabindex', '0');
      v.el.setAttribute('role', 'button');
      v.el.setAttribute('aria-label', `${card(o.def).name} 位置${i + 1}`);
      v.el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.tap('unit', i); } });
      if (o.granted) v.el.appendChild(h('span', { class: 'u-granted', 'aria-label': grantedText(o.granted) },
        itemIcon(({ bone: 'x_bonepact', spark: 'x_inscribe', thorn: 'x_thorn', sprout: 'x_sprout' } as Record<string, string>)[o.granted.id] ?? 'x_ignite')));
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
    this.renderHand();
    this.dropHints();
  }

  /** 共用手牌容量，单位部署和法术施放分别走真实经营入口。 */
  private renderHand() {
    const r = this.run;
    this.handEl.classList.toggle('hidden', !!this.rehearsal);
    const from = this.handFrom;
    this.handFrom = null;
    const before = new Map<number, { x: number; y: number }>();
    for (const el of this.handEl.querySelectorAll<HTMLElement>('.hand-slot[data-oid]')) before.set(Number(el.dataset.oid), this.clientCenter(el));
    const held = r.hand.filter(Boolean).length;
    let rank = 0;
    this.handEl.replaceChildren(h('span', { class: 'hand-head' }, '手牌'),
      ...Array.from({ length: handCap(r) }, (_, k) => {
        const cell = HAND_BASE + k;
        const o = r.hand[k];
        // 扇形只按实际手牌数排布，空格依次排在扇形右侧作为不可见的落点
        const fan = `--i:${o ? rank++ : held + k - rank};--n:${Math.max(held, 1)}`;
        if (!o) return h('div', { class: 'hand-slot empty', 'data-cell': cell, style: fan });
        if (isHeldSpell(o)) {
          const f = FOOD[o.def];
          const el = h('button', { class: 'hand-slot hand-spell', 'data-cell': cell, 'data-oid': o.oid, 'aria-label': `手牌 ${f.name}`, style: fan },
            foodCard(o.def, o.val),
            o.expiresTurn ? h('span', { class: 'hs-expiry' }, '本轮') : null);
          el.addEventListener('pointerdown', (e) => this.dragStart(e, 'spell', cell, el));
          el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.tap('spell', cell); } });
          return el;
        }
        const gold = o.copies >= MAX_COPIES;
        const [atk, hp] = equipStats(o.ench, ownedAtk(o), ownedHp(o));
        const el = h('div', { class: `hand-slot${gold ? ' gold' : ''}`, 'data-cell': cell, 'data-oid': o.oid, role: 'button', tabindex: 0, 'aria-label': `手牌 ${card(o.def).name}`,         style: `--fc:${lineColor(o.def)};${fan}` },
          draftCard(o.def, { level: gold ? 2 : 1, displayStats: { atk, hp }, stack: gold ? undefined : `${o.copies}/${MAX_COPIES}` }));
        el.addEventListener('pointerdown', (e) => this.dragStart(e, 'unit', cell, el));
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.tap('unit', cell); } });
        return el;
      }));
    this.renderRewards();
    this.flyHand(before, from);
  }

  private clientCenter(el: Element) {
    const rc = el.getBoundingClientRect();
    return { x: rc.left + rc.width / 2, y: rc.top + rc.height / 2 };
  }

  /** 手牌入手与重排：从旧的可见位置（或拖动/点击的真实来源）经 WAAPI translate 滑到新格，不改 transform（扇形保留）。 */
  private flyHand(before: Map<number, { x: number; y: number }>, from: { x: number; y: number; cell?: number } | null) {
    if (reduced() || this.rehearsal) return;
    for (const el of this.handEl.querySelectorAll<HTMLElement>('.hand-slot[data-oid]')) {
      const oid = Number(el.dataset.oid), cell = Number(el.dataset.cell);
      const was = before.get(oid);
      const arriving = !!from && (from.cell != null ? from.cell === cell : !was);
      const src = arriving ? from : was;
      if (!src) continue;
      // 手牌位于被 stage 缩放的舞台内，translate 需用舞台坐标，客户端像素差需先换算
      const c = this.clientCenter(el);
      const now = toStage(c.x, c.y);
      const at = toStage(src.x, src.y);
      const dx = at.x - now.x, dy = at.y - now.y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      el.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0px 0px' }], { duration: 260, easing: 'cubic-bezier(.2,.7,.3,1)' });
    }
  }

  /** 点击商店卡购买时的入手起点（商店卡中心） */
  private shopOrigin(idx: number) {
    const el = this.tray.querySelector<HTMLElement>(`[data-idx="${idx}"]`);
    return el ? this.clientCenter(el) : null;
  }

  private handSlotEl(cell: number) {
    return this.handEl.querySelector<HTMLElement>(`.hand-slot[data-cell="${cell}"]`);
  }

  private renderRewards() {
    this.el.querySelector('.reward-open')?.remove();
    const r = this.run;
    const reward = r.rewards?.[0];
    if (!reward || this.rehearsal) return;
    this.el.querySelector('.prep-preview-btn')?.remove();
    const open = h('button', { class: 'btn primary reward-open', 'aria-label': `待领取奖励 ${r.rewards!.length}` }, `待领 ${r.rewards!.length}`);
    open.addEventListener('click', () => { if (this.editable) this.showReward(); });
    this.el.querySelector('.prep-actions')?.appendChild(open);
  }

  private showReward() {
    const r = this.run;
    const reward = r.rewards?.[0];
    if (!reward) return;
    const item = reward.card;
    const name = isHeldSpell(item) ? FOOD[item.def].name : card(item.def).name;
    const take = h('button', { class: 'btn primary', disabled: !r.hand.slice(0, handCap(r)).some(x => !x) }, '领取');
    take.addEventListener('click', () => {
      if (!this.editable || !claimReward(r, reward.id)) return;
      close(); this.persist(r); this.afterChange(); sfx.reward();
    });
    const drop = h('button', { class: 'btn', 'aria-label': `放弃奖励 ${name}` }, '放弃');
    drop.addEventListener('click', () => {
      if (!this.editable) return;
      close();
      this.app.confirm(`放弃${name}？`, '这份奖励将被移除。', '放弃', () => {
        if (discardReward(r, reward.id)) { this.persist(r); this.afterChange(); }
      });
    });
    const back = h('button', { class: 'btn' }, '整理手牌');
    const detail = isHeldSpell(item) ? foodTip(item.def, item.val) : unitTip(item.def, lvlOf(item.copies));
    detail.querySelector('.tip-head')?.remove();
    const close = this.app.modal(h('div', { class: 'spell-dialog' }, h('h3', null, `${name} · 待领 ${r.rewards!.length}`),
      detail,
      take.disabled ? h('p', null, r.endTurnCommitted ? '本轮经营已结束，可放弃已有手牌腾出位置。' : '手牌已满，施放法术或整理单位后领取。') : null,
      h('div', { class: 'dialog-actions' }, take, back, drop)), 'spell-picker');
    back.addEventListener('click', close);
  }

  private storeToHand(idx: number, cell?: number): boolean {
    const origin = this.flyOrigin;
    this.flyOrigin = null;
    if (!this.editable || this.rehearsal) return false;
    const item = this.run.shop[idx];
    if (!item) return false;
    const target = cell ?? HAND_BASE + this.run.hand.slice(0, handCap(this.run)).findIndex(x => !x);
    if (target < HAND_BASE) { this.notice('手牌已满'); return false; }
    if (!this.allowed({ kind: item.kind === 'unit' ? 'buy' : 'food', slot: target, def: item.def })) return false;
    const result = buyToHand(this.run, item.sid, target);
    if (!result.ok) { this.notice(result.why === 'gold' ? '金币不够' : '手牌已满'); return false; }
    hideTip(); this.persist(this.run);
    this.handFrom = origin ? { ...origin, cell: target } : null;
    this.afterChange(result.fx); sfx.place();
    this.pulseHand(target);
    void this.runFx(result.fx).then(() => this.drainDiscover());
    return true;
  }

  private chooseSpellTarget(kind: 'card' | 'spell', idx: number, sourceSlot?: number) {
    if (!this.editable) return;
    const r = this.run;
    const item = kind === 'card' ? r.shop[idx] : handAt(r, idx);
    if (!item) return;
    const f = FOOD[item.def];
    const transferSource = f.spell === 'transfer' && sourceSlot === undefined;
    if (!foodNeedsTarget(item.def)) {
      this.applySpell(kind, idx, null);
      return;
    }
    hideTip();
    const targets = Array.from({ length: HAND_BASE + handCap(r) }, (_, cell) => ({ cell, unit: cellAt(r, cell) }))
      .filter(({ cell, unit }) => unit && (transferSource ? !!unit.granted
        : cell !== sourceSlot && (!f.spell || spellTargetOk(r, item.def, unit))));
    const buttons = targets.map(({ cell, unit }) => {
      const button = h('button', { class: 'spell-target', 'aria-label': `${card(unit!.def).name} ${isHand(cell) ? '手牌' : `位置${cell + 1}`}` },
        h('span', { class: 'target-art', html: unitSvg(unit!.def) }), h('b', null, card(unit!.def).name),
        h('small', null, isHand(cell) ? '手牌' : `位置 ${cell + 1}`));
      button.addEventListener('click', () => {
        close();
        if (transferSource) this.chooseSpellTarget(kind, idx, cell);
        else this.applySpell(kind, idx, cell, false, sourceSlot);
      });
      return button;
    });
    const cancel = h('button', { class: 'btn' }, '取消');
    const close = this.app.modal(h('div', { class: 'spell-dialog' }, h('h3', null, `${f.name} · ${transferSource ? '选择转出能力的单位' : '选择目标'}`),
      buttons.length ? h('div', { class: 'spell-targets' }, ...buttons) : h('p', null, '当前没有合法目标'),
      h('div', { class: 'dialog-actions' }, cancel)), 'spell-picker');
    cancel.addEventListener('click', close);
  }

  private choosePlayTarget(exclude: number[], apply: (oid: number) => void) {
    const targets = this.run.queue.filter((unit): unit is Owned => !!unit && !exclude.includes(unit.oid));
    if (!targets.length) return false;
    const buttons = targets.map(unit => {
      const button = h('button', { class: 'spell-target' }, h('span', { class: 'target-art', html: unitSvg(unit.def) }), h('b', null, card(unit.def).name));
      button.addEventListener('click', () => { close(); apply(unit.oid); });
      return button;
    });
    const cancel = h('button', { class: 'btn' }, '取消');
    const close = this.app.modal(h('div', { class: 'spell-dialog' }, h('h3', null, '选择入场能力目标'),
      h('div', { class: 'spell-targets' }, ...buttons), h('div', { class: 'dialog-actions' }, cancel)), 'spell-picker');
    cancel.addEventListener('click', close);
    return true;
  }

  private applySpell(kind: 'card' | 'spell', idx: number, target: number | null, replace = false, source?: number): boolean {
    if (!this.editable || this.rehearsal) return false;
    const r = this.run;
    const item = kind === 'card' ? r.shop[idx] : handAt(r, idx);
    if (!item) return false;
    const f = FOOD[item.def];
    if (f.spell === 'transfer' && source === undefined) { this.chooseSpellTarget(kind, idx); return false; }
    const unit = target === null ? null : cellAt(r, target);
    const willPlay = unit && (f.spell === 'echo' || f.spell === 'copy' && unit.copies >= MAX_COPIES - 1);
    const playConflict = willPlay ? inspectPlayConflict(r, unit.def, r.queue.indexOf(unit), undefined, f.spell === 'copy' ? MAX_COPIES : unit.copies) : null;
    if (!replace && playConflict) {
      this.app.confirm('替换入场目标的附加能力？', `${card(playConflict.target.def).name}将失去${grantedText(playConflict.target.granted!)}，获得${grantedText(playConflict.incoming)}。`,
        '替换并施放', () => this.applySpell(kind, idx, target, true, source));
      return false;
    }
    if (!replace && unit?.granted && ['bonepact', 'ignite', 'inscribe', 'thorn', 'sprout', 'transfer'].includes(f.spell ?? '')) {
      this.app.confirm('替换附加能力？', `将移除${grantedText(unit.granted)}，并施放${f.name}。`, '替换并施放', () => this.applySpell(kind, idx, target, true, source));
      return false;
    }
    const result = kind === 'card' ? useFood(r, (item as ShopItem).sid, target, replace, source)
      : castHandSpell(r, idx, target, replace, source);
    if (!result.ok) { this.notice(result.why === 'gold' ? '金币不够' : '目标不合法或能力没有提升'); return false; }
    hideTip(); this.persist(r); this.afterChange(result.fx); sfx.buff();
    const position = target === null ? { x: 640, y: 240 } : this.cellPos(target);
    spellFeedback(this.el, position.x, position.y);
    this.discFrom = position;
    void this.runFx(result.fx).then(() => this.drainDiscover());
    return true;
  }

  /** 格子中心（舞台坐标）：队列用棋盘位置，手牌用 DOM 位置 */
  private cellPos(cell: number) {
    if (!isHand(cell)) return bodyPos(0, cell);
    const el = this.handSlotEl(cell);
    if (!el) return { x: 200, y: 140 };
    const rc = el.getBoundingClientRect();
    return toStage(rc.left + rc.width / 2, rc.top + rc.height / 2);
  }

  private pulseHand(cell: number) {
    const el = this.handSlotEl(cell);
    if (el && !reduced()) {
      el.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 360, easing: 'cubic-bezier(.2,1.4,.4,1)' });
      const face = el.firstElementChild as HTMLElement | null;
      if (face) {
        const base = getComputedStyle(face).filter;
        const keep = base && base !== 'none' ? base : '';
        face.animate([{ filter: `brightness(1.6) ${keep}` }, { filter: keep || 'brightness(1)' }], { duration: 360, easing: 'ease-out' });
      }
    }
    const p = this.cellPos(cell);
    spellFeedback(this.el, p.x, p.y);
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
      r.queue.map((o) => (o ? { def: o.def, lvl: lvlOf(o.copies), hp: shownStats(o)[1] } : null)),
      r.enemy.units.slice(0, QUEUE_MAX).map((u) => ({ def: u.def, lvl: u.lvl, hp: u.hp })),
    ]).filter((l) => l.owner.side === f.side && l.owner.slot === f.slot);
    const boardTop = toStage(0, b.el.getBoundingClientRect().top).y;
    const minY = toStage(0, this.hud.getBoundingClientRect().bottom).y + 16 - boardTop;
    const at = (p: { side: Side; slot: number }, dy: number) => ({ x: Math.max(30, Math.min(1250, slotX(p.side, p.slot))), y: headPos(p.side, p.slot).y + dy });
    const linked = new Set<string>();
    const lanes: { lo: number; hi: number; lane: number }[] = [];
    // 同一句时机只标一次（标在跨度最短的那条上），避免一排「阵亡时」
    const said = new Set<string>();
    links
      .map((l) => {
        const p0 = at(l.from, 44);
        const p1 = at(l.to, 4);
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
          minY,
          apexMin: minY + 16,
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
    const projected = this.growthPreview?.queue.find(unit => unit?.oid === o.oid);
    if (projected) o = projected;
    const s = projected ? this.ownedBaseStats(projected) : this.shown.get(o.oid) ?? this.ownedBaseStats(o);
    const [atk, hp] = equipStats(o.ench, s.atk + (o.tmpAtk ?? 0), s.hp + (o.tmpHp ?? 0));
    const kws = [...card(o.def).kws, ...(o.lamp ? ['reborn'] : []), ...(o.tfx?.includes('splash') ? ['splash'] : [])];
    v.setStats({ atk, hp, maxHp: hp, block: 0, chill: 0, burn: 0, kw: keywordsOf(kws) }, { pop });
    v.setExp(o.copies);
    v.setEquips([...(o.ench ? [o.ench] : []), ...(o.tmpAtk || o.tmpHp ? ['f_drum'] : []), ...(o.lamp ? ['f_lamp'] : []), ...(o.tfx ?? []).map((x) => fxFood(x).id)]);
    v.setFoodHistory(card(o.def).inherit ? (o.foodHistory?.length ?? 0) : null);
    if (o.merc) v.setTag(`雇佣 剩${o.merc}场`, 'merc');
    else if (card(o.def).ab === 'egg') v.setTag(`幼龙 ${1 + (o.bank ?? 0)}/${1 + (o.bank ?? 0)}`, 'bank'); else v.setTag(null);
    const scar = o.scar ?? 0, cap = scarCap(o.def);
    v.setMark('scar', hasScar(o.def) && scar > 0 ? 'hit' : null, `${scar}/${cap}`, scar >= cap, `历战 ${scar}/${cap}`);
    const g = o.guard ?? 0;
    v.setMark('guard', card(o.def).disc === 'guard' ? 'eye' : null, '●'.repeat(g) + '○'.repeat(GUARD_N - g), false, `驻守 ${g}/${GUARD_N}`);
  }

  private viewOf(oid: number) {
    return this.board.views.get(`o${oid}`);
  }

  /** 只投影回合结束成长；不运行战斗、不写入正式状态或随机种子。 */
  private toggleGrowthPreview() {
    if (this.growthPreview) this.growthPreview = null;
    else {
      this.growthPreview = structuredClone(this.run);
      endTurn(this.growthPreview);
    }
    for (const o of this.run.queue) if (o) {
      const view = this.viewOf(o.oid);
      if (view) this.paintOwned(view, o);
    }
    const preview = this.el.querySelector<HTMLButtonElement>('.prep-preview-btn');
    if (preview) {
      const label = this.growthPreview ? '还原数值' : '成长预览';
      preview.setAttribute('aria-label', label);
      preview.setAttribute('aria-pressed', String(!!this.growthPreview));
      preview.querySelector('.prep-preview-label')!.textContent = label;
    }
  }

  private renderTray() {
    const r = this.run;
    this.tray.classList.remove('hidden');
    const freeRr = r.freeRr ?? 0;
    const rerollBtn = h('button', { class: `btn primary reroll${freeRr ? ' free-rr' : ''}`, disabled: r.endTurnCommitted || !freeRr && r.gold < REROLL }, h('span', { class: 'rr-main' }, icon('refresh'), h('span', null, '刷新')), h('span', { class: 'rr-price' }, ...(freeRr ? [`免费 ×${freeRr}`] : [itemIcon('coin', 'coin'), `${REROLL}`])));
    rerollBtn.addEventListener('click', () => void this.doReroll());
    const adUsed = !!this.rehearsal || r.adRr === r.turn || !!r.endTurnCommitted;
    const adBtn = h('button', { class: 'btn primary reroll rewarded', disabled: adUsed, 'aria-label': adUsed ? '免费刷新已用完' : '免费刷新（观看视频）' }, h('span', { class: 'rr-main' }, icon('video'), h('span', null, adUsed ? '已用完' : '免费刷新')));
    adBtn.addEventListener('click', () => void this.doAdReroll());
    const left = h('div', { class: 'tray-left' }, this.tavernEl,
      h('div', { class: 'tl-gold', role: 'status', 'aria-label': `金币 ${r.gold}` }, itemIcon('coin', 'coin'), h('b', null, r.gold)), rerollBtn, this.rehearsal ? null : adBtn);
    const units = r.shop.map((it, i) => ({ it, i })).filter((x) => x.it.kind === 'unit');
    const foods = r.shop.map((it, i) => ({ it, i })).filter((x) => x.it.kind === 'food');
    const cards = h('div', { class: 'cards', 'data-count': units.length + foods.length });
    for (const { it, i } of units) cards.appendChild(this.shopCard(it, i));
    if (foods.length) {
      cards.appendChild(h('i', { class: 'shelf-div', 'aria-hidden': 'true' }));
      for (const { it, i } of foods) cards.appendChild(this.foodTile(it, i));
    }
    const size = r.queue.filter(Boolean).length;
    const node = curNode(r);
    const walk = !this.rehearsal && !!node && !isCombat(node.k);
    const pending = !!r.rewards?.length || !!r.discover?.length;
    const can = !pending && (walk || size > 0);
    const fightBtn = h('button', { class: `btn primary fight${can ? '' : ' disabled'}`, disabled: !can }, h('span', null, pending ? '先处理奖励' : this.rehearsal ? '试 打' : walk ? '前 往' : '开 战'), icon('play'));
    fightBtn.addEventListener('click', () => { if (!can || !this.editable) return; if (walk) void this.goNode(); else void this.startBattle(); });
    this.el.querySelector('.prep-actions')?.remove();
    const preview = h('button', { class: 'btn primary prep-preview-btn', disabled: !size, 'aria-label': this.growthPreview ? '还原数值' : '成长预览', 'aria-pressed': String(!!this.growthPreview) }, icon('book'), h('span', { class: 'prep-preview-label' }, this.growthPreview ? '还原数值' : '成长预览'));
    preview.addEventListener('click', () => {
      if (!this.editable) return;
      hideTip(); sfx.click();
      this.toggleGrowthPreview();
    });
    const actions = h('div', { class: 'prep-actions' }, this.rehearsal ? null : preview);
    if (this.rehearsal) {
      const back = h('button', { class: 'btn primary rehearsal-back' }, h('span', null, '返回结算'));
      back.addEventListener('click', () => { if (!this.busy) this.leaveRehearsal(); });
      actions.prepend(back);
      const retry = this.retryButton();
      if (retry) actions.appendChild(retry);
    }
    this.el.appendChild(actions);
    this.tray.replaceChildren(...(this.rehearsal ? [] : [left, cards]), h('div', { class: 'tray-right' }, h('div', { class: 'fight-controls' }, fightBtn)));
    this.renderBag();
    this.lockFx = null;
    this.syncBusy();
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
    this.bagEl.classList.toggle('hidden', !!this.rehearsal || (!r.bag.length && !r.queue.some((o) => o?.ench)));
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
    const c = h('div', { class: `food-tile${f.spell ? ' spell' : ''}${it.locked ? ' locked' : ''}${this.run.gold < foodPrice(it) ? ' unaffordable' : ''}`, role: 'button', tabindex: 0, 'aria-label': `${f.spell ? '法术' : '补给'} ${f.name}${it.locked ? ' 已锁定' : ''}`, 'data-idx': i },
      h('div', { class: 'ft-ico' }, itemIcon(it.def, f.spell ? 'spell' : 'pack'),
        f.tmp ? h('span', { class: 'ft-tmp' }, icon('hourglass')) : null),
      h('b', { class: 'ft-name' }, f.name),
      (() => { const [a, hp] = foodStats(it); return a || hp ? h('span', { class: 'ft-stat' }, h('em', null, `+${a}`), '/', h('i', null, `+${hp}`)) : null; })(),
      it.def === 'f_milk' ? h('span', { class: 'ft-turn' }, '免费') : h('span', { class: 'ft-price' }, itemIcon('coin', 'coin'), String(foodPrice(it))));
    const chains = this.chainsFor(it, c);
    if (chains) c.append(chains);
    c.addEventListener('pointerdown', (e) => this.dragStart(e, 'card', i, c));
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.tap('card', i); } });
    return c;
  }

  private shopCard(it: ShopItem, i: number) {
    const r = this.run;
    let c: HTMLElement;
    if (it.kind === 'food') c = foodCard(it.def, it.val);
    else c = this.unitCard(it.def);
    // 顶部只放一条标签：奖励卡把「叠加 / 升星」并进去；锁定改成右上角小角标
    const price = itemPrice(it);
    if (it.free) {
      const badge = c.querySelector(':scope > .card-badge');
      const extra = badge?.textContent?.trim();
      const tag = it.disc ? '发现' : '金色奖励';
      badge?.remove();
      c.classList.add('bonus-card');
      if (it.disc) c.classList.add('disc-card');
      c.append(h('span', { class: 'bonus-tag' }, icon(it.disc ? 'eye' : 'star'), extra ? `${tag} · ${extra}` : tag,
        price ? h('i', { class: 'bonus-price' }, itemIcon('coin', 'coin', 'sm'), String(price)) : h('i', { class: 'bonus-price gift' }, '免费')));
    }
    if (it.locked) c.classList.add('locked');
    const ch = this.chainsFor(it, c);
    if (ch) c.append(ch);
    if (r.gold < (it.kind === 'unit' ? price : PRICE)) c.classList.add('unaffordable');
    c.dataset.idx = String(i);
    c.setAttribute('role', 'button');
    c.addEventListener('pointerdown', (e) => this.dragStart(e, 'card', i, c));
    return c;
  }

  /** 货架 / 发现用的单位卡：带「叠加 n/3 · 升星」提示 */
  private unitCard(def: string) {
    const r = this.run;
    const same = [...r.queue, ...r.hand].filter((o): o is Owned => !!o && o.def === def);
    const target = same.filter((o) => o.copies < MAX_COPIES).sort((a, b) => b.copies - a.copies)[0];
    const next = target ? target.copies + 1 : 0;
    const goal = MAX_COPIES;
    return draftCard(def, {
      mergeTo: target && next === goal ? 2 : undefined,
      stack: target && next !== goal ? `叠加 ${next}/${goal}` : undefined,
      maxed: !target && same.length > 0,
      plus: r.canned,
    });
  }

  private cardsIn() {
    if (reduced()) return;
    this.tray.querySelectorAll('.card, .food-tile').forEach((c, i) =>
      c.animate([{ transform: 'translateY(60px) rotate(4deg)', opacity: 0 }, { transform: 'translateY(0) rotate(0)', opacity: 1 }],
        { duration: 380, delay: i * 70, easing: 'cubic-bezier(.2,.9,.3,1.15)', fill: 'backwards' }));
  }

  // ───────────── 拖拽 ─────────────

  private dragStart(e: PointerEvent, kind: DragKind, idx: number, src: HTMLElement) {
    if ((this.rehearsal && kind !== 'unit') || !this.editable || e.button > 0 || this.drag || !e.isPrimary) return;
    e.preventDefault();
    hideTip();
    this.flyOrigin = this.handFrom = null;
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
    return d.kind === 'card' ? this.run.shop[d.idx]?.def : d.kind === 'bag' ? this.run.bag[d.idx] : d.kind === 'spell' ? handAt(this.run, d.idx)?.def : cellAt(this.run, d.idx)?.def;
  }

  private dragMove(e: PointerEvent) {
    const d = this.drag;
    if (!d) return;
    if (!d.ghost) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return;
      const def = this.dragDef(d);
      if (!def) { this.drag = null; this.releaseDrag?.(); return; }
      const food = d.kind === 'spell' || d.kind === 'card' && this.run.shop[d.idx].kind === 'food';
      d.ghost = d.kind === 'bag' ? h('div', { class: 'drag-ghost food' }, equipIcon(def)) : food ? h('div', { class: 'drag-ghost food' }, itemIcon(def, FOOD[def]?.spell ? 'spell' : 'pack')) : h('div', { class: 'drag-ghost', html: unitSvg(def) });
      this.el.appendChild(d.ghost);
      d.src.classList.add('lifted');
      if (d.kind === 'unit' && !this.rehearsal) this.openSellZone(d.idx);
      if (d.kind === 'bag') this.openSellZone(-1);
      if (d.kind === 'card') this.openBuyZone(d.idx);
      sfx.pick();
    }
    const p = toStage(e.clientX, e.clientY);
    this.sellZone?.el.classList.toggle('hot', this.overSell(p));
    if (this.buyZone) {
      const hot = this.overBuy(p);
      this.buyZone.classList.toggle('hot', hot && this.buyZone.dataset.blocked === 'false');
      const heading = this.buyZone.querySelector('b')!;
      const text = this.buyZone.dataset.blocked === 'true' ? this.buyZone.dataset.reason! : hot ? '松开购买到手牌' : '拖到这里购买';
      if (heading.textContent !== text) heading.textContent = text;
    }
    d.ghost.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-60%) rotate(${Math.max(-12, Math.min(12, (e.movementX || 0) * 1.5))}deg)`;
    this.dropHints(this.slotAt(p.x, p.y));
  }

  private dragEnd(e: PointerEvent) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    const p = toStage(e.clientX, e.clientY);
    const sellDrop = d.kind !== 'card' && !!d.ghost && this.overSell(p);
    const buyDrop = d.kind === 'card' && !!d.ghost && this.overBuy(p);
    d.src.classList.remove('lifted');
    this.sellZone?.el.remove();
    this.sellZone = null;
    this.buyZone?.remove();
    this.buyZone = null;
    this.dropHints();
    if (e.type === 'pointercancel') { d.ghost?.remove(); return; }
    if (!d.ghost) { this.tap(d.kind, d.idx); return; }
    const ghost = d.ghost;
    const origin = this.clientCenter(ghost);
    if (buyDrop) {
      this.flyOrigin = origin;
      if (this.storeToHand(d.idx)) ghost.remove();
      else this.returnGhost(ghost, d.src);
      return;
    }
    if (sellDrop) { ghost.remove(); if (d.kind === 'bag') this.doDiscard(d.idx); else void this.doSell(d.idx); return; }
    const slot = this.slotAt(p.x, p.y);
    this.handFrom = { ...origin, cell: slot ?? undefined };
    let ok = false;
    if (d.kind === 'card') {
      const it = this.run.shop[d.idx];
      if (it?.kind === 'food') {
        if (slot != null && isHand(slot) && !handAt(this.run, slot)) { this.flyOrigin = origin; ok = this.storeToHand(d.idx, slot); }
        else if (slot != null) ok = this.doFood(d.idx, slot);
        else if (!foodNeedsTarget(it.def) && p.y < 520) ok = this.doFood(d.idx, null);
      } else if (slot != null) ok = this.doBuy(d.idx, slot);
    } else if (d.kind === 'spell') {
      const held = handAt(this.run, d.idx);
      if (held && (slot != null || !foodNeedsTarget(held.def) && p.y < 520)) ok = this.applySpell('spell', d.idx, slot);
    } else if (d.kind === 'bag') { if (slot != null) ok = this.doEquip(d.idx, slot); }
    else if (slot != null) ok = this.doMove(d.idx, slot);
    if (ok) ghost.remove();
    else { this.handFrom = null; this.returnGhost(ghost, d.src); }
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
    if (!this.rehearsal) for (let k = 0; k < HAND_MAX; k++) {
      const el = this.handSlotEl(HAND_BASE + k);
      if (!el) continue;
      const rc = el.getBoundingClientRect();
      const a = toStage(rc.left, rc.top), z = toStage(rc.right, rc.bottom);
      if (x >= a.x - 8 && x <= z.x + 8 && y >= a.y - 8 && y <= z.y + 8) return HAND_BASE + k;
    }
    // The board is translated by the layout. Convert the pointer into the
    // board's actual coordinates so the pedestal and the hit area stay aligned.
    const rect = this.board.el.getBoundingClientRect();
    const origin = toStage(rect.left, rect.top);
    const localX = x - origin.x, localY = y - origin.y;
    if (localY < UNIT_Y - 110 || localY > UNIT_Y + 108) return null;
    for (let s = 0; s < QUEUE_MAX; s++) if (Math.abs(localX - slotX(0, s)) < SLOT_SPACING / 2) return s;
    return null;
  }

  private dropKind(slot: number): string {
    const d = this.drag;
    if (!d?.ghost) return '';
    const r = this.run;
    const at = cellAt(r, slot);
    const hand = isHand(slot);
    if (isHeldSpell(handAt(r, slot))) return 'invalid';
    if (d.kind === 'card') {
      const it = r.shop[d.idx];
      if (!it) return '';
      if (it.kind === 'food') {
        if (hand && !handAt(r, slot)) return 'place';
        if (FOOD[it.def].spell) return FOOD[it.def].target ? (spellTargetOk(r, it.def, at) ? 'merge' : 'invalid') : 'place';
        return foodNeedsTarget(it.def) ? (at ? 'merge' : 'invalid') : 'place';
      }
      if (!at) return 'place';
      return at.def === it.def && at.copies < MAX_COPIES ? 'merge' : 'invalid';
    }
    if (d.kind === 'spell') {
      const held = handAt(r, d.idx);
      if (!held || slot === d.idx) return '';
      return at && (!FOOD[held.def].spell || spellTargetOk(r, held.def, at)) ? 'merge' : 'invalid';
    }
    if (d.kind === 'bag') return at && !hand ? 'merge' : 'invalid';
    if (slot === d.idx) return '';
    if (this.rehearsal && hand) return 'invalid';
    const from = cellAt(r, d.idx);
    if (!at) return 'move';
    return !this.rehearsal && from && at.def === from.def && at.copies < MAX_COPIES && from.copies < MAX_COPIES ? 'merge' : 'swap';
  }

  private dropHints(hover: number | null = null) {
    const active = !!this.drag?.ghost;
    for (let s = 0; s < QUEUE_MAX; s++) {
      const el = this.board.slotEl(0, s);
      const k = active ? this.dropKind(s) : '';
      el.dataset.drop = k;
      el.classList.toggle('drop-hover', active && hover === s && !!k && k !== 'invalid');
    }
    for (let k = 0; k < handCap(this.run); k++) {
      const el = this.handSlotEl(HAND_BASE + k);
      if (!el) continue;
      const kind = active ? this.dropKind(HAND_BASE + k) : '';
      el.dataset.drop = kind;
      el.classList.toggle('drop-hover', active && hover === HAND_BASE + k && !!kind && kind !== 'invalid');
    }
    this.board.el.classList.toggle('dropping', active);
    this.supplyPreview(hover);
  }

  private supplyPreview(hover: number | null) {
    this.board.views.forEach((v) => v.el.classList.remove('supply-preview'));
    const d = this.drag;
    const r = this.run;
    if (hover === null || !d?.ghost || !Number.isInteger(hover) || hover < 0 || hover >= r.queue.length || isHand(hover)) return;
    const target = r.queue[hover];
    if (!target || this.dropKind(hover) !== 'merge') return;
    let def: string | undefined;
    if (d.kind === 'card') {
      const it = r.shop[d.idx];
      if (it?.kind !== 'food' || r.gold < foodPrice(it)) return;
      def = it.def;
    } else if (d.kind === 'spell') {
      def = handAt(r, d.idx)?.def;
    }
    const f = def ? FOOD[def] : undefined;
    if (!f || f.spell || f.n !== undefined || f.id === 'f_can') return;
    const affected = new Set<Owned>([target]);
    const add = (i: number) => {
      const o = r.queue[i];
      if (o) affected.add(o);
    };
    if (f.behind) add(hover + 1);
    if (f.around) {
      add(hover - 1);
      add(hover + 1);
    }
    const share = !f.behind && !f.around && r.relics.includes('r_share') && !(r.tc.shareUsed ?? r.tc.foods > 0) && ['f_bread', 'f_whet', 'f_roast', 'f_milk', 'f_drum'].includes(f.id);
    if (share) {
      add(hover - 1);
      add(hover + 1);
    }
    affected.forEach((o) => this.viewOf(o.oid)?.el.classList.add('supply-preview'));
  }

  /** slot = -1：丢弃背包里的装备 */
  private openSellZone(slot: number) {
    const o = slot >= 0 ? cellAt(this.run, slot) : null;
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

  /** The entire visible hand area is the purchase destination while dragging a shop card. */
  private openBuyZone(idx: number) {
    const item = this.run.shop[idx];
    if (!item) return;
    const box = this.handEl.getBoundingClientRect();
    const a = toStage(box.left, box.top), z = toStage(box.right, box.bottom);
    const free = this.run.hand.slice(0, handCap(this.run)).filter(x => !x).length;
    const price = item.kind === 'unit' ? itemPrice(item) : foodPrice(item);
    const reason = !free ? '手牌已满' : this.run.gold < price ? '金币不足' : '';
    const el = h('div', {
      class: `buy-zone${reason ? ' unavailable' : ''}`, role: 'region', 'aria-label': '购买到手牌',
      'aria-disabled': String(!!reason), 'data-blocked': String(!!reason), 'data-reason': reason,
      style: `left:${a.x}px;top:${a.y}px;width:${z.x - a.x}px;height:${z.y - a.y}px`,
    }, h('b', null, reason || '拖到这里购买'));
    this.el.appendChild(el);
    this.buyZone = el;
  }

  private overBuy(p: { x: number; y: number }) {
    if (!this.buyZone) return false;
    const box = this.buyZone.getBoundingClientRect();
    const a = toStage(box.left, box.top), z = toStage(box.right, box.bottom);
    return p.x >= a.x && p.x <= z.x && p.y >= a.y && p.y <= z.y;
  }

  // ───────────── 点击：详情 + 按钮 ─────────────

  private tap(kind: DragKind, idx: number) {
    if (!this.editable || (this.rehearsal && kind !== 'unit')) return;
    sfx.click();
    const r = this.run;
    if (kind === 'spell') {
      const item = handAt(r, idx);
      if (!isHeldSpell(item)) return;
      const tip = foodTip(item.def, item.val);
      tip.classList.add('hand-spell-tip');
      const cast = h('button', { class: 'btn primary shelf-recruit', disabled: r.endTurnCommitted }, '施放');
      cast.addEventListener('click', () => this.chooseSpellTarget('spell', idx));
      const drop = h('button', { class: 'btn shelf-lock' }, '放弃');
      drop.addEventListener('click', () => {
        if (!this.editable || !discardHandSpell(r, idx)) return;
        hideTip(); this.persist(r); this.afterChange();
      });
      tip.appendChild(h('div', { class: 'shelf-acts' }, cast, drop));
      this.dockTip(tip);
      return;
    }
    if (kind === 'unit') {
      const o = cellAt(r, idx);
      if (!o) return;
      if (r.endTurnCommitted && isHand(idx)) {
        const discard = h('button', { class: 'btn' }, '放弃单位');
        discard.addEventListener('click', () => this.app.confirm(`放弃${card(o.def).name}？`, '本轮经营已结束，放弃该手牌单位腾出位置，获得 0 金。', '放弃', () => {
          if (discardHandUnit(r, idx)) { hideTip(); this.persist(r); this.afterChange(); }
        }));
        this.dockTip(h('div', { class: 'tip-unit' }, h('div', { class: 'tip-head' }, card(o.def).name), h('div', { class: 'shelf-acts' }, discard)));
        return;
      }
      const hand = isHand(idx);
      const s = this.ownedStats(o);
      const tip = unitTip(o.def, lvlOf(o.copies), { ...s, ench: o.ench, tmpAtk: o.tmpAtk, tmpHp: o.tmpHp, lamp: o.lamp, tfx: o.tfx, copies: o.copies, kws: card(o.def).kws, foodHistory: o.foodHistory, prepUses: prepFoodUses(r, o), granted: o.granted }, true);
      if (hasScar(o.def)) tip.appendChild(h('div', { class: 'tip-text tip-scar' }, icon('hit'), `历战 ${o.scar ?? 0}/${scarCap(o.def)}：战斗中每受伤 2 次，战后永久 +1/+1（每场最多 +${scarCap(o.def) / 4}）`));
      if (card(o.def).disc === 'guard') tip.appendChild(h('div', { class: 'tip-text tip-scar' }, icon('eye'), `驻守 ${o.guard ?? 0}/${GUARD_N}`));
      const inheritance = inheritancePreview(r, idx);
      if (inheritance && !this.rehearsal) tip.appendChild(inheritance);
      // Only the detail body scrolls; its actions keep their full touch area.
      tip.classList.add('owned-tip');
      const detailBody = h('div', { class: 'owned-tip-body' }, ...Array.from(tip.childNodes));
      tip.appendChild(detailBody);
      const sellBtn = h('button', { class: 'btn ghost shelf-lock', disabled: r.endTurnCommitted }, `出售 +${sellPrice(o)} 金`);
      sellBtn.addEventListener('click', () => { hideTip(); void this.doSell(idx); });
      const acts = h('div', { class: 'shelf-acts' }, sellBtn);
      if (o.ench) {
        const off = h('button', { class: 'btn ghost shelf-lock', disabled: r.bag.length >= BAG_MAX }, r.bag.length >= BAG_MAX ? '背包已满' : '卸下装备');
        off.addEventListener('click', () => { if (this.rehearsal || !this.editable || !this.allowed({ kind: 'other' }) || !unequip(r, idx)) return; hideTip(); sfx.swap(); this.persist(r); this.afterChange(); });
        acts.prepend(off);
      }
      if (!this.rehearsal) tip.appendChild(acts);
      if (hand) {
        const deploy = h('button', { class: 'btn primary shelf-recruit' }, '上场');
        deploy.addEventListener('click', () => {
          const empty = r.queue.findIndex(x => !x);
          if (empty < 0) { this.notice('队伍已满，可拖到场上交换'); return; }
          hideTip(); this.doMove(idx, empty);
        });
        acts.prepend(deploy);
        this.dockTip(tip);
        return;
      }
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
      const p = itemPrice(it);
      const go = h('button', { class: 'btn primary shelf-recruit', disabled: r.endTurnCommitted || r.gold < p }, p ? `招募 ${p} 金` : '免费招募');
      go.addEventListener('click', () => {
        const slot = autoSlot(r, it.def);
        if (slot < 0) { this.notice('队伍和手牌都满了：拖到同名单位上叠加，或先卖掉一个'); return; }
        const origin = isHand(slot) ? this.shopOrigin(idx) : null;
        hideTip();
        this.handFrom = origin && { ...origin, cell: slot };
        this.doBuy(idx, slot);
        this.handFrom = null;
      });
      acts.appendChild(go);
    } else {
      const store = h('button', { class: 'btn primary shelf-recruit', disabled: r.endTurnCommitted || r.gold < foodPrice(it) || !r.hand.slice(0, handCap(r)).some(x => !x) }, `收入手牌 ${foodPrice(it)} 金`);
      store.addEventListener('click', () => {
        this.flyOrigin = this.shopOrigin(idx);
        this.storeToHand(idx);
      });
      const use = h('button', { class: 'btn shelf-lock', disabled: r.endTurnCommitted || r.gold < foodPrice(it) }, `直接施放 ${foodPrice(it)} 金`);
      use.addEventListener('click', () => this.chooseSpellTarget('card', idx));
      acts.append(store, use);
    }
    if (it.def !== 'f_milk') {
      const lock = h('button', { class: 'btn ghost shelf-lock' }, it.locked ? '解锁' : '锁定');
      lock.addEventListener('click', () => {
        if (!this.editable || !this.allowed({ kind: 'lock', def: it.def })) return;
        toggleLock(r, it.sid); hideTip(); this.persist(r);
        this.lockFx = { sid: it.sid, on: it.locked };
        (it.locked ? sfx.chain : sfx.unchain)();
        this.renderTray();
      });
      acts.appendChild(lock);
    } else acts.appendChild(h('span', { class: 'shelf-note' }, '免费·本回合'));
    tip.appendChild(acts);
    this.dockTip(tip);
  }

  /** 牌区详情统一停靠，不压住卡牌 */
  private dockTip(tip: HTMLElement) {
    showDockTip(tip, toStage(0, this.tray.getBoundingClientRect().top).y - 8);
  }

  private notice(text: string) {
    sfx.fizzle();
    this.fx.float(640, 200, text, 'fizzle', 1400);
  }

  // ───────────── 操作 ─────────────

  private async doReroll() {
    if (this.rehearsal || !this.editable || !this.allowed({ kind: 'reroll' })) return;
    const fx = reroll(this.run);
    if (!fx) { this.notice('金币不够'); return; }
    sfx.swap();
    hideTip();
    this.persist(this.run);
    this.renderTray();
    this.cardsIn();
    if (fx.length) await this.runFx(fx);
  }

  private async doAdReroll() {
    if (this.teaching || this.rehearsal || !this.editable || this.run.adRr === this.run.turn) return;
    this.busy = true;
    hideTip();
    const ok = await showRewardedAd(this.el, '免费刷新', '看完广告，免费刷新一次货架');
    this.busy = false;
    if (!ok || this.disposed || !adReroll(this.run)) return;
    sfx.swap();
    this.persist(this.run);
    this.renderTray();
    this.cardsIn();
  }

  private doEquip(i: number, slot: number): boolean {
    if (this.rehearsal || !this.editable) return false;
    const r = this.run;
    const id = r.bag[i];
    if (!id || isHand(slot) || !this.allowed({ kind: 'equip', slot }) || !equipFromBag(r, i, slot)) return false;
    this.persist(r);
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
    if (this.rehearsal || !this.editable) return;
    if (!this.allowed({ kind: 'other' }) || !discardBag(this.run, i)) return;
    this.persist(this.run);
    sfx.reward();
    this.fx.float(120, 420, '+1 金', 'levelup', 800);
    this.afterChange();
  }

  private doTavern() {
    if (this.rehearsal || !this.editable || !this.allowed({ kind: 'other' })) return;
    const r = this.run;
    if (!upgradeTavern(r)) { this.notice('金币不够'); return; }
    this.persist(r);
    hideTip();
    sfx.reward();
    this.fx.flash('#ffd36b', 0.18, 260);
    this.fx.statPop(640, 200, '', `酒馆 ${r.tavern} 级`, 'pt-power');
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
          const el = h('button', { class: 'rl-card', 'aria-pressed': 'false' },
            h('div', { class: 'rl-art' }, h('i', { class: 'rl-rays' }), h('i', { class: 'rl-ped' }), itemIcon(`rl_${id.slice(2)}`, 'spell', 'rl-ico')),
            h('b', { class: 'rl-name' }, d.name),
            h('p', { class: 'rl-text' }, ...kwRich(d.text)));
          el.addEventListener('click', () => {
            sfx.click();
            sel = i;
            items.forEach((x, j) => { x.classList.toggle('on', j === i); x.classList.toggle('off', j !== i); x.setAttribute('aria-pressed', String(j === i)); });
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
          this.persist(r);
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
          this.persist(r);
          sel = -1;
          paint(n);
        });
        const owned = r.relics.length ? h('div', { class: 'rl-owned' }, h('span', null, '已有'), ...r.relics.map((id) => itemIcon(`rl_${id.slice(2)}`, 'spell'))) : null;
        ov.replaceChildren(h('div', { class: 'chest-card rl-wrap' },
          h('h2', null, '选一件遗物'),
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
    type Opt = { label: string; sub: string; unit?: (o: Owned) => boolean; choice: number; vis?: () => HTMLElement; no?: string };
    const filled = r.queue.filter((o): o is Owned => !!o);
    const plus = (t: string) => h('b', { class: 'fv-plus' }, t);
    const opts: Opt[] = ev === 'fire' ? [
      { label: '整编', sub: '选一个友军', unit: fireCopyOk, choice: 0, no: '都已金色',
        vis: () => h('div', { class: 'fv fv-copy' }, h('span', { class: 'fv-pips' }, h('i', { class: 'on' }), h('i', { class: 'add' }), h('i', { class: 'add' })), plus('+2 份')) },
      { label: '锤炼', sub: '选一个友军 · 永久', unit: () => true, choice: 1,
        vis: () => h('div', { class: 'fv fv-stat' }, statArt('atk', h('i', null, '+4')), statArt('hp', h('i', null, '+4'))) },
      { label: '休整', sub: '回复生命', choice: 2, no: '已满血',
        vis: () => h('div', { class: 'fv fv-heart' }, icon('heart'), plus('+1')) },
      ...(r.hero === 'smith' ? [{ label: '锻打', sub: '选一件装备', unit: fireSmithOk, choice: 3, no: '无可升品',
        vis: () => h('div', { class: 'fv fv-smith' }, itemIcon('eq_hammer', 'spell'), plus('+1 品')) }] : []),
    ] : ev === 'quest' ? QUESTS.map((id, i) => ({ label: QUEST_INFO[id].name, sub: `${QUEST_INFO[id].text} → ${QUEST_INFO[id].reward}`, choice: i }))
    : ev === 'treasure' ? [{ label: '收下', sub: '下回合 +4 金', choice: 0 }]
    : ev === 'camp' ? [
      { label: '加练', sub: '选一个友军永久 +3/+3', unit: () => true, choice: 0 },
      { label: '领装备', sub: '随机一件蓝色装备进背包', choice: 1 },
    ] : ev === 'smith' ? [
      { label: '锻造', sub: '选一个友军直接变金色，随机另一个友军离队', unit: (o) => !o.merc && o.copies < MAX_COPIES, choice: 0 },
    ] : ev === 'morph' ? [
      { label: '跳进去', sub: '选一个友军，变成同阶同标签的另一张卡，成长和装备保留', unit: (o) => !o.merc && morphPool(o).length > 0, choice: 0 },
    ] : ev === 'merc' ? [
      { label: '雇佣', sub: `一个 ${mercTier(r)} 阶金色单位免费入队 ${MERC_FIGHTS} 场，不能出售和合并`, choice: 0 },
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
      if (ev === 'fire' && o.choice === 2) return r.lives < maxLives(r);
      return true;
    };
    return new Promise((done) => {
      const ov = h('div', { class: 'branch-ov event-ov' });
      const finish = async (choice: number, slot: number | null) => {
        const res = resolveEvent(r, choice, slot);
        if (!res.ok) { this.notice('现在不行'); return; }
        sfx.reward();
        this.persist(r);
        ov.remove();
        this.renderAll();
        if (res.ok && res.lost) this.notice(`${card(res.lost.def).name} 离队了`);
        if (res.ok && res.morphed) this.notice(`变成了 ${card(res.morphed).name}`);
        if (res.ok && res.bag && ev === 'fire') this.notice(`锻成 ${EQUIP[res.bag]?.name ?? ''}`);
        if (res.ok && res.fx.length) await this.runFx(res.fx);
        done();
      };
      const pickUnit = (o: Opt) => {
        const units = r.queue.map((u, i) => ({ u, i })).filter((x): x is { u: Owned; i: number } => !!x.u && o.unit!(x.u));
        if (ev === 'morph') {
          ov.replaceChildren(morphUnitPicker(units, (i) => {
            const u = r.queue[i];
            if (!u) return;
            sfx.click();
            ov.replaceChildren(morphOutcomePreview(u, () => { sfx.click(); pickUnit(o); }, () => { void finish(o.choice, i); }));
          }, () => { sfx.click(); main(); }));
          return;
        }
        const back = h('button', { class: 'btn ghost' }, h('span', null, '返回'));
        back.addEventListener('click', () => { sfx.click(); main(); });
        ov.replaceChildren(h('div', { class: 'branch-card' }, h('h2', null, o.label), h('p', null, o.sub),
          h('div', { class: 'ev-units' }, ...units.map(({ u, i }) => {
            const b = h('button', { class: 'ev-unit' }, h('span', { class: 'bo-art', html: unitSvg(u.def) }),
              h('b', null, card(u.def).name), h('span', { class: 'ev-lv' }, lvlOf(u.copies) >= 2 ? '金色' : `${u.copies}/3`));
            b.addEventListener('click', () => { void finish(o.choice, i); });
            return b;
          })), back));
      };
      const main = () => {
        const btns = opts.map((o) => {
          const ok = usable(o);
          if (o.vis) {
            const b = h('button', { class: `fire-opt${ok ? '' : ' disabled'}`, disabled: !ok },
              o.vis(), h('b', { class: 'fo-name' }, o.label), h('span', { class: 'fo-sub' }, o.sub),
              ok ? null : h('span', { class: 'fo-no' }, icon('x'), o.no ?? '不可用'));
            b.addEventListener('click', () => { if (!ok) return; sfx.click(); if (o.unit) pickUnit(o); else void finish(o.choice, null); });
            return b;
          }
          const b = h('button', { class: `branch-opt ev-opt${ok ? '' : ' disabled'}`, disabled: !ok },
            h('div', { class: 'bo-head' }, h('b', null, o.label)), h('div', { class: 'ev-sub' }, ok ? o.sub : `${o.sub}（现在不满足条件）`));
          b.addEventListener('click', () => { if (!ok) return; sfx.click(); if (o.unit) pickUnit(o); else void finish(o.choice, null); });
          return b;
        });
        const leave = ev === 'treasure' ? null : h('button', { class: 'btn ghost' }, h('span', null, '离开'));
        leave?.addEventListener('click', () => void finish(-1, null));
        leave?.classList.add('ev-leave');
        ov.replaceChildren(h('div', { class: `branch-card ev-card${ev === 'fire' ? ' fire-card' : ''}` },
          h('div', { class: 'ev-ico' }, itemIcon(`ev_${ev}`, 'spell')), h('h2', null, info.name), h('p', null, info.text),
          h('div', { class: 'branch-opts ev-opts' }, ...btns), leave));
      };
      main();
      this.el.appendChild(ov);
      sfx.whoosh();
    });
  }

  private merchantSeen = false;
  private where() {
    const r = this.run;
    return r.layer >= LAYERS ? `第${'一二三'[r.act]}幕 · Boss` : `第${'一二三'[r.act]}幕 · ${r.layer + 1}/${LAYERS}`;
  }

  /** 路线图：可选时点节点 → 看详情 → 前往；否则只看 */
  private showMap(pickable: boolean): Promise<void> {
    const r = this.run;
    const opts = nodeOpts(r);
    return new Promise((done) => {
      const ov = h('div', { class: 'map-ov' });
      const W = 1040, H = 440, cols = r.map.length;
      const pos = (l: number, i: number, n: number) => ({ x: 70 + (l * (W - 140)) / (cols - 1), y: H / 2 + (i - (n - 1) / 2) * (n === 3 ? 140 : 170) });
      const lines: string[] = [];
      r.map.forEach((L, l) => L.forEach((n, i) => n.next.forEach((j) => {
        if (!r.map[l + 1]) return;
        const a = pos(l, i, L.length), b = pos(l + 1, j, r.map[l + 1].length);
        const walked = r.path[l] === i && r.path[l + 1] === j;
        lines.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${walked ? 'walked' : ''}"/>`);
      })));
      const info = h('div', { class: 'map-info' });
      const go = h('button', { class: 'btn primary map-go', disabled: true }, h('span', null, '前往'), icon('play'));
      let sel = -1;
      const nodes = r.map.flatMap((L, l) => L.map((n, i) => {
        const p = pos(l, i, L.length);
        const can = l === r.layer && opts.includes(i);
        const on = r.path[l] === i;
        const el = h('button', { class: `map-node k-${n.k}${can ? ' can' : ''}${on ? ' on' : ''}${l < r.layer && !on ? ' past' : ''}`, style: `left:${p.x}px;top:${p.y}px` },
          itemIcon(nodeIco(n.k), 'spell', 'mn-ico'),
          n.k === 'boss' ? h('b', { class: 'mn-tag' }, BOSSES[bossOf(r)].name) : n.form ? h('b', { class: 'mn-tag' }, FORM_INFO[n.form].name) : null);
        el.addEventListener('click', () => {
          sfx.click();
          const nk = NODE_INFO[n.k];
          const name = n.k === 'boss' ? BOSSES[bossOf(r)].name : nk.name;
          const hint = n.k === 'boss' ? BOSSES[bossOf(r)].desc : n.form ? `${FORM_INFO[n.form].name}：${FORM_INFO[n.form].hint}` : nk.hint;
          info.replaceChildren(itemIcon(nodeIco(n.k), 'spell'), h('b', null, name), h('span', null, hint), ...(nk.tail ? [h('em', null, nk.tail)] : []));
          nodes.forEach((x) => x.classList.remove('sel'));
          el.classList.add('sel');
          sel = can ? i : -1;
          go.disabled = sel < 0;
        });
        return el;
      }));
      go.addEventListener('click', () => {
        if (sel < 0 || !pickNode(r, sel)) return;
        sfx.whoosh();
        this.persist(r);
        ov.remove();
        this.renderAll();
        done();
      });
      const close = h('button', { class: 'btn ghost map-close' }, h('span', null, '返回'));
      close.addEventListener('click', () => { sfx.click(); ov.remove(); done(); });
      ov.replaceChildren(h('div', { class: 'map-card' },
        h('div', { class: 'map-head' }, h('h2', null, `第${'一二三'[r.act]}幕`), h('div', { class: 'map-acts' }, ...Array.from({ length: ACTS }, (_, a) => h('i', { class: a < r.act ? 'done' : a === r.act ? 'cur' : '' })))),
        h('div', { class: 'map-field', style: `width:${W}px;height:${H}px` }, h('div', { class: 'map-lines', html: `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%">${lines.join('')}</svg>` }), ...nodes),
        h('div', { class: 'map-foot' }, info, pickable ? go : close)));
      this.el.appendChild(ov);
      if (pickable) {
        const first = nodes.find((x) => x.classList.contains('can'));
        info.replaceChildren(h('span', null, '选一个节点'));
        if (this.teaching && first) first.click();
      }
      sfx.whoosh();
    });
  }

  /** 商人：额外两格特殊货（装备 / 遗物碎片 / 高阶法术） */
  private showMerchant(): Promise<void> {
    const r = this.run;
    return new Promise((done) => {
      const ov = h('div', { class: 'branch-ov event-ov' });
      const paint = () => {
        const goods = (r.merchant ?? []).map((g, i) => {
          const ico = g.kind === 'equip' ? equipIcon(g.id as never) : g.kind === 'shard' ? itemIcon('rl_quick', 'spell') : itemIcon(FOOD[g.id].icon, 'spell');
          const name = g.kind === 'equip' ? EQUIP[g.id as never].name : g.kind === 'shard' ? `遗物碎片 ${r.shards ?? 0}/${SHARD_NEED}` : FOOD[g.id].name;
          const sub = g.kind === 'equip' ? Q_INFO[equipOf(g.id as never)!.q].name : g.kind === 'shard' ? `集齐 ${SHARD_NEED} 片选遗物` : '放上补给栏';
          const b = h('button', { class: `branch-opt mc-good${g.sold ? ' sold' : ''}`, disabled: !!g.sold || r.gold < g.price },
            h('div', { class: 'mc-ico' }, ico), h('b', null, name), h('div', { class: 'ev-sub' }, sub),
            h('div', { class: 'mc-price' }, g.sold ? icon('check') : itemIcon('coin', 'coin', 'sm'), g.sold ? '' : String(g.price)));
          b.addEventListener('click', async () => {
            if (!buyGoods(r, i)) { this.notice('金币不够'); return; }
            sfx.reward();
            this.persist(r);
            this.renderAll();
            paint();
            if (r.relicPick) { ov.remove(); await this.showRelic(); this.el.appendChild(ov); paint(); }
          });
          return b;
        });
        const leave = h('button', { class: 'btn ghost' }, h('span', null, '走了'));
        leave.addEventListener('click', () => { sfx.click(); ov.remove(); done(); });
        leave.classList.add('ev-leave');
        ov.replaceChildren(h('div', { class: 'branch-card ev-card' },
          h('div', { class: 'ev-ico' }, itemIcon('n_shop', 'spell')), h('h2', null, '商人'),
          h('div', { class: 'tl-gold mc-gold' }, itemIcon('coin', 'coin'), h('b', null, r.gold)),
          h('div', { class: 'branch-opts ev-opts' }, ...goods), leave));
      };
      paint();
      this.el.appendChild(ov);
      sfx.whoosh();
    });
  }

  /** 英雄：被动看说明；主动花金币用一次（每回合 1 次） */
  private showHero(): Promise<void> {
    const r = this.run;
    const hero = HERO[r.hero];
    return new Promise((done) => {
      const ov = h('div', { class: 'branch-ov event-ov' });
      const close = () => { ov.remove(); this.renderAll(); done(); };
      const fire = async (slot: number | null) => {
        const fx = useHero(r, slot);
        if (!fx) { this.notice(r.heroUsed === r.turn ? '本回合用过了' : '金币不够'); return; }
        sfx.reward();
        this.persist(r);
        close();
        if (fx.length) await this.runFx(fx);
        await this.drainDiscover();
      };
      const main = () => {
        const use = hero.cost ? h('button', { class: 'btn primary', disabled: !heroReady(r) }, h('span', null, r.heroUsed === r.turn ? '本回合已用' : '使用'), itemIcon('coin', 'coin', 'sm'), String(hero.cost)) : null;
        use?.addEventListener('click', () => {
          if (!heroReady(r)) return;
          sfx.click();
          if (r.hero !== 'qm') { void fire(null); return; }
          const list = Array.from({ length: HAND_BASE + handCap(r) }, (_, i) => i).map((i) => ({ u: cellAt(r, i), i })).filter((x): x is { u: Owned; i: number } => !!x.u);
          const back = h('button', { class: 'btn ghost' }, h('span', null, '返回'));
          back.addEventListener('click', () => { sfx.click(); main(); });
          ov.replaceChildren(h('div', { class: 'branch-card' }, h('h2', null, hero.name), h('p', null, '选一个友军 +1/+2'),
            h('div', { class: 'ev-units' }, ...list.map(({ u, i }) => {
              const b = h('button', { class: 'ev-unit' }, h('span', { class: 'bo-art', html: unitSvg(u.def) }), h('b', null, card(u.def).name));
              b.addEventListener('click', () => void fire(i));
              return b;
            })), back));
        });
        const back = h('button', { class: 'btn ghost' }, h('span', null, '关闭'));
        back.addEventListener('click', () => { sfx.click(); close(); });
        ov.replaceChildren(h('div', { class: 'branch-card ev-card hero-card' },
          h('div', { class: 'hc-art', html: unitSvg(hero.art) }), h('h2', null, hero.name), h('p', null, ...kwRich(hero.text)),
          h('div', { class: 'ev-opts hc-acts' }, use, back)));
      };
      main();
      this.el.appendChild(ov);
    });
  }

  /** 非战斗节点：结束回合 → 处理节点内容 → 下一回合 */
  private async goNode() {
    if (!this.editable || !this.allowed({ kind: 'battle' })) return;
    const r = this.run;
    if (r.leaving) { await this.finishNode(); return; }
    this.growthPreview = null;
    this.busy = true;
    hideTip();
    sfx.start();
    const turnFx = endTurn(r);
    this.renderHud();
    this.renderTray();
    this.renderBoard(turnFx);
    await this.playFx(turnFx);
    if (this.disposed) return;
    await this.drainDiscover();
    if (r.rewards?.length) { this.busy = false; this.persist(r); this.afterChange(); return; }
    leaveNode(r);
    this.persist(r);
    await this.finishNode();
  }
  private async finishNode() {
    const r = this.run;
    this.busy = true;
    if (r.event) await this.showEvent();
    if (this.disposed) return;
    await this.drainDiscover();
    if (r.rewards?.length) {
      this.busy = false;
      this.persist(r);
      this.afterChange();
      return;
    }
    passNode(r);
    this.merchantSeen = false;
    this.persist(r);
    this.backToPrep(true);
  }

  /** 发现从哪里飞出（法术牌 / 触发单位），舞台坐标 */
  private discFrom: { x: number; y: number } | null = null;

  /** 依次弹出所有待选的发现；期间锁住操作 */
  private async drainDiscover() {
    if (this.rehearsal || this.disposed || !this.run.discover?.length) { this.discFrom = null; return; }
    const was = this.busy;
    this.busy = true;
    hideTip();
    this.setFocus(null);
    try { while (this.run.discover?.length && !this.disposed) await this.showDiscover(); }
    finally { this.discFrom = null; this.busy = was; }
  }

  /** 炉石式发现：置灰，三张卡从来源飞出翻面；点选 → 选择；按住「查看战场」暂时淡出 */
  private showDiscover(): Promise<void> {
    const r = this.run;
    const d = r.discover![0];
    const from = this.discFrom ?? { x: 640, y: 660 };
    const anim = !reduced();
    return new Promise((done) => {
      let sel = -1, closing = false;
      const take = h('button', { class: 'btn primary disc-take', disabled: true }, h('span', null, '选一张'));
      const slots = d.opts.map((id, i) => {
        const spell = d.mode === 'spell';
        const name = spell ? FOOD[id].name : card(id).name;
        const el = h('button', { class: `disc-slot${spell ? ' disc-spell' : ''}`, 'aria-pressed': 'false', 'aria-label': name },
          h('i', { class: 'disc-rays' }), h('i', { class: 'disc-glow' }), spell ? foodCard(id, d.val) : this.unitCard(id),
          h('div', { class: 'disc-desc' }, h('span', null, ...kwRich(spell ? FOOD[id].text : cardText(id, d.mode === 'morph' ? lvlOf(r.queue.find((o) => o?.oid === d.oid)?.copies ?? 1) : 1)))));
        el.addEventListener('click', () => {
          if (closing) return;
          sfx.click();
          sel = i;
          slots.forEach((x, j) => { x.classList.toggle('on', j === i); x.classList.toggle('off', j !== i); x.setAttribute('aria-pressed', String(j === i)); });
          take.disabled = false;
          take.replaceChildren(h('span', null, `选择「${name}」`));
        });
        return el;
      });
      const hint = d.mode === 'morph' ? '替换它：份数、成长、历战和装备保留'
        : d.price ? `放上货架，招募 ${d.price} 金` : r.hand.slice(0, handCap(r)).some((o) => !o) ? `放进手牌${(d.count ?? 1) > 1 ? ` ×${d.count}` : ''}` : '手牌已满，选择后待领取';
      const peek = h('button', { class: 'btn ghost disc-peek' }, icon('eye'), h('span', null, '按住看战场'));
      const wrap = h('div', { class: 'disc-wrap' },
        h('div', { class: 'disc-head' }, h('h2', null, d.src)),
        h('div', { class: 'disc-cards' }, ...slots),
        h('p', { class: 'disc-hint' }, hint),
        h('div', { class: 'disc-acts' }, take));
      const ov = h('div', { class: 'disc-ov', role: 'dialog', 'aria-label': '发现' }, h('div', { class: 'disc-dim' }), wrap, peek);
      const peekOn = (e: PointerEvent) => { e.preventDefault(); ov.classList.add('peek'); };
      const peekOff = () => ov.classList.remove('peek');
      peek.addEventListener('pointerdown', peekOn);
      for (const k of ['pointerup', 'pointercancel', 'pointerleave'] as const) peek.addEventListener(k, peekOff);
      peek.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); ov.classList.add('peek'); } });
      peek.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') peekOff(); });
      peek.addEventListener('blur', peekOff);
      peek.addEventListener('contextmenu', (e) => e.preventDefault());
      this.el.appendChild(ov);
      sfx.whoosh();

      const centerOf = (el: Element) => {
        const rc = el.getBoundingClientRect();
        return toStage(rc.left + rc.width / 2, rc.top + rc.height / 2);
      };
      if (anim) slots.forEach((el, i) => {
        const c = centerOf(el);
        el.animate([
          { transform: `translate(${from.x - c.x}px,${from.y - c.y}px) scale(.2) rotateY(180deg)`, opacity: 0 },
          { transform: `translate(0,-26px) scale(1.06) rotateY(0deg)`, opacity: 1, offset: .7 },
          { transform: 'none', opacity: 1 },
        ], { duration: 560, delay: 120 + i * 80, easing: 'cubic-bezier(.25,.8,.35,1)', fill: 'backwards' });
        setTimeout(() => { if (!this.disposed) sfx.place(); }, 120 + i * 80 + 380);
      });

      take.addEventListener('click', async () => {
        if (sel < 0 || closing) return;
        closing = true;
        const chosen = slots[sel];
        const res = pickDiscover(r, sel);
        if (!res) { closing = false; return; }
        this.persist(r);
        sfx.reward();
        // 目的地：变身 → 那个单位；获得 → 货架末尾
        let dest = { x: 520, y: 600 };
        if (res.hand != null) dest = this.cellPos(res.hand);
        else if (res.oid != null) {
          const slot = r.queue.findIndex((o) => o?.oid === res.oid);
          if (slot >= 0) dest = bodyPos(0, slot);
        } else {
          const cards = this.tray.querySelector('.cards');
          if (cards) { const rc = cards.getBoundingClientRect(); dest = toStage(rc.right - 60, rc.top + rc.height / 2); }
        }
        if (anim) {
          const c = centerOf(chosen);
          const fades = slots.filter((x) => x !== chosen).map((x) => x.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(30px) scale(.9)' }], { duration: 220, fill: 'forwards' }).finished);
          wrap.querySelectorAll('.disc-head, .disc-hint, .disc-acts').forEach((x) => x.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' }));
          ov.querySelector('.disc-dim')!.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 520, delay: 160, fill: 'forwards' });
          peek.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
          const fly = chosen.animate([
            { transform: 'translateY(-14px) scale(1.04)' },
            { transform: 'translateY(-40px) scale(1.12)', offset: .25 },
            { transform: `translate(${dest.x - c.x}px,${dest.y - c.y}px) scale(.22)`, opacity: .2 },
          ], { duration: 560, easing: 'cubic-bezier(.5,0,.6,1)', fill: 'forwards' }).finished;
          await Promise.all([fly, ...fades]).catch(() => undefined);
        }
        ov.remove();
        if (this.disposed) { done(); return; }
        this.afterChange();
        if (res.hand != null) this.pulseHand(res.hand);
        else if (res.oid != null) {
          const v = this.viewOf(res.oid);
          if (v) {
            const p = bodyPos(0, v.slot);
            this.fx.ring(p.x, p.y, '#7be3ff', 72, 30);
            this.fx.burst(p.x, UNIT_Y + 10, '#7be3ff', { n: 18, speed: 5 });
            this.fx.statPop(p.x, p.y - 70, '', card(res.def).name, 'pt-power');
            v.appear();
          }
        } else if (res.sid != null) {
          const idx = r.shop.findIndex((s) => s.sid === res.sid);
          const el = this.tray.querySelector(`.card[data-idx="${idx}"]`);
          if (el && anim) el.animate([{ transform: 'translateY(-30px) scale(1.15)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 360, easing: 'cubic-bezier(.2,1.4,.4,1)' });
        }
        done();
      });
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
          const effect = e.atoms?.length === 1 && e.text === ATOM_INFO[e.atoms[0]].name
            ? ATOM_INFO[e.atoms[0]].desc : e.text;
          const el = h('button', { class: `chest-item eq-q${e.q}` },
            h('div', { class: 'ci-beam' }),
            h('div', { class: 'ci-ico' }, equipIcon(id)),
            h('b', { class: 'ci-name', style: `color:${Q_INFO[e.q].color}` }, e.name),
            h('span', { class: 'ci-q' }, Q_INFO[e.q].name, e.curse ? ' · 诅咒' : ''),
            h('div', { class: 'ci-text' }, effect),
            e.q === 2 && (capped || left <= 0) ? h('span', { class: 'ci-cap' }, '橙装已达上限') : null);
          el.addEventListener('click', () => {
            sfx.reward();
            chestPick(r, i);
            this.persist(r);
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
          this.persist(r);
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

  private doBuy(idx: number, slot: number, replacePlayAbility = false, playTarget?: number): boolean {
    if (this.rehearsal || !this.editable) return false;
    const r = this.run;
    const it = r.shop[idx];
    if (!it) return false;
    if (!this.allowed({ kind: 'buy', slot, def: it.def })) return false;
    const before = cellAt(r, slot)?.copies ?? 0;
    if (playTarget === undefined && !isHand(slot) && card(it.def).pl === 'p_ignite' && (!before || before + 1 >= MAX_COPIES)
      && this.choosePlayTarget([cellAt(r, slot)?.oid ?? -1], oid => this.doBuy(idx, slot, replacePlayAbility, oid))) return false;
    const conflict = !isHand(slot) && (!before || before + 1 >= MAX_COPIES) ? inspectPlayConflict(r, it.def, slot, playTarget, before ? MAX_COPIES : 1) : null;
    if (conflict && !replacePlayAbility) {
      this.app.confirm('替换入场目标的附加能力？', `${card(conflict.target.def).name}将失去${grantedText(conflict.target.granted!)}，获得${grantedText(conflict.incoming)}。`,
        '替换并招募', () => this.doBuy(idx, slot, true, playTarget));
      return false;
    }
    const res = buy(r, it.sid, slot, playTarget, replacePlayAbility);
    if (!res.ok) { this.notice(res.why === 'gold' ? '金币不够' : res.why === 'max' ? '已经是金色' : '这里有别的单位'); return false; }
    this.persist(r);
    this.afterChange(res.fx);
    const o = cellAt(r, slot)!;
    const v = this.viewOf(o.oid);
    const p = this.cellPos(slot);
    if (isHand(slot)) this.pulseHand(slot);
    if (res.merged) {
      sfx.merge();
      this.fx.ring(p.x, p.y, lineColor(o.def), 70, 30);
      this.fx.statPop(p.x, p.y - 70, `+${o.copies - before}/+${o.copies - before}`, res.levelUp ? '金色！' : '叠加', res.levelUp ? 'pt-power' : 'pt-hp');
      v?.pulse(lineColor(o.def));
    } else {
      sfx.place();
      v?.appear();
      this.fx.burst(p.x, UNIT_Y + 10, lineColor(o.def), { n: 14, speed: 4 });
    }
    if (res.levelUp) sfx.reward();
    this.discFrom = p;
    void this.runFx(res.fx).then(() => this.drainDiscover());
    return true;
  }

  private doFood(idx: number, slot: number | null): boolean {
    const item = this.run.shop[idx];
    if (!item || !this.allowed({ kind: 'food', slot: slot ?? undefined, def: item.def })) return false;
    return this.applySpell('card', idx, slot);
  }

  private doMove(from: number, to: number, keepAbility?: 'source' | 'target', replacePlayAbility = false, playTarget?: number): boolean {
    if (!this.editable) return false;
    const r = this.run;
    if (!this.allowed({ kind: 'move', from, slot: to })) return false;
    if (this.rehearsal) {
      if (from === to || !r.queue[from] || to < 0 || to >= QUEUE_MAX) return false;
      [r.queue[from], r.queue[to]] = [r.queue[to], r.queue[from]];
      this.afterChange(); sfx.swap(); return true;
    }
    const source = cellAt(r, from), target = cellAt(r, to);
    if (playTarget === undefined && source && !isHand(to) && card(source.def).pl === 'p_ignite'
      && (source.fresh || source.pendingGoldPlay || target?.def === source.def && source.copies + target.copies >= MAX_COPIES)
      && this.choosePlayTarget([source.oid, target?.oid ?? -1], oid => this.doMove(from, to, keepAbility, replacePlayAbility, oid))) return false;
    const conflicts = [
      source && !isHand(to) && (source.fresh || source.pendingGoldPlay || target?.def === source.def && source.copies + target.copies >= MAX_COPIES)
        ? inspectPlayConflict(r, source.def, to, playTarget, target?.def === source.def ? Math.min(MAX_COPIES, source.copies + target.copies) : source.copies, from) : null,
      target && !isHand(from) && (target.fresh || target.pendingGoldPlay)
        ? inspectPlayConflict(r, target.def, from, undefined, target.copies, to) : null,
    ].filter(x => x !== null);
    if (!replacePlayAbility && conflicts.length) {
      this.app.confirm('替换入场目标的附加能力？', conflicts.map(c => `${card(c.target.def).name}将失去${grantedText(c.target.granted!)}，获得${grantedText(c.incoming)}`).join('。'),
        '替换并部署', () => this.doMove(from, to, keepAbility, true, playTarget));
      return false;
    }
    if (!keepAbility && source?.def === target?.def && source && target && source.copies < MAX_COPIES && target.copies < MAX_COPIES
      && source.granted && target.granted && (source.granted.id !== target.granted.id || source.granted.duration !== target.granted.duration)) {
      const choices = (['source', 'target'] as const).map(which => {
        const ability = which === 'source' ? source.granted! : target.granted!;
        const button = h('button', { class: 'btn' }, grantedText(ability));
        button.addEventListener('click', () => { close(); this.doMove(from, to, which, replacePlayAbility, playTarget); });
        return button;
      });
      const cancel = h('button', { class: 'btn' }, '取消');
      const close = this.app.modal(h('div', { class: 'spell-dialog' }, h('h3', null, '合并后保留哪个能力'),
        h('div', { class: 'dialog-actions' }, ...choices, cancel)), 'spell-picker');
      cancel.addEventListener('click', close);
      return false;
    }
    const res = moveOwned(r, from, to, playTarget, keepAbility, replacePlayAbility);
    if (!res) return false;
    this.persist(r);
    this.afterChange(res.fx);
    if (res.merged) {
      const o = cellAt(r, to)!;
      const p = this.cellPos(to);
      sfx.merge();
      if (isHand(to)) this.pulseHand(to); else this.fx.ring(p.x, p.y, lineColor(o.def), 70, 30);
      if (res.levelUp) { this.fx.statPop(p.x, p.y - 70, '', '金色！', 'pt-power'); sfx.reward(); }
      this.discFrom = p;
      void this.runFx(res.fx).then(() => this.drainDiscover());
    } else {
      sfx.swap();
      if (res.fx.length) void this.runFx(res.fx).then(() => this.drainDiscover());
    }
    return true;
  }

  private async doSell(slot: number) {
    if (this.rehearsal || !this.editable) return;
    const r = this.run;
    const o = cellAt(r, slot);
    if (!o) return;
    const p = this.cellPos(slot);
    if (!this.allowed({ kind: 'sell', slot })) return;
    const res = sell(r, slot);
    if (!res) return;
    this.persist(r);
    hideTip();
    sfx.reward();
    const v = this.viewOf(o.oid);
    void v?.die();
    this.fx.float(p.x, p.y - 60, `+${res.gold} 金`, 'levelup', 900);
    this.fx.burst(p.x, p.y, '#ffd36b', { n: 16, speed: 5 });
    this.busy = true;
    try {
      await wait(reduced() ? 0 : 160);
      if (this.disposed) return;
      this.afterChange(res.fx);
      await this.playFx(res.fx, { [o.oid]: p });
    } finally { this.busy = false; }
    this.discFrom = p;
    await this.drainDiscover();
  }

  /** 状态变了：重绘货架 / HUD / 队列（可指定待播的效果，先扣数值） */
  private afterChange(pending: ShopFx[] = []) {
    this.growthPreview = null;
    this.renderHud();
    this.renderTray();
    this.renderBoard(pending);
  }

  private async runFx(fx: ShopFx[], gone: Record<number, { x: number; y: number }> = {}) {
    if (!fx.length) return;
    const wasBusy = this.busy;
    this.busy = true;
    try { await this.playFx(fx, gone); } finally { this.busy = wasBusy; }
  }

  /** 数据已结算；这里只播放可随时快进的表现，不再次应用规则。 */
  private async playFx(fx: ShopFx[], gone: Record<number, { x: number; y: number }> = {}) {
    if (!fx.length || this.disposed) return;
    this.fastFx = reduced();
    const label = h('span', null, `结算中 0/${fx.length}`);
    const skip = h('button', { class: 'btn ghost', type: 'button' }, '立即完成');
    skip.addEventListener('click', () => { this.fastFx = true; this.releaseFxWait?.(); });
    this.settling.replaceChildren(label, skip);
    this.settling.classList.add('on');
    const posOf = (oid: number | null) => {
      if (oid == null) return null;
      const v = this.viewOf(oid);
      return v ? bodyPos(0, v.slot) : gone[oid] ?? null;
    };
    try {
      for (const [i, f] of fx.entries()) {
        if (this.disposed) return;
        label.textContent = `结算中 ${i + 1}/${fx.length} · ${f.label}`;
        const from = posOf(f.src);
        if (f.kind === 'buff') {
          const to = posOf(f.tgt);
          const o = this.run.queue.find((x) => x?.oid === f.tgt);
          if (!to || !o) continue;
          if (!this.fastFx && from && f.src !== f.tgt) {
            this.board.arrow({ x: from.x, y: from.y - 50 }, { x: to.x, y: to.y - 50 }, 'buff', { label: f.label, lift: 40 + Math.abs(to.x - from.x) * 0.14 });
            this.fx.orb({ x: from.x, y: from.y - 30 }, { x: to.x, y: to.y - 30 }, lineColor(o.def), 180);
            await this.fxWait(180);
          } else if (!this.fastFx && from) {
            this.viewOf(f.src!)?.castMotion(lineColor(o.def));
            await this.fxWait(90);
          }
          const shown = this.shown.get(f.tgt);
          if (shown && !f.tmp) { shown.atk += f.atk; shown.hp += f.hp; }
          const v = this.viewOf(f.tgt);
          if (v) this.paintOwned(v, o, !this.fastFx);
          if (!this.fastFx) {
            sfx.buff();
            this.fx.statPop(to.x, to.y - 74, `+${f.atk}/+${f.hp}`, f.label, f.atk >= f.hp ? 'pt-atk' : 'pt-hp', 560);
            await this.fxWait(170);
          }
          this.board.clearArrows();
        } else if (f.kind === 'gold') {
          if (!this.fastFx && from) {
            this.fx.statPop(from.x, from.y - 74, `+${f.n} 金`, f.label, 'pt-power', 560);
            sfx.pick();
            await this.fxWait(170);
          }
        } else {
          if (!this.fastFx && from) {
            this.viewOf(f.src)?.castMotion('#ffb36b');
            this.fx.statPop(from.x, from.y - 74, `+${f.n}/+${f.n}`, '蛋里的幼龙', 'pt-power', 560);
            sfx.buff();
            await this.fxWait(210);
          }
        }
      }
    } finally {
      this.releaseFxWait?.();
      this.settling.classList.remove('on');
      this.board.clearArrows();
      // 快进、普通播放和减少动态效果都对齐同一份最终数据。
      for (const o of this.run.queue) if (o) {
        this.shown.set(o.oid, this.ownedBaseStats(o));
        const v = this.viewOf(o.oid);
        if (v) this.paintOwned(v, o);
      }
    }
  }

  // ───────────── 战斗 ─────────────

  private async startBattle() {
    this.growthPreview = null;
    if (this.rehearsal) { await this.startTrial(); return; }
    if (!this.editable || !this.allowed({ kind: 'battle' })) return;
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
    await this.drainDiscover();
    if (r.rewards?.length) { this.busy = false; this.persist(r); this.afterChange(); return; }
    const out = fight(r);
    const before = { lives: r.lives, wins: r.wins, turn: r.turn, boss: r.enemy.boss };
    settleBattle(r, out);
    this.persist(r);
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
    const b = h('button', { class: 'btn primary res-replay' }, icon('replay'), h('span', null, '重播'));
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

  private reviewButton(out: BattleOut, summary: HTMLElement) {
    const button = h('button', { class: 'btn primary res-review' }, '复盘');
    button.addEventListener('click', () => {
      summary.remove();
      const close = h('button', { class: 'btn primary', 'aria-label': '关闭复盘' }, '返回');
      const detail = h('div', { class: 'result-ov with-report review-only' },
        h('div', { class: 'res-card' }, battleReport(out), h('div', { class: 'res-btns' }, close)));
      detail.querySelector('.res-btns')!.prepend(this.replayBtn(out, detail));
      close.addEventListener('click', () => { detail.remove(); this.el.appendChild(summary); });
      this.el.appendChild(detail);
    });
    return button;
  }

  /** 回到备战（结算/试打/重打之后） */
  private backToPrep(intro: boolean) {
    this.growthPreview = null;
    const r = this.run;
    this.el.classList.remove('in-battle');
    this.bar.classList.remove('on');
    this.busy = false;
    this.board.clearArrows();
    setMusicRun('pdqs', Math.min(2, Math.floor((r.turn - 1) / 4)));
    this.renderAll(intro ? r.pendingFx : []);
    if (intro) this.cardsIn();
    if (intro) void this.intro();
  }

  private leaveRehearsal() {
    this.growthPreview = null;
    const trial = this.rehearsal;
    if (!trial) return;
    this.run = trial.session.settled;
    this.rehearsal = null;
    this.el.classList.remove('rehearsal');
    this.renderAll();
    this.el.classList.add('in-battle');
    this.tray.classList.add('hidden');
    this.bar.classList.remove('on');
    this.busy = true;
    this.el.appendChild(trial.report);
  }

  private retryButton(): HTMLElement | null {
    if (!this.rehearsal) return null;
    const button = h('button', { class: 'btn primary res-retry', disabled: !this.rehearsal.session.canRetry() }, icon('video'), h('span', null, '看广告重打'));
    button.addEventListener('click', () => void this.commitRehearsal(button));
    return button;
  }

  private async commitRehearsal(button: HTMLElement) {
    const trial = this.rehearsal;
    if (!trial || !trial.session.canRetry() || button.hasAttribute('disabled') || this.player || (this.busy && !this.el.querySelector('.result-ov.r-trial'))) return;
    button.setAttribute('disabled', '');
    this.busy = true;
    const ok = await showRewardedAd(this.el, '重新挑战', '看完广告，使用调整后的阵容重新挑战这一战');
    if (this.disposed || this.rehearsal !== trial) return;
    const restored = ok ? trial.session.commitRetry() : null;
    if (!restored) { button.removeAttribute('disabled'); this.busy = false; return; }
    this.run = restored;
    this.rehearsal = null;
    this.el.classList.remove('rehearsal');
    this.el.querySelectorAll('.result-ov').forEach(el => el.remove());
    this.persist(restored);
    this.backToPrep(false);
    await this.startBattle();
  }

  /** 战后试打：调整副本，不计结果、不改存档 */
  private async startTrial() {
    if (this.teaching || !this.rehearsal || !this.editable) return;
    const session = this.rehearsal;
    this.busy = true;
    hideTip();
    sfx.start();
    const out = trialFight(this.run);
    await this.playOut(out);
    if (this.disposed || this.rehearsal !== session) return;
    await wait(300);
    if (this.disposed || this.rehearsal !== session) return;
    const title = out.result === 'win' ? '试打：胜' : out.result === 'lose' ? '试打：负' : '试打：平';
    const back = h('button', { class: 'btn primary' }, h('span', null, '回去调整'), icon('play'));
    const ov = h('div', { class: `result-ov r-trial r-${out.result}` },
      h('div', { class: 'res-card' }, h('div', { class: 'res-title' }, title), h('div', { class: 'res-sub' }, '不计胜负 · 正式开战有随机'),
        h('div', { class: 'res-btns' })));
    const leave = h('button', { class: 'btn primary rehearsal-back' }, h('span', null, '返回结算'));
    leave.addEventListener('click', () => { ov.remove(); this.leaveRehearsal(); });
    ov.querySelector('.res-btns')!.append(this.reviewButton(out, ov), leave, back);
    back.addEventListener('click', () => { sfx.click(); ov.remove(); this.backToPrep(false); });
    this.el.appendChild(ov);
  }

  private showResult(out: BattleOut, before: { lives: number; wins: number; turn: number; boss: string | null }, snap: RunState) {
    const r = this.run;
    const result = out.result;
    if (result === 'win') sfx.win(); else if (result === 'lose') sfx.lose(); else sfx.fizzle();
    const lost = before.lives - r.lives;
    const title = result === 'win' ? (before.boss ? 'Boss 击破' : '胜利') : result === 'lose' ? '失败' : '平局';
    const sub = result === 'win' ? (before.boss ? (r.phase === 'won' ? '通关！' : `进入第${'一二三'[r.act]}幕`) : this.where()) : result === 'lose' ? `失去 ${lost} 心` : '不扣心';
    const go = h('button', { class: 'btn primary' }, h('span', null, this.teaching && r.history.length >= 2 ? '完成' : '继续'), icon('play'));
    const ov = h('div', { class: `result-ov r-${result}` },
      h('div', { class: 'res-card' },
        h('div', { class: 'res-rays' }),
        h('div', { class: 'res-title' }, title),
        h('div', { class: 'res-sub' }, sub),
        h('div', { class: 'res-lives' }, Array.from({ length: maxLives(r) }, (_, i) => h('span', { class: `life${i < r.lives ? ' on' : i < before.lives ? ' lost' : ''}` }, icon('heart')))),
        h('div', { class: 'res-btns' }, go)));
    if (!this.teaching) {
      const adjust = h('button', { class: 'btn primary res-adjust' }, icon('replay'), h('span', null, '重打'));
      adjust.addEventListener('click', () => {
        hideTip(); ov.remove();
        this.rehearsal = { session: createRehearsal(r, snap, result), report: ov };
        this.run = this.rehearsal.session.working;
        this.el.classList.add('rehearsal');
        this.backToPrep(false);
      });
      ov.querySelector('.res-btns')!.prepend(adjust);
    }
    ov.querySelector('.res-btns')!.prepend(this.reviewButton(out, ov));
    if (!this.teaching && result === 'lose' && r.lastLoss > 0 && r.adSave < AD_SAVE_MAX) {
      const protect = h('button', { class: 'btn primary res-protect' }, icon('video'), h('span', null, '保心继续'));
      protect.addEventListener('click', async () => {
        if (protect.hasAttribute('disabled') || this.disposed) return;
        const buttons = [...ov.querySelectorAll<HTMLButtonElement>('button')];
        buttons.forEach(b => b.disabled = true);
        const ok = await showRewardedAd(this.el, '保心继续', '看完广告，保住本场生命并进入下一回合');
        if (this.disposed) return;
        if (!ok || !adSaveHeart(r)) { buttons.forEach(b => b.disabled = false); return; }
        this.persist(r);
        ov.remove();
        this.backToPrep(true);
      });
      ov.querySelector('.res-btns')!.insertBefore(protect, go);
    }
    this.el.appendChild(ov);
    this.tutorial?.result();
    if (!reduced()) ov.querySelector('.res-card')!.animate([{ transform: 'scale(.8)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,1.4,.4,1)' });
    if (result === 'win') this.fx.burst(640, 260, '#ffd36b', { n: 40, speed: 8 });
    go.addEventListener('click', () => {
      sfx.click();
      ov.remove();
      if (this.teaching && r.history.length >= 2) { this.tutorial?.complete(); return; }
      if (r.phase !== 'prep') { if (this.teaching) this.app.toTitle(); else this.app.endRun(r); return; }
      this.backToPrep(true);
    });
  }
}

const nodeIco = (k: NodeKind) => (k === 'camp' ? 'n_fire' : `n_${k}`);
const NODE_INFO: Record<NodeKind, { name: string; hint: string; tail?: string }> = {
  fight: { name: '战斗', hint: '普通对手', tail: '赢 · 下回合 +2 金' },
  elite: { name: '精英', hint: '带词缀的强敌', tail: '赢 · 装备箱　输 · −2 心' },
  camp: { name: '篝火', hint: '三选一：+2 份 / +4/+4 / +1 心' },
  shop: { name: '商人', hint: '额外卖装备、遗物碎片、高阶法术' },
  event: { name: '事件', hint: '奇遇或委托' },
  treasure: { name: '宝藏', hint: '下回合 +4 金' },
  boss: { name: 'Boss', hint: '', tail: '输 · −2 心，打赢才能过' },
};
