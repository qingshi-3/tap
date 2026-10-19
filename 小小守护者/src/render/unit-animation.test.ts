import { describe, expect, it } from 'vitest';
import { applyAction, createGame, serializeGame, step } from '../core';
import type { UnitAsset } from '../assets-types';
import manifest from '../../public/assets/manifest.json';
import { UnitAnimations } from './unit-animation';

const asset:UnitAsset={width:100,height:100,sourceId:'fixture',animations:{
 idle:[{file:'idle',duration:.1}],walk:[{file:'walk',duration:.1}],
 attack:Array.from({length:6},(_,i)=>({file:'attack-'+i,duration:.1}))
}};
function fixture(){
 const state=createGame(1);applyAction(state,{type:'buyLegion',kind:'shield',x:4,y:6});
 applyAction(state,{type:'startWave'});return {state,unit:state.units[0],player:new UnitAnimations()};
}
describe('authored unit attack playback',()=>{
 it('continues the complete attack after the real rule clock resets attack to idle',()=>{
  const {state,unit,player}=fixture();
  let fired=false;
  for(let i=0;i<300;i++){
   step(state);player.begin(state);player.frame(unit,asset);
   if(unit.anim==='attack'){fired=true;break}
  }
  expect(fired).toBe(true);const tick=state.tick;
  const before=serializeGame(state);expect(player.frame(unit,asset)?.file).toBe('attack-0');
  expect(serializeGame(state)).toBe(before);
  step(state);expect(unit.anim).not.toBe('attack');player.begin(state);
  expect(player.frame(unit,asset)?.file).toBe('attack-0');
  const seen=new Set<string>();
  for(let i=0;i<17;i++){
   player.begin(state);seen.add(player.frame(unit,asset)!.file);step(state);
  }
  expect([...seen]).toEqual(asset.animations.attack.map(f=>f.file));
  expect(state.tick).toBe(tick+18);player.begin(state);expect(player.frame(unit,asset)?.file).toBe('idle');
 });
 it('coalesces high attack rates without frame-zero stutter or delayed attack queues',()=>{
  const {state,unit,player}=fixture();
  const engineer=manifest.units.engineer as UnitAsset;
  const seen=new Set<unknown>();
  for(let tick=0;tick<123;tick++){
   state.tick=tick;unit.anim=tick%30===0?'attack':'idle';unit.cooldown=30-tick%30;
   player.begin(state);seen.add(player.frame(unit,engineer));
  }
  expect(seen.size).toBe(engineer.animations.attack.length);
  state.tick=123;unit.anim='idle';unit.cooldown=27;player.begin(state);
  expect(engineer.animations.idle).toContain(player.frame(unit,engineer));
 });
 it('detects a missed attack tick and a hurt-overwritten attack from cooldown refresh',()=>{
  const {state,unit,player}=fixture();state.tick=10;unit.cooldown=1;player.begin(state);player.frame(unit,asset);
  state.tick=13;unit.cooldown=25;unit.anim='hurt';player.begin(state);
  expect(player.frame(unit,asset)?.file).toBe('attack-0');
  state.tick=16;unit.cooldown=22;unit.anim='idle';player.begin(state);
  expect(player.frame(unit,asset)?.file).toBe('attack-1');
 });
 it('cancels the swing on real movement and does not revive it when the unit stops',()=>{
  const {state,unit,player}=fixture();state.tick=10;unit.anim='attack';player.begin(state);player.frame(unit,asset);
  state.tick=11;unit.anim='walk';player.begin(state);expect(player.frame(unit,asset)?.file).toBe('walk');
  state.tick=12;unit.anim='idle';player.begin(state);expect(player.frame(unit,asset)?.file).toBe('idle');
  state.tick=15;unit.anim='walk';unit.cooldown=25;player.begin(state);expect(player.frame(unit,asset)?.file).toBe('walk');
 });
 it('freezes on the simulation tick and clears on replay replacement, rewind, death, and wave end',()=>{
  const {state,unit,player}=fixture();state.tick=10;unit.anim='attack';player.begin(state);player.frame(unit,asset);
  state.tick=13;unit.anim='idle';unit.cooldown=0;player.begin(state);
  expect(player.frame(unit,asset,true)?.file).toBe('attack-1');
  for(let i=0;i<20;i++){player.begin(state);expect(player.frame(unit,asset)?.file).toBe('attack-1')}
  const replay={...state};player.begin(replay);expect(player.frame(unit,asset)?.file).toBe('idle');
  unit.anim='attack';replay.tick=14;player.begin(replay);player.frame(unit,asset);
  replay.tick=1;unit.anim='idle';player.begin(replay);expect(player.frame(unit,asset)?.file).toBe('idle');
  unit.anim='attack';replay.tick=2;player.begin(replay);player.frame(unit,asset);
  unit.hp=0;player.begin(replay);unit.hp=1;unit.anim='idle';player.begin(replay);
  expect(player.frame(unit,asset)?.file).toBe('idle');
  unit.anim='attack';replay.tick=3;player.begin(replay);player.frame(unit,asset);
  replay.phase='prep';player.begin(replay);expect(player.frame(unit,asset)?.file).toBe('idle');
 });
});
