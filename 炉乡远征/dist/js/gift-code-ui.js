export class GiftCodeUI {
  constructor({ progress, onClose, onReward }) {
    this.progress = progress;
    this.onClose = onClose;
    this.onReward = onReward;
    this.dialog = document.getElementById('gift-code-dialog');
    this.input = document.getElementById('gift-code-input');
    this.submit = document.getElementById('gift-code-submit');
    this.result = document.getElementById('gift-code-status');
    this.claimedInput = null;
    this.busy = false;
    this.input.addEventListener('input', () => {
      this.result.textContent = '';
      delete this.result.dataset.state;
      this.refresh();
    });
    document.getElementById('gift-code-form').addEventListener('submit', event => {
      event.preventDefault();
      this.redeem();
    });
    document.getElementById('gift-code-close').addEventListener('click', () => this.close());
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
    // Keep the whole compact form reachable when a mobile keyboard resizes the visual viewport.
    this.resize = () => {
      if (!this.dialog.open) return;
      const viewport = window.visualViewport;
      this.dialog.style.setProperty('--gift-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
      this.dialog.style.setProperty('--gift-viewport-top', `${viewport?.offsetTop ?? 0}px`);
    };
  }
  normalizedInput() { return this.input.value.trim().toUpperCase(); }
  refresh() {
    this.submit.disabled = this.busy || !this.normalizedInput() || this.normalizedInput() === this.claimedInput;
  }
  open() {
    this.input.value = '';
    this.result.textContent = '';
    delete this.result.dataset.state;
    this.claimedInput = null;
    this.refresh();
    if (!this.dialog.open) this.dialog.showModal();
    window.visualViewport?.addEventListener('resize', this.resize);
    window.visualViewport?.addEventListener('scroll', this.resize);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.input.focus({ preventScroll: true });
  }
  close() {
    this.input.blur();
    this.dialog.close();
    window.visualViewport?.removeEventListener('resize', this.resize);
    window.visualViewport?.removeEventListener('scroll', this.resize);
    window.removeEventListener('resize', this.resize);
    this.onClose?.();
  }
  redeem() {
    if (this.submit.disabled || this.busy) return;
    this.busy = true;
    this.refresh();
    try {
      const receipt = this.progress.redeemGiftCode(this.input.value);
      if (receipt.ok) {
        this.claimedInput = this.normalizedInput();
        this.result.dataset.state = 'success';
        this.result.textContent = `${receipt.coins}金币已到账`;
        this.onReward?.(receipt);
      } else {
        this.result.dataset.state = 'error';
        this.result.textContent = this.errorMessage(receipt.error);
      }
    } catch {
      this.result.dataset.state = 'error';
      this.result.textContent = '领取失败，请重试。';
    } finally {
      this.busy = false;
      this.refresh();
    }
  }
  errorMessage(error = '') {
    if (error.includes('其他页面更新')) return '存档已在其他页面更新，请刷新后重试。';
    if (error.startsWith('写入远征存档失败')) return '保存失败，奖励尚未领取，请重试。';
    if (error.includes('冻结的招募')) return '请先保存上次招募结果，再领取奖励。';
    return error || '领取失败，请重试。';
  }
}
