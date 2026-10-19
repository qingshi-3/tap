import {isOriginalHero} from './original-heroes.js';
import { getCombatStats } from './combat-stats.js';

const current=g=>g.heroJob||g.player?.job;
export function hasJobMechanic(g,id){
 const j=current(g);
 return j===id || ({summoner_sovereign:'summoner_master',blink_sovereign:'blink_master',mage_sovereign:'mage_master'})[j]===id || j==='blade_master'&&id==='swift_blade';
}
const alive=e=>e&&!e.dead&&e.hp>0&&!(e.spawnDelay>0);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function state(g){return g.ascensionHero||= {rushes:[],rings:[],echoes:[],domains:[],serial:0};}
function effect(g,data){(g.heroEffects||=[]).push({...data,ascension:true,life:data.life||.3,maxLife:data.life||.3});}
function sweep(g,from,to,width,damage,api,seen=new Set(),budget=null){
 const dx=to.x-from.x,dy=to.y-from.y,len=dx*dx+dy*dy;
 const candidates=g.enemies.filter(alive).map(e=>({e,t:len?Math.max(0,Math.min(1,((e.x-from.x)*dx+(e.y-from.y)*dy)/len)):0})).filter(({e,t})=>Math.hypot(e.x-from.x-dx*t,e.y-from.y-dy*t)<=width+(e.radius||18)).sort((a,b)=>a.t-b.t||a.e.id-b.e.id);
 for(const {e} of candidates){if(seen.has(e.id)||seen.size>=8)continue;seen.add(e.id);const used=budget?.get(e.id)||0;if(used>=2)continue;budget?.set(e.id,used+1);api.damage(e,damage,'#d1f5ff','companion');}
}
export function clearAscension(g){
 for(const c of g.companions||[])delete c.ascensionRush;
 g.ascensionHero=null;g.heroEffects=(g.heroEffects||[]).filter(f=>!f.ascension);
}
export function onAscensionBasic(g,info,api){if(isOriginalHero(g))return;
 if(current(g)!=='summoner_sovereign'||!(info.third||info.forcedCommand)||!alive(info.target))return;
 const s=state(g);if((s.rushReady||0)>(g.time||0))return;s.rushReady=(g.time||0)+1.4;
 const budget=new Map();
 for(const c of (g.companions||[]).filter(c=>c.hp>0&&!c.incapacitated).slice(0,4)){
  if(c.ascensionRush)continue;
  const d=distance(c,info.target),amount=Math.min(170,Math.max(0,d-(c.radius||19)-(info.target.radius||18))),nx=d?(info.target.x-c.x)/d:1,ny=d?(info.target.y-c.y)/d:0;
  c.ascensionRush=true;s.rushes.push({id:c.id,from:{x:c.x,y:c.y},to:{x:c.x+nx*amount,y:c.y+ny*amount},elapsed:0,life:.45,seen:new Set(),budget,damage:c.damage*getCombatStats(g).damage*.7});
 }
}
export function onAscensionSkill(g,id){if(isOriginalHero(g))return;
 if(current(g)==='summoner_sovereign'&&id==='recallSummons'){
  const s=state(g);s.rings=[{remaining:1.8,tick:0}];
 }
}
export function onAscensionLanding(g,anchor,travel){if(isOriginalHero(g))return;
 if(current(g)!=='blink_sovereign')return;
 const visited=travel.ascensionAnchors||=new Set();if(visited.has(anchor.id))return;visited.add(anchor.id);
 const s=state(g),angle=Math.atan2(anchor.y-travel.fromY,anchor.x-travel.fromX),at={x:anchor.x,y:anchor.y};
 s.echoes.push({...at,angle,delay:.32,damage:travel.damage*.25});s.echoes=s.echoes.slice(-8);
 effect(g,{visualKind:'ascensionEcho',...at,kind:g.player.kind,angle,radius:70,life:.65});
}
export function onAscensionReaction(g,target,element,damage){if(isOriginalHero(g))return;
 if(current(g)!=='mage_sovereign')return;
 const s=state(g);if((s.domainReady||0)>(g.time||0))return;s.domainReady=(g.time||0)+.65;
 s.domains.push({id:++s.serial,x:target.x,y:target.y,element:element||'stone',radius:60*getCombatStats(g).area,remaining:1.8,tick:0,damage:damage*.12});s.domains=s.domains.slice(-4);
}
export function updateAscension(g,dt,api){if(isOriginalHero(g))return;
 const s=g.ascensionHero;if(!s||g.phase!=='playing'||g.player.hp<=0)return;
 for(const rush of s.rushes){
  const c=(g.companions||[]).find(c=>c.id===rush.id&&c.hp>0&&!c.incapacitated);if(!c){rush.life=0;continue;}
  const from={x:c.x,y:c.y};rush.elapsed+=dt;const t=Math.min(1,rush.elapsed/.45),to={x:rush.from.x+(rush.to.x-rush.from.x)*t,y:rush.from.y+(rush.to.y-rush.from.y)*t};
  if(api.movementHitsWall?.(from.x,from.y,to.x,to.y,c.radius)){rush.life=0;}else{c.x=to.x;c.y=to.y;c.facing=c.x>=from.x?1:-1;c.anim='attack';c.animTime=0;rush.life=.45-rush.elapsed;sweep(g,from,c,18,rush.damage,{damage(e,n,color,category){const before=e.hp;api.damage(e,n,color,category);if(e.hp<before)effect(g,{visualKind:'ascensionRushHit',shape:'impact',x:e.x,y:e.y,ownerKind:c.kind,radius:24,life:.22});}},rush.seen,rush.budget);effect(g,{visualKind:'spiritChain',shape:'line',...from,toX:c.x,toY:c.y,radius:8,width:8,life:.12});}
  if(rush.life<=0)delete c.ascensionRush;
 }s.rushes=s.rushes.filter(r=>r.life>0);
 for(const ring of s.rings){ring.remaining-=dt;ring.tick-=dt;if(ring.tick<=0&&ring.remaining>0){ring.tick=.6;const hit=new Set();for(const c of (g.companions||[]).filter(c=>c.hp>0&&!c.incapacitated)){
   effect(g,{visualKind:'pactBurst',shape:'circle',x:c.x,y:c.y,ownerId:c.id,ownerKind:c.kind,ownerFacing:c.facing,radius:62,life:.35});
   for(const e of g.enemies.filter(alive))if(!hit.has(e.id)&&distance(c,e)<=62+(e.radius||18)){hit.add(e.id);api.damage(e,14*getCombatStats(g).damage,'#c5ffbd','companion');}
  }}}s.rings=s.rings.filter(r=>r.remaining>0);
 for(const echo of s.echoes){echo.delay-=dt;if(echo.delay>0)continue;const hit=new Set();for(const a of [echo.angle,echo.angle+Math.PI/2]){
  const from={x:echo.x-Math.cos(a)*70,y:echo.y-Math.sin(a)*70},to={x:echo.x+Math.cos(a)*70,y:echo.y+Math.sin(a)*70};
  sweep(g,from,to,14,echo.damage,{damage:(e,n,c)=>api.damage(e,n,c,'active')},hit);
  effect(g,{visualKind:'jobBladeLine',shape:'line',...from,toX:to.x,toY:to.y,radius:14,width:14,life:.25});
 }}s.echoes=s.echoes.filter(e=>e.delay>0);
 const domainHits=new Set();for(const d of s.domains){d.remaining-=dt;d.tick-=dt;if(d.remaining>0&&d.tick<=0){d.tick=.45;effect(g,{visualKind:'ascensionDomain',shape:'circle',x:d.x,y:d.y,radius:d.radius,element:d.element,life:.5});for(const e of g.enemies.filter(alive))if(!domainHits.has(e.id)&&distance(d,e)<=d.radius+(e.radius||18)){domainHits.add(e.id);api.damage(e,d.damage,'#d8dcff','reaction');}}}s.domains=s.domains.filter(d=>d.remaining>0);
}

