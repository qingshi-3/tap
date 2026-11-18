// Read-only use of the existing pixelfx checkout; all output is game-owned.
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
const checkout = resolve(process.argv[2]);
const lib = await import(pathToFileURL(join(checkout, 'tools/lib/fxlib.mjs')));
const fx = await lib.loadEffect('transitions/burn-away');
const frames = lib.renderFrames(fx, { actor:false, bg:'none' });
const output = fileURLToPath(new URL('../output/cloud-cache/transitions/burn-away/', import.meta.url));
lib.save(join(output,'contact.png'),lib.contactSheet(fx,frames,{max:16,zoom:1}));
const sheet = lib.spriteSheet(fx,frames,'burn-away');
const assets = fileURLToPath(new URL('../dist/assets/transitions/',import.meta.url));
lib.save(join(assets,'burn-away.png'),sheet.png);
lib.save(join(assets,'burn-away.json'),JSON.stringify(sheet.json,null,2));
console.log(JSON.stringify({output,frames:frames.n,bytes:sheet.png.length,size:sheet.json.meta.size}));
