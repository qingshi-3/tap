import type {GameState} from './core/types.ts';
import {activeRunId,type StoragePort} from './storage.ts';
export const PROFILE_KEY='little-guardians-h5.profile.v1';
export interface Profile {
 version:1;
 stats:{runs:number;wins:number;kills:number;maxWave:number};
 discovered:string[];achievements:string[];
 history:{id:string;seed:number;result:'won'|'lost';wave:number;kills:number;ticks:number}[];
 completedRunIds:string[];blockedMessage?:string;
}
const empty=():Profile=>({version:1,stats:{runs:0,wins:0,kills:0,maxWave:0},discovered:[],achievements:[],history:[],completedRunIds:[]});
const defaultPort=():StoragePort=>localStorage;
const integer=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
function parseProfile(raw:string):Profile {
 const p:unknown=JSON.parse(raw);
 if(!p||typeof p!=='object')throw new Error('档案损坏，已保留原件');
 const v=p as Profile;
 if(v.version!==1||!v.stats||!['runs','wins','kills','maxWave'].every(k=>integer((v.stats as unknown as Record<string,unknown>)[k]))||Object.keys(v.stats).length!==4||!Array.isArray(v.discovered)||!v.discovered.every(x=>typeof x==='string')||!Array.isArray(v.achievements)||!v.achievements.every(x=>typeof x==='string')||!Array.isArray(v.history)||!Array.isArray(v.completedRunIds)||!v.completedRunIds.every(x=>typeof x==='string'))throw new Error('档案版本或结构不支持，已保留原件');
 if(Object.keys(v).length!==6)throw new Error('档案包含未知字段，已保留原件');
 for(const h of v.history)if(!h||typeof h.id!=='string'||!Number.isSafeInteger(h.seed)||!['won','lost'].includes(h.result)||![h.wave,h.kills,h.ticks].every(integer))throw new Error('档案记录无效，已保留原件');
 return v;
}
export function getProfile(port?:StoragePort):Profile {
 try{port??=defaultPort();const raw=port.getItem(PROFILE_KEY);return raw===null?empty():parseProfile(raw);}
 catch(e){return {...empty(),blockedMessage:e instanceof Error?e.message:'档案读取失败'};}
}
function update(mutator:(profile:Profile)=>void,port?:StoragePort):{ok:boolean;message?:string} {
 try{
  port??=defaultPort();
  const old=port.getItem(PROFILE_KEY),profile=old===null?empty():parseProfile(old);
  mutator(profile);
  if(port.getItem(PROFILE_KEY)!==old)throw new Error('档案已被其他页面改变，未覆盖');
  const next=JSON.stringify(profile);port.setItem(PROFILE_KEY,next);
  if(port.getItem(PROFILE_KEY)!==next)throw new Error('档案写入未确认，请保留当前页面');
  return {ok:true};
 }catch(e){return {ok:false,message:e instanceof Error?e.message:'档案保存失败'};}
}
export function observeRun(state:GameState,port?:StoragePort):{ok:boolean;message?:string} {
 return update(p=>{
  const ids=new Set(p.discovered);
  for(const legion of state.legions)ids.add(`${legion.kind}-${legion.tier}`);
  for(const building of state.buildings)ids.add(building.kind);
  for(const unit of state.units)if(unit.team==='enemy')ids.add(unit.kind);
  if(state.hero)ids.add(state.hero.kind);for(const card of state.cards)ids.add(card.kind);
  p.discovered=[...ids];p.stats.maxWave=Math.max(p.stats.maxWave,state.stats.wavesCleared);
  if(state.stats.wavesCleared>=1&&!p.achievements.includes('first-wave'))p.achievements.push('first-wave');
  if(new Set(state.buildings.map(b=>b.kind)).size>=3&&!p.achievements.includes('builder'))p.achievements.push('builder');
 },port);
}
export function recordOutcome(state:GameState,port?:StoragePort):{ok:boolean;message?:string} {
 if(state.phase!=='won'&&state.phase!=='lost')return {ok:false,message:'战局尚未结算'};
 const id=activeRunId(state);if(!id)return {ok:false,message:'战局标识缺失，未重复记账'};
 return update(p=>{
  if(p.completedRunIds.includes(id))return;
  p.completedRunIds.push(id);p.stats.runs++;if(state.phase==='won')p.stats.wins++;
  p.stats.kills+=state.stats.kills;p.stats.maxWave=Math.max(p.stats.maxWave,state.stats.wavesCleared);
  p.history.unshift({id,seed:state.seed,result:state.phase as 'won'|'lost',wave:state.wave,kills:state.stats.kills,ticks:state.tick});p.history=p.history.slice(0,30);
  if(state.phase==='won'&&!p.achievements.includes('first-victory'))p.achievements.push('first-victory');
 },port);
}
export const ACHIEVEMENTS=[{id:'first-wave',name:'初守',description:'守住第一波'},{id:'builder',name:'营地工匠',description:'同时建有三类工事'},{id:'first-victory',name:'守护者',description:'守住最终围攻'}] as const;

