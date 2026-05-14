/**
 * scripts/electron-after-pack.cjs
 *
 * electron-builder `afterPack` hook. Runs after the app bundle is
 * assembled in `appOutDir` but before code signing and DMG/NSIS
 * packaging. We use it to repair two specific gaps electron-builder
 * leaves in the standalone Next.js bundle:
 *
 *   1. **Nested node_modules** under `.next/standalone/` get stripped
 *      from the packaged tree even though they're matched by the
 *      `files: [".next/standalone/**"]` glob. electron-builder treats
 *      any `node_modules/` directory not at the project root as a
 *      duplicate to dedupe against the root `node_modules/`. That
 *      assumption is wrong for Next.js's `output: "standalone"` mode,
 *      which puts a TRIMMED runtime tree under `.next/standalone/
 *      node_modules/` and an EXTERNALS map at `.next/standalone/.next/
 *      node_modules/<pkg>-<contentHash>` that the Turbopack runtime
 *      hardcodes via `import("<pkg>-<contentHash>")`. Without those
 *      directories the packaged app boots to a page-load 500 on every
 *      route that touches an externalised package (Codex SDK,
 *      pdfjs-dist).
 *
 *   2. The externals map at `.next/standalone/.next/node_modules/` is
 *      built out of **symlinks** pointing to `../../../node_modules/<pkg>`.
 *      Even when we manage to copy the directories themselves,
 *      symlinks through `appOutDir` are not the right path either —
 *      the runtime expects to find the real module here. We resolve
 *      each symlink to its target and recreate the entry as a real
 *      directory copy so the packaged app is self-contained.
 *
 * The result: the packaged tree mirrors what `node server.js` would
 * find when run from the unpacked source tree, which is the only
 * configuration we know Next 16 + Turbopack + standalone supports.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

function copyDirSync(src, dest) {
  const stat = fs.lstatSync(src);
  if (stat.isSymbolicLink()) {
    const real = fs.realpathSync(src);
    copyDirSync(real, dest);
    return;
  }
  if (stat.isFile()) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    return;
  }
  if (!stat.isDirectory()) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isSymbolicLink()) {
      const real = fs.realpathSync(s);
      copyDirSync(real, d);
    } else if (entry.isDirectory()) {
      copyDirSync(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

module.exports = async function afterPack(context) {
  const { appOutDir, packager } = context;
  const projectDir = packager.projectDir;
  const productFilename = packager.appInfo.productFilename;

  // Resolve the in-bundle root for our app sources. On macOS the app
  // bundle lives at `<appOutDir>/<ProductFilename>.app` and our files
  // land at `Contents/Resources/app/`. On Windows/Linux electron-builder
  // unpacks directly into `<appOutDir>/resources/app/`. With `asar: false`
  // electron-builder writes files there as a real on-disk tree.
  const platform = context.electronPlatformName;
  const appResources = platform === "darwin"
    ? path.join(appOutDir, `${productFilename}.app`, "Contents", "Resources", "app")
    : path.join(appOutDir, "resources", "app");

  if (!fs.existsSync(appResources)) {
    console.warn(`[after-pack] expected app dir at ${appResources}; skipping.`);
    return;
  }

  // The two trees to repair, relative to project root and to appResources.
  const repairs = [
    ".next/standalone/node_modules",
    ".next/standalone/.next/node_modules",
  ];

  for (const rel of repairs) {
    const src = path.join(projectDir, rel);
    const dest = path.join(appResources, rel);
    if (!fs.existsSync(src)) continue;
    if (fs.existsSync(dest) && fs.readdirSync(dest).length > 0) continue;
    fs.rmSync(dest, { recursive: true, force: true });
    copyDirSync(src, dest);
    const fileCount = (function countFiles(dir) {
      let n = 0;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) n += countFiles(path.join(dir, e.name));
        else n += 1;
      }
      return n;
    })(dest);
    console.log(`[after-pack] restored ${rel} (${fileCount} files)`);
  }
};
