import './rounds.css';
import '../battle-arrows.css';
import '../unit-keywords.css';
import { FACTION_INFO, unitDef } from '../core/data';
import { SLOTS, tri } from '../core/engine';
import type { Faction, Side, UnitState } from '../core/types';
import { h } from './dom';
import { icon, type IconName } from './icons';
import { unitSvg } from './unitArt';

// 场上单位、备战位共用的阵营徽记（精灵见 pixel.ts SIGILS）
export const factionSigil = (f: Faction) => h('i', { class: `u-fac f-${f}`, style: `--pxs:var(--pxs-${f});--fc:${FACTION_INFO[f].color}` });
// Battlefield and bench share the same authored pixel pedestal.
export const seatArt = () => h('div', { class: 'ped' }, h('div', { class: 'ped-rune' }), h('div', { class: 'ped-top' }));

/** The same pixel stat gem is used by combat units and owned bench units. */
export const statArt = (kind: 'atk' | 'hp' | 'armor' | 'power' | 'block', value: number | HTMLElement, extra?: HTMLElement) =>
  h('div', { class: `st ${kind}` }, kind === 'block' ? icon('shield') : kind === 'atk' || kind === 'hp' ? icon(kind === 'atk' ? 'sword' : 'heart') : null, typeof value === 'number' ? h('i', null, value) : value, extra);

export const UNIT_Y = 300;
export const SLOT_SPACING = 110;
export const slotX = (side: Side, slot: number) => (side === 0 ? 540 - slot * SLOT_SPACING : 740 + slot * SLOT_SPACING);
/** 单位身体中心（特效、箭头锚点） */
export const bodyPos = (side: Side, slot: number) => ({ x: slotX(side, slot), y: UNIT_Y - 12 });
export const headPos = (side: Side, slot: number) => ({ x: slotX(side, slot), y: UNIT_Y - 66 });

export interface StatView {
  atk: number;
  hp: number;
  maxHp: number;
  block: number;
  chill: number;
  burn: number;
  vuln?: number;
  actionsLeft?: number;
  /** 仅有限次施法单位拥有，0 表示本场已用完。 */
  charges?: number;
  /** 常驻词条（含开战后获得的），缺省时不改动标记 */
  kw?: UnitKeywords;
}

export interface UnitKeywords {
  armor: number;
  thorns: number;
  splash: number;
  power: number;
  combo: boolean;
  snipe: boolean;
  guard: boolean;
  /** 复生尚未用掉 */
  reborn: boolean;
}

// 词条小标：顺序即显示顺序，数值类只在 >0 时显示
const KW_CHIPS: { k: keyof UnitKeywords; icon: IconName; name: string }[] = [
  { k: 'guard', icon: 'guard', name: '护卫' },
  { k: 'armor', icon: 'plate', name: '护甲' },
  { k: 'thorns', icon: 'spikes', name: '反击' },
  { k: 'combo', icon: 'combo', name: '连击' },
  { k: 'snipe', icon: 'snipe', name: '狙击' },
  { k: 'splash', icon: 'burst', name: '溅射' },
  { k: 'power', icon: 'sparkle', name: '法强' },
];

export class UnitView {
  el: HTMLElement;
  body: HTMLElement;
  art: HTMLElement;
  private atkEl: HTMLElement;
  private hpEl: HTMLElement;
  private shEl: HTMLElement;
  private chEl: HTMLElement;
  private bnEl: HTMLElement;
  private vnEl: HTMLElement;
  private atkBox: HTMLElement;
  private hpBox: HTMLElement;
  private dAtk: HTMLElement;
  private dHp: HTMLElement;
  private kwEl: HTMLElement;
  private kwKey = '';
  tags: HTMLElement;
  side: Side;
  slot: number;
  defId: string;
  level: number;
  private last: StatView | null = null;

