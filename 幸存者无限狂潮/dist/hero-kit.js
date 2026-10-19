import { isOriginalHero, updateOriginalHero } from './original-heroes.js';
import { MYTHIC_HERO_IDS, MYTHIC_HERO_PERKS, updateMythicHero, mythicHeroIdentity } from './mythic-heroes.js';
import { hasJobMechanic } from './ascension-combat.js';
import { ensureAttackProgress, getAttackProgressionInfo, ATTACK_DAMAGE_SCALE, BASIC_WEAPON_GEOMETRY } from './attack-progression.js';
import { onJobBasicAttack, onJobBasicHit } from './job-mechanics.js';
import { getCombatStats } from './combat-stats.js';
import { SPECIAL_HERO_IDS, SPECIAL_HERO_PERKS, updateSpecialHero, specialHeroIdentity } from './special-heroes.js';

const HERO_NAMES = Object.freeze({
  commander: ['风刃指挥官', '近斩自动蓄势接重斩；突进调整站位，旋斩清出通路。'],
  summoner: ['契灵使', '三名有生命的军团自动补员，本体抽魂供灵骸；灵骸爆破和统领合体各司其职。'],
  blink: ['瞬印行者', '本体短刃、单次残影复演、伤口处刑；进场留下返程影，再按同一技能决定撤离。'],
  mage: ['元素法师', '电弧自动输出，冰霜救急，陨星爆发；三阶陨星自行接续元素落击。'],
});

