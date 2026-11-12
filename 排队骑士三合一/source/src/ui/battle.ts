// 战斗播放：只读引擎事件流，不推算规则。队首交锋双方都出攻击动作，不做受击动作 / 受击闪白。
import { identityColor } from '../qb/archetypes';
import { ATOM_INFO, CARDS, EQUIPS, FOODS, RELICS, card } from '../core/data';
import type { BattleOut, Ev, Order, Snap } from '../core/engine';
import { sfx } from '../qb/audio';
import { Board, bodyPos, keywordsOf, UNIT_Y, UnitView } from '../qb/board';
import { h } from '../qb/dom';
import type { FX } from '../qb/fx';
import { icon } from '../qb/icons';
import { vfxFor, type Pt, type VfxKind, type VfxSource } from '../qb/vfx';

const SPEEDS = [1, 2, 3];
let speedIdx = 0;

interface Live { s: Snap; v: UnitView }
type EffectEvent = Extract<Ev, { tgt: number }>;
const sourceCards = new Map(CARDS.map(c => [c.name, c]));
const sourceSupport = new Map([...EQUIPS, ...FOODS, ...RELICS].map(s => [s.name, s]));

export class BattlePlayer {
  private live = new Map<number, Live>();
  private sides = new Map<number, Snap['side']>();
  private defs = new Map<number, string>();
  private anchors = new Map<number, { x:number; y:number; name:string; color:string }>();
  private skipping = false;
  /** 阵亡动画并行播放；队伍补位等到下一次交锋 / 召唤前再统一挪（先死后动，召唤不闪位） */
  private dying: Promise<void>[] = [];
  private pendingOrder: Order | null = null;
  private log: HTMLElement;
  private phase: HTMLElement;
  /** 演示用：静音、播放倍率（慢放）、逐事件钩子（返回 Promise 时暂停等待）、中止 */
  private sfx: typeof sfx = sfx;
  private demo = false;
  private playbackRate = 1;
  get rate() { return this.playbackRate; }
  set rate(value: number) { this.playbackRate = Math.max(0.1, value); this.fx.rate = this.speed; }
  hook: ((ev: Ev, i: number) => Promise<void> | void) | null = null;
  private stopped = false;
  /** 批量结算中：同一来源一次打到多个目标，特效一次铺开，不逐个过 */
  private batch = false;
  private batchSfx: (() => void) | null = null;
  /** 批量时同一目标的第几个飘字，往上错开 */
  private popN = new Map<number, number>();
  private triggerSource: { uid: number; label: string } | null = null;

  /** bar 为 null：图鉴演示模式（静音、固定 1 倍速，无速度 / 跳过按钮） */
  constructor(private board: Board, private fx: FX, bar: HTMLElement | null) {
    this.phase = h('b', null, '战斗');
    this.log = h('div', { class: 'bb-log' });
    if (!bar) {
      this.demo = true;
      this.sfx = new Proxy(sfx, { get: () => () => {} });
      this.fx.rate = 1;
      return;
    }
    const speedBtn = h('button', { class: 'btn ghost speed' }, icon('ff'), h('span', null, `${SPEEDS[speedIdx]}×`));
    speedBtn.addEventListener('click', () => {
      speedIdx = (speedIdx + 1) % SPEEDS.length;
      speedBtn.querySelector('span')!.textContent = `${SPEEDS[speedIdx]}×`;
      this.fx.rate = SPEEDS[speedIdx];
      this.sfx.click();
    });
    const skipBtn = h('button', { class: 'btn ghost' }, icon('skip'), h('span', null, '跳过'));
    skipBtn.addEventListener('click', () => { this.sfx.click(); this.skip(); });
    bar.replaceChildren(h('div', { class: 'bb-phase' }, h('span', { class: 'bb-dot' }), this.phase), this.log, h('div', { class: 'bb-btns' }, speedBtn, skipBtn));
    this.fx.rate = SPEEDS[speedIdx];
  }

  skip() {
    this.skipping = true;
    this.board.clearMarks();
    this.fx.clear();
  }

  stop() {
    this.stopped = true;
    this.skipping = true;
    this.board.clearMarks();
    this.fx.clear();
  }

