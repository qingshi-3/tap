import { DUNGEONS, upgradeBuilding, trainHero, claimQuest, equipSkill, getActiveCampaignSkills, getAvailableSkills, getDungeonLockReason, getActiveHeroProgress, selectCampaignHero, getJobState } from './campaign.js';
import { unitAssets } from './assets.js';
import { getSelectedHero, getHeroKind, getHeroJobs, HEROES, SKILL_DEFINITIONS, getActiveSkillLoadout } from './heroes.js';
import { SKILL_ART } from './skill-art.js';
import { renderQuestsView, renderMapView } from './campaign-journey.js';
import { createSkillPreview } from './skill-preview.js';
import { renderProfessionView } from './campaign-profession.js';
import { createUnitPreview } from './unit-preview.js';
import { equipRecommendedSkills } from './campaign.js';
import { getJobSkillDescription } from './profession-content.js';
import { getAttackProgressionInfo } from './attack-progression.js';
import { renderHomeView, renderCommonView } from './campaign-home.js';
import { createCommonPreview } from './common-preview.js';
import { renderGrowthView } from './campaign-growth.js';

const TABS=['home','quests','hero','map','common','growth'],LABELS={home:'幸存者：无限狂潮',quests:'行军任务',hero:'切换英雄',map:'远征关卡',common:'通用能力图鉴',growth:'养成'},SLOT_KEYS=['Q','E'];
function portrait(hero,extra=''){return `<canvas class="campaign-portrait ${extra}" width="144" height="144" data-unit-kind="${hero.kind}" role="img" aria-label="${hero.name}"></canvas>`;}
const portraitBounds=new Map();
function drawPortraits(root,images={}){
 root.querySelectorAll('canvas[data-unit-kind]').forEach(canvas=>{
  const kind=canvas.dataset.unitKind,asset=unitAssets[kind]||unitAssets.grunt,frame=asset?.animations?.idle?.frames?.[0]||Object.values(asset?.animations||{})[0]?.frames?.[0];
  if(!asset||!frame)return;
  const image=images[kind]||new Image();
  const draw=()=>{
   let bounds=portraitBounds.get(kind);
   if(!bounds){
    const sample=document.createElement('canvas');sample.width=frame.w;sample.height=frame.h;
    const paint=sample.getContext('2d',{willReadFrequently:true});paint.drawImage(image,frame.x,frame.y,frame.w,frame.h,0,0,frame.w,frame.h);
    const data=paint.getImageData(0,0,frame.w,frame.h).data;let x0=frame.w,y0=frame.h,x1=-1,y1=-1;
    for(let y=0;y<frame.h;y++)for(let x=0;x<frame.w;x++)if(data[(y*frame.w+x)*4+3]>20){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
    bounds=x1>=x0?{x:frame.x+x0,y:frame.y+y0,w:x1-x0+1,h:y1-y0+1}:frame;portraitBounds.set(kind,bounds);
   }
   const ctx=canvas.getContext('2d'),scale=Math.min(canvas.width/bounds.w,canvas.height/bounds.h)*.8,w=bounds.w*scale,h=bounds.h*scale;
   ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,bounds.x,bounds.y,bounds.w,bounds.h,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
  };
  if(image.complete&&image.naturalWidth)draw();else{image.onload=draw;image.src=asset.src;}
 });
}
function resource(kind,value){return `<span class="campaign-resource"><img src="./assets/ui/${kind}.png" alt=""><strong>${Number(value||0).toLocaleString('zh-CN')}</strong></span>`;}
function rewards(values={}){const result=[];if(values.gold)result.push(resource('gold',values.gold));if(values.materials)result.push(resource('materials',values.materials));if(values.xp)result.push(`<span class="text-reward">经验 +${values.xp}</span>`);return result.join('')||'<span class="text-reward">推进远征进度</span>';}
function enemyTraits(enemies=[]){const traits=new Set();enemies.forEach(id=>{if(id.includes('archer'))traits.add('远程');else if(id.includes('runner')||id.includes('scout'))traits.add('冲锋');else if(id.includes('guard')||id.includes('brute'))traits.add('重甲');else traits.add('近战');});return [...traits].join(' · ')||'近战';}
function skillIcon(id){return `<img class="armory-icon" src="${SKILL_ART[id].src}" alt="" draggable="false">`;}
function skillForm(skill){return ({rockWall:'定点陨星',summonGuard:'军团指令',summonElite:'精锐 · 巨灵',recallSummons:'灵骸引爆',blinkStrike:'返影 · 脱离',blinkStorm:'伤害记录 · 结算',guard:'移动旋斩',spiralConvergence:'托举 · 推进',petalPierce:'实体花刃召回',petalBloom:'腾空 · 布刃',magnetCrush:'移动武装'})[skill.id]||({dash:'直线突进',cone:'扇形攻击',circle:'范围攻击',line:'指向施放',self:'自身施放'})[skill.aimType];}

export function createCampaignUI({root,profile,images={},onDepart=()=>{},onChange=()=>{},onAbout=()=>{},onDaily=()=>{}}){
 let browsingHero=null;
 let tab='home',heroPanel='skills',selectedDungeon='moss-gate',selectedSlot=0,selectedSkill=null,selectedJob=null,attackStage='1',selectedAbility='orb',commonStage='1',commonPanel='abilities',selectedStat='damage',statRank=1,growthPanel='hero',selectedGrowth='hall',toastTimer,preview=null,unitPreview=null,renderedTab=null;
 const shell=document.createElement('section');shell.className='campaign-shell is-hidden';shell.setAttribute('aria-label','幸存者：无限狂潮');root.append(shell);
 const viewedProfile=()=>tab==='hero'&&browsingHero?{...profile,selectedHero:browsingHero}:profile;
 const pendingHero=()=>tab==='hero'&&browsingHero&&browsingHero!==profile.selectedHero;
 const pendingChoice=()=>tab==='hero'&&(pendingHero()||selectedJob!==getActiveHeroProgress(profile).job);
 const canConfirm=()=>pendingChoice()&&getJobState(profile,selectedJob)?.unlocked;
 const hero=()=>{const h=getSelectedHero(viewedProfile());return {...h,kind:getHeroKind(h.id,profile.heroes[h.id].job)};};
 function notice(message){let toast=shell.querySelector('.campaign-toast');if(!toast){toast=document.createElement('div');toast.className='campaign-toast';toast.setAttribute('role','status');shell.append(toast);}toast.textContent=message;toast.classList.add('is-visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('is-visible'),2400);}
 function mutate(action){const oldJob=getActiveHeroProgress(profile).job,result=action();if(result?.ok){if(getActiveHeroProgress(profile).job!==oldJob)selectedJob=getActiveHeroProgress(profile).job;onChange(profile,result);render();}notice(result?.message||(result?.ok?'已完成':'暂时无法执行'));return result;}
 function header(){return `<header class="campaign-topbar">${tab==='home'?'':'<button class="campaign-back" data-action="back" aria-label="返回主页"></button>'}<div class="campaign-title"><h1>${LABELS[tab]}</h1><span>${hero().name} · 边境战报</span></div><button class="campaign-about" data-action="about" aria-label="存档与说明">设置</button><div class="campaign-wallet">${resource('gold',profile.gold)}${resource('materials',profile.materials)}</div></header>`;}
 function questsView(){return renderQuestsView({profile,hero:hero(),portrait,rewards,resource});}
 function heroView(){
  const h=hero(),displayProfile=viewedProfile(),progress=getActiveHeroProgress(displayProfile),loadout=getActiveCampaignSkills(displayProfile),available=getAvailableSkills(displayProfile);
  // Locked skills remain inspectable; only the explicit equip action changes the loadout.
  const jobsForHero=getHeroJobs(h.id).map(job=>job.id);
  if(!jobsForHero.includes(selectedJob))selectedJob=progress.job;
  const pending=pendingChoice();
  const sameChoice=h.id===profile.selectedHero&&selectedJob===getActiveHeroProgress(profile).job;
  const chosenUnlocked=Boolean(getJobState(profile,selectedJob)?.unlocked);
  const skills=getActiveSkillLoadout(h.id,h.skills.map(item=>item.id)).map(id=>SKILL_DEFINITIONS[id]).filter(s=>s.jobs.includes(selectedJob)).map(s=>({...s,unlocked:available.some(a=>a.id===s.id&&a.unlocked)}));
  if(!skills.some(s=>s.id===selectedSkill))selectedSkill=loadout[selectedSlot];
  const selected=skills.find(s=>s.id===selectedSkill)||skills[0],equipped=loadout.indexOf(selected.id);
  selectedSkill=selected.id;
  const previewJob=getHeroJobs(h.id).find(job=>job.id===selectedJob);
  const stagePicker=`<nav class="preview-job-picker" aria-label="选择出战阶层与预览">${getHeroJobs(h.id).map(job=>`<button data-preview-job="${job.id}" aria-label="${job.name}，${job.tier}阶预览${job.id===progress.job?'，记住的出战阶层':''}${getJobState(profile,job.id)?.unlocked?'，已解锁':'，未解锁'}" aria-pressed="${job.id===selectedJob}" class="${job.id===selectedJob?'is-active':''}"><b>${['','一阶','二阶','三阶'][job.tier]}</b><small>${job.id===progress.job?'记住':getJobState(profile,job.id)?.unlocked?'已解锁':'未解锁'}</small></button>`).join('')}</nav>`;
  const attackProgress=attackStage==='a'||attackStage==='b'?{rank:4,branch:attackStage}:{rank:Number(attackStage),branch:null};
  const attackInfo=getAttackProgressionInfo({heroId:h.id,heroJob:selectedJob,attackProgress});
  const requirement=`${selected.jobs.map(j=>getHeroJobs(h.id).find(job=>job.id===j)?.name).join(' / ')} · Lv.${selected.level}`;
  const roster=`<nav class="hero-roster" aria-label="选择英雄，可滚动查看全部${HEROES.length}名英雄">${HEROES.map(item=>`<button data-hero="${item.id}" aria-label="${item.name}，等级${profile.heroes[item.id].level}${item.id===profile.selectedHero?'，当前出战':''}" aria-pressed="${item.id===h.id}" class="${item.id===h.id?'is-active':''}" style="--hero-color:${item.color}"><span class="roster-portrait">${portrait({...item,kind:getHeroKind(item.id,profile.heroes[item.id].job)})}</span><span class="roster-name"><b>${item.shortName}</b><small>${item.subtitle}</small></span><span class="roster-level">Lv.${profile.heroes[item.id].level}</span>${item.id===profile.selectedHero?'<i class="roster-check" aria-label="当前出战">◆</i>':''}</button>`).join('')}</nav>`;
  const jobs=heroPanel==='jobs'?renderProfessionView({profile:displayProfile,hero:h,selectedJob,portrait,resource,skillIcon,pending,pendingHero:pendingHero()}):'';
  const equipLabel=pending?'先确认切换':!selected.unlocked?'尚未解锁':equipped===selectedSlot?`已装入 ${SLOT_KEYS[selectedSlot]}`:equipped>=0?`与 ${SLOT_KEYS[equipped]} 槽交换`:`装入 ${SLOT_KEYS[selectedSlot]} 槽`;
  const armory=`<section class="hero-panel skill-armory">
    <aside class="armory-catalog">${stagePicker}
      <div class="skill-library" aria-label="选择战技预览">${skills.map(skill=>{const slot=loadout.indexOf(skill.id);return `<button data-preview-skill="${skill.id}" aria-pressed="${skill.id===selected.id}" class="${skill.id===selected.id?'is-selected':''} ${skill.unlocked?'':'is-locked'}">${skillIcon(skill.id)}<span><b>${skill.name}</b><small>${skillForm(skill)}</small></span><em>${slot>=0?`${SLOT_KEYS[slot]} 已装`:skill.unlocked?`${skill.cooldown}s`:'未解锁'}</em></button>`;}).join('')}</div>
      <section class="armory-loadout" aria-label="战技装备槽"><div class="armory-heading"><h3>出战配置</h3><span>两项主动 · 平A自动施放</span></div><div class="skill-slots">${loadout.map((id,index)=>`<button data-slot="${index}" aria-pressed="${selectedSlot===index}" aria-label="${SLOT_KEYS[index]} 槽，${SKILL_DEFINITIONS[id].name}" class="${selectedSlot===index?'is-active':''}">${skillIcon(id)}<i>${SLOT_KEYS[index]}</i><b>${SKILL_DEFINITIONS[id].name}</b></button>`).join('')}</div></section>
    </aside>
    <section class="skill-inspector" aria-label="${selected.name}预览">
      <div class="skill-preview-stage"><canvas class="skill-preview-canvas" role="img" aria-label="${selected.name}实战效果演示"></canvas><div class="preview-label"><span>${previewJob.name} · ${['','一阶','二阶','三阶'][previewJob.tier]}</span><small>战技预览 · 不改变出战职业</small></div><div class="preview-controls"><span class="preview-state" aria-live="polite">准备演示</span><button data-action="replay" aria-label="重新播放${selected.name}预览"><i aria-hidden="true">↻</i><span>重播</span></button></div></div>
      <div class="skill-detail"><div class="skill-detail-title">${skillIcon(selected.id)}<div><h2>${selected.name}</h2><div class="skill-tags"><span>${skillForm(selected)}</span><span>冷却 ${selected.cooldown} 秒</span></div></div></div><p>${getJobSkillDescription(selectedJob,selected.id,selected.description)}</p>${selected.unlocked?'':`<small class="skill-unlock">解锁条件：${requirement}</small>`}<div class="skill-equip-line"><span>${selected.unlocked?`当前目标：${SLOT_KEYS[selectedSlot]} · ${SKILL_DEFINITIONS[loadout[selectedSlot]].name}`:'可自由预览，解锁后装备'}</span><button class="campaign-primary" data-equip="${selected.id}" ${pending||!selected.unlocked||equipped===selectedSlot?'disabled':''}>${equipLabel}</button></div></div>
    </section>
  </section>`;
  const attackView=`<section class="hero-panel attack-training"><aside class="attack-options">${stagePicker}<nav class="attack-stages" aria-label="专属武器成长预览">${[['1','Ⅰ 起步'],['2','Ⅱ 覆盖'],['3','Ⅲ 成型'],['a','Ⅳ 清群'],['b','Ⅳ 集中']].map(([id,label])=>`<button data-attack-stage="${id}" aria-pressed="${attackStage===id}" class="${attackStage===id?'is-active':''}">${label}</button>`).join('')}</nav></aside><div class="skill-preview-stage"><canvas class="skill-preview-canvas" role="img" aria-label="专属武器实战演示"></canvas><div class="preview-label"><span>${attackInfo.name}</span><small>${previewJob.name} · ${previewJob.tier}阶 · 每局重新成长</small></div><div class="preview-controls"><span class="preview-state" aria-live="polite"></span><button data-action="replay">重播</button></div></div><div class="attack-training-description"><b>${attackInfo.meter||attackInfo.name}</b><p>${attackInfo.description}</p><small>平A是自动被动，不占主动按钮或两个通用槽。末阶两条路线本局二选一；演示不施放主动技能，展示当前职业从Ⅰ到Ⅳ的实际变化。</small></div></section>`;
  return `<main class="campaign-view campaign-hero" style="--hero-color:${h.color}"><div class="hero-screen">${roster}<div class="hero-workspace"><nav class="hero-tabs" aria-label="英雄培养"><button data-hero-panel="skills" aria-pressed="${heroPanel==='skills'}" class="${heroPanel==='skills'?'is-active':''}">战技演武</button><button data-hero-panel="jobs" aria-pressed="${heroPanel==='jobs'}" class="${heroPanel==='jobs'?'is-active':''}">职业晋升</button><button data-hero-panel="attacks" aria-pressed="${heroPanel==='attacks'}" class="${heroPanel==='attacks'?'is-active':''}">专属武器</button><span>${h.name}</span></nav>${heroPanel==='jobs'?jobs:heroPanel==='attacks'?attackView:armory}<footer class="hero-confirm-bar"><span role="status">候选 ${h.name} · ${['','一阶','二阶','三阶'][previewJob.tier]}<small>当前出战：${getSelectedHero(profile).name} · ${['','一阶','二阶','三阶'][getHeroJobs(profile.selectedHero).find(j=>j.id===getActiveHeroProgress(profile).job)?.tier]}</small></span><button class="campaign-primary" data-action="confirm-hero" ${!sameChoice&&chosenUnlocked?'':'disabled'}>${sameChoice?'已出战':chosenUnlocked?'确认切换':'该阶层未解锁'}</button></footer></div></div></main>`;
 }
 function mapView(){return renderMapView({profile,selectedDungeon,rewards,enemyTraits});}
 function navigate(next,{replace=false}={}){
  if((next==='growth'||next==='buildings')&&tab!=='growth')growthPanel='hero';
  if(next!=='hero'||tab!=='hero'){browsingHero=null;selectedJob=null;}
  tab=next==='buildings'?'growth':TABS.includes(next)?next:'home';
  const url=new URL(location.href);url.hash=`/${tab}`;
  if(location.hash!==url.hash)history[replace?'replaceState':'pushState'](null,'',url);
  render();
 }
 window.addEventListener('popstate',()=>{if(!shell.classList.contains('is-hidden')){browsingHero=null;selectedJob=null;tab=TABS.includes(location.hash.slice(2))?location.hash.slice(2):'home';render();}});
 function markScrollContainers(){
  const heroId=hero().id;
  // Catalogs keep their position when selection changes; inspectors belong to the displayed content.
  const keys={
   '.common-library':`common-library:${commonPanel}`,
   '.common-stat-detail':`common-stat-detail:${selectedStat}`,
   '.common-stat-levels':'common-stat-levels',
   '.common-stages':'common-stages',
   '.common-detail':`common-detail:${selectedAbility}:${commonStage}`,
   '.skill-library':`skill-library:${heroId}`,
   '.skill-detail':`skill-detail:${heroId}:${selectedSkill}`,
   '.hero-roster':'hero-roster',
   '.hero-profile':`hero-profile:${heroId}`,
   '.profession-path':`profession-path:${heroId}`,
   '.profession-current':`profession-current:${heroId}`,
   '.profession-detail-scroll':`profession-detail:${heroId}:${selectedJob}`,
   '.attack-stages':`attack-stages:${heroId}`,
   '.journey-quest-list':'journey-quest-list',
   '.journey-scene-picker':'journey-scene-picker',
   '.journey-brief':`journey-brief:${selectedDungeon}`,
   '.growth-options':'growth-options',
   '.growth-details':`growth-details:${heroId}:${growthPanel}`
  };
  for(const [selector,key] of Object.entries(keys))shell.querySelector(selector)?.setAttribute('data-scroll-key',key);
 }
 function render(){
  // Read keys from the old DOM: selection state may already have changed before render is called.
  const scrollPositions=new Map(renderedTab===tab?[...shell.querySelectorAll('[data-scroll-key]')].map(node=>[node.dataset.scrollKey,{top:node.scrollTop,left:node.scrollLeft}]):[]);
  const active=shell.contains(document.activeElement)?document.activeElement:null;
  const focusAttribute=active?.getAttributeNames().find(name=>name.startsWith('data-'));
  const focusValue=focusAttribute?active.getAttribute(focusAttribute):null;
  preview?.dispose();preview=null;unitPreview?.dispose();unitPreview=null;
  const views={home:()=>renderHomeView({profile,hero:hero(),portrait,resource}),common:()=>renderCommonView({profile,selectedAbility,commonStage,commonPanel,selectedStat,statRank}),quests:questsView,hero:heroView,map:mapView,growth:()=>renderGrowthView({profile,hero:hero(),portrait,resource,growthPanel,selectedGrowth})};
  shell.classList.toggle('is-home',tab==='home');
  shell.innerHTML=`${header()}${views[tab]()}<div class="campaign-toast" role="status"></div>`;
  markScrollContainers();
  drawPortraits(shell,images);
  const canvas=shell.querySelector('.skill-preview-canvas');
  const modelCanvas=shell.querySelector('.profession-preview-portrait, .home-portrait, .growth-portrait');
  const commonCanvas=shell.querySelector('.common-preview-canvas');
  if(commonCanvas)preview=createCommonPreview({canvas:commonCanvas,images,abilityId:selectedAbility,level:Number(commonStage)||1,branch:commonStage==='a'||commonStage==='b'?commonStage:null,onState:state=>{const label=shell.querySelector('.preview-state');if(label)label.textContent=state.caption;}});
  if(modelCanvas)unitPreview=createUnitPreview(modelCanvas,images);
  if(canvas)preview=createSkillPreview({canvas,images,skillId:heroPanel==='attacks'?hero().skills[0].id:selectedSkill,heroJob:selectedJob,attackHero:heroPanel==='attacks'?hero().id:null,attackProgress:attackStage==='a'||attackStage==='b'?{rank:4,branch:attackStage}:{rank:Number(attackStage),branch:null},onState:state=>{
   const label=shell.querySelector('.preview-state');
   if(label){label.textContent=state.caption||(state.phase==='complete'?'演示结束 · 可重播':state.phase==='ready'?'点击重播查看效果':'施放中');label.dataset.phase=state.phase;}
  }});
  if(focusAttribute){const next=[...shell.querySelectorAll(`[${focusAttribute}]`)].find(node=>node.getAttribute(focusAttribute)===focusValue);const target=next&&!next.disabled?next:shell.querySelector('.campaign-back, [data-tab="quests"]');target?.focus({preventScroll:true});}
  shell.querySelectorAll('[data-scroll-key]').forEach(node=>{const position=scrollPositions.get(node.dataset.scrollKey);if(position){node.scrollTop=position.top;node.scrollLeft=position.left;}});
  renderedTab=tab;
 }
 shell.addEventListener('click',event=>{const b=event.target.closest('button');if(!b||b.disabled)return;if(b.dataset.tab){navigate(b.dataset.tab);return;}if(b.dataset.growthPanel){growthPanel=b.dataset.growthPanel;render();return;}if(b.dataset.growthOption){selectedGrowth=b.dataset.growthOption;render();return;}if(b.dataset.commonPanel){commonPanel=b.dataset.commonPanel;render();return;}if(b.dataset.commonStat){selectedStat=b.dataset.commonStat;render();return;}if(b.dataset.commonStatRank!==undefined){statRank=Number(b.dataset.commonStatRank);render();return;}if(b.dataset.commonAbility){selectedAbility=b.dataset.commonAbility;render();return;}if(b.dataset.commonStage){commonStage=b.dataset.commonStage;render();return;}if(b.dataset.hero){browsingHero=b.dataset.hero;selectedSlot=0;selectedSkill=null;selectedJob=null;render();return;}if(b.dataset.action==='confirm-hero'){if(!canConfirm())return;const result=mutate(()=>selectCampaignHero(profile,hero().id,selectedJob));if(result?.ok){browsingHero=null;selectedDungeon='moss-gate';}return;}if((pendingChoice()&&(b.dataset.equip||b.dataset.job||['train','recommend-skills'].includes(b.dataset.action)))||(pendingHero()&&b.dataset.claim)){notice('请先确认切换英雄，再进行培养或装备');return;}if(b.dataset.heroPanel){heroPanel=b.dataset.heroPanel;render();return;}if(b.dataset.previewSkill){selectedSkill=b.dataset.previewSkill;render();return;}if(b.dataset.previewJob){selectedJob=b.dataset.previewJob;render();return;}if(b.dataset.attackStage){attackStage=b.dataset.attackStage;render();return;}if(b.dataset.action==='profession-skills'){heroPanel='skills';render();return;}if(b.dataset.action==='attack-training'){heroPanel='attacks';render();return;}if(b.dataset.action==='recommend-skills'){mutate(()=>equipRecommendedSkills(profile));return;}if(b.dataset.action==='profession-details'){shell.querySelector('.profession-info')?.showModal();return;}if(b.dataset.action==='close-profession-details'){shell.querySelector('.profession-info')?.close();return;}if(b.dataset.action==='profession-attack'){unitPreview?.attack();return;}if(b.dataset.action==='replay'){preview?.replay();return;}if(b.dataset.slot!==undefined){selectedSlot=Number(b.dataset.slot);render();return;}if(b.dataset.dungeon){selectedDungeon=b.dataset.dungeon;render();return;}if(b.dataset.route||b.dataset.trial){selectedDungeon=b.dataset.route||b.dataset.trial;navigate('map');return;}if(b.dataset.claim){mutate(()=>claimQuest(profile,b.dataset.claim));return;}if(b.dataset.job){notice('请选择阶层后，使用下方确认切换');return;}if(b.dataset.equip){mutate(()=>equipSkill(profile,selectedSlot,b.dataset.equip));return;}if(b.dataset.upgrade){mutate(()=>upgradeBuilding(profile,b.dataset.upgrade,b.dataset.payment||'materials'));return;}if(b.dataset.action==='back'){navigate('home');return;}if(b.dataset.action==='about'){onAbout();return;}if(b.dataset.action==='daily'){onDaily();return;}if(b.dataset.action==='buildings'){navigate('buildings');return;}if(b.dataset.action==='train'){mutate(()=>trainHero(profile));return;}if(b.dataset.action==='depart'){const d=DUNGEONS.find(item=>item.id===selectedDungeon);if(d&&!getDungeonLockReason(profile,d))onDepart(d.id);}});
 function show(next='home'){root.hidden=false;shell.classList.remove('is-hidden');navigate(next==='hub'?'home':next,{replace:true});}
 function hide(){browsingHero=null;selectedJob=null;preview?.dispose();preview=null;unitPreview?.dispose();unitPreview=null;shell.classList.add('is-hidden');root.hidden=true;}
 function refresh(){if(!shell.classList.contains('is-hidden'))render();}
 render();return{show,hide,refresh,notice};
}

