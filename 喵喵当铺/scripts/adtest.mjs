import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => {
  window.__log = [];
  let n = 0;
  window.tap = { createRewardedVideoAd(o) { n++; window.__log.push('create ' + o.adUnitId); let cb = [];
    return { load() { window.__log.push('load'); return Promise.resolve(); },
      show() { window.__log.push('show'); if (window.__failOnce) { window.__failOnce = false; return Promise.reject(new Error('not ready')); }
        setTimeout(() => cb.forEach((f) => f({ isEnded: window.__ended })), 300); return Promise.resolve(); },
      onClose(f) { cb.push(f); }, offClose(f) { cb = cb.filter((x) => x !== f); }, onError() {} }; } };
});
await p.goto('http://localhost:8931/'); await p.waitForTimeout(800);
const r = await p.evaluate(async () => {
  const { ads } = await import('/js/platform.js');
  window.__ended = true; const a = await ads.show();
  window.__ended = false; const b2 = await ads.show();
  window.__ended = true; window.__failOnce = true; const c = await ads.show();
  return { avail: ads.available, a, b2, c, log: window.__log };
});
console.log(JSON.stringify(r), errs);
await b.close();