  constructor(defId: string, side: Side, slot: number, level: number, o: { token?: boolean } = {}) {
    this.defId = defId;
    this.side = side;
    this.slot = slot;
    this.level = level;
    const d = unitDef(defId);
    this.atkEl = h('i', null, '0');
    this.hpEl = h('i', null, '0');
    this.shEl = h('i', null, '0');
    this.chEl = h('i', null, '0');
    this.bnEl = h('i', null, '0');
    this.vnEl = h('i', null, '0');
    this.dAtk = h('em', { class: 'delta' });
    this.dHp = h('em', { class: 'delta' });
    this.atkBox = statArt('atk', this.atkEl, this.dAtk);
    this.hpBox = statArt('hp', this.hpEl, this.dHp);
    this.art = h('div', { class: 'u-art', html: unitSvg(defId, { enemy: side === 1, small: o.token || d.token }) });
    this.tags = h('div', { class: 'u-tags' });
    this.kwEl = h('div', { class: 'u-kws' });
    this.body = h(
      'div',
      { class: 'u-body' },
      h('div', { class: 'u-bob' }, this.art, h('div', { class: 'u-ice' })),
    );
    const pips =
      !d.enemyOnly && !d.token
        ? h('div', { class: 'u-pips' }, Array.from({ length: level }, () => h('span', { class: 'on' }, icon('star'))))
        : null;
    this.el = h(
      'div',
      {
        class: `unit side-${side} f-${d.faction}${d.token ? ' token' : ''}`,
        'data-side': side,
        'data-slot': slot,
      },
      h('div', { class: 'u-glow' }),
      h('div', { class: 'u-reborn' }, h('i')),
      this.body,
      h('div', { class: 'u-shield' }, icon('shield'), this.shEl),
      h('div', { class: 'u-chill' }, icon('snow'), this.chEl),
      h('div', { class: 'u-burn' }, icon('fire'), this.bnEl),
      h('div', { class: 'u-vuln', title: '易伤' }, icon('target'), this.vnEl),
      h('div', { class: 'u-stats' }, this.atkBox, d.faction === 'enemy' ? null : factionSigil(d.faction), this.hpBox),
      pips,
      this.kwEl,
      this.tags,
    );
    this.place(slot);
    // 每个单位呼吸节奏错开，避免整齐划一
    this.el.style.setProperty('--bob-delay', `${-Math.random() * 3}s`);
  }

  place(slot: number) {
    this.slot = slot;
    this.el.style.left = `${slotX(this.side, slot)}px`;
    this.el.style.top = `${UNIT_Y}px`;
    this.el.dataset.slot = String(slot);
  }

  /** 平滑移动到新格位（牵引、复生） */
  async moveTo(slot: number, dur = 420, lift = 46) {
    const from = slotX(this.side, this.slot);
    this.place(slot);
    const dx = from - slotX(this.side, slot);
    const a = this.el.animate(
      [
        { transform: `translate(${dx}px,0)` },
        { transform: `translate(${dx / 2}px,${-lift}px)`, offset: 0.5 },
        { transform: 'translate(0,0)' },
      ],
      { duration: dur, easing: 'cubic-bezier(.45,0,.3,1)' },
    );
    await a.finished.catch(() => undefined);
  }

