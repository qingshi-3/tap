import { getCard } from './cards.js';

// Read successful settlement facts only. A frozen battleRewards entry is an
// entitlement, not evidence that the inventory or currency was saved.
export function battleRewardSummary({ match, payout, profile, error = '' }) {
  if (match?.mode !== 'expedition' || match.phase !== 'over') return null;
  if (match.winner !== 0) return { status:'defeat', label:'本次未获得奖励', resources:[], cards:[] };
  const settlement = profile?.settlements?.[match.runId];
  if (!settlement || error) return { status:'unsaved', label:error ? `奖励未保存：${error}` : '奖励尚未保存', resources:[], cards:[] };
  const fresh = payout?.runId === match.runId && payout.ok === true && payout.duplicate === false;
  const receipt = fresh ? payout.reward : null;
  const resources = [];
  if (settlement.amount > 0) resources.push({ kind:'gold', amount:settlement.amount });
  const tickets = profile.recruitment?.victoryClaims?.[match.runId] ?? 0;
  if (tickets > 0) resources.push({ kind:'orb', amount:tickets });
  // unlocked includes compatibility grants actually applied by settle(), which
  // can differ from the frozen receipt. Never reconstruct it from milestones.
  const cards = fresh ? [...new Set([...(payout.unlocked?.units ?? []), ...(payout.unlocked?.spells ?? [])])]
    .map(getCard).filter(Boolean).map(card => ({ id:card.id, name:card.name, type:card.type })) : [];
  const label = settlement.firstClear ? '首次通关 · 奖励已到账'
    : receipt?.factionFirst ? '阵营首次通关 · 奖励已到账' : '本关奖励已到账';
  const details = [];
  if (receipt?.chapterCoins > 0) details.push(`含章节奖励 ${receipt.chapterCoins} 金币`);
  if (receipt?.compensationCoins > 0) details.push(`宝珠折算 ${receipt.compensationCoins} 金币`);
  return { status:'saved', label, resources, cards, details };
}

const node = (tag, className, text = '') => {
  const item = document.createElement(tag); item.className = className; item.textContent = text; return item;
};

// Mount inside the existing result dialog; this component has no reward writes,
// modal lifecycle or additional confirmation step.
export function renderBattleRewardSummary(host, options, drawArt) {
  const summary = battleRewardSummary(options);
  const sameRun = host.dataset.rewardRunId === options.match?.runId;
  const scrollLeft = sameRun ? host.querySelector('.battle-reward-cards')?.scrollLeft ?? 0 : 0;
  host.dataset.rewardRunId = options.match?.runId ?? '';
  host.replaceChildren(); host.hidden = !summary;
  if (!summary) return null;
  host.dataset.rewardStatus = summary.status;
  host.append(node('span', 'result-reward-line', summary.label));
  if (summary.resources.length) {
    const resources = node('span', 'battle-reward-resources');
    for (const reward of summary.resources) {
      const item = node('span', 'battle-reward-resource');
      const image = node('img', ''); image.alt = '';
      image.src = `./assets/metagame/original/${reward.kind === 'gold' ? 'resource-gold.png' : 'spirit-orb.png'}`;
      item.append(image, node('strong', '', `+${reward.amount} ${reward.kind === 'gold' ? '金币' : '灵魂宝珠'}`));
      resources.append(item);
    }
    host.append(resources);
  }
  if (summary.cards.length) {
    const list = node('span', 'battle-reward-cards'); list.setAttribute('aria-label', '本关新获得卡牌');
    list.tabIndex = 0;
    for (const card of summary.cards) {
      const item = node('span', 'battle-reward-card');
      const canvas = node('canvas', ''); canvas.width = 224; canvas.height = 176;
      canvas.dataset.cardArt = String(card.id); canvas.setAttribute('aria-hidden', 'true');
      item.append(canvas, node('strong', '', card.name), node('span', 'battle-reward-card-type', `新${card.type === 'spell' ? '法术' : '随从'}`));
      list.append(item);
      try { const result = drawArt?.(canvas, card.id); result?.catch?.(() => {}); } catch (_) { /* Name remains available if art fails. */ }
    }
    host.append(list);
    list.scrollLeft = scrollLeft;
  }
  for (const detail of summary.details ?? []) host.append(node('span', 'battle-reward-detail', detail));
  return summary;
}