  private get speed() { return (this.demo ? 1 : SPEEDS[speedIdx]) * this.rate; }
  private w(ms: number) {
    return this.skipping ? Promise.resolve() : new Promise<void>((r) => setTimeout(r, ms / this.speed));
  }

  private bsfx(f: () => void) { if (this.batch) this.batchSfx ??= f; else f(); }
  private yo(tgt: number) {
    if (!this.batch) return 0;
    const n = this.popN.get(tgt) ?? 0;
    this.popN.set(tgt, n + 1);
    return n * 34;
  }
  private bw(ms: number) { return this.batch ? Promise.resolve() : this.w(ms); }

  private say(text: string) {
    if (this.skipping) return;
    this.log.prepend(h('div', { class: 'll' }, text));
    while (this.log.children.length > 4) this.log.lastElementChild!.remove();
  }

  private name(uid: number) {
    const L = this.live.get(uid);
    return L ? `${L.s.side === 0 ? '' : '敌·'}${card(L.s.def).name}` : this.anchors.get(uid)?.name ?? '';
  }

  private color(uid: number | null) {
    const L = uid == null ? null : this.live.get(uid);
    if (!L) return uid == null ? '#fff' : this.anchors.get(uid)?.color ?? '#fff';
    return L.s.side === 1 ? '#ff6b78' : identityColor(card(L.s.def));
  }

  private pos(uid: number) {
    const L = this.live.get(uid);
    return this.stagePos(L ? bodyPos(L.s.side, L.v.slot) : this.anchors.get(uid) ?? { x: 640, y: UNIT_Y });
  }

  /** 棋盘可能上移；特效根节点保持全舞台坐标，图鉴的共同镜头缩放在此抵消。 */
  private stagePos(p: Pt): Pt {
    const root = this.fx.root, r = root.getBoundingClientRect(), b = this.board.el.getBoundingClientRect();
    const scale = root.offsetWidth ? r.width / root.offsetWidth : 1;
    return { x: p.x + (b.left - r.left) / (scale || 1), y: p.y + (b.top - r.top) / (scale || 1) };
  }

  private visual(ev: EffectEvent): { kind: VfxKind; color?: string } {
    const local = ev.src == null ? undefined : this.live.get(ev.src)?.s.def ?? this.defs.get(ev.src);
    const label = this.triggerSource?.uid === ev.src ? this.triggerSource.label : '';
    const name = label.split('·')[0];
    const explicit = sourceCards.get(name), support = sourceSupport.get(name);
    const d = explicit ?? (local ? card(local) : undefined);
    const effect = label.endsWith('·释放蓄能') ? 'release' : label.endsWith('·引爆猎标') ? 'detonate' : label.endsWith('·薪火传承') ? 'inherit' : undefined;
    const context: VfxSource = { label, effect, archetype: support ? support.archetypes?.[0] : d?.archetype, support: !!support };
    const kind = vfxFor(support ? undefined : d?.ab, support ? undefined : d?.faction, ev.t, ev.t === 'dmg' ? ev.kind : undefined, context);
    // 效果库各自保留材料配色，增益沿用来源识别色。
    return { kind, color: kind === 'buff' ? this.color(ev.src) : undefined };
  }

  private effect(ev: EffectEvent) {
    const { kind, color } = this.visual(ev);
    this.fx.rate = this.speed;
    return this.fx.pixel.at(kind, this.pos(ev.tgt), color);
  }

  private impactWait(delay: number) { return this.w(Math.min(240, delay * this.speed)); }

  private paint(L: Live, pop = false) {
    const s = L.s;
    const kw = keywordsOf(s.kws);
    kw.armor = s.shield ?? 0;
    L.v.setMark('energy', s.charge ? 'bolt' : null, String(s.charge ?? 0), false, `蓄能 ${s.charge ?? 0}`);
    L.v.setMark('quarry', (s.mark ?? 0) > 0 ? 'target' : null, String(s.mark ?? 0), false, `猎标 ${s.mark ?? 0} 层`);
    L.v.setMark('station', s.rounds && card(s.def).rules?.some(r => r.phase === 'battle' && r.when === 'stationary') ? 'flag' : null, String(s.rounds ?? 0), false, `驻阵 ${s.rounds ?? 0} 回合`);
    L.v.setStats({ atk: s.atk, hp: s.hp, maxHp: s.maxHp, block: s.block, chill: 0, burn: s.burn ?? 0, kw }, { pop: pop && !this.skipping });
  }

