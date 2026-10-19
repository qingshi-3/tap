// Diagnostic only: read CSS env values; never infer hardware shape or alter stage fit.
let active = null;

export function openSafeAreaDebug() {
  if (active) { active.expand(); return; }
  const previousFocus = document.activeElement;
  const root = document.createElement('div');
  root.id = 'safe-area-debug';
  const probe = document.createElement('div');
  probe.id = 'safe-area-debug-probe';
  probe.setAttribute('aria-hidden', 'true');
  root.append(probe);
  const bands = Object.fromEntries(['top', 'right', 'bottom', 'left'].map(edge => {
    const band = document.createElement('div');
    band.className = 'safe-area-debug-band';
    band.dataset.edge = edge;
    band.setAttribute('aria-hidden', 'true');
    root.append(band);
    return [edge, band];
  }));
  const panel = document.createElement('section');
  panel.className = 'safe-area-debug-panel';
  panel.setAttribute('aria-label', '屏幕检测');
  const values = document.createElement('p');
  values.className = 'safe-area-debug-values';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const controls = document.createElement('div');
  controls.className = 'safe-area-debug-controls';
  const button = (label, click) => {
    const el = document.createElement('button');
    el.type = 'button'; el.textContent = label;
    el.addEventListener('click', click);
    return el;
  };
  const collapse = button('收起', () => {
    panel.hidden = true; compact.hidden = false; compact.focus();
  });
  const close = button('关闭检测', cleanup);
  controls.append(collapse, close);
  panel.append(values, status, controls);
  const compact = button('检测', expand);
  compact.className = 'safe-area-debug-compact';
  compact.hidden = true;
  root.append(panel, compact);
  document.body.append(root);
  let frame = 0;
  const visual = window.visualViewport;
  const events = [[window, 'resize'], [window, 'orientationchange'], [window, 'pageshow']];
  if (visual) events.push([visual, 'resize'], [visual, 'scroll']);
  function read() {
    frame = 0;
    const css = getComputedStyle(probe);
    const safe = Object.fromEntries(['top', 'right', 'bottom', 'left'].map(edge => [edge,
      Math.max(0, parseFloat(css.getPropertyValue(`padding-${edge}`)) || 0)]));
    const viewport = { width: innerWidth, height: innerHeight };
    const visible = { width: visual?.width ?? innerWidth, height: visual?.height ?? innerHeight,
      left: visual?.offsetLeft ?? 0, top: visual?.offsetTop ?? 0 };
    window.safeAreaDebugData = Object.freeze({ safe: Object.freeze(safe), viewport: Object.freeze(viewport),
      visualViewport: Object.freeze(visible), boundaryOffset: 6 });
    for (const [edge, band] of Object.entries(bands)) {
      band.hidden = safe[edge] === 0;
      band.style.setProperty('--band-size', `${safe[edge] + 6}px`);
      band.dataset.inset = String(safe[edge]);
    }
    // Keep controls inside both the reported usable area and the visible viewport.
    const usable = {
      left: Math.max(safe.left, visible.left), top: Math.max(safe.top, visible.top),
      right: Math.min(viewport.width - safe.right, visible.left + visible.width),
      bottom: Math.min(viewport.height - safe.bottom, visible.top + visible.height),
    };
    root.style.setProperty('--debug-center-x', `${(usable.left + usable.right) / 2}px`);
    root.style.setProperty('--debug-center-y', `${(usable.top + usable.bottom) / 2}px`);
    root.style.setProperty('--debug-max-width', `${Math.max(0, usable.right - usable.left - 24)}px`);
    root.style.setProperty('--debug-max-height', `${Math.max(0, usable.bottom - usable.top - 24)}px`);
    values.textContent = `上 ${safe.top} · 右 ${safe.right} · 下 ${safe.bottom} · 左 ${safe.left} px\n视口 ${viewport.width} × ${viewport.height}`;
    status.textContent = Object.values(safe).some(n => n > 0)
      ? '安全边距，非灵动岛轮廓。边界向外留6px。'
      : '未读到安全边距，不代表没有遮挡。';
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(read); }
  function expand() { panel.hidden = false; compact.hidden = true; close.focus(); }
  function cleanup() {
    events.forEach(([target, event]) => target.removeEventListener(event, schedule));
    if (frame) cancelAnimationFrame(frame);
    root.remove(); active = null;
    delete window.safeAreaDebugData;
    if (previousFocus?.isConnected) previousFocus.focus();
  }
  events.forEach(([target, event]) => target.addEventListener(event, schedule, { passive: true }));
  active = { expand };
  read(); expand();
}
