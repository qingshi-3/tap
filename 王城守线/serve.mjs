import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';

const root = fileURLToPath(new URL('./dist/', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.otf': 'font/otf', '.ttf': 'font/ttf'
};

http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const path = resolve(root, `.${pathname}`);
    const safeRoot = root.endsWith(sep) ? root : `${root}${sep}`;
    if (path !== root.slice(0, -1) && !path.startsWith(safeRoot)) {
      res.writeHead(403); res.end(); return;
    }
    const target = pathname === '/' ? resolve(root, 'index.html') : path;
    const bytes = await readFile(target);
    res.writeHead(200, {
      'Content-Type': types[extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'
    });
    res.end(bytes);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}).listen(4181, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4181'));
