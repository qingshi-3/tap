function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return [c, c.getContext('2d')];
}
function rgba(hex, a = 255) {
    const v = hex.replace('#', '');
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16), a];
}
/** 逐像素绘制：fn 返回颜色或 null（透明） */
function paint(w, h, fn) {
    const [c, x] = canvas(w, h);
    const img = x.createImageData(w, h);
    for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
            const v = fn(i, j);
            if (!v)
                continue;
            const p = typeof v === 'string' ? rgba(v) : v;
            img.data.set(p, (j * w + i) * 4);
        }
    x.putImageData(img, 0, 0);
    return c;
}
const url = (c) => `url("${c.toDataURL()}")`;
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAYER4[(y & 3) * 4 + (x & 3)];
/* ───────── 9-slice 边框：16×16，切片 6 ───────── */
function frame(p, rivet = true) {
    const N = 16;
    return paint(N, N, (x, y) => {
        const t = y, l = x, b = N - 1 - y, r = N - 1 - x;
        const edge = Math.min(t, l, b, r);
        const corner = Math.min(t + l, t + r, b + l, b + r);
        const e = Math.min(edge, corner - 2);
        if (e < 0)
            return null;
        if (e === 0)
            return p.o;
        if (e === 1)
            return Math.min(t, l) <= Math.min(b, r) ? p.h : p.s;
        if (e === 2)
            return p.m;
        if (e === 3)
            return p.d;
        // 四角铆钉
        if (rivet && edge === 4 && corner === 8)
            return p.g ?? p.h;
        return null;
    });
}
function dividerTile(p) {
    return paint(8, 3, (x, y) => {
        if (y === 0)
            return x % 4 === 0 ? p.h : x % 2 === 0 ? p.m : null;
        if (y === 1)
            return x % 2 === 0 ? p.m : p.s;
        return x % 4 === 2 ? p.s : null;
    });
}
function dividerTileV(p) {
    return paint(3, 8, (x, y) => {
        if (x === 1)
            return y % 2 === 0 ? p.m : p.s;
        return y % 4 === 0 ? p.h : null;
    });
}
function gem(p, w = 11, hgt = 7) {
    const cx = (w - 1) / 2, cy = (hgt - 1) / 2;
    return paint(w, hgt, (x, y) => {
        const d = Math.abs(x - cx) / (cx + 0.5) + Math.abs(y - cy) / (cy + 0.5);
        if (d > 1)
            return null;
        if (d > 0.72)
            return p.o;
        if (x < cx && y <= cy)
            return p.h;
        if (y > cy)
            return p.s;
        return p.m;
    });
}
/* ───────── 数值宝石（攻击菱形 / 生命圆） ───────── */
function statGem(kind, p) {
    const N = 17, c = 8;
    return paint(N, N, (x, y) => {
        const dx = x - c, dy = y - c;
        const d = kind === 'atk' ? (Math.abs(dx) + Math.abs(dy)) / 8.6 : Math.sqrt(dx * dx + dy * dy) / 8.2;
        if (d > 1)
            return null;
        const o = kind === 'atk' ? 0.86 : 0.84;
        if (d > o)
            return '#0b0612';
        if (d > o - 0.12)
            return dx + dy < 0 ? p.h : p.s;
        // 内部：左上亮，右下暗，加一颗高光点
        if ((dx === -3 && dy === -4) || (dx === -4 && dy === -3) || (dx === -3 && dy === -3))
            return '#ffffff';
        const sh = (dx + dy) / 16 + bayer(x, y) * 0.35 - 0.17;
        return sh < -0.2 ? p.h : sh > 0.22 ? p.d : sh > 0.04 ? p.s : p.m;
    });
}
/* ───────── 像素心 9×8 ───────── */
const HEART = ['.##...##.', '#hh#.#mm#', '#hmm#mmm#', '#mmmmmmm#', '.#mmmms#.', '..#mms#..', '...#s#...', '....#....'];
function heart(h, m, s, o = '#1a0610') {
    return paint(9, 8, (x, y) => ({ '#': o, h, m, s })[HEART[y][x]] ?? null);
}
/* ───────── 传说冠饰 17×10 ───────── */
const CROWN = [
    '..o.....o.....o..',
    '.oho...oho...oho.',
    '.ohmo..ohmo.ohso.',
    '.ohmmoohmmsoomso.',
    '.ohmmmmhmmmmmmso.',
    'oohhhhhhhhhhhhhoo',
    'ohmmbmmmrmmmbmmso',
    'ohmmmmmmmmmmmmmso',
    'ossssssssssssssso',
    'ooooooooooooooooo',
];
function crown() {
    const c = { o: '#1a0c02', h: '#fff1b8', m: '#f0b53e', s: '#9a5c12', r: '#ff4d64', b: '#6fe6ff' };
    return paint(17, 10, (x, y) => c[CROWN[y][x]] ?? null);
}
const P = {
    gold: { o: '#0b0716', h: '#fff1b8', m: '#e0a63a', s: '#8a5414', d: '#2a1a08', g: '#fff1b8' },
    steel: { o: '#05051a', h: '#8e8ad6', m: '#4b4896', s: '#26235a', d: '#0e0c2a', g: '#ffd36b' },
    teal: { o: '#04121a', h: '#c4fff4', m: '#3cc8b4', s: '#16665e', d: '#082422', g: '#c4fff4' },
    red: { o: '#14040a', h: '#ffb8c3', m: '#e8394f', s: '#7a1024', d: '#2a0610', g: '#ffd36b' },
    dim: { o: '#05051a', h: '#5c5a9a', m: '#33306a', s: '#1c1a44', d: '#0b0a22' },
    moss: { o: '#04140a', h: '#c8ffb0', m: '#4ea844', s: '#1f5a26', d: '#0a2410', g: '#ffd36b' },
};
const OUTLINE = '#07051a';
/** 图标调色板：字母 → 颜色，'.' 为透明；描边自动补在外圈 */
const PAL = {
    k: '#2a2e48', s: '#9aa3c8', w: '#eef2ff', S: '#5c6488',
    y: '#ffc23d', Y: '#fff1b8', o: '#a8620e',
    b: '#8a5428', B: '#4a2a12', e: '#b0743e', E: '#6e4220',
    r: '#e8394f', R: '#7a1024',
    g: '#6ad66a', G: '#1f7a3a', l: '#c8ffb0',
    c: '#9af0ff', C: '#3a8ad0', D: '#1a4a7a',
    p: '#b46cff', P: '#5e2a9e',
    f: '#ff8a3a', F: '#ffd36b',
    q: '#f2deb0', Q: '#a07a4a',
};
const SWORD = [
    '............sw',
    '...........sws',
    '..........sws.',
    '.........sws..',
    '........sws...',
    '.......sws....',
    '......sws.....',
    '..y..sws......',
    '..yysws.......',
    '...yyS........',
    '...byyy.......',
    '..bB..y.......',
    '.bB...........',
    'bB............',
];
const recolor = (g, map) => g.map((row) => [...row].map((c) => map[c] ?? c).join(''));
const mirror = (g) => g.map((row) => [...row].reverse().join(''));
const overlay = (a, b) => a.map((row, y) => [...row].map((c, x) => (c !== '.' ? c : b[y][x])).join(''));
const CHEST = [
    '..k........k..',
    '.kmk......kmk.',
    'kmmmk....kmmmk',
    'kmmmmkkkkmmmmk',
    'kmhmmmmmmmmmnk',
    '.kmhmmmmmmmnk.',
    '..kmmmmmmmmk..',
    '..kmhmmmmmnk..',
    '..kmmmmmmmnk..',
    '..kmhmmmmmnk..',
    '..kmmmmmmmnk..',
    '...kmmmmmnk...',
    '....kkkkkk....',
    '..............',
];
const ICONS = {
    eq_combo: overlay(SWORD, mirror(SWORD)),
    eq_bow: [
        '...bb.........',
        '...w.bb.......',
        '...w...b......',
        '...w....b.....',
        '...w.....b....',
        '...w.....b....',
        'rreeeeeeeeeess',
        '...w.....b....',
        '...w.....b....',
        '...w....b.....',
        '...w...b......',
        '...w.bb.......',
        '...bb.........',
        '..............',
    ],
    eq_thorn: overlay(recolor(CHEST, { m: 'g', h: 'l', n: 'G', k: 'G' }), [
        'w............w',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '.w..........w.',
        '..............',
        '..............',
        '.w..........w.',
        '..............',
        '..............',
        '..............',
        '..............',
    ]),
    eq_guard: [
        '.kkkkkkkkkkkk.',
        'kCCCCCyyCCCCCk',
        'kCcCCCyyCCCCCk',
        'kCCCCCyyCCCCCk',
        'kyyyyyyyyyyyyk',
        'kYYYYYYYYYYYYk',
        'kCCCCCyyCCCCDk',
        'kCCCCCyyCCCCDk',
        '.kCCCCyyCCCDk.',
        '.kCCCCyyCCCDk.',
        '..kCCCyyCCDk..',
        '...kCCyyCDk...',
        '....kCyyDk....',
        '.....kkkk.....',
    ],
    eq_ice: recolor(CHEST, { m: 'c', h: 'w', n: 'C', k: 'D' }),
    eq_halo: [
        '....yyyyyy....',
        '..yyYYYYYYyy..',
        '.yY........Yy.',
        '.y...wwww...y.',
        '....wYYYYw....',
        '...wYYwwYYw...',
        '...wYwyywYw...',
        '...wYwyywYw...',
        '...wYYwwYYw...',
        '....wYYYYw....',
        '.....wwww.....',
        '.....yooy.....',
        '....yo..oy....',
        '...yo....oy...',
    ],
    eq_flame: overlay(recolor(SWORD, { s: 'f', w: 'F', S: 'r' }), [
        '..........r...',
        '.........rf...',
        '.......r..F...',
        '..............',
        '.....r........',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
    ]),
    eq_frost: overlay(recolor(SWORD, { s: 'c', S: 'C' }), [
        '.........w....',
        '.........c...w',
        '.......w......',
        '..............',
        '.....c........',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
    ]),
    eq_hammer: [
        '.kkkkkkkkkkkk.',
        '.kswssssssSSk.',
        '.ksssssssssSk.',
        '.ksssssssssSk.',
        '.kSSSSSSSSSSk.',
        '.kkkkkbbkkkkk.',
        '......bB......',
        '......bB......',
        '......bB......',
        '......bB......',
        '......bB......',
        '......ee......',
        '......eE......',
        '......kk......',
    ],
    eq_tome: [
        '..............',
        '.kkkkkkkkkkkk.',
        '.kPppppppppPk.',
        '.kPpYYYYYYpPk.',
        '.kPpYppppYpPk.',
        '.kPpYpwwpYpPk.',
        '.kPpYpwwpYpPk.',
        '.kPpYppppYpPk.',
        '.kPpYYYYYYpPk.',
        '.kPppppppppPk.',
        '.kqqqqqqqqqqk.',
        '.kQQQQQQQQQQk.',
        '.kkkkkkkkkkkk.',
        '..............',
    ],
    eq_belt: [
        '..............',
        '..............',
        '..............',
        '....kkkkkk....',
        'kkkkyyyyyykkkk',
        'eeekyYkkYykeee',
        'eeekyk..kykeee',
        'EEEkyk..kykEEE',
        'EEEkyYkkoykEEE',
        'kkkkyyyyoykkkk',
        '....kkkkkk....',
        '..............',
        '..............',
        '..............',
    ],
    eq_banner: [
        'Y.............',
        'brrrrrrrrrr...',
        'brRrrrrrrrr...',
        'brrrrYYrrrr...',
        'brrrYYYYrrr...',
        'brrrrYYrrrr...',
        'brrrrrrrrrr...',
        'bRrrrrrrrrR...',
        'bRrrr..rrrR...',
        'bRrr....rrR...',
        'bR........R...',
        'b.............',
        'b.............',
        'B.............',
    ],
    // 法术先用通用卷轴占位，之后再逐个出图
    spell: [
        '..eeeeeeeeee..',
        '.eEqqqqqqqqEe.',
        '.eEqqqqqqqqEe.',
        '..eqQQQQQQqe..',
        '..eqqqqqqqqe..',
        '..eqQQQQQqqe..',
        '..eqqqqqqqqe..',
        '..eqQQQQQQqe..',
        '..eqqqqqqqqe..',
        '..eqQQQqqqqe..',
        '.eEqqqqqqqqEe.',
        '.eEqqqqqqqqEe.',
        '..eeeeeeeeee..',
        '..............',
    ],
    order: [
        '..yyyyyyyyyy..',
        '.yYYYYYYYYYYy.',
        '.yYrrrrrrrrYy.',
        '.yYrrYYYYrrYy.',
        '.yYrYrrrrYrYy.',
        '.yYrYrYYrYrYy.',
        '.yYrYrrrrYrYy.',
        '.yYrrYYYYrrYy.',
        '.yYrrrrrrrrYy.',
        '.yYYYYYYYYYYy.',
        '..yyyyyyyyyy..',
        '....R....R....',
        '...RR....RR...',
        '..............',
    ],
    pack: [
        '.....kkkk.....',
        '......yy......',
        '....eeeeee....',
        '...eqeeeeee...',
        '..eeeeeeeeee..',
        '.eeeeYYeeeeeE.',
        '.eeeYggYeeeeE.',
        '.eeeYglYeeeeE.',
        '.eeeeYYeeeeeE.',
        '.EeeeeeeeeeeE.',
        '..EEeeeeeeEE..',
        '...EEEEEEEE...',
        '..............',
        '..............',
    ],
    coin: [
        '..............',
        '....oooooo....',
        '...oyyyyyyo...',
        '..oyYYyyyyyo..',
        '..oyYyooyyyo..',
        '..oyyyoyyyyo..',
        '..oyyyoyyyyo..',
        '..oyyyoyyyyo..',
        '..oyyyoyyyyo..',
        '..oyyooooyyo..',
        '..oyyyyyyyyo..',
        '...oyyyyyyo...',
        '....oooooo....',
        '..............',
    ],
};
function iconCanvas(g) {
    const N = 16;
    const at = (x, y) => (x >= 1 && y >= 1 && x <= 14 && y <= 14 ? g[y - 1]?.[x - 1] ?? '.' : '.');
    const [c, x] = canvas(N, N);
    for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
            const ch = at(i, j);
            let col = ch !== '.' ? PAL[ch] ?? null : null;
            if (!col) {
                let near = false;
                for (let dy = -1; dy <= 1 && !near; dy++)
                    for (let dx = -1; dx <= 1; dx++)
                        if ((dx || dy) && at(i + dx, j + dy) !== '.') {
                            near = true;
                            break;
                        }
                if (near)
                    col = OUTLINE;
            }
            if (col) {
                x.fillStyle = col;
                x.fillRect(i, j, 1, 1);
            }
        }
    return c;
}
// Restaurant content extends the reference's same 14×14 letter-grid pipeline.
// The original palette and 16×16 automatic outline renderer remain unchanged.
const RESTAURANT_GRIDS = {
 crate: ['..............','..eeeeeeeeee..','..eYYYYYYYYe..','.eeebbbbbbeee.','.ebbeebbeebbe.','.ebbbeeeebbbe.','.ebbbbEEbbbbe.','.ebbbbEEbbbbe.','.ebbbeeeebbbe.','.ebbeebbeebbe.','.eeebbbbbbeee.','..eeeeeeeeee..','..............','..............'],
 chef: ['....wwwwww....','..wwwwwwwwww..','.wwwwwwwwwwww.','.wwwwwwwwwwww.','..wwwwwwwwww..','...ssssssss...','...qqqqqqqq...','...qkqqqqkq...','...qqqqqqqq...','....qbbqqq....','.....qqqq.....','...wwwwwwww...','..wwwwyywwww..','..wwwwyywwww..'],
 dish_soup:['..............','.....s..s.....','....w..w......','..............','..qqqqqqqqqq..','.qYYYYYYYYYYq.','.qQoooffooQQq.','..qooooooooq..','..qooooooooq..','...qQQQQQQq...','....qqqqqq....','...ssssssss...','..............','..............'],
 dish_rice:['..............','..............','....wwwwww....','...wwYwwwww...','..wwwwwYwwww..','..gffwwwwggw..','.qqqqqqqqqqqq.','.qQQQQQQQQQQq.','..qQQQQQQQQq..','...qQQQQQQq...','....qqqqqq....','...ssssssss...','..............','..............'],
 dish_tea:['..............','.....w..w.....','....s..s......','..............','...qqqqqqqq...','...qrrrrrrq...','...qRrrrrRqY..','...qRrrrrRq.Y.','...qRRrrRRq.Y.','...qQQQQQQqY..','....qqqqqq....','..ssssssssss..','..............','..............'],
 dish_fish:['..............','..............','..............','......ssss....','....scwwwss...','..ssccwwwwks..','..scCCccccss..','.s..sCCCss....','....gggggg....','..qqqqqqqqqq..','.qYYYYYYYYYYq.','..qqqqqqqqqq..','..............','..............'],
 dish_bread:['..............','..............','....YYYYYY....','...YeeYeeeY...','..YeeeYeeeeY..','..YeeeeYeeeY..','..YeeYeeYeeY..','..eYeeeeYYee..','..eeeeeeeeee..','...oooooooe...','..qqqqqqqqqq..','...qqqqqqqq...','..............','..............'],
 dish_salad:['..............','....lgglll....','...glgggglg...','..lggrrggllg..','..gggrrgllgg..','..gYYgggrrgg..','..ggglggrrgl..','.qqqqqqqqqqqq.','.qQQQQQQQQQQq.','..qQQQQQQQQq..','...qqqqqqqq...','..............','..............','..............'],
 dish_pie:['..............','..............','....qqqqqq....','...qrrqrrrq...','..qrrqqqrrrq..','..qrqrrrqrRq..','..qqrrrrrqqq..','..qrqrrrqrRq..','..qrrqqqrrRq..','...qRRqRRRq...','....qqqqqq....','..ssssssssss..','..............','..............'],
 dish_stew:['.....s..s.....','....w..w......','..............','...kkkkkkkk...','..kffogogffk..','.kkfooofooRkk.','k.kRRooooRRk.k','k.kRRRooRRRk.k','.kkRRRRRRRRkk.','..kRRRRRRRRk..','...kRRRRRRk...','....kkkkkk....','....ffYYff....','..............'],
};
for (const [id,rows] of Object.entries(RESTAURANT_GRIDS)) ICONS[id]=rows.map(row=>row.padEnd(14,'.').slice(0,14));
const spriteUrls = new Map();
let cachedVars = null;
export const ITEM_IDS = Object.freeze(Object.keys(ICONS));
export function installPixelSprites(target = document.documentElement) {
    if (!cachedVars) {
        const vars = {};
        for (const [k, p] of Object.entries(P)) {
            vars['--pxf-' + k] = url(frame(p));
            vars['--pxd-' + k] = url(dividerTile(p));
            vars['--pxv-' + k] = url(dividerTileV(p));
            vars['--pxg-' + k] = url(gem(p));
        }
        const rarity = [{ o: '#0b0716', h: '#f2f4f8', m: '#a9b1c2', s: '#5c6378', d: '#2a2e3a' },
            { o: '#04101e', h: '#d6f8ff', m: '#46c4f0', s: '#1a6a9a', d: '#0a2a40' },
            { o: '#10061e', h: '#f2dcff', m: '#b46cff', s: '#5e2a9e', d: '#260c44' },
            { o: '#1a0c02', h: '#fff6cc', m: '#ffc23d', s: '#a8620e', d: '#3a1e04' }];
        rarity.forEach((p, i) => vars['--pxr-' + (i + 1)] = url(gem(p, 7, 7)));
        vars['--px-crown'] = url(crown());
        vars['--px-heart'] = url(heart('#ffc0c6', '#ff4d64', '#b01c38'));
        vars['--px-heart-off'] = url(heart('#3a3450', '#2a2540', '#1f1b30', '#0c0a18'));
        // Original numeric badge sprites, usable for stock/reputation rather than battle stats.
        vars['--px-atk'] = url(statGem('atk', { o: '#000', h: '#ffe9a8', m: '#f5a83a', s: '#c0601a', d: '#7a3008' }));
        vars['--px-hp'] = url(statGem('hp', { o: '#000', h: '#ffc0c6', m: '#e8394f', s: '#a81c34', d: '#5c0a1c' }));
        for (const [id, g] of Object.entries(ICONS)) {
            const raw = iconCanvas(g).toDataURL();
            spriteUrls.set(id, raw);
            vars['--pxi-' + id] = 'url("' + raw + '")';
        }
        cachedVars = vars;
    }
    for (const [name, value] of Object.entries(cachedVars))
        target.style.setProperty(name, value);
    return cachedVars;
}
export function itemSpriteUrl(id) { if (!cachedVars)
    installPixelSprites(); return spriteUrls.get(id) || spriteUrls.get('coin'); }
export function itemIcon(id, fallback = 'coin', cls = '') {
    const key = id in ICONS ? id : fallback in ICONS ? fallback : 'coin';
    const node = document.createElement('i');
    node.className = 'px-item ' + cls;
    node.style.setProperty('--pxi', 'var(--pxi-' + key + ')');
    node.setAttribute('aria-hidden', 'true');
    return node;
}
// Same timing/easing as the reference's pop feedback, using Web Animations so
// callers can apply it to their own existing element without extra wrappers.
export function pixelPop(element) { if (matchMedia('(prefers-reduced-motion: reduce)').matches)
    return null; return element.animate([{ transform: 'translateY(8px) scale(.94)', opacity: .4 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], { duration: 250, easing: 'cubic-bezier(.2,1.6,.4,1)' }); }
