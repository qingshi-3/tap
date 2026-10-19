import { BattleAudio } from './audio.js';
import { STAGES } from './levels.js';
import {
  TOWER_TYPES, ENEMY_TYPES, getWaveDescription, createGame, beginWave, requestPlacement, cancelPlacement,
  placeTower, selectTower, upgradeTower, upgradeCost, sellTower, sellValue,
  getMaxTowerLevel, castAbility, getAbilityState, setRallyPoint,
  tick, togglePause, toggleSpeed, consumeEvents, getSelectedTower, getTowerStats,
  hitTower, hitPad
} from './simulation.js';
import {
  loadArtwork, render, canvasPoint, canvasPosition, getBattlefieldView,
  moveBattlefieldView, resetBattlefieldView, drawUnitPreview
} from './renderer.js';
import { PROGRESS_KEY, createProgress, loadProgress, recordVictory } from './progression.js';

const SAVE_KEY = PROGRESS_KEY;
const $ = selector => document.querySelector(selector);
const ui = {
  title: $('#title-screen'), play: $('#play-screen'), stages: $('#stage-list'), campaignRecord: $('#campaign-record'),
  canvas: $('#battlefield'), stageKicker: $('#stage-kicker'), stageName: $('#stage-name'), waveLabel: $('#wave-label'),
  speed: $('#speed-button'), pause: $('#pause-button'), lives: $('#lives-readout'), gold: $('#gold-readout'),
  commandDock: $('#command-dock'), dockTitle: $('#dock-title'), towerList: $('#tower-list'), towerDetail: $('#tower-detail'), clear: $('#clear-selection'),
  waveStatus: $('#wave-status'), enemyCount: $('#enemy-count'), waveButton: $('#wave-button'),
  placementCancel: $('#placement-cancel'), fieldMessage: $('#field-message'), overlay: $('#overlay'),
  dialogTitle: $('#dialog-title'), dialogCopy: $('#dialog-copy'), dialogMark: $('#dialog-mark'),
  dialogStats: $('#dialog-stats'), dialogActions: $('#dialog-actions'), toast: $('#toast'), rotate: $('#rotate-prompt'),
  reinforce: $('#reinforce-button'), meteor: $('#meteor-button'), abilityCancel: $('#ability-cancel')
};

const battleAudio = new BattleAudio();
let buildCategory = 'tower';
let artwork = null;
let game = null;
let activeStage = null;
let progress = createProgress(STAGES.map(stage => stage.id));
let canSave = true;
let saveIssue = null;
let previousFrame = 0;
let uiClock = 0;
let toastTimeout = 0;
let fieldMessageTimeout = 0;
let previousPhase = null;
let detailStateKey = null;
let mobileMenu = null;
const battlefieldPointers = new Map();
const GESTURE_DRAG_THRESHOLD = 8;
let battlefieldGestureUsed = false;

function isCompactBattle() {
  return window.matchMedia('(orientation: landscape)').matches;
}

let mobileMenuPositionFrame = 0;

