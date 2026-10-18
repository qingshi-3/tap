// 卖水流程截图：吹牛的卖水猫、屯水夫人、加冰
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errs = [];
p.on('pageerror', (e) => errs.push('PAGE ' + e.message));
await p.goto('http://localhost:8931/?mockad'); await p.waitForTimeout(600);
await p.evaluate(async () => {
  const G = await import('/js/game.js');
  G.newRun(); const S = G.S; S.tutorial = true; S.day = 3; S.money = 400;
  for (const id of ['purifier', 'labeler', 'fridge']) G.buyUpgrade({ id, cost: 0, machine: id !== 'fridge' });
  S.shelf.push(G.mkItem('water', { g: 4, gk: true }), G.mkItem('water', { g: 2, lab: 5, selfLab: true, gk: true }));
  G.toggleWin(S.shelf[5]); G.toggleWin(S.shelf[6]);
  G.startNight(); S.phase = 'night';
  localStorage.setItem('mmdp_run', JSON.stringify(S));
  localStorage.setItem('mmdp_meta', JSON.stringify({ ach: {}, tut: true, sfx: false, music: false }));
});
await p.reload(); await p.waitForTimeout(600);
await p.click('text=继续营业'); await p.waitForTimeout(400);
await p.click('.bar button:has-text("睡觉")'); await p.waitForTimeout(200);
await p.click('.bar button:has-text("睡觉")'); await p.waitForTimeout(500);
await p.evaluate(async () => {
  const G = await import('/js/game.js'); const S = G.S;
  const hi = S.queue.findIndex((c) => c.hoarder);
  const hoarder = S.queue.splice(hi, 1)[0];
  // 卖水猫：其实是怪味水，吹成纯净水
  const ws = { kind: 'sell', who: 'worker', item: G.mkItem('water', { g: 2, lab: 5 }), ask: 70, ask0: 70, res: 40, pat: 3, checks: [null, null, null], bad: 2 };
  const buyer = { kind: 'buy', who: 'worker', want: 'drink', rich: 1.3, eye: 0, pat: 3 };
  S.queue.unshift(ws, hoarder, buyer);
  window.__hasHoarder = hi >= 0;
});
console.log('hoarder spawned:', await p.evaluate(() => window.__hasHoarder));
await p.click('text=开门营业'); await p.waitForTimeout(1000);
await p.screenshot({ path: 'shots/w_seller.png' });
await p.click('.spot >> nth=2'); await p.waitForTimeout(300);
await p.screenshot({ path: 'shots/w_strip.png' });
await p.click('text=不收了'); await p.waitForTimeout(2200);
await p.screenshot({ path: 'shots/w_hoarder.png' });
await p.click('#stage .panel .slot:not([disabled]) >> nth=0'); await p.waitForTimeout(300);
await p.click('text=换一件'); await p.waitForTimeout(200);
await p.click('text=不卖了'); await p.waitForTimeout(2200);
await p.click('#stage .panel .slot:not([disabled]) >> nth=0'); await p.waitForTimeout(300);
await p.click('text=加冰块'); await p.waitForTimeout(300);
await p.screenshot({ path: 'shots/w_ice.png' });
console.log(errs.join('\n') || 'no errors');
await b.close();
