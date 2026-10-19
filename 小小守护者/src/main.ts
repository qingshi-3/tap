import './style.css';
import { installArtwork, product, portrait, icon } from './ui/artwork';
import { installTouchButtonFallback } from './ui/touch-buttons';
installTouchButtonFallback();
import { shouldDrop } from './ui/drag-release';
import { ReplayPlayer } from './replay-player';
import { applyAction, createGame, step, getWavePreview, getUnitStats, LEGION_DEFS, BUILDING_DEFS, CARD_DEFS, SPELL_DEFS, ENEMY_DEFS, HERO_DEFS, getShopTier, getMapDefinition, validatePlacement, validateBuildingPlacement } from './core/index';
import type { Action, BuildingKind, CardKind, GameState, HeroKind, LegionKind, Point, SpellKind } from './core/types';
import type { AssetManifest } from './assets-types';
import { BattleRenderer } from './render/battle';
import { GameAudio } from './ui/audio';
import { initPlatform, readSafeInsets, startupReady } from './platform';
import { loadRun, saveRun, startFreshRun, exportReplay } from './storage';
import { loadSettings, saveSettings } from './settings';
import { getProfile, observeRun, recordOutcome, ACHIEVEMENTS } from './profile';

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const dialog=(id:string)=>$<HTMLDialogElement>(id);
const button=(id:string)=>$<HTMLButtonElement>(id);
type Tool=LegionKind|BuildingKind|HeroKind|'move'|'moveBuilding'|'heal'|'freeze';
const names:Record<string,string>={shield:'盾卫',archer:'弓手',wall:'城墙',tower:'箭塔',slow:'减速地面',engineer:'工程师',heal:'治疗',freeze:'定身',grunt:'掠夺者',siege:'攻城弩',flyer:'鸦骑',boss:'碎地者'};
for(const defs of [LEGION_DEFS,BUILDING_DEFS,HERO_DEFS,SPELL_DEFS])for(const [kind,def]of Object.entries(defs))if(def)names[kind]=def.name;
const cards:Record<CardKind,string>={giant:'生命 +60%，攻击 +35%。军团覆灭时消失。',deathBurst:'阵亡成员造成范围爆炸。军团覆灭时消失。',sharp:'攻击 +15%。团灭后可重新指派。',bounty:'击杀额外获得 2 金。团灭后可重新指派。'};
let state:GameState=createGame(20261013),renderer:BattleRenderer|null=null,ready=false,active=false,paused=false;
let selected:number|null=null,tool:Tool|null=null,point:Point|null=null,validPoint=false;
let reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,previous=0,accumulator=0,noticeTimer=0;
let replayViewing=false,lastSound=0;let replayPlayer:ReplayPlayer|null=null;
const observedEnemyKinds=new Set(getProfile().discovered);
let blockedSave=false,checkPointMessage='',confirmation:(()=>void)|null=null;
const audio=new GameAudio();
const preferences=loadSettings(reduced);audio.muted=preferences.settings.muted;reduced=preferences.settings.reducedMotion;
function savePreferences(){const result=saveSettings({version:1,muted:audio.muted,reducedMotion:reduced});if(!result.ok)notify(result.message||'设置未能保存。',true)}
button('mute').textContent='音效：'+(audio.muted?'关':'开');button('mute').setAttribute('aria-pressed',String(audio.muted));button('motion').textContent='动效：'+(reduced?'减弱':'开');button('motion').setAttribute('aria-pressed',String(reduced));document.body.classList.toggle('reduce-motion',reduced);
const safeInsets=()=>{const s=readSafeInsets();for(const side of ['top','right','bottom','left'] as const)document.documentElement.style.setProperty('--host-'+side,Math.max(0,s[side])+'px');renderer?.setInsets(s)};
const pauseGame=()=>{if(!active)return;paused=true;accumulator=0;previous=0;cancelGesture();audio.pause();if(!dialog('pause').open&&!dialog('result').open)dialog('pause').showModal()};
initPlatform(pauseGame);safeInsets();
addEventListener('resize',()=>{safeInsets();renderer?.resize();context()});
addEventListener('orientationchange',()=>{safeInsets();cancelGesture();renderer?.resize()});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame()});
addEventListener('blur',()=>{if(active&&state.phase==='combat')pauseGame()});
document.addEventListener('pointerdown',()=>audio.unlock(),{once:true});

