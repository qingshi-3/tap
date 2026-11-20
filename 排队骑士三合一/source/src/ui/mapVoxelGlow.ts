import {
  AdditiveBlending, Color, DataTexture, Matrix4, RedFormat, ShaderMaterial, Vector3, Vector4, type Camera,
} from 'three';

// A small stepped halo shared by the GPU billboards and the software stills.
const SIDE = 25;
const mask = new Uint8Array(SIDE * SIDE);
for (let y = 0; y < SIDE; y++) {
  for (let x = 0; x < SIDE; x++) {
    const dx = Math.abs((2 * x + 1) / SIDE - 1);
    const dy = Math.abs((2 * y + 1) / SIDE - 1);
    const radius = Math.max(dx, dy) + Math.min(dx, dy) * 0.38;
    const falloff = Math.max(0, 1 - radius);
    mask[y * SIDE + x] = Math.round(178 * falloff ** 1.55);
  }
}

export function voxelGlowMaterial() {
  const texture = new DataTexture(mask, SIDE, SIDE, RedFormat);
  texture.needsUpdate = true;
  const material = new ShaderMaterial({
    uniforms: { halo: { value: texture } },
    transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vTint;
      void main() {
        vUv = uv;
        vTint = instanceColor;
        vec4 center = modelViewMatrix * instanceMatrix[3];
        vec2 size = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
        center.xy += position.xy * size;
        gl_Position = projectionMatrix * center;
      }`,
    fragmentShader: `
      uniform sampler2D halo;
      varying vec2 vUv;
      varying vec3 vTint;
      void main() {
        gl_FragColor = vec4(vTint, texture2D(halo, vUv).r);
        #include <colorspace_fragment>
      }`,
  });
  material.addEventListener('dispose', () => texture.dispose());
  return material;
}

export function drawStillGlow(
  matrix: Matrix4, color: Color, camera: Camera, pixels: Uint8ClampedArray, depth: Float32Array,
  width: number, height: number,
) {
  const pos = new Vector3().setFromMatrixPosition(matrix);
  const clip = new Vector4(pos.x, pos.y, pos.z, 1).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
  if (clip.w <= 0 || Math.abs(clip.z) > clip.w) return;
  const centerX = (1 + clip.x / clip.w) * width / 2;
  const centerY = (1 - clip.y / clip.w) * height / 2;
  const scale = new Vector3().setFromMatrixScale(matrix);
  const w = scale.x * camera.projectionMatrix.elements[0] * width / (2 * clip.w);
  const h = scale.y * camera.projectionMatrix.elements[5] * height / (2 * clip.w);
  const left = centerX - w / 2, top = centerY - h / 2;
  const hex = color.getHex();
  const rgb = [hex >> 16, (hex >> 8) & 255, hex & 255];
  for (let y = Math.max(0, Math.ceil(top - 0.5)); y + 0.5 < top + h && y < height; y++) {
    for (let x = Math.max(0, Math.ceil(left - 0.5)); x + 0.5 < left + w && x < width; x++) {
      const i = y * width + x;
      if (clip.z / clip.w > depth[i]) continue;
      const tx = Math.floor((x + 0.5 - left) * SIDE / w);
      const ty = Math.floor((y + 0.5 - top) * SIDE / h);
      const a = mask[ty * SIDE + tx] / 255;
      if (!a) continue;
      const base = pixels[4 * i + 3] / 255;
      const total = base + a * (1 - base);
      for (let ch = 0; ch < 3; ch++) pixels[4 * i + ch] = (pixels[4 * i + ch] * base + rgb[ch] * a) / total;
      pixels[4 * i + 3] = total * 255;
    }
  }
}
