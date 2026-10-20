import { battleNo, screen, stashTotal, type RunState } from '../core/run';
import { slotX, UNIT_Y, SLOT_SPACING } from './board';
import { h, STAGE_W, STAGE_H, stageState, toStage } from './dom';
import { sfx } from './audio';
import '../tutorial-guide.css';

// 新手教学：固定种子、固定候选，前 3 场 + 第一个商店 + 装备后的第 4 战。
// 蒙层镂空高亮目标；输入锁只放行高亮区域；每步按事件或状态推进。

export const TUTORIAL_FLAG = 'zl_tutorial_done';
export const tutorialDone = () => localStorage.getItem(TUTORIAL_FLAG) === '1';
import { newTutorialRun, scriptDraft, tutorialAllows, tutorialComplete, giveTutorialActionScroll, type TutAction } from '../core/tutorialRoute';
export { newTutorialRun, type TutAction };

/** Game 发出的教学事件 */
export type TutEvent =
  | 'select-card' | 'place' | 'merge' | 'move' | 'tip' | 'alloc' | 'reroll' | 'sell'
  | 'buy-equips' | 'equip' | 'battle-start' | 'battle-end';

export interface TutHost {
  el: HTMLElement;
  run: RunState;
  mode(): string;
  finishTutorial(): void;
  /** 关卡告示等过场还在播：教学步先不出 */
  busy?(): boolean;
}

interface Rect { x: number; y: number; w: number; h: number }
type Target = string | Rect | (() => Rect | HTMLElement | null);
/** 步骤可见的教学状态 */
interface Ctx { hold: boolean }
interface Step {
  id?: string;
  /** 满足前不显示、不锁输入（等结算、过场） */
  gate?: (r: RunState, mode: string, x: Ctx) => boolean;
  text: string | ((r: RunState) => string);
  /** 高亮（也是放行区域）；说明框会避开全部高亮 */
  at?: Target[];
  /** 额外放行但不高亮 */
  allow?: Target[];
  /** 'tap' = 点继续；否则等事件 */
  until: 'tap' | TutEvent | ((r: RunState, mode: string) => boolean);
  count?: number;
  /** 条件不具备时直接跳过本步 */
  skip?: (r: RunState) => boolean;
  /** 不加蒙层（战斗中） */
  noMask?: boolean;
  /** 战斗暂停讲解：只在回放暂停时生效，最后一个暂停步结束后恢复回放 */
  hold?: boolean;
  /** 只在角落显示一枚小提示（自由操作阶段） */
  chip?: boolean;
}

const prepOpen = () => !!document.querySelector('.game .prep-ov');
/** 整备弹层还开着：点「完成」回到盘面（盘面上的下一步才点得到） */
const closePrep: Step = { gate: (_, m) => m === 'prep', skip: () => !prepOpen(), at: ['.prep-ov .prep-done'], until: () => !prepOpen(),
  text: '点<b>「完成」</b>回到战场。' };
const slotRect = (side: 0 | 1, slot: number): Rect => ({ x: slotX(side, slot) - 52, y: UNIT_Y - 120, w: 104, h: 210 });
const fieldRect: Rect = { x: slotX(0, 4) - 55, y: UNIT_Y - 120, w: SLOT_SPACING * 4 + 110, h: 210 };
const enemyRect: Rect = { x: slotX(1, 0) - 55, y: UNIT_Y - 120, w: SLOT_SPACING * 4 + 110, h: 210 };
const prep = (b: number) => (r: RunState, m: string) => m === 'prep' && battleNo(r) === b;
const held = (_: RunState, m: string, x: Ctx) => m === 'battle' && x.hold;

let actors: HTMLElement[] = [];