function applyMobileMenuPosition(padIndex) {
  if (!isCompactBattle() || !activeStage || !Number.isInteger(padIndex)) return;
  const dockRect = ui.commandDock.getBoundingClientRect();
  if (dockRect.width <= 0 || dockRect.height <= 0) return;
  const pad = activeStage.pads[padIndex];
  if (!pad) return;
  const [x, y] = pad;
  const { clientX: anchorX, clientY: anchorY, scale } = canvasPosition(ui.canvas, x, y);
  const menuRect = ui.commandDock.querySelector('.tower-menu')?.getBoundingClientRect();
  const fallbackWidth = mobileMenu === 'tower' ? 220 : 300;
  const fallbackHeight = mobileMenu === 'tower' ? 133 : 146;
  const menuWidth = Math.min(menuRect?.width > 0 ? menuRect.width : fallbackWidth, dockRect.width);
  const menuHeight = menuRect?.height > 0 ? menuRect.height : fallbackHeight;
  const headerBottom = ui.play.querySelector('.battle-header')?.getBoundingClientRect().bottom ?? dockRect.top;
  const maxTop = Math.max(0, dockRect.height - menuHeight);
  const minTop = Math.min(Math.max(0, headerBottom + 8 - dockRect.top), maxTop);
  const localAnchorX = anchorX - dockRect.left;
  const localAnchorY = anchorY - dockRect.top;
  const selectedTower = game ? getSelectedTower(game) : null;
  const anchoredToTower = mobileMenu === 'tower' && selectedTower?.padIndex === padIndex;
  const avoidAbove = (anchoredToTower ? 100 : 22) * scale;
  const avoidBelow = (anchoredToTower ? 30 : 22) * scale;
  const gap = 11;
  const below = localAnchorY + avoidBelow + gap;
  const above = localAnchorY - avoidAbove - gap - menuHeight;
  const roomBelow = dockRect.height - below;
  const roomAbove = above + menuHeight - minTop;
  const fitsBelow = roomBelow >= menuHeight;
  const fitsAbove = above >= minTop;
  const preferredTop = fitsBelow && fitsAbove
    ? roomBelow >= roomAbove ? below : above
    : fitsBelow ? below : fitsAbove ? above : roomBelow >= roomAbove ? below : above;
  let left = Math.max(0, Math.min(dockRect.width - menuWidth, localAnchorX - menuWidth / 2));
  let top = Math.max(minTop, Math.min(maxTop, preferredTop));
  if (anchoredToTower && !fitsBelow && !fitsAbove) {
    // At higher zoom the tower can fill the short screen; keep actions beside its body.
    const sideGap = 42 * scale + gap;
    const sideTop = Math.max(minTop, Math.min(maxTop, localAnchorY - menuHeight / 2));
    const safeLeft = value => Math.max(0, Math.min(dockRect.width - menuWidth, value));
    const overlap = candidate => {
      const width = Math.max(0, Math.min(candidate.left + menuWidth, localAnchorX + 35 * scale)
        - Math.max(candidate.left, localAnchorX - 35 * scale));
      const height = Math.max(0, Math.min(candidate.top + menuHeight, localAnchorY + 52 * scale)
        - Math.max(candidate.top, localAnchorY - 100 * scale));
      return width * height;
    };
    const candidates = [
      { left, top },
      { left: safeLeft(localAnchorX + sideGap), top: sideTop },
      { left: safeLeft(localAnchorX - sideGap - menuWidth), top: sideTop }
    ];
    const best = candidates.reduce((chosen, candidate) => overlap(candidate) < overlap(chosen) ? candidate : chosen);
    ({ left, top } = best);
  }
  const waveRect = ui.play.querySelector('.wave-controls')?.getBoundingClientRect();
  if (waveRect?.width > 0 && waveRect?.height > 0) {
    const waveBox = {
      left: waveRect.left - dockRect.left,
      top: waveRect.top - dockRect.top,
      right: waveRect.right - dockRect.left,
      bottom: waveRect.bottom - dockRect.top
    };
    const safeLeft = value => Math.max(0, Math.min(dockRect.width - menuWidth, value));
    const safeTop = value => Math.max(minTop, Math.min(maxTop, value));
    const overlapArea = (candidate, box) => Math.max(0, Math.min(candidate.left + menuWidth, box.right) - Math.max(candidate.left, box.left))
      * Math.max(0, Math.min(candidate.top + menuHeight, box.bottom) - Math.max(candidate.top, box.top));
    const towerBox = {
      left: localAnchorX - 35 * scale,
      top: localAnchorY - (anchoredToTower ? 100 : 22) * scale,
      right: localAnchorX + 35 * scale,
      bottom: localAnchorY + (anchoredToTower ? 52 : 22) * scale
    };
    const current = { left, top };
    if (overlapArea(current, waveBox) > 0) {
      const sideGap = 42 * scale + gap;
      const candidates = [
        current,
        { left: safeLeft(localAnchorX - menuWidth / 2), top: safeTop(above) },
        { left: safeLeft(localAnchorX - menuWidth / 2), top: safeTop(below) },
        { left: safeLeft(localAnchorX + sideGap), top: safeTop(localAnchorY - menuHeight / 2) },
        { left: safeLeft(localAnchorX - sideGap - menuWidth), top: safeTop(localAnchorY - menuHeight / 2) },
        { left: safeLeft(waveBox.left - menuWidth - gap), top: safeTop(top) },
        { left: safeLeft(left), top: safeTop(waveBox.top - menuHeight - gap) }
      ];
      const score = candidate => overlapArea(candidate, waveBox) * 20
        + overlapArea(candidate, towerBox) * (anchoredToTower ? 2 : 0.25);
      const best = candidates.reduce((chosen, candidate) => score(candidate) < score(chosen) ? candidate : chosen);
      ({ left, top } = best);
    }
  }
  ui.commandDock.style.setProperty('--menu-left', `${left}px`);
  ui.commandDock.style.setProperty('--menu-top', `${top}px`);
}

function positionMobileMenu(padIndex) {
  applyMobileMenuPosition(padIndex);
  if (mobileMenuPositionFrame) window.cancelAnimationFrame(mobileMenuPositionFrame);
  mobileMenuPositionFrame = window.requestAnimationFrame(() => {
    mobileMenuPositionFrame = 0;
    if (mobileMenu) applyMobileMenuPosition(padIndex);
  });
}

function readProgress() {
  const stored = loadProgress(localStorage, STAGES.map(stage => stage.id));
  if (stored.canSave === false) canSave = false;
  return stored;
}

function saveProgress() {
  if (!canSave) return false;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    canSave = false;
    saveIssue = '浏览器无法保存进度，本次之后的胜利只在当前页面有效。';
    showToast(saveIssue);
    return false;
  }
}

function setCampaignRecord() {
  ui.campaignRecord.textContent = `已守住 ${Object.keys(progress.wins).length} 座关隘`;
}

function renderStageCards() {
  ui.stages.replaceChildren();
  for (const stage of STAGES) {
    const unlocked = progress.unlocked[stage.id] === true;
    const cleared = progress.wins[stage.id] === true;
    const best = progress.stars[stage.id] ?? 0;
    const stars = cleared ? `${'★'.repeat(best)}${'☆'.repeat(3 - best)}` : '';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'stage-card';
    button.disabled = !unlocked;
    button.setAttribute('aria-label', `${stage.name}，${unlocked ? '可进入' : '尚未解锁'}，本关塔等级上限 ${stage.towerLevelCap}${cleared ? `，最佳 ${best} 星` : ''}`);
    button.innerHTML = `<span class="stage-emblem" aria-hidden="true">${stage.emblem}</span>
      <span><strong>${stage.name}</strong><small>${stage.summary} · ${stage.maxWaves} 波 · 塔上限 ${stage.towerLevelCap} 级</small></span>
      <span class="stage-state">${cleared ? `${stars} 最佳` : unlocked ? stage.difficulty : '未解锁'}</span>`;
    if (unlocked) button.addEventListener('click', () => startStage(stage.id));
    ui.stages.append(button);
  }
  setCampaignRecord();
}

function iconPath(name) {
  return artwork?.manifest?.ui?.icon?.[name] ?? null;
}

function towerArtwork(type) {
  const frames = artwork?.manifest?.towers?.[type];
  return frames?.completed ?? frames?.idle?.[0] ?? null;
}

function coinSvg() {
  return '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#f3b928"/><circle cx="10" cy="10" r="6.7" fill="#d89018" stroke="#ffe080" stroke-width="1"/><path d="m10 5.7 4.1 4.3-4.1 4.3L5.9 10 10 5.7Z" fill="#ffd85b" stroke="#9a5a10" stroke-width=".8"/></svg>';
}

