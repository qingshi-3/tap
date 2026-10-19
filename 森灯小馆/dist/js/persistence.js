import {validateState} from './core.js';

export const SAVE_KEY='forest-lantern.save.v1';
let observed, blocked=false;
export function loadGame(){
  try {
    const raw=localStorage.getItem(SAVE_KEY); observed=raw; blocked=false;
    if(raw===null)return {state:null,error:null};
    let state;
    try{state=JSON.parse(raw);}catch{blocked=true;return {state:null,error:'存档内容损坏。原件已保留，请导出备份后处理。'};}
    const check=validateState(state);
    if(!check.ok){blocked=true;return {state:null,error:`存档无法继续读取：${check.message}。原件已保留。`};}
    return {state,error:null};
  }catch{blocked=true;return {state:null,error:'浏览器暂时无法读取本地存档，请检查存储权限后重试。'};}
}
export function saveGame(state){
  if(blocked)return {ok:false,error:'存档写入已暂停，请先导出当前进度，再重新读取。'};
  const check=validateState(state);
  if(!check.ok){blocked=true;return {ok:false,error:`进度校验失败：${check.message}。原存档未覆盖。`};}
  try{
    const current=localStorage.getItem(SAVE_KEY);
    if(observed===undefined||current!==observed){blocked=true;return {ok:false,error:'另一页面已更新进度。为避免覆盖，已暂停此页；请导出当前进度或重新读取。'};}
    const encoded=JSON.stringify(state);
    if(encoded===observed)return {ok:true,error:null};
    // Keep the previous valid generation before replacing the main save. A failed backup stops the write.
    if(current!==null)localStorage.setItem(`${SAVE_KEY}.backup`,current);
    localStorage.setItem(SAVE_KEY,encoded);
    if(localStorage.getItem(SAVE_KEY)!==encoded){blocked=true;return {ok:false,error:'保存时进度被另一页面更新，请重新读取。'};}
    observed=encoded;
    return {ok:true,error:null};
  }catch{blocked=true;return {ok:false,error:'保存失败，可能是存储空间不足。当前进度仍在此页，请先导出，再重新读取。'};}
}
export function exportSave(state){return JSON.stringify(state,null,2);}
export function exportRawSave(){try{return localStorage.getItem(SAVE_KEY)||'';}catch{return '';}}
