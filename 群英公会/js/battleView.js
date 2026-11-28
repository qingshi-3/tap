// 战斗视图：读取战斗引擎的事件流，按特效键在事件落点播放动画。
import {ICONS, REGIONS, SKILLS} from './data.js';
import {canCommand, chargingBoss, command, readyUnison, runHeadless, step, summarize} from './battle.js';
import {FxLayer} from './kit.js';
import {Ambient, fitCanvas, glow, hash, reflect, regionScene} from './scene.js';

const GROUND = 262;
const AOE_KINDS = new Set(['aoe', 'aoeBurn', 'aoeStun', 'drainAll']);
const STATUS_LABEL = {shield: '护盾', buff: '强化', break: '破甲', stun: '眩晕', burn: '灼烧', freeze: '冰冻'};
const STATUS_COLOR = {shield: '#8fd4ff', buff: '#ffd25e', break: '#ff9a4a', stun: '#fff27a', burn: '#ff6a3a', freeze: '#a8ecff'};

export class BattleView {
  constructor(kit, root) {
    this.kit = kit;
    this.root = root;
    root.innerHTML = `
      <canvas class="b-canvas"></canvas>
      <div class="b-top">
        <div class="b-title"></div>
        <div class="b-timer"><i></i></div>
        <button class="b-btn b-speed">1×</button>
        <button class="b-btn b-skip">跳过 ▸▸</button>
      </div>
      <div class="b-boss hidden"><span class="b-boss-name"></span><div class="b-boss-bar"><i class="hp"></i><i class="sh"></i></div></div>
      <div class="b-banner"></div>
      <div class="b-cmds">
        <div class="b-points"></div>
        <button class="cmd" data-cmd="interrupt"><img src="${kit.iconURL(ICONS.interrupt)}"><b>打断</b><small>首领蓄力时</small></button>
        <button class="cmd" data-cmd="rally"><img src="${kit.iconURL(ICONS.rally)}"><b>鼓舞</b><small>回复+增伤</small></button>
        <button class="cmd unison" data-cmd="unison"><img src="${kit.iconURL(ICONS.unison)}"><b>合体技</b><small class="u-gauge">需要搭档</small></button>
      </div>
      <div class="b-result hidden"></div>`;
    this.canvas = root.querySelector('.b-canvas');
    this.fx = new FxLayer(kit);
    this.speed = 1;
    root.querySelector('.b-speed').onclick = e => {
      this.speed = this.speed === 1 ? 2 : 1;
      e.currentTarget.textContent = this.speed + '×';
    };
    root.querySelector('.b-skip').onclick = () => this.skip();
    root.querySelectorAll('.cmd').forEach(btn => btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      this.issue(btn.dataset.cmd);
    }));
  }

  play({b, title, region}) {
    this.b = b;
    this.regionId = REGIONS[region] ? region : 'knight';
    this.region = REGIONS[this.regionId];
    this.bg = null;
    this.ambient = new Ambient(this.region.particle === 'snow' ? 'snow' : 'ash', 46);
    this.fx.clear();
    this.vt = 0;
    this.slow = null;
    this.shake = null;
    this.flashUntil = 0;
    this.done = false;
    this.ended = null;
    this.unisonHinted = false;
    this.root.querySelector('.b-title').textContent = title;
    this.root.querySelector('.b-result').classList.add('hidden');
    this.root.classList.remove('hidden');
    this.layout();
    this.kit.preload(this.kit.unitAssets(b.units.map(u => u.unit)));
    this.banner('战斗开始', '#ffe6a8');
    for (const v of this.views) this.fx.play('spawn', v.hx, v.hy, {now: -200 + hash(v.hx) * 300, scale: 0.8});
    return new Promise(resolve => {
      this.resolve = resolve;
      this.last = performance.now();
      const loop = now => {
        if (this.done) return;
        this.frame(now);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
  }

  layout() {
    const {LW, px} = fitCanvas(this.canvas);
    this.LW = LW;
    this.px = px;
    const cx = LW / 2;
    const spreads = [[0], [-16, 16], [-24, 0, 24], [-30, -10, 10, 30]];
    this.views = [];
    for (const side of ['A', 'E']) {
      const us = this.b.units.filter(u => u.side === side);
      const rows = {};
      for (const u of us) (rows[u.row] ||= []).push(u);
      for (const [r, list] of Object.entries(rows)) {
        list.forEach((u, i) => {
          const dy = spreads[Math.min(list.length, 4) - 1][i] || 0;
          const dir = side === 'A' ? -1 : 1;
          const hx = cx + dir * (u.boss ? 105 : 72 + Number(r) * 64) + (side === 'A' ? -dy * 0.35 : dy * 0.35);
          this.views.push({u, hx, hy: GROUND + 14 + dy, scale: 1 / px, act: 'idle', actAt: 0, lunge: null, flash: 0, hpShown: 1, deadAt: 0, knock: 0});
        });
      }
    }
    this.byKey = Object.fromEntries(this.views.map(v => [v.u.key, v]));
    const boss = this.b.units.find(u => u.boss);
    this.root.querySelector('.b-boss').classList.toggle('hidden', !boss);
    if (boss) this.root.querySelector('.b-boss-name').textContent = boss.name;
    this.root.querySelector('.cmd.unison').classList.toggle('hidden', !this.b.unison.length);
  }

  body(v) {
    const c = this.kit.unit(v.u.unit, 'idle');
    const h = (c ? c.height : 50) * v.scale;
    return {x: v.hx + this.ox(v), y: v.hy - h * 0.48, top: v.hy - h};
  }

  ox(v) {
    if (!v.lunge) return 0;
    const p = (this.vt - v.lunge.start) / v.lunge.dur;
    if (p >= 1 || p < 0) return 0;
    return v.lunge.dx * Math.sin(p * Math.PI) ** 0.7;
  }

  banner(text, color = '#fff') {
    const el = this.root.querySelector('.b-banner');
    el.textContent = text;
    el.style.color = color;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  doShake(amp, dur) {
    if (!this.shake || this.shake.amp <= amp) this.shake = {amp, until: this.vt + dur, dur};
  }

  issue(cmd) {
    if (!this.b || this.b.over) return;
    if (!command(this.b, cmd)) {
      const btn = this.root.querySelector(`.cmd[data-cmd="${cmd}"]`);
      btn.classList.remove('deny');
      void btn.offsetWidth;
      btn.classList.add('deny');
      return;
    }
    this.slow = null;
    if (navigator.vibrate) navigator.vibrate(cmd === 'unison' ? [20, 40, 30] : 15);
  }

  skip() {
    if (this.ended) return this.finish();
    if (this.b.over) return;
    this.b.auto = true;
    runHeadless(this.b);
    this.showResult(true);
  }

  finish() {
    this.done = true;
    this.root.classList.add('hidden');
    this.resolve(summarize(this.b));
  }

  handle(e) {
    const now = e.t;
    const V = this.byKey;
    switch (e.type) {
      case 'attack': {
        const s = V[e.src], t = V[e.tgt];
        if (!s || !t) break;
        s.act = 'attack';
        s.actAt = now;
        if (e.ranged) {
          const a = this.body(s), z = this.body(t);
          this.fx.projectile(e.proj || 'arrow', a.x + (s.u.side === 'A' ? 10 : -10), a.y, z.x, z.y, e.delay * 0.7, {now: now + e.delay * 0.3});
        } else {
          s.lunge = {start: now, dur: e.delay + 160, dx: (t.hx - s.hx) * 0.62 - (s.u.side === 'A' ? 22 : -22)};
        }
        break;
      }
      case 'hit': {
        const t = V[e.tgt];
        if (!t) break;
        const p = this.body(t);
        const fx = e.fx || (e.kind === 'ult' ? 'hitDark' : e.kind === 'skill' ? 'hitMagic' : null);
        if (fx && e.kind !== 'skill') this.fx.play(fx, p.x, p.y, {now, flipX: t.u.side === 'A'});
        else if (e.kind === 'skill') this.fx.play('hitMagic', p.x, p.y, {now, scale: 0.7});
        t.flash = now;
        t.knock = now;
        const big = e.kind === 'unison' || e.kind === 'ult';
        const color = e.kind === 'burn' ? '#ff8a4a' : t.u.side === 'A' ? '#ff6b6b' : e.crit ? '#ffe14a' : big ? '#ffd27a' : '#ffffff';
        const size = big ? 17 : e.crit ? 15 : e.kind === 'skill' ? 13 : 11;
        this.fx.text((e.crit ? '暴击 ' : '') + e.dmg, p.x + (hash(now) - 0.5) * 16, p.top + 4, {color, size, now, rise: 28});
        if (e.absorbed) this.fx.text(`护盾 -${e.absorbed}`, p.x, p.top - 10, {color: '#8fd4ff', size: 9, now: now + 80});
        if (e.crit) this.doShake(2.5, 140);
        break;
      }
      case 'death': {
        const t = V[e.tgt];
        if (!t) break;
        t.deadAt = now;
        const p = this.body(t);
        this.fx.play(t.u.side === 'A' ? 'deathDark' : 'death', p.x, t.u.side === 'A' ? t.hy - 30 : p.y, {now});
        if (t.u.side === 'A') this.fx.text('重伤撤离', p.x, p.top - 4, {color: '#ff9aa8', size: 11, now, life: 1300});
        if (t.u.boss) { this.doShake(7, 700); this.flashUntil = now + 220; this.fx.play('bigBoom', p.x, p.y, {now}); }
        break;
      }
      case 'heal': {
        const t = V[e.tgt];
        if (!t || !e.amount) break;
        const p = this.body(t);
        if (e.fx) this.fx.play(e.fx, p.x, t.hy - 18, {now});
        this.fx.text('+' + e.amount, p.x, p.top + 2, {color: '#7dff9a', size: 11, now});
        break;
      }
      case 'status': {
        const t = V[e.tgt];
        if (!t) break;
        const p = this.body(t);
        if (e.fx) this.fx.play(e.fx, p.x, e.status === 'shield' || e.status === 'buff' ? t.hy - 20 : p.y, {now});
        this.fx.text(STATUS_LABEL[e.status], p.x, p.top - 12, {color: STATUS_COLOR[e.status], size: 9, now: now + 60, rise: 16, life: 800});
        break;
      }
      case 'skill': {
        const s = V[e.src];
        if (!s) break;
        const sk = SKILLS[e.skill];
        s.act = 'attack';
        s.actAt = now;
        const p = this.body(s);
        this.fx.text(`「${sk.name}」`, p.x, p.top - 6, {color: s.u.side === 'A' ? '#ffe6a8' : '#ff9ab0', size: 12, now, rise: 18, life: 1200});
        s.castAt = now;
        const ts = e.targets.map(k => V[k]).filter(Boolean);
        if (!ts.length || ts[0].u.side === s.u.side) break;
        if (AOE_KINDS.has(sk.kind)) {
          const cx = ts.reduce((a, t) => a + t.hx, 0) / ts.length;
          const cy = ts.reduce((a, t) => a + this.body(t).y, 0) / ts.length;
          this.fx.play(sk.fx, cx, cy, {now: now + 60, flipX: s.u.side === 'E'});
          this.doShake(3, 260);
        } else {
          const seen = new Set();
          ts.forEach((t, i) => {
            if (seen.has(t)) return;
            seen.add(t);
            const q = this.body(t);
            this.fx.play(sk.fx, q.x, q.y, {now: now + 60 + i * 90, flipX: s.u.side === 'E'});
          });
        }
        if (sk.kind === 'backstab' && ts[0]) s.lunge = {start: now, dur: e.delay + 260, dx: (ts[0].hx - s.hx) * 0.8};
        break;
      }
      case 'telegraph': {
        const s = V[e.src];
        if (!s) break;
        this.fx.play('telegraph', s.hx, s.hy, {now, dur: e.until - now});
        this.banner('首领正在蓄力大招！', '#ff8a8a');
        if (this.b.points > 0 && !this.b.auto) this.slow = {until: performance.now() + 1400, k: 0.3};
        break;
      }
      case 'ultimate': {
        this.fx.stop('telegraph');
        const ts = e.targets.map(k => V[k]).filter(Boolean);
        if (ts.length) {
          const cx = ts.reduce((a, t) => a + t.hx, 0) / ts.length;
          this.fx.play('doom', cx, GROUND - 20, {now});
          this.fx.play('shockwave', cx, GROUND + 18, {now, color: 'rgba(255,80,90,0.9)'});
        }
        this.doShake(7, 520);
        this.flashUntil = now + 160;
        this.banner('首领大招！', '#ff5a6a');
        break;
      }
      case 'interrupt': {
        this.fx.stop('telegraph');
        const t = V[e.tgt];
        if (!t) break;
        const p = this.body(t);
        this.fx.play('interrupt', p.x, p.y + 40, {now});
        this.fx.play('shockwave', t.hx, t.hy, {now, color: 'rgba(170,220,255,0.9)'});
        this.doShake(4, 260);
        this.banner('打断成功！首领陷入眩晕', '#a8e6ff');
        break;
      }
      case 'rally': {
        this.banner('鼓舞！全员回复并振奋', '#ffe27a');
        for (const v of this.views) if (v.u.side === 'A' && v.u.alive) this.fx.play('buff', v.hx, v.hy - 20, {now});
        break;
      }
      case 'unison': {
        const a = V[e.a], bb = V[e.b];
        this.banner(`合体技 · ${a.u.name} × ${bb.u.name}`, '#ffd9a0');
        this.fx.play('unisonFlash', (a.hx + bb.hx) / 2, GROUND - 50, {now});
        this.fx.play('levelUp', a.hx, a.hy, {now});
        this.fx.play('levelUp', bb.hx, bb.hy, {now});
        a.act = bb.act = 'attack';
        a.actAt = bb.actAt = now + 300;
        const ts = e.targets.map(k => V[k]).filter(Boolean);
        if (ts.length) {
          const cx = ts.reduce((s, t) => s + t.hx, 0) / ts.length;
          this.fx.play('bigBoom', cx, GROUND - 26, {now: now + 850});
          this.fx.play('shockwave', cx, GROUND + 16, {now: now + 880});
        }
        this.slow = {until: performance.now() + 900, k: 0.35};
        this.doShake(9, 650);
        break;
      }
      case 'end':
        this.showResult(false);
        break;
    }
  }

  showResult(skipped) {
    if (this.ended) return;
    const b = this.b;
    this.ended = {at: this.vt, win: b.winner === 'A'};
    const win = b.winner === 'A';
    const el = this.root.querySelector('.b-result');
    const s = summarize(b);
    const mvp = b.units.filter(u => u.side === 'A').sort((x, y) => y.dealt - x.dealt)[0];
    el.innerHTML = `
      <div class="r-title ${win ? 'win' : 'lose'}">${win ? '凯 旋' : '败 退'}</div>
      <div class="r-sub">${skipped ? '（已跳过）' : ''}用时 ${(s.duration / 1000).toFixed(1)} 秒 · 击倒 ${s.enemiesKilled} 名敌人${s.bossKilled ? ' · 讨伐首领' : ''}</div>
      ${mvp ? `<div class="r-mvp">本场最佳 <b>${mvp.name}</b> 造成 ${Math.round(mvp.dealt)} 伤害</div>` : ''}
      <button class="btn primary r-go">继续</button>`;
    setTimeout(() => {
      el.classList.remove('hidden');
      el.querySelector('.r-go').onclick = () => this.finish();
    }, skipped ? 0 : 900);
    if (win && !skipped) this.fx.play('victory', this.LW / 2, 150, {now: this.vt + 500});
  }

  updateHud() {
    const b = this.b;
    const root = this.root;
    root.querySelector('.b-timer i').style.width = `${Math.max(0, 100 - b.t / 600)}%`;
    root.querySelector('.b-points').innerHTML = '指挥 ' + Array.from({length: 3}, (_, i) => `<i class="${i < b.points ? 'on' : ''}"></i>`).join('');
    const charging = !!chargingBoss(b);
    for (const btn of root.querySelectorAll('.cmd')) {
      const ok = canCommand(b, btn.dataset.cmd);
      btn.classList.toggle('ready', ok);
      btn.classList.toggle('urgent', btn.dataset.cmd === 'interrupt' && charging && ok);
    }
    if (b.unison.length) {
      const p = b.unison.find(x => !x.used);
      const g = root.querySelector('.u-gauge');
      g.textContent = p ? (readyUnison(b) ? '就绪！' : `蓄能 ${Math.floor(p.gauge)}%`) : '已释放';
      if (readyUnison(b) && !this.unisonHinted) {
        this.unisonHinted = true;
        this.banner('搭档合体技已就绪！', '#ffd9a0');
      }
    }
    const boss = b.units.find(u => u.boss);
    if (boss) {
      root.querySelector('.b-boss-bar .hp').style.width = `${(boss.hp / boss.maxHp) * 100}%`;
      root.querySelector('.b-boss-bar .sh').style.width = `${Math.min(1, boss.shield / boss.maxHp) * 100}%`;
      root.querySelector('.b-boss').classList.toggle('charging', charging);
    }
  }

  frame(now) {
    let dt = Math.min(50, now - this.last);
    this.last = now;
    const {ctx, LW} = fitCanvas(this.canvas);
    if (Math.abs(LW - this.LW) > 1 || Math.abs(this.px - fitCanvas(this.canvas).px) > 0.001) {
      this.LW = LW;
      const old = this.views;
      this.layout();
      this.views.forEach((v, i) => Object.assign(v, {...old[i], hx: v.hx, hy: v.hy}));
    }
    let k = this.speed;
    if (this.slow) {
      if (now > this.slow.until) this.slow = null;
      else k *= this.slow.k;
    }
    const adv = dt * k;
    if (!this.b.over) {
      let left = adv;
      while (left > 0 && !this.b.over) {
        const d = Math.min(20, left);
        step(this.b, d);
        left -= d;
        for (const e of this.b.events) this.handle(e);
        this.b.events.length = 0;
      }
      this.vt = this.b.t;
    } else {
      this.vt += adv;
    }
    this.updateHud();
    this.draw(ctx, LW, dt);
  }

  draw(ctx, LW, dt) {
    const vt = this.vt;
    const R = this.region;
    ctx.save();
    if (this.shake && vt < this.shake.until) {
      const a = this.shake.amp * ((this.shake.until - vt) / this.shake.dur);
      ctx.translate((Math.random() - 0.5) * a * 2, (Math.random() - 0.5) * a * 2);
    }
    const BW = ctx.canvas.width, BH = ctx.canvas.height;
    if (!this.bg || this.bg.w !== BW || this.bg.h !== BH) this.bg = {...regionScene(this.regionId, BW, BH), w: BW, h: BH};
    const bg = this.bg;
    const m = ctx.getTransform();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, Math.round(m.e), Math.round(m.f));
    ctx.drawImage(bg.canvas, 0, 0);
    ctx.restore();
    reflect(ctx, bg.canvas, BW, bg.H0, bg.H0, bg.W0 - bg.H0, performance.now(), {tint: bg.P.water, alpha: 0.4, squash: 1.6});
    glow(ctx, LW / 2, GROUND + 10, 200, R.accent + '1a');
    // 单位
    const sorted = this.views.slice().sort((a, b) => a.hy - b.hy);
    for (const v of sorted) this.drawUnit(ctx, v, vt);
    this.fx.draw(ctx, vt);
    for (const v of sorted) this.drawBars(ctx, v, vt);
    this.ambient.draw(ctx, this.kit, LW, 360, dt);
    ctx.restore();

    // 暗角
    const vg = ctx.createRadialGradient(LW / 2, 190, 160, LW / 2, 190, LW * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(5,2,12,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, LW, 360);
    if (vt < this.flashUntil) {
      ctx.fillStyle = `rgba(255,255,255,${(this.flashUntil - vt) / 400})`;
      ctx.fillRect(0, 0, LW, 360);
    }
    if (this.slow) {
      ctx.fillStyle = 'rgba(30,0,10,0.18)';
      ctx.fillRect(0, 0, LW, 360);
    }
  }

  drawUnit(ctx, v, vt) {
    const u = v.u;
    let alpha = 1;
    let sink = 0;
    if (v.deadAt) {
      const p = (vt - v.deadAt) / 700;
      if (p >= 1) return;
      alpha = 1 - p;
      sink = p * 8;
    }
    const flip = u.side === 'E';
    const knock = v.knock && vt - v.knock < 140 ? (flip ? 3 : -3) * (1 - (vt - v.knock) / 140) : 0;
    const x = v.hx + this.ox(v) + knock;
    const y = v.hy + sink;
    // 影子
    this.shadow(ctx, x, v.hy + 1, u.boss ? 22 : 13);
    if (u.boss && u.alive) glow(ctx, x, y - 30 * v.scale, 70, 'rgba(255,60,80,0.10)');
    if (vt < u.buffUntil) glow(ctx, x, y - 20 * v.scale, 34 * v.scale, 'rgba(255,200,80,0.35)');
    if (u.ult && u.ult.chargeUntil > vt) glow(ctx, x, y - 26 * v.scale, 60, `rgba(255,40,60,${0.35 + 0.25 * Math.sin(vt / 60)})`);

    let action = 'idle', el = vt;
    if (v.act === 'attack') {
      const dur = this.kit.duration(u.unit, 'attack');
      if (vt - v.actAt < dur) { action = 'attack'; el = vt - v.actAt; } else v.act = 'idle';
    }
    const frozen = vt < u.freezeUntil;
    const stunned = vt < u.stunUntil;
    if (frozen || stunned) { action = 'idle'; el = 0; }
    ctx.save();
    ctx.globalAlpha = alpha;
    this.kit.drawUnit(ctx, u.unit, action, el, x, y, {flipX: flip, scale: v.scale});
    if (v.flash && vt - v.flash < 110) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.7 * (1 - (vt - v.flash) / 110);
      this.kit.drawUnit(ctx, u.unit, action, el, x, y, {flipX: flip, scale: v.scale});
    }
    ctx.restore();
    const c = this.kit.unit(u.unit, 'idle');
    const h = (c ? c.height : 50) * v.scale;
    if (frozen) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(120,210,255,0.28)';
      ctx.fillRect(x - 16 * v.scale, y - h, 32 * v.scale, h);
      ctx.strokeStyle = 'rgba(200,240,255,0.8)';
      ctx.strokeRect(Math.round(x - 16 * v.scale) + 0.5, Math.round(y - h) + 0.5, Math.round(32 * v.scale), Math.round(h));
      ctx.restore();
    }
    if (stunned && u.alive) {
      for (let i = 0; i < 3; i++) {
        const a = vt / 260 + i * 2.1;
        ctx.fillStyle = '#fff27a';
        ctx.fillRect(Math.round(x + Math.cos(a) * 12) - 1, Math.round(y - h - 4 + Math.sin(a) * 3) - 1, 3, 3);
      }
    }
    if (vt < u.burnUntil && u.alive) {
      for (let i = 0; i < 4; i++) {
        const fy = ((vt / 6 + i * 20) % 26);
        ctx.fillStyle = i % 2 ? '#ff9a3a' : '#ffd84a';
        ctx.fillRect(Math.round(x - 10 + i * 6), Math.round(y - 6 - fy), 2, 2);
      }
    }
    if (u.shield > 0 && u.alive) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(130,200,255,${0.35 + 0.15 * Math.sin(vt / 180)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x, y - h * 0.5, 20 * v.scale, h * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 像素椭圆影子（缓冲像素坐标）
  shadow(ctx, x, y, r) {
    const m = ctx.getTransform();
    const sx = Math.round(m.a * x + m.e), sy = Math.round(m.d * y + m.f);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fillRect(sx - r + 3, sy - 2, r * 2 - 6, 1);
    ctx.fillRect(sx - r, sy - 1, r * 2, 2);
    ctx.fillRect(sx - r + 3, sy + 1, r * 2 - 6, 1);
    ctx.restore();
  }

  drawBars(ctx, v, vt) {
    const u = v.u;
    if (u.boss || v.deadAt) return;
    const c = this.kit.unit(u.unit, 'idle');
    const h = (c ? c.height : 50) * v.scale;
    const m = ctx.getTransform();
    const W = 20;
    const x = Math.round(m.a * (v.hx + this.ox(v)) + m.e) - W / 2;
    const y = Math.round(m.d * (v.hy - h - 2) + m.f);
    const ratio = Math.max(0, u.hp / u.maxHp);
    v.hpShown += (ratio - v.hpShown) * 0.08;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#120a18';
    ctx.fillRect(x - 1, y - 1, W + 2, 5);
    ctx.fillStyle = '#3a2a3e';
    ctx.fillRect(x, y, W, 3);
    ctx.fillStyle = '#fff4d8';
    ctx.fillRect(x, y, Math.round(W * v.hpShown), 3);
    const col = u.side === 'A' ? (ratio < 0.3 ? ['#ff5a5a', '#a82a3a'] : ['#6ef07a', '#2a9a4a']) : ['#ff6a6a', '#b0283a'];
    ctx.fillStyle = col[1];
    ctx.fillRect(x, y, Math.round(W * ratio), 3);
    ctx.fillStyle = col[0];
    ctx.fillRect(x, y, Math.round(W * ratio), 2);
    if (u.shield > 0) {
      ctx.fillStyle = '#8fd4ff';
      ctx.fillRect(x, y - 2, Math.round(W * Math.min(1, u.shield / u.maxHp)), 1);
    }
    if (u.side === 'A') {
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(x - 3, y, 2, 2);
    }
    ctx.restore();
  }
}
