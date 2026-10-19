import { drainTrialAudio, discardTrialAudio, trialAudioValid } from './trial-audio.js';
const AudioContextClass = window.AudioContext || window.webkitAudioContext;

const SAMPLE_FILES = Object.freeze({
  slash:'./assets/audio/clean-slash.m4a', pulse:'./assets/audio/clean-pulse.m4a', hurt:'./assets/audio/clean-hurt.m4a',
  pickup:'./assets/audio/clean-pickup.m4a', select:'./assets/audio/clean-select.m4a',
  upgrade:'./assets/audio/clean-upgrade.m4a', evolution:'./assets/audio/clean-evolution.m4a', win:'./assets/audio/clean-win.m4a', lose:'./assets/audio/clean-lose.m4a',
  trialShieldReady:'./assets/audio/trial-shield-ready.m4a',trialShieldSlash:'./assets/audio/trial-shield-slash.m4a',trialWindCharge:'./assets/audio/trial-wind-charge.m4a',trialWindDash:'./assets/audio/trial-wind-dash.m4a',trialWindLand:'./assets/audio/trial-wind-land.m4a',trialSoulBind:'./assets/audio/trial-soul-bind.m4a',trialSoulPulse:'./assets/audio/trial-soul-pulse.m4a',trialSoulBreak:'./assets/audio/trial-soul-break.m4a',trialRiftMark:'./assets/audio/trial-rift-mark.m4a',trialRiftBurst:'./assets/audio/trial-rift-burst.m4a',trialRiftCut:'./assets/audio/trial-rift-cut.m4a',trialPrismIn:'./assets/audio/trial-prism-in.m4a',trialPrismOut:'./assets/audio/trial-prism-out.m4a',trialPrismCharge:'./assets/audio/trial-prism-charge.m4a',trialPrismBreak:'./assets/audio/trial-prism-break.m4a',
});
// Two short combat voices, one sparse pickup, and one important/UI cue.
const SOUND_CONFIG = Object.freeze({
  trialShieldReady:{sample:'trialShieldReady',gain:.7,maxVoices:2,bus:'combat',interval:.3,priority:1},trialShieldSlash:{sample:'trialShieldSlash',gain:.7,maxVoices:2,bus:'combat',interval:.3,priority:3},trialWindCharge:{sample:'trialWindCharge',gain:.7,maxVoices:2,bus:'combat',interval:.3,priority:1},trialWindDash:{sample:'trialWindDash',gain:.7,maxVoices:2,bus:'combat',interval:.3,priority:3},trialWindLand:{sample:'trialWindLand',gain:.7,maxVoices:2,bus:'combat',interval:.3,priority:3},trialSoulBind:{sample:'trialSoulBind',gain:.7,maxVoices:2,bus:'combat',interval:.3,priority:1},trialSoulPulse:{sample:'trialSoulPulse',gain:.7,maxVoices:2,bus:'combat',interval:.3,priority:3},trialSoulBreak:{sample:'trialSoulBreak',gain:.7,maxVoices:2,bus:'combat',interval:.3,priority:3},trialRiftMark:{sample:'trialRiftMark',gain:.7,maxVoices:2,bus:'combat',interval:.3,priority:1},trialRiftBurst:{sample:'trialRiftBurst',gain:.7,maxVoices:2,bus:'combat',interval:.3,priority:3},trialRiftCut:{sample:'trialRiftCut',gain:.7,maxVoices:2,bus:'combat',interval:.3,priority:3},trialPrismIn:{sample:'trialPrismIn',gain:.7,maxVoices:2,bus:'combat',interval:.3,priority:3},trialPrismOut:{sample:'trialPrismOut',gain:.7,maxVoices:2,bus:'combat',interval:.3,priority:3},trialPrismCharge:{sample:'trialPrismCharge',gain:.7,maxVoices:2,bus:'combat',interval:.3,priority:1},trialPrismBreak:{sample:'trialPrismBreak',gain:.7,maxVoices:2,bus:'combat',interval:.3,priority:3},
  ...Object.fromEntries(['windblade','cleave','bossCleave','dash','bossCharge','quickCut','dagger','bladeCut','bladeWave','markBlade'].map(name=>[name,{sample:'slash',gain:.75,maxVoices:2,bus:'combat',interval:.30,priority:0}])),
  ...Object.fromEntries(['orb','lightning','nova','mine','rockRise','groundSlam','summon','summonElite','teleport','teleportCombo','recall','shield'].map(name=>[name,{sample:'pulse',gain:.65,maxVoices:2,bus:'combat',interval:.45,priority:1}])),
  ...Object.fromEntries(['cleave','dash','quickCut','swordField','whirlwind','teleport','teleportCombo','summonElite','flameBreath'].map(name=>[name,{sample:name==='dash'||name==='quickCut'?'slash':'pulse',gain:.85,maxVoices:1,bus:'important',interval:.5,priority:2}])),
  ...Object.fromEntries(['bossCleave','bossCharge','groundSlam'].map(name=>[name,{sample:'pulse',gain:.9,maxVoices:1,bus:'important',interval:.6,priority:3}])),
  pickup:{sample:'pickup',gain:.65,maxVoices:1,bus:'pickup',interval:.65,priority:0}, supply:{sample:'pickup',gain:.8,maxVoices:1,bus:'pickup',interval:.65,priority:1},
  hurt:{sample:'hurt',gain:.75,maxVoices:1,bus:'important',interval:.8,priority:2},
  select:{sample:'select',gain:.6,maxVoices:1,bus:'important',interval:.12,priority:1,ui:true},
  upgrade:{sample:'upgrade',gain:.8,maxVoices:1,bus:'important',interval:.6,priority:4,ui:true},
  evolution:{sample:'evolution',gain:.85,maxVoices:1,bus:'important',interval:.8,priority:5,ui:true},
  win:{sample:'win',gain:.85,maxVoices:1,bus:'important',interval:.8,priority:5,ui:true}, lose:{sample:'lose',gain:.75,maxVoices:1,bus:'important',interval:.8,priority:5,ui:true},
});

