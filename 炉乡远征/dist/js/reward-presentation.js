const node = (tag, className, text = '') => {
  const value = document.createElement(tag); value.className = className; value.textContent = text; return value;
};

// Presentation consumes an already committed receipt; it never issues rewards.
export class RewardPresentation {
  constructor() {
    this.seen = new Set();
    this.dialog = node('dialog', 'reward-presentation');
    this.dialog.setAttribute('aria-labelledby', 'reward-presentation-title');
    const title = node('h2', '', '奖励已到账'); title.id = 'reward-presentation-title';
    this.art = node('div', 'reward-presentation-art'); this.art.setAttribute('aria-hidden', 'true');
    this.image = node('img', 'reward-presentation-icon'); this.image.alt = '';
    this.art.append(this.image);
    for (let i = 0; i < 6; i++) { const spark = node('i', 'reward-presentation-spark'); spark.style.setProperty('--spark', i); this.art.append(spark); }
    this.amount = node('p', 'reward-presentation-amount'); this.amount.setAttribute('aria-live', 'polite');
    this.button = node('button', 'reward-presentation-continue', '继续'); this.button.type = 'button'; this.button.onclick = () => this.close();
    this.dialog.append(title, this.art, this.amount, this.button);
    this.dialog.addEventListener('close', () => {
      const target = this.returnFocus?.isConnected ? this.returnFocus : this.returnDialog?.open ? this.returnDialog.querySelector('button:not(:disabled)') : null;
      target?.focus({ preventScroll:true });
    });
    this.dialog.addEventListener('keydown', event => { if (event.key === 'Tab') { event.preventDefault(); this.button.focus(); } });
    window.addEventListener('pagehide', () => this.close());
    document.body.append(this.dialog);
  }
  show({ kind, amount, requestId, duplicate = false }) {
    if (duplicate || !requestId || this.seen.has(requestId) || kind !== 'gold' || !Number.isSafeInteger(amount) || amount <= 0) return false;
    this.seen.add(requestId);
    if (!this.dialog.open) {
      this.returnFocus = document.activeElement;
      this.returnDialog = this.returnFocus?.closest('dialog') || [...document.querySelectorAll('dialog[open]')].at(-1);
      // The source modal refreshes its buttons after saving the receipt.
      if (this.returnFocus === document.body && this.returnDialog) this.returnFocus = null;
    }
    this.dialog.dataset.kind = kind;
    this.image.src = './assets/metagame/original/resource-gold.png';
    this.amount.textContent = `+${amount} 金币`;
    if (!this.dialog.open) this.dialog.showModal();
    this.button.focus({ preventScroll:true });
    return true;
  }
  close() { if (this.dialog.open) this.dialog.close(); }
}
