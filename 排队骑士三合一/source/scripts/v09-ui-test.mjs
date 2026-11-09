import { chromium } from 'file:///C:/Users/qs/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';

const base = process.argv.find(arg => arg.startsWith('--base='))?.slice('--base='.length) ?? 'http://127.0.0.1:4175/?debug';
const naturalOnly = process.argv.includes('--natural-only');
const output = 'output/v09';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];

async function step(name, fn) {
  try { await fn(); results.push({ name, ok: true }); }
  catch (error) { results.push({ name, ok: false, error: String(error) }); }
}
async function expectVisible(locator) {
  await locator.waitFor({ state: 'visible', timeout: 6000 });
}
async function openFixture(page, kind) {
  await page.goto(base);
  await page.evaluate(async kind => {
    const m = await import('/src/core/run.ts');
    const r = m.newRun(12, { diff: 0 });
    m.pickNode(r, m.nodeOpts(r)[0]);
    r.gold = 10;
    r.nextId = 9902;
    if (kind === 'fox') r.shop = [{ sid: 9901, kind: 'unit', def: 's_fox', locked: false, free: false }];
    if (kind === 'camp-gold') {
      r.map[0][r.path[0]].k = 'camp';
      r.event = null;
      r.queue[0] = {oid:9800,def:'s_fox',copies:2,atkBonus:0,hpBonus:0};
      r.hand = [...Array.from({length:4},(_,i)=>({kind:'spell',oid:9801+i,def:'f_bread',source:'fixture',obtainedTurn:r.turn})),null];
    }
    if (kind === 'many-targets') {
      const ids = ['l_shield','l_windblade','n_medic','d_dunecaster','a_chanter','v_sentinel','m_incubator','d_goldob','d_pharaoh'];
      r.queue = ids.slice(0,5).map((def,i)=>({oid:9800+i,def,copies:1,atkBonus:0,hpBonus:0}));
      r.hand = [...ids.slice(5).map((def,i)=>({oid:9805+i,def,copies:1,atkBonus:0,hpBonus:0})), null];
      r.shop = [{sid:9901,kind:'food',def:'x_bonepact',locked:false,free:false}];
    }
    if (kind === 'ability' || kind === 'conflict') {
      r.queue[0] = { oid: 9800, def: 's_fox', copies: 1, atkBonus: 0, hpBonus: 0 };
      if (kind === 'conflict') r.queue[0].granted = { id: 'spark', duration: 'permanent', value: 2, source: 'fixture' };
      r.hand[0] = { kind: 'spell', oid: 9801, def: 'x_bonepact', source: 'fixture', obtainedTurn: r.turn };
    }
    if (kind === 'overflow') {
      r.queue[0] = { oid: 9800, def: 's_fox', copies: 1, atkBonus: 0, hpBonus: 0 };
      r.hand = Array.from({ length: 5 }, (_, i) => i < 4 ? { kind: 'spell', oid: 9801 + i, def: 'f_bread', source: 'fixture', obtainedTurn: r.turn } : null);
      r.rewards = [{ id: 9810, source: 'fixture', card: { kind: 'spell', oid: 9811, def: 'x_bonepact', source: 'fixture', obtainedTurn: r.turn } }];
    }
    m.save(r);
  }, kind);
  await page.reload();
  await page.getByRole('button', { name: '继续游戏' }).click();
}
async function natural(page) {
  await page.goto(base);
  await page.getByRole('button', { name: '新的游戏' }).click();
  await page.getByRole('button', { name: /普通/ }).click();
  await page.locator('.hero-opts button').first().click();
  await page.locator('.map-node.can').first().click({ timeout: 6000 });
  await page.getByRole('button', { name: '前往' }).click();
  await page.locator('.cards [data-idx]').first().click();
  await page.getByRole('button', { name: '招募 3 金' }).click();
  await page.waitForTimeout(700);
  while (await page.locator('.disc-slot').count()) {
    await page.locator('.disc-slot').first().click();
    await page.locator('.disc-take').click();
    await page.waitForTimeout(500);
  }
  await expectVisible(page.getByRole('button', { name: /开 战/ }));
  await page.screenshot({ path: `${output}/ui-natural-prep.png` });
  await page.getByRole('button', { name: /开 战/ }).click();
  await page.getByRole('button', { name: '跳过' }).click();
  await expectVisible(page.getByRole('button', { name: '继续', exact: true }));
  await page.screenshot({ path: `${output}/ui-battle-result.png` });
  await page.getByRole('button', { name: '继续', exact: true }).click();
}
async function fox(page) {
  await openFixture(page, 'fox');
  await page.locator('.cards [data-idx]').first().click();
  await page.getByRole('button', { name: '招募 3 金' }).click();
  await expectVisible(page.locator('.disc-slot').first());
  await page.screenshot({ path: `${output}/ui-fox-discover.png` });
  await page.locator('.disc-slot').first().click();
  await page.locator('.disc-take').click();
  await expectVisible(page.locator('.hand-spell').first());
  await page.locator('.hand-spell').first().click();
  await page.getByRole('button', { name: '施放', exact: true }).click();
  await expectVisible(page.locator('.spell-target').first());
  await page.screenshot({ path: `${output}/ui-spell-target.png` });
  await page.locator('.spell-target').first().click();
  await page.waitForTimeout(500);
  if (await page.locator('.hand-spell').count()) throw new Error('Spell remains in hand after cast');
}
async function ability(page) {
  await openFixture(page, 'ability');
  await page.locator('.hand-spell').first().click();
  await page.getByRole('button', { name: '施放', exact: true }).click();
  await page.locator('.spell-target').first().click();
  await page.waitForTimeout(500);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('pdqs3_run_v3')));
  if (stored.queue[0]?.granted?.id !== 'bone') throw new Error('Bone ability missing after UI cast');
  await page.screenshot({ path: `${output}/ui-ability.png` });
}
async function conflict(page) {
  await openFixture(page, 'conflict');
  await page.locator('.hand-spell').first().click();
  await page.getByRole('button', { name: '施放', exact: true }).click();
  await page.locator('.spell-target').first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${output}/ui-ability-conflict.png` });
  const text = await page.locator('body').innerText();
  if (!/替换/.test(text)) throw new Error(`No replacement confirmation: ${text}`);
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.trim() }));
  if (focused.tag !== 'BUTTON') throw new Error(`No keyboard focus: ${JSON.stringify(focused)}`);
  await page.getByRole('button', { name: '取消', exact: true }).last().click();
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pdqs3_run_v3')));
  if (saved.queue[0]?.granted?.id !== 'spark' || !saved.hand.some(x => x?.def === 'x_bonepact')) throw new Error('Cancel altered ability or consumed spell');
  await page.locator('.hand-spell').first().click();
  await page.getByRole('button', { name: '施放', exact: true }).click();
  await page.locator('.spell-target').first().click();
  await page.getByRole('button', { name: '替换并施放' }).click();
  await page.waitForTimeout(300);
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pdqs3_run_v3')));
  if (saved.queue[0]?.granted?.id !== 'bone' || saved.hand.some(x => x?.def === 'x_bonepact')) throw new Error('Confirmed replacement failed');
}
async function manyTargets(page) {
  await openFixture(page, 'many-targets');
  await page.locator('.food-tile').first().click();
  await page.getByRole('button', { name: /直接施放/ }).click();
  await expectVisible(page.locator('.spell-target').first());
  if (await page.locator('.spell-target').count() !== 9) throw new Error('Expected nine targets');
  await page.screenshot({ path: `${output}/ui-nine-targets.png` });
  const visible = await page.locator('.spell-target').evaluateAll(xs => xs.map(x => { const r=x.getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight; }));
  if (visible.some(x => !x)) throw new Error('Target outside viewport');
  for (let i=0;i<12;i++) { await page.keyboard.press('Tab'); if (!await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))) throw new Error('Tab escaped dialog'); }
  await page.keyboard.press('Escape');
  if (await page.locator('.spell-target').count()) throw new Error('Escape did not close target dialog');
}
async function campGold(page) {
  await openFixture(page, 'camp-gold');
  await page.getByRole('button', { name: /前 往/ }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /整编/ }).click();
  await page.locator('.ev-unit').first().click();
  await page.waitForTimeout(600);
  let picks = 0;
  for (let i = 0; i < 5; i++) {
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('pdqs3_run_v3')));
    if (!state.discover?.length) break;
    await expectVisible(page.locator('.disc-slot').first());
    await page.locator('.disc-slot').first().click();
    await page.locator('.disc-take').click();
    await page.waitForTimeout(500);
    picks++;
  }
  if (picks < 2) throw new Error(`Expected gold discovery and fox discovery; got ${picks}`);
  await expectVisible(page.getByRole('button', {name: /^待领取奖励/}));
  await page.reload();
  await page.getByRole('button', {name:'继续游戏'}).click();
  await expectVisible(page.getByRole('button', {name: /^待领取奖励/}));
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pdqs3_run_v3')));
  if (saved.rewards?.length !== 3 || !saved.endTurnCommitted) throw new Error(`Expected three rewards with turn ended, got ${saved.rewards?.length}`);
  const originalRewards = saved.rewards.map(x => x.card.oid);
  await page.getByRole('button', {name: /^待领取奖励/}).click();
  await page.screenshot({ path: `${output}/ui-camp-reward.png` });
  if (!(await page.getByRole('button', { name: '领取', exact: true }).isDisabled())) throw new Error('Full hand claim should be disabled');
  await page.getByRole('button', { name: '整理手牌' }).click();
  await page.locator('.hand-spell').first().click();
  if (!(await page.getByRole('button', { name: '施放', exact: true }).isDisabled())) throw new Error('Can cast after end of turn');
  await page.getByRole('button', { name: '放弃', exact: true }).click();
  await page.getByRole('button', {name: /^待领取奖励/}).click();
  await page.getByRole('button', { name: '领取', exact: true }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', {name: /^待领取奖励/}).click();
    await page.getByRole('button', { name: /^放弃奖励/ }).click();
    await page.getByRole('button', { name: '放弃', exact: true }).click();
  }
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pdqs3_run_v3')));
  const claimed = saved.hand.filter(x => x && originalRewards.includes(x.oid));
  if (saved.rewards?.length || claimed.length !== 1) throw new Error('Reward claim/discard count incorrect');
  await page.getByRole('button', { name: /前 往/ }).click();
  await page.waitForTimeout(500);
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pdqs3_run_v3')));
  if (saved.rewards?.length || saved.layer !== 1 || saved.hand.filter(x => x && originalRewards.includes(x.oid)).length !== 1) throw new Error('Node did not advance or reward duplicated');
  await page.screenshot({ path: `${output}/ui-camp-advanced.png` });
}
async function overflow(page) {
  await openFixture(page, 'overflow');
  await page.screenshot({ path: `${output}/ui-overflow.png` });
  await page.getByRole('button', { name: /^待领取奖励/ }).click();
  if (!(await page.getByRole('button', { name: '领取', exact: true }).isDisabled())) throw new Error('Full hand claim should be disabled');
  await page.getByRole('button', { name: '整理手牌' }).click();
  await page.reload();
  await page.getByRole('button', { name: '继续游戏' }).click();
  await expectVisible(page.getByRole('button', { name: /^待领取奖励/ }));
  await page.screenshot({ path: `${output}/ui-overflow-restored.png` });
  await page.locator('.hand-spell').first().click();
  await page.getByRole('button', { name: '施放', exact: true }).click();
  await page.locator('.spell-target').first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /^待领取奖励/ }).click();
  await page.getByRole('button', { name: '领取', exact: true }).click();
  await page.waitForTimeout(500);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('pdqs3_run_v3')));
  if (stored.rewards?.length || !stored.hand.some(x => x?.def === 'x_bonepact')) throw new Error('Reward was not claimed into hand');
}
try {
  for (const [width, height] of (process.argv.includes('--fixtures') ? [] : [[844, 390], [740, 360], [1280, 720]])) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.stack));
    await step(`natural-${width}x${height}`, () => natural(page));
    await page.screenshot({ path: `${output}/ui-${width}x${height}.png` }).catch(() => {});
    await step(`runtime-${width}x${height}`, async () => { if (errors.length) throw new Error(errors.join('\n')); });
    await context.close();
  }
  for (const [name, test] of (naturalOnly ? [] : [['fox', fox], ['ability', ability], ['conflict', conflict], ['many-targets', manyTargets], ['camp-gold', campGold], ['overflow', overflow]])) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.stack));
    await step(`fixture-${name}`, async () => { try { await test(page); } catch (e) { throw new Error(`${e}\n${errors.join('\n')}`); } if (errors.length) throw new Error(errors.join('\n')); });
    await page.screenshot({ path: `${output}/ui-${name}-final.png` }).catch(() => {});
    await context.close();
  }
  if (!naturalOnly) {
  const motionContext = await browser.newContext({ viewport: { width: 844, height: 390 }, reducedMotion: 'no-preference' });
  const motionPage = await motionContext.newPage();
  await step('fixture-fox-normal-motion', async () => {
    await fox(motionPage);
    await motionPage.waitForTimeout(1400);
    if (await motionPage.locator('.drag-ghost, .disc-ov, .spell-target').count()) throw new Error('Animation or overlay remained after cast');
    await motionPage.screenshot({ path: `${output}/ui-normal-motion.png` });
  });
  await motionContext.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
if (results.some(result => !result.ok)) process.exitCode = 1;

