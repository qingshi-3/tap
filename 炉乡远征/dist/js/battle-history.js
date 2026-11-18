import { buildBattleHistory } from './battle-history-model.js';
import { getCard } from './cards.js';
import { HEROES } from './factions.js';

const iconFor = event => {
  const word = `${event.keyword ?? ''} ${event.label ?? ''}`;
  if (/冻|冰/.test(word)) return 'keyword-freeze';
  if (/眩晕/.test(word)) return 'keyword-stun';
  if (/毒/.test(word)) return 'keyword-poison';
  if (/嘲讽/.test(word)) return 'keyword-taunt';
  if (/治疗|恢复/.test(word)) return 'keyword-overheal';
  if (/伤害/.test(word)) return 'keyword-magic-damage';
  if (/强化|狂暴/.test(word)) return 'keyword-attack';
  if (/飞行/.test(word)) return 'move-speed';
  if (/驱散/.test(word)) return 'keyword-follow-up';
  if (/亡愿|死亡/.test(word)) return 'keyword-deathrattle';
  return ({ attack:'keyword-attack', damage:'keyword-magic-damage', burn:'keyword-magic-damage', heal:'keyword-overheal', death:'keyword-deathrattle', summon:'role-summoner', move:'move-speed', armor:'keyword-taunt', spell:'mana', skill:'mana', forecast:'role-summoner', cancel:'keyword-follow-up', close:'keyword-deathrattle' })[event.kind] ?? 'keyword-follow-up';
};

