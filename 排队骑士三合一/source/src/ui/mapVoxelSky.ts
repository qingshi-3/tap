import type { VoxelThemeInfo } from './mapVoxelThemes';

// Paint at the scale of the distant landscape, then drift the finished sky plate under the island.
const skies = new Map<string, string>();
export function skyLight(theme: VoxelThemeInfo) {
  const cached = skies.get(theme.id);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 136;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'none';
  if (theme.id === 'moonlit_woods' || theme.id === 'alpine_snow') {
    const moon = theme.id === 'moonlit_woods';
    // Two overlapping curtains. The brighter, rippled edge sits below a fainter veil.
    for (let band = 0; band < 2; band++) {
      ctx.fillStyle = band ? '#9b9fff' : '#7cf4d6';
      for (let x = 0; x < canvas.width; x++) {
        const u = x / canvas.width;
        const edge = Math.round(22 + 9 * Math.sin(u * 6.7 + band * 0.35) + 5 * Math.sin(u * 13) - band * 5);
        const veil = 9 + Math.round(6 * (1 + Math.sin(x * 0.075 + band)));
        const strength = Math.sin(u * Math.PI) ** 0.8 * (moon ? 0.36 : 0.26);
        for (let y = 0; y < veil; y++) {
          ctx.globalAlpha = strength * (1 - y / veil) ** 1.6;
          ctx.fillRect(x, edge - y, 1, 1);
        }
      }
    }
  } else {
    const ember = theme.id === 'ashen_citadel';
    ctx.fillStyle = ember ? '#ff9970' : theme.tone === 'day' ? '#fff5ca' : '#ffe5ae';
    // Long, faceted shafts at the horizon. Keep the centre of the route clear.
    for (const [origin, breadth, weight] of [[35, 13, 0.64], [57, 5, 0.38], [72, 25, 1]]) {
      for (let y = 0; y < 103; y++) {
        const u = y / 103;
        const center = origin + Math.round((u - 0.25) * 62);
        const spread = breadth * (0.72 + u * 0.75);
        const strength = (ember ? 0.16 : 0.24) * weight * (1 - u) ** 1.35;
        for (let x = Math.floor(center - spread); x <= center + spread; x++) {
          ctx.globalAlpha = strength * Math.max(0, 1 - Math.abs(x - center) / spread) ** 0.38;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }
  const image = `url("${canvas.toDataURL()}")`;
  skies.set(theme.id, image);
  return image;
}
