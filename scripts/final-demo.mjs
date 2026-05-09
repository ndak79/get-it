/**
 * Capture a curated set of screenshots showing the demo end-to-end.
 *   01-home.png            landing page
 *   02-physics-loading.png viewer right after clicking Physics, showing detection in progress
 *   03-physics-formula.png a formula viz auto-selected
 *   04-anatomy-3d.png      heart 3D view
 *   05-chemistry-3d.png    methane tetrahedron
 *   06-costituzione-text.png Italian Constitution article + sources
 */

import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3457";
const OUT = "scripts/smoke-out/final";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errs.push(`[console] ${m.text()}`);
});

// ── Home ─────────────────────────────────────────────────────────────
await page.goto(BASE, { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}/01-home.png`, fullPage: false });
console.log("✓ 01-home.png");

// ── Click physics ────────────────────────────────────────────────────
await page.locator('button:has-text("Classical Mechanics")').first().click();
await page.waitForURL(/\/viewer\//);
await page.waitForTimeout(2500); // catch the loading state
await page.screenshot({ path: `${OUT}/02-physics-loading.png`, fullPage: false });
console.log("✓ 02-physics-loading.png");

// Wait for first ready tag (auto-selected) to render in right pane.
console.log("→ waiting for first auto-selected viz...");
const t0 = Date.now();
while (Date.now() - t0 < 4 * 60_000) {
  const counts = await page.evaluate(() => ({
    canvas: document.querySelectorAll(".relative.min-h-0.flex-1 canvas").length,
    katex: document.querySelectorAll(".relative.min-h-0.flex-1 .katex").length,
    prose: document.querySelectorAll(".relative.min-h-0.flex-1 .prose").length,
  }));
  if (counts.canvas + counts.katex + counts.prose > 0) break;
  await page.waitForTimeout(1500);
}
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/03-physics-firstviz.png`, fullPage: false });
console.log(`✓ 03-physics-firstviz.png (after ${(Date.now()-t0)/1000}s)`);

// Try to find a 3D tag and click it (might not be present, fallback to graph/formula)
async function findAndClickTagOfType(types) {
  const handles = await page.locator("[data-page] button:not([disabled])").all();
  for (const h of handles) {
    const html = await h.innerHTML();
    for (const t of types) {
      const cls = {"3d": "lucide-box", "2d-anim": "lucide-activity", "graph": "lucide-chart-column", "formula": "lucide-sigma", "2d-text": "lucide-file-text"}[t];
      if (cls && html.includes(cls)) {
        await h.click();
        return t;
      }
    }
  }
  return null;
}
const k = await findAndClickTagOfType(["2d-anim", "graph", "formula"]);
console.log(`→ clicked ${k || "(none)"}`);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/04-physics-${k}.png`, fullPage: false });

// Now back to home, pick anatomy
await page.goto(BASE, { waitUntil: "networkidle" });
await page.locator('button:has-text("Human Anatomy & Physiology")').first().click();
await page.waitForURL(/\/viewer\//);
console.log("→ anatomy: waiting for 3D tag…");
const t1 = Date.now();
let threeDClicked = false;
while (Date.now() - t1 < 5 * 60_000) {
  const k = await findAndClickTagOfType(["3d"]);
  if (k) {
    threeDClicked = true;
    console.log(`→ clicked 3D after ${(Date.now()-t1)/1000}s`);
    break;
  }
  await page.waitForTimeout(2500);
}
if (threeDClicked) {
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/05-anatomy-3d.png`, fullPage: false });
  console.log("✓ 05-anatomy-3d.png");
}

// Costituzione → text
await page.goto(BASE, { waitUntil: "networkidle" });
await page.locator('button:has-text("Costituzione Italiana")').first().click();
await page.waitForURL(/\/viewer\//);
console.log("→ costituzione: waiting for text-source tag…");
const t2 = Date.now();
let textClicked = false;
while (Date.now() - t2 < 4 * 60_000) {
  const k = await findAndClickTagOfType(["2d-text"]);
  if (k) { textClicked = true; break; }
  await page.waitForTimeout(2500);
}
if (textClicked) {
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/06-costituzione-text.png`, fullPage: false });
  console.log(`✓ 06-costituzione-text.png after ${(Date.now()-t2)/1000}s`);
}

console.log(`\nErrors: ${errs.length}`);
errs.forEach((e) => console.log("  ", e.slice(0, 200)));

await browser.close();
console.log("\n✓ done");
