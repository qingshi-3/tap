import { Color, DirectionalLight, InstancedMesh, Matrix4, Vector3, type Camera, type Scene } from 'three';

// A small z-buffer for the WebGL-free still. Rasterizing the actual instance matrices
// keeps towers, arches, paths and DOM anchors in register, including after resize.
const faces = [
  [4, 5, 7, 6, 0, 0, 1],
  [0, 2, 3, 1, 0, 0, -1],
  [1, 3, 7, 5, 1, 0, 0],
  [0, 4, 6, 2, -1, 0, 0],
  [2, 6, 7, 3, 0, 1, 0],
  [0, 1, 5, 4, 0, -1, 0],
];
export function renderStill(scene: Scene, camera: Camera, width: number, height: number) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  const depth = new Float32Array(width * height).fill(Infinity);
  const vp = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const instance = new Matrix4(),
    mvp = new Matrix4();
  const points = Array.from({ length: 8 }, () => new Vector3());
  const normal = new Vector3(),
    paint = new Color(),
    shaded = new Color(),
    sunlight = new Color();
  const sun = scene.children.find((v): v is DirectionalLight => v instanceof DirectionalLight);
  const light = sun?.position.clone().normalize() ?? new Vector3(-0.5, 0.8, 0.35);
  function triangle(a: Vector3, b: Vector3, c: Vector3, r: number, g: number, blue: number, alpha: number) {
    const dx1 = b.x - a.x,
      dy1 = b.y - a.y,
      dx2 = c.x - a.x,
      dy2 = c.y - a.y,
      area = dx1 * dy2 - dy1 * dx2;
    if (area >= -0.00001) return;
    const x0 = Math.max(0, Math.ceil(Math.min(a.x, b.x, c.x) - 0.5)),
      x1 = Math.min(width - 1, Math.floor(Math.max(a.x, b.x, c.x) - 0.5));
    const y0 = Math.max(0, Math.ceil(Math.min(a.y, b.y, c.y) - 0.5)),
      y1 = Math.min(height - 1, Math.floor(Math.max(a.y, b.y, c.y) - 0.5));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - a.x,
          py = y + 0.5 - a.y;
        const s = (px * dy2 - py * dx2) / area,
          t = (dx1 * py - dy1 * px) / area;
        if (s < 0 || t < 0 || s + t > 1) continue;
        const z = a.z + s * (b.z - a.z) + t * (c.z - a.z),
          at = y * width + x;
        if (z >= depth[at]) continue;
        depth[at] = z;
        const idx = at * 4,
          under = (pixels[idx + 3] / 255) * (1 - alpha),
          total = alpha + under;
        pixels[idx] = (r * alpha + pixels[idx] * under) / total;
        pixels[idx + 1] = (g * alpha + pixels[idx + 1] * under) / total;
        pixels[idx + 2] = (blue * alpha + pixels[idx + 2] * under) / total;
        pixels[idx + 3] = total * 255;
      }
  }
  const meshes = scene.children.filter((m): m is InstancedMesh => m instanceof InstancedMesh);
  for (const mesh of meshes.sort((a, b) => a.renderOrder - b.renderOrder)) {
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const luminous = mat.type === 'MeshBasicMaterial';
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, instance);
      mesh.getColorAt(i, paint);
      mvp.multiplyMatrices(vp, instance);
      points.forEach((p, j) => {
        p.set((j & 1) - 0.5, ((j >> 1) & 1) - 0.5, ((j >> 2) & 1) - 0.5).applyMatrix4(mvp);
        p.x = (p.x + 1) * width * 0.5;
        p.y = (1 - p.y) * height * 0.5;
      });
      for (const [a, b, c, d, nx, ny, nz] of faces) {
        const p = points[a],
          q = points[b],
          v = points[c];
        if ((q.x - p.x) * (v.y - p.y) >= (q.y - p.y) * (v.x - p.x)) continue;
        normal.set(nx, ny, nz).transformDirection(instance);
        const sunlit = Math.max(0, normal.dot(light));
        shaded.copy(paint).multiplyScalar(luminous ? 1 : 0.49 + 0.16 * normal.y + sunlit * 0.69);
        if (!luminous && sun) shaded.lerp(sunlight.copy(shaded).multiply(sun.color), 0.43);
        const hex = shaded.getHex(),
          r = hex >> 16,
          g = (hex >> 8) & 255,
          blue = hex & 255;
        triangle(p, q, v, r, g, blue, mat.opacity);
        triangle(p, v, points[d], r, g, blue, mat.opacity);
      }
    }
  }
  return pixels;
}
