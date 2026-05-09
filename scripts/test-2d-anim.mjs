import { chromium } from "playwright";
const BASE = "http://localhost:3457";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("[err]", m.text().slice(0, 250));
});

await page.goto(BASE, { waitUntil: "networkidle" });
await page.locator('button:has-text("Classical Mechanics")').first().click();
await page.waitForURL(/\/viewer\//);

console.log("waiting for ANY 2d-anim ready tag...");
const t0 = Date.now();
let h = null;
while (Date.now() - t0 < 5 * 60_000) {
  const handles = await page.locator("[data-page] button:not([disabled])").all();
  for (const handle of handles) {
    const html = await handle.innerHTML();
    if (html.includes("lucide-activity")) {
      h = handle;
      const txt = await handle.textContent();
      console.log("found 2d-anim:", txt);
      break;
    }
  }
  if (h) break;
  await page.waitForTimeout(2500);
}
if (!h) {
  console.log("no 2d-anim tag found in 5 min");
  process.exit(1);
}
await h.click();
await page.waitForTimeout(3000);
await page.screenshot({ path: "scripts/smoke-out/physics-2d-anim-only.png", fullPage: false });
console.log("err count:", errs.length);
errs.forEach((e) => console.log("  pageerror:", e.slice(0, 200)));
await browser.close();