export const HERO_PERKS = Object.freeze({
  ...SPECIAL_HERO_PERKS,
  ...MYTHIC_HERO_PERKS,
  commander: Object.freeze([
    Object.freeze({ id:'commander_reach', name:'长风刃', description:'每层使本体普攻近斩距离增加18。', icon:'◒', max:2 }),
    Object.freeze({ id:'commander_third', name:'破阵式', description:'每层使第三击近斩伤害增加28个百分点。', icon:'Ⅲ', max:2 }),
    Object.freeze({ id:'commander_reserve', name:'蓄势', description:'每层使满剑势重斩伤害增加20%。', icon:'✦', max:2, category:'heroSkill' }),
  ]),
  summoner: Object.freeze([
    Object.freeze({ id:'summoner_bond', name:'灵契共鸣', description:'每层使Q指令期间军团普攻伤害增加18%。', icon:'♟', max:2 }),
    Object.freeze({ id:'summoner_mend', name:'归息', description:'每层使军团脱战恢复1.5%最大生命/秒。', icon:'+', max:2, category:'heroSkill' }),
    Object.freeze({ id:'summoner_echo', name:'双生灵光', description:'第1层每4次、第2层每3次本体抽魂追加40%魂击；派生不额外产骸。', icon:'◇', max:2 }),
  ]),
  blink: Object.freeze([
    Object.freeze({ id:'blink_quarry', name:'猎印', description:'每层使本体普攻与Q直击对当前死印目标伤害增加12%。', icon:'✦', max:2 }),
    Object.freeze({ id:'blink_precision', name:'透骨刃', description:'每层使短刃普攻伤害增加14%、近斩距离增加12。', icon:'╱', max:2 }),
    Object.freeze({ id:'blink_afterimage', name:'返影', description:'每层使本体普攻复演增加15个百分点伤害，Q攻击影伤害增加30%。', icon:'➤', max:2, category:'heroSkill' }),
  ]),
  mage: Object.freeze([
    Object.freeze({ id:'mage_fire', name:'余烬', description:'每层使Q直接火伤增加8%、陨石燃烧坑系数增加4个百分点。', icon:'♨', max:2 }),
    Object.freeze({ id:'mage_frost', name:'凝霜', description:'每层使冰霜新星对轻敌冻结与减缓持续增加0.22秒。', icon:'❉', max:2 }),
    Object.freeze({ id:'mage_stone', name:'星陨', description:'每层使陨星冲击伤害增加12%、冲击半径增加12。', icon:'◆', max:2, category:'heroSkill' }),
  ]),
});

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function perk(game, id) { return clamp(Math.floor(Number(game?.heroPerks?.[id]) || 0), 0, 2); }
function mastered(game, job) { return hasJobMechanic(game,job); }
export function heroPerk(game, id) { return perk(game, id); }
function dist2(a, b) { const dx=a.x-b.x,dy=a.y-b.y; return dx*dx+dy*dy; }
function alive(enemy) { return enemy && !enemy.dead && (enemy.spawnDelay || 0) <= 0 && enemy.hp > 0; }
function target(game, range, preferredId=null) {
  const p=game.player, max=range*range;
  return game.enemies.filter(alive).filter(e=>dist2(p,e)<=max).sort((a,b)=>{
    if (a.id===preferredId) return -1; if (b.id===preferredId) return 1;
    return dist2(p,a)-dist2(p,b)||a.id-b.id;
  })[0] || null;
}
function stats(game) {
  const value=getCombatStats(game)||{};
  return { damage:Number(value.damage)||1, area:Number(value.area)||1, haste:Number(value.haste)||1, attackSpeed:Number(value.attackSpeed)||1, duration:Number(value.duration)||1 };
}
function effect(game, data) { (game.heroEffects ||= []).push({ ...data, life:data.life, maxLife:data.maxLife ?? data.life }); }
function hit(api, enemy, damage, color, source='basicSecondary') { if (alive(enemy) && damage>0) api.damage(enemy, damage, color, source); }
function mainHit(game,kit,enemy,damage,color,meta,api){
 if(!alive(enemy))return;
 hit(api,enemy,damage,color,'basic');
 const event={target:enemy,damage,rank:ensureAttackProgress(game).rank,branch:game.attackProgress.branch,signatureWeapon:true,...meta};
 kit.jobAttackIds ||= new Set();if(!kit.jobAttackIds.has(meta.shotSerial)){kit.jobAttackIds.add(meta.shotSerial);if(kit.jobAttackIds.size>128)kit.jobAttackIds.delete(kit.jobAttackIds.values().next().value);onJobBasicAttack(game,event,api);}
 onJobBasicHit(game,event,api);
}
function serial(kit){kit.mainSerial=(kit.mainSerial||0)+1;return kit.mainSerial;}
function nearest(game,center,radius,excluded=[],cap=1){return game.enemies.filter(alive).filter(e=>!excluded.includes(e.id)&&dist2(center,e)<=radius*radius).sort((a,b)=>dist2(center,a)-dist2(center,b)||a.id-b.id).slice(0,cap);}
function segmentT(e,a,b){const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,((e.x-a.x)*dx+(e.y-a.y)*dy)/len)):0;return dist2(e,{x:a.x+t*dx,y:a.y+t*dy})<=(e.radius+(b.radius||7))**2?t:null;}
function volley(kit,cap){return {serial:serial(kit),primary:new Set(),secondary:new Map(),cap};}
function weaponHit(game,kit,e,shot,api,c=shot.coefficient,phase='outbound'){
 let settled=0,primary=false;const v=shot.volley,anchor=shot.kind==='blade'&&(game.heroState?.blinkAnchors||[]).some(a=>a.remaining>0&&dist2(a,e)<=96**2),d=shot.damage*(anchor?1.2+.12*perk(game,'blink_quarry')+(mastered(game,'blink_master')?.12:0):1);
 if(c===1&&phase==='outbound'){if(v.primary.has(e.id))return;v.primary.add(e.id);settled=d;primary=true;mainHit(game,kit,e,d,shot.color,{shotSerial:shot.shotSerial,element:shot.element,angle:Math.atan2(shot.vy||0,shot.vx||1),third:shot.command,forcedCommand:shot.forcedCommand},api);}
 else {const used=v.secondary.get(e.id)||0,n=Math.min(c,Math.max(0,v.cap-used));if(n<=0)return;v.secondary.set(e.id,used+n);settled=d*n;hit(api,e,settled,shot.color);}
 if(shot.kind==='spirit'){kit.focusId=e.id;kit.focusTime=2.5;}
 if(shot.kind==='mage'&&phase==='outbound'){applyElement(game,kit,e,shot.element,settled,api);if(!primary&&mastered(game,'mage_master'))onJobBasicHit(game,{target:e,damage:settled,element:shot.element,shotSerial:shot.shotSerial},api);}
}
function blast(game,kit,at,shot,api,radius,cap=4){const es=nearest(game,at,radius,[at.id],cap);for(const e of es)weaponHit(game,kit,e,shot,api,Math.min(.25,(shot.kind==='mage'?(shot.basicBranch==='a'?1.2:.75):.25)/Math.max(1,es.length)),'splash');effect(game,{shape:'ring',visualKind:shot.kind==='wind'?'windBurst':'elementImpact',element:shot.element,x:at.x,y:at.y,radius,color:shot.color,life:.28,basicRank:shot.basicRank,basicBranch:shot.basicBranch});}
function queue(kit,delay,spec){(kit.pendingWeapons||=[]).push({delay,spec});if(kit.pendingWeapons.length>10)kit.pendingWeapons.splice(0,kit.pendingWeapons.length-10);}
function angleTo(a,b){return Math.atan2(b.y-a.y,b.x-a.x);}
function deltaAngle(a,b){return Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));}

