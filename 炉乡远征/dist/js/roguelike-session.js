import * as battleEngine from './engine.js';
import { CAMPAIGN_UNIT_IDS } from './campaign-rules.js';
import { getFaction } from './factions.js';
import { validateEnemyPlan } from './enemy-plans.js';
import { validateFrozenEncounterDefinition } from './encounter-system.js';
import { RELICS, validateRoguelikeDeck, validateRoguelikeUpgrades, validateRoguelikeState } from './roguelike-rules.js';
import { ROGUELIKE_HEROES, ENCOUNTERS, BOSSES, CAMP_COSTS, REWARD_THEMES, getRoguelikeHero, getRoguelikeKit, createRoguelikeRoute } from './roguelike-data.js';
import { getCard } from './cards.js';

export const ROGUELIKE_KEY = 'duelyst-h5.safe-v1.roguelike-v1';
const clone = value => structuredClone(value);
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const int = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= min && value <= max;
const string = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
const canonical = value => Array.isArray(value) ? value.map(canonical) : object(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const emptyOffers = () => ({ routes: [], cards: [], relics: [] });
const defaultRecord = () => ({ schemaVersion: 1, modeVersion: 1, unlockedDifficulty: 1, heroes: Object.fromEntries(ROGUELIKE_HEROES.map(hero => [hero.id, { wins: 0, bestDifficulty: 0, unlockedKits: [hero.kits[0].id] }])), run: null });
const relicIds = new Set(RELICS.map(value => value.id));
const unique = values => new Set(values).size === values.length;
const newId = () => globalThis.crypto?.randomUUID?.() ?? `secret-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
const seedNow = () => globalThis.crypto?.getRandomValues?.(new Uint32Array(1))[0] ?? Math.floor(Math.random() * 4294967296);
function random(run) { run.rng = (Math.imul(run.rng, 1664525) + 1013904223) >>> 0; run.cursor++; return run.rng / 4294967296; }
function shuffled(run, values) { const result = [...values]; for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random(run) * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; } return result; }
function relicOffers(run) {
  const tags = getRoguelikeKit(run.heroId, run.kitId).tags;
  const pool = shuffled(run, RELICS.filter(value => !run.relics.includes(value.id)));
  pool.sort((a, b) => Number(b.tags.some(tag => tags.includes(tag))) - Number(a.tags.some(tag => tags.includes(tag))));
  return pool.slice(0, 3).map(({ id, name, description, tags: itemTags }) => ({ id, name, description, tags: [...itemTags] }));
}
function routeOffers(run) {
  const boss = [3, 6].includes(run.stage);
  const pool = shuffled(run, (boss ? BOSSES : ENCOUNTERS).filter(value => value.minStage <= run.stage));
  return pool.slice(0, 2).map((value, index) => createRoguelikeRoute(value.id, { stage: run.stage, difficulty: run.difficulty, kind: boss ? 'boss' : index === 0 ? 'safe' : 'elite', heroId: run.heroId, battleSeed: Math.floor(random(run) * 4294967296) }));
}
function cardOffers(run) {
  if (run.deck.length > 43) return [];
  const tag = getRoguelikeKit(run.heroId, run.kitId).tags[0];
  const themes = shuffled(run, REWARD_THEMES);
  themes.sort((a, b) => Number(b.id === tag) - Number(a.id === tag));
  const result = [];
  for (const theme of themes) {
    const cards = [], pool = shuffled(run, theme.cards.filter(id => getCard(id).cost <= Math.min(8, 3 + run.stage)));
    for (let i = 0; i < 2; i++) {
      const available = pool.filter(id => run.deck.filter(value => value === id).length + cards.filter(value => value === id).length < 6);
      if (!available.length) break;
      cards.push(available[Math.floor(random(run) * available.length)]);
    }
    if (cards.length === 2) result.push({ id: `${run.stage}-${theme.id}`, title: theme.title, cards });
    if (result.length === 3) break;
  }
  return result;
}

/** Owns only the independent local slot. Engine injection is for isolated
 * transaction tests; production always uses the existing battle engine. */
export class RoguelikeSession {
  constructor(options = {}) {
    this.storage = null; this.raw = null; this._record = freeze(defaultRecord()); this.active = null;
    this.prepared = null; this.pendingStart = null; this.pendingWrite = null; this.blocked = ''; this.lastError = ''; this.engine = options.engine ?? battleEngine;
    try {
      this.storage = Object.hasOwn(options, 'storage') ? options.storage : globalThis.localStorage;
      if (!this.storage?.getItem || !this.storage?.setItem) throw new Error('本机存储不可用。');
      this.raw = this.storage.getItem(ROGUELIKE_KEY);
      if (this.raw !== null) {
        const value = JSON.parse(this.raw);
        if (!this.validRecord(value)) throw new Error('秘境存档格式不受支持，原件已保留。');
        this._record = freeze(value);
      }
    } catch (error) { this.blocked = this.lastError = `无法读取秘境存档：${error.message}`; }
  }
  get record() { return this._record; }
  get error() { return this.lastError; }
  get hasResume() { return !this.blocked && !!this.record.run && !['won', 'lost'].includes(this.record.run.phase); }
  fail(error) { this.lastError = error?.message ?? String(error); return { ok: false, error: this.lastError }; }
  validRoute(route, run) {
    if (!exact(route, ['id', 'encounterId', 'levelId', 'title', 'hint', 'kind', 'gold', 'relic', 'battleSeed', 'enemyPlan', 'template', 'mechanics'])) return false;
    const entry = [...ENCOUNTERS, ...BOSSES].find(value => value.id === route.encounterId);
    const boss = [3, 6].includes(run.stage);
    if (!battleEngine.validRoguelikeTemplate(route.template, route.levelId)) return false;
    const owners = [...new Set(route.template.enemies.map(value => value.owner))];
    if (!validateEnemyPlan(route.enemyPlan, route.levelId, owners) || !validateFrozenEncounterDefinition(route.mechanics, route.levelId, owners)
      || (route.mechanics === null ? route.enemyPlan.encounterVersion !== undefined : route.enemyPlan.encounterVersion !== 1)) return false;
    const cells = Object.values(route.enemyPlan.players).flatMap(plan => plan.garrison);
    if (!unique(cells.map(value => `${value.x},${value.y}`)) || cells.some(value => value.x >= route.template.columns || value.y >= route.template.rows)) return false;
    return !!entry && entry.levelId === route.levelId && entry.minStage <= run.stage && route.id === `${run.stage}-${route.kind}-${route.encounterId}`
      && (boss ? route.kind === 'boss' && BOSSES.includes(entry) : ['safe', 'elite'].includes(route.kind) && ENCOUNTERS.includes(entry))
      && typeof route.title === 'string' && typeof route.hint === 'string' && route.gold === (boss ? 90 : route.kind === 'elite' ? 70 : 45) + run.stage * 5 && route.relic === (route.kind === 'elite' || run.stage === 3)
      && int(route.battleSeed, 0, 4294967295);
  }
  validBattle(match, run, current = false) {
    if (!this.engine.validateMatch(match) || !validateRoguelikeState(match) || match.schemaVersion !== 7 || match.mode !== 'expedition' || match.levelId !== run.route?.levelId
      || match.players[0].generalId !== run.heroId || match.roguelike.runId !== run.id || match.roguelike.stage !== run.stage || match.roguelike.difficulty !== run.difficulty
      || !equal(match.enemyPlan, run.route.enemyPlan) || !equal(match.board, { columns: run.route.template.columns, rows: run.route.template.rows, tiles: run.route.template.tiles ?? [] })
      || !equal(match.objective, run.route.template.objective) || match.turnLimit !== run.route.template.turnLimit) return false;
    if (run.route.mechanics !== null && (!match.encounter || !equal(match.encounter.config.title, run.route.mechanics.title) || !equal(match.encounter.config.text, run.route.mechanics.text)
      || !run.route.mechanics.sources.every((source, index) => equal(source, match.encounter.config.sources[index]) || ['shadow-03', 'confluence-03'].includes(match.levelId) && match.encounter.lastStand && equal({ ...source, card: 0 }, match.encounter.config.sources[index])))) return false;
    return !current || equal(match.loadout.deck, run.deck) && equal(match.roguelike.relics, run.relics) && equal(match.roguelike.upgrades, run.upgrades);
  }
  validRecord(record) {
    try {
      if (!exact(record, ['schemaVersion', 'modeVersion', 'unlockedDifficulty', 'heroes', 'run']) || record.schemaVersion !== 1 || record.modeVersion !== 1 || !int(record.unlockedDifficulty, 1, 5)
        || !exact(record.heroes, ROGUELIKE_HEROES.map(hero => String(hero.id)))) return false;
      for (const hero of ROGUELIKE_HEROES) {
        const progress = record.heroes[hero.id];
        if (!exact(progress, ['wins', 'bestDifficulty', 'unlockedKits']) || !int(progress.wins) || !int(progress.bestDifficulty, 0, 5)
          || (progress.wins === 0) !== (progress.bestDifficulty === 0) || !equal(progress.unlockedKits, hero.kits.slice(0, progress.wins ? 2 : 1).map(value => value.id))) return false;
      }
      if (record.unlockedDifficulty !== Math.min(5, Math.max(...Object.values(record.heroes).map(value => value.bestDifficulty)) + 1)) return false;
      const run = record.run;
      if (run === null) return true;
      if (!exact(run, ['id', 'seed', 'rng', 'cursor', 'heroId', 'kitId', 'difficulty', 'stage', 'phase', 'deck', 'relics', 'upgrades', 'gold', 'offers', 'route', 'match', 'context', 'settled', 'result'])
        || !string(run.id) || !int(run.seed, 0, 4294967295) || !int(run.rng, 0, 4294967295) || !int(run.cursor, 0, 1000000)
        || !getRoguelikeKit(run.heroId, run.kitId) || !record.heroes[run.heroId].unlockedKits.includes(run.kitId) || !int(run.difficulty, 1, record.unlockedDifficulty) || !int(run.stage, 1, 6)
        || !['relic', 'route', 'battle', 'cards', 'camp', 'won', 'lost'].includes(run.phase) || !validateRoguelikeDeck(run.deck) || !validateRoguelikeUpgrades(run.upgrades)
        || Object.keys(run.upgrades).some(id => !run.deck.includes(Number(id))) || !int(run.gold, 0, 1000000) || !Array.isArray(run.relics) || !unique(run.relics) || run.relics.length > 7 || !run.relics.every(id => relicIds.has(id))
        || !exact(run.offers, ['routes', 'cards', 'relics']) || !Object.values(run.offers).every(Array.isArray) || run.offers.routes.length > 2 || run.offers.cards.length > 3 || run.offers.relics.length > 3
        || !run.offers.routes.every(route => this.validRoute(route, run)) || !unique(run.offers.routes.map(route => route.id))
        || !run.offers.cards.every(offer => exact(offer, ['id', 'title', 'cards']) && string(offer.id) && typeof offer.title === 'string' && Array.isArray(offer.cards) && offer.cards.length === 2 && validateRoguelikeDeck([...run.deck, ...offer.cards]))
        || !unique(run.offers.cards.map(value => value.id)) || !run.offers.relics.every(offer => exact(offer, ['id', 'name', 'description', 'tags']) && relicIds.has(offer.id) && !run.relics.includes(offer.id) && typeof offer.name === 'string' && typeof offer.description === 'string' && Array.isArray(offer.tags))
        || !unique(run.offers.relics.map(value => value.id)) || !Array.isArray(run.settled) || run.settled.length > 6 || !unique(run.settled.map(value => value.battleId))
        || !run.settled.every((value, index) => exact(value, ['battleId', 'stage', 'won', 'gold']) && string(value.battleId) && value.stage === index + 1 && typeof value.won === 'boolean' && int(value.gold, 0, 1000) && (value.won || index === run.settled.length - 1 && value.gold === 0))) return false;
      if (run.route !== null && (!this.validRoute(run.route, run) || !run.offers.routes.some(value => equal(value, run.route)))) return false;
      if (run.match === null) { if (run.context !== null) return false; }
      else if (!run.route || !this.validBattle(run.match, run, run.phase === 'battle') || !exact(run.context, ['rng', 'deaths']) || !int(run.context.rng, 0, 4294967295) || run.context.rng !== run.match.expansionRandom || !int(run.context.deaths)) return false;
      const count = run.settled.length, last = run.settled.at(-1), over = run.match?.phase === 'over', won = over && run.match.winner === 0 && run.match.result === 'win';
      if (run.phase === 'won') return run.result === 'win' && run.stage === 6 && count === 6 && run.settled.every(value => value.won) && won && record.heroes[run.heroId].bestDifficulty >= run.difficulty && !run.offers.cards.length && !run.offers.relics.length;
      if (run.phase === 'lost') return !run.offers.cards.length && !run.offers.relics.length && (run.result === 'abandoned' && count <= run.stage || run.result === 'loss' && count === run.stage && last.won === false && over && !won);
      if (run.result !== null || run.settled.some(value => !value.won)) return false;
      if (run.phase === 'route') return count === run.stage - 1 && run.match === null && run.offers.routes.length === 2 && !run.offers.cards.length && !run.offers.relics.length;
      if (run.phase === 'battle') return count === run.stage - 1 && !!run.route && !!run.match && !over && !run.offers.cards.length && !run.offers.relics.length;
      if (run.phase === 'relic' && run.match === null) return run.stage === 1 && count === 0 && run.route === null && !run.relics.length && !run.offers.routes.length && !run.offers.cards.length && run.offers.relics.length === 3;
      if (count !== run.stage || !won || run.stage === 6 || !last.won || last.battleId !== run.match.runId) return false;
      if (run.phase === 'cards') return !run.offers.relics.length;
      if (run.phase === 'relic') return run.route.relic && !run.offers.cards.length && run.offers.relics.length > 0;
      return run.phase === 'camp' && !run.offers.cards.length && !run.offers.relics.length;
    } catch { return false; }
  }
  write(record) {
    if (this.blocked) return this.fail(this.blocked);
    try {
      if (!this.validRecord(record)) throw new Error('秘境状态无效，未保存。');
      const raw = JSON.stringify(record);
      const observed = this.storage.getItem(ROGUELIKE_KEY);
      if (observed !== this.raw) {
        // A readback can fail after a successful commit. Recognize only the
        // exact bytes we attempted; never adopt another page's candidate.
        if (this.pendingWrite?.expected === this.raw && observed === this.pendingWrite.raw) {
          this.raw = observed; this._record = freeze(clone(this.pendingWrite.record)); this.pendingWrite = null;
          if (raw === observed) { this.lastError = ''; return { ok: true }; }
          throw new Error('上次秘境保存已确认，请重新执行当前操作。');
        }
        this.blocked = '秘境存档已在其他页面更新，请重新进入。'; throw new Error(this.blocked);
      }
      this.pendingWrite = { expected: this.raw, raw, record: clone(record) };
      try { this.storage.setItem(ROGUELIKE_KEY, raw); }
      catch (error) { if (this.storage.getItem(ROGUELIKE_KEY) !== raw) throw error; }
      if (this.storage.getItem(ROGUELIKE_KEY) !== raw) { this.blocked = '秘境存档写入未确认，请重新进入。'; throw new Error(this.blocked); }
      this.raw = raw; this._record = freeze(clone(record)); this.pendingWrite = null; this.lastError = ''; return { ok: true };
    } catch (error) { return this.fail(error); }
  }
  change(phase, operation) {
    if (this.blocked) return this.fail(this.blocked);
    if (!this.record.run || ![].concat(phase).includes(this.record.run.phase)) return this.fail('当前秘境阶段不能执行此操作。');
    try { const record = clone(this.record); operation(record.run, record); return this.write(record); }
    catch (error) { return this.fail(error); }
  }
  start(options = {}) {
    if (this.blocked) return this.fail(this.blocked);
    if (this.hasResume) return this.fail('当前秘境尚未结束，请先继续或放弃。');
    try {
      const heroId = options.heroId ?? 23, hero = getRoguelikeHero(heroId), kitId = options.kitId ?? hero?.kits[0].id, difficulty = options.difficulty ?? 1;
      if (!hero || !this.record.heroes[heroId].unlockedKits.includes(kitId) || !int(difficulty, 1, this.record.unlockedDifficulty) || options.seed !== undefined && !int(options.seed, 0, 4294967295)) throw new Error('主将、起始配置或难度尚未开放。');
      const input = JSON.stringify({ heroId, kitId, difficulty, seed: options.seed ?? null });
      if (this.pendingStart?.input !== input) {
        const record = clone(this.record), seed = options.seed ?? seedNow();
        record.run = { id: newId(), seed, rng: seed, cursor: 0, heroId, kitId, difficulty, stage: 1, phase: 'relic', deck: [...getRoguelikeKit(heroId, kitId).deck], relics: [], upgrades: {}, gold: 60, offers: emptyOffers(), route: null, match: null, context: null, settled: [], result: null };
        record.run.offers.relics = relicOffers(record.run); this.pendingStart = { input, record };
      }
      const saved = this.write(this.pendingStart.record);
      if (saved.ok) { this.leave(); this.pendingStart = null; }
      return saved;
    } catch (error) { return this.fail(error); }
  }
  chooseRelic(id) {
    return this.change('relic', run => {
      if (!run.offers.relics.some(value => value.id === id)) throw new Error('请选择当前可用的遗物。');
      run.relics.push(id); run.offers.relics = [];
      if (run.match === null) { run.phase = 'route'; run.offers.routes = routeOffers(run); }
      else run.phase = 'camp';
    });
  }
  chooseRoute(id) {
    return this.change('route', run => {
      const route = run.offers.routes.find(value => value.id === id);
      if (!route) throw new Error('请选择当前可用的路线。');
      if (run.route && run.route.id !== id) throw new Error('本场路线已经确定。');
      run.route = clone(route);
    });
  }
  chooseCards(id) {
    return this.change('cards', run => {
      if (id !== null) {
        const offer = run.offers.cards.find(value => value.id === id);
        if (!offer || !validateRoguelikeDeck([...run.deck, ...offer.cards])) throw new Error('该卡包当前不可领取。');
        run.deck.push(...offer.cards);
      }
      run.offers.cards = [];
      if (run.route.relic) { run.offers.relics = relicOffers(run); run.phase = run.offers.relics.length ? 'relic' : 'camp'; }
      else run.phase = 'camp';
    });
  }
  camp(action, cardId) {
    const result = this.change('camp', run => {
      if (action === 'continue') {
        run.stage++; run.phase = 'route'; run.route = null; run.match = null; run.context = null; run.offers = emptyOffers(); run.offers.routes = routeOffers(run); return;
      }
      if (!['remove', 'upgrade'].includes(action) || !Number.isInteger(cardId) || !run.deck.includes(cardId)) throw new Error('请选择牌组中的卡牌。');
      if (run.gold < CAMP_COSTS[action]) throw new Error('本局金币不足。');
      if (action === 'remove') {
        if (run.deck.length <= 12) throw new Error('牌组至少需要12张牌。');
        run.deck.splice(run.deck.indexOf(cardId), 1); if (!run.deck.includes(cardId)) delete run.upgrades[cardId];
      } else {
        if ((run.upgrades[cardId] ?? 0) >= 2) throw new Error('该卡牌已经强化至上限。');
        run.upgrades[cardId] = (run.upgrades[cardId] ?? 0) + 1;
      }
      run.gold -= CAMP_COSTS[action];
    });
    if (result.ok && action === 'continue') this.leave();
    return result;
  }
  prepareBattle() {
    if (this.blocked) return this.fail(this.blocked);
    const run = this.record.run;
    if (!run || run.phase !== 'route' || !run.route) return this.fail('请先选择本场路线。');
    if (this.prepared?.raw === this.raw) return { ok: true, match: this.prepared.match };
    let match;
    try {
      const faction = getFaction(getRoguelikeHero(run.heroId).faction);
      match = this.engine.createExpeditionMatch(run.route.levelId, {}, [...faction.defaultSquad], run.heroId,
        { deck: [...run.deck], spells: faction.spellIds.slice(0, 2), spellTraining: {}, spellModes: {}, specializations: {}, growthVersion: Object.fromEntries(CAMPAIGN_UNIT_IDS.map(id => [id, 'low-v2'])) },
        { challengeSeed: run.route.battleSeed, enemyPlanOverride: clone(run.route.enemyPlan), roguelikeTemplate: clone(run.route.template), roguelikeMechanics: clone(run.route.mechanics),
          roguelike: { version: 1, runId: run.id, stage: run.stage, difficulty: run.difficulty, relics: [...run.relics], upgrades: clone(run.upgrades) } });
      if (!this.validBattle(match, run, true) || !this.engine.challengeContext(match)) throw new Error('秘境战斗规则或地图不受支持，尚未进入战斗。');
      if (this.prepared) this.engine.unbindChallengeContext(this.prepared.match);
      this.prepared = { raw: this.raw, match }; this.lastError = ''; return { ok: true, match };
    } catch (error) { if (match) this.engine.unbindChallengeContext(match); return this.fail(error); }
  }
  commitBattle(match) {
    if (!this.prepared || this.prepared.match !== match || this.prepared.raw !== this.raw) return this.fail('待开战状态已失效，请重新准备。');
    const saved = this.change('route', run => {
      if (!this.validBattle(match, run, true) || match.phase === 'over') throw new Error('待开战棋局无效。');
      run.match = clone(match); run.context = this.engine.challengeContext(match); run.phase = 'battle';
    });
    if (!saved.ok) return saved;
    this.prepared = null; if (this.active) this.engine.unbindChallengeContext(this.active); this.active = match; return { ok: true, match };
  }
  owns(match) { return !!match && this.active === match && match.roguelike?.runId === this.record.run?.id && !!this.engine.challengeContext(match); }
  checkpoint(match) {
    if (this.blocked) return this.fail(this.blocked);
    if (!this.owns(match)) return this.fail('当前棋局不属于秘境远征。');
    const receipt = this.record.run.settled.find(value => value.battleId === match.runId);
    if (receipt) return match.phase === 'over' && receipt.won === (match.winner === 0 && match.result === 'win') ? { ok: true } : this.fail('秘境结算状态不一致。');
    return this.change('battle', (run, record) => {
      if (match.runId !== run.match.runId || !this.validBattle(match, run, true)) throw new Error('秘境棋局无效，未保存。');
      run.match = clone(match); run.context = this.engine.challengeContext(match);
      if (match.phase !== 'over') return;
      const won = match.winner === 0 && match.result === 'win';
      const gold = won ? run.route.gold : 0;
      run.settled.push({ battleId: match.runId, stage: run.stage, won, gold }); run.gold += gold;
      if (!won) { run.phase = 'lost'; run.result = 'loss'; run.offers.cards = []; run.offers.relics = []; }
      else if (run.stage === 6) {
        run.phase = 'won'; run.result = 'win'; run.offers.cards = []; run.offers.relics = [];
        const progress = record.heroes[run.heroId]; progress.wins++; progress.bestDifficulty = Math.max(progress.bestDifficulty, run.difficulty);
        progress.unlockedKits = getRoguelikeHero(run.heroId).kits.map(value => value.id);
        record.unlockedDifficulty = Math.min(5, Math.max(record.unlockedDifficulty, run.difficulty + 1));
      } else { run.phase = 'cards'; run.offers.cards = cardOffers(run); }
    });
  }
  restoreBattle() {
    if (this.blocked) return this.fail(this.blocked);
    if (this.record.run?.phase !== 'battle') return this.fail('当前没有待继续的秘境战斗。');
    if (this.active) return { ok: true, match: this.active };
    let match;
    try {
      match = this.engine.restoreMatch(clone(this.record.run.match));
      if (!match || !this.validBattle(match, this.record.run, true)) throw new Error('秘境棋局无法恢复，原件已保留。');
      this.engine.bindChallengeContext(match, this.record.run.context); this.active = match; this.lastError = ''; return { ok: true, match };
    } catch (error) { if (match) this.engine.unbindChallengeContext(match); return this.fail(error); }
  }
  leave() {
    if (this.active) this.engine.unbindChallengeContext(this.active);
    if (this.prepared) this.engine.unbindChallengeContext(this.prepared.match);
    this.active = null; this.prepared = null;
  }
  abandon() {
    const saved = this.change(['relic', 'route', 'battle', 'cards', 'camp'], run => { run.phase = 'lost'; run.result = 'abandoned'; run.offers.cards = []; run.offers.relics = []; });
    if (saved.ok) this.leave();
    return saved;
  }
}
