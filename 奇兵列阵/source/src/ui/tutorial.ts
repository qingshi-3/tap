import { battleNo, newRun, screen, teamSize, stashTotal, type RunState } from '../core/run';
import { slotX, UNIT_Y, SLOT_SPACING } from './board';
import { h, STAGE_W, STAGE_H, toStage } from './dom';
import { sfx } from './audio';

// 新手教学：固定种子、固定候选，前 3 场 + 第一个商店。
// 蒙层镂空高亮目标；输入锁只放行高亮区域；每步按事件或状态推进。

export const TUTORIAL_FLAG = 'zl_tutorial_done';
export const tutorialDone = () => localStorage.getItem(TUTORIAL_FLAG) === '1';
const TUTORIAL_SEED = 20261017;

export function newTutorialRun(): RunState {
  const r = newRun('argeon', TUTORIAL_SEED);
  r.picks = 3;
  return r;
}

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
/** 自由练习结束点：教学 3 场 + 自由 3 场 = 第 6 场打完 */
const FREE_END = 6;
const prep = (b: number) => (r: RunState, m: string) => m === 'prep' && battleNo(r) === b;
const held = (_: RunState, m: string, x: Ctx) => m === 'battle' && x.hold;

/** 固定候选：按（第几战, 剩余招募, 剩余刷新）给出 */
function scriptDraft(r: RunState): string[] | null {
  const b = battleNo(r);
  if (b === 0) return r.picks >= 2 ? ['n_merc', 'l_vigil', 'n_archer'] : ['l_vigil', 'n_archer', 'n_medic'];
  if (b === 1) return r.rerolls > 0 ? ['s_backstab', 'n_bulwark', 'm_hide'] : ['n_bulwark', 'd_sentry', 'n_medic'];
  if (b === 2) return ['v_chaser', 'v_guard', 'n_bulwark'];
  return null;
}

let actors: HTMLElement[] = [];

