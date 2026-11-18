// Render the existing pixelfx library read-only into game-owned output.
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';

const checkout = resolve(process.argv[2]);
const lib = await import(pathToFileURL(join(checkout, 'tools/lib/fxlib.mjs')));
const output = fileURLToPath(new URL('../output/roguelike/pixelfx/', import.meta.url));

for (const id of ['fire/torch', 'pickups/collect-burst', 'pickups/chest-open']) {
  const effect = await lib.loadEffect(id);
  const frames = lib.renderFrames(effect, { actor: false, bg: 'none', fps: 15 });
  const name = id.split('/').at(-1);
  lib.save(join(output, `${name}-contact.png`), lib.contactSheet(effect, frames, { max: 16, zoom: 2 }));
  if (id !== 'pickups/chest-open') continue;
  const sheet = lib.spriteSheet(effect, frames, name);
  const assets = fileURLToPath(new URL('../dist/assets/roguelike/', import.meta.url));
  lib.save(join(assets, `${name}.png`), sheet.png);
  lib.save(join(assets, `${name}.json`), JSON.stringify(sheet.json, null, 2));
  console.log(JSON.stringify({ id, frames: frames.n, bytes: sheet.png.length, size: sheet.json.meta.size }));
}
