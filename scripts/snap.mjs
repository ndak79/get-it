import { chromium } from "playwright";
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
await p.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await p.screenshot({ path: "scripts/smoke-out/home-after-fix.png", fullPage: false });
await b.close();
console.log("ok");
