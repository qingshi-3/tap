import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
const { chromium } = createRequire(
  "C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json",
)("playwright");
const browser = await chromium.launch({
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const checks = [];
try {
  for (const width of [568, 844]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 568 ? 320 : 390 },
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4248");
    await page.locator('[data-action="adventure-preview"]').waitFor();
    for (const [open, close] of [
      ['.menu-destinations [data-page="codex"]', ".expedition-menu-return"],
      [
        '.menu-destinations [data-action="recruitment"]',
        '[data-recruitment-action="close"]',
      ],
      ['.menu-destinations [data-action="roguelike"]', '[data-focus="back"]'],
      [
        '.menu-destinations [data-action="leaderboard"]',
        ".platform-progress-close",
      ],
      [
        '.menu-destinations [data-action="achievements"]',
        ".platform-progress-close",
      ],
    ]) {
      await page.locator(open).tap();
      await page.locator(close).waitFor({ state: "visible" });
      await page.locator(close).tap();
      await page
        .locator('[data-action="adventure-preview"]')
        .waitFor({ state: "visible" });
      checks.push({ width, open, result: "actual touch opens and returns" });
    }
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(
    new URL(
      "../output/adventure-preview/navigation-report.json",
      import.meta.url,
    ),
    JSON.stringify(checks, null, 2),
  );
  console.log(checks);
}
