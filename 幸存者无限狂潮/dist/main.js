import { vfxAssets } from './vfx-assets.js';
import { WEAPONS } from './combat-content.js';
import { HERO_PERKS, getHeroIdentity } from './hero-kit.js';
import { getAttackProgressionInfo } from './attack-progression.js';
import { getJobCombat } from './profession-content.js';
import { getCombatStats } from './combat-stats.js';
import { unitAssets } from './assets.js';
import { createGame, configureRun, startGame, updateGame, chooseUpgrade, togglePause, castSkill, getSkillState, canRevive, reviveGame, canRerollUpgrade, rerollUpgrade } from './simulation.js';
import { createRenderer } from './renderer.js';
import { loadProfile, DUNGEONS, UNITS, getExpedition, settleRun, isUnlocked } from './campaign.js';
import { createCampaignUI } from './campaign-ui.js';
import { createAudioEngine } from './audio.js';
import { getFrostAimRange, getFrostTarget } from './skill-targeting.js';
import { skillArtFor } from './skill-art.js';
import { createCloudSaveUI } from './cloud-save-ui.js';
import { createDailyCheckinUI } from './daily-checkin.js';
import { AdGoldBonus, RewardedAd } from './rewarded-ad.js';
import { getUnlockedCommonIds } from './common-unlocks.js';
import { getCommonEvolutionState, GROWTH_STATS } from './growth.js';

const $ = id => document.getElementById(id);
const canvas = $('battle');
const dialogs = ['upgrade-dialog','pause-dialog','result-dialog','revive-dialog','confirm-dialog','about-dialog','cloud-save-dialog','daily-dialog'];
const keys = new Set();
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const touchOnly = matchMedia('(pointer: coarse) and (hover: none)');
const hasFinePointer = matchMedia('(any-pointer: fine)');
const mobileDevice = navigator.userAgentData?.mobile === true || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const appViewport={width:innerWidth,height:innerHeight,left:0,top:0,portrait:false};
const safeProbe=document.createElement('div');
safeProbe.style.cssText='position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
document.body.append(safeProbe);
function syncViewport() {
  const viewport=window.visualViewport, width=Math.round(viewport?.width || innerWidth), height=Math.round(viewport?.height || innerHeight);
  const phone=mobileDevice && touchOnly.matches && !hasFinePointer.matches;
  const ios=/iPhone|iPod/i.test(navigator.userAgent), landscape=width>height;
  const safe=getComputedStyle(safeProbe), inset=side=>parseFloat(safe.getPropertyValue('padding-'+side))||0;
  // Keep host controls above the entire game. Some embedded iOS views report zero safe insets.
  const left=phone?Math.max(inset('left'),ios&&landscape?44:0):0;
  const right=phone?Math.max(inset('right'),ios&&landscape?44:0):0;
  const top=phone&&!landscape?Math.max(60,inset('top')):0;
  const bottom=phone&&!landscape?Math.max(inset('bottom'),ios?21:0):0;
  appViewport.left=(viewport?.offsetLeft||0)+left;appViewport.top=(viewport?.offsetTop||0)+top;
  appViewport.width=Math.max(1,width-left-right);appViewport.height=Math.max(1,height-top-bottom);appViewport.portrait=height>width;
  const style=document.documentElement.style;
  // Menu controls avoid the host capsule and home indicator without cropping the battlefield.
  style.setProperty('--host-menu-reserve',phone && landscape?'112px':'0px');
  style.setProperty('--menu-bottom-inset',`${phone && landscape?Math.max(inset('bottom'),ios?18:0):0}px`);
  for(const [key,value] of Object.entries({width:appViewport.width,height:appViewport.height,left:appViewport.left,top:appViewport.top}))style.setProperty('--app-'+key,`${value}px`);
  document.documentElement.classList.toggle('safe-compact',phone && appViewport.height<=340);
}

syncViewport();
// A narrow desktop panel is resizable, not a phone that needs to be rotated.
function needsLandscape() { return mobileDevice && touchOnly.matches && !hasFinePointer.matches && appViewport.portrait; }
let game = createGame(), renderer, last = performance.now(), lastPhase = '', choiceKey = '';
let stick = null, movement = {x:0,y:0}, sound = false, soundBusy = false, confirmAction;
const audioEngine = createAudioEngine();
let weaponSignature = '';
let upgradeClosing=false,upgradeOpenedAt=0,upgradeEpoch=0;
let upgradeTouchClickUntil=0;
let pauseAfterUpgrade=false;
const skillButtons = new Map();
let skillAimPointer=null;
const movementPhases=['playing','upgrade_slowdown','upgrade','upgrade_resume'];
function canMove(){return movementPhases.includes(game.phase) && !tacticalRequest && !pauseAfterUpgrade && !document.hidden && !needsLandscape() && !dialogs.some(id=>id!=='upgrade-dialog' && $(id).open);}
const loadedProfile = loadProfile();
let profile = loadedProfile.profile, campaignUI, selectedDungeon = DUNGEONS[0].id, settlement = null;
let cloudSaveUI,dailyCheckinUI;
const adGold=new AdGoldBonus({getContext:()=>({profile,runId:game.runId,gameRef:game,resultVisible:$('result-dialog').open&&['victory','defeat'].includes(game.phase),settlementOk:!!settlement?.ok})});
const tacticalAd=new RewardedAd();
let tacticalRequest=null;
const tacticalAvailable=()=>tacticalAd.available&&!tacticalAd.blocked;