  /**
   * 刷新数值。base 给出时显示差值（备战预览：开战后 vs 开战前）。
   * pop 为 true 时数值变化会弹一下。
   */
  setStats(s: StatView, o: { base?: { atk: number; hp: number }; pop?: boolean; maxHp?: number } = {}) {
    const prev = this.last;
    this.atkEl.textContent = String(Math.max(0, s.atk));
    this.hpEl.textContent = String(Math.max(0, s.hp));
    this.shEl.textContent = String(s.block);
    this.chEl.textContent = String(s.chill);
    this.bnEl.textContent = String(s.burn);
    this.vnEl.textContent = String(s.vuln ?? 0);
    this.el.classList.toggle('has-vuln', (s.vuln ?? 0) > 0);
    this.el.classList.toggle('has-shield', s.block > 0);
    this.el.classList.toggle('has-chill', s.chill > 0);
    // 寒意 ≥ 当前攻击：下次出手会被冻结
    this.el.classList.toggle('frozen', s.chill > 0 && s.chill >= s.atk);
    this.el.classList.toggle('has-burn', s.burn > 0);
    this.el.classList.toggle('action-spent', s.actionsLeft === 0);
    if (s.kw) this.setKeywords(s.kw);
    const baseAtk = o.base?.atk ?? null;
    const baseHp = o.base?.hp ?? null;
    this.hpBox.classList.toggle('hurt', s.hp < s.maxHp);
    if (baseAtk != null && baseHp != null) {
      const da = s.atk - baseAtk;
      const dh = s.hp - baseHp;
      this.atkBox.classList.toggle('up', da > 0);
      this.hpBox.classList.toggle('up', dh > 0);
      this.atkBox.classList.toggle('down', da < 0);
      this.hpBox.classList.toggle('down', dh < 0);
      this.dAtk.textContent = da ? (da > 0 ? `+${da}` : String(da)) : '';
      this.dHp.textContent = dh ? (dh > 0 ? `+${dh}` : String(dh)) : '';
    } else {
      this.dAtk.textContent = '';
      this.dHp.textContent = '';
      this.atkBox.classList.remove('down');
      this.hpBox.classList.remove('down');
      this.atkBox.classList.toggle('up', s.atk > levelBaseAtk(this));
      this.hpBox.classList.remove('up');
    }
    if (o.pop && prev) {
      if (prev.atk !== s.atk) popEl(this.atkBox, s.atk > prev.atk);
      if (prev.hp !== s.hp || prev.maxHp !== s.maxHp) popEl(this.hpBox, s.hp > prev.hp);
      if (prev.block !== s.block) popEl(this.el.querySelector('.u-shield')!, s.block > prev.block);
      if (prev.chill !== s.chill && s.chill) popEl(this.el.querySelector('.u-chill')!, false);
      if (prev.burn !== s.burn && s.burn) popEl(this.el.querySelector('.u-burn')!, false);
    }
    this.last = { ...s };
  }

  /** 护卫等常驻词条只保留脚下一排标记，避免与格挡次数重复叠盾。 */
  private setKeywords(kw: UnitKeywords) {
    this.el.classList.toggle('kw-guard', kw.guard);
    this.el.classList.toggle('kw-reborn', kw.reborn);
    const chips = KW_CHIPS.filter((c) => kw[c.k]);
    const key = chips.map((c) => `${c.k}${kw[c.k]}`).join();
    if (key === this.kwKey) return;
    const prev = this.kwKey ? new Set(this.kwKey.split(',')) : null;
    this.kwKey = key;
    this.kwEl.replaceChildren(...chips.map((c) => {
      const v = kw[c.k];
      const el = (c.k === 'armor' || c.k === 'power') && typeof v === 'number'
        ? statArt(c.k, v)
        : h('span', { class: `kwc kw-${c.k}` }, icon(c.icon), typeof v === 'number' ? h('i', null, v) : null);
      el.classList.add(`kw-${c.k}`);
      el.setAttribute('aria-label', typeof v === 'number' ? `${c.name} ${v}` : c.name);
      // 战斗中新获得 / 数值变化的词条弹一下
      if (prev && !prev.has(`${c.k}${v}`)) popEl(el, true);
      return el;
    }));
  }

  getStats(): StatView | null {
    return this.last ? { ...this.last } : null;
  }

  setTag(text: string | null, cls = '') {
    this.tags.replaceChildren();
    if (text) this.tags.appendChild(h('span', { class: `utag ${cls}` }, text));
  }
  addTag(text: string, cls = '') {
    this.tags.appendChild(h('span', { class: `utag ${cls}` }, text));
  }