const STEPS: Step[] = [
  { gate: prep(0), at: [fieldRect, () => slotRect(1, 0)], until: 'tap',
    text: '左边 5 个格位是你的阵型，右边是敌阵。<br>靠近中线的 <b>1 号位是队首</b>：最先出手，也最先挨打。' },
  { gate: prep(0), at: ['.hud-general'], until: 'tap',
    text: '左上角是你的<b>主将</b>。主将不上场、不会被攻击，每场战斗在固定时机<b>自动释放技能</b>。<br>点头像可以查看技能；之后获得的「法强」培养点可以分给主将，让技能更强。' },
  { id: 'recruit-first', gate: prep(0), at: ['.tray .cards > .card:first-child', () => slotRect(0, 0)], until: (r, m) => m === 'prep' && r.picks < 3,
    text: '这次先招募 <b>3</b> 张卡。<br><b>按住「佣兵」</b>，拖到 1 号位松手。（点一下卡牌只是查看详情）' },
  { id: 'merge-first', gate: prep(0), at: ['.tray .cards > .card:first-child', () => slotRect(0, 0)], until: 'merge',
    text: '又来了一张<b>同名卡</b>。把它拖到已有的佣兵身上，<b>合并升星</b>：属性变强、能力升级。' },
  { id: 'recruit-guard', gate: prep(0), at: ['.tray .cards', () => slotRect(0, 1)], until: (r) => r.picks <= 0,
    text: '把<b>守誓者</b>拖到 <b>2 号位</b>，保护佣兵。' },
  { id: 'fight-first', gate: prep(0), at: ['.tray .fight'], until: 'battle-start',
    text: '准备好了就<b>开战</b>。战斗全自动，你只需要看。' },
  { id: 'learn-beat', gate: held, hold: true, at: [() => actors[0] ?? null, () => actors[1] ?? null], until: 'tap',
    text: '这次交锋叫一<b>拍</b>：双方按站位，至多各选 <b>1 名单位</b>行动。<br>同拍先结算施法，再让普攻<b>同时结算</b>。' },
  { id: 'learn-round', gate: held, hold: true, at: ['.order-strip'], until: 'tap',
    text: '每个<b>回合</b>，每名单位默认有 <b>1 次行动</b>。用完就等待，不会提前从队首重来。<br>双方的行动次数全部用完，才进入新回合。' },
  { id: 'learn-action', gate: held, hold: true, at: [() => actors[0] ?? null, () => actors[1] ?? null], until: 'tap',
    text: '轮到单位，按自身能力<b>施法或普攻</b>。施法通常不限次数，例外会写在卡面上。<br>普攻默认打敌方队首；阵亡后，其他单位不前移。' },
  { id: 'learn-order', gate: held, hold: true, at: ['.order-strip'], until: 'tap',
    text: '上方显示<b>回合、行动轮</b>和本轮剩余的出手顺序，数字是<b>格位号</b>。<br>发光者即将行动；一方全倒下就分出胜负。点继续观看。' },
  { gate: (_, m) => m === 'battle', at: ['.battle-bar'], until: 'battle-end', noMask: true,
    text: '战斗进行中。底部可以<b>加速</b>或<b>跳过</b>。' },

  { id: 'inspect-unit', gate: prep(1), at: [() => slotRect(0, 0)], until: 'tap',
    text: '<b>点一下</b>你的单位，可以看到它的属性、能力和关键词说明。' },
  { gate: prep(1), at: [enemyRect], until: 'tap',
    text: '敌人也一样可以点开查看。角标是它们的<b>关键词</b>：格挡抵消一次伤害、护甲减伤……<br>这一关的影袭者带<b>狙击</b>，会打你的队尾。' },
  { id: 'train-general', gate: prep(1), at: ['.prep-entry', '.prep-ov .pt-power', '.prep-ov .pu-card.gen'], until: (r) => !(r.stash.power > 0),
    text: '赢下战斗会获得<b>培养点</b>。打开<b>「整备」</b>，先点<b>「法」</b>，再点<b>主将</b>，把法强分给主将。' },
  { id: 'train-unit', gate: prep(1), at: ['.prep-ov .pp-tray', '.prep-owned[data-slot="0"]'], until: (r) => stashTotal(r) === 0,
    text: '把剩余的<b>生命、格挡、攻击</b>培养点都分给 <b>1 号位佣兵</b>：点培养点，再点佣兵。' },
  closePrep,
  { id: 'reroll', gate: prep(1), at: ['.tray .reroll'], until: 'reroll',
    text: '候选不满意？点<b>刷新</b>换一批（每轮 1 次）。' },
  { id: 'recruit-bulwark', gate: prep(1), at: ['.tray .cards', () => slotRect(0, 2)], until: (r) => r.picks <= 1,
    text: '把<b>铁甲卫士</b>拖到 <b>3 号位</b>。' },
  { id: 'recruit-sentry', gate: prep(1), at: ['.tray .cards', () => slotRect(0, 3)], until: (r) => r.picks <= 0,
    text: '把<b>沙铠甲虫</b>拖到 <b>4 号位</b>，护卫能挡下狙击。' },
  { id: 'swap-front', gate: prep(1), at: [() => slotRect(0, 0), () => slotRect(0, 2)], until: 'move',
    text: '把 <b>1 号位佣兵</b>拖到 <b>3 号位铁甲卫士</b>身上，两者换位，让护甲单位顶在队首。' },
  { id: 'fight-second', gate: prep(1), at: ['.tray .fight'], until: 'battle-start', text: '开战，留意主将技能什么时候发动。' },
  { id: 'learn-wait', gate: held, hold: true, at: ['.order-strip'], until: 'tap',
    text: '这次我方 <b>4 人</b>，敌方 <b>3 人</b>。敌方本轮用完会显示<b>「等待」</b>，等我方剩余单位行动。<br>主将技能、灼烧仍按<b>拍</b>计时，等待时也照常结算。' },
  { gate: (_, m) => m === 'battle', at: ['.battle-bar'], until: 'battle-end', noMask: true,
    text: '主将技能会画出指向目标的弹道。' },

  { id: 'sell-guard', gate: prep(2), at: [() => slotRect(0, 1), '.tray .cards'], until: 'sell',
    text: '把 <b>2 号位守誓者</b>拖到下方招募栏卖掉，腾出位置。每份换 1 金，培养点和装备会退回。' },
  { id: 'recruit-chaser', gate: prep(2), at: ['.tray .cards', () => slotRect(0, 1)], until: (r) => r.picks <= 1,
    text: '把<b>雪原小妖</b>拖到 <b>2 号位</b>。施法叠加寒意；寒意达到敌人攻击时，会冻结它、跳过出手。' },
  { id: 'merge-chaser', gate: prep(2), at: ['.tray .cards', () => slotRect(0, 1)], until: (r) => r.picks <= 0,
    text: '再把一张<b>雪原小妖</b>拖到 <b>2 号位小妖</b>身上，合并升星，增强寒意。' },
  { id: 'fight-third', gate: prep(2), at: ['.tray .fight'], until: 'battle-start', text: '开战，看敌人被冻住。' },
  { id: 'learn-chill', gate: held, hold: true, at: [() => slotRect(0, 1), '.order-strip'], until: 'tap',
    text: '<b>寒意</b>会影响接下来的出手机会；本回合还没出手的敌人，现在就会受影响。<br>敌人已行动完？寒意会保留，不会因换回合而白白消失。' },
  { id: 'learn-freeze', gate: held, hold: true, at: [() => slotRect(0, 1)], until: 'tap',
    text: '寒意让下次普攻临时减攻；达到当前攻击时，<b>冻结并跳过这次出手</b>。<br>被冻结跳过的行动也会消耗次数，用于这次出手的寒意随后清空。' },
  { gate: (_, m) => m === 'battle', at: ['.battle-bar'], until: 'battle-end', noMask: true,
    text: '冰蓝色的<b>寒意</b>角标就是要被减攻 / 冻结的单位。' },

  { id: 'shop-buy', gate: (r, m) => m === 'phase' && screen(r) === 'shop', at: ['.sh-item.eq', '.sh-detail'], until: 'buy-equips',
    text: '点第一件装备<b>战旗</b>，再点说明里的<b>购买</b>，花费 5 金。' },
  { id: 'shop-leave', gate: (r, m) => m === 'prep' || (m === 'phase' && screen(r) === 'shop'), at: ['.sh-leave'], until: (_, m) => m === 'prep',
    text: '战旗已放入背包。点<b>离开商店</b>。' },
  { id: 'equip-banner', gate: (_, m) => m === 'prep', at: ['.prep-entry', '.prep-ov .pp-tray', '.prep-owned[data-slot="2"]'], until: 'equip',
    text: '打开<b>整备</b>，点背包里的<b>战旗</b>，再点 <b>3 号位佣兵</b>装备。战旗会让相邻友军开战加攻。' },
  { id: 'use-haste', gate: prep(3), at: ['.prep-entry', '.prep-ov .pr-chip.sp'], until: r => r.activeSpells.includes('sp_haste'),
    text: '再试一张赠送的<b>号令卷轴</b>。点它为本场启用，让队首在<b>首回合行动次数 +1</b>。<br>卷轴只用一次，开战后消耗。' },
  closePrep,
  { id: 'fight-final', gate: prep(3), at: ['.tray .fight'], until: 'battle-start',
    text: '战旗和卷轴已就绪。点<b>开战</b>，留意队首的额外行动，赢下这关完成教学。' },
  { id: 'learn-extra-action', gate: held, hold: true, at: [() => slotRect(0, 0), '.order-strip'], until: 'tap',
    text: '队首本回合有 <b>2 次行动</b>，但不会连续用完。<br>双方第 1 轮结束后，有剩余次数的单位进入<b>第 2 轮</b>，再按站位行动。' },
  { id: 'learn-immediate', gate: held, hold: true, at: [() => slotRect(0, 0)], until: 'tap',
    text: '<b>立即攻击</b>在当前拍追加普攻，不施法，也不扣常规行动次数。<br><b>连击</b>是一次普攻打两段；<b>额外行动</b>则到后续轮次，照常判断施法还是普攻。' },
  { gate: (_, m) => m === 'battle', at: ['.battle-bar'], until: 'battle-end', noMask: true,
    text: '看上方<b>第 2 轮</b>：队首再次行动，次数用完的单位等待。' },
  { id: 'complete', gate: tutorialComplete, until: 'tap',
    text: '<b>通关结束</b>！点<b>完成</b>返回主界面，开始正式远征。' },
];

