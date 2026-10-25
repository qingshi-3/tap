// 图鉴实机演示：用真实引擎模拟一场配置好的小战斗，再用实战的 BattlePlayer 播放。
// 只截取「目标效果出现」前后几次交锋，静音循环；命中时暂停 → 镜头推近 → 框选 + 气泡 → 慢放 → 拉回。
import { demoOutput, focusUid, type DemoSpec } from '../core/demo';
import type { Ev } from '../core/engine';
import { Board, slotX, UNIT_Y } from '../qb/board';
import '../qb/css/battle-demo.css';
import { h } from '../qb/dom';
import { FX } from '../qb/fx';
import { BattlePlayer } from './battle';

const ZOOM_MAX = 1.35, PUSH_MS = 360, PULL_MS = 520;

export function battleDemo(spec: DemoSpec, label: string) {
  const n = Math.max(2, spec.me.length, spec.foe.length);
  const x0 = slotX(0, n - 1) - 80, x1 = slotX(1, n - 1) + 80;
  const y0 = UNIT_Y - 165, y1 = UNIT_Y + 92;
  const stage = h('div', { class: 'bdemo-stage' });
  const cam = h('div', { class: 'bdemo-cam' }, stage);
  const replay = h('button', { class: 'bdemo-replay', 'aria-label': '重播' }, '↻');
  const el = h('div', { class: 'bdemo', style: `aspect-ratio:${x1 - x0}/${y1 - y0}` }, cam, replay);
  const home = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: 1 };
  let shot = { ...home };
  const base = () => (el.clientWidth || 540) / (x1 - x0);
  const camTransform = (v: typeof shot) => {
    const b = base(), s = b * v.z;
    return `translate(${(x1 - x0) * b / 2 - v.x * s}px,${(y1 - y0) * b / 2 - v.y * s}px) scale(${s})`;
  };
  const fit = () => { shot = { ...home }; cam.getAnimations().forEach((a) => a.cancel()); cam.style.transform = camTransform(shot); };
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const camera = (host: HTMLElement | null) => {
    let next = home;
    if (host && !host.classList.contains('vs')) {
      // 取景：框 + 头顶气泡，四周留白；倍数取装得下的最大值
      const s = base() * shot.z, sr = stage.getBoundingClientRect(), r = host.getBoundingClientRect();
      const tag = host.querySelector<HTMLElement>('.bdemo-tag');
      const tw = tag?.offsetWidth ?? 0, th = (tag?.offsetHeight ?? 0) + 36;
      const cx = (r.left + r.width / 2 - sr.left) / s;
      const top = (r.top - sr.top) / s - 22 - th, bot = (r.bottom - sr.top) / s + 22;
      const w = Math.max(r.width / s + 44, tw) + 56, hgt = bot - top + 40;
      const z = Math.max(1, Math.min(ZOOM_MAX, (x1 - x0) / w, (y1 - y0) / hgt));
      const hw = (x1 - x0) / z / 2, hh = (y1 - y0) / z / 2, cy = (top + bot) / 2;
      next = { x: Math.max(x0 + hw, Math.min(x1 - hw, cx)), y: Math.max(y0 + hh, Math.min(y1 - hh, cy)), z };
    }
    const from = camTransform(shot), to = camTransform(next);
    shot = next;
    cam.style.transform = to;
    if (!reduced()) cam.animate([{ transform: from }, { transform: to }], { duration: next === home ? PULL_MS : PUSH_MS, easing: 'cubic-bezier(.3,.7,.2,1)' });
  };
  // 布局晚于首帧时 clientWidth 会变：按当前镜头重算一次
  const ro = new ResizeObserver(() => { cam.getAnimations().forEach((a) => a.cancel()); cam.style.transform = camTransform(shot); });
  ro.observe(el);
  const board = new Board();
  stage.append(board.el);
  const fx = new FX(stage, stage);
  const { out, at } = demoOutput(spec);
  let pb: BattlePlayer | null = null;
  let stopped = false;
  let restart = false;
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const spotlight = async (p: BattlePlayer, ev: Ev) => {
    const uid = spec.focus === 'clash' ? null : focusUid(ev);
    const unit = uid != null ? board.view(`u${uid}`)?.el : null;
    const host = (unit?.isConnected ? unit : null) ?? board.center;
    const box = h('div', { class: 'bdemo-focus' });
    const tag = h('div', { class: 'bdemo-tag' }, `「${label}」`);
    host.append(box, tag);
    el.classList.add('spot');
    camera(host);
    // 镜头到位后把气泡推回画面内（边上的单位镜头平移不过去）
    setTimeout(() => {
      const er = el.getBoundingClientRect(), tr = tag.getBoundingClientRect(), pad = 8;
      const dx = Math.max(0, er.left + pad - tr.left) - Math.max(0, tr.right - (er.right - pad));
      if (dx) tag.style.translate = `${dx / (base() * shot.z)}px 0`;
    }, reduced() ? 0 : PUSH_MS + 20);
    fx.setPaused(true);
    await sleep(1300);
    if (stopped) return;
    fx.setPaused(false);
    p.rate = 0.45;
    box.classList.add('out');
    setTimeout(() => { p.rate = 1; tag.classList.add('out'); el.classList.remove('spot'); camera(null); }, 1300);
    setTimeout(() => { box.remove(); tag.remove(); }, 1700);
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    pb?.stop();
    fx.dispose();
    clearInterval(watch);
    ro.disconnect();
  };
  // 被 replaceChildren 移走后停播释放
  let seen = false;
  const watch = setInterval(() => {
    if (el.isConnected) seen = true;
    else if (seen) stop();
  }, 400);
  replay.addEventListener('click', () => { restart = true; pb?.stop(); });
  void (async () => {
    await sleep(60);
    while (!stopped) {
      restart = false;
      fit();
      fx.clear();
      const p = new BattlePlayer(board, fx, null);
      pb = p;
      if (at >= 0) p.hook = (ev, i) => (i === at ? spotlight(p, ev) : undefined);
      await p.play(out);
      if (stopped) break;
      el.querySelectorAll('.bdemo-focus, .bdemo-tag').forEach((x) => x.remove());
      el.classList.remove('spot');
      if (!restart) await sleep(1600);
    }
  })();
  return el;
}
