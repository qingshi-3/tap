import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
const root = fileURLToPath(new URL('../media/', import.meta.url));
http.createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const target = resolve(root, `.${pathname === '/' ? '/icon.html' : pathname}`);
  if (!target.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403); res.end(); return; }
  try {
    const bytes = await readFile(target);
    res.writeHead(200, { 'Content-Type': ({'.svg':'image/svg+xml','.html':'text/html; charset=utf-8','.png':'image/png'})[extname(target)] || 'application/octet-stream' });
    res.end(bytes);
  } catch { res.writeHead(404); res.end(); }
}).listen(4182, '127.0.0.1');