export class Tutorial {
  private i = 0;
  private hits = 0;
  private el = h('div', { class: 'tut' });
  private mask = h('div', { class: 'tut-mask', html: '' });
  private ring = h('div', { class: 'tut-rings' });
  private box = h('div', { class: 'tut-box' });
  private timer = 0;
  private rects: Rect[] = [];
  private allowRects: Rect[] = [];
  private shown = false;
  private disposed = false;
  private ctx: Ctx = { hold: false };
  private release: (() => void) | null = null;
  private gavePower = false;
  private gaveActionScroll = false;
  /** 上次落到 DOM 的高亮签名，没变就不重画 */
  private sig = '';

  constructor(private host: TutHost) {
    const skip = h('button', { class: 'btn primary tut-skip' }, h('span', null, '跳过教学'));
    skip.addEventListener('click', () => { sfx.click(); this.finish(); });
    this.el.append(this.mask, this.ring, this.box, skip);
    host.el.appendChild(this.el);
    for (const t of ['pointerdown', 'click', 'keydown', 'wheel'] as const) host.el.addEventListener(t, this.guard, true);
    this.timer = window.setInterval(() => this.update(), 200);
    this.update();
  }

  dispose() {
    this.disposed = true;
    this.resume();
    clearInterval(this.timer);
    for (const t of ['pointerdown', 'click', 'keydown', 'wheel'] as const) this.host.el.removeEventListener(t, this.guard, true);
    this.el.remove();
  }

