import { buildCampaignAtlas } from './campaign-atlas.js';
import { SESSION_HOME_BACKGROUND } from './home-background.js';
import { findGiftCode } from './gift-codes.js';
import { LocalDecks, validateLocalDeck } from './local-decks.js';
import { DECK_COST_FILTERS, toggleDeckCost, matchesDeckInventory } from './deck-filters.js';
import { recommendDeck } from './deck-recommendation.js';
import { TRIAL_GROUPS } from './levels.js';
import { getTrialBackground } from './trial-backgrounds.js';
import { createGameCard } from './game-card.js';
import { CARDS } from './cards.js';
import { cardRuleSections } from './card-rules.js';
import { FACTIONS, getFaction, getHero } from './factions.js';
import { NEUTRAL_IDS, CAMPAIGN_UNIT_IDS, SPELL_IDS, SPELL_TRAINING_COSTS, getUnitSpecializations, getSpellUpgrade, getSpellTrainingPolicy, getUnlockRewards, getUnlockLabel } from './campaign-rules.js';
import { getEnemyPlan } from './enemy-plans.js';
import { makeStarterDeck, validatePlayerDeck, PLAYER_DECK_SIZE, MAX_CARD_COPIES } from './battle-deck.js';
import {
  EXPEDITION_CHAPTERS,
  EXPEDITION_LEVELS,
  TRAINABLE_IDS,
  TRAINING_COSTS,
  DEPLOYMENT_BUDGET,
  deploymentCost,
  trainingBonus
} from './expedition-data.js';

const $ = (root, selector) => root?.querySelector(selector);
const all = (root, selector) => [...(root?.querySelectorAll(selector) || [])];
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = String(text);
  return node;
};

function button(className, text, action) {
  const node = el('button', className, text);
  node.type = 'button';
  if (action) node.dataset.action = action;
  return node;
}

function goldAmount(amount, className = '') {
  const value = el('span', `training-gold ${className}`);
  const icon = el('img', 'resource-icon');
  icon.src = './assets/metagame/original/resource-gold.png'; icon.alt = '';
  value.append(icon, el('span', '', '金币'), el('strong', '', amount));
  return value;
}

function rewardText(reward) {
  if (reward == null) return '—';
  if (typeof reward === 'number') return `${reward} 金币`;
  if (typeof reward === 'string') return reward;
  const coins = reward.coins ?? reward.gold;
  return coins != null ? `${coins} 金币` : String(reward.label || '奖励');
}

function shortChapterTitle(title) {
  return String(title || '').replace(/^第[一二三四五六七八九十\d]+章\s*[·・:：—-]?\s*/, '') || title;
}

function trainedCard(base, bonus) {
  const description = String(base.description || '').replace(/^\d+\s*\/\s*\d+。?\s*/, '');
  return { ...base, attack: base.attack + bonus.attack, health: base.health + bonus.health, description };
}