  async lunge(dir: number, dist = 46, dur = 360) {
    const a = this.body.animate(
      [
        { transform: 'translate(0,0) rotate(0)' },
        { transform: `translate(${-dir * 10}px,2px) rotate(${-dir * 5}deg)`, offset: 0.22 },
        { transform: `translate(${dir * dist}px,-6px) rotate(${dir * 8}deg) scale(1.08)`, offset: 0.48 },
        { transform: `translate(${dir * dist * 0.6}px,0) rotate(${dir * 2}deg)`, offset: 0.62 },
        { transform: 'translate(0,0) rotate(0)' },
      ],
      { duration: dur, easing: 'ease-out' },
    );
    return a;
  }

  hit(dir: number) {
    this.body.animate(
      [
        { transform: 'translate(0,0)', filter: 'brightness(3) saturate(0)' },
        { transform: `translate(${dir * 12}px,0) rotate(${dir * 6}deg)`, filter: 'brightness(1.6)', offset: 0.3 },
        { transform: 'translate(0,0)', filter: 'none' },
      ],
      { duration: 280, easing: 'ease-out' },
    );
  }

  pulse(color = '#fff') {
    this.el.style.setProperty('--pulse', color);
    this.el.classList.remove('pulsing');
    void this.el.offsetWidth;
    this.el.classList.add('pulsing');
  }

  async die(exiled = false) {
    this.el.classList.add('dead');
    const a = this.body.animate(
      [
        { transform: 'scale(1) rotate(0)', opacity: 1, filter: 'brightness(1)' },
        { transform: 'scale(1.15,.85) rotate(0)', opacity: 1, filter: 'brightness(3)', offset: 0.2 },
        { transform: `translateY(18px) scale(.4) rotate(${exiled ? 160 : 30}deg)`, opacity: 0, filter: 'brightness(2)' },
      ],
      { duration: 460, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' },
    );
    this.el.querySelector('.u-stats')!.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
    await a.finished.catch(() => undefined);
    this.el.remove();
  }

  appear(delay = 0) {
    this.body.animate(
      [
        { transform: 'translateY(-30px) scale(.3)', opacity: 0, filter: 'brightness(4)' },
        { transform: 'translateY(4px) scale(1.12)', opacity: 1, filter: 'brightness(1.6)', offset: 0.6 },
        { transform: 'translateY(0) scale(1)', opacity: 1, filter: 'none' },
      ],
      { duration: 420, delay, easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'backwards' },
    );
  }
}

function levelBaseAtk(v: UnitView) {
  return unitDef(v.defId).atk + v.level - 1;
}

function popEl(el: Element, good: boolean) {
  el.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(1.55)', filter: `drop-shadow(0 0 8px ${good ? '#7dffb0' : '#ff5a5a'})`, offset: 0.35 },
      { transform: 'scale(1)' },
    ],
    { duration: 380, easing: 'cubic-bezier(.3,1.6,.5,1)' },
  );
}

export function statsOf(u: UnitState): StatView {
  return { atk: u.atk, hp: u.hp, maxHp: u.maxHp, block: u.block, chill: u.chill, burn: u.burn, vuln: u.vuln, actionsLeft: u.actionsLeft, charges: u.charges, kw: keywordsOf(u) };
}

export function keywordsOf(u: Pick<UnitState, 'defId' | 'level' | 'grants'> & Partial<Pick<UnitState, 'armor' | 'power' | 'revived'>>): UnitKeywords {
  const t = unitDef(u.defId).traits ?? {};
  const g = u.grants;
  return {
    armor: Math.max(0, u.armor ?? tri(t.armor, u.level) + (g.armor ?? 0)),
    thorns: tri(t.thorns, u.level) + (g.thorns ?? 0),
    splash: tri(t.splash, u.level) + (g.splash ?? 0),
    power: Math.max(0, u.power ?? tri(t.power, u.level) + (g.power ?? 0)),
    combo: !!(t.combo || g.combo),
    snipe: !!(t.snipe || g.snipe),
    guard: !!(t.guard || g.guard),
    reborn: !!(t.reborn || g.reborn) && !u.revived,
  };
}

