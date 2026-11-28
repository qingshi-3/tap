import type { Vector3 } from 'three';
import { expeditionCamera } from './mapVoxelCamera';
import { ACT_DEFAULT_THEME, BIOMES, VOXEL_THEMES, type VoxelThemeInfo } from './mapVoxelThemes';
import { clamp, nodeKey, survey } from './mapVoxelTerrain';
import { createRealmRenderer, type RealmRenderer } from './mapVoxelRenderer';
import { skyLight } from './mapVoxelSky';

export { ACT_DEFAULT_THEME, ACT_REALMS, VOXEL_THEMES, type VoxelThemeInfo } from './mapVoxelThemes';
export type MapNodeKind = 'fight' | 'elite' | 'camp' | 'shop' | 'event' | 'treasure' | 'boss';
export interface MapNodeSpec {
  layer: number;
  index: number;
  cols: number;
  count: number;
  kind: MapNodeKind;
  next: number[];
}
export interface MapPathState {
  walked: Set<string>;
  available: Set<string>;
  preview: Set<string>;
  chosen: string;
}
export type MapPulse = 'inspect' | 'depart';
export interface ProjectedPoint {
  x: number;
  y: number;
  scale: number;
}
export interface MapRealm {
  el: HTMLElement;
  theme: VoxelThemeInfo;
  setTheme: (themeId: string) => void;
  setParallax: (nx: number, ny: number) => void;
  setPathState: (state: MapPathState) => void;
  projectNode: (layer: number, index: number) => ProjectedPoint;
  projectEntry: () => ProjectedPoint;
  onFrame: (cb: () => void) => void;
  pulseNode: (layer: number, index: number, kind?: MapPulse) => void;
  dispose: () => void;
}

