// node tools/render-camp-veil.mjs <pixelfx-checkout> [round]
// The shared pixelfx checkout is read-only; output belongs to this game.
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import * as mod from './pixelfx-camp-veil.mjs';
const checkout = process.argv[2];
if (!checkout) throw new Error('Provide the existing pixelfx checkout path.');
const { renderFrames, contactSheet, spriteSheet, save } = await import(pathToFileURL(join(resolve(checkout), 'tools/lib/fxlib.mjs')));
const round = Number(process.argv[3] || 3);
const options = round === 1 ? { strength: .9, softness: .22 } : round === 2 ? { strength: .72, softness: .32 } : {};
const fx = { id: 'transitions/camp-veil', meta: mod.meta, mod };
const frames = renderFrames(fx, { actor: false, bg: 'none', options });
const output = fileURLToPath(new URL(`../output/cloud-cache/transitions/camp-veil-round-${round}/`, import.meta.url));
save(join(output, 'contact.png'), contactSheet(fx, frames, { max: 9, zoom: 1 }));
const sheet = spriteSheet(fx, frames, 'camp-veil');
save(join(output, 'camp-veil.png'), sheet.png);
save(join(output, 'camp-veil.json'), JSON.stringify(sheet.json, null, 2));
if (round === 3) {
  const assets = fileURLToPath(new URL('../dist/assets/transitions/', import.meta.url));
  save(join(assets, 'camp-veil.png'), sheet.png);
  save(join(assets, 'camp-veil.json'), JSON.stringify(sheet.json, null, 2));
}
console.log(JSON.stringify({ round, frames: frames.n, output, bytes: sheet.png.length }));
