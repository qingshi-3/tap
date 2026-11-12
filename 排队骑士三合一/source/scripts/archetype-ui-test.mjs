// UI fixtures verify interaction and rendering only; they are not natural-progression balance evidence.
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const base = process.env.BASE_URL ?? 'http://127.0.0.1:4175';
const output = 'output/archetype-ui';
mkdirSync(`${output}/screenshots`, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], errors = [];
const selectedSteps = process.env.UI_STEPS?.split(',');
let page, size;
function ok(value, message) { if (!value) throw Error(message); }
function ruleText(text) {return text.replace(/[\s「」]/g,'').replace(/生命([+−-]?\d+)/g,'$1生命').replace(/攻击([+−-]?\d+)/g,'$1攻击').replace(/([+−-]?\d+)攻(?!击)/g,'$1攻击').replace(/([+−-]?\d+)层格挡/g,'$1格挡').replace(/格挡([+−-]?\d+)/g,'$1格挡');}
async function shot(name) { const path = `${output}/screenshots/${size}-${name}.png`; await page.screenshot({ path }); return path; }
async function step(name, task) {
  if (selectedSteps && !selectedSteps.includes(name)) return;
  try { const detail = await task(); results.push({ viewport: size, name, ok: true, detail }); }
  catch (error) { results.push({ viewport: size, name, ok: false, error: String(error), screenshot: await shot(`FAIL-${name}`) }); }
}
async function layout() {
  return page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight }));
}
async function noOverflow() { const box = await layout(); ok(box.scrollWidth <= box.width + 1 && box.scrollHeight <= box.height + 1, `document overflow ${JSON.stringify(box)}`); return box; }
async function state() { return page.evaluate(async () => (await import('/src/core/run.ts')).load()); }
async function fixture(capFull = false, withQuarry = false) {
  await page.goto(base);
  const detail = await page.evaluate(async ({capFull, withQuarry}) => {
    const m = await import('/src/core/run.ts');
    let r;
    for (let seed = 1; seed < 5000; seed++) {
      const candidate = m.newRun(seed);
      if (['blood','charge','wheel','nest', ...(withQuarry ? ['hunt'] : [])].every(id => candidate.activeArchetypes.includes(id))) { r = candidate; break; }
    }
    if (!r) throw Error('No matching legal draft');
    r.act = 2; r.gold = 10; r.tavern = 3;
    // Select an existing later encounter. Enemy and owned card stats remain authored values.
    function route(layer, choices, path = []) {
      for (const index of choices) {
        const node = r.map[layer][index], next = [...path, index];
        if (layer === 4 && node.enemy && node.k !== 'boss') return next;
        if (layer < 4) { const found = route(layer + 1, node.next, next); if (found) return found; }
      }
    }
    const path = route(0, m.nodeOpts(r));
    if (!path) throw Error('No later authored encounter fixture');
    r.layer = path.length - 1; r.path = path.slice(0, -1); r.turn = m.actTurn(r.act, r.layer);
    m.pickNode(r, path.at(-1));
    const defs = ['rw_wheel_marshal','rw_nest_hatch','rw_blood_cutpurse','rw_nest_matron','rw_charge_sling'];
    if (withQuarry) defs[3] = 'rw_hunt_spotter';
    r.queue = defs.map(def => ({ oid: r.nextId++, def, copies: 1, atkBonus: 0, hpBonus: 0 }));
    r.queue[0].seal = 3;
    if (capFull) r.tc.generatedGold = 4;
    r.event = null; r.relicPick = null; r.relicDue = 0;
    m.save(r);
    if (!m.load()) throw Error('UI fixture is not a valid v5 save');
    return { seed: r.worldSeed, activeArchetypes: r.activeArchetypes, defs, enemy: r.enemy.units, encounterLayer:r.layer, path:r.path };
  }, {capFull, withQuarry});
  await page.reload();
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.locator('.hud-archetypes').waitFor();
  await page.waitForTimeout(1600); // Let the documented 0.8 s intro + 0.7 s fly-out finish before tips.
  return detail;
}
try {
  for (const viewport of [{ width: 844, height: 390 }, { width: 720, height: 360 }]) {
    size = `${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({ viewport });
    page = await context.newPage();
    page.setDefaultTimeout(6000);
    page.on('pageerror', e => errors.push({ viewport: size, type: 'pageerror', text: String(e) }));
    page.on('console', e => { if (e.type() === 'error') errors.push({ viewport: size, type: 'console', text: e.text(), location:e.location() }); });
    page.on('response', r => { if (r.status() >= 400) errors.push({ viewport:size, type:'http', status:r.status(), url:r.url() }); });
    await step('natural-title-start', async () => {
      await page.goto(base); await page.getByRole('button', { name: '新的游戏', exact: true }).waitFor();
      await shot('title'); await noOverflow();
      await page.getByRole('button', { name: '新的游戏', exact: true }).click();
      await page.getByRole('button', { name: /普通/ }).click();
      await page.locator('.hero-opts button').first().click();
      await page.locator('.map-ov').waitFor();
      await page.locator('.map-ov').evaluate(async el => { await Promise.all(el.getAnimations().filter(a => Number.isFinite(a.effect?.getComputedTiming().iterations)).map(a => a.finished)); });
      // Map nodes intentionally pulse. Click their visible center through the actual mouse.
      const node = await page.locator('.map-node.can').first().boundingBox();
      ok(node, 'map has no selectable node'); await page.mouse.click(node.x + node.width / 2, node.y + node.height / 2);
      await page.getByRole('button', { name: '前往', exact:true }).click();
      await page.locator('.hud-archetypes').waitFor();
      await shot('natural-prep'); return noOverflow();
    });
    await step('catalog-94-real-art-identities', async () => {
      await page.goto(base); await page.getByRole('button', { name: '图鉴', exact: true }).click();
      const cells = page.locator('.ub-cell'); ok(await cells.count() === 94, 'catalog does not have 94 cards');
      ok(await cells.locator('.placeholder').count() === 0, 'catalog contains placeholder art');
      await page.waitForFunction(() => [...document.querySelectorAll('.ub-cell img')].every(img => img.complete && img.naturalWidth > 0));
      const definitions = await page.evaluate(async () => {
        const d = await import('/src/core/data.ts'); const a = await import('/src/core/archetypes.ts'); const f = await import('/src/qb/card.ts');
        return d.SHOP_POOL.map(c => ({ id:c.id, name:c.name, identity:c.archetype ? a.ARCHETYPES[c.archetype].name : '通用', text:f.cardText(c.id, 1) }));
      });
      for (const def of definitions) {
        const cell = page.locator(`.ub-cell[data-id="${def.id}"]`);
        ok((await cell.innerText()).includes(def.identity), `${def.id} wrong primary identity`);
        await cell.click();
        ok((await page.locator('.ub-d-fac').innerText()).includes(def.identity), `${def.id} detail identity`);
        const text = await page.locator('.cx-lv').innerText();
        const ability = await page.locator('.cx-lv .unit-effect .tip-text').first().evaluate(el=>{const copy=el.cloneNode(true);for(const icon of copy.querySelectorAll('.kwi[title]'))icon.replaceWith(icon.title+icon.textContent);for(const number of copy.querySelectorAll('.kwn[aria-label]'))number.replaceWith(number.textContent.replace(/攻$/,'')+(number.classList.contains('kwn-hp')?'生命':'攻击'));return copy.textContent;});
        ok(ruleText(ability)===ruleText(def.text), `${def.id} full ability differs: ${ability} / ${def.text}`);
        ok(!/\{(?:v|u|p|\d+h?)\}|undefined|NaN/.test(text), `${def.id} leaked template: ${text}`);
      }
      await cells.last().click(); await shot('catalog-last-detail'); return { cards: definitions.length, ...(await noOverflow()) };
    });
    await step('natural-tutorial-entry', async () => {
      await page.goto(base);
      const savedBefore = await page.evaluate(() => localStorage.getItem('pdqs3_run_v5'));
      await page.getByRole('button', { name:'新手教程', exact:true }).click();
      await page.locator('.tut-box').waitFor();
      ok((await page.locator('.tut-box').innerText()).includes('独立教学'), 'tutorial welcome missing');
      await shot('tutorial-welcome');
      await page.locator('.tut-ok').click();
      ok((await page.locator('.tut-box').innerText()).includes('后排投石手'), 'tutorial is not teaching new charge card');
      ok((await page.locator('.cards').innerText()).includes('后排投石手'), 'tutorial shop lacks its new unit');
      ok(await page.locator('.cards .placeholder').count() === 0, 'tutorial unit has placeholder art');
      ok(await page.evaluate(() => localStorage.getItem('pdqs3_run_v5')) === savedBefore, 'tutorial overwrote the real run');
      const box = await page.locator('.tut-box').boundingBox();
      ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, 'tutorial callout outside viewport');
      await shot('tutorial-buy-step'); return { savedRunPreserved:true, ...(await noOverflow()) };
    });
    await step('six-archetypes-resources', async () => {
      const detail = await fixture();
      await page.locator('.hud-archetypes').click();
      const tabs = page.locator('.run-archetype-tab');
      ok(await tabs.count() === 6, 'missing six archetype tabs');
      ok(await page.locator('.run-archetypes details').count() === 0, 'flow uses a disclosure');
      const guides = [];
      for (const tab of await tabs.all()) {
        await tab.scrollIntoViewIfNeeded(); await tab.click();
        ok(await page.locator('.run-archetypes .archetype-guide').count() === 1, 'one current guide required');
        ok(await page.locator('.run-archetype-tab[aria-pressed="true"]').count() === 1, 'tab selection count');
        const guide = await page.locator('.run-archetype-detail').innerText();
        ok(guide.includes('计数：') && guide.includes('留意：'), 'resource or cost guide missing');
        guides.push({tab:await tab.innerText(), guide});
      }
      const limits = page.locator('.run-archetypes .run-economy-limits'); await limits.waitFor({state:'visible'});
      const capText = await limits.innerText();
      for (const cap of ['本回合还可获得','额外金币 4 金','临时法术 2 张','免费口粮 2 份']) ok(capText.includes(cap), `missing visible cap: ${cap}`);
      await shot('six-archetypes');
      const last = page.locator('.run-archetypes .run-economy-limits'); await last.scrollIntoViewIfNeeded();
      const rect = await last.boundingBox(); ok(rect && rect.y >= 0 && rect.y + rect.height <= viewport.height + 1, 'economy limits outside viewport');
      await shot('six-archetypes-scrolled'); await page.keyboard.press('Escape'); return detail;
    });
    await step('blood-payment-and-limit', async () => {
      await fixture(); const before = await state();
      const target = page.getByRole('button', { name: '血钱掮客 位置3', exact:true });
      await target.click();
      await page.locator('.blood-pay').click();
      const after = await state();
      ok(after.queue[2].hpBonus === before.queue[2].hpBonus - 1 && after.gold === before.gold + 1, 'blood click did not spend permanent hp');
      await page.waitForTimeout(1200);
      await target.click();
      await page.locator('.blood-pay').waitFor({state:'visible'});
      ok(await page.locator('.blood-pay').isDisabled(), 'blood limit not reflected');
      await shot('blood-limit'); await page.keyboard.press('Escape');
      await fixture(true); await target.click();
      ok(await page.locator('.blood-pay').isDisabled(), 'exhausted team gold cap still permits blood payment');
      const reason = page.locator('.blood-disabled-reason');
      ok((await reason.innerText()).includes('本回合已额外获得 4 金'), 'gold-cap disabled reason missing');
      await reason.scrollIntoViewIfNeeded(); const reasonBox = await reason.boundingBox();
      ok(reasonBox && reasonBox.y >= 0 && reasonBox.y + reasonBox.height <= viewport.height + 1, 'disabled reason cannot be brought into view');
      await shot('blood-budget-exhausted'); await page.keyboard.press('Escape');
      return { before: before.queue[2], after: after.queue[2], exhaustedBudgetDisabled:true };
    });
    await step('enemy-quarry-and-seal', async () => {
      await fixture(false, true);
      await page.locator('[aria-label*="敌方位置2"]').click();
      await page.getByRole('button', { name: '指定猎物', exact:true }).click();
      ok((await state()).quarry === 1, 'quarry was not saved');
      ok(await page.locator('[aria-label*="敌方位置2"].is-quarry').count() === 1, 'selected quarry not highlighted');
      ok(await page.locator('[aria-label*="首次攻击追加 3 伤害"]').count() > 0, 'seal not visible');
      await shot('quarry-and-seal'); return noOverflow();
    });
    await step('battle-play-skip-report', async () => {
      await fixture();
      await page.getByRole('button', { name: /开 战/ }).click();
      await page.getByRole('button', { name: '跳过', exact:true }).waitFor();
      await page.evaluate(() => {
        window.__archetypePlayback = { movement:false, charge:false };
        const inspect = () => {
          window.__archetypePlayback.movement ||= document.querySelector('.bb-log')?.textContent.includes('轮转') ?? false;
          window.__archetypePlayback.charge ||= [...document.querySelectorAll('.unit.side-0 .m-energy')].some(el => Number(el.textContent) > 0);
        };
        window.__archetypeObserver = new MutationObserver(inspect); window.__archetypeObserver.observe(document.body, { subtree:true,childList:true,characterData:true }); inspect();
      });
      await page.waitForFunction(() => window.__archetypePlayback.movement && window.__archetypePlayback.charge, null, { timeout:20000 });
      const playback = await page.evaluate(() => { window.__archetypeObserver.disconnect(); return window.__archetypePlayback; });
      await shot('battle-playing');
      await page.getByRole('button', { name: '跳过', exact:true }).click();
      await page.locator('.res-review').waitFor({ timeout: 15000 });
      await page.locator('.res-review').click();
      await page.locator('.br-node').first().waitFor();
      const capacity = await page.locator('.br-capacity').innerText();
      ok(capacity.includes('满员落空'), 'full-board summon failure summary missing');
      let move = false, counter = false;
      const nodes = page.locator('.br-node:not(.all)');
      for (let i = 0; i < await nodes.count(); i++) {
        await nodes.nth(i).click(); move ||= await page.locator('.br-act.move').count() > 0; counter ||= await page.locator('.br-act.counter').count() > 0;
        if (move && counter) break;
      }
      ok(move && counter, `report events missing move=${move} counter=${counter}`);
      await shot('battle-report'); return { playback, move, counter, capacity, ...(await noOverflow()) };
    });
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(`${output}/${process.env.RESULTS_FILE ?? 'results.json'}`, JSON.stringify({ base, results, errors, limitations: ['UI fixtures use legal v5 drafts and authored card/enemy stats; no full-run win-rate or balance claim.', 'Tutorial entry and first buy lesson are tested; complete tutorial progression is not covered.'] }, null, 2));
}
console.log(JSON.stringify({ results, errors }, null, 2));
if (results.some(r => !r.ok) || errors.length) process.exitCode = 1;
