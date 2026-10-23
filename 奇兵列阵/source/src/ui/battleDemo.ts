// 图鉴实机演示：用真实引擎 simulate 一场配置好的小战斗，再用实战的 Playback 播放。
// 只截取「目标效果出现」前后的几次交锋，静音循环；节点被移出页面后自动停止。
import { demoOutput, type DemoSpec } from '../core/demo';
import { Board, slotX } from './board';
import { h } from './dom';
import { FX } from './fx';
import { Playback } from './playback';
import '../battle-demo.css';

/** 演示视窗：1280×720 的战斗舞台按实际出场人数裁出中间一段，按容器宽度缩放 */
export function battleDemo(spec: DemoSpec) {
  const n = Math.max(2, spec.me.length, spec.foe.length);
  const x0 = slotX(0, n - 1) - 96, x1 = slotX(1, n - 1) + 96;
  const y0 = 128, y1 = 430;
  // 裁切缩放放在外层；内层是震屏目标（震屏会改写 transform）
  const stage = h('div', { class: 'bdemo-stage' });
  const cam = h('div', { class: 'bdemo-cam' }, stage);
  const replay = h('button', { class: 'bdemo-replay', 'aria-label': '重播' }, '↻');
  const el = h('div', { class: 'bdemo', style: `aspect-ratio:${x1 - x0}/${y1 - y0}` }, cam, replay);
  const fit = () => {
    const scale = (el.clientWidth || 540) / (x1 - x0);
    cam.style.transform = `translate(${-x0 * scale}px,${-y0 * scale}px) scale(${scale})`;
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
      await pb.play();
      if (stopped) break;
      if (!restart) await sleep(1600);
    }
  })();
  return el;
}
