import { GiftCodeUI } from './gift-code-ui.js';
import {MenuMusic} from './menu-music.js';
import {AudioSettings} from './audio-settings.js';
import { createBattleFlow } from './battle-flow.js';
import { createBattleDrawController } from './battle-draw-controller.js';
import { createBattleTips } from './battle-tips.js';
import './touch-ui.js';
import './qibing-ui.js';
import { createHandDrag } from './hand-drag.js';
import { createPressInspect } from './press-inspect.js';
import { battleRuleSections, battleObjectiveCopy } from './battle-help.js';
import { bossRules } from './boss-mechanics.js';
import { getCard } from './cards.js';
import { createHandLayout } from './hand-layout.js';
import { cardRuleSections } from './card-rules.js';
import { renderBattleDetailRules } from './battle-detail-content.js';
import { closeHeroEffectDialog, isHeroEffectDialogOpen } from './hero-effect-dialog.js';
import { cardAttackRange } from './attack-range.js';
import { getCardRarity } from './card-rarity.js';
import { createGameCard } from './game-card.js';
import { createBattleCommandPreview } from './battle-command-preview.js';
import { getHero, getFaction } from './factions.js';
import {
  attackPositions, attackUnit, castSpell, confirmMulligan, endTurn,
  effectiveAttack, findGeneral, getLevel, movementPath, moveUnit, occupiedUnit, playCard, restoreMatch, spellTargets,
  startBotTurn, summonPositions, toggleMulligan, useBattleCommand, battleCommandTargets, spellPositions, getBattleCard, getUnitBattleCard, canUseHandCard, replaceHandCard, canReplaceHandCard
} from './engine.js';
import { createCampaignMatch, objectiveText } from './engine.js';
import * as battleRules from './engine.js';
import { hasAvailablePlayerAction } from './battle-available-actions.js';
import { EXPEDITION_LEVELS } from './expedition-data.js';
import { PlayerProfile } from './profile.js';
import { ExpeditionUI } from './expedition-ui.js';
import { ResourceRewardsUI } from './resource-rewards-ui.js';
import { RewardPresentation } from './reward-presentation.js';
import { renderBattleRewardSummary } from './battle-reward-summary.js';
import { createPlatformProgress } from './platform-progress.js';
import { PlatformProgressUI } from './platform-progress-ui.js';
import { BoardRenderer } from './renderer.js';
import { SceneLoading } from './scene-loading.js';
import { assetImage, assetFetch } from './asset-loading.js';
import { PlayerCloud } from './player-cloud.js';
import { SAVE_KEYS } from './storage-keys.js';
import { rewardedAd } from './rewarded-ad.js';
import { parsePlist, framesWithPrefix, drawAtlasFrame } from './atlas.js';

const handLayout = createHandLayout(document.getElementById('hand'), document.getElementById('hand-count'));
const commandIconFrames = new Map();
const commandIcons = { 1:'f1_roar',23:'f1_afterglow',101:'f2_blink',123:'f2_twilightsurge',201:'f3_psionicrecall',223:'f3_windshroud2',301:'f4_shadowspawn',323:'f4_taint',401:'f5_overload',418:'f5_seekingeye',501:'f6_warbird',527:'f6_kinectcoil' };
function loadCommandIcon(iconName) {
  if (!commandIconFrames.has(iconName)) {
    const request = Promise.all([
      assetImage(`./assets/ui/generalspell_${iconName}.png`),
      assetFetch(`./assets/ui/generalspell_${iconName}.plist`)
    ]).then(async ([image, response]) => {
      const frame = framesWithPrefix(parsePlist(await response.text()), `generalspell_${iconName}_`)[0];
      if (!image || !frame) throw new Error('Command icon atlas unavailable');
      return { image, frame };
    }).catch(error => { commandIconFrames.delete(iconName); throw error; });
    commandIconFrames.set(iconName, request);
  }
  return commandIconFrames.get(iconName);
}
function drawCommandIcon(canvas, iconName) {
  if (canvas.dataset.commandIcon === iconName) return;
  canvas.dataset.commandIcon = iconName;
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  loadCommandIcon(iconName).then(({ image, frame }) => {
    if (canvas.dataset.commandIcon !== iconName) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawAtlasFrame(ctx, image, frame, canvas.width / 2, canvas.height / 2, {
      scale: .92 * Math.min(canvas.width / frame.canvasWidth, canvas.height / frame.canvasHeight)
    });
  }).catch(() => { if (canvas.dataset.commandIcon === iconName) delete canvas.dataset.commandIcon; });
}

const $ = (id) => document.getElementById(id);
const ui = {
  match: $('match'),
  leave: $('leave-match'), turn: $('turn-label'), phase: $('phase-label'), mana: $('mana-count'),
  levelKicker: $('level-kicker'), levelTitle: $('level-title'), levelGoal: $('level-goal'),
  manaOrbs: $('mana-orbs'), bbs: $('bbs-button'), endTurn: $('end-turn'), playerHp: $('player-hp'),
  enemyHp: $('enemy-hp'), playerDeck: $('player-deck-count'), enemyDeck: $('enemy-deck-count'),
  hand: $('hand'), instruction: $('hand-instruction'), selectedUnit: $('selected-unit-label'),
  replaceCard: $('replace-hand-card'), drawStatus: $('draw-hand-status'),
  battleLog: $('battle-log'), board: $('board'), hint: $('board-hint'),
  battleRow: document.querySelector('.battle-row'), unitInspect: $('unit-inspect'),
  inspectCast: $('inspect-cast'), objective: $('objective-dialog'), objectiveOpen: $('objective-open'),
  objectiveClose: $('objective-close'), objectiveTitle: $('objective-title'), objectiveGoal: $('objective-goal'),
  objectiveLimit: $('objective-limit'),
  moveCancelZone: $('move-cancel-zone'),
  unitInspectCost: $('unit-inspect-cost'), unitInspectRange: $('unit-inspect-range'), unitInspectArt: $('unit-inspect-art'), unitInspectName: $('unit-inspect-name'),
  unitInspectType: $('unit-inspect-type'), unitInspectAttack: $('unit-inspect-attack'),
  unitInspectHealth: $('unit-inspect-health'), unitInspectDescription: $('unit-inspect-description'),
  result: $('game-result'), resultTitle: $('result-title'), resultCopy: $('result-copy'),
  resultReward: $('result-reward'), resultProgress: $('result-progress'),
  resultAd: $('result-ad-reward'), resultAdStatus: $('result-ad-status'),
  backToLobby: $('back-to-lobby'), playAgain: $('play-again'), nextLevel: $('next-level'), confirmScreen: $('confirm-screen'),
  confirmCopy: $('confirm-copy'), confirmCancel: $('confirm-cancel'), confirmAccept: $('confirm-accept')
};

const battleTips = createBattleTips({ root: document.querySelector('.battle-top-center') });
const battleFlow = createBattleFlow(ui.match, { onSelect: onHandCard, onConfirm: advanceTurn, makeCard: (id, index) => cardButton(getBattleCard(match, id), index) });
let announcedTurn = '', pendingTurn = null;
let botRunToken = 0;
async function announceTurn() {
  if (!match || ui.match.hidden || ui.objective.open || ['mulligan', 'over'].includes(match.phase)) return;
  const target = match, epoch = matchEpoch;
  const key = `${epoch}:${match.round}:${match.currentPlayer}`;
  if (announcedTurn === key) { await pendingTurn; return; }
  announcedTurn = key;
  closeInspect(); commandPreview?.close();
  const complete = pendingTurn = battleFlow.announce(match.currentPlayer === 0 ? '你的回合' : `${match.players[match.currentPlayer].name}的回合`);
  refreshMatch();
  await complete;
  if (pendingTurn === complete) pendingTurn = null;
  if (match === target && matchEpoch === epoch && !ui.match.hidden) refreshMatch();
}

const renderer = new BoardRenderer(ui.board, {
  backCanvas: $('battle-fx-back'), frontCanvas: $('battle-fx-front'),
  onVisualFrame: refreshVisibleHealth
});

const drawController = createBattleDrawController(ui.match, ui.hand, {
  state: () => match, epoch: () => matchEpoch,
  card: (id, owner) => getBattleCard(match,id,owner),
  drawArt: (canvas, id) => renderer.drawCardArt(canvas, id),
  onBusyChange: () => { if (match && !ui.match.hidden) refreshMatch(); },
  onSettled: () => { if (match && !ui.match.hidden) refreshMatch(); }
});

const menuMusic=new MenuMusic({context:renderer.effects.audioContext});
const audioSettings=new AudioSettings(menuMusic, { effects:renderer.effects });
const syncMenuMusic=()=>menuMusic.setHomeVisible(!$('expedition-home').hidden&&$('expedition-home').dataset.page==='menu'&&ui.match.hidden);
const musicVisibility=new MutationObserver(syncMenuMusic);
musicVisibility.observe($('expedition-home'),{attributes:true,attributeFilter:['hidden','data-page']});
musicVisibility.observe(ui.match,{attributes:true,attributeFilter:['hidden']});
menuMusic.subscribe(()=>expeditionUI?.refreshMusicControl());
const sceneLoading = new SceneLoading({
  renderer,
  // Command text remains usable if an optional icon cannot be downloaded.
  prepareUI: state => Promise.allSettled((state?.players ?? []).map(player => commandIcons[player.generalId]).filter(Boolean).map(loadCommandIcon))
});

// The saved result is immediate; visible health follows each original attack's impact.
function refreshVisibleHealth(units) {
  for (const [owner, label] of [[0, ui.playerHp], [displayedEnemy(units), ui.enemyHp]]) {
    const general = units.find((unit) => unit.owner === owner && getCard(unit.cardId)?.type === 'general');
    const health = Math.max(0, general?.health ?? 0);
    const maximum = Math.max(1, (general?.maxHealth ?? 25) + (general?.healthBuff ?? 0));
    const value = `${health} / ${maximum}`;
    const fill = $(owner === 0 ? 'player-hp-fill' : 'enemy-hp-fill');
    fill.style.width = `${Math.min(100, health / maximum * 100)}%`;
    if (label.textContent !== value) label.textContent = value;
  }
}
function displayedEnemy(units = match?.units ?? []) {
  const living = units.filter(unit=>unit.owner!==0 && unit.health>0 && getCard(unit.cardId)?.type==='general');
  return living.find(unit=>unit.owner===match.currentPlayer)?.owner ?? living.find(unit=>unit.owner===focusedEnemyOwner)?.owner ?? living[0]?.owner ?? 1;
}
let match = null;
let overviewBoardKey = '';
let selectedCardIndex = null;
let cardFollowup = null;
let handDragPointer = null;
let inspectedHandIndex = null;
let inspectOpen = false;
let inspectHandSourceIndex = null;
let inspectHandCardId = null;
let handPresentationMatch = null;
let handPresentationKey = '';
let commandMode = false;
let commandPreview = null;
let hoveredUnitId = null;
let inspectedUnitId = null;
let inspectArtFrame = null;
let inspectLayoutFrame = null;
let inspectArtCardId = null;
function stopInspectArt() { cancelAnimationFrame(inspectArtFrame); inspectArtFrame = null; inspectArtCardId = null; }
function animateInspectArt(cardId) {
  if (inspectArtCardId === cardId) return;
  stopInspectArt(); inspectArtCardId = cardId;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const frame = time => {
    if (!inspectOpen || ui.unitInspect.hidden || ui.match.hidden) { stopInspectArt(); return; }
    renderer.drawCardIdle(ui.unitInspectArt, cardId, reduced ? 0 : time);
    if (!reduced) inspectArtFrame = requestAnimationFrame(frame);
  };
  frame(performance.now());
}
let keyboardInspectUnitId = null;
let cardPreviewPosition = null;
let moveGesture = null;
let movePanFrame = null;
let boardPointerId = null;
let movementPlayback = false;
let actionPlayback = false;
let hintTimer = null;
let matchEpoch = 0;
let replacingPlayerSave = false;
let playerCloud = null;
let cloudChoice = null;
let cloudBusy = false;
let cloudReturnFocus = null;
let cloudActionError = '';
let confirmResolver = null;
let confirmReturnFocus = null;
let lastSettlement = null;
let adRewardSession = null;
let resultRewardDay = null;
let expeditionUI = null;
let resourceRewardsUI = null;
let cameraGesture = null;
let botRunning = false;
let botFailure = '';
let focusedEnemyOwner = 1;
let enemyFocusIndex = 0;
playerCloud = new PlayerCloud({
  onChange: () => refreshCloudUI(),
  onRestore: () => {
    replacingPlayerSave = true;
    invalidateCampAds();
    cancelBattleAd();
    matchEpoch += 1;
    match = null;
    window.location.reload();
  }
});
const playerStorage = {
  getItem: (key) => localStorage.getItem(key),
  removeItem: (key) => {
    if (playerCloud.state.blocked) throw new Error('存档恢复未完成，已暂停写入以保护进度。');
    localStorage.removeItem(key);
  },
  setItem: (key, value) => {
    if (playerCloud.state.blocked) throw new Error('存档恢复未完成，已暂停写入以保护进度。');
    localStorage.setItem(key, value);
  }
};
const expedition = new PlayerProfile(playerStorage);
const platformProgress = createPlatformProgress({ readState: () => expedition.state });
const platformProgressUI = new PlatformProgressUI({ service: platformProgress });
let platformProgressSignature = '';
function syncPlatformProgress() {
  if (replacingPlayerSave || playerCloud.state.blocked || expedition.error) return;
  const signature = JSON.stringify([expedition.state.completed, expedition.state.inventory]);
  if (signature === platformProgressSignature) return;
  platformProgressSignature = signature;
  void platformProgress.syncAchievements();
}
expedition.subscribe(syncPlatformProgress);
const giftCodeUI = new GiftCodeUI({ progress: expedition, onClose: () => {
  audioSettings.open(audioSettings.opener);
  audioSettings.giftCode.focus();
}, onReward: () => expeditionUI?.refresh() });
audioSettings.onGiftCode = () => giftCodeUI.open();
expedition.subscribe(() => playerCloud.notifyLocalChange());

