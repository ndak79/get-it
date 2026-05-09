/**
 * Test each sample PDF, click a few tags, screenshot each viz type.
 * Saves images under scripts/smoke-out/<sample>-<tagidx>.png
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3457";
const SAMPLES = (process.env.SAMPLES || "anatomy,physics,calculus,chemistry,costituzione").split(",");
const OUT = "scripts/smoke-out";
fs.mkdirSync(OUT, { recursive: true });

const SAMPLE_TITLE = {
  anatomy: "Human Anatomy & Physiology",
  physics: "Classical Mechanics",
  calculus: "Differential & Integral Calculus",
  chemistry: "Organic Chemistry",
  costituzione: "Costituzione Italiana",
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errs = [];
page.on("pageerror", (e) => errs.push({ src: "(unknown)", msg: e.message }));
page.on("console", (m) => {
  if (m.type() === "error") errs.push({ src: "console", msg: m.text() });
});

for (const sample of SAMPLES) {
  const title = SAMPLE_TITLE[sample];
  if (!title) continue;
  console.log(`\n======================== ${sample} ========================`);
  await page.goto(BASE, { waitUntil: "networkidle" });
  const btn = page.locator(`button:has-text("${title}")`).first();
  await btn.waitFor({ timeout: 10_000 });
  await btn.click();
  await page.waitForURL(/\/viewer\//, { timeout: 30_000 });
  console.log(`→ viewer @ ${page.url()}`);

  // Wait for a few tags to appear and become ready (up to 4 min).
  console.log("→ waiting for at least 3 ready tags...");
  const t0 = Date.now();
  let readyHandles = [];
  while (Date.now() - t0 < 4 * 60_000) {
    readyHandles = await page.locator("[data-page] button:not([disabled])").all();
    if (readyHandles.length >= 3) break;
    await page.waitForTimeout(2000);
  }
  console.log(`→ ${readyHandles.length} ready tags after ${(Date.now()-t0)/1000}s`);

  // Iterate first few tags of distinct types
  const seen = new Set();
  let shotIdx = 0;
  for (const h of readyHandles) {
    const txt = (await h.textContent())?.trim() ?? "";
    // Get the type by looking at the icon class — every type has a unique lucide class
    const iconHtml = await h.innerHTML();
    let kind = "unknown";
    if (iconHtml.includes("lucide-box")) kind = "3d";
    else if (iconHtml.includes("lucide-activity")) kind = "2d-anim";
    else if (iconHtml.includes("lucide-file-text")) kind = "2d-text";
    else if (iconHtml.includes("lucide-sigma")) kind = "formula";
    else if (iconHtml.includes("lucide-chart-column")) kind = "graph";

    if (seen.has(kind)) continue;
    seen.add(kind);

    console.log(`  → click ${kind}: ${txt}`);
    await h.click();
    await page.waitForTimeout(1500); // let viz settle
    const file = `${OUT}/${sample}-${shotIdx}-${kind}.png`;
    await page.screenshot({ path: file, fullPage: false });
    console.log(`     saved ${file}`);

    // Check viz panel produced something
    const counts = await page.evaluate(() => ({
      canvas: document.querySelectorAll(".w-\\[44\\%\\] canvas").length,
      katex: document.querySelectorAll(".w-\\[44\\%\\] .katex").length,
      prose: document.querySelectorAll(".w-\\[44\\%\\] .prose").length,
    }));
    console.log(`     panel: canvas=${counts.canvas} katex=${counts.katex} prose=${counts.prose}`);
    shotIdx++;
    if (shotIdx >= 3) break;
  }
}

console.log(`\n=== Errors (${errs.length}) ===`);
errs.forEach((e) => console.log(` [${e.src}] ${e.msg.slice(0, 200)}`));

await browser.close();
console.log("done");
