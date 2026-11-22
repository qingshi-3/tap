import assert from 'node:assert/strict';
import { createFrame, clearFrame, painterFor, composite, resolveOptions } from '../src/vendor/pixelfx/src/core/index.js';
import * as effect from '../src/vendor/pixelfx/src/fx/transitions/slash-wipe.js';
const frame = createFrame(320, 180), output = new Uint8ClampedArray(320 * 180 * 4);
const fx = effect.create(resolveOptions(effect.meta, { color: '#0b1020', light: 0.45 }));
function advance(from, to) { const steps = Math.ceil((to - from) * 120); for (let i = 0; i < steps; i++) fx.update((to - from) / steps); }
function draw() { clearFrame(frame); const p = painterFor(frame); p.lightK = 0.45; fx.draw(p); composite(frame, output, null); }
advance(0, 0.8); draw();
assert.equal(Array.from(output).filter((_, i) => i % 4 === 3 && output[i] !== 255).length, 0, 'swap frame must be opaque');
advance(0.8, 1.7); draw();
assert.equal(Array.from(output).filter((_, i) => i % 4 === 3 && output[i] !== 0).length, 0, 'last frame must be transparent');
assert.ok(fx.particleCount <= 24, `particle count ${fx.particleCount} exceeds budget`);
console.log(`Opaque swap, transparent end, ${fx.particleCount} total particles`);
