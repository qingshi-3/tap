// 商店素材：横幅 1920×1080、4 张竖屏截图、一段实机录屏
import { chromium } from 'playwright';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const exe = process.env.HOME + '/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const URL = 'http://localhost:8931/';
const b = await chromium.launch({ executablePath: exe });
const errs = [];

// 横幅
{ const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto(URL + 'promo/banner.html'); await p.waitForTimeout(800);
  await p.screenshot({ path: 'promo/banner.png' }); await p.close(); }
copyFileSync('art/raw/k_icon.png', 'promo/icon.png');

// 场景准备：在页面里直接摆好存档
const setup = (p, fn) => p.evaluate(fn);
const META = JSON.stringify({ ach: { first_buy: 1, first_sell: 1, spot_fake: 1, week1: 1 }, tut: true, sfx: false, music: false });
async function page(video) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL); await p.evaluate((m) => localStorage.setItem('mmdp_meta', m), META);
  return { ctx, p };
}
// 一局中途：第 9 天，有净水器/贴标台/制冰盒，橱窗两瓶山泉水
const MID = async () => {
  const G = await import('/js/game.js');
  G.newRun(); const S = G.S; S.tutorial = true; S.day = 8; S.money = 486; S.rentPaid = 1;
  for (const id of ['purifier', 'labeler', 'fridge', 'shelf1', 'wsign']) G.buyUpgrade({ id, cost: 0, machine: ['purifier', 'labeler'].includes(id) });
  S.shelf = [];
  S.shelf.push(G.mkItem('water', { g: 4, gk: true }), G.mkItem('water', { g: 4, gk: true }), G.mkItem('watch'), G.mkItem('bell', { stolen: true, heat: 2, stolenKnown: true }), G.mkItem('nipwine'), G.mkItem('water', { g: 2, lab: 5, selfLab: true, gk: true }), G.mkItem('radio'));
  G.toggleWin(S.shelf[0]); G.toggleWin(S.shelf[1]); G.toggleWin(S.shelf[2]);
  S.rep.elite = 2; S.rep.folk = 3;
  S.sign = 'wsign';
  G.startNight(); S.phase = 'night';
  localStorage.setItem('mmdp_run', JSON.stringify(S));
};
const toDay = async (p, front) => {
  await p.reload(); await p.waitForTimeout(700);
  await p.click('text=继续营业'); await p.waitForTimeout(500);
  if (front) return;
  await p.click('.bar button:has-text("睡觉")'); await p.waitForTimeout(150);
  await p.click('.bar button:has-text("睡觉")'); await p.waitForTimeout(500);
};
const put = (p, kind) => p.evaluate(async (kind) => {
  const G = await import('/js/game.js'); const S = G.S;
  let c;
  if (kind === 'water') c = { kind: 'sell', who: 'doctor', item: G.mkItem('water', { g: 2, lab: 5 }), ask: 96, ask0: 96, res: 50, pat: 3, checks: [null, null, null], bad: 2, said: true, line: '刚从实验室带出来的纯净水，96 鱼币，绝对干净～' };
  if (kind === 'hoarder') { c = S.queue.find((x) => x.hoarder) || { kind: 'buy', who: 'noble', want: 'drink', minG: 4, rich: 1.7, eye: 1, pat: 3, hoarder: true }; S.queue = S.queue.filter((x) => x !== c); }
  if (kind === 'robo') { const it = G.mkItem('holo'); it.fake = true; c = { kind: 'sell', who: 'gent', item: it, ask: 210, ask0: 210, res: 150, pat: 3, checks: [null, null, null], bad: 1, robo: true, roboBad: 2, obs: [null, null, null], said: true, line: '上好的全息投影仪，210 鱼币。喵。喵。喵。' }; }
  S.queue.unshift(c);
}, kind);

// 截图 1：卖水猫吹牛，试纸拆穿
{ const { ctx, p } = await page(); await setup(p, MID); await toDay(p); await put(p, 'water');
  await p.click('text=开门营业'); await p.waitForTimeout(1200);
  await p.click('.spot >> nth=2'); await p.waitForTimeout(500);
  await p.screenshot({ path: 'promo/s1.png' }); await ctx.close(); }
// 截图 2：屯水的珍珠夫人看中橱窗
{ const { ctx, p } = await page(); await setup(p, MID); await toDay(p); await put(p, 'hoarder');
  await p.click('text=开门营业'); await p.waitForTimeout(1200);
  await p.click('#stage .panel .slot:not([disabled]) >> nth=0'); await p.waitForTimeout(500);
  await p.screenshot({ path: 'promo/s2.png' }); await ctx.close(); }
