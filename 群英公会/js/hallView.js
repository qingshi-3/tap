// 公会大厅：横向可拖动的单层建筑剖面，夜空、远山、松林与水面倒影。点击成员或房间打开对应界面。
import {FACILITIES, RACES} from './data.js';
import {FxLayer} from './kit.js';
import {memberStatus} from './sim.js';
import {Ambient, FONT, cloud, fitCanvas, hash, moon, mountains, pglow, pineRow, pixelCircle, rect, reflect, shade, skyBands, stars} from './scene.js';

const ORDER = ['forge', 'cellar', 'hall', 'dorm', 'training', 'altar'];
const WIDTH = {forge: 136, cellar: 128, hall: 236, dorm: 150, training: 150, altar: 112};
const RH = 92;
const WALLW = 6;
const YARD = 96;
const OUTLINE = [[-1, 0], [1, 0], [0, -1], [0, 1]];

const C = {
  ink: '#120c1a',
  wood: '#6a4430', woodD: '#4a2c20', woodL: '#8a5a3a', woodH: '#a8744a',
  plank: '#5a3a2a', plankD: '#3e2619',
  stone: '#4a4458', stoneD: '#342f42', stoneL: '#625a74', mortar: '#26212f',
  roof: '#5a2a3e', roofD: '#3e1c2c', roofL: '#7a3a50',
  gold: '#ffd24a', goldD: '#b8862a',
  sky: ['#141434', '#1a2050', '#222e66', '#2c4078', '#38548a', '#4e6e9e', '#7290b2'],
  cloud: ['#c8d4f0', '#8a98c8', '#525e92'],
};

