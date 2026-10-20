import { buildCampaignAtlas } from './campaign-atlas.js';
import { SESSION_HOME_BACKGROUND } from './home-background.js';
import { findGiftCode } from './gift-codes.js';
import { LocalDecks } from './local-decks.js';
import { DECK_COST_FILTERS, toggleDeckCost, matchesDeckInventory } from './deck-filters.js';
import { recommendDeck } from './deck-recommendation.js';
import { createGameCard } from './game-card.js';
import { CARDS } from './cards.js';
import { cardRuleSections } from './card-rules.js';
import { FACTIONS, getFaction, getHero } from './factions.js';
import { NEUTRAL_IDS, CAMPAIGN_UNIT_IDS, SPELL_IDS, getUnlockLabel } from './campaign-rules.js';
import { shopCatalog } from './shop.js';
import { getEnemyPlan } from './enemy-plans.js';
import { makeStarterDeck, validatePlayerDeck, PLAYER_DECK_SIZE, MAX_CARD_COPIES } from './battle-deck.js';
import { EXPEDITION_CHAPTERS, EXPEDITION_LEVELS } from './expedition-data.js';

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

export class ExpeditionUI {
  constructor({ root, progress, drawCardArt, drawCardIdle, onStart, onResume, onCloud, onResourceRewards, onAudioSettings, onMusicToggle, musicPreferences, onLeaderboard, onAchievements }) {
    this.root = root;
    this.progress = progress;
    this.drawCardArt = typeof drawCardArt === 'function' ? drawCardArt : () => {};
    this.drawCardIdle = typeof drawCardIdle === 'function' ? drawCardIdle : () => 0;
    this.onStart = typeof onStart === 'function' ? onStart : () => {};
    this.onResume = typeof onResume === 'function' ? onResume : () => {};
    this.onCloud = onCloud || (() => {});
    this.onResourceRewards = onResourceRewards || (() => {});
    this.onLeaderboard = onLeaderboard || (() => {});
    this.onAchievements = onAchievements || (() => {});
    this.onAudioSettings=onAudioSettings||(()=>{});this.onMusicToggle=onMusicToggle||(()=>{});this.musicPreferences=musicPreferences||(()=>({muted:true,volume:0}));
    this.page = 'menu';
    this.codexFilter = 'all';
    this.chapterId = null;
    this.levelId = null;
    this.detailCardId = null;
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
    this.root.addEventListener('pointercancel', (event) => this.handlePointerEnd(event));
    this.root.addEventListener('keydown', (event) => this.handleKeyDown(event));
    this.root.addEventListener('scroll', () => this.syncIdle(), { passive: true, capture: true });
    document.addEventListener('visibilitychange', () => this.syncIdle());
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

  get state() { return this.progress?.state || {}; }
  get hero() { return getHero(this.state.selectedHeroId ?? 1); }
  get faction() { return getFaction(this.hero.faction); }

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
    this.handlePointerEnd();
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
    this.handlePointerEnd();
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
    this.root.dataset.inlineChrome = String(this.page === 'prep' || (this.page === 'expedition' && Boolean(this.chapterId)));
    this.root.replaceChildren(this.buildTopbar(), this.buildStage(), this.buildCardDialog(), this.buildHeroDialog());
    requestAnimationFrame(() => {
      for (const [selector, position] of Object.entries(scrollState)) {
        const track = $(this.root, selector);
        if (track) {
          if (selector === '.atlas-chapters') {
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
    bar.hidden = this.page === 'menu' || this.page === 'codex' || this.page === 'shop' || this.page === 'prep' || (this.page === 'expedition' && Boolean(this.chapterId));
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
    else if (this.page === 'shop') main.append(this.buildShop());
    else if (this.chapterId) main.append(this.buildChapter());
    else main.append(this.buildChapterHome());
    if (this.notice) main.append(el('p', 'expedition-notice', this.notice));
    const error = this.progress?.error;
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
    supply.setAttribute('aria-label', '每日补给，观看广告领取金币');
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
    journeys.append(play);
    const links = el('nav', 'menu-destinations');
    const collection = button('menu-destination', '收藏', 'nav'); collection.dataset.page = 'codex'; links.append(collection);
    const shop = button('menu-destination', '军需', 'nav'); shop.dataset.page = 'shop'; links.append(shop);
    links.append(button('menu-destination', '排行', 'leaderboard'), button('menu-destination', '成就', 'achievements'));
    selected.append(story, emblem, journeys, links);
    view.append(resources, factions, selected); return view;
  }

  setMusicControl(target){const p=this.musicPreferences(),silent=p.muted||p.volume===0;target.setAttribute('aria-pressed',String(!silent));target.setAttribute('aria-label',silent?'开启主菜单音乐':'静音主菜单音乐');target.title=silent?'音乐：静音':'音乐：有声';target.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 8h4l6-5v18l-6-5H3z"/>${silent?'<path fill="currentColor" d="m17 7 2 3 2-3 2 2-3 3 3 3-2 2-2-3-2 3-2-2 3-3-3-3z"/>':'<path fill="currentColor" d="M15 7v3a3 3 0 0 1 0 4v3a6 6 0 0 0 0-10M18 3v3a8 8 0 0 1 0 12v3a11 11 0 0 0 0-18"/>'}</svg>`;}
  refreshMusicControl(){for(const target of this.root.querySelectorAll('[data-action="music-toggle"]'))this.setMusicControl(target);}

  buildChapterHome() { return buildCampaignAtlas(this); }

  buildChapter() { return buildCampaignAtlas(this); }

  buildMission(level) {
    const panel = el('aside', 'mission-preview');
    if (!level) return panel;
    const plan = getEnemyPlan(level.id);
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
    const payout = this.progress.rewardPreview(level.id);
    rewards.append(el('div', '', `${payout.firstClear ? '首通奖励' : '再次挑战'}：${payout.coins} 金币`));
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
        return `${card?.name || id}${stats ? `（${stats.cost}费 ${stats.attack}/${stats.health}）` : ''} ×${count}`;
      }).join('、')));
    }
    const unlockNames = [...payout.units, ...payout.spells].filter((id) => CARDS[id]?.faction === this.faction.id || NEUTRAL_IDS.includes(id)).map((id) => CARDS[id]?.name || String(id));
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

  battleDeck() { return this.state.decks?.[this.faction.id] || this.progress.getBattleLoadout().deck; }

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
    const deck = this.draftDeck(), editor = el('aside', 'deck-editor');
    const valid = validatePlayerDeck(deck, this.hero.id, this.state.inventory);
    const heading = el('div', 'deck-heading');
    const back = button('inline-return', '‹ 关卡', 'return-mission'); back.setAttribute('aria-label', '返回关卡情报');
    heading.setAttribute('aria-label', '出战牌组');
    const total = el('strong', `deck-total${deck.length < PLAYER_DECK_SIZE ? ' is-incomplete' : ''}`, deck.length + '/30');
    total.setAttribute('role', 'status'); total.setAttribute('aria-live', 'polite'); total.setAttribute('aria-atomic', 'true');
    heading.append(back, total);
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
    tabs.append(ownership);
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
      roster.append(spells ? this.buildSpellCard(id) : this.buildTrainingCard(id));
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
      open.append(createGameCard(card, { drawArt: (canvas, cardId) => this.paint(canvas, cardId), presentation: 'collection' }));
      if (card.type !== 'general') {
        open.append(el('small', 'collection-card-status', this.owns(card.id, card.type === 'spell' ? 'spells' : 'units') ? '已拥有' : getUnlockLabel(card.id)));
      }
      rail.append(open);
    });
    section.append(filters, rail);
    return section;
  }

  buildShop() {
    const section = el('section', 'expedition-codex expedition-shop');
    const filters = el('aside', 'expedition-codex-filters');
    const balance = goldAmount(this.state.coins ?? 0, 'shop-balance');
    balance.setAttribute('aria-label', `持有金币 ${this.state.coins ?? 0}`);
    balance.setAttribute('aria-live', 'polite');
    const tab = this.shopTab || 'faction';
    const tabs = el('nav', 'codex-types'); tabs.setAttribute('aria-label', '军需分类');
    for (const [id, label] of [['faction', this.faction.name], ['neutral', '中立'], ['all', '全部']]) {
      const choice = button('', label, 'shop-tab'); choice.dataset.tab = id;
      choice.setAttribute('aria-pressed', String(tab === id)); tabs.append(choice);
    }
    filters.append(this.buildMenuReturn(), balance, tabs);
    const rail = el('div', 'expedition-codex-rail shop-rail');
    rail.tabIndex = 0;
    rail.setAttribute('aria-label', '军需卡牌');
    const offers = shopCatalog(this.state.inventory).filter(({ id }) => tab === 'all' || (tab === 'neutral' ? NEUTRAL_IDS.includes(id) : CARDS[id].faction === this.faction.id));
    for (const { id } of offers) {
      const item = el('article', 'shop-card');
      const open = button('expedition-codex-card', '', 'card-detail');
      open.dataset.cardId = id;
      open.setAttribute('aria-label', `查看${CARDS[id].name}详情`);
      open.append(createGameCard(CARDS[id], { drawArt: (canvas, cardId) => this.paint(canvas, cardId), presentation: 'collection' }));
      item.append(open, this.buyButton(id));
      rail.append(item);
    }
    if (!offers.length) rail.append(el('p', 'deck-inventory-empty', '这一类卡牌已全部拥有'));
    section.append(filters, rail);
    return section;
  }

  buildTrainingCard(id) {
    const base = CARDS[id] || { id, name: `单位 ${id}`, type: 'unit', attack: 0, health: 0, description: '' };
    const unlocked = this.owns(id, 'units');
    const wrap = el('article', `training-card${this.draftDeck().includes(id) ? ' is-in-squad' : ''}${unlocked ? '' : ' is-locked'}`);
    const open = button('training-card-open', '', 'card-detail'); open.dataset.cardId = id;
    open.setAttribute('aria-label', `查看${base.name}详情`);
    open.append(createGameCard(base, { drawArt: (canvas, cardId) => this.paint(canvas, cardId) }));
    wrap.append(open, this.deckCardControls(id));
    if (!unlocked) { const caption = el('div', 'training-caption'); caption.append(el('span', '', '未拥有')); wrap.append(caption); }
    return wrap;
  }

  owns(id, type) { return (this.state.inventory?.[type] || []).includes(id); }

  spellCard(id) { return CARDS[id]; }

  buildSpellCard(id) {
    const card = this.spellCard(id), unlocked = this.owns(id, 'spells');
    const selected = this.draftDeck().includes(id);
    const wrap = el('article', `training-card spell-inventory-card${selected ? ' is-in-squad' : ''}${unlocked ? '' : ' is-locked'}`);
    const open = button('spell-card-open', '', 'card-detail'); open.dataset.cardId = id;
    open.append(createGameCard(card, { drawArt: (canvas, cardId) => this.paint(canvas, cardId) }));
    wrap.append(open, this.deckCardControls(id));
    if (!unlocked) { const caption = el('div', 'training-caption'); caption.append(el('span', '', '未拥有')); wrap.append(caption); }
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
    const base = CARDS[this.detailCardId];
    const dialog = el('dialog', 'expedition-card-dialog is-codex');
    if (!base) return dialog;
    dialog.setAttribute('aria-labelledby', 'codex-detail-name');
    const copy = el('div', 'codex-detail-copy');
    copy.tabIndex = 0;
    copy.setAttribute('aria-label', '卡牌规则');
    const name = el('h2', '', base.name); name.id = 'codex-detail-name';
    const type = { general: '主将', unit: '随从', spell: '法术' }[base.type];
    copy.append(name, el('p', 'codex-detail-meta', `${getFaction(base.faction)?.name || '中立'} ${type}${base.cost == null ? '' : `　${base.cost} 费`}`));
    for (const { label, text } of cardRuleSections(base)) {
      const rule = el('section', 'codex-detail-rule');
      if (label) rule.append(el('h3', '', label));
      rule.append(el('p', '', text)); copy.append(rule);
    }
    if (base.type !== 'general') {
      const owned = this.owns(base.id, base.type === 'spell' ? 'spells' : 'units');
      const playable = NEUTRAL_IDS.includes(base.id) || base.faction === this.faction.id;
      if (owned && this.page === 'prep' && playable) copy.append(this.deckCardControls(base.id));
      else if (owned) copy.append(el('p', 'inventory-lock-note', playable ? '已拥有' : `已拥有 · ${getFaction(base.faction)?.name}可用`));
      else copy.append(el('p', 'inventory-lock-note', getUnlockLabel(base.id)), this.buyButton(base.id));
    }
    if (this.dialogError) copy.append(el('p', 'training-detail-error', this.dialogError));
    dialog.append(button('card-dialog-close', '关闭', 'close-card'), createGameCard(base, { drawArt: (canvas, id) => this.paint(canvas, id) }), copy);
    requestAnimationFrame(() => { if (dialog.isConnected && !dialog.open) dialog.showModal(); });
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); this.closeCard(); });
    return dialog;
  }

  buyButton(id) {
    const offer = this.progress.shopOffer(id);
    const buy = button('shop-buy', offer.owned ? '已拥有' : '购买', 'buy-card');
    buy.dataset.cardId = id;
    if (offer.price != null && !offer.owned) buy.append(goldAmount(offer.price));
    buy.disabled = !offer.eligible;
    buy.setAttribute('aria-label', offer.owned ? '已拥有' : offer.price == null ? offer.reason : `购买，${offer.price} 金币${offer.reason ? `，${offer.reason}` : ''}`);
    return buy;
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
        const deck = makeStarterDeck(this.hero.id,this.state.inventory);
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
      const result = this.progress.setBattleDeck([...this.draftDeck()]);
      if (!result.ok) { this.deckMessage = result.error; this.render(); return; }
      this.root.querySelector('dialog[open]')?.close();
      this.onStart(target.dataset.levelId);
    }
    else if (action === 'resume') this.onResume(this.state.activeBattle);
    else if (action === 'cloud') this.onCloud();
    else if (action === 'battle-rules') document.dispatchEvent(new CustomEvent('open-battle-rules'));
    else if (action === 'audio-settings') this.onAudioSettings(target);
    else if (action === 'music-toggle') this.onMusicToggle(event);
    else if (action === 'leaderboard') this.onLeaderboard(target);
    else if (action === 'achievements') this.onAchievements(target);
    else if (action === 'resource-rewards') this.onResourceRewards();
    else if (action === 'inventory-tab') { this.inventoryTab = target.dataset.tab; this.render(); }
    else if (action === 'deck-show-unowned') { this.deckShowUnowned = !this.deckShowUnowned; this.render(); }
    else if (action === 'deck-cost') { this.deckSelectedCost = toggleDeckCost(this.deckSelectedCost, Number(target.dataset.cost)); this.render(); }
    else if (action === 'collection-scope') { this.collectionScope = target.dataset.scope; this.render(); }
    else if (action === 'collection-faction') { const result = this.progress.selectHero(getFaction(Number(target.dataset.factionId)).heroIds[0]); if (!result.ok) this.dialogError = result.error; this.codexFaction = this.faction.id; this.render(); }
    else if (action === 'adjust-loadout') { this.returnMission = target.dataset.levelId; this.navigate('prep'); }
    else if (action === 'return-mission') {
      if (!this.saveLocalDeck()) return;
      const level = EXPEDITION_LEVELS.find((item) => item.id === this.returnMission);
      this.chapterId = level?.chapterId; this.levelId = level?.id; this.navigate('expedition');
    }
    else if (action === 'buy-card') {
      const id = Number(target.dataset.cardId), result = this.progress.buyCard(id);
      this.dialogError = result.ok ? '' : result.error;
      this.flash(result.ok ? `已购入${CARDS[id].name}` : result.error);
      this.pendingFocus = { action: this.detailCardId ? 'close-card' : 'nav', page: 'menu' };
      this.render();
    }
    else if (action === 'shop-tab') { this.shopTab = target.dataset.tab; this.render(); }
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

  // Card rails scroll by touch; a drag that moved must not open the card it started on.
  handlePointerDown(event) {
    if (event.isPrimary && event.button === 0 && event.target.closest('.expedition-codex-card, .shop-card')) this.codexPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  handlePointerMove(event) {
    const codex = this.codexPointer;
    if (codex?.id === event.pointerId && Math.hypot(event.clientX - codex.x, event.clientY - codex.y) > 9) {
      this.suppressClickUntil = performance.now() + 450;
      codex.moved = true;
    }
  }

  handlePointerEnd(event) {
    if (this.codexPointer && (!event || this.codexPointer.id === event.pointerId)) {
      if (this.codexPointer.moved) this.suppressClickUntil = performance.now() + 450;
      this.codexPointer = null;
    }
  }

  handleKeyDown(event) {
    if (event.key !== 'Tab') return;
    const dialog = event.target.closest('dialog[open]');
    if (!dialog) return;
    const choices = [...dialog.querySelectorAll('button:not(:disabled), [tabindex="0"]')].filter((node) => node.getClientRects().length);
    const index = choices.indexOf(document.activeElement);
    if (choices.length && ((!event.shiftKey && index === choices.length - 1) || (event.shiftKey && index === 0))) {
      event.preventDefault(); choices[event.shiftKey ? choices.length - 1 : 0].focus();
    }
  }

  navigate(page, source = document.activeElement) {
    if (!['menu', 'expedition', 'prep', 'codex', 'shop'].includes(page)) return;
    if (this.page === 'menu' && page !== 'menu') {
      this.menuReturnFocus = source && this.root.contains(source) && source.dataset.action
        ? { action: source.dataset.action, page: source.dataset.page }
        : { action: 'nav', page };
    }
    this.handlePointerEnd();
    this.detailCardId = null;
    this.heroPickerOpen = false;
    this.dialogError = '';
    this.page = page;
    this.pendingFocus = page === 'menu' ? this.menuReturnFocus || { action: 'nav', page: 'expedition' } : { action: 'nav', page: 'menu' };
    this.render();
  }

  flash(message) {
    this.notice = message;
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => { this.notice = ''; this.render(); }, 2600);
  }

  chapter() { return EXPEDITION_CHAPTERS.find((chapter) => chapter.id === this.chapterId); }
  completed(id) { return this.factionProgress().completed.includes(id); }

  paint(canvas, id) {
    try { const result = this.drawCardArt(canvas, id); if (result?.catch) result.catch(() => {}); } catch (_) {}
  }

  syncIdle() {
    this.stopIdle();
    if (this.root.hidden || document.hidden || this.reducedMotion.matches || !this.root.isConnected) return;
    this.tickIdle();
  }

  tickIdle() {
    if (this.root.hidden || document.hidden || this.reducedMotion.matches || !this.root.isConnected) return;
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
