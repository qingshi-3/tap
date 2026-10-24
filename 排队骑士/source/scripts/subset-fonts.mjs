// 把 Noto Sans SC 中文字重裁剪到游戏实际用到的字符（每个字重从 ~1.1MB 降到几十 KB）。
// 构建前运行；改了文案后重新跑一次即可。
import { copyFileSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import subsetFont from 'subset-font';
import ts from 'typescript';

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = [...walk('src').filter((f) => /\.(ts|css)$/.test(f)), 'index.html'];
const chars = new Set();
// 注释里的中文不会显示，先剥掉再收字（约省三成字形）
const strip = (f, s) =>
  f.endsWith('.ts')
    ? ts.transpileModule(s, { compilerOptions: { removeComments: true, target: ts.ScriptTarget.ESNext } }).outputText
    : f.endsWith('.css')
      ? s.replace(/\/\*[\s\S]*?\*\//g, '')
      : s.replace(/<!--[\s\S]*?-->/g, '');
for (const f of files) for (const ch of strip(f, readFileSync(f, 'utf8'))) if (ch.codePointAt(0) > 0x2000) chars.add(ch);
// 保底：数字、标点、常见符号
for (const ch of '0123456789０１２３４５６７８９，。：；！？、（）《》「」—…·+-/×→⇄①②③④⑤⑥⑦⑧⑨⑩') chars.add(ch);
const text = [...chars].join('');

mkdirSync('src/fonts', { recursive: true });
const src = 'node_modules/@fontsource/noto-sans-sc/files';
let css = '/* 由 scripts/subset-fonts.mjs 生成，勿手改 */\n';
for (const w of [400, 700, 900]) {
  const buf = readFileSync(`${src}/noto-sans-sc-chinese-simplified-${w}-normal.woff2`);
  const out = await subsetFont(buf, text, { targetFormat: 'woff2' });
  writeFileSync(`src/fonts/noto-sc-${w}.woff2`, out);
  css += `@font-face{font-family:'Noto Sans SC';font-style:normal;font-display:swap;font-weight:${w};src:url(./noto-sc-${w}.woff2) format('woff2');}\n`;
  console.log(`weight ${w}: ${(buf.length / 1024) | 0}KB -> ${(out.length / 1024) | 0}KB`);
}
// 西文字体只拷 woff2（fontsource 的 css 会把 woff 回退一起打进包，现代浏览器用不上）
const latin = [
  ['noto-sans-sc', 'Noto Sans SC', 400],
  ['noto-sans-sc', 'Noto Sans SC', 700],
  ['russo-one', 'Russo One', 400],
  ['cinzel', 'Cinzel', 700],
];
for (const [pkg, family, w] of latin) {
  const file = `${pkg}-latin-${w}-normal.woff2`;
  copyFileSync(`node_modules/@fontsource/${pkg}/files/${file}`, `src/fonts/${file}`);
  css += `@font-face{font-family:'${family}';font-style:normal;font-display:swap;font-weight:${w};src:url(./${file}) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}\n`;
}
writeFileSync('src/fonts/fonts.css', css);
console.log(`${chars.size} chars`);
