import assert from 'node:assert/strict';
import { BoardRenderer } from '../dist/js/renderer.js';

// Exercise the real renderer geometry and pan/focus entry points, without
// constructing its asset/audio pipeline or opening a browser. Only layout and
// the final paint are substituted; camera constraints remain production code.
const previousStyle = Object.getOwnPropertyDescriptor(globalThis, 'getComputedStyle');
globalThis.getComputedStyle = canvas => ({
  getPropertyValue: name => canvas.insets[name] ?? '0px'
});
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-7,
  `${message}: expected ${expected}, got ${actual}`);

function fixture(width, height, columns, rows) {
  const origin = { left: 11, top: 17 };
  const layout = { width, height, hudBottom: 100, handTop: height - 120 };
  const rectangle = (top, bottom) => ({ left: origin.left, right: origin.left + layout.width,
    top: origin.top + top, bottom: origin.top + bottom, width: layout.width, height: bottom - top });
  const match = {
    querySelectorAll: () => [
      { getBoundingClientRect: () => rectangle(0, 49) },
      { getBoundingClientRect: () => rectangle(52, layout.hudBottom) }
    ],
    querySelector: selector => selector === '.hand-zone'
      ? { getBoundingClientRect: () => rectangle(layout.handTop, layout.height) } : null
  };
  const canvas = {
    insets: { '--safe-side-floor': '60px', '--device-safe-left': '0px', '--device-safe-right': '0px' },
    getBoundingClientRect: () => rectangle(0, layout.height),
    closest: selector => selector === '.match' ? match
      : { getBoundingClientRect: () => rectangle(49, layout.height - 160) }
  };
  const renderer = Object.create(BoardRenderer.prototype);
  Object.assign(renderer, { canvas, state: { mode: 'expedition', board: { columns, rows } }, camera: { x: 0, y: 0 },
    paint() { this.lastMetrics = this.boardMetrics(layout.width, layout.height); } });
  return { renderer, layout };
}

function checkExtreme(renderer, layout, sign) {
  renderer.pan(sign * 1e6, sign * 1e6);
  const m = renderer.lastMetrics;
  const viewport = renderer.battlefieldViewport(layout.width, layout.height);
  near(viewport.left, 60, 'device side guard');
  near(viewport.right, layout.width - 60, 'opposite side guard');
  near(viewport.top, layout.hudBottom + 8, 'HUD clearance');
  near(viewport.bottom, layout.handTop - 8, 'hand clearance');
  const rearLeft = renderer.boardPoint(m, 0, 0).x;
  const rearRight = renderer.boardPoint(m, m.columns, 0).x;
  if (rearRight - rearLeft > viewport.right - viewport.left) {
    assert.ok(rearLeft <= viewport.left + 1e-7, 'large board cannot expose excess left blank');
    assert.ok(rearRight >= viewport.right - 1e-7, 'large board cannot expose excess right blank');
    near(sign < 0 ? rearRight : rearLeft, sign < 0 ? viewport.right : viewport.left,
      sign < 0 ? 'right map edge aligns at leftward limit' : 'left map edge aligns at rightward limit');
  } else {
    near(m.centerX, (viewport.left + viewport.right) / 2, 'small board stays horizontally centered');
  }
  const boardHeight = m.bottom - m.top;
  if (boardHeight + 48 > viewport.bottom - viewport.top) {
    near(sign < 0 ? m.bottom : m.top - 48, sign < 0 ? viewport.bottom : viewport.top,
      sign < 0 ? 'bottom row clears hand at upward limit' : 'top row headroom clears HUD at downward limit');
  } else {
    near((m.top - 48 + m.bottom) / 2, (viewport.top + viewport.bottom) / 2,
      'small board plus sprite headroom stays vertically centered');
  }
  const settled = { ...renderer.camera };
  renderer.pan(sign * 1e6, sign * 1e6);
  assert.deepEqual(renderer.camera, settled, 'continued drag against an edge is stable');
  renderer.boardMetrics(layout.width, layout.height);
  assert.deepEqual(renderer.camera, settled, 'layout reads do not drift the camera');
}

let cases = 0;
try {
  for (const [width, height] of [[568, 320], [844, 390]]) {
    for (const [columns, rows] of [[17, 9], [9, 5], [3, 1]]) {
      const { renderer, layout } = fixture(width, height, columns, rows);
      for (const sign of [-1, 1]) { checkExtreme(renderer, layout, sign); cases++; }
      renderer.focusCell(columns - 1, rows - 1);
      const firstFocus = { ...renderer.camera };
      renderer.focusCell(columns - 1, rows - 1);
      assert.deepEqual(renderer.camera, firstFocus, 'repeated focus is stable at the constrained target');
    }
  }
  // A phone rotation must read fresh DOM dimensions and discard previous
  // out-of-range offsets without changing the established cell scale rules.
  const { renderer, layout } = fixture(844, 390, 17, 9);
  renderer.pan(1e6, 1e6);
  Object.assign(layout, { width: 568, height: 320, handTop: 200 });
  checkExtreme(renderer, layout, 1);
  renderer.canvas.insets['--device-safe-left'] = '72px';
  near(renderer.battlefieldViewport(layout.width, layout.height).left, 72, 'asymmetric device inset overrides side floor');
  console.log(`Camera bounds passed: ${cases} phone/board/extreme-drag cases, all four limits, small-board centering, repeated pan/focus, rotation and asymmetric safe area.`);
} finally {
  if (previousStyle) Object.defineProperty(globalThis, 'getComputedStyle', previousStyle);
  else delete globalThis.getComputedStyle;
}
