import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import type { Terrain } from './mapVoxelTerrain';
import type { ProjectedPoint } from './mapArt';

export function expeditionCamera(land: Terrain) {
  const camera = new PerspectiveCamera(20, 1280 / 552, 0.5, 270);
  const target = new Vector3(0, 1.75, 0);
  const view = new Vector3();
  const distance = 117;
  // Keep the top of the keep and the tips of the rocks in shot throughout the
  // orbit. A small set of extrema suffices, even for the narrowest viewport.
  const tiles = new Map<string, { top: Vector3; foot: Vector3 }>();
  for (const { x, h, z, root, wet } of land.cells.values()) {
    const key = Math.floor(x / 4) + ',' + Math.floor(z / 4);
    const high = h + 2.4;
    const low = root - (wet && !land.at(x, z + 1.25) ? 5.3 : 1.4);
    let tile = tiles.get(key);
    if (!tile) {
      tile = { top: new Vector3(x, high, z), foot: new Vector3(x, low, z) };
      tiles.set(key, tile);
    }
    if (high >= tile.top.y) tile.top.set(x, high, z);
    if (low <= tile.foot.y) tile.foot.set(x, low, z);
  }
  const bounds = [...tiles.values()].flatMap(t => [t.top, t.foot]);
  for (const { spec, pos } of land.sites.values()) {
    if (spec.kind === 'boss') bounds.push(pos.clone().add(new Vector3(0.5, 10.7, -5.1)));
  }
  let previousYaw = NaN, previousPitch = NaN, previousAspect = NaN;
  function aim(yaw: number, pitch: number, aspect = camera.aspect) {
    if (yaw === previousYaw && pitch === previousPitch && aspect === previousAspect) return;
    previousYaw = yaw; previousPitch = pitch; previousAspect = aspect;
    const az = MathUtils.degToRad(-3 + yaw * 8), alt = MathUtils.degToRad(38 + pitch * 3.5);
    camera.position.set(Math.sin(az) * Math.cos(alt), Math.sin(alt), Math.cos(az) * Math.cos(alt))
      .multiplyScalar(distance).add(target);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    let bottom = Infinity, top = -Infinity, halfWidth = 0;
    for (const p of bounds) {
      view.copy(p).applyMatrix4(camera.matrixWorldInverse);
      const scale = distance / -view.z;
      bottom = Math.min(bottom, view.y * scale);
      top = Math.max(top, view.y * scale);
      halfWidth = Math.max(halfWidth, Math.abs(view.x * scale));
    }
    const span = Math.max(40.8, (top - bottom) / 0.94, Math.max(94, halfWidth * 2.1) / aspect);
    camera.aspect = aspect;
    camera.fov = MathUtils.radToDeg(2 * Math.atan(span / (2 * distance)));
    camera.updateProjectionMatrix();
    // Shift the film gate vertically while retaining a square pixel aspect.
    camera.projectionMatrix.elements[9] = (top + bottom) / span;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
  function project(p: Vector3): ProjectedPoint {
    view.copy(p).applyMatrix4(camera.matrixWorldInverse);
    const scale = MathUtils.clamp(distance / -view.z, 0.88, 1.12);
    view.applyMatrix4(camera.projectionMatrix);
    return {
      x: MathUtils.clamp((view.x + 1) * 50, 0, 100),
      y: MathUtils.clamp((1 - view.y) * 50, 0, 100),
      scale,
    };
  }
  aim(0, 0);
  return { camera, aim, project };
}
