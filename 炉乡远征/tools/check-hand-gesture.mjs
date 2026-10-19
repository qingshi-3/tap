import assert from 'node:assert/strict';
import { createHandDrag } from '../dist/js/hand-drag.js';

class Node {
  handlers = new Map(); children = []; style = {}; scrollLeft = 0;
  classList = { remove() {}, toggle() {} };
  addEventListener(type, callback) { this.handlers.set(type, callback); }
  append() {} setAttribute() {} hasPointerCapture() { return false; }
  setPointerCapture() {} releasePointerCapture() {}
}
globalThis.document = new Node(); document.body = new Node(); document.createElement = () => new Node();
globalThis.window = new Node();
const rail = new Node(), card = new Node();
card.closest = () => card; card.getBoundingClientRect = () => ({ top: 200 }); rail.children = [card];
let token = 1, taps = 0, begins = 0, drops = 0, previews = 0, cancels = 0, inspections = 0;
createHandDrag(rail, { token: () => token, targeted: () => true, boundary: () => 250,
  tap: () => taps++, inspect: () => inspections++, begin: () => { begins++; return true; },
  preview: () => previews++, drop: () => drops++, cancel: () => cancels++ });
function fire(type, x = 100, y = 230) {
  rail.handlers.get(type)?.({ target: card, isPrimary: true, button: 0, pointerId: 1,
    pointerType: 'touch', clientX: x, clientY: y, preventDefault() {} });
}
// A resting finger must not enter an inspection-only state and disable dragging.
fire('pointerdown'); await new Promise(resolve => setTimeout(resolve, 450));
fire('pointermove', 100, 160); fire('pointerup', 100, 160);
assert.deepEqual([begins, drops, inspections], [1, 1, 0]);
// Tap preview leaves the original card usable as the next drag source.
fire('pointerdown'); fire('pointerup'); assert.equal(taps, 1);
fire('pointerdown'); fire('pointermove', 100, 160); fire('pointerup', 100, 160);
assert.deepEqual([begins, drops], [2, 2]);
// Horizontal browsing never taps or spends a card; upward escape starts a drag.
fire('pointerdown'); fire('pointermove', 150, 230); assert.equal(rail.scrollLeft, -50);
fire('pointermove', 150, 160); fire('pointerup', 150, 160);
assert.deepEqual([begins, drops, taps], [3, 3, 1]);
fire('pointerdown'); token++; fire('pointermove', 100, 160); fire('pointerup', 100, 160);
assert.equal(begins, 3);
fire('pointerdown'); fire('pointermove', 100, 160); fire('pointercancel');
assert.equal(cancels, 1); assert.ok(previews >= 4);
console.log('Hand gesture regression passed: delayed drag, tap→drag, browse→drag, stale token, pointer cancel.');