export function createBattleHistory({ root, trigger, panel, list, state, beforeOpen, drawArt }) {
  let battle = null, signature = '', returnFocus = null, generation = 0;
  const isOpen = () => !panel.hidden;
  const modalOpen = () => document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]:not([hidden])');
  function close(restoreFocus = true) {
    if (!isOpen()) return;
    generation++;
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-label', '打开战斗记录');
    trigger.textContent = '记录';
    if (restoreFocus && !root.closest('[hidden]') && returnFocus?.isConnected && !returnFocus.closest('[inert]')) returnFocus.focus({ preventScroll: true });
  }
  function fitPanel() {
    if (!isOpen() || root.closest('[hidden]')) return;
    const hand = document.querySelector('#match .hand-zone');
    const bottom = hand?.getBoundingClientRect().top ?? window.innerHeight;
    // Match the actual hand boundary, including compact layouts and safe areas.
    const height = Math.max(0, Math.floor(bottom - root.getBoundingClientRect().top - 8));
    root.style.setProperty('--battle-history-available-height', `${height}px`);
  }
  function render(force = false) {
    const groups = buildBattleHistory(state()).groups;
    const next = JSON.stringify(groups);
    if (!force && signature === next) return;
    const atStart = list.scrollTop < 24;
    const previousTop = list.scrollTop;
    const anchor = [...list.children].find(item => item.offsetTop >= previousTop);
    const anchorKey = anchor?.dataset.historyKey;
    const anchorOffset = anchor ? anchor.offsetTop - previousTop : 0;
    const epoch = ++generation;
    signature = next;
    const fragment = document.createDocumentFragment();
    const artQueue = [];
    const occurrences = new Map();
    const portrait = (id, displayName) => {
      const face = document.createElement('span');
      face.className = 'battle-history-face';
      const hero = Object.values(HEROES).find(hero => Number(hero.bbsCardId) === Number(id));
      const artId = hero?.id ?? id;
      const card = getCard(artId);
      if (id != null && card) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 96;
        canvas.setAttribute('aria-hidden', 'true');
        canvas.dataset.cardArt = String(artId);
        const name = document.createElement('span');
        name.className = 'battle-history-name';
        name.textContent = displayName ?? hero?.name ?? card.name;
        face.append(canvas, name);
        artQueue.push(canvas);
        canvas.dataset.cardId = String(artId);
      }
      return face;
    };
    let heading = null, count = 0;
    for (const group of [...groups].reverse()) {
      if (heading !== group.round) {
        heading = group.round;
        const label = document.createElement('li');
        label.className = 'battle-history-turn';
        label.textContent = heading ? `第${heading}回合` : '起手';
        fragment.append(label);
      }
      for (const event of [...group.events].reverse()) {
        const item = document.createElement('li');
        item.className = `battle-history-event${event.effects ? ' battle-history-spell' : ''} tone-${['damage','heal','freeze','buff','summon'].includes(event.tone) ? event.tone : 'neutral'}`;
        const baseKey = JSON.stringify([group.round, group.side, event]);
        const occurrence = occurrences.get(baseKey) ?? 0;
        occurrences.set(baseKey, occurrence + 1);
        item.dataset.historyKey = `${baseKey}:${occurrence}`;
        item.setAttribute('aria-label', `${group.side === 1 ? '敌方' : '我方'}：${event.detail || [event.label,event.amount].filter(value => value != null).join(' ')}`);
        const side = document.createElement('span');
        side.className = `battle-history-side side-${group.side}`;
        side.textContent = group.side === 1 ? '敌' : '我';
        const action = document.createElement('span');
        action.className = 'battle-history-action';
        const icon = document.createElement('img');
        icon.src = `./assets/ui/keywords/${iconFor(event)}.svg`;
        icon.alt = ''; icon.width = icon.height = 22;
        const text = document.createElement('span');
        const actionText = event.keyword || event.label || '';
        const keywordPattern = /(冻结|冰封|碎冰|嘲讽|飞行|狂暴|驱散|强化)/g;
        const keywordClass = { 冻结:'freeze', 冰封:'freeze', 碎冰:'freeze', 嘲讽:'taunt', 飞行:'flying', 狂暴:'rage', 驱散:'dispel', 强化:'buff' };
        for (const part of actionText.split(keywordPattern).filter(Boolean)) {
          if (!keywordClass[part]) { text.append(document.createTextNode(part)); continue; }
          const keyword = document.createElement('span');
          keyword.className = `battle-history-keyword-${keywordClass[part]}`;
          keyword.textContent = part;
          text.append(keyword);
        }
        action.append(icon, text);
        if (event.amount != null && event.amount !== '') {
          const amount = document.createElement('strong');
          amount.className = 'battle-history-amount';
          amount.textContent = typeof event.amount === 'number' && event.amount > 0
            ? `${event.tone === 'heal' ? '+' : event.tone === 'damage' && event.kind !== 'forecast' ? '−' : ''}${event.amount}`
            : event.amount;
          action.append(amount);
        }
        item.append(side);
        if (event.casterId != null) item.append(portrait(event.casterId,event.casterName));
        if (event.sourceId != null) item.append(portrait(event.sourceId, event.sourceName));
        if (event.effects) {
          action.replaceChildren();
          if (event.cell) {
            const cell = document.createElement('span'); cell.className = 'battle-history-spell-cell'; cell.textContent = `（${event.cell.x},${event.cell.y}）`; action.append(cell);
          }
          for (const effect of event.effects) {
            const result = document.createElement('span'); result.className = `battle-history-spell-result tone-${effect.tone}`;
            if (effect.targetId != null) result.append(portrait(effect.targetId, effect.targetName));
            const symbol = document.createElement('img'); symbol.src = `./assets/ui/keywords/${iconFor(effect)}.svg`; symbol.alt = ''; symbol.width = symbol.height = 22;
            const label = document.createElement('span');
            label.textContent = effect.keyword || effect.label;
            result.append(symbol, label);
            if (effect.amount != null && effect.amount !== '') {
              const amount = document.createElement('strong'); amount.className = 'battle-history-amount';
              amount.textContent = typeof effect.amount === 'number' ? `${effect.kind === 'heal' ? '+' : effect.kind === 'damage' ? '−' : ''}${effect.amount}` : effect.amount;
              result.append(amount);
            }
            if (effect.cell) { const cell = document.createElement('span'); cell.textContent = `（${effect.cell.x},${effect.cell.y}）`; result.append(cell); }
            action.append(result);
          }
          if (!event.effects.length) { const cast = document.createElement('span'); cast.textContent = '施放'; action.append(cast); }
        }
        item.append(action);
        if (event.targetId != null) {
          const arrow = document.createElement('span');
          arrow.className = 'battle-history-arrow'; arrow.textContent = '→';
          item.append(arrow, portrait(event.targetId, event.targetName));
        }
        fragment.append(item); count++;
      }
    }
    if (!count) {
      const empty = document.createElement('li');
      empty.textContent = '尚无战斗行动';
      fragment.append(empty);
    }
    list.replaceChildren(fragment);
    const retained = anchorKey && [...list.children].find(item => item.dataset.historyKey === anchorKey);
    list.scrollTop = force || atStart ? 0 : retained ? retained.offsetTop - anchorOffset : previousTop;
    // Each render owns new canvases: late asset loads can never paint a newer row.
    for (const canvas of artQueue) {
      if (epoch !== generation || !isOpen()) break;
      try {
        const result = drawArt?.(canvas, Number(canvas.dataset.cardId));
        Promise.resolve(result).catch(() => {});
      } catch (_) { /* The visible card name remains the fallback. */ }
    }
  }
  function sync() {
    const next = state();
    if (battle !== next || root.closest('[hidden]')) close(false);
    battle = next;
    if (isOpen()) { fitPanel(); render(); }
  }
  function toggle() {
    if (isOpen()) { close(); return; }
    if (!state() || root.closest('[hidden]') || modalOpen()) return;
    beforeOpen?.();
    battle = state();
    returnFocus = trigger;
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    trigger.setAttribute('aria-label', '收起战斗记录');
    trigger.textContent = '收起';
    fitPanel();
    render(true);
    list.focus({ preventScroll: true });
  }
  // A drag may consume Chromium's next compatibility click even after the
  // following tap has delivered a complete pointer sequence. Commit a genuine
  // touch tap on release, then ignore its optional native compatibility click.
  let touchPress = null, touchReleased = -Infinity;
  trigger.addEventListener('pointerdown', event => {
    touchPress = event.isPrimary && event.pointerType === 'touch' && !trigger.disabled
      ? { id:event.pointerId, x:event.clientX, y:event.clientY, moved:false } : null;
  });
  trigger.addEventListener('pointermove', event => {
    if (touchPress?.id === event.pointerId && Math.hypot(event.clientX-touchPress.x,event.clientY-touchPress.y)>10) touchPress.moved = true;
  });
  trigger.addEventListener('pointercancel', () => { touchPress = null; });
  trigger.addEventListener('pointerup', event => {
    const press = touchPress; touchPress = null;
    if (!press || press.id !== event.pointerId || press.moved || trigger.disabled || !trigger.contains(document.elementFromPoint(event.clientX,event.clientY))) return;
    touchReleased = performance.now(); toggle();
  });
  trigger.addEventListener('click', event => {
    if (event.detail && performance.now()-touchReleased<750 && (event.pointerType === 'touch' || event.sourceCapabilities?.firesTouchEvents || event.pointerType === undefined)) return;
    toggle();
  });
  window.addEventListener('resize', fitPanel);
  const layoutObserver = new ResizeObserver(fitPanel);
  layoutObserver.observe(document.getElementById('match'));
  const hand = document.querySelector('#match .hand-zone');
  if (hand) layoutObserver.observe(hand);
  root.addEventListener('keydown', event => {
    // Keep history keyboard controls independent of battle animation input locks.
    event.stopPropagation();
    if (event.key === 'Escape' && isOpen()) { event.preventDefault(); close(); }
  });
  document.addEventListener('pointerdown', event => {
    if (isOpen() && !root.contains(event.target)) close(false);
  }, { capture: true, passive: true });
  // Native modal dialogs own focus; never steal it back when they appear.
  const observer = new MutationObserver(() => {
    if (root.closest('[hidden]') || modalOpen() || !document.getElementById('game-result')?.hidden) close(false);
  });
  observer.observe(document.getElementById('match'), { attributes: true, attributeFilter: ['hidden'], subtree: true });
  observer.observe(document.body, { attributes: true, attributeFilter: ['open', 'hidden'], subtree: true });
  return { sync, close, isOpen };
}
