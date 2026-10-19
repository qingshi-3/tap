import { WEAPONS } from './combat-content.js';
import { getCommonUnlocks } from './common-unlocks.js';
import { GROWTH_STATS } from './growth.js';
import { getCombatStats, getSkillGeometry, getSkillCooldown } from './combat-stats.js';
import { getDailyCheckinState } from './campaign.js';

const ART = { orb:'flame-breath', orbit:'whirlwind', dagger:'mark-blade', lightning:'blink-storm', frost:'frost-aura', meteor:'flame-breath', nova:'sword-field', mine:'rock-wall', beam:'blade-wave', vortex:'recall-summons', familiar:'summon-guard', aegis:'guard' };
const icon = id => `<img class="common-art" src="./assets/ui/skill-${ART[id]}.png" alt="" draggable="false">`;
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function renderHomeView({ profile, hero, portrait, resource }) {
  const unlocked = getCommonUnlocks(profile).filter(entry => entry.unlocked).length;
  const daily = getDailyCheckinState(profile);
  const dailyLabel = daily.canClaim ? '签到·可领取' : daily.canDouble ? '签到·可加领' : '今日已领';
  const entries = [
    ['quests','行军任务','追踪目标，领取远征奖励'],
    ['hero','切换英雄','选择出战英雄 · 查看战技'],
    ['map','远征关卡','选定路线，迎战敌潮'],
    ['common','通用能力',`${unlocked} / ${WEAPONS.length} 已开放 · 能力进阶与属性`],
    ['growth','养成','英雄等级与永久属性加成'],
  ];
  return `<main class="campaign-view campaign-home" aria-label="远征首页">
    <div class="home-title"><h1>幸存者：无限狂潮</h1></div>
    <button class="home-hero" data-tab="hero" aria-label="切换出战英雄，当前${escape(hero.name)}">${portrait(hero,'home-portrait')}<span class="home-hero-name"><b>${escape(hero.name)}</b><span>Lv.${profile.heroes?.[hero.id]?.level || 1}</span></span></button>
    <nav class="home-entries" aria-label="首页入口">${entries.map(([tab,name,detail]) => `<button class="home-entry home-entry-${tab}" data-tab="${tab}"><span><b>${name}</b><small>${detail}</small></span></button>`).join('')}</nav>
    <div class="home-supply">${resource('gold',profile.gold)}${resource('materials',profile.materials)}<button class="home-daily" data-action="daily" aria-label="每日签到，${dailyLabel}">${dailyLabel}</button><button class="home-settings" data-action="about" aria-label="打开设置与存档">设置</button></div>
  </main>`;
}

