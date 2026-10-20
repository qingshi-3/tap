// 美术自检截图：node tools/art-shot.mjs  → /tmp/pt-art/*.png
import http from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {chromium} = require('/home/admin/workspace/喵喵当铺/node_modules/playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const out = '/tmp/pt-art';
const mime = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8'};
const server = http.createServer(async (req, res) => {
  try {
    const p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(root)) { res.writeHead(403).end(); return; }
    res.writeHead(200, {'Content-Type': mime[path.extname(p)] || 'application/octet-stream'}).end(await readFile(p));
  } catch { res.writeHead(404).end(); }
}).listen(4199);
await mkdir(out, {recursive: true});
// 该 playwright 版本期望的浏览器可能未下载；默认路径不存在时回退到本机已有的 headless shell。
import {existsSync, readdirSync} from 'node:fs';
let executablePath;
try { if (!existsSync(chromium.executablePath())) { const base = path.join(process.env.HOME || '', '.cache/ms-playwright'); const d = readdirSync(base).filter(n => n.startsWith('chromium_headless_shell-')).sort().pop(); if (d) executablePath = path.join(base, d, 'chrome-headless-shell-linux64/chrome-headless-shell'); } } catch {}
const browser = await chromium.launch(executablePath ? {executablePath} : {});
const errs = [];
try {
  for (const dsf of [1, 2]) {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}, deviceScaleFactor: dsf});
    page.on('pageerror', e => errs.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto('http://localhost:4199/tools/art-gallery.html');
    await page.waitForFunction(() => window.__done === true, null, {timeout: 15000});
    const inner = await page.evaluate(() => window.__errors);
    errs.push(...inner);
    const ids = dsf === 1 ? ['terrain56', 'terrain32', 'b32_0', 'b32_1', 'b56_0', 'b56_1', 'b56_2', 'b56_3', 'b56_4', 'scene', 'cards', 'icons'] : ['scene', 'b32_0', 'b32_1'];
    for (const id of ids) await page.locator('#' + id).screenshot({path: `${out}/${id}${dsf === 2 ? '@2x' : ''}.png`});
    await page.close();
  }
} finally { await browser.close(); server.close(); }
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'pageerror: none');
process.exit(errs.length ? 1 : 0);
