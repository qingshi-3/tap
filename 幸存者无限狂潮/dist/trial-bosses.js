import { emitTrialAudio, watchTrialNodes, consumeTrialNodeDeaths, cancelTrialOwner } from './trial-audio.js';
// Trial state belongs to the boss; shared geometry and damage stay in enemy-abilities.
export const TRIAL_KITS = Object.freeze({trialBulwark:'trial_commander',trialPursuer:'trial_swift',trialBinder:'trial_summoner',trialRift:'trial_blink',trialPrism:'trial_mage'});
export const isTrialBoss = e => !!TRIAL_KITS[e?.abilityId];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const angle=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x);
const nodes=(game,e)=>game.enemies.filter(n=>n.trialOwnerId===e.id&&!n.dead);
export function initTrialBoss(game,e,id) {
  if(!TRIAL_KITS[id])return false;
  e.abilityId=id;e.kind=TRIAL_KITS[id];e.abilityState={stage:'idle',move:'approach',remaining:1.3,total:1.3,index:0,phase:1,waitForView:true,cycle:0};
  e.trialCue=null;game.enemyHazards||=[];return true;
}
export function clearTrialOwned(game,id) {
  for(const n of game.enemies)if(n.trialOwnerId===id){n.dead=true;n.deathLife=0;n.hp=0;}
  const e=game.enemies.find(n=>n.id===id);if(e){e.trialCue=null;if(e.dead)cancelTrialOwner(e);}
}
export function getTrialDamageMultiplier(game,e) {
  if(!isTrialBoss(e))return 1;
  if(e.trialCue?.mode==='exposed')return 1.25;
  if(e.abilityId==='trialBulwark'&&e.trialCue?.mode==='guard')return .7;
  if(e.abilityId==='trialBinder'&&nodes(game,e).length)return .65;
  return 1;
}
function cue(e,label,mode,progress=0){e.trialCue={label,mode,progress};}
function recover(e,time,exposed=false){Object.assign(e.abilityState,{stage:'rest',move:'recovery',remaining:time,total:time,index:0});e.anim='idle';e.animHoldFrame=null;cue(e,exposed?'破绽 · 进攻':'收招 · 进攻',exposed?'exposed':'recovery');}
export function damageTrialBoss(game,e,actual,helpers) {
  const s=e.abilityState;
  if(e.abilityId!=='trialPrism'||s?.stage!=='channel')return;
  s.interruptedDamage+=actual;cue(e,'聚能 · 攻击打断','channel',Math.min(1,s.interruptedDamage/500));
  if(e.hp>0&&s.interruptedDamage>=500){helpers.clearType(game,e.id,'warning');s.cycle++;s.phase=e.hp/e.maxHp<.45?2:1;recover(e,3,true);emitTrialAudio(game,e,'trialPrismBreak');game.announcement={text:'聚能已打断 · 破绽',remaining:2};}
}
function sequence(e){
  const low=e.abilityState.phase===2;
  switch(e.abilityId){
    case 'trialBulwark':return low?['returnSlash','shieldSlash']:['shieldSlash','returnSlash'];
    case 'trialPursuer':return low?['dash','returnDash','thirdDash','landing']:['dash','returnDash','landing'];
    case 'trialBinder':return ['bindNodes','spiritFan','soulPulse'];
    case 'trialRift':return low?['orderedMarks','riftTwo','riftOne']:['orderedMarks','riftOne','riftTwo'];
    case 'trialPrism':return low?['outerRing','innerPulse','channel']:['innerPulse','outerRing','channel'];
  }
}
// Clamp newly authored anchors only. Published warnings never move with camera/player.
function anchor(game,h,x,y,r){const b=h.viewBounds(game);return {x:clamp(x,Math.max(0,b.left+r),Math.min(game.world.width,b.right-r)),y:clamp(y,Math.max(0,b.top+r),Math.min(game.world.height,b.bottom-r))};}
function readableRadius(game,h,max){const b=h.viewBounds(game);return Math.max(40,Math.min(max,(b.bottom-b.top)/2-6));}
function metadata(e,move,ordinal){return {trialKit:e.abilityId,trialMove:move,ordinal,vfxKey:({trialBulwark:'bossCleave',trialPursuer:'dash',trialBinder:'summon',trialRift:'blinkSeal',trialPrism:'magicImpact'})[e.abilityId]};}
function warning(game,e,h,move,g,time,ordinal){const s=e.abilityState;Object.assign(s,{stage:'warning',move,geometry:g,remaining:time,total:time,waitForView:false});const hazard=h.addHazard(game,e,'warning',g,time,metadata(e,move,ordinal));
if(e.abilityId==='trialBulwark'&&s.index===0)emitTrialAudio(game,e,'trialShieldReady',hazard);
if(move.includes('Dash')||move==='dash')emitTrialAudio(game,e,'trialWindCharge',hazard);
if(move==='channel')emitTrialAudio(game,e,'trialPrismCharge',hazard);
e.anim='attack';e.animTime=0;e.animDuration=time;}
function begin(game,e,h){
 const s=e.abilityState,move=sequence(e)[s.index],a=angle(e,game.player);
 if(e.abilityId!=='trialBinder'||!nodes(game,e).length)e.trialCue=null;
 if(move==='bindNodes'){
   if(nodes(game,e).length){s.stage='rest';s.remaining=.4;s.total=.4;return;}
   const centre=anchor(game,h,e.x,e.y,110);e.x=centre.x;e.y=centre.y;
   // Nodes have no combat AI, contact damage, XP or loot. Their eight-second
   // clock shares the owner's freeze/slow clock and can never strand the loop.
   // Reserve the actual diagonal skill cluster and lower-left joystick, not
   // merely the viewport edge. Choose one separated pair before publication;
   // independent clamping could otherwise collapse both targets into one.
   const b=h.viewBounds(game),cameraX=b.left-20,cameraY=b.top-74,width=game.viewport?.width||844,height=game.viewport?.height||390;
   const left=120,right=Math.max(left+160,width-245),gap=72;
   const cx=clamp(game.player.x-cameraX,left+gap,right-gap),cy=clamp(game.player.y-cameraY,134,Math.min(190,height-110));
   for(const sign of [-1,1]){const p={x:clamp(cameraX+cx+sign*gap,0,game.world.width),y:clamp(cameraY+cy,0,game.world.height)};game.enemies.push({id:game._nextId++,trialConstruct:true,trialOwnerId:e.id,kind:'neutral_golemstone',...p,hp:260,maxHp:260,radius:18,speed:0,damage:0,xp:0,spawnDelay:0,anim:'idle',animTime:0,hitFlash:0,facing:sign});}
   emitTrialAudio(game,e,'trialSoulBind');watchTrialNodes(e,nodes(game,e));s.nodeLife=8;s.nodesBroken=false;cue(e,'缚魂节点 · 转火','linked');s.index++;s.stage='rest';s.remaining=.7;s.total=.7;return;
 }
 if(move==='orderedMarks'){
   const centre=anchor(game,h,e.x,e.y,110);e.x=centre.x;e.y=centre.y;
   const r=44,positions=[anchor(game,h,game.player.x,game.player.y,r),anchor(game,h,game.player.x+95,game.player.y+35,r),anchor(game,h,game.player.x-95,game.player.y-35,r)];
   s.markPositions=positions;s.marks=[h.addHazard(game,e,'warning',{shape:'circle',...positions[0],radius:r},2,metadata(e,move,1))];
   emitTrialAudio(game,e,'trialRiftMark',s.marks[0]);Object.assign(s,{stage:'marks',move,remaining:2,total:2,markElapsed:0,markIndex:0,waitForView:false});return;
 }
 if(move==='channel'){
   const r=readableRadius(game,h,100),p=anchor(game,h,e.x,e.y,r);e.x=p.x;e.y=p.y;warning(game,e,h,move,{shape:'circle',...p,radius:r},3);
   s.stage='channel';s.interruptedDamage=0;cue(e,'聚能 · 攻击打断','channel');return;
 }
 let g,time=1.1;
 if(move.includes('Slash')||move==='spiritFan'){const r=readableRadius(game,h,110),p=anchor(game,h,e.x,e.y,r);e.x=p.x;e.y=p.y;g={shape:'sector',...p,radius:r,angle:angle(p,game.player)+(move==='returnSlash'?.7:0),width:(move==='returnSlash'?100:120)*Math.PI/180};time=move==='returnSlash'?1:1.1;}
 else if(move.includes('Dash')||move==='dash'){
   const b=h.viewBounds(game),p=anchor(game,h,e.x,e.y,18);e.x=p.x;e.y=p.y;
   const dx=Math.cos(a),dy=Math.sin(a);let length=Math.min(220,Math.max(90,Math.hypot(game.player.x-e.x,game.player.y-e.y)+40));
   if(dx>0)length=Math.min(length,(b.right-18-e.x)/dx);else if(dx<0)length=Math.min(length,(b.left+18-e.x)/dx);
   if(dy>0)length=Math.min(length,(b.bottom-18-e.y)/dy);else if(dy<0)length=Math.min(length,(b.top+18-e.y)/dy);
   length=Math.max(0,length);g={shape:'line',x:e.x,y:e.y,toX:e.x+dx*length,toY:e.y+dy*length,width:32,length,angle:a};time=move==='returnDash'?1:1.1;
 }else if(move==='riftOne'||move==='riftTwo'){
   const b=h.viewBounds(game),p={x:clamp(game.player.x,Math.max(111,b.left+111),Math.min(game.world.width-111,b.right-111)),y:clamp(game.player.y,Math.max(56,b.top+56),Math.min(game.world.height-56,b.bottom-56))},d=move==='riftOne'?1:-1;g={shape:'line',x:p.x-95,y:p.y-d*40,toX:p.x+95,toY:p.y+d*40,width:32,length:Math.hypot(190,80),angle:Math.atan2(d*80,190)};time=1.2;
 }else{
   const r=move==='outerRing'?readableRadius(game,h,150):move==='innerPulse'?70:48,p=anchor(game,h,move==='innerPulse'||move==='outerRing'?e.x:game.player.x,move==='innerPulse'||move==='outerRing'?e.y:game.player.y,r);
   if(move==='innerPulse'||move==='outerRing'){e.x=p.x;e.y=p.y;}
   g=move==='outerRing'?{shape:'ring',...p,radius:r,innerRadius:r*.6,outerRadius:r,gapAngle:0,gapWidth:0}:{shape:'circle',...p,radius:r};time=move==='outerRing'?1.4:move==='innerPulse'?1.2:1.1;
 }
 if(e.abilityId==='trialBulwark')cue(e,'盾势 · 减伤','guard');
 warning(game,e,h,move,g,time);
}
function finish(game,e,api,h){const s=e.abilityState,g=s.geometry,move=s.move;h.clearType(game,e.id,'warning');
 if(move.includes('Dash')||move==='dash'){emitTrialAudio(game,e,'trialWindDash');Object.assign(s,{stage:'dash',remaining:.42,total:.42,hitIds:new Set(),dashFrom:{x:e.x,y:e.y}});return;}
 emitTrialAudio(game,e,({shieldSlash:'trialShieldSlash',returnSlash:'trialShieldSlash',landing:'trialWindLand',spiritFan:'trialSoulPulse',soulPulse:'trialSoulPulse',riftOne:'trialRiftCut',riftTwo:'trialRiftCut',innerPulse:'trialPrismIn',outerRing:'trialPrismOut',channel:'trialPrismIn'})[move]);
 h.hurtTargets(game,g,e.damage*(move==='landing'?.85:1),api,new Set());h.addHazard(game,e,'impact',g,.45,metadata(e,move));next(game,e);
}
function next(game,e){const s=e.abilityState;s.index++;
 if(s.index>=sequence(e).length){s.cycle++;s.phase=e.hp/e.maxHp<.45?2:1;recover(e,e.abilityId==='trialBinder'?3:2.4,e.abilityId==='trialBulwark');}
 else{Object.assign(s,{stage:'rest',remaining:.25,total:.25});}
}
export function updateTrialBoss(game,e,dt,api,h){
 const s=e.abilityState;if(!s||e.dead)return false;
 if(e.abilityId==='trialBinder'&&s.nodeLife>0){// Inspect node objects before expiry clears them; timeout has no death animation.
   consumeTrialNodeDeaths(game,e);
   s.nodeLife-=dt;const live=nodes(game,e);
   if(!live.length&&!s.nodesBroken){s.nodesBroken=true;s.nodeLife=0;h.clearType(game,e.id,'warning');s.cycle++;s.phase=e.hp/e.maxHp<.45?2:1;recover(e,3,true);}
   else if(s.nodeLife<=0){clearTrialOwned(game,e.id);cue(e,'收招 · 进攻','recovery');}
   else cue(e,'缚魂节点 · 转火','linked');
 }
 if(s.stage==='idle'){
   s.remaining=Math.max(0,s.remaining-dt);if(s.remaining>0)return false;
   if(!h.visible(game,e)){s.waitForView=true;return false;}
   const approachRange=({trialBulwark:90,trialPrism:80,trialBinder:150})[e.abilityId];
   if(s.index===0&&approachRange&&Math.hypot(e.x-game.player.x,e.y-game.player.y)>approachRange){
     // A complete recovery precedes pursuit. Follow the player rather than the
     // safe-view centre, and commit geometry only once this kit is in range.
     s.waitForView=false;s.move='approach';return false;
   }
   begin(game,e,h);return true;
 }
 if(s.stage==='rest'){s.remaining-=dt;if(s.remaining<=0){s.stage='idle';s.remaining=0;if(e.trialCue?.mode==='exposed')e.trialCue=null;}return true;}
 if(s.stage==='marks'){
   s.markElapsed+=dt;s.remaining-=dt;
   for(let i=s.marks.length;i<3;i++){if(s.markElapsed<i*.35)break;s.marks.push(h.addHazard(game,e,'warning',{shape:'circle',...s.markPositions[i],radius:44},2+i*.9-s.markElapsed,metadata(e,s.move,i+1)));emitTrialAudio(game,e,'trialRiftMark',s.marks[i]);}
   for(let i=s.markIndex;i<s.marks.length;i++){const mark=s.marks[i];mark.remaining=mark.life=Math.max(0,s.remaining+(i-s.markIndex)*.9);}
   if(s.remaining<=0){const mark=s.marks[s.markIndex];emitTrialAudio(game,e,'trialRiftBurst');h.hurtTargets(game,mark,e.damage,api,new Set());mark.remaining=mark.life=0;h.addHazard(game,e,'impact',{shape:mark.shape,x:mark.x,y:mark.y,radius:mark.radius},.45,metadata(e,s.move,s.markIndex+1));s.markIndex++;if(s.markIndex===3)next(game,e);else s.remaining=.9;}return true;
 }
 if(s.stage==='dash'){
   const old={x:e.x,y:e.y};s.remaining=Math.max(0,s.remaining-dt);const t=1-s.remaining/s.total;e.x=s.geometry.x+(s.geometry.toX-s.geometry.x)*t;e.y=s.geometry.y+(s.geometry.toY-s.geometry.y)*t;
   h.hurtTargets(game,{shape:'line',x:old.x,y:old.y,toX:e.x,toY:e.y,width:32},e.damage*.75,api,s.hitIds);
   if(s.remaining<=0){h.addHazard(game,e,'impact',s.geometry,.35,metadata(e,s.move));next(game,e);}return true;
 }
 if(s.stage==='warning'||s.stage==='channel'){
   s.remaining=Math.max(0,s.remaining-dt);for(const w of game.enemyHazards)if(w.ownerId===e.id&&w.type==='warning')w.remaining=w.life=s.remaining;
   if(s.remaining<=0)finish(game,e,api,h);return true;
 }
 return true;
}
