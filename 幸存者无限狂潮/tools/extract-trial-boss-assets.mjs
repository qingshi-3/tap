import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = "D:/godot/rpg";
const manifest = path.join(root, "dist/assets.js");
const { unitAssets } = await import(pathToFileURL(manifest).href);
const units = [
 ["trial_commander", "符盾守门人", "中立_Primus盾牌大师", "neutral_primusshieldmaster", 170],
 ["trial_swift", "荒刃猎豹", "首领_沙地豹", "boss_sandpanther", 174],
 ["trial_summoner", "唤魂祭司", "首领_怨魂", "boss_wraith", 186],
 ["trial_blink", "折空环使", "首领_奥里亚斯", "boss_orias", 182],
 ["trial_mage", "涡流法尊", "首领_噬法者", "boss_spelleater", 184],
];
// Same Godot SpriteFrames/anchor parser as extract-assets.mjs; add only five reviewed trial units.
function parseSpriteFrames(source, sourcePath) {
  const regions = new Map();
  const regionPattern = /\[sub_resource type="AtlasTexture" id="([^"]+)"\][\s\S]*?region\s*=\s*Rect2\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/g;
  for (const match of source.matchAll(regionPattern)) {
    regions.set(match[1], {
      x: Number(match[2]),
      y: Number(match[3]),
      w: Number(match[4]),
      h: Number(match[5]),
    });
  }

  const animations = {};
  const animationPattern = /"frames"\s*:\s*\[([\s\S]*?)\]\s*,\s*"loop"\s*:\s*(true|false)\s*,\s*"name"\s*:\s*&"([^"]+)"\s*,\s*"speed"\s*:\s*([\d.-]+)/g;
  for (const match of source.matchAll(animationPattern)) {
    const frames = [];
    const framePattern = /"duration"\s*:\s*([\d.-]+)\s*,\s*"texture"\s*:\s*SubResource\("([^"]+)"\)/g;
    for (const frameMatch of match[1].matchAll(framePattern)) {
      const region = regions.get(frameMatch[2]);
      if (!region) throw new Error(`Missing ${frameMatch[2]} in ${sourcePath}`);
      frames.push({ ...region, duration: Number(frameMatch[1]) });
    }
    if (!frames.length) throw new Error(`Animation ${match[3]} has no frames in ${sourcePath}`);
    animations[match[3]] = {
      fps: Number(match[4]),
      loop: match[2] === "true",
      frames,
    };
  }
  if (!regions.size || !Object.keys(animations).length) {
    throw new Error(`Could not parse SpriteFrames from ${sourcePath}`);
  }
  return animations;
}

function parseAnchor(source, animations, sourcePath) {
  const offset = source.match(/Offset\s*=\s*Vector2\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/);
  const scale = source.match(/Scale\s*=\s*Vector2\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/);
  const referenceFrame = animations.idle?.frames[0] ?? Object.values(animations)[0].frames[0];
  if (!offset || !scale || !referenceFrame) throw new Error(`Could not derive anchor from ${sourcePath}`);
  return {
    x: Number((0.5 - Number(offset[1]) / (referenceFrame.w * Number(scale[1]))).toFixed(4)),
    y: Number((0.5 - Number(offset[2]) / (referenceFrame.h * Number(scale[2]))).toFixed(4)),
  };
}

function readPngInfo(buffer, sourcePath) {
  if (buffer.toString("ascii", 1, 4) !== "PNG") throw new Error(`Not a PNG: ${sourcePath}`);
  const colorType = buffer[25];
  const hasTransparency = colorType === 4 || colorType === 6 || buffer.includes(Buffer.from("tRNS"));
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    hasTransparency,
    sha256: createHash("sha256").update(buffer).digest("hex").toUpperCase(),
  };
}