function buildTowerCards() {
  ui.towerList.replaceChildren();
  for (const tower of Object.values(TOWER_TYPES)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tower-card';
    button.dataset.tower = tower.id;
    button.hidden = (tower.category ?? 'tower') !== buildCategory;
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', `${tower.name}，${tower.category === 'unit' ? '招募' : '建造'}费用 ${tower.cost} 金币，${tower.role}`);
    const sprite = towerArtwork(tower.id);
    const image = tower.category === 'unit' ? `<canvas class="unit-preview" data-unit="${tower.id}" aria-hidden="true"></canvas>` : sprite ? `<span class="tower-preview" aria-hidden="true" style="background-image:url('./${sprite.path}');background-size:${(sprite.frameCount || 1) * 32}px ${32 * sprite.frameHeight / sprite.frameWidth}px"></span>` : '<span aria-hidden="true">✦</span>';
    button.innerHTML = `<span class="tower-glyph">${image}</span><strong>${tower.name}</strong><small class="build-price" aria-hidden="true">${coinSvg()}${tower.cost}</small>`;
    button.addEventListener('click', () => {
      if (!game || ['victory', 'defeat'].includes(game.phase)) return;
      if (isCompactBattle() && mobileMenu === 'build') {
        const padIndex = game.focusPadIndex;
        if (!requestPlacement(game, tower.id)) {
          consumeEvents(game);
          showToast('金币不足，先击退敌人获取赏金。');
          syncInterface();
          return;
        }
        const result = placeTower(game, padIndex);
        if (!result.ok) showFieldMessage(result.message);
        else {
          mobileMenu = 'tower';
        }
        syncInterface();
        return;
      }
      if (game.placementType === tower.id) {
        cancelPlacement(game);
        syncInterface();
        return;
      }
      if (!requestPlacement(game, tower.id)) {
        consumeEvents(game);
        showToast('金币不足，先击退敌人获取赏金。');
      }
      syncInterface();
    });
    ui.towerList.append(button);
    if (tower.category === 'unit' && artwork) drawUnitPreview(button.querySelector('canvas'), artwork, tower.id);
  }
}

function showToast(message) {
  if (!message) return;
  ui.toast.textContent = message;
  ui.toast.classList.add('show');
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => ui.toast.classList.remove('show'), 2100);
}

function showFieldMessage(message) {
  ui.fieldMessage.textContent = message;
  ui.fieldMessage.classList.add('visible');
  window.clearTimeout(fieldMessageTimeout);
  fieldMessageTimeout = window.setTimeout(() => ui.fieldMessage.classList.remove('visible'), 1450);
}

function cancelTargeting() {
  if (!game) return;
  game.targeting = null;
  game.rallyTowerId = null;
}

function beginTargeting(kind) {
  if (!game || ['victory', 'defeat'].includes(game.phase)) return;
  const state = getAbilityState(game, kind);
  if (!state.unlocked) { showToast(kind === 'reinforce' ? '援军将在第 3 波开放' : '火雨将在第 7 波开放'); return; }
  if (!state.ready) { showToast(`还需 ${Math.ceil(state.cooldown)} 秒`); return; }
  cancelPlacement(game); selectTower(game, null); mobileMenu = null;
  game.targeting = kind; game.rallyTowerId = null;
  syncInterface();
}

function setDialog({ title, copy = '', mark = '✦', stats = '', actions = [] }) {
  resetBattlefieldInput();
  cancelTargeting();
  ui.dialogTitle.textContent = title;
  ui.dialogCopy.textContent = copy;
  ui.dialogMark.textContent = mark;
  ui.dialogStats.hidden = !stats;
  ui.dialogStats.textContent = stats;
  ui.dialogActions.replaceChildren();
  for (const action of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action.label;
    if (action.primary) button.classList.add('primary-button');
    button.addEventListener('click', action.run, { once: true });
    ui.dialogActions.append(button);
  }
  battleAudio.stop();
  if (game) {
    const sound = document.createElement('button');
    sound.type = 'button'; sound.id = 'sound-toggle';
    const update = () => { sound.textContent = `音效：${battleAudio.enabled ? '开' : '关'}`; sound.setAttribute('aria-pressed', String(battleAudio.enabled)); };
    update(); sound.addEventListener('click', () => { battleAudio.unlock(); battleAudio.toggle(); update(); }); ui.dialogActions.append(sound);
  }
  ui.overlay.hidden = false;
  window.requestAnimationFrame(() => ui.dialogActions.querySelector('button')?.focus());
}

function closeDialog({ focus = true } = {}) {
  ui.overlay.hidden = true;
  if (focus && game) ui.waveButton.focus();
}

function showStorageIssue() {
  if (!saveIssue) return;
  setDialog({
    title: '进度存储不可用', copy: saveIssue, mark: '!',
    actions: [{ label: '继续体验（不覆盖原进度）', primary: true, run: closeDialog }]
  });
}

function startStage(stageId) {
  activeStage = STAGES.find(stage => stage.id === stageId);
  if (!activeStage || progress.unlocked[stageId] !== true) return;
  game = createGame(stageId);
  game.targeting = null;
  game.rallyTowerId = null;
  game.campaignVictoryRecorded = false;
  game.focusPadIndex = 0;
  mobileMenu = null;
  previousPhase = game.phase;
  detailStateKey = null;
  ui.title.hidden = true;
  ui.play.hidden = false;
  resetBattlefieldInput({ resetView: true });
  ui.stageKicker.textContent = `第 ${activeStage.number} 战区 · ${activeStage.difficulty}`;
  ui.stageName.textContent = activeStage.name;
  closeDialog({ focus: false });
  syncInterface();
  updateOrientation();
  ui.canvas.focus({ preventScroll: true });
}

