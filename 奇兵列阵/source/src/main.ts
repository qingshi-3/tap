import './fonts/fonts.css';
import './style.css';
import './pixel.css';
import './duelyst-units.css';
import './expansion.css';
import './v07.css';
import { GENERALS, UNITS } from './core/data';
import { App } from './ui/app';
import { installPixelSprites } from './ui/pixel';
import { installItemSprites } from './ui/pixelItems';
import { rasterize } from './ui/unitArt';
import { STAGE_H, STAGE_W, stageState } from './ui/dom';

installPixelSprites();
installItemSprites();
const stage = document.getElementById('stage')!;
const app = new App(stage);

function fit() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scale = Math.min(vw / STAGE_W, vh / STAGE_H);
  const left = (vw - STAGE_W * scale) / 2;
  const top = (vh - STAGE_H * scale) / 2;
  stage.style.setProperty('--control-size', `${Math.max(64, 44 / scale)}px`);
  stage.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
  Object.assign(stageState, { scale, left, top });
  app.resize();
  document.body.classList.toggle('portrait', vh > vw * 1.1 && vw < 900);
}
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', () => setTimeout(fit, 200));
fit();

document.getElementById('rotate-hint')!.addEventListener('click', (e) => (e.currentTarget as HTMLElement).classList.add('dismissed'));
document.addEventListener('contextmenu', (e) => e.preventDefault());

// 预热原图；每个单位仅加载一次，不再生成几何或闭眼帧。
const warm = [
  ...GENERALS.map((g) => rasterize(null, { general: g.id })),
  ...UNITS.map((u) => rasterize(u.id)),
];
Promise.race([Promise.allSettled(warm), new Promise((r) => setTimeout(r, 1500))]).then(() => app.toTitle());

// 调试入口：?debug 时暴露 app，便于截图脚本直达指定关卡
if (location.search.includes('debug')) (window as unknown as { __app: App }).__app = app;