export class ExpeditionUI {
  constructor({ root, progress, drawCardArt, drawCardIdle, onStart, onResume, trials, onCloud, onAdSelfTest, onRecruitment, onResourceRewards, onAudioSettings, onMusicToggle, musicPreferences, onLeaderboard, onAchievements }) {
    this.root = root;
    this.progress = progress;
    this.drawCardArt = typeof drawCardArt === 'function' ? drawCardArt : () => {};
    this.drawCardIdle = typeof drawCardIdle === 'function' ? drawCardIdle : () => 0;
    this.onStart = typeof onStart === 'function' ? onStart : () => {};
    this.onResume = typeof onResume === 'function' ? onResume : () => {};
    this.trials = trials;
    this.onCloud = onCloud || (() => {});
    this.onAdSelfTest = onAdSelfTest || (() => {});
    this.onRecruitment = onRecruitment || (() => {});
    this.onResourceRewards = onResourceRewards || (() => {});
    this.onLeaderboard = onLeaderboard || (() => {});
    this.onAchievements = onAchievements || (() => {});
    this.onAudioSettings=onAudioSettings||(()=>{});this.onMusicToggle=onMusicToggle||(()=>{});this.musicPreferences=musicPreferences||(()=>({muted:true,volume:0}));
    this.page = 'menu';
    this.trialGroupId = null;
    this.trialScroll = new Map();
    this.codexFilter = 'all';
    this.chapterId = null;
    this.levelId = null;
    this.detailCardId = null;
    this.keyboardDrag = null;
    this.pointerDrag = null;
    this.suppressClickUntil = 0;
    this.idleCanvases = new Set();
    this.idleTimer = 0;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    if (!this.root) return;
    this.root.classList.add('expedition-ui');
    this.root.style.setProperty('--home-background', `url("${SESSION_HOME_BACKGROUND}")`);
    this.root.addEventListener('click', (event) => this.handleClick(event));
    this.root.addEventListener('pointerdown', (event) => this.handlePointerDown(event));
    this.root.addEventListener('pointermove', (event) => this.handlePointerMove(event));
    this.root.addEventListener('pointerup', (event) => this.handlePointerEnd(event));
    this.root.addEventListener('pointercancel', (event) => this.cancelPointerDrag(event));
    this.root.addEventListener('lostpointercapture', (event) => this.cancelPointerDrag(event));
    this.root.addEventListener('keydown', (event) => this.handleKeyDown(event));
    this.root.addEventListener('scroll', () => this.syncIdle(), { passive: true, capture: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.cancelDrag(); this.syncIdle(); });
    window.addEventListener('blur', () => this.cancelDrag());
    this.reducedMotion.addEventListener('change', () => { this.deckCountMotion?.cancel(); this.deckCountMotion = null; this.syncIdle(); });
    this.visibilityObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) this.idleCanvases.add(entry.target);
        else this.idleCanvases.delete(entry.target);
      }
      this.syncIdle();
    }, { root: this.root, threshold: 0.01 });
    this.render();
  }

  get state() { return this.challengeSession?.state || this.progress?.state || {}; }
  get hero() { return getHero(this.state.selectedHeroId ?? 1); }
  get faction() { return getFaction(this.hero.faction); }

  openChallengePreparation({ challengeId, title = '远征挑战', heroId = 1, levelId, inventory, initialDeck, onStart, onExit } = {}) {
    if (!challengeId || heroId !== 1 || !levelId) return {ok:false,error:'挑战配置无效。'};
    const pool = {units:[...(inventory?.units || [])], spells:[...(inventory?.spells || [])]};
    const invalid = validateLocalDeck(initialDeck,1,pool);
    if (invalid) return {ok:false,error:invalid};
    if (!this.challengeSession) {
      const fields = ['page','chapterId','levelId','returnMission','detailCardId','heroPickerOpen','heroPickerFaction','inventoryTab','deckShowUnowned','deckSelectedCost','deckMessage','dialogError','notice','deckDrafts','localDecks','deckRecommendationUndo','pendingFocus','menuReturnFocus','cardReturnFocus','codexFaction','codexFilter','renderedMission'];
      this.challengeReturn = {fields:Object.fromEntries(fields.map(key=>[key,this[key]])),focus:document.activeElement,hidden:this.root.hidden,scroll:[...this.root.querySelectorAll('.training-roster,.deck-card-list,.deck-cost-filters,.atlas-chapters,.expedition-codex-rail')].map(node=>({selector:'.'+node.classList[0],left:node.scrollLeft,top:node.scrollTop}))};
    }
    const freeze = object => { for (const value of Object.values(object)) if (value && typeof value === 'object') freeze(value); return Object.freeze(object); };
    const cardIds = [...pool.units,...pool.spells];
    const state = freeze({selectedHeroId:1,inventory:pool,training:{},spellTraining:{},specializations:{},spellModes:{},growthVersion:Object.fromEntries(cardIds.map(id=>[id,'low-v2'])),factionDecks:{1:[...initialDeck]}});
    this.challengeSession = {challengeId,title,state,initialDeck:[...initialDeck],onStart:typeof onStart === 'function'?onStart:()=>{},onExit:typeof onExit === 'function'?onExit:()=>{}};
    // This adapter has no storage dependency. Reusing the editor must never
    // instantiate LocalDecks or touch the player's ordinary deck namespace.
    this.localDecks = {get:()=>[...initialDeck],error:()=>'',save:()=>({ok:true}),set:(factionId,deck)=>{const error=validateLocalDeck(deck,1,pool);return factionId!==1?{ok:false,error:'挑战主将固定。'}:error?{ok:false,error}:{ok:true};}};
    this.deckDrafts = new Map([[1,[...initialDeck]]]); this.deckRecommendationUndo = new Map();
    this.page='prep'; this.returnMission=levelId; this.levelId=levelId; this.detailCardId=null; this.heroPickerOpen=false;
    this.inventoryTab='units'; this.deckSelectedCost=null; this.deckShowUnowned=false; this.deckMessage=''; this.dialogError=''; this.notice='';
    this.root.hidden=false; this.root.setAttribute('aria-hidden','false'); this.render();
    return {ok:true};
  }

  closeChallengePreparation() {
    if (!this.challengeSession) return;
    const restore=this.challengeReturn;
    this.challengeSession=null; this.challengeReturn=null;
    Object.assign(this,restore.fields); this.render();
    this.root.hidden=restore.hidden; this.root.setAttribute('aria-hidden',String(restore.hidden));
    requestAnimationFrame(()=>{
      for(const saved of restore.scroll){const node=this.root.querySelector(saved.selector);if(node){node.scrollLeft=saved.left;node.scrollTop=saved.top;}}
      if(restore.focus?.isConnected) restore.focus.focus({preventScroll:true});
      else if(restore.focus?.dataset?.action){
        const attrs=Object.entries(restore.focus.dataset).filter(([key])=>['action','cardId','cost','tab','page','factionId'].includes(key)).map(([key,value])=>`[data-${key.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase())}="${CSS.escape(value)}"]`).join('');
        this.root.querySelector(attrs)?.focus({preventScroll:true});
      }
    });
  }

  unitTrainingBonus(id, rank) {
    return this.challengeSession ? trainingBonus(id,0,'low-v2') : this.progress.getUnitTrainingBonus(id,rank);
  }

  show() {
    if (!this.root) return;
    this.root.hidden = false;
    this.root.setAttribute('aria-hidden', 'false');
    this.refresh();
  }

  hide() {
    this.deckCountMotion?.cancel(); this.deckCountMotion = null;
    if (!this.root) return;
    this.root.hidden = true;
    this.root.setAttribute('aria-hidden', 'true');
    this.cancelDrag();
    this.stopIdle();
  }

  refresh() {
    if (!this.root) return;
    const activeLevel = this.state.activeBattle?.levelId;
    if (!this.levelId && activeLevel && EXPEDITION_LEVELS.some((level) => level.id === activeLevel)) this.levelId = activeLevel;
    this.render();
  }

  render() {
    this.deckCountMotion?.cancel(); this.deckCountMotion = null;
    this.cancelDrag();
    const scrollState = Object.fromEntries(['.chapter-rail', '.atlas-chapters', '.training-roster', '.deck-cost-filters', '.deck-card-list', '.barracks', '.mission-copy', '.expedition-codex-rail', '.codex-faction-buttons'].map((selector) => [selector, { left: $(this.root, selector)?.scrollLeft || 0, top: $(this.root, selector)?.scrollTop || 0 }]));
    if (this.renderedMission !== this.levelId) scrollState['.mission-copy'].top = 0;
    this.renderedMission = this.levelId;
    const oldDialog = $(this.root, 'dialog[open]');
    const dialogScroll = oldDialog?.scrollTop || 0;
    const detailScroll = oldDialog?.querySelector('.training-detail')?.scrollTop || 0;
    const active = document.activeElement?.closest?.('[data-action]');
    const focusState = this.pendingFocus || (active && this.root.contains(active) ? {
      action: active.dataset.action, chapterId: active.dataset.chapterId, cardId: active.dataset.cardId, slot: active.dataset.slot, factionId: active.dataset.factionId, levelId: active.dataset.levelId, groupId: active.dataset.groupId, page: active.dataset.page, mode: active.dataset.mode, spec: active.dataset.spec, tab: active.dataset.tab, cost: active.dataset.cost
    } : null);
    this.pendingFocus = null;
    this.stopIdle();
    this.visibilityObserver?.disconnect();
    this.idleCanvases.clear();
    this.root.dataset.page = this.page;
    this.root.dataset.challenge = String(Boolean(this.challengeSession));
    this.root.dataset.inlineChrome = String(this.page === 'prep' || (this.page === 'expedition' && Boolean(this.chapterId)));
    this.root.replaceChildren(this.buildTopbar(), this.buildStage(), this.buildCardDialog(), this.buildHeroDialog());
    requestAnimationFrame(() => {
      for (const [selector, position] of Object.entries(scrollState)) {
        const track = $(this.root, selector);
        if (track) {
          if (this.page === 'trials' && selector === '.chapter-rail') {
            const resume = track.querySelector('.is-resumable');
            track.scrollLeft = this.trialScroll.has(this.trialGroupId) ? this.trialScroll.get(this.trialGroupId) : resume ? Math.max(0, resume.offsetLeft - track.offsetLeft - 16) : 0;
          } else if (selector === '.atlas-chapters') {
            track.scrollLeft = this.atlasScrollLeft || 0;
            // A newly entered chapter should be visible, even on a progressed save.
            if (this.atlasVisibleChapter !== this.chapterId) {
              const selected = track.querySelector('[aria-pressed="true"]');
              if (selected) {
                const item = selected.getBoundingClientRect(), rail = track.getBoundingClientRect();
                if (item.left < rail.left) track.scrollLeft -= rail.left - item.left;
                else if (item.right > rail.right) track.scrollLeft += item.right - rail.right;
              }
              this.atlasVisibleChapter = this.chapterId;
              this.atlasScrollLeft = track.scrollLeft;
            }
          } else track.scrollLeft = position.left;
          track.scrollTop = position.top;
        }
      }
      if (focusState) {
        const attrs = [`[data-action="${focusState.action}"]`, focusState.chapterId != null ? `[data-chapter-id="${focusState.chapterId}"]` : '', focusState.cardId != null ? `[data-card-id="${focusState.cardId}"]` : '', focusState.slot != null ? `[data-slot="${focusState.slot}"]` : '', focusState.factionId != null ? `[data-faction-id="${focusState.factionId}"]` : '', focusState.groupId != null ? `[data-group-id="${focusState.groupId}"]` : '', focusState.page != null ? `[data-page="${focusState.page}"]` : ''].join('');
        const options = ['mode', 'spec', 'tab', 'cost'].map((key) => focusState[key] != null ? `[data-${key}="${focusState[key]}"]` : '').join('');
        $(this.root.querySelector('dialog[open]') || this.root, attrs + options + (focusState.levelId ? `[data-level-id="${focusState.levelId}"]` : ''))?.focus({ preventScroll: true });
      }
      const dialog = $(this.root, 'dialog[open]');
      if (dialog) dialog.scrollTop = dialogScroll;
      const detail = dialog?.querySelector('.training-detail');
      if (detail) detail.scrollTop = detailScroll;
      all(this.root, 'canvas[data-card-art]').forEach((canvas) => this.visibilityObserver?.observe(canvas));
      this.syncIdle();
    });
  }

  buildTopbar() {
    const bar = el('header', 'expedition-topbar');
    bar.hidden = this.page === 'menu' || this.page === 'codex' || this.page === 'trials' || this.page === 'prep' || (this.page === 'expedition' && Boolean(this.chapterId));
    if (bar.hidden) return bar;
    const back = button('expedition-back', '返回章节', 'back');
    back.hidden = (this.page !== 'expedition' || !this.chapterId) && this.page !== 'prep';
    if (this.page === 'prep') { back.dataset.action = 'return-mission'; back.setAttribute('aria-label', '返回关卡情报'); }
    if (back.hidden) bar.append(this.buildMenuReturn());
    else { back.textContent = this.page === 'prep' ? '‹ 关卡' : '‹ 章节'; back.setAttribute('aria-label', this.page === 'prep' ? '返回关卡情报' : '返回章节选择'); bar.append(back); }
    const commander = button('expedition-commander', '', 'heroes');
    const crest = el('img'); crest.src = this.faction.crest; crest.alt = '';
    commander.append(crest, el('span', '', this.hero.name), el('span', 'commander-chevron', '⌄'));
    commander.setAttribute('aria-label', `选择主将，当前${this.faction.name}·${this.hero.name}`);
    if (this.page !== 'prep') { commander.classList.add('compact-commander'); bar.append(commander); }
    if (this.page === 'expedition' && !this.chapterId) bar.append(el('strong', 'expedition-title', '远征'));
    return bar;
  }

  buildStage() {
    const main = el('main', 'expedition-stage');
    if (this.page === 'menu') main.append(this.buildMenu());
    else if (this.page === 'prep') main.append(this.buildBarracks());
    else if (this.page === 'codex') main.append(this.buildCodex());
    else if (this.page === 'trials') main.append(this.buildTrials());
    else if (this.chapterId) main.append(this.buildChapter());
    else main.append(this.buildChapterHome());
    if (this.notice) main.append(el('p', 'expedition-notice', this.notice));
    const error = this.challengeSession ? '' : this.progress?.error;
    if (error) main.append(el('p', 'expedition-error', error));
    return main;
  }

  factionProgress(factionId = this.faction.id) { return this.progress.getFactionProgress(factionId); }

  buildMenu() {
    const view = el('section', 'expedition-menu faction-menu'); view.setAttribute('aria-label', '六阵营远征');
    const resources = el('div', 'menu-resources');
    resources.setAttribute('aria-label', '资源余额');
    for (const [resource, label, amount, asset] of [
      ['gold', '金币', this.state.coins ?? 0, 'resource-gold.png'],
      ['orb', '宝珠', this.state.recruitment?.tickets ?? 0, 'spirit-orb.png'],
    ]) {
      const balance = el('div', 'menu-resource'); balance.dataset.resource = resource;
      balance.setAttribute('aria-label', `${label} ${amount}`);
      const icon = el('img', 'resource-icon'); icon.src = `./assets/metagame/original/${asset}`; icon.alt = '';
      balance.append(icon, el('strong', '', amount));
      resources.append(balance);
    }

    const music=button('menu-utility menu-music-toggle','','music-toggle');this.setMusicControl(music);resources.append(music);
    const settings=button('menu-utility','设置','audio-settings');settings.setAttribute('aria-haspopup','dialog');
    const activity = findGiftCode('LX2026');
    if (activity && !Object.hasOwn(this.state.giftCodeClaims ?? {}, activity.id)) {
      settings.classList.add('has-gift-hint');
      settings.append(el('span', 'menu-gift-hint', '礼包待领取'));
      settings.setAttribute('aria-label', '设置，礼包待领取');
    }
    resources.append(settings);
    const save = button('menu-utility', '存档', 'cloud'); save.setAttribute('aria-haspopup', 'dialog'); resources.append(save);
    const rules = button('menu-utility', '规则', 'battle-rules'); rules.setAttribute('aria-label', '战斗规则'); rules.setAttribute('aria-haspopup', 'dialog'); resources.append(rules);
    const supply = button('menu-utility menu-supply', '每日补给', 'resource-rewards');
    supply.setAttribute('aria-label', '每日补给，观看广告领取金币或宝珠');
    supply.setAttribute('aria-haspopup', 'dialog'); resources.append(supply);
    const factions = el('aside', 'menu-faction-picker'); factions.setAttribute('aria-label', '选择阵营');
    const grid = el('div', 'menu-faction-grid');
    for (const faction of FACTIONS) {
      const choice = button('menu-faction', '', 'select-faction'); choice.dataset.factionId = faction.id;
      const icon = el('img'); icon.src = faction.crest; icon.alt = '';
      const completed = this.factionProgress(faction.id).completed.length;
      choice.setAttribute('aria-pressed', String(faction.id === this.faction.id));
      choice.setAttribute('aria-label', faction.name + '，已完成' + completed + '关');
      choice.append(icon, el('strong', '', faction.name), el('small', '', completed + ' / '+EXPEDITION_LEVELS.length+' 关')); grid.append(choice);
    }
    factions.append(grid);
    const emblem = el('div', 'menu-commander');
    const heroSwitch = button('menu-hero-switch', '更换主将', 'heroes');
    heroSwitch.setAttribute('aria-label', `更换主将，当前${this.hero.name}`);
    heroSwitch.setAttribute('aria-haspopup', 'dialog');
    const medallion = el('div', 'menu-portrait-medallion');
    const portrait = el('img', 'menu-hero'); portrait.src = this.hero.portrait; portrait.alt = this.hero.name;
    medallion.append(portrait);
    emblem.append(medallion, heroSwitch);

    const selected = el('section', 'menu-selected-faction');
    const story = el('div', 'menu-faction-story');
    const completed = this.factionProgress().completed;
    const next = EXPEDITION_LEVELS.find(level => !completed.includes(level.id));
    const chapter = EXPEDITION_CHAPTERS.find(item => item.id === next?.chapterId);
    const strengths = el('ul', 'menu-faction-strengths'); strengths.setAttribute('aria-label', '阵营擅长');
    for (const label of this.faction.strengths) strengths.append(el('li', '', label));
    const resume = this.state.activeBattle;
    const battleFaction = resume && getHero(resume.players[0].generalId)?.faction;
    const status = el('div', 'menu-route-status');
    if (resume && battleFaction !== this.faction.id) {
      const continueOther = button('menu-other-resume', '', 'resume');
      continueOther.append(el('span', '', `继续${getFaction(battleFaction).name}`), el('small', '', EXPEDITION_LEVELS.find(level => level.id === resume.levelId)?.title || '保存的战斗'));
      continueOther.setAttribute('aria-label', `继续${getFaction(battleFaction).name}保存的战斗`);
      status.append(continueOther);
    } else status.append(el('strong', '', chapter?.title || '远征已完成'));
    story.append(el('h1', '', this.faction.name), strengths, status);
    heroSwitch.textContent = `${this.hero.name} · 更换`;
    const journeyLabel = completed.length === EXPEDITION_LEVELS.length ? '查看关卡' : completed.length ? '继续征程' : '开始征程';
    const play = button('menu-play expedition-primary', battleFaction === this.faction.id ? '继续战斗' : journeyLabel, battleFaction === this.faction.id ? 'resume' : 'nav');
    if (battleFaction !== this.faction.id) play.dataset.page = 'expedition';
    const journeys = el('div', 'menu-journeys');
    const trial = button('menu-destination menu-trials', '试炼', 'nav'); trial.dataset.page = 'trials';
    journeys.append(play, trial);
    const links = el('nav', 'menu-destinations');
    const collection = button('menu-destination', '收藏', 'nav'); collection.dataset.page = 'codex'; links.append(collection);
    links.append(button('menu-destination', '招募', 'recruitment'));
    links.append(button('menu-destination', '排行', 'leaderboard'), button('menu-destination', '成就', 'achievements'));
    selected.append(story, emblem, journeys, links);
    view.append(resources, factions, selected); return view;
  }

  setMusicControl(target){const p=this.musicPreferences(),silent=p.muted||p.volume===0;target.setAttribute('aria-pressed',String(!silent));target.setAttribute('aria-label',silent?'开启主菜单音乐':'静音主菜单音乐');target.title=silent?'音乐：静音':'音乐：有声';target.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 8h4l6-5v18l-6-5H3z"/>${silent?'<path fill="currentColor" d="m17 7 2 3 2-3 2 2-3 3 3 3-2 2-2-3-2 3-2-2 3-3-3-3z"/>':'<path fill="currentColor" d="M15 7v3a3 3 0 0 1 0 4v3a6 6 0 0 0 0-10M18 3v3a8 8 0 0 1 0 12v3a11 11 0 0 0 0-18"/>'}</svg>`;}
  refreshMusicControl(){for(const target of this.root.querySelectorAll('[data-action="music-toggle"]'))this.setMusicControl(target);}

  buildTrials() {
    const view = el('section', 'expedition-chapters expedition-trials');
    view.setAttribute('aria-label', '战术试炼');
    const state = this.trials.read();
    if (!TRIAL_GROUPS.some((group) => group.id === this.trialGroupId)) {
      this.trialGroupId = this.trials.levels.find((level) => level.id === state.resumeLevelId)?.group || 'basics';
    }
    const heading = el('div', 'trials-heading');
    heading.append(this.buildMenuReturn(), el('h2', '', '战术试炼'), el('span', 'trials-progress', `${this.trials.levels.filter((level) => state.completed.has(level.id)).length} / ${this.trials.levels.length} 完成`));
    if (state.cloudAvailable && state.hasCloudArchive) heading.append(button('trial-save', '云端续玩', 'trial-cloud'));
    if (state.cloudAvailable && state.hasLocal) heading.append(button('trial-save', '同步进度', 'trial-sync'));
    const groups = el('div', 'trial-groups');
    groups.setAttribute('role', 'group');
    groups.setAttribute('aria-label', '选择试炼课程');
    for (const group of TRIAL_GROUPS) {
      const levels = this.trials.levels.filter((level) => level.group === group.id);
      const complete = levels.filter((level) => state.completed.has(level.id)).length;
      const choice = button('trial-group', '', 'trial-group');
      choice.dataset.groupId = group.id;
      choice.setAttribute('aria-pressed', String(group.id === this.trialGroupId));
      choice.append(el('strong', '', group.title), el('small', '', `${complete} / ${levels.length}`));
      groups.append(choice);
    }
    const group = TRIAL_GROUPS.find((item) => item.id === this.trialGroupId);
    const description = el('p', 'trial-group-description', `${group?.description || ''}`);
    const track = el('div', 'chapter-rail');
    track.setAttribute('aria-label', `${group?.title || '试炼'}课程`);
    track.addEventListener('scroll', () => this.trialScroll.set(this.trialGroupId, track.scrollLeft), { passive: true });
    this.trials.levels.filter((level) => level.group === this.trialGroupId).forEach((level, index) => {
      const complete = state.completed.has(level.id);
      const resume = state.resumeLevelId === level.id;
      const status = resume ? '继续试炼' : complete ? '已完成 · 再练一次' : '开始练习';
      const card = button(`expedition-chapter trial-card${resume ? ' is-resumable' : ''}`, '', 'trial');
      card.dataset.levelId = level.id;
      const lesson = level.lesson?.summary || level.subtitle || level.goal;
      card.setAttribute('aria-label', `${level.title}，学习${lesson}，${status}`);
      const art = el('span', 'chapter-art trial-cover');
      art.setAttribute('aria-hidden', 'true');
      // The course cover previews the same authored scenery as its battlefield.
      const scenery = getTrialBackground(level.id);
      art.style.backgroundImage = [scenery?.middleground, scenery?.background].filter(Boolean).map(path => `url("${path}")`).join(', ');
      const copy = el('span', 'chapter-copy');
      copy.append(el('small', '', `练习 ${index + 1}${complete ? '　✓ 已完成' : ''}`), el('strong', '', level.title), el('span', 'trial-lesson', lesson), el('em', '', status));
      card.append(art, copy); track.append(card);
    });
    view.append(heading, groups, description, track);
    if (state.error) {
      const error = el('p', 'expedition-error', state.error);
      error.setAttribute('role', 'status'); view.append(error);
    }
    return view;
  }

  buildChapterHome() { return buildCampaignAtlas(this); }

  buildChapter() { return buildCampaignAtlas(this); }

  buildMission(level) {
    const panel = el('aside', 'mission-preview');
    if (!level) return panel;
    const plan = getEnemyPlan(level.id, 3, this.faction.id);
    const grid = el('div', 'mission-map');
    grid.style.setProperty('--cols', level.columns || 9);
    grid.style.setProperty('--rows', level.rows || 5);
    const tiles = new Map((level.tiles || []).map((tile) => [`${tile.x},${tile.y}`, tile.type]));
    const starts = new Map();
    if (level.playerStart) starts.set(`${level.playerStart.x},${level.playerStart.y}`, 'player-general');
    for (const enemy of level.enemies || []) if (CARDS[enemy.cardId]?.type === 'general') starts.set(`${enemy.x},${enemy.y}`, enemy.owner === 2 ? 'third' : 'enemy');
    for (const [owner, army] of Object.entries(plan.players)) for (const enemy of army.garrison || []) starts.set(`${enemy.x},${enemy.y}`, Number(owner) === 2 ? 'third' : 'enemy');
    for (let y = 0; y < (level.rows || 5); y += 1) {
      for (let x = 0; x < (level.columns || 9); x += 1) {
        const cell = el('i');
        const terrain = tiles.get(`${x},${y}`);
        const occupant = starts.get(`${x},${y}`);
        if (terrain) cell.classList.add(`is-${terrain}`);
        if (occupant) cell.classList.add(`has-${occupant}`);
        grid.append(cell);
      }
    }
    const legend = el('div', 'mission-map-legend');
    legend.innerHTML = '<span class="wall">墙</span><span class="rough">碎石</span><span class="outpost">前哨</span><span class="friendly">我方</span><span class="hostile">敌军</span>';
    const copy = el('div', 'mission-copy');
    copy.append(el('h3', '', level.title), el('p', '', level.goal || '完成本关目标。'));
    const rewards = el('dl', 'mission-rewards');
    const payout = this.progress.rewardPreview(level.id, this.faction.id);
    rewards.append(el('div', '', (payout.accountFirst || payout.factionFirst ? '首通奖励' : '再次挑战') + '：' + payout.coins + ' 金币' + (payout.tickets ? ' / ' + payout.tickets + ' 宝珠' : '')));
    if (payout.chapterCoins) rewards.append(el('small', '', '含本阵营章末奖励 ' + payout.chapterCoins + ' 金币'));
    if (payout.compensationCoins) rewards.append(el('small', '', '含宝珠转金币 ' + payout.compensationCoins));
    const start = button('expedition-primary', '战前准备', 'adjust-loadout');
    start.dataset.levelId = level.id;
    start.disabled = !this.progress?.isUnlocked?.(level.id);
    if (start.disabled) start.textContent = '未解锁';
    const intel = el('details', 'mission-intel');
    intel.append(el('summary', '', '敌军情报'), el('p', '', plan.hint));
    for (const [owner, enemy] of Object.entries(plan.players || {})) {
      const counts = new Map();
      for (const id of enemy.deck || []) counts.set(id, (counts.get(id) || 0) + 1);
      intel.append(el('p', '', `${Number(owner) === 2 ? '第三方' : '敌方'}：主将 ${enemy.generalAttack} 攻 / ${enemy.generalHealth} 血；起手 ${enemy.openingHandSize} 张，法力 ${enemy.mana} 起步、每轮 +${enemy.manaGrowth}、上限 ${enemy.manaCap}`));
      intel.append(el('p', 'enemy-deck-summary', [...counts].map(([id, count]) => {
        const card = CARDS[id], stats = enemy.unitStats?.[id];
        return `${card?.name || id}${stats ? `（${stats.cost}费 ${stats.attack}/${stats.health}）` : card?.type === 'spell' ? `（${enemy.spellRank}阶）` : ''} ×${count}`;
      }).join('、')));
    }
    const unlocks = payout.cards;
    const unlockNames = [...unlocks.units, ...unlocks.spells].filter((id) => CARDS[id]?.faction === this.faction.id || NEUTRAL_IDS.includes(id)).map((id) => CARDS[id]?.name || String(id));
    copy.append(rewards);
    if (unlockNames.length) copy.append(el('p', 'mission-unlocks', `解锁：${unlockNames.join('、')}`));
    copy.append(intel);
    const adjust = button('mission-adjust', '收藏', 'nav'); adjust.dataset.page = 'codex';
    adjust.dataset.levelId = level.id;
    const actions = el('div', 'mission-actions'); actions.append(adjust, start);
    const mapWrap = el('div', 'mission-map-wrap');
    mapWrap.append(grid, legend);
    panel.append(mapWrap, copy, actions);
    return panel;
  }

  battleDeck() { return this.state.factionDecks?.[this.faction.id] || this.progress.getBattleLoadout().deck; }

  draftDeck() {
    this.deckDrafts ||= new Map();
    this.localDecks ||= new LocalDecks();
    if (!this.deckDrafts.has(this.faction.id)) this.deckDrafts.set(this.faction.id, this.localDecks.get(this.faction.id,this.battleDeck(),this.state.inventory));
    return this.deckDrafts.get(this.faction.id);
  }

  saveLocalDeck() {
    const deck = this.draftDeck();
    const changed = this.localDecks.set(this.faction.id,deck,this.state.inventory);
    const result = changed.ok ? this.localDecks.save(this.faction.id,this.state.inventory) : changed;
    this.deckMessage = result.ok ? '' : result.error;
    if (!result.ok) this.render();
    return result.ok;
  }

  signalIncompleteDeck() {
    const count = this.draftDeck().length;
    const total = this.root.querySelector('.deck-total');
    total?.setAttribute('aria-label', count < PLAYER_DECK_SIZE ? `还需加入${PLAYER_DECK_SIZE - count}张卡牌，当前${count}张` : '牌组尚未满足出战条件');
    this.deckCountMotion?.cancel(); this.deckCountMotion = null;
    if (!total?.animate || this.reducedMotion?.matches) return;
    // Keep the unavailable button focusable: activation only points at the
    // missing requirement, and never saves or starts an invalid battle.
    this.deckCountMotion = total.animate(
      [{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}],
      {duration:280,easing:'ease-out'}
    );
    this.deckCountMotion.onfinish = () => { this.deckCountMotion = null; };
  }

  deckCardControls(id) {
    const controls = el('div', 'deck-card-controls');
    const count = this.draftDeck().filter(cardId => cardId === id).length;
    const minus = button('', '−', 'deck-remove'); minus.dataset.cardId = id;
    minus.setAttribute('aria-label', '减少' + CARDS[id].name); minus.disabled = count === 0;
    const plus = button('', '+', 'deck-add'); plus.dataset.cardId = id;
    plus.setAttribute('aria-label', '加入' + CARDS[id].name);
    plus.disabled = count >= MAX_CARD_COPIES || this.draftDeck().length >= PLAYER_DECK_SIZE || !this.owns(id, CARDS[id].type === 'spell' ? 'spells' : 'units');
    controls.append(minus, el('span', '', count + '/3'), plus); return controls;
  }

  buildBarracks() {
    const section = el('section', 'barracks deck-barracks');
    if (this.challengeSession) section.setAttribute('aria-label', `远征挑战 · ${this.challengeSession.title}`);
    const deck = this.draftDeck(), editor = el('aside', 'deck-editor');
    const valid = validatePlayerDeck(deck, this.hero.id, this.state.inventory);
    const heading = el('div', 'deck-heading');
    const back = button('inline-return', '‹ 关卡', 'return-mission'); back.setAttribute('aria-label', '返回关卡情报');
    heading.setAttribute('aria-label', '出战牌组');
    const total = el('strong', `deck-total${deck.length < PLAYER_DECK_SIZE ? ' is-incomplete' : ''}`, deck.length + '/30');
    total.setAttribute('role', 'status'); total.setAttribute('aria-live', 'polite'); total.setAttribute('aria-atomic', 'true');
    heading.append(back, total);
    if (this.challengeSession) { back.textContent='‹ 返回';back.setAttribute('aria-label','返回远征挑战');heading.insertBefore(el('strong','challenge-prep-title','远征挑战'),total); }
    const actions = el('div', 'deck-prep-actions');
    actions.append(button('', '推荐配牌', 'deck-recommend'), button('', '恢复默认', 'deck-default'));
    if (this.deckRecommendationUndo?.has(this.faction.id)) actions.append(button('', '撤销推荐', 'deck-undo-recommend'));
    editor.append(heading, actions);
    const deckError = this.deckMessage || this.localDecks.error(this.faction.id);
    if (deckError) { const status = el('p', 'deck-status', deckError); status.setAttribute('role', 'status'); editor.append(status); }

    const list = el('div', 'deck-card-list');
    // Sort the display only; the draft's draw order remains untouched.
    const cardCost = id => CARDS[id].type === 'spell' ? this.spellCard(id).cost : CARDS[id].cost;
    const displayIds = [...new Set(deck)].sort((a, b) => cardCost(a) - cardCost(b));
    for (const id of displayIds) {
      const row = el('div', 'deck-card-row');
      const detail = button('deck-card-detail', '', 'card-detail'); detail.dataset.cardId = id;
      const cost = CARDS[id].type === 'spell' ? this.spellCard(id).cost : CARDS[id].cost;
      detail.append(el('span', 'deck-mana', String(cost)), el('span', 'deck-card-name', CARDS[id].name));
      detail.setAttribute('aria-label', `${cost}费 ${CARDS[id].name}`);
      row.append(detail, this.deckCardControls(id)); list.append(row);
    }
    if (!deck.length) list.append(el('p', '', '从库存详情加入卡牌。'));
    editor.append(list);
    const launch = button('expedition-primary prep-start', '开始战斗', 'start'); launch.setAttribute('aria-label', '确认牌组并进入战斗'); launch.dataset.levelId = this.returnMission; launch.setAttribute('aria-disabled', String(!valid || !this.returnMission)); editor.append(launch);
    const inventory = el('section', 'barracks-inventory');
    const tabs = el('nav', 'inventory-tabs'); tabs.setAttribute('aria-label', '永久库存');
    for (const [tab, label] of [['units', '单位'], ['spells', '法术']]) {
      const choice = button('', label, 'inventory-tab'); choice.dataset.tab = tab;
      choice.setAttribute('aria-pressed', String((this.inventoryTab || 'units') === tab)); tabs.append(choice);
    }
    const ownership = button('deck-owned-toggle', '显示未拥有', 'deck-show-unowned');
    ownership.setAttribute('aria-pressed', String(Boolean(this.deckShowUnowned)));
    if (!this.challengeSession) tabs.append(ownership);
    const costs = el('nav', 'deck-cost-filters'); costs.setAttribute('aria-label', '费用筛选');
    for (const cost of DECK_COST_FILTERS) {
      const label = cost === 8 ? '8+' : String(cost);
      const choice = button('deck-cost-filter', '', 'deck-cost'); choice.dataset.cost = String(cost);
      choice.setAttribute('aria-label', cost === 8 ? '8费及以上' : `${cost}费`);
      choice.setAttribute('aria-pressed', String(this.deckSelectedCost === cost));
      const icon = el('img'); icon.src = './assets/ui/icon-mana.png'; icon.alt = '';
      choice.append(icon, el('span', '', label)); costs.append(choice);
    }
    const roster = el('div', 'training-roster');
    const spells = this.inventoryTab === 'spells';
    const ids = spells ? this.faction.spellIds : [...this.faction.unitIds, ...NEUTRAL_IDS];
    for (const id of ids) {
      if (!matchesDeckInventory({ owned: this.owns(id, spells ? 'spells' : 'units'), cost: spells ? this.spellCard(id).cost : CARDS[id].cost }, { showUnowned: this.deckShowUnowned, selectedCost: this.deckSelectedCost })) continue;
      roster.append(spells ? this.buildSpellCard(id) : this.buildTrainingCard(id, deck));
    }
    if (!roster.childElementCount) roster.append(el('p', 'deck-inventory-empty', '没有符合筛选的卡牌'));
    inventory.append(tabs, costs, roster);
    section.append(editor, inventory); return section;
  }

  buildCodex() {
    const section = el('section', 'expedition-codex');
    const filters = el('aside', 'expedition-codex-filters');
    filters.append(this.buildMenuReturn());
    const factionId = this.codexFaction ?? this.faction.id;
    const factionBar = el('nav', 'codex-faction-buttons');
    factionBar.setAttribute('aria-label', '图鉴阵营');
    for (const faction of FACTIONS) {
      const item = button('codex-faction-button', '', 'codex-faction');
      item.dataset.factionId = faction.id;
      item.setAttribute('aria-label', faction.name);
      item.setAttribute('aria-pressed', String(faction.id === factionId));
      const crest = el('img'); crest.src = faction.crest; crest.alt = '';
      item.append(crest); factionBar.append(item);
    }
    const neutral = button('codex-faction-button codex-neutral', '中立', 'codex-faction');
    neutral.dataset.factionId = 0; neutral.setAttribute('aria-pressed', String(factionId === 0)); factionBar.append(neutral);
    filters.append(factionBar);
    const types = el('nav', 'codex-types'); types.setAttribute('aria-label', '卡牌类型');
    [['all', '全部'], ['unit', '随从'], ['spell', '法术'], ['general', '主将']].forEach(([filter, label]) => {
      const item = button('', label, 'codex-filter');
      item.dataset.filter = filter;
      item.setAttribute('aria-pressed', String(this.codexFilter === filter));
      types.append(item);
    });
    filters.append(types);
    const ownership = el('nav', 'collection-scope');
    for (const [scope, label] of [['owned', '已拥有'], ['all', '全部收藏']]) { const choice = button('', label, 'collection-scope'); choice.dataset.scope = scope; choice.setAttribute('aria-pressed', String((this.collectionScope || 'owned') === scope)); ownership.append(choice); }
    filters.append(ownership);
    const cards = Object.values(CARDS).filter((card) => (card.type === 'general' || CAMPAIGN_UNIT_IDS.includes(card.id) || SPELL_IDS.includes(card.id)) && (factionId === 0 ? NEUTRAL_IDS.includes(card.id) : card.faction === factionId) && (this.codexFilter === 'all' || card.type === this.codexFilter) && ((this.collectionScope || 'owned') === 'all' || card.type === 'general' || this.owns(card.id, card.type === 'spell' ? 'spells' : 'units')));
    const rail = el('div', 'expedition-codex-rail');
    rail.tabIndex = 0;
    rail.setAttribute('aria-label', '卡牌图鉴');
    cards.forEach((card) => {
      const open = button('expedition-codex-card', '', 'card-detail');
      open.dataset.cardId = card.id;
      open.setAttribute('aria-label', `查看${card.name}详情`);
      const display = card.type === 'unit' ? trainedCard(card, this.progress.getUnitTrainingBonus(card.id)) : card.type === 'spell' ? this.spellCard(card.id) : card;
      open.append(createGameCard(display, { drawArt: (canvas, cardId) => this.paint(canvas, cardId), presentation: 'collection' }));
      if (card.type !== 'general') {
        const rank = this.state[card.type === 'spell' ? 'spellTraining' : 'training']?.[card.id] || 0;
        open.append(el('small', 'collection-card-status', this.owns(card.id, card.type === 'spell' ? 'spells' : 'units') ? `已拥有${rank > 0 ? ` · ${rank} 阶` : ''}` : getUnlockLabel(card.id)));
      }
      rail.append(open);
    });
    section.append(filters, rail);
    return section;
  }

  buildTrainingCard(id, squad) {
    const base = CARDS[id] || { id, name: `单位 ${id}`, type: 'unit', attack: 0, health: 0, description: '' };
    const rank = Math.max(0, Math.min(4, this.state.training?.[id] ?? 0));
    const bonus = this.unitTrainingBonus(id, rank) || { attack: 0, health: 0 };
    const selected = squad.includes(id);
    const unlocked = this.owns(id, 'units');
    const wrap = el('article', `training-card${selected ? ' is-in-squad' : ''}${unlocked ? '' : ' is-locked'}`);
    const open = button('training-card-open', '', 'card-detail'); open.dataset.cardId = id;
    open.dataset.locked = String(!unlocked);
    open.setAttribute('aria-label', `查看${base.name}详情`);
    open.append(createGameCard(trainedCard(base, bonus), { drawArt: (canvas, cardId) => this.paint(canvas, cardId) }));
    const caption = el('div', 'training-caption');
    if (!unlocked) caption.append(el('span', '', this.page === 'prep' ? '未解锁' : getUnlockLabel(id)));
    else if (this.page !== 'prep' || rank > 0) caption.append(el('span', '', this.page === 'prep' ? `${rank} 阶` : `培养 ${rank} 阶${NEUTRAL_IDS.includes(id) ? ' · 中立' : ''}`));
    if (selected && this.page !== 'prep') caption.append(el('strong', '', `牌组 ×${squad.filter(cardId => cardId === id).length}`));
    if (this.page === 'prep') {
      wrap.append(open, this.deckCardControls(id));
      if (caption.childElementCount) wrap.append(caption);
    } else wrap.append(open, caption);
    return wrap;
  }

  owns(id, type) { return (this.state.inventory?.[type] || []).includes(id); }

  modeLabel(mode) { return { base: '原式', power: '强效', tactical: '战术' }[mode || 'base'] || '原式'; }

  selectedSpells() { return this.state.factionSpells?.[this.faction.id] || []; }

  spellCard(id) { return getSpellUpgrade(id, this.state.spellTraining?.[id] || 0, this.state.spellModes?.[id] || 'base'); }

  buildSpellCard(id) {
    const card = this.spellCard(id), unlocked = this.owns(id, 'spells');
    const selected = this.draftDeck().includes(id);
    const wrap = el('article', `training-card spell-inventory-card${selected ? ' is-in-squad' : ''}${unlocked ? '' : ' is-locked'}`);
    const open = button('spell-card-open', '', 'card-detail'); open.dataset.cardId = id;
    open.append(createGameCard(card, { drawArt: (canvas, cardId) => this.paint(canvas, cardId) }));
    const caption = el('div', 'training-caption');
    const rank = this.state.spellTraining?.[id] || 0;
    if (!unlocked) caption.append(el('span', '', this.page === 'prep' ? '未解锁' : getUnlockLabel(id)));
    else if (this.page !== 'prep' || rank > 0) caption.append(el('span', '', `${rank} 阶 · ${this.modeLabel(this.state.spellModes?.[id])}`));
    if (selected && this.page !== 'prep') caption.append(el('strong', '', '牌组 ×' + this.draftDeck().filter(cardId => cardId === id).length));
    if (this.page === 'prep') {
      wrap.append(open, this.deckCardControls(id));
      if (caption.childElementCount) wrap.append(caption);
    } else wrap.append(open, caption);
    return wrap;
  }

  buildMenuReturn() {
    const back = button('expedition-menu-return', '‹ 主菜单', 'nav');
    back.dataset.page = 'menu';
    back.setAttribute('aria-label', '返回主菜单');
    return back;
  }

  buildHeroDialog() {
    const dialog = el('dialog', 'hero-dialog');
    dialog.setAttribute('aria-label', '选择主将');
    if (!this.heroPickerOpen) return dialog;
    const factionId = this.heroPickerFaction ?? this.faction.id;
    const tabs = el('nav', 'hero-factions'); tabs.setAttribute('aria-label', '阵营');
    for (const faction of FACTIONS) {
      const tab = button('hero-faction', '', 'hero-faction'); tab.dataset.factionId = faction.id;
      tab.setAttribute('aria-pressed', String(faction.id === factionId));
      const crest = el('img'); crest.src = faction.crest; crest.alt = '';
      tab.append(crest, el('span', '', faction.name)); tabs.append(tab);
    }
    const choices = el('div', 'hero-choices');
    for (const id of getFaction(factionId).heroIds) {
      const hero = getHero(id);
      const choice = button(`hero-choice${this.hero.id === id ? ' is-selected' : ''}`, '', 'select-hero');
      choice.dataset.cardId = id; choice.setAttribute('aria-pressed', String(this.hero.id === id));
      const canvas = el('canvas', 'hero-art'); canvas.width = 260; canvas.height = 260; canvas.dataset.cardArt = id;
      this.paint(canvas, id);
      const copy = el('span', 'hero-copy');
      copy.append(el('strong', 'hero-name', hero.name));
      for (const [name, description, label] of [[hero.activeName, hero.activeDescription, '主动 · 1费'], [hero.passiveName, hero.passiveDescription, '被动']]) {
        const skill = el('span', 'hero-skill');
        skill.append(el('b', '', name), el('small', '', label), el('span', '', description)); copy.append(skill);
      }
      choice.append(canvas, copy, el('span', 'hero-select-mark', this.hero.id === id ? '已出战' : '选择'));
      choices.append(choice);
    }
    dialog.append(tabs, choices, button('hero-dialog-close', '返回', 'close-heroes'));
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); this.closeHeroes(); });
    requestAnimationFrame(() => { if (dialog.isConnected && !dialog.open) dialog.showModal(); });
    return dialog;
  }

  closeHeroes() {
    this.heroPickerOpen = false;
    this.pendingFocus = { action: 'heroes' };
    this.render();
  }

  buildCardDialog() {
    const card = CARDS[this.detailCardId];
    if (this.challengeSession) {
      const dialog=el('dialog','expedition-card-dialog challenge-card-dialog');
      if (!card || !this.owns(card.id,card.type==='spell'?'spells':'units')) return dialog;
      const copy=el('div','codex-detail-copy');copy.tabIndex=0;copy.setAttribute('aria-label','卡牌规则');
      const name=el('h2','',card.name); name.id='challenge-card-name';dialog.setAttribute('aria-labelledby',name.id);copy.append(name);
      for(const {label,text} of cardRuleSections(card)){const rule=el('section','codex-detail-rule');if(label)rule.append(el('h3','',label));rule.append(el('p','',text));copy.append(rule);}
      const object=el('div','challenge-card-object');
      object.append(createGameCard(card.type==='spell'?this.spellCard(card.id):card,{drawArt:(canvas,id)=>this.paint(canvas,id)}),this.deckCardControls(card.id));
      dialog.append(button('card-dialog-close','关闭','close-card'),object,copy);
      requestAnimationFrame(()=>{if(dialog.isConnected&&!dialog.open)dialog.showModal();});
      dialog.addEventListener('cancel',event=>{event.preventDefault();this.closeCard();});
      return dialog;
    }
    const canGrow = card && ['unit', 'spell'].includes(card.type) && (!card.faction || card.faction === this.faction.id) && this.owns(card.id, card.type === 'spell' ? 'spells' : 'units');
    const isCodex = this.page === 'codex' && !canGrow;
    const dialog = el('dialog', `expedition-card-dialog${isCodex ? ' is-codex' : ''}`);
    if (this.detailCardId && CARDS[this.detailCardId]) {
      const base = CARDS[this.detailCardId];
      if (isCodex) {
        dialog.setAttribute('aria-labelledby', 'codex-detail-name');
        const copy = el('div', 'codex-detail-copy');
        copy.tabIndex = 0;
        copy.setAttribute('aria-label', '卡牌规则');
        const name = el('h2', '', base.name); name.id = 'codex-detail-name';
        const type = { general: '主将', unit: '随从', spell: '法术' }[base.type];
        copy.append(name, el('p', 'codex-detail-meta', `${getFaction(base.faction)?.name || ''} ${type}${base.cost == null ? '' : `　${base.cost} 费`}`));
        for (const { label, text } of cardRuleSections(base)) {
          const rule = el('section', 'codex-detail-rule');
          if (label) rule.append(el('h3', '', label));
          rule.append(el('p', '', text)); copy.append(rule);
        }
        if (base.type !== 'general') {
          copy.append(el('p', 'inventory-lock-note', this.owns(base.id, base.type === 'spell' ? 'spells' : 'units') ? '已拥有 · 切换对应阵营后可培养' : getUnlockLabel(base.id)));
          if (base.faction && base.faction !== this.faction.id) { const change = button('mission-adjust', '切换阵营并培养', 'collection-faction'); change.dataset.factionId = base.faction; copy.append(change); }
        }
        dialog.append(button('card-dialog-close', '关闭', 'close-card'), createGameCard(base, { drawArt: (canvas, id) => this.paint(canvas, id) }), copy);
        requestAnimationFrame(() => { if (dialog.isConnected && !dialog.open) dialog.showModal(); });
        dialog.addEventListener('cancel', (event) => { event.preventDefault(); this.closeCard(); });
        return dialog;
      }
      if (base.type === 'spell') return this.buildSpellDialog(dialog, base);
      const rank = this.state.training?.[this.detailCardId] ?? 0;
      const bonus = this.progress.getUnitTrainingBonus(this.detailCardId, rank) || { attack: 0, health: 0 };
      const next = rank < 4 ? (this.progress.getUnitTrainingBonus(this.detailCardId, rank + 1) || bonus) : null;
      const trained = trainedCard(base, bonus);
      const note = el('div', 'training-detail');
      note.tabIndex = 0; note.setAttribute('aria-label', '完整效果与专精');
      note.append(el('h2', '', base.name));
      const object = el('div', 'training-object');
      object.tabIndex = 0; object.setAttribute('aria-label', '卡牌与培养');
      const cultivation = el('div', 'training-cultivation');
      const cost = rank < 4 ? Number(TRAINING_COSTS?.[rank] ?? TRAINING_COSTS?.[this.detailCardId]?.[rank] ?? 0) : 0;
      const availability = this.progress.getTrainingAvailability(base.id);
      cultivation.append(this.buildTrainingPurchase(base.id, rank < 4 ? cost : null, 'train', availability));
      const steps = el('div', 'training-steps');
      steps.setAttribute('role', 'img');
      steps.setAttribute('aria-label', `培养 ${rank} / 4 阶`);
      for (let step = 1; step <= 4; step += 1) steps.append(el('i', step <= rank ? 'is-complete' : step === rank + 1 ? 'is-next' : ''));
      cultivation.append(steps);
      const stats = el('div', 'training-stat-comparison');
      for (const [key, label] of [['attack', '攻击'], ['health', '生命']]) {
        const row = el('div', 'training-stat-row');
        const image = el('span', `training-stat-icon is-${key}`); image.setAttribute('aria-hidden', 'true');
        const current = trained[key];
        const following = next ? base[key] + next[key] : current;
        row.setAttribute('aria-label', `${label} ${current}${next ? `，下阶 ${following}` : '，已满阶'}`);
        row.append(image, el('strong', '', current));
        if (next) row.append(el('span', 'training-stat-arrow', '→'), el('strong', following > current ? 'is-improved' : '', following));
        stats.append(row);
      }
      cultivation.append(stats, el('p', 'training-detail-note', next ? '下次出战生效' : '已满阶'));
      note.append(this.buildDetailRules(trained));
      const unlocked = this.owns(base.id, 'units');
      if (availability.growthVersion !== 'legacy-v1') cultivation.append(el('p', 'training-detail-note', '满阶 +1攻击 / +2生命；2阶解锁专精。'));
      if (rank === 1 && availability.growthVersion !== 'legacy-v1') cultivation.append(el('p', 'training-detail-note', '下一阶开放：' + getUnitSpecializations(base.id, availability.growthVersion).map(spec => spec.name).join(' / ') + '，培养后免费选择。'));
      if (!unlocked) cultivation.append(el('p', 'inventory-lock-note', getUnlockLabel(base.id)));
      if (this.page === 'prep') cultivation.append(this.deckCardControls(base.id));
      const specialties = el('div', 'specialization-choices');
      specialties.append(el('h3', '', '专精 · 战前免费切换'));
      const none = button('', '不启用专精', 'specialization'); none.dataset.cardId = base.id; none.dataset.spec = 'none';
      none.disabled = !unlocked; none.setAttribute('aria-pressed', String(this.state.specializations?.[base.id] === 'none')); specialties.append(none);
      for (const spec of getUnitSpecializations(base.id, this.state.growthVersion[base.id])) {
        const choice = button('', `${spec.name} · ${spec.rank} 阶解锁`, 'specialization');
        choice.dataset.cardId = base.id; choice.dataset.spec = spec.id; choice.disabled = !unlocked || rank < spec.rank;
        choice.setAttribute('aria-pressed', String(this.state.specializations?.[base.id] === spec.id));
        choice.append(el('small', '', spec.description)); specialties.append(choice);
      }
      note.append(specialties);
      if (this.dialogError) cultivation.append(el('p', 'training-detail-error', this.dialogError));
      object.append(createGameCard(trained, { drawArt: (canvas, id) => this.paint(canvas, id) }), cultivation);
      dialog.append(button('card-dialog-close', '关闭', 'close-card'), object, note);
      requestAnimationFrame(() => { if (dialog.isConnected && !dialog.open) dialog.showModal(); });
    }
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); this.closeCard(); });
    return dialog;
  }

  buildDetailRules(card) {
    const rules = el('div', 'training-rules');
    for (const { label, text } of cardRuleSections(card)) {
      const rule = el('p');
      const hasLabel = label && !['规则', '法术'].includes(label);
      const prefix = String(text).match(/^([^：:]+)[：:]\s*/);
      // A descriptive effect label already conveys its leading trigger (e.g. 登场强化).
      const copy = hasLabel && prefix && (label === prefix[1] || label.startsWith(prefix[1])) ? String(text).slice(prefix[0].length) : text;
      if (hasLabel) rule.append(el('strong', '', `${label}：`));
      rule.append(document.createTextNode(copy)); rules.append(rule);
    }
    return rules;
  }

  buildTrainingPurchase(id, cost, action, availability, unavailableLabel = '已满阶') {
    const purchase = el('div', 'training-purchase');
    const balance = goldAmount(this.state.coins ?? 0, 'training-balance');
    balance.setAttribute('aria-label', `持有金币 ${this.state.coins ?? 0}`);
    balance.setAttribute('aria-live', 'polite');
    const upgrade = button('training-upgrade', cost == null ? unavailableLabel : '培养', action);
    if (cost != null) upgrade.append(goldAmount(cost));
    upgrade.setAttribute('aria-label', cost == null ? unavailableLabel : `培养，费用 ${cost} 金币`);
    upgrade.dataset.cardId = id; upgrade.disabled = !availability.canTrain;
    purchase.append(balance, upgrade);
    if (availability.reason && (cost != null || unavailableLabel !== '已满阶')) {
      let reason = availability.reason;
      if (reason === '尚未开放此阶培养。' && action === 'train') reason = (NEUTRAL_IDS.includes(id) ? '任一阵营' : getFaction(CARDS[id]?.faction)?.name || '所属阵营') + '完成第' + ({2:3,3:9,4:15}[availability.nextRank] || 0) + '关解锁下一阶。';
      const message = el('p', 'training-detail-note', reason);
      message.id = 'training-purchase-reason'; upgrade.setAttribute('aria-describedby', message.id);
      purchase.append(message);
    }
    return purchase;
  }

  buildSpellDialog(dialog, base) {
    const rank = this.state.spellTraining?.[base.id] || 0;
    const unlocked = this.owns(base.id, 'spells');
    const card = this.spellCard(base.id);
    const note = el('div', 'training-detail spell-training-detail');
    const availability = this.progress.getTrainingAvailability(base.id);
    const policy = getSpellTrainingPolicy(base.id);
    note.tabIndex = 0; note.setAttribute('aria-label', '完整效果与施法模式');
    note.append(el('h2', '', base.name), this.buildDetailRules(card));
    const object = el('div', 'training-object');
    object.tabIndex = 0; object.setAttribute('aria-label', '卡牌与培养');
    const cultivation = el('div', 'training-cultivation');
    cultivation.append(this.buildTrainingPurchase(base.id, policy.trainable && rank < 2 ? SPELL_TRAINING_COSTS[rank] : null, 'train-spell', availability, policy.trainable ? '已满阶' : '不可培养'), ...(policy.trainable ? [el('p', '', `法术培养 ${rank} / 2 阶`)] : []));
    if (!unlocked) cultivation.append(el('p', 'inventory-lock-note', getUnlockLabel(base.id)));
    if (policy.trainable) cultivation.append(el('p', 'training-detail-note', rank < 2 ? (getFaction(base.faction)?.name || '所属阵营') + '第' + (rank === 0 ? 3 : 6) + '关开放此阶；下次出战生效。' : '下次出战生效。'));
    if (this.page === 'prep') cultivation.append(this.deckCardControls(base.id));
    const modes = el('div', 'specialization-choices'); modes.append(el('h3', '', '施法模式 · 战前免费切换'));
    for (const [mode, gate] of [['base', 0], ['power', 1], ['tactical', 2]]) {
      const choice = button('', `${this.modeLabel(mode)}${gate ? ` · ${gate} 阶解锁` : ''}`, 'spell-mode');
      choice.dataset.cardId = base.id; choice.dataset.mode = mode; choice.disabled = !unlocked || rank < gate;
      choice.setAttribute('aria-pressed', String((this.state.spellModes?.[base.id] || 'base') === mode));
      const preview = getSpellUpgrade(base.id, Math.max(gate, rank), mode);
      choice.append(el('small', '', `${preview.cost} 费 · ${preview.description}`)); modes.append(choice);
    }
    if (policy.trainable) note.append(modes);
    if (this.dialogError) cultivation.append(el('p', 'training-detail-error', this.dialogError));
    object.append(createGameCard(card, { drawArt: (canvas, id) => this.paint(canvas, id) }), cultivation);
    dialog.append(button('card-dialog-close', '关闭', 'close-card'), object, note);
    requestAnimationFrame(() => { if (dialog.isConnected && !dialog.open) dialog.showModal(); });
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); this.closeCard(); });
    return dialog;
  }

  closeCard() {
    this.pendingFocus = this.cardReturnFocus;
    this.dialogError = '';
    this.detailCardId = null;
    this.render();
  }

  handleClick(event) {
    if (performance.now() < this.suppressClickUntil) { event.preventDefault(); event.stopPropagation(); return; }
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (target.disabled) return;
    if (this.challengeSession && !['deck-add','deck-remove','deck-default','deck-recommend','deck-undo-recommend','inventory-tab','deck-cost','start','return-mission','card-detail','close-card'].includes(action)) return;
    if (action === 'deck-add' || action === 'deck-remove') {
      const id = Number(target.dataset.cardId), deck = [...this.draftDeck()];
      const count = deck.filter(cardId => cardId === id).length;
      if (action === 'deck-add' && count < MAX_CARD_COPIES && deck.length < PLAYER_DECK_SIZE && this.owns(id, CARDS[id].type === 'spell' ? 'spells' : 'units')) deck.push(id);
      else if (action === 'deck-remove' && count) deck.splice(deck.indexOf(id), 1);
      const result = this.localDecks.set(this.faction.id,deck,this.state.inventory);
      if (result.ok) this.deckDrafts.set(this.faction.id, deck);
      this.deckMessage = result.ok ? '' : result.error; this.render(); return;
    }
    if (action === 'deck-default') {
      try {
        const deck = this.challengeSession ? [...this.challengeSession.initialDeck] : makeStarterDeck(this.hero.id,this.state.inventory);
        const result = this.localDecks.set(this.faction.id,deck,this.state.inventory);
        if (!result.ok) throw new Error(result.error);
        this.deckDrafts.set(this.faction.id,deck); this.deckMessage = '';
      }
      catch (error) { this.deckMessage = error.message; }
      this.render(); return;
    }
    if (action === 'deck-recommend' || action === 'deck-undo-recommend') {
      const factionId = this.faction.id, previous = [...this.draftDeck()];
      this.deckRecommendationUndo ||= new Map();
      try {
        const recommended = action === 'deck-recommend' ? recommendDeck({...this.state, heroId:this.hero.id}) : {ok:true, deck:this.deckRecommendationUndo.get(factionId)};
        if (!recommended.ok) throw new Error(recommended.error);
        if (!recommended.deck) return;
        // Comparing counts avoids replacing an equivalent deck just because its
        // draw order differs. A repeated recommendation can still retry a save.
        const same = [...previous].sort((a,b)=>a-b).join(',') === [...recommended.deck].sort((a,b)=>a-b).join(',');
        if (!same) {
          const result = this.localDecks.set(factionId,recommended.deck,this.state.inventory);
          if (!result.ok) throw new Error(result.error);
          this.deckDrafts.set(factionId,[...recommended.deck]);
          if (action === 'deck-recommend') this.deckRecommendationUndo.set(factionId,previous);
        }
        // Save failures retain both editable draft and undo snapshot. The same
        // action retries persistence without discarding the user's last deck.
        const saved = this.saveLocalDeck();
        if (saved && action === 'deck-undo-recommend') this.deckRecommendationUndo.delete(factionId);
      } catch (error) { this.deckMessage = error.message || String(error); }
      this.render(); return;
    }
    if (action === 'select-faction') {
      const faction = getFaction(Number(target.dataset.factionId));
      const result = this.progress.selectHero(faction.heroIds[0]);
      if (!result.ok) { this.flash(result.error); return; }
      this.chapterId = this.levelId = this.returnMission = null; this.codexFaction = faction.id; this.deckMessage = '';
      this.pendingFocus = { action: 'select-faction', factionId: String(faction.id) }; this.render();
    }
    else if (action === 'heroes') { this.heroPickerOpen = true; this.heroPickerFaction = this.faction.id; this.render(); }
    else if (action === 'close-heroes') this.closeHeroes();
    else if (action === 'hero-faction') { this.heroPickerFaction = Number(target.dataset.factionId); this.render(); }
    else if (action === 'select-hero') {
      const result = this.progress.selectHero(Number(target.dataset.cardId));
      if (!result.ok) { this.flash(result.error); this.closeHeroes(); return; }
      this.detailCardId = null; this.codexFaction = this.faction.id; this.closeHeroes();
    }
    else if (action === 'chapter') {
      this.chapterId = target.dataset.chapterId;
      const chapter = this.chapter();
      this.levelId = chapter?.levelIds?.find((id) => this.progress?.isUnlocked?.(id) && !this.completed(id))
        || chapter?.levelIds?.find((id) => this.progress?.isUnlocked?.(id)) || chapter?.levelIds?.[0] || null;
      this.render();
    }
    else if (action === 'back') { this.chapterId = null; this.levelId = null; this.render(); }
    else if (action === 'level') { this.levelId = target.dataset.levelId; this.render(); }
    else if (action === 'start') {
      if (!this.returnMission || !validatePlayerDeck(this.draftDeck(), this.hero.id, this.state.inventory)) {
        this.signalIncompleteDeck(); return;
      }
      if (!this.saveLocalDeck()) return;
      if (this.challengeSession) {
        this.root.querySelector('dialog[open]')?.close();
        this.challengeSession.onStart({deck:[...this.draftDeck()],challengeId:this.challengeSession.challengeId});
        return;
      }
      const result = this.progress.setBattleDeck([...this.draftDeck()]);
      if (!result.ok) { this.deckMessage = result.error; this.render(); return; }
      this.root.querySelector('dialog[open]')?.close();
      this.onStart(target.dataset.levelId);
    }
    else if (action === 'resume') this.onResume(this.state.activeBattle);
    else if (action === 'cloud') this.onCloud();
    else if (action === 'battle-rules') document.dispatchEvent(new CustomEvent('open-battle-rules'));
    else if (action === 'ad-self-test') this.onAdSelfTest();
    else if (action === 'audio-settings') this.onAudioSettings(target);
    else if (action === 'music-toggle') this.onMusicToggle(event);
    else if (action === 'recruitment') this.onRecruitment();
    else if (action === 'leaderboard') this.onLeaderboard(target);
    else if (action === 'achievements') this.onAchievements(target);
    else if (action === 'resource-rewards') this.onResourceRewards();
    else if (action === 'trial-group') {
      this.trialGroupId = target.dataset.groupId;
      this.pendingFocus = { action: 'trial-group', groupId: this.trialGroupId };
      this.render();
    }
    else if (action === 'trial-intro') {
      this.trialGroupId = 'basics';
      this.navigate('trials', target);
    }
    else if (action === 'trial') this.trials.start(target.dataset.levelId);
    else if (action === 'trial-cloud') this.trials.resumeCloud();
    else if (action === 'trial-sync') this.trials.sync();
    else if (action === 'slot') {
      if (this.keyboardDrag) this.dropCard(this.keyboardDrag.cardId, Number(target.dataset.slot), this.keyboardDrag.sourceSlot);
      else { this.cardReturnFocus = { action: 'slot', slot: target.dataset.slot, cardId: target.dataset.cardId }; this.dialogError = ''; this.detailCardId = Number(target.dataset.cardId); this.render(); }
    }
    else if (action === 'train') this.train(Number(target.dataset.cardId));
    else if (action === 'inventory-tab') { this.inventoryTab = target.dataset.tab; this.render(); }
    else if (action === 'deck-show-unowned') { this.deckShowUnowned = !this.deckShowUnowned; this.render(); }
    else if (action === 'deck-cost') { this.deckSelectedCost = toggleDeckCost(this.deckSelectedCost, Number(target.dataset.cost)); this.render(); }
    else if (action === 'collection-scope') { this.collectionScope = target.dataset.scope; this.render(); }
    else if (action === 'collection-faction') { const result = this.progress.selectHero(getFaction(Number(target.dataset.factionId)).heroIds[0]); if (!result.ok) this.dialogError = result.error; this.codexFaction = this.faction.id; this.render(); }
    else if (action === 'adjust-loadout') { this.returnMission = target.dataset.levelId; this.navigate('prep'); }
    else if (action === 'return-mission') {
      if (this.challengeSession) { this.challengeSession.onExit(); return; }
      if (!this.saveLocalDeck()) return;
      const level = EXPEDITION_LEVELS.find((item) => item.id === this.returnMission);
      this.chapterId = level?.chapterId; this.levelId = level?.id; this.navigate('expedition');
    }
    else if (action === 'choose-unit') {
      const squad = this.squadAfterDrop(Number(target.dataset.cardId), Number(target.dataset.slot));
      this.profileAction(this.progress.setSquad(squad));
    }
    else if (action === 'choose-spell') {
      const spells = [...this.selectedSpells()], id = Number(target.dataset.cardId), slot = Number(target.dataset.slot);
      const old = spells.indexOf(id);
      if (old >= 0) [spells[slot], spells[old]] = [spells[old], spells[slot]]; else spells[slot] = id;
      this.profileAction(this.progress.setSpells(spells));
    }
    else if (action === 'train-spell') this.profileAction(this.progress.trainSpell(Number(target.dataset.cardId)));
    else if (action === 'spell-mode') this.profileAction(this.progress.setSpellMode(Number(target.dataset.cardId), target.dataset.mode));
    else if (action === 'specialization') this.profileAction(this.progress.setSpecialization(Number(target.dataset.cardId), target.dataset.spec));
    else if (action === 'card-detail') { this.cardReturnFocus = { action: 'card-detail', cardId: target.dataset.cardId }; this.dialogError = ''; this.detailCardId = Number(target.dataset.cardId); this.render(); }
    else if (action === 'close-card') this.closeCard();
    else if (action === 'codex-faction') {
      this.codexFaction = Number(target.dataset.factionId);
      this.detailCardId = null;
      this.render();
      requestAnimationFrame(() => { const rail = $(this.root, '.expedition-codex-rail'); if (rail) rail.scrollTop = 0; });
    }
    else if (action === 'codex-filter') {
      this.codexFilter = target.dataset.filter || 'all';
      this.detailCardId = null;
      this.render();
      requestAnimationFrame(() => { const rail = $(this.root, '.expedition-codex-rail'); if (rail) rail.scrollTop = 0; });
    }
    else if (action === 'nav') this.navigate(target.dataset.page, target);
  }

  handlePointerDown(event) {
    if (this.page === 'codex' && event.isPrimary && event.button === 0 && event.target.closest('.expedition-codex-card')) {
      this.codexPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      return;
    }
    if (!event.isPrimary || event.button !== 0 || this.pointerDrag || this.page !== 'barracks' || this.deckDrafts) return;
    const source = event.target.closest('.training-card-open[data-card-id], .squad-slot[data-card-id]');
    if (!source || !this.root.contains(source) || source.dataset.locked === 'true') return;
    const sourceSlot = source.matches('.squad-slot') ? Number(source.dataset.slot) : null;
    this.pointerDrag = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      source,
      cardId: Number(source.dataset.cardId),
      sourceSlot,
      x: event.clientX,
      y: event.clientY,
      active: false,
      roster: source.matches('.training-card-open')
    };
    source.setPointerCapture?.(event.pointerId);
  }

  handlePointerMove(event) {
    const codex = this.codexPointer;
    if (codex?.id === event.pointerId && Math.hypot(event.clientX - codex.x, event.clientY - codex.y) > 9) {
      this.suppressClickUntil = performance.now() + 450;
      codex.moved = true;
    }
    const drag = this.pointerDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.active) {
      if (Math.hypot(dx, dy) < 9) return;
      if (drag.roster && drag.pointerType === 'touch' && Math.abs(dx) > Math.abs(dy)) { this.cancelPointerDrag(event); return; }
      this.startPointerDrag(event);
    }
    event.preventDefault();
    this.moveDragGhost(event.clientX, event.clientY);
    this.markDropTarget(this.slotAtPoint(event.clientX, event.clientY));
  }

  startPointerDrag(event) {
    const drag = this.pointerDrag;
    if (!drag) return;
    drag.active = true;
    this.stopIdle();
    const ghost = drag.source.cloneNode(true);
    ghost.className = 'squad-drag-ghost';
    ghost.removeAttribute('id');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.querySelectorAll('canvas').forEach((canvas, index) => {
      const original = drag.source.querySelectorAll('canvas')[index];
      if (!original) return;
      canvas.width = original.width;
      canvas.height = original.height;
      try { canvas.getContext('2d')?.drawImage(original, 0, 0); } catch (_) {}
    });
    document.body.append(ghost);
    drag.ghost = ghost;
    const sourceRect = drag.source.getBoundingClientRect();
    const ghostRect = ghost.getBoundingClientRect();
    drag.ghostWidth = ghostRect.width || Math.min(104, sourceRect.width) || 104;
    drag.ghostHeight = ghostRect.height || (sourceRect.height * drag.ghostWidth / Math.max(1, sourceRect.width)) || 144;
    this.moveDragGhost(event.clientX, event.clientY);
    drag.source.classList.add('squad-drag-source');
  }

  moveDragGhost(x, y) {
    const ghost = this.pointerDrag?.ghost;
    if (!ghost) return;
    ghost.style.position = 'fixed';
    const width = this.pointerDrag.ghostWidth || 104;
    const height = this.pointerDrag.ghostHeight || 144;
    ghost.style.left = `${Math.max(4, Math.min(innerWidth - width - 4, x - width / 2))}px`;
    ghost.style.top = `${Math.max(4, y - height + 20)}px`;
    ghost.style.pointerEvents = 'none';
  }

  slotAtPoint(x, y) {
    return document.elementsFromPoint(x, y).map((node) => node.closest?.('.squad-slot[data-slot]')).find((node) => node && this.root.contains(node)) || null;
  }

  markDropTarget(target) {
    const drag = this.pointerDrag;
    all(this.root, '.squad-slot').forEach((slot) => slot.classList.remove('is-drop-valid', 'is-drop-invalid', 'is-drop-over'));
    if (!drag || !target) return;
    const candidate = this.squadAfterDrop(drag.cardId, Number(target.dataset.slot), drag.sourceSlot);
    const valid = deploymentCost(candidate) <= DEPLOYMENT_BUDGET;
    target.classList.add(valid ? 'is-drop-valid' : 'is-drop-invalid', 'is-drop-over');
  }

  handlePointerEnd(event) {
    if (this.codexPointer?.id === event.pointerId) {
      if (this.codexPointer.moved) this.suppressClickUntil = performance.now() + 450;
      this.codexPointer = null;
    }
    const drag = this.pointerDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const active = drag.active;
    const target = active ? this.slotAtPoint(event.clientX, event.clientY) : null;
    const cardId = drag.cardId;
    const sourceSlot = drag.sourceSlot;
    this.cancelPointerDrag(event);
    if (!active) return;
    event.preventDefault();
    this.suppressClickUntil = performance.now() + 450;
    if (target) this.dropCard(cardId, Number(target.dataset.slot), sourceSlot);
  }

  cancelPointerDrag(event) {
    if (this.codexPointer && (!event || this.codexPointer.id === event.pointerId)) {
      if (this.codexPointer.moved) this.suppressClickUntil = performance.now() + 450;
      this.codexPointer = null;
    }
    const drag = this.pointerDrag;
    if (!drag || (event?.pointerId != null && drag.pointerId !== event.pointerId)) return;
    if (drag.active) this.suppressClickUntil = performance.now() + 450;
    drag.ghost?.remove();
    drag.source?.classList.remove('squad-drag-source');
    all(this.root, '.squad-slot').forEach((slot) => slot.classList.remove('is-drop-valid', 'is-drop-invalid', 'is-drop-over'));
    if (drag.source?.hasPointerCapture?.(drag.pointerId)) drag.source.releasePointerCapture(drag.pointerId);
    this.pointerDrag = null;
    this.syncIdle();
  }

  cancelDrag(message = '') {
    this.cancelPointerDrag();
    if (this.keyboardDrag) {
      this.clearKeyboardDrag();
      this.announce(message || '已取消编队。');
    }
  }

  handleKeyDown(event) {
    if (event.key === 'Tab') {
      const dialog = event.target.closest('dialog[open]');
      if (dialog) {
        const choices = [...dialog.querySelectorAll('button:not(:disabled), [tabindex="0"]')].filter((node) => node.getClientRects().length);
        const index = choices.indexOf(document.activeElement);
        if (choices.length && ((!event.shiftKey && index === choices.length - 1) || (event.shiftKey && index === 0))) {
          event.preventDefault(); choices[event.shiftKey ? choices.length - 1 : 0].focus(); return;
        }
      }
    }
    if (event.key === 'Escape' && (this.pointerDrag || this.keyboardDrag)) {
      event.preventDefault();
      this.cancelDrag();
      return;
    }
    if (event.key === 'Tab' && this.keyboardDrag) {
      const slots = all(this.root, '.squad-slot[data-slot]');
      if (!slots.length) return;
      event.preventDefault();
      const current = slots.indexOf(document.activeElement);
      const step = event.shiftKey ? -1 : 1;
      slots[(current + step + slots.length) % slots.length].focus();
      return;
    }
    if (event.key !== ' ' && event.key !== 'Enter') return;
    if (this.deckDrafts) return;
    const source = event.target.closest('.training-card-open[data-card-id], .squad-slot[data-card-id]');
    if (!source || source.dataset.locked === 'true') return;
    if (this.keyboardDrag && source.matches('.squad-slot')) {
      event.preventDefault();
      this.dropCard(this.keyboardDrag.cardId, Number(source.dataset.slot), this.keyboardDrag.sourceSlot);
      return;
    }
    if (event.key === ' ' && !this.keyboardDrag) {
      event.preventDefault();
      this.keyboardDrag = {
        cardId: Number(source.dataset.cardId),
        sourceSlot: source.matches('.squad-slot') ? Number(source.dataset.slot) : null,
        source
      };
      source.classList.add('is-keyboard-dragging');
      this.announce(`已拿起${CARDS[this.keyboardDrag.cardId]?.name || '单位'}。按 Tab 选择编队位置，再按 Enter 或空格放置。`);
    }
  }

  squadAfterDrop(id, slot, sourceSlot = null) {
    const squad = this.validSquad();
    const existing = sourceSlot == null ? squad.indexOf(id) : sourceSlot;
    if (existing === slot) return squad;
    if (existing >= 0) [squad[slot], squad[existing]] = [squad[existing], squad[slot]];
    else squad[slot] = id;
    return squad;
  }

  dropCard(id, slot, sourceSlot = null) {
    const squad = this.squadAfterDrop(id, slot, sourceSlot);
    const name = CARDS[id]?.name || '单位';
    this.clearKeyboardDrag();
    const result = this.progress?.setSquad?.(squad);
    if (result?.ok === false) {
      const fallback = deploymentCost(squad) > DEPLOYMENT_BUDGET ? '开局费用超出上限，无法调整编队。' : '无法调整出征队伍。';
      this.announce(result.error || fallback);
      this.flash(result.error || fallback);
      this.refresh();
      return;
    }
    this.pendingFocus = { action: 'slot', slot: String(slot) };
    this.announce(`${name}已放入${slot === 0 ? '前锋' : slot === 1 ? '护卫' : '援军'}。`);
    this.refresh();
  }

  announce(message) {
    this.liveMessage = message;
    const live = $(this.root, '.barracks-live');
    if (live) live.textContent = message;
  }

  clearKeyboardDrag() {
    this.keyboardDrag?.source?.classList.remove('is-keyboard-dragging');
    all(this.root, '.is-keyboard-dragging').forEach((node) => node.classList.remove('is-keyboard-dragging'));
    this.keyboardDrag = null;
  }

  navigate(page, source = document.activeElement) {
    if (page === 'barracks') page = 'prep';
    if (!['menu', 'expedition', 'prep', 'codex', 'trials'].includes(page)) return;
    if (this.page === 'menu' && page !== 'menu') {
      this.menuReturnFocus = source && this.root.contains(source) && source.dataset.action
        ? { action: source.dataset.action, page: source.dataset.page }
        : { action: 'nav', page };
    }
    this.cancelDrag();
    this.detailCardId = null;
    this.heroPickerOpen = false;
    this.dialogError = '';
    this.page = page;
    this.pendingFocus = page === 'menu' ? this.menuReturnFocus || { action: 'nav', page: 'expedition' } : { action: 'nav', page: 'menu' };
    this.render();
  }

  train(id) {
    this.pendingFocus = { action: 'train', cardId: String(id) };
    const result = this.progress?.train?.(id);
    if (result?.ok === false) {
      const shortfall = result.error === '金币不足。' ? '金币不足。重复挑战已通关关卡可继续获得金币。' : result.error;
      this.dialogError = shortfall || '无法培养该单位。';
    } else {
      this.dialogError = '';
    }
    this.refresh();
  }

  profileAction(result) {
    this.dialogError = result?.ok === false ? result.error || '调整失败。' : '';
    this.refresh();
  }

  flash(message) {
    this.notice = message;
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => { this.notice = ''; this.render(); }, 2600);
  }

  validSquad() {
    const stateSquad = Array.isArray(this.state.squad) ? this.state.squad : [];
    const unique = [...new Set(stateSquad)].filter((id) => (this.faction.unitIds.includes(id) || NEUTRAL_IDS.includes(id)) && this.owns(id, 'units')).slice(0, 3);
    for (const id of this.faction.defaultSquad) if (unique.length < 3 && !unique.includes(id)) unique.push(id);
    return unique;
  }

  chapter() { return EXPEDITION_CHAPTERS.find((chapter) => chapter.id === this.chapterId); }
  completed(id) { return this.factionProgress().completed.includes(id); }

  paint(canvas, id) {
    try { const result = this.drawCardArt(canvas, id); if (result?.catch) result.catch(() => {}); } catch (_) {}
  }

  syncIdle() {
    this.stopIdle();
    if (this.root.hidden || document.hidden || this.pointerDrag?.active || this.reducedMotion.matches || !this.root.isConnected) return;
    this.tickIdle();
  }

  tickIdle() {
    if (this.root.hidden || document.hidden || this.pointerDrag?.active || this.reducedMotion.matches || !this.root.isConnected) return;
    let next = Infinity;
    const now = performance.now();
    const openDialog = $(this.root, 'dialog[open]');
    // Native modal contents live in the top layer, outside the observer root's clipping.
    const canvases = openDialog ? all(openDialog, 'canvas[data-card-art]') : [...this.idleCanvases];
    for (const canvas of canvases) {
      if (!canvas.isConnected) { this.idleCanvases.delete(canvas); continue; }
      if (openDialog && !openDialog.contains(canvas)) continue;
      const delay = this.drawCardIdle(canvas, Number(canvas.dataset.cardArt), now);
      if (delay > 0) next = Math.min(next, delay);
    }
    if (Number.isFinite(next)) this.idleTimer = setTimeout(() => this.tickIdle(), Math.max(16, Math.ceil(next)));
  }

  stopIdle() { clearTimeout(this.idleTimer); this.idleTimer = 0; }
}
