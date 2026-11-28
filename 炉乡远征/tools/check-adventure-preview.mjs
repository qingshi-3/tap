import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { AdventurePreviewSession } from "../dist/js/adventure-preview.js";
import { ExpeditionProgress } from "../dist/js/expedition-progress.js";
import { createExpeditionMatch, validateMatch } from "../dist/js/engine.js";
import { SAVE_KEYS } from "../dist/js/storage-keys.js";
const bootstrap = process.argv.includes("--bootstrap");
const report = {
  checks: [],
  errors: [],
  limitations: [
    "Edge touch emulation; TapTap host and physical phone not verified. Terminal accounting is a scoped probe, not a played victory.",
  ],
};
const session = new AdventurePreviewSession();
const first = session.prepare("storm-02");
assert.ok(validateMatch(first.match));
assert.ok(session.commit(first));
assert.equal(session.commit(first), false);
assert.ok(session.checkpoint(first.match).ok);
const next = session.prepare("starfall-02");
assert.ok(validateMatch(next.match));
session.leave();
assert.equal(session.commit(next), false);
for (const state of [first.match, next.match, structuredClone(first.match)]) {
  assert.ok(session.attempted(state));
  assert.equal(session.checkpoint(state).ok, false);
}
report.checks.push(
  "Session legal matches, identity, idempotent commit, cancelled/late candidates and cloned run ID fail-closed.",
);
const values = new Map(),
  storage = {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  };
