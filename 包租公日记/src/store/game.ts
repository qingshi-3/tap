import {computed,ref,toRaw} from 'vue';
import {defineStore} from 'pinia';
import {createGame,dispatch,loadGame,saveGame,selectProperties,selectTenants,selectSummary} from '../game';
export const useGameStore=defineStore('game',()=>{
 const state=ref(createGame());const blocked=ref(false);const error=ref('');const message=ref('');const messageError=ref(false);const retryable=ref(false);let raw:string|null=null;let pending:ReturnType<typeof createGame>|null=null;
 try { const loaded=loadGame(localStorage);state.value=loaded.state??createGame();blocked.value=loaded.blocked;error.value=loaded.error??'';raw=loaded.raw; } catch {blocked.value=true;error.value='无法读取本机存档。请检查浏览器存储权限后重新打开。';}
 function act(action:Parameters<typeof dispatch>[1]) {
  if(blocked.value)return false;
  const result=dispatch(toRaw(state.value),action);message.value=result.message;messageError.value=!result.ok;
  if(!result.ok)return false;
  try {const saved=saveGame(localStorage,result.state,raw);if(!saved.ok){failed(saved.error??'保存失败',result.state);return false;}state.value=result.state;raw=saved.raw;error.value='';}catch {failed('保存失败，请检查浏览器存储权限。',result.state);return false;}
  return true;
 }
 function failed(reason:string,next:ReturnType<typeof createGame>){error.value=reason;blocked.value=true;retryable.value=!/另一|损坏|版本|不支持/.test(reason);pending=retryable.value?next:null;message.value=retryable.value?'操作未保存，可重试保存后继续。':'操作未生效，请重新载入最新进度。';}
 function retrySave(){if(!pending||!retryable.value)return;try{const result=saveGame(localStorage,pending,raw);if(!result.ok){failed(result.error??'保存失败',pending);return;}state.value=pending;raw=result.raw;pending=null;blocked.value=false;retryable.value=false;error.value='';message.value='进度已保存，可以继续。';}catch{error.value='保存失败，请检查浏览器存储权限。';}}
 return {state,blocked,error,message,messageError,retryable,act,retrySave,properties:computed(()=>selectProperties(state.value)),tenants:computed(()=>selectTenants(state.value)),summary:computed(()=>selectSummary(state.value))};
});