  /** 按脚本替换候选；第 2 战送 1 点法强，用来教「分给主将」 */
  fixDraft(r: RunState) {
    if (this.host.mode() !== 'prep') return;
    if (battleNo(r) === 1 && !this.gavePower) { this.gavePower = true; r.stash.power = (r.stash.power ?? 0) + 1; }
    // 最后一战用原阵容学习额外行动；一次性赠送卷轴，不改正式奖励或商店。
    if (!this.gaveActionScroll && giveTutorialActionScroll(r)) this.gaveActionScroll = true;
    if (battleNo(r) >= 3) { r.picks = 0; r.rerolls = 0; }
    const d = scriptDraft(r);
    if (d.join() !== r.draft.join()) r.draft = d;
  }

  allows(action: TutAction): boolean {
    const step = STEPS[this.i];
    return !this.disposed && this.active(step) && tutorialAllows(step?.id ?? '', this.host.run, action);
  }

  isCompleteResult(): boolean {
    return !this.disposed && STEPS[this.i]?.id === 'complete'
      && tutorialComplete(this.host.run, this.host.mode());
  }

  /** The game owns the final result card; refresh immediately when its mode changes. */
  refreshResult(): boolean {
    this.update();
    return this.isCompleteResult();
  }

  finishResult(): boolean {
    if (!this.isCompleteResult()) return false;
    this.finish();
    return true;
  }

  /** 回放每拍出手前调用：当前是暂停讲解步时返回一个等待讲解结束的 Promise */
  hold(n: number, els: HTMLElement[]): Promise<void> | null {
    if (this.disposed || n !== 1 || !STEPS[this.i]?.hold) return null;
    actors = els;
    this.ctx.hold = true;
    const p = new Promise<void>((resolve) => { this.release = resolve; });
    this.update();
    return p;
  }

  private resume() {
    this.ctx.hold = false;
    actors = [];
    this.release?.();
    this.release = null;
  }