function ensure(game) {
  ensureAttackProgress(game);
  game.heroEffects ||= [];
  game.heroPerks ||= {};
  const id=game.heroId || game.player?.heroId || 'commander';
  if (!game.heroKit || game.heroKit.heroId!==id) game.heroKit={heroId:id,attackClock:.15,combo:0,element:0,shots:0,empowered:0,empoweredTime:0,focusId:null,focusTime:0,afterimage:0,afterimageTime:0,statuses:[]};
  return game.heroKit;
}

function attackScale(game){return ATTACK_DAMAGE_SCALE[ensureAttackProgress(game).rank-1];}
function commanderAttack(game,kit,s,api){
 const p=ensureAttackProgress(game),r=p.rank,b=p.branch,range=BASIC_WEAPON_GEOMETRY.commander.range[r-1],foe=target(game,range);if(!foe)return false;
 kit.combo=kit.forceThirdTime>0?3:kit.combo%3+1;kit.forceThirdTime=0;kit.forceThird=false;const third=kit.combo===3,a=angleTo(game.player,foe),v=volley(kit,b==='b'?.65:.95);
 let damage=31*s.damage*attackScale(game)*(third?1.72+.28*perk(game,'commander_third'):1);if(kit.empowered){damage*=1.38+.2*perk(game,'commander_reserve');kit.empowered=0;kit.empoweredTime=0;}
 const spec={kind:'wind',color:'#74e6d4',damage,volley:v,shotSerial:v.serial,command:third,range,speed:620,radius:b==='b'?22:BASIC_WEAPON_GEOMETRY.commander.halfWidth[r-1],pierce:b==='b'?5:BASIC_WEAPON_GEOMETRY.commander.pierce[r-1],basicRank:r,basicBranch:b};
 const reach=112*s.area+18*perk(game,'commander_reach'),width=1.28+.12*perk(game,'commander_reach');for(const e of game.enemies)if(alive(e)&&dist2(game.player,e)<=reach**2&&deltaAngle(angleTo(game.player,e),a)<=width/2)weaponHit(game,kit,e,{...spec,coefficient:1,vx:Math.cos(a),vy:Math.sin(a)},api);
 effect(game,{shape:'sector',visualKind:'commanderSlash',x:game.player.x,y:game.player.y,radius:reach,width,angle:a,color:spec.color,strength:third?1.7:1,life:.22,basicRank:r,basicBranch:b});
 const offsets=b==='a'?[0,-.3,.3]:r>=3&&b!=='b'?[0,.22]:[0];offsets.forEach((offset,i)=>launch(game,kit,s,api,{...spec,angle:a+offset,coefficient:i?.35:1,volleyIndex:i,volleyCount:b==='b'?2:offsets.length,endBurst:b==='a'}));if(b==='b')queue(kit,.14,{...spec,angle:a,coefficient:.65,volleyIndex:1,volleyCount:2});return true;
}
function launch(game,kit,s,api,spec){
 const p=game.player,foe=spec.target&&alive(spec.target)?spec.target:target(game,spec.range,spec.preferredId);if(!foe)return false;const a=spec.angle??angleTo(p,foe),speed=spec.speed;kit.projectiles||=[];kit.visualShotSerial=(kit.visualShotSerial||0)+1;
 kit.projectiles.push({...spec,coefficient:spec.coefficient??1,hitIds:[],returnHitIds:[],shotSerial:spec.shotSerial||serial(kit),visualShotId:kit.visualShotSerial,x:p.x,y:p.y,startX:p.x,startY:p.y,targetId:foe.id,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,radius:(spec.radius||7)*s.area,life:Math.min(3,spec.range/speed*(spec.returning?2:1)+.2),remainingDistance:spec.range,phase:'outbound',visualAge:0});return true;
}
function updateProjectiles(game,kit,dt,api){
 for(const shot of kit.projectiles||[]){const from={x:shot.x,y:shot.y},speed=Math.hypot(shot.vx,shot.vy),travel=Math.min(shot.remainingDistance,speed*dt),step=travel/Math.max(1,speed);shot.x+=shot.vx*step;shot.y+=shot.vy*step;shot.remainingDistance-=travel;shot.life-=dt;shot.visualAge+=dt;
 effect(game,{shape:'projectile',visualShotId:shot.visualShotId,visualKind:shot.kind==='wind'?'windWave':shot.kind==='spirit'?'pactBolt':shot.kind==='blade'?'precisionBlade':'elementBolt',element:shot.element,x:from.x,y:from.y,toX:shot.x,toY:shot.y,radius:shot.radius,width:shot.radius,angle:Math.atan2(shot.vy,shot.vx),color:shot.color,life:.1,returning:shot.phase==='return',phase:shot.phase,visualAge:shot.visualAge,basicRank:shot.basicRank,basicBranch:shot.basicBranch,volleyIndex:shot.volleyIndex,volleyCount:shot.volleyCount});
 const ids=shot.phase==='return'?shot.returnHitIds:shot.hitIds,candidates=game.enemies.filter(alive).filter(e=>!ids.includes(e.id)).map(e=>({e,t:segmentT(e,from,shot)})).filter(o=>o.t!==null).sort((a,b)=>a.t-b.t||a.e.id-b.e.id);
 for(const {e} of candidates){if((shot.kind==='spirit'||shot.kind==='mage')&&e.id!==shot.targetId)continue;if(ids.length>=(shot.pierce||1))break;ids.push(e.id);if(shot.echo)hit(api,e,shot.damage*shot.coefficient,shot.color);else weaponHit(game,kit,e,shot,api,shot.phase==='return'?shot.returnCoefficient:shot.coefficient,shot.phase);
 effect(game,{shape:'ring',visualKind:shot.kind==='spirit'?'pactImpact':shot.kind==='mage'?'elementImpact':'bladeImpact',element:shot.element,x:e.x,y:e.y,radius:22,color:shot.color,life:.2,basicRank:shot.basicRank,basicBranch:shot.basicBranch});
 if(!shot.echo&&shot.kind==='mage')blast(game,kit,e,shot,api,shot.blastRadius+(shot.element==='stone'?18*perk(game,'mage_stone'):0),shot.basicBranch==='a'?6:4);
 if(!shot.echo&&shot.chain){let at=e;const visited=[...shot.hitIds];for(let h=0;h<shot.chain;h++){const next=nearest(game,at,BASIC_WEAPON_GEOMETRY.summoner.chainRadius,visited,20).sort((a,b)=>Number(shot.volley.primary.has(a.id)||shot.volley.secondary.has(a.id))-Number(shot.volley.primary.has(b.id)||shot.volley.secondary.has(b.id))||dist2(at,a)-dist2(at,b))[0];if(!next)break;visited.push(next.id);weaponHit(game,kit,next,shot,api,.25,'chain');effect(game,{shape:'line',visualKind:'spiritChain',x:at.x,y:at.y,toX:next.x,toY:next.y,width:4,radius:4,color:shot.color,life:.25,basicRank:shot.basicRank,basicBranch:shot.basicBranch});at=next;}}
 }
 if(shot.remainingDistance<=1e-6||ids.length>=(shot.pierce||1)&&!shot.returning){if(shot.returning&&shot.phase==='outbound'){shot.phase='return';shot.remainingDistance=Math.hypot(shot.x-shot.startX,shot.y-shot.startY);const a=Math.atan2(shot.startY-shot.y,shot.startX-shot.x);shot.vx=Math.cos(a)*speed;shot.vy=Math.sin(a)*speed;}else{if(shot.endBurst)blast(game,kit,{id:null,x:shot.x,y:shot.y},shot,api,55*stats(game).area,6);shot.life=0;}}
 }
 kit.projectiles=(kit.projectiles||[]).filter(s=>s.life>0);
}
function summonerAttack(game,kit,s,api){
 const p=ensureAttackProgress(game),r=p.rank,b=p.branch,count=BASIC_WEAPON_GEOMETRY.summoner.projectiles[r-1],v=volley(kit,b==='b'?1:2.2),next=kit.shots+1,forcedCommand=kit.forceCommandTime>0,command=next%3===0||forcedCommand,foes=nearest(game,game.player,520,[],count);if(!foes.length)return false;
 for(let i=0;i<count;i++){const spec={range:BASIC_WEAPON_GEOMETRY.summoner.range,target:b==='b'?foes[0]:foes[i%foes.length],speed:450,damage:24*s.damage*attackScale(game),color:i===2?'#d5ffd0':'#a9efad',kind:'spirit',radius:b==='b'&&i===2?12:7,pierce:1,coefficient:b==='b'?[1,.4,.6][i]:i?.35:1,chain:r>=3&&b!=='b'?(b==='a'?2:1):0,command,forcedCommand,shotSerial:v.serial,volley:v,basicRank:r,basicBranch:b,volleyIndex:i,volleyCount:count};if(b==='b'&&i)queue(kit,i*.12,spec);else launch(game,kit,s,api,spec);}
 kit.shots=next;if(forcedCommand)kit.forceCommandTime=0;const level=perk(game,'summoner_echo');if(level&&next%(5-level)===0)launch(game,kit,s,api,{range:BASIC_WEAPON_GEOMETRY.summoner.range,target:foes[0],speed:500,damage:24*s.damage*attackScale(game),coefficient:.4,color:'#d5ffd0',kind:'spirit',echo:true,shotSerial:v.serial});return true;
}
function updateSummons(game,kit,dt){
  kit.focusTime=Math.max(0,kit.focusTime-dt);if(!kit.focusTime)kit.focusId=null;
  const bond=perk(game,'summoner_bond'),mend=perk(game,'summoner_mend'),near=game.enemies.some(e=>alive(e)&&dist2(game.player,e)<260**2);
  for(const c of game.companions||[]){
    if(c._heroKitBaseDamage==null)c._heroKitBaseDamage=c.damage;
    c.damage=c._heroKitBaseDamage;c.secondaryFocusTargetId=kit.secondaryFocusTime?kit.secondaryFocusId:null;c.secondaryFocusTime=kit.secondaryFocusTime||0;c.focusTargetId=kit.focusId;c.focusDamageMultiplier=kit.focusTime?1+.18*bond+(mastered(game,'summoner_master')?.12:0):1;
    if(!near)c.hp=Math.min(c.maxHp,c.hp+c.maxHp*(.005+.015*mend)*dt);
  }
}

