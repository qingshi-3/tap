/**
 * 肖像生成：从已加载的图集/地景图里裁出画面，做成小尺寸 data URL。
 * 单位取该兵种 1 级 idle 首帧；建筑取地图上实际使用的地景格。
 * 这样卡片上的图与战场上的对象是同一份原始素材，不会出现"头像与实物不像"。
 * 不新增位图资源，不修改素材源。
 */
import type { AssetManifest, SpriteFrame, UnitAsset, WorldAsset } from '../assets-types';

const atlasImages = new Map<string, HTMLImageElement>();
const portraitCache = new Map<string, string>();

/** 建筑类没有单位动画，用地图上真实渲染的 16×16 地景格做图。 */
const BUILDING_TILE: Record<string, string> = { wall: 'wall', tower: 'tower', slow: 'slow' };

export interface PortraitOptions {
  /** 输出画布宽度（CSS 像素），高度按素材比例 */
  width: number;
  /** 是否裁掉透明边，让单位在框里更大 */
  trim?: boolean;
}

function loadAtlas(file: string): Promise<HTMLImageElement> {
  const cached = atlasImages.get(file);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'sync';
    image.onload = () => {
      atlasImages.set(file, image);
      resolve(image);
    };
    image.onerror = () => reject(new Error(`图集无法解码：${file}`));
    image.src = file;
  });
}

/** 同步取已解码图；未加载过则抛错，调用方按缺图处理。 */
function getDecoded(file: string): HTMLImageElement {
  const image = atlasImages.get(file);
  if (!image) throw new Error(`图集尚未加载：${file}`);
  return image;
}

function opaqueBounds(image: HTMLImageElement, frame: SpriteFrame): [number, number, number, number] {
  const [fx, fy, fw, fh] = frame.rect;
  const probe = document.createElement('canvas');
  probe.width = fw;
  probe.height = fh;
  const context = probe.getContext('2d', { willReadFrequently: true })!;
  context.imageSmoothingEnabled = false;
  context.drawImage(image, fx, fy, fw, fh, 0, 0, fw, fh);
  const { data } = context.getImageData(0, 0, fw, fh);
  let minX = fw;
  let minY = fh;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      if (data[(y * fw + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return [fx, fy, fw, fh];
  return [fx + minX, fy + minY, maxX - minX + 1, maxY - minY + 1];
}

function draw(url: string, source: [number, number, number, number], width: number): string {
  const scale = width / source[2];
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(source[3] * scale));
  const context = canvas.getContext('2d')!;
  context.imageSmoothingEnabled = false;
  context.drawImage(getDecoded(url), source[0], source[1], source[2], source[3], 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

async function framesFrom(url: string, source: [number, number, number, number], width: number): Promise<string | null> {
  try {
    await loadAtlas(url);
    return draw(url, source, width);
  } catch {
    return null;
  }
}

/**
 * 生成全部肖像。返回键 -> data URL，键包含：
 * - 每个单位素材键本身（`shield-1`、`mage-3`…）
 * - 每个兵种的无级别别名（`shield` -> 该兵种 1 级），便于招募栏直接取用
 * - 建筑键（`wall`/`tower`/`slow`）取地图上真实渲染的地景格
 * 任何一项缺素材或解码失败只跳过它，不抛错。
 */
export async function installPortraits(
  manifest: AssetManifest,
  options: PortraitOptions = { width: 44, trim: true },
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const trim = options.trim !== false;
  const alias: string[] = [];

  for (const [kind, unit] of Object.entries(manifest.units) as [string, UnitAsset][]) {
    const cacheKey = `${kind}:${options.width}:${trim}`;
    const cached = portraitCache.get(cacheKey);
    if (cached) {
      result[kind] = cached;
      alias.push(kind);
      continue;
    }
    const frame = unit.animations.idle[0] ?? unit.animations.walk[0] ?? unit.animations.attack[0];
    if (!frame) continue;
    try {
      const image = await loadAtlas(frame.file);
      const source = trim ? opaqueBounds(image, frame) : frame.rect;
      const url = draw(frame.file, source, options.width);
      portraitCache.set(cacheKey, url);
      result[kind] = url;
      alias.push(kind);
    } catch {
      // 缺图不阻塞界面；调用方用图标兜底。
    }
  }

  // 兵种别名：招募栏按 `shield` 取图，实际素材键是 `shield-1`。取编号最小的那一级。
  const byBase = new Map<string, string[]>();
  for (const kind of alias) {
    const base = kind.replace(/-\d+$/, '');
    const list = byBase.get(base) ?? [];
    list.push(kind);
    byBase.set(base, list);
  }
  for (const [base, kinds] of byBase) {
    const lowest = [...kinds].sort((a, b) => {
      const ta = Number(a.match(/-(\d+)$/)?.[1] ?? 1);
      const tb = Number(b.match(/-(\d+)$/)?.[1] ?? 1);
      return ta - tb || a.localeCompare(b);
    })[0];
    result[base] = result[lowest];
  }

  // 建筑：用真实地景格，和战场上看到的是同一张图。
  for (const [building, tile] of Object.entries(BUILDING_TILE)) {
    const asset: WorldAsset | undefined = manifest.world?.[tile];
    if (!asset) continue;
    const cacheKey = `world:${tile}:${options.width}`;
    const cached = portraitCache.get(cacheKey);
    if (cached) { result[building] = cached; continue; }
    const url = await framesFrom(asset.file, asset.rect, options.width);
    if (!url) continue;
    portraitCache.set(cacheKey, url);
    result[building] = url;
  }

  return result;
}
