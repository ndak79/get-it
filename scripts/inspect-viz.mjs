import { chromium } from "playwright";
const BASE = process.env.BASE_URL || "http://localhost:3457";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log(`[${m.type()}]`, m.text().slice(0, 250)); });

await page.goto(BASE, { waitUntil: "networkidle" });
await page.locator('button:has-text("Classical Mechanics")').first().click();
await page.waitForURL(/\/viewer\//);
await page.waitForSelector("[data-page] button:not([disabled])", { timeout: 60_000 });
await page.locator("[data-page] button:not([disabled])").first().click();
await page.waitForTimeout(2500);

const rightPanelHtml = await page.evaluate(() => {
  // viewer-client's right column
  const candidates = document.querySelectorAll("div");
  for (const d of candidates) {
    if (d.className && typeof d.className === "string" && d.className.includes("44%")) {
      return d.outerHTML.slice(0, 4000);
    }
  }
  // fallback: find the visualizer header text
  const hdr = Array.from(document.querySelectorAll("p")).find((p) => p.textContent === "Braynr Visualizer");
  return hdr ? hdr.closest("div.flex.h-full")?.parentElement?.outerHTML?.slice(0, 4000) : "(not found)";
});
console.log("=== RIGHT PANEL HTML ===");
console.log(rightPanelHtml);
console.log("=== Errors:", errs);
await browser.close();