export type ArrowKind = 'buff' | 'block' | 'dmg' | 'chill' | 'burn' | 'summon' | 'kill';
const ARROW_COLOR: Record<ArrowKind, string> = {
  buff: '#7dffb0',
  block: '#ffe08a',
  dmg: '#ff5a6a',
  chill: '#8feaff',
  burn: '#ff9a3d',
  summon: '#d6a8ff',
  kill: '#ff3b5c',
};

interface ArrowPoint { x: number; y: number }
const RELATION_COLOR = '#8bbbc9';
// Never reuse a clip id after clearing a board, including across simultaneous boards.
let nextDirectionClip = 0;

/** Trim the arc by distance so every direction keeps a readable, fixed-size head. */
function directionFlow(from: ArrowPoint, control: ArrowPoint, to: ArrowPoint) {
  const points: ArrowPoint[] = [];
  for (let i = 0; i <= 80; i++) {
    const t = i / 80;
    points.push({ x: (1 - t) ** 2 * from.x + 2 * (1 - t) * t * control.x + t * t * to.x,
      y: (1 - t) ** 2 * from.y + 2 * (1 - t) * t * control.y + t * t * to.y });
  }
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  const total = lengths[lengths.length - 1];
  const at = (distance: number): ArrowPoint => {
    const i = Math.max(1, lengths.findIndex((n) => n >= distance));
    const t = Math.max(0, Math.min(1, (distance - lengths[i - 1]) / Math.max(.001, lengths[i] - lengths[i - 1])));
    return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * t, y: points[i - 1].y + (points[i].y - points[i - 1].y) * t };
  };
  const start = Math.min(12, total * .08);
  const end = Math.max(start + 1, total - Math.min(14, total * .08));
  const headLength = Math.min(24, (end - start) * .3);
  const neck = end - headLength;
  const tip = at(end);
  const base = at(neck);
  const tangentLength = Math.max(.001, Math.hypot(tip.x - base.x, tip.y - base.y));
  const normal = { x: -(tip.y - base.y) / tangentLength, y: (tip.x - base.x) / tangentLength };
  const flow = Array.from({ length: 49 }, (_, i) => at(start + (neck - start) * i / 48));
  const left: ArrowPoint[] = [];
  const right: ArrowPoint[] = [];
  flow.forEach((p, i) => {
    const t = i / (flow.length - 1);
    const distance = start + (neck - start) * t;
    const before = at(Math.max(0, distance - 1));
    const after = at(Math.min(total, distance + 1));
    const length = Math.max(.001, Math.hypot(after.x - before.x, after.y - before.y));
    const half = (3 + 8 * t) / 2;
    const nx = -(after.y - before.y) / length * half;
    const ny = (after.x - before.x) / length * half;
    left.push({ x: p.x + nx, y: p.y + ny });
    right.push({ x: p.x - nx, y: p.y - ny });
  });
  const headHalf = Math.min(12, headLength * .5);
  const head = [{ x: base.x + normal.x * headHalf, y: base.y + normal.y * headHalf }, tip,
    { x: base.x - normal.x * headHalf, y: base.y - normal.y * headHalf }];
  const path = (vertices: ArrowPoint[]) => vertices.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  return { flow: path(flow), clip: path([...left, ...right.reverse()]) + ' Z', head: path(head) + ' Z' };
}
export class Board {
  el: HTMLElement;
  slots: HTMLElement[][] = [[], []];
  units: HTMLElement;
  arrows: SVGSVGElement;
  labels: HTMLElement;
  marks: HTMLElement;
  views = new Map<string, UnitView>();
  center: HTMLElement;
  centerNum: HTMLElement;
  centerLbl: HTMLElement;
  order: HTMLElement;

