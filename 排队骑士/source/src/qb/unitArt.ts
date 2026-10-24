import { FACTION_INFO, GENERAL_MAP, unitDef } from './shim';

export interface ArtOpts {
  enemy?: boolean;
  general?: string;
  /** 召唤物围绕脚底等比缩小。 */
  small?: boolean;
  /** 保留调用兼容；原图不再另外生成眼睛。 */
  noEyes?: boolean;
  /** 主将二阶形象（缺图时退回一阶） */
  tier2?: boolean;
}

interface UnitArt {
  image: string;
  still: string;
  selectedImage: string;
  frames: number;
  durationMs: number;
  width: number;
  height: number;
  source: string;
  attack?: ActStrip;
  hit?: ActStrip;
  cast?: ActStrip;
}
/** 动作条：每帧 160×112（左右各留 30px 给挥砍），脚底与呼吸条对齐 */
interface ActStrip { image: string; frames: number }
interface Manifest { version: number; units: Record<string, UnitArt> }

const manifests = import.meta.glob<Manifest>('../assets/units/manifest.json', { eager: true, import: 'default' });
const manifest = manifests['../assets/units/manifest.json'];
const images = import.meta.glob<string>('../assets/units/*.png', { eager: true, query: '?url', import: 'default' });
const pending = new Map<string, Promise<void>>();

const artKey = (defId: string | null, opts: ArtOpts) => (opts.general ? `general_${opts.general}` : defId);
/** 缺图时返回 null，由调用方画占位 */
function artFor(defId: string | null, opts: ArtOpts): UnitArt | null {
  const key = artKey(defId, opts);
  if (!key) return null;
  return (opts.tier2 ? manifest?.units[`${key}_2`] : undefined) ?? manifest?.units[key] ?? null;
}

/** 占位形象：阵营色剪影 + 名字首字 */
function placeholder(defId: string | null, opts: ArtOpts) {
  const g = opts.general ? GENERAL_MAP[opts.general] : null;
  const name = g ? g.name : defId ? unitDef(defId).name : '?';
  const faction = g ? g.faction : defId ? unitDef(defId).faction : 'neutral';
  return { name, color: FACTION_INFO[faction]?.color ?? '#999' };
}
function placeholderSvg(defId: string | null, opts: ArtOpts) {
  const p = placeholder(defId, opts);
  const crown = opts.general ? `<path d="M34 22 l8 8 8 -12 8 12 8 -8 -3 14 h-26z" fill="#ffd36b"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 112" width="100" height="112"><ellipse cx="50" cy="104" rx="26" ry="6" fill="rgba(0,0,0,.35)"/><path d="M28 104 C26 70 30 50 50 46 C70 50 74 70 72 104 Z" fill="${p.color}" stroke="#10101e" stroke-width="3"/><circle cx="50" cy="36" r="15" fill="${p.color}" stroke="#10101e" stroke-width="3"/>${crown}<text x="50" y="86" text-anchor="middle" font-size="24" font-weight="900" fill="#fff" stroke="#10101e" stroke-width="1">${p.name.slice(0, 1)}</text></svg>`;
}
const placeholderUrl = (defId: string | null, opts: ArtOpts) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(placeholderSvg(defId, opts))}`;

function imageUrl(file: string): string {
  const url = images[`../assets/units/${file}`];
  if (!url) throw new Error(`Missing Duelyst image: ${file}`);
  return url;
}

/** 兼容旧预热入口：直接加载原像素图，不经过 Canvas 或重新描边。 */
export function rasterize(defId: string | null, opts: ArtOpts = {}): Promise<void> {
  const art = artFor(defId, opts);
  if (!art) return Promise.resolve();
  return Promise.all([art.image, art.selectedImage].map((file) => {
    const url = imageUrl(file);
    let task = pending.get(url);
    if (!task) {
      task = new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Unable to load unit image: ${file}`));
        img.src = url;
      });
      pending.set(url, task);
    }
    return task;
  })).then(() => {});
}

/** 说明页 SVG 内使用稳定的第一帧。 */
export function unitPxUrl(defId: string | null, opts: ArtOpts = {}): string {
  const art = artFor(defId, opts);
  return art ? imageUrl(art.still) : placeholderUrl(defId, opts);
}

/** 保留旧调用名；方向由战场/标题容器控制，避免敌方重复镜像。 */
export function unitSvg(defId: string | null, opts: ArtOpts = {}): string {
  const art = artFor(defId, opts);
  if (!art) return `<span class="uart placeholder${opts.small ? ' duelyst-small' : ''}" data-unit-art="${artKey(defId, opts)}" aria-hidden="true"><img src="${placeholderUrl(defId, opts)}" alt="" draggable="false" width="100" height="112"/></span>`;
  const frames = Math.max(1, art.frames);
  const acts = (['attack', 'hit', 'cast'] as const).map((k) => art[k] ? ` data-act-${k}="${imageUrl(art[k]!.image)}|${art[k]!.frames}"` : '').join('');
  return `<span class="uart duelyst${opts.small ? ' duelyst-small' : ''}" data-unit-art="${opts.general ? `general_${opts.general}` : defId}"${acts} aria-hidden="true" style="--duelyst-frames:${frames};--duelyst-duration:${art.durationMs}ms"><span class="duelyst-frame"><img class="duelyst-strip duelyst-normal" src="${imageUrl(art.image)}" alt="" draggable="false" width="${art.width * frames}" height="${art.height}"/><img class="duelyst-strip duelyst-selected" src="${imageUrl(art.selectedImage)}" alt="" draggable="false" width="${art.width * frames}" height="${art.height}"/></span></span>`;
}

export function mix(a: string, b: string, t: number) {
  const pa = parse(a);
  const pb = parse(b);
  const c = pa.map((x, i) => Math.round(x + (pb[i] - x) * t));
  return `#${c.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}
function parse(hex: string) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

export function factionColor(defId: string) {
  return FACTION_INFO[unitDef(defId).faction].color;
}

