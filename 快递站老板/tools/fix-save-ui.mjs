import {readFileSync,writeFileSync} from 'node:fs';
let s=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const changes=[
["toastTimer,sound=false,audio;","toastTimer,sound=false,audio,lastError='';"],
["blocked=true;openError(r.message||'保存失败，原进度已保留');return false","blocked=true;lastError=r.message||'保存失败，原进度已保留';openError(lastError,true);return false"],
["}else{beep();persist();}render();return result","}else{beep();if(!persist())return {ok:false,message:lastError};}render();return result"],
["function openError(message){","function openError(message,retrySave=false){"],
["<p>已停止写入并保留原件。导出后可重试读取；不会自动重开或覆盖。</p><div class=\"sheet-actions\">${button('export','导出原件')}${button('reload','重试读取','primary')}","<p>${retrySave?'最近进度保留在本页。释放存储空间后可重试保存；不要关闭页面。':'已停止写入并保留原件。导出后可重试读取；不会自动重开或覆盖。'}</p><div class=\"sheet-actions\">${button('export','导出进度')}${button(retrySave?'retry-save':'reload',retrySave?'重试保存':'重试读取','primary')}"],
["JSON.stringify(r,null,2)","JSON.stringify({...r,inMemory:loaded.ok?state:null},null,2)"],
["if(a==='reload')location.reload();","if(a==='reload')location.reload();if(a==='retry-save'){blocked=false;if(persist()){close();if(state.phase==='summary')openSummary();else if(state.phase==='ending')openEnding();else if(state.phase==='planning')openPlan();toast('进度已保存')}}"],
["act({type:'BUY',id:b.dataset.buy});openShop()","act({type:'BUY',id:b.dataset.buy});if(!blocked)openShop()"],
["blocked?openError(loaded.message||'存档无法写入'):openMenu()","blocked?openError(lastError||loaded.message||'存档无法写入',!!lastError):openMenu()"],
["if(state.phase!==lastPhase){persist();if(state.phase==='summary')openSummary();if(state.phase==='ending')openEnding()}","if(state.phase!==lastPhase){if(persist()){if(state.phase==='summary')openSummary();if(state.phase==='ending')openEnding()}}"]
];for(const [a,b]of changes){if(!s.includes(a))throw Error('Missing '+a.slice(0,70));s=s.replace(a,b)}writeFileSync(new URL('../js/app.js',import.meta.url),s);
