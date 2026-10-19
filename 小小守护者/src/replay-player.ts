import {createGame,applyAction,step} from './core/index';
import type {GameState,RecordedAction} from './core/types';
import {importReplay} from './storage';

/** Validate first, then play recorded actions on the ordinary 30Hz rule clock. */
export class ReplayPlayer {
 readonly state:GameState;
 readonly finalTick:number;
 private actions:RecordedAction[];
 private cursor=0;
 constructor(text:string){
  const final=importReplay(text);
  const record=JSON.parse(text);
  this.state=createGame(final.seed,final.mapId);this.finalTick=final.tick;this.actions=record.actions;
  this.applyReady();
 }
 get done(){return this.state.tick===this.finalTick&&this.cursor===this.actions.length;}
 private applyReady(){
  while(this.cursor<this.actions.length&&this.actions[this.cursor].tick===this.state.tick){
   const result=applyAction(this.state,this.actions[this.cursor++].action);
   if(!result.ok)throw new Error(result.message||'回放动作无法执行');
  }
 }
 advance(){
  if(this.done)return;
  this.applyReady();
  if(this.state.tick<this.finalTick){const before=this.state.tick;step(this.state);if(before===this.state.tick)throw new Error('回放时间无法推进');}
  this.applyReady();
 }
}
