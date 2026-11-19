import './hero-camp.css';
import { HEROES, type HeroDef, type HeroId } from '../core/data';
import { DIFFS, type Diff } from '../core/run';
import { sfx } from '../qb/audio';
import { h, stageState } from '../qb/dom';
import type { FX } from '../qb/fx';
import { icon } from '../qb/icons';
import { kwRich } from '../qb/kwtext';
import { itemIcon } from '../qb/pixelItems';
import { unitSvg } from '../qb/unitArt';

interface HeroTheme {
  role: string;
  mark: string;
  tip: string;
  accent: string;
  glow: string;
  bg: string;
  rgb: [number, number, number];
  particle: 'ember' | 'plus' | 'star' | 'coin' | 'wisp' | 'forge';
  fx: (fx: FX, x: number, y: number) => void;
}

const HERO_THEMES: Record<HeroId, HeroTheme> = {
  vet: {
    role: '百战先锋 · 驻队历练',
    mark: '百战',
    tip: '核心单位越早入队收益越高，适合稳扎稳打的长线养成阵容。',
    accent: '#f5b642',
    glow: '#ff6238',
    bg: '#24141a',
    rgb: [245, 182, 66],
    particle: 'ember',
    fx: (fx, x, y) => {
      fx.slash(x + 12, y - 38, 1, '#ffd466', true);
      fx.wave(x, y + 66, '#f5b642', 240, 500);
      fx.burst(x + 8, y - 20, '#ff8b42', { n: 22, speed: 6.2, kind: 'spark', size: 3.5, up: 2.2, life: 36 });
    },
  },
  qm: {
    role: '军械统帅 · 精准强化',
    mark: '军需',
    tip: '每回合稳定灌注永久攻血，能迅速把核心前排或主力养成怪物。',
    accent: '#ffd466',
    glow: '#58d6ff',
    bg: '#181d30',
    rgb: [255, 212, 102],
    particle: 'plus',
    fx: (fx, x, y) => {
      fx.pillar(x, y + 70, '#ffd466', 290, 560);
      fx.dome(x, y - 24, '#ffd466');
      fx.burst(x, y - 10, '#ffe48c', { n: 16, speed: 4.4, kind: 'plus', size: 4, up: 3.2, life: 42, gravity: 0.03 });
    },
  },
  seer: {
    role: '星穹观测 · 定向发现',
    mark: '先知',
    tip: '高频发现当前酒馆阶单位，加速三连升金与关键流派核心成型。',
    accent: '#63e3ff',
    glow: '#9a7bff',
    bg: '#121b30',
    rgb: [99, 227, 255],
    particle: 'star',
    fx: (fx, x, y) => {
      fx.implode(x, y - 26, '#7beaff', { n: 18, r: 96, life: 22, size: 3.5 });
      fx.spin(x, y + 64, '#63e3ff');
      fx.burst(x, y - 26, '#9a7bff', { n: 20, speed: 5.2, kind: 'shard', size: 3.5, up: 1.5, life: 38, gravity: 0.04 });
    },
  },
  guild: {
    role: '黄金契约 · 经济滚雪',
    mark: '商会',
    tip: '免费刷新叠加升本折扣，快速拉开酒馆等级差，抢占高阶卡池。',
    accent: '#4ce5a0',
    glow: '#ffd36b',
    bg: '#122424',
    rgb: [76, 229, 160],
    particle: 'coin',
    fx: (fx, x, y) => {
      fx.wave(x, y + 66, '#4ce5a0', 250, 520);
      fx.ring(x, y - 24, '#ffd36b', 96, 28);
      fx.burst(x, y - 24, '#ffd36b', { n: 22, speed: 5.5, kind: 'spark', size: 3.5, up: 2.6, life: 38 });
    },
  },
  summon: {
    role: '冥契唤灵 · 军团爆发',
    mark: '唤灵',
    tip: '开局自带军团层数，天然适配召唤与献祭体系，前期压制力拉满。',
    accent: '#d27aff',
    glow: '#ff59a6',
    bg: '#20122c',
    rgb: [210, 122, 255],
    particle: 'wisp',
    fx: (fx, x, y) => {
      fx.pillar(x, y + 70, '#d27aff', 300, 600);
      fx.wave(x, y + 66, '#ff59a6', 230, 500);
      fx.burst(x, y - 16, '#d27aff', { n: 20, speed: 4.8, kind: 'mote', size: 4, up: 2.4, life: 42, gravity: 0.02 });
    },
  },
  smith: {
    role: '圣锤锻匠 · 装备升阶',
    mark: '锻魂',
    tip: '篝火额外解锁装备升品，把普通装备一路锻成改变战局的神器。',
    accent: '#ff8338',
    glow: '#ffe066',
    bg: '#281512',
    rgb: [255, 131, 56],
    particle: 'forge',
    fx: (fx, x, y) => {
      fx.impact(x, y - 18, '#ffb84d', true);
      fx.wave(x, y + 66, '#ff7b33', 260, 480);
      fx.burst(x, y - 8, '#ffe066', { n: 26, speed: 6.8, kind: 'spark', size: 3.5, up: 2.8, life: 36, gravity: 0.16 });
    },
  },
};

