import { createRequire } from 'node:module';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { ORDERS } from '../js/content.js';
import { inspect } from '../js/engine.js';

// Run through with-lock.mjs: resource rendering shares a workspace-wide lock
// with imports and packaging, while the browser owns only a disposable context.
const require = createRequire(process.env.PLAYWRIGHT_MODULE || 'C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const out = fileURLToPath(new URL('../output/store/', import.meta.url));
const order = ORDERS.find(o => o.id === 'o25');
assert.ok(inspect(order, order.solution).ready, 'Store composition must use a valid, unloadable authored layout');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const errors = [];
const specs = [
  { name: 'banner-1920x1080-v2.png', width: 1920, height: 1080, composition: 'banner' },
  { name: 'square-1440-v2.png', width: 1440, height: 1440, composition: 'square' },
];
try {
  const context = await browser.newContext({ viewport: { width: 960, height: 540 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.CARGO_PREVIEW_URL || 'http://127.0.0.1:4197/');
  const report = [];
  for (const spec of specs) {
    const result = await page.evaluate(async spec => {
      const { drawYard, drawTruck, drawCargo } = await import('/js/art.js');
      const { ORDERS } = await import('/js/content.js');
      const { cellsFor, truckFor, inspect } = await import('/js/engine.js');
      const order = ORDERS.find(o => o.id === 'o25');
      if (!inspect(order, order.solution).ready) throw Error('Invalid promotion layout');
      const font = new FontFace('StoreNoto', 'url(/assets/fonts/noto-sc-900.woff2)', { weight: '900' });
      await font.load(); document.fonts.add(font);
      // Author a fresh low-resolution scene for each requested size, then use
      // nearest-neighbor enlargement. No existing raster is modified or cropped.
      const scene = document.createElement('canvas');
      scene.width = spec.width / 2; scene.height = spec.height / 2;
      const g = scene.getContext('2d'); g.imageSmoothingEnabled = false;
      drawYard(g, scene.width, scene.height);
      const scale = spec.composition === 'square' ? scene.width / 256 : scene.width / 960;
      g.save(); g.scale(scale, scale);
      const truck = truckFor(order);
      const cell = spec.composition === 'square' ? 17 : 36;
      const x = spec.composition === 'square' ? 77 : 640;
      const y = spec.composition === 'square' ? 60 : 101;
      drawTruck(g, { x, y, cell, w: truck.w, h: truck.h, door: truck.door, obstacles: order.obstacles, progress: 0 });
      for (const cargo of order.cargo) {
        const p = order.solution[cargo.id], cells = cellsFor(cargo.type, p.r);
        const w = Math.max(...cells.map(p => p[0])) + 1, h = Math.max(...cells.map(p => p[1])) + 1;
        drawCargo(g, cargo.type, x + p.x * cell, y + p.y * cell, w * cell, h * cell, p.r, { cells });
      }
      function lettering(text, x, baseline, size, color) {
        g.font = `900 ${size}px StoreNoto, 'Microsoft YaHei', sans-serif`;
        g.textBaseline = 'alphabetic';
        // Solid stepped extrusion belongs to the title lettering itself; there
        // is no invented label, decorative panel, outline button or score badge.
        g.fillStyle = '#173f47';
        for (let step = 4; step > 0; step--) g.fillText(text, x + step, baseline + step);
        g.fillStyle = color; g.fillText(text, x, baseline);
      }
      if (spec.composition === 'square') {
        g.font = '900 32px StoreNoto';
        const titleWidth = g.measureText('装车收纳').width;
        lettering('装车收纳', Math.round((256 - titleWidth) / 2), 31, 32, '#f1e8c6');
      } else {
        lettering('装车收纳', 96, 224, 88, '#f1e8c6');
      }
      g.restore();
      const image = document.createElement('canvas'); image.width = spec.width; image.height = spec.height;
      const output = image.getContext('2d'); output.imageSmoothingEnabled = false;
      output.drawImage(scene, 0, 0, spec.width, spec.height);
      const cornerAlpha = [[0,0],[spec.width-1,0],[0,spec.height-1],[spec.width-1,spec.height-1]].map(([x,y]) => output.getImageData(x,y,1,1).data[3]);
      if (cornerAlpha.some(a => a !== 255)) throw Error('Media must be full-bleed and opaque');
      return { png: image.toDataURL('image/png').split(',')[1], cornerAlpha, cargoCount: order.cargo.length, layout: order.id };
    }, spec);
    const path = out + spec.name;
    await writeFile(path, Buffer.from(result.png, 'base64'));
    const { size } = await stat(path);
    assert.ok(size <= 4 * 1024 * 1024, `${spec.name} must be <=4 MiB`);
    report.push({ file: spec.name, width: spec.width, height: spec.height, bytes: size, layout: result.layout, cargoCount: result.cargoCount, opaqueCorners: result.cornerAlpha.every(a => a === 255) });
  }
  assert.deepEqual(errors, [], 'Renderer page errors');
  await writeFile(out + 'media-v2.json', JSON.stringify({ renderer: 'js/art.js', sourceOrder: order.id, validAuthoredLayout: true, title: '装车收纳', tagline: null, roundedCrop: false, media: report }, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  await context.close();
} finally { await browser.close(); }
