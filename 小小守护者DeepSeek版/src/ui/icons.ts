/**
 * 内联像素风 SVG 图标。全部 16x16 网格、奇数像素块、无抗锯齿曲线。
 * 图标以 currentColor 上色，挖空部分用 .cut 跟随父级底色。
 * 这里不引入任何位图，界面装饰全部由代码产生。
 */
const P = 'http://www.w3.org/2000/svg';

function svg(children: string, cls = 'ico'): SVGSVGElement {
  const node = document.createElementNS(P, 'svg');
  node.setAttribute('viewBox', '0 0 16 16');
  node.setAttribute('aria-hidden', 'true');
  node.setAttribute('class', cls);
  node.innerHTML = children;
  return node;
}

const r = (x: number, y: number, w: number, h: number, cls = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}"${cls ? ` class="${cls}"` : ''}/>`;

export const ICONS = {
  coin: () => svg(r(4, 2, 8, 12) + r(2, 5, 2, 6) + r(12, 5, 2, 6)),
  heart: () => svg(r(3, 3, 10, 10) + r(1, 6, 2, 4) + r(13, 6, 2, 4) + r(6, 1, 4, 2) + r(6, 13, 4, 2)),
  close: () =>
    svg(
      `<rect x="1" y="7" width="14" height="2" transform="rotate(45 8 8)"/>` +
        `<rect x="1" y="7" width="14" height="2" transform="rotate(-45 8 8)"/>`,
    ),
} satisfies Record<string, () => SVGSVGElement>;

export function icon(name: keyof typeof ICONS): SVGSVGElement {
  return ICONS[name]();
}
