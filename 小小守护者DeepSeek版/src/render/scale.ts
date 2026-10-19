/** Unit conversion helpers shared by the render modules (no dependencies). */

/**
 * Convert a length in device/CSS pixels into world units.
 *
 * The world drawing context is scaled by `pixels per cell`, so every stroke and
 * offset that should measure a fixed number of screen pixels must be divided by
 * the cell size before it is handed to the context.
 */
export function cellPx(pixels: number, cell: number): number {
  return cell > 0 ? pixels / cell : pixels;
}