function notify(message:string,error=false){$('notice').textContent=message;$('notice').classList.toggle('error',error);$('notice').classList.add('visible');clearTimeout(noticeTimer);noticeTimer=window.setTimeout(()=>$('notice').classList.remove('visible'),3000);audio.play(error?'error':'confirm')}
function confirm(title:string,copy:string,run:()=>void){$('confirm-title').textContent=title;$('confirm-copy').textContent=copy;confirmation=run;dialog('confirm').showModal()}
function persist(){if(replayViewing)return;const observed=observeRun(state);if(observed&&!observed.ok)notify(observed.message||'图鉴档案保存失败，原档已保留。',true);const result=saveRun(state);if(!result.ok){checkPointMessage=result.message||'本机保存失败，旧进度已保留。';notify(checkPointMessage,true)}}
function act(action:Action){if(replayViewing){notify('回放只供观看，请从菜单继续营地。');return false}const result=applyAction(state,action);if(!result.ok){notify(result.message||'当前无法操作',true);return false}persist();refresh();return true}
function reset(seed:number){try{state=startFreshRun(seed);blockedSave=false;replayViewing=false;selected=null;tool=null;point=null;active=true;paused=false;accumulator=0;previous=0;closeAll();renderer?.focusCamp(state);persist();refresh();audio.play('confirm')}catch(e){notify(e instanceof Error?e.message:'新局未能建立，旧进度已保留。',true)}}
function closeAll(){for(const d of document.querySelectorAll<HTMLDialogElement>('dialog'))if(d.open)d.close()}
function currentWave(){return Math.min(7,state.phase==='combat'||state.phase==='won'||state.phase==='lost'?state.wave:state.wave+1)}
function select(id:number|null){selected=id;tool=null;point=null;renderer?.select(id);renderer?.place(null);refresh()}
function cancelTool(){tool=null;point=null;renderer?.place(null);$('placement').hidden=true;refresh()}
function spellTool(){return tool==='heal'||tool==='freeze'}
function chooseTool(kind:Tool){if((kind==='heal'||kind==='freeze')?state.phase!=='combat':state.phase!=='prep')return;tool=kind;point=kind==='freeze'?{...state.map.core}:null;validPoint=kind==='freeze';renderer?.place(null);dialog('shop').close();$('context').hidden=true;$('placement').hidden=!spellTool();$('placement-label').textContent=kind==='freeze'?'全场敌军定身':'治疗：点选范围';button('confirm-placement').disabled=kind!=='freeze';refresh()}
function placementInfo(){const legion=tool==='move'?state.legions.find(l=>l.id===selected):null;const building=tool==='moveBuilding'?state.buildings.find(b=>b.id===selected):null;const kind=legion?.kind||building?.kind||tool||'';const tier=legion?.tier??1;const radius=legion?.alertRadius??(Object.hasOwn(LEGION_DEFS,kind)?Math.max(6,getUnitStats(kind as LegionKind,tier).range):Object.hasOwn(BUILDING_DEFS,kind)?BUILDING_DEFS[kind as BuildingKind].range:Object.hasOwn(HERO_DEFS,kind)?HERO_DEFS[kind as HeroKind]!.aura.radius:tool==='heal'?SPELL_DEFS.heal.radius:0);return {kind,tier,radius,legion,building}}
function legal(p:Point){
 if(spellTool())return p.x>=0&&p.y>=0&&p.x<state.map.width&&p.y<state.map.height;
 const info=placementInfo();const legionKind=Object.hasOwn(LEGION_DEFS,info.kind)?info.kind as LegionKind:undefined;
 if(Object.hasOwn(BUILDING_DEFS,info.kind))return validateBuildingPlacement(state,p,info.building?.id);
 const candidate=p;
 return validatePlacement(state,candidate,legionKind,info.tier)&&!state.buildings.some(b=>b.id!==info.building?.id&&Math.floor(b.x)===p.x&&Math.floor(b.y)===p.y);
}
function updatePoint(p:Point,usable=true){point={x:Math.floor(p.x),y:Math.floor(p.y)};validPoint=usable&&legal(point);const info=placementInfo();const preview=Object.hasOwn(BUILDING_DEFS,info.kind)?{x:point.x+.5,y:point.y+.5}:point;renderer?.place(tool==='freeze'?null:preview,validPoint,info.radius,spellTool()?undefined:info.kind,info.tier);button('confirm-placement').disabled=!validPoint;if(spellTool())$('placement-label').textContent=tool==='freeze'?'全场敌军定身':validPoint?'治疗范围':'不能施放于此处'}

