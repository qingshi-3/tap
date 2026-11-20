import { ACESFilmicToneMapping, PCFShadowMap, WebGLRenderer, type Camera, type Vector3 } from 'three';
import type { MapPathState, MapPulse } from './mapArt';
import type { VoxelThemeInfo } from './mapVoxelThemes';
import type { Terrain } from './mapVoxelTerrain';
import { buildWorld } from './mapVoxelWorld';
import { renderStill } from './mapVoxelStill';

export type RealmRenderer = ReturnType<typeof createRealmRenderer>;

export function createRealmRenderer(el: HTMLElement, land: Terrain, theme: VoxelThemeInfo, redraw: () => void) {
  function canvas() {
    const c = document.createElement('canvas');
    c.className = 'map-realm-canvas';
    Object.assign(c.style, { display: 'block', width: '100%', height: '100%' });
    return c;
  }
  const surface = canvas();
  let world = buildWorld(land, theme),
    gpu: WebGLRenderer | undefined;
  let still: HTMLCanvasElement | undefined,
    ctx: CanvasRenderingContext2D | null = null;
  let dirty = true,
    width = 1,
    height = 1;
  function initGPU() {
    try {
      const attributes = { alpha: true, antialias: true, powerPreference: 'high-performance' as const };
      const gl = surface.getContext('webgl2', attributes) as WebGL2RenderingContext | null;
      if (!gl) return false;
      gpu = new WebGLRenderer({ canvas: surface, context: gl, ...attributes });
      gpu.setClearColor(0, 0);
      gpu.toneMapping = ACESFilmicToneMapping;
      gpu.toneMappingExposure = 1.04;
      gpu.shadowMap.enabled = true;
      gpu.shadowMap.type = PCFShadowMap;
      gpu.shadowMap.autoUpdate = false;
      gpu.shadowMap.needsUpdate = true;
      return true;
    } catch {
      gpu?.dispose();
      gpu = undefined;
      return false;
    }
  }
  function resize(w: number, h: number) {
    width = w;
    height = h;
    if (gpu) gpu.setDrawingBufferSize(w, h, Math.min(window.devicePixelRatio || 1, 1.75));
    else if (still) {
      const ratio = Math.min(1, 1100 / w, 720 / h);
      still.width = Math.max(1, Math.round(w * ratio));
      still.height = Math.max(1, Math.round(h * ratio));
    }
    dirty = true;
  }
  function useStill() {
    still = canvas();
    ctx = still.getContext('2d');
    if (surface.parentElement) surface.replaceWith(still);
    else el.appendChild(still);
    resize(width, height);
  }
  function lost(e: Event) {
    e.preventDefault();
    gpu?.dispose();
    gpu = undefined;
    useStill();
    redraw();
  }
  function restored() {
    if (!initGPU()) return;
    still?.replaceWith(surface);
    still = undefined;
    ctx = null;
    resize(width, height);
    redraw();
  }
  if (initGPU()) el.appendChild(surface);
  else useStill();
  surface.addEventListener('webglcontextlost', lost);
  surface.addEventListener('webglcontextrestored', restored);
  return {
    get animated() {
      return !!gpu;
    },
    resize,
    draw(camera: Camera, t: number) {
      if (gpu) {
        world.frame(t);
        gpu.render(world.scene, camera);
      } else if (dirty && still && ctx) {
        dirty = false;
        world.frame(0);
        const img = ctx.createImageData(still.width, still.height);
        img.data.set(renderStill(world.scene, camera, still.width, still.height));
        ctx.putImageData(img, 0, 0);
      }
    },
    setTheme(nextLand: Terrain, next: VoxelThemeInfo) {
      const replacement = buildWorld(nextLand, next);
      world.dispose();
      world = replacement;
      dirty = true;
      if (gpu) gpu.shadowMap.needsUpdate = true;
    },
    setPaths(state: MapPathState) {
      world.state(state);
      dirty = true;
    },
    pulse(p: Vector3, t: number, kind: MapPulse) {
      if (gpu) world.pulse(p, t, kind);
    },
    dispose() {
      surface.removeEventListener('webglcontextlost', lost);
      surface.removeEventListener('webglcontextrestored', restored);
      world.dispose();
      gpu?.dispose();
      gpu?.forceContextLoss();
      gpu = undefined;
      surface.remove();
      still?.remove();
      still = undefined;
      ctx = null;
    },
  };
}
