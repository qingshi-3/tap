// Package the existing dist only. Run with Node's module parser enabled:
// node --experimental-vm-modules scripts/inline-html.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const indexPath = path.join(dist, 'index.html');
const outputPath = path.join(root, 'dist-single', '排队骑士.html');

const mimeTypes = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.wav': 'audio/wav', '.aac': 'audio/aac', '.flac': 'audio/flac',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.json': 'application/json', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.txt': 'text/plain', '.wasm': 'application/wasm',
};
const resources = new Map();
const transformedSources = new Map();
let replacementCount = 0;
let virtualKeyEscapes = 0;
let scriptCount = 0;
let stylesheetCount = 0;

function isEmbeddedOrRemote(reference) {
  return /^(?:data:|blob:|https?:|\/\/|#)/i.test(reference);
}

function localFile(reference, owner) {
  if (/^[a-z][a-z\d+.-]*:/i.test(reference)) {
    throw new Error('Unsupported resource URL in ' + owner + ': ' + reference);
  }
  if (reference.includes('$' + '{')) {
    throw new Error('Unresolved dynamic resource in ' + owner + ': ' + reference);
  }
  const pathname = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
  const filename = pathname.startsWith('/')
    ? path.resolve(dist, '.' + pathname)
    : path.resolve(path.dirname(owner), pathname);
  const relative = path.relative(dist, filename);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('Resource escapes dist in ' + owner + ': ' + reference);
  }
  if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
    throw new Error('Missing resource in ' + owner + ': ' + reference + ' -> ' + filename);
  }
  return filename;
}

function dataUri(reference, owner) {
  const filename = localFile(reference, owner);
  if (!resources.has(filename)) {
    const bytes = fs.readFileSync(filename);
    const extension = path.extname(filename).toLowerCase();
    if (extension === '.json') JSON.parse(bytes.toString('utf8'));
    const mime = mimeTypes[extension] || 'application/octet-stream';
    resources.set(filename, 'data:' + mime + ';base64,' + bytes.toString('base64'));
  }
  replacementCount++;
  return resources.get(filename);
}

function attribute(attributes, name) {
  const pattern = new RegExp(
    '(?:^|\\s)' + name + '\\s*=\\s*(?:"([^"]*)"|\\x27([^\\x27]*)\\x27|([^\\s"\\x27=<>\\x60]+))',
    'i',
  );
  const match = pattern.exec(attributes);
  return match ? (match[1] ?? match[2] ?? match[3]) : null;
}

function cssUrls(source, callback) {
  return source.replace(
    /(\burl\(\s*)(?:(["'])(.*?)\2|([^'"\s()]+))(\s*\))/gi,
    (whole, opening, quote, quoted, bare, closing) => {
      const reference = quoted ?? bare;
      const replacement = callback(reference);
      return replacement === reference
        ? whole
        : opening + (quote || '') + replacement + (quote || '') + closing;
    },
  );
}

function inlineCss(source, filename) {
  const result = cssUrls(source, reference =>
    isEmbeddedOrRemote(reference) ? reference : dataUri(reference, filename),
  );
  if (/<\/style/i.test(result)) {
    throw new Error('Unsafe closing style tag in ' + filename);
  }
  transformedSources.set(filename, result);
  return result;
}

