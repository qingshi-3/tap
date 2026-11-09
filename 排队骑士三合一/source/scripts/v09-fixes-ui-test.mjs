import { chromium } from 'file:///C:/Users/qs/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const base = process.argv.find(x => x.startsWith('--base='))?.slice(7) ?? 'http://127.0.0.1:4175/?debug';
const output = 'output/v09-fixes';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const evidence = [];
try {
  const setup = await browser.newContext();
  const draft = await setup.newPage();
  await draft.goto('http://127.0.0.1:4175/?debug');
  const fixture = await draft.evaluate(async () => {
    const m = await import('/src/core/run.ts');
    const r = m.newRun(78, { diff: 0 });
    m.pickNode(r, m.nodeOpts(r)[0]);
    r.gold = 30; r.nextId = 9900;
    r.queue = [
      { oid: 9800, def: 'l_windblade', copies: 1, atkBonus: 58, hpBonus: 64, ench: 'b_buckler' },
      { oid: 9801, def: 'd_dunecaster', copies: 3, atkBonus: 0, hpBonus: 0 },
      { oid: 9802, def: 'd_artificer', copies: 1, atkBonus: 0, hpBonus: 0 }, null, null,
    ];
    r.hand = [{ kind: 'spell', oid: 9803, def: 'f_bread', source: 'fixture', obtainedTurn: r.turn }, null, null, null, null];
    r.shop = [{sid:9804, kind:'unit',def:'d_artificer',locked:false,free:false}];
    m.save(r);
    return localStorage.getItem(m.SAVE_KEY);
  });
  // Render actual UI functions as well as checking their behavior in the playable screen.
  const labels = await draft.evaluate(async () => {
    const { SHOP_POOL } = await import('/src/core/data.ts');
    const { draftCard, cardLabels } = await import('/src/qb/card.ts');
    const { unitTip } = await import('/src/qb/tip.ts');
    const { trigsOf } = await import('/src/ui/codex.ts');
    const { trigMatch, kwRich } = await import('/src/qb/kwtext.ts');
    return {
      cards: SHOP_POOL.flatMap(d => [1,2].map(lvl => ({id:d.id,lvl, labels:cardLabels(d.id,lvl), text:draftCard(d.id,{level:lvl}).textContent, timings:[...trigsOf(d.id)]}))),
      sale: trigMatch('出售其他单位后'), end: trigMatch('回合结束时'),
      fox: unitTip('s_fox',1).querySelector('.tip-next')?.textContent,
      medic: unitTip('n_medic',1).querySelector('.tip-next')?.textContent,
      before: kwRich('交锋前：造成 1 伤害').some(n => typeof n !== 'string' && n.textContent.includes('交锋前')),
    };
  });
  assert.equal(labels.cards.length,120);
  assert.equal(labels.sale,'sell'); assert.equal(labels.end,'shop'); assert(labels.fox); assert(labels.medic); assert(labels.before);
  assert(labels.cards.find(x=>x.id==='v_queen'&&x.lvl===2).labels.includes('入场×3'));
  assert.deepEqual(labels.cards.find(x=>x.id==='d_artificer'&&x.lvl===1).labels,['入场','出售时']);
  assert(labels.cards.find(x=>x.id==='d_pharaoh').timings.includes('spell'));
  assert(!labels.cards.find(x=>x.id==='d_dunecaster').timings.includes('shop'));
  writeFileSync(`${output}/card-display-audit.json`,JSON.stringify(labels,null,2));
  await setup.close();

  for (const [width,height,motion] of [[740,360,'reduce'],[844,390,'no-preference'],[1280,720,'reduce']]) {
    const ctx = await browser.newContext({viewport:{width,height},reducedMotion:motion});
    await ctx.addInitScript(value => { if (!localStorage.getItem('pdqs3_run_v3')) localStorage.setItem('pdqs3_run_v3',value); },fixture);
    const page = await ctx.newPage(); const errors=[];
    page.on('pageerror', e=>errors.push(String(e)));
    await page.goto(base);
    await page.getByRole('button',{name:'继续游戏'}).click();
    const unit = slot => page.locator(`.unit.side-0[data-slot="${slot}"]`);
    await unit(0).click();
    assert.match(await page.locator('.tip').innerText(),/61/);
    assert.match(await page.locator('.tip').innerText(),/70/);
    await page.screenshot({path:`${output}/stats-${width}.png`});
    await page.locator('.hand-spell').first().click();
    await page.getByRole('button',{name:'施放',exact:true}).click();
    await page.locator('button.spell-target[aria-label="风刃剑士 位置1"]').click();
    await page.waitForTimeout(1600);
    let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('pdqs3_run_v3')));
    assert.equal(saved.queue[0].atkBonus,59); assert.equal(saved.queue[0].hpBonus,65);
    await unit(2).click();
    await page.getByRole('button',{name:'出售 +1 金',exact:true}).click();
    await page.waitForTimeout(1100);
    saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('pdqs3_run_v3')));
    assert.equal(saved.queue[1].atkBonus >= 2,true); assert.equal(saved.queue[2],null);
    await page.reload(); await page.getByRole('button',{name:'继续游戏'}).click();
    await unit(0).click();
    const restored = await page.locator('.tip').innerText(); assert.match(restored,/62/); assert.match(restored,/71/);
    await page.screenshot({path:`${output}/restored-${width}.png`});
    await page.reload();
    await page.getByRole('button',{name:'图鉴',exact:true}).click();
    await page.getByRole('button',{name:'构装学徒',exact:true}).click();
    assert.match(await page.locator('.ub-detail').innerText(),/入场/); assert.match(await page.locator('.ub-detail').innerText(),/出售时/);
    await page.screenshot({path:`${output}/codex-${width}.png`});
    await page.getByRole('button',{name:/筛选/}).click();
    await page.waitForTimeout(200);
    await page.screenshot({path:`${output}/filters-open-${width}.png`});
    await page.getByRole('button',{name:'出售时',exact:true}).click();
    await page.getByRole('button',{name:/查看 \d+ 个/}).click();
    const ids=await page.locator('.ub-cell').evaluateAll(es=>es.map(e=>e.dataset.id));
    assert.deepEqual(ids.sort(),['a_graveguard','d_artificer','d_dunecaster']);
    await page.screenshot({path:`${output}/sale-filter-${width}.png`});
    await page.getByRole('button',{name:'金色',exact:true}).click();
    assert.match(await page.locator('.ub-detail').innerText(),/\+2/);
    await page.getByRole('button',{name:/筛选/}).click();
    await page.getByRole('button',{name:'清除',exact:true}).click();
    await page.getByRole('button',{name:/查看 \d+ 个/}).click();
    await page.getByRole('button',{name:'霜冠执政官',exact:true}).click();
    assert.match(await page.locator('.ub-cell[data-id="v_queen"]').innerText(),/入场×3/);
    await page.screenshot({path:`${output}/golden-${width}.png`});
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.tagName),'BUTTON');
    assert.deepEqual(errors,[]);
    evidence.push({base,width,height,motion,highStats:restored,saleFilter:ids,errors});
    await ctx.close();
  }
} finally { await browser.close(); }
writeFileSync(`${output}/${base.includes('4174')?'package':'dev'}-ui.json`,JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence,null,2));
