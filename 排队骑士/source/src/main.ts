import './fonts/fonts.css';
import './qb/css/style.css';
import './qb/css/pixel.css';
import './qb/css/duelyst-units.css';
import './qb/css/expansion.css';
import './qb/css/v07.css';
import './qb/css/boss-rules.css';
import './qb/css/ui-audit.css';
import './qb/css/art-pass.css';
import './qb/css/prep-main.css';
import './qb/css/ui-review.css';
import './qb/css/compact.css';
import './qb/css/card-tiers.css';
import './qb/css/cultivate-fx.css';
import './qb/css/command.css';
import './qb/css/mech-fx.css';
import './ui/pdqs.css';
import './qb/css/battle-report.css';
import { CARDS } from './core/data';
import { App } from './ui/app';
import { installPixelSprites } from './qb/pixel';
import { installItemSprites } from './qb/pixelItems';
import { rasterize } from './qb/unitArt';
import { COMPACT_H, STAGE_H, STAGE_W, setStageH, stageState } from './qb/dom';
import { setUnitY } from './qb/board';

installPixelSprites();
installItemSprites();
const stage = document.getElementById('stage')!;
const app = new App(stage);

function fit() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // 短屏横屏（高 ≤ 450）：逻辑高度压到 640，字和单位放大约 12%
  const compact = vh <= 450 && vw > vh;
  if (compact !== stage.classList.contains('compact')) {
    stage.classList.toggle('compact', compact);
    setStageH(compact ? COMPACT_H : 720);
    setUnitY(compact ? 240 : 300, stage);
  }
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

const warm = CARDS.map((c) => rasterize(c.id));
Promise.race([Promise.allSettled(warm), new Promise((r) => setTimeout(r, 1500))]).then(() => app.toTitle());

if (location.search.includes('debug')) (window as unknown as { __app: App }).__app = app;