function unlockGoal(idx: number): string {
  if (idx < 2) return '';
  if (idx < 4) return '完成 1 局解锁';
  return '完成 2 局或通关解锁';
}

/** 播一次英雄素材攻击帧；没有攻击帧的英雄改为蓄光跃起展示姿态 */
function playHeroPose(figure: HTMLElement, accent: string, prevAnim: { current: Animation | null }, dur = 680) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.unitMotion === 'off';
  if (reduced) return;
  const art = figure.querySelector<HTMLElement>('.uart.duelyst');
  const spec = art?.getAttribute('data-act-attack');
  prevAnim.current?.cancel();
  art?.querySelector('.duelyst-act')?.remove();
  art?.classList.remove('acting');
  if (art && spec) {
    const [src, n] = spec.split('|');
    const frames = Number(n);
    const img = h('img', { class: 'duelyst-act-strip', src, alt: '', draggable: 'false' });
    const box = h('span', { class: 'duelyst-act', style: `--af:${frames}` }, img);
    art.appendChild(box);
    art.classList.add('acting');
    const a = img.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-100%)' }],
      { duration: dur, easing: `steps(${frames}, end)` });
    prevAnim.current = a;
    a.finished.catch(() => undefined).finally(() => {
      box.remove();
      if (prevAnim.current === a) {
        prevAnim.current = null;
        art.classList.remove('acting');
      }
    });
    figure.animate([
      { transform: 'translateY(8px) scale(.94)', filter: `brightness(1.35) drop-shadow(0 14px 0 rgba(6,5,14,.68)) drop-shadow(0 0 36px ${accent})` },
      { transform: 'translateY(-4px) scale(1.04)', offset: 0.35 },
      { transform: 'translateY(0) scale(1)' },
    ], { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1)' });
    return;
  }
  figure.animate([
    { transform: 'translateY(10px) scale(.92)', filter: `brightness(1.1) drop-shadow(0 14px 0 rgba(6,5,14,.68))` },
    { transform: 'translateY(-14px) scale(1.06)', filter: `brightness(1.65) drop-shadow(0 20px 0 rgba(6,5,14,.55)) drop-shadow(0 0 42px ${accent})`, offset: 0.42 },
    { transform: 'translateY(0) scale(1)', filter: `brightness(1) drop-shadow(0 14px 0 rgba(6,5,14,.68)) drop-shadow(0 0 24px ${accent})` },
  ], { duration: 540, easing: 'cubic-bezier(.2,.85,.3,1)' });
}

interface CampParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
  danger?: boolean;
}

