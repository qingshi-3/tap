import * as R from './rules.js';
import {loadArt,drawTerrain,drawBuilding,drawIcon} from './art.js';
import {readSave,writeSave,replaceSave,SAVE_KEY} from './storage.js';
const {TERRAIN,BUILDINGS}=R;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const signed=n=>(n>0?'+':'')+Math.round(n),fmt=n=>n>=10000?(n/10000).toFixed(n<100000?1:0)+'万':n;
const seasons=['春','夏','秋','冬'],PAD=300;
let storage,loaded;
try{storage=window.localStorage;loaded=readSave(storage);}catch{loaded={ok:false,reason:'浏览器未允许本地存档'};}
let state=loaded.ok&&loaded.state?loaded.state:R.createGame(20261019);
let blocked=!loaded.ok,unsaved=false,marketKind=null,selection=null,selectedTile=null,anchor=null,rotation=0;
let cell=matchMedia('(max-height:700px) and (orientation:portrait)').matches?48:64;
let gesture=null,frame=0,toastTimer;
const game=$('#game'),board=$('#board'),viewport=$('#viewport'),market=$('#market'),placement=$('#placement'),inspector=$('#inspector'),dialog=$('#dialog');
// Touch release activates controls directly, including immediately after a captured drag.
// Keyboard and mouse retain native click behavior; compatibility touch clicks cannot double-charge.
let touchControl=null;
document.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;const button=e.target.closest('button');touchControl=button&&!button.matches('.tile,.offer,#held-item')?{button,id:e.pointerId,x:e.clientX,y:e.clientY}:null;});
document.addEventListener('pointerup',e=>{const t=touchControl;touchControl=null;if(t&&e.pointerId===t.id&&t.button===e.target.closest('button')&&Math.hypot(e.clientX-t.x,e.clientY-t.y)<8){e.preventDefault();t.button.click();}});
document.addEventListener('pointercancel',()=>{touchControl=null;});
document.addEventListener('click',e=>{if(e.isTrusted&&e.detail>0&&(e.pointerType==='touch'||e.sourceCapabilities?.firesTouchEvents)){e.preventDefault();e.stopImmediatePropagation();}},true);
board.style.setProperty('--cell',cell+'px');
const tiles=[];
for(let y=0;y<14;y++)for(let x=0;x<14;x++){
 const el=document.createElement('button');el.className='tile';el.dataset.x=x;el.dataset.y=y;el.setAttribute('role','gridcell');el.tabIndex=x===6&&y===6?0:-1;el.innerHTML='<canvas width="64" height="64"></canvas>';board.append(el);tiles.push(el);
}
function tileAt(x,y){return state.tiles.find(t=>t.x===x&&t.y===y);}
function icon(key){return `<canvas width="64" height="64" data-icon="${esc(key)}" aria-hidden="true"></canvas>`;}
function paint(root=document){root.querySelectorAll('[data-icon]').forEach(c=>{const ctx=c.getContext('2d');ctx.clearRect(0,0,64,64);drawIcon(ctx,c.dataset.icon,0,0,64);});root.querySelectorAll('[data-land]').forEach(c=>{const o=state.offers[+c.dataset.land];if(!o)return;const cells=R.rotateCells(o.cells,rotation),w=Math.max(...cells.map(t=>t.x))+1,h=Math.max(...cells.map(t=>t.y))+1,s=Math.min(28,112/w,72/h),ctx=c.getContext('2d');ctx.clearRect(0,0,120,80);for(const t of cells)drawTerrain(ctx,t.terrain,(120-w*s)/2+t.x*s,(80-h*s)/2+t.y*s,s);});}
function landIcon(index){return `<canvas width="120" height="80" data-land="${index}" aria-hidden="true"></canvas>`;}
function notify(message){if(dialog.open){let p=dialog.querySelector('.dialog-notice');if(!p){p=document.createElement('p');p.className='dialog-notice';p.setAttribute('role','status');dialog.append(p);}p.textContent=message;}$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3200);}
function save(){const r=writeSave(storage,state);unsaved=!r.ok;if(!r.ok)notify(r.reason);return r;}
function act(fn,...args){if(blocked)return false;const r=fn(state,...args);if(!r.ok){notify(r.reason);return false;}save();return true;}
function goalText(){const g=R.LEVELS[state.level+1];return g?`人口 ${state.population}/${g.population} · 学识 ${state.knowledge}/${g.knowledge}`:`${state.tiles.length} 格领土`;}
function renderHud(){
 const f=R.forecast(state);$('#records').textContent=unsaved?'未保存':'存档';$('#season').textContent=`第 ${Math.floor((state.turn-1)/4)+1} 年 · ${seasons[(state.turn-1)%4]}`;
 const stats=[['gold',state.gold,`金币 ${signed(f.gold)}`],['food',state.food,`粮食 ${signed(f.food)}`],['wood',state.wood,`木材 ${signed(f.wood)}`],['population',state.population,`人口 / ${f.capacity}`],['happiness',state.happiness,'幸福']];
 $('#resources').innerHTML=stats.map(([k,v,label])=>`<div class="resource ${f[k]<0?'negative':''}" aria-label="${esc(label)}，当前${v}">${icon(k)}<div><strong>${fmt(v)}</strong><small>${label}</small></div></div>`).join('');
 $('#milestone').innerHTML=`${R.LEVELS[state.level].name}<small>${goalText()}</small>`;
 $('#open-land').disabled=state.landBought||blocked;$('#open-land').textContent=state.landBought?'本季已购':'买地';$('#open-building').disabled=blocked;$('#next-turn').disabled=blocked||!!selection||!!gesture;
 paint($('.hud'));
}
function placementCheck(){if(!selection||!anchor)return{ok:false,reason:'拖到地图上的合适位置'};
 if(selection.kind==='land')return R.canPlaceLand(state,selection.index,anchor.x,anchor.y,rotation);
 const t=tileAt(anchor.x,anchor.y),b=BUILDINGS[selection.type];
 if(!t)return{ok:false,reason:'这里还没有买地'};if(t.building)return{ok:false,reason:'这里已有建筑'};
 if(!b.terrains.includes(t.terrain))return{ok:false,reason:'需要'+b.terrains.map(k=>TERRAIN[k].name).join('或')};
 if(state.gold<b.cost)return{ok:false,reason:'金币不足'};return{ok:true,reason:''};
}
function cellsForSelection(){return selection?.kind==='land'?R.rotateCells(state.offers[selection.index].cells,rotation):[{x:0,y:0}];}
function drawBoard(){
 const map=new Map(state.tiles.map(t=>[`${t.x},${t.y}`,t])),ghosts=selection&&anchor?cellsForSelection().map(c=>({...c,x:c.x+anchor.x,y:c.y+anchor.y})):[],valid=placementCheck().ok;
 for(const el of tiles){const x=+el.dataset.x,y=+el.dataset.y,t=map.get(`${x},${y}`),g=ghosts.find(c=>c.x===x&&c.y===y),ctx=el.firstElementChild.getContext('2d');ctx.clearRect(0,0,64,64);ctx.imageSmoothingEnabled=false;el.className='tile'+(t?' owned':' empty')+(selection?' placing':'');el.querySelector('.level')?.remove();
  if(t){drawTerrain(ctx,t.terrain,0,0,64,x+y*14);if(t.building){drawBuilding(ctx,t.building,0,0,64,t.level,t.terrain);if(t.level>1){const badge=document.createElement('span');badge.className='level';badge.textContent='ⅡⅢ'[t.level-2];el.append(badge);}}}
  if(selection?.kind==='building'&&t&&!t.building&&BUILDINGS[selection.type].terrains.includes(t.terrain))el.classList.add('suitable');
  if(g){ctx.globalAlpha=.85;if(selection.kind==='land')drawTerrain(ctx,g.terrain,0,0,64);else drawBuilding(ctx,selection.type,0,0,64,1,t?.terrain);ctx.globalAlpha=1;el.classList.remove('suitable');el.classList.add(valid?'ghost':'invalid');}
  if(!selection&&selectedTile?.x===x&&selectedTile?.y===y)el.classList.add('selected');
  el.setAttribute('aria-label',`${x+1}列${y+1}行，${t?TERRAIN[t.terrain].name+(t.building?'，'+BUILDINGS[t.building].name+' '+t.level+'级':'，空地'):'未购土地'}`);
 }
}
const briefs={house:'增加住房与税收',farm:'产粮，邻水增产',lumber:'产木材，邻林增产',mine:'开采金币',fishery:'产粮，冬季照常',market:'邻民居增加收益',school:'积累学识',clinic:'提升幸福与人口',barracks:'减少风暴损失'};
function availableBuilding(type){const b=BUILDINGS[type];return state.tiles.some(t=>!t.building&&b.terrains.includes(t.terrain));}
function renderMarket(){
 if(!marketKind){market.hidden=true;return;}market.hidden=false;market.classList.remove('lifted');const land=marketKind==='land',cost=5*((land?state.rerolls:state.buildingRerolls)+1);
 const cards=land?state.offers.map((o,i)=>`<button class="offer" data-kind="land" data-index="${i}" ${state.gold<o.cost?'disabled':''}>${landIcon(i)}<strong>${o.name}</strong><span class="price">${o.cost} 金币</span><small>${o.cells.length} 格土地</small></button>`).join(''):
 R.getBuildingOffers(state).map(type=>{const b=BUILDINGS[type],can=availableBuilding(type);return`<button class="offer" data-kind="building" data-type="${type}" ${state.gold<b.cost||!can?'disabled':''}>${icon(type)}<strong>${b.name}</strong><span class="price">${b.cost} 金币</span><small>${can?briefs[type]:'暂无合适空地'}</small></button>`;}).join('');
 market.innerHTML=`<div class="market-header"><h2 id="market-title">${land?'选一块土地':'选一座建筑'}</h2><div class="controls">${land?'<button id="market-rotate" aria-label="旋转候选地块">旋转 ↻</button>':''}<button id="close-market" aria-label="收起选择">收起</button></div></div><div class="offers">${cards}</div><div class="market-footer"><span>拖到地图上，松手${land?'购买':'建造'}</span><div class="controls"><button id="refresh-offers" ${state.gold<cost?'disabled':''}>换一批 ${cost}金</button>${land?'<button id="skip-land">先建造</button>':''}</div></div>`;
 $('#close-market').onclick=()=>closeMarket();if(land){$('#market-rotate').onclick=()=>{rotation=(rotation+1)%4;paint(market);};$('#skip-land').onclick=()=>openMarket('building');}
 $('#refresh-offers').onclick=()=>{if(act(land?R.reroll:R.rerollBuildings)){renderHud();renderMarket();}};
 market.querySelectorAll('.offer').forEach(el=>{el.addEventListener('pointerdown',e=>beginOffer(e,el));el.onclick=e=>{if(e.detail===0)selectForTap(offerData(el));};});paint(market);
}
function offerData(el){return el.dataset.kind==='land'?{kind:'land',index:+el.dataset.index}:{kind:'building',type:el.dataset.type};}
function openMarket(kind,{center=false}={}){if(blocked)return;if(kind==='land'&&state.landBought){notify('本季已购地，下季再来');return;}selection=null;anchor=null;selectedTile=null;marketKind=kind;rotation=0;render();if(center)requestAnimationFrame(()=>centerOn(6.5,6.5,true));}
function closeMarket(){marketKind=null;render();}
function selectForTap(item){selection=item;marketKind=null;anchor=null;selectedTile=null;render();}
function renderPlacement(){placement.hidden=!selection||!!gesture?.active;if(placement.hidden)return;const land=selection.kind==='land',b=land?state.offers[selection.index]:BUILDINGS[selection.type],check=placementCheck();
 placement.innerHTML=`<div class="placement-info"><button id="held-item" aria-label="拖动${b.name}">${land?landIcon(selection.index):icon(selection.type)}</button><div><strong>${b.name} · ${b.cost} 金币</strong><p>${land?'拖动地块，或点地图选择位置':b.description}</p></div></div><p class="placement-reason ${check.ok?'':'bad'}">${check.ok?'位置合适':check.reason}</p><div class="actions"><button id="cancel-placement">放回</button>${land?'<button id="rotate">旋转 ↻</button>':''}<button id="confirm-placement" class="primary" ${check.ok?'':'disabled'}>${land?'确认买地':'确认建造'}</button></div>`;
 $('#held-item').onpointerdown=e=>beginOffer(e,null,selection);$('#cancel-placement').onclick=()=>openMarket(selection.kind);
 if(land)$('#rotate').onclick=()=>{rotation=(rotation+1)%4;render();};$('#confirm-placement').onclick=commitPlacement;paint(placement);
}
function commitPlacement(){const check=placementCheck();if(!check.ok){notify(check.reason);return false;}const land=selection.kind==='land',name=land?state.offers[selection.index].name:BUILDINGS[selection.type].name;
 if(!act(land?R.placeLand:R.build,...(land?[selection.index,anchor.x,anchor.y,rotation]:[selection.type,anchor.x,anchor.y])))return false;
 selection=null;anchor=null;selectedTile=null;marketKind=null;render();notify(`${name}${land?'已拼入领土':'建造完成'}`);if(land)openMarket('building');return true;
}
function renderInspector(){const t=selectedTile&&tileAt(selectedTile.x,selectedTile.y);inspector.hidden=!t?.building;if(inspector.hidden)return;const b=BUILDINGS[t.building],cost=R.upgradeCost(t);
 inspector.innerHTML=`<div class="inspect-heading">${icon(t.building)}<div><h3>${b.name} · ${t.level}级</h3><p>${TERRAIN[t.terrain].name}</p></div><button id="unselect">收起</button></div><p class="tile-description">${b.description}</p><div class="actions"><button id="upgrade" class="primary" ${!cost||state.gold<cost.gold||state.wood<cost.wood?'disabled':''}>${cost?`升级 ${cost.gold}金 ${cost.wood}木`:'已满级'}</button>${t.building!=='hall'?'<button id="demolish">拆除</button>':''}</div>`;
 $('#unselect').onclick=()=>{selectedTile=null;render();};$('#upgrade').onclick=()=>{if(act(R.upgrade,t.x,t.y)){render();notify('建筑升级完成');}};
 if($('#demolish'))$('#demolish').onclick=()=>showDialog(`<h2>拆除${b.name}？</h2><p>土地保留，返还部分金币。</p><button id="confirm-demolish" class="danger">确认拆除</button>`,()=>{$('#confirm-demolish').onclick=()=>{if(act(R.demolish,t.x,t.y)){dialog.close();selectedTile=null;render();}};});paint(inspector);
}
function render(){renderHud();renderMarket();renderPlacement();renderInspector();drawBoard();}
function centerOn(x=6.5,y=6.5,avoidMarket=false){let cy=viewport.clientHeight/2;if(avoidMarket&&!market.hidden&&innerHeight>innerWidth){const top=market.getBoundingClientRect().top;cy=(170+top)/2;}
 viewport.scrollLeft=PAD+x*cell-viewport.clientWidth/2;viewport.scrollTop=PAD+y*cell-cy;}
