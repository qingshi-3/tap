import { assetImage, assetFetch, assetFont, prioritizeAsset, assetFailures } from './asset-loading.js';
import { CARDS, getCard } from './cards.js';
import { EFFECT_MANIFEST } from './effect-manifest.js';
import { battleCardIds } from './battle-assets.js';
import { drawAtlasFrame, framesWithPrefix, parsePlist } from './atlas.js';

const ROOT = './assets/';
const MOVE_PARTS = ['start', 'straight', 'straight_from_start', 'corner', 'corner_from_start', 'end', 'end_from_start'];
const MERGED = ['0', '01', '0123', '013', '03', '0_seam'];
const CORE_IMAGES = [
  ...['board@2x', 'spawn', 'spell', 'attack', 'hover@2x', 'mana_idle', 'box', 'path_attack'].map(part => [`tile-${part.replace('@2x', '').replace('mana_idle', 'mana').replace('path_attack', 'path-attack')}`, `tiles/tile_${part}.png`]),
  ['terrain-wall', 'tiles/wall-barricade-v2.png'],
  ['terrain-rough', 'tiles/rough-debris-v2.png'],
  ...['attack', 'attack-bw', 'health', 'health-bw'].map(part => [`stat-${part}`, `ui/icon_${part.replace('attack', 'atk').replace('health', 'hp').replace('-bw', '_bw')}.png`]),
  ...MOVE_PARTS.map(part => [`tile-path-move-${part}`, `tiles/tile_path_move_${part}.png`]),
  ...MERGED.map(part => [`tile-merged-${part}`, `tiles/tile_merged_large_${part}@2x.png`]),
];

