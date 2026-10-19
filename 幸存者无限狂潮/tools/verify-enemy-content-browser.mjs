import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const OUT=path.resolve(import.meta.dirname,process.env.VFX_OUTPUT||'../output/enemy-content');
await mkdir(OUT,{recursive:true});
const report={scope:'Isolated browser encounter fixtures; real navigation, keyboard and CDP touch. Wave clocks isolated for readable skill cycles, not a full-run balance verdict.',cases:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
function assert(v,m){if(!v)throw new Error(m);}
const hook=`
import {initEnemyAbility as qaInit} from './enemy-abilities.js';
import {getEnemyContent as qaContent} from './enemy-content.js';
import {getBattleCamera as qaCamera} from './battle-camera.js';
window.__ENEMY_QA={game:()=>game,camera:()=>qaCamera(game),seed(id,edge){
 const g=game,c=qaContent(id),p=g.player,boss=c.role==='boss';
 if(edge==='top'||edge==='corner')p.y=p.radius; if(edge==='corner')p.x=p.radius;
 g.time=0;g.duration=999;g._spawnClock=9999;g._eliteWaves=3;g.dungeon={...g.dungeon,boss:null};
 g.enemies=[];g.enemyHazards=[];g.enemyProjectiles=[];g.effects=[];g.supplies=[];g.mapObjects=[];g.boss=null;
 const e={id:g._nextId++,kind:c.kind,name:c.name,boss,elite:true,x:p.x+80,y:p.y,radius:boss?32:24,hp:boss?18000:330,maxHp:boss?18000:330,speed:boss?30:45,damage:boss?20:12,xp:5,hitFlash:0,spawnDelay:0,anim:'idle',animTime:0,animDuration:0,facing:-1,contactClock:0,aiClock:1};
 g.enemies.push(e);if(boss)g.boss=e;qaInit(g,e,id);return e.id;
}};
`;
async function open(width,height,reduced=false){
 const c=await browser.newContext({viewport:{width,height},hasTouch:height<500,isMobile:height<500,reducedMotion:reduced?'reduce':'no-preference'});
 await c.route('**/main.js',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text())+hook});});
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.goto('http://127.0.0.1:4178/');await p.locator('.campaign-shell:not(.is-hidden)').waitFor({timeout:35000});
 await p.locator('[data-tab="map"]').click();await p.locator('[data-action="depart"]').click();
 await p.waitForFunction(()=>window.__ENEMY_QA?.game().phase==='playing');
 return{c,p,errors};
}
async function move(c,p,touch){
 const before=await p.evaluate(()=>({x:window.__ENEMY_QA.game().player.x,y:window.__ENEMY_QA.game().player.y}));
 if(touch){
  const box=await p.locator('#battle').boundingBox(),cdp=await c.newCDPSession(p);
  const start={x:box.x+100,y:box.y+box.height-75,id:1};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...start,x:start.x+65}]});
  await p.waitForTimeout(330);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }else{await p.keyboard.down('d');await p.waitForTimeout(330);await p.keyboard.up('d');}
 const distance=await p.evaluate(b=>Math.hypot(window.__ENEMY_QA.game().player.x-b.x,window.__ENEMY_QA.game().player.y-b.y),before);
 assert(distance>25,'real input failed to move hero');return distance;
}
async function encounter(id,width,height,reduced=false,edge=''){
 const {c,p,errors}=await open(width,height,reduced),label=`${id}-${width}x${height}${reduced?'-reduced':''}${edge?'-'+edge:''}${process.env.QA_MODE==='revised'?'-revised':''}`;
 await p.evaluate(({id,edge})=>window.__ENEMY_QA.seed(id,edge),{id,edge});
 const moves=new Set(),hazards=new Set(),screens=[],states=[],visualSamples=[];
 let moved=0,skill=false,paused=false,retreated=false;
 const frames=id==='faultwarden'||id==='cinderweaver'?88:36;
 for(let i=0;i<frames;i++){
  const s=await p.evaluate(()=>{const g=window.__ENEMY_QA.game(),e=g.enemies.find(e=>e.abilityId);return{phase:g.phase,time:g.time,hp:g.player.hp,player:{x:g.player.x,y:g.player.y,radius:g.player.radius},camera:window.__ENEMY_QA.camera(),ability:e?.abilityState,dead:e?.dead,anim:e?.anim,animTime:e?.animTime,kills:g.kills,hazards:g.enemyHazards.map(h=>({type:h.type,move:h.move,shape:h.shape,telegraph:h.telegraph,x:h.x,y:h.y,radius:h.radius,innerRadius:h.innerRadius,outerRadius:h.outerRadius,gapAngle:h.gapAngle,gapWidth:h.gapWidth})),shots:g.enemyProjectiles.length};});
  if(s.ability?.move)moves.add(s.ability.move);for(const h of s.hazards)hazards.add(`${h.type}:${h.move}`);
  states.push({time:+s.time.toFixed(2),phase:s.phase,hp:s.hp,move:s.ability?.move,stage:s.ability?.stage,shots:s.shots,dead:s.dead,anim:s.anim,animTime:s.animTime,kills:s.kills,player:s.player});
  if(s.shots>0&&!screens.includes('projectile')){await p.screenshot({path:path.join(OUT,`${label}-projectile.png`)});screens.push('projectile');}
  if(s.dead&&!screens.includes('death-tail')){await p.screenshot({path:path.join(OUT,`${label}-death-tail.png`)});screens.push('death-tail');if(s.anim==='explode'){await p.waitForTimeout(100);await p.screenshot({path:path.join(OUT,`${label}-explode-bloom.png`)});screens.push('explode-bloom');}}
  if(id==='blastBeetle'&&process.env.QA_RETREAT==='1'&&s.hazards.some(h=>h.telegraph)&&!retreated){
   const box=await p.locator('#battle').boundingBox(),cdp=await c.newCDPSession(p),start={x:box.x+140,y:box.y+box.height-75,id:2};
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...start,x:start.x-65}]});
   await p.waitForTimeout(850);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});retreated=true;
  }
  if(s.hazards.some(h=>h.telegraph)&&!screens.includes('warning')){await p.screenshot({path:path.join(OUT,`${label}-warning.png`)});screens.push('warning');visualSamples.push({type:'warning',time:s.time,player:s.player,camera:s.camera,hazards:s.hazards});}
  if(s.hazards.some(h=>h.type==='ring'||h.type==='aura')&&!screens.includes('active')){await p.screenshot({path:path.join(OUT,`${label}-active.png`)});screens.push('active');visualSamples.push({type:'active',time:s.time,player:s.player,camera:s.camera,hazards:s.hazards});}
  if(i===10){moved=await move(c,p,height<500);if(edge){await p.screenshot({path:path.join(OUT,`${label}-after-drag.png`)});screens.push('after-drag');}}
  if(i===15){await p.locator('.skill-button').last().click();skill=true;}
  if(i===20){
   await p.locator('#pause').click();await p.locator('#pause-dialog[open]').waitFor();
   const t=await p.evaluate(()=>window.__ENEMY_QA.game().time);await p.waitForTimeout(250);
   assert(await p.evaluate(()=>window.__ENEMY_QA.game().time)===t,'pause advanced encounter clock');
   await p.keyboard.press('Escape');await p.waitForFunction(()=>window.__ENEMY_QA.game().phase==='playing');paused=true;
  }
  if(s.phase==='defeat')break;
  await p.waitForTimeout(250);
 }
 await p.screenshot({path:path.join(OUT,`${label}-final.png`)});
 const result={label,edge,retreated,moves:[...moves],hazards:[...hazards],moved,skill,paused,screens,states,visualSamples};report.cases.push(result);
 if(id==='faultwarden')assert(moves.has('wedge')&&moves.has('fault')&&moves.has('sweep'),`${label}: incomplete hammer cycle ${[...moves]}`);
 if(id==='cinderweaver')assert(hazards.size>=4&&[...hazards].some(h=>h.startsWith('ring:')),`${label}: no complete fire/ring sequence ${[...hazards]}`);
 assert(screens.includes('warning')||id==='kilnGuard',`${label}: no visible telegraph`);
 assert(!errors.length,`${label}: ${errors.join('; ')}`);

 console.log(JSON.stringify({label,moves:[...moves],hazards:[...hazards],moved,errors}));await c.close();
}
async function checkPauseBuild(id){
 const {c,p,errors}=await open(667,320,true),label=`${id}-667x320-corner-pause-build`;
 await p.evaluate(id=>window.__ENEMY_QA.seed(id,'corner'),id);await p.waitForTimeout(600);
 const moved=await move(c,p,true);await p.locator('#pause').click();await p.locator('#pause-dialog[open]').waitFor();
 await p.locator('#pause-dialog summary').click();const build=p.locator('#build-summary');assert(await build.isVisible(),label+': build summary invisible');
 const text=await build.innerText();assert(text.includes('范围')&&text.includes('普攻频率')&&text.trim().split(/\n+/).length>=2,label+': missing identity and combat parameters '+text);
 const bounds=await build.boundingBox();assert(bounds&&bounds.x>=0&&bounds.x+bounds.width<=667,label+': build summary overflow');
 const t=await p.evaluate(()=>window.__ENEMY_QA.game().time);await p.screenshot({path:path.join(OUT,`${label}.png`)});assert(await p.evaluate(()=>window.__ENEMY_QA.game().time)===t,label+': pause clock advanced');
 await p.locator('#resume').click();await p.waitForFunction(()=>window.__ENEMY_QA.game().phase==='playing');assert(!errors.length,label+': '+errors.join('; '));
 report.cases.push({label,moved,text,bounds,pausedTime:t,resumed:true,errors});console.log(JSON.stringify({label,moved,resumed:true,errors}));await c.close();
}
try{
 if(process.env.QA_PAUSE_ONLY==='1'){for(const id of ['faultwarden','cinderweaver'])await checkPauseBuild(id);}else if(process.env.QA_MODE==='revised'){
  if(!process.env.QA_EDGES_ONLY)for(const id of ['faultwarden','cinderweaver']){await encounter(id,844,390);await encounter(id,667,320,true);}
  for(const id of (process.env.QA_ONLY?process.env.QA_ONLY.split(','):['faultwarden','cinderweaver']))for(const edge of (process.env.QA_EDGES_ONLY?process.env.QA_EDGES_ONLY.split(','):['top','corner']))await encounter(id,667,320,true,edge);
 }else{
 if(!process.env.QA_ONLY)for(const id of ['faultwarden','cinderweaver']){await encounter(id,844,390);await encounter(id,667,320,true);}
 for(const id of (process.env.QA_ONLY?process.env.QA_ONLY.split(','):['kilnGuard','laneGunner','blastBeetle']))await encounter(id,844,390);
 }
}catch(e){report.errors.push(e.stack||e.message);console.error(e.message);process.exitCode=1;}
finally{await browser.close();await writeFile(path.join(OUT,process.env.QA_PAUSE_ONLY==='1'?'browser-revised-pause-report.json':process.env.QA_MODE==='revised'?(process.env.QA_EDGES_ONLY?'browser-revised-edges-report.json':'browser-revised-report.json'):process.env.QA_ONLY?'browser-targeted-report.json':'browser-report.json'),JSON.stringify(report,null,2)+'\n');}
