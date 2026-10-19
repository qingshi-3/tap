import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = "D:/godot/rpg";
const outputDir = path.join(projectRoot, "dist", "assets", "units");

const units = {
  boss_kron: {
    readableName: "裂垒执锤者",
    role: "boss",
    sourceIdentity: "neutral/首领_克隆",
    sourceDir: "neutral/首领_克隆",
    image: "boss_kron.png",
    renderSize: 150,
    authoredSize: true,
    animationAliases: { move: ["run"], death: ["death", "defeated"] },
  },
  boss_cindera: {
    readableName: "烬环织焰者",
    role: "boss",
    sourceIdentity: "neutral/首领_辛德拉",
    sourceDir: "neutral/首领_辛德拉",
    image: "boss_cindera.png",
    renderSize: 175,
    authoredSize: true,
    animationAliases: { move: ["run"], death: ["death", "defeated"] },
  },
  neutral_golemstone: {
    readableName: "护炉卫",
    role: "mechanism elite",
    sourceIdentity: "neutral/中立_魔像石",
    sourceDir: "neutral/中立_魔像石",
    image: "neutral_golemstone.png",
    renderSize: 116,
    authoredSize: true,
    animationAliases: { move: ["run"], death: ["death", "defeated"] },
  },
  f2_flareslinger: {
    readableName: "封路炮手",
    role: "mechanism elite",
    sourceIdentity: "岚影诸派/f2_异界Flareslinger",
    sourceDir: "岚影诸派/f2_异界Flareslinger",
    image: "f2_flareslinger.png",
    renderSize: 152,
    authoredSize: true,
    animationAliases: { move: ["run"], death: ["death", "defeated"] },
  },
  neutral_monsterexplodingdemon: {
    readableName: "蓄爆甲虫",
    role: "mechanism elite",
    sourceIdentity: "neutral/中立_怪物Exploding恶魔_monsterexplodingdemon",
    sourceDir: "neutral/中立_怪物Exploding恶魔_monsterexplodingdemon",
    image: "neutral_monsterexplodingdemon.png",
    renderSize: 116,
    authoredSize: true,
    animationAliases: { move: ["run"], death: ["death", "defeated"] },
  },
  base_commander: {
    readableName: "白银守卫侍从",
    role: "base hero",
    sourceIdentity: "莱昂纳王国/f1_白银守卫侍从",
    sourceDir: "莱昂纳王国/f1_白银守卫侍从",
    image: "f1_silverguardsquire.png",
    renderSize: 116,
    animationAliases: { move: ["run"], cast: ["attack"], hit: ["damage", "hurt"] },
  },
  base_summoner: {
    readableName: "深渊塞壬",
    role: "base hero",
    sourceIdentity: "深渊军团/f4_异界Siren",
    sourceDir: "深渊军团/f4_异界Siren",
    image: "f4_siren.png",
    renderSize: 108,
    animationAliases: { move: ["run"], cast: ["attack"], hit: ["damage", "hurt"] },
  },
  base_blink: {
    readableName: "岚影环刃士",
    role: "base hero",
    sourceIdentity: "岚影诸派/f2_Keshraifan刃",
    sourceDir: "岚影诸派/f2_Keshraifan刃",
    image: "f2_keshraifanblade.png",
    renderSize: 110,
    animationAliases: { move: ["run"], cast: ["attack"], hit: ["damage", "hurt"] },
  },
  base_mage: {
    readableName: "银发元素法师",
    role: "base hero",
    sourceIdentity: "霜原部盟/f6_将军",
    sourceDir: "霜原部盟/f6_将军",
    image: "f6_general.png",
    renderSize: 104,
    animationAliases: { move: ["run"], cast: ["attack"], hit: ["damage", "hurt"] },
  },
  general_swift: {
    readableName: "风刃剑士",
    role: "advanced hero",
    sourceIdentity: "莱昂纳王国/f1_风刃指挥官",
    sourceDir: "莱昂纳王国/f1_风刃指挥官",
    image: "f1_windbladecommander.png",
    renderSize: 120,
    animationAliases: { move: ["run"], cast: ["attack"], hit: ["damage", "hurt"] },
  },
  general_commander: {
    readableName: "金刃统帅",
    role: "general",
    sourceIdentity: "莱昂纳王国/f1_将军",
    sourceDir: "莱昂纳王国/f1_将军",
    image: "f1_general.png",
  },
  general_summoner: {
    readableName: "紫晶魔将",
    role: "general",
    sourceIdentity: "深渊军团/f4_将军",
    sourceDir: "深渊军团/f4_将军",
    image: "f4_general.png",
  },
  general_blink: {
    readableName: "赤影双镰统帅",
    role: "general",
    sourceIdentity: "岚影诸派/f2_将军",
    sourceDir: "岚影诸派/f2_将军",
    image: "f2_general.png",
  },
  general_mage: {
    readableName: "冰翼元素贤者",
    role: "general",
    sourceIdentity: "霜原部盟/f6_二阶将军",
    sourceDir: "霜原部盟/f6_二阶将军",
    image: "f6_tier2general.png",
    renderSize: 182,
  },
  hero: {
    readableName: "风刃指挥官",
    sourceIdentity: "莱昂纳王国/f1_风刃指挥官",
    sourceDir: "莱昂纳王国/f1_风刃指挥官",
    image: "f1_windbladecommander.png",
  },
  hero_duelist: {
    readableName: "岚影双刃将军",
    sourceIdentity: "岚影诸派/f2_将军",
    sourceDir: "岚影诸派/f2_将军",
    image: "f2_general.png",
  },
  hero_mage: {
    readableName: "星砂沙丘术士",
    sourceIdentity: "星砂圣庭/f3_Dune施法者",
    sourceDir: "星砂圣庭/f3_Dune施法者",
    image: "f3_dunecaster.png",
  },
  grunt: {
    readableName: "深渊爬行者",
    sourceIdentity: "深渊军团/f4_异界Crawler",
    sourceDir: "深渊军团/f4_异界Crawler",
    image: "f4_crawler.png",
  },
  runner: {
    readableName: "深渊暗影舞者",
    sourceIdentity: "深渊军团/f4_暗影Dancer",
    sourceDir: "深渊军团/f4_暗影Dancer",
    image: "f4_shadowdancer.png",
  },
  brute: {
    readableName: "冥界蛮兵",
    sourceIdentity: "深渊军团/f4_异界Underworldbrute",
    sourceDir: "深渊军团/f4_异界Underworldbrute",
    image: "f4_underworldbrute.png",
  },
  guard_basic: {
    readableName: "白银守卫侍从",
    role: "guard",
    sourceIdentity: "莱昂纳王国/f1_白银守卫侍从",
    sourceDir: "莱昂纳王国/f1_白银守卫侍从",
    image: "f1_silverguardsquire.png",
  },
  scout_basic: {
    readableName: "岚影远程兵",
    role: "ranged",
    sourceIdentity: "岚影诸派/f2_远程兵",
    sourceDir: "岚影诸派/f2_远程兵",
    image: "f2_ranged.png",
  },
  healer_basic: {
    readableName: "莱昂纳修女",
    role: "healer",
    sourceIdentity: "莱昂纳王国/f1_修女",
    sourceDir: "莱昂纳王国/f1_修女",
    image: "f1_sister.png",
  },
  archer_elite: {
    readableName: "佣兵射手",
    role: "ranged",
    sourceIdentity: "neutral/中立_佣兵Ranged1",
    sourceDir: "neutral/中立_佣兵Ranged1",
    image: "neutral_mercranged1.png",
  },
  guard_elite: {
    readableName: "青鳞重装兵",
    role: "guard",
    sourceIdentity: "青鳞萨盟/f5_重装兵",
    sourceDir: "青鳞萨盟/f5_重装兵",
    image: "f5_tank.png",
  },
  healer_elite: {
    readableName: "治疗秘术师",
    role: "healer",
    sourceIdentity: "neutral/中立_异界Healingmystic",
    sourceDir: "neutral/中立_异界Healingmystic",
    image: "neutral_healingmystic.png",
  },
};

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

