// v0.8 incremental Duelyst idle-art import (Node port of import-v014-unit-art.py; no PIL needed).
// Frame layout: source sheets carry no plist, so frame rects come from Godot SpriteFrames
// (frames.tres, pixel-identical atlases) or a Cocos plist; gutter detection is the last resort.
// Usage: NODE_PATH=/tmp/qb/node_modules node scripts/import-v08-unit-art.cjs
const fs = require('fs');
const path = require('path');
let PNG;
try { ({ PNG } = require('pngjs')); } catch { ({ PNG } = require('/tmp/qb/node_modules/pngjs')); }

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'src/assets/units');
const SHEETS = '/home/admin/workspace/tap/assets/duelyst-unit-sheets';
const TRES_ROOT = '/tmp/rpg-review/assets/battle/units';
const PLIST_DIR = '/home/admin/workspace/tap/炉乡远征/dist/assets/units';

const MAPPING = {
  l_windblade: 'f1_windbladecommander', l_archer: 'f1_ranged', l_storm: 'f1_xylestormblade', l_caliber: 'f1_caliber-o',
  s_step: 'neutral_silhouettetracer', s_viper: 'f2_support', s_xyle: 'neutral_xyle01', s_panda: 'f2_pandabear',
  a_imp: 'neutral_monsterredsynja', a_chanter: 'neutral_beastrepulsion', a_nightmare: 'neutral_shadow3', a_void: 'f4_daemonvoid',
  m_whelp: 'neutral_gro', m_harvester: 'f5_spiritharvester', m_rager: 'f5_support', m_heart: 'f5_tank',
  v_snowman: 'f6_snowman', v_rhyno: 'f6_arcticrhyno', v_bear: 'f6_waterbear', v_stag: 'f6_voiceofthewind',
  d_goldob: 'f3_obelyskgoldenflame', d_shriek: 'f3_windshriek', d_hourglass: 'f3_zodiac02', d_worm: 'neutral_monsterblacksandburrower',
  n_gladiator: 'neutral_tribalmelee1', n_tether: 'neutral_tethermancer',
  t_night: 'neutral_shadow1', t_flame: 'neutral_monsterexplodingdemon', t_wolf: 'neutral_ghostlynx', t_wisp: 'neutral_dreamgazer',
  t_statue: 'neutral_golemstone', t_worm: 'critter_1',
  x_egg: ['neutral_mystery', 'f5_egg'], x_bone: 'neutral_serpenti', x_fire: 'neutral_zurael', x_frostd: 'neutral_luxignis',
  x_wind: 'neutral_monsterdragonhawk', x_brood: 'neutral_monsterflamewing', t_drakelet: 'neutral_monsterdragonhawk',
  general_zilan: 'f1_altgeneral', general_zilan_2: 'f1_altgeneraltier2', general_reva: 'f2_altgeneral', general_reva_2: 'f2_altgeneraltier2',
  general_kasiva: 'f4_altgeneral', general_kasiva_2: 'f4_altgeneraltier2', general_xingjiao: 'f5_altgeneral', general_xingjiao_2: 'f5_altgeneraltier2',
  general_kara: 'f6_altgeneral', general_kara_2: 'f6_altgeneraltier2', general_sajj: 'f3_altgeneral', general_sajj_2: 'f3_altgeneraltier2',
  s_lord: 'neutral_wartalon', e_frostq: 'boss_borealjuggernaut', d_sandblade: 'neutral_swordofakrane',
};
const ALIASES = { x_argeon: 'general_argeon', t_bonelet: 't_shade' };

const readPng = (p) => PNG.sync.read(fs.readFileSync(p));
const newImg = (w, h) => ({ width: w, height: h, data: Buffer.alloc(w * h * 4) });
function bbox(img) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++)
    if (img.data[(y * img.width + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1];
}
function blit(src, sx, sy, w, h, dst, dx, dy) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = sx + x, Y = sy + y, DX = dx + x, DY = dy + y;
    if (X < 0 || Y < 0 || X >= src.width || Y >= src.height || DX < 0 || DY < 0 || DX >= dst.width || DY >= dst.height) continue;
    const si = (Y * src.width + X) * 4, di = (DY * dst.width + DX) * 4;
    if (src.data[si + 3]) src.data.copy(dst.data, di, si, si + 4);
  }
}