function blinkAttack(game,kit,s,api){
 const p=ensureAttackProgress(game),r=p.rank,b=p.branch,foe=target(game,570);if(!foe)return false;const level=perk(game,'blink_precision'),damage=29*s.damage*attackScale(game)*(1+.14*level),v=volley(kit,b==='b'?1.5:b==='a'?2.25:r>=3?1.45:.7),a=angleTo(game.player,foe),offsets=r===1?[0]:b==='a'?[0,-.24,.24,-.48,.48]:b==='b'?[0,-.08,.08]:[0,-.24,.24];
 offsets.forEach((offset,i)=>launch(game,kit,s,api,{range:BASIC_WEAPON_GEOMETRY.blink.range,speed:610*(1+.1*level),damage,color:'#f0b56a',kind:'blade',radius:6,pierce:b==='a'?4:2,angle:a+offset,coefficient:i?i>2?.25:.35:1,returning:r>=3,returnCoefficient:b==='b'?i?.2:.4:.25,volley:v,shotSerial:v.serial,basicRank:r,basicBranch:b,volleyIndex:i,volleyCount:offsets.length}));
 if(kit.afterimage){const c=(r>=3?.35:mastered(game,'blink_master')?.2:0)+.15*perk(game,'blink_afterimage');if(c)launch(game,kit,s,api,{range:BASIC_WEAPON_GEOMETRY.blink.range,speed:660,damage,coefficient:c,color:'#ffd6a0',kind:'blade',radius:6,echo:true,shotSerial:v.serial});kit.afterimage=0;kit.afterimageTime=0;}return true;
}
function mageAttack(game,kit,s,api){
 const p=ensureAttackProgress(game),r=p.rank,b=p.branch,count=BASIC_WEAPON_GEOMETRY.mage.projectiles[r-1],foes=nearest(game,game.player,500,[],count);if(!foes.length)return false;const elements=[['fire','#ff9b63'],['frost','#9fe8ff'],['stone','#d9c19a']],v=volley(kit,b==='b'?2:2.5);
 for(let i=0;i<count;i++){const current=elements[r>=3?i:kit.element%3],spec={range:BASIC_WEAPON_GEOMETRY.mage.range,target:b==='b'?foes[0]:foes[i%foes.length],speed:410,damage:26*s.damage*attackScale(game),color:current[1],kind:'mage',element:current[0],radius:8,pierce:1,coefficient:i?b==='b'&&i===2?.65:.35:1,blastRadius:BASIC_WEAPON_GEOMETRY.mage.blastRadius[b==='a'?3:Math.min(2,r-1)]*s.area,volley:v,shotSerial:v.serial,basicRank:r,basicBranch:b,volleyIndex:i,volleyCount:count};if(b==='b'&&i)queue(kit,i*.12,spec);else launch(game,kit,s,api,spec);}kit.element=(kit.element+1)%3;return true;
}
function applyElement(game,kit,foe,element,damage,api){
  const mastery=mastered(game,'mage_master')?1.15:1;
  if(element==='fire'){
    const next={kind:'burn',targetId:foe.id,tick:.35,remaining:1.4+.4*perk(game,'mage_fire'),damage:damage*(.1+.04*perk(game,'mage_fire'))*(foe.slow>0?1.35:1)*mastery};
    const burn=kit.statuses.find(status=>status.kind==='burn'&&status.targetId===foe.id);
    if(burn){burn.remaining=Math.max(burn.remaining,next.remaining);burn.damage=Math.max(burn.damage,next.damage);burn.tick=Math.min(burn.tick,.35);}else kit.statuses.push(next);
  }
  else if(element==='frost'){
    foe.slow=Math.max(foe.slow||0,.45+.22*perk(game,'mage_frost'));
    if(foe.poisonEffects?.length)hit(api,foe,damage*.18*perk(game,'mage_frost')*mastery,'#d6fbff');

  }
}
function updateStatuses(game,kit,dt,api){
  for(const status of kit.statuses){status.remaining-=dt;status.tick-=dt;const foe=game.enemies.find(e=>e.id===status.targetId);if(status.kind==='burn'&&alive(foe)&&status.tick<=0){hit(api,foe,status.damage,'#ff8a55');status.tick+=.35;}}
  kit.statuses=kit.statuses.filter(s=>s.remaining>0&&game.enemies.some(e=>e.id===s.targetId&&alive(e)));
}