/** 半分辨率像素粒子与光柱氛围渲染器（640×360 硬像素缩放，不模糊） */
function startCampCanvas(canvas: HTMLCanvasElement, state: { rgb: [number, number, number]; particle: HeroTheme['particle']; diff: Diff }) {
  const W = 640;
  const H = 360;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  ctx.imageSmoothingEnabled = false;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const curRgb: [number, number, number] = [...state.rgb];

  // 固定像素星空
  const stars = Array.from({ length: 42 }, (_, i) => ({
    x: ((i * 97 + 23) % (W - 20)) + 10,
    y: ((i * 53 + 11) % 165) + 12,
    s: i % 5 === 0 ? 2 : 1,
    ph: i * 0.7,
  }));

  const spawn = (randomY = false, danger = false): CampParticle => {
    if (danger) {
      return {
        x: Math.random() * W,
        y: randomY ? Math.random() * H : H + 6,
        vx: -0.45 - Math.random() * 0.6,
        vy: -0.6 - Math.random() * 1.1,
        size: Math.random() < 0.35 ? 2 : 1,
        alpha: 0.45 + Math.random() * 0.5,
        phase: Math.random() * 6.28,
        danger: true,
      };
    }
    const nearAltar = Math.random() < 0.68;
    const x = nearAltar ? 168 + (Math.random() - 0.5) * 196 : Math.random() * W;
    const y = randomY ? 70 + Math.random() * 210 : 258 + Math.random() * 34;
    return {
      x,
      y,
      vx: (Math.random() - 0.5) * 0.35,
      vy: -0.35 - Math.random() * 0.75,
      size: Math.random() < 0.32 ? 3 : Math.random() < 0.72 ? 2 : 1,
      alpha: 0.35 + Math.random() * 0.65,
      phase: Math.random() * 6.28,
    };
  };

  const particles: CampParticle[] = Array.from({ length: 42 }, () => spawn(true, false));
  const dangerParticles: CampParticle[] = Array.from({ length: 20 }, () => spawn(true, true));

  let raf = 0;
  let t = 0;
  let dead = false;

  const drawFrame = () => {
    if (dead) return;
    t += 0.025;
    for (let i = 0; i < 3; i++) curRgb[i] += (state.rgb[i] - curRgb[i]) * 0.08;
    const r = Math.round(curRgb[0]);
    const g = Math.round(curRgb[1]);
    const b = Math.round(curRgb[2]);

    ctx.clearRect(0, 0, W, H);

    // 1. 像素星点
    for (const st of stars) {
      const tw = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.4 + st.ph));
      ctx.fillStyle = `rgba(230,224,255,${tw.toFixed(2)})`;
      ctx.fillRect(st.x | 0, st.y | 0, st.s, st.s);
    }

    // 2. 祭坛斜向像素聚光束（分阶硬边层次）
    const pulse = 0.85 + 0.15 * Math.sin(t * 1.8);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(118, 0);
    ctx.lineTo(248, 0);
    ctx.lineTo(232, 268);
    ctx.lineTo(96, 268);
    ctx.closePath();
    ctx.fillStyle = `rgba(${r},${g},${b},${(0.08 * pulse).toFixed(3)})`;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(146, 0);
    ctx.lineTo(212, 0);
    ctx.lineTo(200, 268);
    ctx.lineTo(132, 268);
    ctx.closePath();
    ctx.fillStyle = `rgba(${r},${g},${b},${(0.07 * pulse).toFixed(3)})`;
    ctx.fill();
    ctx.restore();

    // 3. 英雄主题像素粒子
    const speedMul = state.diff === 2 ? 1.45 : state.diff === 1 ? 1.18 : 1;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!reduced) {
        p.x += (p.vx + Math.sin(t * 1.5 + p.phase) * 0.14) * speedMul;
        p.y += p.vy * speedMul;
        if (p.y < 24 || p.x < -10 || p.x > W + 10) particles[i] = spawn(false, false);
      }
      const fade = Math.min(1, Math.max(0, (p.y - 24) / 68)) * p.alpha;
      const px = Math.round(p.x);
      const py = Math.round(p.y);
      ctx.fillStyle = `rgba(${r},${g},${b},${fade.toFixed(2)})`;
      if (state.particle === 'plus' && p.size >= 2) {
        ctx.fillRect(px, py - 1, 1, 3);
        ctx.fillRect(px - 1, py, 3, 1);
      } else if (state.particle === 'star' && p.size >= 2) {
        ctx.fillRect(px, py, 2, 2);
        ctx.fillStyle = `rgba(255,255,255,${(fade * 0.7).toFixed(2)})`;
        ctx.fillRect(px, py, 1, 1);
      } else if (state.particle === 'coin' && p.size >= 2) {
        ctx.fillStyle = `rgba(255,214,107,${fade.toFixed(2)})`;
        ctx.fillRect(px, py, 2, 2);
      } else {
        ctx.fillRect(px, py, p.size, p.size);
      }
    }

    // 4. 噩梦/困难赤红战火余烬
    if (state.diff >= 1) {
      const count = state.diff === 2 ? dangerParticles.length : 8;
      for (let i = 0; i < count; i++) {
        const p = dangerParticles[i];
        if (!reduced) {
          p.x += p.vx * (state.diff === 2 ? 1.4 : 0.9);
          p.y += p.vy * (state.diff === 2 ? 1.3 : 0.85);
          if (p.y < 8 || p.x < -8) dangerParticles[i] = spawn(false, true);
        }
        ctx.fillStyle = `rgba(255,78,108,${(p.alpha * (state.diff === 2 ? 0.85 : 0.45)).toFixed(2)})`;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
    }

    if (!reduced && !document.hidden) raf = requestAnimationFrame(drawFrame);
  };

  const onVis = () => {
    if (!dead && !reduced && !document.hidden && !raf) raf = requestAnimationFrame(drawFrame);
    if (document.hidden && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
  document.addEventListener('visibilitychange', onVis);
  drawFrame();

  return () => {
    dead = true;
    if (raf) cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', onVis);
  };
}

export interface HeroCampOpts {
  stage: HTMLElement;
  fx: FX;
  initialDiff: Diff;
  unlockedCount: number;
  onBack: () => void;
  onStart: (diff: Diff, hero: HeroId) => void;
}

export function heroCampScreen(opts: HeroCampOpts): { el: HTMLElement; dispose: () => void } {
  const { stage, fx, unlockedCount, onBack, onStart } = opts;
  let diff: Diff = opts.initialDiff;
  let activeIdx = 0;
  let lastUnlockedIdx = 0;
  let launching = false;
  const poseAnim: { current: Animation | null } = { current: null };

  const isUnlocked = (idx: number) => idx < unlockedCount;
  const activeHero = (): HeroDef => HEROES[activeIdx];
  const themeOf = (id: HeroId) => HERO_THEMES[id];

  const canvas = h('canvas', { class: 'hc-canvas', 'aria-hidden': 'true' });
  const canvasState = {
    rgb: [...themeOf(HEROES[0].id).rgb] as [number, number, number],
    particle: themeOf(HEROES[0].id).particle,
    diff,
  };

  // ── 顶栏：返回 + 标题 + 三档难度战旗 ──
  const backBtn = h('button', { class: 'hc-back', type: 'button' },
    h('span', { class: 'hc-back-arrow', 'aria-hidden': 'true' }, '←'),
    h('span', null, '返回'));
  backBtn.addEventListener('click', () => {
    if (launching) return;
    sfx.click();
    onBack();
  });

  const heading = h('div', { class: 'hc-heading' },
    h('span', { class: 'hc-kicker' }, '出征营地'),
    unlockedCount < HEROES.length
      ? h('span', { class: 'hc-unlock-meta' }, `已解锁 ${unlockedCount}/${HEROES.length} 位英雄 · 完成对局逐步开放`)
      : h('span', { class: 'hc-unlock-meta' }, '全英雄已集结 · 选择统帅与难度'));

  const diffDesc = h('p', { class: 'hc-diff-desc' }, DIFFS[diff].desc);
  const diffBtns = DIFFS.map((d, i) => {
    const b = h('button', {
      class: `hc-diff-tab d${i}${i === diff ? ' on' : ''}`,
      type: 'button',
      'aria-pressed': String(i === diff),
    },
      h('b', null, d.name),
      h('span', { class: 'hc-hearts', 'aria-label': `${d.lives} 颗心` },
        ...Array.from({ length: d.lives }, (_, k) => h('span', {
          class: 'life on',
          'aria-hidden': 'true',
          style: `animation-delay:${k * 45}ms`,
        }))));
    b.addEventListener('click', () => {
      if (launching || diff === i) return;
      selectDiff(i as Diff);
    });
    return b;
  });

  // ── 中部左侧：巨型英雄展示祭坛 ──
  const watermark = h('div', { class: 'hc-watermark', 'aria-hidden': 'true' });
  const figure = h('button', { class: 'hc-hero-figure', type: 'button', 'aria-label': '演示英雄动作' });
  const lockSeal = h('div', { class: 'hc-lock-seal hidden' });
  const pokeHint = h('div', { class: 'hc-poke-hint', 'aria-hidden': 'true' }, '点击英雄演示动作');

  const stageBox = h('div', { class: 'hc-stage' },
    h('div', { class: 'hc-banner-slash', 'aria-hidden': 'true' }),
    watermark,
    h('div', { class: 'hc-altar', 'aria-hidden': 'true' },
      h('div', { class: 'hc-altar-ring' }),
      h('div', { class: 'hc-altar-slab' })),
    figure,
    lockSeal,
    pokeHint);

  // ── 中部右侧：开放式英雄档案（无外框、无灰药丸） ──
  const roleText = h('span', { class: 'hc-role-text' });
  const heroName = h('h1', { class: 'hc-name' });
  const abilityMeta = h('div', { class: 'hc-ability-meta' });
  const abilityText = h('p', { class: 'hc-ability-text' });
  const abilityTip = h('p', { class: 'hc-ability-tip' });

  const goBtn = h('button', { class: 'btn primary hc-go', type: 'button' }, h('span', null, '开始远征'), icon('play'));
  const pickUnlockedBtn = h('button', { class: 'btn ghost hc-pick-unlocked hidden', type: 'button' }, h('span', null, '切回可用英雄'));
  pickUnlockedBtn.addEventListener('click', () => {
    if (launching) return;
    selectHero(lastUnlockedIdx, true);
  });

  const dossier = h('div', { class: 'hc-dossier' },
    h('div', { class: 'hc-role-row' }, h('span', { class: 'hc-role-bar', 'aria-hidden': 'true' }), roleText),
    heroName,
    h('div', { class: 'hc-ability' }, abilityMeta, abilityText, abilityTip),
    h('div', { class: 'hc-cta-row' }, goBtn, pickUnlockedBtn));

  // ── 底部：6 位全阵容英雄栏 ──
  const slotBtns = HEROES.map((hd, idx) => {
    const th = themeOf(hd.id);
    const locked = !isUnlocked(idx);
    const b = h('button', {
      class: `hc-slot${idx === activeIdx ? ' on' : ''}${locked ? ' is-locked' : ''}`,
      type: 'button',
      style: `--slot-accent:${th.accent}`,
      'aria-pressed': String(idx === activeIdx),
      'aria-label': locked ? `${hd.name}（${unlockGoal(idx)}）` : hd.name,
    },
      h('span', { class: 'hc-slot-art', html: unitSvg(hd.art) }),
      h('span', { class: 'hc-slot-name' },
        locked ? null : h('i', { class: 'hc-slot-dot', 'aria-hidden': 'true' }),
        h('span', null, hd.name)),
      locked ? icon('lock', 'hc-slot-lock') : null);
    b.addEventListener('click', () => {
      if (launching) return;
      if (idx === activeIdx) {
        triggerHeroFlourish();
        return;
      }
      selectHero(idx, true);
    });
    return b;
  });

  const root = h('section', { class: `screen hero-camp diff-${diff}`, 'aria-label': '出征营地' },
    canvas,
    h('div', { class: 'hc-horizon', 'aria-hidden': 'true' }),
    h('header', { class: 'hc-top' },
      h('div', { class: 'hc-top-left' }, backBtn, heading),
      h('div', { class: 'hc-diff-wrap' },
        h('div', { class: 'hc-diff-bar', role: 'group', 'aria-label': '选择难度' }, ...diffBtns),
        diffDesc)),
    h('div', { class: 'hc-main' }, stageBox, dossier),
    h('footer', { class: 'hc-roster-wrap' },
      h('div', { class: 'hc-roster', role: 'group', 'aria-label': '选择英雄' }, ...slotBtns)));

  /** 计算舞台坐标系下大号英雄的中心点，保证不同分辨率下 FX 精准落在祭坛上 */
  const heroStagePoint = () => {
    const sr = stage.getBoundingClientRect();
    const fr = figure.getBoundingClientRect();
    if (!sr.width || !fr.width) return { x: 336, y: 378 };
    const sc = stageState.scale || (sr.width / 1280);
    return {
      x: (fr.left + fr.width / 2 - sr.left) / sc,
      y: (fr.top + fr.height * 0.56 - sr.top) / sc,
    };
  };

  const triggerHeroFlourish = () => {
    const hd = activeHero();
    const th = themeOf(hd.id);
    const unlocked = isUnlocked(activeIdx);
    const pt = heroStagePoint();
    if (!unlocked) {
      sfx.chain();
      fx.ring(pt.x, pt.y - 10, '#a896dc', 84, 24);
      figure.animate([
        { transform: 'translateX(0)' },
        { transform: 'translateX(-8px)', offset: 0.25 },
        { transform: 'translateX(8px)', offset: 0.6 },
        { transform: 'translateX(0)' },
      ], { duration: 260, easing: 'ease-out' });
      return;
    }
    sfx.pick();
    playHeroPose(figure, th.accent, poseAnim, 680);
    th.fx(fx, pt.x, pt.y);
  };

  figure.addEventListener('click', () => {
    if (launching) return;
    triggerHeroFlourish();
  });

  const selectDiff = (next: Diff) => {
    diff = next;
    canvasState.diff = next;
    root.classList.remove('diff-0', 'diff-1', 'diff-2');
    root.classList.add(`diff-${next}`);
    diffBtns.forEach((btn, j) => {
      btn.classList.toggle('on', j === next);
      btn.setAttribute('aria-pressed', String(j === next));
    });
    diffDesc.textContent = DIFFS[next].desc;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      diffDesc.animate([{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 200, easing: 'ease-out' });
    }
    if (next === 2) {
      sfx.hit(false);
      fx.shake(4, 180);
      const pt = heroStagePoint();
      fx.wave(pt.x, pt.y + 66, '#ff5978', 260, 420);
    } else {
      sfx.click();
    }
  };

  const renderHero = (idx: number, withFx: boolean) => {
    activeIdx = idx;
    const hd = HEROES[idx];
    const th = themeOf(hd.id);
    const unlocked = isUnlocked(idx);
    if (unlocked) lastUnlockedIdx = idx;

    // 同步全局主题 CSS 变量 & 粒子画布配色
    root.style.setProperty('--hc-accent', th.accent);
    root.style.setProperty('--hc-glow', th.glow);
    root.style.setProperty('--hc-bg', th.bg);
    canvasState.rgb = [...th.rgb];
    canvasState.particle = th.particle;

    // 更新底部槽位高亮
    slotBtns.forEach((btn, j) => {
      btn.classList.toggle('on', j === idx);
      btn.setAttribute('aria-pressed', String(j === idx));
    });

    // 更新舞台主形象
    watermark.textContent = th.mark;
    figure.classList.toggle('is-locked', !unlocked);
    figure.innerHTML = unitSvg(hd.art);
    lockSeal.classList.toggle('hidden', unlocked);
    pokeHint.classList.toggle('hidden', !unlocked);
    if (!unlocked) {
      lockSeal.replaceChildren(icon('lock'), h('span', null, unlockGoal(idx)));
    }

    // 更新右侧开放档案
    roleText.textContent = unlocked ? th.role : `${th.role} · 未解锁`;
    heroName.textContent = hd.name;
    if (hd.cost) {
      abilityMeta.replaceChildren(
        itemIcon('coin', 'coin', 'sm'),
        h('span', { class: 'hc-cost-val' }, `${hd.cost} 金 / 回合`),
        h('span', { class: 'hc-skill-kind' }, '· 主动技能'));
    } else {
      abilityMeta.replaceChildren(
        icon('sparkle'),
        h('span', { class: 'hc-skill-kind passive' }, '常驻被动 · 自动生效'));
    }
    abilityText.replaceChildren(...kwRich(hd.text));
    abilityTip.textContent = unlocked ? th.tip : `解锁条件：${unlockGoal(idx)}。当前可提前预览能力，切回已解锁英雄即可出征。`;

    // 更新出征 CTA
    goBtn.disabled = !unlocked;
    if (unlocked) {
      goBtn.replaceChildren(h('span', null, '开始远征'), icon('play'));
      pickUnlockedBtn.classList.add('hidden');
    } else {
      goBtn.replaceChildren(icon('lock'), h('span', null, unlockGoal(idx)));
      pickUnlockedBtn.classList.remove('hidden');
    }

    // 入场错峰文字动效 + 英雄动作特效
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) {
      watermark.animate([
        { opacity: 0, transform: 'translateX(-28px)' },
        { opacity: 0.09, transform: 'translateX(0)' },
      ], { duration: 360, easing: 'cubic-bezier(.2,.9,.3,1)' });
      dossier.animate([
        { opacity: 0, transform: 'translateX(18px)' },
        { opacity: 1, transform: 'translateX(0)' },
      ], { duration: 260, easing: 'cubic-bezier(.2,.9,.3,1)' });
    }
    if (withFx) triggerHeroFlourish();
  };

  const selectHero = (idx: number, withFx: boolean) => {
    renderHero(idx, withFx);
  };

  // 点击「开始远征」：播一次出发蓄力/挥砍 + 金色光柱震屏演出，再进入对局
  let launchTimer = 0;
  const doLaunch = () => {
    if (launching || !isUnlocked(activeIdx)) return;
    launching = true;
    goBtn.disabled = true;
    const hd = activeHero();
    const th = themeOf(hd.id);
    sfx.start();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      onStart(diff, hd.id);
      return;
    }
    const pt = heroStagePoint();
    playHeroPose(figure, '#ffe078', poseAnim, 520);
    fx.pillar(pt.x, pt.y + 72, '#ffd466', 360, 480);
    fx.wave(pt.x, pt.y + 66, th.accent, 320, 420);
    fx.burst(pt.x, pt.y - 16, '#ffe588', { n: 32, speed: 7.4, kind: 'spark', size: 4, up: 3, life: 34 });
    fx.shake(5, 220);
    launchTimer = window.setTimeout(() => onStart(diff, hd.id), 340);
  };
  goBtn.addEventListener('click', doLaunch);

  // 键盘快捷操控：左右切英雄、1/2/3 切难度、Enter 出征、Esc 返回
  const onKey = (e: KeyboardEvent) => {
    if (launching || document.querySelector('.modal')) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      selectHero((activeIdx + HEROES.length - 1) % HEROES.length, true);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      selectHero((activeIdx + 1) % HEROES.length, true);
    } else if (e.key === '1' || e.key === '2' || e.key === '3') {
      selectDiff((Number(e.key) - 1) as Diff);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      doLaunch();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      sfx.click();
      onBack();
    }
  };
  window.addEventListener('keydown', onKey);

  // 首次渲染（挂载到 DOM 后补一次首屏入场光效）
  renderHero(0, false);
  const stopCanvas = startCampCanvas(canvas, canvasState);
  const introTimer = window.setTimeout(() => {
    if (!launching && root.isConnected) triggerHeroFlourish();
  }, 160);

  return {
    el: root,
    dispose: () => {
      if (introTimer) clearTimeout(introTimer);
      if (launchTimer) clearTimeout(launchTimer);
      poseAnim.current?.cancel();
      window.removeEventListener('keydown', onKey);
      stopCanvas();
    },
  };
}
