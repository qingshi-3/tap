import { mkdir, cp, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const source =
  process.env.PIXELFX_ROOT ??
  "C:/Users/qs/Documents/ChatGPT/排队骑士/螺旋丸特效/pixelfx";
const round = Number(
  process.argv.find((x) => x.startsWith("--round="))?.split("=")[1] ?? 3,
);
if (![1, 2, 3].includes(round))
  throw Error("Use --round=1/2/3 for the reviewed adaptation iterations.");
const out = join(root, "dist/assets/adventure"),
  vendor = join(out, "vendor/pixelfx"),
  evidence = join(root, "output/adventure-fx", `round-${round}`);
await mkdir(evidence, { recursive: true });
await mkdir(join(vendor, "src/fx"), { recursive: true });
await cp(join(source, "src/core"), join(vendor, "src/core"), {
  recursive: true,
});
await cp(join(source, "LICENSE"), join(vendor, "LICENSE"));
const ids = [
  "lightning/chain-lightning",
  "arcane/arcane-beam",
  "shadow/black-hole",
  "fire/meteor",
];
for (const id of ids) {
  const category = id.split("/")[0];
  await mkdir(join(vendor, "src/fx", category), { recursive: true });
  for (const file of [`${id}.js`, `${category}/_lib.js`])
    await cp(join(source, "src/fx", file), join(vendor, "src/fx", file));
}
// Preserve original source alongside this explicit single-segment adapter. Real game nodes are supplied by the timeline.
const chainSource = await readFile(
  join(vendor, "src/fx/lightning/chain-lightning.js"),
  "utf8",
);
const adapted = chainSource
  .replace("size: [248, 104]", "size: [184, 96]")
  .replace("origin: [40, 82]", "origin: [28, 48]")
  .replace(
    "const HAND = [10, -16], HOPS = [[58, -22], [104, -30], [150, -19]];",
    "const HAND = [0, 0], HOPS = [[120, 0]];",
  );
if (adapted === chainSource || !adapted.includes("HOPS = [[120, 0]]"))
  throw Error("Upstream chain format changed; review adaptation.");
await writeFile(join(vendor, "src/fx/lightning/adventure-chain.js"), adapted);
const { loadEffect, renderFrames, contactSheet, spriteSheet } = await import(
  pathToFileURL(join(source, "tools/lib/fxlib.mjs")).href
);
const specs = [
  {
    key: "chain",
    id: "lightning/adventure-chain",
    duration: 480,
    pivot: [28, 48],
    end: [148, 48],
    sourceDuration: 1.3,
  },
  {
    key: "beam",
    id: "arcane/arcane-beam",
    duration: 850,
    pivot: [41, 60],
    end: [209, 60],
    sourceDuration: 1.2,
  },
  {
    key: "gravity",
    id: "shadow/black-hole",
    duration: 1000,
    pivot: [92, 54],
    sourceDuration: 4,
  },
  {
    key: "meteor",
    id: "fire/meteor",
    duration: 1500,
    pivot: [150, 208],
    hitAt: 540,
    sourceDuration: round === 1 ? 5 : round === 2 ? 3.5 : 3,
  },
];
const manifest = {
  version: 1,
  round,
  fps: 24,
  sheets: {},
  source: "pixelfx / Hugo Duprez + patch-gg, MIT",
};
for (const spec of specs) {
  const fx = await loadEffect(spec.id, join(vendor, "src/fx"));
  const raw = renderFrames(fx, {
    fps: 24,
    actor: false,
    bg: "dark",
    options: { light: round === 1 ? 1 : round === 2 ? 0.72 : 0.65 },
  });
  const n = Math.ceil((spec.duration / 1000) * 24),
    frames = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1),
      ms = t * spec.duration;
    let sourceTime =
      spec.key === "meteor"
        ? ms <= spec.hitAt
          ? (ms / spec.hitAt) * 0.62
          : 0.62 +
            ((ms - spec.hitAt) / (spec.duration - spec.hitAt)) *
              (spec.sourceDuration - 0.62)
        : t * spec.sourceDuration;
    if (
      round === 3 &&
      spec.key === "meteor" &&
      i === Math.round((spec.hitAt / spec.duration) * (n - 1))
    )
      sourceTime = 0.62;
    const frame =
      raw.frames[
        Math.min(raw.frames.length - 1, Math.round(sourceTime * raw.fps))
      ];
    const clear = frame.clear.slice();
    const alpha = round === 1 ? 1 : Math.min(1, t / 0.08, (1 - t) / 0.22);
    for (let j = 3; j < clear.length; j += 4)
      clear[j] = Math.round(clear[j] * Math.max(0, alpha));
    // Contact frames use the same transparent output over a quiet navy board surrogate.
    const color = clear.slice();
    for (let j = 0; j < clear.length; j += 4) {
      const a = clear[j + 3] / 255;
      color[j] = Math.round(clear[j] * a + 12 * (1 - a));
      color[j + 1] = Math.round(clear[j + 1] * a + 23 * (1 - a));
      color[j + 2] = Math.round(clear[j + 2] * a + 32 * (1 - a));
      color[j + 3] = 255;
    }
    frames.push({ t: ms / 1000, clear, color });
  }
  const rendered = { w: raw.w, h: raw.h, fps: 24, n: frames.length, frames };
  await writeFile(
    join(evidence, `${spec.key}-contact.png`),
    contactSheet(fx, rendered, {
      max: 12,
      width: 1100,
      zoom: 1,
      title: `${spec.key} / round ${round} / game timing`,
    }),
  );
  const parts = spec.key === "gravity" ? ["back", "front"] : ["full"];
  for (const part of parts) {
    const name = spec.key + (part === "full" ? "" : `-${part}`);
    let r = rendered;
    if (part !== "full") {
      r = {
        ...rendered,
        frames: frames.map((frame) => {
          const clear = frame.clear.slice();
          for (let y = 0; y < raw.h; y++)
            for (let x = 0; x < raw.w; x++)
              if (y < spec.pivot[1] !== (part === "back"))
                clear[(y * raw.w + x) * 4 + 3] = 0;
          return { ...frame, clear };
        }),
      };
    }
    const sheet = spriteSheet(fx, r, name);
    await writeFile(join(out, `${name}.png`), sheet.png);
    await writeFile(join(out, `${name}.json`), JSON.stringify(sheet.json));
    manifest.sheets[name] = {
      image: `./assets/adventure/${name}.png`,
      width: r.w,
      height: r.h,
      columns: sheet.json.meta.pixelfx.columns,
      frames: r.n,
      duration: spec.duration,
      pivot: spec.pivot,
      ...(spec.end ? { end: spec.end } : {}),
      ...(spec.hitAt ? { hitAt: spec.hitAt } : {}),
    };
  }
  console.log(`Rendered ${spec.key} round${round}, ${n} frames`);
}
await writeFile(
  join(out, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
await writeFile(
  join(out, "SOURCES.md"),
  "# Adventure battle effects\n\nSource: `C:/Users/qs/Documents/ChatGPT/排队骑士/螺旋丸特效/pixelfx/`, MIT (retained at `vendor/pixelfx/LICENSE`). Original four effects, category helper files and core retained unchanged; `adventure-chain.js` explicitly adapts the three demonstration hops to one segment for actual game coordinates. `tools/build-adventure-fx.mjs` uses the original pixelfx renderFrames/contactSheet/spriteSheet tools, 24fps transparent pre-rendered atlases. Black-hole atlas is split at its center into far/back and near/front halves. Meteor impact is remapped from original0.62s to authored540ms; scene speed applies uniformly. No source actor, demonstration target, source act hit count, or particle is a gameplay authority.\n",
);
await writeFile(
  join(evidence, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