function commitPoint(){if(!point||!tool||!validPoint)return;const p=point;let action:Action;
 if(tool==='move'){if(selected===null)return;action={type:'moveLegion',id:selected,...p}}
 else if(tool==='moveBuilding'){if(selected===null)return;action={type:'moveBuilding',id:selected,...p}}
 else if(tool==='heal'||tool==='freeze')action={type:'castSpell',kind:tool,...p};
 else if(Object.hasOwn(HERO_DEFS,tool))action={type:'buyHero',kind:tool as HeroKind,...p};
 else if(tool==='shield'||tool==='archer'||tool==='mage'||tool==='spear'||tool==='rider')action={type:'buyLegion',kind:tool,...p};
 else action={type:'buyBuilding',kind:tool as BuildingKind,...p};
 if(act(action)){cancelTool();if(action.type==='buyLegion')select(state.legions.at(-1)?.id??null);if(action.type==='buyBuilding')select(state.buildings.at(-1)?.id??null)}else if(state.phase==='prep')cancelTool()
}
button('confirm-placement').onclick=commitPoint;button('cancel-placement').onclick=cancelTool;
document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(b=>b.onclick=()=>notify('按住'+(names[b.dataset.tool!]||'对象')+'拖入战场'));
document.querySelectorAll<HTMLButtonElement>('[data-spell]').forEach(b=>b.onclick=()=>chooseTool(b.dataset.spell as SpellKind));
button('settings').onclick=pauseGame;
button('resume').onclick=()=>{paused=false;previous=0;accumulator=0;dialog('pause').close();audio.unlock();refresh()};
dialog('pause').addEventListener('cancel',e=>{e.preventDefault();button('resume').click()});
button('mute').onclick=()=>{audio.muted=!audio.muted;button('mute').textContent='音效：'+(audio.muted?'关':'开');button('mute').setAttribute('aria-pressed',String(audio.muted));savePreferences()};
button('motion').onclick=()=>{reduced=!reduced;if(renderer)renderer.reduced=reduced;document.body.classList.toggle('reduce-motion',reduced);button('motion').textContent='动效：'+(reduced?'减弱':'开');button('motion').setAttribute('aria-pressed',String(reduced));savePreferences()};
button('zoom-map').onclick=()=>{renderer?.toggleZoom({x:state.map.width/2,y:state.map.height/2});const b=button('zoom-map');const zoom=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',String(zoom));b.textContent=zoom?'－':'＋';b.setAttribute('aria-label',zoom?'查看全景':'放大地图');context()};
button('overview-map').onclick=()=>{const b=button('overview-map');if(b.dataset.view!=='overview'){renderer?.fit();b.dataset.view='overview';b.setAttribute('aria-label','聚焦营地')}else{renderer?.focusCamp(state);b.dataset.view='camp';b.setAttribute('aria-label','全景地图')}context()};
button('fit-map').onclick=()=>{renderer?.fit();dialog('pause').close();paused=false;previous=0;refresh()};
button('restart-seed').onclick=()=>confirm('重开本种子','当前营地将重新开始；已保存进度会先备份。',()=>reset(state.seed));
function home(){paused=true;active=false;cancelTool();closeAll();const saved=loadRun();button('continue-game').disabled=!ready||!saved.state;dialog('home').showModal()}
button('back-home').onclick=home;button('result-home').onclick=home;
button('new-game').onclick=()=>{const seed=(crypto.getRandomValues(new Uint32Array(1))[0]||1);confirm('新建营地',blockedSave?'现有档案无法继续。先完整备份旧档，备份成功后才建立新营地；备份失败不会覆盖。':'将使用新种子开始，旧进度会先备份。',()=>reset(seed))};
button('seed-game').onclick=()=>{const seed=Number($<HTMLInputElement>('seed').value);if(!Number.isSafeInteger(seed)||seed<1||seed>4294967295){$('home-error').textContent='请输入1到4294967295之间的整数。';return}confirm('按种子开局','同种子与同样操作可重现相同战局。',()=>reset(seed))};
button('continue-game').onclick=()=>{const saved=loadRun();if(!saved.state){$('home-error').textContent=saved.error||'没有可继续的营地';return}state=saved.state;replayViewing=false;replayPlayer=null;active=true;paused=false;accumulator=0;previous=0;closeAll();refresh()};
button('again').onclick=()=>reset((crypto.getRandomValues(new Uint32Array(1))[0]||1));
button('confirm-no').onclick=()=>{confirmation=null;dialog('confirm').close()};button('confirm-yes').onclick=()=>{const run=confirmation;confirmation=null;dialog('confirm').close();run?.()};
document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(b=>b.onclick=()=>dialog(b.dataset.close!).close());
button('start-wave').onclick=()=>{if(state.phase!=='prep')return;if(!state.legions.length&&!state.buildings.length){confirm('空营地开战？','当前没有守军，敌人将直接威胁营地。',()=>startWave());return}startWave()};
function startWave(){cancelTool();select(null);persist();if(act({type:'startWave'})){audio.play('wave');previous=0;accumulator=0}}

function makeButton(label:string,run:()=>void,disabled=false){const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled;b.onclick=run;return b}
function context(){const root=$('context');root.replaceChildren();if(tool||selected===null||state.phase!=='prep'||!active){root.hidden=true;return}const legion=state.legions.find(l=>l.id===selected),building=state.buildings.find(b=>b.id===selected);const item=legion||building;if(!item){root.hidden=true;selected=null;return}root.hidden=false;
 const title=document.createElement('strong');title.textContent=legion?`${names[legion.kind]} ${legion.tier}级 · 经验 ${legion.xp}`:`${names[building!.kind]} · ${Math.ceil(building!.hp)} / ${building!.maxHp}`;root.append(title);
 if(legion){const price=legion.tier===1?70:150;root.append(makeButton(legion.tier===3?'已满级':`晋升 ${price}金`,()=>act({type:'upgradeLegion',id:legion.id}),legion.tier===3||state.gold<price||getShopTier(state.mapId,state.wave)<=legion.tier||legion.xp<legion.tier*10));
 const label=document.createElement('label');label.textContent='警戒';const range=document.createElement('input');range.type='range';range.min=String(Math.max(2,getUnitStats(legion.kind,legion.tier).range));range.max='10';range.step='.25';range.value=String(legion.alertRadius);range.setAttribute('aria-label','警戒半径');const value=document.createElement('span');value.textContent=legion.alertRadius.toFixed(1);range.oninput=()=>{value.textContent=Number(range.value).toFixed(1);renderer?.place(legion,true,Number(range.value))};range.onchange=()=>{act({type:'setRadius',id:legion.id,value:Number(range.value)});renderer?.place(null)};label.append(range,value);root.append(label);
 const assigned=legion.cardIds.map(id=>state.cards.find(c=>c.id===id)).filter(c=>!!c);if(assigned.length){const badges=document.createElement('div');badges.className='assigned-effects';badges.setAttribute('aria-label',assigned.map(c=>CARD_DEFS[c!.kind].name).join(' / '));for(const kind of [...new Set(assigned.map(c=>c!.kind))]){const badge=document.createElement('span');badge.append(icon(({giant:'fist',deathBurst:'skull',sharp:'swords',bounty:'coin'} as const)[kind]));const count=assigned.filter(c=>c!.kind===kind).length;if(count>1)badge.append(document.createTextNode(String(count)));badges.append(badge)}root.append(badges)}
 const available=state.cards.filter(c=>c.carrier===null&&CARD_DEFS[c.kind].scope!=='global');if(available.length){root.querySelector('button')?.remove();const row=document.createElement('div');row.className='card-assign';for(const card of available)row.append(makeButton(`挂 ${CARD_DEFS[card.kind].name}`,()=>act({type:'assignCard',cardId:card.id,legionId:legion.id})));root.insertBefore(row,label)}
 }else{const cost=Math.ceil((building!.maxHp-building!.hp)*BUILDING_DEFS[building!.kind].repairRate);root.append(makeButton(`修满 ${cost}金`,()=>act({type:'repair',id:building!.id}),building!.hp>=building!.maxHp||state.gold<cost))}
 const close=makeButton('×',()=>select(null));close.className='context-close icon-button';close.replaceChildren(icon('close'));close.setAttribute('aria-label','取消选中');root.insertBefore(close,title.nextSibling);const screen=renderer?.toScreen(legion?{x:item.x+.5,y:item.y+.5}:item)||{x:200,y:100};const insets=readSafeInsets();const left=insets.left+4,right=innerWidth-insets.right-4,top=Math.max(insets.top+4,$('hud').getBoundingClientRect().bottom+4),bottom=Math.min(innerHeight-insets.bottom-4,$('commands').getBoundingClientRect().top-4);root.style.width=Math.min(220,Math.max(170,(right-left-90)/2))+'px';root.style.maxHeight=Math.max(90,bottom-top)+'px';const w=root.offsetWidth,h=root.offsetHeight,gap=38;const candidates=[{x:screen.x-w-gap,y:screen.y-h/2},{x:screen.x+gap,y:screen.y-h/2},{x:screen.x-w/2,y:screen.y-h-gap},{x:screen.x-w/2,y:screen.y+gap}].map(p=>({x:Math.max(left,Math.min(right-w,p.x)),y:Math.max(top,Math.min(bottom-h,p.y))}));const overlap=(p:Point)=>Math.max(0,Math.min(p.x+w,screen.x+30)-Math.max(p.x,screen.x-30))*Math.max(0,Math.min(p.y+h,screen.y+30)-Math.max(p.y,screen.y-30));const obstacles=[...document.querySelectorAll<HTMLElement>('.resources,.view-controls,#wave-preview')].filter(n=>!n.hidden).map(n=>n.getBoundingClientRect());const score=(p:Point)=>overlap(p)+obstacles.reduce((sum,r)=>sum+4*Math.max(0,Math.min(p.x+w,r.right)-Math.max(p.x,r.left))*Math.max(0,Math.min(p.y+h,r.bottom)-Math.max(p.y,r.top)),0);candidates.sort((a,b)=>score(a)-score(b));const position=candidates[0];root.style.left=position.x+'px';root.style.top=position.y+'px';
}
function showShop(){if(state.phase!=='prep')return;cancelTool();const tier=getShopTier(state.mapId,state.wave);$('shop-title').textContent=`${tier}级商店 · ${state.gold}金`;const root=$('shop-items');root.replaceChildren();
 const add=(name:string,price:number,description:string,run:()=>void,disabled=false,dragKind?:Tool)=>{const b=makeButton('',run,disabled||state.gold<price);const imageKind=dragKind||Object.entries(SPELL_DEFS).find(([,def])=>def.name===name)?.[0]||'effect';product(b,imageKind,name,price,description);if(dragKind){b.dataset.dragTool=dragKind;b.onclick=()=>notify('按住'+name+'拖入战场')}root.append(b)};
 for(const [kind,def]of Object.entries(LEGION_DEFS))if(def)add(def.name,def.price,kind==='shield'?'近战纵深，保护后排':'远程圆形警戒，怕贴身',()=>chooseTool(kind as LegionKind),false,kind as LegionKind);
 for(const [kind,def]of Object.entries(BUILDING_DEFS))add(def.name,def.price,kind==='wall'?'可破坏墙体，延长敌人行路时间':kind==='tower'?'固定远程火力':'踩过减速，不阻挡',()=>chooseTool(kind as BuildingKind),false,kind as BuildingKind);
 for(const [kind,def]of Object.entries(HERO_DEFS))if(def){const locked=tier<def.shopTier||state.wave<(getMapDefinition(state.mapId).supply[kind]??Infinity);add(def.name,def.price,locked?`${def.shopTier}级商店开放`:(def.aura.target==='building'?'建筑攻速光环，波间修复':'守军攻速光环'),()=>chooseTool(kind as HeroKind),!!state.hero||locked,kind as HeroKind);} for(const [kind,def]of Object.entries(SPELL_DEFS))add(def.name,def.price,`${kind==='heal'?'恢复范围内守军':'暂时定住敌军'} · 现有${state.spells[kind as SpellKind]}次`,()=>{if(act({type:'buySpell',kind:kind as SpellKind})){showShop();notify('已购买一次'+def.name)}});
 $('shop-detail').textContent=tier===1?'基础补给每波可买；晋升在更高商店兑现经验。':`当前可晋升至${tier}级：先选中场上的军团。`;
 if(!dialog('shop').open)dialog('shop').showModal();
}
button('open-shop').onclick=showShop;
// A dedicated 44px drag rail leaves scrolling available even when every product
// is itself a drag source; empty grid gaps also retain native vertical scrolling.
let shopScroll:{id:number;y:number;top:number}|null=null;
$('shop-scroll').addEventListener('pointerdown',e=>{shopScroll={id:e.pointerId,y:e.clientY,top:$('shop-items').scrollTop};$('shop-scroll').setPointerCapture(e.pointerId)});
$('shop-scroll').addEventListener('pointermove',e=>{if(shopScroll?.id===e.pointerId)$('shop-items').scrollTop=shopScroll.top+shopScroll.y-e.clientY});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('shop-scroll').addEventListener(type,()=>{shopScroll=null});
function showCards(){if(replayViewing)return;if(!state.cardChoices.length){if(dialog('cards').open)dialog('cards').close();return}const root=$('card-choices');root.replaceChildren();for(const kind of state.cardChoices){const b=makeButton('',()=>{if(act({type:'chooseCard',kind})){dialog('cards').close();notify(CARD_DEFS[kind].scope==='global'?CARD_DEFS[kind].name+'已全局生效，无需指派。':'选中军团即可挂上'+CARD_DEFS[kind].name)}});const strong=document.createElement('strong');strong.textContent=CARD_DEFS[kind].name;const text=document.createElement('span');text.textContent=cards[kind];b.classList.add('effect-choice');b.append(icon(({giant:'fist',deathBurst:'skull',sharp:'swords',bounty:'coin'} as Record<string,string>)[kind]||'star'),strong,text);root.append(b)}if(active&&!dialog('cards').open)dialog('cards').showModal()}
dialog('cards').addEventListener('cancel',e=>e.preventDefault());
function preview(){const root=$('wave-preview');root.replaceChildren();const waves=getWavePreview(state);const current=waves.find(w=>w.wave===currentWave())||waves[0];root.append(makeButton('路线 '+current.gates.map(i=>String.fromCharCode(65+i)).join(''),()=>{$('collection-title').textContent='路线预告';const list=$('collection-content');list.replaceChildren();for(const w of waves)entry(list,`第${w.wave}波${w.boss?' · 最终围攻':''}`,`${w.gates.map(i=>String.fromCharCode(65+i)+' '+state.map.gates[i].label).join(' / ')}：${w.enemies.map(e=>(names[e.kind]||e.kind)+' ×'+e.count).join('，')}；商店${w.shopTier}级`);dialog('collection').showModal()}))}

function refresh(){if(!ready)return;$('gold').textContent=String(Math.floor(state.gold));$('core-health').textContent=String(Math.max(0,Math.ceil(state.coreHp)));$('wave').textContent=currentWave()+' / 7';$('prep-tools').hidden=state.phase!=='prep';$('combat-tools').hidden=state.phase!=='combat';button('start-wave').hidden=state.phase!=='prep';button('start-wave').disabled=state.cardChoices.length>0||blockedSave||replayViewing;
 document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(b=>{const kind=b.dataset.tool!;const price=kind==='engineer'?(HERO_DEFS.engineer?.price??90):LEGION_DEFS[kind as LegionKind]?.price??BUILDING_DEFS[kind as BuildingKind]?.price??0;const heroLocked=kind==='engineer'&&(getShopTier(state.mapId,state.wave)<(HERO_DEFS.engineer?.shopTier??2)||state.wave<(getMapDefinition(state.mapId).supply.engineer??Infinity));b.hidden=heroLocked;b.querySelector('.product-name')!.textContent=kind==='engineer'?'英雄':kind==='slow'?'减速':names[kind];b.querySelector('.product-price')!.replaceChildren(icon('coin'),document.createTextNode(heroLocked?`${HERO_DEFS.engineer?.shopTier??2}级开`:String(price)));b.disabled=state.gold<price||(kind==='engineer'&&!!state.hero)||heroLocked||replayViewing;b.setAttribute('aria-pressed',String(tool===kind))});
 document.querySelectorAll<HTMLButtonElement>('[data-spell]').forEach(b=>{const kind=b.dataset.spell as SpellKind;b.querySelector('b')!.textContent=String(state.spells[kind]);b.disabled=state.spells[kind]<=0||replayViewing;b.setAttribute('aria-pressed',String(tool===kind))});
 $('placement').hidden=!spellTool();context();preview();showCards();renderer?.draw(state);
 if((state.phase==='won'||state.phase==='lost')&&active&&!dialog('result').open){tool=null;point=null;renderer?.place(null);$('placement').hidden=true;const outcome=replayViewing?{ok:true}:recordOutcome(state);if(!outcome.ok)notify(outcome.message||'结果保存失败，旧档已保留。',true);$('result-title').textContent=state.phase==='won'?'营地守住了':'营地失守';$('result-stats').textContent=`守住 ${state.stats.wavesCleared} 波 · 击败 ${state.stats.kills} 敌人 · 损失 ${state.stats.legionsLost} 军团 · 种子 ${state.seed}`;dialog('result').showModal()}
}

// Profile UI is backed by real registered definitions; no decorative locked-content promises.
button('open-codex').onclick=()=>{ $('collection-title').textContent='图鉴';const root=$('collection-content');root.replaceChildren();for(const [kind,def]of Object.entries(LEGION_DEFS))if(def){const tier=def.tiers[0];entry(root,def.name,`${tier.count}人 · 攻击${tier.damage} · 护甲${tier.armor} · 射程${tier.range}；${kind==='shield'?'前排承压，纵深站位':'远程覆盖，分散避开溅射'}`)}for(const [kind,def]of Object.entries(ENEMY_DEFS))if(def)entry(root,names[kind]||kind,`生命${def.hp} · 护甲${def.armor} · ${def.fly?'无视地面阻挡':'地面寻路'} · 漏怪伤害${def.leakDamage}`);for(const [kind,def]of Object.entries(CARD_DEFS))entry(root,def.name,cards[kind as CardKind]);dialog('collection').showModal()};
function entry(root:HTMLElement,name:string,description:string){const row=document.createElement('article');row.className='collection-entry';const copy=document.createElement('div'),title=document.createElement('strong'),p=document.createElement('p');title.textContent=name;p.textContent=description;copy.append(title,p);row.append(copy);root.append(row)}
button('open-achievements').onclick=()=>{$('collection-title').textContent='成就';const root=$('collection-content');root.replaceChildren();const profile=getProfile();entry(root,'营地记录',`守护 ${profile.stats.runs} 次 · 胜利 ${profile.stats.wins} 次 · 最远守住 ${profile.stats.maxWave} 波 · 击败 ${profile.stats.kills} 敌人`);for(const achievement of ACHIEVEMENTS)entry(root,achievement.name,(profile.achievements.includes(achievement.id)?'已达成 · ':'尚未达成 · ')+achievement.description);for(const run of profile.history.slice(0,8))entry(root,run.result==='won'?'守护成功':'营地失守',`种子 ${run.seed} · 第${run.wave}波 · 击败${run.kills}敌人`);if(profile.blockedMessage)entry(root,'档案保留',profile.blockedMessage);dialog('collection').showModal()};
button('open-replay').onclick=()=>{$('collection-title').textContent='回放';const root=$('collection-content');root.replaceChildren();entry(root,'本次动作',`种子 ${state.seed} · ${state.actions.length} 次操作 · ${state.rulesVersion}`);const text=document.createElement('textarea');text.setAttribute('aria-label','回放数据');text.value=exportReplay(state);root.append(text);root.append(makeButton('复制回放',()=>{void navigator.clipboard?.writeText(text.value).then(()=>notify('回放已复制')).catch(()=>{text.select();notify('请选择并复制回放文本')})}));root.append(makeButton('载入并观看',()=>confirm('观看回放','当前进度保持原样；结束观看可从菜单继续营地。',()=>{try{replayPlayer=new ReplayPlayer(text.value);state=replayPlayer.state;replayViewing=true;active=true;paused=false;selected=null;tool=null;closeAll();refresh();notify('回放已重现')}catch(e){notify(e instanceof Error?e.message:'回放不能读取',true)}})));dialog('collection').showModal()};

type Drag={id:number;start:Point;last:Point;moved:boolean;mode:'pan'|'place'|'spell';hit:number|null;source:boolean;inside:boolean;offset:Point};
let drag:Drag|null=null;const fingers=new Set<number>();let gestureCancelled=false;
function cancelGesture(keepPointers=false){if(!keepPointers){fingers.clear();gestureCancelled=false}drag=null;renderer?.place(null);if(tool&&point){point=null;validPoint=false;button('confirm-placement').disabled=true}if(state.phase==='prep')tool=null}
function usableBattle(x:number,y:number){const safe=readSafeInsets();if(x<safe.left||x>innerWidth-safe.right||y<safe.top||y>innerHeight-safe.bottom)return false;for(const id of ['hud','commands','wave-preview','context']){const node=$(id);if(node.hidden)continue;const r=node.getBoundingClientRect();if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom)return false}return !document.querySelector('dialog[open]')}
function hitEntity(p:Point){const screen=renderer!.toScreen(p);const candidates:{id:number;type:'move'|'moveBuilding';d:number;anchor:Point}[]=[];const distance=(point:Point)=>{const q=renderer!.toScreen(point);return Math.hypot(q.x-screen.x,q.y-screen.y)};for(const l of state.legions){const anchor={x:l.x+.5,y:l.y+.5};let d=distance(anchor);for(const u of state.units)if(u.legionId===l.id)d=Math.min(d,distance({x:u.x+.5,y:u.y+.5}));if(d<=22)candidates.push({id:l.id,type:'move',d,anchor})}for(const b of state.buildings){const d=distance(b);if(d<=22)candidates.push({id:b.id,type:'moveBuilding',d,anchor:{x:b.x,y:b.y}})}return candidates.sort((a,b)=>a.d-b.d)[0]??null}
function dragWorld(d:Drag,x:number,y:number){const p=renderer!.toWorld(x,y);return d.hit===null?p:{x:p.x-d.offset.x,y:p.y-d.offset.y}}

