// 把 Noto Sans SC 裁剪到游戏用到的字符；改文案后重跑：node scripts/subset-fonts.mjs
import { copyFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const NM = '/home/admin/workspace/奇兵列阵/source/node_modules/';
const subsetFont = createRequire(NM)('subset-font');
const files = [...readdirSync('js').map((f) => 'js/' + f), 'css/style.css', 'index.html'];
const chars = new Set();
for (const f of files) for (const ch of readFileSync(f, 'utf8')) if (ch.codePointAt(0) > 0x2000) chars.add(ch);
for (const ch of '0123456789，。：；！？、（）《》「」—…·+-/×→♥✓✗⚠？☰✕−') chars.add(ch);
const text = [...chars].join('');
const src = NM + '@fontsource/noto-sans-sc/files';
let css = '/* 由 scripts/subset-fonts.mjs 生成 */\n';
for (const w of [400, 700, 900]) {
  const buf = readFileSync(`${src}/noto-sans-sc-chinese-simplified-${w}-normal.woff2`);
  writeFileSync(`fonts/noto-sc-${w}.woff2`, await subsetFont(buf, text, { targetFormat: 'woff2' }));
  const lat = `noto-sans-sc-latin-${w}-normal.woff2`;
  copyFileSync(`${src}/${lat}`, `fonts/${lat}`);
  css += `@font-face{font-family:'Noto Sans SC';font-display:swap;font-weight:${w};src:url(../fonts/noto-sc-${w}.woff2) format('woff2');}\n`;
  css += `@font-face{font-family:'Noto Sans SC';font-display:swap;font-weight:${w};src:url(../fonts/${lat}) format('woff2');unicode-range:U+0000-00FF,U+2000-206F;}\n`;
}
writeFileSync('css/fonts.css', css);
console.log(chars.size + ' chars');
