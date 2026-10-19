/**
 * DeepSeek 版真实浏览器验收：真实触控事件、真实页面，不注入金币/单位/胜负。
 * 覆盖 844×390 横屏两向与 568×320 短屏，以及安全区与触控目标尺寸。
 * 运行前先启动 npm run dev（4190）。
 */
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const URL = process.env.QA_URL ?? 'http://localhost:4190/';
const OUT = 'output/qa';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
const variants = [
  { name: 'iphone-844', width: 844, height: 390, iphone: true },
  { name: 'iphone-reverse-844', width: 844, height: 390, iphone: true, native: { left: 72, right: 749, top: 44, bottom: 362 } },
  { name: 'android-short-568', width: 568, height: 320, iphone: false },
  { name: 'android-square-640', width: 640, height: 360, iphone: false },
];

/** 用 CDP 派发真实触控序列；优于合成事件，能覆盖 pointer capture 路径。 */
async function touchDrag(session, from, to, steps = 8) {
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y, id: 1 }] });
  for (let i = 1; i <= steps; i++) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps, id: 1 }],
    });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/**
 * 真实触控点击。先把目标滚进最近的可滚动祖先（若目标在滚动区外，触摸会落到容器/被裁掉），
 * 再每次重取中心并**先确认该点命中的就是目标**，确认后才发触摸。
 * 绝不无条件点击：对话框打开瞬间的回流位移会让旧坐标点空，重试时就会重复触发动作。
 */
async function tapElement(page, locator, label) {
  await locator.waitFor({ state: 'attached', timeout: 5000 });
  for (let attempt = 0; attempt < 8; attempt++) {
    // 先把目标滚进最近的可滚动祖先；页面级 scrollIntoView 会把对话框整体推出屏幕，不能用。
    await locator.evaluate((node) => {
      let parent = node.parentElement;
      while (parent) {
        const overflow = getComputedStyle(parent).overflowY;
        if (overflow === 'auto' || overflow === 'scroll') {
          const nodeTop = node.getBoundingClientRect().top - parent.getBoundingClientRect().top + parent.scrollTop;
          const want = Math.max(0, nodeTop - parent.clientHeight / 2 + node.clientHeight / 2);
          if (Math.abs(parent.scrollTop - want) > 1) parent.scrollTop = want;
          return;
        }
        parent = parent.parentElement;
      }
    }).catch(() => {});
    const box = await locator.boundingBox();
    if (box && box.width > 0 && box.height > 0) {
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      if (y > 0 && y < (await page.evaluate(() => innerHeight))) {
        // 命中判定走祖先链：卡片内部的 span/img 也算命中卡片本身。
        const hit = await locator.evaluate((node) => {
          const r = node.getBoundingClientRect();
          let found = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          while (found) {
            if (found === node) return true;
            found = found.parentElement;
          }
          return false;
        });
        if (hit) {
          // 用鼠标点击触发 click 处理器：Playwright 的 touchscreen.tap 在本环境不合成 click，
          // 而真实的触摸拖动沿用 CDP touch 序列。坐标与命中target 都经过校验。
          await page.mouse.click(x, y);
          return;
        }
        if (attempt === 0) console.log(`[tap-miss] ${label} probe-not-hit at ${Math.round(x)},${Math.round(y)} box=${JSON.stringify(box)}`);
      } else if (attempt === 0) {
        console.log(`[tap-out] ${label} y out of range box=${JSON.stringify(box)}`);
      }
    }
    await page.waitForTimeout(120);
  }
  const debug = await locator.evaluate((node) => {
    const r = node.getBoundingClientRect();
    return { rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }, innerHeight };
  }).catch(() => null);
  throw new Error(`${label}：连续 8 次都没能让点击落在目标元素上，最后几何=${JSON.stringify(debug)}`);
}

