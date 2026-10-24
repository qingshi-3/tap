import { h } from './dom';

// 道具像素图标 + 面板藤蔓装饰：与 pixel.ts 同一套做法——启动时用 canvas 逐像素生成，
// 写进 :root 的 CSS 变量（--pxi-<id> / --px-vine*），样式表只引用变量。
// 图标为 16×16 精灵（含 1 像素自动描边），舞台上按 3 倍显示成 48px，保证手机上看得清。

const OUTLINE = '#07051a';
/** 图标调色板：字母 → 颜色，'.' 为透明；描边自动补在外圈 */
const PAL: Record<string, string> = {
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

type Grid = string[];

const SWORD: Grid = [
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
const recolor = (g: Grid, map: Record<string, string>) => g.map((row) => [...row].map((c) => map[c] ?? c).join(''));
const mirror = (g: Grid) => g.map((row) => [...row].reverse().join(''));
const overlay = (a: Grid, b: Grid) => a.map((row, y) => [...row].map((c, x) => (c !== '.' ? c : b[y][x])).join(''));

const CHEST: Grid = [
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

const ICONS: Record<string, Grid> = {
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
  sp_haste: [
    '..yyyyyyyyyy..',
    '.yYqqqqqqqqYy.',
    '.yYqqqqqqqqYy.',
    '..yqqqqFqqqy..',
    '..yqqqFFqqqy..',
    '..yqqFFFqqqy..',
    '..yqFFFFFqqy..',
    '..yqqqFFqqqy..',
    '..yqqFFqqqqy..',
    '..yqqFqqqqqy..',
    '.yYqqqqqqqqYy.',
    '.yYqqqqqqqqYy.',
    '..yyyyyyyyyy..',
    '..............',
  ],
  eq_boots: [
    '..............',
    '...kkkkk......',
    '...kecek......',
    '...kecek...w..',
    '...keeek..ww..',
    '...keeek.ww...',
    '...keeek......',
    '...keeeek.....',
    '..keeeeeekk...',
    '..keeeeeeeek..',
    '..kEEEEEEEEk..',
    '..kBBBBBBBBk..',
    '..............',
    '..............',
  ],
  eq_duel: [
    '.............w',
    '............ws',
    '...........ws.',
    '..........ws..',
    '.........ws...',
    '........ws....',
    '.......ws.....',
    '..r...ws......',
    '..rrrwS.......',
    '...rrS........',
    '...brrr.......',
    '..bB..r.......',
    '.yB...........',
    'yy............',
  ],
  eq_hourglass: [
    '.oooooooooooo.',
    '.oyyyyyyyyyyo.',
    '..kwwwwwwwwk..',
    '..kwFFFFFFwk..',
    '...kwFFFFwk...',
    '....kwFFwk....',
    '.....kwFk.....',
    '.....kwwk.....',
    '....kwwFwk....',
    '...kwwFFFwk...',
    '..kwFFFFFFwk..',
    '..kwwwwwwwwk..',
    '.oyyyyyyyyyyo.',
    '.oooooooooooo.',
  ],
  sp_anchor: [
    '..eeeeeeeeee..',
    '.eEqqqqqqqqEe.',
    '.eEqqqqqqqqEe.',
    '..eqqqSSqqqe..',
    '..eqqqsSqqqe..',
    '..eqSsssSSqe..',
    '..eqqqsSqqqe..',
    '..eqSqsSqSqe..',
    '..eqSSssSSqe..',
    '..eqqqqqqqqe..',
    '.eEqqqqqqqqEe.',
    '.eEqqqqqqqqEe.',
    '..eeeeeeeeee..',
    '..............',
  ],
  sp_freeze: [
    '..eeeeeeeeee..',
    '.eEqqqqqqqqEe.',
    '.eEqqqqqqqqEe.',
    '..eqcqCCqcqe..',
    '..eqqcCCcqqe..',
    '..eqCCwwCCqe..',
    '..eqCCwwCCqe..',
    '..eqqcCCcqqe..',
    '..eqcqCCqcqe..',
    '..eqqqqqqqqe..',
    '.eEqqqqqqqqEe.',
    '.eEqqqqqqqqEe.',
    '..eeeeeeeeee..',
    '..............',
  ],
  sp_purify: [
    '..eeeeeeeeee..',
    '.eEqqqqqqqqEe.',
    '.eEqqqqqqqqEe.',
    '..eqqqYqqqqe..',
    '..eqqYwYqqqe..',
    '..eqYwwwYqqe..',
    '..eqqYwYqqqe..',
    '..eqqqYqqYqe..',
    '..eqqqqqYwqe..',
    '..eqqqqqqqqe..',
    '.eEqqqqqqqqEe.',
    '.eEqqqqqqqqEe.',
    '..eeeeeeeeee..',
    '..............',
  ],
  sp_firerain: [
    '..eeeeeeeeee..',
    '.eEqqqqqqqqEe.',
    '.eEqqqqqqqqEe.',
    '..eqfqqfqqqe..',
    '..eqFqffqfqe..',
    '..eqqfFqfFqe..',
    '..eqffqffqqe..',
    '..eqrFqrFqqe..',
    '..eqqrqqrqqe..',
    '..eqqqqqqqqe..',
    '.eEqqqqqqqqEe.',
    '.eEqqqqqqqqEe.',
    '..eeeeeeeeee..',
    '..............',
  ],
  sp_shield: [
    '..eeeeeeeeee..',
    '.eEqqqqqqqqEe.',
    '.eEqqqqqqqqEe.',
    '..eqCCCCCCqe..',
    '..eqCcCCCDqe..',
    '..eqCCyyCDqe..',
    '..eqCCyyCDqe..',
    '..eqqCCCDqqe..',
    '..eqqqCDqqqe..',
    '..eqqqqqqqqe..',
    '.eEqqqqqqqqEe.',
    '.eEqqqqqqqqEe.',
    '..eeeeeeeeee..',
    '..............',
  ],
  sp_sunder: [
    '..eeeeeeeeee..',
    '.eEqqqqqqqqEe.',
    '.eEqqqqqqqqEe.',
    '..eqqqqqqsqe..',
    '..eqqqqqsqqe..',
    '..eqqqqsqqqe..',
    '..eqrrsrrqqe..',
    '..eqqsRRqqqe..',
    '..eqsqqRqqqe..',
    '..eqqqqqqqqe..',
    '.eEqqqqqqqqEe.',
    '.eEqqqqqqqqEe.',
    '..eeeeeeeeee..',
    '..............',
  ],
  sp_warsong: [
    '..eeeeeeeeee..',
    '.eEqqqqqqqqEe.',
    '.eEqqqqqqqqEe.',
    '..eqqqrrrrqe..',
    '..eqqqrqqrqe..',
    '..eqqqrqqrqe..',
    '..eqqrrqrrqe..',
    '..eqrRrqrRqe..',
    '..eqRRqqRRqe..',
    '..eqqqqqqqqe..',
    '.eEqqqqqqqqEe.',
    '.eEqqqqqqqqEe.',
    '..eeeeeeeeee..',
    '..............',
  ],
  sp_revive: [
    '..eeeeeeeeee..',
    '.eEqqqqqqqqEe.',
    '.eEqqqqqqqqEe.',
    '..eqqqggqqqe..',
    '..eqqqggqqqe..',
    '..eqggggggqe..',
    '..eqgllgggqe..',
    '..eqqqggqqqe..',
    '..eqqqggqqqe..',
    '..eqqqqqqqqe..',
    '.eEqqqqqqqqEe.',
    '.eEqqqqqqqqEe.',
    '..eeeeeeeeee..',
    '..............',
  ],
  sp_soul: [
    '..eeeeeeeeee..',
    '.eEqqqqqqqqEe.',
    '.eEqqqqqqqqEe.',
    '..eqqqppqqqe..',
    '..eqqpccpqqe..',
    '..eqpcwwcpqe..',
    '..eqpcwwcpqe..',
    '..eqqpccpqqe..',
    '..eqqqPqPqqe..',
    '..eqqqqqqqqe..',
    '.eEqqqqqqqqEe.',
    '.eEqqqqqqqqEe.',
    '..eeeeeeeeee..',
    '..............',
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
  f_bread: [
    '..............',
    '..............',
    '..............',
    '....eeeeee....',
    '..eeqeeqeeqe..',
    '.eeqeeqeeqeeE.',
    '.eeeeeeeeeeeE.',
    '.qeeeeeeeeeeE.',
    '.qqeeeeeeeeEE.',
    '.QqqqqqqqqqQE.',
    '..QQQQQQQQQQ..',
    '..............',
    '..............',
    '..............',
  ],
  f_lamp: [
    '..............',
    '.....SSSS.....',
    '....S....S....',
    '...SSSSSSSS...',
    '....sccccs....',
    '....scwccs....',
    '....scwwcs....',
    '....swwwws....',
    '....swwwws....',
    '....sccccs....',
    '...SSSSSSSS...',
    '....SSSSSS....',
    '..............',
    '..............',
  ],
  f_drum: [
    '..............',
    '..q........q..',
    '...b......b...',
    '...qqqqqqqq...',
    '..QqqqqqqqqQ..',
    '..bQQQQQQQQb..',
    '..rqrrrrrrqr..',
    '..rrqrrrrqrr..',
    '..rrrqrrqrrr..',
    '..RRRRqqRRRR..',
    '..RRRqRRqRRR..',
    '..bbbbbbbbbb..',
    '...BBBBBBBB...',
    '..............',
  ],
  f_scroll: [
    '..............',
    '..............',
    '.QQQqqqqqqQQQ.',
    '.QqQqqqqqqQqQ.',
    '.QqQqqqCqqQqQ.',
    '.QqQCCCCCqQqQ.',
    '.QqQqqqCqqQqQ.',
    '.QqQqqCqqqQqQ.',
    '.QqQqCCCCCQqQ.',
    '.QqQqqCqqqQqQ.',
    '.QqQqqqqqqQqQ.',
    '.QQQqqqqqqQQQ.',
    '..............',
    '..............',
  ],
  f_stew: [
    '..............',
    '....w...w.....',
    '.....w...w....',
    '....w...w.....',
    '..............',
    '...ffFffFff...',
    '.SSSSSSSSSSSS.',
    '.kSssssssssSk.',
    '.kSssssssssSk.',
    '..SssssssssS..',
    '..SSssssssSS..',
    '...SSSSSSSS...',
    '....k....k....',
    '..............',
  ],
  f_iron: [
    '..............',
    '..........w...',
    '.........wcw..',
    '..........w...',
    '..............',
    '....ssssssss..',
    '...swwssssS...',
    '..sssssssSS...',
    '.ssssssssSS...',
    '.SSSSSSSSS....',
    '.SSSSSSSS.....',
    '..............',
    '..c...........',
    '..............',
  ],
  f_whet: [
    '..............',
    '..........w...',
    '.....w...ww...',
    '......w.w.....',
    '........w.....',
    '..............',
    '....sssssss...',
    '...sswssssS...',
    '..ssssssssS...',
    '.sssssssSSS...',
    '.SSSSSSSSS....',
    '.SSSSSSSS.....',
    '..............',
    '..............',
  ],
  f_chili: [
    '..............',
    '.........G....',
    '.......gG.....',
    '......gggG....',
    '.....rrrr.....',
    '....rwrrR.....',
    '....rrrrR.....',
    '...rrrrR......',
    '...rrrrR......',
    '..rrrrR.......',
    '..rrrR........',
    '.rrRR.........',
    '.RR...........',
    '..............',
  ],
  f_elixir: [
    '..............',
    '.....bbbb.....',
    '.....wwww.....',
    '......ww......',
    '......ww......',
    '.....w..w.....',
    '....w....w....',
    '...wppppppw...',
    '..wpwpppppPw..',
    '..wpwppppPPw..',
    '..wppppppPPw..',
    '...wPPPPPPw...',
    '....wwwwww....',
    '..............',
  ],
  f_sushi: [
    '..............',
    '..............',
    '..............',
    '..ffffff......',
    '.fFfffff......',
    '.ffffffff.....',
    '.wwwwww.rrrrr.',
    '.wwwwww.rrRrr.',
    '.wwwwww.rrRrr.',
    '.wwwwww.kkkkk.',
    '.wwwwww.kwwwk.',
    '........kwwwk.',
    '........kkkkk.',
    '..............',
  ],
  f_amulet: [
    '..............',
    '..y........y..',
    '...y......y...',
    '....y....y....',
    '.....y..y.....',
    '......yy......',
    '......cc......',
    '.....cwcc.....',
    '....cwcccC....',
    '....cccccC....',
    '....ccccCC....',
    '.....cCCC.....',
    '......CC......',
    '..............',
  ],
  f_shroom: [
    '..............',
    '.....pppp.....',
    '...pppppppp...',
    '..ppllppplpp..',
    '.pplpppppppPP.',
    '.pppppplpppPP.',
    '.PPPPPPPPPPPP.',
    '.....qqqq.....',
    '.....qqqQ.....',
    '.....qqqQ.....',
    '.l...qqqQ..l..',
    '....qqqqQQ....',
    '...l......l...',
    '..............',
  ],
  f_roast: [
    '..............',
    '..............',
    '..........ww..',
    '.........wwww.',
    '.....eeeeww...',
    '...eeqeeeE....',
    '..eqeeeeeE....',
    '..eeeeeeEE....',
    '..beeeeEEb....',
    '...bbEEbb.....',
    '.wwwwwwwwwwww.',
    '..wwwwwwwwww..',
    '...SSSSSSSS...',
    '..............',
  ],
  f_wine: [
    '..............',
    '..yyyyyyyyyy..',
    '..yrrrrrrrRy..',
    '..yrrrrrrrRy..',
    '..yRrrrrrRRy..',
    '...yRRRRRRy...',
    '....yyyyyo....',
    '......yo......',
    '......yo......',
    '......yo......',
    '.....yyoo.....',
    '...yyyyyooo...',
    '..............',
    '..............',
  ],
  f_can: [
    '..............',
    '..............',
    '...SSSSSSSS...',
    '..SsswsssssS..',
    '..sSSSSSSSSs..',
    '..swrrrrrrrS..',
    '..swrwwwwrrS..',
    '..srrwwwwrRS..',
    '..srrrrrrrRS..',
    '..sssssssssS..',
    '..swsssssSSS..',
    '..SSSSSSSSSS..',
    '...SSSSSSSS...',
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

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function iconCanvas(g: Grid) {
  const N = 16;
  const at = (x: number, y: number) => (x >= 1 && y >= 1 && x <= 14 && y <= 14 ? g[y - 1]?.[x - 1] ?? '.' : '.');
  const [c, x] = canvas(N, N);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const ch = at(i, j);
      let col: string | null = ch !== '.' ? PAL[ch] ?? null : null;
      if (!col) {
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && at(i + dx, j + dy) !== '.') { near = true; break; }
        if (near) col = OUTLINE;
      }
      if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); }
    }
  return c;
}

/* ───────── 藤蔓：面板上沿的角饰（左上角，右侧用镜像） ───────── */
function vine(W: number, H: number, seed: number) {
  const [c, x] = canvas(W, H);
  const px = (i: number, j: number, col: string) => {
    if (i < 0 || j < 0 || i >= W || j >= H) return;
    x.fillStyle = col;
    x.fillRect(Math.round(i), Math.round(j), 1, 1);
  };
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const stem = ['#0e2a12', '#2f7a34', '#58b04a'];
  const leaf = ['#0e2a12', '#3c9a3e', '#7ad860', '#c8ffb0'];
  // 叶片：5×3 菱形，带亮边
  const drawLeaf = (cx: number, cy: number, dir: number) => {
    const pts: [number, number, number][] = [
      [0, 0, 2], [dir, 0, 2], [2 * dir, 0, 2], [dir, -1, 3], [2 * dir, -1, 2], [3 * dir, -1, 2], [dir, 1, 1], [2 * dir, 1, 1], [3 * dir, 0, 3], [4 * dir, -1, 2],
    ];
    for (const [dx, dy] of pts) for (const [ox, oy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) px(cx + dx + ox, cy + dy + oy, leaf[0]);
    for (const [dx, dy, k] of pts) px(cx + dx, cy + dy, leaf[k]);
  };
  const flower = (cx: number, cy: number, petal: string) => {
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) px(cx + dx, cy + dy, petal);
    px(cx, cy, '#fff1b8');
  };
  const leaves: [number, number, number][] = [];
  const flowers: [number, number][] = [];
  // 上沿主藤：沿边起伏
  for (let i = 0; i < W - 6; i++) {
    const fade = 1 - i / (W - 6);
    const j = 5 + Math.sin(i / 7 + seed) * 2.2 * (0.4 + fade);
    px(i, j - 1, stem[0]); px(i, j + 2, stem[0]);
    px(i, j, stem[2]); px(i, j + 1, stem[1]);
    if (i > 6 && i % 11 === seed % 5 && fade > 0.1) leaves.push([i, Math.round(j + (i % 22 < 11 ? -2 : 3)), 1]);
    if (i > 10 && rnd() < 0.035 && fade > 0.3) flowers.push([i, Math.round(j + 1)]);
  }
  // 左侧垂下的藤：越往下越细
  for (let j = 4; j < H - 4; j++) {
    const i = 4 + Math.sin(j / 6 + seed * 0.7) * 1.8;
    px(i - 1, j, stem[0]); px(i + 2, j, stem[0]);
    px(i, j, stem[2]); px(i + 1, j, j > H * 0.6 ? stem[0] : stem[1]);
    if (j > 8 && j % 10 === seed % 4) leaves.push([Math.round(i + (j % 20 < 10 ? 2 : -1)), j, j % 20 < 10 ? 1 : -1]);
  }
  // 角上一簇卷须
  for (let a = 0; a < Math.PI * 1.5; a += 0.12) {
    const r = 2 + a * 1.4;
    px(10 + Math.cos(a) * r, 12 + Math.sin(a) * r, stem[1]);
  }
  for (const [i, j, d] of leaves) drawLeaf(i, j, d);
  for (const [i, j] of flowers) flower(i, j, rnd() < 0.5 ? '#ff8ab0' : '#ffd36b');
  return c;
}

/* ───────── 施法法阵：俯视圆形符文环，CSS 再压扁成脚下的椭圆 ───────── */
function rune(core: string, glow: string, dark: string) {
  const N = 40, c0 = N / 2 - 0.5;
  const [c, x] = canvas(N, N);
  const px = (i: number, j: number, col: string) => { x.fillStyle = col; x.fillRect(Math.round(i), Math.round(j), 1, 1); };
  const ring = (r: number, col: string, gap = 0) => {
    const n = Math.round(r * 7);
    for (let k = 0; k < n; k++) {
      if (gap && k % gap === 0) continue;
      const a = (k / n) * Math.PI * 2;
      px(c0 + Math.cos(a) * r, c0 + Math.sin(a) * r, col);
    }
  };
  ring(19, dark); ring(18, core); ring(17, glow);
  ring(12, core, 5); ring(11, dark, 5);
  // 六个符文刻在两环之间
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2, cx = c0 + Math.cos(a) * 14.5, cy = c0 + Math.sin(a) * 14.5;
    px(cx, cy - 1, glow); px(cx, cy, core); px(cx, cy + 1, glow); px(cx - 1, cy, glow); px(cx + 1, cy, glow);
  }
  // 中心六芒星
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2, b = ((k + 2) / 6) * Math.PI * 2;
    for (let t = 0; t <= 1; t += 0.06) px(c0 + (Math.cos(a) * (1 - t) + Math.cos(b) * t) * 10, c0 + (Math.sin(a) * (1 - t) + Math.sin(b) * t) * 10, t % 0.24 < 0.06 ? glow : core);
  }
  return c;
}

