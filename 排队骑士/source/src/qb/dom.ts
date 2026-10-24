type Attrs = Record<string, unknown> & { class?: string; style?: string | Partial<CSSStyleDeclaration> };
type Child = Node | string | number | null | undefined | false | Child[];

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs | null, ...children: Child[]): HTMLElementTagNameMap[K];
export function h(tag: string, attrs?: Attrs | null, ...children: Child[]): HTMLElement;
export function h(tag: string, attrs?: Attrs | null, ...children: Child[]) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'style') {
        if (typeof v === 'string') el.style.cssText = v;
        else Object.assign(el.style, v);
      } else if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      } else if (k === 'html') el.innerHTML = String(v);
      else el.setAttribute(k, String(v));
    }
  }
  append(el, ...children);
  return el;
}

export function append(el: HTMLElement, ...children: Child[]) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, ...c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export function svg(markup: string, cls = '', viewBox = '0 0 24 24') {
  const wrap = document.createElement('span');
  wrap.className = `ic ${cls}`;
  wrap.innerHTML = `<svg viewBox="${viewBox}" aria-hidden="true">${markup}</svg>`;
  return wrap;
}

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function clear(el: Element) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** 舞台坐标换算：舞台为固定 1280×720，整体缩放 */
export const STAGE_W = 1280;
export let STAGE_H = 720;
/** 短屏紧凑布局：逻辑高度 720 → 640，单位行上移 60、下方托盘上移 80 */
export const COMPACT_H = 640;
export function setStageH(h: number) { STAGE_H = h; }
export const stageState = { scale: 1, left: 0, top: 0 };

export function toStage(clientX: number, clientY: number) {
  return { x: (clientX - stageState.left) / stageState.scale, y: (clientY - stageState.top) / stageState.scale };
}
