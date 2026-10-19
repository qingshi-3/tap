import { BattleAudio } from './audio.js';
import { loadArtwork, canvasPoint, canvasPosition, getBattlefieldView, resetBattlefieldView, moveBattlefieldView } from './renderer.js';
import { OF_MAP, OF_TYPES, ofCreateGame, ofCanPlace, ofPlace, ofUpgrade, ofUpgradeCost, ofSell, ofMove, ofBeginWave, ofTick, ofCastSpell, ofWaveInfo, ofRefund } from './openfield.js';
import { ofRender, ofDrawTypePreview } from './openfield-renderer.js';

const ofEl = id => document.getElementById(`of-${id}`);
const OF_UI = Object.fromEntries(['canvas','title','start','record','about','hud','back','lives','gold','wave','scout','speed','pause','banner','roster','spell','cancel','enemy-count','wave-start','menu','menu-name','menu-close','catalog','tabs','cards','menu-note','detail','overlay','dialog-title','dialog-copy','dialog-actions','rotate','toast'].map(id => [id, ofEl(id)]));
const OF_SAVE_KEY = 'castle-ward-h5.openfield.v1';
const ofMixer = new BattleAudio();
let ofArtwork = null;
let ofGame = ofCreateGame();
let ofPlaying = false;
let ofUiGroup = 'front';
let ofUiMenu = null;
let ofUiChoosePlace = false;
let ofUiAnchor = {x:500,y:300};
let ofUiSelected = null;
let ofUiTarget = null;
let ofUiDetailKey = '';
let ofUiPhase = 'deploy';
let ofUiSaved = {schema:1,wins:0,stars:0,bestWave:0};
let ofUiSaveError = null;
let ofUiLastFrame = 0;
let ofUiClock = 0;
let ofUiToastTimer = null;
let ofUiBannerTimer = null;
let ofUiDialogReturn = null;
let ofUiRotatedPause = false;
let ofUiGhost = null;
let ofUiKeyboardPoint = {x:550,y:300};
const OF_UI_POINTERS = new Map();
let ofUiGesture = false;

