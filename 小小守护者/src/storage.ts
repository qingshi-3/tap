import {createGame,restoreGame,serializeGame,replayGame,step} from './core/index.ts';
import type {GameState,RecordedAction} from './core/types.ts';

export interface StoragePort {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void}
export const RUN_KEY='little-guardians-h5.run.v1';
interface Envelope {version:1;runId:string;snapshot:string}
const knownRaw=new WeakMap<GameState,string|null>();
const runIds=new WeakMap<GameState,string>();
let activeId='';
const defaultPort=():StoragePort=>localStorage;
function fingerprint(text:string):string {let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
function readEnvelope(raw:string):Envelope {
 const e:unknown=JSON.parse(raw);
 if(!e||typeof e!=='object')throw new Error('存档结构无法识别，已保留原件');
 const p=e as Record<string,unknown>;
 if(p.version!==1||typeof p.runId!=='string'||!p.runId||typeof p.snapshot!=='string'||Object.keys(p).length!==3)throw new Error('存档版本不支持，已保留原件');
 return p as unknown as Envelope;
}
export function activeRunId(state?:GameState):string{return state?runIds.get(state)||'':activeId;}

export function loadRun(port?:StoragePort):{state:GameState|null;error?:string} {
 try{port??=defaultPort();const raw=port.getItem(RUN_KEY);if(raw===null)return {state:null};const e=readEnvelope(raw);const state=restoreGame(e.snapshot);knownRaw.set(state,raw);runIds.set(state,e.runId);activeId=e.runId;return {state};}
 catch(error){return {state:null,error:error instanceof Error?error.message:'读取失败，未覆盖存档'};}
}

export function saveRun(state:GameState,port?:StoragePort):{ok:boolean;message?:string} {
 if(state.phase==='combat')return {ok:true,message:'战斗中保留本波开始前检查点'};
 try{
  port??=defaultPort();
  const current=port.getItem(RUN_KEY);
  if(knownRaw.has(state)&&current!==knownRaw.get(state))throw new Error('另一个页面已改变存档，请重进读取；未覆盖新进度');
  if(!knownRaw.has(state)&&current!==null)throw new Error('已有存档尚未加载，未覆盖进度');
  const runId=runIds.get(state)||crypto.randomUUID();
  const envelope:Envelope={version:1,runId,snapshot:serializeGame(state)};
  const next=JSON.stringify(envelope);port.setItem(RUN_KEY,next);
  if(port.getItem(RUN_KEY)!==next)throw new Error('存档写入未确认，请保留当前页面');
  knownRaw.set(state,next);runIds.set(state,runId);activeId=runId;
  return {ok:true};
 }catch(error){return {ok:false,message:error instanceof Error?error.message:'保存失败，旧档保持原样'};}
}

export function startFreshRun(seed:number,port?:StoragePort):GameState {
 port??=defaultPort();
 const state=createGame(seed),old=port.getItem(RUN_KEY);
 if(old!==null){
  const key=`${RUN_KEY}.backup.${fingerprint(old)}`;
  const backup=port.getItem(key);if(backup!==null&&backup!==old)throw new Error('备份位置已有不同存档，未创建新局');
  port.setItem(key,old);if(port.getItem(key)!==old)throw new Error('旧档备份失败，未创建新局');
 }
 knownRaw.set(state,old);runIds.set(state,crypto.randomUUID());
 const result=saveRun(state,port);if(!result.ok)throw new Error(result.message);
 return state;
}

export function exportReplay(state:GameState):string {
 return JSON.stringify({version:1,rulesVersion:state.rulesVersion,seed:state.seed,mapId:state.mapId,tick:state.tick,actions:state.actions});
}
export function importReplay(text:string):GameState {
 if(text.length>2000000)throw new Error('回放过大');
 const raw:unknown=JSON.parse(text);if(!raw||typeof raw!=='object')throw new Error('回放格式无效');
 const p=raw as Record<string,unknown>,fresh=createGame(1);
 if(p.version!==1||p.rulesVersion!==fresh.rulesVersion||typeof p.mapId!=='string')throw new Error('回放规则或内容版本不匹配');
 if(!Number.isInteger(p.seed)||typeof p.seed!=='number'||!Number.isInteger(p.tick)||typeof p.tick!=='number'||p.tick<0||p.tick>30*180*7||!Array.isArray(p.actions)||p.actions.length>10000)throw new Error('回放数据无效');
 const actions=p.actions as RecordedAction[];
 for(const entry of actions){if(!entry||!Number.isInteger(entry.tick)||entry.tick<0||entry.tick>p.tick||!entry.action||typeof entry.action!=='object')throw new Error('回放动作无效');}
 // replayGame must validate every action through the same applyAction entry.
 const state=replayGame(p.seed,actions,p.mapId);
 if(state.tick>p.tick)throw new Error('回放时间顺序无效');
 // The final combat interval often contains no player actions. Restore it too.
 while(state.tick<p.tick){const before=state.tick;step(state,Math.min(100000,p.tick-state.tick));if(state.tick===before)throw new Error('回放无法到达终点');}
 return state;
}
