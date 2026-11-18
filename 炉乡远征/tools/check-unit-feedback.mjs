import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';

const require = createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium} = require('playwright');
const browser = await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const output = new URL(process.env.UNIT_FEEDBACK_OUTPUT || '../output/unit-feedback/', import.meta.url);
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
    renderer.motionPreference={matches:true};
    renderer.cellGeometry = () => ({center:{x:160,y:190},width:120,height:60});
    function draw(unit, live=unit, body=null, playback=null) {
      renderer.state = {...state,units:[live]};
      const saved = renderer.effects.bodyState;
      renderer.effects.bodyState = () => body;
      ctx.clearRect(0,0,844,390);
      // Compare the same idle frame, so tint evidence is independent of the
      // wall clock and differences between breathing/idle atlas frames.
      renderer.drawUnit(ctx,{...state,units:[unit]},unit,{}, {selectedUnitId:unit.unitId},playback);
      renderer.effects.bodyState = saved;
      const data = ctx.getImageData(0,0,340,170).data;
      let colored=0, visible=0, light=0;
      for(let i=0;i<data.length;i+=4)if(data[i+3]>100){visible++;light+=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];if(Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2])>8)colored++;}
      return {visible,colored,luminance:light/Math.max(1,visible),resting:renderer.unitRestingAfterAction(unit,playback,body),indicators:renderer.unitIndicators({...state,units:[live]},live).map(item=>item.kind)};
    }
    const ready=draw(base);
    check(ready.colored>40,'ready unit retains colored sprite');
    const resting={...base,moved:true,attacked:true};
    const shaded=draw(resting);
    check(shaded.visible>40 && shaded.colored>40 && shaded.luminance<ready.luminance,'fully used unit retains actual colored pixels with material shading without Canvas filter');
    check(shaded.resting && shaded.indicators.includes('resting'),'fully used unit has an explicit action-exhausted indicator');
    const summoned=draw({...base,summonedThisTurn:true});
    check(summoned.resting && summoned.colored>40 && summoned.indicators.includes('waiting'),'new summon has colored resting body and a waiting indicator even when flags differ');
    const moved=draw({...base,moved:true}),attacked=draw({...base,attacked:true});
    check(!moved.resting && !moved.indicators.includes('resting') && moved.colored>40,'moved unit with attack remaining stays ready and colored');
    check(!attacked.resting && !attacked.indicators.includes('resting') && attacked.colored>40,'unit with movement remaining stays ready and colored');
    const quota=draw({...base,movesUsed:1,attacksUsed:1});
    check(!quota.resting && quota.colored>40,'extra-action quotas follow authoritative flags');
    const stale=draw(base,resting),renewed=draw(resting,base);
    check(stale.resting && stale.indicators.includes('resting') && stale.colored>40,'live exhausted flags beat stale pre-action display');
    check(!renewed.resting && !renewed.indicators.includes('resting') && renewed.colored>40,'new turn live reset beats old display');
    const body=draw(resting,resting,{state:'attack',elapsed:90}),walking=draw(resting,resting,null,{unitId:base.unitId,elapsed:90});
    check(!body.resting && body.colored>40,'active body animation suppresses resting presentation');
    check(!walking.resting && walking.colored>40,'active movement suppresses resting presentation');
    renderer.movement={unitId:base.unitId,resolve(){}};
    renderer.state={...state,units:[resting]};
    check(!renderer.unitRestingAfterAction(resting),'movement owner suppresses premature exhausted presentation');
    renderer.movement=null;
    const sounds=[];
    const originalPlaySound=renderer.effects.playSound;
    renderer.effects.playSound=symbol=>sounds.push(symbol);
    renderer.paint=()=>{};renderer.scheduleAnimation=()=>{};
    const path=[{x:1,y:1},{x:2,y:1}];
    // core/faction1..6.coffee + app/data/resources.js (sfx_singe2 is an alias).
    const originalWalk={1:'sfx_unit_run_charge_4',23:'sfx_neutral_ladylocke_attack_impact',101:'sfx_neutral_ladylocke_attack_impact',123:'sfx_neutral_ladylocke_attack_impact',201:'sfx_neutral_ladylocke_attack_impact',223:'sfx_neutral_ladylocke_attack_impact',301:'sfx_neutral_ladylocke_attack_impact',323:'sfx_neutral_ladylocke_attack_impact',401:'sfx_neutral_ladylocke_attack_impact',418:'sfx_neutral_primordialgazer_death',501:'sfx_neutral_ladylocke_attack_impact',527:'sfx_unit_run_charge_4'};
    for(const reduced of [false,true]) {
      renderer.motionPreference={matches:reduced};
      for(const id of [1,23,101,123,201,223,301,323,401,418,501,527]) {
        renderer.state={units:[{...base,cardId:id}]};
        const promise=renderer.animateMovement(base.unitId,path);
        check(sounds.at(-1)===`resources/sfx/${originalWalk[id]}.m4a`,`hero ${id} uses original walk sound, reduced=${reduced}`);
        check(Boolean(EFFECT_MANIFEST.sounds[sounds.at(-1)]),`hero ${id} walk resolves to packaged audio`);
        renderer.finishMovement();await promise;
      }
      renderer.state={units:[base]};
      const promise=renderer.animateMovement(base.unitId,path);
      check(sounds.at(-1)===EFFECT_MANIFEST.bodies[base.cardId].sounds.walk,`non-general keeps original walk, reduced=${reduced}`);
      renderer.finishMovement();await promise;
    }
    const count=sounds.length;
    await renderer.animateMovement(base.unitId,[path[0]]);
    check(sounds.length===count,'no-op movement does not play a sound');
    check(new Set(Object.values(originalWalk)).size===3,'original twelve generals share three resolved audio files');
    renderer.effects.playSound=originalPlaySound;
    renderer.effects.setSoundVolume(0);
    for(const symbol of new Set(Object.values(originalWalk))) {
      const id=Number(Object.keys(originalWalk).find(id=>originalWalk[id]===symbol));
      const soundPath=EFFECT_MANIFEST.sounds[`resources/sfx/${symbol}.m4a`];
      renderer.effects.playMovementSound(id);
      check(renderer.effects.soundVolume===0 && (!renderer.effects.soundGain || renderer.effects.soundGain.gain.value===0),`walk ${id} respects muted gain`);
      const voices=renderer.effects.mediaVoices.get(soundPath)??[];
      check(voices.every(voice=>voice.volume===0),`walk ${id} respects muted media volume`);
      const response=await fetch(soundPath);
      check(response.ok && (await response.arrayBuffer()).byteLength>1000,`walk ${id} audio resource loads`);
    }
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
    check(first.every((value,i)=>Math.abs(value-cached[i])<=1),'cached resting frame preserves transforms and alpha');
    draw(resting);renderer.finishMovement();renderer.finishAction();
    return {checks,ready,shaded,coverage:'Actual colored/shaded atlas pixels with filter disabled; explicit availability indicators, authoritative action flags and movement sound dispatch. Full UI input, audible device output and host validation are separate.'};
  });
  assert.ok(report.checks.length>30);
  await page.screenshot({path:new URL('colored-shade-without-filter.png',output).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
  await writeFile(new URL('report.json',output),JSON.stringify(report,null,2));
  console.log(`Passed ${report.checks.length} unit feedback checks.`);
} finally {await browser.close();}