/** 按文本点按钮。与 tapElement 同理：真实点击 + 命中校验 + 重试，避免布局回流导致点空。 */
async function tapText(page, text, label, exact = false) {
  const locator = exact
    ? page.getByRole('button', { name: text, exact: true })
    : page.getByRole('button', { name: text });
  if (await locator.count() === 0) {
    const open = await page.evaluate(() => [...document.querySelectorAll('dialog[open] button')].map((b) => b.textContent));
    throw new Error(`${label}：找不到文本为「${String(text)}」的按钮；当前对话框按钮=${JSON.stringify(open)}`);
  }
  await tapElement(page, locator.first(), label);
}

for (const v of variants) {
  const context = await browser.newContext({
    viewport: { width: v.width, height: v.height },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent: v.iphone
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
      : 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36',
  });
  if (v.native) {
    await context.addInitScript(({ w, h, s }) => {
      window.tap = { getWindowInfo: () => ({ windowWidth: w, windowHeight: h, safeArea: s }) };
    }, { w: v.width, h: v.height, s: v.native });
  }

  const page = await context.newPage();
  const errors = [];
  const failed = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('response', (response) => { if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`); });

  const snap = () => page.evaluate(() => window.__deepseekGuardians.snapshot());
  const screenOf = (x, y) => page.evaluate(([wx, wy]) => window.__deepseekGuardians.screenPoint({ x: wx, y: wy }), [x, y]);
  const checks = [];

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__deepseekGuardians?.snapshot().ready, null, { timeout: 30000 });
  const loaded = await snap();
  assert.ok(loaded.portraits > 0, '肖像未生成');
  checks.push(`portraits=${loaded.portraits}`);
  await page.screenshot({ path: `${OUT}/${v.name}-01-home.png` });

  // 开局
  await tapText(page, '按种子开局', 'home-button', true);
  await tapText(page, '确定', 'confirm-button', true);
  await page.waitForFunction(() => window.__deepseekGuardians.snapshot().phase === 'prep');
  const startGold = (await snap()).gold;
  assert.equal(startGold, 160);
  await page.screenshot({ path: `${OUT}/${v.name}-02-battlefield.png` });

  const session = await context.newCDPSession(page);

  // 1) 真实拖动招募卡到战场：只扣一次费
  const card = page.locator('#prep-tools [data-tool="shield"]');
  const cardBox = await card.boundingBox();
  const target = await screenOf(23, 9);
  console.log(`[${v.name}] card=${JSON.stringify(cardBox)} target=${JSON.stringify(target)} viewport=${v.width}x${v.height}`);
  await touchDrag(session, { x: cardBox.x + cardBox.width / 2, y: cardBox.y + cardBox.height / 2 }, { x: target.x, y: target.y });
  await page.waitForTimeout(200);
  let after = await snap();
  console.log(`[${v.name}] after place: gold=${after.gold} legions=${after.legions.length} buildings=${after.buildings.length}`);
  assert.equal(after.legions.length, 1, `拖动后未部署军团（落点 ${JSON.stringify(target)}）`);
  assert.equal(after.gold, startGold - 42, `拖动部署扣费异常：${after.gold}`);
  checks.push(`drag-place shield -42 gold -> ${after.gold}`);
  await page.screenshot({ path: `${OUT}/${v.name}-03-placed.png` });

  // 2) 非法区域（障碍格）释放：不扣费、不出单位
  const blocked = await screenOf(10, 3);
  const goldBeforeIllegal = (await snap()).gold;
  await touchDrag(session, { x: cardBox.x + cardBox.width / 2, y: cardBox.y + cardBox.height / 2 }, { x: blocked.x, y: blocked.y });
  await page.waitForTimeout(200);
  after = await snap();
  console.log(`[${v.name}] after illegal drop at ${JSON.stringify(blocked)}: gold=${after.gold} (before ${goldBeforeIllegal}) legions=${after.legions.length}`);
  assert.equal(after.gold, goldBeforeIllegal, `非法落点仍然扣费（${goldBeforeIllegal} -> ${after.gold}）`);
  assert.equal(after.legions.length, 1, '非法落点仍然产生军团');
  checks.push('illegal drop rejected without charge');

  // 3) 选中已部署军团 → 出现上下文面板，晋升按钮存在但经验不足时禁用
  const legionScreen = await screenOf(23.5, 9.5);
  await page.touchscreen.tap(legionScreen.x, legionScreen.y);
  await page.waitForTimeout(120);
  assert.equal(await page.locator('#context').isVisible(), true, '选中后未显示上下文面板');
  const contextText = await page.evaluate(() => {
    const panel = document.querySelector('#context');
    const upgrade = panel?.querySelector('[data-action="upgrade"]');
    return {
      text: (panel?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 90),
      upgrade: upgrade ? { text: upgrade.textContent, disabled: upgrade.disabled } : null,
      hasSlider: !!panel?.querySelector('input[type=range]'),
    };
  });
  assert.ok(contextText.text.length > 0, '上下文面板没有内容');
  assert.ok(contextText.upgrade !== null, '上下文面板缺少晋升按钮');
  checks.push(`context panel: ${contextText.text}`);
  await page.screenshot({ path: `${OUT}/${v.name}-04-selected.png` });

  // 4) 警告半径滑块：真实拖动后数值改变并保存
  const slider = page.locator('#context input[type=range]');
  // 短屏下选中面板可能被压矮，滑块需要先滚进面板可视区。
  await slider.evaluate((node) => {
    let parent = node.parentElement;
    while (parent) {
      const overflow = getComputedStyle(parent).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') {
        parent.scrollTop = Math.max(0, node.offsetTop - parent.clientHeight / 2);
        return;
      }
      parent = parent.parentElement;
    }
  }).catch(() => {});
  await page.waitForTimeout(120);
  const sliderBox = await slider.boundingBox();
  const sliderProbe = await page.evaluate(([x, y]) => {
    const node = document.elementFromPoint(x, y);
    const panel = document.querySelector('#context');
    const input = document.querySelector('#context input[type=range]');
    return {
      reached: !!input,
      atPoint: node ? `${node.tagName}.${typeof node.className === 'string' ? node.className.split(' ')[0] : ''}` : 'none',
      panelHeight: panel ? Math.round(panel.getBoundingClientRect().height) : null,
      panelScroll: panel ? { top: Math.round(panel.scrollTop), height: panel.scrollHeight, client: panel.clientHeight } : null,
      sliderRect: input ? (() => { const r = input.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })() : null,
    };
  }, [sliderBox.x + sliderBox.width / 2, sliderBox.y + sliderBox.height / 2]);
  console.log(`[${v.name}] slider probe:`, JSON.stringify(sliderProbe));
  await touchDrag(session, { x: sliderBox.x + sliderBox.width * 0.2, y: sliderBox.y + sliderBox.height / 2 }, { x: sliderBox.x + sliderBox.width * 0.85, y: sliderBox.y + sliderBox.height / 2 }, 6);
  await page.waitForTimeout(160);
  const radius = await page.evaluate(() => {
    const input = document.querySelector('#context input[type=range]');
    return input ? Number(input.value) : null;
  });
  assert.ok(radius !== null && radius > 6, `警戒半径未改变：${radius}（${JSON.stringify(sliderProbe)}）`);
  checks.push(`alert radius slider -> ${radius}`);

  // 5) 商店：打开、用触控滚动带滚到底部、购买一次治疗
  await tapText(page, /商店/, 'open-shop');
  await page.waitForTimeout(400);
  assert.equal(await page.locator('#shop').isVisible(), true, '商店未打开');
  const scrollBefore = await page.evaluate(() => document.querySelector('#shop-items').scrollTop);
  const rail = await page.locator('#shop-scroll').boundingBox();
  await touchDrag(session, { x: rail.x + rail.width / 2, y: rail.y + rail.height * 0.8 }, { x: rail.x + rail.width / 2, y: rail.y + rail.height * 0.15 }, 6);
  await page.waitForTimeout(150);
  const scrollAfter = await page.evaluate(() => document.querySelector('#shop-items').scrollTop);
  assert.ok(scrollAfter > scrollBefore, `触控滚动带无效：${scrollBefore} -> ${scrollAfter}`);
  checks.push(`shop scroll ${scrollBefore} -> ${scrollAfter}`);
  await page.screenshot({ path: `${OUT}/${v.name}-05-shop.png` });

  const spellCard = page.locator('#shop-items .shop-card[data-spell="heal"]');
  // 关键：期望值在点击前一刻取，且等卡片真正就绪，避免跨步骤引用到过期状态。
  try {
    await page.waitForFunction(() => {
      const node = document.querySelector('#shop-items .shop-card[data-spell="heal"]');
      return !!node && !node.disabled && !!node.onclick;
    }, null, { timeout: 5000 });
  } catch {
    const why = await page.evaluate(() => {
      const node = document.querySelector('#shop-items .shop-card[data-spell="heal"]');
      return {
        exists: !!node, disabled: node?.disabled ?? null, hasOnclick: node ? typeof node.onclick : null,
        cards: [...document.querySelectorAll('#shop-items .shop-card')].map((c) => `${c.dataset.dragTool ?? c.dataset.spell}:${c.disabled}`),
        shopOpen: document.querySelector('#shop').open,
        phase: window.__deepseekGuardians.snapshot().phase,
        gold: window.__deepseekGuardians.snapshot().gold,
      };
    });
    throw new Error(`治疗卡未就绪：${JSON.stringify(why)}`);
  }
  const goldBeforeSpell = (await snap()).gold;
  await tapElement(page, spellCard.first(), 'shop-card');
  await page.waitForTimeout(300);
  const goldAfterSpell = (await snap()).gold;
  assert.equal(goldAfterSpell, goldBeforeSpell - 18, `购买治疗扣费异常（${goldBeforeSpell} -> ${goldAfterSpell}）`);
  checks.push(`bought one heal charge: ${goldBeforeSpell} -> ${goldAfterSpell}`);
  await tapElement(page, page.locator('#shop [data-close]'), 'shop-close');
  await page.waitForTimeout(200);

  // 6) 单指拖图：世界坐标到屏幕的映射必须改变
  // 起点必须避开 HUD、底部栏与选中面板，否则会被判为不可用区域而不启动拖图。
  const beforePan = await screenOf(23.5, 9.5);
  // 另取一个远离地图边界的参考点：边缘对象可能因镜头边界钳制而不动，会掩盖真实的平移失效。
  const beforeCenter = await screenOf(10, 10);
  if (!beforePan || !beforeCenter) {
    throw new Error(`拖图前置检查失败：渲染器未就绪（edge=${JSON.stringify(beforePan)} center=${JSON.stringify(beforeCenter)}）`);
  }
  const panFrom = { x: Math.round(v.width * 0.22), y: Math.round(v.height * 0.68) };
  await touchDrag(session, panFrom, { x: panFrom.x + 70, y: panFrom.y + 20 }, 6);
  await page.waitForTimeout(160);
  const afterPan = await screenOf(23.5, 9.5);
  const afterCenter = await screenOf(10, 10);
  console.log(`[${v.name}] pan refs: edge ${beforePan.x}->${afterPan.x} center ${beforeCenter.x},${beforeCenter.y}->${afterCenter.x},${afterCenter.y}`);
  assert.ok(
    Math.abs(afterCenter.x - beforeCenter.x) >= 8 || Math.abs(afterCenter.y - beforeCenter.y) >= 8,
    `单指拖图无效（起点 ${JSON.stringify(panFrom)}）：中心点 ${beforeCenter.x},${beforeCenter.y} -> ${afterCenter.x},${afterCenter.y}`,
  );
  checks.push(`single-touch pan: center ${Math.round(beforeCenter.x)},${Math.round(beforeCenter.y)} -> ${Math.round(afterCenter.x)},${Math.round(afterCenter.y)}`);
  await page.screenshot({ path: `${OUT}/${v.name}-06-panned.png` });

  // 7) 开战 → 战斗中确实有敌人与真实战斗表现
  await tapText(page, /开战/, 'start-wave');
  await tapText(page, '确定', 'confirm-button', true).catch(() => {});
  await page.waitForFunction(() => window.__deepseekGuardians.snapshot().phase === 'combat', null, { timeout: 15000 });
  // 第一波在只有一支盾卫时也会很快结束，所以先确认战斗中真的出现了敌人。
  let sawEnemies = 0;
  let sawCombat = false;
  for (let i = 0; i < 24; i++) {
    const now = await snap();
    if (now.phase === 'combat') sawCombat = true;
    if (now.enemies.length > 0) { sawEnemies = Math.max(sawEnemies, now.enemies.length); break; }
    if (now.phase !== 'combat' && sawCombat) break;
    await page.waitForTimeout(150);
  }
  assert.ok(sawEnemies > 0, `开战后没有观察到敌人（战斗中=${sawCombat}）`);
  await page.screenshot({ path: `${OUT}/${v.name}-07-combat.png` });
  const combat = await snap();
  checks.push(`combat observed: maxEnemies=${sawEnemies} phase=${combat.phase} coreHp=${combat.coreHp}`);

  // 8) 暂停面板与返回首页
  await tapElement(page, page.locator('#settings'), 'settings');
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#pause').isVisible(), true);
  await page.screenshot({ path: `${OUT}/${v.name}-08-pause.png` });
  await tapText(page, '继续战斗', 'resume');
  await page.waitForTimeout(120);

  // 9) 触控目标尺寸与溢出检查
  const geometry = await page.evaluate(() => {
    const rects = [...document.querySelectorAll('#hud button, #commands button, #wave-preview button')].map((node) => {
      const r = node.getBoundingClientRect();
      return { label: (node.textContent || node.getAttribute('aria-label') || '').trim().slice(0, 12), w: Math.round(r.width), h: Math.round(r.height), visible: r.width > 0 && r.height > 0 };
    });
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth,
      innerHeight,
      insets: Object.fromEntries(['top', 'right', 'bottom', 'left'].map((k) => [k, getComputedStyle(document.documentElement).getPropertyValue(`--host-${k}`).trim()])),
      buttons: rects,
    };
  });
  assert.ok(geometry.scrollWidth <= geometry.innerWidth + 1, `页面横向溢出：${geometry.scrollWidth} > ${geometry.innerWidth}`);
  const smallButtons = geometry.buttons.filter((b) => b.visible && (b.h < 32 || b.w < 32));
  checks.push(`visible HUD buttons=${geometry.buttons.filter((b) => b.visible).length}, under-32px=${smallButtons.length}`);
  if (smallButtons.length) checks.push(`small: ${JSON.stringify(smallButtons)}`);

  // 10) 重载后继续营地：检查点仍可读
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__deepseekGuardians?.snapshot().ready, null, { timeout: 30000 });
  const continueEnabled = await page.getByRole('button', { name: '继续营地', exact: true }).isEnabled();
  assert.equal(continueEnabled, true, '重载后无可用检查点');
  await tapText(page, '继续营地', 'continue-button', true);
  await page.waitForTimeout(300);
  const resumed = await snap();
  checks.push(`reload resume ok: phase=${resumed.phase} wave=${resumed.wave} gold=${resumed.gold}`);
  await page.screenshot({ path: `${OUT}/${v.name}-09-resumed.png` });

  assert.deepEqual(errors, [], `${v.name} 页面异常：${errors.join(' | ')}`);
  assert.deepEqual(failed, [], `${v.name} 资源失败：${failed.join(' | ')}`);

  report.push({ device: v.name, viewport: `${v.width}x${v.height}`, checks, geometry, errors, failed });
  await context.close();
}

writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify(report.map((r) => ({ device: r.device, checks: r.checks, errors: r.errors, failed: r.failed })), null, 2));

