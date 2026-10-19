// Local, profile-free review entry. Deliberately excluded from the production package allowlist.
import {unitAssets} from './assets.js';
import {vfxAssets} from './vfx-assets.js';
import {createSkillPreview} from './skill-preview.js';
import {getJobSkillDescription,getCareerWeapon,recommendedSkills} from './profession-content.js';
import {HEROES,getHeroJobs,SKILL_DEFINITIONS} from './heroes.js';

const $=selector=>document.querySelector(selector);
const options=new URLSearchParams(location.search);
let heroId=HEROES.some(h=>h.id===location.hash.slice(1))?location.hash.slice(1):'grappler';
let job=(getHeroJobs(heroId).find(j=>String(j.tier)===options.get('tier'))||getHeroJobs(heroId)[0]).id,action='basic',rank=['1','2','3','a','b'].includes(options.get('rank'))?options.get('rank'):'1',preview,images,ready=false;
$('#scenario').value=['pressure','survival','survival-orbit'].includes(options.get('scene'))?options.get('scene'):'formation';
pressed('#weapon','rank',rank);
const allButtons=[...document.querySelectorAll('button')];
allButtons.forEach(button=>button.disabled=true);
const hero=()=>HEROES.find(h=>h.id===heroId);
const skills=()=>recommendedSkills(job,6,hero().skills.map(s=>s.id));
function button(text,key,value,selected){const b=document.createElement('button');b.textContent=text;b.dataset[key]=value;b.setAttribute('aria-pressed',String(selected));return b;}
function controls(){
 const jobs=getHeroJobs(heroId);$('#tiers').replaceChildren(...jobs.map((j,i)=>button(`${['一','二','三'][i]}阶 · ${j.name}`,'job',j.id,j.id===job)));
 const ids=skills();if(action!=='basic'&&!ids.includes(action))action='basic';
 $('#moves').replaceChildren(button('被动 · 自动普攻','action','basic',action==='basic'),...ids.map((id,i)=>button(`${['Q','E'][i]} · ${SKILL_DEFINITIONS[id].name}`,'action',id,id===action)));
}
for(const h of HEROES){const option=document.createElement('option');option.value=h.id;option.textContent=h.name;$('#hero').append(option);}$('#hero').value=heroId;
function pressed(group,key,value){document.querySelectorAll(group+' button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset[key]===value)));}
function show(){
 if(!ready)return;
 preview?.dispose();
 const basic=action==='basic',attackProgress={rank:['a','b'].includes(rank)?4:Number(rank),branch:['a','b'].includes(rank)?rank:null};
 $('#weapon').classList.toggle('visible',basic);
 $('#action').textContent=`${getHeroJobs(heroId).find(j=>j.id===job).name} / ${basic?'普攻':SKILL_DEFINITIONS[action].name}`;
 const weapon=getCareerWeapon({heroId,heroJob:job},attackProgress.rank===4?(rank==='a'?3:4):attackProgress.rank-1);
 const pressure=basic&&$('#scenario').value==='pressure';
 const trial=basic&&$('#scenario').value.startsWith('survival');
 $('#description').textContent=(basic?weapon.join(' · '):getJobSkillDescription(job,action,''))+(trial?' · 24秒真实伤害试炼：后期普通怪生成，固定9次属性升级（战意/延展/连击/体魄各2、轻步1），仅自动普攻，正常受伤和死亡；经验置零以排除升级保护，不影响你的存档。':pressure?' · 12秒覆盖拆解：固定72敌，敌伤为零；只看攻击覆盖，不代表生存能力。':'');
 preview=createSkillPreview({canvas:$('canvas'),images,unitAssets,vfxAssets,heroJob:job,skillId:basic?skills()[0]:action,attackHero:basic?heroId:undefined,attackProgress,attackScenario:$('#scenario').value,playbackRate:Number($('#speed').value),onState(state){
  $('#status').textContent=(state.dead?'已阵亡':{playing:'播放中',paused:'已暂停',ready:'点击重播',complete:'演示结束 · 点击重播'}[state.phase]||state.phase)+(state.trial?` · ${state.elapsed.toFixed(1)}s · HP ${state.hp}/${state.maxHp} · 击杀 ${state.kills} · 受伤 ${state.damageTaken} · 首伤 ${state.firstDamage===null?'无':state.firstDamage+'s'}`:state.totalEnemies?` · 已清 ${state.kills}/${state.totalEnemies}`:'');
  $('#pause').textContent=state.phase==='paused'?'继续':'暂停';
  $('#pause').disabled=state.phase==='complete'||state.phase==='ready';
 }});
 // Read-only observation for the local visual QA harness; no player profile or persistence.
 window.heroVfxLab=window.grapplerVfxLab={state:()=>preview.getState()};
}
$('#hero').addEventListener('change',()=>{heroId=$('#hero').value;job=getHeroJobs(heroId)[0].id;action='basic';rank='1';history.replaceState(null,'','#'+heroId);controls();pressed('#weapon','rank',rank);show();});
$('#tiers').addEventListener('click',e=>{const b=e.target.closest('[data-job]');if(b){job=b.dataset.job;controls();show();}});
$('#actions').addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b){action=b.dataset.action;pressed('#actions','action',action);show();}});
$('#weapon').addEventListener('click',e=>{const b=e.target.closest('[data-rank]');if(b){rank=b.dataset.rank;pressed('#weapon','rank',rank);show();}});
$('#speed').addEventListener('change',show);
$('#scenario').addEventListener('change',show);
$('#replay').addEventListener('click',()=>preview?.replay());
$('#pause').addEventListener('click',()=>{if(preview?.getState().phase==='paused')preview.resume();else preview?.pause();});
$('#fullscreen').addEventListener('click',async()=>{
 try{if(document.fullscreenElement)await document.exitFullscreen();else await $('.stage').requestFullscreen();}
 catch{$('#status').textContent='当前浏览器不支持全屏';}
});
document.addEventListener('fullscreenchange',()=>{$('#fullscreen').textContent=document.fullscreenElement?'退出放大':'放大观看';preview?.resize();});
window.addEventListener('pagehide',()=>preview?.dispose(),{once:true});
async function load(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error(`素材未加载：${src}`));image.src=src;});}
try{
 const keys=Object.keys(unitAssets);
 const sources={...Object.fromEntries(keys.map(k=>[k,unitAssets[k].src])),...Object.fromEntries(Object.entries(vfxAssets).map(([k,v])=>['vfx_'+k,v.src])),terrain:'./assets/terrain.png'};
 images=Object.fromEntries(await Promise.all(Object.entries(sources).map(async([k,src])=>[k,await load(src)])));
 ready=true;allButtons.forEach(button=>button.disabled=false);controls();show();
}catch(error){$('#error').textContent=error.message;$('#status').textContent='加载失败';}