  notify(ev: TutEvent) {
    const s = STEPS[this.i];
    if (!s || typeof s.until !== 'string' || s.until !== ev) return;
    if (++this.hits >= (s.count ?? 1)) this.next();
    else this.update();
  }

  private next() {
    this.i++; this.hits = 0; this.shown = false;
    if (this.ctx.hold && !STEPS[this.i]?.hold) this.resume();
    if (this.i >= STEPS.length) { this.finish(); return; }
    this.update();
  }

  private finish() {
    if (this.disposed) return;
    localStorage.setItem(TUTORIAL_FLAG, '1');
    this.dispose();
    this.host.finishTutorial();
  }

  private active(s: Step | undefined) {
    if (this.host.busy?.()) return false;
    return !!s && (!s.gate || s.gate(this.host.run, this.host.mode(), this.ctx));
  }

  private resolve(t: Target): Rect | null {
    const e = typeof t === 'string' ? this.host.el.querySelector<HTMLElement>(t) : typeof t === 'function' ? t() : t;
    if (!e || !(e instanceof HTMLElement)) return e;
    if (!e.isConnected || !e.getClientRects().length) return null;
    const b = e.getBoundingClientRect();
    const a = toStage(b.left, b.top), z = toStage(b.right, b.bottom);
    return { x: a.x, y: a.y, w: z.x - a.x, h: z.y - a.y };
  }

