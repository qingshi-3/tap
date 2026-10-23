// 图鉴实机演示：用真实引擎 simulate 一场配置好的小战斗，再用实战的 Playback 播放。
// 只截取「目标效果出现」前后的几次交锋，静音循环；节点被移出页面后自动停止。
import { demoOutput, type DemoSpec } from '../core/demo';
import type { BattleEvent, Snap } from '../core/types';
import { Board, slotX } from './board';
import { h } from './dom';
import { FX } from './fx';
import { Playback } from './playback';
import '../battle-demo.css';

/** 演示视窗：1280×720 的战斗舞台按实际出场人数裁出中间一段，按容器宽度缩放 */
/** 目标事件落在哪个单位上；交锋 / 回合这类没有单位的返回 null（看中线的「回合 · 交锋 m/n」） */
function focusUid(ev: BattleEvent, snap: Snap): number | null {
  const mine = (uid?: number) => snap.find(u => u.uid === uid)?.side === 0;
  switch (ev.t) {
    case 'trigger': case 'sacrifice': case 'fizzle': return ev.src;
    case 'dmg': case 'death': case 'heal': case 'buff': return ev.tgt;
    case 'taunt': return ev.to;
    case 'attack': return (ev.pairs.find(p => mine(p.atk)) ?? ev.pairs[0])?.atk ?? null;
    case 'move': return (ev.moves.find(m => mine(m.uid)) ?? ev.moves[0])?.uid ?? null;
    case 'gen': return ev.tgts[0] ?? null;
    case 'rule': return ev.src ?? null;
    case 'act': case 'block': case 'blockBroken': case 'chill': case 'burn': case 'charge': case 'frozenSkip':
    case 'actionGain': case 'revive': case 'summon': case 'recall': case 'pull': return ev.uid;
    default: return null;
  }
}

/** 运镜参数：最大放大倍数、推近 / 拉回时长；实际倍数按「框 + 气泡」装得下算 */
const ZOOM_MAX = 1.3, PUSH_MS = 360, PULL_MS = 520;

/**
 * 命中目标效果时：播放暂停 → 镜头推近主角 → 框选 + 气泡写词条名 → 慢放这一拍 → 拉回全景。
 * 召唤 / 复生的单位要等这一拍播完才出现，所以放在事件之后框选。
 */
function spotlight(board: Board, pb: Playback, label: string, target: number | 'clash' | null, bubble: string | undefined, camera: (host: HTMLElement | null) => void) {
  const unit = typeof target === 'number' ? board.view(`u${target}`)?.el : null;
  const pips = target === 'clash' ? board.el.querySelector<HTMLElement>('.vs-pips.clash') : null;
  const host = (unit?.isConnected ? unit : null) ?? pips ?? board.el.querySelector<HTMLElement>('.vs');
  if (!host) return Promise.resolve();
  const box = h('div', { class: 'bdemo-focus' });
  const tag = h('div', { class: `bdemo-tag${bubble ? ' talk' : ''}${host === pips ? ' below' : ''}` }, bubble ?? `「${label}」`);
  host.append(box, tag);
  const demo = board.el.closest('.bdemo');
  demo?.classList.add('spot');
  camera(host);
  pb.setPaused(true);
  return new Promise<void>((done) => {
    setTimeout(() => {
      pb.setPaused(false);
      pb.speed = 0.45;
      box.classList.add('out');
      done();
      setTimeout(() => { pb.speed = 1; tag.classList.add('out'); demo?.classList.remove('spot'); camera(null); }, 1300);
      setTimeout(() => { box.remove(); tag.remove(); }, 1700);
    }, 1300);
  });
}

