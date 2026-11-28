// A restrained screen-transition variant after reviewing pixelfx's iris and
// diamond-wipe. Uses pixelfx's translucent painter rather than bright rims.
export const meta = {
  name: 'Camp veil', desc: 'A soft violet material withdraws across the new scene.',
  tags: ['transition', 'screen', 'veil'], size: [320, 180], origin: [0, 0],
  duration: .24, fps: 100 / 3, loop: false, bg: 'none',
  options: { strength: .62, softness: .4, seed: 1 },
};
const rgb = (r, g, b) => (255 << 24) | (b << 16) | (g << 8) | r;
const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
export function draw(p, t, o) {
  if (t >= meta.duration) return;
  const u = t / meta.duration, edge = -o.softness + u * (1 + o.softness * 2);
  // Broad filled volumes retain the game's purple material, with a subtle
  // warm upper face. No outline, dust, flash or extra UI is introduced.
  for (let y = 0; y < 180; y++) for (let x = 0; x < 320; x++) {
    const qx = Math.floor(x / 4) * 4, qy = Math.floor(y / 4) * 4;
    const fold = .045 * Math.sin(qy / 45 + qx / 130);
    const a = o.strength * smooth((qx / 320 + fold - edge) / o.softness) * (1 - smooth(u));
    const warm = Math.max(0, 1 - qy / 180) * .6;
    p.blend(x, y, rgb(Math.round(31 + warm * 18), Math.round(23 + warm * 9), Math.round(49 + warm * 12)), a);
  }
}