// ---- frame metadata ----
let tresIndex = null;
function findTres(name) {
  if (!tresIndex) {
    tresIndex = {};
    const walk = (d) => { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (e.name.endsWith('.png') && fs.existsSync(path.join(d, 'frames.tres'))) tresIndex[e.name.slice(0, -4)] = path.join(d, 'frames.tres');
    } };
    walk(TRES_ROOT);
  }
  return tresIndex[name];
}
function rectsFromTres(file) {
  const text = fs.readFileSync(file, 'utf8');
  const regions = {};
  for (const m of text.matchAll(/id="([^"]+)"\]\s*atlas = [^\n]*\nregion = Rect2\((\d+), (\d+), (\d+), (\d+)\)/g)) regions[m[1]] = m.slice(2).map(Number);
  const anims = {};
  for (const m of text.matchAll(/"frames": \[([\s\S]*?)\],\s*"loop": \w+,\s*"name": &"(\w+)"/g))
    anims[m[2]] = [...m[1].matchAll(/SubResource\("([^"]+)"\)/g)].map((x) => regions[x[1]]);
  const key = anims.breathing ? 'breathing' : anims.idle ? 'idle' : null;
  if (!key) throw new Error('no breathing/idle in ' + file);
  return { anim: key, rects: anims[key].map(([x, y, w, h]) => ({ x, y, w, h, sw: w, sh: h, ox: 0, oy: 0 })) };
}
function rectsFromPlist(file) {
  const text = fs.readFileSync(file, 'utf8');
  const frames = {};
  for (const m of text.matchAll(/<key>([^<]+\.png)<\/key>\s*<dict>([\s\S]*?)<\/dict>/g)) {
    const get = (k) => ((m[2].match(new RegExp(`<key>${k}</key>\\s*<string>([^<]*)</string>`)) || [])[1] || '').match(/-?\d+/g)?.map(Number);
    frames[m[1]] = { f: get('frame'), src: get('sourceSize'), col: get('sourceColorRect'), rot: /<key>rotated<\/key>\s*<true\/>/.test(m[2]) };
  }
  let keys = Object.keys(frames).filter((k) => k.includes('_breathing_')).sort();
  let anim = 'breathing';
  if (!keys.length) { keys = Object.keys(frames).filter((k) => k.includes('_idle_')).sort(); anim = 'idle'; }
  if (!keys.length) throw new Error('no breathing/idle in ' + file);
  if (keys.some((k) => frames[k].rot)) throw new Error('rotated plist frames unsupported');
  return { anim, rects: keys.map((k) => { const { f, src, col } = frames[k]; return { x: f[0], y: f[1], w: f[2], h: f[3], sw: src[0], sh: src[1], ox: col[0], oy: col[1] }; }) };
}
// Fallback: transparent-gutter grid detection, first row of cells.
function rectsFromGutters(img) {
  const colEmpty = (x) => { for (let y = 0; y < img.height; y++) if (img.data[(y * img.width + x) * 4 + 3]) return false; return true; };
  const rowEmpty = (y, x0, x1) => { for (let x = x0; x < x1; x++) if (img.data[(y * img.width + x) * 4 + 3]) return false; return true; };
  const runs = (n, empty) => { const r = []; let s = -1; for (let i = 0; i <= n; i++) { const e = i === n || empty(i); if (!e && s < 0) s = i; if (e && s >= 0) { r.push([s, i]); s = -1; } } return r; };
  const rows = runs(img.height, (y) => rowEmpty(y, 0, img.width));
  if (!rows.length) throw new Error('empty sheet');
  const [y0, y1] = rows[0];
  const cols = runs(img.width, (x) => { for (let y = y0; y < y1; y++) if (img.data[(y * img.width + x) * 4 + 3]) return false; return true; });
  const h = y1 - y0, w = Math.max(...cols.map(([a, b]) => b - a));
  return { anim: 'gutter-row0', rects: cols.map(([a, b]) => ({ x: Math.round((a + b - w) / 2), y: y0, w, h, sw: w, sh: h, ox: 0, oy: 0 })) };
}

function extract(source) {
  const sheetPath = path.join(SHEETS, source + '.png');
  if (!fs.existsSync(sheetPath)) throw new Error('missing sheet ' + sheetPath);
  const atlas = readPng(sheetPath);
  const tres = findTres(source), plist = path.join(PLIST_DIR, source + '.plist');
  const meta = tres ? { ...rectsFromTres(tres), via: 'frames.tres' } : fs.existsSync(plist) ? { ...rectsFromPlist(plist), via: 'plist' } : { ...rectsFromGutters(atlas), via: 'gutters' };
  // Canvas = largest source size; frames centered (Godot AnimatedSprite convention) when sizes differ.
  const CW = Math.max(...meta.rects.map((r) => r.sw)), CH = Math.max(...meta.rects.map((r) => r.sh));
  const frames = meta.rects.map((r) => {
    const c = newImg(CW, CH);
    blit(atlas, r.x, r.y, r.w, r.h, c, ((CW - r.sw) >> 1) + r.ox, ((CH - r.sh) >> 1) + r.oy);
    return c;
  });
  const boxes = frames.map(bbox);
  if (boxes.some((b) => !b)) throw new Error('empty idle frame');
  const box = [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])), Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))];
  return { frames, box, anim: meta.anim, via: meta.via };
}

