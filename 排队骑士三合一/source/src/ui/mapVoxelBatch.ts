import {
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  Scene,
  type Material,
} from 'three';

export type Batch = 'solid' | 'light' | 'water' | 'cloud';
export type Motion = (pose: Object3D, seconds: number) => void;
export type Box = (
  x: number,
  base: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: number,
  batch?: Batch,
  motion?: Motion,
  yaw?: number,
) => void;

interface Block {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: number;
  yaw: number;
  motion?: Motion;
}
function place(pose: Object3D, b: Block, t: number) {
  pose.position.set(b.x, b.y, b.z);
  pose.scale.set(b.w, b.h, b.d);
  pose.rotation.set(0, b.yaw, 0);
  b.motion?.(pose, t);
  pose.updateMatrix();
}

// A block's y argument is its foot so roofs, masonry courses and stairs stack exactly.
export function voxelBatches(scene: Scene, lava: boolean) {
  const geometry = new BoxGeometry(1, 1, 1);
  const materials = {
    solid: new MeshLambertMaterial(),
    light: new MeshBasicMaterial({ toneMapped: false }),
    water: lava
      ? new MeshBasicMaterial({ toneMapped: false })
      : new MeshLambertMaterial({ transparent: true, opacity: 0.81, depthWrite: false }),
    cloud: new MeshLambertMaterial({ depthWrite: true }),
  };
  const blocks: Record<Batch, Block[]> = { solid: [], light: [], water: [], cloud: [] };
  let count = 0;
  const box: Box = (x, base, z, w, h, d, color, batch = 'solid', motion, yaw = 0) => {
    count++;
    blocks[batch].push({ x, y: base + h / 2, z, w, h, d, color, yaw, motion });
  };
  const meshes: InstancedMesh[] = [],
    pose = new Object3D(),
    paint = new Color();
  const actors: { mesh: InstancedMesh; moving: { slot: number; block: Block }[] }[] = [];
  function meshFor(max: number, material: Material) {
    const mesh = new InstancedMesh(geometry, material, Math.max(1, max));
    meshes.push(mesh);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  }
  function finish() {
    for (const batch of Object.keys(blocks) as Batch[]) {
      const list = blocks[batch];
      if (!list.length) continue;
      // Keep animated matrices contiguous for a single short GPU buffer update.
      list.sort((a, b) => Number(!!b.motion) - Number(!!a.motion));
      const mesh = meshFor(list.length, materials[batch]);
      mesh.castShadow = mesh.receiveShadow = batch === 'solid';
      if (batch === 'water') mesh.renderOrder = 1;
      const moving: { slot: number; block: Block }[] = [];
      list.forEach((block, slot) => {
        place(pose, block, 0);
        mesh.setMatrixAt(slot, pose.matrix);
        mesh.setColorAt(slot, paint.setHex(block.color));
        if (block.motion) moving.push({ slot, block });
      });
      if (moving.length) {
        mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        actors.push({ mesh, moving });
      }
      list.length = 0;
    }
  }
  function animate(t: number) {
    for (const { mesh, moving } of actors) {
      for (const { slot, block } of moving) {
        place(pose, block, t);
        mesh.setMatrixAt(slot, pose.matrix);
      }
      mesh.instanceMatrix.clearUpdateRanges();
      mesh.instanceMatrix.addUpdateRange(0, moving.length * 16);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
  function dispose() {
    for (const m of meshes) {
      m.removeFromParent();
      m.dispose();
    }
    for (const mat of Object.values(materials)) mat.dispose();
    geometry.dispose();
  }
  return {
    box,
    finish,
    animate,
    dispose,
    get count() {
      return count;
    },
    effects: (capacity: number) => meshFor(capacity, materials.light),
  };
}
