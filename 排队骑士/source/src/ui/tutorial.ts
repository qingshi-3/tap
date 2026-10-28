import type { RunState } from '../core/run';
import { prepareTutorialStep, tutorialStepDone, tutorialPositionAllowed, type TutorialStep } from '../core/tutorial';
import { slotX, UNIT_Y } from '../qb/board';
import { h, STAGE_W, STAGE_H, stageState, toStage } from '../qb/dom';
import { sfx } from '../qb/audio';
import { hideTip } from '../qb/tip';
import '../qb/css/tutorial-guide.css';

// Presentation and target placement are reused from 奇兵列阵/ui/tutorial.ts.
// Only the lesson route and legal actions belong to 排队骑士.
export const TUTORIAL_FLAG = 'pdqs_tutorial_done_v1';
export function tutorialDone() { try { return localStorage.getItem(TUTORIAL_FLAG) === '1'; } catch { return false; } }
interface Rect { x: number; y: number; w: number; h: number }
type Target = string | (() => Rect);
type Action = { kind: 'buy' | 'food' | 'move' | 'equip' | 'sell' | 'lock' | 'reroll' | 'battle' | 'other'; slot?: number; from?: number; def?: string };
interface Host { el: HTMLElement; run: RunState; busy(): boolean; render(): void; finish(): void }
interface Step { id: TutorialStep | 'welcome' | 'rules' | 'report'; text: string; at: Target[]; tap?: boolean }
const slot = (n: number) => () => ({ x: slotX(0, n) - 52, y: UNIT_Y - 115, w: 104, h: 205 });
const first = '.tray .cards > .card:first-child';
const food = '.sp-list > :first-child';
const STEPS: Step[] = [
  { id: 'welcome', tap: true, at: [slot(0), slot(4)], text: '左边是你的队伍，靠近中线的 <b>1 号位是前排</b>。<br>这是一局独立教学，不影响你的正式存档。' },
  { id: 'buy', at: [first, slot(0)], text: '每回合 <b>10 金</b>，招募一名单位 <b>3 金</b>。<br>按住<b>残魂小鬼</b>，拖到 <b>1 号位</b>。点一下可以看详情。' },
  { id: 'merge', at: [first, slot(0)], text: '把第二张<b>残魂小鬼</b>拖到它身上，合并同名单位。' },
  { id: 'star', at: [first, slot(0)], text: '再合并一张：<b>3 份升二星，6 份升三星</b>。<br>升星会增强技能，并出现一张高一阶的奖励卡，仍需花钱购买。' },
  { id: 'lock', at: [food], text: '金币不够买面包了。点开<b>面包</b>，再点<b>锁定</b>，把它留给下一回合。' },
  { id: 'reroll', at: ['.tray .reroll:not(.rewarded)'], text: '用最后 <b>1 金刷新</b>。锁定的商品会保留。<br>剩余金币不结转；新回合重新获得 10 金。' },
  { id: 'rules', tap: true, at: [slot(0)], text: '前排先交锋，阵亡后由身后的单位接上。<br><b>残魂小鬼阵亡会召唤魂火</b>，战斗中自动触发。' },
  { id: 'battle1', at: ['.tray .fight'], text: '点<b>开战</b>，看看小鬼和它召唤的魂火如何战斗。' },
  { id: 'report', tap: true, at: ['.result-ov .res-title'], text: '战报可以查看每名单位的输出与承伤，也能<b>复盘</b>。<br>看完后点战报里的<b>继续</b>，进入下一次备战。' },
  { id: 'ally', at: [first, slot(1)], text: '把<b>暗棘</b>拖到 <b>2 号位</b>，增加一名队友。' },
  { id: 'food', at: [food, slot(0)], text: '把留下的<b>面包</b>拖给 <b>1 号位小鬼</b>，永久获得 +1 攻击、+1 生命。<br>补给效果不同，使用前可以点开查看。' },
  { id: 'position', at: [slot(0), slot(1)], text: '交换<b>小鬼与暗棘</b>的站位，拖动任意一只到另一只身上。<br>让暗棘先上场，观察它的阵亡效果。' },
  { id: 'equip', at: ['.bag-strip', slot(0)], text: '教学赠送了一件<b>锁子甲</b>。把背包里的装备拖给<b>前排暗棘</b>。<br>正式游戏中，挑战精英可获得装备箱。' },
  { id: 'battle2', at: ['.tray .fight'], text: '点<b>开战</b>，观察装备与新站位的效果。<br>正式战斗后可在战报中<b>调整试打</b>。' },
  { id: 'done', tap: true, at: [], text: '<b>教学完成。</b><br>正式游戏中可以拖单位到招募栏出售，或点开详情出售。接下来试着找出你自己的搭配。' },
];