  private mk(s: Snap, slot: number) {
    const v = new UnitView(s.def, s.side, slot, s.lvl, { token: !!card(s.def).token });
    this.board.add(`u${s.uid}`, v);
    const L: Live = { s: { ...s, kws: [...s.kws] }, v };
    this.live.set(s.uid, L);
    this.defs.set(s.uid, s.def);
    this.sides.set(s.uid, s.side);
    this.paint(L);
    v.setEquips([...(s.ench ? [s.ench] : []), ...(s.ax ?? []).filter((a) => s.side === 1).map((a) => ATOM_INFO[a].icon)]);
    return L;
  }

  private relayout(order: Order, except?: number) {
    const moves: Promise<void>[] = [];
    order.forEach((ids) => ids.forEach((id, i) => {
      const L = this.live.get(id);
      if (!L || id === except || L.v.slot === i) return;
      if (this.skipping) L.v.place(i);
      else moves.push(L.v.moveTo(i, 320 / this.speed, 10));
    }));
    return Promise.all(moves);
  }

  async play(out: BattleOut) {
    this.live.clear();
    this.sides.clear();
    this.defs.clear();
    this.anchors.clear();
    this.triggerSource = null;
    this.fx.rate = this.speed;
    this.pendingOrder = null;
    this.board.clearUnits();
    this.board.clearArrows();
    this.board.setCenter('0', '交锋', 'beat');
    for (const s of out.init) {
      const slot = out.initOrder[s.side].indexOf(s.uid);
      if (slot < 0 || slot >= 5) continue;
      const L = this.mk(s, slot);
      L.v.appear(slot * 60 + s.side * 30);
    }
    await this.w(700);
    for (let i = 0; i < out.events.length; i++) {
      const ev = out.events[i];
      this.board.clearMarks();
      if (this.stopped) return;
      const end = this.groupEnd(out.events, i);
      if (end > i) {
        await this.settle(false);
        if (this.hook) for (let k = i; k <= end; k++) await this.hook(out.events[k], k);
        await this.handleGroup(out.events.slice(i, end + 1));
        i = end;
        continue;
      }
      if (ev.t !== 'die') await this.settle(ev.t === 'clash' || ev.t === 'end');
      // 召唤要等单位出现后再框选
      if (this.hook && ev.t !== 'summon') await this.hook(ev, i);
      const clashHits: Ev[] = [];
      if (ev.t === 'clash') for (let k = i + 1; k < out.events.length && out.events[k].t !== 'clash'; k++) {
        const hit = out.events[k];
        if (hit.t === 'dmg' && hit.kind === 'melee') clashHits.push(hit);
      }
      await this.handle(ev, clashHits);
      if (this.hook && ev.t === 'summon') await this.hook(ev, i);
    }
    await this.settle(true);
    this.board.clearMarks();
    this.fx.clear();
    // 跳过时最后对齐一次
    this.skipping = false;
    this.phase.textContent = out.result === 'win' ? '胜利' : out.result === 'lose' ? '失败' : '平局';
  }

  /** 同一来源、同类效果连续打到多个目标（中间夹着的阵亡也算进来）→ 返回这一批最后一个事件的下标；不成批返回 i */
  private groupEnd(evs: Ev[], i: number) {
    const a = evs[i];
    // 同一来源的伤害/治疗/增益/格挡/词条可以混在一起（如「各造成 1 伤害并 +1 攻」逐个交替发出）
    const key = (e: Ev) => e.t === 'dmg' ? (e.kind === 'melee' || e.src == null ? null : `${e.src}`)
      : e.t === 'heal' || e.t === 'buff' || e.t === 'block' || e.t === 'kw' ? `${e.src}` : null;
    const k = key(a);
    if (!k) return i;
    const tg = new Set([(a as { tgt: number }).tgt]);
    let end = i;
    for (let j = i + 1; j < evs.length; j++) {
      const e = evs[j];
      if (e.t === 'die') continue;
      if (key(e) !== k) break;
      tg.add((e as { tgt: number }).tgt);
      end = j;
    }
    return tg.size > 1 ? end : i;
  }

