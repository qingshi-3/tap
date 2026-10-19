import {CONTENT,createGame,dispatch,tick,upgradeCost,adRewardAvailable,managementView,orderPreview,PIPELINE_LAYOUT,arrivalView} from './engine.js';
import {loadGame,saveGame,exportRaw} from './storage.js';
import {createRewardAds} from './ads.js';
import {installPixelSprites} from './pixel.js';
import {renderScene,parcelDataUrl,STATION_SIGNS,sceneY,worldY} from './scene.js';
installPixelSprites();
// A live page owns the save writer where Web Locks are available. This prevents
// simultaneous tabs from crossing the localStorage compare/write window.
let ownsSave=true;
if(navigator.locks){ownsSave=await new Promise(resolve=>{navigator.locks.request('courier-depot.active-writer',{ifAvailable:true},async lock=>{resolve(!!lock);if(lock)await new Promise(release=>addEventListener('pagehide',release,{once:true}));}).catch(()=>resolve(false));});}
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const sheet=$('#sheet'), content=$('#sheet-content'), yard=$('#yard');
let storage;try{storage=localStorage;}catch{storage={getItem(){throw Error('无法访问存储')},setItem(){throw Error('无法访问存储')}};}
const loaded=loadGame(storage);if(!ownsSave){loaded.ok=false;loaded.message='另一个页面正在经营此小站。请关闭另一页面后重试读取。';}let state=loaded.state||createGame(),blocked=!loaded.ok,selected=null,drag=null,modal='',last=performance.now(),saveTimer=0,lastPhase=state.phase,toastTimer,sound=false,audio,lastError='';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let feedback=null,selectedRole=null;
const roleNames={sort:'分拣',pack:'包装',load:'装车'};
const dispatchNotes=[null,null,null];
let adBusy=false,adMessage='';
const rewardAds=createRewardAds({
  getState:()=>state,
  save:s=>blocked?{ok:false,message:lastError||'存档暂时无法写入'}:saveGame(storage,s),
  onBusy:value=>{adBusy=value;refreshRewardSheet()},
  onResult:(message,{saveFailed=false,granted=false}={})=>{
    adMessage=message;
    if(saveFailed){blocked=true;lastError=message;openError(message,true);return}
    render();refreshRewardSheet();
  },
});
function refreshRewardSheet(){if(blocked)return;if(modal==='summary')openSummary();else if(modal==='ending')openEnding()}
function rewardControls(){
  const claimed=state.adRewards?.grants?.some(g=>g.day===state.day);
  if(claimed)return '<p class="ad-result" role="status">额外奖励已入账 · 20 金</p>';
  if(!rewardAds.available())return '';
  const eligible=adRewardAvailable(state);
  return `${eligible||adBusy?`<button class="reward-ad" data-action="reward-ad" ${adBusy?'disabled':''}>${adBusy?'广告加载中…':'看广告 · 额外领20金'}</button>`:''}${adMessage?`<p class="ad-result" role="status">${esc(adMessage)}</p>`:''}`;
}