function text(ctx, s, x, y, color, {align = 'center', outline = C.ink} = {}) {
  ctx.font = `12px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (outline) {
    ctx.fillStyle = outline;
    for (const [dx, dy] of OUTLINE) ctx.fillText(s, Math.round(x) + dx, Math.round(y) + dy);
  }
  ctx.fillStyle = color;
  ctx.fillText(s, Math.round(x), Math.round(y));
}

export class HallView {
  constructor(kit, canvas, {getState, onMember, onRoom}) {
    this.kit = kit;
    this.canvas = canvas;
    this.getState = getState;
    this.onMember = onMember;
    this.onRoom = onRoom;
    this.fx = new FxLayer(kit);
    this.walkers = new Map();
    this.bubbles = [];
    this.ff = new Ambient('firefly', 18);
    this.last = performance.now();
    this.nextBubble = 0;
    this.nextSpark = 0;
    this.altarFx = null;
    this.running = true;
    this.cam = null;
    this.vel = 0;
    this.drag = null;
    this.LW = 400;
    this.BW = 400;
    this.BH = 240;
    this.geo = this.layout(240);
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', e => this.down(e));
    canvas.addEventListener('pointermove', e => this.move(e));
    canvas.addEventListener('pointerup', e => this.up(e));
    canvas.addEventListener('pointercancel', () => { this.drag = null; });
    const loop = now => {
      if (this.running) this.frame(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  layout(BH) {
    const gy = BH - 50;
    const top = gy - RH;
    const rooms = {};
    let x = YARD;
    for (const id of ORDER) {
      const tall = id === 'altar' ? 30 : 0;
      rooms[id] = {x, y: top - tall, w: WIDTH[id], h: RH + tall};
      x += WIDTH[id] + WALLW;
    }
    return {gy, top, wy: gy + 13, rooms, WW: x + YARD, L: YARD - WALLW, R: x};
  }

  rooms() {
    return this.geo.rooms;
  }

  // 屏幕中心对应的世界坐标（供结算特效定位）
  center() {
    return {x: (this.cam || 0) + this.BW / 2, y: this.geo.top + 40};
  }

  focus(id) {
    const r = this.geo.rooms[id];
    if (r) this.camTarget = r.x + r.w / 2 - this.BW / 2;
  }

  clampCam(c) {
    const max = this.geo.WW - this.BW;
    if (max <= 0) return max / 2;
    return Math.max(0, Math.min(max, c));
  }

  // ---------- 输入：拖动平移 / 点击 ----------
  toBuf(e) {
    const r = this.canvas.getBoundingClientRect();
    return {x: ((e.clientX - r.left) / r.width) * this.BW, y: ((e.clientY - r.top) / r.height) * this.BH, k: this.BW / r.width};
  }

  down(e) {
    this.canvas.setPointerCapture?.(e.pointerId);
    this.drag = {x0: e.clientX, cam0: this.cam, moved: false, lx: e.clientX, lt: performance.now(), v: 0};
    this.vel = 0;
    this.camTarget = null;
  }

  move(e) {
    const d = this.drag;
    if (!d) return;
    const {k} = this.toBuf(e);
    if (Math.abs(e.clientX - d.x0) > 6) d.moved = true;
    if (d.moved) {
      this.cam = this.clampCam(d.cam0 - (e.clientX - d.x0) * k);
      const now = performance.now();
      const dt = Math.max(1, now - d.lt);
      d.v = (-(e.clientX - d.lx) * k) / dt;
      d.lx = e.clientX;
      d.lt = now;
    }
  }

  up(e) {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (d.moved) {
      this.vel = d.v * 16;
      return;
    }
    this.tap(e);
  }

  tap(e) {
    const p = this.toBuf(e);
    const x = p.x + this.cam, y = p.y;
    let best = null;
    for (const w of this.walkers.values()) {
      const c = this.kit.unit(w.m.unit, 'idle');
      const h = c ? Math.min(70, c.height * 0.8) : 50;
      if (x > w.x - 12 && x < w.x + 12 && y > w.groundY - h && y < w.groundY + 4) {
        if (!best || Math.abs(w.x - x) < Math.abs(best.x - x)) best = w;
      }
    }
    if (best) {
      this.say(best, this.lineFor(this.getState(), best), performance.now());
      return this.onMember(best.id);
    }
    for (const [id, rr] of Object.entries(this.geo.rooms)) {
      if (x > rr.x && x < rr.x + rr.w && y > rr.y && y < rr.y + rr.h) return this.onRoom(id);
    }
  }

  // ---------- 成员 ----------
  placeOf(state, m, i) {
    const st = memberStatus(state, m);
    if (st === 'away') return null;
    if ((st === 'injured' || st === 'tired') && state.facilities.dorm) return 'dorm';
    if (state.facilities.training && i % 3 === 1) return 'training';
    if (state.facilities.altar && m.legend && i % 2 === 0) return 'altar';
    if (state.facilities.forge && i % 5 === 3) return 'forge';
    if (state.facilities.cellar && i % 7 === 5) return 'cellar';
    return 'hall';
  }

  syncWalkers(state) {
    const R = this.geo.rooms;
    const seen = new Set();
    state.members.forEach((m, i) => {
      const room = this.placeOf(state, m, i);
      if (!room) return;
      seen.add(m.id);
      const r = R[room];
      let w = this.walkers.get(m.id);
      if (!w || w.room !== room) {
        const x = r.x + 20 + hash(i * 3.3 + m.id.length) * (r.w - 40);
        w = {id: m.id, room, x, tx: x, dir: hash(i) > 0.5 ? 1 : -1, pauseUntil: 0, spawnAt: performance.now()};
        this.walkers.set(m.id, w);
      }
      w.m = m;
      w.groundY = r.y + r.h - 4;
      w.minX = r.x + 14;
      w.maxX = r.x + r.w - 14;
      w.status = memberStatus(state, m);
    });
    for (const id of [...this.walkers.keys()]) if (!seen.has(id)) this.walkers.delete(id);
  }

  say(w, text, now) {
    this.bubbles = this.bubbles.filter(b => b.id !== w.id);
    this.bubbles.push({id: w.id, text, start: now, life: 2800});
  }

  lineFor(state, w) {
    const m = w.m;
    if (w.status === 'injured') return '伤口还在疼…';
    if (w.status === 'tired') return 'Zzz…';
    const same = [...this.walkers.values()].filter(o => o !== w && o.room === w.room);
    const foe = same.find(o => (m.affinity[o.id] || 0) <= -30);
    if (foe) return `离我远点，${foe.m.name}。`;
    const pal = same.find(o => (m.affinity[o.id] || 0) >= 60);
    if (pal) return `${pal.m.name}，再来一杯！`;
    if (m.trait === 'greedy' && state.taxRate > 0.45) return '抽成也太狠了吧…';
    if (m.loyalty < 25) return '听说别的公会分成更高…';
    if (m.questId) return '明天就出发！';
    const room = {forge: '这把剑该重铸了。', cellar: '这桶酒快酿好了。', training: '再来一百下！', altar: '祭坛在低语…', dorm: '床铺好软。'}[w.room];
    const lines = [`心愿：${m.wish.text}`, `${RACES[m.race].home}的酒还是更烈些。`, '今晚有什么委托？', '老板，记账！', m.legend ? '这个时代的酒真不错。' : '我会变强的。', room || '这里真热闹。'];
    return lines[Math.floor(hash(performance.now() / 1000 + m.level) * lines.length)];
  }

  // ---------- 帧 ----------
  frame(now) {
    const dt = Math.min(50, now - this.last);
    this.last = now;
    const state = this.getState();
    if (!state) return;
    const {ctx, BW, BH} = fitCanvas(this.canvas);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (BH !== this.BH || BW !== this.BW || !this.sky) {
      this.BW = BW;
      this.BH = BH;
      this.LW = BW;
      this.geo = this.layout(BH);
      this.buildBackdrop();
      this.bkey = null;
    }
    const G = this.geo;
    if (this.cam === null) this.cam = this.clampCam(G.rooms.hall.x + G.rooms.hall.w / 2 - BW / 2);
    if (!this.drag) {
      if (this.camTarget != null) {
        this.cam += (this.clampCam(this.camTarget) - this.cam) * 0.15;
        if (Math.abs(this.clampCam(this.camTarget) - this.cam) < 0.5) this.camTarget = null;
      } else if (Math.abs(this.vel) > 0.05) {
        this.cam += this.vel;
        this.vel *= 0.9;
      }
    }
    this.cam = this.clampCam(this.cam);
    const cam = Math.round(this.cam);
    const key = JSON.stringify([state.facilities, state.guildName, state.rank, BH]);
    if (key !== this.bkey) {
      this.bkey = key;
      this.paintBuilding(state);
    }
    this.syncWalkers(state);

    // 天空与视差远景
    ctx.drawImage(this.sky, 0, 0);
    const cw = this.clouds.width;
    const co = Math.floor((now / 260 + cam * 0.08) % cw);
    ctx.drawImage(this.clouds, -co, 0);
    ctx.drawImage(this.clouds, cw - co, 0);
    ctx.drawImage(this.far, -Math.round(cam * 0.25), 0);
    ctx.drawImage(this.mid, -Math.round(cam * 0.5), 0);

    // 世界层
    ctx.save();
    ctx.translate(-cam, 0);
    ctx.drawImage(this.building, 0, 0);
    this.drawDynamic(ctx, state, now);
    const ws = [...this.walkers.values()].sort((a, b) => a.groundY - b.groundY || a.x - b.x);
    for (const w of ws) {
      if ((w.status === 'ready' || w.status === 'assigned') && now > w.pauseUntil) {
        if (Math.abs(w.tx - w.x) < 1) {
          w.pauseUntil = now + 1200 + hash(now + w.x) * 3500;
          w.tx = w.minX + hash(now * 0.37 + w.x) * (w.maxX - w.minX);
        } else {
          const d = Math.sign(w.tx - w.x);
          w.dir = d;
          w.x += d * dt * 0.012;
        }
      }
      w.x = Math.max(w.minX, Math.min(w.maxX, w.x));
      this.drawMember(ctx, w, now);
    }
    if (now > this.nextBubble && ws.length) {
      const vis = ws.filter(w => w.x > cam && w.x < cam + BW);
      const w = (vis.length ? vis : ws)[Math.floor(hash(now) * (vis.length || ws.length))];
      this.say(w, this.lineFor(state, w), now);
      this.nextBubble = now + 3200 + hash(now * 3) * 3000;
    }
    this.fx.draw(ctx, now);
    this.drawBubbles(ctx, now);
    ctx.restore();

    // 水面倒影
    reflect(ctx, this.canvas, BW, G.wy, G.wy, BH - G.wy, now, {tint: '#141c44', alpha: 0.5, squash: 1.15, amp: 2});
    this.ff.draw(ctx, this.kit, BW, BH, dt);
    this.drawEdgeHints(ctx, now);
  }

  drawEdgeHints(ctx, now) {
    const max = this.geo.WW - this.BW;
    if (max <= 0) return;
    const a = 0.5 + 0.4 * Math.sin(now / 300);
    const y = this.geo.top + 30;
    ctx.globalAlpha = a;
    if (this.cam > 4) for (let i = 0; i < 5; i++) rect(ctx, 4 + i, y - i, 1, i * 2 + 1, '#ffe6a8');
    if (this.cam < max - 4) for (let i = 0; i < 5; i++) rect(ctx, this.BW - 5 - i, y - i, 1, i * 2 + 1, '#ffe6a8');
    ctx.globalAlpha = 1;
  }

  // ---------- 静态背景 ----------
  buildBackdrop() {
    const {BW, BH} = this;
    const G = this.geo;
    const mk = (w, h) => Object.assign(document.createElement('canvas'), {width: w, height: h});
    this.sky = mk(BW, BH);
    let g = this.sky.getContext('2d');
    skyBands(g, BW, 0, G.gy, C.sky);
    rect(g, 0, G.gy, BW, BH - G.gy, '#0e1028');
    stars(g, BW, G.gy * 0.6, 7, Math.round(BW / 4));
    moon(g, Math.round(BW * 0.78), 30, 12);
    this.clouds = mk(BW + 160, Math.round(BH * 0.5));
    g = this.clouds.getContext('2d');
    const cw = this.clouds.width;
    for (let i = 0; i < 7; i++) {
      const x = Math.round((i / 7) * cw + hash(i * 3) * 30);
      const w = 30 + Math.round(hash(i * 7) * 46);
      if (x + w > cw - 8) continue;
      cloud(g, x, Math.round(26 + hash(i * 1.9) * (G.top - 50)), w, C.cloud, i + 2);
    }
    this.far = mk(Math.ceil(BW + G.WW * 0.25 + 4), BH);
    g = this.far.getContext('2d');
    const FW = this.far.width;
    mountains(g, FW, G.gy - 34, 34, '#323c6c', 4, {light: '#46578a', snow: '#9aaad0'});
    mountains(g, FW, G.gy - 22, 18, '#283058', 9, {light: '#36406e', rough: 1.5});
    // 远处小镇
    for (let i = 0, x = 6; x < FW; i++) {
      const w = 12 + Math.round(hash(i * 4.1) * 14);
      const h = 14 + Math.round(hash(i * 1.7) * 22);
      const base = G.gy - 18;
      rect(g, x, base - h, w, h + 2, '#1e2448');
      for (let r = 0; r < 6; r++) rect(g, x - 1 + r, base - h - r, w + 2 - r * 2, 1, '#1e2448');
      if (hash(i * 13) > 0.3) rect(g, x + 3, base - h + 5, 2, 2, '#ffc070');
      if (hash(i * 17) > 0.5) rect(g, x + w - 5, base - h + 11, 2, 2, '#ffb060');
      if (hash(i * 23) > 0.8) { rect(g, x + w / 2 - 1, base - h - 14, 3, 10, '#1e2448'); rect(g, x + w / 2, base - h - 17, 1, 3, '#1e2448'); }
      x += w + 2 + Math.round(hash(i * 2.9) * 16);
    }
    this.mid = mk(Math.ceil(BW + G.WW * 0.5 + 4), BH);
    g = this.mid.getContext('2d');
    pineRow(g, this.mid.width, G.gy - 6, 14, 30, '#18203e', '#26305a', 11, 8);
    rect(g, 0, G.gy - 6, this.mid.width, 8, '#18203e');
  }

  // ---------- 建筑（静态部分缓存） ----------
  paintBuilding(state) {
    const G = this.geo;
    const c = Object.assign(document.createElement('canvas'), {width: G.WW, height: this.BH});
    const g = c.getContext('2d');
    this.lights = [];
    this.fires = [];
    this.smokes = [];
    const F = state.facilities;
    const R = G.rooms;
    const roofTop = G.top - 8;
    const mainR = R.altar.x - WALLW;

    // 地面、院子与石砌河堤
    rect(g, 0, G.gy, G.WW, G.wy - G.gy, '#2c3a2c');
    rect(g, 0, G.gy, G.WW, 2, '#4a6a3a');
    for (let x = 0; x < G.WW; x += 2) {
      const h = Math.floor(hash(x * 0.71) * 3);
      if (h) rect(g, x, G.gy - h, 1, h, hash(x * 1.3) > 0.5 ? '#4a6a3a' : '#6a8a4a');
    }
    for (let y = G.gy + 3, row = 0; y < G.wy; y += 5, row++) {
      for (let x = (row % 2) * 6; x < G.WW; x += 12) {
        rect(g, x, y, 11, 4, row % 2 ? '#3e4252' : '#464a5c');
        rect(g, x, y, 11, 1, '#5a5e70');
      }
    }
    rect(g, 0, G.wy - 1, G.WW, 1, '#1a1c2a');

    // 外墙与基座
    rect(g, G.L - 4, G.gy - 2, G.R - G.L + 8, 4, C.stoneD);
    rect(g, G.L, G.top - 6, mainR - G.L, RH + 6, C.ink);
    // 主屋顶（梯形瓦片）
    const rh = 28;
    for (let r = 0; r < rh; r++) {
      const x0 = G.L - 12 + r, x1 = mainR + 12 - r;
      const y = roofTop - r;
      const band = Math.floor(r / 4) % 2;
      rect(g, x0, y, x1 - x0, 1, band ? C.roof : C.roofD);
      if (r % 4 === 0) for (let x = x0 + (band ? 3 : 0); x < x1; x += 7) rect(g, x, y, 1, 4, C.roofD);
      rect(g, x0, y, 2, 1, C.roofL);
    }
    rect(g, G.L - 14, roofTop, mainR - G.L + 28, 3, C.roofD);
    rect(g, G.L - 14, roofTop, mainR - G.L + 28, 1, C.roofL);
    rect(g, G.L - 12 + rh, roofTop - rh, mainR - G.L + 24 - rh * 2, 2, C.roofL);
    // 屋檐挂饰
    for (let x = G.L - 10; x < mainR + 10; x += 8) rect(g, x, roofTop + 3, 4, 2, C.woodD);
    // 烟囱
    const chim = (cx, lit) => {
      const top = roofTop - rh - 8;
      rect(g, cx - 6, top, 12, roofTop - top, C.stoneD);
      for (let y = top + 2; y < roofTop; y += 4) rect(g, cx - 6, y, 12, 1, C.mortar);
      rect(g, cx - 8, top - 3, 16, 4, C.stone);
      rect(g, cx - 8, top - 3, 16, 1, C.stoneL);
      if (lit) this.smokes.push({x: cx, y: top - 4});
    };
    chim(R.forge.x + 40, F.forge > 0);
    chim(R.hall.x + R.hall.w - 34, true);
    // 阁楼天窗 + 招牌
    const hx = R.hall.x + R.hall.w / 2;
    rect(g, hx - 22, roofTop - 24, 44, 24, C.woodD);
    for (let r = 0; r < 12; r++) rect(g, hx - 26 + r * 2, roofTop - 24 - r, 52 - r * 4, 1, r % 3 ? C.roof : C.roofL);
    rect(g, hx - 8, roofTop - 18, 16, 14, '#ffcf6a');
    rect(g, hx - 7, roofTop - 17, 14, 12, '#ffe7a0');
    rect(g, hx - 1, roofTop - 18, 2, 14, C.woodD);
    rect(g, hx - 8, roofTop - 12, 16, 2, C.woodD);
    this.lights.push({x: hx, y: roofTop - 11, r: 20, c: '#ffc060'});
    // 公会旗
    for (const fx of [G.L + 2, mainR - 4]) {
      rect(g, fx, roofTop - 44, 2, 44, '#2a1c14');
      rect(g, fx + 2, roofTop - 44, 16, 10, '#a8283a');
      rect(g, fx + 2, roofTop - 34, 12, 2, '#a8283a');
      rect(g, fx + 7, roofTop - 41, 5, 5, C.gold);
    }

    // 英灵祭坛塔
    const A = R.altar;
    const at = A.y - 6;
    rect(g, A.x - WALLW, at, A.w + WALLW * 2, A.h + 6, C.ink);
    const sh = 46;
    for (let r = 0; r < sh; r++) {
      const ww = Math.round((A.w / 2 + 12) * (r / sh));
      rect(g, A.x + A.w / 2 - ww, at - sh + r, ww * 2, 1, r % 6 < 3 ? '#3a2a62' : '#2c1f4c');
      rect(g, A.x + A.w / 2 - ww, at - sh + r, 2, 1, '#6a5aa8');
    }
    rect(g, A.x + A.w / 2 - 1, at - sh - 10, 2, 10, C.gold);
    rect(g, A.x + A.w / 2 - 3, at - sh - 6, 6, 2, C.gold);
    rect(g, A.x - 12, at, A.w + 24, 3, '#2c1f4c');
    if (F.altar) this.lights.push({x: A.x + A.w / 2, y: at - sh - 8, r: 12, c: '#b080ff'});

    // 房间
    for (const id of ORDER) {
      const r = R[id];
      const lvl = F[id];
      if (lvl) this.paintRoom(g, id, r, lvl, state);
      else this.paintEmpty(g, id, r);
      // 房间铭牌
      const name = `${FACILITIES[id].name}${lvl ? ' Lv' + lvl : ''}`;
      g.font = `12px ${FONT}`;
      const tw = Math.ceil(g.measureText(name).width) + 8;
      const px = Math.round(r.x + r.w / 2 - tw / 2), py = r.y + 3;
      rect(g, px, py, tw, 14, C.ink);
      rect(g, px + 1, py + 1, tw - 2, 12, lvl ? '#3a2a20' : '#2a2430');
      rect(g, px + 1, py + 1, tw - 2, 1, lvl ? '#6a4a30' : '#40384a');
      text(g, name, r.x + r.w / 2, py + 12, lvl ? '#ffe2a0' : '#a898b8', {outline: null});
    }
    // 柱子与地板梁
    for (let i = 0; i <= ORDER.length; i++) {
      const x = i < ORDER.length ? R[ORDER[i]].x - WALLW : G.R - WALLW;
      const top = i >= ORDER.length - 1 ? A.y - 6 : G.top - 6;
      rect(g, x, top, WALLW, G.gy - top, C.stoneD);
      rect(g, x + 1, top, 1, G.gy - top, C.stoneL);
      rect(g, x + WALLW - 1, top, 1, G.gy - top, C.ink);
      for (let y = top + 6; y < G.gy; y += 8) rect(g, x, y, WALLW, 1, C.mortar);
    }
    rect(g, G.L, G.top - 6, mainR - G.L, 4, C.woodD);
    rect(g, G.L, G.top - 6, mainR - G.L, 1, C.woodL);

    // 招牌
    const sign = `${state.guildName} · ${state.rank}级公会`;
    g.font = `12px ${FONT}`;
    const sw = Math.ceil(g.measureText(sign).width) + 16;
    const sx = Math.round(hx - sw / 2), sy = G.top - 4;
    rect(g, sx + 6, sy - 2, 1, 4, '#2a1c14');
    rect(g, sx + sw - 7, sy - 2, 1, 4, '#2a1c14');
    rect(g, sx, sy + 2, sw, 17, C.ink);
    rect(g, sx + 1, sy + 3, sw - 2, 15, C.woodD);
    rect(g, sx + 2, sy + 4, sw - 4, 13, C.wood);
    rect(g, sx + 2, sy + 4, sw - 4, 1, C.woodH);
    text(g, sign, hx, sy + 15, '#ffe08a', {outline: '#2a160c'});

    // 院子：路灯、木箱、水井、树
    const lamp = x => {
      rect(g, x, G.gy - 34, 2, 34, '#1c1a24');
      rect(g, x - 3, G.gy - 2, 8, 2, '#1c1a24');
      rect(g, x - 3, G.gy - 40, 8, 7, '#1c1a24');
      rect(g, x - 2, G.gy - 39, 6, 5, '#ffd27a');
      this.lights.push({x: x + 1, y: G.gy - 37, r: 18, c: '#ffbf60'});
    };
    lamp(30);
    lamp(G.WW - 30);
    lamp(G.L - 22);
    lamp(G.R + 18);
    for (const [x, s] of [[50, 12], [62, 9], [54, 8]]) {
      const y = G.gy - (x === 54 ? 21 : s);
      rect(g, x, y, s, s, C.woodD);
      rect(g, x + 1, y + 1, s - 2, s - 2, C.wood);
      rect(g, x + 1, y + Math.floor(s / 2), s - 2, 1, C.woodD);
      rect(g, x + 1, y + 1, s - 2, 1, C.woodH);
    }
    const wx = G.R + 40;
    rect(g, wx, G.gy - 12, 20, 12, C.stone);
    rect(g, wx, G.gy - 12, 20, 2, C.stoneL);
    rect(g, wx + 1, G.gy - 30, 2, 18, C.woodD);
    rect(g, wx + 17, G.gy - 30, 2, 18, C.woodD);
    rect(g, wx - 2, G.gy - 32, 24, 3, C.roof);
    rect(g, wx + 8, G.gy - 24, 4, 5, C.wood);
    // 告示栏（院子左侧）
    rect(g, G.L - 52, G.gy - 30, 2, 30, C.woodD);
    rect(g, G.L - 30, G.gy - 30, 2, 30, C.woodD);
    rect(g, G.L - 55, G.gy - 34, 30, 18, C.woodD);
    rect(g, G.L - 54, G.gy - 33, 28, 16, '#8a6a48');
    for (const [nx, ny, nc] of [[-52, -31, '#f0e2c0'], [-44, -30, '#e8d0a0'], [-36, -32, '#f4e8d0'], [-48, -24, '#e0c8a0']]) rect(g, G.L + nx, G.gy + ny, 6, 7, nc);
    this.building = c;
  }

  wall(g, r, kind) {
    const {x, y, w, h} = r;
    const f = y + h;
    if (kind === 'stone' || kind === 'arcane') {
      const base = kind === 'arcane' ? ['#2e2450', '#382c5e', '#46387a'] : [C.stoneD, C.stone, C.stoneL];
      rect(g, x, y, w, h, C.mortar);
      for (let yy = y, row = 0; yy < f; yy += 7, row++) {
        for (let xx = x - (row % 2) * 7; xx < x + w; xx += 14) {
          const bx = Math.max(x, xx), bw = Math.min(x + w, xx + 13) - bx;
          if (bw <= 0) continue;
          rect(g, bx, yy, bw, 6, base[Math.floor(hash(xx * 0.3 + yy) * 2)]);
          rect(g, bx, yy, bw, 1, base[2]);
        }
      }
    } else {
      for (let xx = x, i = 0; xx < x + w; xx += 9, i++) {
        rect(g, xx, y, Math.min(9, x + w - xx), h, i % 2 ? '#4a3040' : '#523646');
        rect(g, xx, y, 1, h, '#3a2432');
      }
      rect(g, x, f - 22, w, 17, C.plankD);
      rect(g, x, f - 22, w, 2, C.woodL);
      for (let xx = x + 4; xx < x + w; xx += 12) rect(g, xx, f - 19, 1, 14, '#2e1a12');
    }
    // 天花板梁与地板
    rect(g, x, y, w, 5, C.woodD);
    rect(g, x, y + 4, w, 1, C.ink);
    for (let xx = x + 16; xx < x + w - 8; xx += 40) rect(g, xx, y, 4, 9, C.woodD);
    rect(g, x, f - 5, w, 5, C.plank);
    rect(g, x, f - 5, w, 1, C.woodH);
    for (let xx = x + 3; xx < x + w; xx += 11) rect(g, xx, f - 4, 1, 4, C.plankD);
  }

  barrel(g, x, y, w = 16, h = 18) {
    rect(g, x + 1, y, w - 2, h, '#7a4a2a');
    rect(g, x, y + 2, w, h - 4, '#7a4a2a');
    rect(g, x + 2, y + 1, 3, h - 2, '#9a643a');
    rect(g, x, y + 3, w, 2, '#3a3440');
    rect(g, x, y + h - 5, w, 2, '#3a3440');
    rect(g, x + w / 2 - 1, y + h / 2 - 1, 3, 3, '#2a1a10');
  }

  paintRoom(g, id, r, lvl, state) {
    const {x, y, w, h} = r;
    const f = y + h - 5;
    this.wall(g, r, id === 'cellar' || id === 'forge' ? 'stone' : id === 'altar' ? 'arcane' : 'wood');
    if (id === 'hall') {
      // 酒柜与酒瓶
      for (const sy of [y + 22, y + 38]) {
        rect(g, x + 8, sy + 10, 70, 3, C.woodD);
        rect(g, x + 8, sy + 10, 70, 1, C.woodL);
        for (let i = 0; i < 9; i++) {
          const bc = ['#7a2a3a', '#2a6a4a', '#8a6a2a', '#3a4a8a', '#6a2a6a'][(i + sy) % 5];
          const bh = 6 + ((i * 7 + sy) % 4);
          rect(g, x + 11 + i * 7, sy + 10 - bh, 4, bh, bc);
          rect(g, x + 12 + i * 7, sy + 10 - bh - 2, 2, 2, bc);
          rect(g, x + 11 + i * 7, sy + 10 - bh + 1, 1, bh - 2, 'rgba(255,255,255,0.35)');
        }
      }
      // 吧台
      rect(g, x + 6, f - 22, 78, 22, C.woodD);
      rect(g, x + 4, f - 24, 82, 4, C.woodH);
      rect(g, x + 4, f - 21, 82, 1, C.woodD);
      for (let i = 0; i < 5; i++) rect(g, x + 9 + i * 15, f - 18, 12, 15, C.wood);
      for (let i = 0; i < 3; i++) { rect(g, x + 20 + i * 22, f - 29, 5, 5, '#e8c070'); rect(g, x + 20 + i * 22, f - 29, 5, 1, '#fff4d0'); rect(g, x + 25 + i * 22, f - 28, 1, 3, '#e8c070'); }
      this.barrel(g, x + 88, f - 18);
      // 告示板
      const nb = x + 104;
      rect(g, nb, y + 16, 40, 28, C.woodD);
      rect(g, nb + 2, y + 18, 36, 24, '#9a7a52');
      for (const [ox, oy, cc] of [[4, 3, '#f4e8d0'], [14, 5, '#e8d4a8'], [26, 2, '#f8ecd4'], [8, 13, '#f0dcb4'], [22, 14, '#ffd8c0']]) {
        rect(g, nb + ox, y + 18 + oy, 9, 8, cc);
        rect(g, nb + ox + 4, y + 18 + oy, 1, 1, '#c8283a');
        rect(g, nb + ox + 2, y + 21 + oy, 5, 1, '#8a7a6a');
      }
      // 公会旗帜
      const bx = x + w / 2 + 22;
      rect(g, bx, y + 8, 22, 30, '#8a2234');
      for (let i = 0; i < 4; i++) rect(g, bx + i * 6, y + 38, 4, 3 - (i % 2), '#8a2234');
      rect(g, bx + 1, y + 8, 2, 30, '#a83448');
      rect(g, bx + 6, y + 15, 10, 10, C.gold);
      rect(g, bx + 8, y + 17, 6, 6, '#8a2234');
      rect(g, bx + 10, y + 19, 2, 2, C.gold);
      // 壁炉
      const fx = x + w - 50;
      rect(g, fx, f - 42, 42, 42, C.stoneD);
      rect(g, fx - 3, f - 44, 48, 5, C.stoneL);
      rect(g, fx - 3, f - 40, 48, 1, C.ink);
      for (let yy = f - 38; yy < f; yy += 6) rect(g, fx, yy, 42, 1, C.mortar);
      rect(g, fx + 7, f - 28, 28, 28, '#150806');
      rect(g, fx + 9, f - 4, 24, 2, '#4a2a1a');
      this.fires.push({x: fx + 10, y: f - 1, w: 22, kind: 'hearth'});
      this.lights.push({x: fx + 21, y: f - 12, r: 40, c: '#ff8a30'});
      // 餐桌
      for (let i = 0; i < Math.min(4, lvl + 1); i++) {
        const tx = x + 102 + i * 32 - (lvl >= 3 ? 8 : 0);
        if (tx > fx - 30) break;
        rect(g, tx, f - 12, 24, 3, C.woodH);
        rect(g, tx, f - 9, 24, 1, C.woodD);
        rect(g, tx + 10, f - 9, 4, 9, C.woodD);
        rect(g, tx + 6, f - 1, 12, 1, C.woodD);
        rect(g, tx + 4, f - 16, 4, 4, '#d8c080');
        rect(g, tx + 4, f - 16, 4, 1, '#fff4d0');
        rect(g, tx + 15, f - 15, 3, 3, '#e0d0b0');
        rect(g, tx + 16, f - 19, 1, 4, '#fff0c0');
        this.lights.push({x: tx + 16, y: f - 19, r: 10, c: '#ffc060'});
      }
      if (lvl >= 3) rect(g, x + 96, f - 1, fx - x - 104, 1, '#a83448');
      // 吊灯
      for (const lx of [x + 70, x + w - 90]) {
        rect(g, lx, y + 5, 1, 9, '#1a1420');
        rect(g, lx - 8, y + 14, 17, 2, '#3a2a1a');
        for (const ox of [-8, 0, 8]) {
          rect(g, lx + ox, y + 11, 1, 3, '#f4e8d0');
          rect(g, lx + ox, y + 10, 1, 1, '#ffd24a');
        }
        this.lights.push({x: lx, y: y + 12, r: 28, c: '#ffc060', flick: 1});
      }
    } else if (id === 'dorm') {
      const beds = [0, 2, 3, 4][lvl];
      const span = (w - 16) / beds;
      for (let i = 0; i < beds; i++) {
        const bx = Math.round(x + 8 + i * span + (span - 30) / 2);
        rect(g, bx, f - 13, 30, 8, C.woodD);
        rect(g, bx, f - 20, 3, 20, C.woodD);
        rect(g, bx + 27, f - 16, 3, 16, C.woodD);
        rect(g, bx + 3, f - 15, 24, 4, ['#6a5aa0', '#a04a5a', '#4a7a6a', '#8a7a4a'][i % 4]);
        rect(g, bx + 3, f - 15, 24, 1, 'rgba(255,255,255,0.3)');
        rect(g, bx + 3, f - 17, 8, 3, '#f0e8d8');
        if (lvl >= 2) {
          rect(g, bx, f - 40, 3, 20, C.woodD);
          rect(g, bx + 27, f - 40, 3, 24, C.woodD);
          rect(g, bx, f - 34, 30, 6, C.woodD);
          rect(g, bx + 3, f - 36, 24, 3, ['#4a7a6a', '#8a7a4a', '#6a5aa0', '#a04a5a'][i % 4]);
          rect(g, bx + 19, f - 38, 8, 3, '#f0e8d8');
        }
      }
      // 窗户与月亮
      const wx = x + w / 2 - 12;
      rect(g, wx - 2, y + 12, 28, 22, C.woodD);
      rect(g, wx, y + 14, 24, 18, '#1c2a5a');
      rect(g, wx, y + 26, 24, 6, '#26386a');
      rect(g, wx + 16, y + 17, 4, 4, '#fff1cf');
      rect(g, wx + 11, y + 14, 2, 18, C.woodD);
      rect(g, wx, y + 22, 24, 2, C.woodD);
      rect(g, wx - 4, y + 34, 32, 2, C.woodL);
      rect(g, x + 8, y + 16, 4, 7, '#ffd27a');
      this.lights.push({x: x + 10, y: y + 19, r: 16, c: '#ffc060', flick: 1});
    } else if (id === 'training') {
      // 训练假人
      for (let i = 0; i < lvl + 1; i++) {
        const dx = x + w - 22 - i * 28;
        rect(g, dx, f - 30, 3, 30, C.woodD);
        rect(g, dx - 7, f - 24, 17, 3, C.wood);
        rect(g, dx - 4, f - 22, 11, 12, '#c8a060');
        rect(g, dx - 4, f - 22, 11, 1, '#e8c890');
        rect(g, dx - 3, f - 37, 9, 8, '#c8a060');
        rect(g, dx - 1, f - 34, 2, 1, C.ink);
        rect(g, dx + 2, f - 34, 2, 1, C.ink);
        rect(g, dx - 4, f - 18, 11, 1, '#8a6a3a');
      }
      // 兵器架
      rect(g, x + 8, y + 14, 46, 3, C.woodD);
      rect(g, x + 8, y + 40, 46, 3, C.woodD);
      for (let i = 0; i < 5; i++) {
        const wx = x + 12 + i * 9;
        rect(g, wx, y + 9, 2, 38, i % 2 ? '#b8bccc' : '#8a6a4a');
        if (i % 2) rect(g, wx - 1, y + 9, 4, 3, '#d8dce8');
        else rect(g, wx - 2, y + 8, 6, 2, '#c8c8d8');
      }
      // 靶子
      const tx = x + 70;
      for (const [rr, cc] of [[9, '#e8e0d0'], [7, '#c8283a'], [5, '#e8e0d0'], [3, '#c8283a']]) { g.fillStyle = cc; pixelCircle(g, tx, y + 30, rr); }
      rect(g, tx + 2, y + 27, 6, 1, C.woodD);
      rect(g, tx - 6, y + 32, 5, 1, C.woodD);
      rect(g, x + 4, f - 2, w - 8, 2, '#5a3a4a');
    } else if (id === 'cellar') {
      const n = [0, 4, 7, 10][lvl];
      for (let i = 0; i < n; i++) {
        const col = i % 5, row = Math.floor(i / 5);
        this.barrel(g, x + 8 + col * 18 + row * 9, f - 18 - row * 17);
      }
      // 酒架
      const rx = x + w - 34;
      rect(g, rx, y + 14, 28, 50, C.woodD);
      for (let yy = 0; yy < 6; yy++) for (let xx = 0; xx < 4; xx++) {
        rect(g, rx + 2 + xx * 7, y + 16 + yy * 8, 5, 6, '#1a0e0a');
        rect(g, rx + 3 + xx * 7, y + 17 + yy * 8, 3, 3, ['#7a2a3a', '#3a6a3a', '#8a6a2a'][(xx + yy) % 3]);
      }
      rect(g, x + w / 2, y + 5, 1, 8, '#1a1420');
      rect(g, x + w / 2 - 3, y + 13, 7, 7, '#2a2028');
      rect(g, x + w / 2 - 2, y + 14, 5, 5, '#ffcf6a');
      this.lights.push({x: x + w / 2, y: y + 16, r: 26, c: '#ffb050', flick: 1});
    } else if (id === 'forge') {
      // 熔炉
      const fx = x + w - 52;
      rect(g, fx, f - 46, 44, 46, '#5a3030');
      for (let yy = f - 44, row = 0; yy < f; yy += 5, row++) for (let xx = fx + (row % 2) * 5; xx < fx + 44; xx += 10) rect(g, xx, yy, 9, 4, row % 2 ? '#6a3a34' : '#7a443a');
      rect(g, fx + 10, y - 2 + 5, 24, f - 46 - y - 3, '#3a2a30');
      rect(g, fx + 10, f - 26, 24, 18, '#1a0806');
      this.fires.push({x: fx + 12, y: f - 9, w: 20, kind: 'forge'});
      this.lights.push({x: fx + 22, y: f - 18, r: 44, c: '#ff6a20'});
      // 铁砧
      const ax = x + 46;
      rect(g, ax - 14, f - 14, 30, 5, '#4a4a5a');
      rect(g, ax - 14, f - 14, 30, 1, '#8a8a9a');
      rect(g, ax - 18, f - 14, 6, 3, '#4a4a5a');
      rect(g, ax - 6, f - 9, 14, 4, '#3a3a4a');
      rect(g, ax - 10, f - 5, 22, 5, '#2a2a3a');
      this.anvil = {x: ax, y: f - 15};
      // 工具墙
      rect(g, x + 10, y + 16, 50, 2, C.woodD);
      for (let i = 0; i < 5; i++) {
        const tx = x + 14 + i * 10;
        rect(g, tx, y + 18, 2, 14 + (i % 2) * 6, C.woodD);
        rect(g, tx - 2, y + 30 + (i % 2) * 6, 6, 4, '#8a8a9a');
      }
      // 淬火桶
      rect(g, x + 8, f - 12, 16, 12, '#4a3a30');
      rect(g, x + 9, f - 12, 14, 2, '#3a6a8a');
      rect(g, x + 8, f - 8, 16, 1, '#2a2a2a');
    } else if (id === 'altar') {
      const cx = x + w / 2;
      // 彩窗
      rect(g, cx - 12, y + 18, 24, 34, '#1a1030');
      for (let i = 0; i < 12; i++) rect(g, cx - 10 + (i % 4) * 5, y + 22 + Math.floor(i / 4) * 9, 4, 8, ['#8a4ad0', '#4a8ad0', '#d04a8a', '#d0a04a'][(i + lvl) % 4]);
      for (let r = 0; r < 6; r++) rect(g, cx - 12 + r * 2, y + 18 - r, 24 - r * 4, 1, '#1a1030');
      this.lights.push({x: cx, y: y + 34, r: 22, c: '#a070ff', flick: 0.3});
      // 符文柱
      for (const px of [x + 14, x + w - 22]) {
        rect(g, px, f - 50, 8, 50, '#3a2c62');
        rect(g, px, f - 50, 2, 50, '#5a4a8a');
        rect(g, px - 2, f - 54, 12, 4, '#4a3a78');
        for (let i = 0; i < 3; i++) rect(g, px + 3, f - 44 + i * 12, 2, 5, '#c8a0ff');
      }
      // 魔法阵与祭台
      g.fillStyle = '#6a4ab0';
      for (let a = 0; a < 64; a++) {
        const t = (a / 64) * Math.PI * 2;
        g.fillRect(Math.round(cx + Math.cos(t) * 34), Math.round(f - 2 + Math.sin(t) * 3), 2, 1);
      }
      rect(g, cx - 14, f - 10, 28, 10, '#4a3a6a');
      rect(g, cx - 14, f - 10, 28, 2, '#7a6aa8');
      rect(g, cx - 10, f - 14, 20, 4, '#5a4a80');
    }
  }

  paintEmpty(g, id, r) {
    const {x, y, w, h} = r;
    const f = y + h;
    rect(g, x, y, w, h, '#120e18');
    for (let xx = x, i = 0; xx < x + w; xx += 9, i++) rect(g, xx, y + 6, 1, h - 6, '#1a1422');
    // 脚手架
    for (const sx of [x + 10, x + w - 14]) {
      rect(g, sx, y + 8, 3, h - 8, '#6a4a30');
      rect(g, sx + 1, y + 8, 1, h - 8, '#8a6a40');
    }
    for (const sy of [y + 30, y + 60]) rect(g, x + 8, sy, w - 16, 3, '#7a5636');
    g.fillStyle = '#5a3e28';
    for (let i = 0; i < w - 26; i++) g.fillRect(x + 12 + i, Math.round(y + 33 + i * (27 / (w - 26))), 2, 2);
    // 木板封窗
    rect(g, x + w / 2 - 18, y + 38, 36, 6, '#8a6a48');
    rect(g, x + w / 2 - 18, y + 38, 36, 1, '#aa8a60');
    rect(g, x + w / 2 - 16, y + 48, 32, 6, '#7a5a3a');
    rect(g, x + w / 2 - 16, y + 48, 32, 1, '#9a7a50');
    // 蛛网
    for (let i = 0; i < 8; i++) { rect(g, x + i, y + 5 + i, 1, 1, '#5a5468'); rect(g, x + 8 - i, y + 5, 1, 1, '#5a5468'); }
    rect(g, x, f - 5, w, 5, '#2a2024');
    // 砖头、木料堆
    for (let i = 0; i < 4; i++) rect(g, x + w / 2 - 20 + i * 8, f - 9 - (i % 2) * 3, 7, 4, '#8a4a3a');
    rect(g, x + w - 42, f - 8, 24, 3, '#8a6a48');
    rect(g, x + w - 40, f - 11, 24, 3, '#7a5a3a');
    text(g, '待修建', x + w / 2, y + h / 2 + 10, '#ffd88a');
  }

  // ---------- 动态：火焰、灯光、烟、法阵 ----------
  drawDynamic(ctx, state, now) {
    const flick = 0.75 + 0.25 * Math.sin(now / 90) * Math.sin(now / 37);
    for (const L of this.lights) {
      const k = L.flick === undefined ? 1 : 1 - L.flick * (1 - flick);
      pglow(ctx, L.x, L.y, Math.round(L.r * (0.9 + 0.1 * flick)), L.c, 0.07 * k);
    }
    for (const F of this.fires) {
      const cols = F.kind === 'forge' ? ['#ff4a1a', '#ff8a2a', '#ffd24a', '#fff0a0'] : ['#e8401a', '#ff8a2a', '#ffc84a', '#fff0b0'];
      for (let i = 0; i < F.w; i += 2) {
        const hgt = Math.round(6 + 10 * Math.abs(Math.sin(now / (90 + i * 7) + i)) * (1 - Math.abs(i / F.w - 0.5)));
        for (let j = 0; j < 4; j++) {
          const hh = Math.round(hgt * (1 - j * 0.24));
          if (hh > 0) rect(ctx, F.x + i, F.y - hh, 2, hh, cols[j]);
        }
      }
      if (Math.random() < 0.02) this.fx.play('forgeSpark', F.x + Math.random() * F.w, F.y - 12, {now, scale: 0.4});
    }
    for (const s of this.smokes) {
      for (let i = 0; i < 5; i++) {
        const t = ((now / 2200 + i / 5) % 1);
        const r = Math.round(2 + t * 5);
        ctx.globalAlpha = 0.35 * (1 - t);
        ctx.fillStyle = '#8a88a8';
        pixelCircle(ctx, s.x + Math.sin(t * 5 + i) * 4 + t * 12, s.y - t * 40, r);
      }
      ctx.globalAlpha = 1;
    }
    const R = this.geo.rooms;
    if (state.facilities.forge && this.anvil && now > this.nextSpark) {
      this.fx.play('forgeSpark', this.anvil.x, this.anvil.y, {now, scale: 0.6});
      this.nextSpark = now + 1400 + Math.random() * 1600;
    }
    if (state.facilities.altar) {
      const A = R.altar;
      const cx = A.x + A.w / 2, f = A.y + A.h - 5;
      for (let i = 0; i < 8; i++) {
        const t = now / 900 + i * 0.785;
        rect(ctx, cx + Math.cos(t) * 30, f - 22 - Math.sin(t * 1.3) * 10 - i * 2, 1, 2, i % 2 ? '#d8b0ff' : '#8ac8ff');
      }
      const ph = 0.5 + 0.5 * Math.sin(now / 400);
      rect(ctx, cx - 3, f - 26 - ph * 3, 6, 10, '#c8a0ff');
      rect(ctx, cx - 1, f - 28 - ph * 3, 2, 14, '#f0e0ff');
      pglow(ctx, cx, f - 22, 20, '#a070ff', 0.08 + 0.04 * ph);
      if (!this.altarFx || !this.fx.items.includes(this.altarFx)) this.altarFx = this.fx.play('altarSwirl', cx, f - 22, {now, loop: true, scale: 0.35 + state.facilities.altar * 0.05});
      else { this.altarFx.x = cx; this.altarFx.y = f - 22; }
    }
  }

  drawMember(ctx, w, now) {
    const m = w.m;
    const fade = Math.min(1, (now - w.spawnAt) / 400);
    const x = Math.round(w.x);
    ctx.save();
    ctx.globalAlpha = fade;
    rect(ctx, x - 8, w.groundY, 16, 1, 'rgba(0,0,0,0.4)');
    rect(ctx, x - 6, w.groundY - 1, 12, 3, 'rgba(0,0,0,0.3)');
    const lying = w.status === 'injured' || w.status === 'tired';
    this.kit.drawUnit(ctx, m.unit, 'idle', lying ? 0 : now + w.x * 17, x, w.groundY, {flipX: w.dir < 0, scale: 1});
    ctx.restore();
    const top = w.groundY - this.headH(m);
    if (m.legend) pglow(ctx, x, top + 4, 8, '#ffd27a', 0.1);
    if (w.status === 'injured') this.tag(ctx, x, top, '+', '#ff7a8a');
    else if (w.status === 'tired') this.tag(ctx, x, top, 'z', '#a8c8ff');
    else if (w.status === 'assigned') this.tag(ctx, x, top, '!', C.gold);
  }

  headH(m) {
    const c = this.kit.unit(m.unit, 'idle');
    return c ? Math.min(72, Math.round(c.height * 0.62)) : 44;
  }

  tag(ctx, x, y, s, color) {
    text(ctx, s, x, y - 2, color);
  }

  drawBubbles(ctx, now) {
    this.bubbles = this.bubbles.filter(b => now - b.start < b.life);
    ctx.font = `12px ${FONT}`;
    for (const b of this.bubbles) {
      const w = this.walkers.get(b.id);
      if (!w) continue;
      const top = w.groundY - this.headH(w.m) - 6;
      const t = (now - b.start) / b.life;
      if (t > 0.88 && Math.floor(now / 80) % 2) continue;
      let s = b.text;
      while (ctx.measureText(s).width > 150 && s.length > 2) s = s.slice(0, -2) + '…';
      const tw = Math.ceil(ctx.measureText(s).width) + 10;
      const bx = Math.round(w.x - tw / 2), by = Math.round(top - 18 - (t < 0.08 ? (0.08 - t) * 40 : 0));
      rect(ctx, bx, by + 1, tw, 14, C.ink);
      rect(ctx, bx + 1, by, tw - 2, 16, C.ink);
      rect(ctx, bx + 1, by + 1, tw - 2, 14, '#f4e6c8');
      rect(ctx, bx + 1, by + 13, tw - 2, 2, '#d0b890');
      rect(ctx, Math.round(w.x) - 2, by + 15, 5, 2, C.ink);
      rect(ctx, Math.round(w.x) - 1, by + 15, 3, 1, '#d0b890');
      rect(ctx, Math.round(w.x), by + 17, 1, 1, C.ink);
      text(ctx, s, w.x, by + 12, '#2a1830', {outline: null});
    }
  }
}
