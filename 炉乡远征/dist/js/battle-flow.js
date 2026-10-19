export function createBattleFlow(host, { onSelect, onConfirm, makeCard }) {
  const opening = document.createElement('section');
  opening.className = 'opening-hand'; opening.hidden = true;
  opening.setAttribute('role', 'dialog'); opening.setAttribute('aria-modal', 'true'); opening.setAttribute('aria-label', '起手换牌');
  const prompt = document.createElement('p'); prompt.textContent = '最多可换2张牌';
  const cards = document.createElement('div'); cards.className = 'opening-cards';
  const confirm = document.createElement('button'); confirm.className = 'game-button opening-confirm'; confirm.textContent = '确认起手'; confirm.type = 'button';
  opening.append(prompt, cards, confirm);
  const toast = document.createElement('div'); toast.className = 'turn-toast'; toast.hidden = true; toast.setAttribute('role', 'status');
  host.append(opening, toast);
  let current = null, handKey = '', settle = null, timer = null;
  confirm.addEventListener('click', () => { if (confirm.disabled) return; confirm.disabled = true; onConfirm(); });
  function finish() { clearTimeout(timer); timer = null; toast.hidden = true; host.classList.remove('turn-transition'); const resolve = settle; settle = null; resolve?.(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });
  return {
    get busy() { return Boolean(settle); },
    sync(state, blocked) {
      const visible = state?.phase === 'mulligan' && !blocked;
      opening.hidden = !visible; host.classList.toggle('opening-hand-active', visible);
      if (!visible) return;
      const key = state.players[0].hand.join('|');
      if (current !== state || handKey !== key) {
        current = state; handKey = key;
        cards.replaceChildren(...state.players[0].hand.map((id, index) => {
          const button = makeCard(id, index);
          // The opening uses ordinary clicks, including touch and keyboard, rather than hand drag.
          button.addEventListener('click', event => { if (event.detail) onSelect(index); });
          return button;
        }));
      }
      [...cards.children].forEach((button, index) => { const selected = state.mulligan.includes(index); button.classList.toggle('replacing', selected); button.setAttribute('aria-pressed', String(selected)); button.disabled = !selected && state.mulligan.length >= 2; });
      confirm.disabled = false; confirm.textContent = state.mulligan.length ? `换${state.mulligan.length}张并开战` : '确认起手';
    },
    announce(text) {
      finish(); toast.textContent = text; toast.hidden = false; host.classList.add('turn-transition');
      if (document.hidden) { finish(); return Promise.resolve(); }
      return new Promise(resolve => { settle = resolve; timer = setTimeout(finish, matchMedia('(prefers-reduced-motion: reduce)').matches ? 240 : 820); });
    },
    cancel() { finish(); opening.hidden = true; host.classList.remove('opening-hand-active'); current = null; }
  };
}
