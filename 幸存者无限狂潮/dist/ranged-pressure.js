import { getBattleCamera } from './battle-camera.js';

export const RANGED_PRESSURE = Object.freeze({ speed: 125, warning: .6, attackers: 2, projectiles: 6, spacing: .35 });
const ordinary = e => !e.boss && !e.abilityId && e.kind === 'archer_elite';
function visible(game, e) {
  const width=game.viewport?.width||844,height=game.viewport?.height||390;
  const camera=getBattleCamera(game,width,height),pad=e.radius+8;
  return e.x-pad>=camera.x+20&&e.x+pad<=camera.x+width-20&&e.y-pad>=camera.y+74&&e.y+pad<=camera.y+height-12;
}

// Reserve both a bullet slot and a launch time before publishing a warning.
// Waiting shooters have no stored aim, so congestion never produces catch-up shots.
export function scheduleOrdinaryRanged(game, dt) {
  const state=game.rangedPressure ||= { lastId: 0, lastShot: -Infinity };
  const candidates=[];
  for(const e of game.enemies) {
    if(!ordinary(e))continue;
    e.rangedNeedsView=!visible(game,e);
    const eligible=!e.dead&&e.spawnDelay<=0&&!(e.frozen>0)&&!e.rangedNeedsView;
    if(!eligible){if(e.attackWarning?.type==='shot'){e.attackWarning=null;e.aiClock=Math.max(e.aiClock||0,.6);}continue;}
    e.aiClock=Math.max(0,(e.aiClock||0)-dt*(e.slow>0?.55:1));
    const playerDistance=(e.x-game.player.x)**2+(e.y-game.player.y)**2;
    const allyCloser=game.companions.some(a=>!a.incapacitated&&(a.x-e.x)**2+(a.y-e.y)**2<Math.min(playerDistance,260**2));
    if(!e.attackWarning&&e.aiClock<=0&&playerDistance<470**2&&!allyCloser)candidates.push(e);
  }
  let warnings=game.enemies.filter(e=>!e.dead&&ordinary(e)&&e.attackWarning?.type==='shot');
  let slots=game.enemyProjectiles.filter(s=>s.kind==='enemyOrb'&&!s.hit&&s.life>0).length+warnings.length;
  candidates.sort((a,b)=>(a.id>state.lastId?0:1)-(b.id>state.lastId?0:1)||a.id-b.id);
  let nextAt=Math.max(game.time+RANGED_PRESSURE.warning,state.lastShot+RANGED_PRESSURE.spacing,...warnings.map(e=>e.attackWarning.fireAt+RANGED_PRESSURE.spacing));
  for(const e of candidates){
    if(warnings.length>=RANGED_PRESSURE.attackers||slots>=RANGED_PRESSURE.projectiles)break;
    const total=nextAt-game.time;
    e.attackWarning={type:'shot',angle:Math.atan2(game.player.y-e.y,game.player.x-e.x),remaining:total,total,fireAt:nextAt};
    e.anim='attack';e.animTime=0;e.animDuration=total;
    warnings.push(e);slots++;state.lastId=e.id;nextAt+=RANGED_PRESSURE.spacing;
  }
}

export function launchOrdinaryShot(game,e,warning) {
  const state=game.rangedPressure;
  if(game.time+1e-8<(state?.lastShot??-Infinity)+RANGED_PRESSURE.spacing)return false;
  const speed=RANGED_PRESSURE.speed;
  game.enemyProjectiles.push({id:game._nextId++,kind:'enemyOrb',ownerId:e.id,x:e.x,y:e.y,vx:Math.cos(warning.angle)*speed,vy:Math.sin(warning.angle)*speed,radius:8,life:4,damage:e.damage});
  state.lastShot=game.time;
  return true;
}

export function clearOrdinaryRanged(game) {
  for(const e of game.enemies)if(ordinary(e)&&e.attackWarning?.type==='shot')e.attackWarning=null;
  game.enemyProjectiles=game.enemyProjectiles.filter(s=>s.kind!=='enemyOrb');
  game.rangedPressure=null;
}