function timeLabel(seconds) { const s = Math.floor(seconds); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }
function closeDialog(id) { if ($(id).open) $(id).close(); }
function closeAll() { adGold.cancel();cancelTacticalAd();upgradeEpoch++; upgradeClosing=false; pauseAfterUpgrade=false; for (const id of dialogs) closeDialog(id); }
function clearStick() {
  const pointerId=stick?.id;
  stick=null; movement={x:0,y:0};
  // WebViews may lose the pointer between the capture query and release.
  try{if(pointerId!==undefined && canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);}catch{}
  $('joystick').classList.remove('active'); $('stick-knob').style.transform='';
  $('joystick').style.left=''; $('joystick').style.top=''; $('joystick').style.bottom='';
}
function clearInput(clearSkills=true) {
  keys.clear();clearStick();
  if(clearSkills)clearSkillAim();
}
function moveStick(clientX,clientY) {
  if(!stick)return;
  const dx=clientX-stick.x,dy=clientY-stick.y,d=Math.hypot(dx,dy),limit=34;
  const amount=Math.min(1,d/limit);movement=d>5?{x:dx/d*amount,y:dy/d*amount}:{x:0,y:0};
  $('stick-knob').style.transform=`translate(${movement.x*limit}px,${movement.y*limit}px)`;
}
function degradeStickCapture() {
  if(stick?.type==='touch' && stick.touchId!==null){stick.mode='touch';movement={x:0,y:0};$('stick-knob').style.transform='';}
  else clearStick();
}
function newRun(dungeonId = selectedDungeon) {
  if(adGold.busy||tacticalRequest)return;
  if (typeof dungeonId !== 'string') dungeonId = selectedDungeon;
  const dungeon = DUNGEONS.find(entry => entry.id === dungeonId);
  if (!renderer || !profile || !dungeon || !isUnlocked(profile,dungeon)) return;
  if (settlement && !settlement.ok) return;
  selectedDungeon = dungeonId;
  closeAll(); clearInput();
  game = createGame({seed:crypto.getRandomValues(new Uint32Array(1))[0]});
  game.availableCommonIds = getUnlockedCommonIds(profile);
  configureRun(game,getExpedition(profile,dungeonId));
  game.runId = crypto.randomUUID();
  settlement = null; campaignUI.hide();
  startGame(game); audioEngine.reset(game); lastPhase=''; choiceKey=''; last=performance.now(); syncUI();
}
function titleScreen() {
  if(adGold.busy||tacticalRequest)return;
  if (settlement && !settlement.ok) return;
  closeAll(); clearInput(); game=createGame(); lastPhase=''; choiceKey='';
  campaignUI?.show('hub'); syncUI();
}
function saveResult() {
  settlement = settleRun(profile,{id:game.runId,heroId:game.player.heroId,dungeonId:selectedDungeon,victory:game.phase==='victory',kills:game.kills,time:game.time});
  $('again').disabled = $('result-home').disabled = !settlement.ok;
  $('retry-save').hidden = settlement.ok;
  if (!settlement.ok) {
    $('result-loot').textContent=`战利品尚未保存：${settlement.message}。请保留此页面后重试。`;
    syncAdRewardControls();
    return;
  }
  const reward = settlement.reward;
  $('result-loot').textContent=reward ? `已带回：金币 ${reward.gold} · 材料 ${reward.materials}${reward.xp ? ` · 英雄经验 ${reward.xp}` : ''}${reward.firstClear ? ' · 首次通关' : ''}。返回任务查看成长目标。` : settlement.message;
  campaignUI.refresh();
  syncAdRewardControls();
}
function syncAdRewardControls(){
  const {gold:amount,materials}=adGold.amounts(),pending=!!adGold.receipt,busy=adGold.busy;
  $('ad-gold').hidden=(!adGold.available||amount<=0)&&!busy;
  $('ad-gold').disabled=busy||pending||amount<=0;
  $('ad-gold').textContent=busy?'视频播放中…':`看视频加领：金币 +${amount} · 材料 +${materials}`;
  $('retry-ad-gold').hidden=!pending;$('retry-ad-gold').disabled=busy;
  $('again').disabled=$('result-home').disabled=busy||!settlement?.ok;
}
async function watchAdGold(){
  if(adGold.busy||tacticalRequest||adGold.amount()<=0)return;clearInput();$('ad-status').textContent='可选视频追加本局金币 50% 与材料 25%；正常奖励已保存。';
  const requestGame=game;
  const pending=adGold.watch();syncAdRewardControls();
  const result=await pending;if(!$('result-dialog').open||game!==requestGame)return;
  $('ad-status').textContent=result.message;syncAdRewardControls();campaignUI.refresh();
}
function retryAdGold(){const result=adGold.retrySave();$('ad-status').textContent=result.message;syncAdRewardControls();campaignUI.refresh();}
function syncRerollControls(){
  const free=canRerollUpgrade(game,'free'),paid=canRerollUpgrade(game,'ad'),busy=!!tacticalRequest;
  const button=$('upgrade-reroll');
  button.textContent=busy?'视频播放中…':free?'免费重抽 1/1':game.runSupport?.tacticalAdUsed?'本局广告支援已使用':tacticalAvailable()?'看视频再重抽一次':'免费重抽已用完';
  button.disabled=upgradeClosing||busy||(!free&&(!paid||!tacticalAvailable()));
  for(const card of $('upgrade-choices').children)card.disabled=upgradeClosing||busy;
}
function syncReviveControls(){
  $('revive-watch').disabled=!!tacticalRequest||!canRevive(game)||!tacticalAvailable();
  $('revive-watch').textContent=tacticalRequest?'视频播放中…':'看视频复活';
  $('revive-skip').disabled=!!tacticalRequest;
}
function cancelTacticalAd(){
  if(!tacticalRequest)return;
  const kind=tacticalRequest.kind;tacticalRequest=null;tacticalAd.cancel();clearInput();
  $(kind==='revive'?'revive-status':'reroll-status').textContent='本次广告请求已中断，未消耗支援机会。可继续选择或结束远征；重新进入游戏后可再尝试广告。';
  syncRerollControls();syncReviveControls();
}
async function watchTacticalAd(kind){
  if(tacticalRequest||adGold.busy||!tacticalAvailable()||upgradeClosing)return;
  const eligible=kind==='revive'?canRevive(game)&&!settlement:canRerollUpgrade(game,'ad');
  if(!eligible)return;
  const request={game,runId:game.runId,kind,epoch:upgradeEpoch,choices:game.choices};
  const status=$(kind==='revive'?'revive-status':'reroll-status');
  tacticalRequest=request;clearInput();status.textContent='正在准备视频，未完整观看不会消耗支援机会。';
  syncRerollControls();syncReviveControls();
  const valid=()=>tacticalRequest===request&&game===request.game&&game.runId===request.runId&&(kind==='revive'?$('revive-dialog').open&&canRevive(game)&&!settlement:$('upgrade-dialog').open&&game.choices===request.choices&&upgradeEpoch===request.epoch&&canRerollUpgrade(game,'ad'));
  try{
    const result=await tacticalAd.show({isContextValid:valid});
    if(!valid())return;
    if(result.status!=='completed'){status.textContent=result.message||'视频未完整观看，支援机会保留。';return;}
    if(kind==='revive'){
      if(!reviveGame(game)){status.textContent='当前战局无法复活，未消耗支援机会。';return;}
      closeDialog('revive-dialog');clearInput();last=performance.now();
      // A native ad can release every physical finger. Resume only on an explicit tap.
      pause('已复活，点击继续战斗');
    }else{
      if(rerollUpgrade(game,'ad')){
        choiceKey='';upgradeEpoch++;upgradeOpenedAt=performance.now();
        status.textContent='已重抽。本局广告支援已使用。';showChoices();
      }else status.textContent='当前没有不同的可选组合，支援机会保留。';
    }
  }catch{if(valid())status.textContent='视频暂时无法播放，支援机会保留。';}
  finally{if(tacticalRequest===request){tacticalRequest=null;syncRerollControls();syncReviveControls();}}
}
function rerollChoices(){
  if(tacticalRequest||upgradeClosing||game.phase!=='upgrade'||performance.now()-upgradeOpenedAt<220)return;
  if(canRerollUpgrade(game,'free')){
    if(rerollUpgrade(game,'free')){choiceKey='';upgradeEpoch++;upgradeOpenedAt=performance.now();$('reroll-status').textContent='已免费重抽；本局还可用一次广告支援重抽或复活。';showChoices();}
    else $('reroll-status').textContent='当前没有不同的可选组合，免费次数保留。';
  }else void watchTacticalAd('reroll');
}
function showFinalResult(){
  closeDialog('revive-dialog');
  $('result-title').textContent=game.phase==='victory'?'远征告捷':'整队归营';
  $('result-note').textContent=game.phase==='victory'?`${game.dungeon?.name||'副本'}已通关，战利品带回据点。`:'保留部分探索收益。培养英雄、尝试不同武器构筑后再来挑战。';
  const stats=$('result-stats');stats.replaceChildren();
  for(const [value,label] of [[timeLabel(game.time),'生存时间'],[game.kills,'击败敌人'],[game.player.level,'最终等级']]){
    const cell=document.createElement('div'),n=document.createElement('strong'),l=document.createElement('span');n.textContent=value;l.textContent=label;cell.append(n,l);stats.append(cell);
  }
  $('ad-status').textContent='';saveResult();$('result-dialog').showModal();syncAdRewardControls();audioEngine.play(game.phase==='victory'?'win':'lose');
}
function pause(reason) {
  clearInput();
  if(game.phase==='upgrade'){pauseAfterUpgrade=true;return;}
  if (['playing','upgrade_slowdown','upgrade_resume'].includes(game.phase)) { togglePause(game); $('pause-title').textContent=reason || '战斗暂停'; syncUI(); }
}
function askReset(action, title) {
  confirmAction=action; $('confirm-title').textContent=title;
  $('confirm-dialog').showModal();
}
function showChoices() {
  if(upgradeClosing)return;
  const signature=game.choices.map(x=>x.id+':'+x.level).join('|');
  if (signature !== choiceKey) {
    choiceKey=signature; $('upgrade-choices').replaceChildren();
    game.choices.forEach((option,index)=> {
      const button=document.createElement('button'); button.className='upgrade-option';
      const icon=document.createElement('span'); icon.className='upgrade-icon'; icon.setAttribute('aria-hidden','true'); icon.textContent=option.icon || '✦';
      if(option.category==='attack'){const art=skillArtFor(({commander:'cleave',summoner:'summonGuard',blink:'markBlade',mage:'flameBreath',grappler:'grappleHook',rift:'riftGate',magnet:'magnetLance',sword:'swordFocus',spiral:'spiralOrb',petal:'petalSweep'})[game.heroId]);if(art){icon.textContent='';const img=document.createElement('img');img.src=art.src;img.alt='';icon.append(img);}}
      const title=document.createElement('strong'); title.textContent=option.title;
      const desc=document.createElement('span'); desc.className='description'; desc.textContent=option.description;
      const tag=document.createElement('span');tag.className='upgrade-tag';tag.textContent=option.tag || (option.evolved?'进化':'强化');
      button.dataset.category=option.category || 'stat';
      button.append(tag,icon,title,desc);
      button.addEventListener('click',event=>{if(event.detail>0 && performance.now()<upgradeTouchClickUntil)return;selectUpgrade(option.id,button);});
      // Secondary fingers do not reliably synthesize click. A card still requires a local tap.
      let touchChoice=null;
      button.addEventListener('pointerdown',event=>{if(event.pointerType==='touch')touchChoice={id:event.pointerId,x:event.clientX,y:event.clientY,epoch:upgradeEpoch};});
      button.addEventListener('pointermove',event=>{if(touchChoice?.id===event.pointerId && Math.hypot(event.clientX-touchChoice.x,event.clientY-touchChoice.y)>12)touchChoice=null;});
      for(const type of ['pointercancel','pointerleave'])button.addEventListener(type,()=>{touchChoice=null;});
      button.addEventListener('pointerup',event=>{
        if(event.pointerType!=='touch')return;
        event.preventDefault();upgradeTouchClickUntil=performance.now()+500;
        const tap=touchChoice;touchChoice=null;
        if(tap?.id===event.pointerId && tap.epoch===upgradeEpoch && Math.hypot(event.clientX-tap.x,event.clientY-tap.y)<=12)selectUpgrade(option.id,button);
      });
      button.dataset.choice=index+1; $('upgrade-choices').append(button);
    });
  }
  $('upgrade-context').textContent=`${getAttackProgressionInfo(game).meter} · 通用能力 ${WEAPONS.filter(w=>game.upgrades[w.id]>0).length}/2 · 选择后恢复 3 生命`;
  syncRerollControls();
  if (!$('upgrade-dialog').open) {
    // Nonmodal: captured movement must keep receiving the physical finger, including release.
    const dialog=$('upgrade-dialog');dialog.classList.remove('is-leaving');dialog.show();
    upgradeOpenedAt=performance.now();
    $('upgrade-title').focus({preventScroll:true});
    dialog.animate(motion.matches?[{opacity:0},{opacity:1}]:[{opacity:0,transform:'translateY(10px) scale(.96)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:motion.matches?80:240,easing:'cubic-bezier(.16,1,.3,1)'});
  }
}
async function selectUpgrade(id,button) {
  if(tacticalRequest || upgradeClosing || game.phase!=='upgrade' || performance.now()-upgradeOpenedAt<220)return;
  upgradeClosing=true;const epoch=upgradeEpoch,currentGame=game,dialog=$('upgrade-dialog');
  button.classList.add('is-chosen');
  dialog.classList.add('is-leaving');
  for(const card of $('upgrade-choices').children)card.disabled=true;
  audioEngine.play('select');
  const animation=dialog.animate(motion.matches?[{opacity:1},{opacity:0}]:[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'translateY(-8px) scale(.98)'}],{duration:motion.matches?70:190,easing:'ease-in',fill:'forwards'});
  try{await animation.finished;}catch{}
  animation.cancel();
  if(epoch!==upgradeEpoch || currentGame!==game)return;
  closeDialog('upgrade-dialog');upgradeClosing=false;
  if(chooseUpgrade(game,id)) {
    choiceKey='';
    if(document.hidden || needsLandscape() || pauseAfterUpgrade)pause('返回战场后继续');
    syncUI();
  }
}
function currentDirection() {
  const x=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
  const y=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
  return x||y ? {x,y} : stick?movement:{x:0,y:0};
}
function activateSkill(id,input={x:0,y:0}) {
  if (dialogs.some(id=>$(id).open) || needsLandscape() || document.hidden) return;
  if(castSkill(game,id,input)) syncCombatControls();
}
function automaticSkillDirection() {
  const player=game.player;
  let target=null,best=Infinity;
  for(const enemy of game.enemies || []) {
    if(enemy.dead || enemy.spawnDelay>0)continue;
    const distance=(enemy.x-player.x)**2+(enemy.y-player.y)**2;
    if(distance<best){best=distance;target=enemy;}
  }
  if(!target)return {x:player.facing || 1,y:0};
  const dx=target.x-player.x,dy=target.y-player.y,length=Math.hypot(dx,dy)||1;
  return {x:dx/length,y:dy/length};
}
function clearSkillAim(releaseCapture=true) {
  const aim=skillAimPointer;
  skillAimPointer=null; game.skillAim=null;
  $('skill-bar').classList.remove('is-aiming','is-cancelled');
  for(const button of skillButtons.values())button.classList.remove('is-aiming');
  try{if(releaseCapture && aim?.button.hasPointerCapture(aim.id))aim.button.releasePointerCapture(aim.id);}catch{}
}
function beginSkillAim(event,id,button) {
  const state=getSkillState(game).find(skill=>skill.id===id);
  if(event.button!==0 || game.phase!=='playing' || skillAimPointer || !state || state.locked || state.remaining>0)return;
  event.preventDefault();event.stopPropagation();window.getSelection()?.removeAllRanges();
  const direction=automaticSkillDirection();
  const frostTarget=id==='rockWall'?getFrostTarget(game):null;
  const anchor=null;
  skillAimPointer={id:event.pointerId,skillId:id,displaySkillId:state.isReturn?'blinkStrike':id,button,startX:event.clientX,startY:event.clientY,direction,originX:game.player.x,originY:game.player.y,targetX:frostTarget?.x,targetY:frostTarget?.y,anchorId:anchor?.id,dragged:false,cancelled:false};
  game.skillAim={id:state.isReturn?'blinkStrike':id,anchorId:anchor?.id,x:direction.x,y:direction.y,targetX:frostTarget?.x,targetY:frostTarget?.y,cancelled:false};
  button.classList.add('is-aiming');$('skill-bar').classList.add('is-aiming');
  try{button.setPointerCapture(event.pointerId);}catch{clearSkillAim(false);}
}
function moveSkillAim(event) {
  const aim=skillAimPointer;
  if(!aim || aim.id!==event.pointerId)return;
  event.preventDefault();
  const dx=event.clientX-aim.startX,dy=event.clientY-aim.startY,distance=Math.hypot(dx,dy);
  const deadzone=12,cancelRadius=Math.max(108,Math.min(140,appViewport.height*.43));
  aim.dragged=distance>=deadzone;aim.cancelled=distance>=cancelRadius;
  if(aim.dragged){
    aim.direction={x:dx/distance,y:dy/distance};
    if(aim.skillId==='rockWall'){
      const worldDistance=getFrostAimRange(game)*Math.min(1,distance/80);
      const target=getFrostTarget(game,{targetX:aim.originX+aim.direction.x*worldDistance,targetY:aim.originY+aim.direction.y*worldDistance});
      aim.targetX=target.x;aim.targetY=target.y;
    }
  }
  game.skillAim={id:aim.displaySkillId,anchorId:aim.anchorId,x:aim.direction.x,y:aim.direction.y,targetX:aim.targetX,targetY:aim.targetY,cancelled:aim.cancelled};
  $('skill-bar').classList.toggle('is-cancelled',aim.cancelled);
}
function finishSkillAim(event,cast=true) {
  const aim=skillAimPointer;
  if(!aim || aim.id!==event.pointerId)return;
  event.preventDefault();
  const shouldCast=cast && !aim.cancelled;
  const input=aim.skillId==='rockWall'?{targetX:aim.targetX,targetY:aim.targetY}:aim.dragged?aim.direction:{x:0,y:0};
  clearSkillAim(false);
  if(shouldCast)activateSkill(aim.skillId,input);
}
function syncCombatControls() {
  const visible=game.phase !== 'ready';
  $('skill-bar').hidden=!visible; $('weapon-rack').hidden=!visible;
  const skills=getSkillState(game);
  const skillSignature=skills.map(skill=>`${skill.key}:${skill.id}`).join('|');
  if($('skill-bar').dataset.loadout!==skillSignature) {
    clearSkillAim();
    $('skill-bar').replaceChildren(); skillButtons.clear();
    $('skill-bar').dataset.loadout=skillSignature;
  }
  for(const skill of skills) {
    let button=skillButtons.get(skill.id);
    if(!button) {
      button=document.createElement('button'); button.className='skill-button'; button.dataset.skill=skill.id;
      button.dataset.key=skill.key.toLowerCase();
      const key=document.createElement('kbd'), icon=document.createElement('span'), name=document.createElement('strong'), cooldown=document.createElement('span');
      key.className='skill-key'; icon.className='skill-icon'; name.className='skill-name'; cooldown.className='skill-cooldown';
      key.textContent=skill.key; name.textContent=skill.name;
      const art=skillArtFor(skill.id);
      if(art){icon.style.backgroundImage=`url("${art.src}")`;icon.classList.add('has-art');}else icon.textContent=skill.icon;
      button.append(key,icon,name,cooldown);
      button.addEventListener('pointerdown',event=>beginSkillAim(event,skill.id,button));
      button.addEventListener('pointermove',moveSkillAim);
      button.addEventListener('pointerup',event=>finishSkillAim(event));
      button.addEventListener('pointercancel',event=>finishSkillAim(event,false));
      button.addEventListener('lostpointercapture',event=>finishSkillAim(event,false));
      // Keyboard/assistive click has no pointerdown; pointer clicks are settled on release above.
      button.addEventListener('click',event=>{if(event.detail===0)activateSkill(skill.id);});
      $('skill-bar').append(button); skillButtons.set(skill.id,button);
    }
    const remaining=Math.max(0,skill.remaining || 0);
    button.querySelector('.skill-name').textContent=skill.name;
    button.disabled=game.phase!=='playing' || Boolean(skill.locked) || remaining>0;
    button.setAttribute('aria-disabled',String(skill.locked || remaining>0 || game.phase!=='playing'));
    button.classList.toggle('is-cooling',remaining>0);
    button.style.setProperty('--cooldown',`${Math.min(100,100*remaining/skill.cooldown)}%`);
    button.querySelector('.skill-cooldown').textContent=skill.locked ? (skill.lockReason || '不可用') : remaining>0 ? remaining.toFixed(1) : '';
    button.classList.toggle('is-locked',Boolean(skill.locked));
    button.title=`${skill.name} [${skill.key}]：${skill.description}（冷却 ${skill.cooldown} 秒）`;
    button.setAttribute('aria-label',`${skill.name}，${remaining>0 ? '冷却 '+Math.ceil(remaining)+' 秒' : '就绪'}。${skill.description}`);
  }
  const owned=WEAPONS.filter(weapon=>(game.upgrades[weapon.id] || 0)>0);
  const signature=owned.map(weapon=>`${weapon.id}:${game.upgrades[weapon.id]}:${game.evolutions[weapon.id]||""}`).join('|');
  if(signature!==weaponSignature || !$('weapon-rack').childElementCount) {
    weaponSignature=signature; $('weapon-rack').replaceChildren();
    for(const weapon of owned) {
      const level=game.upgrades[weapon.id], branch=weapon.branches.find(b=>b.id===game.evolutions[weapon.id]), evolved=Boolean(branch);
      const slot=document.createElement('div'), icon=document.createElement('b'), label=document.createElement('span');
      slot.className='weapon-slot'+(evolved?' is-evolved':''); icon.textContent=weapon.icon;
      label.textContent=`${evolved ? branch.name : weapon.name} ${evolved ? '进化' : 'Lv.'+level}`;
      slot.title=branch?.description || weapon.description; slot.append(icon,label); $('weapon-rack').append(slot);
    }
    for(let i=owned.length;i<2;i++){const slot=document.createElement('div');slot.className='weapon-slot is-empty';slot.textContent='◇ 空能力槽';$('weapon-rack').append(slot);}
  }
}
function syncBuildSummary(){
  const target=$('build-summary');target.replaceChildren();
  const stats=getCombatStats(game), identity=getHeroIdentity(game);
  const rows=[identity.description, ...((HERO_PERKS[game.heroId||'commander']||[]).filter(p=>game.heroPerks[p.id]>0).map(p=>`${p.name} ${game.heroPerks[p.id]}/${p.max}：${p.description}`)), ...WEAPONS.filter(w=>game.upgrades[w.id]>0).map(w=>{const branch=w.branches.find(b=>b.id===game.evolutions[w.id]);return branch?`${w.name} → ${branch.name}：${branch.description}`:`${w.name} Lv.${game.upgrades[w.id]}：${w.description}`;}),`范围 ×${stats.area.toFixed(1)} · 急速 ×${stats.haste.toFixed(1)} · 普攻频率 ×${stats.attackSpeed.toFixed(1)} · 区域时长 ×${stats.duration.toFixed(1)}`];
  for(const row of rows){const p=document.createElement('p');p.textContent=row;target.append(p);}
  for(const weapon of ownedCommonForSummary()){
    const state=getCommonEvolutionState(game,weapon.id);
    if(!state||state.evolved)continue;
    const stat=GROWTH_STATS.find(item=>item.id===state.requiredGrowth),missing=[];
    if(state.remainingLevels)missing.push(`武器升至 Lv.${weapon.basicMax}`);
    if(state.remainingRank)missing.push(`「${stat?.name||state.requiredGrowth}」至少 1 层`);
    if(state.remainingTime)missing.push(`再战斗 ${Math.ceil(state.remainingTime)} 秒`);
    const p=document.createElement('p');p.textContent=`${weapon.name}进化：${missing.length?missing.join('；'):'条件已满足，下次升级可选进化路线'}`;target.append(p);
  }
  const attack=getAttackProgressionInfo(game),job=getJobCombat(game.player.job),detail=document.createElement('p');detail.textContent=`${attack.meter}：${attack.description}${job?` · ${job.loop}`:''}`;target.prepend(detail);
}
function ownedCommonForSummary(){return WEAPONS.filter(weapon=>(game.upgrades[weapon.id]||0)>0);}
function syncUI() {
  $('arena').classList.toggle('has-boss',Boolean(game.boss && !game.boss.dead));
  $('welcome').hidden=game.phase !== 'ready' || Boolean(campaignUI); $('hud').hidden=game.phase === 'ready';
  $('joystick').hidden=!movementPhases.includes(game.phase); $('control-hint').hidden=game.phase !== 'playing' || game.time>18;
  $('arena').classList.toggle('is-upgrading',game.phase==='upgrade');
  for(const button of $('hud').querySelectorAll('button'))button.disabled=game.phase==='upgrade'||(button.id==='sound'&&soundBusy);
  $('hp-text').textContent=`生命 ${Math.ceil(game.player.hp)} / ${game.player.maxHp}`;
  $('hp-fill').style.width=`${Math.max(0,100*game.player.hp/game.player.maxHp)}%`;
  $('time').textContent=timeLabel(game.time); $('kills').textContent=`击败 ${game.kills}`;
  $('level').textContent=`等级 ${game.player.level}`; $('xp-fill').style.width=`${Math.min(100,100*game.player.xp/game.player.xpNext)}%`;
  $('expedition-name').textContent=game.dungeon?.name || '';
  $('encounter-status').textContent=game.objective?.text || (game.encounter ? `${game.encounter.name} · ${game.encounter.hint}` : '');
  $('encounter-status').title=game.encounter?.hint || '';
  const identity=getHeroIdentity(game);
  const resources=game.jobMechanics,jobMeter=game.player.job==='blade_master'?`剑意 ${resources?.swords||0}/3 · 动势 ${resources?.momentum||0}/3`:game.player.job==='swift_blade'?`动势 ${resources?.momentum||0}/3`:'';
  $('hero-status').textContent=jobMeter?`${identity.attack?.meter||''} · ${jobMeter}`:identity.meter;
  $('hero-status').title=identity.description;
  $('hero-status').classList.toggle('is-empowered',Boolean(game.heroKit?.empowered));
  syncCombatControls();
  if (game.phase !== lastPhase) {
    if(!movementPhases.includes(game.phase))clearInput();
    else if(game.phase!=='playing')clearSkillAim();
    closeDialog('upgrade-dialog'); closeDialog('pause-dialog'); closeDialog('result-dialog'); closeDialog('revive-dialog');
    if(game.phase === 'upgrade') { $('reroll-status').textContent='';audioEngine.play('upgrade'); showChoices(); }
    if(game.phase === 'paused' && !needsLandscape() && !$('confirm-dialog').open) {syncBuildSummary();$('pause-dialog').showModal();}
    if(game.phase === 'victory' || game.phase === 'defeat') {
      if(game.phase==='defeat'&&!settlement&&canRevive(game)&&tacticalAvailable()){
        $('revive-status').textContent='本次远征尚未结算。复活可保留当前构筑和战斗进度。';
        $('revive-dialog').showModal();syncReviveControls();$('revive-watch').focus();
      }else showFinalResult();
    }
    lastPhase=game.phase;
  } else if(game.phase === 'upgrade') showChoices();
}

$('start').addEventListener('click',()=>campaignUI ? titleScreen() : location.reload());
$('pause').addEventListener('click',()=>pause());
$('resume').addEventListener('click',()=>{if(needsLandscape() || document.hidden)return;pauseAfterUpgrade=false;togglePause(game);last=performance.now();syncUI();});
$('restart').addEventListener('click',()=>askReset(newRun,'重新开始？'));
$('return-title').addEventListener('click',()=>askReset(titleScreen,'放弃本次战利品并返回据点？'));
$('confirm-yes').addEventListener('click',()=>{closeDialog('confirm-dialog');confirmAction?.();confirmAction=null;});
$('confirm-no').addEventListener('click',()=>{closeDialog('confirm-dialog');confirmAction=null;$('resume').focus();});
$('again').addEventListener('click',newRun); $('result-home').addEventListener('click',titleScreen);
$('retry-save').addEventListener('click',saveResult);
$('upgrade-reroll').addEventListener('click',rerollChoices);
$('revive-watch').addEventListener('click',()=>watchTacticalAd('revive'));
$('revive-skip').addEventListener('click',()=>{if(!tacticalRequest&&game.phase==='defeat')showFinalResult();});
$('ad-gold').addEventListener('click',watchAdGold);$('retry-ad-gold').addEventListener('click',retryAdGold);
$('result-dialog').addEventListener('close',()=>{adGold.cancel();});
$('about').addEventListener('click',()=>$('about-dialog').showModal()); $('about-close').addEventListener('click',()=>closeDialog('about-dialog'));
$('sound').addEventListener('click',async()=> {
  const button=$('sound');
  if(soundBusy)return;
  soundBusy=true;button.disabled=true;
  try {
    sound=await audioEngine.setEnabled(!sound);
    if(sound){audioEngine.reset(game);audioEngine.play('select');}
    button.textContent=sound?'音效开':'音效关'; button.setAttribute('aria-pressed',String(sound));
  } finally {soundBusy=false;button.disabled=game.phase==='upgrade';}
});
for(const id of dialogs) $(id).addEventListener('cancel',event=> {
  event.preventDefault();
  if(id==='pause-dialog') $('resume').click();
  else if(id==='confirm-dialog') $('confirm-no').click();
  else if(id==='about-dialog') $('about-close').click();
  else if(id==='revive-dialog') $('revive-skip').click();
  else if(id==='daily-dialog') dailyCheckinUI?.close();
});
const movementKeys=['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'];
window.addEventListener('keydown',event=> {
  const key=event.key.toLowerCase();
  if(movementKeys.includes(key)) {event.preventDefault();if(canMove())keys.add(key);}
  if(key==='tab' && game.phase==='upgrade') {
    event.preventDefault();const cards=[...$('upgrade-dialog').querySelectorAll('button:not(:disabled)')];
    if(cards.length){const at=cards.indexOf(document.activeElement);cards[at<0?(event.shiftKey?cards.length-1:0):(at+(event.shiftKey?-1:1)+cards.length)%cards.length].focus();}
  }
  const skill=getSkillState(game).find(skill=>skill.key.toLowerCase()===key);
  if(skill && !event.repeat) {event.preventDefault();activateSkill(skill.id);}
  if(key==='escape' && !dialogs.some(id=>$(id).open)) pause();
  if(game.phase==='upgrade' && ['1','2','3'].includes(key)) $('upgrade-choices').querySelector(`[data-choice="${key}"]`)?.click();
});
window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
// CSS alone does not suppress every Android/iOS WebView selection and callout path.
for(const type of ['contextmenu','selectstart','dragstart']) $('arena').addEventListener(type,event=>event.preventDefault());
for(const type of ['touchstart','touchmove']) canvas.addEventListener(type,event=>event.preventDefault(),{passive:false});
canvas.addEventListener('pointerdown',event=> {
  if(!canMove() || event.clientX<appViewport.left || event.clientX-appViewport.left>appViewport.width*.5 || event.button!==0) return;
  event.preventDefault(); window.getSelection()?.removeAllRanges();
  // A fresh left gesture is an explicit recovery command, even if a release was lost.
  const samePointer=stick?.id===event.pointerId;
  if(samePointer){stick=null;movement={x:0,y:0};}else clearStick();
  stick={id:event.pointerId,x:event.clientX,y:event.clientY,type:event.pointerType,startedAt:event.timeStamp,touchId:null,mode:'capture'};
  try{canvas.setPointerCapture(event.pointerId);if(!canvas.hasPointerCapture(event.pointerId))stick.mode=event.pointerType==='touch'?'touch':'pointer';}
  catch{stick.mode=event.pointerType==='touch'?'touch':'pointer';}
  const size=appViewport.height<=500?90:102;
  $('joystick').style.left=`${stick.x-appViewport.left-size/2}px`; $('joystick').style.top=`${stick.y-appViewport.top-size/2}px`; $('joystick').style.bottom='auto'; $('joystick').classList.add('active');
});
window.addEventListener('pointermove',event=> {
  if(!stick || stick.id!==event.pointerId || event.timeStamp<stick.startedAt) return;
  if(stick.mode==='touch')return; // Touch.identifier is the sole driver in capture-less WebViews.
  if(event.pointerType==='mouse' && !(event.buttons&1)){clearStick();return;}
  event.preventDefault();
  moveStick(event.clientX,event.clientY);
},{capture:true,passive:false});
for(const event of ['pointerup','pointercancel'])window.addEventListener(event,e=>{if(stick?.id===e.pointerId && e.timeStamp>=stick.startedAt)clearStick();},true);
window.addEventListener('lostpointercapture',event=>{
  if(stick?.id!==event.pointerId || event.timeStamp<stick.startedAt)return;
  if(stick.mode!=='capture')return;
  // A queued loss from the replaced generation must not clear a newly captured owner.
  try{if(canvas.hasPointerCapture(stick.id))return;}catch{}
  degradeStickCapture();
},true);
window.addEventListener('mouseout',event=>{if(!event.relatedTarget && stick?.type==='mouse')clearStick();},true);
for(const type of ['touchstart','touchmove','touchend','touchcancel'])window.addEventListener(type,event=>{
  if(stick?.type!=='touch')return;
  if(stick.touchId===null){
    // Pointer and Touch identifiers are separate namespaces. Bind only the actual start.
    const touch=[...event.changedTouches].find(t=>t.target===canvas && Math.abs(t.clientX-stick.x)<2 && Math.abs(t.clientY-stick.y)<2);
    if(type==='touchstart' && touch)stick.touchId=touch.identifier;
    else{clearStick();return;}
  }
  const active=[...event.touches].find(t=>t.identifier===stick.touchId);
  if(!active){clearStick();return;}
  if(stick.mode==='touch' && type==='touchmove')moveStick(active.clientX,active.clientY);
}, {capture:true,passive:true});
function orientation() {
  clearInput();
  syncViewport();
  const portrait=needsLandscape();
  if(portrait) {
    pause('旋转屏幕后继续'); $('rotate').hidden=false;
    // A modal sits above every game dialog and cannot resume a portrait battle.
    if(!$('rotate').open)$('rotate').showModal();
  } else {
    closeDialog('rotate'); $('rotate').hidden=true;
    if(game.phase==='paused' && !$('pause-dialog').open && !$('confirm-dialog').open)$('pause-dialog').showModal();
  }
}
$('rotate').addEventListener('cancel',event=>event.preventDefault());
window.visualViewport?.addEventListener('resize',orientation);
window.visualViewport?.addEventListener('scroll',orientation);
window.addEventListener('orientationchange',()=>{clearInput();requestAnimationFrame(orientation);});
window.addEventListener('resize',orientation); window.addEventListener('blur',()=>pause('离开战场，已暂停'));
window.addEventListener('pagehide',()=>pause('离开战场，已暂停'));
window.addEventListener('pagehide',()=>cloudSaveUI?.close());
window.addEventListener('pagehide',cancelTacticalAd);
window.addEventListener('pagehide',()=>{const interrupted=adGold.busy||adGold.receipt;adGold.cancel();if(interrupted)$('ad-status').textContent='已离开本次页面，旧视频请求已失效；正常结算奖励保留。';syncAdRewardControls();});
touchOnly.addEventListener('change',orientation); hasFinePointer.addEventListener('change',orientation);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('离开战场，已暂停');});
document.addEventListener('visibilitychange',()=>{if(document.hidden)cloudSaveUI?.close();});
orientation();