function returnToCampaign() {
  battleAudio.stop();
  resetBattlefieldInput({ resetView: true });
  game = null;
  activeStage = null;
  mobileMenu = null;
  ui.play.hidden = true;
  ui.title.hidden = false;
  closeDialog({ focus: false });
  renderStageCards();
  updateOrientation();
}

function askReturnToCampaign() {
  if (!game) return;
  if (game.phase === 'deploy' && game.towers.length === 0 && game.wave === 0) {
    returnToCampaign();
    return;
  }
  const wasPaused = game.paused;
  game.paused = true;
  setDialog({
    title: '返回战区选择？', copy: '本场战斗的布防与波次进度会丢失。', mark: '↩',
    actions: [
      { label: '继续守城', primary: true, run: () => { game.paused = wasPaused; closeDialog(); syncInterface(); } },
      { label: '返回战区选择', run: returnToCampaign }
    ]
  });
}

function selectStageNext(stage) {
  if (game.campaignVictoryRecorded) return null;
  const result = recordVictory(progress, STAGES.map(item => item.id), stage.id, game.lives);
  progress = result.progress;
  game.campaignVictoryRecorded = true;
  saveProgress();
  return { ...result, stage: result.next ? STAGES.find(item => item.id === result.next) : null };
}

function handleTerminalPhase() {
  if (!game || game.phase === previousPhase) return;
  previousPhase = game.phase;
  if (game.phase === 'intermission') {
    showFieldMessage(`第 ${game.wave} 波守住了`);
  } else if (game.phase === 'victory') {
    const victory = selectStageNext(activeStage);
    const next = victory?.stage ?? null;
    const allCleared = !next && progress.wins[activeStage.id] === true;
    const outcome = activeStage.number === 1 ? '下一战区开放 2 级防御塔。' : activeStage.number === 2 ? '下一关将面对治疗祭司和高生命巨兽。' : '首章完成，王城外三道防线已经守住。';
    renderStageCards();
    setDialog({
      title: '关隘守住了！', copy: `${allCleared ? '王城的道路已经安全。' : `${activeStage.name}的敌军已全部击退。`} ${outcome}`,
      mark: '♜', stats: `本次 ${victory.earned} 星 · 最佳 ${victory.best} 星 · ${game.wave} 波完成 · 剩余城门耐久 ${game.lives}`,
      actions: [
        ...(next ? [{ label: `前往下一战区：${next.name}`, primary: true, run: () => startStage(next.id) }] : []),
        { label: '再次挑战', primary: !next, run: () => startStage(activeStage.id) },
        { label: '返回战区选择', run: returnToCampaign }
      ]
    });
  } else if (game.phase === 'defeat') {
    setDialog({
      title: '城门失守', copy: '敌军突破了最后一道防线。调整防御塔的位置和组合，再试一次。', mark: '!',
      stats: `守到第 ${game.wave} 波 · 剩余金币 ${game.gold}`,
      actions: [
        { label: '重新布防', primary: true, run: () => startStage(activeStage.id) },
        { label: '返回战区选择', run: returnToCampaign }
      ]
    });
  }
}

