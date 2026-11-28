// Duelyst H5 素材接入：单位动画、特效键、图标，以及程序自绘特效。
import {FX, PARTICLE_TEX} from './data.js';
import {FONT} from './scene.js';

const OUTLINE = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, 2]];

const NO_ADD = new Set(['death', 'smoke', 'dust', 'boulder', 'freeze']);

export function createKit() {
  const k = globalThis.DuelystH5.create();
  const images = new Map();

  function image(clip) {
    if (!clip) return null;
    const url = k.assetURL(clip);
    const rec = images.get(url);
    if (rec) return rec.ready ? rec.img : null;
    const r = {img: null, ready: false};
    images.set(url, r);
    k.image(clip).then(img => { r.img = img; r.ready = true; }).catch(() => images.delete(url));
    return null;
  }

  function preload(clips) {
    return Promise.all(clips.filter(Boolean).map(c => k.image(c).then(img => {
      images.set(k.assetURL(c), {img, ready: true});
    }).catch(() => null)));
  }

  const unit = (id, action) => k.unit(id, action) || k.unit(id, 'idle');
  const feet = id => {
    const c = k.unit(id, 'idle');
    return c ? c.height - c.anchorY : 0;
  };
  const top = id => {
    const c = k.unit(id, 'idle');
    return c ? c.height : 60;
  };

  // 以脚底为基准绘制单位
  function drawUnit(ctx, id, action, elapsed, x, groundY, {flipX = false, scale = 1, loop = true, rate = 1} = {}) {
    const clip = unit(id, action);
    const img = image(clip);
    if (!img) return false;
    return k.draw(ctx, clip, img, Math.max(0, elapsed * rate), x, groundY - feet(id) * scale, {loop, scale, flipX});
  }

  function duration(id, action) {
    const c = unit(id, action);
    return c ? k.duration(c) : 600;
  }

  const fxClip = key => (FX[key]?.sprite ? k.effect(FX[key].sprite) : null);
  const texClip = name => k.effect(PARTICLE_TEX[name]);
  const iconURL = id => (k.icon(id) ? k.assetURL(k.icon(id)) : '');

  function unitAssets(ids) {
    const clips = [];
    for (const id of ids) clips.push(k.unit(id, 'idle'), k.unit(id, 'attack'));
    return clips;
  }

  // 单位立绘：取待机第一帧，缩放到方框中
  function portrait(id, size = 64) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    c.className = 'portrait';
    const clip = k.unit(id, 'idle');
    const paint = img => {
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const s = Math.min(size / clip.width, size / clip.height, 2) * 0.95;
      const w = clip.width * s, h = clip.height * s;
      ctx.drawImage(img, 0, 0, clip.width, clip.height, (size - w) / 2, size - h - 2, w, h);
    };
    if (clip) k.image(clip).then(paint).catch(() => {});
    return c;
  }

  return {raw: k, image, preload, unit, drawUnit, duration, feet, top, fxClip, texClip, iconURL, unitAssets, portrait};
}

// 特效层：按键独立调用，时机与落点由游戏事件决定，同一特效可被任意多个实例复用。
export class FxLayer {
  constructor(kit) {
    this.kit = kit;
    this.items = [];
    this.texts = [];
  }

  play(key, x, y, opts = {}) {
    const def = FX[key];
    if (!def) return null;
    const now = opts.now ?? performance.now();
    const item = {key, def, x, y, start: now + (opts.delay || 0), scale: (def.scale || 1) * (opts.scale || 1), flipX: !!opts.flipX,
      loop: opts.loop ?? !!def.loop, until: opts.until || 0, dur: opts.dur || 0, color: opts.color, follow: opts.follow || null};
    if (def.sprite) {
      item.clip = this.kit.fxClip(key);
      this.kit.image(item.clip);
    }
    this.items.push(item);
    return item;
  }