  /** 同源多目标效果按语义并行铺开，原事件顺序逐项消费，飘字与音效沿用批量节奏。 */
  private async handleGroup(evs: Ev[]) {
    const first = evs.find((e) => e.t !== 'die')! as Extract<Ev, { tgt: number }>;
    const src = first.src;
    if (!this.skipping) {
      this.lockDamage(evs);
      this.fx.rate = this.speed;
      const groups = new Map<VfxKind, { color?: string; targets: Map<number, Pt> }>();
      for (const e of evs) {
        if (e.t === 'die') continue;
        const { kind, color } = this.visual(e as EffectEvent);
        const group = groups.get(kind) ?? { color, targets: new Map<number, Pt>() };
        group.targets.set((e as EffectEvent).tgt, this.pos((e as EffectEvent).tgt));
        groups.set(kind, group);
      }
      const from = src != null && this.live.has(src) ? this.pos(src) : null;
      let impact = 0;
      for (const [kind, group] of groups) impact = Math.max(impact, this.fx.pixel.area(kind, { targets: [...group.targets.values()], from, color: group.color }));
      await this.impactWait(impact);
    }
    this.batch = true;
    this.batchSfx = null;
    this.popN.clear();
    for (const e of evs) await this.handle(e);
    this.batch = false;
    (this.batchSfx as (() => void) | null)?.();
    this.batchSfx = null;
    await this.w(first.t === 'dmg' ? 260 : 240);
  }

  /** UID 每次从当前存活视图解析位置，开火后清理；换位和补位沿用下一事件的新槽位。 */
  private lockDamage(events: Ev[]) {
    if (this.skipping) return;
    const marked = new Set<number>();
    for (const e of events) {
      if (e.t !== 'dmg' || e.src == null || e.kind === 'burn' || marked.has(e.tgt)) continue;
      const target = this.live.get(e.tgt);
      if (!target || e.src != null && this.sides.get(e.src) === target.s.side) continue;
      marked.add(e.tgt);
      const marker = this.board.target(target.s.side, target.v.slot, target.s.side === 1 ? 'ally-aim' : 'enemy-aim', e.kind === 'melee' ? 'melee' : 'skill');
      marker.dataset.targetUid = String(e.tgt);
    }
  }

  private async settle(layout: boolean) {
    if (this.dying.length) { const d = this.dying; this.dying = []; await Promise.all(d); }
    if (layout && this.pendingOrder) { const o = this.pendingOrder; this.pendingOrder = null; await this.relayout(o); }
  }

