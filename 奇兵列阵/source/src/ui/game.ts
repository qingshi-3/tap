import { abilityText, ownedPower } from '../core/abilityText';
import '../tutorial-guide.css';
import '../prep-battle.css';
import '../shop-layout.css';
import '../v08.css';
import '../economy-bindings.css';
import { modernEconomy, previewPreparation } from '../core/preparation';
import { FACTION_INFO, unitDef } from '../core/data';
import { generalDefinition, EQUIP_MAP, ORDER_MAP, PASSIVE_MAP, POINT_MAP, POINT_TYPES, SPELL_MAP } from '../core/content';
import { chapter, type RouteNode, type Stage } from '../core/route';
import { SLOTS, fatigueStartForChapter, levelStats, previewAttackTarget, simulate } from '../core/engine';
import {
  allocPoint, applyRewardedReroll, battleNo, beginBattle, buildBattle, buy, canRewardedReroll, chooseReward, choosePromo, cloneRun, consumeRewardedRetry,
  allocRefundable, deallocPoint, equip, finishBattle, stashTotal, leaveShop, orderOptions, pickFork, promoted, refreshShop, screen, sell, canSell, sellBlockReason, shopUnitBuysRemaining, canTrainGeneral, sellPrice, unequip, unitDestination, type ShopKind, unuseSpell, useOrder, useSpell,
  MAX_COPIES, MAX_LIVES, MAX_REWARDED_REROLLS, remainingRewardedRerolls, allOwned, cloneOwned, currentNode, currentStage, getOwned, moveKind, moveSlot, placeKind, PICKS_PER_ROUND, reroll, tierCap,
  remainingRewardedRetries, settleRewardedRetry, takeDraft, takeUpgradeOffer, freezeUpgradeOffer, upgradeOfferBuyBlockReason, teamSize, freezeDraft, draftBuyBlockReason,
  modernTactics, setGeneralOrder, addSwap, clearSwaps, eggThreshold, hireMerc, reserveSlots, signMerc, swapCap, SIGN_PRICE,
  type RewardedRetrySettlement, type RunState, type Screen,
  shopSize,
} from '../core/run';
import { clearRun, saveRun } from '../core/save';
import { recordOfficialBattle, recordRunOutcome } from '../core/career';
import { syncCareerLeaderboards } from './leaderboard';
import { Tutorial, type TutAction, type TutEvent } from './tutorial';
import { unitBrowser } from './unitBrowser';
import { unitLevel, LEVEL_COPIES, type BattleOutput, type EggStat, type BattleResult, type Faction, type Side, type Slotted, type UnitState } from '../core/types';
import type { App } from './app';
import { setMusicRun, setMusicDucked, sfx } from './audio';
import { audioSettings } from './audioSettings';
import { type ArrowKind, Board, bodyPos, headPos, factionSigil, seatArt, statArt, SLOT_SPACING, slotX, statsOf, keywordsOf, UNIT_Y, UnitView } from './board';
import { draftCard, tierArt } from './card';
import { append, h, STAGE_H, STAGE_W, toStage, wait } from './dom';
import { markHint, seenHints } from './hints';
import { icon, type IconName } from './icons';
import { kwRich, kwTag, pxIcon } from './kwtext';
import { circled, type LogLine, Playback } from './playback';
import { generalTip, hideTip, isTipTarget, showTip, unitTip } from './tip';
import { unitSvg } from './unitArt';
import { itemIcon } from './pixelItems';

type Mode = 'prep' | 'battle' | 'result' | 'sandbox' | 'sandboxBattle' | 'rewardedAd' | 'phase';
type Sel = { kind: 'card'; idx: number } | { kind: 'unit'; slot: number } | { kind: 'point'; type: string } | { kind: 'equip'; idx: number };

const cloneSlots = (a: (Slotted | null)[]) => a.map(cloneOwned);

/** 一场战斗的冻结上下文：模拟与结算都只用这里的数据，不再回读可能已经变化的 run */
interface BattleCtx {
  kind: 'official' | 'sandbox' | 'retry';
  /** 战斗所在节点的状态（正式战为 run，复盘 / 重打为战前快照） */
  base: RunState;
  slots: (Slotted | null)[];
  bench: (Slotted | null)[];
  /** 开战前的完整状态快照（official / retry 才有） */
  checkpoint: RunState | null;
}

/** 最近一场正式战斗的记录：复盘的基准站位、战前快照与结果 */
interface FightCtx {
  slots: (Slotted | null)[];
  bench: (Slotted | null)[];
  checkpoint: RunState;
  result: BattleResult;
}

interface Preview {
  arrows: { from: number; to: number; kind: ArrowKind; label: string; hideSourceBadge?: boolean }[];
  badges: { uid: number; kind: ArrowKind; label: string }[];
  fizzles: Map<number, string>;
  summons: { side: Side; slot: number; text: string }[];
}

function analyze(out: BattleOutput): Preview {
  const p: Preview = { arrows: [], badges: [], fizzles: new Map(), summons: [] };
  let label = '';
  let general = false;
  for (const { ev, snap } of out.log) {
    if (ev.t === 'phase' && ev.name === 'battle') break;
    const add = (src: number | undefined, tgt: number, kind: ArrowKind) => {
      if (general) return;
      if (!src) p.badges.push({ uid: tgt, kind, label });
      else if (src === tgt) p.badges.push({ uid: tgt, kind, label });
      else p.arrows.push({ from: src, to: tgt, kind, label });
    };
    switch (ev.t) {
      case 'trigger':
        label = ev.order ? circled(ev.order) : '';
        general = !!ev.general;
        break;
      case 'buff':
        add(ev.src, ev.tgt, 'buff');
        break;
      case 'heal':
        add(ev.src, ev.tgt, 'buff');
        break;
      case 'block':
        add(ev.src, ev.uid, 'block');
        break;
      case 'chill':
        add(ev.src, ev.uid, 'chill');
        break;
      case 'burn':
        add(ev.src, ev.uid, 'burn');
        break;
      case 'dmg': {
        const s = ev.src ? snap[ev.src - 1] : null;
        const t = snap[ev.tgt - 1];
        add(ev.src, ev.tgt, s && s.side === t.side ? 'kill' : 'dmg');
        break;
      }
      case 'summon': {
        const u = snap[ev.uid - 1];
        p.summons.push({ side: u.side, slot: u.slot, text: `${label}召唤 ${u.atk}/${u.hp}` });
        break;
      }
      case 'fizzle':
        p.fizzles.set(ev.src, `${label ? label + ' ' : ''}落空：${ev.reason}`);
        break;
    }
  }
  // Match combat's local guard: the adjacent living friend in front first, then behind; no chained redirection.
  for (const side of [0, 1] as Side[]) {
    const st = out.afterStart.filter(u => u.alive && u.hp > 0 && !u.reserve && u.side === side).sort((x, y) => x.slot - y.slot);
    const taunt = (u?: UnitState) => !!u && !!(unitDef(u.defId).traits?.taunt || u.grants.taunt);
    st.forEach((u, i) => {
      const g = taunt(u) ? undefined : [st[i - 1], st[i + 1]].find(taunt);
      if (g) p.arrows.push({ from: g.uid, to: u.uid, kind: 'block', label: '护', hideSourceBadge: true });
    });
  }
  return p;
}

const KIND_TEXT: Record<RouteNode['kind'], string> = { normal: '', elite: '精英', boss: '首领' };
/** 培养点 / 成长的属性色（与托盘 pt-* 一致） */
const CUL_COLOR: Record<string, string> = { atk: '#ff6a33', hp: '#7dffb0', power: '#c590ff', block: '#8feaff' };
type Pt = { x: number; y: number };
type GrowthSnap = { units: Map<number, { defId: string; copies: number; g: Required<Pick<NonNullable<Slotted['growth']>, 'atk' | 'hp' | 'power'>> }>; uses: Record<string, number> };