/** 启动时调用一次 */
export function installItemSprites() {
  const root = document.documentElement.style;
  for (const [id, g] of Object.entries(ICONS)) root.setProperty(`--pxi-${id}`, `url("${iconCanvas(g).toDataURL()}")`);
  root.setProperty('--px-vine', `url("${vine(96, 64, 3).toDataURL()}")`);
  root.setProperty('--px-rune', `url("${rune('#b46cff', '#f2dcff', '#3a1466').toDataURL()}")`);
  // 施法法阵按阵营上色：图案一致，颜色说明是谁在施法
  const RUNES: Record<string, [string, string, string]> = {
    light: ['#ffd36b', '#fff6d6', '#6b4a10'], shadow: ['#ff5f6d', '#ffd6da', '#5e1220'],
    abyss: ['#b46cff', '#f2dcff', '#3a1466'], magma: ['#ff8a2a', '#ffe0b8', '#5e2206'],
    frost: ['#5fdcff', '#e0fbff', '#0c4058'], desert: ['#e9bd72', '#fff0cc', '#664418'],
    neutral: ['#c8d0e2', '#ffffff', '#353c4e'], enemy: ['#ff4b6e', '#ffd0da', '#3a0b19'],
  };
  for (const [f, c] of Object.entries(RUNES)) root.setProperty(`--px-rune-${f}`, `url("${rune(...c).toDataURL()}")`);
  root.setProperty('--px-vine-b', `url("${vine(80, 40, 8).toDataURL()}")`);
}

/** 道具图标节点；没有专属图的回退到对应类别占位 */
export function itemIcon(id: string, fallback: 'spell' | 'order' | 'pack' | 'coin' = 'spell', cls = '') {
  const key = id in ICONS ? id : fallback;
  return h('i', { class: `px-item ${cls}`, style: `--pxi:var(--pxi-${key})`, 'aria-hidden': 'true' });
}
