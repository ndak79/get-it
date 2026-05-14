/**
 * scripts/electron-after-sign.cjs
 *
 * electron-builder `afterSign` hook. Runs after the app bundle is staged
 * but before the .dmg is built. On macOS we apply an **ad-hoc** code
 * signature to every Mach-O binary in the bundle. This is the free
 * (no $99 Apple Developer Program needed) path that satisfies the
 * Apple Silicon kernel's requirement that every loaded binary carry a
 * code signature.
 *
 * Without this, a fresh download from a GitHub Release on an M-series
 * Mac trips Gatekeeper with the modern fatal variant:
 *     "Get It.app is damaged and can't be opened."
 * The bundle isn't actually damaged — macOS reports unsigned Mach-O on
 * arm64 the same way it reports a corrupted archive. Ad-hoc signing
 * (`codesign --sign -`) is enough to clear the kernel-level check; the
 * user still sees Gatekeeper's "unidentified developer" prompt the
 * first time and bypasses it via System Settings → Privacy & Security
 * → Open Anyway. A proper Developer ID + notarization removes that
 * prompt entirely but costs $99/yr and is a funding decision, not a
 * technical requirement.
 *
 * No-op on Windows / Linux (electron-builder calls afterSign there too,
 * with `electronPlatformName` set to the target).
 */

"use strict";

const { execFileSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

module.exports = async function afterSign(context) {
  const { electronPlatformName, appOutDir, packager } = context;
  if (electronPlatformName !== "darwin") return;

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  if (!fs.existsSync(appPath)) {
    console.warn(`[after-sign] expected ${appPath} but it does not exist; skipping ad-hoc sign.`);
    return;
  }

  // `--force` replaces any pre-existing signature (Electron ships its
  // framework pre-signed by the upstream project; if we leave that in
  // place the outer ad-hoc sig won't validate against the inner one).
  // `--deep` recurses into Frameworks/, Helpers, MachO inside Resources
  // (the bundled Codex Rust binary lives under .../app.asar.unpacked/
  // electron/codex-bin/.../codex).
  // `--sign -` is the documented ad-hoc identity sigil.
  console.log(`[after-sign] ad-hoc signing ${appPath}`);
  execFileSync(
    "codesign",
    ["--force", "--deep", "--sign", "-", "--timestamp=none", appPath],
    { stdio: "inherit" },
  );

  // Sanity check: verify the signature validates. `--verify --deep`
  // walks every nested Mach-O and surfaces any helper we missed.
  execFileSync("codesign", ["--verify", "--deep", "--strict", appPath], {
    stdio: "inherit",
  });
  console.log(`[after-sign] ad-hoc signature verified.`);
};
