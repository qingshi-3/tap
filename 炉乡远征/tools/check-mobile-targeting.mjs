import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Reuses the running preview; isolated page/storage, real atlas art and renderer.
const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const fixture = JSON.parse(await readFile('output/progression-playthrough/browser/input-probes/sand-03-occlusion-mapping.json', 'utf8'));
const output = 'output/mobile-interaction/targeting';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const reports = [];
try {
  for (const viewport of [{ width: 844, height: 390 }, { width: 667, height: 375 }, { width: 568, height: 320 }]) {
    const context = await browser.newContext({ viewport, hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.route('**/targeting-fixture', route => route.fulfill({ contentType: 'text/html', body: '<style>body{margin:0;background:#18232d}.battle-row{position:absolute;top:55px;height:calc(100vh - 215px);width:100vw}canvas{position:fixed;inset:0;width:100vw;height:100vh}@media(max-height:450px){.battle-row{top:49px;height:calc(100vh - 209px)}}@media(max-height:360px){.battle-row{top:44px;height:calc(100vh - 194px)}}</style><div class="battle-row"><canvas id="board"></canvas></div>' }));
    await page.goto(`${process.env.TARGETING_URL || 'http://127.0.0.1:4223'}/targeting-fixture`);
    const result = await page.evaluate(async fixture => {
      const { BoardRenderer } = await import('/js/renderer.js');
      const { createExpeditionMatch } = await import('/js/engine.js');
      const { getCard } = await import('/js/cards.js');
      const renderer = new BoardRenderer(document.querySelector('canvas'));
      const state = createExpeditionMatch('sand-03');
      state.units = fixture.nearbyUnits;
      await renderer.loadBattle(state);
      renderer.draw(state);
      const checks = [];
      const equal = (a, b) => a?.x === b?.x && a?.y === b?.y;
      const check = (name, actual, expected) => { checks.push({ name, actual, expected, pass: equal(actual, expected) }); };
      const hit = (p, options) => { const r = renderer.canvas.getBoundingClientRect(); return renderer.positionFromPointer({ clientX: r.left + p.x, clientY: r.top + p.y }, options); };
      const artCenter = unit => {
        const r = renderer.canvas.getBoundingClientRect(), m = renderer.boardMetrics(r.width, r.height), cell = renderer.cellGeometry(m, unit.x, unit.y);
        const card = getCard(unit.cardId), art = renderer.getSpriteArt(card), atlas = renderer.atlases.get(card.sprite.sheet);
        const frame = atlas.animations.breathing?.frames[0] ?? atlas.animations.idle.frames[0], scale = renderer.unitScale(cell, frame, card.type === 'general');
        return { x: cell.center.x + (unit.owner === 0 ? 1 : -1) * (art.x + art.width / 2 - art.image.width / 2) * scale,
          y: cell.center.y + cell.height * .145 - art.height * scale / 2 };
      };
      const samples = [];
      for (const pan of [{ x: 0, y: 0 }, fixture.camera]) {
        renderer.camera = { ...pan };
        const r = renderer.canvas.getBoundingClientRect(), metrics = renderer.boardMetrics(r.width, r.height);
        for (const unit of state.units) {
          const cell = renderer.cellGeometry(metrics, unit.x, unit.y), expected = { x: unit.x, y: unit.y };
          check(`unit-${unit.unitId}-center-pan-${pan.x}`, hit(cell.center), expected);
          check(`unit-${unit.unitId}-feet-pan-${pan.x}`, hit({ x: cell.center.x, y: cell.center.y + cell.height * .12 }), expected);
          // A distinct 44px square must work, not merely a thin exposed edge.
          let count = 0, hits = 0, pure = 0;
          // Pixel centers inside a 44px square; tile boundaries themselves
          // intentionally belong to only one of the adjacent cells.
          for (let dy = -21; dy <= 21; dy += 2) for (let dx = -21; dx <= 21; dx += 2) {
            const p = { x: cell.center.x + dx, y: cell.center.y + dy };
            count++; if (equal(hit(p), expected)) hits++;
            if (equal(hit(p, { preferUnits: false }), expected)) pure++;
          }
          samples.push({ unitId: unit.unitId, cardId: unit.cardId, pan, width: cell.width, height: cell.height, count, hits, pure, pass: hits === count && pure === count });
          check(`only-legal-unit-${unit.unitId}`, hit(cell.center, { unitIds: [unit.unitId] }), expected);
          check(`empty-filter-pure-unit-${unit.unitId}`, hit(cell.center, { unitIds: [] }), hit(cell.center, { preferUnits: false }));
        }
        for (let y = 0; y < metrics.rows; y++) for (let x = 0; x < metrics.columns; x++) {
          const cell = renderer.cellGeometry(metrics, x, y);
          check(`pure-tile-${x}-${y}-pan-${pan.x}`, hit(cell.center, { preferUnits: false }), { x, y });
        }
      }
      const target = state.units.find(unit => unit.unitId === fixture.target.unitId), general = state.units.find(unit => getCard(unit.cardId).type === 'general');
      // Sparse bodies extend into empty tiles and remain direct touch targets.
      for (const unit of [target, general]) {
        state.units = [unit];
        const p = artCenter(unit);
        check(`sparse-body-${unit.cardId}`, hit(p), unit);
        check(`sparse-body-pure-${unit.cardId}`, hit(p, { preferUnits: false }), hit(p, { unitIds: [] }));
      }
      state.units = fixture.nearbyUnits;
      // A non-candidate general covering the legal target must not intercept it.
      const targetBody = artCenter(target);
      check('filtered-overlap-body', hit(targetBody, { unitIds: [target.unitId] }), target);
      state.units = [];
      const r = renderer.canvas.getBoundingClientRect(), metrics = renderer.boardMetrics(r.width, r.height), empty = renderer.cellGeometry(metrics, 2, 2).center;
      check('empty-board-cell', hit(empty), { x: 2, y: 2 });
      check('outside-board', hit({ x: -100, y: -100 }), null);
      state.units = fixture.nearbyUnits;
      renderer.paint();
      // Mark the recovered rear target's tile for visual context.
      const cell = renderer.cellGeometry(metrics, target.x, target.y);
      renderer.context.strokeStyle = '#ffe19b'; renderer.context.lineWidth = 2;
      renderer.context.beginPath(); renderer.context.moveTo(cell.points[0].x, cell.points[0].y);
      for (const p of cell.points.slice(1)) renderer.context.lineTo(p.x, p.y);
      renderer.context.closePath(); renderer.context.stroke();
      return { checks, samples, originalTarget: fixture.target, originalExposedPointCount: fixture.targetPointCount };
    }, fixture);
    await page.screenshot({ path: `${output}/${viewport.width}x${viewport.height}.png` });
    reports.push({ viewport, ...result });
    assert.equal(result.checks.every(check => check.pass), true, JSON.stringify(result.checks.filter(check => !check.pass)));
    assert.equal(result.samples.every(sample => sample.pass), true, JSON.stringify(result.samples.filter(sample => !sample.pass)));
    await context.close();
  }
} finally {
  await writeFile(`${output}/geometry-results.json`, JSON.stringify({ method: 'isolated instantiated renderer with real sprite atlases; geometric calls, not UI interaction', reports }, null, 2));
  await browser.close();
}
console.log('Mobile targeting geometry passed: all three viewport sizes, tile/feet/body, filtering, 44px distinct regions, pure grid, camera translation.');

