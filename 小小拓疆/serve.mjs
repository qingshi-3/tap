import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
const root = fileURLToPath(new URL('./dist/', import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
http.createServer(async (req,res) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(path !== root.slice(0,-1) && !path.startsWith(root.endsWith(sep)?root:root+sep)) {res.writeHead(403);res.end();return;}
    const target = req.url.split('?')[0] === '/' ? resolve(root,'index.html') : path;
    const bytes = await readFile(target);
    res.writeHead(200,{'Content-Type':types[extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(4177,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4177'));
