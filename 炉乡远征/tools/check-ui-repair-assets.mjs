import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const base=process.env.UI_REPAIR_BASE??'http://127.0.0.1:4223';
const out='games/duelyst-h5/output/ui-repair';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true});
await page.goto(base);
await page.route('**/assets/units/f6_altgeneral.png',route=>route.abort());
const failure=await page.evaluate(async()=>{
 const {BoardRenderer}=await import('/js/renderer.js');const r=window.__retryRenderer=new BoardRenderer(document.createElement('canvas'));
 try {await r.load();return {rejected:false,ready:r.ready};}catch(error){return {rejected:true,ready:r.ready,message:error.message,missingCardIds:error.missingCardIds};}
});
assert.ok(failure.rejected&&!failure.ready&&failure.missingCardIds.includes(527));
await page.unroute('**/assets/units/f6_altgeneral.png');
const recovery=await page.evaluate(async()=>{const r=window.__retryRenderer;const result=await r.load();return {ready:r.ready,failures:result.failures};});
assert.ok(recovery.ready);assert.ok(!recovery.failures.includes('./assets/units/f6_altgeneral.png'));
const audit=await page.evaluate(async()=>{
 const {BoardRenderer}=await import('/js/renderer.js'),{CARDS}=await import('/js/cards.js');
 const canvas=document.createElement('canvas');canvas.width=844;canvas.height=390;
 const r=window.__assetRenderer=new BoardRenderer(canvas);await r.load();
 const gallery=document.createElement('div');gallery.style='display:grid;grid-template-columns:repeat(10,120px);background:#24354b;color:white;width:1200px';
 const cards=Object.values(CARDS).map(card=>{
  const cell=document.createElement('div'),a=document.createElement('canvas');a.width=120;a.height=110;
  r.drawCardArt(a,card.id);cell.append(a,document.createTextNode(`${card.id} ${card.name}`));gallery.append(cell);
  const pixels=a.getContext('2d').getImageData(0,0,a.width,a.height).data;
  const visible=pixels.filter((v,i)=>i%4===3&&v>16).length;
  const atlas=r.atlases.get(card.sprite?.sheet);
  return {id:card.id,name:card.name,type:card.type,sheet:card.sprite?.sheet,visible,frames:atlas?.animations.idle?.frames.length??0,loaded:card.type==='spell'?!!r.images.get(`spell-${card.effect}`):!!atlas?.image};
 });
 document.body.replaceChildren(gallery);return cards;
});
assert.equal(audit.length,103);assert.ok(audit.every(c=>c.loaded&&c.visible>0));
await page.setViewportSize({width:1200,height:1450});await page.screenshot({path:`${out}/all-103-card-assets.png`,fullPage:true});
await page.setViewportSize({width:844,height:390});
const fx=await page.evaluate(async()=>{
 const {createExpeditionMatch}=await import('/js/engine.js'),{ExpeditionProgress}=await import('/js/expedition-progress.js');
 const p=new ExpeditionProgress(localStorage),r=window.__assetRenderer;
 const s=createExpeditionMatch('border-01',p.state.training,p.state.squad);s.units.find(u=>u.owner===0&&u.cardId===1).cardId=527;
 r.canvas.style='width:844px;height:390px';document.body.replaceChildren(r.canvas);r.draw(s,{});
 const unit=s.units.find(u=>u.owner===0&&u.cardId===14);r.effects.play({kind:'summon',sourceId:unit.unitId,cardId:14},s.units.filter(u=>u!==unit));
 r.effects.playback.startedAt=performance.now();
 const light=document.createElement('canvas');light.width=844;light.height=390;
 r.effects.drawLight(light.getContext('2d'),422,195,{radius:270,intensity:9,color:{r:255,g:255,b:255}},500,1000,1);
 const data=light.getContext('2d').getImageData(0,0,844,390).data;let min=844,max=0,count=0;
 for(let y=0;y<390;y++)for(let x=0;x<844;x++)if(data[(y*844+x)*4+3]>0){min=Math.min(min,x);max=Math.max(max,x);count++;}
 return {light:{min,max,count},entries:r.effects.playback.entries.filter(e=>e.kind==='recipe').map(e=>({sprite:e.item.spriteIdentifier,type:e.item.type,radius:e.item.radius}))};
});
assert.ok(fx.light.max-fx.light.min<=266,'source lighting remains local in Canvas');
for(const t of [0,160,320,500,800]){
 await page.evaluate(t=>{const r=window.__assetRenderer;r.effects.playback.startedAt=performance.now()-t;r.paint();},t);
 await page.screenshot({path:`${out}/summon-${t}.png`});
}
await writeFile(`${out}/asset-audit.json`,JSON.stringify({audit,fx,failure,recovery},null,2));
const compatibility=await browser.newPage();
await compatibility.addInitScript(()=>{
 const decode=HTMLImageElement.prototype.decode;
 HTMLImageElement.prototype.decode=function(){return this.src.includes('/units/f6_')?Promise.reject(new DOMException('Host decode unavailable','EncodingError')):decode.call(this);};
});
await compatibility.goto(base);
const decoded=await compatibility.evaluate(async()=>{
 const {BoardRenderer}=await import('/js/renderer.js'),{CARDS}=await import('/js/cards.js');
 const r=new BoardRenderer(document.createElement('canvas'));const result=await r.load();
 return {ready:r.ready,failures:result.failures,vanar:Object.values(CARDS).filter(c=>c.faction===6&&c.sprite).map(c=>({id:c.id,loaded:!!r.atlases.get(c.sprite.sheet)?.image}))};
});
assert.ok(decoded.ready&&decoded.vanar.every(c=>c.loaded));
await writeFile(`${out}/decode-compatibility.json`,JSON.stringify(decoded,null,2));
const touch=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,reducedMotion:'no-preference'});
await touch.addInitScript(async()=>{
 const {BoardRenderer}=await import('/js/renderer.js');const draw=BoardRenderer.prototype.draw;
 BoardRenderer.prototype.draw=function(...args){window.__renderer=this;return draw.apply(this,args);};
});
await touch.goto(base);
await touch.evaluate(async()=>{
 const {ExpeditionProgress}=await import('/js/expedition-progress.js'),{createExpeditionMatch,confirmMulligan}=await import('/js/engine.js');
 const p=new ExpeditionProgress(localStorage);if(!p.selectHero(527).ok)throw Error('hero unavailable');
 const load=p.getBattleLoadout(),m=createExpeditionMatch('border-01',p.state.training,p.state.squad,527,load);
 if(!p.saveBattle(m).ok)throw Error('fixture reward freeze failed');confirmMulligan(m);
 const deck=[...load.deck],id=deck.find(id=>id===505);if(!id)throw Error('Crystal Cloaker unavailable');deck.splice(deck.indexOf(id),1);
 m.players[0].hand=[id];m.players[0].deck=deck;m.players[0].mana=9;
 const saved=p.saveBattle(m);if(!saved.ok)throw Error(saved.error);
});
await touch.reload();await touch.locator('.menu-play').tap();await touch.locator('#objective-close').tap();await touch.waitForFunction(()=>window.__renderer?.ready);
await touch.locator('#hand button').first().tap();
const drop=await touch.evaluate(()=>{
 const r=window.__renderer,rect=r.canvas.getBoundingClientRect(),c=r.cellGeometry(r.boardMetrics(rect.width,rect.height),2,2).center;
 return {x:rect.x+c.x,y:rect.y+c.y};
});
await touch.touchscreen.tap(drop.x,drop.y);
await touch.waitForFunction(()=>window.__renderer.effects.playback?.action.kind==='summon');
for(const t of [160,320,500]){
 await touch.evaluate(t=>{const r=window.__renderer;r.effects.playback.startedAt=performance.now()-t;r.paint();},t);
 await touch.screenshot({path:`${out}/app-touch-summon-${t}.png`});
}
assert.ok(await touch.evaluate(()=>window.__renderer.state.units.some(u=>u.cardId===505&&u.x===2&&u.y===2)));
await writeFile(`${out}/touch-summon.json`,JSON.stringify({passed:true,hero:527,card:505,viewport:'844x390',input:'touch hand then board cell',frames:[160,320,500]},null,2));
await browser.close();console.log('103 card assets rendered; summon frames captured');