const routeNames=['梧桐街','河湾路','山丘镇'];const stationNames=['梧桐街小站','河湾转运站','山丘总站'];
const typeName=id=>CONTENT.types.find(t=>t.id===id)?.name||id;
const dayInfo=()=>CONTENT.days[Math.min(state.day-1,CONTENT.days.length-1)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function beep(ok=true){if(!sound)return;try{audio||=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(ok?660:220,audio.currentTime);o.frequency.exponentialRampToValueAtTime(ok?880:160,audio.currentTime+.10);g.gain.setValueAtTime(.045,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.14);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+.15);}catch{}}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2200)}
function persist(){if(blocked)return false;const r=saveGame(storage,state);if(!r.ok){blocked=true;lastError=r.message||'保存失败，原进度已保留';openError(lastError,true);return false}return true}
function present(events=[]){for(const ev of events){if(ev.type==='start'){clearTimeout(toastTimer);$('#toast').classList.remove('show');$('#toast').textContent='';dispatchNotes.fill(null)}if(ev.type==='sorted'){feedback={dest:ev.dest,startedAt:performance.now()/1000,type:'sorted'}}if(ev.type==='depart'){dispatchNotes[ev.dest]={until:performance.now()+2400,text:`+${ev.earnings} 金${ev.batchBonus?' · 集货':''}`};beep()}if(ev.type==='prepared'){feedback={dest:0,startedAt:performance.now()/1000,type:'prepared'};const p=state.shift?.parcels.find(p=>p.id===ev.id);if(p)toast(`${'ABC'[p.dest]} 件已处理`)}}}
function act(action){if(blocked)return;const result=dispatch(state,action);if(!result.ok){toast(result.message||'暂时无法操作');beep(false)}else{beep();present(result.events);if(!persist())return {ok:false,message:lastError};}render();return result}
function close(){sheet.close();modal='';last=performance.now();render()}
function show(kind,html){clearAssignment();modal=kind;content.innerHTML=html;if(!sheet.open)sheet.showModal();content.scrollTop=0;sheet.scrollTop=0;bindSheet()}
const button=(action,label,cls='')=>`<button data-action="${action}" class="${cls}">${label}</button>`;
function openIntro(){show('intro',`<h1>快递站老板</h1><p>带着三名工人，把街角小站做成全城转运站。</p><div class="goal">工人自动分拣、包装、装车。拖动工人到积压的工位；赚运费，招人、添设备，扩大每天的接单量。</div><p>忙碌的工人会先送完手里的货，再走到新岗位。</p><p class="privacy">进度保存在本设备。广告奖励完全自选。</p><div class="sheet-actions">${button('plan','安排第一天','primary')}</div>`)}
let plan=state.plannedOrder?.plan||'steady',route=state.plannedOrder?.route??0;
function openPlan(focusSelector){
  const d=dayInfo(),o=orderPreview(state,{plan,route});
  const modes=[['steady','常规'],['rush','加急']].map(([id,name])=>({id,name,...orderPreview(state,{plan:id,route})}));
  const waves=(o.waves||[]).reduce((out,w)=>{const last=out.at(-1);if(last?.kind===w.kind)last.count+=w.count;else out.push({...w});return out},[]);
  const arrivalPlan=waves.length?`<ol class="plan-waves" aria-label="按顺序来货">${waves.map(w=>`<li><img src="${parcelDataUrl(w.kind,-1,false)}" alt=""><span>${typeName(w.kind)} ×${w.count}</span></li>`).join('')}</ol>`:'';
  show('plan',`<div class="plan-sheet"><h2>第 ${state.day} 天 · ${esc(d.name)}</h2><div class="plan-modes" role="group" aria-label="接单量">${modes.map(m=>`<button data-plan="${m.id}" aria-pressed="${plan===m.id}" class="${plan===m.id?'active':''}"><b>${m.name}<span class="chosen-mark" aria-hidden="true">${plan===m.id?'✓':''}</span></b><span>${m.total} 件${m.id==='rush'?' · 来货更快':''}</span></button>`).join('')}</div>${arrivalPlan}<p class="contract-result" aria-live="polite">准时送达 <b>${Math.ceil(o.total*o.goal)} 件</b>，另奖 <b>${o.bonus} 金</b></p><div class="route-pick"><h3>加价线路 <span>每件多 2 金</span></h3><div class="plan-routes" role="group" aria-label="加价线路">${routeNames.map((n,i)=>`<button data-route="${i}" aria-pressed="${route===i}" class="${route===i?'active':''}"><b>${'ABC'[i]} ${n}</b><span>${o.routeCounts[i]} 件${route===i?' ✓':''}</span></button>`).join('')}</div><p class="route-result" aria-live="polite">${'ABC'[route]}线额外运费：最多 <b>${o.routeExtra} 金</b></p></div><div class="sheet-actions plan-actions">${button('shop','招人与设备')}${button('prepare-shift','确认，去调配','primary')}</div></div>`);
  // Keep keyboard focus on the changed choice when its dependent totals refresh.
  if(focusSelector)content.querySelector(focusSelector)?.focus({preventScroll:true});
}
const upgradeText={worker:'新人先到装车岗，可再调岗',packer:'缩短包装工时，易碎件加固更快',widegate:'加宽搬运通道，缩短大件装车工时',dispatch:'自动发车间隔缩短至7秒',scanner:'分拣岗验单更快，减少异常件积压',sorter:'缩短分拣工时'};
function openShop(hired=false){
  const staff=managementView(state);
  show('shop',`<div class="shop-heading"><h2>招人与设备</h2><span class="shop-cash">${Math.floor(state.cash)} 金</span><button data-action="plan" aria-label="返回接单">×</button></div><section class="shop-staff" aria-label="当前员工分布" aria-live="polite"><p>员工 <b>${staff.total} 人</b></p><dl>${Object.entries(roleNames).map(([id,name])=>`<div class="${hired&&id==='load'?'staff-added':''}"><dt>${name}</dt><dd>${staff.roles[id].assigned} 人${hired&&id==='load'?'<span class="staff-increase">+1</span>':''}</dd></div>`).join('')}</dl></section>${CONTENT.upgrades.map(u=>{const level=state.upgrades[u.id]||0,max=u.max||1,cost=upgradeCost(state,u.id),locked=state.day<(u.unlockDay||1);return `<div class="shop-row"><div><h3>${esc(u.id==='worker'?'招募员工':u.name)} ${u.id!=='worker'&&level?`✓${level>1?level:''}`:''}</h3><p>${esc(upgradeText[u.id]||u.description||u.effect)}</p></div><button data-buy="${u.id}" ${locked||level>=max||state.cash<cost?'disabled':''}>${level>=max?(u.id==='worker'?'已满员':'已置办'):locked?`第${u.unlockDay}天`:`${cost} 金`}</button></div>`}).join('')}<div class="sheet-actions">${button('plan','返回接单','primary')}</div>`);
}
function openSummary(){const r=state.dayResult||{};show('summary',`<h2>第 ${r.day||state.day} 天打烊</h2><div class="result-numbers"><div><strong>${r.delivered||0}</strong><span>件已送出</span></div><div><strong>+${Math.floor(r.profit??r.earnings??0)}</strong><span>金币入账</span></div><div><strong>${r.missed||0}</strong><span>件未准时</span></div></div><div class="goal">${r.success?'营业目标达标':'营业目标未达标，明天再试'} · 奖金 ${r.bonus||0} 金<br>错放 ${r.errors||0} 次 · 累计送出 ${state.totalDelivered} 件</div>${state.day===6?'<p>河湾转运站开放</p>':state.day===12?'<p>山丘总站开放</p>':''}<div class="sheet-actions">${button('next',state.day===18?'查看经营成果':'准备明天','primary')}</div>${rewardControls()}`)}
function openEnding(){show('ending',`<h1>山丘总站，开张了</h1><p>18 天经营结束。你已经走过街角小站、河湾转运站和山丘总站。</p><div class="result-numbers"><div><strong>${state.totalDelivered}</strong><span>累计送出</span></div><div><strong>${state.history.filter(h=>h.success).length}</strong><span>次营业达标</span></div><div><strong>${Math.floor(state.cash)}</strong><span>金币结余</span></div></div><p>接下来可以继续自由营业。不同接单方式、重点线路与设施组合，仍会改变每一天的压力。</p><div class="sheet-actions">${button('next','继续自由营业','primary')}</div>${rewardControls()}`)}
function openMenu(){show('menu',`<h2>${state.phase==='running'?'已暂停':'小站管理'}</h2><div class="settings-line"><span>操作音效</span>${button('sound',sound?'已开启':'已关闭')}</div><div class="sheet-actions">${button('help','岗位说明')}${button('history','营业记录')}</div><div class="sheet-actions">${button('export','导出存档')}${button('privacy','隐私说明')}</div><p class="privacy">自动保存于本设备；退出时保留当天进度。${reduced.matches?'已采用减少动效。':''}</p><div class="sheet-actions">${button('close','继续经营','primary')}</div>`)}
function openHelp(){show('help',`<button class="close-top" data-action="menu" aria-label="返回">×</button><h2>岗位说明</h2><p><b>分拣 → 包装 → 装车</b><br>三个岗位都有工人才会持续出货。拖动工人到目标工位，也可以点工人再点工位。忙碌的工人会先交完手里的货再换岗。</p><p>看上方订单下的下一批来货，提前安排人手。入口堵住后，已经到站的货仍在门口排队；货堆变大、工位亮起橙色时，需要支援。</p><p>异常件需要分拣岗验单，易碎件需要包装岗加固，大件需要装车岗搬运。设备能缩短对应工时，特殊货物仍需额外处理。</p><p>车辆自动发车，也可点击有货的车提前发出。一次发出至少3件，每件多赚1金；急件须在25秒内发出。</p><div class="sheet-actions">${button('close','继续经营','primary')}</div>`)}
function openError(message,retrySave=false){show('error',`<h2>存档需要处理</h2><p>${esc(message)}</p><p>${retrySave?'最近进度保留在本页。释放存储空间后可重试保存；不要关闭页面。':'已停止写入并保留原件。导出后可重试读取；不会自动重开或覆盖。'}</p><div class="sheet-actions">${button('export','导出进度')}${button(retrySave?'retry-save':'reload',retrySave?'重试保存':'重试读取','primary')}</div>`)}
function exportSave(){const r=exportRaw(storage);const blob=new Blob([JSON.stringify({...r,inMemory:loaded.ok?state:null},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`courier-depot-day-${state.day}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('已导出当前存档与备份')}
function bindSheet(){content.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{const a=b.dataset.action;if(a==='plan')openPlan();if(a==='shop')openShop();if(a==='prepare-shift'){if(act({type:'SET_ORDER',plan,route})?.ok){close();$('#workers button')?.focus({preventScroll:true});toast('拖动工人调岗，准备好再开门')}}if(a==='reward-ad'){if(!blocked){adMessage='';rewardAds.request()}}if(a==='next'){rewardAds.cancel();adMessage='';if(act({type:'NEXT'})?.ok){if(state.phase==='ending')openEnding();else openPlan()}}if(a==='close')close();if(a==='menu')openMenu();if(a==='sound'){sound=!sound;beep();openMenu()}if(a==='help')openHelp();if(a==='export')exportSave();if(a==='reload')location.reload();if(a==='retry-save'){blocked=false;if(persist()){close();if(state.phase==='summary')openSummary();else if(state.phase==='ending')openEnding();else if(state.phase==='planning')openPlan();toast('进度已保存')}}if(a==='history')show('history',`<button class="close-top" data-action="menu" aria-label="返回">×</button><h2>营业记录</h2><ul class="compact-list">${state.history.length?state.history.slice(-18).reverse().map(h=>`<li>第 ${h.day} 天 · 送出 ${h.delivered} 件 · ${h.success?'达标':'未达标'}<br>入账 ${h.profit??h.earnings} 金</li>`).join(''):'<li>完成第一天后，营业结果会记在这里。</li>'}</ul>`);if(a==='privacy')show('privacy',`<button class="close-top" data-action="menu" aria-label="返回">×</button><h2>隐私说明</h2><p>《快递站老板》由阿芙工作室制作。游戏在当前设备保存经营进度，不自行收集姓名、电话、位置、通讯录或设备标识，不包含第三方统计或内购。结算页可自愿观看TapTap提供的激励广告，每个营业日最多领取一次20金；不观看也可正常游玩。广告由平台及其广告服务方处理，相关数据处理以广告服务与TapTap隐私政策为准。</p><p>清理浏览器或 TapTap 应用数据可能移除存档。你可在小站管理中导出副本。TapTap 平台自身的数据处理以其隐私政策为准。</p><p>反馈可通过本游戏 TapTap 页面提交。更新日期：2026年10月19日。</p>`)});content.querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>{plan=b.dataset.plan;openPlan(`[data-plan="${plan}"]`)});content.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>{route=+b.dataset.route;openPlan(`[data-route="${route}"]`)});content.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{const id=b.dataset.buy,result=act({type:'BUY',id});if(!blocked)openShop(id==='worker'&&!!result?.ok)})}
// Input follows actual worker identities. Pointer capture keeps a drag intact outside the yard.
let stationSigns={};
function placeStationSigns(){
  const r=yard.getBoundingClientRect();if(!r.width||!r.height)return;
  for(const [role,sign] of Object.entries(STATION_SIGNS)){const b=$(`#stations [data-role="${role}"]`);b.style.left=`${sign.x/390*100}%`;b.style.top=`${sign.y/520*100}%`;b.style.width=`${sign.width/390*100}%`;stationSigns[role]={...sign,height:b.offsetHeight*520/r.height}}
}
new ResizeObserver(placeStationSigns).observe(yard);placeStationSigns();
const workersLayer=document.createElement('div');workersLayer.id='workers';workersLayer.setAttribute('aria-label','工人');yard.append(workersLayer);
let dropRole=null,suppressWorkerClick=false;
function canAssign(){return !blocked&&!modal&&['planning','running'].includes(state.phase)}
function clearAssignment(){suppressWorkerClick=false;selected=null;selectedRole=null;dropRole=null;const old=drag;drag=null;if(old&&yard.hasPointerCapture(old.pointerId))yard.releasePointerCapture(old.pointerId)}
function workerAt(id){return managementView(state).workers.find(w=>w.id===id)}
function yardPoint(x,y){const r=yard.getBoundingClientRect();return {x:(x-r.left)*390/r.width,y:worldY((y-r.top)*520/r.height)}}
function roleAt(x,y){
  const r=yard.getBoundingClientRect();if(x<r.left||x>r.right||y<r.top||y>r.bottom)return null;
  for(const b of $$('#stations [data-role]')){const q=b.getBoundingClientRect();if(x>=q.left&&x<=q.right&&y>=q.top&&y<=q.bottom)return b.dataset.role}
  const p=yardPoint(x,y);
  return Object.keys(roleNames).map(role=>{const q=PIPELINE_LAYOUT.roles[role].work;return {role,d:Math.hypot((p.x-q.x)/58,(p.y-q.y)/48)}}).filter(v=>v.d<=1).sort((a,b)=>a.d-b.d)[0]?.role||null;
}
function chooseWorker(id){const w=workerAt(id);if(!canAssign()||!w)return;selected=id;selectedRole=w.targetRole;dropRole=null;render()}
function moveSelected(role){const w=workerAt(selected);if(!canAssign()||!w||!role)return;const id=w.id,busy=!!w.parcel,old=w.targetRole;clearAssignment();if(old===role){render();return}if(act({type:'MOVE_WORKER',workerId:id,role})?.ok)toast(`${id}号 → ${roleNames[role]}${busy?'，交货后换岗':''}`)}
$$('#stations [data-role]').forEach(b=>{b.onclick=()=>{if(selected!==null)moveSelected(b.dataset.role);else toast('先点一名工人')};b.onpointerenter=()=>{if(selected!==null&&!drag){dropRole=b.dataset.role;render()}};b.onpointerleave=()=>{if(!drag){dropRole=null;render()}};b.onfocus=()=>{if(selected!==null){dropRole=b.dataset.role;render()}};b.onblur=()=>{if(!drag){dropRole=null;render()}}});
$$('[data-dispatch]').forEach(b=>b.onclick=()=>{clearAssignment();act({type:'DISPATCH',dest:+b.dataset.dispatch})});
yard.addEventListener('pointerdown',e=>{
  if(!canAssign()||e.button!==0||drag)return;
  const r=yard.getBoundingClientRect(),candidates=managementView(state).workers.map(w=>({w,x:r.left+w.x*r.width/390,y:r.top+(sceneY(w.y)-18)*r.height/520})).filter(v=>Math.abs(v.x-e.clientX)<=22&&Math.abs(v.y-e.clientY)<=22).sort((a,b)=>Math.hypot(a.x-e.clientX,a.y-e.clientY)-Math.hypot(b.x-e.clientX,b.y-e.clientY));
  // Station labels are explicit destinations, even when a walking worker passes behind one.
  const button=e.target.closest('button');if(button&&!button.dataset.workerId)return;
  const w=candidates[0]?.w;if(!w)return;
  e.preventDefault();chooseWorker(w.id);suppressWorkerClick=true;
  const p=yardPoint(e.clientX,e.clientY);drag={id:w.id,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:w.x,y:w.y,offsetX:w.x-p.x,offsetY:w.y-p.y,moved:false};yard.setPointerCapture(e.pointerId);
});
yard.addEventListener('pointermove',e=>{if(!drag||drag.pointerId!==e.pointerId)return;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>6)drag.moved=true;if(drag.moved){const p=yardPoint(e.clientX,e.clientY);drag.x=p.x+drag.offsetX;drag.y=worldY(sceneY(p.y+drag.offsetY)-(e.pointerType==='touch'?26:0));dropRole=roleAt(e.clientX,e.clientY);render()}});
yard.addEventListener('pointerup',e=>{if(!drag||drag.pointerId!==e.pointerId)return;const moved=drag.moved,target=roleAt(e.clientX,e.clientY);drag=null;if(yard.hasPointerCapture(e.pointerId))yard.releasePointerCapture(e.pointerId);if(moved){if(target)moveSelected(target);else{clearAssignment();render()}}else render();setTimeout(()=>suppressWorkerClick=false,0)});
yard.addEventListener('pointercancel',()=>{clearAssignment();render()});
yard.addEventListener('lostpointercapture',()=>{if(drag){clearAssignment();render()}});
yard.addEventListener('click',e=>{const b=e.target.closest('[data-worker-id]');if(b){if(!suppressWorkerClick)chooseWorker(+b.dataset.workerId);return}if(!e.target.closest('button')&&selected!==null&&!suppressWorkerClick){const role=roleAt(e.clientX,e.clientY);if(role)moveSelected(role);else{clearAssignment();render()}}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal){clearAssignment();render()}});
$('#menu').onclick=()=>blocked?openError(lastError||loaded.message||'存档无法写入',!!lastError):openMenu();
$('#edit-order').onclick=()=>{plan=state.plannedOrder.plan;route=state.plannedOrder.route??0;openPlan()};
$('#main-action').onclick=()=>{clearAssignment();if(state.phase==='planning'){if(state.plannedOrder)act({type:'START'});else openPlan()}else if(state.phase==='running')openMenu();else if(state.phase==='ending')openEnding();else openSummary()};
sheet.addEventListener('cancel',e=>{e.preventDefault();if(['menu','help','history','privacy','shop','plan'].includes(modal))close()});
function render(){
  const d=dayInfo(),shift=state.shift,running=state.phase==='running',view=managementView(state),arrivals=arrivalView(state);
  $('#station').textContent=stationNames[Math.min(2,Math.floor((state.day-1)/6))];
  $('#day').textContent=`第 ${state.day} 天${state.day>18?' · 自由营业':''}`;
  $('#cash').textContent=Math.floor(state.cash);
  $('#reputation').textContent=running?`剩余 ${Math.max(0,Math.ceil(shift.duration-shift.elapsed))} 秒`:state.phase==='planning'?'待开门':'已打烊';
  $('#shift-status').textContent=running?`已送 ${shift.delivered} / ${shift.total} 件`:state.plannedOrder?`${state.plannedOrder.plan==='rush'?'加急':'常规'} ${orderPreview(state,state.plannedOrder).total} 件`:'准备营业 · '+d.name;
  $('#edit-order').hidden=state.phase!=='planning'||!state.plannedOrder;
  $('#edit-order').disabled=blocked;
  $('#main-action').disabled=blocked;
  $('#main-action').textContent=running?'暂停':state.phase==='planning'?(state.plannedOrder?'开门营业':'选择订单'):'营业结算';
  $$('#stations [data-role]').forEach(b=>{const role=b.dataset.role,v=view.roles[role],queued=v.pending+(role==='sort'?arrivals.waiting:0),urgent=v.oldestUrgentRemaining!==null&&v.oldestUrgentRemaining!==undefined&&v.oldestUrgentRemaining<12;
    b.querySelector('small').textContent=!running?'':urgent?(v.oldestUrgentRemaining<=0?'急件超时':`急件 ${Math.ceil(v.oldestUrgentRemaining)}秒`):v.pressure==='blocked'?`停工 ${queued}件`:v.pressure==='busy'?(queued?`积压 ${queued}件`:role==='sort'?'接货繁忙':'处理中'):queued?`等候 ${queued}件`:v.busy?'处理中':'等货';
    b.dataset.pressure=running?(urgent?'urgent':v.pressure||'steady'):'idle';b.classList.toggle('stalled',running&&!v.active&&v.pending>0);b.disabled=blocked;
  });
  const first=!running&&state.phase==='planning'&&state.plannedOrder?orderPreview(state,state.plannedOrder).waves?.[0]:null;
  const notice=$('#arrival-notice');notice.hidden=!arrivals.enabled&&!first;
  const forecast=$('#arrival-forecast'),waiting=$('#arrival-waiting');
  const upcoming=first||arrivals.next||(arrivals.current?.remaining?arrivals.current:null);
  forecast.textContent=upcoming?`${typeName(upcoming.kind)} ×${upcoming.count}`:'今日来货已到齐';
  $('#arrival-timing').textContent=first?'首批来货':arrivals.next?`${Math.max(0,Math.ceil(arrivals.next.inSeconds))}秒后来货`:arrivals.current?.remaining?'正在到货':'';
  const arrivalIcon=$('#arrival-icon');arrivalIcon.hidden=!upcoming;
  if(upcoming&&arrivalIcon.dataset.kind!==upcoming.kind){arrivalIcon.src=parcelDataUrl(upcoming.kind,-1,false);arrivalIcon.dataset.kind=upcoming.kind}
  waiting.textContent=arrivals.waiting?`待卸 ${arrivals.waiting}件`:'';
  notice.classList.toggle('inbound-blocked',arrivals.waiting>0);
  $$('[data-dispatch]').forEach((b,i)=>{
    const count=shift?.loading?.[i].length||0,seconds=Math.max(0,Math.ceil(shift?.departures?.[i]||0));
    b.disabled=!running||!count||blocked;
    b.querySelector('b').textContent=`${'ABC'[i]}车 ${count?`${count}件`:'待装'}`;
    b.querySelector('small').textContent=running&&count?`${seconds}秒发车`:'';
    b.setAttribute('aria-label',`${'ABC'[i]}车${count?`发车，已装${count}件，${seconds}秒后自动发车`:'等待装货'}`);
    b.classList.toggle('batch-ready',count>=3);
    const note=dispatchNotes[i];b.parentElement.querySelector('.dispatch-gain').textContent=note&&note.until>performance.now()?note.text:'';
  });
  const chosen=view.workers.find(w=>w.id===selected),target=dropRole&&dropRole!==chosen?.targetRole?dropRole:null;
  $('#selection').textContent=chosen?`${chosen.id}号 · ${roleNames[chosen.targetRole]} → ${target?roleNames[target]:'选工位'}`:'拖动工人调岗';
  for(const w of view.workers){
    let b=workersLayer.querySelector(`[data-worker-id="${w.id}"]`);
    if(!b){b=document.createElement('button');b.dataset.workerId=w.id;b.className='worker-hit';workersLayer.append(b)}
    b.style.left=`${w.x/390*100}%`;b.style.top=`${(sceneY(w.y)-18)/520*100}%`;
    b.disabled=!canAssign();b.setAttribute('aria-label',`${w.id}号工人，${roleNames[w.targetRole]}${w.targetRole!==w.role?'，调岗中':''}`);b.setAttribute('aria-pressed',String(selected===w.id));
  }
  workersLayer.querySelectorAll('[data-worker-id]').forEach(b=>{if(!view.workers.some(w=>w.id===+b.dataset.workerId))b.remove()});
  $$('#stations [data-role]').forEach(b=>{const role=b.dataset.role,v=view.roles[role],change=target?(role===target?1:role===chosen.targetRole?-1:0):0;b.querySelector('b').textContent=change?`${roleNames[role]} ${v.assigned}→${v.assigned+change}`:`${roleNames[role]} ${v.assigned}人`;b.classList.toggle('drop-ready',!!chosen&&role!==chosen.targetRole);b.classList.toggle('drop-hover',role===target);b.classList.remove('active');b.removeAttribute('aria-pressed')});
  renderScene($('#scene'),state,{time:performance.now()/1000,reducedMotion:reduced.matches,selectedRole,selectedWorkerId:selected,dragWorker:drag?.moved?drag:null,dropRole:target,feedback,stationSigns,arrivals});
}
function frame(now){const dt=Math.min(.1,(now-last)/1000);last=now;if(!sheet.open&&!document.hidden&&!blocked&&state.phase==='running'){const events=tick(state,dt);present(events);saveTimer+=dt;if(saveTimer>3){persist();saveTimer=0}if(state.phase!==lastPhase){clearAssignment();if(persist()){if(state.phase==='summary')openSummary();if(state.phase==='ending')openEnding()}}lastPhase=state.phase}render();requestAnimationFrame(frame)}
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearAssignment();persist();}last=performance.now()});window.addEventListener('pagehide',()=>{rewardAds.cancel();persist()});window.addEventListener('storage',e=>{if(e.key==='courier-depot.save.v1'){blocked=true;openError('另一个页面更新了进度。请重试读取最新存档。')}});
if(!blocked&&!state.management){const enabled=dispatch(state,{type:'ENABLE_MANAGEMENT'});if(!enabled.ok){blocked=true;lastError=enabled.message||'流水线进度无法读取';}else persist()}
if(!blocked&&state.adRewards?.pending){dispatch(state,{type:'CANCEL_AD',id:state.adRewards.pending.id});persist()}
render();if(blocked)openError(lastError||loaded.message);else if(state.phase==='summary')openSummary();else if(state.phase==='ending')openEnding();else if(state.day===1&&!state.history.length&&state.phase==='planning'&&!state.plannedOrder)openIntro();requestAnimationFrame(frame);