// 截图 3：观察伪猫
{ const { ctx, p } = await page(); await setup(p, MID); await toDay(p); await put(p, 'robo');
  await p.click('text=开门营业'); await p.waitForTimeout(1200);
  await p.click('.eye-btn'); await p.waitForTimeout(300);
  await p.click('.mask .li >> nth=0 >> text=看看'); await p.waitForTimeout(200);
  await p.click('.mask .li >> nth=1 >> text=看看'); await p.waitForTimeout(400);
  await p.screenshot({ path: 'promo/s3.png' }); await ctx.close(); }
// 截图 4：夜晚门面——灯牌和橱窗
{ const { ctx, p } = await page(); await setup(p, MID); await toDay(p, true);
  await p.click('.tab >> text=门面'); await p.waitForTimeout(500);
  await p.screenshot({ path: 'promo/s4.png' }); await ctx.close(); }
// 截图 0：标题
{ const { ctx, p } = await page(); await p.reload(); await p.waitForTimeout(900);
  await p.screenshot({ path: 'promo/s0.png' }); await ctx.close(); }

// 实机录屏：开局教学几位客人 + 中途卖水/伪猫
// Playwright 自带的 ffmpeg 不带 VP8，自己用 CDP 抓帧再编 VP9
{ const { ctx, p } = await page(true);
  rmSync('promo/frames', { recursive: true, force: true }); mkdirSync('promo/frames');
  const cdp = await ctx.newCDPSession(p), frames = [];
  cdp.on('Page.screencastFrame', async (f) => {
    const n = String(frames.length).padStart(5, '0');
    writeFileSync(`promo/frames/${n}.jpg`, Buffer.from(f.data, 'base64'));
    frames.push(f.metadata.timestamp);
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
  const tap = async (sel, ms) => { try { await p.click(sel, { timeout: 2500 }); } catch { console.log('skip', sel); } await p.waitForTimeout(ms); };
  await p.reload(); await p.waitForTimeout(1500);
  await setup(p, MID);
  await p.reload(); await p.waitForTimeout(1200);
  await tap('text=继续营业', 1200); await tap('.tab >> text=门面', 1800);
  await tap('.bar button:has-text("睡觉")', 400); await tap('.bar button:has-text("睡觉")', 1500);
  await put(p, 'robo'); await put(p, 'hoarder'); await put(p, 'water');
  await tap('text=开门营业', 1800);
  await tap('.spot >> nth=0', 900); await tap('.spot >> nth=2', 2200);
  await tap('button:has-text("不收了")', 2200);
  await tap('#stage .panel .slot:not([disabled]) >> nth=0', 1500);
  await tap('button:has-text("成交")', 2600);
  await p.waitForFunction(async () => (await import('/js/game.js')).current()?.robo, null, { timeout: 8000 }).catch(() => console.log('no robo'));
  await tap('.eye-btn', 1000);
  for (const i of [0, 2]) await tap(`.mask .li >> nth=${i} >> text=看看`, 1100);
  await tap('text=举报伪猫', 3500);
  await cdp.send('Page.stopScreencast');
  await ctx.close();
  // 自带 ffmpeg 只有 image2pipe+mjpeg：按真实时间戳重采样成 15fps 再管道喂进去
  const FPS = 15, t0 = frames[0], parts = [];
  for (let k = 0, i = 0; t0 + k / FPS <= frames.at(-1) + 1; k++) {
    while (i + 1 < frames.length && frames[i + 1] <= t0 + k / FPS) i++;
    parts.push(readFileSync(`promo/frames/${String(i).padStart(5, '0')}.jpg`));
  }
  writeFileSync('promo/frames/all.mjpeg', Buffer.concat(parts));
  execFileSync(process.env.HOME + '/.cache/ms-playwright/ffmpeg-1013/ffmpeg-linux', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', 'file:promo/frames/all.mjpeg', '-vf', 'scale=720:-2', '-c:v', 'libvpx-vp9', '-b:v', '2M', '-pix_fmt', 'yuv420p', 'promo/gameplay.webm']);
  console.log('frames', frames.length, 'secs', (frames.at(-1) - frames[0]).toFixed(1)); }
console.log(errs.join('\n') || 'no errors');
await b.close();
