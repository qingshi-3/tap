import { Box3, DirectionalLight, OrthographicCamera, Scene, Vector3 } from 'three';
import type { MapNodeSpec } from './mapArt';
import { voxelBatches } from './mapVoxelBatch';
import { landmark } from './mapVoxelModels';
import { renderStill } from './mapVoxelStill';
import { BIOMES, type VoxelThemeInfo } from './mapVoxelThemes';

// The inspection panel uses the same miniature as the island, seen close up from the gate.
export function landmarkPortrait(spec: MapNodeSpec, theme: VoxelThemeInfo) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 90;
  canvas.className = 'map-landmark-portrait';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const scene = new Scene();
  const batch = voxelBatches(scene, false);
  try {
    landmark(batch.box, { spec, pos: new Vector3() }, theme.id, BIOMES[theme.id]);
    batch.finish();
    const bounds = new Box3();
    for (const model of scene.children) if (!model.userData.mapAura) bounds.expandByObject(model);
    const center = bounds.getCenter(new Vector3());
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    camera.position.copy(center).add(new Vector3(8, 7, 16));
    camera.lookAt(center);
    camera.updateMatrixWorld();
    const view = bounds.clone().applyMatrix4(camera.matrixWorldInverse);
    const size = view.getSize(new Vector3());
    const aspect = canvas.width / canvas.height;
    const half = Math.max(size.y, size.x / aspect) * 0.52;
    camera.left = -half * aspect;
    camera.right = half * aspect;
    camera.top = half;
    camera.bottom = -half;
    camera.updateProjectionMatrix();
    const sun = new DirectionalLight(BIOMES[theme.id].key);
    sun.position.set(-4, 7, 5);
    scene.add(sun);
    const img = ctx.createImageData(canvas.width, canvas.height);
    img.data.set(renderStill(scene, camera, img.width, img.height));
    ctx.putImageData(img, 0, 0);
  } finally {
    batch.dispose();
  }
  return canvas;
}
