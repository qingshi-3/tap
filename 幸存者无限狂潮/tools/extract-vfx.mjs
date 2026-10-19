import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.resolve(
  "C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main/app/resources/fx",
);
const outputRoot = path.join(projectRoot, "dist/assets/vfx");
const metadataPath = path.join(projectRoot, "dist/vfx-assets.js");

const selections = {
  shockNoise: { source: "fx_radial_bluenoise", fps: 22, loop: false, prefixes: ["fx_radial_bluenoise_"] },
  fireExplosion: { source: "fx_explosionorangesmoke", fps: 24, loop: false, prefixes: ["fx_explosionorangesmoke_"] },
  fireImpact: { source: "fx_fireimpact", fps: 20, loop: false, prefixes: ["fx_fireimpact_"] },
  fireGround: { source: "fx_firefallground", fps: 10, loop: true, prefixes: ["fx_firefallground_"] },
  flameCore: { source: "fx_flamesphere", fps: 18, loop: false, prefixes: ["fx_flamesphere_"] },
  poisonCloud: { source: "fx_smoke2", fps: 8, loop: true, activeRange: [1,7], prefixes: ["fx_smokeground_"] },
  whiteSpark: { source: "fx_smoke", fps: 24, loop: false, prefixes: ["fx_explosionwhitesmokemedium_"] },
  heal: { source: "fx_heal", fps: 18, loop: false, prefixes: ["fx_heal_"] },
  hitImpact: { source: "fx_impactred", fps: 24, loop: false, prefixes: ["fx_impactredmedium_"] },
  blinkSeal: { source: "fx_shadowcreep", fps: 6, loop: true, prefixes: ["fx_shadowcreep_idle_"] },
  blinkPhase: { source: "fx_teleportblueorb", fps: 24, loop: false, prefixes: ["fx_teleportblueorb_"] },
  shield: { source: "fx_distortion_hex_shield", fps: 8, loop: true, activeRange: [1,6], prefixes: ["distortion_hex_shield_"] },
  familiar: { source: "fx_teleportblueorb", fps: 12, loop: true, activeRange: [5,12], prefixes: ["fx_teleportblueorb_"] },
  tesla: { source: "fx_beamtesla", fps: 22, loop: true, activeRange: [16,29], prefixes: ["fx_beamtesla_"] },
  beam: { source: "fx_beamlaser", fps: 24, loop: true, activeRange: [10,26], prefixes: ["fx_beamlaser_"] },
  vortex: { source: "fx_vortexswirl", fps: 14, loop: true, activeRange: [6,33], prefixes: ["fx_vortexswirl_"] },
  summon: { source: "fx_summonlegendary", fps: 16, loop: false, prefixes: ["fx_summonlegendary_"] },
  magicBolt: {
    source: "fx_f1_casterprojectile", fps: 16, loop: true,
    frameNames: [
      "fx_f1casterprojectile_002.png",
      "fx_f1casterprojectile_003.png",
      "fx_f1casterprojectile_004.png",
    ],
  },
  magicImpact: { source: "fx_impactblue", fps: 18, loop: false, prefixes: ["fx_impactbluebig_"] },
  dash: { source: "fx_f2_teleport", fps: 16, loop: false, prefixes: ["fx_f2_teleport_"] },
  cleave: { source: "fx_crossslash", fps: 18, loop: false, prefixes: ["fx_crossslash_"] },
  swordField: { source: "fx_bladestorm", fps: 16, loop: false, prefixes: ["fx_bladestorm_"] },
  frost: {
    source: "f6_flashfreeze", fps: 18, loop: false,
    prefixes: ["f6_flashfreeze_appear_", "f6_flashfreeze_disappear_"],
  },
  bossCleave: { source: "fx_fireslash", fps: 22, loop: false, prefixes: ["fx_fireslash_"] },
  bossCharge: {
    source: "f5_fx_flamingstampede", fps: 28, loop: false,
    prefixes: ["f5_fx_flamingstampede_"],
  },
  bossSlam: {
    source: "fx_f3_cataclysmicfault", fps: 30, loop: false,
    prefixes: ["fx_f3_cataclysmicfault_"],
  },
};

