import { HAND_LIMIT } from './hand-rules.js';

// Later cards cover the right side of earlier cards. The exposed left edge keeps
// both its mana cost and a 44px touch target; the inspected card reserves its full width.
export function createHandLayout(hand, counter) {
  let pending = null;
  let previousExpanded = null;
  let previousAvailable = -1;
  let previousWidth = -1;
  const refresh = () => {
    if (hand.dataset.dragging === 'true') return;
    const cards = [...hand.querySelectorAll('.hand-card')];
    const n = cards.length;
    const style = getComputedStyle(hand);
    const available = hand.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const width = cards[0]?.getBoundingClientRect().width ?? 0;
    const selected = cards.findIndex(card => card.classList.contains('selected'));
    const focused = document.activeElement?.matches(':focus-visible') ? cards.indexOf(document.activeElement) : -1;
    const expanded = selected >= 0 ? selected : focused;
    const stacked = n > 3 && n * width + (n - 1) * 8 > available;
    hand.classList.toggle('is-stacked', stacked);
    let step = width + 8;
    if (stacked) {
      const reserve = expanded >= 0 && expanded < n - 1 ? width + 4 : 0;
      const edges = Math.max(1, n - 1 - (reserve ? 1 : 0));
      step = Math.min(width, Math.max(44, (available - width - reserve) / edges));
    }
    cards.forEach((card, i) => {
      card.style.marginLeft = !i || !stacked ? '0px' : `${i - 1 === expanded ? 4 : step - width}px`;
      card.style.zIndex = String(i === expanded ? 100 : i + 1);
      card.dataset.handCovered = String(stacked && i < n - 1 && i !== expanded);
    });
    const supply = hand.dataset.supplyMode === 'true';
    const draw = hand.dataset.drawMode === 'true', mulligan = hand.dataset.mulliganMode === 'true';
    const text = mulligan ? `起手 ${n}张 · 待换${hand.dataset.mulliganCount}/2` : supply ? `剩余使用次数 ${hand.dataset.supplyRemaining}次` : `手牌 ${n}/${HAND_LIMIT}${n >= HAND_LIMIT ? draw ? ' · 手牌已满' : ' · 暂停抽牌' : ''}`;
    if (counter.textContent !== text) counter.textContent = text;
    counter.classList.toggle('is-full', !supply && n >= HAND_LIMIT);
    counter.title = mulligan ? '起手最多换2张，确认后开始行动。' : supply ? '每张牌有独立使用次数。补给可恢复已消耗的次数。' : draw ? `${hand.dataset.drawTiming==='start'?'回合开始':'回合结束'}抽1张。手牌最多6张，满手时新牌会被弃掉；牌库为空时抽牌使主将受到2点伤害。` : n >= HAND_LIMIT ? '满手时暂停抽牌，牌库保留；出牌后可继续抽牌。' : '最多六张手牌；满手时暂停抽牌，牌库保留。';
    // Reveal selection after relayout without moving the document or camera.
    if (expanded >= 0 && (cards[expanded] !== previousExpanded || available !== previousAvailable || width !== previousWidth)) {
      const rect = cards[expanded].getBoundingClientRect(), viewport = hand.getBoundingClientRect();
      if (rect.left < viewport.left + 4) hand.scrollLeft += rect.left - viewport.left - 4;
      else if (rect.right > viewport.right - 4) hand.scrollLeft += rect.right - viewport.right + 4;
    }
    previousExpanded = cards[expanded] ?? null;
    previousAvailable = available;
    previousWidth = width;
  };
  const schedule = () => {
    if (pending !== null) return;
    pending = requestAnimationFrame(() => { pending = null; refresh(); });
  };
  const resize = new ResizeObserver(schedule);
  resize.observe(hand);
  const mutations = new MutationObserver(schedule);
  mutations.observe(hand, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
  hand.addEventListener('focusin', schedule);
  hand.addEventListener('focusout', schedule);
  return { refresh };
}