  private async handle(ev: Ev, clashHits: Ev[] = []) {
    const fx = this.fx;
    const quiet = this.skipping;
    switch (ev.t) {
      case 'clash': {
        this.triggerSource = null;
        this.board.setCenter(String(ev.n), '交锋', 'beat');
        this.phase.textContent = `交锋 ${ev.n}`;
        const A = this.live.get(ev.a), B = this.live.get(ev.b);
        if (quiet || !A || !B) return;
        this.lockDamage(clashHits);
        void A.v.lunge(1, 40, 360 / this.speed);
        void B.v.lunge(-1, 40, 360 / this.speed);
        await this.w(170);
        if (this.skipping) return;
        const center = this.stagePos({ x: 640, y: UNIT_Y - 20 });
        fx.impact(center.x, center.y, '#fff2c0', false);
        this.sfx.hit();
        await this.w(60);
        return;
      }
      case 'trigger': {
        this.triggerSource = { uid: ev.uid, label: ev.label };
        const L = this.live.get(ev.uid);
        if (!L) return;
        this.say(`${this.name(ev.uid)}：${ev.label}`);
        if (quiet) return;
        const c = this.color(ev.uid);
        const p = this.pos(ev.uid);
        L.v.castMotion(c, 420 / this.speed);
        fx.float(p.x, p.y - 96, ev.label, 'combo', 900);
        this.sfx.trigger();
        await this.w(260);
        return;
      }
      case 'dmg': {
        const T = this.live.get(ev.tgt);
        if (!T) return;
        if (!quiet && !this.batch) this.lockDamage([ev]);
        const p = this.pos(ev.tgt);
        if (!quiet && !this.batch && ev.kind !== 'melee') {
          const delay = this.effect(ev);
          if (ev.src != null && this.live.has(ev.src)) await this.impactWait(delay);
        }
        T.s.hp = ev.hp;
        T.s.block = ev.block;
        const shieldHit = ev.blocked && T.s.shield > ev.shield;
        T.s.shield = ev.shield;
        this.paint(T, true);
        if (quiet || this.skipping) return;
        const yo = this.yo(ev.tgt);
        if (shieldHit) {
          fx.ring(p.x, p.y - 20, '#8fd8ff', 54, 20);
          fx.float(p.x, p.y - 80 - yo, `护盾 -${ev.n}`, 'shield', 800);
          this.bsfx(() => this.sfx.shieldHit());
        } else if (ev.blocked) {
          // 格挡碎裂
          fx.burst(p.x, p.y - 20, '#ffe08a', { n: 18, speed: 6, kind: 'shard', size: 4 });
          fx.ring(p.x, p.y - 20, '#ffe08a', 50, 20);
          fx.float(p.x, p.y - 80 - yo, '格挡', 'shield', 800);
          this.bsfx(() => this.sfx.shieldHit());
        } else {
          fx.float(p.x, p.y - 80 - yo, `-${ev.n}`, 'dmg', 800);
          if (ev.kind === 'splash') fx.burst(p.x, p.y - 20, '#ffb340', { n: 12, speed: 5 });
          if (ev.kind === 'burn') fx.burst(p.x, p.y - 20, '#ff6a2a', { n: 10, speed: 3, up: 2 });
          if (ev.kind !== 'melee') this.bsfx(() => this.sfx.hit(ev.n >= 6));
        }
        await this.bw(ev.kind === 'melee' ? 100 : 180);
        return;
      }
      case 'heal': {
        const T = this.live.get(ev.tgt);
        if (!T) return;
        T.s.hp = ev.hp;
        this.paint(T, true);
        if (quiet) return;
        const yo = this.yo(ev.tgt);
        const p = this.pos(ev.tgt);
        if (!this.batch) {
          const delay = this.effect(ev);
          if (ev.src !== ev.tgt && this.live.has(ev.src)) await this.impactWait(delay);
        }
        if (this.skipping) return;
        fx.float(p.x, p.y - 80 - yo, `+${ev.n}`, 'buff', 800);
        this.bsfx(() => this.sfx.buff());
        await this.bw(180);
        return;
      }
      case 'buff': {
        const T = this.live.get(ev.tgt);
        if (!T) return;
        const p = this.pos(ev.tgt);
        if (!quiet && !this.batch) {
          const delay = this.effect(ev);
          if (ev.src !== ev.tgt && this.live.has(ev.src)) await this.impactWait(delay);
        }
        T.s.atk = ev.nowAtk;
        T.s.hp = ev.nowHp;
        T.s.maxHp = Math.max(T.s.maxHp, ev.nowHp);
        this.paint(T, true);
        if (quiet || this.skipping) return;
        const yo = this.yo(ev.tgt);
        const neg = ev.atk < 0 || ev.hp < 0;
        const sg = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
        fx.statPop(p.x, p.y - 80 - yo, `${sg(ev.atk)}/${sg(ev.hp)}`, ev.perm ? '永久' : '', neg ? 'pt-atk' : ev.atk >= ev.hp ? 'pt-atk' : 'pt-hp', 760);
        this.bsfx(() => this.sfx.buff());
        await this.bw(200);
        return;
      }
      case 'block': {
        const T = this.live.get(ev.tgt);
        if (!T) return;
        const p = this.pos(ev.tgt);
        if (!quiet && !this.batch) {
          const delay = this.effect(ev);
          if (ev.src !== ev.tgt && this.live.has(ev.src)) await this.impactWait(delay);
        }
        T.s.block = ev.block;
        this.paint(T, true);
        if (quiet || this.skipping) return;
        const yo = this.yo(ev.tgt);
        fx.statPop(p.x, p.y - 80 - yo, `+${ev.n}`, '格挡', 'pt-block', 760);
        this.bsfx(() => this.sfx.shield());
        await this.bw(180);
        return;
      }
      case 'kw': {
        const T = this.live.get(ev.tgt);
        if (!T) return;
        T.s.kws = [...new Set([...T.s.kws, ...ev.kws])];
        this.paint(T, true);
        if (quiet) return;
        const yo = this.yo(ev.tgt);
        const p = this.pos(ev.tgt);
        if (!this.batch) this.effect(ev);
        const names: Record<string, string> = { reborn: '复生', splash: '溅射', block: '格挡' };
        fx.float(p.x, p.y - 80 - yo, ev.kws.map((k) => names[k] ?? k).join(' '), 'grant', 800);
        this.bsfx(() => this.sfx.buff());
        await this.bw(180);
        return;
      }
      case 'die': {
        const L = this.live.get(ev.uid);
        if (!L) return;
        this.board.marks.querySelectorAll(`[data-target-uid="${ev.uid}"]`).forEach(marker => marker.remove());
        this.anchors.set(ev.uid, { ...bodyPos(L.s.side, L.v.slot), name:this.name(ev.uid), color:this.color(ev.uid) });
        this.live.delete(ev.uid);
        this.board.views.delete(`u${ev.uid}`);
        this.say(`${L.s.side === 0 ? '' : '敌·'}${card(L.s.def).name} 阵亡`);
        this.pendingOrder = ev.order;
        if (quiet) { L.v.el.remove(); return; }
        const p = this.stagePos(bodyPos(L.s.side, L.v.slot));
        fx.burst(p.x, p.y, L.s.side === 1 ? '#ff6b78' : identityColor(card(L.s.def)), { n: 14, speed: 4 });
        this.sfx.death();
        this.dying.push(L.v.die());
        return;
      }
      case 'summon': {
        const s = ev.unit;
        const idx = ev.order[s.side].indexOf(s.uid);
        this.pendingOrder = null;
        await this.relayout(ev.order);
        if (idx < 0 || idx >= 5) return;
        const L = this.mk(s, idx);
        this.say(`${ev.revive ? '复生' : '召唤'}：${this.name(s.uid)}`);
        if (quiet || this.skipping) return;
        const p = this.stagePos(bodyPos(s.side, idx));
        L.v.appear();
        fx.ring(p.x, p.y, ev.revive ? '#78f0ff' : '#d6a8ff', 70, 28);
        if (ev.revive) fx.float(p.x, p.y - 90, '复生', 'grant', 900);
        this.sfx.summon();
        await this.w(380);
        return;
      }
      case 'move': {
        this.pendingOrder = null;
        await this.settle(false);
        await this.relayout(ev.order);
        this.say(`${this.name(ev.uid)} · ${ev.reason ?? '换位'}：${ev.from + 1} → ${ev.to + 1}`);
        return;
      }
      case 'counter': {
        const L = this.live.get(ev.uid);
        if (L) { L.s.charge = ev.charge; L.s.mark = ev.mark; L.s.rounds = ev.rounds; this.paint(L); }
        return;
      }
      case 'fizzle': {
        this.say(`${this.name(ev.uid)} · ${ev.label}`);
        if (quiet) return;
        const p = this.pos(ev.uid);
        fx.float(p.x, p.y - 90, ev.label, 'fizzle', 800);
        this.sfx.fizzle();
        await this.w(200);
        return;
      }
      case 'stat': {
        const T = this.live.get(ev.uid);
        if (!T) return;
        const more = ev.shield > T.s.shield;
        const burnUp = ev.burn > T.s.burn;
        T.s.shield = ev.shield;
        T.s.burn = ev.burn;
        this.paint(T, true);
        if (quiet) return;
        const p = this.pos(ev.uid);
        if (more) { fx.pixel.at('plate', p); fx.statPop(p.x, p.y - 80, `+${ev.shield}`, '护盾', 'pt-block', 760); this.sfx.shield(); }
        if (burnUp) { fx.pixel.at('fire', p, undefined, 0.55); fx.float(p.x, p.y - 80, `灼烧 ${ev.burn}`, 'dmg', 700); }
        await this.w(140);
        return;
      }
      case 'end':
        return;
    }
  }
}
