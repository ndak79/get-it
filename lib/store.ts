/**
 * In-memory + on-disk store for uploaded documents.
 * Process-local — we keep PDFs in /tmp/braynr-uploads/<docId>.pdf and the
 * extracted text in memory keyed by docId. Good enough for a single-user demo.
 *
 * NOTE: a Next.js dev server reloads modules on file changes, so this map is
 * also stashed on `globalThis` to survive HMR.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import type { ExtractedPdf } from "./pdf-extract";

export const UPLOADS_DIR = path.join(os.tmpdir(), "braynr-uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

type StoreEntry = {
  id: string;
  filename: string;
  uploadedAt: number;
  extracted: ExtractedPdf;
  /** Public URL the client can fetch the raw PDF from. */
  pdfUrl: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __braynrStore: Map<string, StoreEntry> | undefined;
}

const store: Map<string, StoreEntry> =
  globalThis.__braynrStore ?? (globalThis.__braynrStore = new Map());

export function newDocId(): string {
  return randomUUID();
}

export function pdfPath(docId: string): string {
  return path.join(UPLOADS_DIR, `${docId}.pdf`);
}

export function saveDoc(entry: StoreEntry): void {
  store.set(entry.id, entry);
}

export function getDoc(id: string): StoreEntry | undefined {
  return store.get(id);
}