export class CardAssetLoader {
  constructor(renderer) {
    this.renderer = renderer;
    this.jobs = new Map();
    this.failed = new Set();
    this.canvases = new Map();
    this.visible = new Set();
    this.optionalActive = 0;
    this.battleActive = 0;
    this.coreJob = null;
    this.fullJob = null;
    this.observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) this.visible.add(entry.target);
        else this.visible.delete(entry.target);
      }
      this.pumpVisible();
    }) : { observe() {}, unobserve() {}, disconnect() {} };
    // Renderers recreate card nodes when changing pages. Release detached nodes
    // instead of retaining every canvas ever displayed during a long session.
    this.mutations = typeof MutationObserver === 'function' ? new MutationObserver(() => {
      for (const canvas of this.canvases.keys()) if (!canvas.isConnected) this.forget(canvas);
    }) : { observe() {}, disconnect() {} };
    if (document.body) this.mutations.observe(document.body, { childList: true, subtree: true });
    window.addEventListener?.('pagehide', event => {
      // BFCache keeps this renderer alive; its observers must resume with it.
      if (event.persisted) return;
      this.observer.disconnect(); this.mutations.disconnect(); this.canvases.clear(); this.visible.clear();
    });
  }

  hasCard(id) {
    const card = getCard(id);
    if (!card) return false;
    if (card.type === 'spell') return !!this.renderer.images.get(`spell-${card.effect}`);
    const atlas = this.renderer.atlases.get(card.sprite?.sheet);
    return !!(atlas?.image && atlas.animations.idle?.frames.length);
  }

  requestCanvas(canvas, id) {
    if (!getCard(id) || this.hasCard(id)) { if (this.canvases.has(canvas)) this.forget(canvas); return; }
    if (this.canvases.get(canvas) === id) return;
    this.canvases.set(canvas, id);
    this.observer.observe(canvas);
    if (this.visible.has(canvas)) queueMicrotask(() => this.pumpVisible());
  }

  forget(canvas) { this.observer.unobserve(canvas); this.canvases.delete(canvas); this.visible.delete(canvas); }

  pumpVisible() {
    if (this.battleActive) return;
    for (const canvas of [...this.visible]) {
      if (!canvas.isConnected) { this.forget(canvas); continue; }
      const id = this.canvases.get(canvas);
      if (this.hasCard(id)) { this.renderer.drawCardArt(canvas, id); this.forget(canvas); continue; }
      if (this.failed.has(id) || this.jobs.has(id)) continue;
      if (this.optionalActive >= 2) break;
      this.optionalActive++;
      this.loadCard(id).catch(() => {}).finally(() => { this.optionalActive--; this.pumpVisible(); });
    }
  }

  retryVisible() { this.failed.clear(); this.pumpVisible(); }

  loadCard(id, priority = 0) {
    const card = getCard(id);
    if (!card) return Promise.reject(new Error(`未知卡牌 ${id}`));
    const spec = EFFECT_MANIFEST.spellArtSpecs?.[id];
    const paths = card.type === 'spell' ? [spec?.img ?? card.art, spec?.plist] : [`${ROOT}units/${card.sprite.sheet}.png`, `${ROOT}units/${EFFECT_MANIFEST.bodies?.[id]?.plist ?? card.sprite.sheet}.plist`];
    if (priority) paths.filter(Boolean).forEach(prioritizeAsset);
    if (this.hasCard(id)) return Promise.resolve();
    if (this.jobs.has(id)) return this.jobs.get(id);
    const options = { priority };
    const job = (async () => {
      if (card.type === 'spell') {
        const art = await assetImage(paths[0], options);
        if (!art) throw new Error(`“${card.name}”画面未能加载，请重试。`);
        let icon = art;
        if (spec) {
          const response = await assetFetch(spec.plist, options);
          const frame = framesWithPrefix(parsePlist(await response.text()), spec.prefix)[0];
          if (!frame) throw new Error(`“${card.name}”图集缺少画面。`);
          icon = document.createElement('canvas');
          icon.width = frame.canvasWidth || frame.sourceWidth || frame.width;
          icon.height = frame.canvasHeight || frame.sourceHeight || frame.height;
          drawAtlasFrame(icon.getContext('2d'), art, frame, icon.width / 2, icon.height / 2);
        }
        this.renderer.images.set(`spell-${card.effect}`, icon);
      } else {
        const [image, response] = await Promise.all([assetImage(paths[0], options), assetFetch(paths[1], options)]);
        if (!image) throw new Error(`“${card.name}”画面未能加载，请重试。`);
        const frames = parsePlist(await response.text());
        const states = { ...(EFFECT_MANIFEST.bodies?.[id]?.states ?? {}),
          breathing: { prefix: card.sprite.breathingPrefix, frameMs: card.sprite.breathingFrameMs ?? 120 },
          idle: { prefix: card.sprite.idlePrefix, frameMs: card.sprite.idleFrameMs ?? 80 },
          run: { prefix: card.sprite.runPrefix, frameMs: card.sprite.runFrameMs ?? 80 },
        };
        const animations = {};
        for (const [state, raw] of Object.entries(states)) {
          const value = Array.isArray(raw) ? { prefix: raw[0], frameMs: raw[1] } : raw;
          animations[state] = { frames: framesWithPrefix(frames, value?.prefix ?? ''), frameMs: value?.frameMs ?? 80 };
        }
        if (!animations.idle.frames.length) throw new Error(`“${card.name}”图集缺少待机画面。`);
        this.renderer.atlases.set(card.sprite.sheet, { image, animations });
      }
      this.failed.delete(id);
      this.renderer.cardArt.delete(id);
      this.renderer.cardIdleLayouts.delete(id);
      for (const [canvas, requested] of [...this.canvases]) if (requested === id && canvas.isConnected) {
        this.renderer.drawCardArt(canvas, id); this.forget(canvas);
      }
      if (this.renderer.canvas.dispatchEvent && typeof CustomEvent === 'function') this.renderer.canvas.dispatchEvent(new CustomEvent('card-art-ready', { detail: { id } }));
    })().catch(error => {
      this.failed.add(id);
      if (this.renderer.canvas.dispatchEvent && typeof CustomEvent === 'function') this.renderer.canvas.dispatchEvent(new CustomEvent('card-art-error', { detail: { id, error } }));
      throw error;
    }).finally(() => { this.jobs.delete(id); });
    this.jobs.set(id, job);
    return job;
  }

  loadCards(ids, { priority = 0, onProgress = () => {} } = {}) {
    const cards = [...new Set(ids)].filter(id => getCard(id));
    let completed = 0;
    onProgress({ completed, total: cards.length });
    return Promise.all(cards.map(id => this.loadCard(id, priority).finally(() => onProgress({ completed: ++completed, total: cards.length }))));
  }

  loadCore() {
    if (this.coreJob) return this.coreJob;
    this.coreJob = Promise.all(CORE_IMAGES.map(async ([key, path]) => {
      const image = await assetImage(ROOT + path, { priority: 1 });
      if (!image) throw new Error('战场标记未能加载，请重试。');
      this.renderer.images.set(key, image);
    })).then(async () => {
      if (!globalThis.FontFace || !document.fonts) return;
      try { const face = await assetFont(new FontFace('Duelyst Lato', `url(${ROOT}fonts/Lato-Regular.ttf)`)); document.fonts.add(face); } catch { /* Readable font fallback. */ }
    }).catch(error => { this.coreJob = null; throw error; });
    return this.coreJob;
  }

  async loadBattle(state, onProgress = () => {}) {
    if (!state?.players?.length) throw new Error('战斗状态不可用，未进入战场。');
    const ids = battleCardIds(state);
    this.battleActive++;
    try {
      await Promise.all([this.loadCore(), this.loadCards(ids, { priority: 1, onProgress }), this.renderer.effects.load(ids)]);
      this.renderer.ready = true;
      return { cardIds: ids };
    } finally { this.battleActive--; this.pumpVisible(); }
  }

  loadAll(onProgress) {
    if (this.fullJob) return this.fullJob;
    const jobs = [
      ...CORE_IMAGES.map(async ([key, path]) => this.renderer.images.set(key, await assetImage(ROOT + path))),
      ...Object.values(CARDS).map(card => this.loadCard(card.id)),
      this.renderer.effects.load(),
    ];
    let completed = 0;
    const notify = () => { try { onProgress?.({ completed, total: jobs.length }); } catch { /* Presentation listener only. */ } };
    notify();
    this.fullJob = Promise.allSettled(jobs.map(async job => { try { return await job; } finally { completed++; notify(); } }))
      .then(results => {
        const missingCardIds = Object.values(CARDS).filter(card => !this.hasCard(card.id)).map(card => card.id);
        const failure = results.find(result => result.status === 'rejected');
        if (missingCardIds.length || failure) {
          const error = failure?.reason instanceof Error ? failure.reason : new Error('卡牌画面未加载完成，请重试。');
          error.missingCardIds = missingCardIds;
          throw error;
        }
        this.renderer.ready = true;
        return { failures: [...assetFailures] };
      })
      .catch(error => { this.fullJob = null; throw error; });
    return this.fullJob;
  }
}
