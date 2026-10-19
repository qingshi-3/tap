import { assetImage, assetFont } from './asset-loading.js';
import { getHero } from './factions.js';
import { battleCardIds } from './battle-assets.js';
import { getCard } from './cards.js';
import { createBattleTips } from './battle-tips.js';
import { getTrialBackground } from './trial-backgrounds.js';

const BACKGROUNDS = [
  'battlemap2_background.png', 'battlemap2_middleground.png',
  'battlemap2_foreground_001.png', 'battlemap2_foreground_002.png',
].map(name => new URL(`../assets/maps/${name}`, import.meta.url).href);
const absoluteAsset = path => new URL(path, document.baseURI).href;
const nextPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

// Authored battle shell only. Hidden collection, recruitment and other-faction
// card frames belong to their own visible UI, not to the battle entry gate.
function sceneImages(state) {
  const backdrop = state?.mode === 'challenge' ? getTrialBackground(state.levelId) : null;
  const paths = new Set(backdrop ? Object.values(backdrop).filter(Boolean).map(absoluteAsset) : BACKGROUNDS);
  for (const path of ['ui/portrait-frame.png', 'ui/icon-mana.png', 'ui/button-secondary.png', 'ui/overview-frame.png', 'ui/keywords/keyword-attack.svg', 'ui/keywords/health.svg']) paths.add(absoluteAsset('./assets/' + path));
  for (const player of state?.players ?? []) {
    const hero = getHero(player.generalId);
    if (hero?.portrait) paths.add(absoluteAsset(hero.portrait));
  }
  for (const id of battleCardIds(state)) {
    const card = getCard(id);
    const frame = card.faction === 0 ? 'neutral-unit' : 'f' + card.faction + '-' + (card.type === 'spell' ? 'spell' : 'unit');
    paths.add(absoluteAsset('./assets/card-backgrounds/' + frame + '.png'));
  }
  return [...paths];
}

export class SceneLoading {
  constructor({ renderer, prepareUI = async () => {} }) {
    this.renderer = renderer;
    this.prepareUI = prepareUI;
    this.busy = false;
    this.images = new Map();
    this.dialog = document.createElement('dialog');
    this.dialog.id = 'scene-loading';
    this.dialog.className = 'scene-loading';
    this.dialog.setAttribute('aria-labelledby', 'scene-loading-title');
    this.dialog.innerHTML = `<div class="scene-loading-content">
      <img class="scene-loading-crest" src="./assets/metagame/original/crest-f1.png" alt="">
      <h2 id="scene-loading-title">准备战场</h2>
      <p class="scene-loading-status" role="status" aria-live="polite">正在准备画面资源…</p>
      <progress class="scene-loading-progress" max="1" value="0" aria-label="战场资源准备进度"></progress>
      <p class="scene-loading-count"></p>
      <div class="scene-loading-actions"><button type="button" data-loading-action="retry" hidden>重新加载</button><button type="button" data-loading-action="cancel">返回</button></div>
    </div>`;
    document.body.append(this.dialog);
    this.tips = createBattleTips({ root: this.dialog });
    this.status = this.dialog.querySelector('.scene-loading-status');
    this.progress = this.dialog.querySelector('progress');
    this.count = this.dialog.querySelector('.scene-loading-count');
    this.retry = this.dialog.querySelector('[data-loading-action="retry"]');
    this.cancel = this.dialog.querySelector('[data-loading-action="cancel"]');
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.cancelRequest?.(); });
    this.cancel.addEventListener('click', () => this.cancelRequest?.());
    this.retry.addEventListener('click', () => this.retryRequest?.());
  }

  async prepare(state, onProgress) {
    const paths = sceneImages(state), local = { completed: 0, total: paths.length + 2 };
    let render = { completed: 0, total: 1 };
    const update = () => onProgress({ completed: render.completed + local.completed, total: render.total + local.total });
    const jobs = paths.map(async path => {
      if (!this.images.has(path)) {
        const image = await assetImage(path, { priority: 1 });
        if (!image) throw new Error('战场画面未能加载，请检查网络后重试。');
        if (image) this.images.set(path, image);
      }
    });
    jobs.push((async () => {
      if (!document.fonts) return;
      // Bound font readiness too; system text remains readable when unavailable.
      await assetFont({ family: 'scene-ui', load: () => Promise.all([
        document.fonts.load('400 16px "Luxiang UI"'), document.fonts.load('400 16px Averta'),
      ]) }).catch(() => {});
    })());
    jobs.push(Promise.resolve().then(() => this.prepareUI(state)));
    const rendering = this.renderer.loadBattle(state, value => { render = value; update(); });
    update();
    const results = await Promise.allSettled([rendering, ...jobs.map(async job => {
      try { await job; } finally { local.completed++; update(); }
    })]);
    const failed = results.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
    if (sceneImages(state).some(path => !this.images.has(path))) throw new Error('战场背景未能加载，请检查网络后重试。');
  }

  // Commit owns the route/state change. Until it runs, cancellation cannot
  // replace an active save or expose a half-loaded scene.
  async run(commit, { title = '准备战场', isCurrent = () => true, battle = null } = {}) {
    if (this.busy) return false;
    this.busy = true;
    const returnFocus = document.activeElement;
    let active = true, committed = false, resolveCancel;
    const cancelled = new Promise(resolve => { resolveCancel = resolve; });
    this.cancelRequest = () => { active = false; resolveCancel('cancel'); this.retryRequest?.('cancel'); };
    this.dialog.querySelector('h2').textContent = title;
    this.retry.hidden = true;
    this.cancel.disabled = false;
    this.progress.value = 0;
    this.count.textContent = '';
    this.status.textContent = '正在准备画面资源…';
    this.dialog.showModal();
    this.tips.setVisible(true);
    this.cancel.focus();
    try {
      // Paint the loading screen before atlas preparation can occupy the CPU.
      await nextPaint();
      while (active && isCurrent()) {
        this.retry.hidden = true;
        this.progress.hidden = this.count.hidden = false;
        this.status.textContent = '正在准备画面资源…';
        const result = await Promise.race([
          this.prepare(battle, ({ completed, total }) => {
            if (!active) return;
            this.progress.max = total; this.progress.value = completed;
            this.count.textContent = `${completed} / ${total}`;
          }).then(() => ({ ok: true }), error => ({ error })),
          cancelled,
        ]);
        if (!active || !isCurrent() || result === 'cancel') return false;
        if (result.error) {
          this.tips.setVisible(false);
          this.status.textContent = result.error.message || '资源准备失败，请重试。';
          this.progress.hidden = this.count.hidden = true;
          this.retry.hidden = false; this.retry.focus();
          await new Promise(resolve => { this.retryRequest = resolve; });
          this.retryRequest = null;
          this.tips.setVisible(true);
          continue;
        }
        this.status.textContent = '正在进入战场…';
        this.cancel.disabled = true;
        this.cancelRequest = null;
        if (await commit() === false) return false;
        committed = true;
        await nextPaint();
        return true;
      }
      return false;
    } finally {
      active = false;
      this.cancelRequest = null; this.retryRequest = null;
      this.dialog.close();
      this.tips.setVisible(false);
      this.busy = false;
      if (!committed && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    }
  }
}
