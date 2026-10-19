import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {initTrialBoss,updateTrialBoss,damageTrialBoss,clearTrialOwned} from '../dist/trial-bosses.js';
import {emitTrialAudio,drainTrialAudio,trialAudioValid} from '../dist/trial-audio.js';
let time=1,hidden=false,visibility,decode,sources=[];
globalThis.document={get hidden(){return hidden},addEventListener(t,f){visibility=f}};
const param=()=>({value:0,setTargetAtTime(){},cancelScheduledValues(){}});
class Context{
  state='running';destination={};get currentTime(){return time}
  createDynamicsCompressor(){return {threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),connect(){}}}
  createGain(){return {gain:param(),connect(){},disconnect(){}}}
  async resume(){} async decodeAudioData(){return decode?decode():{duration:.3}}
  createBufferSource(){const source={connect(){},disconnect(){},start(){},stop(){this.onended?.()}};sources.push(source);return source}
}
globalThis.window={AudioContext:Context};globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(10)});
const {createAudioEngine}=await import('../dist/audio.js');
const h={viewBounds:()=>({left:0,right:844,top:74,bottom:390}),visible:()=>true,
  addHazard(g,e,type,geometry,duration,extra){const v={ownerId:e.id,type,...geometry,...extra,life:duration,remaining:duration};g.enemyHazards.push(v);return v},
  clearType(g,id,type){g.enemyHazards=g.enemyHazards.filter(v=>v.ownerId!==id||v.type!==type)},hurtTargets(){}};
const make=id=>{const e={id:1,x:400,y:210,hp:1000,maxHp:1000,damage:10};const g={phase:'playing',time:0,world:{width:2400,height:1800},viewport:{width:844,height:390},player:{x:410,y:210,hp:100},enemies:[e],enemyHazards:[],_nextId:2,effects:[],projectiles:[]};initTrialBoss(g,e,id);return {g,e}};
const step=(g,e,n=1)=>{for(let i=0;i<n;i++){g.time+=.05;updateTrialBoss(g,e,.05,{},h)}};
const expected={trialBulwark:['trialShieldReady','trialShieldSlash'],trialPursuer:['trialWindCharge','trialWindDash','trialWindLand'],trialBinder:['trialSoulBind','trialSoulPulse'],trialRift:['trialRiftMark','trialRiftBurst','trialRiftCut'],trialPrism:['trialPrismIn','trialPrismOut','trialPrismCharge']};
for(const [id,names] of Object.entries(expected)){const {g,e}=make(id),seen=new Set();for(let i=0;i<260;i++){step(g,e);for(const fact of drainTrialAudio(g))seen.add(fact.name)}for(const name of names)assert.ok(seen.has(name),`${id} emits ${name}`)}
{
  const {g,e}=make('trialBinder');step(g,e,28);drainTrialAudio(g);
  const node=g.enemies.find(n=>n.trialConstruct);node.hp=0;node.dead=true;node.anim='death';step(g,e);
  assert.equal(drainTrialAudio(g).filter(f=>f.name==='trialSoulBreak').length,1);step(g,e);assert.equal(drainTrialAudio(g).filter(f=>f.name==='trialSoulBreak').length,0);
  clearTrialOwned(g,e.id);step(g,e);assert.equal(drainTrialAudio(g).filter(f=>f.name==='trialSoulBreak').length,0,'timeout/cleanup quiet');
}
{
  const {g,e}=make('trialPrism');for(let i=0;i<250&&e.abilityState.stage!=='channel';i++)step(g,e);drainTrialAudio(g);
  damageTrialBoss(g,e,500,h);const event=drainTrialAudio(g).find(f=>f.name==='trialPrismBreak');assert.ok(event);assert.ok(trialAudioValid(g,event),'clear warning does not cancel interrupt');
}
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
const {g,e}=make('trialBulwark');const audio=createAudioEngine();audio.reset(g);await audio.setEnabled(true);
emitTrialAudio(g,e,'trialShieldReady');emitTrialAudio(g,e,'trialShieldSlash');audio.consume(g);await flush();assert.equal(audio.diagnostics.startedByName.trialShieldSlash,1);assert.equal(audio.diagnostics.startedByName.trialShieldReady,undefined);
time+=1;audio.play('orb');await flush();audio.play('pickup');audio.play('upgrade');await flush();assert.equal(audio.diagnostics.voices,4);assert.deepEqual(audio.diagnostics.buses,{combat:2,pickup:1,important:1});
time+=1;audio.reset(g);g.heroKit={projectiles:[{kind:'orb'}]};audio.consume(g);await flush();time+=.016;
emitTrialAudio(g,e,'trialShieldSlash');audio.consume(g);await flush();assert.equal(audio.diagnostics.startedByName.trialShieldSlash,2,'impact crosses previous-frame player cadence');
time+=.016;emitTrialAudio(g,e,'trialPrismBreak');audio.consume(g);await flush();assert.equal(audio.diagnostics.startedByName.trialPrismBreak,1,'interrupt replaces low combat voice under full bus');assert.ok(audio.diagnostics.voices<=4);
time+=1;audio.reset(g);audio.play('orb');await flush();
const manifest=JSON.parse(await fs.readFile(new URL('../output/sensory-rework/audio-manifest.json',import.meta.url),'utf8'));
const pulseDuration=manifest.files.find(f=>f.file.endsWith('clean-pulse.m4a')).duration;
time+=pulseDuration;sources.at(-1).onended();assert.equal(audio.diagnostics.voices,0);
emitTrialAudio(g,e,'trialShieldSlash');audio.consume(g);await flush();const shortCount=audio.diagnostics.startedByName.trialShieldSlash;assert.equal(shortCount,3,'impact crosses cooldown after short pulse naturally ends');
time+=.016;emitTrialAudio(g,e,'trialShieldSlash');audio.consume(g);await flush();assert.equal(audio.diagnostics.startedByName.trialShieldSlash,shortCount,'same sample cooldown survives priority bypass');
g.phase='paused';audio.consume(g);emitTrialAudio(g,e,'trialShieldSlash');g.phase='playing';audio.consume(g);await flush();assert.equal(audio.diagnostics.voices,0);
emitTrialAudio(g,e,'trialShieldSlash');hidden=true;visibility();hidden=false;audio.consume(g);await flush();assert.equal(audio.diagnostics.voices,0);
time+=1;emitTrialAudio(g,e,'trialShieldSlash');audio.consume(g);await flush();e.dead=true;audio.consume(g);assert.equal(audio.diagnostics.voices,0,'owner death stops voice');
e.dead=false;for(let i=0;i<1000;i++)emitTrialAudio(g,e,'trialRiftMark');assert.equal(drainTrialAudio(g).length,32,'bounded while off');
const pendingResolvers=[];decode=()=>new Promise(r=>pendingResolvers.push(r));const pending=createAudioEngine();e.dead=false;pending.reset(g);const ready=pending.setEnabled(true);await flush();emitTrialAudio(g,e,'trialShieldSlash');pending.consume(g);e.dead=true;clearTrialOwned(g,e.id);e.dead=false;for(const r of pendingResolvers)r({duration:.3});await ready;await flush();assert.equal(pending.diagnostics.voices,0,'death then same-object revival invalidates pending decode');
decode=null;
console.log('Trial audio production events and lifecycle passed (mock WebAudio; real decode separate).');
