// 从 Duelyst H5 接入包中只导入本作实际用到的单位、特效与图标，并生成裁剪后的帧表。
// 用法：node tools/import-duelyst.mjs [接入包根目录]
import {copyFile, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assetUsage} from '../js/data.js';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const DEFAULT_KIT = '/Users/qingshi/Documents/Codex/2026-11-21/users-qingshi-documents-chatgpt-tap-assets/outputs/Duelyst-H5接入包';
const kit = path.resolve(process.argv[2] || process.env.DUELYST_KIT || DEFAULT_KIT);
const out = path.join(root, 'assets', 'duelyst');

if (!existsSync(path.join(kit, 'assets', 'manifest.json'))) {
  console.error('找不到接入包：' + kit);
  process.exit(1);
}

const full = JSON.parse(await readFile(path.join(kit, 'assets', 'manifest.json'), 'utf8'));
const usage = assetUsage();
const missing = [];
const trimmed = {version: full.version, units: {}, effects: {}, icons: {}};
const files = new Set();

for (const id of usage.units) {
  const unit = full.units[id];
  if (!unit) { missing.push('unit:' + id); continue; }
  const actions = {};
  for (const name of ['idle', 'attack']) {
    const a = unit.actions[name];
    if (!a) continue;
    const {path: p, width, height, count, cols, ms, anchorX, anchorY} = a;
    actions[name] = {path: p, width, height, count, cols, ms, anchorX, anchorY};
    files.add(p);
  }
  trimmed.units[id] = {actions};
}
for (const key of usage.effects) {
  const e = full.effects[key];
  if (!e) { missing.push('effect:' + key); continue; }
  const {path: p, width, height, count, cols, ms, anchorX, anchorY} = e;
  trimmed.effects[key] = {path: p, width, height, count, cols, ms, anchorX, anchorY};
  files.add(p);
}
for (const id of usage.icons) {
  const icon = full.icons[id];
  if (!icon) { missing.push('icon:' + id); continue; }
  trimmed.icons[id] = {name: icon.name, path: icon.path};
  files.add(icon.path);
}

if (missing.length) {
  console.error('素材包缺少以下条目：\n' + missing.join('\n'));
  process.exit(1);
}

await rm(out, {recursive: true, force: true});
for (const dir of ['units', 'effects', 'icons']) await mkdir(path.join(out, 'assets', dir), {recursive: true});
let bytes = 0;
for (const p of files) {
  await copyFile(path.join(kit, p), path.join(out, p));
  bytes += (await readFile(path.join(out, p))).length;
}
await copyFile(path.join(kit, 'duelyst-h5.js'), path.join(out, 'duelyst-h5.js'));
await copyFile(path.join(kit, 'UPSTREAM-CC0.txt'), path.join(out, 'UPSTREAM-CC0.txt'));
const json = JSON.stringify(trimmed);
await writeFile(path.join(out, 'assets', 'manifest.json'), json);
await writeFile(path.join(out, 'assets', 'manifest.js'), 'globalThis.DuelystH5Manifest = ' + json + ';\n');
console.log(`导入 ${usage.units.length} 个单位、${usage.effects.length} 个特效、${usage.icons.length} 个图标；${files.size} 张图，${(bytes / 1024 / 1024).toFixed(2)} MB`);