function attachInput(){const canvas=renderer!.app.canvas;
 document.addEventListener('pointerdown',e=>{if(!active||paused||replayViewing)return;fingers.add(e.pointerId);if(fingers.size>1){gestureCancelled=true;cancelGesture(true);return}if(gestureCancelled)return;const element=e.target as Element;const source=element.closest<HTMLButtonElement>('[data-tool],[data-drag-tool]');if(source&&!source.disabled&&state.phase==='prep'){const kind=(source.dataset.tool||source.dataset.dragTool) as Tool;chooseTool(kind);drag={id:e.pointerId,start:{x:e.clientX,y:e.clientY},last:{x:e.clientX,y:e.clientY},moved:false,mode:'place',hit:null,source:true,inside:false,offset:{x:0,y:0}};canvas.setPointerCapture(e.pointerId);return}if(e.target!==canvas||document.querySelector('dialog[open]'))return;canvas.setPointerCapture(e.pointerId);const world=renderer!.toWorld(e.clientX,e.clientY);const hit=hitEntity(world);const mode=spellTool()?'spell':state.phase==='prep'&&(tool||hit)?'place':'pan';if(mode==='place'&&hit){selected=hit.id;renderer!.select(selected);tool=hit.type;$('context').hidden=true}drag={id:e.pointerId,start:{x:e.clientX,y:e.clientY},last:{x:e.clientX,y:e.clientY},moved:false,mode,hit:hit?.id??null,source:false,inside:usableBattle(e.clientX,e.clientY),offset:hit?{x:world.x-hit.anchor.x,y:world.y-hit.anchor.y}:{x:0,y:0}};if(mode!=='pan')updatePoint(dragWorld(drag,e.clientX,e.clientY),drag.inside);
 },true);
 document.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId||gestureCancelled)return;const dx=e.clientX-drag.last.x,dy=e.clientY-drag.last.y;if(Math.hypot(e.clientX-drag.start.x,e.clientY-drag.start.y)>7)drag.moved=true;drag.inside=usableBattle(e.clientX,e.clientY);if(drag.mode==='place'||drag.mode==='spell')updatePoint(dragWorld(drag,e.clientX,e.clientY),drag.inside);else if(drag.moved)renderer!.pan(dx,dy);drag.last={x:e.clientX,y:e.clientY};renderer!.draw(state)},true);
 document.addEventListener('pointerup',e=>{fingers.delete(e.pointerId);if(gestureCancelled){if(!fingers.size)gestureCancelled=false;cancelGesture(true);return}if(!drag||drag.id!==e.pointerId)return;const d=drag;drag=null;const inside=usableBattle(e.clientX,e.clientY);if(d.mode==='spell'){if(inside)updatePoint(renderer!.toWorld(e.clientX,e.clientY));else cancelGesture();return}if(d.mode==='place'){updatePoint(dragWorld(d,e.clientX,e.clientY),inside);if(shouldDrop({start:d.start,end:{x:e.clientX,y:e.clientY},inside,valid:validPoint,cancelled:gestureCancelled,otherPointers:fingers.size})){commitPoint();return}renderer!.place(null);point=null;validPoint=false;if(d.hit!==null){select(d.hit)}else{tool=null;refresh()}return}if(!d.moved){const hit=hitEntity(renderer!.toWorld(e.clientX,e.clientY));select(hit?.id??null)}else context();
 },true);
 document.addEventListener('pointercancel',e=>{fingers.delete(e.pointerId);gestureCancelled=fingers.size>0;cancelGesture(true);refresh()},true);
 canvas.addEventListener('lostpointercapture',e=>{if(drag?.id===e.pointerId){fingers.delete(e.pointerId);cancelGesture();refresh()}});
 canvas.addEventListener('dblclick',e=>{if(active&&!tool)renderer!.toggleZoom(renderer!.toWorld(e.clientX,e.clientY))});
}

