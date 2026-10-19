import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = new URL('../../output/arrow-hybrid-check/', import.meta.url);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
try {
  for (const [width, height, touch, reducedMotion] of [[568, 320, true, 'no-preference'], [844, 390, true, 'no-preference'], [1280, 720, false, 'no-preference'], [667, 375, true, 'reduce']]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, reducedMotion });
    await context.addInitScript(() => localStorage.setItem('zl_coach', 'drag,preview,hint'));
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:8766/source/dist/?debug');
    const start = page.getByRole('button', { name: '开始远征', exact: true });
    if (touch) { await start.tap(); await page.locator('.gen-card').first().tap(); }
    else { await start.click(); await page.locator('.gen-card').first().click(); }
    await page.locator('.stage-intro').waitFor({ state: 'attached' });
    await page.locator('.stage-intro').waitFor({ state: 'detached' });
    await page.evaluate(() => {
      const g = window.__app.game;
      g.run.slots = ['l_shield', 'l_priest', 'l_martyr', 'n_echo', 'n_obelisk'].map(defId => ({ defId, level: 1 }));
      g.renderAll(false);
    });
    const inspectUnit = async slot => {
      await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => Number.isFinite(a.effect?.getTiming().iterations)).map(a => a.finished)); });
      const b = await page.locator(`.unit.side-0[data-slot="${slot}"]`).boundingBox();
      if (touch) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      else await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      try { await page.locator('.tip.on').waitFor({ timeout: 3000 }); }
      catch (e) { await page.screenshot({ path: fileURLToPath(new URL(`${width}-failed-input.png`, out)) }); console.log(await page.evaluate(({ b }) => ({ at: document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.outerHTML, mode: window.__app.game.mode, drag: window.__app.game.drag, focus: window.__app.game.focus, pointer: matchMedia('(pointer: coarse)').matches }), { b })); throw e; }
      await page.waitForTimeout(450);
    };
    const clearFocus = async () => {
      const b = await page.locator('#stage').boundingBox();
      const x = b.x + b.width * 20 / 1280, y = b.y + b.height * 400 / 720;
      if (touch) await page.touchscreen.tap(x, y); else await page.mouse.move(x, y);
    };
    await inspectUnit(1);
    assert.equal(await page.locator('.tip.on .tip-name').innerText(), '圣光牧师');
    const flows = page.locator('.direction-flow .arw-flow');
    assert.ok(await flows.count() >= 2);
    const read = () => flows.evaluateAll(nodes => nodes.map(e => {
      const s = getComputedStyle(e), length = e.getTotalLength(), start = e.getPointAtLength(0), end = e.getPointAtLength(length);
      return { length, start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y }, stroke: s.stroke, fill: s.fill, width: s.strokeWidth, dash: s.strokeDasharray, offset: s.strokeDashoffset, animation: s.animationName, playState: s.animationPlayState };
    }));
    const before = await read();
    const tapers = await flows.evaluateAll(nodes => nodes.map(e => {
      const clip = e.getAttribute('clip-path');
      const shape = document.getElementById(clip.slice(5, -1)).querySelector('path');
      const length = e.getTotalLength();
      const section = t => {
        const p = e.getPointAtLength(length * t), a = e.getPointAtLength(length * t - 1), b = e.getPointAtLength(length * t + 1);
        const n = Math.hypot(b.x - a.x, b.y - a.y);
        let width = 0;
        for (let d = -15; d <= 15; d += .25) if (shape.isPointInFill(new DOMPoint(p.x - (b.y - a.y) / n * d, p.y + (b.x - a.x) / n * d))) width += .25;
        return width;
      };
      return { tail: section(.15), neck: section(.85) };
    }));
    assert.ok(tapers.every(t => t.tail >= 2 && t.neck > t.tail + 3), 'Rendered clipping must widen toward the head');
    assert.equal(new Set(before.map(f => f.stroke)).size, 1, 'Relationship lines share one restrained color');
    await page.screenshot({ path: fileURLToPath(new URL(`${width}-buff-a.png`, out)) });
    await page.waitForTimeout(180);
    const after = await read();
    await page.screenshot({ path: fileURLToPath(new URL(`${width}-buff-b.png`, out)) });
    for (let i = 0; i < before.length; i++) {
      const f = before[i];
      assert.ok(f.length > 30 && Number.parseFloat(f.width) >= 5);
      assert.equal(f.fill, 'none'); assert.notEqual(f.stroke, 'none'); assert.notEqual(f.dash, 'none');
      if (reducedMotion === 'reduce') { assert.equal(f.animation, 'none'); assert.equal(after[i].offset, f.offset); }
      else { assert.notEqual(f.animation, 'none'); assert.notEqual(after[i].offset, f.offset); }
    }
    const heads = await page.locator('.direction-flow .arw-head').evaluateAll(nodes => nodes.map(e => ({ fill: getComputedStyle(e).fill, width: e.getBBox().width, height: e.getBBox().height })));
    assert.equal(heads.length, before.length); assert.ok(heads.every(h => h.fill !== 'none' && h.width > 5 && h.height > 5));
    // Existing pause contract must also stop the new directional flow.
    await page.locator('.game').evaluate(e => e.setAttribute('data-render-paused', ''));
    const paused = await read(); assert.ok(paused.every(f => f.playState === 'paused' || f.animation === 'none'));
    await page.locator('.game').evaluate(e => e.removeAttribute('data-render-paused'));
    await clearFocus();
    await page.evaluate(() => {
      const g = window.__app.game;
      g.run.general = 'kaleos';
      g.run.slots = [{ defId: 'l_shield', level: 1 }, null, null, null, { defId: 'l_priest', level: 1 }];
      g.renderAll(false);
    });
    await inspectUnit(0);
    const swaps = page.locator('.arw-kind-swap .arw-flow');
    assert.equal(await swaps.count(), 2);
    const swapDirections = await swaps.evaluateAll(nodes => nodes.map(e => { const s = e.getPointAtLength(0), t = e.getPointAtLength(e.getTotalLength()); return { dx: t.x - s.x, y: e.getPointAtLength(e.getTotalLength() / 2).y }; }));
    assert.ok(swapDirections[0].dx * swapDirections[1].dx < 0);
    assert.ok(Math.abs(swapDirections[0].y - swapDirections[1].y) > 10);
    await page.screenshot({ path: fileURLToPath(new URL(`${width}-swap.png`, out)) });
    await clearFocus();
    await page.evaluate(() => { const g = window.__app.game; g.run.slots = [{ defId: 'l_shield', level: 1 }, { defId: 'l_priest', level: 1 }, null, null, null]; g.renderAll(false); });
    await inspectUnit(0);
    if (!touch) { const b = await page.locator('.unit.side-0[data-slot="0"]').boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); }
    assert.equal(await page.locator('.arw-kind-swap .arw-flow').count(), 2);
    await page.screenshot({ path: fileURLToPath(new URL(`${width}-short-swap.png`, out)) });
    assert.doesNotMatch(await page.locator('.arrow-labels').innerText(), /将军/);
    assert.equal(await page.locator('.direction-flow clipPath').count(), await flows.count(), 'Only the current arrows retain clipping resources');
    const empty = page.locator('.slot.side-0[data-slot="4"]');
    const hint = await empty.evaluate(e => { const p = getComputedStyle(e, '::after'); return { text: p.content, top: parseFloat(p.top), number: getComputedStyle(e.querySelector('.slot-num')).visibility, pointer: p.pointerEvents }; });
    assert.ok(['none', 'normal', '""'].includes(hint.text)); assert.notEqual(hint.number, 'hidden'); assert.equal(hint.pointer, 'none');
    const eb = await empty.boundingBox();
    if (touch) await page.touchscreen.tap(eb.x + eb.width / 2, eb.y); else await page.mouse.click(eb.x + eb.width / 2, eb.y);
    assert.equal(await page.evaluate(() => window.__app.game.run.slots[4]?.defId), 'l_shield');
    assert.equal(await page.evaluate(() => window.__app.game.run.slots[0]), null);
    assert.notEqual(await empty.evaluate(e => getComputedStyle(e.querySelector('.slot-num')).visibility), 'hidden');
    await page.screenshot({ path: fileURLToPath(new URL(`${width}-moved.png`, out)) });
    await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => Number.isFinite(a.effect?.getTiming().iterations)).map(a => a.finished)); });
    const ub = await page.locator('.unit.side-0[data-slot="4"]').boundingBox(), target = await page.locator('.slot.side-0[data-slot="3"]').boundingBox();
    await page.mouse.move(ub.x + ub.width / 2, ub.y + ub.height / 2); await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y, { steps: 12 }); await page.mouse.up();
    assert.equal(await page.evaluate(() => window.__app.game.run.slots[3]?.defId), 'l_shield');
    await page.locator('.tray .fight').click();
    await page.waitForFunction(() => window.__app.game.mode === 'battle');
    assert.equal(await flows.count(), 0);
    assert.equal(await page.locator('.direction-flow clipPath').count(), 0);
    assert.deepEqual(errors, []);
    report.push({ width, height, touch, reducedMotion, before, after, tapers, heads, swapDirections, errors });
    await context.close();
  }
  writeFileSync(new URL('report.json', out), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.map(({ width, reducedMotion, errors }) => ({ width, reducedMotion, errors }))));
} finally { await browser.close(); }
