/* Pixel 9-slice frames for the camp / shop UI, in the warm gold palette.
 * Each frame is a tiny canvas (12×12, stepped corners) exported as a data URI
 * CSS variable, used with   border-image: var(--cpx-x) 3 fill / 6px stretch;
 * plus image-rendering: pixelated — so panels and buttons read as game art,
 * not as 1px-bordered web boxes.
 */
(function () {
  window.MT = window.MT || {};

  // layers: outermost → inner. Each layer is [top, right, bottom, left] colours
  // (or one colour for all sides). Corners of layer 0 are left transparent.
  function frame(layers, fill) {
    const N = 12;
    const c = document.createElement('canvas');
    c.width = N;
    c.height = N;
    const g = c.getContext('2d');
    const px = (x, y, col) => { if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } };
    g.fillStyle = fill;
    g.fillRect(layers.length, layers.length, N - layers.length * 2, N - layers.length * 2);
    layers.forEach((L, k) => {
      const [t, r, b, l] = Array.isArray(L) ? L : [L, L, L, L];
      const a = k;
      const z = N - 1 - k;
      for (let x = a; x <= z; x++) { px(x, a, t); px(x, z, b); }
      for (let y = a + 1; y < z; y++) { px(a, y, l); px(z, y, r); }
      if (k === 0) {
        // stepped corner: knock out the four corner pixels of the outline
        g.clearRect(a, a, 1, 1); g.clearRect(z, a, 1, 1); g.clearRect(a, z, 1, 1); g.clearRect(z, z, 1, 1);
        // and fill the inner diagonal with the outline colour so the step reads
        px(a + 1, a + 1, t); px(z - 1, a + 1, t); px(a + 1, z - 1, b); px(z - 1, z - 1, b);
      }
    });
    return c.toDataURL('image/png');
  }

  const O = '#0a0806';
  const FRAMES = {
    // dark panel with a bevelled gold rim
    panel: frame([O, ['#f2dba2', '#8a6a34', '#6e5228', '#d4ae68'], '#1a120a'], 'rgba(23, 18, 14, 0.94)'),
    // gold button / price plate
    gold: frame([O, ['#fff4cf', '#a8813f', '#7a5a26', '#fff0c0'], ['#e8c77e', '#c9a259', '#a8813f', '#e8c77e']], '#d9b468'),
    // crimson call-to-action
    red: frame([O, ['#ff9a9a', '#6e1520', '#4a0c14', '#ff8a8a'], ['#d4434f', '#a52a36', '#7c1b26', '#d4434f']], '#b8323f'),
    // dark button
    dark: frame([O, ['#5a4a34', '#1a140e', '#120d09', '#4a3c2a'], '#2a2219'], '#221b14'),
    // recessed socket (relic slots)
    socket: frame([O, ['#120d09', '#5a4a34', '#6e5a3e', '#120d09'], '#0d0a07'], '#15100c')
  };

  const root = document.documentElement.style;
  for (const [k, url] of Object.entries(FRAMES)) root.setProperty(`--cpx-${k}`, `url("${url}")`);
  window.MT.pxFrame = { frame };
})();
