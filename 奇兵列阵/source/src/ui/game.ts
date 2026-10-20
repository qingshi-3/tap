import { abilityText, ownedPower } from '../core/abilityText';
import '../prep-battle.css';
import '../shop-layout.css';
import { DRAFT_POOL, FACTION_INFO, GENERAL_MAP, RARITY_NAMES, unitDef } from '../core/data';
import { EQUIP_MAP, ORDER_MAP, PASSIVE_MAP, POINT_MAP, POINT_TYPES, SPELL_MAP } from '../core/content';
import { chapter, type RouteNode, type Stage } from '../core/route';
import { SLOTS, levelStats, simulate } from '../core/engine';
import {
  allocPoint, applyRewardedReroll, battleNo, beginBattle, buildBattle, buy, canRewardedReroll, chooseReward, choosePromo, cloneRun, consumeRewardedRetry,
  allocRefundable, deallocPoint, equip, finishBattle, stashTotal, leaveShop, orderOptions, pickFork, promoted, refreshShop, screen, sell, canSell, sellPrice, unequip, unitDestination, unuseSpell, useOrder, useSpell,
  MAX_COPIES, MAX_LIVES, MAX_REWARDED_REROLLS, remainingRewardedRerolls, allOwned, cloneOwned, currentNode, getOwned, moveKind, moveSlot, placeKind, PICKS_PER_ROUND, reroll, tierCap,
  remainingRewardedRetries, settleRewardedRetry, takeDraft, teamSize,
  type RewardedRetrySettlement, type RunState, type Screen,
} from '../core/run';
import { clearRun, saveRun } from '../core/save';
import { recordOfficialBattle, recordRunOutcome } from '../core/career';
import { syncCareerLeaderboards } from './leaderboard';
import { Tutorial, type TutAction, type TutEvent } from './tutorial';
import { unitLevel, type BattleOutput, type BattleResult, type Side, type Slotted } from '../core/types';
import type { App } from './app';
import { setMusicRun, setMusicDucked, sfx } from './audio';
import { audioSettings } from './audioSettings';
import { type ArrowKind, Board, bodyPos, headPos, factionSigil, seatArt, statArt, SLOT_SPACING, slotX, statsOf, keywordsOf, UNIT_Y, UnitView } from './board';
import { draftCard } from './card';
import { append, h, toStage, wait } from './dom';
import { icon } from './icons';
import { kwRich } from './kwtext';
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
  return p;
}

