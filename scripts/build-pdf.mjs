/**
 * Render technical-writeup.md → technical-writeup.pdf
 *
 * Uses `marked` to turn markdown into HTML and Playwright (a dev dep we
 * already ship) to render that HTML to A4 PDF. No new runtime deps.
 *
 * Run with: node scripts/build-pdf.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const MD_PATH = path.join(ROOT, "technical-writeup.md");
const PDF_PATH = path.join(ROOT, "technical-writeup.pdf");

const md = await fs.readFile(MD_PATH, "utf-8");
const body = marked.parse(md, { gfm: true, breaks: false });

// Editorial styling: tight, ink-on-paper, similar to the product's design
// system (ink #111 on warm white, single accent #4f5ae0). Page margins are
// 18mm so a 2–3 page reading-length .md lands as 2–3 PDF pages cleanly.
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Get It. · Technical Writeup</title>
<style>
  @page {
    size: A4;
    margin: 14mm 16mm 16mm 16mm;
  }
  :root {
    --ink-900: #111113;
    --ink-700: #2a2a2d;
    --ink-500: #6a6a6e;
    --ink-400: #8c8c90;
    --rule:    #e3e2df;
    --accent:  #4f5ae0;
    --code-bg: #f3f2ef;
  }
  html, body {
    background: #ffffff;
    color: var(--ink-900);
    font-family: "Inter", "Helvetica Neue", system-ui, -apple-system, sans-serif;
    font-size: 9.6pt;
    line-height: 1.42;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body { margin: 0; }
  h1 {
    font-size: 20pt;
    font-weight: 700;
    letter-spacing: -0.01em;
    margin: 0 0 0.2rem 0;
  }
  h2 {
    font-size: 12.5pt;
    font-weight: 600;
    letter-spacing: -0.005em;
    margin: 0.95rem 0 0.4rem 0;
    color: var(--ink-900);
    border-top: 1px solid var(--rule);
    padding-top: 0.55rem;
  }
  h3 {
    font-size: 10.5pt;
    font-weight: 600;
    margin: 0.7rem 0 0.3rem 0;
  }
  p {
    margin: 0 0 0.4rem 0;
    color: var(--ink-700);
  }
  ul, ol {
    margin: 0 0 0.55rem 0;
    padding-left: 1.25rem;
  }
  li { margin: 0.15rem 0; color: var(--ink-700); }
  blockquote {
    margin: 0.55rem 0;
    padding: 0.2rem 0 0.2rem 0.75rem;
    border-left: 2px solid var(--accent);
    color: var(--ink-700);
    font-style: italic;
  }
  blockquote p:last-child { margin-bottom: 0; }
  strong { color: var(--ink-900); }
  em { color: var(--ink-700); }
  code {
    font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 9.2pt;
    background: var(--code-bg);
    padding: 0.05rem 0.3rem;
    border-radius: 3px;
  }
  pre {
    background: var(--code-bg);
    padding: 0.5rem 0.7rem;
    border-radius: 6px;
    overflow: hidden;
    font-size: 7.8pt;
    line-height: 1.35;
    margin: 0.35rem 0 0.55rem 0;
  }
  pre code {
    background: transparent;
    padding: 0;
    border-radius: 0;
    font-size: inherit;
    color: var(--ink-900);
  }
  hr {
    border: 0;
    border-top: 1px solid var(--rule);
    margin: 0.7rem 0;
  }
  a { color: var(--accent); text-decoration: none; }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 0.4rem 0 0.55rem 0;
    font-size: 8.8pt;
  }
  th, td {
    text-align: left;
    border-bottom: 1px solid var(--rule);
    padding: 0.25rem 0.5rem 0.25rem 0;
    vertical-align: top;
  }
  th {
    color: var(--ink-500);
    font-weight: 600;
    font-size: 7.9pt;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  /* Top intro block reads tighter than body. */
  body > h1 + blockquote {
    margin-top: 0.3rem;
    font-size: 10pt;
  }
  body > h1 + blockquote + p {
    margin-top: 0.45rem;
    color: var(--ink-500);
    font-size: 8.8pt;
  }
  body > h1 + blockquote + p + p {
    color: var(--ink-500);
    font-size: 8.8pt;
  }
  ul, ol { margin: 0 0 0.4rem 0; }
  li { margin: 0.08rem 0; }
  /* Avoid awkward orphans/widows where possible. */
  h2, h3 { break-after: avoid-page; }
  pre, blockquote, table { break-inside: avoid-page; }
</style>
</head>
<body>
${body}
</body>
</html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: PDF_PATH,
    format: "A4",
    printBackground: true,
    margin: { top: "18mm", right: "18mm", bottom: "20mm", left: "18mm" },
  });
} finally {
  await browser.close();
}

console.log("wrote", path.relative(ROOT, PDF_PATH));
