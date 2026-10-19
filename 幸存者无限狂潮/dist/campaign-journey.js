import { DUNGEONS, getDungeonLockReason, getQuestStates } from './campaign.js';
import { JOURNEY_ART } from './journey-art.js';
import { HERO_JOBS } from './heroes.js';

function progressOf(quest) {
  return Math.min(100, quest.progress / Math.max(1, quest.target) * 100);
}

function journeyArt(dungeon) {
  const art = JOURNEY_ART[dungeon.id] || {};
  return {
    src: art.src || './assets/ui/hub.jpg',
    position: art.position || 'center',
    label: art.label || `${dungeon.region} · ${dungeon.name}`,
  };
}

export function renderQuestsView({ profile, rewards }) {
  const quests = getQuestStates(profile);
  const available = quest => quest.dungeonId && !getDungeonLockReason(profile, quest.dungeonId);
  const tracked = quests.find(quest => quest.ready && !quest.claimed)
    || quests.find(quest => !quest.claimed && available(quest))
    || quests.find(quest => !quest.claimed);
  const finished = quests.filter(quest => quest.claimed).length;
  const ordered = tracked ? [tracked, ...quests.filter(quest => quest !== tracked)] : quests;

  return `<main class="campaign-view journey-quests"><div class="journey-board journey-quests-board">
    <section class="journey-ledger" aria-label="行军任务">
      <header class="journey-quests-heading"><p>${tracked ? '完成远征，领取军令奖励' : '军令全部完成，可继续挑战远征'}</p><span>${finished} / ${quests.length} 已完成</span></header>
      <div class="journey-quest-list">
        ${ordered.map(quest => {
          const isTracked = quest === tracked;
          const stateClass = quest.claimed ? ' is-complete' : quest.ready ? ' is-ready' : '';
          const action = quest.claimed
            ? '<span class="journey-status">✓ 已领取</span>'
            : quest.ready
              ? `<button class="journey-action" data-claim="${quest.id}">领取奖励</button>`
              : quest.dungeonId
                ? `<button class="journey-action is-quiet" data-route="${quest.dungeonId}">前往远征</button>`
                : '<span class="journey-status">进行中</span>';
          return `<article class="journey-quest${isTracked ? ' is-tracked' : ''}${stateClass}">
            <div class="journey-quest-copy"><div class="journey-quest-title"><span class="journey-quest-label">${quest.claimed ? '已完成' : quest.ready ? '可领取' : isTracked ? '当前目标' : '后续军令'}</span><h3>${quest.name}</h3></div><p>${quest.description}</p>
              <div class="journey-quest-progress"><div class="journey-progress" role="progressbar" aria-label="${quest.name}进度" aria-valuemin="0" aria-valuemax="${quest.target}" aria-valuenow="${quest.progress}"><i style="--journey-progress:${progressOf(quest)}%"></i></div><span>${quest.progress} / ${quest.target}</span></div>
            </div>
            <div class="journey-quest-meta"><div class="journey-rewards">${rewards(quest.rewards)}</div></div>
            <div class="journey-quest-action">${action}</div>
          </article>`;
        }).join('')}
      </div>
    </section>
  </div></main>`;
}

export function renderMapView({ profile, selectedDungeon, rewards, enemyTraits }) {
  const dungeons = DUNGEONS.filter(item=>{const job=Object.values(HERO_JOBS).find(job=>job.trialId===item.id);return !job||job.heroId===profile.selectedHero;});
  const dungeon = dungeons.find(item => item.id === selectedDungeon) || dungeons[0];
  const selectedArt = journeyArt(dungeon);
  const lock = getDungeonLockReason(profile, dungeon);
  const cleared = profile.cleared?.includes(dungeon.id);

  return `<main class="campaign-view journey-expedition"><div class="journey-board journey-expedition-board">
    <section class="journey-stage">
      <img src="${selectedArt.src}" alt="${selectedArt.label}" style="object-position:${selectedArt.position}" draggable="false">
      <div class="journey-stage-shade"></div>
      <header><span>${dungeon.region}</span><h2>${dungeon.name}</h2><p>${dungeon.description}</p></header>
      <div class="journey-scene-picker" aria-label="选择远征场景" style="grid-template-columns:repeat(${dungeons.length},minmax(0,1fr))">
        ${dungeons.map(item => {
          const art = journeyArt(item);
          const reason = getDungeonLockReason(profile, item);
          return `<button class="journey-scene${item.id === dungeon.id ? ' is-selected' : ''}${reason ? ' is-locked' : ''}" data-dungeon="${item.id}" aria-pressed="${item.id === dungeon.id}">
            <img src="${art.src}" alt="" style="object-position:${art.position}" draggable="false">
            <i aria-hidden="true">◆</i>
            <span><b>${item.name}</b><small>${reason || item.region}</small></span>
          </button>`;
        }).join('')}
      </div>
    </section>
    <aside class="journey-brief">
      <header class="journey-heading"><div><span></span><h2>远征简报</h2><span></span></div><p>${cleared ? '已肃清，可重复挑战' : lock ? '路线尚未开放' : '斥候回报，可出征'}</p></header>
      <div class="journey-brief-title"><span>难度 ${dungeon.difficulty}</span><h2>${dungeon.name}</h2><p>${dungeon.description}</p></div>
      <dl class="journey-intel">
        <div><dt>敌人特征</dt><dd>${enemyTraits(dungeon.enemies)}</dd></div>
        <div><dt>作战目标</dt><dd>坚守 ${Math.ceil(dungeon.duration / 60)} 分钟并击败首领</dd></div>
        <div><dt>首领</dt><dd>${dungeon.boss.name}</dd></div>
      </dl>
      <section class="journey-loot"><span>远征奖励</span><div>${rewards(dungeon.rewards)}</div></section>
      ${lock ? `<div class="journey-lock"><b>尚未解锁</b><span>${lock}</span></div>` : `<button class="journey-depart" data-action="depart">${cleared ? '再次出征' : '开始远征'}</button>`}
    </aside>
  </div></main>`;
}