export class Game {
  el: HTMLElement;
  private board = new Board();
  private hud: HTMLElement;
  private tray: HTMLElement;
  private bar: HTMLElement;
  private banner: HTMLElement;
  private overlay: HTMLElement | null = null;
  private popover: HTMLElement | null = null;
  private mode: Mode = 'prep';
  private sel: Sel | null = null;
  private drag: {
    kind: 'card' | 'unit'; idx: number; startX: number; startY: number; ghost: HTMLElement | null; src: HTMLElement; pid: number;
  } | null = null;
  /** 聚焦单位：点选 / 刚放下 / 桌面兼容的指针悬停 */
  private focus: { side: Side; slot: number } | null = null;
  private hover: { side: Side; slot: number } | null = null;
  /** 当前说明框是不是鼠标悬停带出来的（悬停结束才收起，点开的不动） */
  private hoverTip = false;
  private focusTimer = 0;
  private pv: { out: BattleOutput; pv: Preview } | null = null;
  private probeKey = '';
  private sandbox: { slots: (Slotted | null)[]; bench: (Slotted | null)[]; base: RunState } | null = null;
  /** 主界面的「整备」入口 */
  private dock = h('div', { class: 'prep-entry' });
  /** 蕾娃换位：是否进入点选模式、已选的第一个敌方格 */
  private commandArm = false;
  private swapArm = false;
  private swapPick: number | null = null;
  private hatchNoted = '';
  /** 整备弹层（盖住盘面，教学蒙层仍在它上面） */
  private prep: HTMLElement | null = null;
  private prepFocus: number | 'general' | null = null;
  /** 旧的操作提示，现已并入整备弹层 */
  private armHint = h('div', { class: 'arm-hint hidden' });
  private panel: HTMLElement | null = null;
  /** 商店里当前选中的商品（'units:0' 这类键），刷新/购买/离开后清空 */
  private shopSel: string | null = null;
  private benchEl = h('div', { class: 'bench', 'aria-label': '备战' });
  private pb: Playback | null = null;
  private disposed = false;
  private paused = document.hidden;
  private releaseDrag: (() => void) | null = null;
  /** 拖动己方单位时，招募栏变成出售区 */
  private sellZone: { el: HTMLElement; rect: { x: number; y: number; w: number; h: number } } | null = null;
  /** Returning previews remain owned until their animation finishes or the screen changes. */
  private returningGhosts = new Map<HTMLElement, Animation>();
  private onWindowKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !this.editable) return;
    this.clearDrag(); this.sel = null; hideTip(); this.renderBoard();
  };
  private onWindowBlur = () => {
    this.clearDrag();
    if (this.editable) { this.dropHints(); this.drawLinks(); }
  };
  private effectTimers = new Set<ReturnType<typeof setTimeout>>();

  setPaused(paused: boolean) {
    this.paused = paused; this.pb?.setPaused(paused);
    if (paused) this.onWindowBlur();
  }

  dispose() {
    this.disposed = true;
    setMusicRun(null);
    setMusicDucked(false);
    this.tut?.dispose();
    this.pb?.cancel();
    this.pb = null;
    clearTimeout(this.focusTimer);
    for (const timer of this.effectTimers) clearTimeout(timer);
    this.effectTimers.clear();
    window.removeEventListener('blur', this.onWindowBlur);
    window.removeEventListener('keydown', this.onWindowKeydown);
    this.clearDrag();
    this.adToken++;
    this.adPending = false;
    this.closePopover();
    hideTip();
    for (const animation of this.el.getAnimations({ subtree: true })) animation.cancel();
  }

  private later(callback: () => void, delay: number) {
    const timer = setTimeout(() => {
      this.effectTimers.delete(timer);
      if (!this.disposed && this.app.isCurrentGame(this)) callback();
    }, delay);
    this.effectTimers.add(timer);
  }
  /** 最近一场正式战斗（复盘 / 奖励重打的依据） */
  private fight: FightCtx | null = null;
  /** 激励广告进行中：锁住所有局内交互 */
  private adPending = false;
  private adToken = 0;
  private logEl!: HTMLElement;
  private speedBtn!: HTMLElement;
  private speed = [1, 2, 3].includes(Number(localStorage.getItem('zl_speed'))) ? Number(localStorage.getItem('zl_speed')) : 1;

  constructor(
    private app: App,
    private run: RunState,
    private tutorial = false,
  ) {
    this.hud = h('div', { class: 'hud' });
    this.tray = h('div', { class: 'tray' });
    this.bar = h('div', { class: 'battle-bar' });
    this.banner = h('div', { class: 'stage-banner' });
    this.el = h('div', { class: 'screen game' }, this.board.el, this.banner, this.dock, this.armHint, this.hud, this.tray, this.bar);
    this.bindBoard();
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('keydown', this.onWindowKeydown);
    const sc = screen(run);
    if (sc !== 'prep' && sc !== 'over') this.mode = 'phase';
    // 入场后约 350ms 才挂关卡告示：这段空档里也算「告示中」，免得教学蒙层先亮
    const introDue = sc === 'prep' ? performance.now() + 700 : 0;
    if (tutorial) this.tut = new Tutorial({
      el: this.el, run, mode: () => this.mode, finishTutorial: () => { this.app.toTitle(); this.app.askFeedback('tutorial'); },
      busy: () => performance.now() < introDue || !!this.el.querySelector('.stage-intro'),
      camera: (focus) => this.camera(focus),
      stageMap: (r) => this.stageMap(r),
    });
    this.renderAll(true);
    if (sc !== 'prep' && sc !== 'over') this.showPhase(sc);
  }

  // ───────────── 讲解运镜 ─────────────
  /** 盘面与特效层同步缩放平移（transform-origin 0 0），震屏仍作用在外层 world 上 */
  private camShot = { x: STAGE_W / 2, y: 0, z: 1 };
  private camTargets() { return [this.board.el, this.app.fx.canvas, this.app.fx.layer]; }
  private camMatrix() { return new DOMMatrix(getComputedStyle(this.board.el).transform === 'none' ? undefined : getComputedStyle(this.board.el).transform); }
  /** 盘面固定坐标 → 当前画面坐标 */
  private stageMap(r: { x: number; y: number; w: number; h: number }) {
    const m = this.camMatrix();
    if (m.isIdentity) return r;
    const a = m.transformPoint(new DOMPoint(r.x, r.y)), b = m.transformPoint(new DOMPoint(r.x + r.w, r.y + r.h));
    return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
  }
  /** 推近框住 focus（当前画面坐标），null 拉回全景 */
  camera(focus: { x: number; y: number; w: number; h: number } | null) {
    const H = STAGE_H, from = this.camMatrix();
    let to = 'none', z = 1;
    if (focus) {
      // 先换回盘面坐标，再按目标大小定倍数：单个单位约 1.45 倍，多个目标适度拉远
      const inv = from.inverse();
      const a = inv.transformPoint(new DOMPoint(focus.x, focus.y)), b = inv.transformPoint(new DOMPoint(focus.x + focus.w, focus.y + focus.h));
      const w = Math.max(80, b.x - a.x), hh = Math.max(80, b.y - a.y);
      z = Math.max(1, Math.min(1.45, (STAGE_W * 0.62) / w, (H * 0.5) / hh));
      if (z > 1.02) {
        const vw = STAGE_W / z, vh = H / z;
        const cx = Math.max(vw / 2, Math.min(STAGE_W - vw / 2, (a.x + b.x) / 2));
        const cy = Math.max(vh / 2, Math.min(H - vh / 2, (a.y + b.y) / 2 + 30));
        to = `translate(${STAGE_W / 2 - cx * z}px,${H / 2 - cy * z}px) scale(${z})`;
      }
    }
    this.camShot.z = z;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const el of this.camTargets()) {
      el.style.transformOrigin = '0 0';
      el.style.transform = to === 'none' ? '' : to;
      if (!reduced) el.animate([{ transform: from.toString() }, { transform: to === 'none' ? 'matrix(1,0,0,1,0,0)' : to }], { duration: focus ? 380 : 480, easing: 'cubic-bezier(.3,.7,.2,1)' });
    }
    this.el.classList.toggle('cam-on', to !== 'none');
  }

  // ───────────── 数据 ─────────────

  private get slots() {
    return this.sandbox ? this.sandbox.slots : this.run.slots;
  }
  private get base() {
    return this.sandbox?.base ?? this.run;
  }
  private get node() {
    return currentNode(this.base);
  }
  private get inventory(): RunState {
    return this.sandbox ? { ...this.sandbox.base, slots: this.sandbox.slots, bench: this.sandbox.bench } : this.run;
  }
  private owned(index: number) { return getOwned(this.inventory, index); }
  private setup(record = true) {
    return { ...buildBattle(this.base, this.slots, this.inventory.bench), record };
  }
  private save() {
    if (!this.sandbox) this.persist();
    this.growthCheck();
  }
  /** 教学局不落存档，不覆盖正式远征 */
  private storageWarningShown = false;
  private persist() {
    if (this.tutorial) return;
    if (saveRun(this.run)) this.storageWarningShown = false;
    else if (!this.storageWarningShown) {
      this.storageWarningShown = true;
      this.app.showRewardNotice('进度尚未保存', '本地存储暂不可用，请勿关闭游戏。', 'error');
    }
  }
  private tut: Tutorial | null = null;
  /** 教学约束在实际提交操作时检查；拖动松手不能绕过蒙层的起点限制。 */
  private allowTutorial(action: TutAction) { return !this.tut || this.tut.allows(action); }
  private emit(ev: TutEvent) {
    this.tut?.notify(ev);
  }
  private end() {
    if (this.tutorial) this.app.toTitle();
    else this.app.toEnd(this.run);
  }
  private get editable() {
    return !this.disposed && (this.mode === 'prep' || this.mode === 'sandbox');
  }

  // ───────────── 渲染 ─────────────

  private syncMusicState() {
    if (this.disposed) return;
    setMusicRun(`${this.tutorial ? 'tutorial' : 'run'}:${this.run.seed}:${this.run.general}`, this.run.chapter);
    setMusicDucked(!!this.prep || !!this.panel?.classList.contains('ph-shop'));
  }

  renderAll(intro = false) {
    // A full render replaces gesture sources; no preview may outlive that inventory view.
    this.clearDrag();
    this.tut?.fixDraft(this.run);
    this.growthSnap ??= this.takeGrowth();
    this.renderHud();
    this.renderBanner();
    this.renderTray();
    this.renderBoard(intro);
    this.renderBench();
    this.syncMusicState();
    if (!intro) requestAnimationFrame(() => this.coach());
  }

  private renderHud() {
    const g = generalDefinition(this.run.general, this.run.tacticsVersion);
    const f = FACTION_INFO[g.faction];
    const ch = chapter(this.run.chapter);
    const genBadge = h(
      'div',
      { class: `hud-general${this.sel?.kind === 'point' && POINT_MAP[this.sel.type]?.toGeneral && canTrainGeneral(this.run) ? ' arm-target' : ''}`, style: `--fc:${f.color}` },
      h('div', { class: 'hg-portrait', html: unitSvg(null, { general: g.id, tier2: promoted(this.run) }) }),
      h('div', { class: 'hg-text' }, h('b', null, g.name), h('span', null, g.title)),
    );
    const showGenTip = () => {
      const r = genBadge.getBoundingClientRect();
      const p = toStage(r.left + r.width / 2, r.bottom);
      showTip(generalTip(g.id, this.base.genPower, this.base.passives, this.base.tacticsVersion), p.x + 40, p.y, 'below');
    };
    // 手机优先：点头像看技能；鼠标悬停只是桌面上的附加便利
    genBadge.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showGenTip(); });
    genBadge.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.restoreTip(); });
    genBadge.addEventListener('click', () => {
      const s = this.sel;
      if (s?.kind !== 'point' || !POINT_MAP[s.type]?.toGeneral || !canTrainGeneral(this.run) || !this.editable || this.sandbox) { showGenTip(); return; }
      if (!this.allowTutorial({ kind: 'alloc', to: 'general', type: s.type })) return;
      const from = this.chipPos(s.type);
      if (allocPoint(this.run, 'general', s.type)) {
        sfx.merge();
        if (!(this.run.stash[s.type] > 0)) this.sel = null;
        this.save(); this.renderAll(); this.allocFx(s.type, from, 'general'); this.emit('alloc');
      } else sfx.fizzle();
    });
    const lives = h(
      'div',
      { class: 'hud-lives' },
      Array.from({ length: MAX_LIVES }, (_, i) => h('span', { class: `life${i < this.run.lives ? ' on' : ''}` }, icon('heart'))),
    );
    const route = h(
      'div',
      { class: 'route' },
      h('div', { class: 'route-line' }, h('div', { class: 'route-fill', style: `width:${(this.run.node / (ch.stages.length - 1)) * 100}%` })),
      ch.stages.map((st, i) => {
        const cur = i === this.run.node;
        const done = i < this.run.node;
        const kind = st.type === 'boss' ? 'boss' : st.type === 'fork' ? 'elite' : st.type === 'shop' ? 'shop' : 'normal';
        const node = h(
          'button',
          { class: `rnode k-${kind}${cur ? ' cur' : ''}${done ? ' done r-win' : ''}`, title: '' },
          st.type === 'boss' ? icon('crown') : st.type === 'fork' ? icon('skull') : st.type === 'shop' ? icon('diamond') : h('b', null, i + 1),
          done ? h('span', { class: 'rn-ok' }, icon('check')) : null,
        );
        node.addEventListener('click', (e) => {
          e.stopPropagation();
          sfx.click();
          this.showRoutePreview(i, node);
        });
        return node;
      }),
    );
    const helpBtn = h('button', { class: 'icon-btn', 'aria-label': '玩法' }, icon('book'));
    helpBtn.addEventListener('click', () => {
      sfx.click();
      this.app.showHowTo();
    });
    // 手机上顶栏小图标挨得近，返回 / 放弃这类重操作收进菜单，避免误触
    const menuBtn = h('button', { class: 'icon-btn', 'aria-label': '菜单' }, icon('menu'));
    menuBtn.addEventListener('click', () => {
      sfx.click();
      this.showMenu();
    });
    this.hud.replaceChildren(
      h('div', { class: 'hud-left' }, genBadge, lives),
      route,
      h(
        'div',
        { class: 'hud-right' },
        h('div', { class: 'hud-wins hud-chapter' }, h('span', null, ch.name), h('b', null, `${this.run.chapter + 1}/3`)),
        h('div', { class: 'hud-wins hud-gold' }, h('span', null, '金币'), h('b', null, this.run.gold)),
        h('button', { class: 'icon-btn pool-open', 'aria-label': '本局卡池', onclick: () => this.showPool() }, icon('diamond')),
        helpBtn,
        menuBtn,
      ),
    );
  }

  private showMenu() {
    const busy = this.mode === 'battle' || this.mode === 'sandboxBattle' || this.mode === 'rewardedAd';
    const home = h('button', { class: `btn ghost${busy ? ' disabled' : ''}`, disabled: busy }, icon('menu'), h('span', null, busy ? '战斗中无法返回' : '保存并返回标题'));
    const fb = h('button', { class: 'btn ghost' }, h('span', null, '反馈'));
    fb.addEventListener('click', () => { sfx.click(); close(); this.app.showFeedback(); });
    const quit = h('button', { class: 'btn danger' }, icon('flag'), h('span', null, '放弃远征'));
    const close = this.app.modal(h('div', { class: 'confirm game-menu', 'aria-label': '菜单' }, h('h3', null, '菜单'), audioSettings(), h('div', { class: 'menu-btns' }, home, fb, quit)), 'audio-dialog', document.body);
    home.addEventListener('click', () => {
      if (this.mode === 'battle' || this.mode === 'sandboxBattle' || this.mode === 'rewardedAd') return;
      close(); sfx.click(); this.save(); this.app.toTitle();
    });
    quit.addEventListener('click', () => {
      close(); sfx.click();
      this.app.confirm('放弃本次远征？', '放弃将计为远征失败，并结束当前连胜。', '放弃', () => {
        if (!this.tutorial) {
          const profile = recordRunOutcome(this.run, this.run.over ?? 'abandon');
          if (profile.storageStatus !== 'ok' || !clearRun()) {
            this.app.showRewardNotice('战绩尚未保存', '本局存档已保留，请检查本地存储后重试。', 'error');
            return;
          }
          void syncCareerLeaderboards();
        }
        this.app.toTitle();
      });
    });
  }

  private renderBanner() {
    const n = this.node;
    this.banner.className = `stage-banner k-${n.kind}`;
    this.banner.replaceChildren();
    append(
      this.banner,
      h(
        'div',
        { class: 'sb-title' },
        KIND_TEXT[n.kind] ? h('span', { class: 'sb-kind' }, KIND_TEXT[n.kind]) : null,
        h('span', { class: 'sb-no' }, `${chapter(this.base.chapter).name} · 第 ${battleNo(this.base) + 1} 战`),
        h('b', null, n.name),
      ),
      n.hint ? h('div', { class: 'sb-hint' }, icon('bolt'), h('span', null, ...kwRich(n.hint))) : null,
      this.sandbox && (this.mode === 'sandbox' || this.mode === 'sandboxBattle')
        ? h('div', { class: 'sb-sandbox' }, icon('replay'), '复盘模式 · 不影响远征')
        : null,
    );
  }

  /** Negative indices address upgrade choices without colliding with ordinary shelf slots. */
  private draftItem(r: RunState, index: number) {
    if (!Number.isSafeInteger(index)) return undefined;
    if (index >= 0) return r.draft[index] ? { id: r.draft[index], locked: !!r.draftLocked?.[index], groupId: undefined, choiceIdx: undefined } : undefined;
    const encoded = -1 - index, groupId = Math.floor(encoded / 2), choiceIdx = encoded % 2;
    const group = r.upgradeOffers?.find(g => g.id === groupId);
    return group?.choices[choiceIdx] ? { id: group.choices[choiceIdx], locked: group.locked, groupId, choiceIdx } : undefined;
  }
  private takeShelf(r: RunState, index: number, slot: number, confirmed = false) {
    const item = this.draftItem(r, index);
    if (!item) return 'invalid' as const;
    return item.groupId === undefined ? takeDraft(r, index, slot, confirmed) : takeUpgradeOffer(r, item.groupId, item.choiceIdx!, slot, confirmed);
  }
  private shelfBuyReason(r: RunState, index: number, slot: number) {
    const item = this.draftItem(r, index);
    if (!item) return '商品不可购买';
    return item.groupId === undefined ? draftBuyBlockReason(r, index, slot) : upgradeOfferBuyBlockReason(r, item.groupId, item.choiceIdx!, slot);
  }
  private renderTray() {
    this.renderDock();
    if (this.mode === 'phase') { this.tray.classList.add('hidden'); return; }
    if (this.mode === 'sandbox') return this.renderSandboxTray();
    const r = this.run;
    const paid = modernEconomy(r);
    const groups = paid ? r.upgradeOffers ?? [] : [];
    this.tray.classList.toggle('paid-shelf', paid);
    const picks = h(
      'div',
      { class: 'picks' },
      Array.from({ length: this.tut ? Math.max(PICKS_PER_ROUND, r.picks) : PICKS_PER_ROUND }, (_, i) => h('span', { class: `pick${i < r.picks ? ' on' : ''}` })),
    );
    let rerollBtn: HTMLElement;
    if (canRewardedReroll(r)) {
      rerollBtn = this.buildRewardedRerollBtn();
    } else {
      rerollBtn = h(
        'button',
        { class: `btn ghost reroll`, disabled: paid ? r.gold < 1 || r.draft.every((id, i) => !!id && r.draftLocked?.[i]) : r.rerolls <= 0 || r.picks <= 0 },
        icon('refresh'),
        h('span', null, '刷新'),
        h('i', null, paid ? '1 金' : r.rerolls),
      );
      rerollBtn.addEventListener('click', () => {
        if (this.adPending || !this.editable || this.sandbox || !this.allowTutorial({ kind: 'reroll' }) || !reroll(this.run)) return;
        this.sel = null; hideTip(); sfx.swap(); this.save(); this.renderAll(); this.cardsIn();
        this.emit('reroll');
      });
    }
    const left = h(
      'div',
      { class: 'tray-left' },
      paid ? h('div', { class: 'tl-row', 'aria-label': `可用金币 ${r.gold}` }, `${r.gold} 金 · 每张 3 金`) : h('div', { class: 'tl-title' }, '招募'),
      paid ? null : h('div', { class: 'tl-row' }, h('span', null, '本轮可选'), picks),
      rerollBtn,
      paid ? this.benchEl : null,
    );
    const goods = [
      ...r.draft.slice(0, paid ? shopSize(r) : r.draft.length).map((id, index) => ({ id, index, bonus: false })),
      ...groups.map(g => ({ id: g.choices[0], index: -1 - g.id * 2, bonus: true })),
    ];
    const cards = h('div', { class: `cards${!paid && r.picks <= 0 ? ' exhausted' : ''}`, 'data-count': goods.length });
    goods.forEach(({ id, index: i, bonus }) => {
      const item = this.draftItem(r, i);
      if (!id) { cards.appendChild(h('div', { class: 'shelf-empty' }, '已购买')); return; }
      const same = allOwned(this.inventory).filter((s): s is Slotted => !!s && s.defId === id && !s.temp);
      const target = same.filter(s => s.copies < MAX_COPIES).sort((x, y) => y.copies - x.copies)[0];
      const next = target ? target.copies + 1 : 0;
      const goal = next <= LEVEL_COPIES[0] ? LEVEL_COPIES[0] : LEVEL_COPIES[1];
      const c = draftCard(id, {
        mergeTo: target && next === goal ? unitLevel(target) + 1 : undefined,
        stack: target && next !== goal ? `叠加 ${next}/${goal}` : undefined,
        maxed: !target && same.length > 0,
      });
      c.dataset.draftIndex = String(i);
      if (bonus) { c.classList.add('bonus-card'); c.append(h('span', { class: 'bonus-tag' }, icon('star'), '升星奖励')); }
      if (paid && item?.locked) c.append(h('span', { class: 'card-badge' }, '已锁定'));
      if (paid && r.gold < 3) c.classList.add('unaffordable');
      if (this.sel?.kind === 'card' && this.sel.idx === i) c.classList.add('selected');
      c.setAttribute('tabindex', paid || r.picks > 0 ? '0' : '-1');
      c.setAttribute('role', 'button');
      c.setAttribute('aria-label', `${unitDef(id).name}，招募`);
      c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.tap('card', i, { x: 0, y: 0 }); } });
      c.setAttribute('aria-label', `${unitDef(id).name}，${paid ? `3 金${item?.locked ? '，已锁定' : ''}${bonus ? '，升星奖励' : ''}，` : ''}拖到位置招募`);
      c.addEventListener('pointerdown', (e) => this.dragStart(e, 'card', i, c));
      c.addEventListener('pointerenter', () => {
        if (this.drag) return;
        sfx.hover();
      });
      cards.appendChild(c);
    });
    if (!paid && r.picks <= 0) cards.appendChild(h('div', { class: 'cards-done' }, icon('check'), '招募完成'));
    const size = teamSize(r);
    const fight = h('button', { class: `btn primary fight${size ? '' : ' disabled'}`, disabled: !size }, h('span', null, '开 战'), icon('play'));
    fight.addEventListener('click', () => {
      if (!size) return;
      if (!paid && r.picks > 0 && r.draft.length && !this.tut) this.app.confirm('还有招募没用完', `本轮还能招募 ${r.picks} 次，开战后作废。`, '直接开战', () => { if (this.editable) void this.startBattle(); });
      else void this.startBattle();
    });
    const right = h(
      'div',
      { class: 'tray-right' },
      paid ? null : this.benchEl,
      h('div', { class: 'fight-controls' }, h('div', { class: 'tr-team' }, `${size}/${SLOTS}`), fight),
    );
    this.tray.replaceChildren(left, cards, right);
    this.tray.classList.remove('hidden');
    this.renderBench();
  }

  private renderSandboxTray() {
    const tryBtn = h('button', { class: 'btn primary fight', disabled: !this.slots.some(Boolean) }, h('span', null, '试 打'), icon('play'));
    tryBtn.addEventListener('click', () => this.startBattle());
    const back = h('button', { class: 'btn ghost' }, icon('x'), h('span', null, '结束复盘'));
    back.addEventListener('click', () => this.exitSandbox());
    const reset = h('button', { class: 'btn ghost' }, icon('refresh'), h('span', null, '还原站位'));
    reset.addEventListener('click', () => {
      if (!this.sandbox || !this.fight) return;
      this.sandbox.slots = cloneSlots(this.fight.checkpoint.slots);
      this.sandbox.bench = cloneSlots(this.fight.checkpoint.bench);
      this.sel = null; hideTip();
      sfx.swap();
      this.renderAll();
    });
    const canRetry = this.canRewardedRetry();
    const retryBtn = canRetry
      ? h('button', { class: 'btn primary ad-retry', disabled: !this.slots.some(Boolean) }, icon('play'), h('span', null, '看广告重打'))
      : null;
    retryBtn?.addEventListener('click', () => void this.requestRewardedRetry(retryBtn));
    // 备战席与备战界面一致放右下，试打占开战键的位置
    this.tray.replaceChildren(
      h(
        'div',
        { class: 'sandbox-panel' },
        h(
          'div',
          { class: 'sp-text' },
          '调整上阵与备战，试打不影响远征。',
          canRetry ? h('br') : null,
          canRetry ? `广告重打胜利可挽回生命，本局剩余 ${remainingRewardedRetries(this.run)} 次。` : null,
        ),
        h('div', { class: 'sp-btns' }, reset, back, retryBtn),
      ),
      this.benchEl,
      h('div', { class: 'sb-fight' }, tryBtn),
    );
    this.tray.classList.remove('hidden');
  }

  private renderBench() {
    this.benchEl.classList.toggle('hidden', !this.inventory.bench.length);
    this.benchEl.replaceChildren(...this.inventory.bench.map((_, k) => 5 + k).map(index => {
      const u = this.owned(index);
      const base = u ? levelStats(u.defId, unitLevel(u)) : null;
      const atk = base ? statArt('atk', base.atk) : null;
      const reserve = index - 5 < reserveSlots(this.base);
      const button = h('button', { class: `bench-slot${this.sel?.kind === 'unit' && this.sel.slot === index ? ' selected' : ''}${reserve ? ' reserve' : ''}${u?.temp ? ' temp' : ''}`, 'data-index': index, 'aria-label': `备战${index - 4}${u ? ' ' + unitDef(u.defId).name : ' 空位'}` },
        h('span', { class: 'bench-seat' }, seatArt()),
        u ? h('span', { class: 'bench-art', html: unitSvg(u.defId) }) : null,
        base && u ? h('div', { class: 'u-stats bench-stats' }, atk, factionSigil(unitDef(u.defId).faction), statArt('hp', base.hp)) : null,
        h('span', { class: 'bench-label' }, u?.temp ? '佣兵' : u ? '★'.repeat(unitLevel(u)) : reserve ? '预备' : `备战${index - 4}`));
      button.addEventListener('pointerdown', e => {
        if (!this.editable) return;
        if (this.drag) { e.preventDefault(); e.stopPropagation(); return; }
        e.stopPropagation();
        if (u) this.dragStart(e, 'unit', index, button);
        else if (this.sel?.kind === 'unit') { e.preventDefault(); this.doMove(this.sel.slot, index); }
      });
      button.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault(); if (!this.editable) return;
        if (u) this.tap('unit', index, { x: 0, y: 0 });
        else if (this.sel?.kind === 'unit') this.doMove(this.sel.slot, index);
      });
      return button;
    }));
    this.dropHints();
  }

  private showOwnedTip(index: number) {
    const u = this.owned(index); if (!u) return;
    if (index < 5) this.showUnitTip(0, index);
    else {
      const content = unitTip(u.defId, unitLevel(u), { ...this.ownedStats(u), chill: 0, burn: 0, power: ownedPower(u.defId, unitLevel(u), u) });
      const extra = this.ownedExtra(u, index); if (extra) content.appendChild(extra);
      const blocked = sellBlockReason(this.run, index);
      if (blocked) content.append(h('div', { class: 'tip-text' }, blocked));
      const r = this.benchEl.querySelector<HTMLElement>(`[data-index="${index}"]`)!.getBoundingClientRect();
      const p = toStage(r.left + r.width / 2, r.top);
      showTip(content, p.x, p.y, 'above');
    }
  }

  private showPool() {
    hideTip();
    const factions = [...this.run.activeFactions, 'neutral'] as Faction[];
    const cap = tierCap(battleNo(this.run));
    this.app.modal(h('div', { class: 'content-dialog pool-dialog' }, unitBrowser({
      factions, state: { fac: factions[0], star: 1, sel: null },
      lockNote: d => (d.tier > cap ? `第${[0, 1, 3, 6, 9, 12, 15][d.tier]}战开放` : null),
    })), 'wide');
  }

  private cardsIn() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.tray.querySelectorAll('.card').forEach((c, i) =>
      c.animate(
        [
          { transform: 'translateY(60px) rotate(4deg)', opacity: 0 },
          { transform: 'translateY(0) rotate(0)', opacity: 1 },
        ],
        { duration: 380, delay: i * 70, easing: 'cubic-bezier(.2,.9,.3,1.15)', fill: 'backwards' },
      ),
    );
  }

  /** 备战盘面：开战前站位 + 开战阶段之后的数值预览 */
  private renderBoard(intro = false) {
    const b = this.board;
    const out = simulate(this.setup(true));
    const pv = analyze(out);
    const keep = new Map(b.views);
    b.views.clear();
    const fresh: UnitView[] = [];
    for (const u of out.initial) {
      const key = `p${u.side}-${u.slot}`;
      let v = keep.get(key);
      if (v && v.defId === u.defId && v.level === u.level) keep.delete(key);
      else {
        v = new UnitView(u.defId, u.side, u.slot, u.level);
        fresh.push(v);
      }
      b.views.set(key, v);
      if (!v.el.isConnected) b.units.appendChild(v.el);
      const after = out.afterStart[u.uid - 1];
      v.setStats(statsOf(after), { base: { atk: u.atk, hp: u.hp } });
      v.el.classList.toggle('doomed', !after.alive);
      v.el.classList.toggle('selected', this.sel?.kind === 'unit' && u.side === 0 && this.sel.slot === u.slot);
      v.el.classList.toggle('cmd-ok', this.commandArm && u.side === 0);
      v.el.setAttribute('tabindex', '0');
      v.el.setAttribute('role', 'button');
      v.el.setAttribute('aria-label', `${u.side ? '敌方' : '我方'}${u.slot + 1}格 ${unitDef(u.defId).name}`);
      v.el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (this.editable && !u.side) this.tap('unit', u.slot, { x: 0, y: 0 }); else this.showUnitTip(u.side, u.slot); } };
      v.setTag(null);
      const own = u.side === 0 ? this.owned(u.slot) : null;
      v.setExp(own && !own.temp && modernEconomy(this.run) ? own.copies : null);
      if (u.side === 0 && modernTactics(this.run) && this.run.commandTarget === this.owned(u.slot)?.ownedId) v.addTag(generalDefinition(this.run.general, 1).skill, 'buff');
      if (!after.alive) v.addTag('开战时阵亡', 'death');
      const fz = pv.fizzles.get(u.uid);
      if (fz) v.addTag(fz, 'fizzle');
    }
    for (const v of keep.values()) v.el.remove();
    fresh.forEach((v, i) => v.appear(intro ? 80 * i : 0));
    this.el.classList.toggle('command-arm', this.commandArm);

    // 箭头、徽记：默认只挂序号牌，点选 / 拖拽时才画出相关连线
    b.clearMarks();
    this.pv = { out, pv };
    this.drawLinks(intro);
    for (const s of pv.summons) b.slotMark(s.side, s.slot, h('span', null, s.text), 'summon');


    b.setCenter('VS', '', '');
    this.dropHints();
    this.renderBench();
  }

  /**
   * 连线层。无焦点：每个来源单位头顶挂「序号牌」（颜色 = 效果类型），结果看目标身上的数值差。
   * 有焦点：只画与焦点单位相关的箭头（发出 + 指向它），其余单位压暗；箭头按跨度分车道避免交叠。
   */
  private drawLinks(intro = false, src = this.pv, f: { side: Side; slot: number } | null = this.focus ?? this.hover) {
    const b = this.board;
    b.clearArrows();
    if (!src) return;
    const { out, pv } = src;
    const pos = (uid: number) => {
      const u = out.initial[uid - 1];
      return u ? headPos(u.side, u.slot) : null;
    };
    const fu = f ? out.initial.find((u) => u.side === f.side && u.slot === f.slot)?.uid ?? -1 : 0;
    b.marks.querySelectorAll('.target-glow').forEach(mark => mark.remove());
    const alive = (side: Side) => out.afterStart.filter(u => u.alive && u.hp > 0 && u.side === side).sort((a, z) => a.slot - z.slot);
    const attackers = f ? out.afterStart.filter(u => u.uid === fu && u.alive) : [alive(0)[0], alive(1)[0]].filter(Boolean);
    const linked = new Set<number>();
    for (const a of attackers) {
      const d = unitDef(a.defId);
      if (d.traits?.idle || (!f && d.cast && a.charges !== 0)) continue;
      const target = previewAttackTarget(a, alive((1 - a.side) as Side));
      if (!target) continue;
      const initial = out.initial[target.uid - 1];
      if (initial) b.target(initial.side, initial.slot, a.side ? 'enemy-aim' : 'ally-aim');
      if (f) linked.add(target.uid);
    }
    const arrows = f ? pv.arrows.filter((a) => a.from === fu || a.to === fu) : [];
    arrows.forEach((a) => linked.add(a.from).add(a.to));
    // 车道：区间相交就往上抬一层（短的先排，贴近单位）
    const spans = arrows
      .map((a, i) => ({ a, i, f: pos(a.from), t: pos(a.to) }))
      .filter((x) => x.f && x.t)
      .sort((x, y) => Math.abs(x.t!.x - x.f!.x) - Math.abs(y.t!.x - y.f!.x));
    const lanes: { lo: number; hi: number; lane: number }[] = [];
    spans.forEach(({ a, f: p0, t: p1 }, k) => {
      const lo = Math.min(p0!.x, p1!.x) - 20;
      const hi = Math.max(p0!.x, p1!.x) + 20;
      let lane = 0;
      while (lanes.some((l) => l.lane === lane && l.lo < hi && lo < l.hi)) lane++;
      lanes.push({ lo, hi, lane });
      const dist = Math.abs(p1!.x - p0!.x);
      b.arrow({ x: p0!.x, y: p0!.y + 4 }, { x: p1!.x, y: p1!.y + 4 }, a.kind, {
        label: a.label,
        lift: 40 + dist * 0.14 + lane * 30,
        labelDx: lane === 0 ? 0 : (lane % 2 ? 1 : -1) * 28 * Math.ceil(lane / 2),
        delay: k * 70,
      });
    });
    // 序号牌：无焦点时全部显示；有焦点时只显示相关单位的
    const chips = new Map<number, { label: string; kind: ArrowKind }[]>();
    const chip = (uid: number, label: string, kind: ArrowKind) => {
      if (f && uid !== fu && !linked.has(uid)) return;
      const l = chips.get(uid) ?? [];
      if (!l.some((c) => c.label === label && c.kind === kind)) l.push({ label, kind });
      chips.set(uid, l);
    };
    // 聚焦时序号已经写在弧线上，来源不再重复挂牌
    if (!f) for (const a of pv.arrows) if (!a.hideSourceBadge) chip(a.from, a.label || '•', a.kind);
    for (const bd of pv.badges) chip(bd.uid, bd.label || '•', bd.kind);
    let n = 0;
    for (const [uid, l] of chips) {
      const p = pos(uid);
      if (!p) continue;
      l.slice(0, 3).forEach((c, i) => b.orderBadge(p.x + 32, p.y - 16 - i * 22, c.label, c.kind, intro ? n++ * 60 : 0));
    }
    b.el.classList.toggle('focusing', !!f && fu > 0);
    for (const v of b.views.values()) {
      const u = out.initial.find((x) => x.side === v.side && x.slot === v.slot);
      const isF = !!f && v.side === f.side && v.slot === f.slot;
      v.el.classList.toggle('focus', isF);
      v.el.classList.toggle('linked', !isF && !!u && linked.has(u.uid));
    }
  }

  private setFocus(f: { side: Side; slot: number } | null, o: { auto?: boolean } = {}) {
    clearTimeout(this.focusTimer);
    this.focus = f;
    this.drawLinks();
    // 放下 / 移动后的自动聚焦：停留一会儿再回到总览
    if (f && o.auto)
      this.focusTimer = window.setTimeout(() => {
        if (this.focus === f && !this.sel && !this.drag) this.setFocus(null);
      }, 2400);
  }

  /** 只登记焦点（随后的 renderBoard 负责绘制） */
  private armFocus(slot: number) {
    this.focus = { side: 0, slot };
    clearTimeout(this.focusTimer);
    const f = this.focus;
    this.focusTimer = window.setTimeout(() => {
      if (this.focus === f && !this.sel && !this.drag) this.setFocus(null);
    }, 2400);
  }

  private setHover(f: { side: Side; slot: number } | null) {
    const same = (a: typeof f, b: typeof f) => a?.side === b?.side && a?.slot === b?.slot;
    if (same(f, this.hover)) return;
    this.hover = f;
    if (!this.focus) this.drawLinks();
  }

  /** 拖拽试探：假设放到 slot，只画被拖单位在那里会连上谁 */
  private probe(slot: number | null) {
    const d = this.drag;
    const key = slot == null || !d ? '' : `${d.kind}${d.idx}>${slot}`;
    if (key === this.probeKey) return;
    this.probeKey = key;
    if (!key || !d || slot == null) return this.drawLinks(false, this.pv, null);
    if (slot >= 5) return this.drawLinks(false, this.pv, null);
    const trial = cloneRun(this.inventory);
    if (d.kind === 'card') {
      if (this.takeShelf(trial, d.idx, slot) === 'invalid') return this.drawLinks(false, this.pv, null);
    } else if (moveSlot(trial, d.idx, slot, this.sandbox ? 'swap' : 'auto') === 'invalid') return this.drawLinks(false, this.pv, null);
    const out = simulate({ ...this.setup(true), player: cloneSlots(trial.slots) });
    this.drawLinks(false, { out, pv: analyze(out) }, { side: 0, slot });
  }

  // ───────────── 拖放与点选 ─────────────

  private slotAt(x: number, y: number): number | null {
    const client = this.el.getBoundingClientRect();
    const bench = this.benchEl.getBoundingClientRect();
    const scale = client.width / 1280;
    if (x * scale + client.left >= bench.left && x * scale + client.left <= bench.right && y * scale + client.top >= bench.top && y * scale + client.top <= bench.bottom) {
      const buttons = this.benchEl.querySelectorAll<HTMLElement>('.bench-slot');
      for (let i = 0; i < buttons.length; i++) { const b = buttons[i].getBoundingClientRect(); if (x * scale + client.left >= b.left && x * scale + client.left <= b.right) return i + 5; }
    }
    if (y < UNIT_Y - 110 || y > UNIT_Y + 90) return null;
    for (let s = 0; s < SLOTS; s++) if (Math.abs(x - slotX(0, s)) < SLOT_SPACING / 2) return s;
    return null;
  }
  private enemySlotAt(x: number, y: number): number | null {
    if (y < UNIT_Y - 110 || y > UNIT_Y + 90) return null;
    for (let s = 0; s < SLOTS; s++) if (Math.abs(x - slotX(1, s)) < SLOT_SPACING / 2) return s;
    return null;
  }

  private dropKind(slot: number): string {
    const d = this.drag ?? (this.sel?.kind === 'unit' ? { kind: 'unit', idx: this.sel.slot } : null);
    if (!d) return '';
    if (d.kind === 'card') {
      const item = this.draftItem(this.run, d.idx);
      if (!item || (d.idx >= 0 && this.run.picks <= 0) || (modernEconomy(this.run) && this.shelfBuyReason(this.run, d.idx, slot))) return 'invalid';
      return placeKind(this.run, item.id, slot);
    }
    if (d.idx === slot || (!this.drag && this.owned(slot))) return '';
    return moveKind(this.inventory, d.idx, slot, this.sandbox ? 'swap' : 'auto');
  }

  private dropHints(hover: number | null = null) {
    const active = !!this.drag?.ghost || this.sel?.kind === 'unit';
    for (let s = 0; s < 8; s++) {
      const el = s < 5 ? this.board.slotEl(0, s) : this.benchEl.querySelector<HTMLElement>(`[data-index="${s}"]`);
      if (!el) continue;
      const k = active ? this.dropKind(s) : '';
      el.dataset.drop = k;
      el.classList.toggle('drop-hover', active && hover === s && !!k && k !== 'invalid');
    }
    this.board.el.classList.toggle('dropping', active);
  }

  /** 手势结束时立刻撤销命中区域与目标高亮，不干预仍需回弹的影子。 */
  private clearDragTargets() {
    this.sellZone?.el.remove();
    this.sellZone = null;
    this.el.querySelectorAll('.target-dim,.target-lit').forEach(el => el.classList.remove('target-dim', 'target-lit'));
  }

  /** End the owned gesture and every returning preview, including cancelled animations. */
  private clearDrag() {
    this.clearDragTargets();
    this.releaseDrag?.();
    const drag = this.drag;
    this.drag = null;
    this.probeKey = '';
    drag?.src.classList.remove('lifted');
    drag?.ghost?.remove();
    for (const [ghost, animation] of this.returningGhosts) {
      animation.cancel();
      ghost.remove();
    }
    this.returningGhosts.clear();
    // This layer owns every preview, so lifecycle cleanup also removes any untracked stale node.
    this.el.querySelectorAll('.drag-ghost').forEach(ghost => ghost.remove());
    this.el.querySelectorAll('.lifted').forEach(source => source.classList.remove('lifted'));
  }

  private openSellZone(index: number) {
    if (!this.allowTutorial({ kind: 'sell', slot: index })) return;
    const u = this.owned(index);
    const cards = this.tray.querySelector<HTMLElement>('.cards');
    if (!u || this.mode !== 'prep' || this.sandbox || !cards || !canSell(this.run, index)) return;
    const b = cards.getBoundingClientRect();
    const a = toStage(b.left, b.top), z = toStage(b.right, b.bottom);
    const rect = { x: a.x, y: a.y, w: z.x - a.x, h: z.y - a.y };
    const el = h('div', { class: 'sell-zone', style: `left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px` },
      h('b', null, '拖到这里出售'), h('span', null, `+${sellPrice(u, this.run)} 金 · 培养点和装备退回`));
    this.el.appendChild(el);
    this.sellZone = { el, rect };
  }

  private overSell(p: { x: number; y: number }) {
    const r = this.sellZone?.rect;
    return !!r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  /** 出售：高星或带装备 / 培养的单位先确认，其余直接卖 */
  private sellOwned(index: number) {
    if (!this.allowTutorial({ kind: 'sell', slot: index })) return;
    const u = this.owned(index);
    if (!u || !this.editable || this.sandbox || !canSell(this.run, index)) return;
    const done = () => {
      if (!this.editable || !this.allowTutorial({ kind: 'sell', slot: index }) || !sell(this.run, index)) return;
      sfx.reward();
      const p = index < 5 ? bodyPos(0, index) : null;
      if (p) this.app.fx.float(p.x, p.y - 60, `+${sellPrice(u, this.run)} 金`, 'levelup', 900);
      this.sel = null; hideTip(); this.save(); this.renderAll(); this.emit('sell');
    };
    const valuable = unitLevel(u) > 1 || (u.equips ?? []).length > 0 || Object.values(u.train ?? {}).some(Boolean);
    if (valuable) this.app.confirm(`出售${unitDef(u.defId).name}？`, `获得 ${sellPrice(u, this.run)} 金，培养点和装备会退回。`, '出售', done);
    else done();
  }

  private returnGhost(ghost: HTMLElement, source: HTMLElement) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { ghost.remove(); return; }
    const r = source.getBoundingClientRect();
    const home = toStage(r.left + r.width / 2, r.top + r.height / 2);
    const animation = ghost.animate([
      { transform: ghost.style.transform, opacity: 1 },
      { transform: `translate(${home.x}px,${home.y}px) translate(-50%,-60%) scale(.6)`, opacity: 0 },
    ], { duration: 220, easing: 'ease-in' });
    this.returningGhosts.set(ghost, animation);
    const release = () => {
      if (this.returningGhosts.get(ghost) === animation) this.returningGhosts.delete(ghost);
      ghost.remove();
    };
    // Animation cancellation rejects finished; both outcomes must remove the actual node.
    void animation.finished.then(release, release);
  }

  private dragStart(e: PointerEvent, kind: 'card' | 'unit', idx: number, src: HTMLElement) {
    if (!this.editable || e.button > 0 || this.drag || !e.isPrimary) return;
    if (kind === 'card' && this.mode === 'sandbox') return;
    e.preventDefault();
    this.clearDrag();
    hideTip();
    this.drag = { kind, idx, startX: e.clientX, startY: e.clientY, ghost: null, src, pid: e.pointerId };
    const move = (ev: PointerEvent) => { if (ev.pointerId === this.drag?.pid) this.dragMove(ev); };
    this.releaseDrag?.();
    this.releaseDrag = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      this.releaseDrag = null;
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== this.drag?.pid) return;
      this.releaseDrag?.();
      this.dragEnd(ev);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  private dragMove(e: PointerEvent) {
    const d = this.drag;
    if (!d || e.pointerId !== d.pid) return;
    if (!this.editable) { this.clearDrag(); return; }
    if (!d.ghost) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return;
      const defId = d.kind === 'card' ? this.draftItem(this.run, d.idx)?.id : this.owned(d.idx)?.defId;
      if (!defId) { this.clearDrag(); return; }
      d.ghost = h('div', { class: 'drag-ghost', html: unitSvg(defId) });
      this.el.appendChild(d.ghost);
      d.src.classList.add('lifted');
      this.sel = null;
      clearTimeout(this.focusTimer);
      this.focus = this.hover = null;
      this.tray.querySelectorAll('.card.selected').forEach((c) => c.classList.remove('selected'));
      this.board.views.forEach((v) => v.el.classList.remove('selected'));
      if (d.kind === 'unit') this.openSellZone(d.idx);
      sfx.pick();
    }
    const p = toStage(e.clientX, e.clientY);
    this.sellZone?.el.classList.toggle('hot', this.overSell(p));
    d.ghost.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-60%) rotate(${Math.max(-12, Math.min(12, (e.movementX || 0) * 1.5))}deg)`;
    const over = this.slotAt(p.x, p.y);
    this.dropHints(over);
    this.probe(over);
  }

  private dragEnd(e: PointerEvent) {
    const d = this.drag;
    if (!d || e.pointerId !== d.pid) return;
    if (!this.editable) { this.clearDrag(); return; }
    const p = toStage(e.clientX, e.clientY);
    // 先保存售卖命中结果，再统一清理手势表面，所有松手与取消路径都适用。
    const sellDrop = d.kind === 'unit' && !!d.ghost && this.overSell(p);
    this.releaseDrag?.();
    this.drag = null;
    this.probeKey = '';
    d.src.classList.remove('lifted');
    this.clearDragTargets();
    this.dropHints();
    if (e.type === 'pointercancel') { d.ghost?.remove(); this.drawLinks(); return; }
    if (!d.ghost) {
      // 点击：选中 / 放置
      this.tap(d.kind, d.idx, p);
      return;
    }
    const slot = this.slotAt(p.x, p.y);
    const ghost = d.ghost;
    let ok = false;
    if (sellDrop) {
      ghost.remove();
      this.clearDrag();
      this.sellOwned(d.idx);
      return;
    }
    if (slot != null) ok = d.kind === 'card' ? this.doPlace(d.idx, slot) : this.doMove(d.idx, slot);
    if (ok) {
      ghost.remove();
    } else {
      this.returnGhost(ghost, d.src);
      this.drawLinks();
    }
  }

  /** 鼠标悬停结束时调用：点开的卡牌详情要留着，只关悬停带出来的说明 */
  private restoreTip() {
    const item = this.sel?.kind === 'card' ? this.draftItem(this.run, this.sel.idx) : undefined;
    if (!item || this.sel?.kind !== 'card') { hideTip(); return; }
    // Purchase details show the offered one-star ability; owned units retain
    // their upgrade preview. Repeating long next-star text hides the choices.
    const tip = unitTip(item.id, 1, null, false);
    const index = this.sel.idx;
    const acts = h('div', { class: 'shelf-acts' });
    // 「招募」与拖拽招募走同一条 doPlace：价格、金币、空位规则不另写一套。
    if (this.editable && !this.tut) {
      acts.appendChild(h('button', { class: 'btn primary shelf-recruit', onclick: () => {
        if (!this.editable) return;
        const slot = this.recruitSlot(item.id);
        if (slot === null) { this.app.showRewardNotice('没有空位', '场上满了：拖到同名单位上叠加，拖到别的单位上替换，或先卖掉一个。', 'error'); sfx.fizzle(); return; }
        this.doPlace(index, slot);
      } }, '招募'));
    }
    if (modernEconomy(this.run)) {
      acts.appendChild(h('button', { class: 'btn ghost shelf-lock', onclick: () => {
        if (!this.editable || !(item.groupId === undefined ? freezeDraft(this.run, index) : freezeUpgradeOffer(this.run, item.groupId))) return;
        this.sel = null; hideTip(); sfx.click(); this.save(); this.renderTray();
      } }, item.locked ? (item.groupId === undefined ? '解锁' : '解锁二选一') : (item.groupId === undefined ? '锁定' : '锁定二选一')));
    }
    if (acts.childElementCount) tip.appendChild(acts);
    // Keep purchase details above the shelf and left of the battle controls.
    showTip(tip, 690, 440, 'above');
  }

  private tap(kind: 'card' | 'unit', idx: number, p: { x: number; y: number }) {
    if (kind === 'card') {
      if (idx >= 0 && this.run.picks <= 0) return;
      if (this.sel?.kind === 'card' && this.sel.idx === idx) this.sel = null;
      else {
        this.sel = { kind: 'card', idx };
        sfx.pick();
        this.emit('select-card');
      }
      this.tray.querySelectorAll<HTMLElement>('.card').forEach(c => c.classList.toggle('selected', this.sel?.kind === 'card' && this.sel.idx === Number(c.dataset.draftIndex)));
      this.board.views.forEach((v) => v.el.classList.remove('selected'));
      this.focus = this.hover = null; this.drawLinks();
      this.dropHints();
      // 点卡牌只看详情，不进入“再点位置”的放置模式；详情里的「招募」按钮自动找空位
      this.restoreTip();
      return;
    }
    // 单位：点在单位上
    const slot = idx;
    if (this.commandArm && slot < 5) { this.chooseCommand(slot); return; }
    if (this.sel?.kind === 'point' || this.sel?.kind === 'equip') { this.applyArm(slot); return; }
    if (this.sel?.kind === 'card') { this.sel = null; hideTip(); this.tray.querySelectorAll('.card.selected').forEach((c) => c.classList.remove('selected')); }
    // 点选保留原来的查看语义；占用位置之间的交换/合成只由拖动发起。
    if (this.sel?.kind === 'unit' && this.sel.slot === slot) {
      this.sel = null;
      hideTip();
      this.setFocus(null);
      this.renderBoard();
      return;
    }
    if (this.owned(slot)) {
      this.sel = { kind: 'unit', slot };
      clearTimeout(this.focusTimer);
      this.focus = { side: 0, slot };
      sfx.pick();
      this.renderBoard();
      this.showOwnedTip(slot);
      // 教学只认可主动查看己方单位，悬停和敌方说明不算点击操作。
      this.emit('tip');
    }
    void p;
  }

  private bindBoard() {
    const el = this.board.el;
    for (let i = 0; i < 5; i++) {
      const slot = this.board.slotEl(0, i);
      slot.tabIndex = 0; slot.setAttribute('role', 'button'); slot.setAttribute('aria-label', `我方${i + 1}格`);
      slot.addEventListener('keydown', e => {
        if ((e.key !== 'Enter' && e.key !== ' ') || !this.editable) return;
        e.preventDefault();
        if (this.sel?.kind === 'unit' && this.sel.slot !== i) this.doMove(this.sel.slot, i);
        else if (this.slots[i]) this.tap('unit', i, { x: 0, y: 0 });
      });
    }
    el.addEventListener('pointerdown', (e) => {
      if (!this.editable) return;
      if (this.drag) { e.preventDefault(); return; }
      const p = toStage(e.clientX, e.clientY);
      const s = this.slotAt(p.x, p.y);
      if (s == null) return;
      if (this.slots[s]) {
        const v = this.board.view(`p0-${s}`);
        if (v) this.dragStart(e, 'unit', s, v.el);
      } else if (this.sel?.kind === 'unit') {
        e.preventDefault();
        const from = this.sel.slot;
        this.sel = null;
        this.doMove(from, s);
      }
    });
    el.addEventListener('pointermove', (e) => {
      if (this.drag || e.pointerType !== 'mouse' || isTipTarget(e.target)) return;
      if (this.editable && this.sel?.kind === 'unit') return;
      const p = toStage(e.clientX, e.clientY);
      const s = this.slotAt(p.x, p.y);
      const es = this.enemySlotAt(p.x, p.y);
      const f: { side: Side; slot: number } | null =
        s != null && this.board.view(this.viewKey(0, s)) ? { side: 0, slot: s } : es != null && this.board.view(this.viewKey(1, es)) ? { side: 1, slot: es } : null;
      if (f) this.showUnitTip(f.side, f.slot);
      else if (this.hoverTip) this.restoreTip();
      this.hoverTip = !!f;
      if (this.editable) this.setHover(f);
    });
    el.addEventListener('pointerleave', (e) => {
      // Touch emits pointerleave on finger release; it must not close a tapped unit's details.
      if (e.pointerType !== 'mouse' || isTipTarget(e.relatedTarget) || (this.editable && this.sel?.kind === 'unit')) return;
      if (this.hoverTip) this.restoreTip();
      this.hoverTip = false;
      if (this.editable) this.setHover(null);
    });
    el.addEventListener('click', (e) => {
      
      const p = toStage(e.clientX, e.clientY);
      // During playback both teams remain inspectable, without changing the battle commands.
      if (!this.editable) {
        const ps = this.slotAt(p.x, p.y);
        if (ps != null && this.board.view(this.viewKey(0, ps))) {
          this.showUnitTip(0, ps);
          return;
        }
      }
      const es = this.enemySlotAt(p.x, p.y);
      if (es == null || !this.board.view(this.viewKey(1, es))) return;
      if (this.editable && this.swapArm && !this.sandbox) {
        // 蕾娃：先后点两个敌方格完成一次换位
        if (this.swapPick == null || this.swapPick === es) {
          this.swapPick = this.swapPick === es ? null : es;
          this.board.views.forEach((v) => v.el.classList.toggle('swap-pick', v.side === 1 && v.slot === this.swapPick));
          sfx.click();
          return;
        }
        const a = this.swapPick;
        this.swapPick = null; this.swapArm = false;
        if (!addSwap(this.run, a, es)) { sfx.fizzle(); return; }
        sfx.swap(); this.save(); this.renderAll();
        return;
      }
      this.showUnitTip(1, es);
      if (!this.editable) return;
      const again = this.focus?.side === 1 && this.focus.slot === es;
      if (this.sel?.kind === 'unit') {
        this.sel = null;
        this.board.views.forEach((v) => v.el.classList.remove('selected'));
      }
      this.setFocus(again ? null : { side: 1, slot: es });
      if (again) hideTip();
    });
    this.el.addEventListener('pointerdown', (e) => {
      const t = e.target as HTMLElement;
      if ((this.drag && e.pointerId !== this.drag.pid)) { e.preventDefault(); return; }
      if (isTipTarget(t) || t.closest('.bench') || t.closest('.content-dialog') || t.closest('.prep-ov')) return;
      if (this.popover && !this.popover.contains(t)) this.closePopover();
      if (!this.editable) return;
      // 点盘面空白处：退出聚焦
      if (this.focus && !t.closest('.card') && !t.closest('button')) {
        const p = toStage(e.clientX, e.clientY);
        if (this.slotAt(p.x, p.y) == null && this.enemySlotAt(p.x, p.y) == null) {
          hideTip();
          if (this.sel?.kind === 'unit') this.sel = null;
          this.board.views.forEach((v) => v.el.classList.remove('selected'));
          this.setFocus(null);
        }
      }
      if (!this.sel) return;
      if (t.closest('.card') || t.closest('.board') || t.closest('button') || t.closest('.prep-entry') || t.closest('.hud-general')) return;
      this.sel = null;
      this.renderDock();
      this.tray.querySelectorAll('.card.selected').forEach((c) => c.classList.remove('selected'));
      this.renderBoard();
    });
  }

  private viewKey(side: Side, slot: number) {
    if (this.editable) return `p${side}-${slot}`;
    for (const [k, v] of this.board.views) if (v.side === side && v.slot === slot) return k;
    return '';
  }

  private showUnitTip(side: Side, slot: number) {
    const v = this.board.view(this.viewKey(side, slot));
    if (!v) return;
    for (const view of this.board.views.values()) view.el.classList.toggle('inspected', view === v);
    let st = v.getStats();
    if (this.editable) {
      const out = simulate(this.setup(true));
      const init = out.initial.find((u) => u.side === side && u.slot === slot);
      if (init) st = out.afterStart[init.uid - 1];
    }
    // 备战时连线画在头顶，说明框放到台座下方，别挡住箭头
    // Playback replaces preparation views. Keep the inspected entity's key so
    // later swaps or revivals cannot make its remaining uses follow another unit.
    const key = this.viewKey(side, slot);
    const liveKey = key.startsWith('p') ? this.pb?.initialViewKey(side, slot) ?? key : key;
    const content = unitTip(v.defId, v.level, st, true, this.editable ? undefined : () => this.board.view(liveKey)?.getStats() ?? v.getStats());
    const own = side === 0 && this.editable ? this.owned(slot) : null;
    const extra = own ? this.ownedExtra(own, slot) : null;
    if (extra) content.appendChild(extra);
    const blocked = own ? sellBlockReason(this.run, slot) : null;
    if (blocked) content.append(h('div', { class: 'tip-text' }, blocked));
    const p = headPos(side, slot);
    if (this.editable) showTip(content, slotX(side, slot), UNIT_Y + 62, 'below', p.y - 30);
    else showTip(content, p.x, p.y - 30, 'above');
  }

  /** 点「招募」时的落点：第一个空战位，其次预备格；都满时才叠加到同名单位 */
  private recruitSlot(defId: string): number | null {
    const r = this.run;
    for (let s = 0; s < 5 + r.bench.length; s++) if (!this.owned(s) && placeKind(r, defId, s) === 'place') return s;
    for (let s = 0; s < 5 + r.bench.length; s++) if (placeKind(r, defId, s) === 'merge') return s;
    return null;
  }

  private doPlace(idx: number, slot: number, confirmed = false) {
    if (!this.allowTutorial({ kind: 'place', idx, slot })) return false;
    if (modernEconomy(this.run)) {
      const reason = this.shelfBuyReason(this.run, idx, slot);
      if (reason) { this.app.showRewardNotice('无法购买', reason, 'error'); return false; }
    }
    const defId = this.draftItem(this.run, idx)?.id;
    if (!defId) return false;
    // 放到已有单位的位置：挤去备战席或遣散，都先确认，防止拖偏了把场上单位顶掉
    if (!confirmed && (idx < 0 || this.run.picks > 0) && placeKind(this.run, defId, slot) === 'reserve') {
      const old = this.owned(slot)!;
      this.app.confirm(`替换${unitDef(old.defId).name}？`, `${unitDef(defId).name}会占这个位置，${unitDef(old.defId).name}移到备战席。`, '替换', () => { if (this.editable) this.doPlace(idx, slot, true); });
      return false;
    }
    const lvBefore = this.owned(slot) ? unitLevel(this.owned(slot)!) : 0;
    const kind = this.takeShelf(this.run, idx, slot, confirmed);
    if (kind === 'confirm') {
      const old = this.owned(slot)!;
      this.app.confirm(`遣散${unitDef(old.defId).name}？`, `场上满了，${unitDef(defId).name}会顶掉这名${unitLevel(old)}星单位（按出售退还金币、培养点和装备）。`, '遣散并招募', () => { if (this.editable) this.doPlace(idx, slot, true); });
      return false;
    }
    if (kind === 'invalid') { const why = sellBlockReason(this.run, slot); if (why) this.app.showRewardNotice('无法替换', why, 'error'); sfx.fizzle(); if (slot < 5) this.flashSlot(slot, 'bad'); return false; }
    hideTip(); this.sel = null;
    if (kind === 'merge') sfx.merge(); else sfx.place();
    if (slot < 5) this.armFocus(slot);
    this.save();
    this.renderAll();
    this.placementEffect(slot, defId, kind === 'merge', lvBefore);
    if (this.run.picks > 0 || this.run.upgradeOffers?.length) this.cardsIn();
    this.emit(kind === 'merge' ? 'merge' : 'place');
    return true;
  }

  private doMove(from: number, to: number, mode: 'auto' | 'swap' = this.sandbox ? 'swap' : 'auto') {
    if (!this.allowTutorial({ kind: 'move', from, to })) return false;
    const va = from < 5 ? this.board.view(`p0-${from}`) : null;
    const vb = to < 5 ? this.board.view(`p0-${to}`) : null;
    const lvBefore = this.owned(to) ? unitLevel(this.owned(to)!) : 0;
    const kind = moveSlot(this.inventory, from, to, mode);
    if (kind === 'invalid') { sfx.fizzle(); return false; }
    hideTip(); this.sel = null;
    if (kind === 'merge') sfx.merge(); else sfx.swap();
    if (to < 5) this.armFocus(to); else this.focus = null;
    // Keep the existing UnitViews attached to their owned actors while the original hop plays.
    // Re-key before rendering so the refreshed stats do not replace the animated DOM nodes.
    if (kind !== 'merge' && from < 5 && to < 5) {
      this.board.views.delete(`p0-${from}`); this.board.views.delete(`p0-${to}`);
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (va) { this.board.views.set(`p0-${to}`, va); if (reduced) va.place(to); else void va.moveTo(to, 300, 30); }
      if (vb) { this.board.views.set(`p0-${from}`, vb); if (reduced) vb.place(from); else void vb.moveTo(from, 300, -20); }
    }
    this.save();
    this.renderAll();
    if (kind === 'merge') this.placementEffect(to, this.owned(to)!.defId, true, lvBefore);
    this.emit(kind === 'merge' ? 'merge' : 'move');
    return true;
  }

  private placementEffect(index: number, defId: string, merge: boolean, lvBefore = 0) {
    const p = index < 5 ? bodyPos(0, index) : (() => {
      const rect = this.benchEl.querySelector<HTMLElement>(`[data-index="${index}"]`)!.getBoundingClientRect();
      const scale = this.el.getBoundingClientRect().width / 1280;
      return toStage(rect.left + rect.width / 2, rect.top + 70 * scale);
    })();
    const fx = this.app.fx;
    const u = this.owned(index);
    if (merge && u && unitLevel(u) <= lvBefore) {
      // 叠加未升星：+1/+1 小反馈，显示离下一星还差几份
      const goal = u.copies < LEVEL_COPIES[0] ? LEVEL_COPIES[0] : LEVEL_COPIES[1];
      fx.burst(p.x, p.y, '#fff6cc', { n: 10, speed: 3, kind: 'plus', size: 4, up: 2.5, life: 30, gravity: 0.02 });
      fx.ring(p.x, p.y + 40, '#ffe08a', 70, 18);
      fx.pulse(this.unitArt(this.unitNode(index)), 1.16, 300);
      fx.float(p.x, p.y - 70, u.copies >= MAX_COPIES ? '+1/+1 · 满' : `+1/+1 · ${u.copies}/${goal}`, 'levelup', 700);
      return;
    }
    if (merge) {
      // 升星：星芒炸开 → 小星升起 → 单位弹一下；全程 ≤700ms
      fx.stars(p.x, p.y - 10);
      fx.burst(p.x, p.y, '#ffe08a', { n: 22, speed: 6, size: 3, life: 30 });
      fx.burst(p.x, p.y, '#fff6cc', { n: 8, speed: 3, kind: 'plus', size: 4, up: 2.5, life: 34, gravity: 0.02 });
      fx.ring(p.x, p.y + 40, '#ffe08a', 90, 22);
      fx.wave(p.x, p.y + 44, '#ffe08a', 180, 420);
      fx.pulse(this.unitArt(this.unitNode(index)), 1.28, 380);
      fx.float(p.x, p.y - 70, `升级 ${'★'.repeat(unitLevel(this.owned(index)!))}`, 'levelup', 700);
    } else {
      const color = FACTION_INFO[unitDef(defId).faction].color;
      fx.ring(p.x, p.y + 40, color, 70);
      fx.burst(p.x, p.y + 40, color, { n: 16, speed: 4, kind: 'mote', size: 2.5, up: 2 });
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) fx.shake(3, 160);
    }
  }

  // ───────────── 培养特效 ─────────────

  /** 已拥有单位当前显示的节点：整备弹层 > 战位 > 备战席 */
  private unitNode(slot: number): HTMLElement | null {
    if (this.prep?.isConnected) return this.prep.querySelector<HTMLElement>(`.prep-owned[data-slot="${slot}"]`);
    if (slot < 5) return this.board.view(`p0-${slot}`)?.el ?? null;
    return this.benchEl.querySelector<HTMLElement>(`[data-index="${slot}"]`);
  }
  private genNode(): HTMLElement | null {
    return (this.prep?.isConnected ? this.prep.querySelector<HTMLElement>('.pu-card.gen') : null) ?? this.el.querySelector<HTMLElement>('.hud-general');
  }
  private unitArt(n: HTMLElement | null) {
    return n?.querySelector<HTMLElement>('.u-art, .bench-art, .pu-art, .hg-portrait') ?? n;
  }
  /** 节点（立绘）中心与脚下，舞台坐标 */
  private nodePos(n: HTMLElement) {
    const r = (this.unitArt(n) ?? n).getBoundingClientRect();
    return { c: toStage(r.left + r.width / 2, r.top + r.height / 2), feet: toStage(r.left + r.width / 2, r.bottom), top: toStage(r.left + r.width / 2, r.top) };
  }
  private slotPos(slot: number) {
    const n = this.unitNode(slot);
    if (n) return this.nodePos(n);
    if (slot >= 5) return null;
    const p = bodyPos(0, slot);
    return { c: p, feet: { x: p.x, y: p.y + 44 }, top: { x: p.x, y: p.y - 50 } };
  }
  /** 托盘里培养点按钮的位置（在重绘之前取） */
  private chipPos(type: string): Pt | null {
    const el = this.prep?.querySelector<HTMLElement>(`.pr-chip.pt-${type}`) ?? (this.prep ? null : this.dock.querySelector<HTMLElement>('.prep-btn'));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width ? toStage(r.left + r.width / 2, r.top + r.height / 2) : null;
  }
  /** 数值牌下的显示值：先回退到旧值，法球到达时再跳到新值 */
  private statBox(n: HTMLElement | null, type: string, general: boolean) {
    if (!n) return null;
    if (general) return n.querySelector<HTMLElement>('.pu-stat em');
    if (type === 'atk') return n.querySelector<HTMLElement>('.u-stats .st.atk, .bench-stats .st.atk');
    if (type === 'hp') return n.querySelector<HTMLElement>('.u-stats .st.hp, .bench-stats .st.hp');
    if (type === 'block') return n.querySelector<HTMLElement>('.u-shield');
    return null;
  }
  private preRoll(box: HTMLElement | null, delta: number) {
    const i = box && (box.tagName === 'EM' ? box : box.querySelector<HTMLElement>(':scope > i'));
    if (!i || !this.prep || i.childElementCount) return;
    const now = Number(i.textContent);
    if (!Number.isFinite(now) || now - delta < 0) return;
    i.dataset.to = String(now);
    i.textContent = String(now - delta);
  }
  private tickTo(box: HTMLElement | null) {
    if (!box) return;
    const i = box.tagName === 'EM' ? box : box.querySelector<HTMLElement>(':scope > i');
    if (i?.dataset.to) { i.textContent = i.dataset.to; delete i.dataset.to; }
    this.app.fx.bump(box);
  }

  /** 分配培养点：法球从托盘飞向目标 → 目标弹跳 + 属性牌 + 数值跳动 */
  private allocFx(type: string, from: Pt | null, to: number | 'general') {
    const fx = this.app.fx, color = CUL_COLOR[type] ?? '#ffd36b', general = to === 'general';
    const node = () => (general ? this.genNode() : this.unitNode(to));
    const n0 = node();
    if (!n0) return;
    const b = this.nodePos(n0).c;
    const delta = type === 'hp' ? 2 : 1;
    if (type !== 'block') this.preRoll(this.statBox(n0, type, general), delta);
    const start = from ?? { x: b.x, y: b.y - 170 };
    const fly = 300;
    fx.orb(start, b, color, fly);
    this.later(() => {
      const n = node();
      if (!n) return;
      const p = this.nodePos(n);
      fx.ring(p.c.x, p.c.y, color, 56, 18);
      fx.burst(p.c.x, p.c.y, color, { n: 14, speed: 4.5, size: 3, up: 1.5, life: 24 });
      fx.burst(p.c.x, p.c.y, '#ffffff', { n: 4, speed: 2.5, kind: 'plus', size: 3, up: 2, life: 26, gravity: 0.02 });
      fx.pulse(this.unitArt(n), 1.2, 320);
      fx.statPop(p.top.x, p.top.y - 4, `+${delta}`, POINT_MAP[type]?.short ?? '', `pt-${type}`);
      this.tickTo(this.statBox(n, type, general));
    }, fly);
  }

  /** 装备：图标砸到单位身上 + 冲击环 */
  private equipFx(id: string, slot: number) {
    const fx = this.app.fx, gold = '#ffd36b';
    const p0 = this.slotPos(slot);
    if (!p0) return;
    const dur = 440;
    fx.drop(p0.feet, itemIcon(id, 'spell'), dur);
    this.later(() => {
      const p = this.slotPos(slot) ?? p0;
      fx.wave(p.feet.x, p.feet.y, gold, 190, 420);
      fx.ring(p.c.x, p.c.y, gold, 70, 18);
      fx.burst(p.feet.x, p.feet.y - 6, gold, { n: 14, speed: 5, kind: 'shard', size: 3, up: 3, life: 24 });
      fx.pulse(this.unitArt(this.unitNode(slot)), 1.16, 300);
      fx.statPop(p.top.x, p.top.y - 4, '', EQUIP_MAP[id]?.name ?? '装备', 'eq');
    }, Math.round(dur * 0.62));
  }

  private growthSnap: GrowthSnap | null = null;
  private takeGrowth(): GrowthSnap {
    const units: GrowthSnap['units'] = new Map();
    for (const u of [...this.run.slots, ...this.run.bench]) if (u) units.set(u.ownedId, { defId: u.defId, copies: u.copies, g: { atk: u.growth?.atk ?? 0, hp: u.growth?.hp ?? 0, power: u.growth?.power ?? 0 } });
    return { units, uses: { ...(this.run.prepUses ?? {}) } };
  }
  /** 每次落存档后比较远征成长：单位能力带来的成长都给一个看得见的来源 */
  private growthCheck() {
    const prev = this.growthSnap, next = this.takeGrowth();
    this.growthSnap = next;
    if (!prev || this.mode !== 'prep' || this.sandbox || this.run.prepCommitted) return;
    // 本次触发的能力来源（仍在场上的单位）
    const sources: number[] = [];
    for (const [k, v] of Object.entries(next.uses)) if (v > (prev.uses[k] ?? 0)) {
      const id = Number(k.split(':')[0]);
      if (next.units.has(id) && !sources.includes(id)) sources.push(id);
    }
    const gone = [...prev.units.entries()].filter(([id]) => !next.units.has(id));
    const all = [...this.run.slots, ...this.run.bench];
    let order = 0;
    for (const [id, now] of next.units) {
      const was = prev.units.get(id);
      if (!was) continue;
      const d = { atk: now.g.atk - was.g.atk, hp: now.g.hp - was.g.hp, power: now.g.power - was.g.power };
      // 合并升星：被合并那份的成长并入，不算新成长
      if (now.copies > was.copies) for (const [, v] of gone) if (v.defId === now.defId) { d.atk -= v.g.atk; d.hp -= v.g.hp; d.power -= v.g.power; }
      const stats = (['atk', 'hp', 'power'] as const).filter(k => d[k] > 0);
      if (!stats.length) continue;
      const slot = all.findIndex(u => u?.ownedId === id);
      if (slot < 0) continue;
      const src = sources.find(s => s !== id);
      const srcSlot = src === undefined ? -1 : all.findIndex(u => u?.ownedId === src);
      const delay = 40 + order++ * 110;
      this.later(() => stats.forEach((k, i) => this.later(() => this.growthFx(slot, srcSlot, k, d[k], i), i * 120)), delay);
    }
  }
  private growthFx(slot: number, srcSlot: number, stat: 'atk' | 'hp' | 'power', n: number, row: number) {
    const fx = this.app.fx, color = CUL_COLOR[stat];
    const p = this.slotPos(slot);
    if (!p) return;
    const s = srcSlot >= 0 ? this.slotPos(srcSlot) : null;
    const tag = () => {
      const q = this.slotPos(slot) ?? p;
      fx.statPop(q.top.x, q.top.y - 4 - row * 46, `+${n}`, POINT_MAP[stat]?.short ?? '', `pt-${stat}`);
      fx.pulse(this.unitArt(this.unitNode(slot)), 1.14, 300);
      fx.bump(this.statBox(this.unitNode(slot), stat, false));
    };
    if (s) {
      // 来源可知：从来源单位拉一道属性色光线，粒子顺线流过去
      fx.link(s.c, p.c, color, 380);
      fx.flow(s.c, p.c, color, { n: 8, life: 18, arc: 36, size: 2.5 });
      fx.ring(s.c.x, s.c.y, color, 44, 14);
      this.later(() => { fx.burst(p.c.x, p.c.y, color, { n: 10, speed: 3.5, size: 2.5, up: 1.5, life: 22 }); tag(); }, 300);
    } else {
      // 来源不可知（已出售等）：原地升起像素光柱
      fx.pillar(p.feet.x, p.feet.y, color, 150, 520);
      fx.rise(p.c.x, p.feet.y - 10, color, 8, 44);
      this.later(tag, 140);
    }
  }

  private flashSlot(slot: number, cls: string) {
    const el = this.board.slotEl(0, slot);
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 400);
  }

  // ───────────── 军械条：培养点 / 装备 / 法术 / 招募令 / 卖出 ─────────────

  /** 已拥有单位的装备与培养说明（挂在单位说明框底部） */
  /** 说明框里的装备 / 培养；备战时每件装备带「卸下」按钮（放在框里，不会被说明框挡住） */
  private ownedExtra(u: Slotted, slot: number) {
    const eqs = u.equips ?? [];
    const train = Object.entries(u.train ?? {}).filter(([, n]) => n);
    const growth = Object.entries(u.growth ?? {}).filter(([, n]) => n);
    const projected = this.preparedOwned(u);
    const pending = (['atk', 'hp', 'power'] as const).map(k => [k, (projected.growth?.[k] ?? 0) - (u.growth?.[k] ?? 0)] as const).filter(([,n]) => n);
    if (!eqs.length && !train.length && !growth.length && !pending.length) return null;
    const canEdit = this.mode === 'prep' && !this.sandbox && this.editable;
    const off = (i: number) => h('button', { class: 'to-off', onclick: (e: Event) => {
      e.stopPropagation();
      if (this.adPending || !this.allowTutorial({ kind: 'unequip' }) || !unequip(this.run, slot, i)) return;
      sfx.click(); this.save(); this.renderAll(); this.showOwnedTip(slot);
    } }, '卸下');
    return h(
      'div',
      { class: 'tip-own' },
      eqs.map((id, i) => h('div', { class: 'to-eq' }, itemIcon(id, 'spell', 'sm'), h('b', null, EQUIP_MAP[id]?.name ?? id), h('span', null, EQUIP_MAP[id]?.text ?? ''), canEdit ? off(i) : null)),
      train.length ? h('div', { class: 'to-tr' }, '培养：', train.map(([k, n]) => `${POINT_MAP[k]?.name ?? k}+${n}`).join('  ')) : null,
      growth.length ? h('div', { class: 'to-tr' }, '远征成长：', growth.map(([k, n]) => `${POINT_MAP[k]?.name ?? k}+${n}`).join('  ')) : null,
      pending.length ? h('div', { class: 'to-tr' }, '开战时成长：', pending.map(([k, n]) => `${POINT_MAP[k]?.name ?? k}+${n}`).join('  ')) : null,
    );
  }

  /** 选中培养点 / 装备后点单位：分配到该单位 */
  private applyArm(slot: number) {
    const s = this.sel;
    if (!s || this.sandbox || this.mode !== 'prep') return;
    let ok = false;
    const from = s.kind === 'point' ? this.chipPos(s.type) : null;
    const item = s.kind === 'equip' ? this.run.bag[s.idx] : '';
    if (s.kind === 'point') {
      if (!this.allowTutorial({ kind: 'alloc', to: slot, type: s.type })) return;
      ok = allocPoint(this.run, slot, s.type);
      if (ok && !(this.run.stash[s.type] > 0)) this.sel = null;
    } else if (s.kind === 'equip') {
      if (!this.allowTutorial({ kind: 'equip', index: s.idx, slot })) return;
      ok = equip(this.run, s.idx, slot);
      if (ok) this.sel = null;
    }
    if (!ok) { sfx.fizzle(); return; }
    sfx.merge();
    this.save();
    this.renderAll();
    if (s.kind === 'point') this.allocFx(s.type, from, slot);
    else if (item) this.equipFx(item, slot);
    this.emit(s.kind === 'equip' ? 'equip' : 'alloc');
  }

  /** 主界面只留一个「整备」入口：角标是还没用掉的资源数 */
  private renderDock() {
    const r = this.run;
    const d = this.dock;
    this.armHint.classList.add('hidden');
    if (this.mode !== 'prep' || this.sandbox) { this.commandArm = false; this.el.classList.remove('command-arm'); this.swapArm = false; this.swapPick = null; d.classList.add('hidden'); this.closePrep(); return; }
    this.el.classList.toggle('command-arm', this.commandArm);
    if (this.commandArm) { this.armHint.textContent = '选择战位友军'; this.armHint.classList.remove('hidden'); }
    const left = stashTotal(r) + r.bag.length + r.spells.length + r.orders.length;
    const btn = h('button', { class: `prep-btn${left ? ' has' : ''}`, 'aria-label': '整备' }, icon('plate'), h('span', null, '整备'), left ? h('i', null, left) : null);
    btn.addEventListener('click', (e) => { e.stopPropagation(); if (this.editable && !this.adPending) { sfx.click(); this.openPrep(); } });
    const acts = h('div', { class: 'gen-acts' }, this.genActions());
    d.replaceChildren(acts, btn);
    d.classList.remove('hidden');
    // 主将专属按钮堆在「整备」上方：把开战键再往上让出同样高度，避免互相压住
    // 每位主将预留固定行数（整局不变），状态变化只换内容，开战键不再上下跳
    const rows = [...acts.children], live = rows.filter(c => !c.classList.contains('egg-prog')).length;
    const [rb, re] = this.genReserve();
    const buttons = Math.max(live, rb), eggs = Math.max(rows.length - live, re);
    this.el.style.setProperty('--gen-stack', buttons + eggs
      ? `calc(${2 + eggs * 56 + buttons * 8}px + ${buttons} * max(56px, var(--control-size, 64px)))` : '0px');
    const hk = r.lastHatch ? `${battleNo(r)}:${r.lastHatch}` : '';
    if (hk && hk !== this.hatchNoted) {
      this.hatchNoted = hk;
      this.app.showRewardNotice('龙蛋孵化', `${unitDef(r.lastHatch!).name}破壳而出`);
    }
    if (this.prep) this.renderPrep();
  }

  /** 主将专属按钮列预留的 [按钮行, 龙蛋行] */
  private genReserve(): [number, number] {
    const r = this.run;
    if (modernTactics(r) && (r.general === 'zilan' || r.general === 'kaleos')) return [2, 0];
    if (r.general === 'reva') return [1, 0];
    if (r.general === 'hank') return [r.passives.includes('hank_1') ? 2 : 1, 0];
    if (r.general === 'xingjiao') return [0, (r.pendingEggs ?? 0) > 0 ? 2 : 1];
    return [0, 0];
  }

  private chooseCommand(slot: number) {
    const id = this.owned(slot)?.ownedId;
    if (id == null || !this.editable || this.sandbox || this.adPending || !setGeneralOrder(this.run, id)) { sfx.fizzle(); return; }
    this.commandArm = false; this.sel = null; hideTip(); sfx.pick(); this.save(); this.renderAll();
  }

  /** 主将专属的备战操作：蕾娃换位、赫克佣兵、星角龙蛋进度 */
  private genActions(): HTMLElement[] {
    const r = this.run, out: HTMLElement[] = [];
    const act = (ic: Parameters<typeof icon>[0], label: string, n: string, on: boolean, fn: () => void) => {
      const b = h('button', { class: `gen-act${on ? ' on' : ''}`, 'aria-label': label }, icon(ic), h('span', null, label), n ? h('i', null, n) : null);
      b.addEventListener('click', (e) => { e.stopPropagation(); if (this.editable && !this.adPending) fn(); });
      return b;
    };
    if (modernTactics(r) && (r.general === 'zilan' || r.general === 'kaleos')) {
      const skill = generalDefinition(r.general, 1).skill;
      const target = r.slots.find(u => u?.ownedId === r.commandTarget);
      const choose = act('flag', this.commandArm ? '取消选择' : skill, '', this.commandArm || !!target, () => {
        sfx.click(); this.commandArm = !this.commandArm; this.sel = null; hideTip(); this.renderDock(); this.renderBoard();
      });
      choose.disabled = !r.slots.some(Boolean);
      choose.setAttribute('aria-pressed', String(this.commandArm));
      out.push(choose);
      if (r.commandTarget != null) out.push(act('replay', '撤销指令', '', false, () => {
        if (!setGeneralOrder(r, null)) return;
        this.commandArm = false; sfx.click(); this.save(); this.renderAll();
      }));
    }
    if (r.general === 'reva') {
      const cap = swapCap(r), n = r.swaps?.length ?? 0;
      out.push(n >= cap
        ? act('replay', '撤销', `${n}/${cap}`, false, () => {
          sfx.click(); clearSwaps(r); this.swapArm = false; this.swapPick = null; this.save(); this.renderAll();
        })
        : act('swap', '换位', `${n}/${cap}`, this.swapArm, () => {
          sfx.click(); this.swapArm = !this.swapArm; this.swapPick = null; this.renderDock(); this.renderBoard();
        }));
    }
    if (r.general === 'hank') {
      const m = r.merc;
      // 先看详情再雇：说明框底部带雇用按钮，金币不足时按钮置灰
      if (m && !m.sold) {
        const b = act('flag', unitDef(m.id).name, m.price ? `${m.price}金` : '免费', false, () => {
          sfx.click();
          const short = r.gold < m.price;
          const hire = h('button', { class: 'btn merc-hire', disabled: short }, short ? `金币不足（需 ${m.price}）` : m.price ? `雇用 · ${m.price} 金` : '雇用');
          hire.addEventListener('click', (e) => {
            e.stopPropagation();
            hideTip();
            if (!hireMerc(r)) { sfx.fizzle(); return; }
            sfx.place(); this.save(); this.renderAll();
          });
          const content = unitTip(m.id, 1);
          content.append(h('p', { class: 'merc-note' }, '临时佣兵，只参加本场'), hire);
          const rc = b.getBoundingClientRect(), p0 = toStage(rc.left + rc.width / 2, rc.bottom), q = toStage(0, rc.top);
          showTip(content, p0.x, p0.y, 'below', q.y);
        });
        out.push(b);
      }
      const temp = allOwned(r).findIndex((u) => u?.temp);
      if (temp >= 0 && r.passives.includes('hank_1')) out.push(act('check', '长约', `${SIGN_PRICE}金`, false, () => {
        if (!signMerc(r, temp)) { sfx.fizzle(); return; }
        sfx.merge(); this.save(); this.renderAll();
      }));
    }
    if (r.general === 'xingjiao' && allOwned(r).some((u) => u?.defId === 'x_egg')) {
      const acc = r.eggStats, max = eggThreshold(r);
      const EGG_ICONS: [EggStat, Parameters<typeof icon>[0]][] = [['death', 'skull'], ['burn', 'fire'], ['freeze', 'snow'], ['move', 'swap'], ['summon', 'sparkle']];
      out.push(h('div', { class: 'egg-prog', 'aria-label': `龙蛋 满${max}孵化` },
        EGG_ICONS.map(([k, ic]) => h('span', { class: `egg-${k}` }, icon(ic), h('i', null, acc?.[k] ?? 0))), h('b', null, `/${max}`)));
    }
    if (r.general === 'xingjiao' && (r.pendingEggs ?? 0) > 0) {
      out.push(h('div', { class: 'egg-prog egg-pending', role: 'status' }, icon('sparkle'), h('span', null, `待补蛋 ${r.pendingEggs}`)));
    }
    return out;
  }

  private openPrep() {
    hideTip();
    this.sel = null;
    this.prep = h('div', { class: 'prep-ov' });
    this.prep.addEventListener('click', (e) => e.stopPropagation());
    this.el.appendChild(this.prep);
    this.el.classList.add('prep-open');
    this.syncMusicState();
    this.renderPrep();
    this.coach();
  }

  private closePrep() {
    if (!this.prep) return;
    hideTip();
    this.prep.remove();
    this.prep = null;
    this.syncMusicState();
    this.el.classList.remove('prep-open');
    requestAnimationFrame(() => this.coach());
    if (this.sel?.kind === 'point' || this.sel?.kind === 'equip') this.sel = null;
  }

  /** 整备：双方阵容 + 主将 + 我方资源，选资源后点目标，目标上直接显示改动后的属性 */
  private renderPrep() {
    const ov = this.prep;
    if (!ov) return;
    const r = this.run, sel = this.sel;
    const act = (fn: () => boolean, ok: () => void = () => sfx.click()) => (e: Event) => {
      e.stopPropagation();
      if (!this.editable || this.adPending) return;
      hideTip();
      if (!fn()) { sfx.fizzle(); return; }
      ok(); this.save(); this.renderAll();
    };
    const pick = (next: Sel) => () => {
      this.sel = this.sel && JSON.stringify(this.sel) === JSON.stringify(next) ? null : next;
      return true;
    };
    const num = (a: number, b: number) => (a === b ? h('em', null, a) : h('em', null, a, h('s', { class: 'kwup' }, '→'), h('b', { class: 'kwup-v' }, b)));
    const tipAt = (el: HTMLElement, content: HTMLElement) => {
      const b = el.getBoundingClientRect(), p = toStage(b.left + b.width / 2, b.bottom), q = toStage(0, b.top);
      showTip(content, p.x, p.y, 'below', q.y);
    };
    const trayLeft = ov.querySelector<HTMLElement>('.pp-tray')?.scrollLeft ?? 0;
    const active = document.activeElement as HTMLElement | null;
    const focusOwner = active?.closest<HTMLElement>('.prep-refund')?.dataset.owner;
    const focusPoint = active?.closest<HTMLElement>('.prep-refund')?.dataset.point;
    const choosingResource = sel?.kind === 'point' || sel?.kind === 'equip';
    // The UID-backed round ledger excludes lifetime training and battle-start buffs.
    const refunds = (owner: number | 'general') => {
      const buttons = POINT_TYPES.filter(p => allocRefundable(r, owner, p.id) > 0).map(p => {
        const count = allocRefundable(r, owner, p.id);
        const delta = p.id === 'hp' ? count * 2 : count;
        // 本轮分配的点数：像素图标 + 绿色增量，右侧小箭头表示可退回
        const art = [pxIcon(p.id), h('i', { class: 'prep-added' }, `+${delta}`), h('s', { class: 'prep-undo' }, '↩')];
        const b = h('button', { class: `prep-refund pt-${p.id}`, 'data-owner': owner, 'data-point': p.id,
          disabled: !!this.tut || !this.editable || this.adPending,
          'aria-label': `本轮${p.name}${p.id === 'block' ? `分配${count}点（有效格挡最多3层）` : `增加${delta}`}，退回一点${p.name}` },
          h('span', { class: 'prep-refund-face', 'aria-hidden': 'true' }, ...art));
        b.addEventListener('click', act(() => !this.tut && deallocPoint(r, owner, p.id)));
        b.addEventListener('keydown', e => e.stopPropagation());
        b.addEventListener('keyup', e => e.stopPropagation());
        return b;
      });
      return h('div', { class: 'prep-refunds' }, ...buttons);
    };
    const markOwned = (el: HTMLElement, slot: number) => {
      if (this.prepFocus === slot && !choosingResource) el.classList.add('prep-focused');
    };
    const roster = h('div', { class: 'prep-roster board', 'aria-label': '我方阵容与备战' });
    roster.addEventListener('scroll', hideTip, { passive: true });
    const allies = h('div', { class: 'prep-allies' });
    const enemies = h('div', { class: 'prep-enemies board', 'aria-label': '敌方预览' });
    const seats = new Map<number, HTMLElement>();
    for (let slot = 0; slot < SLOTS; slot++) {
      const seat = h('div', { class: 'prep-seat' },
        h('div', { class: 'prep-figure' }, seatArt()));
      seats.set(slot, seat); allies.append(seat);
    }
    const out = simulate(this.setup(true));
    const activate = (el: HTMLElement, fn: (e: Event) => void) => {
      el.tabIndex = 0; el.setAttribute('role', 'button');
      el.addEventListener('click', fn);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
    };
    const selectOwned = (slot: number, el: HTMLElement, e: Event) => {
      e.stopPropagation();
      if (!this.editable || this.adPending) return;
      if (this.commandArm && slot < 5) { this.chooseCommand(slot); return; }
      this.prepFocus = slot;
      if (sel?.kind === 'point' || sel?.kind === 'equip') { this.applyArm(slot); return; }
      this.renderPrep();
      const u = getOwned(r, slot);
      if (u) {
        const target = this.prep?.querySelector<HTMLElement>(`.prep-owned[data-slot="${slot}"]`) ?? el;
        const init = out.initial.find(x => x.side === 0 && x.slot === slot);
        const st = init ? out.afterStart[init.uid - 1] : { ...this.ownedStats(u), chill: 0, burn: 0, power: ownedPower(u.defId, unitLevel(u), this.preparedOwned(u)) };
        const tip = unitTip(u.defId, unitLevel(u), st);
        const extra = this.ownedExtra(u, slot); if (extra) tip.append(extra);
        tipAt(target, tip);
      }
    };
    for (const u of out.initial) {
      const v = new UnitView(u.defId, u.side, u.slot, u.level);
      const after = out.afterStart[u.uid - 1];
      v.setStats(statsOf(after), { base: { atk: u.atk, hp: u.hp } });
      v.el.classList.toggle('doomed', !after.alive);
      if (!after.alive) v.addTag('开战时阵亡', 'death');
      v.el.setAttribute('aria-label', `${u.side ? '敌方' : '我方'}${u.slot + 1}格 ${unitDef(u.defId).name}`);
      if (u.side === 0) {
        v.el.classList.add('prep-owned');
        markOwned(v.el, u.slot);
        v.el.classList.toggle('selected', this.prepFocus === u.slot || sel?.kind === 'point' || sel?.kind === 'equip');
        activate(v.el, e => selectOwned(u.slot, v.el, e));
      } else activate(v.el, e => { e.stopPropagation(); tipAt(v.el, unitTip(u.defId, u.level, after, false)); });
      if (u.side === 0) {
        const seat = seats.get(u.slot)!;
        seat.querySelector('.prep-figure')!.append(v.el);
        seat.append(refunds(u.slot));
      } else {
        enemies.append(h('div', { class: 'prep-enemy', style: `--s:${u.slot}` }, seatArt(), v.el));
      }
    }
    const bench = h('div', { class: 'prep-bench', 'aria-label': '备战' });
    for (const slot of r.bench.map((_, k) => 5 + k)) {
      const u = getOwned(r, slot);
      if (!u) { bench.append(h('div', { class: 'prep-bench-empty' }, seatArt(), h('div', { class: 'prep-position' }, '备战'))); continue; }
      const v = new UnitView(u.defId, 0, slot, unitLevel(u));
      const st = this.ownedStats(u);
      v.setStats({ ...st, maxHp: st.hp, chill: 0, burn: 0,
        kw: keywordsOf({ defId: u.defId, level: unitLevel(u), grants: st.grants, power: ownedPower(u.defId, unitLevel(u), u) }) });
      v.el.classList.add('prep-owned');
      markOwned(v.el, slot);
      v.el.classList.toggle('selected', this.prepFocus === slot || sel?.kind === 'point' || sel?.kind === 'equip');
      v.el.setAttribute('aria-label', `备战${slot - 4} ${unitDef(u.defId).name}`);
      activate(v.el, e => selectOwned(slot, v.el, e));
      bench.append(h('div', { class: 'prep-seat prep-bench-seat' }, h('div', { class: 'prep-figure' }, seatArt(), v.el), refunds(slot), h('div', { class: 'prep-position' }, '备战')));
    }
    const focused = typeof this.prepFocus === 'number' ? getOwned(r, this.prepFocus) : null;
    const actions = h('div', { class: 'prep-unit-actions' });
    if (focused && typeof this.prepFocus === 'number') {
      const slot = this.prepFocus;
      (focused.equips ?? []).forEach((id, i) => {
        const b = h('button', { class: 'prep-unequip pr-chip eq', 'aria-label': `卸下${EQUIP_MAP[id]?.name ?? id}` }, itemIcon(id, 'spell'), '卸下');
        b.addEventListener('click', act(() => this.allowTutorial({ kind: 'unequip' }) && unequip(r, slot, i)));
        actions.append(b);
      });
    }

    // 主将：只收法强
    const g = generalDefinition(r.general, r.tacticsVersion);
    const genOn = sel?.kind === 'point' && !!POINT_MAP[sel.type]?.toGeneral && canTrainGeneral(r);
    const gen = h('div', { class: `pu-card gen${genOn ? ' target' : ''}`, style: `--fc:${FACTION_INFO[g.faction].color}` },
      h('div', { class: 'pu-art', html: unitSvg(null, { general: g.id, tier2: promoted(r) }) }),
      h('div', { class: 'pu-lv' }, '主将'),
      h('b', { class: 'pu-name' }, g.name),
      canTrainGeneral(r) ? h('div', { class: 'pu-stat', 'aria-label': `主将法强 ${r.genPower}` }, h('span', { class: 'p' }, pxIcon('power'), num(r.genPower, r.genPower))) : null,
      refunds('general'),
    );
    gen.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.editable || this.adPending) return;
      const s = this.sel;
      if (!genOn || s?.kind !== 'point') {
        this.prepFocus = 'general'; this.renderPrep();
        const target = this.prep?.querySelector<HTMLElement>('.pu-card.gen') ?? gen;
        tipAt(target, generalTip(g.id, this.base.genPower, this.base.passives, this.base.tacticsVersion)); return;
      }
      hideTip();
      if (!this.allowTutorial({ kind: 'alloc', to: 'general', type: s.type })) return;
      const from = this.chipPos(s.type);
      if (!allocPoint(r, 'general', s.type)) { sfx.fizzle(); return; }
      sfx.merge();
      if (!(r.stash[s.type] > 0)) this.sel = null;
      this.save(); this.renderAll(); this.allocFx(s.type, from, 'general'); this.emit('alloc');
    });

    // 资源托盘
    const chip = (cls: string, on: boolean, kids: (HTMLElement | string | number | null)[], fn: (e: Event) => void) => {
      const b = h('button', { class: `pr-chip ${cls}${on ? ' on' : ''}` }, ...kids);
      b.addEventListener('click', fn);
      return b;
    };
    const group = (cls: string, label: string, items: HTMLElement[]) =>
      items.length ? h('div', { class: `pr-group ${cls}` }, h('span', { class: 'pr-label' }, label), h('div', { class: 'pr-items' }, items)) : null;
    const pts = POINT_TYPES.filter((p) => r.stash[p.id] > 0).map((p) =>
      chip(`pt pt-${p.id}`, sel?.kind === 'point' && sel.type === p.id, [pxIcon(p.id), h('i', null, r.stash[p.id]),
        h('span', { class: 'pr-cap' }, `${p.name} ${p.text.match(/\+\s*\d+/)?.[0].replace(/\s/g, '') ?? ''}`.trim())], act(pick({ kind: 'point', type: p.id }))));
    const eqs = r.bag.map((id, i) =>
      chip('eq', sel?.kind === 'equip' && sel.idx === i, [itemIcon(id, 'spell'), h('span', null, EQUIP_MAP[id]?.name ?? id)], act(pick({ kind: 'equip', idx: i }))));
    const sps = [
      ...r.activeSpells.map((id) => chip('sp', true, [itemIcon(id, 'spell'), h('span', null, SPELL_MAP[id]?.name ?? id)], act(() => this.allowTutorial({ kind: 'spell' }) && unuseSpell(r, id)))),
      ...r.spells.map((id, i) => chip('sp', false, [itemIcon(id, 'spell'), h('span', null, SPELL_MAP[id]?.name ?? id)], act(() => this.allowTutorial({ kind: 'spell' }) && useSpell(r, i), () => sfx.trigger()))),
    ];
    const ods = r.orders.map((id, i) => chip('od', false, [itemIcon(id, 'order'), h('span', null, ORDER_MAP[id]?.name ?? id)], (e) => {
      e.stopPropagation(); if (!this.editable || !this.allowTutorial({ kind: 'order' })) return; sfx.click(); this.closePrep(); this.showOrder(i);
    }));
    const groups = [group('g-pt', '培养', pts), group('g-eq', '装备', eqs), group('g-sp', '法术', sps), group('g-od', '招募令', ods)].filter(Boolean);

    // 一行说明：选中的资源干什么、点哪里
    let say: (string | Node)[] = [];
    if (sel?.kind === 'point') { const p = POINT_MAP[sel.type]; say = [h('b', null, p.name), ...kwRich(p.text)]; }
    else if (sel?.kind === 'equip') { const e = EQUIP_MAP[r.bag[sel.idx]]; say = [h('b', null, e?.name ?? ''), ...kwRich(e?.text ?? '')]; }
    else if (r.activeSpells.length) say = [h('b', null, '本场法术'), r.activeSpells.map((id) => SPELL_MAP[id]?.name ?? id).join('、')];
    else if (pts.length || eqs.length) say = ['选资源，再点单位'];


    const done = h('button', { class: 'btn primary prep-done' }, h('span', null, '完成'));
    done.addEventListener('click', (e) => { e.stopPropagation(); sfx.click(); this.closePrep(); this.renderAll(); });
    gen.setAttribute('aria-label', `主将 ${g.name}`);
    gen.tabIndex = 0; gen.setAttribute('role', 'button');
    gen.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); gen.click(); } });
    ov.replaceChildren(h('div', { class: 'prep-panel' },
      enemies, gen, done, roster,
      h('div', { class: `pp-say${sel?.kind === 'point' || sel?.kind === 'equip' ? ' on' : ''}` }, ...say),
      h('div', { class: 'pp-tray' }, actions, groups.length ? groups : h('div', { class: 'pp-empty' }, '战斗胜利获得培养点'))));
    roster.append(allies, bench);
    ov.querySelector<HTMLElement>('.pp-tray')!.scrollLeft = trayLeft;
    if (focusOwner && focusPoint) {
      const button = ov.querySelector<HTMLElement>(`.prep-refund[data-owner="${focusOwner}"][data-point="${focusPoint}"]`);
      const fallback = focusOwner === 'general' ? ov.querySelector<HTMLElement>('.pu-card.gen') : ov.querySelector<HTMLElement>(`.prep-owned[data-slot="${focusOwner}"]`);
      (button ?? fallback)?.focus({ preventScroll: true });
    }

  }

  private showOrder(index: number) {
    const r = this.run;
    const kind = r.orders[index];
    if (!kind) return;
    if (r.picks <= 0) { this.app.showRewardNotice('本轮招募已完成', '下一轮招募时再使用招募令', 'error'); return; }
    const opts = orderOptions(r, kind);
    let close = () => {};
    const label = (o: string) => kind === 'o_faction' ? FACTION_INFO[o as keyof typeof FACTION_INFO]?.name ?? o : kind === 'o_named' ? unitDef(o).name : o;
    const buttons = opts.map(o => h('button', { class: 'btn ghost', onclick: () => {
      if (!this.editable || !useOrder(r, index, o)) return;
      this.sel = null; hideTip(); sfx.swap(); close(); this.save(); this.renderAll(); this.cardsIn();
    } }, label(o)));
    close = this.app.modal(h('div', { class: 'content-dialog refresh-dialog' }, h('h3', null, ORDER_MAP[kind].name), h('p', null, ORDER_MAP[kind].text),
      h('div', { class: 'refresh-options' }, buttons.length ? buttons : h('span', null, '暂无可用目标'))), 'wide');
  }

  // ───────────── 节点界面：商店 / 分岔 / 精英奖励 / 主将升阶 ─────────────

  private closePanel(syncMusic = true) {
    this.panel?.remove();
    this.panel = null;
    if (syncMusic) this.syncMusicState();
  }

  private showPhase(sc: Exclude<Screen, 'over' | 'prep'>) {
    if (sc === 'shop') this.tut?.fixDraft(this.run);
    this.mode = 'phase';
    this.tray.classList.add('hidden');
    this.dock.classList.add('hidden');
    this.armHint.classList.add('hidden');
    const body = sc === 'shop' ? this.shopPanel() : sc === 'fork' ? this.forkPanel() : sc === 'reward' ? this.rewardPanel() : this.promoPanel();
    this.closePanel(false);
    this.panel = h('div', { class: `phase-ov ph-${sc}` }, body);
    this.el.appendChild(this.panel);
    this.syncMusicState();
    if (sc === 'promo') {
      const panel = this.panel;
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-label', modernTactics(this.run) ? '选择战术' : `${generalDefinition(this.run.general).name}升阶`);
      // Scope the trap to this dialog so independently focused coach/modal controls keep their own input.
      panel.addEventListener('keydown', e => {
        if (e.key !== 'Tab') return;
        const options = [...panel.querySelectorAll<HTMLButtonElement>(':is(.ph-opt.passive, .promo-ok):not(:disabled)')];
        if (!options.length) return;
        e.preventDefault(); e.stopPropagation();
        const i = options.indexOf(document.activeElement as HTMLButtonElement);
        const next = i < 0 ? (e.shiftKey ? options.length - 1 : 0)
          : (i + (e.shiftKey ? -1 : 1) + options.length) % options.length;
        options[next].focus({ preventScroll: true });
      });
      requestAnimationFrame(() => {
        this.coach();
        if (this.panel !== panel || !panel.isConnected) return;
        if (document.activeElement?.closest('.coach, .modal-ov')) return;
        panel.querySelector<HTMLButtonElement>('.ph-opt.passive:not(:disabled)')?.focus({ preventScroll: true });
      });
    }
  }

  private phaseDone() {
    this.save();
    sfx.click();
    this.proceed();
  }

  private shopPanel() {
    const r = this.run, s = r.shop!;
    const unitBuys = shopUnitBuysRemaining(r);
    // 手机防误触：点一下只选中并在右侧说明栏展开详情，再点「购买」才扣金币；出售改为把阵容头像拖进出售框
    type Good = { key: string; kind: Parameters<typeof buy>[1]; i: number; name: string; text: string; unitStats?: { atk: number; hp: number }; price: number; sold: boolean; cls: string; icon: HTMLElement; block?: string };
    const doBuy = (g: Good) => {
      const sig = () => allOwned(r).map(u => u ? `${u.ownedId}:${u.copies}` : '');
      const before = sig(), from = this.panel?.querySelector('.sh-buy')?.getBoundingClientRect();
      if (this.mode !== 'phase' || !this.allowTutorial({ kind: 'buy', category: g.kind, index: g.i }) || !buy(r, g.kind, g.i)) { sfx.fizzle(); return; }
      this.shopSel = null;
      sfx.reward(); this.save(); this.renderAll(); this.showPhase('shop');
      if (g.kind === 'equips') this.emit('buy-equips');
      this.buyFeedback(g.kind, g.kind === 'units' ? s.units[g.i].id : null, before, sig(), from);
    };
    const pick = (key: string | null) => { sfx.click(); this.shopSel = key; this.showPhase('shop'); };
    const price = (n: number, sold: boolean) => h('span', { class: `sh-price${sold ? ' sold' : r.gold < n ? ' poor' : ''}` }, sold ? '已售' : h('span', null, itemIcon('coin', 'coin', 'sm'), `${n}`));
    const goods: Good[] = [
      ...s.units.map((it, i) => {
        const d = unitDef(it.id), st = levelStats(it.id, 1);
        return { key: `units:${i}`, kind: 'units' as const, i, name: d.name, text: abilityText(it.id, 1), unitStats: st, price: it.price, sold: it.sold, cls: 'un', icon: h('span'),
          block: !it.sold && unitBuys <= 0 ? '本店已购买2名单位' : !it.sold && unitDestination(r, it.id) === null ? '没空位了：先拖一个单位去出售' : undefined };
      }),
      ...s.equips.map((it, i) => ({ key: `equips:${i}`, kind: 'equips' as const, i, name: EQUIP_MAP[it.id].name, text: EQUIP_MAP[it.id].text, price: it.price, sold: it.sold, cls: 'eq', icon: itemIcon(it.id) })),
      ...s.spells.map((it, i) => ({ key: `spells:${i}`, kind: 'spells' as const, i, name: SPELL_MAP[it.id].name, text: SPELL_MAP[it.id].text, price: it.price, sold: it.sold, cls: 'sp', icon: itemIcon(it.id, 'spell') })),
      ...(s.boon ? [{ key: 'boon:0', kind: 'boon' as const, i: 0, name: PASSIVE_MAP[s.boon.id].name, text: `本次远征持续生效：${PASSIVE_MAP[s.boon.id].text}`, price: s.boon.price, sold: s.boon.sold, cls: 'sp', icon: itemIcon('sp_haste', 'spell') }] : []),
      ...(s.order ? [{ key: 'order:0', kind: 'order' as const, i: 0, name: ORDER_MAP[s.order.id].name, text: ORDER_MAP[s.order.id].text, price: s.order.price, sold: s.order.sold, cls: 'od', icon: itemIcon(s.order.id, 'order') }] : []),
      ...(s.pack ? [{ key: 'pack:0', kind: 'pack' as const, i: 0, name: '培养包', text: `内含：${s.pack.points.map(p => POINT_MAP[p].name).join('、')}`, price: s.pack.price, sold: s.pack.sold, cls: 'pk', icon: itemIcon('pack', 'pack') }] : []),
    ];
    const sel = goods.find(g => g.key === this.shopSel && !g.sold) ?? null;
    const owned = allOwned(r);
    const ownSel = this.shopSel?.startsWith('own:') ? Number(this.shopSel.slice(4)) : -1;
    const ownU = ownSel >= 0 ? owned[ownSel] ?? null : null;
    // 选中商店里的单位时，阵容中同名的单位亮起：一眼看出买了能不能合并升星
    const matchId = sel?.kind === 'units' ? s.units[sel.i].id : null;
    const tile = (g: Good, body: HTMLElement[]) => {
      const b = h('button', { class: `${g.kind === 'units' ? 'sh-unit' : `sh-item ${g.cls}`}${g.sold ? ' sold' : ''}${g.block ? ' unavailable' : ''}${sel === g ? ' on' : ''}`, disabled: g.sold, 'aria-pressed': String(sel === g), 'aria-label': `${g.name}，${g.price} 金` }, ...body);
      b.addEventListener('click', () => pick(sel === g ? null : g.key));
      return b;
    };
    const units = goods.filter(g => g.kind === 'units').map(g => tile(g, [draftCard(s.units[g.i].id), g.block ? h('span', { class: 'sh-price poor' }, unitBuys <= 0 ? '已达购买上限' : '无空位') : price(g.price, g.sold)]));
    const items = goods.filter(g => g.kind !== 'units').map(g => tile(g, [h('span', { class: 'sh-icon' }, g.icon), h('b', null, g.name), price(g.price, g.sold)]));

    // 说明栏：选中商品的完整说明 + 购买按钮
    let detail: HTMLElement;
    if (ownU) {
      const d = unitDef(ownU.defId), lv = unitLevel(ownU), st = this.ownedStats(ownU);
      const eqs = (ownU.equips ?? []).map(id => EQUIP_MAP[id]?.name ?? id);
      const train = Object.entries(ownU.train ?? {}).filter(([, n]) => n).map(([k, n]) => `${POINT_MAP[k]?.short ?? k}+${n}`);
      const extra = [eqs.length ? `装备：${eqs.join('、')}` : '', train.length ? `培养：${train.join(' ')}` : ''].filter(Boolean).join('　');
      detail = h('div', { class: 'sh-detail own' },
        tierArt('sh-icon art', ownU.defId, unitDef(ownU.defId).tier, 'span'),
        h('div', { class: 'sh-desc' },
          h('b', null, d.name, h('i', { class: 'sh-stars' }, '★'.repeat(lv))),
          h('span', { class: 'sh-pos' }, ownSel < 5 ? `战斗席 ${ownSel + 1} 号位` : '备战席'),
          h('span', { class: 'sh-st px' }, statArt('atk', st.atk), statArt('hp', st.hp), st.block ? h('span', { class: 'kwic kw-block' }, h('i', null, st.block)) : null),
          h('p', null, ...kwRich(abilityText(ownU.defId, lv, ownedPower(ownU.defId, lv, ownU))), extra ? h('span', { class: 'sh-extra' }, `　${extra}`) : null)),
        h('div', { class: 'sh-sellhint' }, h('span', null, sellBlockReason(r, ownSel) ?? '拖进出售框卖出'), canSell(r, ownSel) ? h('b', null, itemIcon('coin', 'coin', 'sm'), `+${sellPrice(ownU, r)}`) : null));
    } else if (sel) {
      const why = sel.block ?? (r.gold < sel.price ? `金币不足（还差 ${sel.price - r.gold}）` : '');
      const go = h('button', { class: 'btn primary sh-buy', disabled: !!why }, h('span', null, '购买'), h('span', { class: 'sh-buy-p' }, itemIcon('coin', 'coin', 'sm'), `${sel.price}`));
      go.addEventListener('click', () => doBuy(sel));
      detail = h('div', { class: `sh-detail ${sel.cls}` },
        sel.kind === 'units' ? tierArt('sh-icon art', s.units[sel.i].id, unitDef(s.units[sel.i].id).tier, 'span') : h('span', { class: 'sh-icon' }, itemIcon(sel.key.startsWith('equips') ? s.equips[sel.i].id : sel.kind === 'spells' ? s.spells[sel.i].id : sel.kind, sel.kind === 'order' ? 'order' : sel.kind === 'pack' ? 'pack' : 'spell')),
        h('div', { class: 'sh-desc' }, h('b', null, sel.name), matchId ? this.heldNote(matchId) : null,
          sel.unitStats ? h('span', { class: 'sh-st px' }, statArt('atk', sel.unitStats.atk), statArt('hp', sel.unitStats.hp)) : null,
          h('p', null, why ? h('em', null, why, '。') : null, ...kwRich(sel.text))),
        go);
    } else detail = h('div', { class: 'sh-detail empty' }, h('span', { class: 'sh-icon' }, itemIcon('pack', 'pack')), h('p', null, '点选商品查看说明'));

    const refresh = h('button', { class: 'btn ghost', disabled: r.gold < s.refreshCost }, icon('refresh'), h('span', null, `刷新 ${s.refreshCost} 金`));
    refresh.addEventListener('click', () => {
      if (!this.allowTutorial({ kind: 'shop-refresh' }) || !refreshShop(r)) { sfx.fizzle(); return; }
      this.shopSel = null;
      sfx.swap(); this.save(); this.renderHud(); this.showPhase('shop');
    });

    // 阵容：按住头像拖进出售框才卖出；点一下只提示
    // 阵容：战斗席 5 格 + 预备格（萨吉）都列出来（空格也画），点一下看现状，按住拖进出售框才卖出
    const bin = h('div', { class: 'sh-bin' }, itemIcon('coin', 'coin'), h('span', null, '拖入出售'));
    const seat = (u: Slotted | null, i: number) => {
      const tag = i < 5 ? `${i + 1}` : '备';
      if (!u) return h('div', { class: 'sh-own empty' }, h('span', { class: 'sh-seat' }, tag), h('span', { class: 'sh-none' }, '空'));
      const st = this.ownedStats(u), lv = unitLevel(u);
      const b = h('div', { class: `sh-own${ownSel === i ? ' on' : ''}${matchId === u.defId ? ' match' : ''}`, role: 'button', tabindex: 0, 'aria-pressed': String(ownSel === i), 'aria-label': `${unitDef(u.defId).name} ${lv} 星，${st.atk} 攻 ${st.hp} 血，${sellBlockReason(r, i) ?? `拖到出售框卖出 ${sellPrice(u, this.run)} 金`}` },
        tierArt('sh-own-art', u.defId, unitDef(u.defId).tier, 'span'),
        h('span', { class: 'sh-seat' }, tag),
        u.equips?.length ? h('span', { class: 'sh-own-eq' }, itemIcon(u.equips[0], 'spell', 'sm')) : null,
        h('i', null, '★'.repeat(lv)),
        h('span', { class: 'sh-own-st px' }, statArt('atk', st.atk), statArt('hp', st.hp)));
      b.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(ownSel === i ? null : `own:${i}`); }
      });
      b.addEventListener('pointerdown', e => this.shopSellDrag(e, b, bin, i, u.defId, () => pick(ownSel === i ? null : `own:${i}`)));
      return b;
    };
    const field = owned.slice(0, 5).map((u, i) => seat(u, i));
    const reserve = owned.slice(5).map((u, i) => seat(u, i + 5));
    const leave = h('button', { class: 'btn primary sh-leave' }, h('span', null, '离开商店'), icon('play'));
    leave.addEventListener('click', () => { if (this.allowTutorial({ kind: 'leave-shop' }) && leaveShop(r)) { this.shopSel = null; this.phaseDone(); } });
    return h('div', { class: 'ph-card shop px-panel' },
      h('div', { class: 'ph-head' }, h('b', null, '商店'), h('span', { class: 'sh-gold' }, itemIcon('coin', 'coin'), `${r.gold}`), modernTactics(r) ? h('span', { class: 'sh-unit-budget', role: 'status' }, `单位可购 ${unitBuys}/2`) : refresh, leave),
      h('div', { class: 'sh-market' },
        h('div', { class: 'sh-catalog' },
          h('div', { class: 'sh-units' }, units),
          h('div', { class: 'sh-goods' }, items)),
        detail),
      h('div', { class: 'sh-roster' },
        h('div', { class: 'sh-grp' }, h('span', { class: 'dk-label' }, '战斗席'), h('div', { class: 'sh-owns' }, field)),
        reserve.length ? h('div', { class: 'sh-grp' }, h('span', { class: 'dk-label' }, '预备'), h('div', { class: 'sh-owns' }, reserve)) : null,
        bin));
  }

  /** 商店购买去向：单位飞进落脚的席位并闪一下；有空战位时点亮它；其他商品提示放进了整备 */
  private buyFeedback(kind: ShopKind, defId: string | null, before: string[], after: string[], from?: DOMRect) {
    if (kind !== 'units' || !defId) {
      const where: Partial<Record<ShopKind, string>> = { equips: '已放入整备', spells: '已放入整备', pack: '培养点已放入整备', order: '已放入整备，招募时使用' };
      if (where[kind]) this.app.showRewardNotice('购买成功', where[kind]!);
      return;
    }
    const seats = [...(this.panel?.querySelectorAll<HTMLElement>('.sh-roster .sh-own') ?? [])];
    const dest = after.findIndex((v, k) => v && v !== before[k]);
    const seat = seats[dest];
    if (!seat) return;
    seat.classList.add('just-in');
    const free = dest >= 5 ? after.slice(0, 5).findIndex(v => !v) : -1;
    if (free >= 0) seats[free]?.classList.add('slot-free');
    if (!from) return;
    const a = toStage(from.left + from.width / 2, from.top + from.height / 2), rc = seat.getBoundingClientRect();
    const b = toStage(rc.left + rc.width / 2, rc.top + rc.height / 2);
    const ghost = h('div', { class: 'buy-fly', html: unitSvg(defId), style: `left:${a.x}px;top:${a.y}px` });
    this.el.appendChild(ghost);
    ghost.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${b.x - a.x}px),calc(-50% + ${b.y - a.y}px)) scale(.5)`, opacity: 0.6 }],
      { duration: 420, easing: 'cubic-bezier(.3,.7,.4,1)' }).onfinish = () => ghost.remove();
  }

  private preparedOwned(u: Slotted): Slotted {
    if (this.mode !== 'prep' || this.sandbox) return u;
    const projected = previewPreparation(this.run);
    return [...projected.slots, ...projected.bench].find(x => x?.ownedId === u.ownedId) ?? u;
  }

  /** Includes pending preparation growth; excludes battle-only opening abilities. */
  private ownedStats(u: Slotted) {
    u = this.preparedOwned(u);
    const b = levelStats(u.defId, unitLevel(u));
    const t = { atk: b.atk, hp: b.hp, maxHp: b.hp, block: 0, grants: {} as Record<string, number> };
    t.atk += u.growth?.atk ?? 0; t.hp += u.growth?.hp ?? 0; t.maxHp = t.hp;
    for (const [k, n] of Object.entries(u.train ?? {})) if (n && POINT_MAP[k]) POINT_MAP[k].apply(t as never, n);
    for (const id of u.equips ?? []) { const e = EQUIP_MAP[id]; if (e) { t.atk = Math.max(1, t.atk + (e.atk ?? 0)); t.hp += e.hp ?? 0; } }
    return t;
  }

  /** 商店单位的已持有情况：只给客观信息，不标“推荐” */
  private heldNote(defId: string) {
    const same = allOwned(this.run).filter((u): u is Slotted => !!u && u.defId === defId);
    if (!same.length) return null;
    const mergeable = same.some(u => !u.temp && u.copies < MAX_COPIES);
    return h('span', { class: 'sh-held' }, `已持有 ${same.map(u => '★'.repeat(unitLevel(u))).join(' / ')}${mergeable ? '，可叠加' : ''}`);
  }

  private shopSellDrag(e: PointerEvent, src: HTMLElement, bin: HTMLElement, idx: number, defId: string, onTap: () => void) {
    if (e.button > 0) return;
    e.preventDefault();
    src.setPointerCapture(e.pointerId);
    const x0 = e.clientX, y0 = e.clientY;
    let ghost: HTMLElement | null = null;
    const over = (ev: PointerEvent) => {
      const b = bin.getBoundingClientRect();
      return ev.clientX >= b.left && ev.clientX <= b.right && ev.clientY >= b.top && ev.clientY <= b.bottom;
    };
    const move = (ev: PointerEvent) => {
      if (!ghost && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 10) return;
      if (!ghost) { ghost = h('div', { class: 'drag-ghost', html: unitSvg(defId) }); this.el.appendChild(ghost); src.classList.add('lifted'); bin.classList.add('live'); }
      const p = toStage(ev.clientX, ev.clientY);
      ghost.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-60%)`;
      bin.classList.toggle('hot', over(ev));
    };
    const end = (ev: PointerEvent) => {
      src.removeEventListener('pointermove', move);
      src.removeEventListener('pointerup', end);
      src.removeEventListener('pointercancel', end);
      src.classList.remove('lifted'); bin.classList.remove('live', 'hot');
      if (!ghost) {
        // 只是点了一下：查看这个单位的现状
        if (ev.type === 'pointerup') onTap();
        return;
      }
      ghost.remove();
      if (ev.type === 'pointerup' && over(ev) && this.mode === 'phase' && this.allowTutorial({ kind: 'sell', slot: idx }) && sell(this.run, idx)) {
        this.shopSel = null;
        sfx.reward(); this.save(); this.renderAll(); this.showPhase('shop'); this.emit('sell');
      }
    };
    src.addEventListener('pointermove', move);
    src.addEventListener('pointerup', end);
    src.addEventListener('pointercancel', end);
  }

  private forkPanel() {
    const st = currentStage(this.run) as Extract<Stage, { type: 'fork' }>;
    const opt = (pick: 'normal' | 'elite', n: RouteNode, reward: string) => {
      const b = h('button', { class: `ph-opt fork-${pick}` },
        h('div', { class: 'rp-head' }, h('span', { class: 'sb-kind' }, pick === 'elite' ? '精英' : '普通'), h('b', null, n.name)),
        this.lineupEl(n),
        n.hint ? h('div', { class: 'rp-hint' }, icon('bolt'), h('span', null, ...kwRich(n.hint))) : null,
        h('div', { class: 'ph-reward' }, reward));
      b.addEventListener('click', () => { if (pickFork(this.run, pick)) this.phaseDone(); });
      return b;
    };
    return h('div', { class: 'ph-card fork' },
      h('div', { class: 'ph-head' }, h('b', null, '岔路'), h('span', null, '选择一条路线')),
      h('div', { class: 'ph-opts' },
        opt('normal', st.normal, '胜利：3 金 + 3 培养点'),
        opt('elite', st.elite, '胜利：5 金 + 4 培养点 + 装备三选一')));
  }

  private rewardPanel() {
    const r = this.run;
    return h('div', { class: 'ph-card reward' },
      h('div', { class: 'ph-head' }, h('b', null, '精英战利品'), h('span', null, '选择一件装备放入背包')),
      h('div', { class: 'ph-opts' }, r.reward!.map((id, i) => {
        const b = h('button', { class: 'ph-opt eq' }, itemIcon(id), h('b', null, EQUIP_MAP[id].name), h('p', null, ...kwRich(EQUIP_MAP[id].text)));
        b.addEventListener('click', () => { if (chooseReward(r, i)) { sfx.reward(); this.phaseDone(); } });
        return b;
      })));
  }

  private promoPanel() {
    const r = this.run;
    const g = generalDefinition(r.general, r.tacticsVersion);
    // 先选中、再按「确定」才生效，防误触
    let pick = -1;
    const ok = h('button', { class: 'btn primary promo-ok', disabled: true }, h('span', null, '确定'));
    ok.addEventListener('click', () => { if (pick >= 0 && choosePromo(r, pick)) { sfx.reward(); this.renderHud(); this.phaseDone(); } });
    const opts = r.promo!.map((id, i) => {
      const p = PASSIVE_MAP[id];
      const b = h('button', { class: `ph-opt passive${p.general ? ' own' : ''}`, 'aria-pressed': 'false' },
        h('span', { class: 'promo-ic' }, icon(tacticIcon(p))),
        p.general ? h('span', { class: 'sb-kind' }, '专属') : null, h('b', null, p.name), h('p', null, ...kwRich(p.text)));
      b.addEventListener('click', () => {
        sfx.click(); pick = i;
        opts.forEach((o, k) => { o.classList.toggle('on', k === i); o.setAttribute('aria-pressed', String(k === i)); });
        ok.disabled = false;
      });
      return b;
    });
    return h('div', { class: 'ph-card promo', style: `--fc:${FACTION_INFO[g.faction].color}` },
      h('div', { class: 'ph-head' }, h('div', { class: 'promo-art', html: unitSvg(null, { general: g.id, tier2: true }) }), h('b', null, modernTactics(r) ? '选择战术' : `${g.name} 升阶`), modernTactics(r) ? null : h('span', null, '选择一个主将被动')),
      h('div', { class: 'ph-opts' }, opts),
      h('div', { class: 'promo-foot' }, ok));
  }

  // ───────────── 路线预览 ─────────────

  private closePopover() {
    this.popover?.remove();
    this.popover = null;
  }

  private lineupEl(n: RouteNode) {
    return h(
      'div',
      { class: 'rp-units' },
      n.lineup.map((e, k) => {
        if (!e) return h('div', { class: 'rp-unit empty' }, h('i', null, k + 1));
        const d = unitDef(e.defId);
        return h(
          'div',
          { class: 'rp-unit' },
          h('div', { class: 'rp-art', html: unitSvg(e.defId, { enemy: true }) }),
          h('div', { class: 'rp-stats' }, statArt('atk', e.atk ?? d.atk), statArt('hp', e.hp ?? d.hp)),
          h('div', { class: 'rp-name' }, d.name),
          d.keywords?.length ? h('div', { class: 'rp-kw' }, kwTag(d.keywords[0])) : null,
        );
      }),
    );
  }

  private stageNodes(st: Stage, i: number): RouteNode[] {
    switch (st.type) {
      case 'shop': return [];
      case 'boss': return [st.main];
      case 'fork': return [st.normal, st.elite];
      case 'battle': return [st.variant && this.run.variantChoices[`${this.run.chapter}:${i}`] ? st.variant : st.main];
    }
  }

  private showRoutePreview(i: number, anchor: HTMLElement) {
    this.closePopover();
    const st = currentStage(this.run, i);
    const nodes = this.stageNodes(st, i);
    const r = anchor.getBoundingClientRect();
    const p = toStage(r.left + r.width / 2, r.bottom);
    const left = Math.max(16, Math.min(1280 - 436, p.x - 210));
    const kind = st.type === 'boss' ? 'boss' : st.type === 'fork' ? 'elite' : 'normal';
    const pop = h(
      'div',
      { class: `route-pop k-${kind}`, style: `left:${left}px;top:${p.y + 12}px;--ax:${p.x - left}px` },
      st.type === 'shop'
        ? h('div', { class: 'rp-head' }, h('b', null, '商店'), h('span', { class: 'rp-no' }, '用金币购买单位、装备、法术与培养点'))
        : null,
      nodes.map((n, k) => [
        h(
          'div',
          { class: 'rp-head' },
          st.type === 'fork' ? h('span', { class: 'sb-kind' }, k ? '精英线' : '普通线') : KIND_TEXT[n.kind] ? h('span', { class: 'sb-kind' }, KIND_TEXT[n.kind]) : null,
          h('b', null, n.name),
        ),
        this.lineupEl(n),
        n.hint ? h('div', { class: 'rp-hint' }, icon('bolt'), h('span', null, ...kwRich(n.hint))) : st.type === 'fork' ? null : h('div', { class: 'rp-hint calm' }, '没有特殊题型'),
      ]),
    );
    this.el.appendChild(pop);
    this.popover = pop;
    pop.animate([{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 180, easing: 'ease-out' });
  }

  // ───────────── 战斗 ─────────────

  private async startBattle(passed?: BattleCtx) {
    if (this.disposed || this.adPending) return;
    if (!this.allowTutorial({ kind: 'battle' })) return;
    if (!passed && !this.editable) return;
    const ctx: BattleCtx =
      passed ??
      (this.mode === 'sandbox' && this.sandbox
        ? { kind: 'sandbox', base: this.sandbox.base, slots: cloneSlots(this.sandbox.slots), bench: cloneSlots(this.sandbox.bench), checkpoint: null }
        : {
            kind: 'official',
            base: this.run,
            slots: cloneSlots(this.run.slots),
            bench: cloneSlots(this.run.bench),
            checkpoint: cloneRun(this.run),
          });
    if (!ctx.slots.some(Boolean)) return;
    this.clearDrag();
    this.dropCoach();
   
    this.mode = ctx.kind === 'sandbox' ? 'sandboxBattle' : 'battle';
    this.sel = null;
    clearTimeout(this.focusTimer);
    this.focus = this.hover = null;
    this.board.el.classList.remove('focusing');
    hideTip();
    this.closePopover();
    this.board.clearArrows();
    this.board.clearMarks();
    this.board.el.classList.remove('dropping');
    this.board.setSlotClass('drop-hover', () => false);
    for (let s = 0; s < SLOTS; s++) this.board.slotEl(0, s).dataset.drop = '';
    this.tray.classList.add('hidden');
    this.dock.classList.add('hidden');
    this.armHint.classList.add('hidden');
    this.renderBar();
    this.bar.classList.add('on');
    this.el.classList.add('in-battle');
    if (ctx.kind === 'retry') {
      this.renderBanner();
      append(this.banner, h('div', { class: 'sb-sandbox sb-retry' }, icon('bolt'), '广告重打 · 正式计入远征'));
    }
    sfx.click();
    const out = simulate({ ...buildBattle(ctx.checkpoint ?? ctx.base, ctx.slots, ctx.bench), record: true });
    if (out.fault) {
      if (ctx.kind === 'retry') { this.mode = 'sandbox'; this.run.rewardedRetryCount = Math.max(0, this.run.rewardedRetryCount - 1); this.persist(); }
      else this.mode = ctx.kind === 'sandbox' ? 'sandbox' : 'prep';
      this.resetBattleUi(); this.renderAll();
      this.app.showRewardNotice('战斗中止', '已回到战前，生命和招募都没结算。调整阵容再打。', 'error');
      console.error('battle fault', { seed: this.run.seed, chapter: ctx.base.chapter, node: ctx.base.node, fault: out.fault });
      return;
    }
    // 正式战：结果先算出并存档，中途退出也按这一结果结算
    if (ctx.kind === 'official') {
      beginBattle(this.run, out.result, out.gold ?? 0, out.eggStats);
      if (!this.tutorial) recordOfficialBattle(this.run, out, ctx.checkpoint!, ctx.slots, ctx.bench);
      this.persist();
      this.emit('battle-start');
    }
    const pb = new Playback(this.board, this.app.fx, out);
    pb.speed = this.speed;
    pb.genEl = () => this.el.querySelector<HTMLElement>('.hud-general');
    pb.onLog = (l) => this.pushLog(l);
    const fatigueStart = fatigueStartForChapter(ctx.base.chapter + 1);
    pb.onBeat = (n, round) => {
      const remaining = fatigueStart - n;
      // Near fatigue the two existing lines prioritize its timing over the
      // round counter; keeping the beat number makes the damage schedule clear.
      this.setBarPhase(remaining > 3 ? `第 ${round} 回合\n第 ${n} 次交锋`
        : `第 ${n} 次交锋\n${remaining > 0 ? `疲劳${remaining}拍后` : `疲劳${n - fatigueStart + 1}伤/交锋`}`);
    };
    pb.onPhase = (ph) => this.setBarPhase(ph === 'start' ? '开战阶段' : '交锋');
    if (this.tut && ctx.kind === 'official') pb.onHold = (n, els) => this.tut?.hold(n, els) ?? null;
    this.pb = pb;
    pb.setPaused(this.paused);
    const current = () => !this.disposed && this.app.isCurrentGame(this) && this.pb === pb && !pb.cancelled;
    await wait(250);
    await pb.waitUntilResumed();
    if (!current()) return;
    await pb.play();
    if (!current()) return;
    await wait(pb.speed > 1 ? 300 : 600);
    await pb.waitUntilResumed();
    if (!current()) return;
    this.pb = null;
    this.showResult(out, ctx);
  }

  private renderBar() {
    this.logEl = h('div', { class: 'bb-log' });
    this.speedBtn = h('button', { class: 'btn ghost speed' }, icon('ff'), h('span', null, `${this.speed}×`));
    this.speedBtn.addEventListener('click', () => {
      this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 3 : 1;
      localStorage.setItem('zl_speed', String(this.speed));
      if (this.pb) this.pb.speed = this.speed;
      this.speedBtn.querySelector('span')!.textContent = `${this.speed}×`;
      sfx.click();
    });
    const skip = h('button', { class: 'btn ghost' }, icon('skip'), h('span', null, '跳过'));
    skip.addEventListener('click', () => {
      this.pb?.skip();
      sfx.click();
    });
    this.bar.replaceChildren(
      h('div', { class: 'bb-phase' }, h('span', { class: 'bb-dot' }), h('b', null, '准备')),
      this.logEl,
      h('div', { class: 'bb-btns' }, this.speedBtn, skip),
    );
  }

  private setBarPhase(t: string) {
    const b = this.bar.querySelector('.bb-phase b');
    if (b) b.textContent = t;
  }

  private pushLog(l: LogLine) {
    const line = h('div', { class: `ll ${l.cls}` }, l.text);
    this.logEl.appendChild(line);
    while (this.logEl.children.length > 4) this.logEl.firstElementChild!.remove();
    line.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 200 });
  }

  private showResult(out: BattleOutput, ctx: BattleCtx) {
    const res = out.result;
    const node = currentNode(ctx.checkpoint ?? ctx.base);
    const prevLives = this.run.lives;
    let retry: RewardedRetrySettlement | null = null;
    if (ctx.kind === 'official') {
      this.emit('battle-end');
      finishBattle(this.run);
      this.persist();
      if (!this.tutorial) void syncCareerLeaderboards();
      this.fight = { slots: cloneSlots(ctx.slots), bench: cloneSlots(ctx.bench), checkpoint: ctx.checkpoint!, result: res };
    } else if (ctx.kind === 'retry') {
      retry = settleRewardedRetry(this.run, ctx.checkpoint!, ctx.slots, res, ctx.bench, out.gold ?? 0, out.eggStats);
      if (!this.tutorial) recordOfficialBattle(this.run, out, ctx.checkpoint!, ctx.slots, ctx.bench);
      this.persist();
      if (!this.tutorial) void syncCareerLeaderboards();
      this.sandbox = null;
      // 连续重打同一败局始终从原战前快照结算，不能把上次重打的结算当成下一次起点。
      this.fight = { slots: cloneSlots(ctx.slots), bench: cloneSlots(ctx.bench), checkpoint: ctx.checkpoint!, result: retry.authoritativeResult };
    }
    const settled = ctx.kind === 'official' || retry?.authoritativeResult === 'win';
    const goldGain = settled && ctx.checkpoint ? this.run.gold - ctx.checkpoint.gold : 0;
    const bossHeal = ctx.kind === 'official' && res === 'win' && node.kind === 'boss' && this.run.lives > prevLives;
    const sandbox = ctx.kind === 'sandbox';
    this.mode = 'result';
    const tutorialComplete = this.tut?.refreshResult() ?? false;
    if (res === 'win') sfx.win();
    else sfx.lose();
    if (retry?.lifeRestored) {
      this.later(() => sfx.reward(), 650);
      this.app.showRewardNotice('生命已挽回', '这一战已按胜利重新结算');
      this.later(() => {
        this.app.fx.ring(640, 320, '#ffd36b', 150, 34);
        this.app.fx.burst(640, 320, '#7dffb0', { n: 26, speed: 6, size: 3 });
      }, 300);
    }
    if (res === 'win') {
      for (let i = 0; i < 4; i++)
        this.later(() => this.app.fx.burst(300 + Math.random() * 680, 200 + Math.random() * 200, ['#ffd36b', '#7dffb0', '#6fe6ff', '#ff9a3d'][i], { n: 40, speed: 8, size: 3, gravity: 0.15 }), i * 160);
    }
    // 终局失败但本局重打资格还在：给出复盘补救的机会
    const retryChance = !sandbox && this.fight?.result === 'lose' && this.run.over === 'defeat' && remainingRewardedRetries(this.run) > 0;
    const title = tutorialComplete ? '通关结束' : { win: '胜利', lose: '败北', draw: '平局' }[res];
    let sub = '';
    if (sandbox) sub = res === 'win' ? '试打胜利，尚未计入远征。' : '试打未胜利，可继续调整。';
    else if (retry) {
      if (retry.authoritativeResult === 'win')
        sub = this.run.over === 'victory' ? '首领被击败，生命已挽回——远征完成！' : '这一战按胜利重新结算 · 生命已挽回';
      else if (res === 'draw') sub = '平局算输，但不扣生命';
      else sub = this.run.over === 'defeat'
        ? remainingRewardedRetries(this.run) > 0 ? '补救未成功 · 仍可复盘后看广告重打' : '补救未成功 · 远征到此为止'
        : '补救未成功，但没有再失去生命';
    } else if (this.run.over === 'victory') sub = '最终首领倒下了，远征完成！';
    else if (this.run.over === 'defeat') sub = '最后一条命也失去了。';
    else if (res === 'win') sub = `${node.name} 已击破，${out.rounds ?? 0} 回合 · ${out.beats} 次交锋结束战斗${bossHeal ? ' · 恢复 1 条命' : ''}`;
    else if (res === 'lose') sub = node.kind === 'boss' ? `失去 1 条命 · 首领战可以重新挑战` : `失去 1 条命 · 远征继续`;
    else sub = node.kind === 'boss' ? '首领战平局 · 不扣命，调整后再战' : '双方都无法再出手 · 不扣命，+1 金，远征继续';

    const cont = h('button', { class: 'btn primary' }, h('span', null, tutorialComplete ? '完成' : sandbox ? '再调整' : this.run.over ? '查看结算' : '继续'), icon('play'));
    cont.addEventListener('click', () => {
      sfx.click();
      if (tutorialComplete && this.tut?.finishResult()) return;
      this.closeOverlay();
      if (sandbox) this.enterSandbox(false);
      else if (this.run.over) this.end();
      else this.proceed();
    });
    const replay = h('button', { class: 'btn ghost' }, icon('replay'), h('span', null, sandbox ? '结束复盘' : '复盘'));
    replay.addEventListener('click', () => {
      sfx.click();
      this.closeOverlay();
      if (sandbox) this.exitSandbox();
      else this.enterSandbox(true);
    });
    const showReplay = !tutorialComplete && (sandbox || !this.run.over || retryChance);
    const lives = !sandbox
      ? h(
          'div',
          { class: 'res-lives' },
          Array.from({ length: MAX_LIVES }, (_, i) => {
            const cls = [
              'life',
              i < this.run.lives ? 'on' : '',
              !retry && res === 'lose' && i >= this.run.lives && i < prevLives ? 'lost' : '',
              (retry?.lifeRestored || bossHeal) && i === prevLives ? 'restored' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return h('span', { class: cls }, icon('heart'));
          }),
        )
      : null;
    const tip = retryChance
      ? h('div', { class: 'res-tip' }, '提示：「复盘」可换站位试打；看广告可正式重打，赢了挽回生命。')
      : !sandbox && res !== 'win' && !this.run.over
        ? h('div', { class: 'res-tip' }, '提示：「复盘」可以用同一阵容换站位再打一次。')
        : null;
    const gains = !sandbox && settled
      ? h(
          'div',
          { class: 'res-gains' },
          goldGain > 0 ? h('span', { class: 'rg-gold' }, `+${goldGain} 金`) : null,
          (res === 'win' || retry?.authoritativeResult === 'win') && this.run.lastPoints.length
            ? h('span', { class: 'rg-pts' }, '培养点 ', ...POINT_TYPES.map(pt => {
                const n = this.run.lastPoints.filter(x => x === pt.id).length;
                return n ? h('b', { class: `pt-${pt.id}`, 'aria-label': `${pt.name}×${n}` }, pxIcon(pt.id), `×${n}`) : null;
              }))
            : null,
        )
      : null;
    const ov = h(
      'div',
      { class: `result-ov r-${res}${retry ? ' retry' : ''}` },
      h(
        'div',
        { class: 'res-card' },
        h('div', { class: 'res-rays' }),
        h('div', { class: 'res-title' }, title),
        h('div', { class: 'res-sub' }, sub),
        lives,
        gains,
        h('div', { class: 'res-btns' }, showReplay ? replay : null, cont),
        tip,
      ),
    );
    this.overlay = ov;
    this.el.appendChild(ov);
    this.renderHud();
  }

  private closeOverlay() {
    this.overlay?.remove();
    this.overlay = null;
  }

  private resetBattleUi() {
    this.clearDrag();
    this.bar.classList.remove('on');
    this.el.classList.remove('in-battle');
    if (this.el.classList.contains('cam-on')) this.camera(null);
    this.board.clearUnits();
  }

  /** 按状态推导下一个界面：商店 / 分岔 / 奖励 / 升阶 / 备战 */
  proceed() {
    this.closePanel();
    this.closeOverlay();
    this.sel = null; this.focus = this.hover = null;
    this.mode = 'prep';
    this.sandbox = null;
    this.growthSnap = this.takeGrowth();
    this.resetBattleUi();
    const sc = screen(this.run);
    if (sc === 'over') { this.end(); return; }
    if (sc !== 'prep') {
      this.mode = 'phase';
      this.renderAll(true);
      this.showPhase(sc);
      return;
    }
    this.renderAll(true);
    this.cardsIn();
    this.introBanner();
  }

  private enterSandbox(first: boolean) {
    if (first || !this.sandbox) {
      // 复盘的是刚才那一战：开战前的阵容、当时的关卡（都取自冻结的战斗记录）
      const f = this.fight;
      const base = cloneRun(f ? f.checkpoint : this.run);
      this.sandbox = { slots: cloneSlots(base.slots), bench: cloneSlots(base.bench), base };
    }
    this.sel = null;
    this.mode = 'sandbox';
    this.resetBattleUi();
    this.renderAll(false);
  }

  private exitSandbox() {
    this.sandbox = null;
    if (this.run.over) {
      this.end();
      return;
    }
    this.proceed();
  }

  // ───────────── 激励视频：宿主明确确认完整观看后才发奖 ─────────────

  /** 复盘中是否允许看广告正式重打：刚才那场是正式败北，且本局资格未用 */
  private canRewardedRetry() {
    return !!this.sandbox && !!this.fight && this.fight.result === 'lose' && remainingRewardedRetries(this.run) > 0 && !this.adPending;
  }

  private buildRewardedRerollBtn() {
    const btn = h(
      'button',
      { class: 'btn ghost reroll rewarded', 'aria-label': `看广告换一批卡（每局最多 ${MAX_REWARDED_REROLLS} 次）` },
      icon('play'),
      h('span', null, '广告刷新'),
      h('i', { 'aria-hidden': 'true' }, remainingRewardedRerolls(this.run)),
    );
    btn.addEventListener('click', () => void this.requestRewardedReroll(btn));
    return btn;
  }

  /** 广告通用的加锁 / 解锁 / 防迟到回调包装 */
  private async withRewardedAd(placement: 'extra-reroll' | 'failed-battle-retry', btn: HTMLElement) {
    if (this.adPending || !this.app.isCurrentGame(this)) return null;
    this.clearDrag();
    this.adPending = true;
    const token = ++this.adToken;
    this.mode = 'rewardedAd';
    this.el.classList.add('ad-locked');
    btn.classList.add('disabled');
    if (btn instanceof HTMLButtonElement) btn.disabled = true;
    sfx.click();
    let result: 'rewarded' | 'cancelled' | 'failed';
    try {
      result = await this.app.showRewarded(placement);
    } catch {
      result = 'failed';
    }
    // 迟到回调：已离开本局 / 已有新请求，直接忽略
    if (token !== this.adToken || !this.app.isCurrentGame(this)) return null;
    this.adPending = false;
    this.el.classList.remove('ad-locked');
    return result;
  }

  private async requestRewardedReroll(btn: HTMLElement) {
    if (this.mode !== 'prep' || !canRewardedReroll(this.run)) return;
    const at = btn.getBoundingClientRect();
    const p = toStage(at.left + at.width / 2, at.top + at.height / 2);
    const result = await this.withRewardedAd('extra-reroll', btn);
    if (!result) return;
    if (result === 'rewarded' && applyRewardedReroll(this.run)) {
      this.persist();
      this.mode = 'prep';
      this.sel = null; hideTip();
      this.renderAll();
      this.cardsIn();
      sfx.reward();
      this.app.fx.ring(p.x, p.y, '#ffd36b', 80);
      this.app.fx.burst(p.x, p.y, '#ffd36b', { n: 20, speed: 5, size: 2.5 });
      this.app.fx.float(p.x + 46, p.y - 26, '额外刷新已到账', 'reward', 1200);
      this.app.showRewardNotice('额外刷新已到账', `本局广告刷新剩余 ${remainingRewardedRerolls(this.run)} 次`);
      return;
    }
    this.mode = 'prep';
    this.renderTray();
    if (result === 'failed') this.app.showRewardNotice('广告加载失败', '没有刷新招募，可稍后再试', 'error');
  }

  private async requestRewardedRetry(btn: HTMLElement) {
    const sb = this.sandbox;
    const fight = this.fight;
    if (!sb || !fight || fight.result !== 'lose' || remainingRewardedRetries(this.run) <= 0) return;
    // 点击瞬间冻结复盘站位：广告期间即使界面有变，重打也用这套站位
    const retrySlots = cloneSlots(sb.slots);
    const retryBench = cloneSlots(sb.bench);
    if (!retrySlots.some(Boolean)) return;
    const result = await this.withRewardedAd('failed-battle-retry', btn);
    if (!result) return;
    if (result === 'rewarded' && consumeRewardedRetry(this.run)) {
      this.persist();
      sfx.reward();
      this.app.showRewardNotice('正式重打已激活', '用当前站位重打这一战 · 赢了才挽回生命');
      void this.startBattle({ kind: 'retry', base: fight.checkpoint, slots: retrySlots, bench: retryBench, checkpoint: fight.checkpoint });
      return;
    }
    this.mode = 'sandbox';
    this.renderAll(false);
    if (result === 'failed') this.app.showRewardNotice('广告加载失败', '没有消耗重打次数，可稍后再试', 'error');
  }

  introBanner() {
    if (this.mode !== 'prep') return;
    const n = this.node;
    const el = h(
      'div',
      { class: `stage-intro k-${n.kind}` },
      h('div', { class: 'si-no' }, `${chapter(this.run.chapter).name} · 第 ${battleNo(this.run) + 1} 战${KIND_TEXT[n.kind] ? ' · ' + KIND_TEXT[n.kind] : ''}`),
      h('div', { class: 'si-name' }, n.name),
      n.hint ? h('div', { class: 'si-hint' }, ...kwRich(n.hint)) : null,
    );
    this.el.appendChild(el);
    sfx.whoosh();
    el.animate(
      [
        { opacity: 0, transform: 'translate(-50%,-50%) scale(1.3)', filter: 'blur(6px)' },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', filter: 'blur(0)', offset: 0.15 },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.8 },
        { opacity: 0, transform: 'translate(-50%,-50%) scale(.96)' },
      ],
      { duration: n.hint ? 2200 : 1500, easing: 'ease-out' },
    ).onfinish = () => {
      el.remove();
      this.coach();
    };
  }

  // ───────────── 新手引导 ─────────────

  private coachEl: HTMLElement | null = null;
  /** 引导框指向的目标外圈脉冲；与引导框同生同灭 */
  private coachPulse: HTMLElement | null = null;

  private dropCoach() {
    this.coachEl?.remove();
    this.coachEl = null;
    this.coachPulse?.remove();
    this.coachPulse = null;
  }

  coach() {
    if (this.tutorial || this.disposed) return;
    if (this.el.querySelector('.stage-intro')) return;
    if (this.prep) { this.dropCoach(); return; }
    const promo = this.mode === 'phase' && !!this.panel?.classList.contains('ph-promo');
    if (this.mode !== 'prep' && !promo) { this.dropCoach(); return; }
    const done = seenHints();
    // 已经在显示同一条：不重建，免得每次重绘都重播入场动画
    const live = this.coachEl?.isConnected ? this.coachEl.dataset.id : undefined;
    type Rect = { x: number; y: number; w: number; h: number };
    const show = (id: string, text: string, x: number, y: number, dir: 'up' | 'down' | 'left', pulse?: Rect, boxX?: number) => {
      if (done.has(id)) return false;
      if (live === id) return true;
      this.dropCoach();
      // 框被夹回屏内时，箭头仍对准目标
      const cx = Math.max(220, Math.min(STAGE_W - 220, boxX ?? x));
      const el = h(
        'div',
        dir === 'left'
          ? { class: 'coach dir-left', style: `left:${x}px;top:${Math.max(110, Math.min(STAGE_H - 110, y))}px`, 'data-id': id }
          : { class: `coach dir-${dir}`, style: `left:${cx}px;top:${y}px;--ax:${x - cx}px`, 'data-id': id },
        h('div', { class: 'coach-text', html: text }),
        h('button', { class: 'coach-ok' }, '知道了'),
      );
      el.querySelector('button')!.addEventListener('click', (e) => {
        e.stopPropagation();
        markHint(id);
        this.dropCoach();
        sfx.click();
        this.coach();
      });
      if (pulse) {
        this.coachPulse = h('div', { class: 'coach-pulse', 'aria-hidden': 'true', style: `left:${pulse.x}px;top:${pulse.y}px;width:${pulse.w}px;height:${pulse.h}px` });
        this.el.appendChild(this.coachPulse);
      }
      this.el.appendChild(el);
      this.coachEl = el;
      // 上方放不下（短屏紧凑布局）：翻到目标下方，仍不压住目标
      if (dir === 'down' && y - el.offsetHeight - 12 < 4) {
        el.classList.replace('dir-down', 'dir-up');
        el.style.top = `${pulse ? pulse.y + pulse.h : y + 140}px`;
      }
      return true;
    };
    /** 指向某个元素：目标在上半屏就把框放在下面，反之放上面，箭头不压住目标 */
    const at = (id: string, text: string, target: HTMLElement | null) => {
      if (done.has(id) || !target || !target.getClientRects().length) return false;
      const b = target.getBoundingClientRect();
      const top = toStage(b.left + b.width / 2, b.top), bottom = toStage(b.left + b.width / 2, b.bottom);
      // 右下角操作区（开战键所在列）：框放到目标左侧，不压住开战
      const left = toStage(b.left, b.top + b.height / 2);
      if (top.x > STAGE_W - 300 && top.y > STAGE_H / 2) return show(id, text, left.x, left.y, 'left');
      return bottom.y < STAGE_H / 2 ? show(id, text, top.x, bottom.y, 'up') : show(id, text, top.x, top.y, 'down');
    };
    if (promo) {
      if (!at('promo', modernTactics(this.run) ? '战术<b>整局远征</b>有效' : '升阶被动<b>只对当前主将</b>有效', this.panel!.querySelector<HTMLElement>('.ph-opts'))) this.dropCoach();
      return;
    }
    // 框放在我方格位上方（目标在下），目标本身加脉冲外圈；框不压格位与单位。
    const allyRow: Rect = { x: slotX(0, SLOTS - 1) - 58, y: UNIT_Y + 2, w: slotX(0, 0) - slotX(0, SLOTS - 1) + 116, h: 62 };
    const front: Rect = { x: slotX(0, 0) - 58, y: UNIT_Y - 100, w: 116, h: 166 };
    const empty = teamSize(this.run) === 0;
    if (empty) {
      if (show('drag', '把卡<b>拖到左边格位</b>招募。<br>挨着中线的 <b>1 号位是队首</b>：最先出手，也最先挨打。', 320, UNIT_Y - 6, 'down', allyRow)) return;
    } else {
      if (show('preview6', '盘面数值已算上<b>开战时</b>效果，拖动时实时变化。', slotX(0, 0), UNIT_Y - 104, 'down', front, 350)) return;
      if (show('preview7', '每回合每人<b>行动一次</b>。<b>准星</b>标出普攻目标。', slotX(0, 0), UNIT_Y - 104, 'down', front, 350)) return;
    }
    // 首遇提示：主将专属交互和新流派词条，各只出一次
    const r = this.run, q = <T extends HTMLElement>(sel: string) => this.el.querySelector<T>(sel);
    const unitWith = (pick: (d: ReturnType<typeof unitDef>) => boolean) => {
      const i = r.slots.findIndex((u) => !!u && pick(unitDef(u.defId)));
      return i < 0 ? null : q(`.board .unit[data-side="0"][data-slot="${i}"]`);
    };
    if (r.general === 'reva' && at('g_reva', '点<b>换位</b>，再点两个敌人，让他们<b>对调</b>', q('.gen-acts .gen-act'))) return;
    if (r.general === 'sajj' && at('g_sajj', '最右是<b>预备</b>格：有人阵亡就<b>补上</b>', q('.bench-slot.reserve'))) return;
    if (r.general === 'xingjiao' && at('g_xingjiao', '任一项攒满，<b>龙蛋孵化</b>成对应的龙', q('.egg-prog'))) return;
    if (r.general === 'hank' && r.merc && !r.merc.sold && at('g_hank', '免费临时佣兵，<b>只打这一场</b>', q('.gen-acts .gen-act'))) return;
    if (r.general === 'argeon' && at('g_argeon', '主将<b>亲自上场</b>占一格，不能出售', q('.board .unit[data-side="0"][data-slot="0"]'))) return;
    if (at('k_charge', '<b>蓄力</b>：圆点攒满，立刻放蓄力技', unitWith((d) => !!d.traits?.charge))) return;
    if (at('k_rotate', '<b>轮换</b>：行动后退到队尾，后面的人顶上', unitWith((d) => !!d.traits?.rotate))) return;
    if (battleNo(this.run) >= 3 && show('hint', '敌人开始有针对性了。<br>点顶部<b>路线节点</b>可以提前看敌阵。', 640, 84, 'up')) return;
    this.dropCoach();
  }
}

/** 战术卡图标：按战术本身，其次按所属流派 */
const TACTIC_ICON: Record<string, IconName> = {
  g_martyr: 'tomb', g_elite: 'crown', g_drill: 'arrowUp', g_revive: 'replay', g_breach: 'spikes', g_pay: 'diamond',
  g_dual: 'combo', g_relay: 'swap', g_arena: 'kill', g_surge: 'wand', g_horde: 'sparkle', g_taunt: 'guard',
  g_ember: 'fire', g_tide: 'snow', g_chain: 'bolt',
};
const NEED_ICON: Record<string, IconName> = {
  burn: 'fire', chill: 'snow', cast: 'wand', extra: 'bolt', equip2: 'combo', rotate: 'swap', duel: 'kill',
  charge: 'hourglass', rattle: 'tomb', summon: 'sparkle', taunt: 'guard',
};
function tacticIcon(p: (typeof PASSIVE_MAP)[string]): IconName {
  return TACTIC_ICON[p.id] ?? (p.need ? NEED_ICON[p.need] : undefined) ?? (p.general ? 'flag' : 'star');
}