export function renderCommonView({ profile, selectedAbility = 'orb', commonStage = '1', commonPanel = 'abilities', selectedStat = 'damage', statRank = 1 }) {
  if (commonPanel === 'stats') return renderStatCatalog(selectedStat, statRank);
  const unlocks = getCommonUnlocks(profile), byId = Object.fromEntries(unlocks.map(entry => [entry.id,entry]));
  const weapon = WEAPONS.find(entry => entry.id === selectedAbility) || WEAPONS[0], unlock = byId[weapon.id];
  const basicMax=weapon.basicMax||weapon.max-1;
  const stage = [...Array.from({length:basicMax},(_,i)=>String(i+1)),'a','b'].includes(commonStage) ? commonStage : '1';
  const branch = weapon.branches.find(entry => entry.id === stage);
  const description = branch?.description || weapon.levelDescriptions[Number(stage)-1];
  const stages = [...Array.from({length:basicMax},(_,i)=>[String(i+1),`Lv.${i+1}`]),...weapon.branches.map(entry => [entry.id,`进化 ${entry.id.toUpperCase()}`])];
  const requiredStat=GROWTH_STATS.find(stat=>stat.id===weapon.requiredGrowth);
  const count = unlocks.filter(entry => entry.unlocked).length;
  return `<main class="campaign-view campaign-common">${commonTabs('abilities')}<div class="common-layout">
    <aside class="common-catalog"><div class="common-heading"><h2>通用能力图鉴</h2><span>${count} / ${WEAPONS.length} 已开放</span></div><div class="common-library" aria-label="选择通用能力">${WEAPONS.map(entry => { const rule = byId[entry.id]; return `<button data-common-ability="${entry.id}" aria-pressed="${entry.id===weapon.id}" class="${entry.id===weapon.id?'is-selected':''} ${rule.unlocked?'':'is-locked'}">${icon(entry.id)}<span><b>${entry.name}</b><small>${rule.unlocked?'已开放':`未解锁 · ${rule.progress} / ${rule.target}`}</small></span><i aria-hidden="true">${rule.unlocked?'✓':'锁'}</i></button>`; }).join('')}</div></aside>
    <section class="common-inspector" aria-label="${weapon.name}演武"><nav class="common-stages" aria-label="能力成长阶段">${stages.map(([id,label]) => `<button data-common-stage="${id}" aria-pressed="${stage===id}" class="${stage===id?'is-active':''}">${label}</button>`).join('')}</nav>
      <div class="skill-preview-stage common-preview-stage"><canvas class="common-preview-canvas" role="img" aria-label="${weapon.name} ${branch?.name || `${stage}阶`}实战效果演示"></canvas><div class="preview-label"><span>${branch?.name || weapon.name}</span><small>演武预览 · 每局重新成长</small></div><div class="preview-controls"><span class="preview-state" aria-live="polite">准备演示</span><button data-action="replay">重播</button></div></div>
      <div class="common-detail"><div class="common-detail-heading">${icon(weapon.id)}<div><h2>${weapon.name}</h2><span>${weapon.description}</span></div></div><p class="common-stage-description"><b>${branch ? `进化 · ${branch.name}` : `Lv.${stage}`}</b> ${description}</p><div class="common-unlock ${unlock.unlocked?'is-unlocked':''}"><b>${unlock.unlocked?'已开放':'尚未解锁'}</b><span>${unlock.requirement}</span>${unlock.target ? `<progress max="${unlock.target}" value="${unlock.progress}" aria-label="${weapon.name}解锁进度"></progress><small>${unlock.progress} / ${unlock.target}</small>`:''}</div><p class="common-evolution-rule">进化条件：本局升至 Lv.${basicMax}${requiredStat?`，并选择至少 1 层「${requiredStat.name}」`:''}。达到关卡进度门槛后，在升级三选一选择一条路线。</p><p class="common-rule">${unlock.unlocked?'进入远征后，在升级三选一中获取。':'当前可自由预览；达成条件后才会进入升级三选一。'} 每局最多两种通用能力。主关最快 90 秒、英雄挑战最快 40 秒开放进化；演武可自由查看所有阶段。</p></div>
    </section></div></main>`;
}