export function createAudioEngine() {
  let context=null, master=null, enabled=false, currentGame=null, gameGeneration=0, uiGeneration=0, enableSequence=0;
  let seenEffects=new WeakSet(), seenProjectiles=new WeakSet(), seenEnemyShots=new WeakSet();
  let previousHp=0, orbitSerial=0, feedbackTotals={}, lastPhase=null;
  const bytePromises=new Map(), decodedPromises=new Map(), voices=new Set(), voicesBySample=new Map(), cooldowns=new Map();
  const ownedEffects=new Map(), decodedKeys=new Set(), decodeErrors=new Map();
  let importantTicket=null;const startedCounts={}, rejectedCounts={};
  const MAX_VOICES=4, BUS_LIMITS={combat:2,pickup:1,important:1};

  function withDeadline(promise,timeoutMs,message,onTimeout){
    return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{try{onTimeout?.();}finally{reject(new Error(message));}},timeoutMs);
      Promise.resolve(promise).then(value=>{clearTimeout(timeout);resolve(value);},error=>{clearTimeout(timeout);reject(error);});});
  }
  function setup(){
    if(context||!AudioContextClass)return Boolean(context);context=new AudioContextClass();
    const compressor=context.createDynamicsCompressor();compressor.threshold.value=-20;compressor.knee.value=18;
    compressor.ratio.value=7;compressor.attack.value=.004;compressor.release.value=.18;
    master=context.createGain();master.gain.value=.28;master.connect(compressor);compressor.connect(context.destination);return true;
  }
  function fetchSample(key){
    if(bytePromises.has(key))return bytePromises.get(key);const controller=new AbortController();
    const request=fetch(new URL(SAMPLE_FILES[key],import.meta.url),{signal:controller.signal}).then(response=>{
      if(!response.ok)throw new Error(`Audio load failed (${response.status}): ${SAMPLE_FILES[key]}`);return response.arrayBuffer();});
    const promise=withDeadline(request,30000,`Audio load timed out: ${SAMPLE_FILES[key]}`,()=>controller.abort());
    bytePromises.set(key,promise);promise.catch(()=>{if(bytePromises.get(key)===promise)bytePromises.delete(key);});return promise;
  }
  async function preload(onProgress){
    const keys=Object.keys(SAMPLE_FILES);let loaded=0,loadedBytes=0;onProgress?.({loaded,total:keys.length,loadedBytes});
    await Promise.all(keys.map(async key=>{const bytes=await fetchSample(key);loaded++;loadedBytes+=bytes.byteLength;onProgress?.({loaded,total:keys.length,loadedBytes});}));
  }
  function decodeSample(key){
    if(decodedPromises.has(key))return decodedPromises.get(key);
    const promise=fetchSample(key).then(bytes=>withDeadline(context.decodeAudioData(bytes.slice(0)),15000,`Audio decode timed out: ${SAMPLE_FILES[key]}`)).then(buffer=>{decodedKeys.add(key);decodeErrors.delete(key);return buffer;});
    decodedPromises.set(key,promise);promise.catch(error=>{decodeErrors.set(key,String(error));if(decodedPromises.get(key)===promise)decodedPromises.delete(key);});return promise;
  }
  function allowed(config,interval=0){
    const sample=config.sample;
    if(!enabled||!context||context.state!=='running'||document.hidden||(!config.ui&&currentGame?.phase!=='playing')||
      [...voices].filter(v=>v.sample===sample&&v.bus===config.bus).length>=config.maxVoices&&config.bus!=='important')return false;
    const now=context.currentTime, busKey=`bus:${config.bus}`;
    const trialImpact=config.bus==='combat'&&config.priority===3;
    const urgent=(trialImpact&&((cooldowns.get('combatPriority')||0)<3||[...voices].some(v=>v.bus==='combat'&&v.priority<3)))||config.bus==='important'&&[...voices].some(v=>v.bus==='important'&&v.priority<config.priority);
    if(((trialImpact||!urgent)&&now<(cooldowns.get(`${config.bus}:${sample}`)||0))||(!urgent&&now<(cooldowns.get(busKey)||0)))return false;
    const busVoices=[...voices].filter(v=>v.bus===config.bus);
    if(busVoices.length>=BUS_LIMITS[config.bus]){
      const victim=busVoices.filter(v=>!v.stopping&&(v.priority||0)<(config.priority||0)).sort((a,b)=>a.started-b.started)[0];
      if(!victim)return false;stopVoice(victim,0);finishVoice(victim);
    }
    cooldowns.set(`${config.bus}:${sample}`,now+Math.max(interval,config.interval));
    if(config.bus==='combat')cooldowns.set('combatPriority',config.priority||0);
    cooldowns.set(busKey,now+(config.bus==='combat'?.30:config.bus==='pickup'?config.interval:.12));return true;
  }
  function finishVoice(record){
    if(record.finished)return;record.finished=true;voices.delete(record);
    voicesBySample.set(record.sample,Math.max(0,(voicesBySample.get(record.sample)||1)-1));
    if(record.owner&&ownedEffects.get(record.owner)===record)ownedEffects.delete(record.owner);
    try{record.source.disconnect();record.gain.disconnect();}catch{}
  }
  function stopVoice(record,fade=.08){
    if(!record||record.finished||record.stopping||!record.source)return;record.stopping=true;const now=context.currentTime;
    try{record.gain.gain.cancelScheduledValues(now);record.gain.gain.setTargetAtTime(.0001,now,Math.max(.01,fade/3));record.source.stop(now+fade);}catch{}
  }
  function stopOwnedEffects(){
    for(const record of ownedEffects.values()){record.cancelled=true;stopVoice(record);}
    for(const record of voices)if(record.owner)stopVoice(record);
    ownedEffects.clear();
  }
  function stopAllVoices(){
    importantTicket=null;stopOwnedEffects();for(const record of [...voices]){stopVoice(record,0);finishVoice(record);}
  }
  function play(name,interval=0,owner=null){
    const config=SOUND_CONFIG[name],decoded=config&&decodedPromises.get(config.sample);if(!config||!decoded)return;
    const reject=()=>{rejectedCounts[config.bus]=(rejectedCounts[config.bus]||0)+1;};
    const ticket={priority:config.priority||0};
    if(config.bus==='important'){if(importantTicket&&importantTicket.priority>=ticket.priority){reject();return;}importantTicket=ticket;}
    const generation=config.ui?uiGeneration:gameGeneration,pending=owner?{owner,cancelled:false,source:null}:null;if(owner)ownedEffects.set(owner,pending);
    decoded.then(buffer=>{
      if(config.bus==='important'){if(importantTicket!==ticket){if(owner&&ownedEffects.get(owner)===pending)ownedEffects.delete(owner);reject();return;}importantTicket=null;}
      if((owner?.trialEvent&&!trialAudioValid(currentGame,owner.trialEvent))||pending?.cancelled||generation!==(config.ui?uiGeneration:gameGeneration)||(owner&&ownedEffects.get(owner)!==pending)||!allowed(config,interval)){
        if(owner&&ownedEffects.get(owner)===pending)ownedEffects.delete(owner);reject();return;
      }
      const source=context.createBufferSource(),gain=context.createGain(),record=pending||{owner:null,cancelled:false};
      Object.assign(record,{name,group:config.bus,source,gain,sample:config.sample,finished:false,priority:config.priority||0,ui:Boolean(config.ui),bus:config.bus,started:context.currentTime});source.buffer=buffer;gain.gain.value=config.gain;
      source.connect(gain);gain.connect(master);voices.add(record);voicesBySample.set(config.sample,(voicesBySample.get(config.sample)||0)+1);
      source.onended=()=>finishVoice(record);source.start();startedCounts[name]=(startedCounts[name]||0)+1;
    }).catch(()=>{if(importantTicket===ticket)importantTicket=null;if(owner&&ownedEffects.get(owner)===pending)ownedEffects.delete(owner);});
  }
  function reset(game){
    discardTrialAudio(game);gameGeneration++;uiGeneration++;stopAllVoices();cooldowns.clear();currentGame=game;seenEffects=new WeakSet();seenProjectiles=new WeakSet();seenEnemyShots=new WeakSet();
    for(const item of game?.effects||[])seenEffects.add(item);for(const item of game?.projectiles||[])seenProjectiles.add(item);
    for(const item of game?.enemyProjectiles||[])seenEnemyShots.add(item);
    for(const item of [...(game?.commonEntities||[]),...(game?.heroKit?.projectiles||[])])seenProjectiles.add(item);
    for(const item of [...(game?.commonEffects||[]),...(game?.heroEffects||[])])seenEffects.add(item);
    previousHp=game?.player?.hp||0;orbitSerial=game?.orbitHitSerial||0;feedbackTotals={...(game?.combatFeedback?.totals||{})};lastPhase=game?.phase;
  }
  function consume(game){
    if(game!==currentGame)reset(game);
    if(game?.phase!==lastPhase){
      const normalResume=lastPhase==='upgrade_resume'&&game?.phase==='playing';
      gameGeneration++;
      if(normalResume){for(const record of [...voices])if(!record.ui){stopVoice(record,0);finishVoice(record);}}
      else {uiGeneration++;stopAllVoices();cooldowns.clear();}
      lastPhase=game?.phase;
    }
    const activeEffects=new Set([...(game?.effects||[]),...(game?.commonEntities||[]),...(game?.jobMechanics?.whirlwind?[game.jobMechanics.whirlwind]:[])]);
    for(const [effect,record] of ownedEffects)if(effect.trialEvent?!trialAudioValid(game,effect.trialEvent,!record.source):!activeEffects.has(effect)){
      ownedEffects.delete(effect);
      if(effect.trialEvent||(effect.life??0)>0){record.cancelled=true;stopVoice(record);}
    }
    // Evolution can arrive while its selection panel transitions back to combat.
    if((game?.combatFeedback?.totals?.evolution||0)>(feedbackTotals.evolution||0))play('evolution',.6);
    if(!enabled||!context||context.state!=='running'||document.hidden||game?.phase!=='playing'){
      if(document.hidden||!enabled||context?.state!=='running')stopAllVoices();
      else for(const record of [...voices])if(!record.ui){stopVoice(record,0);finishVoice(record);}
      for(const item of game?.effects||[])seenEffects.add(item);for(const item of game?.projectiles||[])seenProjectiles.add(item);
      for(const item of game?.enemyProjectiles||[])seenEnemyShots.add(item);
      for(const item of [...(game?.commonEntities||[]),...(game?.heroKit?.projectiles||[])])seenProjectiles.add(item);
      for(const item of [...(game?.commonEffects||[]),...(game?.heroEffects||[])])seenEffects.add(item);
      discardTrialAudio(game);previousHp=game?.player?.hp??previousHp;orbitSerial=game?.orbitHitSerial??orbitSerial;feedbackTotals={...(game?.combatFeedback?.totals||{})};return;
    }
    // Select the highest consequence fact before any decode callback runs.
    const trialEvents=drainTrialAudio(game).filter(event=>trialAudioValid(game,event)).sort((a,b)=>(SOUND_CONFIG[b.name]?.priority||0)-(SOUND_CONFIG[a.name]?.priority||0));
    if(trialEvents.length)play(trialEvents[0].name,0,{trialEvent:trialEvents[0]});
    const whirlwind=game.jobMechanics?.whirlwind;
    if(whirlwind&&!seenEffects.has(whirlwind)){seenEffects.add(whirlwind);play('whirlwind',0,whirlwind);}
    // Aggregate new combat facts once per frame; never spawn one long voice per enemy.
    const totals=game.combatFeedback?.totals||{}, delta=type=>Math.max(0,(totals[type]||0)-(feedbackTotals[type]||0));
    if(delta('hurt'))play('hurt',.25);
    if(delta('supply'))play('supply',.15);
    if(delta('pickup'))play('pickup',.14);
    // Ordinary hits and kills are visual facts; extra impact/death layers masked the attack rhythm.
    feedbackTotals={...totals};
    for(const effect of game.heroEffects||[])if(!seenEffects.has(effect)){
      seenEffects.add(effect);
      if(['newHero','mythicHero'].includes(effect.visualKind)){
        // A cast/attack supplies one cue; moving weapons and persistent fields stay quiet.
        if(effect.sound&&['bladeCut','orb','teleport','groundSlam'].includes(effect.sound))play(effect.sound,.3);
      }else if(effect.shape==='sector')play('windblade',.12);
    }
    for(const shot of game.heroKit?.projectiles||[])if(!seenProjectiles.has(shot)){
      seenProjectiles.add(shot);play(shot.kind==='blade'?'bladeCut':'orb',.2);
    }
    for(const item of game.commonEntities||[])if(!seenProjectiles.has(item)){
      seenProjectiles.add(item);
      if(item.kind==='boomerang')play('dagger',.15);
      else if(item.kind==='homing'||item.kind==='bolt')play('orb',.18);
      else if(item.weapon==='vortex'&&item.kind==='zone'){}
      else if(item.weapon==='frost'&&item.kind==='zone'){}
    }
    for(const effect of game.commonEffects||[])if(!seenEffects.has(effect)){
      seenEffects.add(effect);
      if(effect.weapon==='nova')play('nova',.25);
      else if(effect.weapon==='mine'&&effect.phase!=='chain')play('mine',.22);
      else if(effect.weapon==='lightning'&&effect.shape==='line')play('lightning',.3);
      else if(effect.weapon==='aegis'&&effect.life>1)play('shield',.4);
      else if(effect.weapon==='meteor'&&!effect.telegraph)play('groundSlam',.3);
      else if(effect.weapon==='beam')play('bladeWave',.4);
    }
    let playedRecall=false;
    for(const effect of game.effects||[]){
      if(seenEffects.has(effect))continue;seenEffects.add(effect);
      if(effect.type==='windblade')play('windblade',.075);
      else if(effect.type==='cleave')play(effect.bladeWave?'bladeWave':effect.whirlwind?'whirlwind':'cleave',.16);
      else if(effect.type==='dash')play(effect.quickCut?'quickCut':'dash',.16);
      else if(effect.type==='lightning')play('lightning',.18);
      else if(effect.type==='frostAura')play('frost',.4);
      else if(effect.type==='swordField')play(effect.guard?'shield':'swordField',.45,effect.guard?null:effect);
      else if(effect.type==='summon')play(effect.elite?'summonElite':'summon',.18);
      else if(effect.type==='recall'&&effect.companionId!=null&&!playedRecall){play('recall',.3);playedRecall=true;}
      else if(effect.type==='blinkStart')play(effect.skillId==='blinkStorm'?'teleportCombo':'teleport');
      else if(effect.type==='poisonField')play('poison',.3,effect);
      else if(effect.type==='flameBreath')play('flameBreath',.4,effect);
      else if(effect.type==='rockWall')play('rockRise',.35);
      else if(effect.type==='bossCleave')play('bossCleave',.18);
      else if(effect.type==='bossCharge')play('bossCharge',.24);
      else if(effect.type==='bossSlam')play('groundSlam',.3);
    }
    for(const shot of game.projectiles||[])if(!seenProjectiles.has(shot)){
      seenProjectiles.add(shot);if(shot.weapon==='orb')play('orb',.09);else if(shot.weapon==='dagger')play('dagger',.12);else if(shot.weapon==='markBlade')play('markBlade',.12);
    }
    for(const shot of game.enemyProjectiles||[])if(!seenEnemyShots.has(shot))seenEnemyShots.add(shot);
    if((game.orbitHitSerial||0)!==orbitSerial){orbitSerial=game.orbitHitSerial||0;play('bladeCut',.12);}
    previousHp=game.player?.hp??previousHp;
  }
  async function setEnabled(value){
    discardTrialAudio(currentGame);
    const sequence=++enableSequence;enabled=Boolean(value);if(!enabled){discardTrialAudio(currentGame);gameGeneration++;uiGeneration++;stopAllVoices();if(master&&context)master.gain.setTargetAtTime(.0001,context.currentTime,.015);return false;}
    if(!setup()){enabled=false;return false;}try{
      const resume=withDeadline(context.resume(),5000,'Audio context resume timed out');await Promise.all([resume,...Object.keys(SAMPLE_FILES).map(decodeSample)]);
      if(sequence!==enableSequence||!enabled)return false;
      master.gain.cancelScheduledValues(context.currentTime);master.gain.setTargetAtTime(.28,context.currentTime,.015);return true;
    }catch{if(sequence===enableSequence)enabled=false;return false;}
  }
  document.addEventListener?.('visibilitychange',()=>{if(document.hidden){discardTrialAudio(currentGame);gameGeneration++;uiGeneration++;stopAllVoices();cooldowns.clear();}});
  return{consume,play,preload,reset,setEnabled,get diagnostics(){return {voices:voices.size,maxVoices:MAX_VOICES,buses:Object.fromEntries(Object.keys(BUS_LIMITS).map(bus=>[bus,[...voices].filter(v=>v.bus===bus).length])),started:Object.values(startedCounts).reduce((n,x)=>n+x,0),startedByName:{...startedCounts},startedByGroup:Object.fromEntries(Object.keys(BUS_LIMITS).map(bus=>[bus,Object.entries(startedCounts).reduce((n,[name,x])=>n+(SOUND_CONFIG[name]?.bus===bus?x:0),0)])),rejectedByGroup:{...rejectedCounts},samples:Object.keys(SAMPLE_FILES).length,decoded:decodedKeys.size,decodeErrors:Object.fromEntries(decodeErrors)};},get enabled(){return enabled;}};
}