const progress = new ExpeditionProgress(storage);
assert.ok(
  progress.saveBattle(
    createExpeditionMatch(
      "border-01",
      progress.state.training,
      progress.state.squad,
      1,
      progress.getBattleLoadout(),
    ),
  ).ok,
);
const seed = Object.fromEntries(values);
if (bootstrap) {
  const fixture = JSON.parse(
    await readFile(
      new URL(
        "./fixtures/save-contract-profile13-pre-adventure-2026-11-05.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  seed[SAVE_KEYS.expedition] = JSON.stringify(fixture.profiles[0]);
}
const { chromium } = createRequire(
  "C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json",
)("playwright");
const browser = await chromium.launch({
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const out = new URL(
  bootstrap
    ? "../output/adventure-preview-bootstrap/"
    : "../output/adventure-preview/",
  import.meta.url,
);
await mkdir(out, { recursive: true });
try {
  for (const [width, height, motion] of [
    [568, 320, "reduce"],
    [844, 390, "no-preference"],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: true,
      reducedMotion: motion,
    });
    await context.addInitScript(
      ({ seed, bootstrap }) => {
        const real = localStorage;
        if (!real.getItem("__qa_seeded")) {
          for (const [k, v] of Object.entries(seed)) real.setItem(k, v);
          real.setItem("__qa_seeded", "yes");
        }
        window.__realRead = (keys) =>
          Object.fromEntries(keys.map((k) => [k, real.getItem(k)]));
        window.__tapCalls = 0;
        if (bootstrap) {
          const fake = new Proxy(function () {}, {
            get: () => fake,
            apply: () => {
              window.__tapCalls++;
              return Promise.resolve({});
            },
          });
          window.tap = fake;
        }
      },
      { seed, bootstrap },
    );
    const page = await context.newPage();
    if (bootstrap)
      await page.route("http://127.0.0.1:4248/", async (route) => {
        const html = await readFile(
          new URL("../dist/index.html", import.meta.url),
          "utf8",
        );
        await route.fulfill({
          contentType: "text/html",
          body: html.replace(
            'src="./js/main.js"',
            'src="./js/adventure-test-bootstrap.js"',
          ),
        });
      });
    page.on("pageerror", (e) => report.errors.push(String(e)));
    await page.route("**/js/main.js", async (route) => {
      const source = await readFile(
        new URL("../dist/js/main.js", import.meta.url),
        "utf8",
      );
      await route.fulfill({
        contentType: "text/javascript",
        body:
          source +
          '\nwindow.__previewQA={renderer,get state(){return match},get ready(){return activeTurn()},get paused(){return playerCloud.paused},probeTerminal(winner){match.phase="over";match.winner=winner;persist();refreshMatch();},probeDetached(state){return persist(state)},installLoadingFault(kind){const original=sceneLoading.prepare;let release;sceneLoading.prepare=kind==="fail"?async()=>{throw new Error("QA injected resource failure")}:()=>new Promise(resolve=>{release=resolve});return window.__releaseLoadingFault=()=>{sceneLoading.prepare=original;release?.();}}};',
      });
    });
    await page.goto("http://127.0.0.1:4248", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__previewQA);
    await page.waitForTimeout(1000);
    const raw = () =>
      page.evaluate(
        (keys) => window.__realRead(keys),
        Object.values(SAVE_KEYS),
      );
    const baseline = await raw();
    if (bootstrap)
      assert.equal(baseline[SAVE_KEYS.expedition], seed[SAVE_KEYS.expedition]);
    for (const selector of [
      '[data-page="codex"]',
      '[data-action="recruitment"]',
      '[data-action="roguelike"]',
      '[data-action="leaderboard"]',
      '[data-action="achievements"]',
    ]) {
      const available = await page
        .locator(".menu-destinations " + selector)
        .evaluate((el) => {
          const r = el.getBoundingClientRect();
          return el.contains(
            document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
          );
        });
      assert.ok(available, selector + " touch center reachable");
    }
    await page.screenshot({
      path: new URL(`${width}-home.png`, out).pathname.replace(
        /^\/([A-Za-z]:)/,
        "$1",
      ),
    });
    const entry = page.locator('[data-action="adventure-preview"]');
    await entry.tap();
    await page.locator("#adventure-preview-picker[open]").waitFor();
    await page.screenshot({
      path: new URL(`${width}-picker.png`, out).pathname.replace(
        /^\/([A-Za-z]:)/,
        "$1",
      ),
    });
    await page.locator("[data-preview-close]").tap();
    assert.equal(await page.evaluate(() => window.__previewQA.paused), false);
    assert.deepEqual(await raw(), baseline);
    for (const kind of ["fail", "delay"]) {
      await page.evaluate(
        (kind) => window.__previewQA.installLoadingFault(kind),
        kind,
      );
      await entry.tap();
      await page.locator('[data-preview-scenario="storm-02"]').tap();
      await page.locator("#scene-loading[open]").waitFor();
      if (kind === "fail")
        await page
          .locator('[data-loading-action="retry"]')
          .waitFor({ state: "visible" });
      await page.locator('[data-loading-action="cancel"]').tap();
      await page.waitForFunction(
        () => !document.querySelector("#scene-loading").open,
      );
      await page.evaluate(() => window.__releaseLoadingFault());
      await page.waitForTimeout(150);
      assert.deepEqual(await raw(), baseline);
      assert.equal(await page.locator("#match").isVisible(), false);
      assert.equal(await page.evaluate(() => window.__previewQA.paused), false);
      report.checks.push({
        width,
        loadingFault: kind,
        result: "cancel returns home, late completion cannot enter or persist",
      });
    }
    for (const level of ["storm-02", "starfall-02"]) {
      await entry.tap();
      await page.locator(`[data-preview-scenario="${level}"]`).tap();
      await page.waitForFunction(
        () =>
          !document.querySelector("#scene-loading").open &&
          document.querySelector("#match").hidden === false,
      );
      await page.locator("#objective-close").tap();
      await page.locator(".opening-confirm").tap();
      await page.waitForFunction(() => window.__previewQA.ready);
      assert.equal(
        await page.evaluate(() => window.__previewQA.state.levelId),
        level,
      );
      assert.equal(await page.evaluate(() => window.__previewQA.paused), true);
      assert.deepEqual(await raw(), baseline);
      async function tapCell(x, y) {
        const point = await page.evaluate(
          ({ x, y }) => {
            const r = window.__previewQA.renderer,
              b = r.canvas.getBoundingClientRect(),
              c = r.cellGeometry(r.boardMetrics(b.width, b.height), x, y);
            return { x: b.left + c.center.x, y: b.top + c.center.y };
          },
          { x, y },
        );
        await page.touchscreen.tap(point.x, point.y);
      }
      for (const [cardId, x, y, cost] of level === "storm-02"
        ? [[9202, 4, 3, 2]]
        : [
            [9203, 6, 3, 2],
            [9204, 6, 4, 3],
          ]) {
        const source = await page.evaluate(
          (id) => window.__previewQA.state.units.find((u) => u.cardId === id),
          cardId,
        );
        assert.ok(source);
        await tapCell(source.x, source.y);
        await page.locator(".adventure-ability").waitFor({ state: "visible" });
        await page.screenshot({
          path: new URL(
            `${width}-${level}-${cardId}.png`,
            out,
          ).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
        });
        const mana = await page.evaluate(
          () => window.__previewQA.state.players[0].mana,
        );
        await page.locator(".adventure-ability").tap();
        await tapCell(x, y);
        await tapCell(x, y);
        await page.waitForFunction(
          (mana) => window.__previewQA.state.players[0].mana < mana,
          mana,
        );
        await page.waitForFunction(() => window.__previewQA.ready);
        assert.equal(
          await page.evaluate(() => window.__previewQA.state.players[0].mana),
          mana - cost,
        );
        assert.deepEqual(await raw(), baseline);
        report.checks.push({
          width,
          level,
          cast: cardId,
          cost,
          storage: "unchanged after real touch cast",
        });
      }
      // Accounting probe forces only this in-memory test battle's terminal state.
      await page.evaluate(() => window.__previewQA.probeTerminal(0));
      await page.locator("#game-result").waitFor({ state: "visible" });
      assert.equal(await page.locator("#result-ad-reward").isVisible(), false);
      assert.deepEqual(await raw(), baseline);
      if (level === "storm-02") {
        await page.locator("#play-again").tap();
        await page.waitForFunction(
          () =>
            !document.querySelector("#scene-loading").open &&
            window.__previewQA.state.phase === "mulligan",
        );
        await page.locator("#objective-close").tap();
        await page.locator(".opening-confirm").tap();
        await page.waitForFunction(() => window.__previewQA.ready);
        await page.evaluate(() => window.__previewQA.probeTerminal(1));
        assert.deepEqual(await raw(), baseline);
      }
      await page.locator("#back-to-lobby").tap();
      await page
        .locator('[data-action="adventure-preview"]')
        .waitFor({ state: "visible" });
      assert.equal(await page.evaluate(() => window.__previewQA.state), null);
      assert.deepEqual(await raw(), baseline);
    }
    if (!bootstrap) {
      await page.locator('[data-action="resume"]').tap();
      await page.waitForFunction(
        () =>
          !document.querySelector("#scene-loading").open &&
          !document.querySelector("#match").hidden,
      );
      assert.equal(
        await page.evaluate(() => window.__previewQA.state.levelId),
        "border-01",
      );
    } else {
      assert.equal(await page.evaluate(() => window.__tapCalls), 0);
      await page.reload();
      await page.waitForFunction(() => window.__previewQA);
      assert.deepEqual(await raw(), baseline);
      assert.equal(await page.evaluate(() => window.__tapCalls), 0);
      assert.equal(await page.evaluate(() => window.tap), undefined);
    }
    report.checks.push({
      width,
      height,
      motion,
      entry: bootstrap
        ? "bootstrap schema13 real-storage isolation, touch both scenarios/retry/return/reload; fakeTap calls0"
        : "touch open/cancel, both scenarios, retry, win/loss isolation probe, return and formal battle resume",
      storage: "All three formal SAVE_KEYS byte-identical throughout preview",
    });
    await context.close();
  }
} catch (error) {
  report.errors.push(error.stack);
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(new URL("report.json", out), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
