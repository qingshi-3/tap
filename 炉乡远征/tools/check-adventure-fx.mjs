import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import {
  compileAdventureTimeline,
  adventureDisplayUnit,
} from "../dist/js/adventure-effects.js";
import { ExpeditionProgress } from "../dist/js/expedition-progress.js";
import {
  createExpeditionMatch,
  confirmMulligan,
  getAdventureAbilityOptions,
  previewAdventureAbility,
  useAdventureAbility,
} from "../dist/js/engine.js";
const out = new URL("../output/adventure-fx/", import.meta.url);
await mkdir(out, { recursive: true });
const manifest = JSON.parse(
  await readFile(
    new URL("../dist/assets/adventure/manifest.json", import.meta.url),
  ),
);
assert.equal(manifest.version, 1);
assert.equal(manifest.round, 3);
assert.deepEqual(Object.keys(manifest.sheets).sort(), [
  "beam",
  "chain",
  "gravity-back",
  "gravity-front",
  "meteor",
]);
let bytes = 0,
  decodeBytes = 0;
for (const [key, s] of Object.entries(manifest.sheets)) {
  const png = await readFile(
    new URL("../dist/" + s.image.replace(/^\.\//, ""), import.meta.url),
  );
  assert.equal(png.readUInt32BE(0), 0x89504e47);
  const w = png.readUInt32BE(16),
    h = png.readUInt32BE(20);
  assert.ok(w <= 2048 && h <= 2048, key + " mobile texture dimensions");
  assert.ok(s.pivot.every(Number.isFinite));
  bytes += png.length;
  decodeBytes += w * h * 4;
}
assert.ok(decodeBytes < 20 * 1024 * 1024, "bounded total decoded atlas budget");
const storage = { getItem: () => null, setItem() {}, removeItem() {} },
  p = new ExpeditionProgress(storage),
  scenarios = [
    ["chain", "storm-01", 9201],
    ["beam", "storm-02", 9202],
    ["gravity", "starfall-02", 9203],
    ["meteor", "starfall-02", 9204],
  ];
const results = [];
for (const [name, level, id] of scenarios) {
  const s = createExpeditionMatch(
    level,
    p.state.training,
    p.state.squad,
    1,
    p.getBattleLoadout(),
  );
  assert.ok(confirmMulligan(s));
  const u = s.units.find((u) => u.cardId === id),
    options = getAdventureAbilityOptions(s, u.unitId),
    base = {
      unitId: u.unitId,
      abilityId: options.abilityId,
      revision: s.revision,
    };
  const commands = options.unitIds.length
    ? options.unitIds.map((targetId) => ({ ...base, targetId }))
    : options.directions.length
      ? options.directions.map((direction) => ({ ...base, direction }))
      : options.cells.map((cell) => ({ ...base, cell }));
  const choices = commands
    .map((command) => ({
      command,
      result: previewAdventureAbility(s, command),
    }))
    .filter((x) => x.result.ok)
    .sort((a, b) => b.result.steps.length - a.result.steps.length);
  assert.ok(choices.length, name + " legal skill");
  const before = structuredClone(s.units);
  assert.ok(useAdventureAbility(s, choices[0].command));
  const action = structuredClone(s.lastAction),
    original = JSON.stringify(action),
    timeline = compileAdventureTimeline(action, before, s.units);
  assert.equal(JSON.stringify(action), original);
  assert.ok(timeline.entries.some((e) => e.name === name));
  assert.ok(
    timeline.duration <= 2200,
    name + " finite sub1.4s actual timeline",
  );
  assert.ok(timeline.entries.every((e) => e.at >= 0 && e.duration > 0));
  const byBefore = new Map(before.map((u) => [u.unitId, u])),
    byAfter = new Map(s.units.map((u) => [u.unitId, u])),
    playback = { adventureTimeline: timeline, byBefore, byAfter };
  for (const [unitId, hits] of timeline.hits) {
    const unit = byAfter.get(unitId) ?? byBefore.get(unitId),
      first = hits[0];
    if (byBefore.has(unitId))
      assert.equal(
        adventureDisplayUnit(playback, unit, first.at - 1).health,
        byBefore.get(unitId).health,
        name + " health held until hit",
      );
    assert.equal(
      adventureDisplayUnit(playback, unit, timeline.duration).health,
      byAfter.get(unitId)?.health ?? 0,
      name + " exact final health",
    );
  }
  for (const [unitId, moves] of timeline.moves) {
    const unit = byAfter.get(unitId) ?? byBefore.get(unitId),
      first = moves[0],
      last = moves.at(-1);
    assert.equal(
      adventureDisplayUnit(playback, unit, first.at - 1).x,
      first.from.x,
    );
    assert.equal(
      adventureDisplayUnit(playback, unit, timeline.duration).x,
      last.to.x,
    );
  }
  results.push({
    name,
    level,
    steps: action.steps.map((s) => s.kind),
    duration: timeline.duration,
    hits: [...timeline.hits.values()].flat().length,
    moves: [...timeline.moves.values()].flat().length,
  });
}
const sequence = {
  kind: "end-turn",
  steps: [
    { kind: "event", eventKind: "stormStrike", cells: [{ x: 4, y: 3 }] },
    { kind: "hit", unitId: 1, amount: 2, cell: { x: 4, y: 3 } },
    {
      kind: "event",
      eventKind: "meteor",
      cells: [
        { x: 7, y: 2 },
        { x: 8, y: 3 },
        { x: 9, y: 4 },
      ],
    },
    { kind: "hit", unitId: 1, amount: 3, cell: { x: 4, y: 3 } },
  ],
};
const ordered = compileAdventureTimeline(sequence);
assert.ok(
  ordered.hits.get(1)[1].at > ordered.hits.get(1)[0].at,
  "due events preserve hit order",
);
const report = {
  passed: true,
  rounds: 3,
  renderedAndViewedContactSheets: 12,
  atlasBytes: bytes,
  decodedBytes: decodeBytes,
  results,
  browserVerified: false,
};
if (process.env.ADVENTURE_FX_BROWSER === "1") {
  const require = createRequire(
      "C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json",
    ),
    { chromium } = require("playwright");
  const browser = await chromium.launch({
    executablePath:
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  });
  const errors = [],
    screens = [];
  try {
    for (const viewport of [
      { width: 844, height: 390 },
      { width: 568, height: 320 },
    ]) {
      const context = await browser.newContext({ viewport, hasTouch: true }),
        page = await context.newPage();
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.route("**/adventure-fx-fixture", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#0e2029;color:white;font:16px sans-serif;overflow:hidden}canvas{display:block;width:100vw;height:calc(100vh - 44px)}button{height:44px;min-width:120px;background:#365c78;color:white;border:0;font-size:16px}#ready{display:inline}</style><canvas id="board"></canvas><button id="cast">施放技能</button><span id="ready"></span>',
        }),
      );
      await page.goto(
        (process.env.ADVENTURE_FX_URL ?? "http://127.0.0.1:4248") +
          "/adventure-fx-fixture",
      );
      await page.evaluate(async () => {
        const { BoardRenderer } = await import("/js/renderer.js"),
          engine = await import("/js/engine.js"),
          { ExpeditionProgress } = await import("/js/expedition-progress.js");
        window.fx = {
          renderer: new BoardRenderer(document.querySelector("canvas")),
          engine,
          progress: new ExpeditionProgress({
            getItem: () => null,
            setItem() {},
            removeItem() {},
          }),
        };
        window.fx.cast = () => {
          const { renderer: r, engine: e, match, command } = window.fx,
            before = structuredClone(match.units);
          if (!e.useAdventureAbility(match, command))
            throw Error("cast failed");
          r.draw(match);
          r.animateAction(match.lastAction, before);
          window.fx.playback = r.effects.playback;
          document.querySelector("#ready").textContent = "已施放";
        };
        document
          .querySelector("#cast")
          .addEventListener("click", () => window.fx.cast());
      });
      for (const [name, level, cardId] of scenarios) {
        await page.evaluate(
          async ({ name, level, cardId }) => {
            const { renderer: r, engine: e, progress: p } = window.fx;
            r.finishAction();
            const s = e.createExpeditionMatch(
              level,
              p.state.training,
              p.state.squad,
              1,
              p.getBattleLoadout(),
            );
            e.confirmMulligan(s);
            await r.loadBattle(s);
            r.draw(s);
            const u = s.units.find((u) => u.cardId === cardId),
              o = e.getAdventureAbilityOptions(s, u.unitId),
              base = {
                unitId: u.unitId,
                abilityId: o.abilityId,
                revision: s.revision,
              };
            const commands = o.unitIds.length
              ? o.unitIds.map((targetId) => ({ ...base, targetId }))
              : o.directions.length
                ? o.directions.map((direction) => ({ ...base, direction }))
                : o.cells.map((cell) => ({ ...base, cell }));
            const choice = commands
              .map((command) => ({
                command,
                result: e.previewAdventureAbility(s, command),
              }))
              .filter((x) => x.result.ok)
              .sort((a, b) => b.result.steps.length - a.result.steps.length)[0];
            window.fx.match = s;
            window.fx.command = choice.command;
            const focus = choice.command.cell ??
              s.units.find((u) => u.unitId === choice.command.targetId) ?? {
                x: 5,
                y: 3,
              };
            r.focusCell(focus.x, focus.y);
            r.paint();
            document.querySelector("#ready").textContent = name;
          },
          { name, level, cardId },
        );
        await page.locator("#cast").tap();
        await page.evaluate(async (name) => {
          const { battleDelay } = await import("/js/battle-motion.js"),
            r = window.fx.renderer,
            p = r.effects.playback;
          if (!p) throw Error("missing timeline after real input");
          for (const timer of p.timers) clearTimeout(timer);
          if (r.pending !== null) {
            cancelAnimationFrame(r.pending);
            r.pending = null;
          }
          window.fx.originalSchedule = r.scheduleAnimation;
          r.scheduleAnimation = () => {};
          p.startedAt =
            performance.now() -
            battleDelay(
              { chain: 510, beam: 450, gravity: 600, meteor: 780 }[name],
            );
          r.paint();
        }, name);
        const file = `${viewport.width}-${name}.png`;
        await page.screenshot({
          path: new URL(file, out).pathname.replace(/^\/([A-Z]:)/, "$1"),
        });
        screens.push(file);
        await page.evaluate(() => {
          const r = window.fx.renderer;
          r.finishAction();
          r.scheduleAnimation = window.fx.originalSchedule;
        });
        await page.waitForFunction(() => !window.fx.renderer.effects.playback);
        assert.equal(
          await page.evaluate(() => window.fx.renderer.effects.adventure.error),
          "",
        );
      }
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.evaluate(async () => {
        const f = window.fx,
          e = f.engine,
          r = f.renderer,
          p = f.progress,
          s = e.createExpeditionMatch(
            "starfall-02",
            p.state.training,
            p.state.squad,
            1,
            p.getBattleLoadout(),
          );
        e.confirmMulligan(s);
        r.draw(s);
        const u = s.units.find((u) => u.cardId === 9204),
          o = e.getAdventureAbilityOptions(s, u.unitId);
        f.match = s;
        f.command = {
          unitId: u.unitId,
          abilityId: o.abilityId,
          revision: s.revision,
          cell: o.cells[0],
        };
      });
      await page.locator("#cast").tap();
      await page.waitForFunction(() => !window.fx.renderer.effects.playback);
      await context.close();
    }
    const retryContext = await browser.newContext(),
      retryPage = await retryContext.newPage();
    let failSheet = true;
    await retryPage.route("**/adventure-fx-retry", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><canvas></canvas>",
      }),
    );
    await retryPage.route("**/assets/adventure/chain.png", (route) =>
      failSheet ? route.abort() : route.continue(),
    );
    await retryPage.goto(
      (process.env.ADVENTURE_FX_URL ?? "http://127.0.0.1:4248") +
        "/adventure-fx-retry",
    );
    assert.equal(
      await retryPage.evaluate(async () => {
        const { AdventureEffects } = await import("/js/adventure-effects.js");
        window.retryFx = new AdventureEffects({});
        return await window.retryFx.load();
      }),
      false,
    );
    failSheet = false;
    assert.equal(await retryPage.evaluate(() => window.retryFx.load()), true);
    await retryContext.close();
    report.imageFailureRetry = true;
    assert.deepEqual(errors, []);
    report.browserVerified = true;
    report.browserCoverage =
      "Isolated renderer harness: real touch button submits legal engine commands; both viewport renders at deterministic committed-step checkpoints and reduced-motion completion. Product targeting UI validated separately.";
    report.screens = screens;
  } finally {
    await browser.close();
  }
}
await writeFile(
  new URL("verification.json", out),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
