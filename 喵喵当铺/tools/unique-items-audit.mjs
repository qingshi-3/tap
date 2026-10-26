import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as current from '../js/data.js';

const root = new URL('../', import.meta.url);
const output = new URL('../../output/miaomiao-pawnshop/unique-items-20261023/', root);
// A data URL keeps the frozen .js snapshot an ES module regardless of its folder's package type.
const beforeSource = await readFile(new URL('data-before.js', output), 'utf8');
const before = await import(`data:text/javascript;base64,${Buffer.from(beforeSource).toString('base64')}`);
const withoutIcons = exports => Object.fromEntries(Object.entries(exports).map(([key, value]) => [key,
  key === 'ITEMS' ? Object.fromEntries(Object.entries(value).map(([id, item]) => {
    const { icon, ...rest } = item; return [id, rest];
  })) : value]));
const comparable = value => {
  if (typeof value === 'function') return { functionSource: value.toString() };
  if (Array.isArray(value)) return value.map(comparable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, comparable(child)]));
  return value;
};
assert.deepEqual(comparable(withoutIcons(current)), comparable(withoutIcons(before)), 'Only ITEMS.icon may change in data exports');
assert.equal(Object.keys(current.ITEMS).length, 49);
let sharp;
try { sharp = (await import('sharp')).default; } catch {
  try { sharp = (await import('file:///C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs')).default; } catch { /* File hashes remain mandatory; visual review covers unavailable decoding. */ }
}
const manifest = [];
for (const [id, item] of Object.entries(current.ITEMS)) {
  assert.equal(item.icon, undefined, `${id} must use its own stable asset ID`);
  const path = `assets/items/${id}.png`;
  const bytes = await readFile(new URL(path, root));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  let pixels;
  if (sharp) {
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    pixels = { width: info.width, height: info.height,
      sha256: createHash('sha256').update(`${info.width}x${info.height}:`).update(data).digest('hex') };
  }
  manifest.push({ id, name: item.name, path, bytes: bytes.length, sha256, ...(pixels ? { pixels } : {}) });
}
for (const key of ['path', 'sha256']) assert.equal(new Set(manifest.map(x => x[key])).size, 49, `Duplicate ${key}`);
if (sharp) assert.equal(new Set(manifest.map(x => x.pixels.sha256)).size, 49, 'Duplicate decoded pixels');
await mkdir(output, { recursive: true });
const report = { count: manifest.length, dataContractUnchangedExceptIcons: true, decodedPixelCheck: !!sharp, manifest };
await writeFile(new URL('item-manifest.json', output), JSON.stringify(report, null, 2) + '\n');
console.log(`PASS: 49 distinct existing item paths and file hashes; pixel decoding ${sharp ? 'passed' : 'unavailable, visual confirmation required'}; all exports unchanged except ITEMS.icon.`);
console.log(fileURLToPath(new URL('item-manifest.json', output)));
