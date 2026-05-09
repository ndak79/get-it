import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "node:fs";
const data = new Uint8Array(fs.readFileSync(process.argv[2]));
const pdf = await getDocument({ data, useSystemFonts: true }).promise;
console.log(`pages: ${pdf.numPages}`);
for (let p = 1; p <= Math.min(pdf.numPages, 2); p++) {
  const page = await pdf.getPage(p);
  const tc = await page.getTextContent();
  const items = tc.items.slice(0, 3);
  console.log(`-- page ${p} -- ${tc.items.length} items, first 3:`);
  for (const it of items) console.log("  ", JSON.stringify(it).slice(0, 200));
  const fullText = tc.items.map((i) => i.str).join(" ");
  console.log("  text-snippet:", fullText.slice(0, 200));
}