const rewardPresentation = new RewardPresentation();
resourceRewardsUI = new ResourceRewardsUI({ progress: expedition, onClose: () => expeditionUI?.refresh(), onReward: receipt => rewardPresentation.show(receipt) });
expeditionUI = new ExpeditionUI({
  root: $('expedition-home'), progress: expedition,
  drawCardArt: (canvas, id) => renderer.drawCardArt(canvas, id),
  drawCardIdle: (canvas, id, time) => renderer.drawCardIdle(canvas, id, time),
  onStart: (id) => void startExpedition(id), onResume: resumeExpedition,
  onCloud: openPlayerCloud,
  onLeaderboard: target => platformProgressUI.open('leaderboard', target),
  onAchievements: target => platformProgressUI.open('achievements', target),
  onAudioSettings: (target) => audioSettings.open(target),
  onMusicToggle: (event) => menuMusic.toggle(event),
  musicPreferences: () => menuMusic.preferences,
  onResourceRewards: () => resourceRewardsUI.open(),
});
expeditionUI.show();
syncPlatformProgress();

function showExpeditionHome() {
  invalidateCampAds();
  commandPreview?.close();
  closeMapOverview(false);
  ui.match.hidden = true;
  expeditionUI.show();
}

function cloudSummaryText(element, summary, unavailable = false, protectedLocal = false, unread = false) {
  element.replaceChildren();
  if (!summary || unavailable) {
    const empty = document.createElement('div');
    empty.className = 'cloud-empty';
    const title = document.createElement('strong');
    title.textContent = protectedLocal ? '本机存档受保护' : unavailable ? '尚未连接' : unread ? '暂未读取' : element.id === 'cloud-local-summary' ? '暂无本机存档' : '暂无云存档';
    const hint = document.createElement('span');
    hint.textContent = protectedLocal ? '暂无法读取进度，请查看上方提示；原件不会被覆盖' : unavailable ? '在 TapTap 内可备份和恢复进度' : unread ? '刷新后查看云端进度' : element.id === 'cloud-local-summary' ? '开始远征后自动保存' : '备份本机进度即可建立';
    empty.append(title, hint); element.append(empty); return;
  }
  const metrics = document.createElement('dl'); metrics.className = 'cloud-metrics';
  for (const [label, value] of [
    ['远征', `${summary.completed ?? 0}/${EXPEDITION_LEVELS.length}`],
    ['金币', summary.coins ?? 0],
    ['卡牌', summary.cards ?? 0]
  ]) {
    const row = document.createElement('div');
    const term = document.createElement('dt');

    term.append(document.createTextNode(label));
    const amount = document.createElement('dd'); amount.textContent = String(value);
    row.append(term, amount); metrics.append(row);
  }
  const battle = document.createElement('span'); battle.className = 'cloud-battle-badge';
  battle.dataset.active = String(Boolean(summary.hasBattle));
  battle.textContent = summary.hasBattle ? '可续战' : '无进行中战斗';
  const date = document.createElement('small'); date.className = 'cloud-updated';
  date.textContent = summary.savedAt ? `更新 ${new Date(summary.savedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : '尚未同步';
  element.append(metrics, battle, date);
}

function refreshCloudUI() {
  if (!playerCloud) return;
  const state = playerCloud.state;
  document.querySelectorAll('[data-action="cloud"]').forEach(button => {
    button.dataset.cloudStatus = state.status;
    button.setAttribute('aria-label', `存档：${state.label || '保存在本机'}`);
  });
  const errorText = cloudActionError || state.error;
  $('player-cloud-status').textContent = /^读取云存档失败/.test(errorText)
    ? '云存档读取失败，请稍后刷新'
    : errorText || (!state.available ? '进度自动保存在本机' : state.label) || '进度保存在本机';
  $('cloud-dialog').querySelector('footer').hidden = !state.available;
  // A failed/protected read is different from a successfully read empty slot.
  cloudSummaryText($('cloud-local-summary'), state.localSummary, false, !state.localSummary && Boolean(state.blocked || state.error));
  cloudSummaryText($('cloud-remote-summary'), state.cloudSummary, !state.available, false, Boolean(state.error));
  $('player-cloud-status').dataset.error = String(Boolean(cloudActionError || state.error));
  const choosing = cloudChoice !== null;
  $('cloud-choice-copy').hidden = !choosing;
  $('cloud-choice-copy').textContent = cloudChoice === 'local'
    ? '确认用本机进度替换云端？原云端副本会先保存在本机。'
    : '确认使用云端进度？本机进度会先备份，随后重新进入游戏。';
  $('cloud-refresh').hidden = !state.available || choosing;
  $('cloud-use-local').hidden = !state.available || choosing || state.blocked;
  $('cloud-use-local').textContent = state.conflict ? '使用本机进度' : state.hasRemote ? '同步到云端' : '备份到云端';
  $('cloud-use-remote').hidden = !state.available || !state.hasRemote || choosing || state.blocked;
  $('cloud-choice-back').hidden = !choosing;
  $('cloud-choice-confirm').hidden = !choosing;
  $('cloud-choice-confirm').textContent = cloudChoice === 'local' ? '确认使用本机' : '确认使用云端';
  for (const id of ['cloud-refresh', 'cloud-use-local', 'cloud-use-remote', 'cloud-choice-back', 'cloud-choice-confirm']) $(id).disabled = cloudBusy;
  if (state.blocked && expeditionUI) {
    expeditionUI.root.inert = true;
    if (!$('cloud-dialog').open) $('cloud-dialog').showModal();
  }
  $('cloud-close').disabled = state.blocked;
}

function openPlayerCloud() {
  invalidateCampAds();
  cloudReturnFocus = document.activeElement;
  cloudChoice = null;
  cloudActionError = '';
  playerCloud.paused = true;
  refreshCloudUI();
  if (!$('cloud-dialog').open) $('cloud-dialog').showModal();
  $('cloud-close').focus();
  if (playerCloud.state.available) void runCloudAction('refresh');
}

async function runCloudAction(action) {
  if (cloudBusy) return;
  cloudBusy = true;
  cloudActionError = '';
  refreshCloudUI();
  try {
    let result;
    if (action === 'refresh') result = await playerCloud.refresh();
    else if (action === 'local') result = await playerCloud.sync({ useLocal: playerCloud.state.hasRemote });
    else if (action === 'remote') result = await playerCloud.restore();
    if (result?.stale) cloudActionError = result.error;
  } catch (error) {
    cloudActionError = `云端操作未完成，本机进度保留：${error.message}`;
  } finally {
    cloudBusy = false;
    cloudChoice = null;
    refreshCloudUI();
  }
}

$('cloud-close').addEventListener('click', () => $('cloud-dialog').close());
$('cloud-dialog').addEventListener('cancel', event => { if (playerCloud.state.blocked) event.preventDefault(); });
$('cloud-dialog').addEventListener('close', () => {
  playerCloud.paused = false;
  cloudChoice = null;
  if (cloudReturnFocus?.isConnected) cloudReturnFocus.focus({ preventScroll: true });
});
$('cloud-refresh').addEventListener('click', () => void runCloudAction('refresh'));
$('cloud-use-local').addEventListener('click', () => {
  if (playerCloud.state.hasRemote) { cloudChoice = 'local'; refreshCloudUI(); $('cloud-choice-confirm').focus(); }
  else void runCloudAction('local');
});
$('cloud-use-remote').addEventListener('click', () => { cloudChoice = 'remote'; refreshCloudUI(); $('cloud-choice-confirm').focus(); });
$('cloud-choice-back').addEventListener('click', () => { cloudChoice = null; refreshCloudUI(); $('cloud-use-local').focus(); });
$('cloud-choice-confirm').addEventListener('click', () => void runCloudAction(cloudChoice));

// Never let an older in-memory battle overwrite another tab's newly saved progress.
window.addEventListener('storage', (event) => {
  if (event.key !== SAVE_KEYS.profile) return;
  replacingPlayerSave = true;
  invalidateCampAds();
  matchEpoch += 1;
  match = null;
  playerCloud.dispose();
  window.location.reload();
});
window.addEventListener('online', () => void playerCloud.refresh());

async function startExpedition(levelId) {
  if (sceneLoading.busy || !expedition.isUnlocked(levelId)) return;
  const capturedEpoch = matchEpoch;
  const snapshot = expedition.state.activeBattle;
  if (snapshot && snapshot.phase !== 'over') {
    if (!await askConfirmation('开始新战斗将替换未完成的棋局。已获得的金币、卡牌和通关记录会保留。', '开始战斗', { intent: 'replace-battle' })) return;
  }
  if (sceneLoading.busy || capturedEpoch !== matchEpoch) return;
  try {
    const { heroId, deck } = expedition.getBattleLoadout();
    const next = createCampaignMatch(levelId, heroId, deck);
    await sceneLoading.run(() => {
      const saved = expedition.saveBattle(next);
      if (!saved.ok) throw new Error(saved.error || '战斗未保存，尚未进入战场。');
      matchEpoch += 1; lastSettlement = null; match = next;
      enterMatch();
    }, { title: '准备战场', isCurrent: () => capturedEpoch === matchEpoch, battle: next });
  } catch (error) { expeditionUI.page = 'prep'; expeditionUI.flash(`无法出征：${error.message}`); expeditionUI.refresh(); }
}

async function resumeExpedition() {
  if (sceneLoading.busy) return;
  const capturedEpoch = matchEpoch;
  const snapshot = expedition.state.activeBattle;
  const restored = snapshot && restoreMatch(snapshot);
  if (!restored) { expeditionUI.refresh(); return; }
  await sceneLoading.run(() => {
    const selected = expedition.selectHero(restored.players[0].generalId);
    if (!selected.ok) { expeditionUI.flash(selected.error); expeditionUI.refresh(); return false; }
    expeditionUI.codexFaction = getHero(restored.players[0].generalId).faction;
    matchEpoch += 1; lastSettlement = null; match = restored;
    enterMatch(true);
  }, { title: '准备战场', isCurrent: () => capturedEpoch === matchEpoch, battle: restored });
}

let shownBossAnnounce = 0;
function showHint(message) {
  ui.hint.textContent = message;
  ui.hint.classList.add('visible');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => ui.hint.classList.remove('visible'), Math.min(4500, Math.max(2500, message.length * 65))); 
}

function askConfirmation(message, acceptText, { title = '确认操作', cancelFirst = false, intent = '' } = {}) {
  if (confirmResolver) return Promise.resolve(false);
  $('confirm-title').textContent = title;
  ui.confirmScreen.dataset.intent = intent;
  confirmReturnFocus = document.activeElement;
  ui.confirmCopy.textContent = message;
  ui.confirmAccept.textContent = acceptText;
  ui.confirmScreen.hidden = false;
  (cancelFirst ? ui.confirmCancel : ui.confirmAccept).focus();
  return new Promise((resolve) => { confirmResolver = resolve; });
}

function settleConfirmation(accepted) {
  if (!confirmResolver) return;
  const resolve = confirmResolver;
  confirmResolver = null;
  ui.confirmScreen.hidden = true;
  if (confirmReturnFocus?.isConnected) confirmReturnFocus.focus();
  resolve(accepted);
}

function activeTurn() {
  return Boolean(match && !ui.objective.open && !battleFlow.busy && !drawController.busy && !movementPlayback && !actionPlayback && !moveGesture?.dragging && match.phase === 'playing' && match.currentPlayer === 0);
}

function drawBoard() {
  if (!match) return;
  if (hoveredUnitId && !match.units.some((unit) => unit.unitId === hoveredUnitId)) hoveredUnitId = null;
  const selectedId = selectedCardIndex === null ? null : match.players[0].hand[selectedCardIndex];
  const selectedSpell = selectedId == null ? null : getBattleCard(match, selectedId);
  const primaryTargets = ['occupiedCell', 'areaCell'].includes(selectedSpell?.target) ? { type: 'cell', cells: spellPositions(match, selectedSpell, 0), unitIds: [] } : null;
  const cardBounds = selectedCardIndex === null ? null : ui.hand.children[selectedCardIndex]?.getBoundingClientRect();
  const general = commandMode ? findGeneral(match, 0) : null;
  const skillBounds = ui.bbs.getBoundingClientRect();
  const cardSourcePoint = general ? {x:skillBounds.left+skillBounds.width/2,y:skillBounds.top+skillBounds.height/2}
    : cardBounds ? { x: cardBounds.left + cardBounds.width / 2, y: cardBounds.top + 2 } : null;
  renderer.draw(match, {
    observedUnitId: inspectOpen && inspectHandSourceIndex === null && match.units.some(unit => unit.unitId === inspectedUnitId && unit.owner !== 0) ? inspectedUnitId : null,
    selectedUnitId: match.selectedUnitId, selectedCardId: selectedId, hoveredUnitId,
    commandTargets: cardFollowup ? { type: cardFollowup.type, cells: cardFollowup.cells || [], unitIds: cardFollowup.unitIds || [] } : commandMode ? battleCommandTargets(match, 0) : primaryTargets,
    cardFollowupActive: Boolean(cardFollowup),
    cardPreviewPosition, cardSourcePoint, handDragPointer, handDragging:ui.hand.dataset.dragging === 'true' || Boolean(commandMode && handDragPointer),
    movementPreview: moveGesture?.dragging ? moveGesture : null
  });
  refreshUnitInspect();
}

function refreshUnitInspect() {
  if (inspectHandSourceIndex !== null && match?.players[0].hand[inspectHandSourceIndex] !== inspectHandCardId) { inspectHandSourceIndex = null; inspectOpen = false; }
  const handCard = inspectHandSourceIndex === null ? null : getBattleCard(match, match?.players[0].hand[inspectHandSourceIndex]);
  const unit = match?.units.find((entry) => entry.unitId === inspectedUnitId);
  let card = handCard ?? (unit ? getUnitBattleCard(match, unit) : null);
  if (!inspectOpen || ui.hand.dataset.dragging === 'true' || !card || ui.match.hidden || ui.objective.open || moveGesture?.dragging || match.phase === 'over') {
    closeHeroEffectDialog({restoreFocus:false});
    if (!card || ui.match.hidden || ui.objective.open || match?.phase === 'over') inspectOpen = false;
    stopInspectArt();
    ui.unitInspect.hidden = true;
    ui.unitInspect.setAttribute('aria-hidden', 'true');
    return;
  }
  ui.unitInspect.hidden = false;
  ui.unitInspect.setAttribute('aria-hidden', 'false');
  ui.unitInspect.classList.toggle('hand-preview', Boolean(handCard));
  ui.unitInspect.classList.toggle('spell-preview', card.type === 'spell');
  ui.unitInspect.style.setProperty('--inspect-frame', `url('./assets/card-backgrounds/${card.faction === 0 ? 'neutral-unit' : `f${card.faction || 1}-${card.type === 'spell' ? 'spell' : 'unit'}`}.png')`);
  ui.unitInspectCost.textContent = card.cost == null ? '' : String(card.cost);
  ui.unitInspectCost.hidden = card.cost == null;
  ui.unitInspectCost.setAttribute('aria-label', `${card.cost ?? 0}法力`);
  const attackRange = cardAttackRange(!handCard && unit?.silenced ? { ...card, ranged:false, blast:false } : card);
  ui.unitInspectRange.hidden = attackRange === null;
  ui.unitInspectRange.textContent = attackRange === null ? '' : Number.isFinite(attackRange) ? String(attackRange) : '∞';
  ui.unitInspectRange.setAttribute('aria-label', Number.isFinite(attackRange) ? `攻击射程${attackRange}格` : '无限射程');
  ui.unitInspectName.textContent = card.name;
  ui.unitInspectType.textContent = ({ general: '主将', spell: '法术', unit: '随从' })[card.type];
  ui.unitInspect.dataset.faction = String(card.faction ?? 0);
  const inspectFace = ui.unitInspect.querySelector('.unit-inspect-card');
  inspectFace.dataset.faction = String(card.faction ?? 0);
  inspectFace.className = `unit-inspect-card game-card game-card-${card.type}${card.type !== 'spell' ? ' is-entity' : ''}`;
  inspectFace.style.setProperty('--card-frame', 'var(--inspect-frame)');
  const rarity = card.type !== 'general' && !unit?.token ? getCardRarity(card.id) : null;
  if (rarity) {
    const rarityLabel = document.createElement('span');
    rarityLabel.className = 'inspect-rarity';
    rarityLabel.style.setProperty('--rarity-color', rarity.color);
    rarityLabel.style.setProperty('--rarity-icon', `url('./assets/ui/rarity/${rarity.key === 'basic' ? 'common' : rarity.key}.png')`);
    rarityLabel.textContent = rarity.label;
    ui.unitInspectType.append(rarityLabel);
  }
  ui.unitInspectAttack.parentElement.hidden = card.type === 'spell';
  ui.unitInspectAttack.textContent = card.type === 'spell' ? '' : String(handCard ? card.attack : effectiveAttack(match, unit));
  ui.unitInspectHealth.textContent = card.type === 'spell' ? '' : String(handCard ? card.health : Math.max(0, unit.health));
  const hero = card.type === 'general' ? getHero(card.id) : null;
  ui.unitInspect.classList.toggle('hero-preview', Boolean(hero));
  renderBattleDetailRules(ui.unitInspectDescription, { card, hero, silenced:!handCard && unit?.silenced,
    unit:handCard?null:unit, drawArt:(canvas,id) => renderer.drawCardArt(canvas,id) });
  ui.unitInspectDescription.tabIndex = 0;
  ui.inspectCast.hidden = true;
  ui.inspectCast.textContent = `施放${card.name}`;
  ui.inspectCast.disabled = !activeTurn() || match.players[0].mana < card.cost || !canUseHandCard(match, inspectedHandIndex);
  $('inspect-followup-skip').hidden = !cardFollowup?.deployment || !cardFollowup.optional;
  $('inspect-followup-skip').disabled = !activeTurn();
  animateInspectArt(card.id);
  const bounds = ui.match.getBoundingClientRect();
  const safeStyle = getComputedStyle(document.documentElement);
  const inset = edge => Math.max(0, parseFloat(safeStyle.getPropertyValue(`--device-safe-${edge}`)) || 0);
  const sideFloor = Math.max(0, parseFloat(safeStyle.getPropertyValue('--safe-side-floor')) || 0);
  const safeLeft = Math.max(sideFloor, inset('left')) + 8;
  const safeRight = Math.max(sideFloor, inset('right')) + 8;
  const topEdge = Math.max(inset('top')+8,54);
  const availableHeight = Math.max(0,bounds.height-topEdge-inset('bottom')-8);
  const width = Math.min(224,availableHeight*224/296,bounds.width-safeLeft-safeRight);
  const height = width*296/224;
  const handBounds = handCard && ui.hand.children[inspectHandSourceIndex]?.getBoundingClientRect();
  const anchor = handCard ? {x:handBounds ? handBounds.left+handBounds.width/2 : bounds.left+bounds.width/2} : renderer.getUnitAnchor(unit);
  // Inspect opposite its source, preserving the source card for the next drag.
  const right = anchor.x < bounds.left+bounds.width/2;
  ui.unitInspect.style.width=`${width}px`;
  ui.unitInspect.style.height=`${height}px`;
  ui.unitInspect.style.maxHeight=`${height}px`;
  ui.unitInspect.style.setProperty('--inspect-card-height',`${height}px`);
  ui.unitInspect.style.left=`${right?bounds.width-safeRight-width:safeLeft}px`;
  ui.unitInspect.style.top=`${topEdge}px`;
  cancelAnimationFrame(inspectLayoutFrame);

}

let objectiveRulesView = false;
let objectiveFromHome = false;
let objectiveReturnFocus = null;
let activeRuleSection = 'keywords';

function renderRuleSection(id) {
  const sections = battleRuleSections(objectiveFromHome ? null : match);
  const section = sections.find(item => item.id === id) ?? sections[0];
  activeRuleSection = section.id;
  for (const tab of $('rule-tabs').querySelectorAll('[role="tab"]')) {
    const selected = tab.dataset.ruleTab === section.id;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  $('battle-rules-panel').setAttribute('aria-labelledby', `rule-tab-${section.id}`);
  $('battle-rules').replaceChildren(...section.entries.map(([name, text]) => {
    const row = document.createElement('div');
    const title = document.createElement('dt'); title.textContent = name;
    const description = document.createElement('dd'); description.textContent = text;
    row.append(title, description); return row;
  }));
  ui.objective.querySelector('.objective-body').scrollTop = 0;
}

$('rule-tabs').addEventListener('click', event => {
  const tab = event.target.closest('[data-rule-tab]');
  if (tab) renderRuleSection(tab.dataset.ruleTab);
});
$('rule-tabs').addEventListener('keydown', event => {
  const tabs = [...$('rule-tabs').querySelectorAll('[role="tab"]')];
  const current = tabs.indexOf(document.activeElement);
  if (current < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
    : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  renderRuleSection(tabs[next].dataset.ruleTab);
  tabs[next].focus({ preventScroll: true });
});

function setObjectiveView(rulesView) {
  objectiveRulesView = rulesView;
  ui.objective.dataset.view = rulesView ? 'rules' : 'goal';
  ui.objective.querySelector('.objective-actions').hidden = objectiveFromHome;
  ui.objectiveTitle.textContent = rulesView ? '战斗规则' : '本局目标';
  ui.objective.querySelector('.objective-heading img').hidden = objectiveFromHome;
  ui.objectiveGoal.hidden = rulesView;
  ui.objectiveLimit.hidden = rulesView;
  $('objective-boss').hidden = rulesView || !bossRules(match).length || objectiveFromHome;
  $('rule-tabs').hidden = !rulesView;
  $('battle-rules-panel').hidden = !rulesView;
  ui.objective.querySelector('.objective-body').tabIndex = rulesView ? -1 : 0;
  if (rulesView) renderRuleSection(activeRuleSection);
  $('objective-rules').hidden = objectiveFromHome;
  $('objective-rules').textContent = rulesView ? '本局目标' : '战斗规则';
  ui.objective.setAttribute('aria-describedby', rulesView ? 'battle-rules' : 'objective-goal objective-limit');
  ui.objective.querySelector('.objective-body').scrollTop = 0;
  ui.objectiveTitle.focus({ preventScroll: true });
}

function showBattleRulesFromHome() {
  if (!ui.match.hidden || ui.objective.open) return;
  objectiveFromHome = true;
  objectiveReturnFocus = document.activeElement;
  setObjectiveView(true);
  ui.objectiveClose.textContent = '关闭';
  ui.objective.showModal();
  ui.objectiveTitle.focus({ preventScroll: true });
}

function showObjective() {
  if (!match || match.phase === 'over' || movementPlayback || actionPlayback) return;
  cancelMoveGesture();
  selectedCardIndex = inspectedHandIndex = null; cardFollowup = null;
  commandMode = false;
  hoveredUnitId = inspectedUnitId = null;
  const level = getLevel(match.levelId);
  objectiveFromHome = false;
  objectiveReturnFocus = ui.objectiveOpen;
  const brief = battleObjectiveCopy(match, level);
  ui.objectiveGoal.textContent = brief.goal;
  ui.objectiveLimit.textContent = brief.limit;
  $('objective-boss').replaceChildren(...bossRules(match).flatMap(rule => {
    const term = document.createElement('dt'), detail = document.createElement('dd');
    term.textContent = rule.title; detail.textContent = rule.text;
    return [term, detail];
  }));
  setObjectiveView(false);
  ui.objectiveClose.textContent = match.lastAction ? '返回战场' : '进入战场';
  ui.objectiveOpen.setAttribute('aria-expanded', 'true');
  ui.objective.showModal();
  refreshMatch();
  ui.objective.querySelector('.objective-body').scrollTop = 0;
  // Reading starts at the heading; the action receives a focus ring only on keyboard navigation.
  ui.objectiveTitle.focus({ preventScroll: true });
}

function closeObjective() {
  ui.objective.close();
  ui.objectiveOpen.setAttribute('aria-expanded', 'false');
  objectiveReturnFocus?.focus({ preventScroll: true });
  if (!objectiveFromHome) { refreshMatch(); void announceTurn().then(runBotIfNeeded); }
}

function persist(state = match) {
  if (!state || replacingPlayerSave || state.mode !== 'expedition') return false;
  const outcome = state.phase === 'over' && state.winner === 0 ? expedition.settle(state) : expedition.saveBattle(state);
  if (outcome.ok && state.phase === 'over' && state.winner === 0 && (!outcome.duplicate || lastSettlement?.runId !== state.runId)) lastSettlement = { runId: state.runId, ...outcome };
  if (!outcome.ok && match === state) { ui.battleLog.textContent = outcome.error; showHint(outcome.error); }
  if (outcome.ok) playerCloud.notifyLocalChange();
  return outcome.ok;
}

function enterMatch(restored = false) {
  drawController.cancel(); battleFlow.cancel(); announcedTurn = ""; pendingTurn = null; shownBossAnnounce = 0; botRunToken += 1; botRunning = false; battleTips.setVisible(true);
  invalidateCampAds();
  cancelBattleAd();
  expeditionUI?.hide();
  botFailure = ''; focusedEnemyOwner = 1;
  resetMovementInteraction();
  clearHint();
  ui.match.hidden = false;
  ui.match.dataset.mode = match.mode;
  closeMapOverview(false);
  updateMapNavigation();
  selectedCardIndex = null; cardFollowup = null;
  inspectedHandIndex = null;
  commandMode = false;
  hoveredUnitId = null;
  inspectedUnitId = null;
  cardPreviewPosition = null;
  ui.result.hidden = true;
  refreshMatch();
  {
    const general = findGeneral(match, 0);
    if (general) renderer.focusCell(general.x, general.y);
    drawVisibleOverview();
  }
  if (!restored) persist();
  showObjective();
  runBotIfNeeded();
}

function returnToLobby({ requireSave = false } = {}) {
  if (requireSave && match && !persist()) return;
  drawController.cancel(); battleFlow.cancel(); botRunToken += 1; botRunning = false; battleTips.setVisible(false);
  invalidateCampAds();
  commandPreview?.close();
  closeMapOverview(false);
  cancelBattleAd();
  matchEpoch += 1;
  ui.objective.close();
  resetMovementInteraction();
  if (match && !requireSave) persist();
  ui.match.hidden = true;
  selectedCardIndex = null; cardFollowup = null;
  inspectedHandIndex = null;
  commandMode = false;
  hoveredUnitId = null;
  inspectedUnitId = null;
  cardPreviewPosition = null;
  if (match) expedition.selectHero(match.players[0].generalId);
  expeditionUI.page = 'menu';
  showExpeditionHome();
}

// Invalidate playback evidence before changing routes or replacing the profile.
function invalidateCampAds() {
  rewardPresentation.close();
  resourceRewardsUI?.invalidate();
}

function cancelBattleAd() {
  const session = adRewardSession;
  adRewardSession = null;
  if (!session) return;
  rewardedAd.cancel();
  if (!session.granted && !replacingPlayerSave) expedition.cancelDailyAd('gold', session.requestId);
}

function refreshAdReward() {
  const eligibleBattle = match?.mode === 'expedition' && match.phase === 'over' && match.winner === 0;
  const offer = eligibleBattle ? expedition.dailyAdOffer('gold') : null;
  const session = adRewardSession?.runId === match?.runId ? adRewardSession : null;
  ui.resultAd.hidden = !eligibleBattle;
  ui.resultAd.disabled = Boolean(session?.busy || (!offer?.eligible && !session?.completed));
  ui.resultAd.textContent = session?.busy ? '广告播放中…' : session?.completed && !session.granted
    ? '重试保存奖励' : offer?.eligible ? `看广告，再领${offer.min}～${offer.max}金币` : offer?.claimed ? '今日金币已领取' : '暂时无法领取';
  ui.resultAdStatus.textContent = session?.message || (!offer?.eligible && !offer?.claimed ? offer?.reason : '') || '';
  ui.resultAdStatus.hidden = !eligibleBattle || !ui.resultAdStatus.textContent;
}

async function claimBattleAdReward() {
  if (ui.result.hidden || ui.match.hidden || adRewardSession?.busy || replacingPlayerSave) return;
  if (match?.mode !== 'expedition' || match.phase !== 'over' || match.winner !== 0) return;
  if (!expedition.dailyAdOffer('gold').eligible && !adRewardSession?.completed) return;
  const target = match, epoch = matchEpoch;
  let session = adRewardSession;
  if (!session || session.runId !== target.runId || !session.completed) {
    session = { runId: target.runId, requestId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, busy: false, completed: false, granted: false, message: '' };
    adRewardSession = session;
  }
  const valid = () => adRewardSession === session && match === target && matchEpoch === epoch
    && target.mode === 'expedition' && target.phase === 'over' && target.winner === 0
    && !ui.match.hidden && !ui.result.hidden && !replacingPlayerSave && !playerCloud.state.blocked;
  const begin = expedition.beginDailyAd('gold', session.requestId);
  if (!begin.ok) { session.message = begin.error; refreshAdReward(); return; }
  session.busy = true;
  session.message = '';
  refreshAdReward();
  try {
    if (!session.completed) {
      const result = await rewardedAd.show({ isContextValid: valid });
      if (!valid()) return;
      if (result.status !== 'completed') {
        const cancelled = expedition.cancelDailyAd('gold', session.requestId);
        session.message = cancelled.ok ? (result.message || '未完整观看，未领取额外奖励。') : cancelled.error;
        return;
      }
      // Keep completion evidence in this session if the atomic save needs retrying.
      session.completed = true;
    }
    if (!valid()) return;
    const reward = expedition.completeDailyAd('gold', session.requestId);
    session.granted = reward.ok;
    session.message = reward.ok ? `已获得 ${reward.amount} 金币` : `奖励尚未保存：${reward.error}`;
    if (reward.ok && !reward.duplicate) rewardPresentation.show({ kind:'gold', amount:reward.amount, requestId:session.requestId });
  } catch (error) {
    if (valid()) session.message = `广告未完成：${error?.message || '请稍后再试'}`;
    if (!session.completed && !replacingPlayerSave) expedition.cancelDailyAd('gold', session.requestId);
  } finally {
    session.busy = false;
    if (adRewardSession === session && match === target && matchEpoch === epoch && !ui.match.hidden) refreshMatch();
  }
}

function cardButton(card, index) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.faction=String(card.faction??0);
  refreshHandCardState(button, card, index);
  const attackRange = cardAttackRange(card);
  const rangeLabel = attackRange === null ? '' : Number.isFinite(attackRange) ? `，射程${attackRange}格` : '，无限射程';
  button.setAttribute('aria-label', `${card.name}, 法力 ${card.cost}${card.attack === undefined ? '' : `, ${card.attack} 攻击, ${card.health} 生命`}${rangeLabel}. ${card.description}`);
  button.title = card.description;

  const face = createGameCard(card, { drawArt:(canvas,id) => renderer.drawCardArt(canvas,id) });
  face.setAttribute('aria-hidden','true');
  const rarity = getCardRarity(card.id);
  if (rarity) {
    const gem = document.createElement('span'); gem.className = 'battle-card-rarity';
    gem.style.setProperty('background-image', `url('./assets/ui/rarity/${rarity.key === 'basic' ? 'common' : rarity.key}.png')`);
    gem.title = rarity.label; face.append(gem);
  }
  button.append(face);
  const replacement = document.createElement('span'); replacement.className = 'mulligan-mark'; replacement.textContent = '待换'; replacement.setAttribute('aria-hidden', 'true'); button.append(replacement);
  button.addEventListener('click', event => { if (!event.detail) { if (match?.phase === 'mulligan') onHandCard(index); else inspectHandCard(index); } });
  return button;
}

// Card art/content only changes with the hand or its training. Selection and turn locks do not rebuild canvases.
function refreshHandCardState(button, card, index) {
  const isMulligan = match.phase === 'mulligan';
  const attackRange = cardAttackRange(card);
  const rangeLabel = attackRange === null ? '' : Number.isFinite(attackRange) ? `，射程${attackRange}格` : '，无限射程';
  const playable = activeTurn() && match.players[0].mana >= card.cost && canUseHandCard(match, index);
  button.className = `hand-card${card.type === 'spell' ? ' spell' : ''}${inspectedHandIndex === index ? ' selected' : ''}${!playable && !isMulligan ? ' unplayable' : ''}${isMulligan && match.mulligan.includes(index) ? ' replacing' : ''}`;
  button.setAttribute('aria-pressed', String(isMulligan ? match.mulligan.includes(index) : inspectedHandIndex === index));
  button.removeAttribute('aria-describedby');
  if (isMulligan) button.setAttribute('aria-label', `${card.name}，${card.cost}法力${rangeLabel}，${match.mulligan.includes(index) ? '已选待换，再点取消' : '点击选择起手换牌'}。${card.description}`);
  button.disabled = false;
  button.setAttribute('aria-disabled', 'false');
}
function setPortraitSource(image, source) {
  if (image.getAttribute('src') !== source) image.src = source;
}

function cardTargetInstruction(card) {
  if (cardFollowup) return cardFollowup.type === 'unit' ? '拖出同张牌，选择高亮目标；拖回红区取消' : '拖出同张牌，选择高亮格子；拖回红区取消';
  if (match.players[0].mana < card.cost) return `法力不足：需要${card.cost}点，当前${match.players[0].mana}点`;
  if (isUntargetedSpell(card)) return '拖到战场松手施放，拖回红区取消';
  if (card.target === 'areaCell') return '拖到高亮区域松手施放';
  if (['cell', 'occupiedCell'].includes(card.target)) return spellPositions(match, card, 0).length ? card.target === 'occupiedCell' ? '将指示线指向高亮格子驱散；敌军受伤害' : '将指示线指向高亮召唤格' : '没有合法目标格';
  if (card.type === 'unit') {
    return summonPositions(match, 0, card.id).length
      ? card.airdrop ? '空投：拖到任意高亮空格松手召唤' : '拖到友军周围的高亮空格松手召唤'
      : '没有空闲的合法召唤格';
  }
  // Legal targets follow the current board, including the general's position after moving.
  if (!spellTargets(match, card, 0).length) {
    return ({
      roar: '主将周围一格内没有友方随从',
      heal: '场上没有受伤的单位',
      strike: '场上没有可指定的随从',
      bond: '场上没有可指定的随从'
    })[card.effect] ?? '当前没有合法目标';
  }
  return ({
    roar: '将指示线指向主将周围一格内的友方随从',
    heal: '将指示线指向高亮的受伤单位',
    strike: '将指示线指向高亮的随从',
    bond: '将指示线指向高亮的随从'
  })[card.effect] ?? '将指示线指向高亮目标，松手施放';
}

function refreshDrawControls() {
  const mulligan = match.phase === 'mulligan', player = match.players[0];
  $('draw-hand-controls').hidden = Boolean(cardFollowup) || match.phase === 'over' || (!mulligan && (inspectedHandIndex === null || !activeTurn()));
  ui.drawStatus.hidden = true;
  ui.replaceCard.hidden = mulligan;
  ui.replaceCard.disabled = mulligan || inspectedHandIndex === null || !activeTurn() || !canReplaceHandCard(match, inspectedHandIndex, 0);
  const used = !mulligan && player.hand.length > 0 && player.deck.length > 0 && activeTurn() && player.hand.every((_, index) => !canReplaceHandCard(match, index, 0));
  ui.drawStatus.textContent = mulligan ? `选 ${match.mulligan.length}/2 张待换，确认后才能行动` : !player.deck.length ? '牌库已空，抽牌会使主将受到2点伤害' : !activeTurn() ? `牌库 ${player.deck.length} · 等待己方回合` : used ? `本回合已换牌 · 牌库 ${player.deck.length}` : `每回合换1 · 牌库 ${player.deck.length}`;
  ui.replaceCard.textContent = used ? '本回合已换' : !player.deck.length ? '无法换牌' : inspectedHandIndex === null ? '先选手牌' : '换选中牌';
}

function refreshMatch() {
  $('inspect-followup-skip').hidden = !cardFollowup?.deployment || !cardFollowup.optional;
  $('inspect-followup-skip').disabled = !activeTurn();
  boardInspect?.invalidate();
  handDrag?.invalidate();
  if (!match) return;
  const focusedHandIndex = [...ui.hand.children].indexOf(document.activeElement);
  const human = match.players[0], enemyId = displayedEnemy(), bot = match.players[enemyId];
  const level = getLevel(match.levelId);
  const isMulligan = match.phase === 'mulligan';
  const isOver = match.phase === 'over';
  const isHumanTurn = activeTurn();

  const bossNote = match.boss?.announce;
  if (bossNote && bossNote.serial !== shownBossAnnounce) { shownBossAnnounce = bossNote.serial; if (!isMulligan) showHint(bossNote.text); }
  ui.levelKicker.textContent = `远征 · ${match.board.columns} × ${match.board.rows}`;
  ui.levelTitle.textContent = level.title;
  ui.levelGoal.textContent = objectiveText(match);
  ui.turn.textContent = isMulligan ? '起手准备' : `第 ${match.round} / ${match.turnLimit} 回合`;
  ui.phase.textContent = movementPlayback ? '移动中' : actionPlayback ? ({ summon: '召唤中', attack: '攻击中', spell: '施法中', bbs: '施法中' })[match.lastAction?.kind] ?? '行动中'
    : isMulligan ? `起手换牌 ${match.mulligan.length}/2` : isOver ? (match.winner === 0 ? '远征获胜' : '战斗失利') : match.currentPlayer === 0 ? '你的回合' : `${match.players[match.currentPlayer].name}行动`;
  const manaCapacity = Math.min(9, human.maxMana + Object.values(match.outposts).filter(owner=>owner===0).length);
  ui.mana.textContent = `${human.mana} / ${Math.max(manaCapacity,human.mana)}`;
  const orbCount = Math.min(9, Math.max(manaCapacity, human.mana));
  if (ui.manaOrbs.children.length !== orbCount) {
    ui.manaOrbs.replaceChildren(...Array.from({ length: orbCount }, () => document.createElement('i')));
  }
  [...ui.manaOrbs.children].forEach((orb, index) => orb.classList.toggle('filled', index < human.mana));
  refreshVisibleHealth(match.units);
  ui.playerDeck.textContent = String(human.deck.length);
  ui.playerDeck.parentElement.title = '牌库为空后，每次抽牌使主将受到2点伤害。满手时新抽到的牌会被弃掉。';
  ui.enemyDeck.textContent = String(bot.deck.length);
  const enemyPanel = document.querySelector('.general-enemy');
  enemyPanel.querySelector('.general-name').textContent = match.boss?.owner === enemyId ? bot.name : `${enemyId === 2 ? '紫方' : '红方'} ${bot.name}`;
  setPortraitSource(enemyPanel.querySelector('.portrait-frame img'), heroPortrait(bot.generalId));
  const playerPanel = document.querySelector('.general-player');
  playerPanel.querySelector('.general-name').textContent = getCard(human.generalId).name;
  setPortraitSource(playerPanel.querySelector('.portrait-frame img'), heroPortrait(human.generalId));
  setPortraitSource(ui.objective.querySelector('.objective-heading img'), heroPortrait(human.generalId));
  ui.endTurn.textContent = isMulligan ? '确认起手' : '结束回合';
  ui.endTurn.hidden = isMulligan;
  ui.endTurn.disabled = battleFlow.busy || drawController.busy || !(isMulligan || isHumanTurn);
  const showEndTurnHint = isHumanTurn && !ui.match.hidden && !ui.objective.open
    && !cardFollowup && !moveGesture?.dragging && !hasAvailablePlayerAction(match);
  $('end-turn-hint').hidden = !showEndTurnHint;
  ui.endTurn.parentElement.classList.toggle('has-end-turn-hint', showEndTurnHint);
  if (botFailure && match.phase === 'ai') { ui.endTurn.disabled = false; ui.endTurn.textContent = '继续敌军行动'; }
  ui.objectiveOpen.disabled = battleFlow.busy || drawController.busy || movementPlayback || actionPlayback || isOver || match.phase === 'ai';
  ui.objectiveOpen.textContent = '本局目标';
  ui.bbs.hidden = isMulligan || isOver;
  const command = battleCommandTargets(match, 0);
  const hero = getHero(human.generalId);
  ui.bbs.disabled = battleFlow.busy || drawController.busy || movementPlayback || actionPlayback || ui.objective.open;
  ui.bbs.classList.toggle('is-unavailable', !isHumanTurn || !command.available);
  $('bbs-name').textContent = hero?.activeName ?? '战术指令';
  drawCommandIcon($('bbs-icon'), commandIcons[human.generalId] ?? 'f1_roar');
  ui.bbs.setAttribute('aria-label', `${hero?.activeName ?? '战术指令'}，${hero?.target === 'self' ? '点击使用，长按查看' : '点击查看，拖动使用，回车选择目标'}`);
  setPortraitSource($('focus-general').querySelector('img'), hero?.portrait ?? './assets/generals/general_portrait_image_f1.png');
  ui.bbs.setAttribute('aria-pressed', String(commandMode));
  ui.bbs.title = hero?.target === 'self' ? '点击使用 · 长按查看' : '点击查看 · 拖动使用';
  commandPreview?.sync();
  const handKey = human.hand.join('|');
  if (handPresentationMatch !== match || handPresentationKey !== handKey) {
    ui.hand.replaceChildren(...human.hand.map((id, index) => {
      const card = getBattleCard(match, id);
      return card ? cardButton(card, index) : document.createElement('span');
    }));
    handPresentationMatch = match;
    handPresentationKey = handKey;
  } else {
    human.hand.forEach((id, index) => { const card = getBattleCard(match, id); if (card) refreshHandCardState(ui.hand.children[index], card, index); });
  }
  drawController.applyHand();
  ui.hand.dataset.drawTiming = 'start';
  ui.hand.dataset.drawMode = 'true';
  ui.hand.dataset.mulliganMode = String(isMulligan);
  ui.hand.dataset.mulliganCount = String(match.mulligan.length);
  handLayout.refresh();
  battleFlow.sync(match, ui.objective.open);
  [...ui.match.children].forEach(node => { if (!node.classList.contains('opening-hand') && !node.classList.contains('turn-toast') && node !== ui.objective) node.inert = battleFlow.busy || drawController.busy || (isMulligan && !ui.objective.open); });
  battleTips.setContext(cardFollowup ? cardFollowup.type === 'unit' ? '选择一名高亮单位' : '选择高亮格子' : null);
  battleTips.setVisible(!ui.match.hidden && !ui.objective.open && !isMulligan && !isOver && !battleFlow.busy && !drawController.busy);
  refreshDrawControls();
  const focusedCard = ui.hand.children[focusedHandIndex];
  if (focusedCard && !focusedCard.disabled) focusedCard.focus({ preventScroll: true });
  ui.instruction.textContent = isMulligan
    ? ''
    : movementPlayback || actionPlayback ? '' : commandMode ? (command.type === 'cell' ? '选择召唤格' : '选择高亮目标')
      : inspectedHandIndex !== null ? cardTargetInstruction(getBattleCard(match, human.hand[inspectedHandIndex])) : '';
  const selectedUnit = match.units.find((unit) => unit.unitId === match.selectedUnitId);
  ui.selectedUnit.textContent = selectedUnit ? getCard(selectedUnit.cardId)?.name ?? '' : '';
  ui.battleLog.textContent = actionPlayback && isOver ? '正在完成最后一击…' : match.lastAction ? match.log.at(-1) ?? '' : '';
  if (expedition.error) ui.battleLog.textContent = expedition.error;
  if (botFailure) ui.battleLog.textContent = '敌军行动中断，可点击「继续敌军行动」恢复。';
  const resultWasVisible = !ui.result.hidden;
  ui.result.hidden = !isOver || actionPlayback;
  if (isOver) {
    ui.resultTitle.textContent = match.winner === 0 ? '胜利' : '战败';
    ui.nextLevel.textContent = '下一关';
    {
      const index = EXPEDITION_LEVELS.findIndex(item => item.id === match.levelId);
      const payout = lastSettlement?.runId === match.runId ? lastSettlement : null;
      const reason = ({'enemies-eliminated':'敌方主将已被击败。','survived':'已完成坚守。','survived-rounds':'已完成坚守。','general-defeated':'己方主将已倒下。','player-defeated':'己方主将已倒下。','turn-limit':'未能在回合限制内完成目标。'})[match.resultReason];
      ui.resultCopy.textContent = match.winner === 0 ? (reason || '已完成目标。') : `${reason || '本次战斗失利。'} ${level.hint}`;
      renderBattleRewardSummary(ui.resultReward, { match, payout, profile: expedition.state, error: expedition.error },
        (canvas, id) => renderer.drawCardArt(canvas, id));
      const factionId = getHero(match.players[0].generalId).faction;
      const progress = expedition.getFactionProgress(factionId);
      const factionName = getFaction(factionId).name;
      if (match.winner === 0 && progress.completed.length === EXPEDITION_LEVELS.length) ui.resultCopy.textContent = `${factionName}远征已全部完成。`;
      ui.resultCopy.hidden = match.winner === 0 && progress.completed.length !== EXPEDITION_LEVELS.length;
      ui.nextLevel.hidden = match.winner !== 0 || !EXPEDITION_LEVELS[index + 1] || Boolean(expedition.error);
      ui.backToLobby.textContent = progress.completed.length === EXPEDITION_LEVELS.length ? '选择其他阵营' : '返回主菜单';
    }
    ui.playAgain.textContent = match.winner === 0 ? '重玩本关' : '重新出征';
    refreshAdReward();
    if (!ui.result.hidden && !resultWasVisible) (ui.nextLevel.hidden ? ui.playAgain : ui.nextLevel).focus();
  }
  $('result-prep').hidden = !isOver || match.winner === 0;
  drawBoard();
  updateMapNavigation();
  drawVisibleOverview();
  $('faction-status').textContent = match.players.map((player) => `${['蓝','红','紫'][player.id]}方 ${findGeneral(match,player.id)?.health ?? 0} 生命`).join('　');
}

function cardHint(card) {
  const mana = match.players[0].mana;
  return mana < card.cost ? `法力不足 · 需要 ${card.cost}，当前 ${mana}` : `${card.name}：${cardTargetInstruction(card)}。`;
}

function closeInspect() {
  closeHeroEffectDialog({restoreFocus:false});
  stopInspectArt();
  inspectOpen = false;
  inspectHandSourceIndex = inspectHandCardId = null;
  inspectedUnitId = null;
  refreshUnitInspect();
}
function inspectHandCard(index) {
  if (!match || battleFlow.busy || drawController.busy || ui.match.hidden || !getBattleCard(match, match.players[0].hand[index])) return;
  clearHint();
  selectedCardIndex = null; inspectedHandIndex = index; cardFollowup = null; commandMode = false; commandPreview?.close();
  hoveredUnitId = null;
  inspectHandSourceIndex = index;
  inspectHandCardId = match.players[0].hand[index];
  inspectedUnitId = null;
  inspectOpen = true;
  refreshMatch();
}
function onHandCard(index) {
  closeInspect();
  cardFollowup = null;
  commandPreview?.close();
  if (!match) return;
  if (match.phase === 'mulligan') {
    toggleMulligan(match, index);
    persist();
    refreshMatch();
    return;
  }
  if (!activeTurn()) return;
  const card = getBattleCard(match, match.players[0].hand[index]);
  if (!card) return;
  cardPreviewPosition = null;
  if (inspectedHandIndex === index) {
    selectedCardIndex = inspectedHandIndex = null; cardFollowup = null;
    clearHint();
    refreshMatch();
    return;
  }
  commandMode = false;
  hoveredUnitId = inspectedUnitId = null;
  match.selectedUnitId = null;
  inspectedHandIndex = index;
  selectedCardIndex = null;
  clearHint();
  refreshMatch();
}

// Every release is checked against the visible battlefield, never a HUD overlay.
function handCancelBoundary() { const cards = [...ui.hand.children]; return cards.length ? Math.min(...cards.map(card => card.getBoundingClientRect().top)) : ui.hand.getBoundingClientRect().bottom - 80; }
function handDropPosition(event) {
  if (event.clientY >= handCancelBoundary()) return null;
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  if (!hit || !(hit === ui.board || hit.closest('.board-wrap')) || hit.closest('button, .general-panel, .unit-inspect, .hand-zone')) return null;
  return renderer.positionFromPointer(event, cardPointerOptions());
}
function handDropValid(event,index=selectedCardIndex) {
  if (!activeTurn()) return false;
  const position=handDropPosition(event); if (!position) return false;
  const card=getBattleCard(match,match.players[0].hand[index]); if (!card) return false;
  const target=occupiedUnit(match,position.x,position.y);
  if (cardFollowup?.type === 'cell') return cardFollowup.cells.some(c=>c.x===position.x&&c.y===position.y);
  if (cardFollowup) return Boolean(target && cardFollowup.unitIds.includes(target.unitId));
  if (card.type === 'unit') return summonPositions(match,0,card.id).some(c=>c.x===position.x&&c.y===position.y);
  if (isUntargetedSpell(card)) return true;
  if (['cell','occupiedCell','areaCell'].includes(card.target)) return spellPositions(match,card,0).some(c=>c.x===position.x&&c.y===position.y);
  return Boolean(target && spellTargets(match,card,0).some(u=>u.unitId===target.unitId));
}
function handUsesTargetLine() {
  if (cardFollowup) return true;
  const card = getBattleCard(match, match?.players[0].hand[selectedCardIndex]);
  return card?.type === 'unit' || (card?.type === 'spell' && !isUntargetedSpell(card));
}
const handDrag = createHandDrag(ui.hand, {
  token: () => `${matchEpoch}:${match?.phase}:${match?.currentPlayer}:${match?.players[0].hand.join(',')}:${match?.players[0].mana}:${ui.match.hidden}:${ui.objective.open}:${Boolean(actionPlayback || movementPlayback)}`,
  boundary: handCancelBoundary,
  tap(index) { if (match?.phase === 'mulligan') onHandCard(index); else inspectHandCard(index); },
  inspect: inspectHandCard,
  ready:handDropValid,
  targeted:handUsesTargetLine,
  begin(index) {
    closeInspect();
    if (!activeTurn()) return false;
    const card = getBattleCard(match, match.players[0].hand[index]);
    if (!card || match.players[0].mana < card.cost || !canUseHandCard(match,index)) return false;
    if (selectedCardIndex !== index || !cardFollowup) cardFollowup = null;
    selectedCardIndex = inspectedHandIndex = index;
    commandPreview?.close(); commandMode = false; inspectedUnitId = hoveredUnitId = null; match.selectedUnitId = null;
    ui.hand.dataset.dragging = 'true';
    clearHint();
    drawBoard(); return true;
  },
  preview(event,cancelled) { handDragPointer = handUsesTargetLine() ? { x:event.clientX, y:event.clientY, cancelled } : null; cardPreviewPosition = cancelled ? null : handDropPosition(event); drawBoard(); },
  cancel() { delete ui.hand.dataset.dragging; handDragPointer = null; selectedCardIndex = inspectedHandIndex = null; cardFollowup = null; cardPreviewPosition = null; refreshMatch(); },
  drop(event,index) {
    delete ui.hand.dataset.dragging; handDragPointer = null;
    if (!activeTurn() || !handDropPosition(event)) { this.cancel(); return; }
    const card = getBattleCard(match,match.players[0].hand[index]);
    const valid=handDropValid(event,index);
    if (!valid) { this.cancel(); return; }
    if (isUntargetedSpell(card)) void executeCombatAction(() => castSpell(match,index));
    else onBoardInput(event);
    cardPreviewPosition = null;
    // Invalid primary drops cancel without spending; a valid staged drop retains its prompt.
    if (!cardFollowup && match.players[0].hand[index] === card?.id && !actionPlayback) this.cancel();
    else refreshMatch();
  }
});

function onBoardInput(event) {
  if (!match || !activeTurn()) return;
  if (selectedCardIndex === null) inspectedHandIndex = null;
  const selectedCard = selectedCardIndex === null ? null : getBattleCard(match, match.players[0].hand[selectedCardIndex]);
  const deploying = cardFollowup ? cardFollowup.type === 'cell' : selectedCard?.type === 'unit' || ['cell', 'occupiedCell', 'areaCell'].includes(selectedCard?.target) || commandMode && battleCommandTargets(match, 0).type === 'cell';
  const position = renderer.positionFromPointer(event, cardPointerOptions(!deploying));
  if (!position) {
    closeInspect();
    if (selectedCardIndex === null && !commandMode) { match.selectedUnitId = null; hoveredUnitId = null; clearHint(); }
    drawBoard(); return;
  }
  const target = occupiedUnit(match, position.x, position.y);

  if (selectedCardIndex !== null) {
    const card = getBattleCard(match, match.players[0].hand[selectedCardIndex]);
    if (!card) { selectedCardIndex = inspectedHandIndex = null; cardFollowup = null; refreshMatch(); return; }
    if (cardFollowup) {
      const pending = cardFollowup;
      const valid = pending.type === 'cell' ? pending.cells.some(cell => cell.x === position.x && cell.y === position.y) : target && pending.unitIds.includes(target.unitId);
      if (!valid) { showHint(cardTargetInstruction(card)); return; }
      const index = selectedCardIndex;
      if (pending.deployment) {
        if (pending.type === 'unit') {
          const next = battleRules.getOpeningFollowup(match, card.id, pending.deployment, 0, target.unitId);
          if (next?.type === 'cell' && next.cells?.length) {
            cardFollowup = { ...next, deployment: pending.deployment, primaryId: target.unitId };
            clearHint(); refreshMatch(); return;
          }
        }
        const openingTarget = pending.type === 'unit' ? {unitId:target.unitId}
          : pending.primaryId != null ? {unitId:pending.primaryId,cell:position} : position;
        void executeCombatAction(() => playCard(match, index, pending.deployment.x, pending.deployment.y, 0, openingTarget), '目标已变化，请重新选择。');
      }
      else void executeCombatAction(() => castSpell(match, index, pending.type === 'cell' ? { unitId: pending.primaryId, cell: position } : { unitIds: [pending.primaryId, target.unitId] }, 0), '目标已变化，请重新选择。');
      return;
    }
    if (card.type === 'unit') {
      if (battleRules.getOpeningFollowup) {
        if (!summonPositions(match, 0, card.id).some(cell => cell.x === position.x && cell.y === position.y)) { showHint(cardTargetInstruction(card)); return; }
        const next = battleRules.getOpeningFollowup(match, card.id, position, 0);
        if (next?.cells?.length || next?.unitIds?.length) { cardFollowup = { ...next, deployment: position }; clearHint(); refreshMatch(); return; }
      }
      void executeCombatAction(() => playCard(match, selectedCardIndex, position.x, position.y), `${cardTargetInstruction(card)}。`);
      return;
    }
    if (['cell', 'occupiedCell', 'areaCell'].includes(card.target)) {
      void executeCombatAction(() => castSpell(match, selectedCardIndex, position, 0), '请选择高亮格子。');
      return;
    }
    const valid = target && spellTargets(match, card, 0).some((unit) => unit.unitId === target.unitId);
    if (valid && battleRules.getSpellFollowup) {
      const next = battleRules.getSpellFollowup(match, card, target.unitId, 0);
      if (next) { cardFollowup = { ...next, primaryId: target.unitId }; clearHint(); refreshMatch(); return; }
    }
    if (valid) void executeCombatAction(() => castSpell(match, selectedCardIndex, target.unitId), '请选择该法术高亮的目标。');
    else showHint(cardHint(card));
    return;
  }

  if (commandMode) {
    const command = battleCommandTargets(match, 0);
    const destination = command.type === 'cell' ? position : target?.unitId;
    const valid=command.type==='cell'?command.cells.some(p=>p.x===position.x&&p.y===position.y):command.unitIds.includes(target?.unitId);
    if(valid)void executeCombatAction(() => useBattleCommand(match, destination, 0));
    else {commandMode=false;cardPreviewPosition=null;handDragPointer=null;clearHint();refreshMatch();}
    return;
  }

  const selected = match.units.find((unit) => unit.unitId === match.selectedUnitId && unit.owner === 0);
  if (target && target.owner !== 0) {
    if (selected) {
      const valid = attackPositions(match, selected).some(unit => unit.unitId === target.unitId);
      match.selectedUnitId = null;
      hoveredUnitId = null;
      closeInspect(); clearHint();
      if (valid) void executeCombatAction(() => attackUnit(match, selected.unitId, target.unitId, 0));
      else refreshMatch();
      return;
    }
    hoveredUnitId = null;
    inspectHandSourceIndex = inspectHandCardId = null; inspectedUnitId = target.unitId; inspectOpen = true;
    clearHint();
    drawBoard();
    return;
  }
  inspectedUnitId = null;
  refreshUnitInspect();
  if (target?.owner === 0) {
    match.selectedUnitId = target.unitId;
    clearHint();
    refreshMatch();
    return;
  }
  match.selectedUnitId = null;
  hoveredUnitId = null;
  clearHint();
  refreshMatch();
}

function onBoardPointerDown(event) {
  if (!event.isPrimary || event.button !== 0 || boardPointerId !== null || !activeTurn()) return;
  boardPointerId = event.pointerId;
  ui.board.setPointerCapture(event.pointerId);
  if (selectedCardIndex !== null || commandMode) {
    updateCardPreview(event);
    return;
  }
  const position = renderer.positionFromPointer(event);
  const target = position && occupiedUnit(match, position.x, position.y);
  keyboardInspectUnitId = target?.unitId ?? null;
  if (!target) {
    inspectedUnitId = null;
    refreshUnitInspect();
    cameraGesture = { x:event.clientX, y:event.clientY, moved:false };
    return;
  }
  if (target && target.owner !== 0) return;
  const unit = target?.owner === 0 ? target : match.units.find((entry) => entry.unitId === match.selectedUnitId && entry.owner === 0);
  if (!unit) return;
  match.selectedUnitId = unit.unitId;
  clearHint();
  moveGesture = {
    pointerId: event.pointerId, unitId: unit.unitId, startX: event.clientX, startY: event.clientY,
    epoch: matchEpoch, dragging: false, cancelled: false, path: []
  };
  refreshMatch();
}

function updateCardPreview(event) {
  const card = getBattleCard(match, match?.players[0].hand[selectedCardIndex]);
  if (!card && !commandMode) return;
  // Press/drag uses the same target position as hover; preview never spends cards or mana.
  const position = event.clientY < ui.battleRow.getBoundingClientRect().bottom
    ? renderer.positionFromPointer(event, cardPointerOptions()) : null;
  const changed = position?.x !== cardPreviewPosition?.x || position?.y !== cardPreviewPosition?.y;
  cardPreviewPosition = position;
  const hadInspect = hoveredUnitId !== null || inspectedUnitId !== null;
  hoveredUnitId = inspectedUnitId = null;
  if (changed || hadInspect) drawBoard();
}

function cardPointerOptions(preferUnits = true) {
  if (cardFollowup) return { preferUnits:cardFollowup.type === 'unit', unitIds:cardFollowup.unitIds || [] };
  if (commandMode) {
    const targets = battleCommandTargets(match, 0);
    return { preferUnits: targets.type !== 'cell', unitIds: targets.unitIds };
  }
  const card = selectedCardIndex === null ? null : getBattleCard(match, match?.players[0].hand[selectedCardIndex]);
  if (card?.type === 'spell') return { preferUnits: !['cell', 'occupiedCell', 'areaCell'].includes(card.target), unitIds: spellTargets(match, card, 0).map(unit => unit.unitId) };
  return { preferUnits: card?.type === 'unit' ? false : preferUnits };
}

function updateMoveGesture(event) {
  if (!moveGesture || event.pointerId !== moveGesture.pointerId) return;
  if (moveGesture.epoch !== matchEpoch || match?.phase !== 'playing' || match.currentPlayer !== 0 || ui.match.hidden || ui.objective.open || movementPlayback || actionPlayback) { cancelMoveGesture(); return; }
  if (!moveGesture.dragging && Math.hypot(event.clientX - moveGesture.startX, event.clientY - moveGesture.startY) <= 9) return;
  moveGesture.dragging = true;
  $('draw-hand-controls').hidden = true;
  moveGesture.clientX = event.clientX;
  moveGesture.clientY = event.clientY;
  ui.endTurn.disabled = ui.bbs.disabled = true;
  hoveredUnitId = null;
  inspectedUnitId = null;
  const unit = match?.units.find((entry) => entry.unitId === moveGesture.unitId);
  // Pointer capture delivers coordinates over HUDs too; those never accept a drop.
  const inCancelRail = event.clientY >= handCancelBoundary();
  const overBoard = document.elementFromPoint(event.clientX, event.clientY) === ui.board;
  const position = renderer.positionFromPointer(event, { preferUnits: false });
  const atOrigin = position && unit && position.x === unit.x && position.y === unit.y;
  moveGesture.cancelled = inCancelRail || !overBoard || atOrigin || !unit;
  const tileOccupant = position && occupiedUnit(match, position.x, position.y);
  // Dragging owns movement only; enemy attacks require a separate tap.
  moveGesture.path = !moveGesture.cancelled && !tileOccupant && position && unit
    ? movementPath(match, unit, position.x, position.y) : [];
  ui.moveCancelZone.hidden = false;
  ui.moveCancelZone.style.top = `${handCancelBoundary() - ui.match.getBoundingClientRect().top}px`;
  ui.moveCancelZone.classList.toggle('active', inCancelRail);
  ui.moveCancelZone.textContent = inCancelRail ? '松手取消' : '';
  drawBoard();
  startMoveEdgePan();
}

// A captured finger can hold at the edge to reveal a distant landing cell.
// Keep this separate from the lower HUD cancel area and stop on every exit path.
function startMoveEdgePan() {
  if (movePanFrame !== null || !match) return;
  let previous = performance.now();
  const tick = (now) => {
    if (!moveGesture?.dragging || ui.match.hidden) { stopMoveEdgePan(); return; }
    const { clientX:x, clientY:y, pointerId, cancelled } = moveGesture;
    const rect = ui.board.getBoundingClientRect();
    const edge = 32;
    const edgeSpeed = (point, low, high) => point < low + edge ? Math.min(1, (low + edge - point) / edge)
      : point > high - edge ? -Math.min(1, (point - high + edge) / edge) : 0;
    const elapsed = Math.min(40, now - previous) / 1000; previous = now;
    if (!cancelled && x >= rect.left && x <= rect.right && y >= rect.top && y < rect.bottom) {
      const dx = edgeSpeed(x, rect.left, rect.right) * 280 * elapsed;
      const dy = edgeSpeed(y, rect.top, rect.bottom) * 280 * elapsed;
      if (dx || dy) {
        renderer.pan(dx, dy);
        updateMoveGesture({ pointerId, clientX:x, clientY:y });
        drawVisibleOverview();
      }
    }
    movePanFrame = requestAnimationFrame(tick);
  };
  movePanFrame = requestAnimationFrame(tick);
}

function stopMoveEdgePan() {
  if (movePanFrame !== null) cancelAnimationFrame(movePanFrame);
  movePanFrame = null;
}

function releaseBoardPointer(pointerId) {
  if (pointerId !== null && ui.board.hasPointerCapture(pointerId)) ui.board.releasePointerCapture(pointerId);
}

function onBoardPointerUp(event) {
  if (event.pointerId !== boardPointerId) return;
  if (cameraGesture) {
    const dragged = cameraGesture.moved;
    cameraGesture = null; boardPointerId = null; releaseBoardPointer(event.pointerId);
    if (!dragged) onBoardInput(event);
    return;
  }
  if (moveGesture) updateMoveGesture(event);
  const gesture = moveGesture;
  // updateMoveGesture may cancel because this gesture belongs to an old scene.
  if (boardPointerId !== event.pointerId) return;
  stopMoveEdgePan();
  moveGesture = null;
  boardPointerId = null;
  if (cardPreviewPosition) { cardPreviewPosition = null; drawBoard(); }
  ui.moveCancelZone.hidden = true;
  releaseBoardPointer(event.pointerId);
  if (!gesture?.dragging) {
    onBoardInput(event);
    return;
  }
  const unit = match?.units.find((entry) => entry.unitId === gesture.unitId);
  if (gesture.cancelled) clearHint();
  else if (gesture.path.length && unit) {
    void executeMovement(unit, gesture.path.at(-1));
    return;
  } else clearHint();
  match.selectedUnitId = null;
  refreshMatch();
}

function cancelMoveGesture() {
  stopMoveEdgePan();
  const pointerId = boardPointerId;
  moveGesture = null;
  cameraGesture = null;
  boardPointerId = null;
  cardPreviewPosition = null;
  ui.moveCancelZone.hidden = true;
  releaseBoardPointer(pointerId);
  if (match && !ui.match.hidden) refreshMatch();
}

function resetMovementInteraction() {
  closeInspect();
  handDrag.cancel();
  cancelMoveGesture();
  renderer.finishMovement();
  renderer.finishAction();
  movementPlayback = false;
  actionPlayback = false;
}

async function executeMovement(unit, destination) {
  if (!activeTurn()) return;
  closeInspect();
  const path = movementPath(match, unit, destination.x, destination.y);
  if (!path.length || !moveUnit(match, unit.unitId, destination.x, destination.y, 0)) return;
  const targetMatch = match, epoch = matchEpoch;
  movementPlayback = true;
  hoveredUnitId = inspectedUnitId = null;
  clearHint();
  // Save only the committed grid destination. Animation never writes intermediate positions into the snapshot.
  persist();
  const completed = renderer.animateMovement(unit.unitId, path);
  refreshMatch();
  await completed;
  if (match !== targetMatch || matchEpoch !== epoch || ui.match.hidden) return;
  movementPlayback = false;
  afterAction();
  await drawController.playPending();
}

async function executeCombatAction(operation, invalidMessage = '') {
  if (!activeTurn()) return;
  closeInspect();
  // Keep only a render snapshot outside the save model, so removed targets can finish hit/death frames.
  const beforeUnits = match.units.map((unit) => ({ ...unit }));
  if (!operation()) {
    if (invalidMessage) showHint(invalidMessage);
    return;
  }
  const targetMatch = match, epoch = matchEpoch;
  actionPlayback = true;
  selectedCardIndex = null; cardFollowup = null;
  inspectedHandIndex = null;
  commandMode = false;
  cardPreviewPosition = null;
  hoveredUnitId = inspectedUnitId = null;
  clearHint();
  // Commit the legal result before playback; reload resumes this result without replaying costs or damage.
  drawController.capture();
  persist();
  try {
    const completed = renderer.animateAction(match.lastAction, beforeUnits);
    refreshMatch();
    await completed;
  } finally {
    if (match === targetMatch && matchEpoch === epoch && !ui.match.hidden) {
      actionPlayback = false;
      afterAction();
      await drawController.playPending();
    }
  }
}

function onBoardPointerMove(event) {
  if (cameraGesture && event.pointerId === boardPointerId) {
    const dx=event.clientX-cameraGesture.x, dy=event.clientY-cameraGesture.y;
    if (cameraGesture.moved || Math.hypot(dx,dy)>5) {
      cameraGesture.moved=true; renderer.pan(dx,dy);
      cameraGesture.x=event.clientX; cameraGesture.y=event.clientY;
      drawVisibleOverview();
    }
    return;
  }
  if (moveGesture) { updateMoveGesture(event); return; }
  if (movementPlayback || actionPlayback) return;
  if (match && activeTurn() && (selectedCardIndex !== null || commandMode)) {
    updateCardPreview(event);
    return;
  }
  if (!match || event.pointerType === 'touch' || !['playing', 'ai'].includes(match.phase)) return;
  const position = renderer.positionFromPointer(event);
  const unit = position ? occupiedUnit(match, position.x, position.y) : null;
  const nextHoverId = unit?.unitId ?? null;
  if (nextHoverId === hoveredUnitId) return;
  hoveredUnitId = nextHoverId;
  drawBoard();
}

function onBoardPointerLeave() {
  if (boardPointerId !== null || moveGesture || movementPlayback || actionPlayback) return;
  if (hoveredUnitId === null && cardPreviewPosition === null) return;
  hoveredUnitId = null;
  cardPreviewPosition = null;
  drawBoard();
}

function afterAction() {
  drawController.capture();
  clearHint();
  commandMode = false;
  persist();
  refreshMatch();
}

function clearHint() {
  clearTimeout(hintTimer);
  hintTimer = null;
  ui.hint.classList.remove('visible');
  ui.hint.textContent = '';
}

function runBotIfNeeded() {
  if (!match || match.phase !== 'ai' || botRunning || ui.objective.open) return;
  const targetMatch = match;
  const epoch = matchEpoch;
  const runToken = ++botRunToken;
  botRunning = true;
  botFailure = '';
  const cancelled = () => runToken !== botRunToken || match !== targetMatch || matchEpoch !== epoch || ui.match.hidden;
  void (async () => {
    await announceTurn();
    if (cancelled()) return;
    await drawController.playPending();
    if (cancelled()) return;
    await startBotTurn(targetMatch, async (beforeUnits, action) => {
    if (cancelled()) return;
    drawController.capture();
    persist(targetMatch);
    const actor = action && targetMatch.units.find(unit=>unit.unitId === (action.unitId ?? action.sourceId ?? action.attackerId));
    if (actor) renderer.focusCell(actor.x,actor.y);
    if (action?.kind === 'move' && action.path?.length > 1) {
      movementPlayback = true;
      const animation = renderer.animateMovement(action.unitId, action.path);
      refreshMatch(); await animation;
      movementPlayback = false;
    } else if (action && ['attack','summon','spell','bbs','end-turn'].includes(action.kind)) {
      actionPlayback = true;
      const animation = renderer.animateAction(action, beforeUnits ?? []);
      refreshMatch(); await animation;
      actionPlayback = false;
    }
    if (cancelled()) return;
    refreshMatch();
    if (action?.kind === 'end-turn') {
      await drawController.playPending({stage:'turnEnd'});
      if (cancelled()) return;
      await announceTurn();
      if (cancelled()) return;
    }
    if (cancelled()) return;
    await drawController.playPending();
  }, { isCancelled: cancelled });
  })().catch(error => {
    if (!cancelled()) botFailure = error.message || '行动中断';
  }).finally(() => {
    if (runToken !== botRunToken) return;
    botRunning = false;
    if (!cancelled() && match.phase === 'ai') {
      botFailure ||= '行动暂停';
      renderer.finishMovement(); renderer.finishAction(); movementPlayback = actionPlayback = false;
      refreshMatch();
    }
    if (!ui.match.hidden && match?.phase === 'ai' && (match !== targetMatch || matchEpoch !== epoch)) runBotIfNeeded();
  });
}

async function advanceTurn() {
  commandPreview?.close();
  if (!match || battleFlow.busy || drawController.busy || ui.objective.open) return;
  if (botFailure && match.phase === 'ai') { runBotIfNeeded(); return; }
  if (match.phase === 'mulligan') {
    const openingMatch=match,openingEpoch=matchEpoch;
    const stale=()=>match!==openingMatch||matchEpoch!==openingEpoch||ui.match.hidden;
    confirmMulligan(match);
    afterAction();
    await drawController.playPending({stage:'action'});
    if(stale())return;
    await announceTurn();
    if(stale())return;
    await drawController.playPending();
    if(stale())return;
    runBotIfNeeded();
    return;
  }
  if (!activeTurn()) return;
  const beforeUnits = match.units.map(unit => ({...unit}));
  const targetMatch = match, epoch = matchEpoch;
  endTurn(match, 0);
  drawController.capture();
  selectedCardIndex = null; cardFollowup = null;
  inspectedHandIndex = null;
  inspectedUnitId = null;
  commandMode = false;
  cardPreviewPosition = null;
  actionPlayback = true;
  persist();
  try {
    const complete = renderer.animateAction(match.lastAction, beforeUnits);
    refreshMatch();
    await complete;
  } finally {
    if (match === targetMatch && matchEpoch === epoch) actionPlayback = false;
  }
  if (match !== targetMatch || matchEpoch !== epoch || ui.match.hidden) return;
  afterAction();
  await drawController.playPending({stage:'turnEnd'});
  if(match!==targetMatch||matchEpoch!==epoch||ui.match.hidden)return;
  await announceTurn();
  if(match!==targetMatch||matchEpoch!==epoch||ui.match.hidden)return;
  await drawController.playPending();
  if(match!==targetMatch||matchEpoch!==epoch||ui.match.hidden)return;
  runBotIfNeeded();
}

function battleCommandPreviewModel() {
  if (!match) return null;
  const player = match.players[0], hero = getHero(player.generalId);
  const cost = battleRules.battleCommandCost?.(match, 0) ?? hero?.cost ?? 1;
  const command = battleCommandTargets(match, 0);
  const available = activeTurn() && command.available;
  let reason = '';
  if (movementPlayback || actionPlayback) reason = '正在结算行动';
  else if (match.currentPlayer !== 0 || match.phase !== 'playing') reason = '等待你的回合';
  else if (player.bbsUsed) reason = '本回合已使用，下回合可用';
  else if (player.mana < cost) reason = `法力不足 · 需要 ${cost}，当前 ${player.mana}`;
  else if (!command.available) reason = '当前没有符合条件的目标或空格';
  let description = cardRuleSections(getCard(player.generalId))[0].text;
  description = description.replace(/每个己方回合限用一次。$/, '每回合1次。');
  return {
    interactionKey: `${matchEpoch}:${match.round}:${match.phase}:${match.currentPlayer}`, selected: commandMode,
    battleKey: match, visible: !ui.match.hidden && !ui.objective.open && !ui.bbs.hidden,
    name: hero?.activeName ?? '战术指令', cost, faction: getCard(player.generalId)?.faction ?? 1,
    description,
    available, reason, targetType: command.type
  };
}

function prepareBattleCommandPreview() {
  closeInspect();
  selectedCardIndex = null; cardFollowup = null;
  inspectedHandIndex = null;
  inspectedUnitId = null;
  commandMode = false;
  cardPreviewPosition = null;
  match.selectedUnitId = null;
  clearHint();
  refreshMatch();
}

function confirmBattleCommand() {
  if (!activeTurn()) return;
  const command = battleCommandTargets(match, 0);
  if (!command.available) return;
  commandMode = true;
  if (command.type === 'self') {
    void executeCombatAction(() => useBattleCommand(match, null, 0));
    return;
  }
  refreshMatch();
  showHint(command.type === 'cell' ? '选择高亮空格' : '选择高亮目标');
}

function heroPortrait(id) {
  const hero = getHero(id);
  return hero?.portrait ?? `./assets/generals/general_portrait_image_f${getCard(id)?.faction ?? 1}${[23,123,223,323,418,527].includes(id) ? 'alt' : ''}.png`;
}

function isUntargetedSpell(card) { return card?.type === 'spell' && (card.effect === 'tempest' || card.id === 20122 || ['self', 'enemyArea', 'none', 'allMinions'].includes(card.target)); }

ui.objectiveOpen.addEventListener('click', showObjective);
document.addEventListener('open-battle-rules', showBattleRulesFromHome);
$('objective-rules').addEventListener('click', () => setObjectiveView(!objectiveRulesView));
$('inspect-close').addEventListener('click', () => {
  closeInspect();
  refreshMatch();
  ui.board.focus({ preventScroll: true });
});
ui.objectiveClose.addEventListener('click', closeObjective);
ui.objective.addEventListener('cancel', (event) => { event.preventDefault(); closeObjective(); });
ui.inspectCast.addEventListener('click', () => {
  if (inspectedHandIndex !== null && isUntargetedSpell(getBattleCard(match, match?.players[0].hand[inspectedHandIndex]))) {
    void executeCombatAction(() => castSpell(match, inspectedHandIndex));
  }
});
$('inspect-followup-skip').addEventListener('click', () => {
  if (!cardFollowup?.deployment || !cardFollowup.optional || selectedCardIndex === null) return;
  const index = selectedCardIndex, cell = cardFollowup.deployment;
  void executeCombatAction(() => playCard(match, index, cell.x, cell.y, 0, null), '当前无法部署。');
});
let leaveConfirmationPending = false;
ui.leave.addEventListener('click', () => audioSettings.open(ui.leave, { battle:true }));
$('settings-leave-battle').addEventListener('click', async () => {
  if (leaveConfirmationPending || confirmResolver || !match || ui.match.hidden) return;
  audioSettings.close();
  leaveConfirmationPending = true;
  const battle = match, epoch = matchEpoch;
  const destination = '主菜单';
  try {
    const accepted = await askConfirmation(`当前战斗会保留，之后可继续。是否返回${destination}？`, '确认返回', { title: `返回${destination}？`, cancelFirst: true, intent: 'leave' });
    if (accepted && match === battle && matchEpoch === epoch && !ui.match.hidden) returnToLobby({ requireSave: true });
  } finally { leaveConfirmationPending = false; }
});
ui.endTurn.addEventListener('click', advanceTurn);
ui.replaceCard.addEventListener('click', () => {
  if (!match || inspectedHandIndex === null || !canReplaceHandCard(match, inspectedHandIndex, 0)) return;
  const index = inspectedHandIndex;
  if (!replaceHandCard(match, index, 0)) { showHint('当前无法换牌。'); refreshMatch(); return; }
  selectedCardIndex = inspectedHandIndex = null; cardFollowup = null; inspectedUnitId = null;
  afterAction(); void drawController.playPending(); ui.hand.children[index]?.focus({ preventScroll: true });
});
commandPreview = createBattleCommandPreview({
  button: ui.bbs, read: battleCommandPreviewModel,
  onOpen: prepareBattleCommandPreview, onConfirm: confirmBattleCommand,
  onCancel() { commandMode=false;handDragPointer=null;cardPreviewPosition=null;clearHint();refreshMatch(); },
  onAim(event) {
    if (!commandMode || !activeTurn()) return;
    cardPreviewPosition = handDropPosition(event);
    handDragPointer = {x:event.clientX,y:event.clientY,cancelled:!cardPreviewPosition};
    drawBoard();
  },
  onDrop(event) {
    const position=handDropPosition(event), targets=battleCommandTargets(match,0);
    const unit=position&&occupiedUnit(match,position.x,position.y);
    const valid=position&&(targets.type==='cell'?targets.cells.some(p=>p.x===position.x&&p.y===position.y):targets.unitIds.includes(unit?.unitId));
    handDragPointer=null;cardPreviewPosition=null;
    if(valid)onBoardInput(event);
    else {commandMode=false;clearHint();refreshMatch();}
  }
});
// Resume the audio context inside the trusted activation stack, before a later action starts playback.
function unlockBattleAudio(event) {
  if (event.isTrusted) { renderer.effects.unlockAudio(); menuMusic.unlock(event,!event.target.closest?.('[data-action="music-toggle"],#settings-music-toggle')); }
}
document.addEventListener('pointerdown', unlockBattleAudio, { capture: true, passive: true });
document.addEventListener('keydown', unlockBattleAudio, { capture: true });
const boardInspect = createPressInspect(ui.board, {
  token: () => `${matchEpoch}:${match?.phase}:${match?.currentPlayer}:${ui.match.hidden}:${battleFlow.busy}`,
  resolve(event) {
    if (!match || battleFlow.busy || drawController.busy || ui.match.hidden || ui.objective.open || !['playing','ai'].includes(match.phase)) return null;
    const position = renderer.positionFromPointer(event, { preferUnits:true });
    const unit = position && occupiedUnit(match, position.x, position.y);
    if (selectedCardIndex !== null || commandMode || moveGesture?.dragging || ui.hand.dataset.dragging === 'true') return null;
    return unit ? {unitId:unit.unitId, owner:unit.owner, selectedUnitId:match.selectedUnitId} : null;
  },
  tap(reading) {
    if (reading.owner === 0 || match?.units.some(unit => unit.owner === 0 && unit.unitId === match.selectedUnitId)) return false;
    this.show(reading); drawBoard(); return true;
  },
  show(reading) {
    if (!match || battleFlow.busy || drawController.busy || ui.match.hidden) return;
    clearHint();
    cancelMoveGesture();
    match.selectedUnitId = reading.selectedUnitId;
    inspectHandSourceIndex = inspectHandCardId = null; inspectedUnitId = reading.unitId; inspectOpen = true;
    refreshUnitInspect();
  },
  moved() { closeInspect(); }
});
// Closing a reading panel must leave the new gesture available to the board or rail.
document.addEventListener('pointerdown', event => {
  if (isHeroEffectDialogOpen()) return;
  if (!inspectOpen || ui.unitInspect.contains(event.target)) return;
  closeInspect(); drawBoard();
}, true);
ui.board.addEventListener('pointerdown', onBoardPointerDown);
ui.board.addEventListener('pointerup', onBoardPointerUp);
ui.board.addEventListener('pointermove', onBoardPointerMove);
ui.board.addEventListener('pointerleave', onBoardPointerLeave);
ui.board.addEventListener('pointercancel', (event) => { if (event.pointerId === boardPointerId) cancelMoveGesture(); });
ui.board.addEventListener('lostpointercapture', (event) => { if (event.pointerId === boardPointerId) cancelMoveGesture(); });
document.addEventListener('pointerdown', (event) => { if (!event.isPrimary && boardPointerId !== null) cancelMoveGesture(); }, true);
ui.match.addEventListener('keydown', (event) => {
  if (battleFlow.busy || drawController.busy) { event.preventDefault(); return; }
  if (event.key === 'Escape' && inspectOpen) { event.preventDefault(); closeInspect(); return; }
  if (event.target === ui.board && ['Enter',' '].includes(event.key)) {
    event.preventDefault();
    const unit = match?.units.find(unit => unit.unitId === (keyboardInspectUnitId ?? match.selectedUnitId));
    if (unit) { inspectHandSourceIndex = inspectHandCardId = null; inspectedUnitId = unit.unitId; inspectOpen = true; refreshUnitInspect(); }
    return;
  }
  if (event.key === 'Escape' && !$('map-panel').hidden) { event.preventDefault(); closeMapOverview(); return; }
  if (event.key !== 'Escape' || ui.objective.open) return;
  if (moveGesture) { event.preventDefault(); cancelMoveGesture(); }
  else if (selectedCardIndex !== null || inspectedHandIndex !== null || inspectedUnitId !== null || match?.selectedUnitId != null || commandMode) {
    event.preventDefault();
    cancelMoveGesture();
    selectedCardIndex = null; cardFollowup = null;
    inspectedHandIndex = null;
    inspectedUnitId = null;
    commandMode = false;
    if (match) match.selectedUnitId = null;
    hoveredUnitId = null;
    clearHint();
    refreshMatch();
  }
});
// A touch released on the board can finish combat before its compatibility
// click is hit-tested. Newly revealed result controls must own the press too.
let resultPress = null;
document.addEventListener('pointerdown', event => {
  const button = event.target.closest?.('button');
  resultPress = !ui.result.hidden && button && ui.result.contains(button)
    ? { button, pointerId:event.pointerId } : null;
}, { capture:true, passive:true });
document.addEventListener('pointercancel', event => {
  if (resultPress?.pointerId === event.pointerId) resultPress = null;
}, { capture:true, passive:true });
ui.result.addEventListener('click', event => {
  const button = event.target.closest?.('button');
  if (!button) return;
  // Keyboard and accessibility activation have no pointer press (detail 0).
  if (event.detail !== 0 && (resultPress?.button !== button
      || (event.pointerId !== undefined && event.pointerId !== resultPress.pointerId))) {
    event.preventDefault(); event.stopImmediatePropagation();
  }
  resultPress = null;
}, { capture:true });
ui.backToLobby.addEventListener('click', returnToLobby);
$('result-prep').addEventListener('click', () => { const levelId = match.levelId; returnToLobby(); expeditionUI.returnMission = levelId; expeditionUI.navigate('prep'); });
ui.resultAd.addEventListener('click', () => void claimBattleAdReward());
ui.result.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { event.preventDefault(); returnToLobby(); }
  if (event.key === 'Tab') {
    const controls = [...ui.result.querySelectorAll('button:not(:disabled), summary, [tabindex="0"]')]
      .filter(control => !control.hidden && control.getClientRects().length > 0);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
ui.playAgain.addEventListener('click', () => { if (match) void startExpedition(match.levelId); });
ui.nextLevel.addEventListener('click', () => {
  if (!match) return;
  const index = EXPEDITION_LEVELS.findIndex(level=>level.id===match.levelId);
  if(EXPEDITION_LEVELS[index+1]) { const id = EXPEDITION_LEVELS[index+1].id; returnToLobby(); expeditionUI.returnMission = id; expeditionUI.levelId = id; expeditionUI.navigate('prep'); }
});
ui.confirmCancel.addEventListener('click', () => settleConfirmation(false));
ui.confirmAccept.addEventListener('click', () => settleConfirmation(true));
ui.confirmScreen.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { event.preventDefault(); settleConfirmation(false); }
  if (event.key === 'Tab') {
    const controls = [ui.confirmCancel, ui.confirmAccept];
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
window.addEventListener('resize', () => { cancelMoveGesture(); closeMapOverview(false); if (match) refreshMatch(); });
function closeMapOverview(restoreFocus = true) {
  const wasOpen = !$('map-panel').hidden;
  $('map-panel').hidden = true;
  $('map-open').setAttribute('aria-expanded', 'false');
  if (wasOpen && restoreFocus && !$('map-controls').hidden && !ui.match.hidden) $('map-open').focus({preventScroll:true});
}
function updateMapNavigation() {
  const board = match?.board;
  const key = board ? `${match.runId ?? match.levelId}:${board.columns}:${board.rows}` : '';
  const available = Boolean(board) && (board.columns > 9 || board.rows > 5);
  if (key !== overviewBoardKey || !available) closeMapOverview(false);
  overviewBoardKey = key;
  $('map-controls').hidden = !available;
  ui.match.classList.toggle('has-map-navigation', available);
}
function drawVisibleOverview() {
  // Opening the panel renders it immediately; hidden maps need no canvas or layout work.
  if (!ui.match.hidden && !$('map-panel').hidden) renderer.drawOverview($('map-overview'));
}
$('map-open').addEventListener('click', () => {
  if (!$('map-panel').hidden) { closeMapOverview(); return; }
  $('map-panel').hidden = false;
  $('map-open').setAttribute('aria-expanded', 'true');
  drawVisibleOverview();
  $('map-overview').focus({preventScroll:true});
});
$('map-close').addEventListener('click', () => closeMapOverview());
$('focus-general').addEventListener('click', () => {
  const unit = match && findGeneral(match,0);
  if(unit) {renderer.focusCell(unit.x,unit.y);drawVisibleOverview();}
});
$('focus-enemy').addEventListener('click', () => {
  const generals = match?.units.filter(unit=>unit.owner!==0&&unit.health>0&&getCard(unit.cardId)?.type==='general') ?? [];
  // During an enemy turn the portrait represents the acting general.
  const unit=generals.find(unit=>unit.owner===match.currentPlayer) ?? generals[enemyFocusIndex++ % generals.length];
  if(unit) {focusedEnemyOwner=unit.owner;renderer.focusCell(unit.x,unit.y);refreshMatch();}
});
$('map-overview').addEventListener('pointerdown', event => {
  if (!match) return;
  const canvas=event.currentTarget, rect=canvas.getBoundingClientRect(), board=match.board;
  // Use drawable map pixels, excluding any CSS border.
  const x=(event.clientX-rect.left-canvas.clientLeft)/canvas.clientWidth;
  const y=(event.clientY-rect.top-canvas.clientTop)/canvas.clientHeight;
  renderer.focusCell(Math.max(0,Math.min(board.columns-1,Math.floor(x*board.columns))),Math.max(0,Math.min(board.rows-1,Math.floor(y*board.rows))));
  closeMapOverview();
});
$('map-overview').addEventListener('keydown', event => {
  const d={ArrowLeft:[64,0],ArrowRight:[-64,0],ArrowUp:[0,44],ArrowDown:[0,-44]}[event.key];
  if(d){event.preventDefault();renderer.pan(...d);drawVisibleOverview();}
});
window.addEventListener('blur', cancelMoveGesture);
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelMoveGesture(); });
window.addEventListener('pagehide', () => {
  cancelMoveGesture();
  sceneLoading.cancelRequest?.();
  cancelBattleAd();
});
window.addEventListener('beforeunload', () => { cancelBattleAd(); if (match && !replacingPlayerSave) persist(); playerCloud.dispose(); });

setInterval(() => {
  if (!document.hidden && !ui.match.hidden && !ui.result.hidden && match?.mode === 'expedition') {
    const day = expedition.dailyAdOffer('gold').day;
    if (day !== resultRewardDay) { resultRewardDay = day; refreshAdReward(); }
  }
  if (!match || sceneLoading.busy || ui.match.hidden || document.hidden || !['playing', 'ai'].includes(match.phase)) return;
  match.playtimeSeconds = (match.playtimeSeconds || 0) + 1;
  if (match.playtimeSeconds % 10 === 0) persist();
}, 1000);

// A single manager owns all cloud SDK calls and its one-upload-per-minute budget.
void playerCloud.initialize();
// Text and stats are immediately available. Failed visible card art can be
// retried without preparing the whole collection or touching player progress.
const artRetry = document.createElement('button');
artRetry.id = 'art-retry'; artRetry.type = 'button'; artRetry.hidden = true;
artRetry.textContent = '部分画面未加载 · 点按重试';
artRetry.addEventListener('click', () => { artRetry.hidden = true; renderer.assets.retryVisible(); });
document.body.append(artRetry);
ui.board.addEventListener('card-art-error', () => { if (!sceneLoading.busy) artRetry.hidden = false; });
ui.board.addEventListener('card-art-ready', () => {
  if (!renderer.assets.failed.size) artRetry.hidden = true;
  expeditionUI.syncIdle();
});
