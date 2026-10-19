// Capture on the stable rail: selection refreshes must not steal the gesture.
export function createHandDrag(rail, hooks) {
  let gesture = null, suppressed = 0;
  const shade = document.createElement('div'); shade.className = 'hand-cancel-zone'; shade.textContent = '松手取消';
  const ghost = document.createElement('div'); ghost.className = 'hand-drag-ghost'; ghost.setAttribute('aria-hidden','true');
  document.body.append(shade, ghost);
  function clean(cancel = true) {
    const old = gesture; gesture = null;
    if (old?.dragging) suppressed = performance.now()+700;
    old?.card.classList.remove('aiming');
    shade.hidden = ghost.hidden = true;
    if (old && rail.hasPointerCapture(old.id)) rail.releasePointerCapture(old.id);
    if (old?.dragging && cancel) hooks.cancel();
  }
  clean();
  function start(e) {
    const card = e.target.closest('.hand-card');
    if (!card || card.disabled || !e.isPrimary || e.button !== 0) return;
    clean();
    gesture = { id:e.pointerId, x:e.clientX, y:e.clientY, index:[...rail.children].indexOf(card), card, scroll:rail.scrollLeft, mode:null, dragging:false, token:hooks.token() };
    rail.setPointerCapture(e.pointerId);
  }
  rail.addEventListener('pointerdown', start);
  rail.addEventListener('pointermove', e => {
    const g = gesture; if (!g || g.id !== e.pointerId) return;
    if (g.token !== hooks.token()) { clean(); return; }
    const dx = e.clientX-g.x, dy = e.clientY-g.y;
    if (!g.mode && Math.hypot(dx,dy)>9) g.mode = e.pointerType === 'touch' && Math.abs(dx)>Math.abs(dy)*1.15 ? 'scroll' : 'drag';
    if (g.mode === 'scroll' && dy < -24 && e.clientY < g.card.getBoundingClientRect().top) g.mode = 'drag';
    if (g.mode === 'scroll') { rail.scrollLeft=g.scroll-dx; e.preventDefault(); return; }
    if (g.mode !== 'drag') return;
    e.preventDefault();
    if (!g.dragging) {
      if (!hooks.begin(g.index)) { clean(); return; }
      g.dragging=true;
      // Aimed cards stay in the rail; only the targeting line follows the finger.
      g.aiming=Boolean(hooks.targeted());
      g.card.classList.toggle('aiming',g.aiming);
      if (!g.aiming) {
        const clone=g.card.cloneNode(true);
        clone.removeAttribute('id'); clone.tabIndex=-1;
        clone.querySelector('.game-card-description')?.remove(); clone.querySelector('.supply-count')?.remove(); clone.querySelector('.mulligan-mark')?.remove();
        clone.querySelectorAll('canvas').forEach((canvas,i)=>canvas.getContext('2d').drawImage(g.card.querySelectorAll('canvas')[i],0,0));
        ghost.replaceChildren(clone); ghost.hidden=false;
      }
    }
    if (g.token !== hooks.token()) { clean(); return; }
    const boundary=hooks.boundary();
    shade.hidden=false; shade.style.top=`${boundary}px`;
    const cancelled=e.clientY>=boundary;
    shade.classList.toggle('is-active',cancelled);
    ghost.style.left=`${e.clientX}px`; ghost.style.top=`${e.clientY-50}px`;
    ghost.classList.toggle('is-invalid',cancelled);
    ghost.classList.toggle('is-ready', !cancelled && hooks.ready?.(e));
    hooks.preview(e,cancelled);
  });
  rail.addEventListener('pointerup',e=>{
    const g=gesture; if (!g || g.id!==e.pointerId) return;
    suppressed=performance.now()+700;
    const dragged=g.dragging, mode=g.mode, valid=g.token===hooks.token();
    clean(false);
    if (dragged) { if (valid && e.clientY<hooks.boundary()) hooks.drop(e,g.index); else hooks.cancel(); }
    else if (!mode && valid) hooks.tap(g.index);
  });
  rail.addEventListener('click',e=>{ if (e.detail && performance.now()<suppressed) { e.preventDefault(); e.stopImmediatePropagation(); } },true);
  document.addEventListener('pointerdown',e=>{ if(!e.isPrimary) clean(); },true);
  rail.addEventListener('contextmenu',e=>e.preventDefault());
  rail.addEventListener('pointercancel',()=>clean());
  rail.addEventListener('lostpointercapture',()=>clean());
  window.addEventListener('pagehide',()=>clean());
  window.addEventListener('resize',()=>clean());
  window.addEventListener('blur',()=>clean());
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) clean(); });
  window.addEventListener('keydown',e=>{ if(e.key==='Escape') clean(); });
  return { start, cancel:()=>clean(), invalidate:()=>{ if(gesture && gesture.token!==hooks.token()) clean(); } };
}