function ofUiLoad() {
  try {
    const raw = localStorage.getItem(OF_SAVE_KEY);
    if (raw === null) return;
    const value = JSON.parse(raw);
    if (value.schema !== 1 || !Number.isInteger(value.wins) || value.wins < 0 || !Number.isInteger(value.stars) || value.stars < 0 || value.stars > 3 || !Number.isInteger(value.bestWave) || value.bestWave < 0 || value.bestWave > ofGame.maxWaves) throw Error('invalid');
    ofUiSaved = value;
  } catch {
    ofUiSaveError = '现有林地进度无法读取，原数据已保留。本次仍可游玩，但不会覆盖原进度。';
  }
}
function ofUiSave(won) {
  ofUiSaved.bestWave = Math.max(ofUiSaved.bestWave, ofGame.wave);
  if (won) {
    ofUiSaved.wins++;
    ofUiSaved.stars = Math.max(ofUiSaved.stars, ofGame.lives >= 18 ? 3 : ofGame.lives >= 6 ? 2 : 1);
  }
  if (ofUiSaveError) return;
  try { localStorage.setItem(OF_SAVE_KEY, JSON.stringify(ofUiSaved)); }
  catch { ofUiSaveError = '浏览器未能保存本次进度。'; ofUiToast(ofUiSaveError); }
}
function ofUiToast(message) {
  OF_UI.toast.textContent = message;
  OF_UI.toast.classList.add('of-visible');
  clearTimeout(ofUiToastTimer);
  ofUiToastTimer = setTimeout(() => OF_UI.toast.classList.remove('of-visible'), 2600);
}
function ofUiBanner(message) {
  OF_UI.banner.textContent = message;
  clearTimeout(ofUiBannerTimer);
  ofUiBannerTimer = setTimeout(() => OF_UI.banner.textContent = '', 3200);
}
function ofUiPlanPhase() { return ['deploy','intermission'].includes(ofGame.phase); }
function ofUiType(unit) { return typeof unit.type === 'string' ? OF_TYPES[unit.type] : unit.type; }
function ofUiCloseMenu() {
  ofUiMenu = null; ofUiSelected = null; ofUiGhost = null; ofUiDetailKey = '';
  OF_UI.menu.hidden = true;
}
function ofUiCancelTarget() { ofUiTarget = null; ofUiGhost = null; }
function ofUiResetPointers() {
  for (const id of OF_UI_POINTERS.keys()) if (OF_UI.canvas.hasPointerCapture(id)) OF_UI.canvas.releasePointerCapture(id);
  OF_UI_POINTERS.clear(); ofUiGesture = false;
}
function ofUiDialog(title, copy, actions) {
  ofUiResetPointers(); ofUiCancelTarget(); ofUiCloseMenu(); ofMixer.stop();
  ofUiDialogReturn = document.activeElement;
  OF_UI['dialog-title'].textContent = title;
  OF_UI['dialog-copy'].textContent = copy;
  OF_UI['dialog-actions'].replaceChildren();
  for (const [index, action] of actions.entries()) {
    const button = document.createElement('button');
    button.className = index === 0 ? 'of-primary' : 'of-small';
    button.textContent = action.label;
    button.addEventListener('click', () => { ofUiHideDialog(); action.run(); });
    OF_UI['dialog-actions'].append(button);
  }
  OF_UI.overlay.hidden = false;
  OF_UI['dialog-actions'].querySelector('button')?.focus({preventScroll:true});
  ofUiSync();
}
function ofUiHideDialog() {
  OF_UI.overlay.hidden = true;
  if (ofUiDialogReturn?.isConnected && !ofUiDialogReturn.closest('[hidden]')) ofUiDialogReturn.focus({preventScroll:true});
}
function ofUiPause() {
  if (!ofPlaying || ['victory','defeat'].includes(ofGame.phase)) return;
  ofGame.paused = true;
  ofUiDialog('暂歇片刻', '调整部署放在波次之间。战斗时，士兵会自动迎敌、施法和归位。', [
    {label:'继续守卫',run:()=>{ofGame.paused=false;ofUiSync();}},
    {label:ofMixer.enabled?'关闭音效':'开启音效',run:()=>{ofMixer.toggle();ofUiPause();}}
  ]);
}
function ofUiStart() {
  ofGame = ofCreateGame(); ofPlaying = true; ofUiPhase = ofGame.phase;
  ofUiCloseMenu(); ofUiCancelTarget(); ofUiResetPointers(); ofUiHideDialog();
  resetBattlefieldView(OF_UI.canvas);
  OF_UI.title.hidden = true; OF_UI.hud.hidden = false;
  ofMixer.unlock(); ofUiBanner('点空地部署士兵与塔楼，准备好后迎战');
  ofUiSync(); ofUiOrientation();
  if (ofUiSaveError) ofUiToast(ofUiSaveError);
}
function ofUiHome() {
  ofMixer.stop(); ofPlaying=false; ofGame=ofCreateGame();
  ofUiCloseMenu(); ofUiCancelTarget(); ofUiResetPointers();
  OF_UI.hud.hidden=true; OF_UI.title.hidden=false;
  OF_UI.record.textContent=ofUiSaved.wins ? `守卫成功 ${ofUiSaved.wins} 次 · 最佳 ${'★'.repeat(ofUiSaved.stars)}` : '12 种士兵 · 4 类塔楼 · 林地守卫战';
  resetBattlefieldView(OF_UI.canvas); ofUiOrientation();
}
function ofUiInfo() {
  const wasPaused=ofGame.paused; ofGame.paused=true;
  ofUiDialog('布阵，然后迎战', '点空地选择士兵或塔楼。盾卫守住通道，远程与塔楼覆盖后方，医师和唤灵师自动支援。\n每波结束可重新部署士兵、升级塔楼。树石和塔楼影响敌军绕行，不能封死通路。\n双指缩放，放大后单指拖动。火雨仅作救场，日常防守自动执行。\n进度只保存在本机；无账号、广告、支付或数据上传。', [{label:'明白了',run:()=>{ofGame.paused=wasPaused;ofUiSync();}}]);
}
function ofUiScout() {
  const wasPaused=ofGame.paused; ofGame.paused=true;
  const info=ofWaveInfo(ofGame);
  ofUiDialog(ofGame.phase==='combat'?'战斗进行中':`第 ${info.number} 波进攻`, ofGame.phase==='combat' ? '部队会自动接敌。下一次调整部署将在本波结束后开放。' : info.groups.map(g=>`${g.name}：${g.enemy ?? g.type} × ${g.count}`).join('\n'), [{label:'返回战场',run:()=>{ofGame.paused=wasPaused;ofUiSync();}}]);
}
function ofUiCatalog() {
  OF_UI.cards.replaceChildren();
  const types=Object.values(OF_TYPES).filter(t=>t.group===ofUiGroup);
  for (const type of types) {
    const button=document.createElement('button'); button.className='of-card'; button.dataset.ofType=type.id;
    button.setAttribute('aria-label',`${type.name}，${type.cost} 金，${type.description}`);
    button.title=`${type.role}：${type.description}`;
    const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');
    const name=document.createElement('strong');name.textContent=type.name;
    const price=document.createElement('span');price.className='of-price';price.textContent=String(type.cost);
    button.append(canvas,name,price); OF_UI.cards.append(button);
    ofDrawTypePreview(canvas,ofArtwork,type.id);
    button.disabled=ofGame.gold<type.cost || !ofUiPlanPhase();
    // A drag to another card, or a canvas tap that opens the menu, cannot buy a unit.
    let press=null;
    button.addEventListener('pointerdown',e=>{press={id:e.pointerId,x:e.clientX,y:e.clientY,scroll:OF_UI.cards.scrollLeft};});
    button.addEventListener('pointercancel',()=>{press=null;});
    button.addEventListener('click',e=>{
      if(e.detail!==0 && (!press || Math.hypot(e.clientX-press.x,e.clientY-press.y)>8 || Math.abs(OF_UI.cards.scrollLeft-press.scroll)>5)){press=null;return;}
      press=null;
      if(ofUiMenu!=='build')return;
      if(ofUiChoosePlace){ofUiCloseMenu();ofUiTarget={kind:'place',type:type.id};ofUiBanner(`点空地部署${type.name}`);ofUiSync();return;}
      const result=ofPlace(ofGame,type.id,ofUiAnchor.x,ofUiAnchor.y);
      if(!result.ok){ofUiGhost={...ofUiAnchor,valid:false};ofUiToast(result.message);return;}
      ofMixer.play('build');ofUiCloseMenu();ofUiSync();
    });
  }
  OF_UI.cards.scrollLeft=0;
  for(const tab of OF_UI.tabs.querySelectorAll('button'))tab.setAttribute('aria-selected',String(tab.dataset.ofGroup===ofUiGroup));
  OF_UI['menu-note'].textContent=types.length>4 ? `${types.length} 种可选 · 左右滑动查看` : ofUiChoosePlace?'先选兵种，再点空地部署':'选择一位，部署到标记处';
}
function ofUiPositionMenu() {
  if(!ofUiMenu)return;
  const style=getComputedStyle(document.documentElement);
  // Computed custom max()/env() values aren't reliably numeric; resolve via real HUD bounds.
  const left=Math.max(72,OF_UI.back.getBoundingClientRect().left);
  const right=Math.max(72,innerWidth-OF_UI['wave-start'].getBoundingClientRect().right);
  const width=OF_UI.menu.offsetWidth,height=OF_UI.menu.offsetHeight;
  const pos=canvasPosition(OF_UI.canvas,ofUiAnchor.x,ofUiAnchor.y);
  let x=pos.clientX+34,y=pos.clientY-height/2;
  if(x+width>innerWidth-right)x=pos.clientX-width-34;
  x=Math.max(left,Math.min(innerWidth-right-width,x));
  y=Math.max(82,Math.min(innerHeight-height-12,y));
  // On the shortest screens, allow the panel to use the gap above the bottom controls.
  if(y+height>innerHeight-8)y=Math.max(58,innerHeight-height-8);
  OF_UI.menu.style.left=`${x}px`;OF_UI.menu.style.top=`${y}px`;
}
function ofUiOpenBuild(point,choosePlace=false) {
  if(!ofUiPlanPhase()){ofUiToast('本波结束后可以调整部署');return;}
  ofUiCancelTarget();ofUiChoosePlace=choosePlace;ofUiSelected=null;ofUiAnchor={x:point.x,y:point.y};
  ofUiMenu='build';ofUiGhost={...ofUiAnchor,valid:true};
  OF_UI.menu.hidden=false;OF_UI.menu.classList.remove('of-unit-menu');
  OF_UI.catalog.hidden=false;OF_UI.detail.hidden=true;OF_UI['menu-name'].textContent='部署防线';
  ofUiCatalog();ofUiSync();ofUiPositionMenu();
}
function ofUiOpenUnit(unit) {
  ofUiCancelTarget();ofUiSelected=unit.id;ofUiMenu='unit';ofUiAnchor={x:unit.x,y:unit.y};
  ofUiDetailKey='';OF_UI.menu.hidden=false;OF_UI.menu.classList.add('of-unit-menu');
  OF_UI.catalog.hidden=true;OF_UI.detail.hidden=false;
  ofUiSync();ofUiPositionMenu();
}
function ofUiDetail() {
  const unit=ofGame.units.find(u=>u.id===ofUiSelected);
  if(!unit){ofUiCloseMenu();return;}
  const type=ofUiType(unit),cost=ofUpgradeCost(unit),plan=ofUiPlanPhase();
  const key=[unit.id,unit.level,ofGame.gold,ofGame.phase,Math.ceil(unit.hp),Math.ceil(unit.deadLeft||0)].join(':');
  if(key===ofUiDetailKey)return;ofUiDetailKey=key;
  const focused=OF_UI.detail.querySelector(':focus')?.dataset.ofAction;
  OF_UI['menu-name'].textContent=`${type.name}${type.category==='tower'?' '+'★'.repeat(unit.level):''}`;
  OF_UI.detail.replaceChildren();
  const info=document.createElement('div');info.className='of-unit-info';
  const role=document.createElement('div');role.className='of-role';role.textContent=type.description;
  const health=document.createElement('div');health.textContent=unit.deadLeft>0 ? `${Math.ceil(unit.deadLeft)} 秒后归队` : `${Math.ceil(unit.hp)} / ${Math.ceil(unit.maxHp)} 生命`;
  const bar=document.createElement('div');bar.className='of-health';const fill=document.createElement('i');fill.style.width=`${100*Math.max(0,unit.hp/unit.maxHp)}%`;bar.append(fill);info.append(role,health,bar);OF_UI.detail.append(info);
  if(unit.ownerId||unit.temporary){const p=document.createElement('p');p.textContent='自动作战的协防部队';OF_UI.detail.append(p);return;}
  const actions=document.createElement('div');actions.className='of-unit-actions';
  const add=(id,label,icon,sub,enabled,run)=>{
    const b=document.createElement('button');b.dataset.ofAction=id;b.disabled=!enabled;
    const img=document.createElement('img');img.src=`./assets/ui/action/${icon}.png`;img.alt='';
    const s=document.createElement('span');s.textContent=label;const small=document.createElement('small');small.textContent=sub;
    b.append(img,s,small);b.addEventListener('click',run);actions.append(b);
  };
  if(type.category==='tower')add('upgrade',cost?'升级':'满级',cost?'upgrade':'max-level',cost?`${cost} 金`:'',plan&&cost>0&&ofGame.gold>=cost,()=>{const result=ofUpgrade(ofGame,unit.id);if(!result.ok)ofUiToast(result.message);else ofMixer.play('upgrade');ofUiSync();});
  else add('move','换位','rally','波前免费',plan,()=>{ofUiCloseMenu();ofUiTarget={kind:'move',id:unit.id};ofUiBanner('点空地，调整驻守位置');ofUiSync();});
  add('sell',type.category==='tower'?'拆除':'撤回','demolish',`+${ofRefund(ofGame,unit)} 金`,plan,()=>{const result=ofSell(ofGame,unit.id);if(!result.ok)ofUiToast(result.message);else{ofUiCloseMenu();ofMixer.play('build');}ofUiSync();});
  OF_UI.detail.append(actions);
  if(!plan){const p=document.createElement('p');p.textContent='本波结束后可调整';OF_UI.detail.append(p);}
  if(focused)OF_UI.detail.querySelector(`[data-of-action="${focused}"]:not(:disabled)`)?.focus({preventScroll:true});
}
function ofUiSync() {
  if(!ofPlaying)return;
  OF_UI.lives.textContent=String(ofGame.lives);OF_UI.gold.textContent=String(ofGame.gold);
  OF_UI.wave.textContent=ofGame.phase==='combat'?`第 ${ofGame.wave+1} / ${ofGame.maxWaves} 波`:`${ofGame.wave} / ${ofGame.maxWaves} 波`;
  OF_UI.speed.querySelector('small').textContent=`${ofGame.speed}×`;
  OF_UI.speed.setAttribute('aria-label',`当前 ${ofGame.speed} 倍速，点击切换`);
  OF_UI['wave-start'].hidden=!ofUiPlanPhase();
  OF_UI['wave-start'].disabled=ofGame.paused;
  OF_UI['wave-start'].innerHTML=`<img src="./assets/ui/action/play.png" alt="">迎战 · 第 ${ofGame.wave+1} 波`;
  OF_UI['enemy-count'].textContent=ofGame.phase==='combat'?`余敌 ${ofGame.enemies.filter(e=>!e.dead).length+(ofGame.spawnQueue?.length??0)}`:'';
  OF_UI.roster.disabled=!ofUiPlanPhase()||ofGame.paused;
  OF_UI.roster.hidden=Boolean(ofUiMenu);
  OF_UI.spell.hidden=Boolean(ofUiMenu)||ofUiPlanPhase();
  OF_UI.spell.disabled=ofGame.phase!=='combat'||ofGame.spellCooldown>0||ofGame.paused;
  OF_UI.spell.querySelector('small').textContent=ofGame.spellCooldown>0?`${Math.ceil(ofGame.spellCooldown)}s`:'火雨';
  OF_UI.spell.setAttribute('aria-pressed',String(ofUiTarget?.kind==='spell'));
  OF_UI.cancel.hidden=!ofUiTarget;OF_UI.cancel.textContent='取消';
  if(ofUiMenu==='unit')ofUiDetail();
  if(ofUiMenu==='build')for(const card of OF_UI.cards.children)card.disabled=ofGame.gold<OF_TYPES[card.dataset.ofType].cost||!ofUiPlanPhase();
}
function ofUiMapTap(clientX,clientY) {
  const point=canvasPoint(OF_UI.canvas,clientX,clientY);
  if(point.x<0||point.y<0||point.x>OF_MAP.width||point.y>OF_MAP.height)return;
  if(ofUiTarget){
    const result=ofUiTarget.kind==='spell'?ofCastSpell(ofGame,point.x,point.y):ofUiTarget.kind==='place'?ofPlace(ofGame,ofUiTarget.type,point.x,point.y):ofMove(ofGame,ofUiTarget.id,point.x,point.y);
    if(result.ok){ofUiCancelTarget();ofMixer.play('build');}else{ofUiToast(result.message);ofUiGhost={...point,valid:false};}
    ofUiSync();return;
  }
  const hit=ofGame.units.filter(u=>!u.ownerId&&!u.temporary).map(u=>({u,d:Math.hypot(point.x-u.x,point.y-u.y+16)})).filter(v=>v.d<Math.max(28,23/point.scale)).sort((a,b)=>a.d-b.d)[0];
  if(hit){ofUiOpenUnit(hit.u);return;}
  if(ofUiMenu){ofUiCloseMenu();ofUiSync();return;}
  if(ofUiPlanPhase())ofUiOpenBuild(point);
}
function ofUiInputAllowed(){return ofPlaying&&!ofGame.paused&&OF_UI.overlay.hidden&&OF_UI.rotate.hidden&&!['victory','defeat'].includes(ofGame.phase);}
function ofUiGestureStart(){if(ofUiGesture)return;ofUiGesture=true;ofUiCancelTarget();ofUiCloseMenu();ofUiSync();}
function ofUiPinch(){const p=[...OF_UI_POINTERS.values()];return p.length<2?null:{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2,d:Math.max(1,Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y))};}
OF_UI.canvas.addEventListener('pointerdown',e=>{
  if(!ofUiInputAllowed()||(e.pointerType==='mouse'&&e.button!==0))return;
  e.preventDefault();ofMixer.unlock();if(!OF_UI_POINTERS.size)ofUiGesture=false;
  OF_UI_POINTERS.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY});OF_UI.canvas.setPointerCapture(e.pointerId);
  if(OF_UI_POINTERS.size>1)ofUiGestureStart();
});
OF_UI.canvas.addEventListener('pointermove',e=>{
  const p=OF_UI_POINTERS.get(e.pointerId);if(!p)return;e.preventDefault();
  if(!ofUiInputAllowed()){ofUiResetPointers();return;}
  const before=ofUiPinch(),x=p.x,y=p.y;p.x=e.clientX;p.y=e.clientY;
  if(before){const after=ofUiPinch();moveBattlefieldView(OF_UI.canvas,before.x,before.y,after.x,after.y,after.d/before.d);return;}
  if(Math.hypot(p.x-p.sx,p.y-p.sy)>8)ofUiGestureStart();
  if(ofUiGesture&&getBattlefieldView(OF_UI.canvas).zoom>1)moveBattlefieldView(OF_UI.canvas,x,y,p.x,p.y);
});
OF_UI.canvas.addEventListener('pointerup',e=>{
  const p=OF_UI_POINTERS.get(e.pointerId);if(!p)return;e.preventDefault();
  const tap=!ofUiGesture&&OF_UI_POINTERS.size===1&&Math.hypot(p.sx-e.clientX,p.sy-e.clientY)<=8&&ofUiInputAllowed();
  OF_UI_POINTERS.delete(e.pointerId);if(OF_UI.canvas.hasPointerCapture(e.pointerId))OF_UI.canvas.releasePointerCapture(e.pointerId);
  if(tap)ofUiMapTap(e.clientX,e.clientY);
});
OF_UI.canvas.addEventListener('pointercancel',ofUiResetPointers);
let ofUiMenuPress = null;
OF_UI.menu.addEventListener('pointerdown',e=>{ofUiMenuPress={button:e.target.closest('button'),x:e.clientX,y:e.clientY};},true);
OF_UI.menu.addEventListener('click',e=>{
  const button=e.target.closest('button');
  if(e.detail!==0&&(!ofUiMenuPress||ofUiMenuPress.button!==button||Math.hypot(e.clientX-ofUiMenuPress.x,e.clientY-ofUiMenuPress.y)>8)){
    e.preventDefault();e.stopImmediatePropagation();
  }
  ofUiMenuPress=null;
},true);
OF_UI.canvas.addEventListener('keydown',e=>{
  if(!ofUiInputAllowed())return;
  const vectors={ArrowLeft:[-32,0],ArrowRight:[32,0],ArrowUp:[0,-32],ArrowDown:[0,32]};
  if(vectors[e.key]){e.preventDefault();ofUiKeyboardPoint.x=Math.max(160,Math.min(900,ofUiKeyboardPoint.x+vectors[e.key][0]));ofUiKeyboardPoint.y=Math.max(130,Math.min(480,ofUiKeyboardPoint.y+vectors[e.key][1]));ofUiGhost={...ofUiKeyboardPoint,valid:true};}
  if(e.key==='Enter'||e.key===' '){e.preventDefault();const p=canvasPosition(OF_UI.canvas,ofUiKeyboardPoint.x,ofUiKeyboardPoint.y);ofUiMapTap(p.clientX,p.clientY);if(ofUiMenu)OF_UI.tabs.querySelector('button')?.focus();}
});
document.addEventListener('keydown',e=>{
  if(!OF_UI.overlay.hidden&&e.key==='Tab'){
    const buttons=[...OF_UI['dialog-actions'].querySelectorAll('button')];
    if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1)?.focus();}
    else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0]?.focus();}
  }
  if(e.key!=='Escape')return;
  if(!OF_UI.overlay.hidden)return;
  if(ofUiMenu){ofUiCloseMenu();ofUiSync();}
  else if(ofUiTarget){ofUiCancelTarget();ofUiSync();}
  else ofUiPause();
});
for(const tab of OF_UI.tabs.querySelectorAll('button'))tab.addEventListener('click',()=>{ofUiGroup=tab.dataset.ofGroup;ofUiCatalog();ofUiPositionMenu();});
OF_UI['menu-close'].addEventListener('click',()=>{ofUiCloseMenu();ofUiSync();});
OF_UI.cancel.addEventListener('click',()=>{ofUiCancelTarget();ofUiSync();});
OF_UI.start.addEventListener('click',ofUiStart);OF_UI.about.addEventListener('click',ofUiInfo);
OF_UI.pause.addEventListener('click',ofUiPause);OF_UI.scout.addEventListener('click',ofUiScout);
OF_UI.speed.addEventListener('click',()=>{ofGame.speed=ofGame.speed===1?1.6:1;ofUiSync();});
OF_UI.back.addEventListener('click',()=>{const paused=ofGame.paused;ofGame.paused=true;ofUiDialog('返回营地？','本次尚未完成的布防不会保留。已获得的通关记录不受影响。',[{label:'继续守卫',run:()=>{ofGame.paused=paused;ofUiSync();}},{label:'返回营地',run:ofUiHome}]);});
OF_UI.roster.addEventListener('click',()=>{ofUiOpenBuild({x:550,y:310},true);});
OF_UI.spell.addEventListener('click',()=>{if(ofGame.phase!=='combat'||ofGame.spellCooldown>0)return;ofUiCloseMenu();ofUiTarget={kind:'spell'};ofUiBanner('点敌群施放火雨');ofUiSync();});
OF_UI['wave-start'].addEventListener('click',()=>{ofUiCloseMenu();ofUiCancelTarget();const result=ofBeginWave(ofGame);if(result?.ok===false)ofUiToast(result.message);else{ofMixer.unlock();ofMixer.play('wave');ofUiBanner(`第 ${ofGame.wave+1} 波 · 守住核心`);}ofUiSync();});
function ofUiOrientation(){
  const portrait=innerHeight>innerWidth;
  OF_UI.rotate.hidden=!portrait;
  if(portrait&&ofPlaying&&!ofUiRotatedPause){ofUiRotatedPause=!ofGame.paused;ofGame.paused=true;ofMixer.stop();ofUiResetPointers();ofUiCancelTarget();}
  else if(!portrait&&ofUiRotatedPause){ofGame.paused=false;ofUiRotatedPause=false;}
  ofUiPositionMenu();ofUiSync();
}
window.addEventListener('resize',()=>{ofUiResetPointers();ofUiCancelTarget();ofUiOrientation();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&ofPlaying&&OF_UI.overlay.hidden){ofUiPause();}});
function ofUiTerminal(){
  if(ofGame.phase===ofUiPhase)return;ofUiPhase=ofGame.phase;
  if(ofGame.phase==='intermission'){ofUiBanner('这一波守住了 · 可以调整部署');ofUiCloseMenu();}
  if(!['victory','defeat'].includes(ofGame.phase))return;
  const won=ofGame.phase==='victory';ofUiSave(won);
  ofUiDialog(won?'林地守住了！':'防线被突破了',won?`${'★'.repeat(ofGame.lives>=18?3:ofGame.lives>=6?2:1)}\n${ofGame.maxWaves} 波进攻已击退，核心剩余 ${ofGame.lives} 点耐久。`:`守到第 ${Math.min(ofGame.wave+1,ofGame.maxWaves)} 波。试着让士兵拦在通道处，塔楼覆盖它们的交战位置。`,[{label:'重新布防',run:ofUiStart},{label:'返回营地',run:ofUiHome}]);
}
function ofUiFrame(ms){
  const dt=Math.min(.05,Math.max(0,(ms-ofUiLastFrame)/1000));ofUiLastFrame=ms;
  if(ofPlaying&&OF_UI.overlay.hidden&&OF_UI.rotate.hidden){ofTick(ofGame,dt);ofUiTerminal();}
  if(!ofGame.paused&&ofPlaying)for(const event of ofGame.audioEvents.splice(0))ofMixer.play(event.key);
  else ofGame.audioEvents.length=0;
  ofRender(OF_UI.canvas,ofArtwork,ofGame,{selectedId:ofUiSelected,placement:ofUiGhost,showRoutes:ofPlaying&&ofUiPlanPhase(),targeting:ofUiTarget?.kind??null},ms/1000);
  ofUiClock+=dt;if(ofUiClock>.15){ofUiClock=0;ofUiSync();}
  requestAnimationFrame(ofUiFrame);
}
async function ofUiInit(){
  ofUiLoad();ofUiHome();ofUiOrientation();requestAnimationFrame(ofUiFrame);
  try {ofArtwork=await loadArtwork();ofMixer.configure(ofArtwork.manifest.duelyst?.sounds??ofArtwork.manifest.duelyst?.audio);if(ofArtwork.loaded!==ofArtwork.total)ofUiToast('部分美术未载入，请刷新重试');}
  catch {ofUiToast('素材加载失败，请检查网络后刷新');}
  OF_UI.start.disabled=false;OF_UI.start.textContent='部署防线';
}
ofUiInit();