  private update() {
    if (this.disposed) return;
    const s = STEPS[this.i];
    this.el.hidden = this.isCompleteResult();
    if (this.el.hidden) {
      this.el.classList.remove('on');
      this.rects = this.allowRects = [];
      return;
    }
    this.el.dataset.step = s?.id ?? `step-${this.i + 1}`;
    if (s && this.active(s) && (s.skip?.(this.host.run) || (typeof s.until === 'function' && s.until(this.host.run, this.host.mode())))) { this.next(); return; }
    const on = this.active(s);
    this.el.classList.toggle('on', on);
    this.el.classList.toggle('focus-fight', on && s.until === 'battle-start');
    this.el.classList.toggle('no-mask', !!s?.noMask);
    this.box.classList.toggle('chip', !!s?.chip);
    if (!on) { this.shown = false; this.sig = ''; this.rects = this.allowRects = []; return; }
    const rects = (s.at ?? []).map((t) => this.resolve(t)).filter((r): r is Rect => !!r);
    const pad = (r: Rect) => ({ x: r.x - 6, y: r.y - 6, w: r.w + 12, h: r.h + 12 });
    this.rects = rects.map(pad);
    this.allowRects = [...this.rects, ...(s.allow ?? []).map((t) => this.resolve(t)).filter((r): r is Rect => !!r).map(pad)];
    // 每 200ms 轮询一次高亮位置，但只在位置或步骤变化时才改 DOM：整屏蒙层 SVG 和呼吸光圈
    // 反复重建会让整屏每秒重绘 5 次并重启动画，手机上是持续发热源
    const text = typeof s.text === 'function' ? s.text(this.host.run) : s.text;
    const tip = this.resolve(() => document.querySelector<HTMLElement>('.tip.on'));
    const sig = `${this.i}|${text}|${s.noMask ? 1 : 0}|${[...this.rects, ...(tip ? [tip] : [])].map((r) => `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)},${Math.round(r.h)}`).join(';')}`;
    if (sig === this.sig && this.shown) return;
    this.sig = sig;
    // 蒙层：整屏减去高亮矩形（evenodd 镂空）
    const holes = this.rects.map((r) => `M${r.x},${r.y}h${r.w}v${r.h}h${-r.w}z`).join('');
    this.mask.innerHTML = s.noMask ? '' :
      `<svg viewBox="0 0 ${STAGE_W} ${STAGE_H}" width="${STAGE_W}" height="${STAGE_H}"><path fill-rule="evenodd" d="M0,0H${STAGE_W}V${STAGE_H}H0z${holes}"/></svg>`;
    this.ring.replaceChildren(...this.rects.map((r) => h('div', { class: 'tut-ring', style: `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px` })));
    if (!this.shown || s.chip) {
      this.shown = true;
      const btn = s.until === 'tap' ? h('button', { class: 'btn primary tut-ok' }, h('span', null, this.i === STEPS.length - 1 ? '完成' : '继续')) : null;
      btn?.addEventListener('click', () => { sfx.click(); this.next(); });
      this.box.replaceChildren(s.chip ? '' : h('div', { class: 'tut-step' }, `${this.i + 1}/${STEPS.length}`), h('div', { class: 'tut-text', html: text }), ...(btn ? [btn] : []));
    }
    if (s.chip) this.box.style.cssText = '';
    else this.place();
  }

  /** 说明框：在候选位置里挑与高亮区域重叠最少的，尽量贴近第一个高亮 */
  private place() {
    const W = Math.max(440, Math.min(720, 320 / stageState.scale)), M = 12;
    this.box.style.width = `${W}px`;
    const H = this.box.offsetHeight || 150;
    const f = this.rects[0];
    const clampX = (x: number) => Math.max(16, Math.min(STAGE_W - W - 16, x));
    const clampY = (y: number) => Math.max(84, Math.min(STAGE_H - H - 12, y));
    const cx = f ? clampX(f.x + f.w / 2 - W / 2) : STAGE_W / 2 - W / 2;
    const cand: { x: number; y: number }[] = [];
    if (f) {
      cand.push({ x: cx, y: clampY(f.y - H - M) }, { x: cx, y: clampY(f.y + f.h + M) });
      cand.push({ x: clampX(f.x + f.w + M), y: clampY(f.y + f.h / 2 - H / 2) }, { x: clampX(f.x - W - M), y: clampY(f.y + f.h / 2 - H / 2) });
    }
    for (const y of [92, STAGE_H / 2 - H / 2, STAGE_H - H - 12]) for (const x of [cx, 16, STAGE_W - W - 16]) cand.push({ x, y: clampY(y) });
    // 固定退出入口也参与避让，不能被移动中的讲解框盖住。
    const skip = this.resolve('.tut-skip');
    const avoid = skip ? [...this.rects, { x: skip.x - 12, y: skip.y - 12, w: skip.w + 24, h: skip.h + 24 }] : [...this.rects];
    // 查看详情时仍需读说明并点继续；详情出现、移动或关闭后重新避让。
    const tip = this.resolve(() => document.querySelector<HTMLElement>('.tip.on'));
    if (tip) avoid.push(tip);
    const overlap = (p: { x: number; y: number }) => avoid.reduce((a, r) =>
      a + Math.max(0, Math.min(p.x + W, r.x + r.w) - Math.max(p.x, r.x)) * Math.max(0, Math.min(p.y + H, r.y + r.h) - Math.max(p.y, r.y)), 0);
    let best = cand[0], score = Infinity;
    for (const p of cand) { const o = overlap(p); if (o < score - 1) { best = p; score = o; } }
    this.box.style.cssText = `left:${best.x}px;top:${best.y}px;width:${W}px`;
  }

  /** 输入锁：只放行高亮区域、说明框和跳过按钮 */
  private guard = (e: Event) => {
    const s = STEPS[this.i];
    if (this.disposed || this.isCompleteResult() || !this.active(s) || s.noMask) return;
    const t = e.target as HTMLElement | null;
    if (e instanceof KeyboardEvent) {
      // The mask restricts actions, not focus navigation. Keep Tab inside the
      // current teaching controls and highlighted targets, including after a
      // step removes the previously focused Continue button.
      const targets = [...this.host.el.querySelectorAll<HTMLElement>('button:not(:disabled),[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')]
        .filter((el) => {
          if (!el.getClientRects().length || getComputedStyle(el).visibility !== 'visible' || el.closest('[hidden],[inert]')) return false;
          if (this.el.contains(el)) return true;
          const b = el.getBoundingClientRect(), p = toStage(b.left + b.width / 2, b.top + b.height / 2);
          return this.allowRects.some((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
        });
      if (e.key === 'Tab') {
        e.stopPropagation(); e.preventDefault();
        const i = targets.indexOf(document.activeElement as HTMLElement);
        const next = i < 0 ? (e.shiftKey ? targets.length - 1 : 0) : (i + (e.shiftKey ? -1 : 1) + targets.length) % targets.length;
        targets[next]?.focus();
      } else if (e.key !== 'Escape' && !(t && (this.el.contains(t) || targets.some((el) => el === t || el.contains(t))))) {
        e.stopPropagation(); e.preventDefault();
      }
      return;
    }
    if (t && this.el.contains(t)) return;
    const p = e instanceof MouseEvent ? toStage(e.clientX, e.clientY) : null;
    if (p && this.allowRects.some((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h)) return;
    e.stopPropagation();
    e.preventDefault();
  };
}
