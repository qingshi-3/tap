// Reading owns the held gesture; movement cancels the pending timer first.
export function createPressInspect(surface, hooks) {
  let press = null;
  function cancel() { clearTimeout(press?.timer); press = null; }
  surface.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    cancel();
    const value = hooks.resolve(event);
    if (value == null) return;
    const current = press = { id:event.pointerId, x:event.clientX, y:event.clientY, token:hooks.token(), value, held:false };
    current.timer = setTimeout(() => {
      if (press !== current || current.token !== hooks.token()) return;
      current.held = true;
      hooks.show(value);
    }, 400);
  }, true);
  surface.addEventListener('pointermove', event => {
    if (!press || press.id !== event.pointerId) return;
    if (press.held) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (Math.hypot(event.clientX-press.x,event.clientY-press.y)>9) { cancel(); hooks.moved?.(); }
  }, true);
  surface.addEventListener('pointerup', event => {
    if (!press || press.id !== event.pointerId) return;
    const current = press;
    const held = current.held; cancel();
    const tapped = !held && current.token === hooks.token() && hooks.tap?.(current.value);
    if (held || tapped) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  surface.addEventListener('pointercancel', cancel, true);
  surface.addEventListener('lostpointercapture', () => { if (!press?.held) cancel(); }, true);
  document.addEventListener('pointerdown', event => { if (!event.isPrimary) cancel(); }, true);
  window.addEventListener('keydown', event => { if (event.key === 'Escape') cancel(); });
  surface.addEventListener('contextmenu', event => event.preventDefault());
  for (const name of ['pagehide','resize','blur']) window.addEventListener(name,cancel);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  return { cancel, invalidate() { if (press && press.token !== hooks.token()) cancel(); } };
}
