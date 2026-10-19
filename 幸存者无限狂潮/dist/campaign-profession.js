import { getHeroJobs, getHeroKind, SKILL_DEFINITIONS } from './heroes.js';
import { getJobCombat, recommendedSkills } from './profession-content.js';
import { getHeroTrainingCost, getJobState } from './campaign.js';

function text(value){
  return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function benefitText(benefit){
  if(Array.isArray(benefit))return benefit.filter(Boolean).join(' · ');
  if(benefit&&typeof benefit==='object')return Object.values(benefit).filter(Boolean).join(' · ');
  return benefit||'保留当前战技，并获得该职业的专属特性。';
}

function jobStatus(state,active){
  if(active)return '已解锁 · 记住的出战阶层';
  if(state?.unlocked)return '永久已解锁';
  if(state?.readyToClaim)return '解锁待领取';
  return '尚未解锁';
}

function actionFor(job,state,active,pendingHero){
  if(state?.unlocked)return `<button class="profession-cta is-current" disabled>${active?'已解锁 · 记住的阶层':'已解锁 · 下方确认出战'}</button>`;
  if(pendingHero)return '<button class="profession-cta is-current" disabled>先确认该英雄出战</button>';
  if(state?.readyToClaim&&state.questId)return `<button class="profession-cta" data-claim="${text(state.questId)}">免费领取并解锁</button>`;
  return '<button class="profession-cta is-current" disabled>解锁条件尚未满足</button>';
}

/** Render the inner hero panel. Path buttons only change the preview in the parent UI. */
export function renderProfessionView({profile,hero,selectedJob,portrait,resource,skillIcon,pending=false,pendingHero=false}){
  const jobs=getHeroJobs(hero.id);
  const progress=profile?.heroes?.[hero.id]||{};
  const currentId=progress.job||jobs[0]?.id;
  const selectedId=typeof selectedJob==='string'?selectedJob:selectedJob?.id;
  const selected=jobs.find(job=>job.id===selectedId)||jobs.find(job=>job.id===currentId)||jobs[0];
  if(!selected)return '<section class="hero-panel profession-view"><p class="profession-empty">暂无可用职业。</p></section>';

  const current=jobs.find(job=>job.id===currentId)||selected;
  const selectedState=getJobState(profile,selected.id)||{unlocked:selected.tier===1,description:selected.description,steps:[]};
  const currentKind=getHeroKind(hero.id,current.id);
  const selectedKind=getHeroKind(hero.id,selected.id);
  const level=Number(progress.level||1),experience=Number(progress.experience||0),nextXp=Math.max(100,level*100);
  const cost=getHeroTrainingCost(profile);
  const affordable=cost&&profile.gold>=cost.gold&&profile.materials>=cost.materials;
  const path=jobs.map(job=>{
    const state=getJobState(profile,job.id)||{unlocked:job.tier===1};
    const active=job.id===currentId,chosen=job.id===selected.id;
    return `<button class="profession-node ${chosen?'is-selected':''} ${active?'is-active':''}" data-preview-job="${text(job.id)}" aria-pressed="${chosen}">
      <span class="profession-node-art">${portrait({kind:getHeroKind(hero.id,job.id),name:job.name},'profession-node-unit')}</span>
      <span class="profession-node-copy"><small>${job.tier===1?'一阶起步':job.tier===3?'三阶晋升':'二阶晋升'}</small><b>${text(job.name)}</b><em>${active?'◆ 记住的出战阶层':state.readyToClaim?'▣ 可解锁':state.unlocked?'已解锁':'▣ 未解锁'}</em></span>
    </button>`;
  }).join('');
  const steps=(selectedState.steps||[]).map(step=>`<li class="${step.complete?'is-complete':''}"><i aria-hidden="true">${step.complete?'✓':'◇'}</i><span>${text(step.label)}</span></li>`).join('');
  const description=selectedState.description||selected.description||'';
  const combat=getJobCombat(selected.id);
  const recommended=recommendedSkills(selected.id,level,hero.skills.map(skill=>skill.id));
  const before=getJobCombat(current.id);
  const transition=current.id!==selected.id?`<section class="profession-mechanics"><h3>升阶前后</h3><p><b>${text(current.name)}</b> ${text(before?.basic||hero.passive)}</p><p><b>${text(selected.name)}</b> ${text(combat?.basic||selected.benefit)}</p></section>`:'';
  const mechanics=`${transition}${combat?`<section class="profession-mechanics"><h3>${text(combat.loop)}</h3><p><b>普攻</b> ${text(combat.basic)}</p>${Object.entries(combat.skills).map(([id,description])=>`<p><b>${text(SKILL_DEFINITIONS[id].name)}</b> ${text(description)}</p>`).join('')}</section>`:`<p>${text(hero.passive)}</p>`}<section class="profession-mechanics"><h3>普攻也能进阶</h3><p>每局从Ⅰ开始，升级三次至Ⅳ，最终选择清群或重点打单体；不占通用能力槽。</p><button class="profession-inline-action" data-action="attack-training">查看普攻演武</button></section>${selected.id===currentId?`<section class="profession-mechanics"><p>推荐：${recommended.map(id=>text(SKILL_DEFINITIONS[id].name)).join(' · ')}</p><button class="profession-inline-action" data-action="recommend-skills" ${pending?'disabled':''}>恢复两项主动顺序</button></section>`:''}`;

  return `<section class="hero-panel profession-view" aria-label="${text(hero.name)}职业培养">
    <aside class="profession-current">
      <div class="profession-current-art">${portrait({kind:currentKind,name:hero.name},'profession-current-unit')}<span>${text(current.name)}</span></div>
      <div class="profession-current-copy"><small>${pendingHero?'浏览英雄 · 尚未出战':'当前出战英雄'}</small><h2>${text(hero.name)}</h2><p>${text(hero.subtitle||hero.description)}</p></div>
      <div class="profession-level"><b>Lv.${level}</b><div class="meter"><i style="--p:${level>=30?100:Math.min(100,experience/nextXp*100)}%"></i></div><small>${level>=30?'满级':`${experience} / ${nextXp}`}</small></div>
      <div class="profession-training">${cost?`${resource('gold',cost.gold)}${resource('materials',cost.materials)}<button data-action="train" ${pending||!affordable?'disabled':''}>${pending?'先确认切换':affordable?'训练升级':'资源不足'}</button>`:'<b>训练已达上限</b>'}</div>
      <button class="profession-buildings" data-action="buildings">查看营地训练加成</button>
    </aside>
    <div class="profession-workbench">
      <header class="profession-path-heading"><div><h2>职业晋升</h2><p>阶层永久解锁；选择已解锁阶层后，下方确认出战</p></div><span>记住 ${['','Ⅰ','Ⅱ','Ⅲ'][current.tier]} · 候选 ${['','Ⅰ','Ⅱ','Ⅲ'][selected.tier]}</span></header>
      <nav class="profession-path" aria-label="职业路径" style="--profession-count:${jobs.length}">${path}</nav>
      <article class="profession-inspector ${selectedState.unlocked?'':'is-locked'}">
        <div class="profession-preview">${portrait({kind:selectedKind,name:selected.name},'profession-preview-unit profession-preview-portrait')}<span>${selected.tier===1?'一阶预览':selected.tier===3?'三阶预览':'二阶预览'}</span><button data-action="profession-attack" aria-label="演示${text(selected.name)}攻击动作">攻击演示</button></div>
        <div class="profession-detail">
          <header><div><small>${jobStatus(selectedState,selected.id===currentId)}</small><h2>${text(selected.name)}</h2></div><span>${['','Ⅰ','Ⅱ','Ⅲ'][selected.tier]}</span></header>
          <div class="profession-detail-scroll"><p>${text(description)}</p>
          <section class="profession-benefit"><h3>${selected.tier===1?'基础特性':'晋升所得'}</h3><p>${text(benefitText(selected.benefit))}</p></section>
          ${steps?`<ul class="profession-steps">${steps}</ul>`:''}<button class="profession-inline-action profession-details-open" data-action="profession-details">技能机制详情</button>
          </div>
          <footer><button class="profession-inline-action profession-skills-open" data-action="profession-skills">战技预览</button>${actionFor(selected,selectedState,selected.id===currentId,pendingHero)}</footer>
        </div>
      </article>
    </div>
    <dialog class="profession-info" aria-label="${text(selected.name)}技能变化"><header><h2>${text(selected.name)} · 战斗机制</h2><button data-action="close-profession-details" aria-label="关闭技能变化">关闭</button></header><div class="profession-info-content">${mechanics}</div></dialog>
  </section>`;
}