function commonTabs(panel) {
  return `<nav class="common-panels" aria-label="图鉴分类">${[['abilities','通用能力'],['stats','通用属性']].map(([id,name])=>`<button data-common-panel="${id}" aria-pressed="${panel===id}" class="${panel===id?'is-active':''}">${name}</button>`).join('')}</nav>`;
}
const STAT_SCOPE = {
  damage:'英雄普攻、主动技能、通用能力与契灵伤害；按基础值累加，不逐层相乘。',
  area:'圆形、扇形、弧形的半径与直线命中宽度增加。扇角、直线长度、施法距离与位移距离不变。',
  haste:'主动技能与通用能力释放频率；持续伤害跳伤间隔不变。岩墙还需等区域结束后至少 2 秒才可重放。',
  attackSpeed:'英雄普攻与契灵攻击频率；不改变技能冷却、持续伤害跳伤间隔或无敌时间。',
  duration:'持续伤害区域，如火焰吐息、霜冻领域、剑域与岩墙；不延长护盾、无敌、瞬移保护或移动耗时。',
  vitality:'每次选择立即增加最大生命并恢复生命；恢复不超过新的生命上限。',
  speed:'英雄行走速度，按基础值累加；不改变突进、瞬移距离。',
  pickup:'普通魂晶吸附半径；磁吸临时效果使用独立的 310 半径。'
};
const fmt = n => Number(n.toFixed(2)).toString();
function statValue(id, rank) {
  const game={growth:{[id]:rank},player:{}},stats=getCombatStats(game);
  if(id==='damage')return `伤害 ${fmt(stats.damage*100)}% · 基础 100 → ${fmt(100*stats.damage)}`;
  if(id==='area')return `半径 / 命中宽度 ${fmt(stats.area*100)}%`;
  if(id==='haste')return `释放频率 ${fmt(stats.haste*100)}% · 基础 10 秒 → ${fmt(getSkillCooldown(game,'flameBreath',10))} 秒`;
  if(id==='attackSpeed')return `攻击频率 ${fmt(stats.attackSpeed*100)}% · 基础 1 秒 → ${fmt(1/stats.attackSpeed)} 秒`;
  if(id==='duration')return `持续时间 ${fmt(stats.duration*100)}% · 吐息 3 秒 → ${fmt(getSkillGeometry(game,'flameBreath').duration)} 秒`;
  if(id==='vitality')return rank?`最大生命累计 +${12*rank} · 每次选择恢复 12`:'基础生命 · 无额外恢复';
  if(id==='speed')return `行走速度 ${100+5*rank}% · 205 → ${fmt(205*(1+.05*rank))}`;
  return `吸附半径 ${100+20*rank}% · 54 → ${fmt(54*(1+.2*rank))}`;
}
function renderStatCatalog(selectedStat, selectedRank) {
  const stat=GROWTH_STATS.find(s=>s.id===selectedStat)||GROWTH_STATS[0];
  const rank=Math.max(0,Math.min(stat.max,Number(selectedRank)||0));
  const levels=Array.from({length:stat.max+1},(_,i)=>i);
  const linked=WEAPONS.filter(weapon=>weapon.requiredGrowth===stat.id).map(weapon=>weapon.name);
  const game={growth:{area:rank},player:{}},sector=getSkillGeometry(game,'flameBreath'),circle=getSkillGeometry(game,'frostAura'),line=getSkillGeometry(game,'bladeWave');
  return `<main class="campaign-view campaign-common">${commonTabs('stats')}<div class="common-layout common-stat-layout">
    <aside class="common-catalog"><div class="common-heading"><h2>通用属性</h2><span>${GROWTH_STATS.length} 项 · 每局成长</span></div><div class="common-library" aria-label="选择通用属性">${GROWTH_STATS.map(s=>`<button data-common-stat="${s.id}" aria-pressed="${s.id===stat.id}" class="${s.id===stat.id?'is-selected':''}"><span><b>${s.name}</b><small>${s.max} 层上限 · ${s.id=== 'vitality'?'每层 +12 生命':s.id==='speed'?'每层 +5%':s.id==='pickup'?'每层 +20%':'每层 +10%'}</small></span></button>`).join('')}</div></aside>
    <section class="common-stat-inspector" aria-label="${stat.name}属性说明"><nav class="common-stat-levels" aria-label="属性层数">${levels.map(i=>`<button data-common-stat-rank="${i}" aria-pressed="${rank===i}" class="${rank===i?'is-active':''}">${i===0?'基础':`${i} 层`}</button>`).join('')}</nav><div class="common-stat-detail"><h2>${stat.name} · ${rank} / ${stat.max} 层</h2><p class="common-stat-result">${statValue(stat.id,rank)}</p><p>${stat.description}</p><p>${STAT_SCOPE[stat.id]}</p>${linked.length?`<p class="common-evolution-rule">进化配套：${linked.join('、')}。至少选择 1 层本属性，再满足武器满级与关卡进度条件。</p>`:''}${stat.id==='haste'?'<p>冷却 = 基础冷却 ÷ (1 + 0.1 × 层数)。每层增加频率 10%，并非冷却缩短 10%。</p>':''}${stat.id==='area'?`<div class="stat-geometry"><p>真实几何举例 · 长度单位为战场坐标</p><dl><dt>火焰扇形</dt><dd>半径 235 → ${fmt(sector.radius)}，扇角始终 ${fmt(sector.angle*180/Math.PI)}°</dd><dt>霜冻圆形</dt><dd>半径 150 → ${fmt(circle.radius)}</dd><dt>剑气直线</dt><dd>宽度 24 → ${fmt(line.width)}，长度始终 640</dd></dl></div>`:''}<div class="common-stat-table" aria-label="各层效果">${levels.map(i=>`<div class="${i===rank?'is-current':''}"><b>${i===0?'基础':`${i} 层`}</b><span>${statValue(stat.id,i)}</span></div>`).join('')}</div><p class="common-rule">进入远征后通过升级三选一获得，本局生效。可在图鉴查看各层效果；实际增益需在本局升级时选择。绵延只在存在适用持续区域时进入候选池。</p></div></section>
  </div></main>`;
}