  constructor() {
    const slotsLayer = h('div', { class: 'slots' });
    for (const side of [0, 1] as Side[]) {
      for (let s = 0; s < SLOTS; s++) {
        const el = h(
          'div',
          { class: `slot side-${side}${s === 0 ? ' front' : ''}`, style: `left:${slotX(side, s)}px;top:${UNIT_Y}px`, 'data-side': side, 'data-slot': s },
          seatArt(),
          h('div', { class: 'slot-num' }, h('b', null, s + 1), s === 0 ? h('span', null, '队首') : null),
          h('div', { class: 'slot-mark' }),
        );
        this.slots[side][s] = el;
        slotsLayer.appendChild(el);
      }
    }
    this.centerNum = h('div', { class: 'vs-num' }, 'VS');
    this.centerLbl = h('div', { class: 'vs-lbl' }, '');
    this.center = h('div', { class: 'vs' }, h('div', { class: 'vs-ring' }), h('div', { class: 'vs-ring r2' }), this.centerNum, this.centerLbl);
    this.units = h('div', { class: 'units' });
    this.arrows = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.arrows.setAttribute('class', 'arrows');
    this.arrows.setAttribute('viewBox', '0 0 1280 720');
    this.arrows.innerHTML = '<g class="ag"></g>';
    this.labels = h('div', { class: 'arrow-labels' });
    this.marks = h('div', { class: 'marks' });
    this.order = h('div', { class: 'order-strip' });
    this.el = h('div', { class: 'board' }, h('div', { class: 'arena-floor' }), slotsLayer, this.center, this.units, this.marks, this.arrows, this.labels, this.order);
  }

  /** 出手顺序预告：高亮双方本拍出手者，并列出接下来的轮转（按格位号）。null 清空。 */
  setOrder(next: { player: string[]; enemy: string[] } | null, round?: number, wave = 1) {
    for (const v of this.views.values()) v.el.classList.remove('next-actor');
    this.order.replaceChildren();
    if (!next) return;
    const row = (keys: string[], cls: string, label: string) => h('div', { class: `os-side ${cls}${keys.length ? '' : ' waiting'}` }, label,
      keys.length ? null : h('span', { class: 'os-wait' }, '等待'),
      keys.map((k, i) => {
        const v = this.views.get(k);
        if (i === 0) v?.el.classList.add('next-actor');
        return v ? h('span', { class: `os-u${i === 0 ? ' first' : ''}` }, String(v.slot + 1)) : null;
      }));
    if (round != null) this.order.append(h('div', { class: 'os-round' }, `第${round}回合 · 第${wave}轮`));
    this.order.append(h('div', { class: 'os-queues' }, row(next.player, 'player', '我方'), row(next.enemy, 'enemy', '敌方')));
  }

  setCenter(num: string, lbl = '', cls = '') {
    this.centerNum.textContent = num;
    this.centerLbl.textContent = lbl;
    this.center.className = `vs ${cls}`;
  }

  view(key: string) {
    return this.views.get(key);
  }

  add(key: string, v: UnitView) {
    this.views.get(key)?.el.remove();
    this.views.set(key, v);
    this.units.appendChild(v.el);
    return v;
  }

  remove(key: string) {
    const v = this.views.get(key);
    if (v) v.el.remove();
    this.views.delete(key);
  }

  clearUnits() {
    for (const v of this.views.values()) v.el.remove();
    this.views.clear();
    this.order.replaceChildren();
  }

  slotEl(side: Side, slot: number) {
    return this.slots[side][slot];
  }

  setSlotClass(cls: string, pred: (side: Side, slot: number) => boolean) {
    for (const side of [0, 1] as Side[]) for (let s = 0; s < SLOTS; s++) this.slots[side][s].classList.toggle(cls, pred(side, s));
  }

  clearArrows() {
    this.arrows.querySelector('.ag')!.replaceChildren();
    this.labels.replaceChildren();
  }

  clearMarks() {
    this.marks.replaceChildren();
    for (const side of [0, 1] as Side[]) for (let s = 0; s < SLOTS; s++) this.slots[side][s].querySelector('.slot-mark')!.replaceChildren();
  }

