import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {EffectsPlayer,SFX_MIX} from '../dist/js/effects-player.js';
import {EFFECT_MANIFEST} from '../dist/js/effect-manifest.js';
import {CARDS} from '../dist/js/cards.js';
const checks=[];function check(value,name){assert.ok(value,name);checks.push(name);}
let created=[];
const gain=()=>({gain:{value:1},connect(){},disconnect(){}});
class Context{constructor(){this.state='running';this.destination={};}createGain(){return gain();}createDynamicsCompressor(){return Object.fromEntries(['threshold','knee','ratio','attack','release'].map(k=>[k,{value:0}]).concat([['connect',()=>{}]]));}createBufferSource(){const source={connect(){},disconnect(){},start(){created.push(this);},stop(){}};return source;}}
class Voice{constructor(path){this.path=path;}load(){}removeAttribute(){}cloneNode(){return new Voice(this.path);}play(){return Promise.resolve();}pause(){}}
globalThis.AudioContext=Context;globalThis.Audio=Voice;
const renderer={motionPreference:{matches:false},state:{units:[]},atlases:new Map(),facings:new Map(),paint(){},requestPaint(){}};
const e=new EffectsPlayer(renderer);e.prepareSound=()=>{};
for(const card of Object.values(CARDS).filter(c=>c.spriteFrom))check(e.bodySounds(card.id)===EFFECT_MANIFEST.bodies[card.spriteFrom].sounds,`variant ${card.id} resolves explicit original ${card.spriteFrom}`);
const unitSound=EFFECT_MANIFEST.bodies[14].sounds.attack,spellSound=EFFECT_MANIFEST.spellSounds[20044];
for(const key of [unitSound,spellSound])e.audioBuffers.set(EFFECT_MANIFEST.sounds[key],{});
e.playSound(unitSound);check(created.length===1 && created[0].loop===false,'WebAudio plays original resource once without loop');
e.playSound(unitSound);check(created.length===1,'duplicate same resource within 60ms suppressed');
e.soundStarts.clear();e.playSound(unitSound);e.soundStarts.clear();e.playSound(unitSound);check(created.length===2,'same resource concurrent maximum two');
e.finish();e.playSound(spellSound,{kind:'spell'});check(e.soundDetails.get(created.at(-1)).gain===.7,'spell voice softened without replacing its source');
check(e.soundGain.gain.value===.42 && e.soundCompressor.threshold.value===-12 && e.soundCompressor.ratio.value===6,'WebAudio overall mix and compressor configured');
e.setSoundVolume(.5);check(e.soundGain.gain.value===.21,'user effects slider scales mix');e.setSoundVolume(0);const count=created.length;e.playSound(unitSound);check(created.length===count && e.soundGain.gain.value===0,'mute blocks new voices and silences active gain');
e.finish();e.setSoundVolume(1);for(const key of Object.keys(EFFECT_MANIFEST.sounds).slice(0,12)){e.audioBuffers.set(EFFECT_MANIFEST.sounds[key],{});e.playSound(key);}check(e.activeSounds.size===6,'WebAudio concurrent voices bounded at six');
e.finish();e.audioContext=null;e.playSound(spellSound,{kind:'spell'});const media=[...e.activeSounds][0];check(media.volume===.42*.7 && media.loop===false,'media fallback same softened spell mix, no loop');e.setSoundVolume(.5);check(media.volume===.5*.42*.7,'media slider preserves spell mix');e.setSoundVolume(0);check(media.volume===0,'media mute silences live voice');e.finish();e.setSoundVolume(1);
for(const key of Object.keys(EFFECT_MANIFEST.sounds).slice(0,12))e.playSound(key);check(e.activeSounds.size===6,'media fallback also bounded at six');e.finish();
const calls=[];e.playSound=(sound,options)=>calls.push({sound,options});
const before=[{unitId:1,cardId:1,x:0,y:0,health:25},{unitId:2,cardId:14,x:1,y:0,health:4},{unitId:3,cardId:9,x:2,y:0,health:3}];renderer.state.units=[before[0],{...before[1],health:2}];
e.play({kind:'spell',cardId:20044,sourceId:1,targetIds:[2,3],effect:'tempest'},before);check(calls.filter(c=>c.sound===spellSound).length===1,'multi-target spell apply sound once');check(calls.some(c=>c.sound===EFFECT_MANIFEST.bodies[14].sounds.receiveDamage),'spell survivor uses own original hit');check(calls.some(c=>c.sound===EFFECT_MANIFEST.bodies[9].sounds.death),'spell casualty uses own original death');e.finish();
e.play({kind:'summon',cardId:14,sourceId:2},[before[0]]);check(calls.at(-1).sound===EFFECT_MANIFEST.bodies[14].sounds.apply,'summon uses original per-unit apply');e.finish();
const originalManifest=e.manifest;e.manifest={...originalManifest,recipes:{},cardRecipes:{},bodies:{...originalManifest.bodies,1:{...originalManifest.bodies[1],attackDelayMs:0}}};
const start=calls.length;e.play({kind:'attack',cardId:1,sourceId:1,targetIds:[2]},before);await new Promise(resolve=>setTimeout(resolve,15));const attackCalls=calls.slice(start).map(c=>c.sound);
check(attackCalls.includes(EFFECT_MANIFEST.bodies[1].sounds.attack),'attack uses original swing');check(attackCalls.includes(EFFECT_MANIFEST.bodies[1].sounds.attackDamage),'attack uses original impact');check(attackCalls.includes(EFFECT_MANIFEST.bodies[14].sounds.receiveDamage),'attack target uses original receiveDamage');e.finish();e.manifest=originalManifest;
const turnStart=calls.length;e.play({kind:'end-turn',targetIds:[2]},before);check(calls.slice(turnStart).some(c=>c.sound===EFFECT_MANIFEST.bodies[14].sounds.receiveDamage),'turn damage uses original receiveDamage');e.finish();
renderer.motionPreference.matches=true;const previous=calls.length;await e.play({kind:'spell',cardId:20044,sourceId:1,targetIds:[2,3],effect:'tempest'},before);check(!e.playback && calls.slice(previous).filter(c=>c.sound===spellSound).length===1,'reduced motion spell sound once without visual playback');const reducedStart=calls.length;await e.play({kind:'attack',cardId:1,sourceId:1,targetIds:[2]},before);check(calls.slice(reducedStart).some(c=>c.sound===EFFECT_MANIFEST.bodies[1].sounds.attackDamage),'reduced motion attack retains impact sound');const reducedTurn=calls.length;await e.play({kind:'end-turn',targetIds:[2]},before);check(calls.slice(reducedTurn).some(c=>c.sound===EFFECT_MANIFEST.bodies[14].sounds.receiveDamage),'reduced motion turn damage retains sound');const settled=calls.length;await new Promise(resolve=>setTimeout(resolve,25));check(calls.length===settled && !e.playback,'reduced motion creates no delayed duplicate sound or playback');e.playMovementSound(23);check(calls.at(-1).sound===EFFECT_MANIFEST.bodies[23].sounds.walk,'movement audio remains independent of reduced motion');
const out=new URL('../output/ui-refinement/audio/',import.meta.url);await mkdir(out,{recursive:true});await writeFile(new URL('playback-checks.json',out),JSON.stringify({mix:SFX_MIX,checks,coverage:'Instrumented WebAudio/media and action scheduling. No loudspeaker or TapTap host listening verification.'},null,2));console.log(`Passed ${checks.length} audio behavior checks.`);
