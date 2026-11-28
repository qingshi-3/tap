// 构建：复制到 dist/，并额外产出素材内联为 data URI 的单文件版本 dist/群英公会.html。
import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

await rm(dist, {recursive: true, force: true});
await mkdir(dist, {recursive: true});
for (const item of ['index.html', 'css', 'js', 'assets']) await cp(path.join(root, item), path.join(dist, item), {recursive: true});
await writeFile(path.join(dist, 'version.json'), JSON.stringify({version: pkg.version, builtAt: new Date().toISOString(), saveKey: 'guild-of-legends.save.v1'}));

// ---------- 单文件版 ----------
const read = p => readFile(path.join(root, p), 'utf8');

// 依赖顺序打包 ES 模块（项目内只有相对导入）
async function bundle(entry) {
  const order = [];
  const seen = new Set();
  const sources = {};
  async function visit(file) {
    if (seen.has(file)) return;
    seen.add(file);
    const src = await read(path.join('js', file));
    sources[file] = src;
    for (const m of src.matchAll(/import\s+[\s\S]*?\s+from\s+'\.\/([\w.]+)';/g)) await visit(m[1]);
    order.push(file);
  }
  await visit(entry);
  const out = ['const __m = {};'];
  for (const file of order) {
    let src = sources[file];
    src = src.replace(/import\s+\*\s+as\s+(\w+)\s+from\s+'\.\/([\w.]+)';/g, (_, n, f) => `const ${n} = __m['${f}'];`);
    src = src.replace(/import\s+\{([\s\S]*?)\}\s+from\s+'\.\/([\w.]+)';/g, (_, names, f) =>
      `const {${names.replace(/(\w+)\s+as\s+(\w+)/g, '$1: $2')}} = __m['${f}'];`);
    const names = [...src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
    src = src.replace(/^export\s+/gm, '');
    out.push(`__m['${file}'] = (() => {\n${src}\nreturn {${names.join(', ')}};\n})();`);
  }
  return out.join('\n');
}

const manifest = JSON.parse(await read('assets/duelyst/assets/manifest.json'));
const toData = async rel => `data:image/png;base64,${(await readFile(path.join(root, 'assets/duelyst', rel))).toString('base64')}`;
const walk = async obj => {
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') {
      if (typeof v.path === 'string' && v.path.endsWith('.png')) v.path = await toData(v.path);
      else await walk(v);
    }
  }
};
await walk(manifest);

const esc = s => s.replace(/<\/script/gi, '<\\/script');
let html = await read('index.html');
html = html.replace('<link rel="stylesheet" href="css/style.css">', () => `<style>\n${'{{CSS}}'}\n</style>`);
html = html.replace(/<script src="assets\/duelyst\/assets\/manifest.js"><\/script>\s*<script src="assets\/duelyst\/duelyst-h5.js"><\/script>\s*<script type="module" src="js\/main.js"><\/script>/,
  '<script>{{MANIFEST}}</script>\n<script>{{KIT}}</script>\n<script type="module">{{APP}}</script>');
const MIME = {woff2: 'font/woff2', png: 'image/png'};
const css = (await read('css/style.css')).replace(/url\("\.\.\/(assets\/[^"]+\.(woff2|png))"\)/g, (m, rel, ext) => `url("${'{{'}${rel}${'}}'}")`);
const cssAssets = [...css.matchAll(/\{\{(assets\/[^}]+\.(woff2|png))\}\}/g)];
let cssOut = css;
for (const [tok, rel, ext] of cssAssets) cssOut = cssOut.replace(tok, `data:${MIME[ext]};base64,${(await readFile(path.join(root, rel))).toString('base64')}`);
const kitSrc = await read('assets/duelyst/duelyst-h5.js');
const app = await bundle('main.js');
html = html
  .replace('{{CSS}}', () => cssOut)
  .replace('{{MANIFEST}}', () => `globalThis.DuelystH5Manifest = ${JSON.stringify(manifest)};`)
  .replace('{{KIT}}', () => esc(kitSrc))
  .replace('{{APP}}', () => esc(app));
const single = path.join(dist, '群英公会.html');
await writeFile(single, html);
console.log(`Built guild-of-legends/dist (v${pkg.version}) + 单文件 ${(html.length / 1048576).toFixed(2)} MB`);
