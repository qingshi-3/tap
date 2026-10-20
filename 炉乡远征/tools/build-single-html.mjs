// Single-file trial build: one HTML that runs by double-click (file://), no server.
// JS modules are bundled into a classic script; every file under dist/assets and
// dist/vendor is embedded and served from blob: URLs, so fetch(), <img>, Audio,
// CSS url() and canvas pixel reads all behave as on http.
//   node tools/build-single-html.mjs [--out output/single/炉乡远征.html]
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, posix, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), dist = join(root, 'dist');
const outArg = process.argv.indexOf('--out');
const out = join(root, outArg > 0 ? process.argv[outArg + 1] : 'output/single/炉乡远征.html');
const esbuildPath = process.env.ESBUILD ?? '/tmp/bundler/node_modules/esbuild';
const esbuild = createRequire(import.meta.url)(esbuildPath);

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.otf': 'font/otf', '.json': 'application/json', '.plist': 'application/xml', '.xml': 'application/xml', '.txt': 'text/plain', '.css': 'text/css' };

const walk = dir => readdirSync(dir).flatMap(name => { const p = join(dir, name); return statSync(p).isDirectory() ? walk(p) : [p]; });
const rel = p => relative(dist, p).split('\\').join('/');

// 1. Assets: dist-relative path -> [mime, base64].
const assets = {};
for (const file of [...walk(join(dist, 'assets')), ...walk(join(dist, 'vendor'))]) {
  const mime = MIME[extname(file).toLowerCase()];
  if (mime && !file.endsWith('.css')) assets[rel(file)] = [mime, readFileSync(file).toString('base64')];
}

// 2. CSS in <link> order, url() rewritten to dist-relative paths (swapped for blob: URLs at boot).
let html = readFileSync(join(dist, 'index.html'), 'utf8');
const cssFiles = [...html.matchAll(/<link rel="stylesheet" href="\.\/([^"]+)">/g)].map(m => m[1]);
const css = cssFiles.map(file => readFileSync(join(dist, file), 'utf8').replace(/url\((['"]?)(?!data:|https?:|#)([^'")]+)\1\)/g,
  (_, q, path) => `url("${posix.normalize(posix.join(posix.dirname(file), path))}")`)).join('\n');

// 3. JS bundle.
const { outputFiles } = await esbuild.build({ entryPoints: [join(dist, 'js/main.js')], bundle: true, format: 'iife', minify: true, target: 'es2020', write: false,
  // Modules resolve paths against their own URL; every module lives in dist/js.
  define: { 'import.meta.url': '__lxModuleUrl' }, banner: { js: "var __lxModuleUrl=location.href.replace(/[?#].*$/,'').replace(/[^/]*$/,'')+'js/main.js';" }, logLevel: 'warning' });
const js = outputFiles[0].text;

// 4. Boot shim: path resolver, blob cache, and patches for every way the game loads a file.
const boot = `(() => {
const DATA = JSON.parse(document.getElementById('lx-assets').textContent), URLS = {};
const base = location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
const key = value => { if (typeof value !== 'string') return null; let p = value.trim();
  if (p.startsWith(base)) p = p.slice(base.length); p = p.replace(/^\\.\\//, '').replace(/[?#].*$/, '');
  try { p = decodeURIComponent(p); } catch {} return DATA[p] ? p : null; };
const blobOf = k => { const [mime, b64] = DATA[k], bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new Blob([bytes], { type: mime }); };
const resolve = value => { const k = key(value); if (!k) return value; return URLS[k] ??= URL.createObjectURL(blobOf(k)); };
const fixUrls = text => text.replace(/url\\((['"]?)([^'")]+)\\1\\)/g, (m, q, p) => { const r = resolve(p); return r === p ? m : 'url("' + r + '")'; });
window.__lxResolve = resolve;
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init) => { const k = key(typeof input === 'string' ? input : input?.url);
  return k ? Promise.resolve(new Response(blobOf(k), { status: 200, headers: { 'Content-Type': DATA[k][0] } })) : nativeFetch(input, init); };
for (const [proto, prop] of [[HTMLImageElement.prototype, 'src'], [HTMLMediaElement.prototype, 'src'], [HTMLSourceElement.prototype, 'src'], [HTMLLinkElement.prototype, 'href']]) {
  const d = Object.getOwnPropertyDescriptor(proto, prop);
  Object.defineProperty(proto, prop, { ...d, set(v) { d.set.call(this, resolve(v)); } });
}
const setAttr = Element.prototype.setAttribute;
Element.prototype.setAttribute = function (name, value) { const n = String(name).toLowerCase();
  return setAttr.call(this, name, n === 'src' || n === 'href' ? resolve(value) : n === 'style' ? fixUrls(String(value)) : value); };
const NativeAudio = window.Audio;
window.Audio = function (src) { const a = new NativeAudio(); if (src !== undefined) a.src = src; return a; };
window.Audio.prototype = NativeAudio.prototype;
const styleSet = CSSStyleDeclaration.prototype.setProperty;
CSSStyleDeclaration.prototype.setProperty = function (p, v, pr) { return styleSet.call(this, p, typeof v === 'string' ? fixUrls(v) : v, pr); };
// Chromium exposes style.backgroundImage etc. through a named-property interceptor that cannot be patched;
// game code sets url() styles through setProperty instead, and the observer below catches the rest.
const NativeFontFace = window.FontFace;
if (NativeFontFace) { window.FontFace = function (family, source, descriptors) { return new NativeFontFace(family, typeof source === 'string' ? fixUrls(source) : source, descriptors); };
  window.FontFace.prototype = NativeFontFace.prototype; }
const fixNode = el => { if (el.nodeType !== 1) return;
  for (const a of ['src', 'href']) { const v = el.getAttribute(a); if (v && key(v)) setAttr.call(el, a, resolve(v)); }
  const s = el.getAttribute('style'); if (s && s.includes('url(')) { const f = fixUrls(s); if (f !== s) setAttr.call(el, 'style', f); }
  if (el.tagName === 'STYLE' && !el.__lxFixed) { el.__lxFixed = true; el.textContent = fixUrls(el.textContent); } };
new MutationObserver(list => { for (const m of list) { if (m.type === 'attributes') fixNode(m.target);
  else for (const n of m.addedNodes) if (n.nodeType === 1) { fixNode(n); n.querySelectorAll?.('[src],[href],[style]').forEach(fixNode); } } })
  .observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'href', 'style'] });
const style = document.createElement('style'); style.__lxFixed = true;
style.textContent = fixUrls(document.getElementById('lx-css').textContent); document.head.append(style);
})();`;

// 5. Assemble.
const safeScript = text => text.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
html = html
  .replace(/\s*<link rel="stylesheet" href="[^"]+">/g, '')
  .replace(/\s*<link rel="preload"[^>]*>/g, '')
  .replace(/\s*<script type="module" src="\.\/js\/main\.js"><\/script>/, '')
  .replace('</head>', `<script type="application/json" id="lx-assets">${safeScript(JSON.stringify(assets))}</script>\n` +
    `<script type="text/plain" id="lx-css">${safeScript(css)}</script>\n<script>${safeScript(boot)}</script>\n</head>`)
  .replace('</body>', `<script>${safeScript(js)}</script>\n</body>`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${rel(out).replace(/^(\.\.\/)+/, '')}: ${(Buffer.byteLength(html) / 1048576).toFixed(1)} MB, ${Object.keys(assets).length} assets, ${cssFiles.length} css, js ${(js.length / 1024).toFixed(0)} KB`);
