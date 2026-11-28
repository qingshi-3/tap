// 像素 UI 皮肤：用代码绘制图标与材质贴图，写入 CSS 变量；并按屏幕高度设置界面整数缩放。
const PAL = {
  k: '#120c1a', y: '#ffd24a', Y: '#fff0a0', o: '#b8862a', r: '#c8283a', R: '#ff6a5a', w: '#f4ecd8',
  g: '#8a8a9a', G: '#c8ccd8', d: '#3a3a4a', b: '#6a4430', B: '#a8744a', p: '#8a5ad0', P: '#c8a0ff',
  c: '#4ac8e8', C: '#b0f0ff', n: '#4aa85a', N: '#8ae07a',
};

const ICONS = {
  gold: [
    '....kkkk....', '..kkyyyykk..', '.kyYYyyyyok.', '.kyYyyyyyok.', 'kyYyyooyyyok', 'kyyyoyyoyyok',
    'kyyyoyyoyyok', 'kyyyyooyyyok', '.kyyyyyyyok.', '.koyyyyyook.', '..kkooookk..', '....kkkk....'],
  fame: [
    '.....kk.....', '....kyyk....', '....kYyk....', 'kkkkkYyykkkk', 'kYYYYyyyyyok', '.kyyyyyyyok.',
    '..kyyyyyyk..', '..kyyyyyyk..', '.kyyyokyyyk.', '.kyyok.kyok.', 'kyok....kok.', 'kkk......kk.'],
  mats: [
    '.....kk.....', '....kPPk....', '...kPPppk...', '..kPPpppdk..', '.kPPppppppk.', '.kPpppppppk.',
    '.kPpppppppk.', '.kPppppppdk.', '..kPpppppk..', '...kPpppk...', '....kppk....', '.....kk.....'],
  quests: [
    '.kkkkkkkkk..', 'kBwwwwwwwBk.', 'kbkwwwwwwbk.', '.kwkkkkwwk..', '.kwwwwwwwk..', '.kwkkkkkwk..',
    '.kwwwwwwwk..', '.kwkkkkwwk..', '.kwwwwwwwk..', 'kBwwwwwwwBk.', 'kbbbbbbbbbk.', '.kkkkkkkkk..'],
  members: [
    '...kkkkkk...', '..kGGGGGgk..', '.kGGgGGGggk.', '.kGgggGgggk.', 'kGGgggGggggk', 'kGkkkkGkkkgk',
    'kGkddkGkddgk', 'kGgggggggggk', 'kGgkgggggkgk', '.kgkgggggkk.', '.kkk.kkk.kk.', '............'],
  recruit: [
    '............', '..kkkkkkk...', '.kwwwwwwwk..', '.kwGwwwwwkkk', '.kyyyyyyykBk', '.kyYyyyyykBk',
    '.kyYyyyyykBk', '.kyYyyyyykBk', '.kyyyyyyykk.', '.kooooooook.', '..kkkkkkkk..', '............'],
  facilities: [
    '..kkkkk.....', '.kGGGGGk....', 'kGGGGGGGkk..', 'kgggggggGk..', '.kkkkkbkk...', '.....kbk....',
    '.....kbk....', '.....kBk....', '.....kbk....', '.....kBk....', '.....kbk....', '.....kkk....'],
  guild: [
    'kkkkkkkkkkk.', 'kyrrrrrrryk.', 'kyrryyyrryk.', 'kyrryrrrryk.', 'kyrryyrrryk.', 'kyrryrrrryk.',
    'kyrrrrrrryk.', '.kyrrrrryk..', '..kyrrryk...', '...kyyyk....', '....kyk.....', '.....k......'],
  moon: [
    '....kkkk....', '..kkYYYk....', '.kYYYyk.....', '.kYYyk......', 'kYYyk.......', 'kYYyk.......',
    'kYYyk.......', 'kYYyyk......', '.kYYyyk..k..', '.kYYYyykkk..', '..kkYYYYk...', '....kkkk....'],
  sword: [
    '..........kk', '.........kGk', '........kGk.', '.......kGk..', '......kGk...', '.k...kGk....',
    '.kk.kGk.....', '..kkGk......', '..kbkk......', '.kbk.kk.....', 'kbk.........', 'kk..........'],
  back: [
    '............', '....kk......', '...kwk......', '..kwwk......', '.kwwwkkkkkk.', 'kwwwwwwwwwwk',
    'kwwwwwwwwwwk', '.kwwwkkkkkk.', '..kwwk......', '...kwk......', '....kk......', '............'],
  heart: [
    '............', '.kkk...kkk..', 'kRRrk.kRrrk.', 'kRwrrkrrrrk.', 'kRrrrrrrrrk.', 'kRrrrrrrrrk.',
    '.krrrrrrrk..', '..krrrrrk...', '...krrrk....', '....krk.....', '.....k......', '............'],
  lock: [
    '............', '....kkkk....', '...kGddGk...', '...kGkkGk...', '..kkkkkkkk..', '..kyyyyyyk..',
    '..kyYkkyok..', '..kyykkyok..', '..kyyyyyok..', '..kooooook..', '..kkkkkkkk..', '............'],
};