export class Tutorial {
  private i = 0;
  private el = h('div', { class: 'tut' });
  private mask = h('div', { class: 'tut-mask' });
  private ring = h('div', { class: 'tut-rings' });
  private box = h('div', { class: 'tut-box', role: 'status', 'aria-live': 'polite' });
  private timer = 0;
  private rects: Rect[] = [];
  private disposed = false;
  private sig = '';
  private shown = false;
  private resultCount = 0;
  constructor(private host: Host) {
    const skip = h('button', { class: 'tut-skip' }, '跳过教学');
    skip.addEventListener('click', () => this.finish(false));
    this.el.append(this.mask, this.ring, this.box, skip);
    host.el.appendChild(this.el);
    for (const t of ['pointerdown', 'click', 'keydown', 'wheel'] as const) host.el.addEventListener(t, this.guard, true);
    this.timer = window.setInterval(() => this.update(), 100);
  }
  dispose() {
    this.disposed = true;
    clearInterval(this.timer);
    for (const t of ['pointerdown', 'click', 'keydown', 'wheel'] as const) this.host.el.removeEventListener(t, this.guard, true);
    this.el.remove();
  }
  private finish(completed: boolean) {
    if (this.disposed) return;
    if (completed) { try { localStorage.setItem(TUTORIAL_FLAG, '1'); } catch { /* storage unavailable */ } }
    hideTip(); this.dispose(); this.host.finish();
  }
  complete() { if (this.resultCount >= 2) this.finish(true); }
  result() { this.resultCount++; this.update(); }
  allows(a: Action) {
    const id = STEPS[this.i].id;
    if (this.host.busy()) return false;
    if (['buy', 'merge', 'star'].includes(id)) return a.kind === 'buy' && a.slot === 0 && a.def === 'a_imp';
    if (id === 'ally') return a.kind === 'buy' && a.slot === 1 && a.def === 'a_spine';
    if (id === 'food') return a.kind === 'food' && a.slot === 0 && a.def === 'f_bread';
    if (id === 'position') return a.kind === 'move' && tutorialPositionAllowed(a.from, a.slot);
    if (id === 'equip') return a.kind === 'equip' && a.slot === 0;
    if (id === 'lock') return a.kind === 'lock' && a.def === 'f_bread';
    return (id === 'reroll' && a.kind === 'reroll') || ((id === 'battle1' || id === 'battle2') && a.kind === 'battle');
  }
  private next() {
    hideTip();
    this.i++; this.shown = false; this.sig = '';
    const s = STEPS[this.i];
    if (!s) { this.finish(true); return; }
    if (!['welcome', 'rules', 'report'].includes(s.id)) {
      prepareTutorialStep(this.host.run, s.id as TutorialStep);
      if (!this.host.busy()) this.host.render();
    }
    this.update();
  }
  private resolve(t: Target): Rect | null {
    if (typeof t !== 'string') return t();
    const e = this.host.el.querySelector<HTMLElement>(t);
    if (!e?.isConnected || !e.getClientRects().length) return null;
    const b = e.getBoundingClientRect();
    const a = toStage(b.left, b.top), z = toStage(b.right, b.bottom);
    return { x: a.x, y: a.y, w: z.x - a.x, h: z.y - a.y };
  }
  private active() {
    const id = STEPS[this.i].id;
    if (id === 'done') return false;
    if (id === 'report') return !!this.host.el.querySelector('.result-ov');
    return !this.host.busy() && !this.host.el.querySelector('.result-ov');
  }
  private update() {
    if (this.disposed) return;
    const s = STEPS[this.i];
    const complete = s.id === 'battle1' ? this.resultCount >= 1 : s.id === 'battle2' ? this.resultCount >= 2 :
      !s.tap && this.active() && tutorialStepDone(this.host.run, s.id as TutorialStep);
    if (complete) { this.next(); return; }
    const on = this.active();
    this.el.classList.toggle('on', on);
    this.el.classList.toggle('focus-fight', s.id === 'battle1' || s.id === 'battle2');
    this.el.dataset.step = s.id;
    if (!on) { this.shown = false; this.sig = ''; return; }
    this.rects = s.at.map(t => this.resolve(t)).filter((r): r is Rect => !!r).map(r => ({ x: r.x - 6, y: r.y - 6, w: r.w + 12, h: r.h + 12 }));
    const tip = document.querySelector<HTMLElement>('.tip.on');
    const sig = `${this.i}|${STAGE_H}|${stageState.scale}|${tip?.textContent}|${JSON.stringify(this.rects)}`;
    if (sig === this.sig && this.shown) return;
    this.sig = sig;
    const holes = this.rects.map(r => `M${r.x},${r.y}h${r.w}v${r.h}h${-r.w}z`).join('');
    this.mask.innerHTML = `<svg viewBox="0 0 ${STAGE_W} ${STAGE_H}" width="${STAGE_W}" height="${STAGE_H}"><path fill-rule="evenodd" d="M0,0H${STAGE_W}V${STAGE_H}H0z${holes}"/></svg>`;
    this.ring.replaceChildren(...this.rects.map(r => h('div', { class: 'tut-ring', style: `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px` })));
    if (!this.shown) {
      this.shown = true;
      const btn = s.tap ? h('button', { class: 'btn primary tut-ok' }, h('span', null, s.id === 'report' ? '知道了' : s.id === 'done' ? '完成' : '继续')) : null;
      btn?.addEventListener('click', () => { sfx.click(); this.next(); });
      this.box.replaceChildren(h('div', { class: 'tut-step' }, `${this.i + 1}/${STEPS.length - 1}`), h('div', { class: 'tut-text', html: s.text }), ...(btn ? [btn] : []));
    }
    this.place();
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
    const tip = this.tipRect();
    if (tip) avoid.push(tip);
    const overlap = (p: { x: number; y: number }) => avoid.reduce((a, r) =>
      a + Math.max(0, Math.min(p.x + W, r.x + r.w) - Math.max(p.x, r.x)) * Math.max(0, Math.min(p.y + H, r.y + r.h) - Math.max(p.y, r.y)), 0);
    let best = cand[0], score = Infinity;
    for (const p of cand) { const o = overlap(p); if (o < score - 1) { best = p; score = o; } }
    this.box.style.cssText = `left:${best.x}px;top:${best.y}px;width:${W}px`;
  }