const KIND_TEXT: Record<RouteNode['kind'], string> = { normal: '', elite: '精英', boss: '首领' };

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
      el: this.el, run, mode: () => this.mode, finishTutorial: () => this.app.toTitle(),
      busy: () => performance.now() < introDue || !!this.el.querySelector('.stage-intro'),
    });
    this.renderAll(true);
    if (sc !== 'prep' && sc !== 'over') this.showPhase(sc);
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
    this.renderHud();
    this.renderBanner();
    this.renderTray();
    this.renderBoard(intro);
    this.renderBench();
    this.syncMusicState();
  }

  private renderHud() {
    const g = GENERAL_MAP[this.run.general];
    const f = FACTION_INFO[g.faction];
    const ch = chapter(this.run.chapter);
    const genBadge = h(
      'div',
      { class: `hud-general${this.sel?.kind === 'point' && POINT_MAP[this.sel.type]?.toGeneral ? ' arm-target' : ''}`, style: `--fc:${f.color}` },
      h('div', { class: 'hg-portrait', html: unitSvg(null, { general: g.id, tier2: promoted(this.run) }) }),
      h('div', { class: 'hg-text' }, h('b', null, g.name), h('span', null, g.title)),
    );
    const showGenTip = () => {
      const r = genBadge.getBoundingClientRect();
      const p = toStage(r.left + r.width / 2, r.bottom);
      showTip(generalTip(g.id, this.base.genPower, this.base.passives), p.x + 40, p.y, 'below');
    };
    // 手机优先：点头像看技能；鼠标悬停只是桌面上的附加便利
    genBadge.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showGenTip(); });
    genBadge.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.restoreTip(); });
    genBadge.addEventListener('click', () => {
      const s = this.sel;
      if (s?.kind !== 'point' || !POINT_MAP[s.type]?.toGeneral || !this.editable || this.sandbox) { showGenTip(); return; }
      if (!this.allowTutorial({ kind: 'alloc', to: 'general', type: s.type })) return;
      if (allocPoint(this.run, 'general', s.type)) {
        sfx.merge();
        const r = genBadge.getBoundingClientRect(), p = toStage(r.left + r.width / 2, r.top);
        this.app.fx.float(p.x, p.y + 20, `法强 ${this.run.genPower}`, 'levelup', 1000);
        if (!(this.run.stash[s.type] > 0)) this.sel = null;
        this.save(); this.renderAll(); this.emit('alloc');
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
    const quit = h('button', { class: 'btn danger' }, icon('flag'), h('span', null, '放弃远征'));
    const close = this.app.modal(h('div', { class: 'confirm game-menu', 'aria-label': '菜单' }, h('h3', null, '菜单'), audioSettings(), h('div', { class: 'menu-btns' }, home, quit)), 'audio-dialog', document.body);
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

  private renderTray() {
    this.renderDock();
    if (this.mode === 'phase') { this.tray.classList.add('hidden'); return; }
    if (this.mode === 'sandbox') return this.renderSandboxTray();
    const r = this.run;
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
        { class: `btn ghost reroll${r.rerolls > 0 && r.picks > 0 ? '' : ' disabled'}`, disabled: r.rerolls <= 0 || r.picks <= 0 },
        icon('refresh'),
        h('span', null, '刷新'),
        h('i', null, r.rerolls),
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
      h('div', { class: 'tl-title' }, '招募'),
      h('div', { class: 'tl-row' }, h('span', null, '本轮可选'), picks),
      rerollBtn,
    );
    const cards = h('div', { class: `cards${r.picks <= 0 ? ' exhausted' : ''}` });
    r.draft.forEach((id, i) => {
      const same = allOwned(this.inventory).map((s, k) => ({ s, k })).filter((x) => x.s?.defId === id);
      const mergeable = same.find((x) => x.s!.copies === 1);
      const c = draftCard(id, { mergeTo: mergeable ? 2 : undefined, maxed: same.some(x => x.s!.copies === MAX_COPIES) });
      if (this.sel?.kind === 'card' && this.sel.idx === i) c.classList.add('selected');
      c.setAttribute('tabindex', r.picks > 0 ? '0' : '-1');
      c.setAttribute('role', 'button');
      c.setAttribute('aria-label', `${unitDef(id).name}，招募`);
      c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.tap('card', i, { x: 0, y: 0 }); } });
      c.setAttribute('aria-label', `${unitDef(id).name}，拖到位置招募`);
      c.addEventListener('pointerdown', (e) => this.dragStart(e, 'card', i, c));
      c.addEventListener('pointerenter', () => {
        if (this.drag) return;
        sfx.hover();
      });
      cards.appendChild(c);
    });
    if (r.picks <= 0) cards.appendChild(h('div', { class: 'cards-done' }, icon('check'), '招募完成'));
    const size = teamSize(r);
    const fight = h('button', { class: `btn primary fight${size ? '' : ' disabled'}`, disabled: !size }, h('span', null, '开 战'), icon('play'));
    fight.addEventListener('click', () => {
      if (!size) return;
      if (r.picks > 0 && r.draft.length && !this.tut) this.app.confirm('还有招募没用完', `本轮还能招募 ${r.picks} 次，开战后作废。`, '直接开战', () => { if (this.editable) void this.startBattle(); });
      else void this.startBattle();
    });
    const right = h(
      'div',
      { class: 'tray-right' },
      this.benchEl,
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
    this.tray.replaceChildren(
      this.benchEl,
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
        h('div', { class: 'sp-btns' }, reset, back, retryBtn, tryBtn),
      ),
    );
    this.tray.classList.remove('hidden');
  }

  private renderBench() {
    this.benchEl.replaceChildren(...[5, 6, 7].map(index => {
      const u = this.owned(index);
      const base = u ? levelStats(u.defId, unitLevel(u)) : null;
      const atk = base ? statArt('atk', base.atk) : null;
      const button = h('button', { class: `bench-slot${this.sel?.kind === 'unit' && this.sel.slot === index ? ' selected' : ''}`, 'data-index': index, 'aria-label': `备战${index - 4}${u ? ' ' + unitDef(u.defId).name : ' 空位'}` },
        h('span', { class: 'bench-seat' }, seatArt()),
        u ? h('span', { class: 'bench-art', html: unitSvg(u.defId) }) : null,
        base && u ? h('div', { class: 'u-stats bench-stats' }, atk, factionSigil(unitDef(u.defId).faction), statArt('hp', base.hp)) : null,
        h('span', { class: 'bench-label' }, u ? '★'.repeat(unitLevel(u)) : `备战${index - 4}`));
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
      const r = this.benchEl.querySelector<HTMLElement>(`[data-index="${index}"]`)!.getBoundingClientRect();
      const p = toStage(r.left + r.width / 2, r.top);
      showTip(content, p.x, p.y, 'above');
    }
  }

  private showPool() {
    hideTip();
    const groups = [...this.run.activeFactions, 'neutral'] as const;
    const list = h('div', { class: 'pool-list' });
    const detail = h('div', { class: 'pool-detail' });
    const show = (id: string) => {
      const d = unitDef(id);
      detail.replaceChildren(h('div', { class: 'pool-art', html: unitSvg(id) }), h('b', null, `${d.name} · `, h('span', { class: `tip-rarity rarity-${d.tier}` }, RARITY_NAMES[d.tier])), ...[1, 2, 3].map(level => h('section', null, h('b', null, '★'.repeat(level)), unitTip(id, level, null, false))));
    };
    const tabs = groups.map(f => h('button', { class: 'btn ghost', onclick: () => select(f) }, FACTION_INFO[f].name));
    const select = (f: typeof groups[number]) => {
      tabs.forEach((b, i) => b.classList.toggle('active', groups[i] === f));
      const defs = DRAFT_POOL.filter(d => d.faction === f);
      list.replaceChildren(...defs.map(d => h('button', { class: `pool-unit tier-${d.tier}${d.tier > tierCap(battleNo(this.run)) ? ' locked' : ''}`, onclick: () => show(d.id) }, h('span', { class: 'pool-unit-art', html: unitSvg(d.id) }), h('b', null, d.name), h('span', null, `${RARITY_NAMES[d.tier]}${d.tier > tierCap(battleNo(this.run)) ? ` · 第${[0, 1, 3, 6, 9][d.tier]}战开放` : ''}`))));
      show(defs[0].id);
    };
    select(groups[0]);
    this.app.modal(h('div', { class: 'content-dialog pool-dialog' }, h('div', { class: 'pool-tabs' }, tabs), h('div', { class: 'pool-body' }, list, detail)), 'wide');
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
      v.el.setAttribute('tabindex', '0');
      v.el.setAttribute('role', 'button');
      v.el.setAttribute('aria-label', `${u.side ? '敌方' : '我方'}${u.slot + 1}格 ${unitDef(u.defId).name}`);
      v.el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (this.editable && !u.side) this.tap('unit', u.slot, { x: 0, y: 0 }); else this.showUnitTip(u.side, u.slot); } };
      v.setTag(null);
      if (!after.alive) v.addTag('开战时阵亡', 'death');
      const fz = pv.fizzles.get(u.uid);
      if (fz) v.addTag(fz, 'fizzle');
    }
    for (const v of keep.values()) v.el.remove();
    fresh.forEach((v, i) => v.appear(intro ? 80 * i : 0));

    // 箭头、徽记：默认只挂序号牌，点选 / 拖拽时才画出相关连线
    b.clearMarks();
    this.pv = { out, pv };
    this.drawLinks(intro);
    for (const s of pv.summons) b.slotMark(s.side, s.slot, h('span', null, s.text), 'summon');

    // 第 1 拍双方队首出手：普攻打敌方队首，狙击打队尾；施法单位第 1 拍不普攻
    const alive = (side: Side) => out.afterStart.filter((u) => u.alive && u.side === side).sort((x, y) => x.slot - y.slot);
    for (const side of [0, 1] as Side[]) {
      const a = alive(side)[0];
      const foes = alive((1 - side) as Side);
      if (!a || !foes.length || unitDef(a.defId).cast) continue;
      const back = !!(unitDef(a.defId).traits?.snipe || a.grants.snipe);
      const t = back ? foes[foes.length - 1] : foes[0];
      const init = out.initial[t.uid - 1];
      b.target(init.side, init.slot, side === 1 ? 'enemy-aim' : 'ally-aim');
    }

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
    const linked = new Set<number>();
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
      if (takeDraft(trial, d.idx, slot) === 'invalid') return this.drawLinks(false, this.pv, null);
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
      if (this.run.picks <= 0) return 'invalid';
      return placeKind(this.run, this.run.draft[d.idx], slot);
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
      h('b', null, '拖到这里出售'), h('span', null, `+${sellPrice(u)} 金 · 培养点和装备退回`));
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
      if (p) this.app.fx.float(p.x, p.y - 60, `+${sellPrice(u)} 金`, 'levelup', 900);
      this.sel = null; hideTip(); this.save(); this.renderAll(); this.emit('sell');
    };
    const valuable = unitLevel(u) > 1 || (u.equips ?? []).length > 0 || Object.values(u.train ?? {}).some(Boolean);
    if (valuable) this.app.confirm(`出售${unitDef(u.defId).name}？`, `获得 ${sellPrice(u)} 金，培养点和装备会退回。`, '出售', done);
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
      const defId = d.kind === 'card' ? this.run.draft[d.idx] : this.owned(d.idx)!.defId;
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
    if (this.sel?.kind !== 'card' || !this.run.draft[this.sel.idx]) { hideTip(); return; }
    const tip = unitTip(this.run.draft[this.sel.idx], 1);
    tip.appendChild(h('div', { class: 'tip-note' }, '按住卡牌拖到位置上招募'));
    // 招募区上方的右半边：不挡卡牌，也有足够高度
    showTip(tip, 1050, 470, 'above');
  }

  private tap(kind: 'card' | 'unit', idx: number, p: { x: number; y: number }) {
    if (kind === 'card') {
      if (this.run.picks <= 0) return;
      if (this.sel?.kind === 'card' && this.sel.idx === idx) this.sel = null;
      else {
        this.sel = { kind: 'card', idx };
        sfx.pick();
        this.emit('select-card');
      }
      this.tray.querySelectorAll('.card').forEach((c, i) => c.classList.toggle('selected', this.sel?.kind === 'card' && this.sel.idx === i));
      this.board.views.forEach((v) => v.el.classList.remove('selected'));
      this.focus = this.hover = null; this.drawLinks();
      this.dropHints();
      // 点卡牌只看详情，不进入“再点位置”的放置模式：招募必须拖，避免手机上误点买下
      this.restoreTip();
      return;
    }
    // 单位：点在单位上
    const slot = idx;
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
    const p = headPos(side, slot);
    if (this.editable) showTip(content, slotX(side, slot), UNIT_Y + 62, 'below', p.y - 30);
    else showTip(content, p.x, p.y - 30, 'above');
  }

  private doPlace(idx: number, slot: number, confirmed = false) {
    if (!this.allowTutorial({ kind: 'place', idx, slot })) return false;
    const defId = this.run.draft[idx];
    // 放到已有单位的位置：挤去备战席或遣散，都先确认，防止拖偏了把场上单位顶掉
    if (!confirmed && this.run.picks > 0 && placeKind(this.run, defId, slot) === 'reserve') {
      const old = this.owned(slot)!;
      this.app.confirm(`替换${unitDef(old.defId).name}？`, `${unitDef(defId).name}会占这个位置，${unitDef(old.defId).name}移到备战席。`, '替换', () => { if (this.editable) this.doPlace(idx, slot, true); });
      return false;
    }
    const kind = takeDraft(this.run, idx, slot, confirmed);
    if (kind === 'confirm') {
      const old = this.owned(slot)!;
      this.app.confirm(`遣散${unitDef(old.defId).name}？`, `场上和备战席都满了，${unitDef(defId).name}会顶掉这名${unitLevel(old)}星单位（按出售退还金币、培养点和装备）。`, '遣散并招募', () => { if (this.editable) this.doPlace(idx, slot, true); });
      return false;
    }
    if (kind === 'invalid') { sfx.fizzle(); if (slot < 5) this.flashSlot(slot, 'bad'); return false; }
    hideTip(); this.sel = null;
    if (kind === 'merge') sfx.merge(); else sfx.place();
    if (slot < 5) this.armFocus(slot);
    this.save();
    this.renderAll();
    this.placementEffect(slot, defId, kind === 'merge');
    if (this.run.picks > 0) this.cardsIn();
    this.emit(kind === 'merge' ? 'merge' : 'place');
    return true;
  }

  private doMove(from: number, to: number, mode: 'auto' | 'swap' = this.sandbox ? 'swap' : 'auto') {
    if (!this.allowTutorial({ kind: 'move', from, to })) return false;
    const va = from < 5 ? this.board.view(`p0-${from}`) : null;
    const vb = to < 5 ? this.board.view(`p0-${to}`) : null;
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
    if (kind === 'merge') this.placementEffect(to, this.owned(to)!.defId, true);
    this.emit(kind === 'merge' ? 'merge' : 'move');
    return true;
  }

  private placementEffect(index: number, defId: string, merge: boolean) {
    const p = index < 5 ? bodyPos(0, index) : (() => {
      const rect = this.benchEl.querySelector<HTMLElement>(`[data-index="${index}"]`)!.getBoundingClientRect();
      const scale = this.el.getBoundingClientRect().width / 1280;
      return toStage(rect.left + rect.width / 2, rect.top + 70 * scale);
    })();
    const fx = this.app.fx;
    if (merge) {
      fx.burst(p.x, p.y, '#ffe08a', { n: 30, speed: 6, size: 3 });
      fx.ring(p.x, p.y + 40, '#ffe08a', 90);
      fx.float(p.x, p.y - 60, `升级 ${'★'.repeat(unitLevel(this.owned(index)!))}`, 'levelup', 1200);
    } else {
      const color = FACTION_INFO[unitDef(defId).faction].color;
      fx.ring(p.x, p.y + 40, color, 70);
      fx.burst(p.x, p.y + 40, color, { n: 16, speed: 4, kind: 'mote', size: 2.5, up: 2 });
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) fx.shake(3, 160);
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
    if (!eqs.length && !train.length) return null;
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
    );
  }

  /** 选中培养点 / 装备后点单位：分配到该单位 */
  private applyArm(slot: number) {
    const s = this.sel;
    if (!s || this.sandbox || this.mode !== 'prep') return;
    let ok = false;
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
    const p = slot < 5 && !this.prep ? bodyPos(0, slot) : null;
    if (p) {
      this.app.fx.ring(p.x, p.y + 40, s.kind === 'equip' ? '#ffd36b' : '#7dffb0', 70);
      this.app.fx.float(p.x, p.y - 60, s.kind === 'point' ? `${POINT_MAP[s.type]?.name ?? ''} +1` : '装备', 'levelup', 900);
    }
    this.save();
    this.renderAll();
    this.emit(s.kind === 'equip' ? 'equip' : 'alloc');
  }

  /** 主界面只留一个「整备」入口：角标是还没用掉的资源数 */
  private renderDock() {
    const r = this.run;
    const d = this.dock;
    this.armHint.classList.add('hidden');
    if (this.mode !== 'prep' || this.sandbox) { d.classList.add('hidden'); this.closePrep(); return; }
    const left = stashTotal(r) + r.bag.length + r.spells.length + r.orders.length;
    const btn = h('button', { class: `prep-btn${left ? ' has' : ''}`, 'aria-label': '整备' }, icon('plate'), h('span', null, '整备'), left ? h('i', null, left) : null);
    btn.addEventListener('click', (e) => { e.stopPropagation(); if (this.editable && !this.adPending) { sfx.click(); this.openPrep(); } });
    d.replaceChildren(btn);
    d.classList.remove('hidden');
    if (this.prep) this.renderPrep();
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
  }

  private closePrep() {
    if (!this.prep) return;
    hideTip();
    this.prep.remove();
    this.prep = null;
    this.syncMusicState();
    this.el.classList.remove('prep-open');
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
        const label = p.id === 'block' ? `${count}点` : `+${delta}`;
        const value = h('i', { class: 'prep-added' }, label);
        // Reuse the original stat/keyword components, including their numeral styling.
        const art = statArt(p.id, value);
        const b = h('button', { class: `prep-refund pt-${p.id}`, 'data-owner': owner, 'data-point': p.id,
          disabled: !!this.tut || !this.editable || this.adPending,
          'aria-label': `本轮${p.name}${p.id === 'block' ? `分配${count}点（有效格挡最多3层）` : `增加${delta}`}，退回一点${p.name}` },
          h('span', { class: 'prep-refund-face', 'aria-hidden': 'true' }, art));
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
      this.prepFocus = slot;
      if (sel?.kind === 'point' || sel?.kind === 'equip') { this.applyArm(slot); return; }
      this.renderPrep();
      const u = getOwned(r, slot);
      if (u) {
        const target = this.prep?.querySelector<HTMLElement>(`.prep-owned[data-slot="${slot}"]`) ?? el;
        const init = out.initial.find(x => x.side === 0 && x.slot === slot);
        const st = init ? out.afterStart[init.uid - 1] : { ...this.ownedStats(u), chill: 0, burn: 0, power: ownedPower(u.defId, unitLevel(u), u) };
        tipAt(target, unitTip(u.defId, unitLevel(u), st));
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
        enemies.append(h('div', { class: 'prep-enemy' }, seatArt(), v.el));
      }
    }
    const bench = h('div', { class: 'prep-bench', 'aria-label': '备战' });
    for (const slot of [5, 6, 7]) {
      const u = getOwned(r, slot);
      if (!u) { bench.append(h('div', { class: 'prep-bench-empty' }, seatArt())); continue; }
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
    const g = GENERAL_MAP[r.general];
    const genOn = sel?.kind === 'point' && !!POINT_MAP[sel.type]?.toGeneral;
    const gen = h('div', { class: `pu-card gen${genOn ? ' target' : ''}`, style: `--fc:${FACTION_INFO[g.faction].color}` },
      h('div', { class: 'pu-art', html: unitSvg(null, { general: g.id, tier2: promoted(r) }) }),
      h('div', { class: 'pu-lv' }, '主将'),
      h('b', { class: 'pu-name' }, g.name),
      h('div', { class: 'pu-stat' }, h('span', { class: 'p' }, icon('wand'), '法强', num(r.genPower, r.genPower))),
      refunds('general'),
    );
    gen.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.editable || this.adPending) return;
      const s = this.sel;
      if (!genOn || s?.kind !== 'point') {
        this.prepFocus = 'general'; this.renderPrep();
        const target = this.prep?.querySelector<HTMLElement>('.pu-card.gen') ?? gen;
        tipAt(target, generalTip(g.id, this.base.genPower, this.base.passives)); return;
      }
      hideTip();
      if (!this.allowTutorial({ kind: 'alloc', to: 'general', type: s.type })) return;
      if (!allocPoint(r, 'general', s.type)) { sfx.fizzle(); return; }
      sfx.merge();
      if (!(r.stash[s.type] > 0)) this.sel = null;
      this.save(); this.renderAll(); this.emit('alloc');
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
      chip(`pt pt-${p.id}`, sel?.kind === 'point' && sel.type === p.id, [h('b', null, p.short), h('i', null, r.stash[p.id])], act(pick({ kind: 'point', type: p.id }))));
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


    const done = h('button', { class: 'btn primary prep-done' }, h('span', null, '完成'));
    done.addEventListener('click', (e) => { e.stopPropagation(); sfx.click(); this.closePrep(); this.renderAll(); });
    gen.setAttribute('aria-label', `主将 ${g.name}`);
    gen.tabIndex = 0; gen.setAttribute('role', 'button');
    gen.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); gen.click(); } });
    ov.replaceChildren(h('div', { class: 'prep-panel' },
      enemies, gen, done, roster,
      h('div', { class: `pp-say${sel?.kind === 'point' || sel?.kind === 'equip' ? ' on' : ''}` }, ...say),
      h('div', { class: 'pp-tray' }, actions, groups.length ? groups : null)));
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
    this.mode = 'phase';
    this.tray.classList.add('hidden');
    this.dock.classList.add('hidden');
    this.armHint.classList.add('hidden');
    const body = sc === 'shop' ? this.shopPanel() : sc === 'fork' ? this.forkPanel() : sc === 'reward' ? this.rewardPanel() : this.promoPanel();
    this.closePanel(false);
    this.panel = h('div', { class: `phase-ov ph-${sc}` }, body);
    this.el.appendChild(this.panel);
    this.syncMusicState();
  }

  private phaseDone() {
    this.save();
    sfx.click();
    this.proceed();
  }

  private shopPanel() {
    const r = this.run, s = r.shop!;
    // 手机防误触：点一下只选中并在右侧说明栏展开详情，再点「购买」才扣金币；出售改为把阵容头像拖进出售框
    type Good = { key: string; kind: Parameters<typeof buy>[1]; i: number; name: string; text: string; unitStats?: { atk: number; hp: number }; price: number; sold: boolean; cls: string; icon: HTMLElement; block?: string };
    const doBuy = (g: Good) => {
      if (this.mode !== 'phase' || !this.allowTutorial({ kind: 'buy', category: g.kind, index: g.i }) || !buy(r, g.kind, g.i)) { sfx.fizzle(); return; }
      this.shopSel = null;
      sfx.reward(); this.save(); this.renderAll(); this.showPhase('shop');
      if (g.kind === 'equips') this.emit('buy-equips');
    };
    const pick = (key: string | null) => { sfx.click(); this.shopSel = key; this.showPhase('shop'); };
    const price = (n: number, sold: boolean) => h('span', { class: `sh-price${sold ? ' sold' : r.gold < n ? ' poor' : ''}` }, sold ? '已售' : h('span', null, itemIcon('coin', 'coin', 'sm'), `${n}`));
    const goods: Good[] = [
      ...s.units.map((it, i) => {
        const d = unitDef(it.id), st = levelStats(it.id, 1);
        return { key: `units:${i}`, kind: 'units' as const, i, name: d.name, text: abilityText(it.id, 1), unitStats: st, price: it.price, sold: it.sold, cls: 'un', icon: h('span'),
          block: !it.sold && unitDestination(r, it.id) === null ? '没有空位：先把阵容里的单位拖进出售框' : undefined };
      }),
      ...s.equips.map((it, i) => ({ key: `equips:${i}`, kind: 'equips' as const, i, name: EQUIP_MAP[it.id].name, text: EQUIP_MAP[it.id].text, price: it.price, sold: it.sold, cls: 'eq', icon: itemIcon(it.id) })),
      ...s.spells.map((it, i) => ({ key: `spells:${i}`, kind: 'spells' as const, i, name: SPELL_MAP[it.id].name, text: SPELL_MAP[it.id].text, price: it.price, sold: it.sold, cls: 'sp', icon: itemIcon(it.id, 'spell') })),
      ...(s.order ? [{ key: 'order:0', kind: 'order' as const, i: 0, name: ORDER_MAP[s.order.id].name, text: ORDER_MAP[s.order.id].text, price: s.order.price, sold: s.order.sold, cls: 'od', icon: itemIcon(s.order.id, 'order') }] : []),
      { key: 'pack:0', kind: 'pack' as const, i: 0, name: '培养包', text: `内含：${s.pack.points.map(p => POINT_MAP[p].name).join('、')}`, price: s.pack.price, sold: s.pack.sold, cls: 'pk', icon: itemIcon('pack', 'pack') },
    ];
    const sel = goods.find(g => g.key === this.shopSel && !g.sold) ?? null;
    const owned = allOwned(r);
    const ownSel = this.shopSel?.startsWith('own:') ? Number(this.shopSel.slice(4)) : -1;
    const ownU = ownSel >= 0 ? owned[ownSel] ?? null : null;
    // 选中商店里的单位时，阵容中同名的单位亮起：一眼看出买了能不能合并升星
    const matchId = sel?.kind === 'units' ? s.units[sel.i].id : null;
    const tile = (g: Good, body: HTMLElement[]) => {
      const b = h('button', { class: `${g.kind === 'units' ? 'sh-unit' : `sh-item ${g.cls}`}${g.sold ? ' sold' : ''}${sel === g ? ' on' : ''}`, disabled: g.sold, 'aria-pressed': String(sel === g), 'aria-label': `${g.name}，${g.price} 金` }, ...body);
      b.addEventListener('click', () => pick(sel === g ? null : g.key));
      return b;
    };
    const units = goods.filter(g => g.kind === 'units').map(g => tile(g, [draftCard(s.units[g.i].id), g.block ? h('span', { class: 'sh-price poor' }, '无空位') : price(g.price, g.sold)]));
    const items = goods.filter(g => g.kind !== 'units').map(g => tile(g, [h('span', { class: 'sh-icon' }, g.icon), h('b', null, g.name), price(g.price, g.sold)]));

    // 说明栏：选中商品的完整说明 + 购买按钮
    let detail: HTMLElement;
    if (ownU) {
      const d = unitDef(ownU.defId), lv = unitLevel(ownU), st = this.ownedStats(ownU);
      const eqs = (ownU.equips ?? []).map(id => EQUIP_MAP[id]?.name ?? id);
      const train = Object.entries(ownU.train ?? {}).filter(([, n]) => n).map(([k, n]) => `${POINT_MAP[k]?.short ?? k}+${n}`);
      const extra = [eqs.length ? `装备：${eqs.join('、')}` : '', train.length ? `培养：${train.join(' ')}` : ''].filter(Boolean).join('　');
      detail = h('div', { class: 'sh-detail own' },
        h('span', { class: 'sh-icon art', html: unitSvg(ownU.defId) }),
        h('div', { class: 'sh-desc' },
          h('b', null, d.name, h('i', { class: 'sh-stars' }, '★'.repeat(lv))),
          h('span', { class: 'sh-pos' }, ownSel < 5 ? `战斗席 ${ownSel + 1} 号位` : '备战席'),
          h('span', { class: 'sh-st' }, h('i', { class: 'a' }, icon('sword'), st.atk), h('i', { class: 'h' }, icon('heart'), st.hp), st.block ? h('i', { class: 'k' }, icon('shield'), st.block) : null),
          h('p', null, ...kwRich(abilityText(ownU.defId, lv, ownedPower(ownU.defId, lv, ownU))), extra ? h('span', { class: 'sh-extra' }, `　${extra}`) : null)),
        h('div', { class: 'sh-sellhint' }, h('span', null, '拖进出售框卖出'), h('b', null, itemIcon('coin', 'coin', 'sm'), `+${sellPrice(ownU)}`)));
    } else if (sel) {
      const why = sel.block ?? (r.gold < sel.price ? `金币不足（还差 ${sel.price - r.gold}）` : '');
      const go = h('button', { class: 'btn primary sh-buy', disabled: !!why }, h('span', null, '购买'), h('span', { class: 'sh-buy-p' }, itemIcon('coin', 'coin', 'sm'), `${sel.price}`));
      go.addEventListener('click', () => doBuy(sel));
      detail = h('div', { class: `sh-detail ${sel.cls}` },
        sel.kind === 'units' ? h('span', { class: 'sh-icon art', html: unitSvg(s.units[sel.i].id) }) : h('span', { class: 'sh-icon' }, itemIcon(sel.key.startsWith('equips') ? s.equips[sel.i].id : sel.kind === 'spells' ? s.spells[sel.i].id : sel.kind, sel.kind === 'order' ? 'order' : sel.kind === 'pack' ? 'pack' : 'spell')),
        h('div', { class: 'sh-desc' }, h('b', null, sel.name), matchId ? this.heldNote(matchId) : null,
          sel.unitStats ? h('span', { class: 'sh-st' }, h('i', { class: 'a' }, icon('sword'), sel.unitStats.atk), h('i', { class: 'h' }, icon('heart'), sel.unitStats.hp)) : null,
          h('p', null, why ? h('em', null, why, '。') : null, ...kwRich(sel.text))),
        go);
    } else detail = h('div', { class: 'sh-detail empty' }, h('p', null, '选择商品'));

    const refresh = h('button', { class: 'btn ghost', disabled: r.gold < s.refreshCost }, icon('refresh'), h('span', null, `刷新 ${s.refreshCost} 金`));
    refresh.addEventListener('click', () => {
      if (!this.allowTutorial({ kind: 'shop-refresh' }) || !refreshShop(r)) { sfx.fizzle(); return; }
      this.shopSel = null;
      sfx.swap(); this.save(); this.renderHud(); this.showPhase('shop');
    });

    // 阵容：按住头像拖进出售框才卖出；点一下只提示
    // 阵容：战斗席 5 格 + 备战席 3 格都列出来（空格也画），点一下看现状，按住拖进出售框才卖出
    const bin = h('div', { class: 'sh-bin' }, itemIcon('coin', 'coin'), h('span', null, '拖入出售'));
    const seat = (u: Slotted | null, i: number) => {
      const tag = i < 5 ? `${i + 1}` : '备';
      if (!u) return h('div', { class: 'sh-own empty' }, h('span', { class: 'sh-seat' }, tag), h('span', { class: 'sh-none' }, '空'));
      const st = this.ownedStats(u), lv = unitLevel(u);
      const b = h('div', { class: `sh-own${ownSel === i ? ' on' : ''}${matchId === u.defId ? ' match' : ''}`, role: 'button', tabindex: 0, 'aria-pressed': String(ownSel === i), 'aria-label': `${unitDef(u.defId).name} ${lv} 星，${st.atk} 攻 ${st.hp} 血，拖到出售框卖出 ${sellPrice(u)} 金` },
        h('span', { class: 'sh-own-art', html: unitSvg(u.defId) }),
        h('span', { class: 'sh-seat' }, tag),
        u.equips?.length ? h('span', { class: 'sh-own-eq' }, itemIcon(u.equips[0], 'spell', 'sm')) : null,
        h('i', null, '★'.repeat(lv)),
        h('span', { class: 'sh-own-st' }, h('b', { class: 'a' }, st.atk), h('b', { class: 'h' }, st.hp)));
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
      h('div', { class: 'ph-head' }, h('b', null, '商店'), h('span', { class: 'sh-gold' }, itemIcon('coin', 'coin'), `${r.gold}`), refresh, leave),
      h('div', { class: 'sh-market' },
        h('div', { class: 'sh-catalog' },
          h('div', { class: 'sh-units' }, units),
          h('div', { class: 'sh-goods' }, items)),
        detail),
      h('div', { class: 'sh-roster' },
        h('div', { class: 'sh-grp' }, h('span', { class: 'dk-label' }, '战斗席'), h('div', { class: 'sh-owns' }, field)),
        h('div', { class: 'sh-grp' }, h('span', { class: 'dk-label' }, '备战席'), h('div', { class: 'sh-owns' }, reserve)),
        bin));
  }

  /** 拥有单位的战前身材：星级基础 + 培养 + 装备（不含开战效果） */
  private ownedStats(u: Slotted) {
    const b = levelStats(u.defId, unitLevel(u));
    const t = { atk: b.atk, hp: b.hp, maxHp: b.hp, block: 0, grants: {} as Record<string, number> };
    for (const [k, n] of Object.entries(u.train ?? {})) if (n && POINT_MAP[k]) POINT_MAP[k].apply(t as never, n);
    for (const id of u.equips ?? []) { const e = EQUIP_MAP[id]; if (e) { t.atk = Math.max(1, t.atk + (e.atk ?? 0)); t.hp += e.hp ?? 0; } }
    return t;
  }

  /** 商店单位的已持有情况：只给客观信息，不标“推荐” */
  private heldNote(defId: string) {
    const same = allOwned(this.run).filter((u): u is Slotted => !!u && u.defId === defId);
    if (!same.length) return null;
    const mergeable = same.some(u => u.copies < 4);
    return h('span', { class: 'sh-held' }, `已持有 ${same.map(u => '★'.repeat(unitLevel(u))).join(' / ')}${mergeable ? '，可合并' : ''}`);
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
    const st = chapter(this.run.chapter).stages[this.run.node] as Extract<Stage, { type: 'fork' }>;
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
    const g = GENERAL_MAP[r.general];
    return h('div', { class: 'ph-card promo', style: `--fc:${FACTION_INFO[g.faction].color}` },
      h('div', { class: 'ph-head' }, h('div', { class: 'promo-art', html: unitSvg(null, { general: g.id, tier2: true }) }), h('b', null, `${g.name} 升阶`), h('span', null, '选择一个主将被动')),
      h('div', { class: 'ph-opts' }, r.promo!.map((id, i) => {
        const p = PASSIVE_MAP[id];
        const b = h('button', { class: `ph-opt passive${p.general ? ' own' : ''}` }, p.general ? h('span', { class: 'sb-kind' }, '专属') : null, h('b', null, p.name), h('p', null, ...kwRich(p.text)));
        b.addEventListener('click', () => { if (choosePromo(r, i)) { sfx.reward(); this.renderHud(); this.phaseDone(); } });
        return b;
      })));
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
          h('div', { class: 'rp-stats' }, h('span', { class: 'a' }, e.atk ?? d.atk), h('span', { class: 'h' }, e.hp ?? d.hp)),
          h('div', { class: 'rp-name' }, d.name),
          d.keywords?.length ? h('div', { class: 'rp-kw' }, d.keywords[0]) : null,
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
    const st = chapter(this.run.chapter).stages[i];
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
    this.coachEl?.remove();
    this.coachEl = null;
   
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
      this.app.showRewardNotice('战斗中止', '已返回战前，生命和招募未结算。请调整阵容后重试。', 'error');
      console.error('battle fault', { seed: this.run.seed, chapter: ctx.base.chapter, node: ctx.base.node, fault: out.fault });
      return;
    }
    // 正式战：结果先算出并存档，中途退出也按这一结果结算
    if (ctx.kind === 'official') {
      beginBattle(this.run, out.result, out.gold ?? 0);
      if (!this.tutorial) recordOfficialBattle(this.run, out, ctx.checkpoint!, ctx.slots, ctx.bench);
      this.persist();
      this.emit('battle-start');
    }
    const pb = new Playback(this.board, this.app.fx, out);
    pb.speed = this.speed;
    pb.genEl = () => this.el.querySelector<HTMLElement>('.hud-general');
    pb.onLog = (l) => this.pushLog(l);
    pb.onBeat = (n) => this.setBarPhase(`第 ${n} 拍`);
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
      retry = settleRewardedRetry(this.run, ctx.checkpoint!, ctx.slots, res, ctx.bench, out.gold ?? 0);
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
      else if (res === 'draw') sub = '平局不算取胜 · 这一战仍按败北结算，但没有再失去生命';
      else sub = this.run.over === 'defeat'
        ? remainingRewardedRetries(this.run) > 0 ? '补救未成功 · 仍可复盘后看广告重打' : '补救未成功 · 远征到此为止'
        : '补救未成功，但没有再失去生命';
    } else if (this.run.over === 'victory') sub = '最终首领倒下了，远征完成！';
    else if (this.run.over === 'defeat') sub = '最后一条命也失去了。';
    else if (res === 'win') sub = `${node.name} 已击破，${out.beats} 拍结束战斗${bossHeal ? ' · 恢复 1 条命' : ''}`;
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
      ? h('div', { class: 'res-tip' }, '提示：进入「复盘」调整站位并试打，看广告可以正式重打这一战——胜利即挽回生命。')
      : !sandbox && res !== 'win' && !this.run.over
        ? h('div', { class: 'res-tip' }, '提示：「复盘」可以用同样的阵容换站位重打这一战，帮你找出问题。')
        : null;
    const gains = !sandbox && settled
      ? h(
          'div',
          { class: 'res-gains' },
          goldGain > 0 ? h('span', { class: 'rg-gold' }, `+${goldGain} 金`) : null,
          (res === 'win' || retry?.authoritativeResult === 'win') && this.run.lastPoints.length
            ? h('span', { class: 'rg-pts' }, '培养点 ', ...POINT_TYPES.map(pt => {
                const n = this.run.lastPoints.filter(x => x === pt.id).length;
                return n ? h('b', { class: `pt-${pt.id}` }, `${pt.short}×${n}`) : null;
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
    this.board.clearUnits();
  }

  /** 按状态推导下一个界面：商店 / 分岔 / 奖励 / 升阶 / 备战 */
  proceed() {
    this.closePanel();
    this.closeOverlay();
    this.sel = null; this.focus = this.hover = null;
    this.mode = 'prep';
    this.sandbox = null;
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
      { class: 'btn ghost reroll rewarded', 'aria-label': `看广告，重新生成本轮招募（整局最多 ${MAX_REWARDED_REROLLS} 次）` },
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
      this.app.showRewardNotice('正式重打已激活', '用当前站位重打刚才那一战 · 胜利才挽回生命');
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

  coach() {
    if (this.mode !== 'prep' || this.tutorial) return;
    const done = new Set((localStorage.getItem('zl_coach') || '').split(',').filter(Boolean));
    const step = (id: string, text: string, x: number, y: number, dir: 'up' | 'down') => {
      if (done.has(id)) return false;
      this.coachEl?.remove();
      const el = h(
        'div',
        { class: `coach dir-${dir}`, style: `left:${x}px;top:${y}px` },
        h('div', { class: 'coach-text', html: text }),
        h('button', { class: 'coach-ok' }, '知道了'),
      );
      el.querySelector('button')!.addEventListener('click', () => {
        done.add(id);
        localStorage.setItem('zl_coach', [...done].join(','));
        el.remove();
        this.coachEl = null;
        sfx.click();
        this.coach();
      });
      this.el.appendChild(el);
      this.coachEl = el;
      return true;
    };
    if (teamSize(this.run) === 0) {
      step('drag', '按住一张卡，<b>拖到左侧格位</b>招募（点一下只看详情）。<br>靠近中线的 <b>1 号位是队首</b>，最先出手、也最先挨打。', 620, 452, 'down');
      return;
    }
    if (step('preview6', '盘面显示的是<b>开战时效果之后</b>的数值，拖动时实时预演。<br>每回合默认每人<b>行动一次</b>，双方按站位行动；一方本轮用完就等待。带「施法」的施法，其余普攻。<b>准星</b>标出第 1 拍双方会打谁。', 340, 112, 'up')) return;
    if (battleNo(this.run) >= 3 && step('hint', '从这里开始敌人会出题。<br>点击顶部<b>路线节点</b>可以提前查看之后的敌人。', 640, 84, 'up')) return;
  }
}

