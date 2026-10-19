import { BUILDINGS, DUNGEONS, getBuildingCost, getBuildingGoldCost, getHeroTrainingCost, getActiveHeroProgress, getExpedition } from './campaign.js';
import { getHeroJob } from './heroes.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const percent = value => `${Math.round(value * 100)}%`;

export function renderGrowthView({profile, hero, portrait, resource, growthPanel='hero', selectedGrowth='hall'}) {
  const progress = getActiveHeroProgress(profile), cost = getHeroTrainingCost(profile);
  const bonus = getExpedition(profile, DUNGEONS[0].id).heroBonus;
  const options = [
    {id:'hall', title:'生命与伤害', benefit:level=>`生命 +${level * 12} · 伤害 +${percent(level * .07)}`, note:'所有英雄出战时生效'},
    {id:'barracks', title:'训练效率', benefit:level=>`金币 −${level * 10} · 材料 −${level * 5}%`, note:'所有英雄训练生效；材料折后向上取整'},
    {id:'workshop', title:'材料收益', benefit:level=>`远征材料 +${percent(level * .08)}`, note:'结算材料加成，最终数量向下取整'},
  ];
  const permanent = growthPanel === 'permanent';
  const item = options.find(entry=>entry.id===selectedGrowth) || options[0];
  const level = profile.buildings[item.id], max = BUILDINGS.find(entry=>entry.id===item.id).maxLevel;
  const price = getBuildingCost(profile,item.id);
  const goldPrice = getBuildingGoldCost(profile,item.id);
  const affordable = cost && profile.gold >= cost.gold && profile.materials >= cost.materials;
  return `<main class="campaign-view campaign-growth" aria-label="养成">
    <nav class="growth-tabs" aria-label="养成分类"><button data-growth-panel="hero" aria-pressed="${!permanent}">英雄升级</button><button data-growth-panel="permanent" aria-pressed="${permanent}">永久强化</button></nav>
    ${permanent ? `<section class="growth-permanent" aria-label="永久强化">
      <div class="growth-options" aria-label="强化项目">${options.map(option=>`<button data-growth-option="${option.id}" aria-pressed="${option.id===item.id}"><b>${option.title}</b><span>Lv.${profile.buildings[option.id]} / ${BUILDINGS.find(entry=>entry.id===option.id).maxLevel}</span></button>`).join('')}</div>
      <article class="growth-inspector"><header><h2>${item.title}</h2><p class="growth-level">Lv.${level}${price===null ? ' · 已满级' : ` <span>→</span> Lv.${level+1}`} <small>/ ${max}</small></p></header>
        <div class="growth-benefits"><div><small>当前效果</small><p>${item.benefit(level)}</p></div>${price===null ? '' : `<div><small>升级后</small><p>${item.benefit(level+1)}</p></div>`}</div>
        <p class="growth-rule">${item.note}</p>
        ${price===null ? '<div class="growth-purchase"><button class="campaign-primary" disabled>已满级</button></div>' : `<div class="growth-payment"><p>任选一种资源升级</p><div class="growth-payment-options" role="group" aria-label="任选一种资源升级">${[['gold',goldPrice,'金币'],['materials',price,'材料']].map(([currency,amount,label])=>`<button class="campaign-primary" data-payment="${currency}" data-upgrade="${item.id}" ${profile[currency]<amount?'disabled':''} aria-label="${label}${profile[currency]<amount?'不足':'升级'}，需要${amount}${label}"><span>${label}${profile[currency]<amount?'不足':'升级'}</span><span class="growth-payment-cost">${resource(currency,amount)}</span></button>`).join('')}</div></div>`}
      </article>
    </section>` : `<section class="growth-hero" aria-label="英雄升级">
      <div class="growth-identity">${portrait(hero,'growth-portrait')}<div><h2>${escape(hero.name)}</h2><p>${escape(getHeroJob(progress.job).name)}</p><strong>Lv.${progress.level} <small>/ 30</small></strong></div></div>
      <div class="growth-hero-content"><div class="growth-experience"><label for="growth-xp">${cost ? `经验 ${progress.experience} / ${progress.level * 100}` : '已达到最高等级'}</label><progress id="growth-xp" value="${cost ? progress.experience : 1}" max="${cost ? progress.level * 100 : 1}"></progress></div>
        <div class="growth-training"><p class="growth-level">Lv.${progress.level}${cost ? ` <span>→</span> Lv.${progress.level+1}` : ' · 已满级'}</p>${cost ? '<p class="growth-gain">本次升级 <b>+10 生命</b><b>+5% 伤害</b></p>' : ''}
          <div class="growth-purchase">${cost ? `<div class="growth-cost" aria-label="训练花费">${resource('gold',cost.gold)}${resource('materials',cost.materials)}</div>` : ''}<button class="campaign-primary" data-action="train" ${!affordable ? 'disabled' : ''}>${!cost ? '已满级' : !affordable ? '训练资源不足' : '训练升级'}</button></div>
          ${cost&&profile.buildings.barracks>0 ? `<p class="growth-rule">费用已含训练效率：金币 −${profile.buildings.barracks*10}，材料 −${profile.buildings.barracks*5}%</p>` : ''}
        </div>
        <details class="growth-details"><summary>属性详情</summary><div><p>出战加成：生命 +${bonus.hp} · 伤害 +${percent(bonus.damage)}</p><p>远征经验也能升级；训练保留已有经验。</p><p>英雄最高 30 级，永久强化最高 5 级。</p></div></details>
      </div>
    </section>`}
  </main>`;
}
