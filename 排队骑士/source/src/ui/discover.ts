import { card } from '../core/data';
import { cardText, draftCard } from '../qb/card';
import { h } from '../qb/dom';
import { kwRich } from '../qb/kwtext';
import { sfx } from '../qb/audio';
import './discover.css';

export interface DiscoverViewOffer {
  source: string;
  title: string;
  options: { def: string }[];
  targetOid?: number;
  free: boolean;
}

/** Blocks the preparation screen until the player confirms one candidate. */
export function showDiscover(host: HTMLElement, offer: DiscoverViewOffer, choose: (index: number, destination?: 'shop' | 'replace') => boolean): Promise<void> {
  return new Promise(resolve => {
    let selected = -1;
    let closing = false;
    let destination: 'shop' | 'replace' = 'replace';
    const overlay = h('div', { class: 'discover-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': offer.title });
    const row = h('div', { class: 'discover-row' });
    const confirm = h('button', { class: 'discover-confirm', disabled: true }, '选择');
    const destinations = h('div', { class: 'discover-destinations' });
    if (offer.targetOid != null && offer.source !== '转生') {
      const replace = h('button', { class: 'active', 'aria-pressed': 'true' }, '替换单位');
      const shelf = h('button', { 'aria-pressed': 'false' }, '放入货架');
      for (const [button, value] of [[replace, 'replace'], [shelf, 'shop']] as const) button.addEventListener('click', () => {
        destination = value; replace.classList.toggle('active', value === 'replace'); shelf.classList.toggle('active', value === 'shop');
        replace.setAttribute('aria-pressed', String(value === 'replace')); shelf.setAttribute('aria-pressed', String(value === 'shop'));
      });
      destinations.append(replace, shelf);
    }
    const look = h('button', { class: 'discover-look' }, '按住看战场');
    const slots = offer.options.map((option, index) => {
      const visual = draftCard(option.def);
      const slot = h('button', { class: 'discover-slot', 'aria-label': `${card(option.def).name}，选择此候选`, 'aria-pressed': 'false' },
        h('span', { class: 'discover-rays', 'aria-hidden': 'true' }), h('span', { class: 'discover-halo', 'aria-hidden': 'true' }),
        visual, h('span', { class: 'discover-price' }, offer.free ? '免费' : '3 金'),
        h('span', { class: 'discover-description' }, ...kwRich(cardText(option.def))));
      slot.style.setProperty('--delay', `${index * 80}ms`);
      slot.addEventListener('click', () => {
        if (closing) return;
        selected = index;
        slots.forEach((s, i) => { s.classList.toggle('selected', i === index); s.classList.toggle('dimmed', i !== index); s.setAttribute('aria-pressed', String(i === index)); });
        confirm.disabled = false;
        sfx.click();
      });
      return slot;
    });
    row.append(...slots);
    const reveal = (on: boolean) => overlay.classList.toggle('looking', on);
    look.addEventListener('pointerdown', e => { e.preventDefault(); look.setPointerCapture(e.pointerId); reveal(true); });
    look.addEventListener('pointerup', () => reveal(false));
    look.addEventListener('pointercancel', () => reveal(false));
    look.addEventListener('lostpointercapture', () => reveal(false));
    look.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); reveal(true); } });
    look.addEventListener('keyup', () => reveal(false));
    look.addEventListener('blur', () => reveal(false));
    confirm.addEventListener('click', () => {
      if (selected < 0 || closing || !choose(selected, offer.targetOid == null ? 'shop' : destination)) return;
      closing = true;
      confirm.disabled = true;
      const chosen = slots[selected];
      const destinationEl = offer.targetOid != null && destination === 'replace' ? host.querySelector<HTMLElement>(`.unit[data-oid="${offer.targetOid}"]`) : host.querySelector<HTMLElement>('.tray .cards');
      const target = destinationEl?.getBoundingClientRect() ?? host.querySelector<HTMLElement>('.tray')?.getBoundingClientRect();
      const from = chosen.getBoundingClientRect();
      const stage = host.getBoundingClientRect();
      if (target && stage.width) {
        const scale = 1280 / stage.width;
        chosen.style.setProperty('--fly-x', `${(target.left + target.width / 2 - from.left - from.width / 2) * scale}px`);
        chosen.style.setProperty('--fly-y', `${(target.top + target.height / 2 - from.top - from.height / 2) * scale}px`);
      }
      overlay.classList.add('departing');
      chosen.classList.add('flying');
      sfx.reward();
      const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 360;
      setTimeout(() => { overlay.remove(); resolve(); }, duration);
    });
    overlay.append(h('div', { class: 'discover-heading' }, h('span', null, offer.source), h('h2', null, offer.title === offer.source ? '发现' : offer.title)), row, destinations, confirm, look);
    host.appendChild(overlay);
    const origin = offer.targetOid != null ? host.querySelector<HTMLElement>(`.unit[data-oid="${offer.targetOid}"]`) : host.querySelector<HTMLElement>('.tray');
    const originRect = origin?.getBoundingClientRect(), hostRect = host.getBoundingClientRect();
    if (originRect && hostRect.width) slots.forEach(slot => {
      const scale = 1280 / hostRect.width;
      const centerX = slot.offsetLeft + slot.offsetWidth / 2, centerY = slot.offsetTop + slot.offsetHeight / 2;
      slot.style.setProperty('--origin-x', `${(originRect.left + originRect.width / 2 - hostRect.left) * scale - centerX}px`);
      slot.style.setProperty('--origin-y', `${(originRect.top + originRect.height / 2 - hostRect.top) * scale - centerY}px`);
    });
    slots.forEach((slot, i) => {
      const timer = setTimeout(() => { if (slot.isConnected) sfx.place(); }, i * 80 + 380);
      // Removal before a delayed sound should not leave work behind.
      slot.addEventListener('animationcancel', () => clearTimeout(timer), { once: true });
    });
    slots[0]?.focus({ preventScroll: true });
  });
}