function renderTowerDetail() {
  const tower = getSelectedTower(game);
  ui.towerDetail.hidden = !tower || (isCompactBattle() && mobileMenu !== 'tower');
  if (!tower) { detailStateKey = null; return; }
  const nextCost = upgradeCost(tower);
  const canAffordUpgrade = game.gold >= nextCost;
  const stateKey = `${tower.id}:${tower.level}:${canAffordUpgrade}:${game.phase}`;
  if (stateKey === detailStateKey) return;
  const focusedAction = ui.towerDetail.contains(document.activeElement)
    ? document.activeElement.closest('[data-action]')?.dataset.action
    : null;
  detailStateKey = stateKey;
  const type = TOWER_TYPES[tower.type];
  const stats = getTowerStats(tower);
  const refund = sellValue(tower, game);
  const canAct = !['victory', 'defeat'].includes(game.phase);
  const levelCap = getMaxTowerLevel(game);
  const maxLevel = tower.level >= levelCap;
  const statsDescription = type.family === 'barracks'
    ? `${type.summary} 每名士兵 ${stats.soldierHp} 生命，集结范围 ${Math.round(stats.range)}。`
    : `${type.summary} 伤害 ${stats.damageBounds?.join('–') ?? stats.damage}，射程 ${Math.round(stats.range)}，攻击间隔 ${stats.interval.toFixed(1)} 秒`;
  const canUpgrade = canAct && !maxLevel && canAffordUpgrade;
  const unaffordable = canAct && !maxLevel && !canAffordUpgrade;
  const stars = Array.from({ length: levelCap }, (_, index) => {
    const level = index + 1;
    const stateClass = level <= tower.level ? 'earned' : level === tower.level + 1 ? 'next' : '';
    return `<span class="star-slot ${stateClass}" aria-hidden="true">★</span>`;
  }).join('');
  ui.towerDetail.setAttribute('aria-label', `${type.name}，${tower.level} 级，${statsDescription}`);
  ui.towerDetail.title = statsDescription;
  ui.towerDetail.innerHTML = `<div class="tower-summary"><strong>${type.name}</strong><span class="detail-stars" aria-label="${tower.level} 级，本关上限 ${levelCap} 级">${stars}</span></div>
    <p class="defense-role">${type.role}${type.groundOnly ? ' · 对地' : ''}</p>
    <div class="detail-actions">
      <button type="button" data-action="upgrade" class="upgrade-button${maxLevel ? ' max-level' : unaffordable ? ' unaffordable' : ''}" ${canUpgrade ? '' : 'disabled'}><span class="action-icon" aria-hidden="true"><img src="./assets/ui/action/${maxLevel ? 'max-level' : 'upgrade'}.png" alt="" draggable="false"></span><span class="action-label">${maxLevel ? '本关满级' : unaffordable ? '金币不足' : '升级'}</span>${maxLevel ? '' : `<span class="action-price">${coinSvg()}${nextCost}</span>`}</button>
      <button type="button" class="sell-button" data-action="sell" ${canAct ? '' : 'disabled'}><span class="action-icon" aria-hidden="true"><img src="./assets/ui/action/demolish.png" alt="" draggable="false"></span><span class="action-label">${type.category === 'unit' ? '撤回' : '拆除'}</span><span class="action-price">${coinSvg()}+${refund}</span></button>
      ${type.family === 'barracks' ? '<button type="button" class="rally-button" data-action="rally"><img src="./assets/ui/action/rally.png" alt="">调整集结</button>' : ''}
    </div>`;
  const upgradeButton = ui.towerDetail.querySelector('[data-action="upgrade"]');
  const sellButton = ui.towerDetail.querySelector('[data-action="sell"]');
  upgradeButton.setAttribute('aria-label', maxLevel ? `${type.name}已达本关等级上限` : !canAct ? '战斗已经结束，无法升级' : game.gold < nextCost ? `金币不足，升级${type.name}需要 ${nextCost} 金币` : `升级${type.name}，花费 ${nextCost} 金币`);
  upgradeButton.title = maxLevel ? '已达本关等级上限' : `升级：${nextCost} 金币；${statsDescription}`;
  sellButton.setAttribute('aria-label', canAct ? `${type.category === 'unit' ? '撤回' : '拆除'}${type.name}，返还 ${refund} 金币` : '战斗已经结束，无法拆除');
  sellButton.title = `拆除后返还 ${refund} 金币`;
  upgradeButton.addEventListener('click', () => {
    const result = upgradeTower(game, tower.id);
    if (!result.ok) showToast(result.message);
    else if (!isCompactBattle()) showFieldMessage(`${type.name}升级至 ${tower.level} 级`);
    syncInterface();
  });
  sellButton.addEventListener('click', () => {
    const result = sellTower(game, tower.id);
    if (result.ok) {
      mobileMenu = null;
      showToast(`拆除防御塔，返还 ${result.refund} 金币`);
    }
    syncInterface();
  });
  ui.towerDetail.querySelector('[data-action="rally"]')?.addEventListener('click', () => {
    cancelPlacement(game); game.targeting = 'rally'; game.rallyTowerId = tower.id; mobileMenu = null; syncInterface();
  });
  if (focusedAction) ui.towerDetail.querySelector(`[data-action="${focusedAction}"]:not(:disabled)`)?.focus({ preventScroll: true });
}

function syncInterface() {
  if (!game) return;
  const compact = isCompactBattle();
  const selected = getSelectedTower(game);
  const terminal = ['victory', 'defeat'].includes(game.phase);
  ui.play.dataset.context = compact ? (mobileMenu ?? 'closed') : 'desktop';
  if (compact && mobileMenu) positionMobileMenu(selected?.padIndex ?? game.focusPadIndex);
  ui.gold.textContent = String(game.gold);
  ui.lives.textContent = String(game.lives);
  ui.speed.querySelector('.speed-value').textContent = `${game.speed}×`;
  ui.speed.setAttribute('aria-label', `当前速度 ${game.speed} 倍，点击切换`);
  ui.pause.setAttribute('aria-pressed', String(game.paused));
  ui.pause.setAttribute('aria-label', game.paused ? '继续战斗' : '暂停战斗');
  ui.dockTitle.textContent = selected ? '防御塔操作' : game.placementType ? `选择建造位置：${TOWER_TYPES[game.placementType].name}` : '建造防御塔';
  ui.clear.hidden = !selected && !game.placementType && !(compact && mobileMenu);
  ui.clear.setAttribute('aria-label', mobileMenu === 'build' ? '关闭建造菜单' : '取消选择');
  ui.towerList.hidden = compact && mobileMenu !== 'build';
  $('#build-panel').hidden = ui.towerList.hidden;
  ui.placementCancel.hidden = !game.placementType;
  ui.towerList.querySelectorAll('.tower-card').forEach(button => {
    const type = TOWER_TYPES[button.dataset.tower];
    button.disabled = ['victory', 'defeat'].includes(game.phase) || game.gold < type.cost;
    button.setAttribute('aria-pressed', String(game.placementType === type.id));
  });
  for (const [kind, button, label] of [['reinforce', ui.reinforce, '援军'], ['meteor', ui.meteor, '火雨']]) {
    if (!button) continue;
    const state = getAbilityState(game, kind);
    button.disabled = !state.unlocked || !state.ready || terminal;
    button.setAttribute('aria-pressed', String(game.targeting === kind));
    button.querySelector('.ability-label').textContent = !state.unlocked ? `${kind === 'reinforce' ? '第3波' : '第7波'}` : state.ready ? label : `${Math.ceil(state.cooldown)}s`;
    button.setAttribute('aria-label', !state.unlocked ? `${label}尚未解锁` : state.ready ? `${label}可用，点击后选择地图位置` : `${label}冷却还剩 ${Math.ceil(state.cooldown)} 秒`);
  }
  if (ui.abilityCancel) ui.abilityCancel.hidden = !game.targeting;
  $('#ability-controls').hidden = Boolean(mobileMenu) || terminal;
  ui.abilityCancel.textContent = game.targeting === 'rally' ? '点道路集结 · 取消' : '点地图施放 · 取消';
  renderTowerDetail();
  ui.waveButton.hidden = game.phase === 'combat';
  ui.enemyCount.hidden = game.phase !== 'combat';
  ui.waveButton.disabled = terminal || game.phase === 'combat' || game.paused;
  if (game.phase === 'combat') ui.waveButton.textContent = game.paused ? `第 ${game.wave} 波已暂停` : `第 ${game.wave} 波进行中`;
  else if (game.phase === 'intermission') ui.waveButton.textContent = `开始第 ${game.wave + 1} 波`;
  else if (terminal) ui.waveButton.textContent = game.phase === 'victory' ? '战役完成' : '城门失守';
  else ui.waveButton.textContent = `开始第 ${game.wave + 1} 波`;
  $('#scout-button').disabled = terminal || game.phase === 'combat' || Boolean(mobileMenu);
  $('#scout-button').setAttribute('aria-label', game.phase === 'combat' ? `当前第 ${game.wave} 波` : '查看下一波敌情');
  ui.waveLabel.textContent = `${game.wave} / ${game.maxWaves}`;
  ui.enemyCount.textContent = `${game.enemies.length} 名敌人`;
  if (game.phase === 'combat') ui.waveStatus.textContent = `第 ${game.wave} 波正在进攻`;
  else if (game.phase === 'intermission') ui.waveStatus.textContent = '这一波已守住，可以继续布防';
  else if (terminal) ui.waveStatus.textContent = game.phase === 'victory' ? '战役胜利' : '城门耐久耗尽';
  else ui.waveStatus.textContent = '道路暂时安全';
}

