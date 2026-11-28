import { getAdventureAbilityOptions, previewAdventureAbility, useAdventureAbility } from './engine.js';

const names = { 9201: '连锁放电', 9202: '贯穿炮', 9203: '引力井', 9204: '陨星轰击' };
const directions = { east: [1, 0], south: [0, 1], west: [-1, 0], north: [0, -1] };

// The controller keeps aiming state outside the saved battle. Every confirmation
// re-enters the authoritative command API with the revision used by the preview.
export function createAdventureControls({ read, renderer, board, host, ready, prepare, refresh, execute, hint, cancelBoundary }) {
  const panel = document.createElement('div');
  panel.className = 'adventure-controls';
  panel.hidden = true;
  panel.innerHTML = '<button class="button button-primary adventure-ability" type="button"><span></span><b></b></button><button class="button button-secondary adventure-cancel" type="button" hidden>取消</button><span id="adventure-ability-status" class="adventure-summary" role="status" hidden></span>';
  host.append(panel);
  const button = panel.querySelector('.adventure-ability');
  const cancelButton = panel.querySelector('.adventure-cancel');
  const summary = panel.querySelector('.adventure-summary');
  let aim = null, gesture = null, suppressedUntil = 0, tapReadyUntil = 0;
  let optionCache = null;

  function selected() {
    const state = read();
    return state?.units.find(unit => unit.unitId === (aim?.unitId ?? state.selectedUnitId));
  }

  function options() {
    const state = read(), unit = selected();
    if (!state?.adventure || !names[unit?.cardId] || unit.owner !== 0) return null;
    const key = [state.revision, state.round, state.currentPlayer, state.phase, unit.unitId, state.players[0].mana, unit.attacked, unit.stunned, unit.silenced].join(':');
    if (optionCache?.state !== state || optionCache.key !== key) optionCache = { state, key, value: getAdventureAbilityOptions(state, unit.unitId) };
    return optionCache.value;
  }

  function cancel(update = true) {
    aim = null;
    gesture = null;
    tapReadyUntil = 0;
    if (update) refresh();
  }

  function begin() {
    const state = read(), unit = selected(), choice = options();
    if (!ready() || !choice?.available) return false;
    prepare();
    aim = { state, unitId: unit.unitId, abilityId: choice.abilityId, revision: state.revision, command: null, preview: null };
    refresh();
    return true;
  }

  function commandAt(cell) {
    const state = read(), unit = selected(), choice = options();
    if (!aim || !cell || !unit || !choice) return null;
    const command = { unitId: unit.unitId, abilityId: choice.abilityId, revision: aim.revision };
    if (choice.type === 'unit') command.targetId = state.units.find(target => target.x === cell.x && target.y === cell.y)?.unitId;
    else if (choice.type === 'direction') {
      const dx = cell.x - unit.x, dy = cell.y - unit.y;
      if (dx && !dy) command.direction = dx > 0 ? 'east' : 'west';
      else if (dy && !dx) command.direction = dy > 0 ? 'south' : 'north';
      else return null;
    } else command.cell = { x: cell.x, y: cell.y };
    return command;
  }

  function showPreview(cell, confirm = false) {
    if (!aim || !ready()) return false;
    const command = commandAt(cell);
    const previous = aim.command && JSON.stringify(aim.command);
    const result = command && previewAdventureAbility(read(), command);
    aim.command = result?.ok ? command : null;
    aim.preview = result?.ok ? result : null;
    if (!result?.ok) {
      if (confirm) hint(result?.reason || '请选择高亮目标');
      refresh();
      return false;
    }
    if (confirm && previous === JSON.stringify(command)) return submit();
    refresh();
    return true;
  }

  function submit() {
    if (!aim?.command || !ready()) return false;
    const command = aim.command;
    cancel(false);
    void execute(() => useAdventureAbility(read(), command), '战局已变化，请重新选择技能目标。');
    return true;
  }

  function pointerOptions() {
    const choice = options();
    return { preferUnits: choice?.type === 'unit', unitIds: choice?.type === 'unit' ? choice.unitIds : null };
  }

  function aimAt(event, confirm = false) {
    if (event.clientY >= cancelBoundary()) return false;
    const cell = renderer.positionFromPointer(event, pointerOptions());
    return showPreview(cell, confirm);
  }

  function renderOptions() {
    const choice = options(), unit = selected();
    if (!aim || !choice || !unit) return {};
    let cells = choice.cells || [];
    if (choice.type === 'direction') {
      cells = Object.entries(directions).flatMap(([direction, [dx, dy]]) => {
        const command = { unitId: aim.unitId, abilityId: aim.abilityId, revision: aim.revision, direction };
        const preview = previewAdventureAbility(read(), command);
        return preview.ok ? preview.cells || [{ x: unit.x + dx, y: unit.y + dy }] : [];
      });
    }
    return {
      selectedUnitId: null,
      commandTargets: { type: choice.type === 'unit' ? 'unit' : 'cell', unitIds: choice.unitIds || [], cells },
      cardFollowupActive: true,
      adventurePreview: aim.preview,
      adventureSource: unit,
    };
  }

  function sync() {
    const state = read();
    if (aim && (aim.state !== state || aim.revision !== state?.revision || !ready())) cancel(false);
    const unit = selected(), choice = options();
    panel.hidden = !unit || !choice || host.hidden || !ready() || Boolean(host.querySelector('#hand .hand-card.selected'));
    if (panel.hidden) return;
    panel.classList.toggle('is-aiming', Boolean(aim));
    button.querySelector('span').textContent = aim ? aim.preview ? '施放' : '选目标' : names[unit.cardId];
    button.querySelector('b').textContent = `${choice.cost}法力`;
    button.setAttribute('aria-label', `${names[unit.cardId]}，${choice.cost}法力${unit.cardId === 9202 ? `，充能${choice.charge ?? 0}/2` : ''}`);
    button.setAttribute('aria-pressed', String(Boolean(aim)));
    button.disabled = !choice.available;
    cancelButton.hidden = !aim;
    const preview = aim?.preview;
    const damage = (preview?.statChanges || []).filter(change => change.kind === 'damage').reduce((sum, change) => sum + change.amount, 0);
    if (aim) {
      const targetCount = preview?.targetIds?.length || new Set(preview?.moves?.map(move => move.unitId)).size || 0;
      summary.textContent = preview
        ? `${targetCount}目标${damage ? ` · ${damage}伤害` : ''}`
        : ({ 9201: '选择传导目标', 9202: '选择开炮方向', 9203: '选择引力中心', 9204: '选择陨击中心' })[unit.cardId];
    } else {
      const charge = unit.cardId === 9202 ? choice.charge === 2 ? '过载就绪' : choice.charge === 1 ? '充能1/2' : '' : '';
      const reason = choice.used ? '本回合已用' : choice.reason || '';
      summary.textContent = [charge, reason].filter(Boolean).join(' · ');
    }
    summary.hidden = !summary.textContent;
    summary.classList.toggle('is-charged', !aim && unit.cardId === 9202 && choice.charge === 2);
    if (summary.hidden) button.removeAttribute('aria-describedby');
    else button.setAttribute('aria-describedby', summary.id);
    // One fixed operation lane keeps both allies and enemies directly touchable.
    // The aiming summary floats above this lane without moving the buttons.
    panel.style.left = 'var(--ui-left, 8px)';
    panel.style.top = `${cancelBoundary() - host.getBoundingClientRect().top}px`;
  }

  button.addEventListener('click', event => {
    if (event.detail) {
      // A map closes on pointerdown; its compatibility click can land here.
      // Only accept pointer clicks whose press/release belonged to this button.
      const now = performance.now();
      if (now < suppressedUntil || now > tapReadyUntil) return;
      tapReadyUntil = 0;
    }
    if (aim?.command) submit();
    else if (aim) { cancel(); board.focus({ preventScroll: true }); }
    else if (begin()) board.focus({ preventScroll: true });
  });
  cancelButton.addEventListener('click', () => { cancel(); board.focus({ preventScroll: true }); });
  button.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || button.disabled) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('pointermove', event => {
    if (gesture?.id !== event.pointerId) return;
    if (!gesture.dragging && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 10) return;
    if (!gesture.dragging) { if (!aim && !begin()) return; gesture.dragging = true; }
    event.preventDefault();
    aimAt(event);
  });
  button.addEventListener('pointerup', event => {
    if (gesture?.id !== event.pointerId) return;
    const dragged = gesture.dragging;
    gesture = null;
    if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
    if (!dragged) { tapReadyUntil = performance.now() + 750; return; }
    suppressedUntil = performance.now() + 600;
    if (aimAt(event)) submit();
    else cancel();
  });
  button.addEventListener('pointercancel', () => cancel());
  for (const event of ['blur', 'pagehide']) window.addEventListener(event, () => cancel());
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  const hand = host.querySelector('#hand');
  if (hand) {
    // Hand inspection deliberately preserves the board selection. Hide its skill
    // lane when input moves to a card, including pointer and keyboard selection.
    new MutationObserver(records => {
      if (records.some(record => record.target.classList.contains('hand-card')
        && record.target.classList.contains('selected') !== /\bselected\b/.test(record.oldValue || ''))) sync();
    }).observe(hand, { attributes: true, attributeFilter: ['class'], attributeOldValue: true, subtree: true });
  }

  function keydown(event) {
    if (!aim) return false;
    if (event.key === 'Escape') { cancel(); button.focus({ preventScroll: true }); return true; }
    if (event.key === 'Enter' || event.key === ' ') { submit(); return true; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return false;
    const option = renderOptions().commandTargets;
    const cells = option.type === 'unit' ? read().units.filter(unit => option.unitIds.includes(unit.unitId)) : option.cells;
    if (!cells.length) return true;
    const offset = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
    aim.cursor = ((aim.cursor ?? -1) + offset + cells.length) % cells.length;
    renderer.focusCell(cells[aim.cursor].x, cells[aim.cursor].y);
    showPreview(cells[aim.cursor]);
    return true;
  }

  return { get active() { return Boolean(aim); }, sync, cancel, renderOptions, pointerOptions, aimAt, keydown };
}
