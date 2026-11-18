import { createExpeditionMatch } from './engine.js';
import { makeStarterDeck } from './battle-deck.js';
import { CAMPAIGN_UNIT_IDS } from './campaign-rules.js';
import { getFaction } from './factions.js';

// Self-test build switch. Disable for a formal public release.
export const ADVENTURE_PREVIEW_ENABLED = true;
export const ADVENTURE_PREVIEW_SCENARIOS = Object.freeze([
  { id: 'storm-02', label: '雷电光束' },
  { id: 'starfall-02', label: '引力陨星' }
]);

// No storage adapter or permanent profile is accepted by this session. Retained
// run IDs keep late/cloned callbacks from falling through to the real ledger.
export class AdventurePreviewSession {
  constructor() { this.generation = 0; this.current = null; this.pending = null; this.attempts = new WeakSet(); this.runIds = new Set(); }
  prepare(levelId) {
    if (!ADVENTURE_PREVIEW_SCENARIOS.some(item => item.id === levelId)) throw new Error('未知测试场景');
    const training = Object.fromEntries(CAMPAIGN_UNIT_IDS.map(id => [id, 2]));
    const match = createExpeditionMatch(levelId, training, null, 1, {
      deck: makeStarterDeck(1), spells: getFaction(1).spellIds.slice(0, 2),
      spellTraining: {}, spellModes: {}, specializations: {},
      growthVersion: Object.fromEntries(CAMPAIGN_UNIT_IDS.map(id => [id, 'low-v2']))
    }, { encounters: true });
    const candidate = { match, token: ++this.generation };
    this.attempts.add(match); this.runIds.add(match.runId); this.pending = candidate;
    return candidate;
  }
  isPending(candidate) { return this.pending === candidate && candidate.token === this.generation; }
  commit(candidate) { if (!this.isPending(candidate)) return false; this.current = candidate.match; this.pending = null; return true; }
  owns(state) { return !!state && this.current === state; }
  attempted(state) { return !!state && (this.attempts.has(state) || this.runIds.has(state.runId)); }
  checkpoint(state) { return { ok: this.owns(state) }; }
  leave() { this.generation++; this.pending = null; this.current = null; }
}

export function createAdventurePreviewPicker({ onChoose, onClose }) {
  const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = './adventure-preview.css'; document.head.append(style);
  const dialog = document.createElement('dialog'); dialog.id = 'adventure-preview-picker';
  dialog.setAttribute('aria-labelledby', 'adventure-preview-title');
  dialog.innerHTML = `<h2 id="adventure-preview-title">冒险测试</h2><p>测试进度仅本次有效，不计奖励。</p><div class="adventure-preview-options"></div><button type="button" data-preview-close>返回</button>`;
  for (const scenario of ADVENTURE_PREVIEW_SCENARIOS) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.previewScenario = scenario.id; button.textContent = scenario.label;
    button.addEventListener('click', () => { dialog.close(); onChoose(scenario.id); });
    dialog.querySelector('.adventure-preview-options').append(button);
  }
  dialog.querySelector('[data-preview-close]').addEventListener('click', () => { dialog.close(); onClose(); });
  dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close(); onClose(); });
  document.body.append(dialog);
  return { open: () => dialog.showModal(), get visible() { return dialog.open; } };
}
