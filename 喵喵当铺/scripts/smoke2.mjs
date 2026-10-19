// 新机制冒烟：规则层随机模拟 + 关键界面截图（不是自动对局 bot）
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errs = [];
p.on('pageerror', (e) => errs.push('PAGE ' + e.message));
p.on('console', (m) => m.type() === 'error' && errs.push('CON ' + m.text())); p.on('response', (r) => r.status() >= 400 && errs.push('404 ' + r.url()));
await p.goto('http://localhost:8931/?mockad');
await p.waitForTimeout(800);
// 界面：夜晚门面
await p.evaluate(async () => {
  const G = await import('/js/game.js');
  G.newRun(); const S = G.S; S.tutorial = true; S.day = 5; S.money = 600;
  for (const id of ['purifier', 'labeler', 'fridge', 'dark']) G.buyUpgrade({ id, cost: 0, machine: id !== 'fridge' && id !== 'dark' });
  S.shelf.push(G.mkItem('water', { g: 4, gk: true }), G.mkItem('water', { g: 4, gk: true }), G.mkItem('water', { g: 1, gk: true }), G.mkItem('watch', { stolen: true, heat: 2, stolenKnown: true }));
  G.toggleWin(S.shelf[5]); G.toggleWin(S.shelf[6]);
  G.startNight(); S.phase = 'night';
  localStorage.setItem('mmdp_run', JSON.stringify(S));
  localStorage.setItem('mmdp_meta', JSON.stringify({ ach: {}, tut: true, sfx: false, music: false }));
});
await p.reload(); await p.waitForTimeout(800);
await p.click('text=继续营业'); await p.waitForTimeout(500);
await p.click('.tab >> text=门面'); await p.waitForTimeout(400);
await p.screenshot({ path: 'shots/n_front.png' });
await p.click('.tab >> text=作坊'); await p.waitForTimeout(300);
await p.screenshot({ path: 'shots/n_work.png' });
await p.click('.bar button:has-text("货架")'); await p.waitForTimeout(300);
await p.click('.sheet .slot >> nth=7'); await p.waitForTimeout(300);
await p.screenshot({ path: 'shots/n_shelf.png' });
await p.click('.sheet .x'); await p.waitForTimeout(200);
// 白天：强制第一位是伪猫卖家，看观察面板
await p.click('.bar button:has-text("睡觉")'); await p.waitForTimeout(300);
await p.click('.bar button:has-text("睡觉")'); await p.waitForTimeout(600);
await p.evaluate(async () => {
  const G = await import('/js/game.js');
  const c = G.S.queue.find((x) => x.kind === 'sell' && x.item.id !== 'water') || G.S.queue[0];
  Object.assign(c, { robo: true, roboBad: 1, obs: [null, null, null], pat: 3 });
  G.S.queue.splice(G.S.queue.indexOf(c), 1); G.S.queue.unshift(c);
});
await p.evaluate(async () => { const G = await import('/js/game.js'); return [G.S.day, G.S.news, G.S.qi, document.querySelector('.news')?.textContent]; }).then((x) => console.log(JSON.stringify(x)));
await p.screenshot({ path: 'shots/d_morning.png' });
await p.click('text=开门营业'); await p.waitForTimeout(1000);
await p.evaluate(async () => { const G = await import('/js/game.js'); return [G.S.day, G.S.news, G.S.qi, document.querySelector('.news')?.textContent]; }).then((x) => console.log(JSON.stringify(x)));
await p.screenshot({ path: 'shots/d_cust.png' });
await p.click('.eye-btn'); await p.waitForTimeout(300);
await p.click('.mask .li >> nth=1 >> text=看看'); await p.waitForTimeout(300);
await p.evaluate(async () => { const G = await import('/js/game.js'); return [G.S.day, G.S.news, G.S.qi, document.querySelector('.news')?.textContent]; }).then((x) => console.log(JSON.stringify(x)));
await p.screenshot({ path: 'shots/d_observe.png' });
await p.click('text=举报伪猫'); await p.waitForTimeout(500);
await p.evaluate(async () => { const G = await import('/js/game.js'); return [G.S.day, G.S.news, G.S.qi, document.querySelector('.news')?.textContent]; }).then((x) => console.log(JSON.stringify(x)));
await p.screenshot({ path: 'shots/d_report.png' });
await p.waitForTimeout(1800);
await p.evaluate(async () => { const G = await import('/js/game.js'); return [G.S.day, G.S.news, G.S.qi, document.querySelector('.news')?.textContent]; }).then((x) => console.log(JSON.stringify(x)));
await p.screenshot({ path: 'shots/d_next.png' });
console.log(errs.join('\n') || 'no errors');
await b.close();
