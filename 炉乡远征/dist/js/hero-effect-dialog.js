let dialog = null, returnTarget = null, observer = null;

export const isHeroEffectDialogOpen = () => Boolean(dialog?.open);

export function closeHeroEffectDialog({restoreFocus = true} = {}) {
  if (!dialog) return;
  const target = returnTarget;
  observer?.disconnect(); observer = null;
  dialog.close(); dialog.remove(); dialog = null; returnTarget = null;
  if (restoreFocus && target?.isConnected && !target.closest('[hidden]')) target.focus({preventScroll:true});
}

// This is an explanation only. No battle command or skill handler is connected.
export function openHeroEffectDialog({name, effect, trigger, owner}) {
  closeHeroEffectDialog({restoreFocus:false});
  returnTarget = trigger;
  const surface = document.createElement('dialog');
  surface.className = 'hero-effect-dialog';
  surface.setAttribute('aria-label', `${name}效果`);
  const copy = document.createElement('div');
  copy.className = 'hero-effect-copy'; copy.tabIndex = 0; copy.textContent = effect;
  const back = document.createElement('button');
  back.type = 'button'; back.className = 'hero-effect-back'; back.textContent = '返回';
  back.addEventListener('click', () => closeHeroEffectDialog());
  surface.append(copy, back);
  // Keep the backdrop until the closing click has ended: its pointerup can never
  // land on the board and finish a move, attack or hand gesture.
  for (const type of ['pointerdown','pointerup','pointermove','click','dblclick','contextmenu']) {
    surface.addEventListener(type, event => {
      event.stopPropagation();
      if (type === 'contextmenu') event.preventDefault();
      if (type === 'click' && event.target === surface) {
        const r = surface.getBoundingClientRect();
        if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeHeroEffectDialog();
      }
    });
  }
  surface.addEventListener('cancel', event => { event.preventDefault(); event.stopPropagation(); closeHeroEffectDialog(); });
  surface.addEventListener('keydown', event => event.stopPropagation());
  document.body.append(surface); dialog = surface; surface.showModal(); copy.focus({preventScroll:true});
  if (owner) {
    observer = new MutationObserver(() => {
      if (!owner.isConnected || owner.closest('[hidden]')) closeHeroEffectDialog({restoreFocus:false});
    });
    for (let node = owner; node; node = node.parentElement) observer.observe(node,{attributes:true,attributeFilter:['hidden']});
  }
}
