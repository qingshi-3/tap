import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { GRID, TILE_WIDTH, type Terrain } from './mapVoxelTerrain';
import type { ProjectedPoint } from './mapArt';

export function expeditionCamera(land: Terrain) {
  const camera = new PerspectiveCamera(20, 1280 / 552, 0.5, 270);
  const target = new Vector3(0, 1.75, 0);
  const view = new Vector3();
  const distance = 117;
  // Keep the top of the keep and the tips of the rocks in shot throughout the
  // orbit. A small set of extrema suffices, even for the narrowest viewport.
  const tiles = new Map<string, { top: Vector3; foot: Vector3 }>();
  const cliffLip: Vector3[] = [];
  for (const { x, h, z, root, wet } of land.cells.values()) {
    const key = Math.floor(x / 4) + ',' + Math.floor(z / 4);
    const high = h + 2.4;
    const openFront = !land.at(x, z + GRID);
    const low = root - (wet && openFront ? 5.3 : 1.4);
    if (z > 0 && openFront) {
      // The buttresses and falling water project below the last terrain cell.
      cliffLip.push(new Vector3(x - TILE_WIDTH / 2, root - (wet ? 5.2 : 2.4), z + GRID));
    }
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
    const boss = spec.kind === 'boss';
    bounds.push(pos.clone().add(new Vector3(boss ? 0.5 : 0, boss ? 10.7 : 5.2, boss ? -5.1 : -2.2)));
  }
  // The six skyline models have distinct footprints. Frame their rear corners,
  // including the ember plume above the furnace, at the generated shelf height.
  const { x, z } = land.focal;
  const crown = land.ground(x, z) + (land.themeId === 'ashen_citadel' ? 14.2 : 10.1);
  for (const side of [-1, 1]) bounds.push(new Vector3(x + side * 4.7, crown, z - 2.8));
  const [bearing, elevation] = land.viewAngles;
  let previousYaw = NaN, previousPitch = NaN, previousAspect = NaN;
  function aim(yaw: number, pitch: number, aspect = camera.aspect) {
    if (yaw === previousYaw && pitch === previousPitch && aspect === previousAspect) return;
    previousYaw = yaw; previousPitch = pitch; previousAspect = aspect;
    const az = MathUtils.degToRad(bearing + yaw * 3.5), alt = MathUtils.degToRad(elevation + pitch * 1.8);
    camera.position.set(Math.sin(az) * Math.cos(alt), Math.sin(alt), Math.cos(az) * Math.cos(alt))
      .multiplyScalar(distance).add(target);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    let bottom = Infinity, top = -Infinity, left = Infinity, right = -Infinity;
    for (const p of bounds) {
      view.copy(p).applyMatrix4(camera.matrixWorldInverse);
      const scale = distance / -view.z;
      bottom = Math.min(bottom, view.y * scale);
      top = Math.max(top, view.y * scale);
      left = Math.min(left, view.x * scale);
      right = Math.max(right, view.x * scale);
    }
    let lip = Infinity;
    for (const p of cliffLip) {
      view.copy(p).applyMatrix4(camera.matrixWorldInverse);
      lip = Math.min(lip, view.y * distance / -view.z);
    }
    const floor = Math.min(bottom, Number.isFinite(lip) ? lip : bottom);
    const height = (top - floor) / 0.952;
    const width = (right - left) / 0.96;
    const span = Math.max(height, width / aspect);
    camera.aspect = aspect;
    camera.fov = MathUtils.radToDeg(2 * Math.atan(span / (2 * distance)));
    camera.updateProjectionMatrix();
    // The terrain silhouette and skyline stay centred at every aspect ratio.
    // DOM markers and the 3D renderer share this same off-axis projection.
    const centerY = (top + floor) / 2;
    camera.projectionMatrix.elements[8] = (left + right) / (aspect * span);
    camera.projectionMatrix.elements[9] = 2 * centerY / span;
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