export function mountMapRealm(act: number, nodes: MapNodeSpec[] = [], initialThemeId?: string): MapRealm {
  const actId = ACT_DEFAULT_THEME[clamp(Math.trunc(act) || 0, 0, 2)];
  let theme = VOXEL_THEMES.find(v => v.id === initialThemeId) ?? VOXEL_THEMES.find(v => v.id === actId)!;
  const el = document.createElement('div');
  el.className = 'map-illustration';
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, { position: 'absolute', inset: '0', overflow: 'hidden', pointerEvents: 'none' });
  const sky = document.createElement('div');
  sky.className = 'map-skylight';
  el.appendChild(sky);
  function backdrop() {
    const [top, horizon, base] = BIOMES[theme.id].sky;
    // 分阶像素天空色带 + 四周暗角压边，避免平滑塑料渐变与体素浮空岛割裂
    el.style.background = [
      'radial-gradient(ellipse 84% 78% at 50% 48%, transparent 54%, rgba(7, 5, 18, .62) 100%)',
      `radial-gradient(ellipse at 20% 34%, ${base}48, transparent 54%)`,
      `linear-gradient(180deg, ${top} 0% 18%, color-mix(in srgb, ${top} 66%, ${horizon}) 18% 36%, color-mix(in srgb, ${top} 28%, ${horizon}) 36% 54%, ${horizon} 54% 72%, color-mix(in srgb, ${horizon} 45%, ${base}) 72% 86%, ${base} 86% 100%)`,
    ].join(', ');
    el.dataset.theme = theme.id;
    sky.style.backgroundImage = skyLight(theme);
  }
  backdrop();
  let land = survey(nodes, theme.id);
  let view = expeditionCamera(land);
  let width = 0,
    height = 0,
    yaw = 0,
    pitch = 0,
    nx = 0,
    ny = 0;
  let paths: MapPathState = { walked: new Set(), available: new Set(), preview: new Set(), chosen: '' };
  const listeners = new Set<() => void>();
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let renderer: RealmRenderer | undefined;
  let pendingPulse: { pos: Vector3; kind: MapPulse } | undefined;
  let dead = false,
    loading = false,
    failed = false;
  let raf = 0,
    previous = 0,
    elapsed = 0;

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = previous = 0;
  }
  function redraw() {
    if (!dead && !document.hidden && width && height && !raf) raf = requestAnimationFrame(frame);
  }
  function frame(now: number) {
    raf = 0;
    if (dead || document.hidden || !width || !height) return;
    const dt = previous ? Math.min(0.08, (now - previous) / 1000) : 0;
    previous = now;
    const moving = renderer?.animated && !motion.matches;
    if (moving) {
      elapsed += dt;
      const ease = -Math.expm1(-dt * 6.1);
      yaw += (nx - yaw) * ease;
      pitch += (ny - pitch) * ease;
    } else {
      yaw = pitch = 0;
    }
    view.aim(yaw, pitch);
    if (moving) redraw();
    for (const cb of listeners) cb();
    if (!dead) renderer?.draw(view.camera, motion.matches ? 0 : elapsed);
  }
  function start() {
    loading = true;
    try {
      if (dead || document.hidden || !width || !height) return;
      renderer = createRealmRenderer(el, land, theme, redraw);
      renderer.resize(width, height);
      renderer.setPaths(paths);
      if (pendingPulse && !motion.matches) renderer.pulse(pendingPulse.pos, elapsed, pendingPulse.kind);
      pendingPulse = undefined;
    } catch (error) {
      failed = true;
      renderer?.dispose();
      renderer = undefined;
      console.warn('远征地图已启用静态布局', error);
    } finally {
      loading = false;
      redraw();
    }
  }
  function refresh() {
    stop();
    if (dead || document.hidden || !width || !height) return;
    if (!loading && !renderer && !failed) void start();
    redraw();
  }
  function resize(w: number, h: number) {
    width = Math.round(w);
    height = Math.round(h);
    if (width && height) {
      view.aim(yaw, pitch, width / height);
      renderer?.resize(width, height);
    }
    refresh();
  }
  const measure = () => resize(el.clientWidth, el.clientHeight);
  const observer =
    typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver(([entry]) => resize(entry.contentRect.width, entry.contentRect.height));
  observer?.observe(el);
  window.addEventListener('resize', measure);
  const kickMeasure = () => {
    if (dead || (width > 0 && height > 0)) return;
    if (el.clientWidth > 0 && el.clientHeight > 0) measure();
    else requestAnimationFrame(kickMeasure);
  };
  requestAnimationFrame(kickMeasure);
  motion.addEventListener('change', refresh);
  document.addEventListener('visibilitychange', refresh);
  return {
    el,
    get theme() {
      return theme;
    },
    setTheme(id) {
      const next = VOXEL_THEMES.find(v => v.id === id);
      if (dead || !next || next === theme) return;
      const nextLand = survey(nodes, next.id);
      const nextView = expeditionCamera(nextLand);
      if (width && height) nextView.aim(yaw, pitch, width / height);
      renderer?.setTheme(nextLand, next);
      land = nextLand;
      view = nextView;
      theme = next;
      pendingPulse = undefined;
      backdrop();
      renderer?.setPaths(paths);
      redraw();
    },
    setParallax(x, y) {
      nx = Number.isFinite(x) ? clamp(x, -1, 1) : 0;
      ny = Number.isFinite(y) ? clamp(y, -1, 1) : 0;
    },
    setPathState(state) {
      if (dead) return;
      paths = state;
      renderer?.setPaths(state);
      redraw();
    },
    projectNode(l, i) {
      return view.project(land.sites.get(nodeKey(l, i))?.pos ?? land.gate);
    },
    projectEntry() {
      return view.project(land.gate);
    },
    onFrame(cb) {
      if (!dead) {
        listeners.add(cb);
        redraw();
      }
    },
    pulseNode(l, i, kind = 'depart') {
      const site = land.sites.get(nodeKey(l, i));
      if (!dead && site && !motion.matches) {
        if (renderer) renderer.pulse(site.pos, elapsed, kind);
        else pendingPulse = { pos: site.pos, kind };
        redraw();
      }
    },
    dispose() {
      if (dead) return;
      dead = true;
      stop();
      listeners.clear();
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      motion.removeEventListener('change', refresh);
      document.removeEventListener('visibilitychange', refresh);
      renderer?.dispose();
      renderer = undefined;
    },
  };
}

export function mapArt(act = 0): HTMLElement {
  const tag = 'expedition-map-art';
  if (!customElements.get(tag))
    customElements.define(
      tag,
      class extends HTMLElement {
        private realm?: MapRealm;
        connectedCallback() {
          this.realm = mountMapRealm(Number(this.dataset.act));
          this.replaceChildren(this.realm.el);
        }
        disconnectedCallback() {
          this.realm?.dispose();
          this.realm = undefined;
        }
      },
    );
  const host = document.createElement(tag);
  host.className = 'map-illustration';
  host.setAttribute('aria-hidden', 'true');
  host.dataset.act = String(act);
  return host;
}