function showWaveIntel() {
  if (!game || !['deploy', 'intermission'].includes(game.phase)) return;
  const description = getWaveDescription(activeStage, game.wave + 1);
  const counters = {
    grunt: '无甲，快速射击有效', runner: '高速，会闪避近战，远程射击可靠', armored: '有护甲，用魔法配合兵营',
    flyer: '飞行：近战与投石无法命中', swarm: '密集虫群：范围伤害或连锁',
    shaman: '高魔抗并治疗同伴，优先物理火力', wraith: '抗魔：物理射击更有效',
    juggernaut: '高生命、无甲，兵营拖延并集中输出', boss: '巨兽：强生命，抵抗眩晕'
  };
  setDialog({ title: `第 ${game.wave + 1} 波敌情`, copy: description, mark: '⚑',
    actions: [{ label: '继续布防', primary: true, run: closeDialog }] });
  const list = document.createElement('div'); list.className = 'intel-list';
  for (const [id, type] of Object.entries(ENEMY_TYPES)) {
    if (!description.includes(`${type.name}×`)) continue;
    const row = document.createElement('p'); row.textContent = `${type.name}：${counters[id]}`; list.append(row);
  }
  ui.dialogCopy.replaceChildren(document.createTextNode(description), list);
}

function setWaveButton() {
  if (game && !game.paused) beginWave(game);
  syncInterface();
  handleTerminalPhase();
}

function onCanvasPointer(event) {
  if (!game || ui.overlay.hidden === false || ['victory', 'defeat'].includes(game.phase)) return;
  const point = canvasPoint(ui.canvas, event.clientX, event.clientY);
  if (game.targeting) {
    const targeting = game.targeting;
    const result = targeting === 'rally'
      ? setRallyPoint(game, game.rallyTowerId, point.x, point.y)
      : castAbility(game, targeting, point.x, point.y);
    if (result.ok) { cancelTargeting(); showFieldMessage(targeting === 'rally' ? '集结点已调整' : targeting === 'reinforce' ? '援军已抵达' : '火雨已落下'); }
    else showToast(result.message);
    syncInterface();
    return;
  }
  const touchRadius = Math.max(22, 22 / point.scale);
  const tower = hitTower(game, point.x, point.y, Math.max(42, touchRadius));
  if (tower) {
    selectTower(game, tower.id);
    mobileMenu = isCompactBattle() ? 'tower' : null;
    if (mobileMenu) positionMobileMenu(tower.padIndex);
    syncInterface();
    return;
  }
  const padIndex = hitPad(game, point.x, point.y, Math.max(38, touchRadius));
  if (padIndex >= 0) {
    if (isCompactBattle()) {
      game.focusPadIndex = padIndex;
      cancelPlacement(game);
      selectTower(game, null);
      mobileMenu = 'build';
      positionMobileMenu(padIndex);
      syncInterface();
      return;
    }
    if (!game.placementType) {
      showFieldMessage('先从右侧选择一种防御塔');
      return;
    }
    const result = placeTower(game, padIndex);
    if (!result.ok) showFieldMessage(result.message);
    else showFieldMessage(`${TOWER_TYPES[result.tower.type].name}建成`);
    syncInterface();
    return;
  }
  if (isCompactBattle()) {
    cancelPlacement(game);
    selectTower(game, null);
    mobileMenu = null;
    syncInterface();
    return;
  }
  if (game.placementType) showFieldMessage('请点击地图上的石基位置');
  else if (getSelectedTower(game)) { selectTower(game, null); syncInterface(); }
}

function battlefieldInputAllowed() {
  return game && ui.overlay.hidden && ui.rotate.hidden && !document.hidden
    && !['victory', 'defeat'].includes(game.phase);
}

function resetBattlefieldInput({ resetView = false } = {}) {
  const pointerIds = [...battlefieldPointers.keys()];
  battlefieldPointers.clear();
  battlefieldGestureUsed = false;
  for (const pointerId of pointerIds) {
    if (ui.canvas.hasPointerCapture(pointerId)) ui.canvas.releasePointerCapture(pointerId);
  }
  if (resetView) resetBattlefieldView(ui.canvas);
}

function beginBattlefieldGesture() {
  if (battlefieldGestureUsed) return;
  // The whole contact sequence stays a gesture, including its final remaining finger.
  battlefieldGestureUsed = true;
  cancelPlacement(game);
  cancelTargeting();
  selectTower(game, null);
  mobileMenu = null;
  syncInterface();
}

