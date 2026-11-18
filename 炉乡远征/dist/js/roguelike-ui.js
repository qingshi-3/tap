import { CARDS } from './cards.js';
import { createGameCard } from './game-card.js';
import { cardRuleSections } from './card-rules.js';
import { ROGUELIKE_HEROES, ROGUELIKE_DIFFICULTIES, CAMP_COSTS } from './roguelike-data.js';
import { RELICS, applyRoguelikeUpgrades } from './roguelike-rules.js';
import { SESSION_HOME_BACKGROUND } from './home-background.js';
import { RELIC_ICONS, ROUTE_ICONS } from './roguelike-icons.js';

const node = (tag, className, text) => {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text != null) result.textContent = String(text);
  return result;
};
const finished = run => run && ['won', 'lost'].includes(run.phase);
const titleFor = { relic: '选择遗物', route: '选择路线', battle: '远征途中', cards: '选择卡包', camp: '战后整备', won: '秘境通关', lost: '远征结束' };
const cardCounts = deck => [...new Set(deck || [])].map(id => ({ id: Number(id), count: deck.filter(value => Number(value) === Number(id)).length }));
const logo = (src, className) => {
  const image = node('img', className); image.src = src; image.alt = ''; image.draggable = false;
  return image;
};

/** Owns presentation only. All persisted changes go through RoguelikeSession. */
export class RoguelikeUI {
  constructor({ session, drawArt, onBattle, onClose, confirm, playRewardFx } = {}) {
    if (!session) throw new Error('RoguelikeUI requires a session');
    this.session = session;
    this.drawArt = drawArt;
    this.onBattle = onBattle;
    this.onClose = onClose;
    this.confirm = confirm;
    this.playRewardFx = playRewardFx;
    this.heroId = ROGUELIKE_HEROES[0]?.id;
    this.kitId = ROGUELIKE_HEROES[0]?.kits[0]?.id;
    this.difficulty = 1;
    this.view = null;
    this.selection = null;
    this.setup = false;
    this.busy = false;
    this.error = '';
    this.root = node('section', 'roguelike-ui');
    this.root.id = 'roguelike-home';
    this.root.style.setProperty('--home-background', `url("${SESSION_HOME_BACKGROUND}")`);
    this.root.hidden = true;
    this.root.tabIndex = -1;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', 'roguelike-title');
    this.root.addEventListener('keydown', event => this.keydown(event));
    // The app owns the final qibing theme. New controls inherit its real button
    // mapping instead of recreating a second set of textures or painted frames.
    (document.getElementById('app') || document.body).append(this.root);
  }

  get run() { return this.session.record?.run; }
  get visible() { return !this.root.hidden; }

  show() {
    if (!this.visible) this.returnFocus = document.activeElement;
    this.root.hidden = false;
    this.refresh();
    this.root.querySelector('[data-focus="back"]')?.focus({ preventScroll: true });
  }

