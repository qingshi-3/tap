import type { SpriteFrame, UnitAsset } from '../assets-types';
import type { GameState, Unit } from '../core/types';

interface Playback {
 tick:number;
 cooldown:number;
 animation:'idle'|'walk';
 started:number;
 attackStarted:number|null;
 asset:UnitAsset;
}

/** Presentation only: core attack is a one-tick fact, not a playback lifetime. */
export class UnitAnimations {
 private owner:GameState|null=null;
 private tick=-1;
 private units=new Map<number,Playback>();

 begin(state:GameState){
  // Replays/new runs can reuse IDs and seeds. A replaced state or rewound clock
  // must never inherit a previous run's unfinished attack.
  if(this.owner!==state||state.tick<this.tick||state.phase!=='combat')this.units.clear();
  this.owner=state;this.tick=state.tick;
  const live=new Set(state.units.filter(u=>u.hp>0).map(u=>u.id));
  for(const id of this.units.keys())if(!live.has(id))this.units.delete(id);
 }

 frame(unit:Unit,asset:UnitAsset,reduced=false):SpriteFrame|undefined {
  const tick=this.tick,animation=unit.anim==='walk'?'walk':'idle';
  let playback=this.units.get(unit.id);
  if(playback?.asset!==asset){playback=undefined;this.units.delete(unit.id)}
  const elapsed=playback?tick-playback.tick:0;
  // Cooldown refresh also catches attacks overwritten by a later hurt signal,
  // or a render that follows several simulation steps and misses 'attack'.
  const fired=this.owner?.phase==='combat'&&(!playback||elapsed>0)&&
   (unit.anim==='attack'||!!playback&&unit.cooldown>Math.max(0,playback.cooldown-elapsed));
  if(!playback){playback={tick,cooldown:unit.cooldown,animation,started:tick,attackStarted:null,asset};this.units.set(unit.id,playback)}
  if(playback.animation!==animation){playback.animation=animation;playback.started=tick}
  // Walking has spatial meaning: don't slide a unit across the map in a swing
  // pose. Idle/hurt cannot truncate attacks, but actual movement cancels them.
  if(animation==='walk')playback.attackStarted=null;
  const attacks=asset.animations.attack;
  const duration=attacks.reduce((sum,frame)=>sum+frame.duration,0);
  if(playback.attackStarted!==null&&(tick-playback.attackStarted)/30>=duration-1e-9)playback.attackStarted=null;
  // Preserve every authored frame and its timing. Long clips (e.g. engineer
  // 4.08s) may span several damage pulses: pulses during playback are coalesced,
  // never restart frame zero or queue stale swings after combat has ended.
  if(fired&&animation!=='walk'&&playback.attackStarted===null&&duration>0)playback.attackStarted=tick;
  playback.tick=tick;playback.cooldown=unit.cooldown;
  if(playback.attackStarted!==null)return frameAt(attacks,(tick-playback.attackStarted)/30,false);
  const frames=asset.animations[animation].length?asset.animations[animation]:asset.animations.idle;
  return reduced&&animation==='idle'?frames[0]:frameAt(frames,(tick-playback.started)/30,true);
 }
}

function frameAt(frames:SpriteFrame[],elapsed:number,loop:boolean):SpriteFrame|undefined {
 const total=frames.reduce((sum,frame)=>sum+frame.duration,0);
 if(total<=0)return frames[0];
 let time=loop?elapsed%total:Math.min(elapsed,total);
 for(const frame of frames){if(time<frame.duration-1e-9)return frame;time-=frame.duration}
 return frames[frames.length-1];
}
