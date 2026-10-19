/* Visual feedback owns no game state and never synthesizes or cancels activation. */
const EXCLUDED = '.recruitment-dialog,.recruitment-presentation,.resource-rewards-dialog,.reward-presentation,.game-card,.hand-card,.hand-zone,.training-card-open,.spell-card-open,.expedition-codex-card,.deck-card-detail,.atlas-level,.squad-slot,#bbs-button,#unit-inspect,.card-dialog,.expedition-card-dialog,canvas';
const SURFACES = '.game-dialog,.hero-dialog,.hero-effect-dialog,#audio-settings,#cloud-dialog,#objective-dialog,#game-result,#confirm-screen';

export function installUIFeedback(doc = document) {
  const win = doc.defaultView;
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  const active = new Map();
  const animations = new Map();
  const glows = new Map();
  const surfaces = new Map();
  let pointer = null;
  let keyboard = null;
  let disposed = false;
  const allowed = () => !motion.matches && !doc.hidden && !disposed;
  const buttonFor = target => {
    const button = target?.closest?.('button');
    return button && !button.closest(EXCLUDED) ? button : null;
  };
  const enabled = button => button?.isConnected && !button.matches(':disabled,[aria-disabled="true"]') && !button.closest('[hidden],[inert]');
  function cancelAnimation(node) {
    animations.get(node)?.cancel();
    animations.delete(node);
  }
  function play(node, frames, options) {
    cancelAnimation(node);
    if (!allowed() || !node.animate) return;
    const animation = node.animate(frames, options);
    animations.set(node, animation);
    animation.onfinish = () => {
      if (animations.get(node) === animation) animations.delete(node);
    };
  }
  function release() {
    pointer = null;
    keyboard = null;
    for (const [button, observer] of active) {
      button.classList.remove('ui-feedback-pressed');
      observer.disconnect();
    }
    active.clear();
  }
  function press(button) {
    release();
    if (!enabled(button) || !allowed()) return false;
    button.classList.add('ui-feedback-button','ui-feedback-pressed');
    const observer = new MutationObserver(() => { if (!enabled(button)) release(); });
    observer.observe(button, { attributes:true, attributeFilter:['disabled','aria-disabled','hidden'] });
    active.set(button, observer);
    return true;
  }
  function clearGlow(button) {
    const entry = glows.get(button);
    if (!entry) return;
    win.clearTimeout(entry.timer);
    entry.node.remove();
    button.classList.remove('ui-feedback-relative');
    glows.delete(button);
  }
  function flash(button) {
    if (!allowed() || !enabled(button) || button.matches('.menu-music-toggle')) return;
    clearGlow(button);
    const glow = doc.createElement('span');
    glow.className = 'ui-feedback-glint';
    glow.setAttribute('aria-hidden', 'true');
    if (win.getComputedStyle(button).position === 'static') button.classList.add('ui-feedback-relative');
    button.append(glow);
    glows.set(button, { node:glow, timer:win.setTimeout(() => clearGlow(button), 240) });
  }
  function down(event) {
    if (!event.isPrimary || event.button !== 0) return;
    const button = buttonFor(event.target);
    if (!button || !press(button)) return;
    const rect = button.getBoundingClientRect();
    pointer = { button, id:event.pointerId, x:event.clientX, y:event.clientY, left:rect.left, top:rect.top };
    // Presentation observes document-level input without taking pointer capture
    // away from a control or changing the browser's native click/scroll target.
  }
  function move(event) {
    if (!pointer || pointer.id !== event.pointerId) return;
    const bounds = pointer.button.getBoundingClientRect();
    if (Math.hypot(event.clientX-pointer.x, event.clientY-pointer.y) > 10 || event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) release();
  }
  function up(event) {
    if (!pointer || pointer.id !== event.pointerId) return;
    const button = pointer.button;
    release();
    flash(button);
  }
  function keydown(event) {
    if (event.repeat || !['Enter',' '].includes(event.key)) return;
    const button = buttonFor(event.target);
    if (button && press(button)) keyboard = { button, key:event.key };
  }
  function keyup(event) {
    if (!keyboard || keyboard.key !== event.key) return;
    const button = keyboard.button;
    release();
    flash(button);
  }
  const isVisible = node => node.isConnected && !node.closest('[hidden]') && (node.tagName !== 'DIALOG' || node.open) && win.getComputedStyle(node).display !== 'none';
  function checkSurface(node) {
    const entry = surfaces.get(node);
    if (!entry) return;
    const visible = isVisible(node);
    if (visible === entry.visible) return;
    entry.visible = visible;
    const target = node.querySelector(':scope > .result-panel,:scope > .confirm-panel') || node;
    cancelAnimation(target);
    if (visible) play(target, [{ opacity:0, translate:'0 5px', scale:'.985' }, { opacity:1, translate:'0 0', scale:'1' }], { duration:170, easing:'cubic-bezier(.2,.7,.3,1)' });
    else release();
  }
  function discover(root, animateNew = true) {
    const nodes = [...(root.matches?.(SURFACES) ? [root] : []), ...root.querySelectorAll?.(SURFACES) || []];
    for (const node of nodes) {
      if (surfaces.has(node) || node.closest(EXCLUDED)) continue;
      const observer = new MutationObserver(() => checkSurface(node));
      surfaces.set(node, { observer, visible:animateNew ? false : isVisible(node) });
      observer.observe(node, { attributes:true, attributeFilter:['hidden','open','class'] });
      checkSurface(node);
    }
    // The home renderer replaces the portrait when changing factions; animate only that image.
    if (animateNew) {
      const portraits = [...(root.matches?.('#expedition-home .menu-hero') ? [root] : []), ...root.querySelectorAll?.('#expedition-home .menu-hero') || []];
      for (const portrait of portraits) play(portrait, [{opacity:.4, scale:'.98'}, {opacity:1, scale:'1'}], {duration:180, easing:'ease-out'});
    }
  }
  discover(doc, false);
  const tree = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1 && !node.matches('.ui-feedback-glint')) discover(node);
    for (const [node, entry] of surfaces) {
      if (!node.isConnected) { entry.observer.disconnect(); cancelAnimation(node); surfaces.delete(node); }
    }
    if ([...active.keys()].some(button => !enabled(button))) release();
    for (const button of glows.keys()) if (!button.isConnected) clearGlow(button);
  });
  tree.observe(doc.body, {childList:true, subtree:true});
  const clear = () => {
    release();
    for (const node of animations.keys()) cancelAnimation(node);
    for (const button of glows.keys()) clearGlow(button);
  };
  const visibility = () => { if (doc.hidden) clear(); };
  // Pointerdown precedes the old control's focusout. Focus loss releases only
  // a keyboard press; pointer feedback follows movement, cancellation and up.
  const focusout = event => {
    if (keyboard?.button.contains(event.target)) release();
  };
  const pointercancel = event => { if (pointer?.id === event.pointerId) release(); };
  const scroll = () => {
    if (!pointer) return;
    const rect = pointer.button.getBoundingClientRect();
    if (Math.abs(rect.left-pointer.left) > .5 || Math.abs(rect.top-pointer.top) > .5) release();
  };
  const listeners = [[doc,'pointerdown',down],[doc,'pointermove',move],[doc,'pointerup',up],[doc,'pointercancel',pointercancel],[doc,'keydown',keydown],[doc,'keyup',keyup],[doc,'scroll',scroll],[doc,'focusout',focusout],[doc,'visibilitychange',visibility],[win,'blur',clear],[win,'pagehide',clear]];
  for (const [target,type,handler] of listeners) target.addEventListener(type,handler,{capture:true,passive:true});
  motion.addEventListener('change',clear);
  return () => {
    clear(); disposed = true; tree.disconnect();
    for (const {observer} of surfaces.values()) observer.disconnect();
    surfaces.clear();
    for (const [target,type,handler] of listeners) target.removeEventListener(type,handler,true);
    motion.removeEventListener('change',clear);
  };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => installUIFeedback(), {once:true});
  else installUIFeedback();
}
