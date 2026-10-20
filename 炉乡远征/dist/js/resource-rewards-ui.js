import { watchDailyAdRefresh } from './daily-ad-rewards.js';
import { rewardedAd } from './rewarded-ad.js';

const element = (tag, text = '') => { const node = document.createElement(tag); node.textContent = text; return node; };
// Both entry points use the existing victory ledgers. Completed playback is only
// retained in this open session, allowing a failed save to retry without replay.
export class ResourceRewardsUI {
  constructor({ progress, ad = rewardedAd, onClose = () => {}, onReward = () => {} }) {
    this.onReward = onReward;
    this.progress = progress; this.ad = ad; this.onClose = onClose; this.session = null; this.notice = '';
    this.dialog = element('dialog'); this.dialog.className = 'resource-rewards-dialog';
    this.dialog.setAttribute('aria-label', '每日补给');
    this.dialog.addEventListener('close', () => { this.stopDailyRefresh?.(); this.stopDailyRefresh = null; this.invalidate(false); this.onClose(); const trigger = this.returnFocus?.isConnected ? this.returnFocus : document.querySelector('[data-action="resource-rewards"]'); trigger?.focus({ preventScroll:true }); });
    this.dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const targets = [...this.dialog.querySelectorAll('button:not(:disabled)')];
      const first = targets[0], last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    window.addEventListener('pagehide', () => this.invalidate());
    document.body.append(this.dialog);
  }
  open() { if (this.dialog.open) return; this.returnFocus = document.activeElement; this.notice = ''; this.render(); this.dialog.showModal(); this.dialog.querySelector('button').focus(); this.stopDailyRefresh = watchDailyAdRefresh(() => { if(this.dialog.open&&!this.session)this.render(); }); }
  close() { this.invalidate(); }
  invalidate(close = true) {
    const session = this.session; this.session = null;
    if (session) { if (session.busy) this.ad.cancel(); this.cancel(session); }
    if (close && this.dialog.open) this.dialog.close();
  }
  cancel(session) { return this.progress.cancelDailyAd(session.kind,session.requestId); }
  render() {
    const header = element('header'), title = element('h2', '每日补给'), back = element('button', '返回'); back.type = 'button'; back.onclick = () => this.close(); header.append(back, title);
    const grid = element('section'); grid.className = 'resource-rewards-options';
    for (const [kind, name, icon] of [['gold', '金币', 'resource-gold.png']]) {
      const offer = this.progress.resourceRewardOffer(kind), card = element('article'); card.dataset.rewardKind = kind;
      const image = element('img'); image.src = `./assets/metagame/original/${icon}`; image.alt = '';
      const saved = this.session?.kind === kind && this.session.earned;
      const amount = offer.range;
      const button = element('button', saved ? '重试保存奖励' : this.session?.busy && this.session.kind === kind ? '广告播放中…' : offer.claimed ? '今日已领取' : '看广告领取');
      button.type = 'button'; button.dataset.rewardAction = kind; button.disabled = !!this.session?.busy || (!saved && !offer.eligible) || !!(this.session && this.session.kind !== kind);
      button.onclick = () => void this.watch(kind);
      card.append(image, element('h3', name), element('p', `${amount} 金币`), element('p', offer.reason), button); grid.append(card);
    }
    const notice = element('p', this.notice || '奖励随机，完整观看后到账。'); notice.className = 'resource-rewards-notice'; notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite');
    this.dialog.replaceChildren(header, grid, notice);
  }
  async watch(kind) {
    if (this.session?.busy || (this.session && this.session.kind !== kind)) return;
    const offer = this.progress.resourceRewardOffer(kind);
    if (!this.session?.earned && !offer.eligible) return;
    const session = this.session || { kind, requestId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, earned:false };
    this.session = session; session.busy = true;
    const valid = () => this.session === session && this.dialog.open;
    try {
      if (!session.earned) {
        const begin = this.progress.beginDailyAd(kind,session.requestId);
        if (!begin.ok) { this.notice = begin.error; this.session = null; return; }
        this.render(); const result = await this.ad.show({ isContextValid:valid });
        if (!valid()) return;
        if (result.status !== 'completed') { this.cancel(session); this.session = null; this.notice = result.message || '未完成观看，没有发放奖励。'; return; }
        session.earned = true;
      }
      const result = this.progress.completeDailyAd(kind,session.requestId);
      if (result.ok) { this.session = null; this.notice = `金币 +${result.amount}，已保存。`; if (!result.duplicate) this.onReward({ kind, amount:result.amount, requestId:session.requestId }); }
      else this.notice = `${result.error} 本次已看完，可重试保存；关闭后需要重新观看。`;
    } catch (error) { if (valid()) { this.notice = `奖励未保存：${error.message}`; if (!session.earned) { this.cancel(session); this.session = null; } } }
    finally { session.busy = false; if (this.dialog.open) this.render(); }
  }
}
