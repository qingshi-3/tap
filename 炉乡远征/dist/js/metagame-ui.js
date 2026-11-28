import { createGameCard, TYPE_LABELS } from './game-card.js';
import { isTrialUnlocked } from './levels.js';

const esc = (value) => globalThis.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/["\\]/g, '\\$&');

export class MetagameUI {
  constructor({ levels, cards, drawCardArt, drawCardIdle, onSelectLevel }) {
    this.levels = Array.isArray(levels) ? levels : [];
    this.cards = cards || {};
    this.drawCardArt = typeof drawCardArt === 'function' ? drawCardArt : () => {};
    this.drawCardIdle = typeof drawCardIdle === 'function' ? drawCardIdle : () => 0;
    this.onSelectLevel = typeof onSelectLevel === 'function' ? onSelectLevel : () => {};
    this.completed = new Set(); this.attempted = new Set();
    this.selectedLevelId = this.levels[0]?.id ?? null;
    this.resumeSnapshot = null; this.progressError = ''; this.filter = 'all';
    this.selectedCardId = Number(Object.keys(this.cards)[0]) || null;
    this.visibleCards = []; this.dialogCards = []; this.dialogIndex = 0; this.dialogTrigger = null;
    this.root = document.getElementById('lobby');
    if (!this.root) return;
    this.els = {
      list: this.root.querySelector('#level-list'),
      overview: this.root.querySelector('[data-chapter-view="overview"]'),
      levels: this.root.querySelector('[data-chapter-view="levels"]'),
      campaign: this.root.querySelector('[data-meta-panel="campaign"]'),
      codex: this.root.querySelector('[data-meta-panel="codex"]'),
      grid: this.root.querySelector('[data-codex-grid]'),
      mission: this.root.querySelector('#mission-dialog'),
      cardDialog: this.root.querySelector('#card-dialog'),
      dossier: this.root.querySelector('[data-card-dossier]')
    };
    this.bindIdleAnimation();
    this.bindNavigation();
    this.renderLevelList(); this.renderCodex(); this.renderProgress(); this.renderBrief();
  }

  bindIdleAnimation() {
    this.idleVisible = new Set();
    this.idleTargets = [];
    this.idleTimer = null;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    this.idleObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio > 0) this.idleVisible.add(entry.target);
        else this.idleVisible.delete(entry.target);
      }
      this.syncIdleAnimation();
    }, { root: this.els.grid, threshold: 0 });
    // Visibility changes include leaving the lobby and native modal open/close.
    this.idleVisibilityObserver = new MutationObserver(() => this.syncIdleAnimation());
    for (const target of [this.root, this.els.cardDialog, this.els.mission]) {
      if (target) this.idleVisibilityObserver.observe(target, { attributes: true, attributeFilter: ['hidden', 'open', 'data-screen'] });
    }
    document.addEventListener('visibilitychange', () => this.syncIdleAnimation());
    this.reducedMotion.addEventListener('change', () => {
      if (this.reducedMotion.matches) this.refreshArt();
      else this.syncIdleAnimation();
    });
  }

  syncIdleAnimation() {
    clearTimeout(this.idleTimer); this.idleTimer = null;
    this.idleTargets = [];
    if (this.root.hidden || document.hidden || this.reducedMotion.matches) return;
    if (this.els.cardDialog?.open) {
      this.idleTargets = [...this.els.dossier.querySelectorAll('canvas[data-card-art]')];
    } else if (this.root.dataset.screen === 'codex' && !this.els.mission?.open) {
      this.idleTargets = [...this.idleVisible].filter((canvas) => canvas.isConnected);
    }
    this.idleTargets = this.idleTargets.filter((canvas) => this.cards[canvas.dataset.cardArt]?.type !== 'spell');
    this.tickIdleAnimation();
  }

  tickIdleAnimation() {
    // One shared timer, scheduled at the next authored sprite frame boundary.
    // No DOM layout reads, pixel scans or independent timers per card here.
    let next = Infinity;
    const animated = [];
    const now = performance.now();
    for (const canvas of this.idleTargets) {
      const delay = this.drawCardIdle(canvas, Number(canvas.dataset.cardArt), now);
      if (delay > 0) { next = Math.min(next, delay); animated.push(canvas); }
    }
    this.idleTargets = animated;
    if (Number.isFinite(next)) this.idleTimer = setTimeout(() => this.tickIdleAnimation(), Math.max(16, Math.ceil(next)));
  }

  bindNavigation() {
    this.root.querySelectorAll('[data-open-chapter]').forEach((button) => button.addEventListener('click', () => this.showChapter(this.selectedLevelId)));
    this.root.querySelector('[data-meta-back]')?.addEventListener('click', () => {
      if (this.root.dataset.screen === 'codex') this.showPage('campaign');
      else this.showOverview();
    });
    this.root.querySelectorAll('[data-meta-page]').forEach((button) => button.addEventListener('click', () => this.showPage(button.dataset.metaPage, button)));
    this.root.querySelectorAll('[data-card-filter]').forEach((button) => button.addEventListener('click', () => {
      this.filter = button.dataset.cardFilter;
      this.root.querySelectorAll('[data-card-filter]').forEach((item) => {
        const active = item === button; item.classList.toggle('is-active', active); item.setAttribute('aria-pressed', String(active));
      });
      this.renderCodex();
    }));
    this.root.querySelector('[data-close-mission]')?.addEventListener('click', () => { this.els.mission?.close(); this.restoreMissionFocus(); });
    this.root.querySelector('[data-close-card]')?.addEventListener('click', () => this.closeCardDialog());
    this.root.querySelector('[data-card-prev]')?.addEventListener('click', () => this.stepCard(-1));
    this.root.querySelector('[data-card-next]')?.addEventListener('click', () => this.stepCard(1));
    this.root.querySelector('[data-codex-prev]')?.addEventListener('click', () => this.scrollCodex(-1));
    this.root.querySelector('[data-codex-next]')?.addEventListener('click', () => this.scrollCodex(1));
    this.els.grid?.addEventListener('scroll', () => this.updateCodexPage(), { passive: true });
    this.els.grid?.addEventListener('pointerdown', (event) => {
      this.gridPointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
      this.suppressGridClick = false;
    }, { passive: true });
    this.els.grid?.addEventListener('pointermove', (event) => {
      const start = this.gridPointerStart;
      if (start?.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) this.suppressGridClick = true;
    }, { passive: true });
    this.els.grid?.addEventListener('click', (event) => {
      if (!this.suppressGridClick) return;
      event.preventDefault(); event.stopPropagation(); this.suppressGridClick = false;
    }, true);
    this.els.grid?.addEventListener('keydown', (event) => {
      if (event.target instanceof HTMLButtonElement) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); this.scrollCodex(event.key === 'ArrowLeft' ? -1 : 1);
      }
    });
    this.els.cardDialog?.addEventListener('cancel', (event) => { event.preventDefault(); this.closeCardDialog(); });
    this.els.mission?.addEventListener('cancel', (event) => { event.preventDefault(); this.els.mission.close(); this.restoreMissionFocus(); });
    window.addEventListener('resize', () => this.updateCodexPage(), { passive: true });
  }

  setScreen(screen) {
    this.root.dataset.screen = screen;
    const back = this.root.querySelector('[data-meta-back]');
    if (back) back.hidden = screen === 'home';
  }

  showOverview() {
    this.els.levels.hidden = true; this.els.overview.hidden = false; this.setScreen('home');
    this.root.querySelector('[data-open-chapter]')?.focus();
  }

  showPage(page, trigger) {
    const codex = page === 'codex';
    this.els.campaign.hidden = codex; this.els.codex.hidden = !codex;
    this.root.querySelectorAll('[data-meta-page]').forEach((button) => {
      const active = button.dataset.metaPage === page; button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
    });
    this.setScreen(codex ? 'codex' : (this.els.levels.hidden ? 'home' : 'levels'));
    if (codex) { this.refreshArt(); requestAnimationFrame(() => this.updateCodexPage()); }
    (trigger || this.root.querySelector(`[data-meta-page="${page}"]`))?.focus();
  }

  showChapter(levelId) {
    if (this.levels.some((level) => level.id === levelId) && levelId !== this.selectedLevelId) this.selectLevel(levelId, true);
    this.showPage('campaign'); this.els.overview.hidden = true; this.els.levels.hidden = false; this.setScreen('levels');
    this.els.list?.querySelector(`[data-level-id="${esc(this.selectedLevelId || '')}"]`)?.focus();
  }

  closeOverlays() {
    if (this.els.cardDialog?.open) this.els.cardDialog.close();
    if (this.els.mission?.open) this.els.mission.close();
    this.dialogTrigger = null;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  refresh({ completed, attempted, selectedLevelId, resumeSnapshot, progressError } = {}) {
    this.completed = completed instanceof Set ? completed : new Set(completed || []);
    this.attempted = attempted instanceof Set ? attempted : new Set(attempted || []);
    if (this.levels.some((level) => level.id === selectedLevelId)) this.selectedLevelId = selectedLevelId;
    this.resumeSnapshot = resumeSnapshot || null; this.progressError = progressError || '';
    this.renderProgress(); this.renderLevelList(); this.renderBrief();
  }

  renderProgress() {
    const total = this.levels.length, count = this.levels.filter((level) => this.completed.has(level.id)).length;
    this.root.querySelectorAll('[data-complete-count], [data-level-progress]').forEach((el) => { el.textContent = `${count} / ${total}`; });
    const medal = this.root.querySelector('[data-chapter-medal]');
    if (medal) {
      const earned = total > 0 && count === total; medal.classList.toggle('is-earned', earned);
      const state = medal.querySelector('small'); if (state) state.textContent = earned ? '章节试炼全部完成' : '完成全部试炼获得';
    }
    const error = this.root.querySelector('[data-progress-error]');
    if (error) { error.textContent = this.progressError; error.hidden = !this.progressError; }
  }

  isUnlocked(level) { return isTrialUnlocked(level.id, this.completed); }

  renderLevelList() {
    if (!this.els.list) return;
    const focused = document.activeElement?.dataset?.levelId; this.els.list.replaceChildren();
    this.levels.forEach((level, index) => {
      const complete = this.completed.has(level.id), unlocked = this.isUnlocked(level, index);
      const button = document.createElement('button'); button.type = 'button';
      button.className = `meta-level${this.selectedLevelId === level.id ? ' is-selected' : ''}${complete ? ' is-complete' : ''}${unlocked ? '' : ' is-locked'}`;
      button.dataset.levelId = level.id; button.setAttribute('aria-label', `${level.title}，${complete ? '已完成' : unlocked ? '可挑战' : '未解锁'}`);
      const image = document.createElement('img'); image.src = `./assets/metagame/original/challenge-gate-00${index % 3}.jpg`; image.alt = '';
      const number = document.createElement('span'); number.className = 'meta-level-number'; number.textContent = String(index + 1).padStart(2, '0');
      const copy = document.createElement('span'); copy.className = 'meta-level-copy';
      const title = document.createElement('strong'); title.textContent = level.title;
      const subtitle = document.createElement('small'); subtitle.textContent = level.subtitle || level.goal || ''; copy.append(title, subtitle);
      const state = document.createElement('span'); state.className = 'meta-level-state';
      state.textContent = complete ? '已完成' : unlocked ? (this.attempted.has(level.id) ? '已尝试' : '未尝试') : '未解锁';
      button.append(image, number, copy, state);
      button.addEventListener('click', () => this.selectLevel(level.id, true, true, button)); this.els.list.append(button);
    });
    if (focused) this.els.list.querySelector(`[data-level-id="${esc(focused)}"]`)?.focus();
  }

  selectLevel(levelId, notify, open = false, trigger = null) {
    if (!this.levels.some((level) => level.id === levelId)) return;
    this.selectedLevelId = levelId; this.renderLevelList(); this.renderBrief();
    if (notify) this.onSelectLevel(levelId);
    if (open && this.els.mission && !this.els.mission.open) {
      this.missionTriggerId = trigger?.dataset.levelId || levelId; this.els.mission.showModal();
    }
  }

  restoreMissionFocus() {
    requestAnimationFrame(() => this.els.list?.querySelector(`[data-level-id="${esc(this.missionTriggerId || this.selectedLevelId)}"]`)?.focus());
  }

  renderBrief() {
    const level = this.levels.find((item) => item.id === this.selectedLevelId); if (!level) return;
    const index = this.levels.indexOf(level), complete = this.completed.has(level.id), unlocked = this.isUnlocked(level, index);
    const set = (selector, value) => { const el = this.root.querySelector(selector); if (el) el.textContent = value; };
    set('[data-brief-number]', String(index + 1).padStart(2, '0')); set('[data-brief-title]', level.title);
    set('[data-brief-subtitle]', level.subtitle || '固定战术局面'); set('[data-brief-goal]', level.goal || '击败敌方主将');
    set('[data-brief-turns]', `${level.turnLimit ?? 1} 回合`);
    set('[data-brief-state]', complete ? '已完成' : unlocked ? (this.attempted.has(level.id) ? '已尝试' : '未尝试') : '未解锁');
    set('[data-brief-reward]', complete ? '完成记录已保留，可自由重练。' : '固定阵容与手牌，自由练习，不消耗金币。');
    const start = this.root.querySelector('#new-game');
    if (start) { start.disabled = !unlocked; start.textContent = unlocked ? (complete ? '再次挑战' : '开始试炼') : '先完成上一关'; }
    const roster = this.root.querySelector('[data-brief-roster]'); if (!roster) return;
    roster.replaceChildren();
    const entries = []; (level.hand || []).forEach((id) => entries.push({ id, label: '手牌' }));
    (level.board || []).forEach((unit) => entries.push({ id: unit.cardId, label: unit.owner === 0 ? '友军' : '敌军' }));
    const seen = new Set(), unique = entries.filter((entry) => !seen.has(`${entry.label}:${entry.id}`) && seen.add(`${entry.label}:${entry.id}`));
    unique.forEach((entry, indexInRoster) => {
      const card = this.cards[entry.id]; if (!card) return;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'roster-card';
      button.dataset.cardId = card.id; button.setAttribute('aria-label', `${entry.label}，${card.name}，查看卡牌详情`);
      const tag = document.createElement('span'); tag.className = 'roster-tag'; tag.textContent = entry.label;
      button.append(createGameCard(card, { drawArt: (canvas, id) => this.paint(canvas, id) }), tag);
      button.addEventListener('click', () => this.openCardDialog(unique.map((item) => this.cards[item.id]).filter(Boolean), indexInRoster, button));
      roster.append(button);
    });
  }

  renderCodex() {
    if (!this.els.grid) return;
    this.idleObserver.disconnect(); this.idleVisible.clear();
    this.visibleCards = Object.values(this.cards).filter((card) => this.filter === 'all' || card.type === this.filter);
    if (this.visibleCards.length && !this.visibleCards.some((card) => Number(card.id) === Number(this.selectedCardId))) this.selectedCardId = this.visibleCards[0].id;
    const count = this.root.querySelector('[data-codex-count]'); if (count) count.textContent = `${this.visibleCards.length} 张`;
    this.els.grid.replaceChildren();
    this.visibleCards.forEach((card, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'codex-card';
      button.dataset.cardId = card.id; button.setAttribute('aria-label', `${card.name}，${TYPE_LABELS[card.type] || '卡牌'}，查看详情`);
      button.append(createGameCard(card, { drawArt: (canvas, id) => this.paint(canvas, id) }));
      button.addEventListener('click', () => { this.selectedCardId = card.id; this.openCardDialog(this.visibleCards, index, button); });
      this.els.grid.append(button);
      this.idleObserver.observe(button.querySelector('canvas[data-card-art]'));
    });
    this.syncIdleAnimation();
    this.els.grid.scrollLeft = 0; requestAnimationFrame(() => this.updateCodexPage());
  }

  openCardDialog(cards, index, trigger) {
    if (!cards.length || !this.els.cardDialog) return;
    this.dialogCards = cards; this.dialogIndex = Math.max(0, Math.min(index, cards.length - 1));
    this.dialogTrigger = { element: trigger, cardId: trigger?.dataset.cardId, levelId: this.selectedLevelId };
    this.renderDossier(); if (!this.els.cardDialog.open) this.els.cardDialog.showModal();
  }

  renderDossier() {
    const card = this.dialogCards[this.dialogIndex] || this.cards[this.selectedCardId]; if (!card || !this.els.dossier) return;
    this.selectedCardId = card.id; this.els.dossier.replaceChildren(createGameCard(card, { drawArt: (canvas, id) => this.paint(canvas, id) }));
    this.els.cardDialog.setAttribute('aria-label', `${card.name}卡牌详情`);
    this.root.querySelectorAll('[data-card-prev], [data-card-next]').forEach((button) => { button.disabled = this.dialogCards.length < 2; });
    this.syncIdleAnimation();
  }

  stepCard(direction) {
    if (this.dialogCards.length < 2) return;
    this.dialogIndex = (this.dialogIndex + direction + this.dialogCards.length) % this.dialogCards.length; this.renderDossier();
  }

  closeCardDialog() {
    if (this.els.cardDialog?.open) this.els.cardDialog.close();
    const saved = this.dialogTrigger; this.dialogTrigger = null;
    requestAnimationFrame(() => {
      if (saved?.element?.isConnected) saved.element.focus();
      else if (saved?.cardId != null) this.root.querySelector(`[data-card-id="${esc(saved.cardId)}"]`)?.focus();
      else if (saved?.levelId != null) this.root.querySelector(`[data-level-id="${esc(saved.levelId)}"]`)?.focus();
    });
  }

  scrollCodex(direction) {
    this.els.grid?.scrollBy({
      left: direction * Math.max(1, this.els.grid.clientWidth),
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    });
  }

  updateCodexPage() {
    const label = this.root?.querySelector('[data-codex-page]'); if (!label || !this.els?.grid) return;
    const buttons = [...this.els.grid.querySelectorAll('.codex-card')];
    if (!buttons.length) { label.textContent = '没有符合条件的卡牌'; return; }
    const viewport = this.els.grid.getBoundingClientRect();
    const visible = buttons.map((button, index) => ({ button, index })).filter(({ button }) => {
      const rect = button.getBoundingClientRect();
      return rect.right > viewport.left + 1 && rect.left < viewport.right - 1;
    });
    label.textContent = `${(visible[0]?.index ?? 0) + 1}–${(visible.at(-1)?.index ?? 0) + 1} / ${buttons.length}`;
    const max = Math.max(0, this.els.grid.scrollWidth - this.els.grid.clientWidth);
    const previous = this.root.querySelector('[data-codex-prev]'), next = this.root.querySelector('[data-codex-next]');
    if (previous) previous.disabled = this.els.grid.scrollLeft <= 1;
    if (next) next.disabled = this.els.grid.scrollLeft >= max - 1;
  }

  refreshArt() {
    this.root?.querySelectorAll('canvas[data-card-art]').forEach((canvas) => this.paint(canvas, Number(canvas.dataset.cardArt)));
    this.syncIdleAnimation();
  }
  paint(canvas, id) {
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    try { const result = this.drawCardArt(canvas, id); if (result?.catch) result.catch(() => {}); } catch (_) {}
  }
}