export function updateHeroKit(game,dt,api){
  if(!game?.player||!api?.damage)return;
  const kit=ensure(game), active=game.phase==='playing', step=active?Math.max(0,Number(dt)||0):0, s=stats(game);
  for(const fx of game.heroEffects)fx.life-=step;game.heroEffects=game.heroEffects.filter(fx=>fx.life>0);
  if(!active)return;
  if(MYTHIC_HERO_IDS.includes(kit.heroId)){updateMythicHero(game,step,api);return;}
  if(SPECIAL_HERO_IDS.includes(kit.heroId)){updateSpecialHero(game,step,api);return;}
  if(isOriginalHero(game)){updateOriginalHero(game,step,api);return;}
  kit.forceThirdTime=Math.max(0,(kit.forceThirdTime||0)-step);if(!kit.forceThirdTime)kit.forceThird=false;
  kit.empoweredTime=Math.max(0,kit.empoweredTime-step);if(!kit.empoweredTime)kit.empowered=0;
  kit.afterimageTime=Math.max(0,kit.afterimageTime-step);if(!kit.afterimageTime)kit.afterimage=0;
  kit.forceCommandTime=Math.max(0,(kit.forceCommandTime||0)-step);
  kit.secondaryFocusTime=Math.max(0,(kit.secondaryFocusTime||0)-step);
  for(const q of kit.pendingWeapons||[]){q.delay-=step;if(q.delay<=0)launch(game,kit,s,api,q.spec);}kit.pendingWeapons=(kit.pendingWeapons||[]).filter(q=>q.delay>0);
  updateProjectiles(game,kit,step,api);updateStatuses(game,kit,step,api);if(kit.heroId==='summoner')updateSummons(game,kit,step);
  if(game.jobState?.whirlwind||game.jobMechanics?.whirlwind){kit.attackClock=.12;return;}
  kit.attackClock-=step;if(kit.attackClock>0)return;
  let fired=false;
  if(kit.heroId==='commander')fired=commanderAttack(game,kit,s,api);
  else if(kit.heroId==='summoner')fired=summonerAttack(game,kit,s,api);
  else if(kit.heroId==='blink')fired=blinkAttack(game,kit,s,api);
  else if(kit.heroId==='mage')fired=mageAttack(game,kit,s,api);
  if(fired){const foe=target(game,570);if(foe)game.player.facing=foe.x>=game.player.x?1:-1;if(!(game.player.animSource==='skill'&&game.player.animTime<game.player.animDuration)){game.player.anim='attack';game.player.animTime=0;game.player.animDuration=.3;game.player.animSource='auto';game.player.animFacing=game.player.facing;}}
  kit.attackClock=fired?Math.max(.18,(kit.heroId==='commander' ? .72 : .82)/Math.max(.2,s.attackSpeed)):.12;
}