export function battleDemo(spec: DemoSpec, label?: string) {
  const n = Math.max(2, spec.me.length, spec.foe.length);
  const x0 = slotX(0, n - 1) - 96, x1 = slotX(1, n - 1) + 96;
  const y0 = 128, y1 = 430;
  // 裁切缩放放在外层；内层是震屏目标（震屏会改写 transform）
  const stage = h('div', { class: 'bdemo-stage' });
  const cam = h('div', { class: 'bdemo-cam' }, stage);
  const replay = h('button', { class: 'bdemo-replay', 'aria-label': '重播' }, '↻');
  const el = h('div', { class: 'bdemo', style: `aspect-ratio:${x1 - x0}/${y1 - y0}` }, cam, replay);
  // 镜头：以 (cx, cy) 为画面中心、z 倍放大；z=1 是裁好的全景
  const home = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: 1 };
  let shot = { ...home };
  const base = () => (el.clientWidth || 540) / (x1 - x0);
  const camTransform = (v: typeof shot) => {
    const b = base(), s = b * v.z;
    return `translate(${(x1 - x0) * b / 2 - v.x * s}px,${(y1 - y0) * b / 2 - v.y * s}px) scale(${s})`;
  };
  const fit = () => { shot = { ...home }; cam.getAnimations().forEach(a => a.cancel()); cam.style.transform = camTransform(shot); };
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const camera = (host: HTMLElement | null) => {
    let next = home;
    // 中线小框在全景里就看得清：稍拉远并下移给框下的气泡留位置
    if (host?.classList.contains('vs-pips')) next = { ...home, y: home.y + 44, z: 0.9 };
    else if (host) {
      // 取景：框（宿主外扩 22）并上头顶 / 脚下的气泡，四周再留 28；倍数取装得下的最大值，不超过 ZOOM_MAX
      const s = base() * shot.z, sr = stage.getBoundingClientRect(), r = host.getBoundingClientRect();
      const tag = host.querySelector<HTMLElement>('.bdemo-tag');
      const tw = tag?.offsetWidth ?? 0, th = (tag?.offsetHeight ?? 0) + 36;
      const cx = (r.left + r.width / 2 - sr.left) / s;
      let top = (r.top - sr.top) / s - 22, bot = (r.bottom - sr.top) / s + 22;
      top -= th;
      const w = Math.max(r.width / s + 44, tw) + 56, hgt = bot - top + 56;
      const z = Math.max(1, Math.min(ZOOM_MAX, (x1 - x0) / w, (y1 - y0) / hgt));
      const hw = (x1 - x0) / z / 2, hh = (y1 - y0) / z / 2, cy = (top + bot) / 2;
      next = { x: Math.max(x0 + hw, Math.min(x1 - hw, cx)), y: Math.max(y0 + hh - 40, Math.min(y1 - hh, cy)), z };
    }
    const from = camTransform(shot), to = camTransform(next);
    shot = next;
    cam.style.transform = to;
    if (!reduced()) cam.animate([{ transform: from }, { transform: to }], { duration: next === home ? PULL_MS : PUSH_MS, easing: 'cubic-bezier(.3,.7,.2,1)' });
  };
  const board = new Board();
  stage.append(board.el);
  const fx = new FX(stage, stage);
  const { out } = demoOutput(spec);
  let pb: Playback | null = null;
  let stopped = false;
  let restart = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    pb?.cancel();
    fx.dispose();
    clearInterval(watch);
  };
  // 被 replaceChildren 移走后停播释放
  let seen = false;
  const watch = setInterval(() => {
    if (el.isConnected) seen = true;
    else if (seen) stop();
  }, 400);
  replay.addEventListener('click', () => { restart = true; pb?.skip(); });
  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
  void (async () => {
    await sleep(60);
    while (!stopped) {
      restart = false;
      fit();
      fx.clear();
      board.clearArrows();
      pb = new Playback(board, fx, out);
      pb.silent = true;
      pb.banners = false;
      if (label) {
        const p = pb;
        let shown = false;
        const late = (ev: BattleEvent) => ev.t === 'summon' || ev.t === 'revive';
        const at = (after: boolean) => (ev: BattleEvent, snap: Snap) => {
          if (shown || late(ev) !== after || !spec.hit(ev, snap)) return;
          shown = true;
          return spotlight(board, p, label, spec.focus ? spec.focus(ev, snap) : focusUid(ev, snap), spec.bubble, camera);
        };
        pb.beforeStep = at(false);
        pb.afterStep = at(true);
      }
      await pb.play();
      if (stopped) break;
      if (!restart) await sleep(1600);
    }
  })();
  return el;
}