  hide() {
    this.cancelConfirmation?.(false);
    this.root.hidden = true;
    if (this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
  }

  destroy() { this.hide(); this.root.remove(); }

  button(text, key, action, { primary = false, disabled = false, className = '' } = {}) {
    const object = /roguelike-(card-object|pack-card|info-panel)/.test(className);
    const result = node('button', `roguelike-button${primary ? ' is-primary button-primary' : ''}${object ? ' training-card-open' : ''}${className ? ` ${className}` : ''}`, text);
    result.type = 'button';
    result.dataset.focus = key;
    result.dataset.action = key;
    result.disabled = disabled || this.busy;
    result.addEventListener('click', action);
    return result;
  }

  refresh() {
    if (!this.visible) return;
    const active = this.root.contains(document.activeElement) ? document.activeElement?.dataset.focus : null;
    const scroll = this.resetScroll ? 0 : this.root.querySelector('.roguelike-content')?.scrollTop || 0;
    const horizontalScroll = this.resetScroll ? 0 : this.root.querySelector('.roguelike-card-strip')?.scrollLeft || 0;
    this.resetScroll = false;
    const run = this.run;
    const phaseKey = `${run?.id || 'new'}:${run?.phase || 'new'}:${run?.stage || 0}:${this.setup}`;
    const changedPhase = this.phaseKey !== phaseKey;
    if (changedPhase) { this.selection = null; this.phaseKey = phaseKey; }
    this.root.replaceChildren();
    this.root.dataset.phase = this.setup ? 'setup' : run?.phase || 'setup';
    this.root.setAttribute('aria-busy', String(this.busy));
    const header = node('header', 'roguelike-header');
    header.append(this.button(this.view ? '返回' : '返营', 'back', () => this.back()));
    const pageTitle = run?.phase === 'route' ? `选择路线 · ${run.stage}/6战` : titleFor[run?.phase] || '秘境远征';
    const heading = node('h1', 'roguelike-title', this.view?.title || (this.setup || !run ? '秘境远征' : pageTitle));
    heading.id = 'roguelike-title';
    heading.tabIndex = -1;
    header.append(heading);
    const tools = node('nav', 'roguelike-tools'); tools.setAttribute('aria-label', '远征资料');
    if (run && !this.setup && !this.view) {
      tools.append(this.button(`牌组 ${run.deck.length}`, 'deck', () => this.openView({ type: 'deck', title: '当前牌组' })));
      tools.append(this.button(`遗物 ${run.relics.length}`, 'relics', () => this.openView({ type: 'relics', title: '当前遗物' })));
    } else if (!this.view) tools.append(this.button('记录', 'records', () => this.openView({ type: 'records', title: '通关记录' })));
    header.append(tools);
    this.body = node('main', 'roguelike-content');
    if (this.view?.type === 'card') {
      this.body.tabIndex = 0;
      this.body.setAttribute('aria-label', '卡牌详情内容');
    }
    this.footer = node('footer', 'roguelike-footer');
    this.status = node('p', 'roguelike-error');
    this.status.setAttribute('role', 'alert');
    this.status.textContent = this.error || this.session.error || '';
    this.status.hidden = !this.status.textContent;
    this.root.append(header, this.body, this.status, this.footer);
    if (this.view) this.renderView();
    else if (this.setup || !run) this.renderSetup();
    else {
      if (!finished(run) && run.phase !== 'route') this.body.append(this.runStatus(run));
      const render = { relic: 'renderRelics', route: 'renderRoutes', battle: 'renderBattle', cards: 'renderCards', camp: 'renderCamp', won: 'renderResult', lost: 'renderResult' }[run.phase];
      if (render) this[render](run);
      else this.body.append(node('p', 'roguelike-empty', '此进度暂时无法继续，请返营后重试。'));
    }
    if (this.busy) this.footer.append(node('span', 'roguelike-saving', '正在保存…'));
    this.body.scrollTop = changedPhase ? 0 : scroll;
    const strip = this.body.querySelector('.roguelike-card-strip');
    if (strip) strip.scrollLeft = changedPhase ? 0 : horizontalScroll;
    const restore = active && [...this.root.querySelectorAll('[data-focus]')].find(item => item.dataset.focus === active && !item.disabled);
    if (restore) restore.focus({ preventScroll: true });
    else if (active) heading.focus({ preventScroll: true });
  }

  runStatus(run) {
    const result = node('div', 'roguelike-run-status');
    const hero = ROGUELIKE_HEROES.find(item => Number(item.id) === Number(run.heroId));
    result.append(node('span', '', `${hero?.name || '主将'}　难度 ${run.difficulty}　${run.stage} / 6 战`));
    result.append(this.gold(run.gold));
    return result;
  }

  gold(amount) {
    const result = node('span', 'roguelike-gold');
    const image = node('img'); image.src = './assets/metagame/original/resource-gold.png'; image.alt = '';
    result.append(image, node('span', '', `${amount} 金币`)); return result;
  }

  displayCard(id, starter = false) {
    const base = CARDS[id];
    const rank = !starter && Number(this.run?.upgrades?.[id] || 0);
    if (!base || !rank) return base;
    const card = { ...base };
    applyRoguelikeUpgrades({ roguelike: { upgrades: { [id]: rank }, upgradeBases: {} }, battleCards: { 0: { [id]: card } } });
    return card;
  }

  renderSetup() {
    this.body.classList.add('roguelike-setup');
    const heroes = node('div', 'roguelike-heroes'); heroes.setAttribute('aria-label', '选择主将');
    for (const hero of ROGUELIKE_HEROES) {
      const selected = Number(hero.id) === Number(this.heroId);
      const choice = this.button('', `hero-${hero.id}`, () => {
        this.heroId = hero.id; this.kitId = hero.kits[0].id; this.refresh();
      }, { className: 'roguelike-hero' });
      choice.setAttribute('aria-pressed', String(selected));
      const image = node('img'); image.src = hero.portrait; image.alt = ''; image.draggable = false;
      choice.append(image, node('strong', '', hero.name)); heroes.append(choice);
    }
    const hero = ROGUELIKE_HEROES.find(item => Number(item.id) === Number(this.heroId)) || ROGUELIKE_HEROES[0];
    const options = node('div', 'roguelike-setup-options');
    const kits = node('div', 'roguelike-kit-options'); kits.setAttribute('role', 'group'); kits.setAttribute('aria-label', '起始牌组');
    const unlocked = this.session.record.heroes?.[hero.id]?.unlockedKits || [hero.kits[0].id];
    for (const kit of hero.kits) {
      const locked = !unlocked.includes(kit.id);
      const choice = this.button(locked ? `${kit.name} · 通关解锁` : kit.name, `kit-${kit.id}`, () => { this.kitId = kit.id; this.refresh(); }, { disabled: locked });
      choice.setAttribute('aria-pressed', String(this.kitId === kit.id)); kits.append(choice);
    }
    const kit = hero.kits.find(item => item.id === this.kitId) || hero.kits[0];
    options.append(kits, node('p', 'roguelike-kit-description', kit.description));
    options.append(this.button(`查看起始牌组 · ${kit.deck.length}张`, 'starter-deck', () => this.openView({ type: 'deck', title: kit.name, deck: kit.deck, starter: true })));
    const difficulties = node('div', 'roguelike-difficulties'); difficulties.setAttribute('role', 'group'); difficulties.setAttribute('aria-label', '选择难度');
    for (const difficulty of ROGUELIKE_DIFFICULTIES) {
      const locked = Number(difficulty.id) > Number(this.session.record.unlockedDifficulty || 1);
      const choice = this.button(String(difficulty.id), `difficulty-${difficulty.id}`, () => { this.difficulty = Number(difficulty.id); this.refresh(); }, { disabled: locked });
      choice.setAttribute('aria-label', `${difficulty.name || `难度 ${difficulty.id}`}${locked ? '，通关前一级解锁' : ''}`);
      choice.setAttribute('aria-pressed', String(this.difficulty === Number(difficulty.id))); difficulties.append(choice);
    }
    const label = node('div', 'roguelike-difficulty-row'); label.append(node('span', '', '难度'), difficulties); options.append(label);
    const selectedDifficulty = ROGUELIKE_DIFFICULTIES.find(item => Number(item.id) === this.difficulty);
    if (selectedDifficulty?.description) options.append(node('p', 'roguelike-kit-description', selectedDifficulty.description));
    this.body.append(heroes, options);
    this.footer.append(this.button('开始远征', 'start', () => this.action(() => this.session.start({ heroId: hero.id, kitId: kit.id, difficulty: this.difficulty }), { setup: false }), { primary: true }));
  }

  renderRelics(run) {
    const offers = run.offers?.relics || [];
    const list = node('div', 'roguelike-relic-choices');
    for (const relic of offers) {
      const choice = this.button('', `relic-${relic.id}`, () => { this.selection = relic.id; this.refresh(); }, { className: 'roguelike-info-panel roguelike-relic-choice' });
      choice.setAttribute('aria-pressed', String(this.selection === relic.id));
      const heading = node('span', 'roguelike-choice-heading');
      heading.append(logo(RELIC_ICONS[relic.id], 'roguelike-relic-icon'), node('strong', '', relic.name));
      choice.append(heading, node('span', 'roguelike-relic-description', relic.description));
      const mark = node('span', 'roguelike-choice-mark', this.selection === relic.id ? '✓' : ''); mark.setAttribute('aria-hidden', 'true'); choice.append(mark); list.append(choice);
    }
    this.body.append(list);
    if (!offers.length) this.body.append(node('p', 'roguelike-empty', '没有可选遗物，请返营后重试。'));
    this.footer.append(this.button('收下遗物', 'take-relic', () => this.action(() => this.session.chooseRelic(this.selection), { reward: true }), { primary: true, disabled: !offers.some(item => item.id === this.selection) }));
  }

  renderRoutes(run) {
    const routes = run.offers?.routes || [];
    const selected = run.route?.id || this.selection;
    const list = node('div', 'roguelike-routes');
    for (const route of routes) {
      const item = node('div', 'roguelike-route-item');
      const choice = this.button('', `route-${route.id}`, () => { this.selection = route.id; this.refresh(); }, { disabled: !!run.route && run.route.id !== route.id, className: 'roguelike-info-panel roguelike-route' });
      choice.setAttribute('aria-pressed', String(selected === route.id));
      const kind = route.kind === 'boss' ? '首领' : route.kind === 'elite' ? '精英' : '稳妥';
      const heading = node('span', 'roguelike-choice-heading');
      heading.append(logo(ROUTE_ICONS[route.kind], 'roguelike-route-icon'), node('strong', '', `${kind} · ${route.title}`));
      choice.append(heading, node('span', 'roguelike-route-hint', route.hint));
      choice.append(node('span', 'roguelike-route-rewards', `${route.gold} 金币${route.relic ? ' · 遗物' : ''}`));
      const mark = node('span', 'roguelike-choice-mark', selected === route.id ? '✓' : ''); mark.setAttribute('aria-hidden', 'true'); choice.append(mark);
      item.append(choice, this.button('查看敌情', `route-intel-${route.id}`, () => this.openView({ type: 'intel', route, title: route.title })));
      list.append(item);
    }
    this.body.append(list);
    if (!routes.length) this.body.append(node('p', 'roguelike-empty', '路线尚未就绪，请返营后重试。'));
    this.footer.append(this.button('放弃本局', 'abandon', () => this.abandon()));
    this.footer.append(this.button(run.route ? '进入战斗' : '选择并出战', 'battle', async () => {
      if (this.busy) return;
      if (!this.run.route) {
        const result = await this.action(() => this.session.chooseRoute(this.selection));
        if (!result?.ok) return;
      }
      await this.battle();
    }, { primary: true, disabled: !routes.some(item => item.id === selected) }));
  }

  renderBattle(run) {
    const content = node('div', 'roguelike-resume');
    content.append(node('h2', '', run.route?.title || '战斗尚未结束'));
    if (run.route?.hint) content.append(node('p', '', run.route.hint));
    this.body.append(content);
    this.footer.append(this.button('放弃本局', 'abandon', () => this.abandon()), this.button('继续战斗', 'battle', () => this.battle(), { primary: true }));
  }

  renderCards(run) {
    const offers = run.offers?.cards || [];
    const list = node('div', 'roguelike-packs');
    for (const pack of offers) {
      const item = node('div', 'roguelike-pack');
      const choice = this.button(pack.title, `pack-${pack.id}`, () => { this.selection = pack.id; this.refresh(); }, { className: 'roguelike-pack-select' });
      choice.setAttribute('aria-pressed', String(this.selection === pack.id));
      choice.setAttribute('aria-label', `${pack.title}，${pack.cards.map(id => CARDS[id]?.name || '卡牌').join('、')}`);
      const art = node('span', 'roguelike-pack-cards');
      pack.cards.forEach((id, index) => {
        if (!CARDS[id]) return;
        const detail = this.button('', `pack-detail-${pack.id}-${index}`, () => this.cardDetail(id), { className: 'roguelike-pack-card' });
        detail.setAttribute('aria-label', `查看${CARDS[id].name}详情`);
        detail.append(createGameCard(CARDS[id], { drawArt: this.drawArt })); art.append(detail);
      });
      item.append(art, choice); list.append(item);
    }
    this.body.append(list);
    if (!offers.length) this.body.append(node('p', 'roguelike-empty', '没有可选卡包，可跳过继续。'));
    this.footer.append(this.button('跳过', 'skip-cards', () => this.action(() => this.session.chooseCards(null))));
    this.footer.append(this.button('收下卡包', 'take-cards', () => this.action(() => this.session.chooseCards(this.selection), { reward: true }), { primary: true, disabled: !offers.some(item => item.id === this.selection) }));
  }

  renderCamp(run) {
    const list = node('div', 'roguelike-camp-grid'); list.setAttribute('aria-label', '选择强化卡牌');
    for (const { id, count } of cardCounts(run.deck)) {
      const base = CARDS[id]; if (!base) continue;
      const level = Number(run.upgrades?.[id] || 0);
      const maxed = level >= 2;
      const card = this.displayCard(id);
      const choice = this.button('', `camp-card-${id}`, () => { this.selection = id; this.refresh(); }, { className: 'roguelike-camp-card' });
      choice.setAttribute('aria-pressed', String(Number(this.selection) === id));
      choice.setAttribute('aria-label', `${base.name}，${count}张${level ? `，强化${level}` : ''}${maxed ? '，强化已满' : ''}`);
      const canvas = node('canvas', 'roguelike-camp-art'); canvas.width = 128; canvas.height = 128;
      try { const painted = this.drawArt?.(canvas, id); painted?.catch?.(() => {}); } catch (_) {}
      const copy = node('span', 'roguelike-camp-card-copy');
      copy.append(node('strong', '', base.name), node('span', '', `${card.cost}费 · ×${count}`));
      if (level) copy.append(node('span', '', `强化 ${level}/2`));
      choice.append(canvas, copy); list.append(choice);
    }
    this.body.append(list);
    const selected = CARDS[this.selection];
    const cost = CAMP_COSTS.upgrade;
    const maxed = Number(run.upgrades?.[this.selection] || 0) >= 2;
    const unavailable = !selected || run.gold < cost || maxed;
    const purchaseLabel = run.gold < cost ? '金币不足' : maxed ? '强化已满' : `强化同名牌 · ${cost}金币`;
    this.footer.append(this.button('详情', 'camp-detail', () => this.cardDetail(this.selection), { disabled: !selected }));
    this.footer.append(this.button(purchaseLabel, 'camp-buy', async () => {
      const effect = selected.type === 'spell' ? '所有同名法术费用-1，最低0费。' : '所有同名随从+1攻击、+2生命。';
      const approved = await this.ask({ title: `强化${selected.name}？`, message: `消耗 ${cost} 金币。${effect}本次远征持续生效，最多强化2次；通关、失败或放弃后结束。`, confirmText: '确认强化' });
      if (approved) await this.action(() => this.session.camp('upgrade', this.selection), { reward: true });
    }, { disabled: unavailable }));
    this.footer.append(this.button('继续远征', 'camp-continue', () => this.action(() => this.session.camp('continue')), { primary: true }));
  }

  renderResult(run) {
    const content = node('div', 'roguelike-result');
    const hero = ROGUELIKE_HEROES.find(item => Number(item.id) === Number(run.heroId));
    const image = node('img', 'roguelike-result-portrait'); image.src = hero?.portrait || ''; image.alt = '';
    const copy = node('div');
    copy.append(node('h2', '', `${hero?.name || '主将'} · 难度 ${run.difficulty}`));
    const victories = (run.settled || []).filter(item => item.won).length;
    copy.append(node('p', '', `胜利 ${victories} / 6 战`));
    if (run.phase === 'won') copy.append(node('p', '', '已记录通关，起始配置与可选难度已更新。'));
    else if (run.result === 'abandoned') copy.append(node('p', '', '本局已放弃。'));
    content.append(image, copy); this.body.append(content);
    this.footer.append(this.button('查看记录', 'records', () => this.openView({ type: 'records', title: '通关记录' })), this.button('再开一局', 'new-run', () => {
      this.heroId = run.heroId; this.kitId = run.kitId; this.difficulty = run.difficulty;
      this.setup = true; this.refresh();
    }, { primary: true }));
  }

  openView(view) {
    const returnState = {
      focusKey: document.activeElement?.dataset.focus,
      scrollTop: this.body?.scrollTop || 0,
      scrollLeft: this.body?.querySelector('.roguelike-card-strip')?.scrollLeft || 0,
    };
    this.view = { ...view, previous: this.view, returnState };
    this.resetScroll = true; this.refresh();
    this.root.querySelector('[data-focus="back"]')?.focus({ preventScroll: true });
  }
  cardDetail(cardId) { this.openView({ type: 'card', cardId: Number(cardId), title: CARDS[cardId]?.name || '卡牌详情' }); }

  renderView() {
    if (this.view.type === 'deck') {
      const deck = this.view.deck || this.run?.deck || [];
      const list = node('div', 'roguelike-card-grid');
      for (const { id, count } of cardCounts(deck)) {
        const card = CARDS[id]; if (!card) continue;
        const level = !this.view.starter && Number(this.run?.upgrades?.[id] || 0);
        const item = this.button('', `deck-card-${id}`, () => this.cardDetail(id), { className: 'roguelike-card-object' });
        item.setAttribute('aria-label', `${card.name}，${count}张${level ? `，强化${level}` : ''}，查看详情`);
        item.append(createGameCard(this.displayCard(id, !!this.view.starter), { drawArt: this.drawArt }), node('span', 'roguelike-card-count', `×${count}${level ? `　强化 ${level}` : ''}`)); list.append(item);
      }
      this.body.append(node('p', 'roguelike-deck-summary', `${deck.length}张 · ${cardCounts(deck).length}种`), list);
    } else if (this.view.type === 'card') {
      const card = this.view.displayCard || this.displayCard(this.view.cardId, !!this.view.previous?.starter);
      if (!card) { this.body.append(node('p', 'roguelike-empty', '这张卡牌暂时无法显示。')); return; }
      const content = node('div', 'roguelike-card-detail');
      content.append(createGameCard(card, { drawArt: this.drawArt }));
      const copy = node('div', 'roguelike-card-rules roguelike-info-panel');
      const level = !this.view.displayCard && !this.view.previous?.starter && Number(this.run?.upgrades?.[card.id] || 0);
      if (level) copy.append(node('p', 'roguelike-upgrade-copy', `强化 ${level} / 2 · 所有同名牌在本次远征持续生效。`));
      for (const section of cardRuleSections(card)) {
        if (section.label && section.label !== '规则') copy.append(node('h2', '', section.label));
        copy.append(node('p', '', section.text));
      }
      content.append(copy); this.body.append(content);
    } else if (this.view.type === 'intel') {
      const route = this.view.route;
      if (route.hint) this.body.append(node('p', 'roguelike-intel-hint', route.hint));
      for (const [owner, plan] of Object.entries(route.enemyPlan?.players || {})) {
        const section = node('section', 'roguelike-enemy');
        const general = CARDS[plan.generalId];
        section.append(node('h2', '', `${general?.name || '敌将'} · ${plan.generalAttack}攻击 / ${plan.generalHealth}生命`));
        section.append(node('p', 'roguelike-intel-hint', `开场 ${plan.mana} 法力 · ${plan.openingHandSize} 张手牌`));
        const opening = plan.garrison.filter(item => item.id !== plan.generalId);
        section.append(node('p', 'roguelike-intel-hint', opening.length ? `开场驻军：${opening.map(item => `${CARDS[item.id]?.name || '随从'} ${item.attack}/${item.health}`).join('、')}` : '无开场驻军'));
        const list = node('div', 'roguelike-card-strip'); list.setAttribute('aria-label', `${general?.name || '敌军'}牌组`);
        for (const { id, count } of cardCounts(plan.deck)) {
          const base = CARDS[id]; if (!base) continue;
          const card = { ...base, ...(plan.unitStats?.[id] || {}) };
          const button = this.button('', `enemy-${owner}-${id}`, () => this.openView({ type: 'card', cardId: id, displayCard: card, title: `${card.name} · 敌军` }), { className: 'roguelike-card-object' });
          button.setAttribute('aria-label', `${card.name}，${count}张，查看敌军卡牌详情`);
          button.append(createGameCard(card, { drawArt: this.drawArt }), node('span', 'roguelike-card-count', `×${count}`)); list.append(button);
        }
        section.append(list); this.body.append(section);
      }
    } else if (this.view.type === 'records') {
      const list = node('div', 'roguelike-records');
      for (const hero of ROGUELIKE_HEROES) {
        const record = this.session.record.heroes?.[hero.id] || {};
        const row = node('div', 'roguelike-record'); const image = node('img'); image.src = hero.portrait; image.alt = '';
        row.append(image, node('strong', '', hero.name), node('span', '', record.wins ? `通关 ${record.wins} 次 · 最高难度 ${record.bestDifficulty}` : '尚未通关'));
        list.append(row);
      }
      this.body.append(list);
    } else if (this.view.type === 'relics') {
      const list = node('div', 'roguelike-owned-relics');
      for (const id of this.run?.relics || []) {
        const relic = RELICS.find(item => item.id === id) || { name: id, description: '' };
        const item = node('div', 'roguelike-owned-relic');
        const copy = node('div'); copy.append(node('h2', '', relic.name), node('p', '', relic.description));
        item.append(logo(RELIC_ICONS[id], 'roguelike-relic-icon'), copy); list.append(item);
      }
      this.body.append(list);
      if (!list.childElementCount) this.body.append(node('p', 'roguelike-empty', '尚未获得遗物。'));
    }
    if (this.view.type === 'deck' && !this.view.starter && this.run && !finished(this.run)) this.footer.append(this.button('放弃本局', 'abandon', () => this.abandon()));
    this.footer.append(this.button('返回', 'view-back', () => this.back(), { primary: true }));
  }

  async action(callback, { reward = false, setup } = {}) {
    if (this.busy) return { ok: false };
    const focusKey = document.activeElement?.dataset.focus;
    this.busy = true; this.error = ''; this.refresh();
    let result;
    try {
      result = await callback();
      if (!result?.ok) this.error = typeof result?.error === 'string' ? result.error : this.session.error || '保存未完成，请重试。';
      else if (setup != null) this.setup = setup;
    } catch (_) { this.error = '操作未完成，请重试。'; result = { ok: false }; }
    finally {
      this.busy = false; this.refresh();
      if (this.visible) {
        const restore = [...this.root.querySelectorAll('[data-focus]')].find(item => item.dataset.focus === focusKey && !item.disabled);
        (restore || this.footer.querySelector('button.is-primary:not(:disabled)') || this.root.querySelector('.roguelike-title'))?.focus({ preventScroll: true });
      }
    }
    if (reward && result?.ok && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      try { this.playRewardFx?.(this.root.querySelector('.roguelike-title')); } catch (_) { /* Feedback never changes a committed reward. */ }
    }
    return result;
  }

  async battle() {
    if (this.busy) return;
    if (typeof this.onBattle !== 'function') { this.error = '战斗尚未就绪，请返营后重试。'; this.refresh(); return; }
    await this.action(async () => (await this.onBattle({ run: this.run, route: this.run?.route })) || { ok: true });
  }

  async abandon() {
    if (this.busy) return;
    const approved = await this.ask({ title: '放弃本局远征？', message: '本局牌组、金币、遗物和强化将结束。通关记录保留。', confirmText: '放弃本局' });
    if (approved) await this.action(() => {
      const result = this.session.abandon();
      if (result.ok) this.view = null;
      return result;
    });
  }

  async back() {
    if (this.busy) return;
    if (this.view) {
      const returnState = this.view.returnState;
      this.view = this.view.previous || null; this.resetScroll = true; this.refresh();
      if (returnState) {
        this.body.scrollTop = returnState.scrollTop;
        const strip = this.body.querySelector('.roguelike-card-strip');
        if (strip) strip.scrollLeft = returnState.scrollLeft;
        const opener = [...this.root.querySelectorAll('[data-focus]')].find(item => item.dataset.focus === returnState.focusKey && !item.disabled);
        (opener || this.root.querySelector('[data-focus="back"]'))?.focus({ preventScroll: true });
      }
      return;
    }
    if (this.setup && this.run) { this.setup = false; this.refresh(); return; }
    const result = await this.action(() => { this.session.leave(); return { ok: true }; });
    if (result?.ok) { this.hide(); this.onClose?.(); }
  }

  async ask(options) {
    if (typeof this.confirm === 'function') return !!(await this.confirm(options));
    const previous = document.activeElement;
    const layer = node('div', 'roguelike-confirm-layer');
    const panel = node('section', 'roguelike-confirm game-dialog'); panel.setAttribute('role', 'alertdialog'); panel.setAttribute('aria-modal', 'true');
    const title = node('h2', '', options.title); title.id = 'roguelike-confirm-title';
    const message = node('p', '', options.message); message.id = 'roguelike-confirm-message';
    panel.setAttribute('aria-labelledby', title.id); panel.setAttribute('aria-describedby', message.id);
    return new Promise(resolve => {
      const done = approved => { layer.remove(); this.cancelConfirmation = null; previous?.isConnected && previous.focus({ preventScroll: true }); resolve(approved); };
      this.cancelConfirmation = done;
      const actions = node('div', 'roguelike-confirm-actions');
      const cancel = this.button('取消', 'confirm-cancel', () => done(false));
      actions.append(cancel, this.button(options.confirmText || '确认', 'confirm-yes', () => done(true), { primary: true }));
      panel.append(title, message, actions); layer.append(panel); this.root.append(layer); cancel.focus();
    });
  }

  keydown(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (this.cancelConfirmation) this.cancelConfirmation(false); else this.back(); return; }
    if (event.key !== 'Tab') return;
    const area = this.root.querySelector('.roguelike-confirm') || this.root;
    const targets = [...area.querySelectorAll('button:not(:disabled),[tabindex="0"]')].filter(item => item.getClientRects().length);
    if (!targets.length) { event.preventDefault(); this.root.focus(); return; }
    const first = targets[0], last = targets[targets.length - 1];
    if (event.shiftKey && (document.activeElement === first || !area.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !area.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  }
}