export function onHeroSkill(game,id,api){
  const kit=ensure(game), s=stats(game); if(isOriginalHero(game))return s;
  if(kit.heroId==='commander'){
    const reserve=perk(game,'commander_reserve');
    kit.empowered=1;kit.empoweredTime=5+reserve;
    if(ensureAttackProgress(game).rank>=3||id==='cleave'&&reserve){kit.forceThird=true;kit.forceThirdTime=5;}
  }else if(kit.heroId==='summoner'){
    if(id==='recallSummons'&&hasJobMechanic(game,'summoner_master')&&(game.companions||[]).some(c=>c.hp>0))kit.forceCommandTime=3;
    if(id==='recallSummons')for(const c of game.companions||[])c.hp=Math.min(c.maxHp,c.hp+c.maxHp*.05*perk(game,'summoner_mend'));
    if(id==='summonGuard'||id==='summonElite')updateSummons(game,kit,0);
  }else if(kit.heroId==='blink'&&(id==='blinkStrike'||id==='blinkStorm')){
    const afterimage=perk(game,'blink_afterimage');
    const enabled=afterimage||ensureAttackProgress(game).rank>=3||hasJobMechanic(game,'blink_master');kit.afterimage=enabled?1:0;kit.afterimageTime=enabled?3:0;
    if(afterimage)kit.attackClock=Math.min(kit.attackClock,.08);

  }else if(kit.heroId==='mage'){
    if(id==='flameBreath')kit.element=1;else if(id==='frostAura')kit.element=2;else if(id==='rockWall'){
      kit.element=0;
      const stone=perk(game,'mage_stone');
      if(stone&&api?.damage){
        const wall=[...(game.fields||[])].reverse().find(field=>field.type==='rockWall'), center=wall||game.player, radius=70*s.area+15*stone;
        for(const enemy of game.enemies)if(alive(enemy)&&dist2(center,enemy)<=radius*radius)hit(api,enemy,22*s.damage*stone,'#e5cfaa');
        effect(game,{shape:'ring',visualKind:'stoneSplash',x:center.x,y:center.y,radius,color:'#e5cfaa',life:.35,maxLife:.35});
      }
    }
  }
  return s;
}

