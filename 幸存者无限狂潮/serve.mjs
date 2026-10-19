import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
const host = process.argv[2] || '127.0.0.1';
const root = fileURLToPath(new URL('./dist/', import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
http.createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const path = resolve(root, '.' + pathname);
    if(path !== root.slice(0,-1) && !path.startsWith(root.endsWith(sep)?root:root+sep)) {res.writeHead(403);res.end();return;}
    const bytes = await readFile(pathname === '/' ? resolve(root,'index.html') : path);
    res.writeHead(200,{'Content-Type':types[extname(pathname === '/' ? 'index.html' : path)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(4178,host,()=>console.log(`Preview: http://${host}:4178`));
