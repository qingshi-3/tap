import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {ExpeditionProgress} from '../dist/js/expedition-progress.js';
import {EXPEDITION_LEVELS} from '../dist/js/expedition-data.js';
import {SAVE_KEYS} from '../dist/js/storage-keys.js';

const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const output=new URL('../output/stage-tabs/',import.meta.url);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const reports=[];
try {
  for(const [width,height] of [[568,320],[844,390]])for(const [completed,reducedMotion] of [[0,'reduce'],[0,'no-preference'],[30,'no-preference']]) {
    const context=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion});
    const page=await context.newPage();
    if(completed) {
      const state=new ExpeditionProgress({getItem:()=>null,setItem(){}}).state;
      state.completed=EXPEDITION_LEVELS.map(level=>level.id);
      state.factionCompleted[1]=[...state.completed];
      state.accountStageClaims=Object.fromEntries(state.completed.map(id=>[id,'legacy']));
      await page.addInitScript(({state,key})=>localStorage.setItem(key,JSON.stringify(state)),{state,key:SAVE_KEYS.expedition});
    }
    await page.goto(process.env.STAGE_TABS_URL || 'http://127.0.0.1:4200');
    await page.locator('.menu-play').tap();
    await page.locator('.campaign-atlas').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForTimeout(800);
    const geometry=await page.locator('.atlas-chapter').evaluateAll(buttons=>buttons.map(button=>{
      const bounds=button.getBoundingClientRect(),style=getComputedStyle(button);
      const children=[...button.querySelectorAll('.atlas-chapter-number,.atlas-chapter-copy strong,.atlas-chapter-progress,.atlas-lock')].map(child=>{
        const r=child.getBoundingClientRect();return {name:child.className.baseVal??child.className,left:r.left-bounds.left,right:bounds.right-r.right,top:r.top-bounds.top,bottom:bounds.bottom-r.bottom,width:r.width,height:r.height};
      });
      return {label:button.getAttribute('aria-label'),width:bounds.width,height:bounds.height,font:getComputedStyle(button.querySelector('strong')).fontSize,touchAction:style.touchAction,children};
    }));
    assert.equal(geometry.length,10);
    for(const item of geometry) {
      assert.ok(item.width>=148 && item.height>=44,JSON.stringify(item));
      assert.ok(parseFloat(item.font)>=14,'chapter names stay readable');
      assert.equal(item.touchAction,'pan-x');
      for(const child of item.children) assert.ok(child.left>=8 && child.right>=8 && child.top>=2 && child.bottom>=2,JSON.stringify({item,child}));
    }
    const rail=page.locator('.atlas-chapters');
    const firstSelection=await page.locator('.atlas-chapter[aria-pressed="true"]').getAttribute('data-chapter-id');
    const dimensions=await rail.evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth,left:el.scrollLeft}));
    assert.ok(dimensions.scrollWidth>dimensions.width*2,'chapter buttons overflow into a scroll rail');
    const suffix=`${width}-${reducedMotion}-${completed}`;
    await page.screenshot({path:fileURLToPath(new URL(`start-${suffix}.png`,output))});
    const cdp=await context.newCDPSession(page);
    const box=await rail.boundingBox();
    async function swipe() {
      const x=box.x+box.width-35,y=box.y+box.height/2;
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
      for(let n=1;n<=10;n++) {
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-(box.width-70)*n/10,y}]});
        await page.waitForTimeout(16);
      }
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.waitForTimeout(180);
    }
    await swipe();
    assert.ok(await rail.evaluate(el=>el.scrollLeft)>dimensions.left+50,'real touch swipe scrolls from a chapter button');
    assert.equal(await page.locator('.atlas-chapter[aria-pressed="true"]').getAttribute('data-chapter-id'),firstSelection,'swipe does not activate a chapter');
    for(let n=0;n<5;n++)await swipe();
    const last=page.locator('.atlas-chapter').last();
    const lastBox=await last.boundingBox();
    assert.ok(lastBox.x>=box.x && lastBox.x+lastBox.width<=box.x+box.width+1,'last chapter reachable by touch scrolling');
    await last.tap();
    assert.equal(await page.locator('.atlas-chapter').last().getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('.atlas-start').isDisabled(),!completed,'chapter retains its correct unlock state');
    const scrolled=await rail.evaluate(el=>el.scrollLeft);
    assert.ok(scrolled>50,'selection retains rail position');
    await page.screenshot({path:fileURLToPath(new URL(`end-${suffix}.png`,output))});
    await page.locator('.atlas-chapter').last().focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.chapterId),await page.locator('.atlas-chapter').last().getAttribute('data-chapter-id'),'keyboard activation preserves focus');
    const levelRail=page.locator('.atlas-levels');
    if(width===568) {
      const lb=await levelRail.boundingBox();
      const before=await levelRail.evaluate(el=>el.scrollLeft);
      const oldLevel=await page.locator('.atlas-level[aria-pressed="true"]').getAttribute('data-level-id');
      const x=lb.x+lb.width-35,y=lb.y+lb.height/2;
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
      for(let n=1;n<=10;n++) {await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-(lb.width-70)*n/10,y}]});await page.waitForTimeout(16);}
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(200);
      assert.ok(await levelRail.evaluate(el=>el.scrollLeft)>before+30,'map/plaque rail scrolls by real touch');
      assert.equal(await page.locator('.atlas-level[aria-pressed="true"]').getAttribute('data-level-id'),oldLevel,'level swipe does not select');
    }
    await page.locator('.atlas-level').last().tap();
    assert.equal(await page.locator('.atlas-start').getAttribute('data-level-id'),await page.locator('.atlas-level').last().getAttribute('data-level-id'),'selected level matches preparation');
    await page.locator('.atlas-intel').tap();
    const selectedId=await page.locator('.atlas-level[aria-pressed="true"]').getAttribute('data-level-id');
    assert.equal(await page.locator('.atlas-dialog-heading h3').innerText(),EXPEDITION_LEVELS.find(level=>level.id===selectedId).title,'enemy intelligence matches selected level');
    await page.locator('.atlas-dialog-close').tap();
    const levelBounds=await page.locator('.atlas-level[aria-pressed="true"]').boundingBox(),trackBounds=await levelRail.boundingBox();
    assert.ok(levelBounds.x>=trackBounds.x-1 && levelBounds.x+levelBounds.width<=trackBounds.x+trackBounds.width+1,'selected map and plaque remain visible after rerender');
    await page.screenshot({path:fileURLToPath(new URL(`levels-${suffix}.png`,output))});
    const allLevels=[];
    if(completed) {
      for(let chapter=0;chapter<10;chapter++) {
        await page.locator('.atlas-chapter').nth(chapter).tap();
        for(let index=0;index<3;index++) {
          await page.locator('.atlas-level').nth(index).tap();
          const item=await page.locator('.atlas-level[aria-pressed="true"]').evaluate(el=>{
            const caption=el.querySelector('.atlas-level-caption'),cb=caption.getBoundingClientRect(),title=el.querySelector('.atlas-level-name'),t=title.getBoundingClientRect();
            return {id:el.dataset.levelId,width:el.getBoundingClientRect().width,title:title.textContent,titleHeight:t.height,line:parseFloat(getComputedStyle(title).lineHeight),children:[...caption.children].map(c=>{const r=c.getBoundingClientRect();return {name:c.className,left:r.left-cb.left,right:cb.right-r.right,top:r.top-cb.top,bottom:cb.bottom-r.bottom};})};
          });
          assert.ok(item.width>=220,'each level retains room for its map and full caption');
          assert.ok(item.titleHeight<=Math.max(22,item.line)+1,'level name stays on one line beside its number: '+JSON.stringify(item));
          for(const child of item.children)assert.ok(child.left>=0 && child.right>=0 && child.top>=0 && child.bottom>=0,'all level labels and portraits fit: '+JSON.stringify(item));
          assert.equal(await page.locator('.atlas-start').getAttribute('data-level-id'),item.id,'all levels update preparation target');
          allLevels.push(item);
        }
      }
    }
    const footer=await page.locator('.atlas-summary').boundingBox();
    assert.ok(footer.y+footer.height<=height,'scrolling levels does not displace footer');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no document horizontal overflow');
    reports.push({viewport:{width,height},completed,reducedMotion,dimensions,scrolled,geometry,allLevels,checks:'All labels/icons inside plaques; 44px touch height; actual touch swipes from chapter and level tabs; final chapter/level tap and unlock state; scroll retention; keyboard focus; footer visible; no page overflow.'});
    await context.close();
  }
  await writeFile(new URL('report.json',output),JSON.stringify(reports,null,2));
  console.log('Passed stage tab layout and real touch input at 568x320 and 844x390, both motion preferences.');
} finally {await browser.close();}