export function getHeroIdentity(game){
  const kit={heroId:game.heroId||game.player?.heroId||'commander'}, data=HERO_NAMES[kit.heroId]||HERO_NAMES.commander;
  // HUD queries must not revive cleared run entities on the title/terminal screens.
  const view={...game,attackProgress:game.attackProgress?{...game.attackProgress}:undefined};
  const special=specialHeroIdentity({...view,phase:'victory'})||mythicHeroIdentity(view);if(special){if(SPECIAL_HERO_IDS.includes(kit.heroId)){const state=game.specialHero;special.meter=kit.heroId==='grappler'?'连拳 '+(state?.combo||0)+'/3 · 持敌 '+(state?.heldSlots?.length||0)+'/'+(state?.tier===3?2:1):kit.heroId==='rift'?'远门 '+(state?.gates?.length||0)+'/1'+(state?.riftHeavy?' · 重火力':''):'弹仓 '+(state?.scraps?.length||0)+(state?.fieldTime>0?' · 护板 '+Math.ceil(state.shieldHP):'')+(state?.armorTime>0?' · 热量 '+Math.floor(state.heat)+'/6':'');}const attack=getAttackProgressionInfo(view);return {...special,meter:`${attack.meter} · ${special.meter}`,attack};}
  const original=game.originalHero||{combo:0,momentum:0,corpses:[],fusion:null,orderTime:0,returnShadow:null,deathMark:null,elementWindow:null};
  let meter='';
  if(kit.heroId==='commander')meter='连斩 '+original.combo+'/3 · 剑势 '+original.momentum+'/12'+(original.momentum>=12?' · 下一重斩兑现':'');
  else if(kit.heroId==='summoner')meter=(original.fusion?'巨灵合体':'军团 '+(game.companions||[]).filter(c=>c.originalArmy).length) + ' · 灵骸 '+original.corpses.length+'/12'+(original.orderTime>0?' · 指挥中':'');
  else if(kit.heroId==='blink')meter=original.deathMark?'死印记录中':original.returnShadow?'返程影就绪':'短刃蓄伤';
  else meter=original.elementWindow?`三相天象 ${original.elementWindow.used.size}/3`:'电弧 · 烈焰 · 冰霜';
  const attack=getAttackProgressionInfo(view);
  return {name:data[0],description:data[1],meter:`${attack.meter} · ${meter}`,attack};
}






