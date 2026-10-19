// Generated image atlases only. Immutable originals and prompts: assets/SOURCES.md.
const TERRAIN = ['grass', 'forest', 'water', 'mountain', 'fertile'];
const BUILDINGS = ['hall', 'house', 'farm', 'lumber', 'mine', 'fishery', 'market', 'school', 'clinic', 'barracks'];
const RESOURCES = ['gold', 'food', 'wood', 'population', 'happiness', 'knowledge', 'defense'];
const MATERIAL = ['#91b16e', '#789763', '#68adb7', '#9fa69a', '#b69b6b'];
const atlases = new Map();
let loading;

/** Complete subject bounds preserve flags that cross nominal atlas cell boundaries. */
export function loadArt() {
  if (!loading) loading = (async () => {
    const response = await fetch(new URL('./assets/generated/frames.json', import.meta.url));
    if (!response.ok) throw new Error('无法加载美术裁切数据');
    const metadata = await response.json();
    const reports = await Promise.all(['buildings', 'terrain', 'resources'].map(name => new Promise(resolve => {
      const image = new Image();
      image.onload = () => {
        const entry = metadata[name];
        if (image.naturalWidth !== entry.width || image.naturalHeight !== entry.height) {
          resolve({name, ok:false, error:'图集尺寸与裁切记录不符'}); return;
        }
        atlases.set(name, {image, frames:entry.frames}); resolve({name, ok:true});
      };
      image.onerror = () => resolve({name, ok:false, error:'图片加载失败'});
      image.src = new URL(`./assets/generated/${name}.png`, import.meta.url).href;
    })));
    return {loaded:reports.filter(r => r.ok).length, total:reports.length, reports};
  })().catch(error => ({loaded:0, total:3, error:error.message}));
  return loading;
}

function begin(ctx, x, y, size) {
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.beginPath(); ctx.rect(x, y, size, size); ctx.clip();
}
function model(ctx, name, index, x, y, size, bottom = false) {
  const atlas = atlases.get(name), frame = atlas?.frames[index];
  if (!frame) return;
  const scale = size * .96 / Math.max(frame.w, frame.h), w = frame.w * scale, h = frame.h * scale;
  ctx.drawImage(atlas.image, frame.x, frame.y, frame.w, frame.h,
    x + (size-w)/2, bottom ? y+size*.96-h : y+(size-h)/2, w, h);
}
function terrain(ctx, type, x, y, size, cleared = false) {
  const index = Math.max(0, TERRAIN.indexOf(type));
  // Opaque ground covers former trees/rocks, including when previewing a building.
  ctx.fillStyle = MATERIAL[index]; ctx.fillRect(x, y, size, size);
  const atlas = atlases.get('terrain'), frame = atlas?.frames[index + (cleared ? 5 : 0)];
  if (frame) ctx.drawImage(atlas.image, frame.x, frame.y, frame.w, frame.h, x, y, size, size);
}
export function drawTerrain(ctx, type, x, y, size, seed = 0) {
  if (!(size > 0)) return;
  begin(ctx,x,y,size); terrain(ctx,type,x,y,size); ctx.restore();
}
export function drawBuilding(ctx, type, x, y, size, level = 1, ground = 'grass') {
  if (!(size > 0)) return;
  begin(ctx,x,y,size);
  ctx.clearRect(x,y,size,size);
  terrain(ctx,ground,x,y,size,true);
  model(ctx,'buildings',BUILDINGS.indexOf(type),x,y,size,true);
  // The host UI owns the level badge; these originals have one model per building.
  ctx.restore();
}
export function drawIcon(ctx, key, x, y, size) {
  if (!(size > 0)) return;
  if (TERRAIN.includes(key)) return drawTerrain(ctx,key,x,y,size);
  begin(ctx,x,y,size);
  const building = BUILDINGS.indexOf(key), resource = RESOURCES.indexOf(key);
  if (building >= 0) model(ctx,'buildings',building,x,y,size);
  else if (resource >= 0) model(ctx,'resources',resource,x,y,size);
  ctx.restore();
}
