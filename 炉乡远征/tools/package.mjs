import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { deflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { join, relative, resolve, isAbsolute, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const dist = join(project, 'dist');
const version = '0.4.6';
const files = [];
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--output-dir')) throw new Error('Usage: package.mjs [--output-dir <workspace-contained-directory>]');
const workspace = resolve(project, '../..');
const output = args.length ? resolve(process.cwd(), args[1]) : join(project, 'build');
const outputRelative = relative(workspace, output);
if (outputRelative === '..' || outputRelative.startsWith(`..${sep}`) || isAbsolute(outputRelative)) throw new Error('Package output must remain inside the workspace.');
// Mandatory for all callers and output locations; no ZIP is created on failure.
const checks = ['check-expedition-progress.mjs','check-hero-progress.mjs','check-profile-expansion.mjs','check-ad-rewards.mjs','check-campaign-progress.mjs','check-local-trial-save.mjs','check-player-cloud.mjs','check-cloud-archive.mjs','check-save-compatibility.mjs','check-campaign-v2-progress.mjs','check-recruitment.mjs','check-draw-profile.mjs','check-draw-battle.mjs','check-progressive-fatigue.mjs','check-campaign-content.mjs','check-campaign-economy.mjs','check-daily-ad-rewards.mjs','check-attack-range.mjs','check-content-expansion-mechanics.mjs','check-content-expansion-progress.mjs','check-collection-training.mjs','check-random-recruitment.mjs','check-recruitment-mechanics.mjs'];
// A solvable lesson can still teach nothing. Gate both the intended solutions
// and the known ways to win while omitting their central mechanics.
checks.push('check-trial-lessons.mjs', 'check-trial-mechanisms.mjs', 'check-trial-design.mjs');
checks.push('check-battle-command-gesture.mjs');
checks.push('check-battle-available-actions.mjs');
checks.push('check-gift-codes.mjs');
checks.push('check-battle-reward-summary.mjs', 'check-deck-filters.mjs', 'check-deck-recommendation.mjs', 'check-platform-progress.mjs');
checks.push('check-ranked-challenge.mjs', 'check-challenge-preparation.mjs', 'check-ranked-main-isolation.mjs');
let compatibility;
for (const check of checks) {
  const result = spawnSync(process.execPath, [join(project, 'tools', check)], { encoding: 'utf8', cwd: project });
  if (result.status !== 0 || result.error) throw new Error(`Save compatibility gate failed: ${check}\n${result.stderr || result.error || result.stdout}`);
  if (check === 'check-save-compatibility.mjs') compatibility = JSON.parse(result.stdout.trim().split('\n').at(-1));
}
if (compatibility?.passed !== true || compatibility.singleDeviceUpdate?.passed !== true
  || compatibility.singleDeviceUpdate.storageContractChecked !== true
  || !Number.isSafeInteger(compatibility.singleDeviceUpdate.roundTrips) || compatibility.singleDeviceUpdate.roundTrips < 1) {
  throw new Error('Single-device update compatibility evidence is missing or failed; packaging stopped.');
}
compatibility = { ...compatibility, packageVersion: version, checkedAt: new Date().toISOString(), checks };

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else files.push(path);
  }
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

await collect(dist);
files.sort();
const manifest = [], local = [], central = [];
let offset = 0;
for (const file of files) {
  const data = await readFile(file);
  const relativePath = relative(dist, file).split(sep).join('/');
  const name = Buffer.from(`duelyst-h5/${relativePath}`);
  const compressed = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6);
  header.writeUInt16LE(8, 8); header.writeUInt16LE(0x5d4a, 12);
  header.writeUInt32LE(crc, 14); header.writeUInt32LE(compressed.length, 18);
  header.writeUInt32LE(data.length, 22); header.writeUInt16LE(name.length, 26);
  local.push(header, name, compressed);

  const directory = Buffer.alloc(46);
  directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6);
  directory.writeUInt16LE(0x800, 8); directory.writeUInt16LE(8, 10); directory.writeUInt16LE(0x5d4a, 14);
  directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(compressed.length, 20);
  directory.writeUInt32LE(data.length, 24); directory.writeUInt16LE(name.length, 28);
  directory.writeUInt32LE(offset, 42);
  central.push(directory, name);
  offset += header.length + name.length + compressed.length;
  manifest.push({ path: name.toString(), bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
}

const centralBytes = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralBytes.length, 12); end.writeUInt32LE(offset, 16);
const zip = Buffer.concat([...local, centralBytes, end]);
await mkdir(output, { recursive: true });
await writeFile(join(output, `duelyst-h5-${version}.zip`), zip);
const record = { version, compatibility, bytes: zip.length, sha256: createHash('sha256').update(zip).digest('hex'), files: manifest };
await writeFile(join(output, `manifest-${version}.json`), `${JSON.stringify(record, null, 2)}\n`);
console.log(JSON.stringify(record, null, 2));