function decodeXml(value) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function values(raw) {
  const numbers = raw.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  if (!numbers) throw new Error(`Cannot parse plist geometry: ${raw}`);
  return numbers;
}

function naturalCompare(left, right) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function parseFrames(xml, sourceName, selection) {
  const framesSection = xml.match(/<key>frames<\/key>\s*<dict>([\s\S]*?)<\/dict>\s*<key>metadata<\/key>/)?.[1];
  if (!framesSection) throw new Error(`Missing frames dictionary in ${sourceName}.plist`);

  const entryPattern = /<key>([^<]+\.png)<\/key>\s*<dict>([\s\S]*?)<\/dict>/g;
  const entries = [];
  for (const match of framesSection.matchAll(entryPattern)) {
    const name = decodeXml(match[1]);
    const body = match[2];
    const field = (key) => body.match(new RegExp(`<key>${key}<\\/key>\\s*<string>([^<]+)<\\/string>`))?.[1];
    const frame = values(field("frame"));
    const sourceSize = values(field("sourceSize"));
    const sourceColorRectValue = field("sourceColorRect");
    const centerOffsetValue = field("offset");
    const rotated = /<key>rotated<\/key>\s*<true\s*\/>/.test(body);

    let offsetX;
    let offsetY;
    if (sourceColorRectValue) {
      [offsetX, offsetY] = values(sourceColorRectValue);
    } else if (centerOffsetValue) {
      // TexturePacker's offset is measured from the untrimmed frame centre.
      const [centerX, centerY] = values(centerOffsetValue);
      const drawnW = rotated ? frame[3] : frame[2];
      const drawnH = rotated ? frame[2] : frame[3];
      offsetX = (sourceSize[0] - drawnW) / 2 + centerX;
      offsetY = (sourceSize[1] - drawnH) / 2 - centerY;
    } else {
      offsetX = 0;
      offsetY = 0;
    }

    entries.push({
      name,
      frame: {
        x: frame[0], y: frame[1], w: frame[2], h: frame[3], rotated,
        sourceW: sourceSize[0], sourceH: sourceSize[1], offsetX, offsetY,
      },
    });
  }
  let selected;
  if (selection.frameNames) {
    const byName = new Map(entries.map((entry) => [entry.name, entry]));
    selected = selection.frameNames.map((name) => byName.get(name));
    const missing = selection.frameNames.filter((name, index) => !selected[index]);
    if (missing.length) throw new Error(`Missing frames in ${sourceName}.plist: ${missing.join(", ")}`);
  } else {
    selected = selection.prefixes.flatMap((prefix) => entries
      .filter((entry) => entry.name.startsWith(prefix))
      .sort((a, b) => naturalCompare(a.name, b.name)));
  }
  if (!selected.length) throw new Error(`No selected PNG frames found in ${sourceName}.plist`);
  return (selection.activeRange ? selected.slice(...selection.activeRange) : selected).map(({ frame }) => frame);
}

await mkdir(outputRoot, { recursive: true });
// Preserve separately authored/imported atlases outside this FX batch.
const { vfxAssets: existingAssets } = await import(pathToFileURL(metadataPath).href);
const assets = { ...existingAssets };
for (const [key, selection] of Object.entries(selections)) {
  const plistPath = path.join(sourceRoot, `${selection.source}.plist`);
  const sourcePng = path.join(sourceRoot, `${selection.source}.png`);
  const outputPng = path.join(outputRoot, `${key}.png`);
  const xml = await readFile(plistPath, "utf8");
  await copyFile(sourcePng, outputPng);
  assets[key] = {
    src: `assets/vfx/${key}.png`,
    fps: selection.fps,
    loop: selection.loop,
    frames: parseFrames(xml, selection.source, selection),
  };
}

const output = `// Generated by tools/extract-vfx.mjs from unmodified Duelyst texture atlases.\nexport const vfxAssets = ${JSON.stringify(assets, null, 2)};\n`;
await writeFile(metadataPath, output, "utf8");
console.log(`Wrote ${Object.keys(assets).length} VFX atlases to ${path.relative(projectRoot, outputRoot)}`);
