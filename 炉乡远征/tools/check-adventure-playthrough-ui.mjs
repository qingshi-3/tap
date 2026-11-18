import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, readdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import {
  ExpeditionProgress,
  validateExpeditionState,
} from "../dist/js/expedition-progress.js";
import { ORIGINAL_CAMPAIGN_LEVEL_IDS } from "../dist/js/adventure-access.js";
import { getUnlockRewards } from "../dist/js/campaign-rules.js";
import { getHero, FACTIONS } from "../dist/js/factions.js";
import { validateMatch } from "../dist/js/engine.js";
import { SAVE_KEYS } from "../dist/js/storage-keys.js";
const args = Object.fromEntries(
  process.argv.slice(2).map((s) => {
    const [k, ...v] = s.replace(/^--/, "").split("=");
    return [k, v.join("=")];
  }),
);
const root = fileURLToPath(new URL("..", import.meta.url)),
  output = join(root, "output/adventure-playthrough-ui");
await mkdir(output, { recursive: true });
const captureRoot = resolve(
  args.captures ??
    join(root, "output/adventure-balance/browser-boss-captures/matches"),
);
const levels = (
  args.levels ??
  "storm-03,storm-06,storm-09,starfall-03,starfall-06,starfall-09,storm-01,storm-02,storm-04,storm-05,storm-07,storm-08,starfall-01,starfall-02,starfall-04,starfall-05,starfall-07,starfall-08"
).split(",");
const base = process.env.ADVENTURE_URL ?? "http://127.0.0.1:4248";
let report = {
  startedAt: new Date().toISOString(),
  results: [],
  limitations: [
    "Independent mature-build battles, not a continuous economic route.",
    "Real Edge mixed input: mouse clicks for controls, touchscreen board targets and CDP touch drags; not a physical phone/TapTap host.",
    "Starting from legally generated after-mulligan continuation snapshots when exact seed context is not persisted; opening input is covered separately.",
  ],
};
try {
  const old = JSON.parse(await readFile(join(output, "report.json"), "utf8"));
  report.results = old.results ?? [];
} catch {}
class Memory {
  data = new Map();
  getItem(k) {
    return this.data.get(k) ?? null;
  }
  setItem(k, v) {
    this.data.set(k, String(v));
  }
  removeItem(k) {
    this.data.delete(k);
  }
}
async function captureFor(level) {
  if (level.startsWith("probe-")) {
    const dir = join(
      root,
      "output/adventure-balance/browser-mechanism-probes",
      level.slice(6),
    );
    const initial = JSON.parse(
      await readFile(join(dir, "before-mulligan-match.json"), "utf8"),
    );
    const afterOpening = JSON.parse(
      await readFile(join(dir, "initial-match.json"), "utf8"),
    );
    const hero = initial.players[0].generalId;
    const loadout = JSON.parse(
      await readFile(
        join(
          root,
          "output/adventure-balance/browser-normal-native-allocator/matches",
          `${hero}-late-core-aware-11-${initial.levelId}`,
          "loadout.json",
        ),
        "utf8",
      ),
    );
    return {
      dir,
      initial,
      afterOpening,
      loadout,
      probe: true,
      commands: JSON.parse(await readFile(join(dir, "commands.json"), "utf8")),
      final: JSON.parse(await readFile(join(dir, "final-match.json"), "utf8")),
    };
  }
  let effectiveRoot = captureRoot;
  if (!args.captures && ["storm-06", "starfall-06"].includes(level))
    effectiveRoot = join(
      root,
      "output/adventure-balance/browser-boss-native-allocator/matches",
    );
  if (
    !args.captures &&
    !level.endsWith("-03") &&
    !level.endsWith("-06") &&
    !level.endsWith("-09")
  )
    effectiveRoot = join(
      root,
      "output/adventure-balance/browser-normal-native-allocator/matches",
    );
  if (
    !args.captures &&
    [
      "storm-01",
      "storm-02",
      "storm-04",
      "storm-05",
      "storm-07",
      "storm-08",
      "starfall-01",
      "starfall-02",
      "starfall-04",
      "starfall-05",
      "starfall-07",
      "starfall-08",
    ].includes(level)
  )
    effectiveRoot = join(
      root,
      "output/adventure-balance/browser-normal-native-allocator/matches",
    );
  const entries = await readdir(effectiveRoot);
  const name = entries.find((x) => x.endsWith("-" + level));
  assert.ok(name, "No captured successful source for " + level);
  const dir = join(effectiveRoot, name);
  return {
    dir,
    initial: JSON.parse(
      await readFile(join(dir, "initial-match.json"), "utf8"),
    ),
    afterOpening: JSON.parse(
      await readFile(join(dir, "after-mulligan-match.json"), "utf8"),
    ),
    loadout: JSON.parse(await readFile(join(dir, "loadout.json"), "utf8")),
    commands: JSON.parse(await readFile(join(dir, "commands.json"), "utf8")),
    final: JSON.parse(await readFile(join(dir, "final-match.json"), "utf8")),
  };
}
function seededProfile(capture) {
  const storage = new Memory(),
    p = new ExpeditionProgress(storage);
  assert.ok(p.selectHero(capture.loadout.hero).ok);
  const s = p.state,
    fid = getHero(capture.loadout.hero).faction,
    other = FACTIONS.find((f) => f.id !== fid).id;
  s.factionCompleted[fid] = [...ORIGINAL_CAMPAIGN_LEVEL_IDS];
  s.factionCompleted[other] = ["border-01"];
  s.completed = [...ORIGINAL_CAMPAIGN_LEVEL_IDS];
  s.accountStageClaims = Object.fromEntries(
    s.completed.map((id) => [id, "legacy"]),
  );
  for (const [f, ids] of Object.entries(s.factionCompleted))
    for (const id of ids) {
      const rewards = getUnlockRewards(id, Number(f));
      for (const kind of ["units", "spells"])
        s.inventory[kind] = [
          ...new Set([...s.inventory[kind], ...rewards[kind]]),
        ];
    }
  s.training = { ...capture.loadout.training };
  s.factionDecks[fid] = [...capture.loadout.loadout.deck];
  assert.ok(validateExpeditionState(s));
  assert.ok(p.replaceState(s).ok);
  assert.ok(p.dismissAdventureGiftNotice().ok);
  assert.ok(validateMatch(capture.initial));
  assert.ok(validateMatch(capture.afterOpening));
  assert.ok(p.saveBattle(capture.initial).ok);
  assert.ok(p.saveBattle(capture.afterOpening).ok);
  return p.state;
}
const { chromium } = createRequire(
  "C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json",
)("playwright");
const browser = await chromium.launch({
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
let page, current;
const summary = (s) => ({
  revision: s.revision,
  phase: s.phase,
  round: s.round,
  turn: s.players[0].turnsStarted,
  mana: s.players[0].mana,
  hand: s.players[0].hand,
  units: s.units.map((u) => ({
    unitId: u.unitId,
    cardId: u.cardId,
    owner: u.owner,
    x: u.x,
    y: u.y,
    health: u.health,
  })),
  winner: s.winner,
  result: s.result,
});
async function flush() {
  report.finishedAt = new Date().toISOString();
  report.completedLevels = [
    ...new Set(
      report.results.filter((r) => r.passed && !r.probe).map((r) => r.level),
    ),
  ];
  report.all18Passed = report.completedLevels.length === 18;
  await writeFile(
    join(output, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
}
async function observe() {
  return page.evaluate(() => structuredClone(window.__adventureQA.state));
}
async function ready() {
  await page.waitForFunction(
    () =>
      window.__adventureQA.state?.phase === "over" ||
      window.__adventureQA.ready,
    { timeout: 60000 },
  );
}
async function point(x, y) {
  return page.evaluate(
    ({ x, y }) => {
      const r = window.__adventureQA.renderer,
        b = r.canvas.getBoundingClientRect(),
        c = r.cellGeometry(r.boardMetrics(b.width, b.height), x, y);
      const center = { x: b.left + c.center.x, y: b.top + c.center.y };
      for (const dy of [0, 0.28, -0.28])
        for (const dx of [0, 0.22, -0.22]) {
          const p = { x: center.x + dx * c.width, y: center.y + dy * c.height };
          const hit = r.positionFromPointer(
            { clientX: p.x, clientY: p.y },
            { preferUnits: false },
          );
          if (
            hit?.x === x &&
            hit?.y === y &&
            document.elementFromPoint(p.x, p.y) === r.canvas &&
            p.y < window.__adventureQA.boundary - 8
          )
            return { ...p, clear: true, offset: [dx, dy] };
        }
      return { ...center, clear: false };
    },
    { x, y },
  );
}
async function focusCell(x, y) {
  if (!(await page.locator("#map-panel").isVisible()))
    await page.locator("#map-open").click();
  await page.locator("#map-overview").waitFor({ state: "visible" });
  const box = await page.locator("#map-overview").boundingBox();
  const s = await observe();
  await page.touchscreen.tap(
    box.x + ((x + 0.5) / s.board.columns) * box.width,
    box.y + ((y + 0.5) / s.board.rows) * box.height,
  );
  await page.locator("#map-panel").waitFor({ state: "hidden" });
}
async function clearInspect() {
  if (await page.locator("#inspect-close").isVisible())
    await page.locator("#inspect-close").click();
}
async function ensureCell(x, y) {
  let p = await point(x, y);
  if (!p.clear) {
    await clearInspect();
    await focusCell(x, y);
    p = await point(x, y);
  }
  assert.ok(
    p.clear,
    `Cell${x},${y} blocked/offscreen after normal map navigation`,
  );
  return p;
}
async function tapCell(x, y) {
  const p = await ensureCell(x, y);
  await page.touchscreen.tap(p.x, p.y);
}
async function unit(id) {
  const s = await observe(),
    u = s.units.find((u) => u.unitId === id);
  assert.ok(u, "Missing trace unit " + id);
  return u;
}
async function drag(from, to) {
  current.drags = (current.drags ?? 0) + 1;
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: from.x, y: from.y, id: 0, radiusX: 2, radiusY: 2, force: 1 },
      ],
    });
    const points = [{ x: from.x, y: Math.min(from.y - 35, to.y) }, to];
    let prev = from;
    for (const end of points) {
      for (let i = 1; i <= 6; i++) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [
            {
              x: prev.x + ((end.x - prev.x) * i) / 6,
              y: prev.y + ((end.y - prev.y) * i) / 6,
              id: 0,
              radiusX: 2,
              radiusY: 2,
              force: 1,
            },
          ],
        });
      }
      prev = end;
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } finally {
    await cdp.detach();
  }
}
async function handDrag(index, cell) {
  await ensureCell(cell.x, cell.y);
  const card = page.locator("#hand > .hand-card").nth(index);
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  assert.ok(box);
  const dest = await ensureCell(cell.x, cell.y);
  await drag(
    { x: box.x + box.width * 0.5, y: box.y + Math.min(box.height * 0.5, 40) },
    dest,
  );
}
async function targetCell(value) {
  if (typeof value === "number") {
    const u = await unit(value);
    return { x: u.x, y: u.y };
  }
  if (value && Number.isInteger(value.x) && Number.isInteger(value.y))
    return value;
  if (value?.cell) return value.cell;
  if (value?.unitId) return targetCell(value.unitId);
  return null;
}
async function execute(command) {
  await clearInspect();
  // A regular empty-cell tap releases the previous near-body ability control before choosing another actor.
  const empty = await page.evaluate(() => {
    const q = window.__adventureQA,
      s = q.state;
    if (s.selectedUnitId == null) return null;
    const r = q.renderer,
      b = r.canvas.getBoundingClientRect(),
      m = r.boardMetrics(b.width, b.height);
    for (let y = 0; y < s.board.rows; y++)
      for (let x = 0; x < s.board.columns; x++) {
        if (s.units.some((u) => u.x === x && u.y === y)) continue;
        const c = r.cellGeometry(m, x, y),
          p = { x: b.left + c.center.x, y: b.top + c.center.y };
        const hit = r.positionFromPointer({ clientX: p.x, clientY: p.y });
        if (
          hit?.x === x &&
          hit?.y === y &&
          document.elementFromPoint(p.x, p.y) === r.canvas &&
          p.y < q.boundary - 8
        )
          return p;
      }
    return null;
  });
  if (empty) await page.touchscreen.tap(empty.x, empty.y);
  if (command.kind === "mulligan") {
    for (const i of command.mulliganIndices ?? [])
      await page.locator("#hand > .hand-card").nth(i).click();
    await page.locator(".opening-confirm").click();
    return;
  }
  if (command.kind === "end-turn") {
    await page.locator("#end-turn").click();
    return;
  }
  if (command.kind === "replace") {
    await page.locator("#hand > .hand-card").nth(command.handIndex).click();
    await page.locator("#replace-hand-card").click();
    return;
  }
  if (command.kind === "move") {
    const u = await unit(command.unitId);
    await focusCell((u.x + command.x) / 2, (u.y + command.y) / 2);
    const a = await point(u.x, u.y),
      b = await point(command.x, command.y);
    assert.ok(
      a.clear && b.clear,
      "Move endpoints unavailable: " + JSON.stringify({ u, command, a, b }),
    );
    await drag(a, b);
    return;
  }
  if (command.kind === "attack") {
    const source = await unit(command.sourceId);
    await tapCell(source.x, source.y);
    const target = await unit(command.targetId);
    await tapCell(target.x, target.y);
    return;
  }
  if (command.kind === "adventure") {
    const source = await unit(command.unitId);
    await tapCell(source.x, source.y);
    await page.locator(".adventure-ability").waitFor({ state: "visible" });
    await page.locator(".adventure-ability").click();
    if (
      (await page
        .locator(".adventure-ability")
        .getAttribute("aria-pressed")) !== "true"
    ) {
      current.inputs.at(-1).buttonBeginRetry = true;
      await page.waitForTimeout(120);
      await page.locator(".adventure-ability").click();
    }
    try {
      await page.waitForFunction(
        () =>
          document
            .querySelector(".adventure-ability")
            ?.getAttribute("aria-pressed") === "true",
        null,
        { timeout: 2500 },
      );
    } catch (error) {
      current.inputs.at(-1).beginDiagnostic = await page.evaluate(() => ({
        selection: window.__adventureQA.selection,
        button: document.querySelector(".adventure-ability")?.outerHTML,
        pointer: window.__qaPointerLog?.slice(-8),
      }));
      throw error;
    }
    let cell = command.cell;
    if (command.targetId != null) cell = await targetCell(command.targetId);
    if (command.direction) {
      const d = { east: [1, 0], west: [-1, 0], south: [0, 1], north: [0, -1] }[
        command.direction
      ];
      cell = { x: source.x + d[0], y: source.y + d[1] };
    }
    assert.ok(cell, "No target " + JSON.stringify(command));
    current.inputs.at(-1).aimPoint = await ensureCell(cell.x, cell.y);
    await tapCell(cell.x, cell.y);
    const validPreview = page
      .locator(".adventure-ability")
      .filter({ hasText: "施放" });
    try {
      await validPreview.waitFor({ timeout: 2500 });
    } catch (error) {
      current.inputs.at(-1).aimDiagnostic = await page.evaluate(() => ({
        selection: window.__adventureQA.selection,
        text: document.querySelector(".adventure-summary")?.textContent,
        boundary: window.__adventureQA.boundary,
        point: window.__qaPointerLog?.slice(-6),
      }));
      throw error;
    }
    if ((await point(cell.x, cell.y)).clear) await tapCell(cell.x, cell.y);
    else {
      current.inputs.at(-1).confirmation =
        "existing skill button (preview panel covered target)";
      await page.locator(".adventure-ability").click();
    }
    return;
  }
  if (command.kind === "bbs") {
    const target = await targetCell(command.targetId ?? command.target);
    if (!target) {
      await page.locator("#bbs-button").click();
      return;
    }
    await ensureCell(target.x, target.y);
    const box = await page.locator("#bbs-button").boundingBox();
    await drag(
      { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 },
      await ensureCell(target.x, target.y),
    );
    return;
  }
  if (command.kind === "summon" || command.kind === "spell") {
    const s = await observe();
    assert.equal(
      s.players[0].hand[command.handIndex],
      command.cardId,
      "Hand differs from recorded successful trace",
    );
    let cell =
      command.kind === "summon"
        ? { x: command.x, y: command.y }
        : await targetCell(command.target ?? command.targetId);
    if (!cell) {
      await page.locator("#hand > .hand-card").nth(command.handIndex).click();
      await page.locator("#inspect-cast").click();
      return;
    }
    await handDrag(command.handIndex, cell);
    const pending = await page.evaluate(
      () => window.__adventureQA.selection.cardFollowup,
    );
    if (pending) {
      if (command.openingTarget) {
        const target = await targetCell(command.openingTarget);
        assert.ok(target);
        await tapCell(target.x, target.y);
      } else if (command.target?.unitIds) {
        for (const id of command.target.unitIds.slice(1)) {
          const target = await targetCell(id);
          await tapCell(target.x, target.y);
        }
      } else if (await page.locator("#inspect-followup-skip").isVisible())
        await page.locator("#inspect-followup-skip").click();
      else
        throw Error(
          "Recorded command needs unsupported followup " +
            JSON.stringify({ command, pending }),
        );
    }
    return;
  }
  throw Error("Unmapped command " + JSON.stringify(command));
}
try {
  for (const level of levels) {
    if (
      args.resume === "true" &&
      report.results.some((r) => r.level === level && r.passed)
    )
      continue;
    const capture = await captureFor(level);
    const prior = report.results.find((r) => r.level === level);
    let checkpointIndex = null,
      priorInputs = [];
    if (
      args.checkpoint === "true" &&
      prior &&
      !prior.passed &&
      prior.inputs.length
    ) {
      try {
        const snapshot = JSON.parse(
          await readFile(join(output, level + "-failure-match.json"), "utf8"),
        );
        assert.equal(snapshot.runId, capture.initial.runId);
        assert.ok(validateMatch(snapshot));
        capture.afterOpening = snapshot;
        checkpointIndex = prior.inputs.at(-1).traceIndex;
        priorInputs = prior.inputs.filter(
          (i) => i.traceIndex < checkpointIndex,
        );
      } catch (error) {
        throw Error(
          "Invalid/missing actual-input checkpoint: " + error.message,
        );
      }
    }
    if (!capture.probe)
      assert.equal(
        capture.final.winner,
        0,
        "Only successful source trajectories allowed",
      );
    const width = level === (args.short ?? "starfall-03") ? 568 : 844,
      height = width === 568 ? 320 : 390;
    current = {
      level,
      probe: Boolean(capture.probe),
      width,
      height,
      source: capture.dir,
      sourceInitialHash: createHash("sha256")
        .update(JSON.stringify(capture.afterOpening))
        .digest("hex"),
      seed: capture.loadout.seed,
      hero: capture.loadout.hero,
      startedAt: new Date().toISOString(),
      inputs: priorInputs,
      checkpointIndex,
      errors: [],
      passed: false,
    };
    report.results = report.results.filter((r) => r.level !== level);
    report.results.push(current);
    await flush();
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const profile = seededProfile(capture);
    await context.addInitScript(
      ({ key, profile }) => {
        if (!localStorage.getItem(key))
          localStorage.setItem(key, JSON.stringify(profile));
      },
      { key: SAVE_KEYS.expedition, profile },
    );
    page = await context.newPage();
    page.on("pageerror", (e) => current.errors.push(String(e)));
    await page.route("**/js/main.js", async (route) => {
      const source = await readFile(join(root, "dist/js/main.js"), "utf8");
      await route.fulfill({
        contentType: "text/javascript",
        body:
          source +
          "\nwindow.__adventureQA={renderer,get state(){return match},get ready(){return activeTurn()},get boundary(){return handCancelBoundary()},get selection(){return{selectedCardIndex,cardFollowup,commandMode,adventureActive:adventureControls?.active,boardPointerId,cameraGesture}}};",
      });
    });
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__adventureQA);
    await page.evaluate(() => {
      window.__qaPointerLog = [];
      for (const type of ["pointerdown", "pointerup"])
        document.addEventListener(
          type,
          (event) => {
            const q = window.__adventureQA;
            if (!q.state) return;
            window.__qaPointerLog.push({
              type,
              target: event.target.id || event.target.className,
              x: event.clientX,
              y: event.clientY,
              selection: q.selection,
              cell: q.renderer.positionFromPointer(event, {
                preferUnits: false,
              }),
            });
            if (window.__qaPointerLog.length > 20)
              window.__qaPointerLog.shift();
          },
          { capture: true, passive: true },
        );
    });
    await page.locator('[data-action="resume"]').click();
    await page.locator("#match").waitFor({ state: "visible" });
    await page.waitForFunction(
      () => !document.querySelector("#scene-loading").open,
    );
    if (await page.locator("#objective-close").isVisible())
      await page.locator("#objective-close").click();
    await ready();
    await page.screenshot({ path: join(output, level + "-start.png") });
    let first = true;
    for (const row of capture.commands) {
      if (
        row.owner !== 0 ||
        (checkpointIndex !== null &&
          capture.commands.indexOf(row) < checkpointIndex)
      )
        continue;
      if (
        first &&
        row.command.kind === "mulligan" &&
        capture.afterOpening.phase !== "mulligan"
      ) {
        first = false;
        continue;
      }
      first = false;
      await ready();
      const before = await observe();
      assert.notEqual(
        before.phase,
        "over",
        "Battle ended before trace command",
      );
      const expectedTurn =
        row.turn ??
        1 +
          capture.commands
            .slice(0, capture.commands.indexOf(row))
            .filter(
              (previous) =>
                previous.owner === 0 && previous.command.kind === "end-turn",
            ).length;
      assert.equal(
        before.players[0].turnsStarted,
        expectedTurn,
        "Player turn differs from source",
      );
      if (capture.probe && Array.isArray(row.before)) {
        const units = (rows) =>
          rows.map((u) => ({
            unitId: u.unitId,
            cardId: u.cardId,
            owner: u.owner,
            x: u.x,
            y: u.y,
            health: u.health,
          }));
        assert.deepEqual(
          units(before.units),
          units(row.before),
          "Probe before units must match the ordinary-replay-certified source",
        );
      }
      const entry = {
        traceIndex: capture.commands.indexOf(row),
        command: row.command,
        before: summary(before),
        startedAt: Date.now(),
      };
      current.inputs.push(entry);
      await execute(row.command);
      await ready();
      const after = await observe();
      entry.after = summary(after);
      entry.steps = after.lastAction?.steps ?? [];
      if (current.probe && row.command.kind === "adventure")
        await page.screenshot({
          path: join(output, level + "-step-" + entry.traceIndex + ".png"),
        });
      entry.elapsedMs = Date.now() - entry.startedAt;
      assert.notDeepEqual(
        entry.after,
        entry.before,
        "Input did not commit " + JSON.stringify(row.command),
      );
      await flush();
      if (after.phase === "over") break;
    }
    const final = await observe();
    const saved = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      SAVE_KEYS.expedition,
    );
    if (capture.probe) {
      assert.equal(final.phase, capture.final.phase);
      assert.equal(final.winner, capture.final.winner);
      const special = current.inputs
          .filter((i) => i.command.kind === "adventure")
          .slice(level.includes("double") ? -3 : -2),
        before = special[0].before,
        after = special.at(-1).after;
      const enemies = before.units.filter(
        (u) => u.owner !== 0 && u.cardId !== final.players[1].generalId,
      );
      current.mechanics = {
        casts: special.map((i) => i.command),
        manaSpent: before.mana - after.mana,
        enemyKills: enemies.filter(
          (u) => !after.units.some((v) => v.unitId === u.unitId),
        ).length,
        playerTurn: final.players[0].turnsStarted,
      };
      assert.equal(
        current.mechanics.enemyKills,
        level.includes("double") ? 5 : 4,
      );
      assert.equal(
        current.mechanics.manaSpent,
        level.includes("double") ? 7 : 5,
      );
      assert.equal(saved.activeBattle.revision, final.revision);
      assert.equal(
        saved.accountStageClaims[final.levelId],
        undefined,
        "Mechanism probe is not a victory or reward",
      );
      await page.screenshot({ path: join(output, level + "-mechanism.png") });
    } else {
      assert.equal(final.phase, "over");
      assert.equal(
        final.winner,
        0,
        "Recorded route must actually win via inputs",
      );
      await page.locator("#game-result").waitFor({ state: "visible" });
      await page.screenshot({ path: join(output, level + "-victory.png") });
      assert.ok(
        saved.factionCompleted[getHero(capture.loadout.hero).faction].includes(
          level,
        ),
        "Actual victory persisted",
      );
    }
    current.passed = true;
    current.final = summary(final);
    current.settlement = saved.settlements[final.runId];
    current.finishedAt = new Date().toISOString();
    assert.deepEqual(current.errors, []);
    await writeFile(
      join(output, level + "-final-match.json"),
      JSON.stringify(final, null, 2) + "\n",
    );
    await writeFile(
      join(output, level + "-saved-profile.json"),
      JSON.stringify(saved, null, 2) + "\n",
    );
    await flush();
    console.log(
      JSON.stringify({
        level,
        passed: true,
        inputs: current.inputs.length,
        round: final.round,
        health: final.units.find(
          (u) => u.owner === 0 && u.cardId === capture.loadout.hero,
        )?.health,
        width,
      }),
    );
    await context.close();
  }
  await flush();
  if (report.completedLevels.length === 18) {
    const rows = [];
    for (const result of report.results.filter((r) => r.passed && !r.probe)) {
      const saved = JSON.parse(
        await readFile(
          join(output, result.level + "-saved-profile.json"),
          "utf8",
        ),
      );
      const battle = JSON.parse(
        await readFile(
          join(output, result.level + "-final-match.json"),
          "utf8",
        ),
      );
      assert.ok(validateExpeditionState(saved));
      assert.equal(battle.phase, "over");
      assert.equal(battle.winner, 0);
      const receipt = saved.settlements[battle.runId],
        orbs = saved.recruitment.victoryClaims[battle.runId];
      assert.ok(receipt);
      assert.equal(saved.coins, 100 + receipt.amount);
      assert.equal(saved.recruitment.tickets, 10 + orbs);
      assert.equal(
        Object.values(saved.factionCompleted).reduce(
          (n, ids) => n + ids.length,
          0,
        ),
        32,
      );
      rows.push({
        level: result.level,
        hero: result.hero,
        width: result.width,
        height: result.height,
        round: result.final.round,
        health: result.final.units.find(
          (u) => u.owner === 0 && u.cardId === result.hero,
        )?.health,
        playerCommands: result.inputs.length,
        coins: receipt.amount,
        orbs,
        checkpointIndex: result.checkpointIndex,
      });
    }
    rows.sort((a, b) => a.level.localeCompare(b.level));
    const totals = {
      coins: rows.reduce((n, r) => n + r.coins, 0),
      orbs: rows.reduce((n, r) => n + r.orbs, 0),
      playerCommands: rows.reduce((n, r) => n + r.playerCommands, 0),
    };
    assert.equal(totals.coins, 6720);
    assert.equal(totals.orbs, 24);
    const summary = {
      passed: true,
      completedLevels: 18,
      bosses: rows.filter((r) => /-0[369]$/.test(r.level)).length,
      shortScreenCompleteWins: rows.filter((r) => r.width === 568).length,
      rows,
      totals,
      probes: report.results
        .filter((r) => r.passed && r.probe)
        .map((r) => ({ name: r.level, ...r.mechanics })),
      limitations: report.limitations,
    };
    await writeFile(
      join(output, "summary.json"),
      JSON.stringify(summary, null, 2) + "\n",
    );
    report.summaryFile = "summary.json";
  }
} catch (error) {
  if (current) {
    current.failure = error.stack;
    if (page && !page.isClosed()) {
      await page.screenshot({
        path: join(output, current.level + "-failure.png"),
      });
      try {
        await writeFile(
          join(output, current.level + "-failure-match.json"),
          JSON.stringify(await observe(), null, 2),
        );
      } catch {}
    }
  }
  await flush();
  throw error;
} finally {
  await flush();
  await browser.close();
}