function frame(now) {
  // A silent capture loss stops the old vector; only a live mapped touch can resume it.
  if(stick){
    if(stick.type==='touch' && stick.touchId===null)clearStick();
    else if(stick.mode==='capture'){try{if(!canvas.hasPointerCapture(stick.id))degradeStickCapture();}catch{degradeStickCapture();}}
  }
  else movement={x:0,y:0};
  const dt=Math.max(0,Math.min((now-last)/1000,.25));last=now;
  if(renderer && game.phase !== 'ready'){
    game.viewport={width:appViewport.width,height:appViewport.height};
    if(needsLandscape() || document.hidden)pause('离开战场，已暂停');
    const x=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
    const y=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
    updateGame(game,dt,x||y?{x,y}:stick?movement:{x:0,y:0});
    audioEngine.consume(game);
    renderer.render(game,{width:appViewport.width,height:appViewport.height,dpr:devicePixelRatio,reducedMotion:motion.matches}); syncUI();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function loadImage(src) {return new Promise((resolve,reject)=>{
  const image=new Image(),timer=setTimeout(()=>reject(new Error(`加载超时 ${src}`)),30000);
  image.onload=async()=>{try{await image.decode();clearTimeout(timer);resolve(image);}catch(error){clearTimeout(timer);reject(error);}};
  image.onerror=()=>{clearTimeout(timer);reject(new Error(`无法加载 ${src}`));};image.src=src;
});}
try {
  const uiFiles=['hub.jpg','camp-original.png','frame.png','bottom-bar.png','button.png','back.png','gold.png','materials.png'];
  const sources={
    ...Object.fromEntries(Object.entries(vfxAssets).map(([key,asset])=>[`vfx_${key}`,asset.src])),
    ...Object.fromEntries(Object.entries(unitAssets).map(([key,asset])=>[key,asset.src])),
    ...Object.fromEntries(uiFiles.map(name=>[`ui_${name}`,`./assets/ui/${name}`])),
    terrain:'./assets/terrain.png',vfxStroke:'./assets/vfx/rend-strip.png',vfxBlade:'./assets/vfx/return-blade-painted.png',
  };
  let complete=0,audioFraction=0;
  const total=Object.keys(sources).length+1;
  function loadingProgress(){const percent=Math.min(99,Math.floor(100*(complete+audioFraction)/total));$('load-progress').value=percent;$('load-status').textContent=`正在准备画面与音效… ${percent}%`;}
  loadingProgress();
  const [entries]=await Promise.all([
    Promise.all(Object.entries(sources).map(async([key,src])=>{const image=await loadImage(src);complete++;loadingProgress();return [key,image];})),
    audioEngine.preload(({loaded,total})=>{audioFraction=total?loaded/total:0;loadingProgress();}),
    document.fonts.ready,
  ]);
  const images=Object.fromEntries(entries);
  if (!profile) throw new Error(`无法读取本地养成记录：${loadedProfile.error}。原记录已保留，请勿清除浏览器数据。`);
  renderer=createRenderer(canvas,unitAssets,images,vfxAssets);
  cloudSaveUI=createCloudSaveUI({profile,canOpen:()=>game.phase==='ready'&&!needsLandscape(),onRestore:()=>{selectedDungeon=DUNGEONS[0].id;campaignUI?.show('hub');},onAbout:()=>$('about-dialog').showModal()});
  dailyCheckinUI=createDailyCheckinUI({profile,canOpen:()=>game.phase==='ready'&&!needsLandscape(),isCurrent:()=>game.phase==='ready',onChange:()=>campaignUI?.refresh()});
  campaignUI=createCampaignUI({root:$('campaign'),profile,images,onDepart:newRun,onChange:()=>{},onAbout:()=>cloudSaveUI.open(),onDaily:()=>dailyCheckinUI.open()});
  $('load-progress').value=100;$('load-status').textContent='准备完成';
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  campaignUI.show('hub');document.body.classList.remove('boot-loading');syncUI();
} catch(error) {
  $('loading-error').hidden=false;$('loading-error').textContent=profile?'资源未加载完整，请检查网络后重试。':error.message;
  $('load-status').textContent='加载未完成';$('start').disabled=false;$('start').textContent='重新加载';console.error(error);
}