function inlineJavaScript(source, filename) {
  // A quote must directly precede ./assets/: ../assets/ bundler keys are not files.
  let result = source.replace(
    /(["'\x60])(\.\/assets\/[^"'\x60\r\n]+)\1/g,
    (_whole, quote, reference) => quote + dataUri(reference, indexPath) + quote,
  );
  // Vite also emits bare hashed filenames relative to the original module.
  result = result.replace(
    /(\bnew\s+URL\s*\(\s*)(["'\x60])([^"'\x60\r\n]+)\2(\s*,\s*import\.meta\.url\s*\))/g,
    (whole, opening, quote, reference, closing) => isEmbeddedOrRemote(reference)
      ? whole
      : opening + quote + dataUri(reference, filename) + quote + closing,
  );
  // These are import-glob lookup keys, including a template lookup, not resource URLs.
  // Escape only their slash: their runtime values and lookup behavior stay identical.
  result = result.replace(
    /(["'\x60])\.\.\/assets\/([^"'\x60\r\n]*)\1/g,
    (_whole, quote, suffix) => {
      virtualKeyEscapes++;
      return quote + '..\\u002fassets/' + suffix + quote;
    },
  );
  result = result.replace(/<\/script/gi, match => '<\\/' + match.slice(2));
  transformedSources.set(filename, result);
  return result;
}

function remainingAssetPaths(source) {
  return [...new Set([
    ...Array.from(source.matchAll(/\.\/assets\/[^\s"'\x60<>\\)]*/g), match => match[0]),
    ...Array.from(source.matchAll(/url\(\.\/[^)\r\n]*/gi), match => match[0]),
  ])];
}

function validate(html) {
  const failures = [];
  for (const [filename, source] of [...transformedSources, [outputPath, html]]) {
    for (const reference of remainingAssetPaths(source)) {
      failures.push(path.relative(root, filename) + ': ' + reference);
    }
  }

  const scripts = [];
  const styles = [];
  let markup = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi,
    (_whole, attributes, contents) => {
      const src = attribute(attributes, 'src');
      if (src !== null) failures.push('HTML script src: ' + src);
      scripts.push({ attributes, contents });
      return '';
    });
  markup = markup.replace(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi,
    (_whole, contents) => {
      styles.push(contents);
      return '';
    });
  for (const tag of markup.matchAll(/<[a-z][^>]*>/gi)) {
    for (const name of ['src', 'href']) {
      const reference = attribute(tag[0], name);
      if (reference && !isEmbeddedOrRemote(reference)) {
        failures.push('HTML ' + name + ': ' + reference);
      }
    }
  }
  for (const source of [...styles, markup]) {
    cssUrls(source, reference => {
      if (!isEmbeddedOrRemote(reference)) failures.push('CSS url: ' + reference);
      return reference;
    });
  }
  for (const { contents } of scripts) {
    const references = [
      ...Array.from(contents.matchAll(
        /\bnew\s+URL\s*\(\s*(["'\x60])([^"'\x60\r\n]+)\1\s*,\s*import\.meta\.url\s*\)/g,
      ), match => match[2]),
      ...Array.from(contents.matchAll(
        /\bimport\s*\(\s*(["'\x60])([^"'\x60\r\n]+)\1/g,
      ), match => match[2]),
      ...Array.from(contents.matchAll(
        /\b(?:src|href)\s*=\s*(["'])([^"']+)\1/gi,
      ), match => match[2]).filter(reference =>
        /\.(?:m?js|css|png|jpe?g|gif|svg|webp|woff2?|ttf|otf|m4a|mp3|ogg|wav|json)(?:[?#]|$)/i.test(reference),
      ),
    ];
    for (const reference of references) {
      if (!isEmbeddedOrRemote(reference)) failures.push('JavaScript resource: ' + reference);
    }
  }
  if (failures.length) {
    throw new Error('Unresolved external references:\n' + [...new Set(failures)].join('\n'));
  }

  if (scripts.length !== scriptCount || styles.length !== stylesheetCount) {
    throw new Error('Inline script/style tag count mismatch');
  }
  for (const [index, { attributes, contents }] of scripts.entries()) {
    if (attribute(attributes, 'type') === 'module') {
      const module = new vm.SourceTextModule(contents, {
        identifier: outputPath + '#module-' + index,
      });
      if (module.dependencySpecifiers.length) {
        throw new Error('External module imports remain: ' + module.dependencySpecifiers.join(', '));
      }
    } else {
      new vm.Script(contents, { filename: outputPath + '#script-' + index });
    }
  }
  return scripts.length;
}

if (typeof vm.SourceTextModule !== 'function') {
  throw new Error('Run with: node --experimental-vm-modules scripts/inline-html.mjs');
}

let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi,
  (whole, attributes, contents) => {
    const src = attribute(attributes, 'src');
    if (!src || attribute(attributes, 'type') !== 'module') return whole;
    if (isEmbeddedOrRemote(src)) throw new Error('External module script: ' + src);
    if (contents.trim()) throw new Error('External script also has inline contents: ' + src);
    const filename = localFile(src, indexPath);
    scriptCount++;
    return '<script type="module">\n' +
      inlineJavaScript(fs.readFileSync(filename, 'utf8'), filename) + '\n</script>';
  });
html = html.replace(/<link\b([^>]*)>/gi, (whole, attributes) => {
  if (attribute(attributes, 'rel')?.toLowerCase() !== 'stylesheet') return whole;
  const href = attribute(attributes, 'href');
  if (!href || isEmbeddedOrRemote(href)) throw new Error('Unsupported stylesheet: ' + href);
  const filename = localFile(href, indexPath);
  stylesheetCount++;
  return '<style>\n' + inlineCss(fs.readFileSync(filename, 'utf8'), filename) + '\n</style>';
});
if (!scriptCount || !stylesheetCount) {
  throw new Error('Expected at least one module script and one stylesheet in dist/index.html');
}

const checkedScripts = validate(html);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, html, 'utf8');
if (fs.readFileSync(outputPath, 'utf8') !== html) throw new Error('Output read-back mismatch');
const bytes = fs.statSync(outputPath).size;
console.log(JSON.stringify({
  outputPath,
  bytes,
  sizeMB: Number((bytes / 1_000_000).toFixed(2)),
  uniqueResources: resources.size,
  resourceReplacements: replacementCount,
  resourcesByExtension: Object.fromEntries(
    [...resources.keys()].reduce((counts, filename) => {
      const extension = path.extname(filename).toLowerCase();
      counts.set(extension, (counts.get(extension) || 0) + 1);
      return counts;
    }, new Map()),
  ),
  inlinedScripts: scriptCount,
  inlinedStylesheets: stylesheetCount,
  preservedVirtualKeys: virtualKeyEscapes,
  syntaxCheckedScripts: checkedScripts,
  residualExternalReferences: 0,
  scriptPath: fileURLToPath(import.meta.url),
}, null, 2));

