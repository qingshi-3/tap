import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const errs = [];
p.on('pageerror', (e) => errs.push('PAGE ' + e.message + '\n' + e.stack));
await p.goto('http://localhost:8931/?mockad');
await p.evaluate(() => localStorage.clear());
await p.reload(); await p.waitForTimeout(500);
const shots = process.argv[2] === 'shots';
let n = 0, lastDay = 0;
for (let step = 0; step < 1500; step++) {
  const st = await p.evaluate(() => {
    const vis = (e) => e && !e.disabled && e.offsetParent !== null;
    const btns = [...document.querySelectorAll('#stage button')].filter(vis);
    const mask = document.querySelector('.mask');
    const scope = mask ? [...mask.querySelectorAll('button')].filter(vis) : btns;
    const txt = scope.map((x) => x.textContent.trim());
    return { txt, mask: !!mask, day: document.querySelector('.hud .date b')?.textContent, end: !!document.querySelector('.end-hero'), money: document.querySelector('.hud .m')?.textContent };
  });
  if (st.end) { console.log('END at', st.day, st.money); break; }
  const pri = ['开张营业', '开张！', '开门营业', '关门', '交不起了……', '付房租', '还给她', '接单', '辛苦了', '认罚', '交付', '成交', '开工', '卖出', '睡觉'];
  let target = null;
  for (const k of pri) { const t = st.txt.find((x) => x.startsWith(k) || x.includes(k)); if (t) { target = t; break; } }
  // 出价/报价随机试一下
  if (!target || Math.random() < 0.3) { const o = st.txt.find((x) => x.startsWith('出价') || x.startsWith('报价')); if (o && Math.random() < 0.5) target = o; }
  const clicked = await p.evaluate(({ target, mask }) => {
    const vis = (e) => e && !e.disabled && e.offsetParent !== null;
    const root = mask ? document.querySelector('.mask') : document;
    let el = target && [...root.querySelectorAll('#stage button, .mask button')].filter(vis).find((x) => x.textContent.trim() === target);
    if (!el) el = [...root.querySelectorAll('button.slot, button.crate, button.spot')].filter(vis)[0];
    if (!el) el = [...root.querySelectorAll('button')].filter(vis).find((x) => /不收了|不卖了|抱歉|送客|不接|再想想|✕|舍不得/.test(x.textContent));
    if (!el) return null;
    el.click(); return el.textContent.trim();
  }, { target, mask: st.mask });
  if (!clicked) { await p.waitForTimeout(400); if (++n > 20) { console.log('STUCK', JSON.stringify(st)); await p.screenshot({ path: 'shots/stuck.png' }); break; } continue; }
  n = 0;
  if (st.day !== lastDay) { lastDay = st.day; console.log(st.day, st.money); }
  await p.waitForTimeout(clicked.startsWith('成交') || clicked.startsWith('不') || /还给她|接单|辛苦|认罚|出价|报价/.test(clicked) ? 1700 : 260);
}
console.log(errs.join('\n') || 'no errors');
await b.close();
