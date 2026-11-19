import { Vector3 } from 'three';
import { expeditionCamera } from './mapVoxelCamera';
import { ACT_DEFAULT_THEME, BIOMES, VOXEL_THEMES, type VoxelThemeInfo } from './mapVoxelThemes';
import { clamp, follow, nodeKey, ROAD_LIFT, survey } from './mapVoxelTerrain';
import { createRealmRenderer, type RealmRenderer } from './mapVoxelRenderer';

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
export interface ProjectedPoint {
  x: number;
  y: number;
  scale: number;
}
interface NodeRef {
  layer: number;
  index: number;
}
export interface MapRealm {
  el: HTMLElement;
  theme: VoxelThemeInfo;
  setTheme: (themeId: string) => void;
  setParallax: (nx: number, ny: number) => void;
  setPathState: (state: MapPathState) => void;
  projectNode: (layer: number, index: number) => ProjectedPoint;
  projectCampEntry: (index: number) => ProjectedPoint;
  projectAlong: (from: NodeRef | { campIndex: number }, to: NodeRef, t: number) => ProjectedPoint;
  onFrame: (cb: () => void) => void;
  pulseNode: (layer: number, index: number) => void;
  dispose: () => void;
}

export function mountMapRealm(act: number, nodes: MapNodeSpec[] = [], initialThemeId?: string): MapRealm {
  const actId = ACT_DEFAULT_THEME[clamp(Math.trunc(act) || 0, 0, 2)];
  let theme = VOXEL_THEMES.find(v => v.id === initialThemeId) ?? VOXEL_THEMES.find(v => v.id === actId)!;
  const el = document.createElement('div');
  el.className = 'map-illustration';
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, { position: 'absolute', inset: '0', overflow: 'hidden', pointerEvents: 'none' });
  function backdrop() {
    const [top, horizon, base] = BIOMES[theme.id].sky;
    el.style.background = `radial-gradient(ellipse at 18% 34%, ${base}60, transparent 57%), linear-gradient(180deg, ${top} 0%, ${horizon} 64%, ${base} 100%)`;
    el.dataset.theme = theme.id;
  }
  backdrop();
  const land = survey(nodes);
  const { camera, aim, project } = expeditionCamera(land);
  const target = new Vector3(), point = new Vector3();
  let width = 0,
    height = 0,
    yaw = 0,
    pitch = 0,
    nx = 0,
    ny = 0;
  const entryAt = (i: number) => land.entries.get(i) ?? land.entries.values().next().value ?? target;
  const nodeAt = (l: number, i: number) => land.sites.get(nodeKey(l, i))?.pos ?? target;
  let paths: MapPathState = { walked: new Set(), available: new Set(), preview: new Set(), chosen: '' };
  const listeners = new Set<() => void>();
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let renderer: RealmRenderer | undefined;
  let pendingPulse: Vector3 | undefined;
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
    aim(yaw, pitch);
    if (moving) redraw();
    for (const cb of listeners) cb();
    if (!dead) renderer?.draw(camera, motion.matches ? 0 : elapsed);
  }
  function start() {
    loading = true;
    try {
      if (dead || document.hidden || !width || !height) return;
      renderer = createRealmRenderer(el, land, theme, redraw);
      renderer.resize(width, height);
      renderer.setPaths(paths);
      if (pendingPulse && !motion.matches) renderer.pulse(pendingPulse, elapsed);
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
      aim(yaw, pitch, width / height);
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
      renderer?.setTheme(next);
      theme = next;
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
      return project(nodeAt(l, i));
    },
    projectCampEntry(i) {
      return project(entryAt(i));
    },
    projectAlong(from, to, t) {
      const camp = 'campIndex' in from;
      const start = camp ? entryAt(from.campIndex) : nodeAt(from.layer, from.index);
      const dest = nodeAt(to.layer, to.index),
        u = Number.isFinite(t) ? clamp(t, 0, 1) : 0;
      if (u === 0 || u === 1) return project(u === 0 ? start : dest);
      // All entry lanes share the timber landing. A hero starting in another
      // lane first crosses the deck, then follows the destination's built spur.
      const key = (camp ? `camp-${to.index}` : nodeKey(from.layer, from.index)) + '->' + nodeKey(to.layer, to.index);
      const road = land.roads.get(key);
      if (road) {
        const lead = start.distanceTo(road.points[0]);
        const travel = u * (lead + road.length);
        if (travel < lead) point.lerpVectors(start, road.points[0], travel / lead);
        else follow(road, (travel - lead) / road.length, point);
      } else {
        point.lerpVectors(start, dest, u);
        point.y = land.ground(point.x, point.z) + ROAD_LIFT;
      }
      point.y += Math.sin(Math.PI * u) * 1.4;
      return project(point);
    },
    onFrame(cb) {
      if (!dead) {
        listeners.add(cb);
        redraw();
      }
    },
    pulseNode(l, i) {
      const site = land.sites.get(nodeKey(l, i));
      if (!dead && site && !motion.matches) {
        if (renderer) renderer.pulse(site.pos, elapsed);
        else pendingPulse = site.pos;
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