  projectile(key, x0, y0, x1, y1, dur, opts = {}) {
    const it = this.play(key, x0, y0, {...opts, loop: true, until: (opts.now ?? performance.now()) + dur});
    if (it) Object.assign(it, {x0, y0, x1, y1, travel: dur, flipX: x1 < x0});
    return it;
  }

  text(str, x, y, {color = '#fff', size = 12, rise = 26, life = 900, stroke = '#1a0f22', now} = {}) {
    this.texts.push({str, x, y, color, size, rise, life, stroke, start: now ?? performance.now()});
  }

  stop(key) {
    this.items = this.items.filter(it => it.key !== key);
  }

  clear() {
    this.items.length = 0;
    this.texts.length = 0;
  }

  draw(ctx, now) {
    const keep = [];
    for (const it of this.items) {
      if (now < it.start) { keep.push(it); continue; }
      const t = now - it.start;
      if (it.until && now > it.until) continue;
      let x = it.x, y = it.y;
      if (it.travel) {
        const p = Math.min(1, t / it.travel);
        x = it.x0 + (it.x1 - it.x0) * p;
        y = it.y0 + (it.y1 - it.y0) * p - Math.sin(p * Math.PI) * 10;
      }
      if (it.follow) ({x, y} = it.follow());
      let alive;
      if (it.def.proc) alive = PROC[it.def.proc](ctx, t, x, y, it);
      else {
        const img = this.kit.image(it.clip);
        if (!img) { keep.push(it); continue; }
        ctx.save();
        ctx.globalCompositeOperation = NO_ADD.has(it.key) ? 'source-over' : 'lighter';
        alive = this.kit.raw.draw(ctx, it.clip, img, t, x, y, {loop: it.loop, scale: it.scale, flipX: it.flipX});
        ctx.restore();
        if (it.loop && !it.until) alive = true;
      }
      if (alive) keep.push(it);
    }
    this.items = keep;

    const texts = [];
    for (const tx of this.texts) {
      const t = (now - tx.start) / tx.life;
      if (t < 0) { texts.push(tx); continue; }
      if (t >= 1) continue;
      const ease = 1 - Math.pow(1 - t, 3);
      // 在缓冲像素坐标中用像素字体绘制，保证字形清晰
      const m = ctx.getTransform();
      const lx = tx.x, ly = tx.y - tx.rise * ease;
      const sx = Math.round(m.a * lx + m.c * ly + m.e), sy = Math.round(m.b * lx + m.d * ly + m.f);
      const big = tx.size >= 15 || (t < 0.1 && tx.size >= 13);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
      ctx.font = `${big ? 24 : 12}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = tx.stroke;
      for (const [dx, dy] of OUTLINE) ctx.fillText(tx.str, sx + dx, sy + dy);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.str, sx, sy);
      ctx.restore();
      texts.push(tx);
    }
    this.texts = texts;
  }
}

// ---------- 程序特效 ----------
const TAU = Math.PI * 2;

const PROC = {
  // 首领蓄力预警：脚下红色符文圈收缩 + 竖直警示光柱 + 进度弧
  telegraph(ctx, t, x, y, it) {
    const dur = it.dur || 3600;
    if (t > dur) return false;
    const p = t / dur;
    const pulse = 0.5 + 0.5 * Math.sin(t / 70);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);
    ctx.scale(1, 0.38);
    const r = 70 - 30 * p;
    ctx.strokeStyle = `rgba(255,60,70,${0.45 + 0.4 * pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255,190,80,0.9)';
    ctx.beginPath(); ctx.arc(0, 0, r + 8, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + t / 400;
      ctx.fillStyle = 'rgba(255,90,90,0.8)';
      ctx.fillRect(Math.cos(a) * (r + 16) - 3, Math.sin(a) * (r + 16) - 3, 6, 6);
    }
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(x, y - 140, x, y);
    g.addColorStop(0, 'rgba(255,40,60,0)');
    g.addColorStop(1, `rgba(255,40,60,${0.18 + 0.2 * pulse})`);
    ctx.fillStyle = g;
    ctx.fillRect(x - 34, y - 140, 68, 140);
    ctx.restore();
    ctx.save();
    ctx.font = `24px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(255,${120 + 100 * pulse},80,1)`;
    ctx.strokeStyle = '#2a0008';
    ctx.lineWidth = 4;
    ctx.strokeText('!', x, y - 118 - pulse * 4);
    ctx.fillText('!', x, y - 118 - pulse * 4);
    ctx.restore();
    return true;
  },
  // 打断：碎裂的白色光环与飞散碎片
  shatterRing(ctx, t, x, y) {
    const dur = 600;
    if (t > dur) return false;
    const p = t / dur;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y - 40);
    ctx.strokeStyle = `rgba(200,230,255,${1 - p})`;
    ctx.lineWidth = 6 * (1 - p) + 1;
    ctx.beginPath(); ctx.arc(0, 0, 20 + 70 * p, 0, TAU); ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU;
      const d = 18 + 90 * p;
      ctx.fillStyle = `rgba(255,255,255,${1 - p})`;
      ctx.fillRect(Math.cos(a) * d - 2, Math.sin(a) * d - 2, 4, 4);
    }
    ctx.restore();
    return true;
  },
  // 冲击波：地面椭圆环
  shockwave(ctx, t, x, y, it) {
    const dur = 520;
    if (t > dur) return false;
    const p = t / dur;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);
    ctx.scale(1, 0.32);
    ctx.strokeStyle = it.color || `rgba(255,220,150,${1 - p})`;
    ctx.globalAlpha = 1 - p;
    ctx.lineWidth = 10 * (1 - p) + 2;
    ctx.beginPath(); ctx.arc(0, 0, 14 + 120 * p, 0, TAU); ctx.stroke();
    ctx.restore();
    return true;
  },
  // 金币迸发：结算与收入
  coinBurst(ctx, t, x, y, it) {
    const dur = 1100;
    if (t > dur) return false;
    const p = t / dur;
    ctx.save();
    for (let i = 0; i < 14; i++) {
      const a = -Math.PI / 2 + (i - 7) * 0.16;
      const v = 60 + (i * 37) % 50;
      const px = x + Math.cos(a) * v * p * 1.4;
      const py = y + Math.sin(a) * v * p * 1.4 + 160 * p * p;
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = i % 3 ? '#ffd24a' : '#fff2a8';
      ctx.fillRect(px - 2, py - 2, 4, 4);
      ctx.fillStyle = '#b8791a';
      ctx.fillRect(px - 2, py + 1, 4, 1);
    }
    ctx.restore();
    return true;
  },
  // 合体技：全屏闪白 + 放射光芒
  unisonFlash(ctx, t, x, y, it) {
    const dur = 1100;
    if (t > dur) return false;
    const p = t / dur;
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = p < 0.15 ? p / 0.15 : Math.max(0, 1 - (p - 0.15) / 0.85);
    ctx.fillStyle = it.color || 'rgba(255,230,180,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);
    ctx.rotate(t / 900);
    for (let i = 0; i < 16; i++) {
      ctx.rotate(TAU / 16);
      ctx.fillStyle = `rgba(255,220,140,${0.35 * (1 - p)})`;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(260, -10); ctx.lineTo(260, 10); ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    return true;
  },
  // 好感：小爱心升起（搭档结成）
  heartBurst(ctx, t, x, y) {
    const dur = 1400;
    if (t > dur) return false;
    const p = t / dur;
    ctx.save();
    for (let i = 0; i < 6; i++) {
      const px = x + Math.sin(i * 2.1 + t / 200) * 14;
      const py = y - p * 60 - i * 7;
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = '#ff6b9a';
      const s = 2;
      ctx.fillRect(px - 2 * s, py - s, 2 * s, 2 * s);
      ctx.fillRect(px, py - s, 2 * s, 2 * s);
      ctx.fillRect(px - 1.5 * s, py + s, 3 * s, s);
    }
    ctx.restore();
    return true;
  },
};
