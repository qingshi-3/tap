import { onJobBlinkLanding, onJobBladeLanded } from './job-mechanics.js';
import {getBlinkRoute} from './skill-targeting.js';
export function startBlinkTravel(game,skillId,input,geometry,damage){
  // Freeze world points at cast time: expiring anchors cannot redirect a live route.
  const route=getBlinkRoute(game,{...input,skillId});if(!route.length)return false;
  const p=game.player;
  game.heroState.blinkTravel={skillId,route,segmentIndex:0,elapsed:0,segmentDuration:skillId==='blinkStrike'?.20:.13,fromX:p.x,fromY:p.y,damage,hitIds:new Set(),totalHits:new Map(),width:geometry.width,landingRadius:geometry.radius,charges:new Map(stateCharges(game)),chargedIds:new Set(),chargeHits:new Map()};
  // One cast event owns the audio cue; per-frame visual trails remain silent.
  game.effects.push({type:'blinkStart',skillId,x:p.x,y:p.y,life:.3,maxLife:.3});
  return true;
}
export function updateBlink(game,dt,api){
  const state=game.heroState,p=game.player;
  for(const a of state.blinkAnchors)a.remaining-=dt;
  state.blinkAnchors=state.blinkAnchors.filter(a=>a.remaining>0);
  const travel=state.blinkTravel;if(!travel)return;
  // Only refresh one simulation frame; duration growth must never extend protection.
  p.invulnerable=Math.max(p.invulnerable,dt);
  let remaining=dt;
  while(remaining>1e-9&&state.blinkTravel){
    const dest=travel.route[travel.segmentIndex],step=Math.min(remaining,travel.segmentDuration-travel.elapsed),x=p.x,y=p.y;
    travel.elapsed+=step;remaining-=step;
    const t=Math.min(1,travel.elapsed/travel.segmentDuration);
    p.x=travel.fromX+(dest.x-travel.fromX)*t;p.y=travel.fromY+(dest.y-travel.fromY)*t;
    const dx=p.x-x,dy=p.y-y;
    for(const e of game.enemies){
      if(e.dead||e.spawnDelay>0||travel.hitIds.has(e.id)||(travel.totalHits.get(e.id)||0)>=4)continue;
      const len=dx*dx+dy*dy,u=len?Math.max(0,Math.min(1,((e.x-x)*dx+(e.y-y)*dy)/len)):0;
      if(Math.hypot(e.x-x-dx*u,e.y-y-dy*u)<=travel.width+e.radius){travel.hitIds.add(e.id);travel.totalHits.set(e.id,(travel.totalHits.get(e.id)||0)+1);api.damage(e,travel.damage);}
    }
    game.effects.push({type:travel.skillId==='blinkStorm'?'blinkStorm':'blink',x:p.x,y:p.y,fromX:x,fromY:y,toX:p.x,toY:p.y,angle:Math.atan2(dy,dx),radius:travel.width,life:.18,maxLife:.18});
    if(travel.elapsed+1e-9<travel.segmentDuration)break;
    p.x=dest.x;p.y=dest.y;onJobBlinkLanding(game,dest,travel,api);
    if(++travel.segmentIndex<travel.route.length){travel.fromX=p.x;travel.fromY=p.y;travel.elapsed=0;travel.hitIds=new Set();continue;}
    // Push only on the final landing, with full displacement for every enemy class.
    const endDx=dest.x-travel.fromX,endDy=dest.y-travel.fromY,endLen=Math.hypot(endDx,endDy),fallback={x:endLen?endDx/endLen:p.facing||1,y:endLen?endDy/endLen:0};
    for(const e of game.enemies)if(!e.dead&&!(e.spawnDelay>0)&&Math.hypot(e.x-p.x,e.y-p.y)<=travel.landingRadius+e.radius){
      const distance=Math.hypot(e.x-p.x,e.y-p.y),n=distance?{x:(e.x-p.x)/distance,y:(e.y-p.y)/distance}:fallback,force=p.radius*10;
      e.x=Math.max(e.radius,Math.min(game.world.width-e.radius,e.x+n.x*force));e.y=Math.max(e.radius,Math.min(game.world.height-e.radius,e.y+n.y*force));
    }
    game.effects.push({type:'blinkImpact',x:p.x,y:p.y,radius:travel.landingRadius,life:.3,maxLife:.3});
    state.blinkTravel=null;api.complete(travel.skillId);
  }
}
export function landBlinkBlade(game,shot){
  onJobBladeLanded(game,shot);
  const anchors=game.heroState.blinkAnchors;
  anchors.push({id:shot.id,x:shot.x,y:shot.y,remaining:14,maxLife:14});
  if(anchors.length>4)anchors.shift();
  game.effects.push({type:'bladeMark',x:shot.x,y:shot.y,life:.5,maxLife:.5});shot.hit=true;
}

function stateCharges(game){return game.heroState.blinkAnchors.map(a=>[a.id,a.charge||0]);}
