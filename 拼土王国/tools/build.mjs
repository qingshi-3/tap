// Single-file build: node tools/build.mjs  →  release/拼土王国.html (double-click to play, no server).
// ES modules don't load from file://, so modules are inlined as plain function scopes in dependency order.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const src = f => readFileSync(new URL(`../dist/${f}`, import.meta.url), 'utf8');
const ORDER = ['rules.js', 'art.js', 'storage.js', 'tutorial.js', 'app.js'];
const varOf = f => '__m_' + f.replace('.js', '');
// `export const a = 1, b = 2;` exports both, so walk declarator lists at bracket depth 0.
function exportNames(code, file) {
  const names = [];
  for (const m of code.matchAll(/^export\s+(async\s+)?(function\*?|class|const|let|var)\s+/gm)) {
    let i = m.index + m[0].length;
    const id = () => { const r = /[A-Za-z_$][\w$]*/y; r.lastIndex = i; const x = r.exec(code); if (!x) throw new Error(`${file}: destructured export`); names.push(x[0]); i = r.lastIndex; };
    id();
    if (!/const|let|var/.test(m[2])) continue;
    if (m[2] !== 'const') throw new Error(`${file}: mutable export ${names.at(-1)} would lose live binding`);
    for (let depth = 0, q = null; i < code.length; i++) {
      const ch = code[i];
      if (q) { if (ch === '\\') i++; else if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'" || ch === '`') q = ch;
      else if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch)) depth--;
      else if (depth === 0 && (ch === ';' || ch === '\n')) break;
      else if (depth === 0 && ch === ',') { i++; while (/\s/.test(code[i])) i++; id(); i--; }
    }
  }
  return names;
}
function wrap(file) {
  let code = src(file);
  const names = exportNames(code, file);
  const head = [];
  code = code.replace(/^import\s+(?:\*\s+as\s+(\w+)|\{([^}]*)\})\s+from\s+'\.\/([\w.]+)';?\s*$/gm, (_, ns, list, dep) => {
    if (!ORDER.includes(dep)) throw new Error(`${file}: unknown import ${dep}`);
    head.push(ns ? `const ${ns} = ${varOf(dep)};` : `const {${list.replace(/\bas\b/g, ':')}} = ${varOf(dep)};`);
    return '';
  });
  if (/^\s*(import|export)\b/m.test(code.replace(/^export\s+(?:async\s+)?(?:function|const|let|var|class)/gm, ''))) throw new Error(`${file}: unsupported import/export form`);
  code = code.replace(/^export\s+/gm, '');
  return `const ${varOf(file)} = (() => {\n${head.join('\n')}\n${code}\nreturn { ${names.join(', ')} };\n})();`;
}
const js = ORDER.map(wrap).join('\n\n').replace(/<\/script/gi, '<\\/script');
let html = src('index.html')
  .replace(/<link rel="stylesheet" href="\.\/style\.css">/, () => `<style>\n${src('style.css')}\n</style>`)
  .replace(/<script type="module" src="\.\/app\.js"><\/script>/, () => `<script type="module">\n${js}\n</script>`);
if (/href="\.\/|src="\.\//.test(html)) throw new Error('unreplaced local reference');
mkdirSync(new URL('../release/', import.meta.url), { recursive: true });
const out = new URL('../release/拼土王国.html', import.meta.url);
writeFileSync(out, html);
console.log(decodeURIComponent(out.pathname), (html.length / 1024).toFixed(0) + ' KB');