function frame(time:number){requestAnimationFrame(frame);if(!ready||!active||paused||document.hidden||document.querySelector('dialog[open]')){previous=0;accumulator=0;return}if(!previous)previous=time;accumulator+=Math.min(200,time-previous);previous=time;const oldPhase=state.phase,oldWave=state.wave,oldKills=state.stats.kills,oldHealth=state.coreHp;
 if(replayViewing&&replayPlayer){while(accumulator>=1000/30){replayPlayer.advance();accumulator-=1000/30;if(replayPlayer.done){accumulator=0;break}}}else if(state.phase==='combat'){while(accumulator>=1000/30){step(state);accumulator-=1000/30;if(state.phase!=='combat')break}}else accumulator=0;
 if(!replayViewing&&state.units.some(u=>u.team==='enemy'&&!observedEnemyKinds.has(u.kind))){for(const u of state.units)if(u.team==='enemy')observedEnemyKinds.add(u.kind);const observed=observeRun(state);if(!observed.ok)notify(observed.message||'遭遇记录保存失败。',true)}
 if(time-lastSound>300){if(state.stats.kills>oldKills){audio.asset('death');lastSound=time}else if(state.coreHp<oldHealth){audio.asset('hit');lastSound=time}else if(state.effects.some(e=>e.born>=state.tick-3&&e.kind==='shot')){audio.asset('attack');lastSound=time}}
 if(oldPhase!==state.phase||oldWave!==state.wave){persist();refresh()}else{renderer?.draw(state);$('gold').textContent=String(Math.floor(state.gold));$('core-health').textContent=String(Math.max(0,Math.ceil(state.coreHp)))}
}
async function boot(){dialog('home').showModal();try{const response=await fetch('./assets/manifest.json');if(!response.ok)throw new Error('素材清单无法读取。');const manifest:AssetManifest=await response.json();const ui=manifest.ui;const url=(path:string)=>new URL(path.startsWith('assets/')?path:'assets/'+path,document.baseURI).href;if(ui.wideNormal)document.documentElement.style.setProperty('--button-art',`url("${url(ui.wideNormal)}")`);if(ui.widePressed)document.documentElement.style.setProperty('--button-pressed-art',`url("${url(ui.widePressed)}")`);if(ui.squarePressed)document.documentElement.style.setProperty('--square-pressed-art',`url("${url(ui.squarePressed)}")`);if(ui.squareNormal)document.documentElement.style.setProperty('--square-art',`url("${url(ui.squareNormal)}")`);if(ui.wideNormal)document.documentElement.style.setProperty('--button-primary-art',`url("${url(ui.wideNormal)}")`);await installArtwork(manifest);audio.setSources(manifest.sounds||{});
 renderer=new BattleRenderer($('battlefield'),manifest);await renderer.init(()=>{});renderer.setInsets(readSafeInsets());renderer.reduced=reduced;attachInput();ready=true;const saved=loadRun();blockedSave=!!saved.error&&!saved.state;button('continue-game').disabled=!saved.state;button('new-game').disabled=false;button('seed-game').disabled=false;if(blockedSave)button('new-game').textContent='备份旧档后新建';$('home-error').textContent=saved.error||'';startupReady();if(preferences.error)notify(preferences.error,true);renderer.draw(state);requestAnimationFrame(frame);
 }catch(e){$('home-error').textContent=e instanceof Error?e.message:'必要素材未准备完成。';const retry=makeButton('重试',()=>{renderer?.app.destroy(true);renderer=null;void boot()});$('home-error').append(retry)}}
void boot();

// Read-only diagnostic seam for isolated browser checks, without exposing state mutations.
Object.defineProperty(window,'__guardians',{value:{snapshot:()=>({phase:state.phase,wave:state.wave,gold:state.gold,coreHp:state.coreHp,legions:state.legions.map(l=>({id:l.id,kind:l.kind,tier:l.tier,x:l.x,y:l.y})),buildings:state.buildings.map(b=>({id:b.id,kind:b.kind,x:b.x,y:b.y})),members:state.units.filter(u=>u.legionId!==null).map(u=>({id:u.id,legionId:u.legionId,x:u.x,y:u.y})),tool,paused,ready}),screenPoint:(p:Point)=>renderer?.toScreen(p)}});