  /** 画一条弧形箭头；from/to 为舞台坐标 */
  arrow(from: { x: number; y: number }, to: { x: number; y: number }, kind: ArrowKind, o: { label?: string; lift?: number; delay?: number; labelDx?: number; color?: string } = {}) {
    const g = this.arrows.querySelector('.ag')!;
    const c = ARROW_COLOR[kind];
    const mx = (from.x + to.x) / 2;
    const dist = Math.abs(to.x - from.x);
    const lift = o.lift ?? 34 + dist * 0.22;
    const my = Math.min(from.y, to.y) - lift;
    const ns = 'http://www.w3.org/2000/svg';
    const grp = document.createElementNS(ns, 'g');
    grp.setAttribute('class', `arw-g direction-flow arw-kind-${kind}`);
    grp.dataset.from = `${from.x},${from.y}`;
    grp.dataset.to = `${to.x},${to.y}`;
    grp.dataset.kind = kind;
    grp.style.color = o.color ?? RELATION_COLOR;
    grp.style.animationDelay = `${o.delay ?? 0}ms`;
    const defs = document.createElementNS(ns, 'defs');
    grp.appendChild(defs);
    const addFlow = (start: ArrowPoint, end: ArrowPoint, height: number, secondary = false) => {
      // Anchors stay above the character; every path runs from its own source to target.
      const d = directionFlow({ x: start.x, y: start.y - 12 }, { x: mx, y: height - 12 }, { x: end.x, y: end.y - 12 });
      const clipId = `direction-clip-${++nextDirectionClip}`;
      const clip = document.createElementNS(ns, 'clipPath');
      clip.id = clipId;
      clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
      const outline = document.createElementNS(ns, 'path');
      outline.setAttribute('d', d.clip);
      clip.appendChild(outline);
      defs.appendChild(clip);
      const flow = document.createElementNS(ns, 'path');
      flow.setAttribute('class', 'arw-flow');
      flow.setAttribute('d', d.flow);
      flow.setAttribute('stroke', o.color ?? RELATION_COLOR);
      flow.setAttribute('clip-path', `url(#${clipId})`);
      const head = document.createElementNS(ns, 'path');
      head.setAttribute('class', 'arw-head');
      head.setAttribute('d', d.head);
      head.setAttribute('fill', o.color ?? RELATION_COLOR);
      if (secondary) {
        flow.setAttribute('opacity', '.84');
        head.setAttribute('opacity', '.84');
      }
      grp.append(flow, head);
    };
    addFlow(from, to, my);
    g.appendChild(grp);
    if (o.label) {
      // 二次贝塞尔中点
      const lx = 0.25 * from.x + 0.5 * mx + 0.25 * to.x;
      const ly = 0.25 * from.y + 0.5 * my + 0.25 * to.y;
      this.labels.appendChild(
        h('div', { class: `arw-lbl direction-label k-${kind}`, 'data-kind': kind, style: `left:${lx + (o.labelDx ?? 0)}px;top:${ly - 32}px;--c:${c};animation-delay:${o.delay ?? 0}ms` }, o.label),
      );
    }
  }

  /** 单位身上的序号徽记（自我增益、无箭头的效果） */
  orderBadge(x: number, y: number, label: string, kind: ArrowKind, delay = 0) {
    const c = ARROW_COLOR[kind];
    this.labels.appendChild(h('div', { class: `arw-lbl self k-${kind}`, style: `left:${x}px;top:${y}px;--c:${c};animation-delay:${delay}ms` }, label));
  }

  /** 瞄准标记：敌方第一下打谁 */
  target(side: Side, slot: number, cls = '') {
    const p = bodyPos(side, slot);
    this.marks.appendChild(h('div', { class: `crosshair ${cls}`, style: `left:${p.x}px;top:${p.y}px` }, icon('target')));
  }

  slotMark(side: Side, slot: number, content: Node, cls = '') {
    this.slots[side][slot].querySelector('.slot-mark')!.appendChild(h('div', { class: `smark ${cls}` }, content));
  }
}