function battlefieldPinch() {
  const [first, second] = battlefieldPointers.values();
  if (!first || !second) return null;
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
    distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y))
  };
}

function onBattlefieldPointerDown(event) {
  if (!battlefieldInputAllowed() || (event.pointerType === 'mouse' && event.button !== 0)) return;
  event.preventDefault();
  if (!battlefieldPointers.size) battlefieldGestureUsed = false;
  battlefieldPointers.set(event.pointerId, {
    x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY
  });
  ui.canvas.setPointerCapture(event.pointerId);
  if (battlefieldPointers.size >= 2) beginBattlefieldGesture();
}

function onBattlefieldPointerMove(event) {
  const pointer = battlefieldPointers.get(event.pointerId);
  if (!pointer) return;
  event.preventDefault();
  if (!battlefieldInputAllowed()) { resetBattlefieldInput(); return; }
  const previousPinch = battlefieldPinch();
  const previousX = pointer.x, previousY = pointer.y;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  if (previousPinch) {
    const pinch = battlefieldPinch();
    moveBattlefieldView(ui.canvas, previousPinch.x, previousPinch.y, pinch.x, pinch.y,
      pinch.distance / previousPinch.distance);
    return;
  }
  const moved = Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) >= GESTURE_DRAG_THRESHOLD;
  const wasGesture = battlefieldGestureUsed;
  if (moved) beginBattlefieldGesture();
  if (battlefieldGestureUsed && getBattlefieldView(ui.canvas).zoom > 1) {
    moveBattlefieldView(ui.canvas, wasGesture ? previousX : pointer.startX,
      wasGesture ? previousY : pointer.startY, pointer.x, pointer.y);
  }
}

function onBattlefieldPointerUp(event) {
  const pointer = battlefieldPointers.get(event.pointerId);
  if (!pointer) return;
  event.preventDefault();
  const moved = Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) >= GESTURE_DRAG_THRESHOLD;
  const canTap = !battlefieldGestureUsed && !moved && battlefieldPointers.size === 1 && battlefieldInputAllowed();
  battlefieldPointers.delete(event.pointerId);
  if (ui.canvas.hasPointerCapture(event.pointerId)) ui.canvas.releasePointerCapture(event.pointerId);
  if (!battlefieldPointers.size) battlefieldGestureUsed = false;
  if (canTap) onCanvasPointer(event);
}

function onCanvasKeydown(event) {
  if (!game || !ui.overlay.hidden || ['victory', 'defeat'].includes(game.phase)) return;
  const currentIndex = Number.isInteger(game.focusPadIndex) ? game.focusPadIndex : 0;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
    event.preventDefault();
    const [x, y] = activeStage.pads[currentIndex];
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    const candidates = activeStage.pads.map(([px, py], index) => ({ index, dx: px - x, dy: py - y }))
      .filter(item => item.index !== currentIndex && item.dx * direction[0] + item.dy * direction[1] > 0)
      .sort((a, b) => {
        const distanceA = Math.hypot(a.dx, a.dy), distanceB = Math.hypot(b.dx, b.dy);
        const angleA = Math.abs((a.dx * direction[1] - a.dy * direction[0]) / distanceA);
        const angleB = Math.abs((b.dx * direction[1] - b.dy * direction[0]) / distanceB);
        return angleA - angleB || distanceA - distanceB;
      });
    game.focusPadIndex = candidates[0]?.index ?? (currentIndex + 1) % activeStage.pads.length;
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    const tower = game.towers.find(item => item.padIndex === currentIndex);
    if (tower) { selectTower(game, tower.id); mobileMenu = isCompactBattle() ? 'tower' : null; }
    else if (isCompactBattle() && !game.placementType) { mobileMenu = 'build'; }
    if (isCompactBattle() && mobileMenu) positionMobileMenu(tower?.padIndex ?? currentIndex);
    else if (game.placementType) {
      const result = placeTower(game, currentIndex);
      if (!result.ok) showFieldMessage(result.message);
      else showFieldMessage(`${TOWER_TYPES[result.tower.type].name}建成`);
    } else showFieldMessage('先从右侧选择一种防御塔');
    syncInterface();
    return;
  }
  if (/^[1-4]$/.test(event.key)) {
    const type = Object.values(TOWER_TYPES).filter(type => type.category === buildCategory)[Number(event.key) - 1]?.id;
    if (type) {
      event.preventDefault();
      if (requestPlacement(game, type)) syncInterface();
      else showToast('金币不足，先击退敌人获取赏金。');
    }
  } else if (event.key === 'Escape') {
    cancelPlacement(game);
    cancelTargeting();
    selectTower(game, null);
    mobileMenu = null;
    syncInterface();
  }
}

function updateOrientation() {
  resetBattlefieldInput();
  const portrait = window.matchMedia('(orientation: portrait)').matches;
  ui.rotate.hidden = !(game && !ui.play.hidden && portrait);
  if (game) syncInterface();
}

function onFrame(now) {
  const delta = previousFrame ? Math.min(.05, (now - previousFrame) / 1000) : 0;
  previousFrame = now;
  if (game) {
    const sounds = game.audioEvents?.splice(0) ?? [];
    if (!game.paused && !document.hidden && ui.overlay.hidden) for (const sound of sounds) battleAudio.play(sound);
    if (!window.matchMedia('(orientation: portrait)').matches) tick(game, delta);
    render(ui.canvas, game, artwork, now / 1000);
    uiClock += delta;
    if (uiClock >= .12) {
      uiClock = 0;
      const events = consumeEvents(game);
      for (const event of events) {
        if (event.type === 'breach') showFieldMessage(event.text);
        else if (['build', 'upgrade'].includes(event.type)) {
          if (!isCompactBattle()) showFieldMessage(event.text);
        } else if (['wave', 'clear'].includes(event.type)) showFieldMessage(event.text);
      }
      syncInterface();
      handleTerminalPhase();
    }
  }
  window.requestAnimationFrame(onFrame);
}

