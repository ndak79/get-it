/**
 * Verify the auto-repair loop:
 *   1. Open the viewer in manual mode.
 *   2. Click a 2D-anim tag to trigger viz generation.
 *   3. The FIRST /api/generate-viz response is rewritten by Playwright to
 *      contain intentionally broken JS (`SyntaxError`).
 *   4. The visualizer should crash, the orchestrator should detect it,
 *      bump the attempt count, and re-fire generate-viz.
 *   5. The SECOND response is the real one — visualization should render.
 *
 * Pass criteria:
 *   - The viewer makes 2 generate-viz calls for that tag.
 *   - At least one call carries a `previousAttempt` body (the repair call).
 *   - The right pane eventually shows a canvas (the fixed viz).
 *
 * Requires: dev server at BASE_URL (default http://localhost:3000) running
 * in MANUAL mode (.env has NEXT_PUBLIC_AUTO_GENERATE_VIZ=false).
 */

import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();

const calls = [];
let firstCallSeen = false;

page.on("console", (m) => {
  const t = m.text();
  if (m.type() === "error" || m.type() === "warning" || t.includes("[braynr]")) {
    console.log("  [browser " + m.type() + "]", t.slice(0, 250));
  }
});
page.on("pageerror", (e) => console.log("  [pageerror]", e.message.slice(0, 250)));

await page.route("**/api/generate-viz", async (route) => {
  const req = route.request();
  const body = req.postDataJSON();
  calls.push({
    type: body?.type,
    label: body?.label,
    isRepair: !!body?.previousAttempt,
    at: Date.now(),
  });
  // Only sabotage the FIRST call. The repair call goes through normally.
  if (!firstCallSeen) {
    firstCallSeen = true;
    const fakeBroken = {
      type: body.type,
      title: "Broken Test Spec",
      caption: "Intentionally broken for the auto-fix test",
      setup_code:
        // Definite SyntaxError: unmatched template literal backtick.
        "const x = `unterminated; return { draw(ctx, w, h, t) { ctx.fillStyle = '#fafafa'; ctx.fillRect(0, 0, w, h); } };",
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fakeBroken),
    });
  } else {
    await route.continue();
  }
});

await page.goto(BASE, { waitUntil: "networkidle" });
await page.locator('button:has-text("Classical Mechanics")').first().click();
await page.waitForURL(/\/viewer\//);

console.log("→ wait for tags to appear");
await page.waitForFunction(() => document.querySelectorAll("[data-page] button").length >= 2, null, { timeout: 90_000 });

console.log("→ click the first 2D-anim tag");
const handles = await page.locator("[data-page] button:not([disabled])").all();
let target = null;
for (const h of handles) {
  const html = await h.innerHTML();
  if (html.includes("lucide-activity")) { target = h; break; }
}
if (!target) {
  console.log("no 2D-anim tag found; falling back to first tag");
  target = handles[0];
}
const tagText = (await target.textContent())?.trim();
console.log("  tag:", tagText);
await target.click();

console.log("→ wait for repair cycle (max 4 minutes)");
const t0 = Date.now();
let canvasFound = false;
while (Date.now() - t0 < 4 * 60_000) {
  await page.waitForTimeout(2000);
  const found = await page.evaluate(() => {
    const right = Array.from(document.querySelectorAll("div")).find((d) =>
      d.className?.includes?.("44%"),
    );
    return right ? !!right.querySelector("canvas") : false;
  });
  if (found) {
    canvasFound = true;
    break;
  }
}

console.log("\n=== /api/generate-viz calls ===");
calls.forEach((c, i) =>
  console.log(`  [${i}] ${c.type} "${c.label}" repair=${c.isRepair} at=+${c.at - calls[0].at}ms`),
);

const repairCount = calls.filter((c) => c.isRepair).length;
const ok = calls.length >= 2 && repairCount >= 1 && canvasFound;
console.log(ok ? "\n✓ auto-fix loop works" : "\n✗ auto-fix loop did NOT recover");
await browser.close();
process.exit(ok ? 0 : 2);
