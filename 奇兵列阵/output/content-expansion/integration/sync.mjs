import { cpSync, copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const game = fileURLToPath(new URL('../../../', import.meta.url));
const source = join(game, 'source', 'dist');
const sourceNote = join(game, 'dist', 'assets', 'SOURCES.md');
if (existsSync(sourceNote)) copyFileSync(sourceNote, join(source, 'assets', 'SOURCES.md'));
const list = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? list(join(dir, entry.name)) : [join(dir, entry.name)]);
const files = list(source);
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
for (const output of ['dist', 'web-dist']) {
  cpSync(source, join(game, output), { recursive: true });
  for (const file of files) assert.equal(hash(join(game, output, relative(source, file))), hash(file));
}
const single = join(game, 'source', 'dist-single', 'index.html');
const offline = join(game, '阵列-双击打开.html');
copyFileSync(single, offline);
assert.equal(hash(single), hash(offline));
const report = { files: files.length, splitOutputs: ['dist', 'web-dist'], hashMatch: true, singleMatch: true, rule: 'same-name-same-star-only', ui: 'drag designation, no-target exception, ritualist no-space reason, restored original placement and merge effects' };
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'sync.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