function chooseTile(x,y){if(blocked)return;if(selection){anchor={x,y};renderPlacement();drawBoard();return;}const t=tileAt(x,y);if(t?.building){marketKind=null;selectedTile={x,y};render();}else if(t)openMarket('building');else if(!state.landBought)openMarket('land');else{selectedTile=null;marketKind=null;render();}}

// Pointer ownership stays on the stable game root while cards disappear during a drag.
function beginOffer(e,el,item){if(blocked||e.button!==0||gesture||el?.disabled)return;e.preventDefault();gesture={kind:'offer',id:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,item:item?{...item}:offerData(el),active:false,lift:e.pointerType==='touch'?cell*1.15:0};game.setPointerCapture(e.pointerId);}
function pointAnchor(){if(!gesture?.active)return;const rect=board.getBoundingClientRect(),cells=cellsForSelection(),w=Math.max(...cells.map(c=>c.x))+1,h=Math.max(...cells.map(c=>c.y))+1;
 anchor={x:Math.floor((gesture.x-rect.x-PAD)/cell-(w-1)/2),y:Math.floor((gesture.y-gesture.lift-rect.y-PAD)/cell-(h-1)/2)};
 drawBoard();const check=placementCheck(),status=$('#drag-status');status.hidden=false;status.classList.toggle('bad',!check.ok);status.textContent=check.ok?'松手放置':check.reason;
}
function edgePan(){if(!gesture?.active)return;const edge=40,speed=5,v=viewport.getBoundingClientRect();const dx=gesture.x<v.left+edge?-speed:gesture.x>v.right-edge?speed:0,dy=gesture.y<v.top+70?-speed:gesture.y>v.bottom-65?speed:0;if(dx||dy){viewport.scrollLeft+=dx;viewport.scrollTop+=dy;pointAnchor();}frame=requestAnimationFrame(edgePan);}
game.addEventListener('pointermove',e=>{if(!gesture||e.pointerId!==gesture.id)return;
 if(gesture.kind==='pan'){const dx=e.clientX-gesture.startX,dy=e.clientY-gesture.startY;if(Math.hypot(dx,dy)>7){gesture.active=true;viewport.classList.add('dragging');}if(gesture.active){viewport.scrollLeft=gesture.left-dx;viewport.scrollTop=gesture.top-dy;}return;}
 gesture.x=e.clientX;gesture.y=e.clientY;
 if(!gesture.active&&Math.hypot(e.clientX-gesture.startX,e.clientY-gesture.startY)>8){gesture.active=true;selection={...gesture.item};selectedTile=null;market.classList.add('lifted');placement.hidden=true;inspector.hidden=true;$('#toast').classList.remove('visible');$('.map-actions').classList.add('hidden-actions');$('#next-turn').disabled=true;frame=requestAnimationFrame(edgePan);}
 if(gesture.active)pointAnchor();
});
function finishGesture(e,cancel=false){if(!gesture||e.pointerId!==gesture.id)return;const g=gesture;cancelAnimationFrame(frame);gesture=null;if(game.hasPointerCapture(e.pointerId))game.releasePointerCapture(e.pointerId);viewport.classList.remove('dragging');$('.map-actions').classList.remove('hidden-actions');$('#drag-status').hidden=true;
 if(g.kind==='pan'){if(!cancel&&!g.active&&g.tile)chooseTile(+g.tile.dataset.x,+g.tile.dataset.y);return;}
 if(cancel){openMarket(g.item.kind);return;}
 if(!g.active){selectForTap(g.item);return;}
 // Releasing over HUD or below the map action line is cancellation, even if the offset preview is legal.
 const overControl=['.hud','#milestone','.map-controls'].some(selector=>{const r=$(selector).getBoundingClientRect();return g.x>=r.left&&g.x<=r.right&&g.y>=r.top&&g.y<=r.bottom;});
 const inside=!overControl&&g.x>=0&&g.x<=innerWidth&&g.y>=105&&g.y<innerHeight-65;
 if(inside&&placementCheck().ok){commitPlacement();}else{const reason=inside?placementCheck().reason:'已放回，未扣款';openMarket(g.item.kind);notify(reason);}
}
game.addEventListener('pointerup',e=>finishGesture(e));game.addEventListener('pointercancel',e=>finishGesture(e,true));
window.addEventListener('blur',()=>{if(gesture)finishGesture({pointerId:gesture.id},true);});
viewport.addEventListener('pointerdown',e=>{if(gesture||e.button!==0||blocked)return;gesture={kind:'pan',id:e.pointerId,startX:e.clientX,startY:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop,active:false,tile:e.target.closest('.tile')};game.setPointerCapture(e.pointerId);});
board.addEventListener('click',e=>{if(e.detail!==0)return;const t=e.target.closest('.tile');if(t)chooseTile(+t.dataset.x,+t.dataset.y);});
board.addEventListener('keydown',e=>{const el=e.target.closest('.tile');if(!el)return;const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(d){e.preventDefault();const x=Math.max(0,Math.min(13,+el.dataset.x+d[0])),y=Math.max(0,Math.min(13,+el.dataset.y+d[1]));tiles.forEach(t=>t.tabIndex=-1);const t=tiles[y*14+x];t.tabIndex=0;t.focus({preventScroll:true});centerOn(x+.5,y+.5);}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!dialog.open){if(gesture)finishGesture({pointerId:gesture.id},true);else if(selection)openMarket(selection.kind);else{marketKind=null;selectedTile=null;render();}}});
$('#open-land').onclick=()=>openMarket('land');$('#open-building').onclick=()=>openMarket('building');$('#center').onclick=()=>centerOn(6.5,6.5,!!marketKind);
function zoom(delta){const x=(viewport.scrollLeft+viewport.clientWidth/2-PAD)/cell,y=(viewport.scrollTop+viewport.clientHeight/2-PAD)/cell;cell=Math.max(44,Math.min(88,cell+delta));board.style.setProperty('--cell',cell+'px');centerOn(x,y);$('#zoom-out').disabled=cell===44;$('#zoom-in').disabled=cell===88;}
$('#zoom-in').onclick=()=>zoom(8);$('#zoom-out').onclick=()=>zoom(-8);
function showDialog(html,bind){dialog.querySelector('.dialog-notice')?.remove();$('#dialog-body').innerHTML=html;$('#close-dialog').textContent='返回地图';if(!dialog.open)dialog.showModal();bind?.();paint(dialog);}
$('#close-dialog').onclick=()=>{if(blocked){notify('请先处理原存档，避免覆盖进度');return;}dialog.close();};dialog.addEventListener('cancel',e=>{if(blocked)e.preventDefault();});
$('#next-turn').onclick=()=>{const before={...state};if(!act(R.nextTurn))return;selectedTile=null;openMarket('land',{center:true});notify(`${seasons[(before.turn-1)%4]}季结算：金币 ${signed(state.gold-before.gold)}，粮食 ${signed(state.food-before.food)}${state.level>before.level?' · 升为'+R.LEVELS[state.level].name:''}`);};
function realm(){const f=R.forecast(state);showDialog(`<h2>${R.LEVELS[state.level].name}</h2><p>${goalText()}</p><div class="realm-stats"><div><strong>${state.population}/${f.capacity}</strong>居民 / 住房</div><div><strong>${state.knowledge}</strong>学识 ${signed(f.knowledge)}</div><div><strong>${state.happiness}</strong>幸福 → ${f.happiness}</div><div><strong>${f.defense}</strong>防务</div></div><div class="policy">${Object.entries(R.POLICIES).map(([id,p])=>`<button data-policy="${id}" class="${state.policy===id?'active':''}" aria-pressed="${state.policy===id}">${p.name}</button>`).join('')}</div><p>${R.POLICIES[state.policy].description}</p><div class="separator"></div><p>${f.effects.map(esc).join('<br>')}</p><ul class="log">${state.log.slice(-4).reverse().map(l=>`<li>${esc(l)}</li>`).join('')}</ul>`,()=>dialog.querySelectorAll('[data-policy]').forEach(b=>b.onclick=()=>{if(act(R.setPolicy,b.dataset.policy)){renderHud();realm();}}));}
$('#milestone').onclick=realm;
function download(text,name){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function replaceCurrent(next){const r=replaceSave(storage,next);if(!r.ok){notify(r.reason);return;}state=next;unsaved=false;selection=null;selectedTile=null;dialog.close();openMarket(state.landBought?'building':'land',{center:true});}
function records(){showDialog(`<h2>王国存档</h2><p>${unsaved?'最近改动未保存，请导出备份后再离开。':'进度自动保存在当前浏览器。更换浏览器前请导出备份。'}</p><div class="save-actions"><button id="export">导出存档</button><button id="import">导入存档</button><button id="restart">新王国</button></div><input type="file" id="file-input" accept=".json,application/json"><div class="separator"></div><p>从三选一卡片拖出土地或建筑，松手放置；不合适的位置会退回，不扣钱。土地可先旋转，地图可单指拖动。</p><p>也可点选卡片后用方向键或点地图选择位置，再确认。点已有建筑可升级和拆除。</p>`,()=>{
 $('#export').onclick=()=>download(JSON.stringify(state,null,2),`拼土王国-第${state.turn}季.json`);$('#import').onclick=()=>$('#file-input').click();
 $('#file-input').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const r=R.validateSave(JSON.parse(await file.text()));if(!r.ok){notify(r.reason);return;}showDialog('<h2>替换当前王国？</h2><p>确认后替换当前进度，并在本浏览器保留替换前备份。</p><button id="confirm-import">确认导入</button>',()=>{$('#confirm-import').onclick=()=>replaceCurrent(r.state);});}catch{notify('文件不是可用存档，原进度保留。');}};
 $('#restart').onclick=()=>showDialog('<h2>开始新王国？</h2><p>当前进度会替换，并保留一份替换前备份。</p><button id="confirm-restart" class="danger">确认开始新王国</button>',()=>{$('#confirm-restart').onclick=()=>replaceCurrent(R.createGame(Date.now()>>>0));});
 });}
$('#records').onclick=records;
const artReport=await loadArt();render();
if(blocked){showDialog(`<h2>原存档暂时无法载入</h2><p>${esc(loaded.reason)}。原件未被覆盖。</p><div class="save-actions"><button id="export-original">导出原件</button><button id="recover-new">备份并建立新王国</button></div>`,()=>{$('#export-original').onclick=()=>{try{download(storage.getItem(SAVE_KEY)||'','拼土王国-原存档.json');}catch{notify('浏览器不允许读取存档');}};$('#recover-new').onclick=()=>{const r=replaceSave(storage,state);if(!r.ok){notify(r.reason);return;}blocked=false;dialog.close();openMarket('land',{center:true});};});}
else{if(!loaded.state)save();openMarket(state.landBought?'building':'land',{center:true});}
new ResizeObserver(()=>{if(!gesture)centerOn(6.5,6.5,!!marketKind);}).observe(viewport);
if(artReport.loaded!==artReport.total)notify('部分游戏图片未能加载，请刷新重试。');