const evidence = [];
await mkdir(path.join(root, "output/trial-bosses/assets"), { recursive: true });
for (const [key, readableName, dir, sourceId, renderSize] of units) {
 const sourceDir = `neutral/${dir}`;
 const assetDir = path.join(sourceRoot, "assets/battle/units", sourceDir);
 const pngPath = path.join(assetDir, `${sourceId}.png`);
 const framesPath = path.join(assetDir, "frames.tres");
 const visualPath = path.join(sourceRoot, "resource/battle/units", sourceDir, "visual.tres");
 const png = await readFile(pngPath);
 const info = readPngInfo(png, pngPath);
 const animations = parseSpriteFrames(await readFile(framesPath, "utf8"), framesPath);
 for (const animation of Object.values(animations)) for (const frame of animation.frames) {
  if (frame.x < 0 || frame.y < 0 || frame.w <= 0 || frame.h <= 0 || frame.x + frame.w > info.width || frame.y + frame.h > info.height) throw new Error(`Out of bounds frame: ${key}`);
 }
 for (const name of ["idle", "attack", "run", "hit", "death"]) if (!animations[name]) throw new Error(`Missing ${name}: ${key}`);
 const dest = path.join(root, "dist/assets/units", `${key}.png`);
 await copyFile(pngPath, dest);
 if (readPngInfo(await readFile(dest), dest).sha256 !== info.sha256) throw new Error(`Copy mismatch: ${key}`);
 unitAssets[key] = { src: `./assets/units/${key}.png`, readableName, role: "profession trial boss", sourceIdentity: sourceDir, sourceSha256: info.sha256, renderSize, authoredSize: true, animationAliases: { move: ["run"], cast: ["attack"] }, anchor: parseAnchor(await readFile(visualPath, "utf8"), animations, visualPath), animations };
 evidence.push({ key, readableName, sourceId, sourcePng: pngPath, sourceFrames: framesPath, sourceVisual: visualPath, exportPng: dest, ...info, bytes: png.length, anchor: unitAssets[key].anchor, actions: Object.fromEntries(Object.entries(animations).map(([name, a]) => [name, { frames: a.frames.length, fps: a.fps, loop: a.loop }])) });
}
await writeFile(manifest, `// Generated base units and reviewed familiars; trial units added by tools/extract-trial-boss-assets.mjs.\nexport const unitAssets = ${JSON.stringify(unitAssets, null, 2)};\n`);
await writeFile(path.join(root, "output/trial-bosses/assets/manifest.json"), JSON.stringify(evidence, null, 2) + "\n");
const docsPath = path.join(root, "dist/assets/SOURCES.md");
let docs = await readFile(docsPath, "utf8");
const marker = "## 五职业试炼 Boss 素材（2026-10-12）";
if (docs.includes(marker)) docs = docs.slice(0, docs.indexOf(marker)).trimEnd();
const rows = evidence.map(e => `| ${e.key} | ${e.readableName} | ${e.sourcePng} | ${e.sha256} | ${e.width}×${e.height} | ${Object.entries(e.actions).map(([k,v])=>`${k}:${v.frames}`).join(", ")} |`).join("\n");
await writeFile(docsPath, docs + `\n\n${marker}\n\n原样复制只读 D:/godot/rpg 项目中的五份 Duelyst 单位PNG；商业使用授权沿用工作区已确认素材授权。依 Story 视觉分析记录并亲看 idle、attack 四分位、run 实际帧后选型。保持源动作、速度、循环标志、帧时长与 visual.tres 锚点；cast仅别名映射原 attack，无伪造传送/召唤动作。\n\n| 游戏key | 原创名 | 原PNG路径 | SHA-256 | 图集尺寸 | 动作与帧数 |\n| --- | --- | --- | --- | --- | --- |\n${rows}\n\n符盾守门人：黑金重甲和青蓝符文盾，盾面膨胀后横纵弧击；荒刃猎豹：人形上身、豹形下身、绿刃长尾，跃身甩尾；唤魂祭司：白衣人形与紫色灵兽共生，举臂唤起灵浪；折空环使：悬浮灰身、青晶片、同心环施法；涡流法尊：橙发袍者被蓝环流包裹，扩张旋涡。按这些实际动作配机制，不把来源名称当作行为证据。\n\n复现：基础/随从提取后运行 tools/extract-trial-boss-assets.mjs，只追加5个trial_*条目与图片，不重生成已有PNG。输出精确来源、哈希、尺寸、字节数、动作参数见 output/trial-bosses/assets/manifest.json；亲看接触表 candidates.png。新增原图共 ${evidence.reduce((n,e)=>n+e.bytes,0)} 字节。\n`);
console.log(evidence.map(e => `${e.key}: ${e.bytes} bytes; ${Object.keys(e.actions).join(", ")}`).join("\n"));