await mkdir(outputDir, { recursive: true });
const output = {};
const sourceRows = [];

for (const [key, unit] of Object.entries(units)) {
  const assetDir = path.join(sourceRoot, "assets", "battle", "units", unit.sourceDir);
  const visualDir = path.join(sourceRoot, "resource", "battle", "units", unit.sourceDir);
  const framesPath = path.join(assetDir, "frames.tres");
  const visualPath = path.join(visualDir, "visual.tres");
  const imagePath = path.join(assetDir, unit.image);
  const [framesText, visualText, png] = await Promise.all([
    readFile(framesPath, "utf8"),
    readFile(visualPath, "utf8"),
    readFile(imagePath),
  ]);
  const animations = parseSpriteFrames(framesText, framesPath);
  const pngInfo = readPngInfo(png, imagePath);
  for (const animation of Object.values(animations)) for (const frame of animation.frames) {
    if (frame.x < 0 || frame.y < 0 || frame.w <= 0 || frame.h <= 0 || frame.x + frame.w > pngInfo.width || frame.y + frame.h > pngInfo.height) throw new Error(`Atlas frame out of bounds: ${key}`);
  }
  const destination = path.join(outputDir, `${key}.png`);
  await copyFile(imagePath, destination);
  const copiedInfo = readPngInfo(await readFile(destination), destination);
  if (copiedInfo.sha256 !== pngInfo.sha256) throw new Error(`Copy hash mismatch: ${key}`);
  output[key] = {
    src: `./assets/units/${key}.png`,
    readableName: unit.readableName,
    ...(unit.role ? { role: unit.role } : {}),
    sourceIdentity: unit.sourceIdentity,
    sourceSha256: pngInfo.sha256,
    ...(unit.renderSize ? { renderSize: unit.renderSize } : {}),
    ...(unit.authoredSize ? { authoredSize: true } : {}),
    ...(unit.animationAliases ? { animationAliases: unit.animationAliases } : {}),
    anchor: parseAnchor(visualText, animations, visualPath),
    animations,
  };
  sourceRows.push({ key, unit, pngInfo, animations: Object.keys(animations) });
}

