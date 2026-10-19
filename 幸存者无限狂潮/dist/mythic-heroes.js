import { getCombatStats, getSkillGeometry, pointInSector } from './combat-stats.js';
import { ATTACK_DAMAGE_SCALE } from './attack-progression.js';

export const MYTHIC_HERO_IDS=Object.freeze(['sword','spiral','petal']);
export const MYTHIC_HERO_PERKS=Object.freeze({
 sword:Object.freeze([{id:'sword_focus',name:'凝神御令',description:'每层使指定群敌集火保持 +1秒。',icon:'✦',max:2,category:'heroSkill'},{id:'sword_recall',name:'回锋护体',description:'每层使回航飞剑伤害 +15%、护体时间 +0.15秒；护体不提供无敌。',icon:'↶',max:2,category:'heroSkill'}]),
 spiral:Object.freeze([{id:'spiral_control',name:'凝旋',description:'每层使Q控制丸停留 +0.4秒，持续缓牵轻敌；普攻不磨削。',icon:'◉',max:2,category:'heroSkill'},{id:'spiral_shadow',name:'影契',description:'每层使分身保留 +1秒，短丸补投系数 +0.1；本体普攻的协同复制每影仍只一次。',icon:'♟',max:2,category:'heroSkill'}]),
 petal:Object.freeze([{id:'petal_current',name:'叠潮',description:'每层使快速种刃增加有限实体刃片；不生成驻场伤害。',icon:'≋',max:2,category:'heroSkill'},{id:'petal_net',name:'收网',description:'每层使实体花刃召回伤害增加10点基础伤害，保留整次召回总量上限。',icon:'❀',max:2,category:'heroSkill'}]),
});
const OWN_SKILLS={sword:['swordFocus','swordRecall','swordUnion'],spiral:['spiralOrb','spiralClone','spiralConvergence'],petal:['petalSweep','petalPierce','petalBloom']};
const TAU=Math.PI*2;
const alive=e=>e&&!e.dead&&e.hp>0&&!(e.spawnDelay>0);
const immovable=e=>e.boss||e.trialConstruct||e.construct||e.mechanicConstruct;
const d2=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const perk=(g,id)=>clamp(Number(g.heroPerks?.[id])||0,0,2);
const point=(p,a,n)=>({x:p.x+Math.cos(a)*n,y:p.y+Math.sin(a)*n});
const angleTo=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x);
const aimAngle=(g,a)=>typeof a==='number'?a:(a?.x||a?.y)?Math.atan2(Number(a.y)||0,Number(a.x)||0):(g.player.facing<0?Math.PI:0);
const bounded=(g,p,r=24)=>({x:clamp(p.x,r,(g.world?.width||2400)-r),y:clamp(p.y,r,(g.world?.height||1800)-r)});
const progress=g=>({rank:clamp(Number(g.attackProgress?.rank)||1,1,4),branch:g.attackProgress?.branch});
const evolved=g=>g.mythicHero?.tier===3&&progress(g).rank===4;
const ordinaryScale=(g,e,category)=>category==='basic'&&evolved(g)&&!immovable(e)&&!e.elite?({sword:5,spiral:5,petal:5}[g.mythicHero.heroId]||1):1;
const power=g=>getCombatStats(g).damage*ATTACK_DAMAGE_SCALE[progress(g).rank-1];
function tier(g){return ['sword_sage','spiral_sage','petal_sovereign'].includes(g.heroJob||g.player.job)?3:['sword_adept','spiral_adept','petal_dancer'].includes(g.heroJob||g.player.job)?2:1;}
function ensure(g){
 const heroId=g.heroId||g.player?.heroId;if(!MYTHIC_HERO_IDS.includes(heroId))return null;
 if(g.mythicHero?.heroId!==heroId){clearMythicHero(g);g.mythicHero={heroId,tier:tier(g),time:0,serial:0,clock:.12,swords:[],union:null,focus:null,recallTime:0,orbs:[],windBlades:[],clones:[],convergence:null,history:[{x:g.player.x,y:g.player.y,time:0}],sampleClock:0,petals:[],paths:[],bloom:null,pending:[],pierces:[],frameBudget:new Map(),loopClock:0};}
 g.mythicHero.tier=tier(g);return g.mythicHero;
}
export function clearMythicHero(g){if(g.player){delete g.player.mythicFrontGuard;delete g.player.mythicAirborne;delete g.player.mythicSwordGuard;}g.mythicHero=null;g.heroEffects=(g.heroEffects||[]).filter(f=>f.visualKind!=='mythicHero');}
function fx(g,style,data={}){const s=g.mythicHero;(g.heroEffects||=[]).push({visualKind:'mythicHero',heroId:s.heroId,tier:s.tier,style,shape:'circle',life:.25,maxLife:.25,...data});if(g.heroEffects.length>192)g.heroEffects.splice(0,g.heroEffects.length-192);}
function sound(g,id){fx(g,id,{shape:'sound',x:g.player.x,y:g.player.y,radius:0,life:.1,maxLife:.1,sound:id==='swordRecall'?'teleport':id==='swordUnion'?'groundSlam':id.startsWith('petal')?'bladeCut':'orb'});}
function near(g,p,r,cap=24){return g.enemies.filter(alive).filter(e=>d2(e,p)<=(r+(e.radius||18))**2).sort((a,b)=>d2(a,p)-d2(b,p)||a.id-b.id).slice(0,cap);}
function projection(e,a,b){const dx=b.x-a.x,dy=b.y-a.y;return clamp(((e.x-a.x)*dx+(e.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);}
function segmentDistance(e,a,b){return Math.sqrt(d2(e,{x:a.x+(b.x-a.x)*projection(e,a,b),y:a.y+(b.y-a.y)*projection(e,a,b)}));}
function along(g,a,b,width){return g.enemies.filter(alive).filter(e=>segmentDistance(e,a,b)<=width+(e.radius||18)).sort((x,y)=>projection(x,a,b)-projection(y,a,b)||x.id-y.id);}
function canHit(g,e,category='basic',budget=null,cap=Infinity){const scale=ordinaryScale(g,e,category);return alive(e)&&(g.mythicHero.frameBudget.get(category+':'+e.id)||0)<(category==='active'?240:80*scale)*getCombatStats(g).damage&&(!budget||(budget.get(e.id)||0)<cap*scale);}
function hit(g,api,e,n,category='basic',budget=null,cap=Infinity){
 if(!alive(e)||!(n>0))return 0;const scale=ordinaryScale(g,e,category);n*=scale;cap*=scale;const s=g.mythicHero,frameKey=`${category}:${e.id}`,used=s.frameBudget.get(frameKey)||0,frameCap=(category==='active'?240:80*scale)*getCombatStats(g).damage;
 n=Math.min(n,Math.max(0,frameCap-used));if(budget)n=Math.min(n,Math.max(0,cap-(budget.get(e.id)||0)));if(n<=0)return 0;
 s.frameBudget.set(frameKey,used+n);if(budget)budget.set(e.id,(budget.get(e.id)||0)+n);api.damage(e,n,category==='active'?'#fff1bb':'#bdfaff',category);return n;
}
function radial(g,p,r,n,api,category='active',budget=null,cap=Infinity){for(const e of near(g,p,r,Infinity))hit(g,api,e,n,category,budget,cap);}
function move(g,e,to,api){to=bounded(g,to,e.radius||12);if(api.movementHitsWall?.(e.x,e.y,to.x,to.y,e.radius||12))return false;e.x=to.x;e.y=to.y;return true;}
function advance(g,e,to,speed,dt,api){const a=angleTo(e,to),distance=Math.sqrt(d2(e,to));e.angle=a;return move(g,e,point(e,a,Math.min(distance,speed*dt)),api);}
function pose(g){const p=g.player;if(!(p.animSource==='skill'&&p.animTime<p.animDuration)){p.anim='attack';p.animTime=0;p.animDuration=.28;p.animSource='auto';p.animFacing=p.facing;}}
function swordConfig(g){const r=progress(g),i=r.rank===4?(r.branch==='b'?4:3):r.rank-1,counts=[[1,2,3,6,5],[2,3,5,8,6],[1,3,5,10,8]];return {count:counts[tier(g)-1][i],speed:[260,300,340,500,580][i],damage:(tier(g)===3?16:11)*power(g)*(r.branch==='b'?1.12:1),interval:Math.max(.22,(tier(g)===3&&r.rank===4?(r.branch==='b'?.32:.38):r.branch==='b'?.48:.65)/getCombatStats(g).attackSpeed)};}
function ensureSwords(g){const s=g.mythicHero,c=swordConfig(g);s.swords=s.swords.slice(0,c.count);while(s.swords.length<c.count){const i=s.swords.length;s.swords.push({id:++s.serial,...point(g.player,i*2.4,20),angle:i*2.4,phase:'cruise',radius:8,speed:c.speed,targetId:null,readyTime:s.time+i*.08,hitTimes:new Map(),trail:[]});}for(const sword of s.swords)sword.speed=c.speed;}
// High weapons keep near/remote priorities, but every sword can leave the body.
function swordTarget(g,sword){
 if(g.mythicHero.tier===1)return null;
 const s=g.mythicHero,r=progress(g),index=s.swords.indexOf(sword),range=s.tier===1?0:s.tier===2?(r.rank>=3?320:125):(evolved(g)?650:470);
 let candidates=s.focus?.remaining>0?near(g,s.focus,s.focus.radius,20).filter(e=>d2(e,g.player)<650**2):near(g,g.player,range,20);
 if(s.tier===2&&s.focus?.targetId){const exact=candidates.find(e=>e.id===s.focus.targetId);if(exact)return exact;}
 if(s.tier===3&&s.focus&&candidates.length===0&&!s.focus.transferred){const next=near(g,s.focus,260,1)[0];if(next){s.focus.x=next.x;s.focus.y=next.y;s.focus.transferred=true;candidates=near(g,s.focus,s.focus.radius,20);}}
 if(!candidates.length)return null;
 if(r.branch==='b'&&index%3===0){const priority=candidates.find(e=>e.elite||e.boss);if(priority)return priority;}
 if(s.tier===2&&r.rank>=3&&index%2===0)candidates.sort((a,b)=>(d2(a,g.player)<160**2?0:1)-(d2(b,g.player)<160**2?0:1)||d2(a,sword)-d2(b,sword));
 else candidates.sort((a,b)=>d2(a,sword)-d2(b,sword)||a.id-b.id);
 const assigned=new Set(s.swords.filter(n=>n!==sword&&(n.phase==='chase'||n.phase==='pass')).map(n=>n.targetId));return candidates.find(e=>!assigned.has(e.id))||candidates[index%candidates.length];
}
function swordHits(g,sword,from,api,recall=false){recall=recall||sword.commandActive;const s=g.mythicHero,c=swordConfig(g);for(const e of along(g,from,sword,(evolved(g)?(progress(g).branch==='a'?28:22):9)*getCombatStats(g).area)){if(s.time-(sword.hitTimes.get(e.id)??-Infinity)<c.interval)continue;const n=hit(g,api,e,c.damage*(s.tier===3&&c.count===1?4.2:1)*(recall?1.4+.15*perk(g,'sword_recall'):1),recall?'active':'basic');if(n>0){sword.hitTimes.set(e.id,s.time);const audible=s.time>=(s.swordSoundTime||0);if(audible)s.swordSoundTime=s.time+.22;fx(g,'swordHit',{x:e.x,y:e.y,radius:20,angle:sword.angle,...(audible?{sound:'bladeCut'}:{})});}}for(const [id,t]of sword.hitTimes)if(s.time-t>3)sword.hitTimes.delete(id);while(sword.hitTimes.size>160)sword.hitTimes.delete(sword.hitTimes.keys().next().value);}
function updateUnion(g,dt,api){const s=g.mythicHero,u=s.union,p=g.player,st=getCombatStats(g);u.elapsed+=dt;u.remaining=Math.max(0,u.duration-u.elapsed);u.phase=u.elapsed<.45?'gather':u.elapsed<.8?'strike':u.remaining<.25?'split':'combat';
 for(const sword of s.swords){sword.phase='union';if(u.elapsed<.45){const from=sword.unionFrom,t=Math.min(1,u.elapsed/.45);sword.x=from.x+(u.origin.x-from.x)*t;sword.y=from.y+(u.origin.y-from.y)*t;}else {sword.x=u.origin.x;sword.y=u.origin.y;}sword.angle=u.angle;}
 u.gathered=s.swords.every(n=>d2(n,u.origin)<=1);
 if(s.tier===3&&u.elapsed>=.8){const target=near(g,p,230,1)[0];if(target)u.angle=angleTo(p,target);u.origin=point(p,u.angle,45);u.center=point(u.origin,u.angle,115);u.tick-=dt;if(u.tick<=0&&u.remaining>.25){u.tick=.55;for(const e of along(g,u.origin,u.center,u.radius))hit(g,api,e,48*st.damage,'active',u.budget,u.budgetCap);fx(g,'swordUnion',{...u.origin,toX:u.center.x,toY:u.center.y,radius:u.radius,angle:u.angle,life:.3,maxLife:.3});}}
 else if(!u.struck&&u.elapsed>=.8){u.struck=true;const endpoint=s.tier===1?u.center:point(u.origin,u.angle,90);for(const e of along(g,u.origin,endpoint,u.radius))hit(g,api,e,(110+8*s.swords.length)*st.damage,'active',u.budget,u.budgetCap);fx(g,'swordUnion',{...u.origin,toX:endpoint.x,toY:endpoint.y,radius:u.radius,angle:u.angle,life:.35,maxLife:.35});}
 if(s.tier===2&&u.elapsed>=.8&&u.remaining>.25){const from={...u.center};u.center=point(u.origin,u.angle,Math.min(300,90+(u.elapsed-.8)*220));for(const e of along(g,from,u.center,u.radius*.65))hit(g,api,e,45*st.damage,'active',u.budget,u.budgetCap);}
 // Split is presentation metadata only: finish on each real entity before return resumes.
 if(u.phase==='split'){u.splitOrigin||={...u.center};const t=clamp(1-u.remaining/.25,0,1);u.splitVisual=s.swords.map(b=>({id:b.id,x:u.splitOrigin.x+(b.x-u.splitOrigin.x)*t,y:u.splitOrigin.y+(b.y-u.splitOrigin.y)*t}));}
 if(u.remaining<=0){if(s.tier===3){for(const e of near(g,u.center,u.radius,Infinity))hit(g,api,e,70*st.damage,'active',u.budget,u.budgetCap);fx(g,'swordUnion',{...u.origin,toX:u.center.x,toY:u.center.y,radius:u.radius,angle:u.angle,life:.35,maxLife:.35});}s.union=null;for(const sword of s.swords){sword.phase='return';sword.readyTime=s.time+.18;delete sword.unionFrom;}fx(g,'swordSplit',{...p,radius:70});}return true;
}
function updateSwords(g,dt,api){
 const s=g.mythicHero;ensureSwords(g);const c=swordConfig(g),st=getCombatStats(g),p=g.player,r=progress(g);
 if(s.focus){s.focus.remaining-=dt;if(s.tier===2&&s.focus.targetId&&!g.enemies.some(e=>e.id===s.focus.targetId&&alive(e)))s.focus.remaining=0;if(s.focus.remaining<=0){s.focus=null;if(s.tier===2)for(const sword of s.swords)sword.phase='return';}}
 if(s.union){updateUnion(g,dt,api);return;}
 if(p.mythicSwordGuard){p.mythicSwordGuard.remaining-=dt;if(p.mythicSwordGuard.remaining<=0||p.mythicSwordGuard.charges<=0)delete p.mythicSwordGuard;}
 s.recallTime=Math.max(0,s.recallTime-dt);
 s.clock-=dt;if(s.tier<3&&s.clock<=0){const target=near(g,p,105*st.area,1)[0];if(target){const a=angleTo(p,target);for(const e of near(g,p,95*st.area,Infinity))if(pointInSector(e,p,a,95*st.area,1.5))hit(g,api,e,25*power(g),'basic');fx(g,'swordSlash',{shape:'sector',...p,radius:95*st.area,width:1.5,angle:a,sound:'bladeCut'});pose(g);
  if(s.tier===1&&!s.recallTime){for(let i=0;i<s.swords.length;i++){const sword=s.swords[i],spread=r.branch==='a'?(i-(s.swords.length-1)/2)*.2:r.branch==='b'?0:(i-(s.swords.length-1)/2)*.16;sword.phase='pass';sword.passPoint=point(p,a+spread,155);sword.passTime=.7;sword.readyTime=s.time+i*.035;}}
 }s.clock=.75/st.attackSpeed;}
 for(let i=0;i<s.swords.length;i++){const sword=s.swords[i],from={x:sword.x,y:sword.y};if(s.recallTime>0&&sword.phase!=='counter')sword.phase='return';
  if(s.recallTime>0&&s.tier>=2&&d2(sword,p)<85**2&&sword.phase!=='counter'){
   const a=s.guardAngle??(p.facing<0?Math.PI:0),at=s.tier===3?point(point(p,a,45),a+Math.PI/2,(i-(s.swords.length-1)/2)*18):point(p,s.time*2+i*TAU/s.swords.length,50);advance(g,sword,at,c.speed*1.4,dt,api);sword.phase='guard';swordHits(g,sword,from,api,true);
   if(sword.guardCharges>0){const shot=(g.enemyProjectiles||[]).find(o=>!o.hit&&o.life>0&&o.kind!=='laneShell'&&segmentDistance(sword,o,point(o,Math.atan2(o.vy,o.vx),Math.hypot(o.vx,o.vy)*dt))<22+(o.radius||5));if(shot){shot.hit=true;sword.guardCharges--;fx(g,'swordHit',{...sword,radius:24});if(s.tier===3){const owner=g.enemies.find(e=>e.id===shot.ownerId&&alive(e));if(owner){sword.phase='counter';sword.passPoint={x:owner.x,y:owner.y};sword.passTime=.7;}}}}
  }
  else if(sword.phase==='return'||sword.phase==='guard'){sword.phase='return';advance(g,sword,p,c.speed*1.3,dt,api);swordHits(g,sword,from,api,s.recallTime>0);if(d2(sword,p)<35**2){sword.phase='cruise';sword.evolutionTarget=false;sword.commandActive=false;sword.readyTime=s.time+.12;if(s.tier===1&&s.recallTime>0&&!s.guardGranted){s.guardGranted=true;p.mythicSwordGuard={angle:s.guardAngle,remaining:1.2,charges:1};}}}
  else if(sword.phase==='pass'||sword.phase==='counter'){if(s.time>=sword.readyTime){advance(g,sword,sword.passPoint,c.speed,dt,api);swordHits(g,sword,from,api,sword.phase==='counter');sword.passTime-=dt;if(sword.passTime<=0||d2(sword,sword.passPoint)<12**2){if(evolved(g)&&sword.phase==='pass'&&!sword.commandActive){const occupied=new Set(s.swords.filter(n=>n!==sword&&(n.phase==='chase'||n.phase==='pass')).map(n=>n.targetId)),next=near(g,p,650,160).filter(e=>e.id!==sword.targetId&&!occupied.has(e.id)).sort((a,b)=>d2(a,sword)-d2(b,sword))[0];if(next){sword.chainUsed=false;sword.cycleTargets=new Set([next.id]);sword.phase='chase';sword.targetId=next.id;sword.evolutionTarget=true;sword.readyTime=s.time;continue;}}const reserved=new Set(s.swords.filter(n=>n!==sword&&(n.phase==='chase'||n.phase==='pass')).map(n=>n.targetId)),next=s.tier>=2&&r.rank>=3&&sword.phase==='pass'&&!sword.commandActive&&!sword.chainUsed?near(g,sword,190,20).find(e=>e.id!==sword.targetId&&!sword.cycleTargets?.has(e.id)&&!reserved.has(e.id)):null;if(next){sword.chainUsed=true;sword.phase='chase';sword.targetId=next.id;(sword.cycleTargets||=new Set()).add(next.id);sword.readyTime=s.time;}else sword.phase='return';}}}
  else {const continued=sword.phase==='chase'&&(sword.chainUsed||sword.evolutionTarget)?g.enemies.find(e=>e.id===sword.targetId&&alive(e)):null;if(sword.phase==='chase'&&(sword.chainUsed||sword.evolutionTarget)&&!continued){sword.phase='return';sword.evolutionTarget=false;sword.targetId=null;continue;}const target=continued||swordTarget(g,sword);sword.targetId=target?.id??null;
   if(target&&s.time>=sword.readyTime){if(sword.phase==='cruise'){sword.chainUsed=false;sword.cycleTargets=new Set([target.id]);}sword.phase='chase';const side=s.tier===3&&r.rank>=3&&i%2?Math.PI/2:0,to=side?point(target,angleTo(p,target)+side,20):target;advance(g,sword,to,c.speed,dt,api);swordHits(g,sword,from,api);if(d2(sword,target)<((target.radius||18)+25)**2){sword.phase='pass';const crowded=s.tier>=2&&r.rank>=3&&near(g,target,150,20).some(e=>e.id!==target.id&&(e.x-target.x)*Math.cos(sword.angle)+(e.y-target.y)*Math.sin(sword.angle)>20&&Math.abs((e.x-target.x)*(-Math.sin(sword.angle))+(e.y-target.y)*Math.cos(sword.angle))<70);sword.passPoint=point(target,sword.angle+(side?-.45:0),crowded?(r.branch==='a'?130:110):65);sword.passTime=crowded?.5:.35;}}
   else {sword.phase='cruise';advance(g,sword,point(p,s.tier===1?i*TAU/c.count-Math.PI/2:s.time*.4+i*TAU/c.count,s.tier===1?24:45),c.speed,dt,api);}
  }sword.trail.push({x:sword.x,y:sword.y});sword.trail=sword.trail.slice(-7);
 }
}
function clone(g,p,remaining){const s=g.mythicHero;return {id:++s.serial,...bounded(g,p,18),remaining,lureTime:1.5,hp:70,maxHp:70,radius:18,invulnerable:0,facing:g.player.facing||1,kind:g.player.kind,heroTier:s.tier,mythicClone:true,dead:false,anim:'idle',animTime:0};}
export function getMythicDecoy(g,e){const s=g.mythicHero;if(g.phase!=='playing'||s?.heroId!=='spiral'||immovable(e)||e.elite||!alive(e))return null;return (s.clones||[]).filter(c=>!c.dead&&c.hp>0&&c.remaining>0&&c.lureTime>0&&d2(c,e)<=260**2).sort((a,b)=>d2(a,e)-d2(b,e)||a.id-b.id)[0]||null;}
// Basic collisions are short, finite attacks. Only Q owns a lasting field.
function emitOrb(g,at,angle,large=false,coefficient=1,shared=null,category='basic',cloneId=null,extra={}){
 const s=g.mythicHero,r=progress(g),st=getCombatStats(g),geo=getSkillGeometry(g,'spiralOrb');if(s.orbs.length>=32)return null;
 const orb={id:++s.serial,x:at.x,y:at.y,vx:Math.cos(angle)*(large?340:420),vy:Math.sin(angle)*(large?340:420),angle,radius:large?geo.radius:(s.tier>=2&&r.rank>=3?(r.branch==='a'?55:r.branch==='b'?38:42):(r.branch==='a'?27:20)+s.tier*2)*st.area,phase:'flight',life:large?7:1.25,remaining:large?geo.duration+.4*perk(g,'spiral_control'):0,grindDuration:large?geo.duration:0,distance:large?geo.length:440,tick:0,age:0,large,cloneId,coefficient,category,budget:shared||new Map(),budgetCap:(large?230:95)*power(g),hitIds:new Set(),rank:r.rank,branch:r.branch,tier:s.tier,child:false,...extra};s.orbs.push(orb);return orb;
}
function volley(g,a,large=false,category='basic'){
 const s=g.mythicHero,r=progress(g),targets=near(g,g.player,470,8),target=targets[0],angle=a??(target?angleTo(g.player,target):g.player.facing<0?Math.PI:0),budget=new Map();
 if(large){emitOrb(g,g.player,angle,true,1,budget,category);for(const c of s.clones.filter(c=>!c.dead&&c.hp>0&&c.remaining>0&&c.copyReady)){c.copyReady=false;emitOrb(g,c,angleTo(c,point(g.player,angle,240)),true,.35,budget,category,c.id,{remaining:1.25,copy:true,tier:1});}return;}
 const fire=(at,ang,scale,extra={})=>emitOrb(g,at,ang,false,scale,budget,'basic',null,extra);
 if(s.tier===2){const cycle=++s.serial,pairState={crossed:false};fire(point(g.player,angle-Math.PI/2,15),angle,.72,{pair:cycle,pairState,first:true}); s.pending.push({delay:.09,kind:'spiralBasic',fn:()=>{const to=r.rank>=3?(targets.slice(1).find(e=>!target||d2(e,target)<200**2)||target):r.branch==='a'?(targets[1]||target):target,origin=point(g.player,angle+Math.PI/2,15);fire(origin,to?angleTo(origin,to):angle,.72,{pair:cycle,pairState,last:true});}});}
 else if(evolved(g)){const lanes=r.branch==='a'?4:3,used=new Set();for(let i=0;i<lanes;i++){const pool=near(g,g.player,650,160),candidate=pool.filter(e=>!used.has(e.id)&&Math.abs(Math.atan2(Math.sin(angleTo(g.player,e)-angle-i*TAU/lanes),Math.cos(angleTo(g.player,e)-angle-i*TAU/lanes)))<1.05).sort((a,b)=>d2(a,g.player)-d2(b,g.player))[0]||pool.find(e=>!used.has(e.id));if(candidate)used.add(candidate.id);fire(g.player,candidate?angleTo(g.player,candidate):target&&immovable(target)?angleTo(g.player,target):angle+i*TAU/lanes,1,{evolutionLane:true,distance:650,life:1.7,radius:(r.branch==='a'?52:42)*getCombatStats(g).area,last:true});}}else fire(g.player,angle,1,{last:true});
 for(const c of s.clones.filter(c=>!c.dead&&c.remaining>0&&c.hp>0&&!s.convergence?.sideIds?.includes(c.id))){const to=target||point(g.player,angle,180);emitOrb(g,c,angleTo(c,to),false,.35+.1*perk(g,'spiral_shadow'),budget,'basic',c.id,{tier:1,rank:1,branch:null,child:true});if(c.copyReady){const copied=emitOrb(g,c,angleTo(c,to),false,.6,budget,'basic',c.id,{tier:1,rank:1,branch:null,child:true,copy:true,radius:34*getCombatStats(g).area});if(copied)c.copyReady=false;}c.anim='attack';c.animTime=0;}
 fx(g,'spiralOrb',{...g.player,radius:22,angle,sound:'orb'});pose(g);
}
function pull(g,center,radius,speed,dt,api,controlled){for(const e of near(g,center,radius,Infinity)){if(immovable(e)||controlled.has(e.id))continue;controlled.add(e.id);const distance=Math.sqrt(d2(e,center)),step=Math.min(Math.max(0,distance-8),speed*(e.elite?.25:1)*dt);if(step>0)move(g,e,point(e,angleTo(e,center),step),api);e.slow=Math.max(e.slow||0,e.elite?.08:.18);}}
function burstOrb(g,o,api){
 const st=getCombatStats(g),impactRadius=o.evolutionLane?(o.branch==='b'?115:80)*st.area:o.radius+(o.large?18:10)*st.area;radial(g,o,impactRadius,(o.large?38:24)*power(g)*o.coefficient,api,o.category,o.budget,o.budgetCap);
 if(!o.large&&!o.child){
  if(o.tier===3)spawnWindBlades(g,o);
  if(o.rank>=2&&o.tier!==3){const distance=(o.branch==='b'?110:62)*st.area, end=point(o,o.angle,distance);for(const e of along(g,o,end,(o.branch==='a'?46:13)*st.area))hit(g,api,e,12*power(g)*o.coefficient,'basic',o.budget,o.budgetCap);fx(g,'spiralBlade',{...o,toX:end.x,toY:end.y,radius:o.branch==='a'?65:40,life:.24,maxLife:.24});}
  if(o.tier===2&&o.rank>=3&&!o.pairState?.crossed){const paired=g.mythicHero.orbs.find(p=>p!==o&&p.pair===o.pair&&p.phase==='flight');if(paired){o.pairState.crossed=true;paired.cross=true;for(const a of [o.angle+Math.PI/2,o.angle-Math.PI/2])for(const e of along(g,o,point(o,a,o.branch==='a'?140:110),20))hit(g,api,e,10*power(g),'basic',o.budget,o.budgetCap);fx(g,'spiralCross',{...o,radius:o.branch==='a'?140:110,angle:o.angle,life:.24,maxLife:.24});}}
  if(o.tier===3&&o.rank>=3&&o.last&&o.branch!=='b'&&!o.evolutionLane){const angles=o.branch==='a'?[-.9,-.3,.3,.9]:[-.65,.65],neighbors=near(g,o,220,12).filter(e=>!o.hitIds.has(e.id));for(let i=0;i<angles.length;i++){const a=neighbors[i]?angleTo(o,neighbors[i]):o.angle+angles[i];emitOrb(g,o,a,false,.35,o.budget,'basic',null,{child:true,distance:190,life:.6,rank:1,tier:1,branch:null,budgetCap:o.budgetCap});}}
 }
 fx(g,'spiralBurst',{...o,radius:impactRadius,life:.3,maxLife:.3});o.life=0;
}
function spawnWindBlades(g,o){const s=g.mythicHero;if(s.windBlades.length>=16)return;const group={id:++s.serial,origin:{x:o.x,y:o.y},x:o.x,y:o.y,angle:o.angle,rank:o.rank,branch:o.branch,phase:o.rank>=2?'forward':'ring',elapsed:0,evolution:o.evolutionLane===true,returnOrigin:{x:g.player.x,y:g.player.y},remaining:o.evolutionLane?1.6:o.rank>=3?.6:o.branch==='b'?.46:o.rank>=2?.34:.2,drillHits:new Set(),budget:o.budget,budgetCap:o.budgetCap,damage:8*power(g)*o.coefficient,blades:[]};for(let i=0;i<3;i++){const at=point(point(o,o.angle,(i-1)*14),o.angle+Math.PI/2,-38);group.blades.push({id:++s.serial,...at,angle:o.angle+Math.PI/2,hitIds:new Set()});}s.windBlades.push(group);}
// Preserve the original close cut before extending; front-loaded 110px travel skips contact.
function updateWindBlades(g,dt,api){const s=g.mythicHero;for(const group of s.windBlades){group.elapsed+=dt;group.remaining-=dt;if(group.evolution){const fromCenter={x:group.x,y:group.y};if(!Number.isFinite(fromCenter.x)){group.x=group.origin.x;group.y=group.origin.y;}const returning=group.elapsed>.35,target=returning?g.player:point(group.origin,group.angle,140);advance(g,group,target,returning?720:400,dt,api);group.phase=returning?'return':'forward';for(let i=0;i<group.blades.length;i++){const b=group.blades[i],from={x:b.x,y:b.y},a=group.elapsed*8+i*TAU/3,to=point(group,a,36);b.angle=a+Math.PI/2;move(g,b,to,api);const ids=returning?(b.returnHits||=new Set()):b.hitIds;for(const e of along(g,from,b,18*getCombatStats(g).area).filter(e=>!ids.has(e.id)&&canHit(g,e,'basic',group.budget,group.budgetCap))){if(hit(g,api,e,group.damage,'basic',group.budget,group.budgetCap)>0)ids.add(e.id);}}if(returning&&d2(group,g.player)<30**2)group.remaining=0;continue;}const high=group.rank>=3,forwardTime=group.rank>=2?.12:0,drilling=group.branch==='b'&&group.elapsed>.3,extension=high&&!drilling?clamp((group.elapsed-.32)/.08,0,1):0,forward=group.rank>=2?Math.min(1,group.elapsed/forwardTime)*38+extension*72:0,cross=clamp((group.elapsed-forwardTime)/.2,0,1),transverse=high&&group.elapsed>.32&&!drilling?(group.elapsed<.4?38-extension*108:-70+clamp((group.elapsed-.4)/.2,0,1)*140):-38+cross*76;group.phase=group.rank===1?'ring':drilling?'drill':group.elapsed<forwardTime?'forward':'cross';const center=point(group.origin,group.angle,forward+(drilling?(group.elapsed-.3)*(high?500:350):0));group.x=center.x;group.y=center.y;
 for(let i=0;i<group.blades.length;i++){const blade=group.blades[i],from={x:blade.x,y:blade.y},to=group.rank===1?point(center,group.angle+i*TAU/3+group.elapsed*14,24):drilling?point(center,group.angle+Math.PI/2,(i-1)*5):point(point(center,group.angle,(i-1)*14),group.angle+Math.PI/2,transverse);blade.angle=group.rank===1?angleTo(center,to)+Math.PI/2:drilling?group.angle:group.angle+Math.PI/2+cross*.5;if(!move(g,blade,to,api)){group.remaining=0;continue;}for(const e of along(g,from,blade,8)){const hits=drilling?group.drillHits:blade.hitIds;if(!hits.has(e.id)&&canHit(g,e,'basic',group.budget,group.budgetCap)){const n=hit(g,api,e,group.damage*(drilling?2:1),'basic',group.budget,group.budgetCap);if(n>0)hits.add(e.id);}}}
 }s.windBlades=s.windBlades.filter(b=>b.remaining>0);}
function updateConvergence(g,dt,api){
 const s=g.mythicHero,v=s.convergence,p=g.player;if(!v)return;
 v.elapsed+=dt;v.remaining=Math.max(0,v.duration-v.elapsed);v.rotation+=dt*5;const dx=p.x-v.lastPlayer.x,dy=p.y-v.lastPlayer.y;if(v.phase==='held'&&dx*dx+dy*dy>.04)v.angle=Math.atan2(dy,dx);v.lastPlayer={x:p.x,y:p.y};
 const release=s.tier>=2&&v.elapsed>v.duration*.65;v.phase=release?'roll':'held';v.height=release?0:32;v.charge=Math.min(1,v.elapsed/.18);
 if(!release){const at=bounded(g,point(p,v.angle,v.radius*.78+25),v.radius*.4);v.x=at.x;v.y=at.y;p.mythicFrontGuard={angle:v.angle,remaining:v.remaining,factor:.65};}
 else {delete p.mythicFrontGuard;move(g,v,point(v,v.angle,210*dt),api);}
 v.tick-=dt;const damageNow=v.tick<=0;if(damageNow)v.tick=.18;
 // Main and side contact faces share one cast budget, never a player-centered circle.
 const faces=[v];for(const id of v.sideIds){const c=s.clones.find(c=>c.id===id);if(!c)continue;const i=v.sideIds.indexOf(id),side=i%2?-1:1,target=point(point(p,v.angle,55+(i>>1)*30),v.angle+Math.PI/2,side*(v.radius+30));if(!release)advance(g,c,target,210,dt,api);else advance(g,c,point(v,v.angle,-32),285,dt,api);c.facing=Math.cos(v.angle)<0?-1:1;c.anim='attack';c.pushOrb={...point(c,v.angle,32),radius:v.radius*.36,angle:v.angle};faces.push(c.pushOrb);}
 for(const f of faces)for(const e of near(g,f,f.radius,Infinity)){if(damageNow)hit(g,api,e,15*power(g)*(f===v?1:.35),'active',v.budget,v.budgetCap);if(!immovable(e)){e.slow=Math.max(e.slow||0,.15);move(g,e,point(e,v.angle,(e.elite?10:38)*dt),api);}}
 if(v.remaining<=0){for(const f of faces){radial(g,f,f.radius+12,42*power(g)*(f===v?1:.35),api,'active',v.budget,v.budgetCap);fx(g,'spiralConvergence',{...f,phase:'burst',life:.35,maxLife:.35});}for(const c of s.clones)delete c.pushOrb;delete p.mythicFrontGuard;s.convergence=null;}
}
function updateOrbs(g,dt,api){const s=g.mythicHero,controls=new Set();
 for(const c of s.clones){c.remaining-=dt;c.invulnerable=Math.max(0,(c.invulnerable||0)-dt);c.lureTime=Math.max(0,c.lureTime-dt);c.animTime+=dt;if(c.animTime>.3)c.anim='idle';if(c.reposition){advance(g,c,c.reposition,330,dt,api);if(d2(c,c.reposition)<12**2)delete c.reposition;}}s.clones=s.clones.filter(c=>!c.dead&&c.hp>0&&c.remaining>0);
 updateConvergence(g,dt,api);
 for(const o of [...s.orbs]){o.life-=dt;o.age+=dt;if(o.life<=0)continue;
  if(o.phase==='flight'){const from={x:o.x,y:o.y},speed=Math.hypot(o.vx,o.vy),distance=Math.min(o.distance,speed*dt),to=point(o,o.angle,distance);o.distance-=distance;
   if(o.evolutionLane){let stopped=false;for(const e of along(g,from,to,o.radius).filter(e=>!o.hitIds.has(e.id)&&canHit(g,e,'basic',o.budget,o.budgetCap))){if(hit(g,api,e,26*power(g)*o.coefficient,'basic',o.budget,o.budgetCap)>0)o.hitIds.add(e.id);if(immovable(e)){o.x=to.x;o.y=to.y;burstOrb(g,o,api);stopped=true;break;}}if(!stopped&&(!move(g,o,to,api)||o.distance<=0))burstOrb(g,o,api);continue;}const first=along(g,from,to,Math.min(12,o.radius*.5)).find(e=>!o.hitIds.has(e.id)&&(o.large||canHit(g,e,'basic',o.budget,o.budgetCap))),wall=api.movementHitsWall?.(from.x,from.y,to.x,to.y,12);
   if(first){const t=projection(first,from,to);o.x=from.x+(to.x-from.x)*t;o.y=from.y+(to.y-from.y)*t;
    if(o.large){o.phase='grind';o.anchor={x:o.x,y:o.y};o.tick=0;}
    else {const n=hit(g,api,first,18*power(g)*o.coefficient,'basic',o.budget,o.budgetCap);if(n>0)o.hitIds.add(first.id);if(o.tier===2&&o.first&&!immovable(first))move(g,first,point(first,o.angle,20),api);if(o.tier===1&&o.rank>=3&&!o.child&&!first.elite&&!immovable(first)&&o.hitIds.size===1){o.x=to.x;o.y=to.y;}else burstOrb(g,o,api);}
   }else if(wall||o.distance<=0){o.x=wall?from.x:to.x;o.y=wall?from.y:to.y;if(o.large){o.phase='grind';o.anchor={x:o.x,y:o.y};o.tick=0;}else burstOrb(g,o,api);}else {o.x=to.x;o.y=to.y;}
  }
  if(o.phase==='grind'&&o.large){o.remaining-=dt;o.tick-=dt;const anchor=o.anchor||o;
   if(o.tier===2&&o.age<1.9)move(g,o,point(o,o.angle,52*dt),api);
   if(o.tier===3){const candidates=near(g,anchor,180,16);if(candidates.length){const cluster=candidates.map(e=>({e,count:candidates.filter(n=>d2(n,e)<90**2).length})).sort((a,b)=>b.count-a.count||d2(a.e,o)-d2(b.e,o));if(cluster[0].count>1&&d2(cluster[0].e,anchor)<180**2)advance(g,o,cluster[0].e,48,dt,api);}}
   pull(g,o,o.radius+28,48,dt,api,controls);if(o.tick<=0){o.tick=.2;radial(g,o,o.radius,14*power(g)*o.coefficient,api,'active',o.budget,o.budgetCap);fx(g,'spiralGrind',{x:o.x,y:o.y,radius:o.radius,large:true,life:.22,maxLife:.22});}if(o.remaining<=0)burstOrb(g,o,api);
  }
 }s.orbs=s.orbs.filter(o=>o.life>0);
 updateWindBlades(g,dt,api);
 s.clock-=dt;if(s.clock<=0){if(!s.convergence)volley(g,null);s.clock=.78/getCombatStats(g).attackSpeed;}
}
// A planted blade is inert material. Only a player E command consumes it.
const PETAL_CAP=48;
// Capacity eviction owns only idle basic material, never a travelling or active blade.
function petalShot(g,from,a,distance,damage,category='basic',extra={}){const s=g.mythicHero;if(s.petals.length>=PETAL_CAP){const idle=s.petals.findIndex(b=>b.remaining<=0||(b.phase==='planted'&&b.category!=='active'));if(idle<0){s.petalCapacityBlocked=true;return null;}s.petals.splice(idle,1);}s.petalCapacityBlocked=false;const blade={id:++s.serial,x:from.x,y:from.y,angle:a,radius:6,speed:460,phase:'flight',distance:Math.max(24,distance),remaining:9,damage,category,hitIds:new Set(),budget:extra.budget||new Map(),budgetCap:extra.budgetCap||100*power(g),...extra};s.petals.push(blade);return blade;}
function petalFan(g,from,a,count,spread,distance,damage,category='basic',extra={}){for(let i=0;i<count;i++)petalShot(g,from,a+(count===1?0:(i/(count-1)-.5)*spread),distance+(i%2)*18,damage,category,{...extra,pin:extra.pin&&i<Math.ceil(count/2)});}
// Basic high buds own two finite, offset flights; planted material remains inert.
function openBud(g,bud,api){const s=g.mythicHero,r=progress(g);radial(g,bud,38,25*power(g),api,bud.category,bud.budget,bud.budgetCap);fx(g,'petalBurst',{...bud,radius:48,life:.3,maxLife:.3});const count=(r.branch==='a'?8:4)+(bud.category==='active'?perk(g,'petal_current'):0),origin={x:bud.x,y:bud.y},spread=r.branch==='b'?(bud.evolution?1.8:1):TAU-.4,high=bud.category==='basic'&&r.rank>=3,emit=(second=false)=>petalFan(g,origin,bud.angle+(high&&second?(r.branch==='b'?(bud.evolution?Math.PI+.12:.12):Math.PI/count):0),count,spread,bud.evolution?(r.branch==='b'?340:280):high?(r.branch==='b'?190:r.branch==='a'?170:145):75,10*power(g),bud.category,{budget:bud.budget,budgetCap:bud.budgetCap,pin:r.branch==='b',evolutionReturn:bud.evolution===true,returnOrigin:bud.evolution?origin:null,speed:bud.evolution?700:460,pierce:high?(r.branch==='b'?4:3):1,child:true});emit();if(r.rank>=3)s.pending.push({delay:.2,fn:()=>emit(true)});bud.remaining=0;}
function plant(g,b,api){const s=g.mythicHero;b.phase='planted';b.remaining=8;b.angle+=Math.PI/2;b.hitIds.clear();fx(g,'petalPlant',{...b,radius:15,life:.2,maxLife:.2});
 if(b.sideBud&&!b.child){const origin={x:b.x,y:b.y};petalShot(g,origin,b.angle-Math.PI/2+(b.sideSign||1)*.6,60,b.damage*.5,b.category,{budget:b.budget,budgetCap:b.budgetCap,child:true});}
 if(s.recallWindow>0)recallBlade(g,b,s.recallBudget,s.recallCounts);
}
function recallBlade(g,b,budget,counts){b.phase='recall';b.speed=650;b.remaining=2.5;b.hitIds.clear();b.recallBudget=budget;b.recallCounts=counts;b.recallCap=220*getCombatStats(g).damage;b.recallDamage=(b.emergency?15:35+10*perk(g,'petal_net'))*power(g);b.category='active';}
function basicPetal(g,api){const s=g.mythicHero,r=progress(g),p=g.player,pool=near(g,p,evolved(g)?650:480,evolved(g)?160:1),target=evolved(g)?pool.find(e=>d2(e,p)<160**2)||pool.find(e=>d2(e,p)>180**2)||pool[0]:pool[0];if(!target)return;const a=angleTo(p,target),distance=Math.min(evolved(g)?620:470,Math.sqrt(d2(p,target))+(evolved(g)?100:80)),budget=new Map(),base=20*power(g);pose(g);
 if(s.tier===3){const extra={bud:true,budget,budgetCap:100*power(g),pierce:evolved(g)?99:r.rank>=2?2:1,evolution:evolved(g),radius:evolved(g)?14:6};petalShot(g,p,a,distance,base,'basic',extra);if(evolved(g)&&r.branch==='b'){const second=pool.find(e=>e.id!==target.id&&Math.abs(Math.atan2(Math.sin(angleTo(p,e)-a),Math.cos(angleTo(p,e)-a)))>.65);if(second)petalShot(g,p,angleTo(p,second),Math.min(620,Math.sqrt(d2(p,second))+100),base,'basic',extra);}return;}
 if(s.tier===1){petalShot(g,p,a,distance,base,'basic',{budget,pierce:r.rank>=3?5:1});if(r.rank>=2)s.pending.push({delay:.1,fn:()=>petalShot(g,g.player,a,distance+25,base*.7,'basic',{budget,pierce:r.rank>=3?5:1})});if(r.rank>=3&&r.branch!=='b')petalShot(g,p,a+.13,distance,base*.6,'basic',{budget,pierce:5});if(r.branch==='a')petalFan(g,p,a,3,.6,distance,base*.45,'basic',{budget,pierce:3});}
 else {const assigned=new Set();for(const side of [-1,1]){const candidates=r.rank>=3?near(g,p,480,12).filter(e=>!assigned.has(e.id)):[],sideTarget=candidates.filter(e=>((e.x-p.x)*(-Math.sin(a))+(e.y-p.y)*Math.cos(a))*side>15)[0]||candidates[0]||target;assigned.add(sideTarget.id);const from=point(p,a+Math.PI/2,side*17),wingAngle=angleTo(from,point(sideTarget,a+Math.PI/2,side*8));petalShot(g,from,wingAngle,Math.min(470,Math.sqrt(d2(p,sideTarget))+80),base*.8,'basic',{budget,sideBud:r.rank>=2,sideSign:side,wingExitAngle:wingAngle+side*.5,wingDistance:r.rank>=3?150:90,pierce:r.rank>=3?4:2});if(r.branch==='a')petalShot(g,from,a+side*.3,distance,base*.5,'basic',{budget,child:true});}if(r.rank>=3)petalShot(g,p,a,distance+(r.branch==='b'?80:0),base,'basic',{budget,pierce:6});}
}
function startRecall(g,a,api){const s=g.mythicHero,p=g.player;if(s.tier>=2)move(g,p,point(p,a,65),api);s.recallBudget=new Map();s.recallCounts=new Map();s.recallWindow=s.tier===3?1.7:0;const planted=s.petals.filter(b=>b.phase==='planted'||b.phase==='pinned');if(planted.length===0){for(const side of [-1,1]){const b=petalShot(g,point(p,a+side*.2,100),a+Math.PI,60,0,'active',{emergency:true});if(b){b.phase='planted';planted.push(b);}}}for(const b of planted)recallBlade(g,b,s.recallBudget,s.recallCounts);fx(g,'petalRecall',{...p,radius:65,life:.3,maxLife:.3});}
function updatePetals(g,dt,api){const s=g.mythicHero,p=g.player,r=progress(g);s.recallWindow=Math.max(0,(s.recallWindow||0)-dt);
 if(s.bloom){const b=s.bloom;b.elapsed+=dt;b.remaining=Math.max(0,b.duration-b.elapsed);p.mythicAirborne={remaining:b.remaining,height:42*Math.sin(Math.PI*Math.min(1,b.elapsed/b.duration))};b.x=p.x;b.y=p.y;b.tick-=dt;
  if(b.tick<=0&&(b.waves||0)<(s.tier===3?5:s.tier===2?2:1)){b.waves=(b.waves||0)+1;b.tick=s.tier===3?.24:s.tier===2?.4:99;const count=s.tier===3?4:5,spread=s.tier===3?TAU-.3:1.25,angle=s.tier===3?b.angle+b.elapsed*2:b.angle;petalFan(g,p,angle,count,spread,180,24*getCombatStats(g).damage,'active',{budget:b.budget,budgetCap:200*getCombatStats(g).damage,child:true});fx(g,'petalRain',{...p,radius:80,angle,life:.3,maxLife:.3});}
  if(b.remaining<=0){s.bloom=null;delete p.mythicAirborne;}
 }
 for(const b of [...s.petals]){b.remaining-=dt;if(b.remaining<=0)continue;
  if(b.phase==='pinned'){const target=g.enemies.find(e=>e.id===b.pinnedId&&alive(e));if(target){b.x=target.x;b.y=target.y;}else b.phase='planted';continue;}if(b.phase==='planted')continue;
  const from={x:b.x,y:b.y};if(b.phase==='autoReturn'){const destination=b.returnOrigin,dist=Math.sqrt(d2(b,destination)),to=point(b,angleTo(b,destination),Math.min(dist,b.speed*dt));b.angle=angleTo(b,destination);b.x=to.x;b.y=to.y;for(const e of along(g,from,to,14*getCombatStats(g).area).filter(e=>!b.hitIds.has(e.id)&&canHit(g,e,b.category,b.budget,b.budgetCap))){if(hit(g,api,e,b.damage,b.category,b.budget,b.budgetCap)>0)b.hitIds.add(e.id);}if(dist<=b.speed*dt+8)plant(g,b,api);continue;}if(b.phase==='recall'){
   const dist=Math.sqrt(d2(b,p)),to=point(b,angleTo(b,p),Math.min(dist,b.speed*dt));b.angle=angleTo(b,p);b.x=to.x;b.y=to.y;
   for(const e of along(g,from,to,9))if(!b.hitIds.has(e.id)&&canHit(g,e,'active',b.recallBudget,b.recallCap)){const n=hit(g,api,e,b.recallDamage,'active',b.recallBudget,b.recallCap);if(n<=0)continue;b.hitIds.add(e.id);const count=(b.recallCounts.get(e.id)||0)+1;b.recallCounts.set(e.id,count);if(count>=3&&!immovable(e)){e.frozen=Math.max(e.frozen||0,e.elite?.21:.6);}}
   if(dist<=b.speed*dt+10)b.remaining=0;continue;
  }
  const distance=Math.min(b.distance,b.speed*dt),to=point(b,b.angle,distance),wall=api.movementHitsWall?.(from.x,from.y,to.x,to.y,6);b.distance-=distance;if(!wall){b.x=to.x;b.y=to.y;}else b.distance=0;
  const enemies=along(g,from,b,(b.evolution||b.evolutionReturn?14:8)*getCombatStats(g).area).filter(e=>!b.hitIds.has(e.id)&&canHit(g,e,b.category,b.budget,b.budgetCap));for(const e of enemies){const n=hit(g,api,e,b.damage,b.category,b.budget,b.budgetCap);if(n<=0)continue;b.hitIds.add(e.id);if(b.wingExitAngle!==undefined&&!b.wingTurned){b.wingTurned=true;b.angle=b.wingExitAngle;b.distance=Math.min(b.distance,b.wingDistance||90);}
   if(b.bud&&(!b.pierce||b.hitIds.size>=b.pierce||b.category==='basic'&&(immovable(e)||e.elite))){b.x=e.x;b.y=e.y;openBud(g,b,api);break;}
   if(b.pin&&(e.elite||immovable(e))){b.x=e.x;b.y=e.y;b.phase='pinned';b.pinnedId=e.id;b.remaining=8;if(s.recallWindow>0)recallBlade(g,b,s.recallBudget,s.recallCounts);break;}if(!b.bud&&b.hitIds.size>=(b.pierce||1)&&!b.hitDistance){b.hitDistance=true;b.distance=Math.min(b.distance,70);}
  }
  if(b.remaining>0&&b.phase==='flight'&&b.distance<=0){if(b.bud)openBud(g,b,api);else if(b.evolutionReturn){b.phase='autoReturn';b.remaining=1.2;b.hitIds.clear();}else plant(g,b,api);}
 }s.petals=s.petals.filter(b=>b.remaining>0);
 s.clock-=dt;if(s.clock<=0){if(!s.bloom)basicPetal(g,api);s.clock=(evolved(g)?.5:s.tier===3?.62:.8)/getCombatStats(g).attackSpeed;}
}
export function castMythicHero(g,id,aim,api){
 const heroId=g.heroId||g.player?.heroId;if(!OWN_SKILLS[heroId]?.includes(id))return null;if(g.phase!=='playing'||g.player.hp<=0)return false;
 const s=ensure(g),a=aimAngle(g,aim),p=g.player,st=getCombatStats(g),geo=getSkillGeometry(g,id);s.frameBudget.clear();
 if(heroId==='sword'&&s.union){g.announcement={text:'巨剑正在合击，待拆剑后再下令',remaining:1.2};return false;}
 if(id==='swordFocus'){ensureSwords(g);const center=bounded(g,point(p,a,geo.length));if(s.tier===1){pose(g);for(const e of near(g,p,95*st.area,Infinity))if(pointInSector(e,p,a,95*st.area,1.5))hit(g,api,e,35*st.damage,'active');for(const sword of s.swords){sword.phase='pass';sword.passPoint=center;sword.commandActive=true;sword.passTime=geo.length/sword.speed+.15;sword.readyTime=s.time;}}
  else {s.focus={...center,radius:geo.radius,remaining:3+perk(g,'sword_focus'),targetId:s.tier===2?near(g,center,geo.radius,1)[0]?.id:null,transferred:false};for(const sword of s.swords){sword.phase='cruise';sword.targetId=null;sword.readyTime=s.time;}}fx(g,'swordFocus',{...center,radius:geo.radius,life:.6,maxLife:.6});}
 else if(id==='swordRecall'){ensureSwords(g);s.recallTime=s.tier===1?1.15:2.1+.15*perk(g,'sword_recall');s.guardAngle=a;s.guardGranted=false;for(const sword of s.swords){sword.phase='return';sword.guardCharges=1;}fx(g,'swordRecall',{shape:'ring',...p,radius:65,life:.5,maxLife:.5});}
 else if(id==='swordUnion'){ensureSwords(g);s.recallTime=0;delete p.mythicSwordGuard;const duration=s.tier===3?3.4:s.tier===2?1.8:1.2;s.union={origin:bounded(g,point(p,a,35)),center:bounded(g,point(p,a,s.tier===2?90:geo.length)),angle:a,radius:geo.radius,duration,elapsed:0,remaining:duration,phase:'gather',struck:false,tick:0,budget:new Map(),budgetCap:260*st.damage};for(const sword of s.swords){sword.phase='union';sword.unionFrom={x:sword.x,y:sword.y};}fx(g,'swordGather',{...p,radius:60,angle:a,life:.45,maxLife:.45});}
 else if(id==='spiralOrb'){if(s.orbs.length>=28){g.announcement={text:'旋丸已满，等待现有旋丸释放',remaining:1.2};return false;}volley(g,a,true,'active');}
 else if(id==='spiralClone'){const count=s.tier===3?4:s.tier===2?2:1;s.clones=s.clones.filter(c=>!c.dead&&c.hp>0&&c.remaining>0).slice(0,count);while(s.clones.length<count)s.clones.push(clone(g,p,geo.duration+perk(g,'spiral_shadow')));for(let i=0;i<s.clones.length;i++){const c=s.clones[i],to=bounded(g,point(point(p,a,s.tier===3?110:35),a+(i%2?1:-1)*Math.PI/2,65+Math.floor(i/2)*30));if(s.tier===3)c.reposition=to;else Object.assign(c,to);c.remaining=geo.duration+perk(g,'spiral_shadow');c.lureTime=1.5;c.copyReady=s.tier>=2;fx(g,'spiralClone',{...c,radius:22,life:.6,maxLife:.6});}}
 else if(id==='spiralConvergence'){if(s.convergence)return false;s.orbs=s.orbs.filter(o=>o.category==='active');s.windBlades=[];s.pending=s.pending.filter(q=>q.kind!=='spiralBasic');const radius=Math.min(92,geo.radius),at=bounded(g,point(p,a,radius*.78+25));s.convergence={id:++s.serial,...at,radius,angle:a,duration:geo.duration,elapsed:0,remaining:geo.duration,phase:'held',height:32,charge:0,rotation:0,tick:0,lastPlayer:{x:p.x,y:p.y},sideIds:s.tier===3?s.clones.filter(c=>!c.dead&&c.hp>0&&c.remaining>0).map(c=>c.id):[],budget:new Map(),budgetCap:230*power(g)};p.mythicFrontGuard={angle:a,remaining:geo.duration,factor:.65};}
 else if(id==='petalSweep'){if(s.petals.length>=PETAL_CAP&&!s.petals.some(b=>b.remaining<=0||(b.phase==='planted'&&b.category!=='active'))){s.petalCapacityBlocked=true;g.announcement={text:'花刃已满，等待现有飞刃落定或召回',remaining:1.2};return false;}const budget=new Map();if(s.tier===3)petalShot(g,p,a,geo.radius+70,42*st.damage,'active',{bud:true,pierce:99,budget,budgetCap:200*st.damage});else if(s.tier===2){for(const side of [-1,1])petalFan(g,point(p,a+Math.PI/2,side*24),a+side*.35,3+perk(g,'petal_current'),.45,geo.radius+100,35*st.damage,'active',{budget,budgetCap:200*st.damage,pierce:6});}else petalFan(g,p,a,5+perk(g,'petal_current'),geo.angle,geo.radius+80,40*st.damage,'active',{budget,budgetCap:200*st.damage,pierce:6});}
 else if(id==='petalPierce'){if(s.tier<3&&s.bloom)return false;startRecall(g,a,api);}
 else if(id==='petalBloom'){if(s.bloom)return false;const duration=s.tier===3?1.25:s.tier===2?.85:.65;s.bloom={x:p.x,y:p.y,angle:a,duration,elapsed:0,remaining:duration,tick:0,budget:new Map()};p.mythicAirborne={remaining:duration,height:0};}
 sound(g,id);return true;
}
export function updateMythicHero(g,dt,api){
 if(g.phase==='defeat'||g.phase==='victory'){clearMythicHero(g);return;}if(g.phase!=='playing'||g.player.hp<=0||!MYTHIC_HERO_IDS.includes(g.heroId||g.player.heroId))return;
 const s=ensure(g);dt=Math.max(0,Math.min(.25,Number(dt)||0));if(dt<=0)return;s.time+=dt;s.frameBudget.clear();
 const pending=s.pending;s.pending=[];for(const q of pending){q.delay-=dt;if(q.delay<=0)q.fn();else s.pending.push(q);}s.pending=s.pending.slice(-8);
 if(s.heroId==='sword')updateSwords(g,dt,api);else if(s.heroId==='spiral')updateOrbs(g,dt,api);else updatePetals(g,dt,api);
}
export function mythicHeroIdentity(g){const id=g.heroId||g.player?.heroId;if(!MYTHIC_HERO_IDS.includes(id))return null;const s=g.mythicHero;return {name:{sword:'御剑修士',spiral:'旋丸影者',petal:'花刃使'}[id],description:{sword:'剑实体自主追击与回航；真君取消本体平A，合剑期间只结算巨剑。',spiral:'旋丸自动攻击，分身诱敌协同，巨丸随移动托举推进。',petal:'自动布刃；走位改变召回路径，腾空播下花雨。'}[id],meter:id==='sword'?s?.union?'收剑 · 合击 · 拆剑':`飞剑 ${s?.swords?.length||0}/${swordConfig(g).count}${s?.recallTime?' · 回航':''}`:id==='spiral'?`旋球 ${s?.orbs?.length||0} · 分身 ${s?.clones?.length||0}`:`落刃 ${s?.petals?.filter(b=>b.phase==='planted').length||0}${s?.recallWindow?' · 召回窗口':''}${s?.bloom?' · 腾空':''}`};}
export function getMythicHeroAim(g,id,aim){
 const heroId=g.heroId||g.player?.heroId;if(!OWN_SKILLS[heroId]?.includes(id))return null;const p=g.player,a=aimAngle(g,aim),geo=getSkillGeometry(g,id),center=bounded(g,point(p,a,geo.length||0));
 if(id==='swordFocus')return {kind:'circle',...center,radius:geo.radius};
 if(id==='swordRecall'||id==='spiralClone'||id==='petalPierce'||id==='petalBloom')return {kind:'circle',x:p.x,y:p.y,radius:geo.radius};
 if(id==='swordUnion')return {kind:'capsule',...bounded(g,point(p,a,35)),toX:center.x,toY:center.y,width:geo.radius,radius:geo.radius,angle:a};
 if(id==='spiralOrb'){const end=point(p,a,geo.length);return {kind:'capsule',x:p.x,y:p.y,toX:end.x,toY:end.y,width:geo.width,angle:a,...(id==='spiralOrb'?{radius:geo.radius}:{})};}
 if(id==='petalSweep')return {kind:'sector',x:p.x,y:p.y,radius:geo.radius,angle:a,width:geo.angle,arc:geo.angle};
 if(id==='spiralConvergence')return {kind:'circle',...bounded(g,point(p,a,Math.min(92,geo.radius)*.78+25)),radius:Math.min(92,geo.radius)};
 return {kind:'circle',...center,radius:geo.radius};
}