  private tipRect(): Rect | null {
    const tip = document.querySelector<HTMLElement>('.tip.on');
    if (!tip) return null;
    const b = tip.getBoundingClientRect(), a = toStage(b.left, b.top), z = toStage(b.right, b.bottom);
    return { x: a.x, y: a.y, w: z.x - a.x, h: z.y - a.y };
  }
  private guard = (e: Event) => {
    if (this.disposed || !this.active()) return;
    const t = e.target as HTMLElement | null;
    if (t && this.el.contains(t)) return;
    // The existing detail popup lives outside Game. Mutations are independently
    // checked in Game, so opening a detail never grants permission to buy/sell.
    const allowed = (el: HTMLElement) => {
      if (this.el.contains(el)) return true;
      const b = el.getBoundingClientRect(), p = toStage(b.left + b.width / 2, b.top + b.height / 2);
      return this.rects.some(r => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
    };
    if (e instanceof KeyboardEvent) {
      if (e.key === 'Tab') {
        const targets = [...this.host.el.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"]')].filter(el => el.getClientRects().length && allowed(el));
        const i = targets.indexOf(document.activeElement as HTMLElement);
        targets[(i + (e.shiftKey ? targets.length - 1 : 1)) % targets.length]?.focus();
      } else if (e.key === 'Escape' || (t && allowed(t))) return;
    } else if (e instanceof MouseEvent) {
      const p = toStage(e.clientX, e.clientY);
      if (this.rects.some(r => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h)) return;
    }
    e.stopPropagation(); e.preventDefault();
  };
}
