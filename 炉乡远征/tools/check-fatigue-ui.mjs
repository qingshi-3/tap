import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {ExpeditionProgress} from '../dist/js/expedition-progress.js';
import {createExpeditionMatch,confirmMulligan,validateMatch} from '../dist/js/engine.js';
import {SAVE_KEYS} from '../dist/js/storage-keys.js';

const {chromium}=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const out=new URL('../output/fatigue/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const report={checks:[],errors:[],limitations:['Desktop Edge touch emulation; physical phones and TapTap host not verified.']};
class Memory {data=new Map();getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
function seed(){
  const progress=new ExpeditionProgress(new Memory());
  const s=createExpeditionMatch('border-01',progress.state.training,progress.state.squad,progress.state.selectedHeroId,progress.getBattleLoadout());
  assert.ok(progress.saveBattle(s).ok);
  assert.ok(confirmMulligan(s));
  for(const player of s.players){player.deck=[];player.hand=[];}
  assert.ok(validateMatch(s));assert.ok(progress.saveBattle(s).ok);
  return progress.state;
}
async function shot(page,name){await page.screenshot({path:fileURLToPath(new URL(name+'.png',out))});}
async function ready(page){await page.waitForFunction(()=>window.__renderer?.state.currentPlayer===0&&window.__renderer.state.phase==='playing'&&!document.querySelector('#end-turn').disabled);}
async function resume(page){await page.locator('.menu-play').tap();await page.locator('#objective-close').tap();await ready(page);}
try{
  for(const [width,height] of [[568,320],[844,390]]){
    const c=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:width===568?'reduce':'no-preference'});
    const page=await c.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
    await page.addInitScript(({profile,key})=>{
      if(!sessionStorage.getItem('fatigue-fixture')){localStorage.setItem(key,JSON.stringify(profile));sessionStorage.setItem('fatigue-fixture','1');}
    },{profile:seed(),key:SAVE_KEYS.expedition});
    await page.addInitScript(async()=>{const {BoardRenderer}=await import('/js/renderer.js');const draw=BoardRenderer.prototype.draw;BoardRenderer.prototype.draw=function(...args){window.__renderer=this;return draw.apply(this,args);};});
    await page.goto(process.env.FATIGUE_UI_BASE||'http://127.0.0.1:4227');
    await page.locator('[data-action="battle-rules"]').tap();await page.locator('#rule-tab-draw').tap();
    const text=await page.locator('#battle-rules').innerText();assert.match(text,/首次抽牌受到1点/);assert.match(text,/同回合额外抽牌也递增/);
    await page.locator('#battle-rules > div').filter({has:page.locator('dt',{hasText:'疲劳'})}).scrollIntoViewIfNeeded();
    await shot(page,`rules-${width}`);await page.locator('#objective-close').tap();
    await resume(page);
    // Actual end-turn input runs the enemy turn and the next player draw.
    for(const count of [1,2,3]){
      if(count===3){
        await page.reload();await resume(page);
        assert.deepEqual(await page.evaluate(()=>window.__renderer.state.players.map(p=>p.fatigueCount)),[2,2]);
      }
      await page.locator('#end-turn').tap();
      const notice=page.locator('.card-draw-flight').filter({hasText:`疲劳 −${count}`});
      await notice.first().waitFor({state:'visible'});
      if(count===2)await shot(page,`fatigue-two-${width}`);
      await ready(page);
      assert.deepEqual(await page.evaluate(()=>window.__renderer.state.players.map(p=>p.fatigueCount)),[count,count]);
      const logs=await page.evaluate(()=>window.__renderer.state.log.join('\n'));
      assert.match(logs,new RegExp(`${count}点疲劳伤害`));
      const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).activeBattle,SAVE_KEYS.expedition);
      assert.deepEqual(saved.players.map(p=>p.fatigueCount),[count,count]);
    }
    await page.locator('#objective-open').tap();await page.locator('#objective-rules').tap();await page.locator('#rule-tab-draw').tap();
    assert.match(await page.locator('#battle-rules').innerText(),/首次抽牌受到1点/);await page.locator('#objective-close').tap();await ready(page);
    report.checks.push(`${width}x${height}: real end-turn inputs produce 1/2/3 for both owners; fatigue feedback shown; save/reload after 2 continues at 3; home and battle help agree`);
    await c.close();
  }
}catch(e){report.errors.push(e.stack);for(const c of browser.contexts())for(const page of c.pages())await shot(page,'failure');}
finally{await browser.close();report.passed=report.errors.length===0;await writeFile(new URL('ui-report.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
if(!report.passed)process.exitCode=1;
