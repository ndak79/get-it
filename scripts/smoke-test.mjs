/**
 * Headless browser smoke test:
 *   1. open home page
 *   2. click the physics sample
 *   3. wait for the viewer route to load and start detection
 *   4. wait for at least one tag pill to appear and become "ready"
 *   5. click that pill
 *   6. assert the visualizer panel renders (canvas / katex / 3D mount)
 *   7. report all console errors
 */

import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3457";
const SAMPLE = process.env.SAMPLE || "physics";
const OUT_DIR = "scripts/smoke-out";
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

const consoleEvents = [];
const pageErrors = [];
page.on("console", (msg) => {
  consoleEvents.push({ type: msg.type(), text: msg.text(), at: Date.now() });
});
page.on("pageerror", (err) => {
  pageErrors.push({ message: err.message, stack: err.stack });
});

console.log(`→ navigating to ${BASE}`);
await page.goto(BASE, { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT_DIR}/01-home.png`, fullPage: true });

console.log(`→ clicking sample button: ${SAMPLE}`);
const sampleBtn = page.locator(`button:has-text("Classical Mechanics")`).first();
await sampleBtn.waitFor({ timeout: 10_000 });
await sampleBtn.click();

await page.waitForURL(/\/viewer\//, { timeout: 30_000 });
console.log(`→ on viewer route ${page.url()}`);

// Wait for "codex is reading" header to disappear OR a tag to appear
console.log(`→ waiting for first tag pill (up to 90s)…`);
const firstReadyTag = page
  .locator("button.cursor-pointer:not([disabled])")
  .filter({ hasNot: page.locator("svg.animate-spin") })
  .first();

// First wait for ANY tag to appear
const anyTag = await page.waitForSelector("[data-page] button", { timeout: 90_000 });
console.log("→ at least one tag rendered");
await page.screenshot({ path: `${OUT_DIR}/02-tags-appearing.png`, fullPage: true });

// Now wait until at least one is "ready" (clickable, not disabled)
console.log(`→ waiting for the first ready tag (up to 5 min)…`);
let readyTagHandle = null;
const t0 = Date.now();
while (Date.now() - t0 < 5 * 60_000) {
  const candidates = await page.locator("[data-page] button:not([disabled])").all();
  if (candidates.length > 0) {
    readyTagHandle = candidates[0];
    break;
  }
  await page.waitForTimeout(1500);
}
if (!readyTagHandle) {
  console.error("✗ no ready tag after 5 minutes");
  await browser.close();
  process.exit(1);
}
console.log(`→ found ready tag after ${(Date.now()-t0)/1000}s`);
const tagText = await readyTagHandle.textContent();
console.log(`  text: "${tagText?.trim()}"`);

await readyTagHandle.click();
console.log("→ clicked the ready tag");
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT_DIR}/03-tag-clicked.png`, fullPage: true });

// Visualizer should render some content. Look for canvas / katex / markdown.
const canvasCount = await page.locator(".w-\\[44\\%\\] canvas").count();
const katexCount = await page.locator(".w-\\[44\\%\\] .katex").count();
const proseCount = await page.locator(".w-\\[44\\%\\] .prose").count();
console.log(`  visualizer panel: canvas=${canvasCount} katex=${katexCount} prose=${proseCount}`);

// Wait for rendered content to settle
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT_DIR}/04-final.png`, fullPage: true });

console.log(`\n=== Console events (${consoleEvents.length}) ===`);
consoleEvents.filter((e) => e.type === "error" || e.type === "warning").forEach((e) => {
  console.log(`  [${e.type}] ${e.text.slice(0, 200)}`);
});
console.log(`\n=== Page errors (${pageErrors.length}) ===`);
pageErrors.forEach((e) => {
  console.log(`  ${e.message}`);
  if (e.stack) console.log(`    ${e.stack.split("\n").slice(0, 3).join("\n    ")}`);
});

if (canvasCount + katexCount + proseCount === 0) {
  console.error("\n✗ visualizer panel rendered nothing");
  await browser.close();
  process.exit(2);
}

console.log("\n✓ end-to-end smoke test passed");
await browser.close();