// Port of art.add_outline: ring = dilate(alpha>=32, 3x3 | 5x5) minus (alpha>0); fill only empty pixels.
function addOutline(cell, selected) {
  const { width: W, height: H, data } = cell, r = selected ? 2 : 1;
  const color = selected ? [255, 225, 102, 255] : [255, 248, 226, 235];
  const out = { width: W, height: H, data: Buffer.from(data) };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3]) continue;
    let hit = false;
    for (let dy = -r; dy <= r && !hit; dy++) for (let dx = -r; dx <= r; dx++) {
      const X = x + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < W && Y < H && data[(Y * W + X) * 4 + 3] >= 32) { hit = true; break; }
    }
    if (hit) color.forEach((v, i) => { out.data[(y * W + x) * 4 + i] = v; });
  }
  for (let i = 0; i < W; i++) if (out.data[i * 4 + 3] || out.data[((H - 1) * W + i) * 4 + 3]) throw new Error('outline clipped top/bottom');
  for (let j = 0; j < H; j++) if (out.data[j * W * 4 + 3] || out.data[(j * W + W - 1) * 4 + 3]) throw new Error('outline clipped left/right');
  return out;
}

function build(source) {
  const { frames, box, anim, via } = extract(source);
  const bw = box[2] - box[0], bh = box[3] - box[1];
  const scale = Math.min(92 / bw, 82 / bh);
  const sw = Math.round(bw * scale), sh = Math.round(bh * scale);
  const strip = newImg(100 * frames.length, 112), sel = newImg(100 * frames.length, 112);
  let still = null;
  frames.forEach((f, i) => {
    const cell = newImg(100, 112), ox = (100 - sw) >> 1, oy = 104 - sh;
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const sx = box[0] + Math.floor((x + 0.5) * bw / sw), sy = box[1] + Math.floor((y + 0.5) * bh / sh);
      const si = (sy * f.width + sx) * 4, di = ((oy + y) * 100 + ox + x) * 4;
      f.data.copy(cell.data, di, si, si + 4);
    }
    const s = addOutline(cell, true), n = addOutline(cell, false);
    if (!bbox(n)) throw new Error('empty cell');
    blit(n, 0, 0, 100, 112, strip, 100 * i, 0);
    blit(s, 0, 0, 100, 112, sel, 100 * i, 0);
    if (!still) still = n;
  });
  return { strip, sel, still, frames: frames.length, anim, via, box, size: [sw, sh] };
}

const writePng = (p, img) => { const png = new PNG({ width: img.width, height: img.height }); img.data.copy(png.data); fs.writeFileSync(p, PNG.sync.write(png)); };

function main() {
  const manifestPath = path.join(OUT, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^﻿/, ''));
  const written = [], skipped = [], cache = {};
  for (const [uid, spec] of Object.entries(MAPPING)) {
    let result = null, source = null, err = [];
    for (const s of [].concat(spec)) {
      try { result = cache[s] || (cache[s] = build(s)); source = s; break; } catch (e) { err.push(`${s}: ${e.message}`); }
    }
    if (!result) { skipped.push({ uid, reason: err.join('; ') }); continue; }
    writePng(path.join(OUT, uid + '.png'), result.strip);
    writePng(path.join(OUT, uid + '-still.png'), result.still);
    writePng(path.join(OUT, uid + '-selected.png'), result.sel);
    manifest.units[uid] = { image: uid + '.png', still: uid + '-still.png', selectedImage: uid + '-selected.png', frames: result.frames,
      durationMs: Math.max(800, Math.round(result.frames * 1000 / 12)), width: 100, height: 112, source };
    written.push({ uid, source, frames: result.frames, anim: result.anim, via: result.via, size: result.size.join('x') });
  }
  for (const [alias, target] of Object.entries(ALIASES)) {
    if (manifest.units[target]) { manifest.units[alias] = { ...manifest.units[target] }; written.push({ uid: alias, alias: target }); }
    else skipped.push({ uid: alias, reason: 'alias target missing: ' + target });
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ written, skipped }, null, 1));
}
main();