function bitmapURL(rows, scale = 1) {
  const c = document.createElement('canvas');
  c.width = rows[0].length * scale;
  c.height = rows.length * scale;
  const g = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (PAL[ch]) { g.fillStyle = PAL[ch]; g.fillRect(x * scale, y * scale, scale, scale); }
  }));
  return c.toDataURL();
}

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function texture(w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d'), w, h);
  return c.toDataURL();
}

const TEX = {
  slate: (g, w, h) => {
    g.fillStyle = '#3a3e52';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = hash(i) > 0.5 ? '#42465c' : '#34374a';
      g.fillRect(Math.floor(hash(i * 3.1) * w), Math.floor(hash(i * 7.3) * h), 1 + (i % 3 === 0), 1);
    }
  },
  dark: (g, w, h) => {
    g.fillStyle = '#1e1c2c';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = hash(i) > 0.5 ? '#232134' : '#1a1826';
      g.fillRect(Math.floor(hash(i * 3.1) * w), Math.floor(hash(i * 7.3) * h), 2, 1);
    }
  },
  parch: (g, w, h) => {
    g.fillStyle = '#ead6aa';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) {
      g.fillStyle = ['#e2cc9c', '#f0dfb8', '#dcc290'][i % 3];
      g.fillRect(Math.floor(hash(i * 3.1) * w), Math.floor(hash(i * 7.3) * h), 1 + (i % 4 === 0) * 2, 1);
    }
  },
  wood: (g, w, h) => {
    for (let y = 0; y < h; y += 8) {
      g.fillStyle = (y / 8) % 2 ? '#5a3a28' : '#62402c';
      g.fillRect(0, y, w, 8);
      g.fillStyle = '#3e2619';
      g.fillRect(0, y + 7, w, 1);
      g.fillRect(Math.floor(hash(y) * w), y, 1, 7);
      g.fillStyle = '#6e4a32';
      for (let i = 0; i < 4; i++) g.fillRect(Math.floor(hash(y * 5 + i) * w), y + 2 + (i % 4), 4, 1);
    }
  },
};

export function installSkin() {
  const root = document.documentElement.style;
  for (const [k, rows] of Object.entries(ICONS)) root.setProperty(`--ic-${k}`, `url(${bitmapURL(rows)})`);
  for (const [k, paint] of Object.entries(TEX)) root.setProperty(`--tx-${k}`, `url(${texture(32, 32, paint)})`);
  const fit = () => {
    const h = Math.min(window.innerHeight, window.innerWidth * 0.6);
    const u = Math.max(1, Math.min(2.5, Math.floor((h / 380) * 2) / 2));
    root.setProperty('--u', u);
  };
  fit();
  window.addEventListener('resize', fit);
}

export const iconCSS = name => `<i class="ic ic-${name}"></i>`;