function bindActions() {
  // Opening a menu on pointerup can move a card under the finger before the browser
  // synthesizes click. Only a pointer that began on that button may activate it.
  let menuPointerTarget = null;
  document.addEventListener('pointerdown', event => { menuPointerTarget = event.target; }, true);
  ui.commandDock.addEventListener('click', event => {
    const button = event.target.closest('.tower-menu button');
    if (button && event.detail > 0 && !button.contains(menuPointerTarget)) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  document.addEventListener('pointerdown', () => battleAudio.unlock(), { passive: true });
  document.addEventListener('keydown', () => battleAudio.unlock());
  $('#build-tabs').addEventListener('click', event => {
    const tab = event.target.closest('[data-category]'); if (!tab) return;
    buildCategory = tab.dataset.category;
    $('#build-tabs').querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button === tab)));
    ui.towerList.querySelectorAll('.tower-card').forEach(button => { button.hidden = TOWER_TYPES[button.dataset.tower].category !== buildCategory; });
    syncInterface();
  });
  $('#scout-button').addEventListener('click', showWaveIntel);
  $('#wave-button').addEventListener('click', setWaveButton);
  ui.reinforce?.addEventListener('click', () => beginTargeting('reinforce'));
  ui.meteor?.addEventListener('click', () => beginTargeting('meteor'));
  ui.abilityCancel?.addEventListener('click', () => { cancelTargeting(); syncInterface(); });
  $('#back-to-map').addEventListener('click', askReturnToCampaign);
  $('#speed-button').addEventListener('click', () => { if (game && !['victory', 'defeat'].includes(game.phase)) { toggleSpeed(game); syncInterface(); } });
  $('#pause-button').addEventListener('click', () => {
    if (!game || ['victory', 'defeat'].includes(game.phase)) return;
    togglePause(game);
    if (game.paused) {
      setDialog({ title: '战斗暂停', copy: '敌军暂时停在路上，准备好后继续守城。', mark: 'Ⅱ', actions: [{ label: '继续战斗', primary: true, run: () => { togglePause(game); closeDialog(); syncInterface(); } }, { label: '返回战区选择', run: askReturnToCampaign }] });
    } else closeDialog();
    syncInterface();
  });
  $('#clear-selection').addEventListener('click', () => { if (game) { cancelPlacement(game); cancelTargeting(); selectTower(game, null); mobileMenu = null; syncInterface(); } });
  $('#placement-cancel').addEventListener('click', () => { if (game) { cancelPlacement(game); mobileMenu = null; syncInterface(); } });
  ui.canvas.addEventListener('pointerdown', onBattlefieldPointerDown);
  ui.canvas.addEventListener('pointermove', onBattlefieldPointerMove);
  ui.canvas.addEventListener('pointerup', onBattlefieldPointerUp);
  ui.canvas.addEventListener('pointercancel', () => resetBattlefieldInput());
  ui.canvas.addEventListener('lostpointercapture', event => {
    if (battlefieldPointers.has(event.pointerId)) resetBattlefieldInput();
  });
  $('#battlefield').addEventListener('keydown', onCanvasKeydown);
  $('#battlefield').addEventListener('contextmenu', event => event.preventDefault());
  $('#about-open').addEventListener('click', () => setDialog({
    title: '玩法与隐私', copy: '四个防御系从开局即可使用；建筑与驻军是同系的两种外观，数值和职能相同。点击驻军可调整集结点；援军与火雨需先选技能再点地图。通关剩余 18 点生命得 3 星、6 点得 2 星，其余得 1 星。首波前拆除全额返还，开战后返还累计投入的 60%。双指缩放，放大后可单指拖动战场。',
    mark: '✦', stats: '本游戏不联网、不接广告、不收集个人信息。关卡解锁仅保存在此浏览器。',
    actions: [{ label: '开始守城', primary: true, run: closeDialog }]
  }));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !ui.overlay.hidden && !game?.paused) closeDialog({ focus: false });
  });
  document.addEventListener('visibilitychange', () => {
    resetBattlefieldInput();
    if (document.hidden) battleAudio.stop();
    if (!document.hidden || !game || ['victory', 'defeat'].includes(game.phase) || !ui.overlay.hidden) return;
    if (!game.paused) togglePause(game);
    setDialog({ title: '战斗已暂停', copy: '切换到其他应用后，战场会自动暂停。', mark: 'Ⅱ', actions: [{ label: '继续战斗', primary: true, run: () => { if (game.paused) togglePause(game); closeDialog(); syncInterface(); } }, { label: '返回战区选择', run: returnToCampaign }] });
    syncInterface();
  });
  window.addEventListener('resize', updateOrientation, { passive: true });
  window.addEventListener('orientationchange', updateOrientation, { passive: true });
  window.addEventListener('blur', () => resetBattlefieldInput());
}

async function boot() {
  const stored = readProgress();
  progress = stored.value;
  saveIssue = stored.issue;
  if (stored.needsSave) saveProgress();
  buildTowerCards();
  renderStageCards();
  bindActions();
  try {
    artwork = await loadArtwork();
    battleAudio.configure(artwork.manifest.duelyst?.audio);
    buildTowerCards();
    if (artwork.loaded < artwork.total) showToast('部分美术资源无法读取，已切换为简化显示。');
  } catch (error) {
    console.error(error);
    showToast('美术清单无法读取，正在使用简化画面。');
    artwork = { manifest: {}, images: new Map(), loaded: 0, total: 0 };
  }
  updateOrientation();
  window.requestAnimationFrame(onFrame);
  if (saveIssue) showStorageIssue();
}

boot();