const STEPS: Step[] = [
  { gate: prep(0), at: [fieldRect, () => slotRect(1, 0)], until: 'tap',
    text: '左边 5 个格位是你的阵型，右边是敌阵。<br>靠近中线的 <b>1 号位是队首</b>：最先出手，也最先挨打。' },
  { gate: prep(0), at: ['.hud-general'], until: 'tap',
    text: '左上角是你的<b>主将</b>。主将不上场、不会被攻击，每场战斗在固定时机<b>自动释放技能</b>。<br>点头像可以查看技能；之后获得的「法强」培养点可以分给主将，让技能更强。' },
  { gate: prep(0), at: ['.tray .cards > .card:nth-child(1)', fieldRect], until: (r, m) => m === 'prep' && r.picks < 3,
    text: '这是本轮的候选卡，每轮能招 <b>2~3</b> 张。<br><b>按住「佣兵」</b>，拖到 1 号位松手。（点一下卡牌只是查看详情）' },
  { gate: prep(0), at: ['.tray .cards > .card:nth-child(1)', fieldRect], until: 'merge',
    text: '又来了一张<b>同名卡</b>。把它拖到已有的佣兵身上，<b>合并升星</b>：属性变强、能力升级。' },
  { gate: prep(0), at: ['.tray .cards', fieldRect], until: (r) => r.picks <= 0,
    text: '把剩下的招募机会用掉：挑一张放到 2 号位。' },
  { gate: prep(0), at: ['.tray .fight'], until: 'battle-start',
    text: '准备好了就<b>开战</b>。战斗全自动，你只需要看。' },
  { gate: held, hold: true, at: [() => actors[0] ?? null, () => actors[1] ?? null], until: 'tap',
    text: '先暂停一下。战斗按<b>拍</b>进行：每一拍，双方从队首往后<b>轮流出手</b>。<br>圈出的就是这一拍双方最先出手的单位。' },
  { gate: held, hold: true, at: [() => actors[0] ?? null, () => actors[1] ?? null], until: 'tap',
    text: '带「施法」的单位轮到时执行施法，其余单位<b>普攻</b>对面的队首。<br>普攻双方<b>同时结算</b>；生命归零就会倒下，后面的单位往前补位。' },
  { gate: held, hold: true, at: ['.order-strip'], until: 'tap',
    text: '上方这条是双方本拍的<b>出手顺序</b>（数字是格位号），下一个出手的单位会发光。<br>一方全部倒下即分出胜负。点继续观看战斗。' },
  { gate: (_, m) => m === 'battle', at: ['.battle-bar'], until: 'battle-end', noMask: true,
    text: '战斗进行中。底部可以<b>加速</b>或<b>跳过</b>。' },

  { gate: prep(1), at: [() => slotRect(0, 0)], until: 'tip',
    text: '<b>点一下</b>你的单位，可以看到它的属性、能力和关键词说明。' },
  { gate: prep(1), at: [enemyRect], until: 'tap',
    text: '敌人也一样可以点开查看。角标是它们的<b>关键词</b>：格挡抵消一次伤害、护甲减伤……<br>这一关的影袭者带<b>狙击</b>，会打你的队尾。' },
  { gate: prep(1), at: ['.prep-entry', '.prep-ov .pt-power', '.prep-ov .pu-card.gen'], until: (r) => !(r.stash.power > 0),
    text: '赢下战斗会获得<b>培养点</b>。打开<b>「整备」</b>，先点<b>「法」</b>，再点<b>主将</b>，把法强分给主将。' },
  { gate: prep(1), at: ['.prep-entry', '.prep-ov .pp-tray', '.prep-ov .pp-units'], until: (r) => stashTotal(r) === 0,
    text: '其余培养点：点一下点数，再点一个单位。单位上会显示分配后的属性。把点数都分完。' },
  closePrep,
  { gate: prep(1), at: ['.tray .reroll'], until: 'reroll',
    text: '候选不满意？点<b>刷新</b>换一批（每轮 1 次）。' },
  { gate: prep(1), at: ['.tray .cards', fieldRect, '.bench'], until: (r) => r.picks <= 0,
    text: '招两张卡上场。' },
  { gate: prep(1), skip: (r) => teamSize(r) < 2, at: [fieldRect], until: 'move',
    text: '站位很重要：把一个单位<b>拖到另一个单位上</b>，两者换位。' },
  { gate: prep(1), at: ['.tray .fight'], until: 'battle-start', text: '开战，留意主将技能什么时候发动。' },
  { gate: (_, m) => m === 'battle', at: ['.battle-bar'], until: 'battle-end', noMask: true,
    text: '主将技能会画出指向目标的弹道。' },

  { gate: prep(2), at: [fieldRect, '.bench', '.tray .cards'], until: 'sell',
    text: '用不上的单位可以<b>卖掉</b>：按住单位，<b>拖到下方招募栏</b>松手。<br>每份换 1 金，培养点和装备会退回。' },
  { gate: prep(2), at: ['.tray .cards > .card:nth-child(1)', fieldRect], until: (r) => r.picks <= 1,
    text: '<b>雪原学徒</b>施法给敌方队首<b>寒意</b>：下次出手攻击降低；寒意 ≥ 攻击时直接<b>冻结</b>，跳过出手。招它上场。' },
  { gate: prep(2), at: ['.tray .cards', fieldRect, '.bench'], until: (r) => r.picks <= 0, text: '再招一张。' },
  { gate: prep(2), at: ['.tray .fight'], until: 'battle-start', text: '开战，看敌人被冻住。' },
  { gate: (_, m) => m === 'battle', at: ['.battle-bar'], until: 'battle-end', noMask: true,
    text: '冰蓝色的<b>寒意</b>角标就是要被减攻 / 冻结的单位。' },

  // 商店：只讲一次怎么买 / 怎么卖，然后放开让玩家自己逛，离开商店才推进；不强制购买，也不拦着不让买
  { gate: (r, m) => m === 'phase' && screen(r) === 'shop', at: ['.sh-goods', '.sh-detail'], until: 'tap',
    text: '每章会遇到两次<b>商店</b>，用金币买单位、装备、法术。<br><b>点一件商品</b>看说明，再点说明栏里的<b>「购买」</b>；点下方阵容里的单位可以查看它的现状。' },
  { gate: (r, m) => m === 'phase' && screen(r) === 'shop', noMask: true, chip: true, until: (_, m) => m === 'prep',
    text: '随便逛逛，买好了点右上角<b>「离开商店」</b>。' },
  { gate: (_, m) => m === 'prep', at: ['.prep-entry', '.prep-ov .pp-tray', '.prep-ov .pp-units'], until: 'equip', skip: (r) => !r.bag.length,
    text: '买到的装备也在<b>「整备」</b>里：点装备，再点一个单位装上。' },
  closePrep,
  { gate: (_, m) => m === 'prep', until: 'tap',
    text: '该教的都教完了。<br>接下来<b>自己打 3 场</b>练练手：怎么招募、怎么站位、要不要卖都由你决定。' },
  // 自由练习：不加蒙层、不锁输入，只在角落提示进度；打完 3 场（走到本章第二个商店前）结束
  { noMask: true, chip: true, until: (r) => battleNo(r) >= FREE_END,
    text: (r) => `自由练习 <b>${Math.min(3, Math.max(1, battleNo(r) - FREE_END + 4))}/3</b>` },
  { until: 'tap',
    text: '教学完成！<br>正式远征共 3 章 21 战，3 条命，打赢首领回 1 条命。祝你好运。' },
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
  /** 上次落到 DOM 的高亮签名，没变就不重画 */
  private sig = '';

  constructor(private host: TutHost) {
    const skip = h('button', { class: 'btn ghost tut-skip' }, h('span', null, '跳过教学'));
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
    if (r.picks <= 0) return;
    const d = scriptDraft(r);
    if (d && d.join() !== r.draft.join()) r.draft = d;
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
    if (s && this.active(s) && (s.skip?.(this.host.run) || (typeof s.until === 'function' && s.until(this.host.run, this.host.mode())))) { this.next(); return; }
    const on = this.active(s);
    this.el.classList.toggle('on', on);
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
    const sig = `${this.i}|${text}|${s.noMask ? 1 : 0}|${this.rects.map((r) => `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)},${Math.round(r.h)}`).join(';')}`;
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
    const W = 440, M = 12;
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
    const overlap = (p: { x: number; y: number }) => this.rects.reduce((a, r) =>
      a + Math.max(0, Math.min(p.x + W, r.x + r.w) - Math.max(p.x, r.x)) * Math.max(0, Math.min(p.y + H, r.y + r.h) - Math.max(p.y, r.y)), 0);
    let best = cand[0], score = Infinity;
    for (const p of cand) { const o = overlap(p); if (o < score - 1) { best = p; score = o; } }
    this.box.style.cssText = `left:${best.x}px;top:${best.y}px;width:${W}px`;
  }

  /** 输入锁：只放行高亮区域、说明框和跳过按钮 */
  private guard = (e: Event) => {
    const s = STEPS[this.i];
    if (this.disposed || !this.active(s) || s.noMask) return;
    const t = e.target as HTMLElement | null;
    if (t && this.el.contains(t)) return;
    if (e instanceof KeyboardEvent) { if (e.key !== 'Escape') { e.stopPropagation(); e.preventDefault(); } return; }
    const p = e instanceof MouseEvent ? toStage(e.clientX, e.clientY) : null;
    if (p && this.allowRects.some((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h)) return;
    e.stopPropagation();
    e.preventDefault();
  };
}
