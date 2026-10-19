import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';

const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium} = require('playwright');
const browser = await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const output = new URL('../output/unit-feedback/', import.meta.url);
await mkdir(output, {recursive:true});
try {
  const context = await browser.newContext({viewport:{width:844,height:390},hasTouch:true});
  const page = await context.newPage();
  await page.route('**/unit-feedback-fixture', route => route.fulfill({contentType:'text/html',body:'<canvas id="board" width="844" height="390"></canvas>'}));
  await page.goto(`${process.env.UNIT_FEEDBACK_URL || 'http://127.0.0.1:4200'}/unit-feedback-fixture`);
  const report = await page.evaluate(async () => {
    const {BoardRenderer} = await import('/js/renderer.js');
    const {createExpeditionMatch} = await import('/js/engine.js');
    const {getCard} = await import('/js/cards.js');
    const {EFFECT_MANIFEST} = await import('/js/effect-manifest.js');
    // Model mobile hosts where assigning ctx.filter has no visual effect.
    Object.defineProperty(CanvasRenderingContext2D.prototype,'filter',{configurable:true,get:()=> 'none',set(){}});
    const renderer = new BoardRenderer(document.querySelector('canvas'));
    const state = createExpeditionMatch('border-01');
    await renderer.loadBattle(state);
    const base = {...state.units.find(u => getCard(u.cardId)?.type === 'unit'),moved:false,attacked:false,summonedThisTurn:false};
    const checks = [];
    const check = (value,name) => {if(!value)throw Error(name);checks.push(name);};
    const ctx = renderer.context;
    renderer.cellGeometry = () => ({center:{x:160,y:190},width:120,height:60});
    function draw(unit, live=unit, body=null, playback=null) {
      renderer.state = {...state,units:[live]};
      const saved = renderer.effects.bodyState;
      renderer.effects.bodyState = () => body;
      ctx.clearRect(0,0,844,390);
      renderer.drawUnit(ctx,{...state,units:[unit]},unit,{}, {},playback);
      renderer.effects.bodyState = saved;
      const data = ctx.getImageData(0,0,340,170).data;
      let colored=0, visible=0;
      for(let i=0;i<data.length;i+=4)if(data[i+3]>100){visible++;if(Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2])>8)colored++;}
      return {visible,colored};
    }
    const ready=draw(base);
    check(ready.colored>40,'ready unit retains colored sprite');
    const resting={...base,moved:true,attacked:true};
    const gray=draw(resting);
    check(gray.visible>40 && gray.colored===0,'fully used unit has actual grayscale pixels without Canvas filter');
    check(draw({...base,summonedThisTurn:true}).colored===0,'new summon rests even when flags differ');
    check(draw({...base,moved:true}).colored>40,'moved unit with attack remaining stays colored');
    check(draw({...base,attacked:true}).colored>40,'unit with movement remaining stays colored');
    check(draw({...base,movesUsed:1,attacksUsed:1}).colored>40,'extra-action quotas follow authoritative flags');
    check(draw(base,resting).colored===0,'live flags beat stale pre-action display');
    check(draw(resting,base).colored>40,'new turn live reset beats old display');
    check(draw(resting,resting,{state:'attack',elapsed:90}).colored>40,'active body animation remains colored');
    check(draw(resting,resting,null,{unitId:base.unitId,elapsed:90}).colored>40,'active movement remains colored');
    renderer.movement={unitId:base.unitId,resolve(){}};
    renderer.state={...state,units:[resting]};
    check(!renderer.unitRestingAfterAction(resting),'movement owner suppresses premature gray stats');
    renderer.movement=null;
    const sounds=[];
    renderer.effects.playSound=symbol=>sounds.push(symbol);
    renderer.paint=()=>{};renderer.scheduleAnimation=()=>{};
    const path=[{x:1,y:1},{x:2,y:1}];
    for(const reduced of [false,true]) {
      renderer.motionPreference={matches:reduced};
      for(const id of [1,23,101,123,201,223,301,323,401,418,501,527]) {
        renderer.state={units:[{...base,cardId:id}]};
        const promise=renderer.animateMovement(base.unitId,path);
        check(sounds.at(-1)==='resources/sfx/sfx_unit_run_charge_4.m4a',`hero ${id} uses running sound, reduced=${reduced}`);
        renderer.finishMovement();await promise;
      }
    }
    const count=sounds.length;
    await renderer.animateMovement(base.unitId,[path[0]]);
    check(sounds.length===count,'no-op movement does not play a sound');
    check(Boolean(EFFECT_MANIFEST.sounds[sounds[0]]),'hero run cue resolves to packaged audio');
    renderer.state={...state,units:[base]};
    const card=getCard(base.cardId),sheet=renderer.atlases.get(card.sprite.sheet),frame=sheet.animations.idle.frames[0];
    const {drawAtlasFrame}=await import('/js/atlas.js');
    const image=document.createElement('canvas');image.width=340;image.height=340;
    const ic=image.getContext('2d');
    const options={resting:true,scale:1.1,flipX:true,rotation:17,alpha:.6};
    drawAtlasFrame(ic,sheet.image,frame,170,170,options);
    const first=ic.getImageData(0,0,340,340).data;
    ic.clearRect(0,0,340,340);drawAtlasFrame(ic,sheet.image,frame,170,170,options);
    const cached=ic.getImageData(0,0,340,340).data;
    check(first.every((value,i)=>Math.abs(value-cached[i])<=1),'cached gray frame preserves transforms and alpha');
    draw(resting);renderer.finishMovement();renderer.finishAction();
    return {checks,ready,gray,coverage:'Actual atlas pixels with filter disabled; authoritative action flags and movement sound dispatch. Full UI input, audible device output and host validation are separate.'};
  });
  assert.ok(report.checks.length>30);
  await page.screenshot({path:new URL('gray-without-filter.png',output).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
  await writeFile(new URL('report.json',output),JSON.stringify(report,null,2));
  console.log(`Passed ${report.checks.length} unit feedback checks.`);
} finally {await browser.close();}
