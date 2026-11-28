import { battleSpeedScale } from "./battle-motion.js";
import { cardRuleSections } from './card-rules.js';

export function createBattleFlow(host, { onSelect, onConfirm, makeCard, getCard }) {
  const opening = document.createElement('section');
  opening.className = 'opening-hand'; opening.hidden = true;
  opening.setAttribute('role', 'dialog'); opening.setAttribute('aria-modal', 'true'); opening.setAttribute('aria-label', '起手换牌');
  const prompt = document.createElement('p'); prompt.textContent = '最多可换2张牌';
  const cards = document.createElement('div'); cards.className = 'opening-cards';
  const confirm = document.createElement('button'); confirm.className = 'game-button opening-confirm'; confirm.textContent = '确认起手'; confirm.type = 'button';
  opening.append(prompt, cards, confirm);
  const toast = document.createElement('div'); toast.className = 'turn-toast'; toast.hidden = true; toast.setAttribute('role', 'status');
  host.append(opening, toast);
  let current = null, handKey = '', settle = null, timer = null, detail = null;
  function closeDetail() { detail?.close(); }
  function inspect(id, index, trigger) {
    const card = getCard?.(id); if (!card || detail) return;
    const dialog = document.createElement('dialog'); dialog.className = 'opening-card-detail';
    dialog.setAttribute('aria-label', card.name);
    const close = document.createElement('button'); close.type = 'button'; close.className = 'opening-detail-close'; close.textContent = '关闭';
    const heading = document.createElement('h2'); heading.textContent = card.name;
    const rules = document.createElement('div'); rules.className = 'opening-detail-rules'; rules.tabIndex = 0; rules.setAttribute('aria-label', '卡牌完整规则');
    for (const { label, text } of cardRuleSections(card)) {
      if (label && !['规则', '法术'].includes(label)) { const title = document.createElement('h3'); title.textContent = label; rules.append(title); }
      const paragraph = document.createElement('p'); paragraph.textContent = text; rules.append(paragraph);
    }
    const face = makeCard(id, index).querySelector('.game-card');
    if (face) { face.setAttribute('aria-hidden', 'true'); dialog.append(face); }
    dialog.append(heading, rules, close); opening.append(dialog); detail = dialog;
    close.addEventListener('click', closeDetail);
    dialog.addEventListener('cancel', event => { event.preventDefault(); event.stopPropagation(); closeDetail(); });
    dialog.addEventListener('close', () => { dialog.remove(); detail = null; if (trigger.isConnected && !opening.hidden) trigger.focus({ preventScroll: true }); }, { once: true });
    dialog.showModal(); close.focus({ preventScroll: true });
  }
  confirm.addEventListener('click', () => { if (confirm.disabled) return; confirm.disabled = true; onConfirm(); });
  function finish() { clearTimeout(timer); timer = null; toast.hidden = true; host.classList.remove('turn-transition'); const resolve = settle; settle = null; resolve?.(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });
  return {
    get busy() { return Boolean(settle); },
    sync(state, blocked) {
      const visible = state?.phase === 'mulligan' && !blocked;
      opening.hidden = !visible; host.classList.toggle('opening-hand-active', visible);
      if (!visible) { closeDetail(); return; }
      const key = state.players[0].hand.join('|');
      if (current !== state || handKey !== key) {
        current = state; handKey = key;
        cards.replaceChildren(...state.players[0].hand.map((id, index) => {
          const button = makeCard(id, index);
          const slot = document.createElement('div'); slot.className = 'opening-card-slot';
          button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-label', `${getCard?.(id)?.name ?? '卡牌'}，查看完整效果`);
          // Capture keyboard clicks too: the shared battle card otherwise toggles replacement.
          button.addEventListener('click', event => { event.stopImmediatePropagation(); inspect(id, index, button); }, true);
          const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'opening-card-toggle';
          toggle.addEventListener('click', () => onSelect(index));
          slot.append(button, toggle); return slot;
        }));
      }
      [...cards.children].forEach((slot, index) => {
        const selected = state.mulligan.includes(index), button = slot.firstElementChild, toggle = slot.lastElementChild;
        button.classList.toggle('replacing', selected); button.removeAttribute('aria-pressed'); button.disabled = false;
        toggle.textContent = selected ? '保留' : '换掉'; toggle.setAttribute('aria-pressed', String(selected));
        toggle.setAttribute('aria-label', `${getCard?.(state.players[0].hand[index])?.name ?? '卡牌'}，${selected ? '取消换牌' : '选择换牌'}`);
        toggle.disabled = !selected && state.mulligan.length >= 2;
      });
      confirm.disabled = false; confirm.textContent = state.mulligan.length ? `换${state.mulligan.length}张并开战` : '确认起手';
    },
    announce(text) {
      finish(); toast.textContent = text; toast.hidden = false; host.classList.add('turn-transition');
      if (document.hidden) { finish(); return Promise.resolve(); }
      return new Promise(resolve => { settle = resolve; timer = setTimeout(finish, matchMedia('(prefers-reduced-motion: reduce)').matches ? 220 : Math.max(240, Math.round(760 / battleSpeedScale()))); });
    },
    cancel() { closeDetail(); finish(); opening.hidden = true; host.classList.remove('opening-hand-active'); current = null; }
  };
}

