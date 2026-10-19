import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const project = fileURLToPath(new URL('../', import.meta.url));
const dist = join(project, 'dist');
const output = join(project, 'build');
const archiveDirectory = 'castle-ward-h5';
const version = '0.4.0';

const excludedPaths = new Set(['assets/SOURCES.md', 'assets/duelyst/SOURCES.md']);
const ignoredNames = new Set(['.DS_Store', 'Thumbs.db']);
const runtimeExtensions = new Set([
  '.avif', '.css', '.gif', '.html', '.ico', '.jpeg', '.jpg', '.js', '.json',
  '.m4a', '.mp3', '.ogg', '.otf', '.png', '.svg', '.ttf', '.wasm', '.wav',
  '.webm', '.webp', '.woff', '.woff2'
]);
const requiredRuntimeFiles = [
  'index.html', 'openfield.css', 'game.js',
  'assets/asset-manifest.json'
];

function normalizePath(path) {
  return path.split(sep).join('/');
}

async function collect(directory, files = []) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));

  for (const entry of entries) {
    const path = join(directory, entry.name);
    const relativePath = normalizePath(relative(dist, path));

    if (entry.isDirectory()) {
      await collect(path, files);
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(`Unsupported non-file entry in dist: ${relativePath}`);
    }
    if (excludedPaths.has(relativePath) || ignoredNames.has(entry.name)) continue;
    if (!runtimeExtensions.has(extname(entry.name).toLowerCase())) {
      throw new Error(`Unclassified dist file; review before packaging: ${relativePath}`);
    }
    files.push({ path, relativePath });
  }

  return files;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const files = await collect(dist);
const collectedPaths = new Set(files.map(file => file.relativePath));
for (const requiredPath of requiredRuntimeFiles) {
  if (!collectedPaths.has(requiredPath)) {
    throw new Error(`Missing required runtime file: dist/${requiredPath}`);
  }
}

const manifestFiles = [];
const localParts = [];
const centralParts = [];
let offset = 0;

for (const file of files) {
  const data = await readFile(file.path);
  const archivePath = `${archiveDirectory}/${file.relativePath}`;
  const name = Buffer.from(archivePath);
  const compressed = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0x0800, 6);
  localHeader.writeUInt16LE(8, 8);
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0x5d4a, 12);
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(compressed.length, 18);
  localHeader.writeUInt32LE(data.length, 22);
  localHeader.writeUInt16LE(name.length, 26);
  localParts.push(localHeader, name, compressed);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0x0800, 8);
  centralHeader.writeUInt16LE(8, 10);
  centralHeader.writeUInt16LE(0, 12);
  centralHeader.writeUInt16LE(0x5d4a, 14);
  centralHeader.writeUInt32LE(crc, 16);
  centralHeader.writeUInt32LE(compressed.length, 20);
  centralHeader.writeUInt32LE(data.length, 24);
  centralHeader.writeUInt16LE(name.length, 28);
  centralHeader.writeUInt32LE(offset, 42);
  centralParts.push(centralHeader, name);

  offset += localHeader.length + name.length + compressed.length;
  manifestFiles.push({ path: archivePath, bytes: data.length, sha256: sha256(data) });
}

if (files.length > 0xffff) throw new Error('ZIP32 supports at most 65,535 files.');

const centralDirectory = Buffer.concat(centralParts);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralDirectory.length, 12);
end.writeUInt32LE(offset, 16);

const zip = Buffer.concat([...localParts, centralDirectory, end]);
const archiveName = `${archiveDirectory}-${version}.zip`;
const record = {
  version,
  archive: archiveName,
  topLevelDirectory: archiveDirectory,
  entrypoint: `${archiveDirectory}/index.html`,
  bytes: zip.length,
  sha256: sha256(zip),
  files: manifestFiles
};

await mkdir(output, { recursive: true });
await writeFile(join(output, archiveName), zip);
await writeFile(join(output, `manifest-${version}.json`), `${JSON.stringify(record, null, 2)}\n`);
console.log(JSON.stringify(record, null, 2));
