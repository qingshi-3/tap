// 像素符文图标：技能时机、金色王冠等。9×9 网格手绘，外圈自动描一像素深色边，SVG crispEdges 输出。
// 字母：x 主色 / h 亮面 / s 暗面（由 base 推出），w 高光白，k 墨色，g 金，p 钢，b 木柄，r 赤，.空。

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => `#${hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;

export type RuneName =
  | 'flag' | 'swords' | 'burst' | 'hourglass' | 'drop' | 'heart' | 'skull' | 'egg' | 'coin'
  | 'bread' | 'spark' | 'sun' | 'moon' | 'eye' | 'shield' | 'arrow' | 'crown';

interface Rune { base: string; rows: string[] }
const R: Record<RuneName, Rune> = {
  flag: { base: '#ff5a6e', rows: [
    'pxxxxxh..',
    'pxhhxxxh.',
    'pxhxxxxxh',
    'pxxxxxxs.',
    'pxsssss..',
    'p........',
    'p........',
    'p........',
    'b........',
  ] },
  swords: { base: '#d6d3e6', rows: [
    'w.......w',
    '.p.....p.',
    '..p...p..',
    '...p.p...',
    '....p....',
    '...p.p...',
    '.gg...gg.',
    '..b...b..',
    '.b.....b.',
  ] },
  burst: { base: '#ffc845', rows: [
    '....w....',
    '.x..x..x.',
    '..xxhxx..',
    '..xhwhx..',
    'wxhwwwhxw',
    '..xhwhs..',
    '..xxhss..',
    '.x..s..s.',
    '....s....',
  ] },
  hourglass: { base: '#ffd36b', rows: [
    'bbbbbbbbb',
    '.pwwwwwp.',
    '..pxxxp..',
    '...pxp...',
    '....p....',
    '...pxp...',
    '..pxxxp..',
    '.pxxxxxp.',
    'bbbbbbbbb',
  ] },
  drop: { base: '#ff6a4a', rows: [
    '....x....',
    '....x....',
    '...xxx...',
    '...whx...',
    '..xhxxx..',
    '..xhxxx..',
    '..xxxxs..',
    '...xss...',
    '.........',
  ] },
  heart: { base: '#ff4a6a', rows: [
    '.xx...xx.',
    'xwhx.xxxx',
    'xhxxxxxxx',
    'xxxxxxxxs',
    '.xxxxxxs.',
    '..xxxxs..',
    '...xxs...',
    '....s....',
    '.........',
  ] },
  skull: { base: '#ece4cc', rows: [
    '..xxxxx..',
    '.xhhxxxx.',
    'xhxxxxxxs',
    'xkkxxxkks',
    'xkkxxxkks',
    '.xxxkxxs.',
    '..xsxsx..',
    '..x.x.s..',
    '.........',
  ] },
  egg: { base: '#7fe0b0', rows: [
    '...xxx...',
    '..xhhxx..',
    '.xhxxxxx.',
    '.xhxxsxx.',
    'xxxxxxxxs',
    'xxsxxxxxs',
    'xxxxxxxss',
    '.xxxxxss.',
    '..sssss..',
  ] },
  coin: { base: '#ffd36b', rows: [
    '..xxxxx..',
    '.xwhhxxs.',
    'xwhxxxxxs',
    'xhxkkkxxs',
    'xhxxkxxxs',
    'xhxkkkxxs',
    'xxxxxxxss',
    '.xsssss..',
    '..sssss..',
  ] },
  bread: { base: '#e8a654', rows: [
    '.........',
    '..xxxxx..',
    '.xwhhxxx.',
    'xhxxxxxxs',
    'xhxsxsxxs',
    'xxxxxxxxs',
    '.sssssss.',
    '.........',
    '.........',
  ] },
  spark: { base: '#a6baff', rows: [
    '....w....',
    '....x....',
    '...hxh...',
    '...xwx...',
    'wxxwwwxxw',
    '...xwx...',
    '...sxs...',
    '....x....',
    '....s....',
  ] },
  sun: { base: '#ffcf4a', rows: [
    '....x....',
    '.x.....x.',
    '...xxx...',
    '..xwhxx..',
    'x.xhxxx.x',
    '..xxxxs..',
    '...xss...',
    '.x.....x.',
    '....x....',
  ] },
  moon: { base: '#cfd8ff', rows: [
    '...xxx...',
    '..xwx....',
    '.xhx.....',
    '.xhx...w.',
    '.xhx.....',
    '.xxx...x.',
    '..xxs.xs.',
    '...xxxs..',
    '.........',
  ] },
  eye: { base: '#8cd4ff', rows: [
    '.........',
    '...xxx...',
    '.xxhhhxx.',
    'xhhkkkhhx',
    'xhkkwkkhs',
    'xhhkkkhhs',
    '.xxsssxs.',
    '...sss...',
    '.........',
  ] },
  shield: { base: '#9fb0e6', rows: [
    '.xxxxxxx.',
    'xwhhxxxxs',
    'xhxxgxxxs',
    'xhxggggxs',
    'xhxxgxxxs',
    '.xhxgxxs.',
    '.xxxxxxs.',
    '..xxxxs..',
    '...xxs...',
  ] },
  arrow: { base: '#8ff07a', rows: [
    '...xxx...',
    '...xhx...',
    '...xhx...',
    '...xhx...',
    'xxxxhxxxs',
    '.xxxhxxs.',
    '..xxhxs..',
    '...xxs...',
    '....s....',
  ] },
  crown: { base: '#ffd36b', rows: [
    'x...x...x',
    'xr.xbx.rx',
    'xx.xxx.xx',
    'xxxxxxxxx',
    'xwwxrxwwx',
    'xxxxxxxxx',
    'sssssssss',
    '.........',
    '.........',
  ] },
};

const FIXED: Record<string, string> = { w: '#fff7e0', k: '#1a1030', g: '#ffd36b', p: '#d6d3e6', b: '#8a5a2a', r: '#ff4a5a' };
const OUTLINE = '#0b0718';
const cache = new Map<string, string>();

/** 任意像素网格 → SVG 字符串（外圈自动描边） */
export function pixelSvg(rows: readonly string[], colors: Record<string, string>, outline = OUTLINE): string {
  const W = Math.max(...rows.map((r) => r.length)), H = rows.length;
  const solid = (x: number, y: number) => !!colors[rows[y]?.[x] ?? '.'];
  const paths: Record<string, string> = {};
  let ol = '';
  for (let y = -1; y <= H; y++) for (let x = -1; x <= W; x++) {
    if (solid(x, y)) { const c = rows[y][x]; paths[c] = (paths[c] ?? '') + `M${x + 1} ${y + 1}h1v1h-1z`; continue; }
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (solid(x + dx, y + dy)) { near = true; break; }
    if (near) ol += `M${x + 1} ${y + 1}h1v1h-1z`;
  }
  return `<svg viewBox="0 0 ${W + 2} ${H + 2}" shape-rendering="crispEdges" aria-hidden="true"><path fill="${outline}" d="${ol}"/>${Object.entries(paths).map(([c, d]) => `<path fill="${colors[c]}" d="${d}"/>`).join('')}</svg>`;
}

export function runeSvg(name: RuneName): string {
  let svg = cache.get(name);
  if (!svg) {
    const r = R[name];
    svg = pixelSvg(r.rows, { ...FIXED, x: r.base, h: mix(r.base, '#ffffff', 0.45), s: mix(r.base, '#000000', 0.38) });
    cache.set(name, svg);
  }
  return svg;
}

/** 符文图标元素 */
export function rune(name: RuneName, cls = ''): HTMLElement {
  const el = document.createElement('span');
  el.className = `rune${cls ? ` ${cls}` : ''}`;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = runeSvg(name);
  return el;
}