const moduleText = `// Generated by tools/extract-assets.mjs from the read-only Godot source.\nexport const unitAssets = ${JSON.stringify(output, null, 2)};\n`;
await writeFile(path.join(projectRoot, "dist", "assets.js"), moduleText, "utf8");

const documentedRows = sourceRows.filter(({ key, unit }) => key.startsWith("hero") || unit.role);
const lines = [
  "# General, hero, and recruit unit assets",
  "",
  "These base heroes, advanced generals, legacy heroes, enemies, and recruits are unmodified copies from the read-only local `D:/godot/rpg` project. Base professions use the four base_* keys; the five advanced appearances use general_* keys. This is this game's authored profession grading, not an official Duelyst evolution tree. The existing enemy and legacy keys remain available.",
  "",
  "| Game key | Readable name | Role | Source identity | Source PNG | Export PNG | Source SHA-256 | Atlas size | Render size | Transparency | Animation aliases | Animations |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...documentedRows.map(({ key, unit, pngInfo, animations }) =>
    `| ${key} | ${unit.readableName} | ${unit.role ?? "hero"} | \`${unit.sourceIdentity}\` | \`${unit.image}\` | \`assets/units/${key}.png\` | \`${pngInfo.sha256}\` | ${pngInfo.width}×${pngInfo.height} | ${unit.renderSize ?? "renderer default"} | ${pngInfo.hasTransparency ? "PNG alpha/transparency" : "none detected"} | ${unit.animationAliases ? Object.entries(unit.animationAliases).map(([name, aliases]) => `${name}→${aliases.join("/")}`).join(", ") : "none"} | ${animations.join(", ")} |`
  ),
  "",
  "The frame rectangles, animation speeds, loop flags, and per-frame duration multipliers in `dist/assets.js` are parsed from each source `frames.tres`. The normalized anchor is derived from the matching `visual.tres` Offset and Scale relative to an animation frame. The source `cast` and `attack` animations are non-looping; `castloop` is a separate authored loop and must not replace `cast` for one-shot hero actions.",
  "",
];
await writeFile(path.join(projectRoot, "dist", "assets", "UNIQUE_UNITS.md"), lines.join("\n"), "utf8");

for (const row of sourceRows) {
  console.log(`${row.key}: ${row.pngInfo.width}x${row.pngInfo.height}; ${row.animations.join(", ")}`);
}
