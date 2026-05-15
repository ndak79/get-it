/**
 * Server-side background jobs for a doc.
 *
 * Two job kinds, both keyed by docId, both idempotent (calling
 * `ensureDetection`/`ensureVizQueue` while the same doc's job is already
 * running is a no-op):
 *
 *   • Detection job — walks pages that aren't yet in
 *     `tags.json#pagesAnalyzed`, calls the concept-detection agent for
 *     each, locates anchors against the extracted pdf items, persists
 *     new tags incrementally. When `autoGenerate` is on (settings.json
 *     → autoGenerate), every new tag is marked `generating: true` so
 *     the viz queue picks it up automatically.
 *
 *   • Viz queue — processes every tag with `generating: true && !error`,
 *     producing the spec via the viz agent. Carries the retry budget
 *     (settings.maxRetries) and the runtime-error repair path that
 *     used to live in the viewer. After each call the result lands in
 *     tags.json before we move on, so a client that has lost the
 *     connection picks up the work on its next poll.
 *
 * Rate-limit recovery: every Codex error of kind="rate_limit" carries a
 * retryAt timestamp; on hit we set a timer to re-enter the job once the
 * window clears. Auth-lost errors don't auto-retry — the user gets the
 * top-bar banner and walks back through the wizard.
 *
 * Both job runners write to disk via tags-store's atomic
 * (write+rename) helper, so concurrent reads from the viewer poll and
 * the library poll never see torn JSON.
 */

import { CodexError } from "./codex";
import { detectConceptsForPage } from "./agents/detect";
import { generateVizSpec } from "./agents/viz";
import { locateAnchor } from "./pdf-extract";
import { loadSettings } from "./settings-store";
import { getDoc } from "./store";
import {
  loadTags,
  saveTags,
  type PersistedTagServer,
  type PersistedTagsFile,
} from "./tags-store";
import type { DetectedConcept, VizType } from "./schemas";

const DETECTION_CONCURRENCY = 3;
const VIZ_CONCURRENCY = 4;
const MIN_PAGE_TEXT_LEN = 120;

// ── small helpers ───────────────────────────────────────────────────────

function ensureTagsFile(docId: string): PersistedTagsFile {
  const f = loadTags(docId);
  if (f) return f;
  saveTags(docId, { tags: [], activeTagId: null, pagesAnalyzed: [] });
  return loadTags(docId)!;
}

function docTitleFromFilename(filename: string): string {
  const FILENAME_TO_TITLE: Record<string, string> = {
    "anatomy.pdf": "Anatomy & Physiology",
    "physics.pdf": "Classical Mechanics",
    "costituzione.pdf": "Costituzione Italiana",
    "calculus.pdf": "Differential & Integral Calculus",
    "chemistry.pdf": "Organic Chemistry",
  };
  return FILENAME_TO_TITLE[filename] ?? filename.replace(/\.pdf$/i, "");
}

function mergeTagsFile(
  docId: string,
  mutator: (file: PersistedTagsFile) => PersistedTagsFile,
): PersistedTagsFile {
  const before = ensureTagsFile(docId);
  const after = mutator(before);
  saveTags(docId, {
    tags: after.tags,
    activeTagId: after.activeTagId,
    pagesAnalyzed: after.pagesAnalyzed,
  });
  return loadTags(docId)!;
}

// ── Detection job ───────────────────────────────────────────────────────

const detectionInFlight = new Map<string, Promise<void>>();
const detectionRetryTimer = new Map<string, NodeJS.Timeout>();

export function isDetectionRunning(docId: string): boolean {
  return detectionInFlight.has(docId);
}

export function ensureDetection(docId: string): void {
  if (detectionInFlight.has(docId)) return;
  // Clear any pending retry timer — we're starting now.
  const t = detectionRetryTimer.get(docId);
  if (t) {
    clearTimeout(t);
    detectionRetryTimer.delete(docId);
  }
  const p = runDetection(docId)
    .catch((e) =>
      console.warn("[jobs/detect]", docId, e instanceof Error ? e.message : e),
    )
    .finally(() => {
      detectionInFlight.delete(docId);
    });
  detectionInFlight.set(docId, p);
}

async function runDetection(docId: string) {
  const doc = getDoc(docId);
  if (!doc) return;
  ensureTagsFile(docId);
  const settings = loadSettings();
  const autoGenerate = settings.autoGenerate;

  // What pages still need a pass? Read fresh each loop tick — a viewer
  // poll or a manual click should never block detection from picking
  // up the next page.
  const pickNextPage = (): number | null => {
    const file = loadTags(docId);
    if (!file) return null;
    const analyzed = new Set(file.pagesAnalyzed);
    for (let i = 0; i < doc.extracted.numPages; i++) {
      if (!analyzed.has(i) && !inFlightPages.has(i)) return i;
    }
    return null;
  };

  const inFlightPages = new Set<number>();
  let rateLimitedRetryAt: number | null = null;
  let terminalCodexError: CodexError | null = null;

  await new Promise<void>((resolve) => {
    let active = 0;
    let done = false;

    const pump = () => {
      while (active < DETECTION_CONCURRENCY) {
        const page = pickNextPage();
        if (page == null) {
          if (active === 0 && !done) {
            done = true;
            resolve();
          }
          return;
        }
        inFlightPages.add(page);
        active++;
        analyzePage(docId, page, autoGenerate)
          .catch((e) => {
            // Rate-limit: stop pumping more pages, schedule a retry of
            // the whole detection job once the window clears.
            if (e instanceof CodexError && e.kind === "rate_limit" && e.retryAt) {
              rateLimitedRetryAt = e.retryAt;
            } else if (
              e instanceof CodexError &&
              (e.kind === "binary_missing" || e.kind === "auth_lost")
            ) {
              terminalCodexError = e;
            } else {
              console.warn(
                "[jobs/detect-page]",
                docId,
                page,
                e instanceof Error ? e.message : e,
              );
            }
          })
          .finally(() => {
            inFlightPages.delete(page);
            active--;
            if (rateLimitedRetryAt || terminalCodexError) {
              // Bail out of this run — schedule retry below.
              if (active === 0 && !done) {
                done = true;
                resolve();
              }
              return;
            }
            pump();
          });
      }
    };

    pump();
  });

  if (terminalCodexError) {
    throw terminalCodexError;
  }

  if (rateLimitedRetryAt) {
    const wait = Math.max(1000, rateLimitedRetryAt - Date.now() + 500);
    const t = setTimeout(() => {
      detectionRetryTimer.delete(docId);
      ensureDetection(docId);
    }, wait);
    detectionRetryTimer.set(docId, t);
  }
}

async function analyzePage(
  docId: string,
  pageIndex: number,
  autoGenerate: boolean,
) {
  const doc = getDoc(docId);
  if (!doc) return;
  const page = doc.extracted.pages[pageIndex];
  if (!page) return;
  // Skip very short pages but still mark analyzed so we don't loop on
  // them again.
  if (page.text.length < MIN_PAGE_TEXT_LEN) {
    appendDetectionResult(docId, pageIndex, [], autoGenerate);
    return;
  }
  const result = await detectConceptsForPage(pageIndex, page.text);
  const concepts: DetectedConcept[] = result.concepts;
  const newTags: PersistedTagServer[] = concepts
    .map((c, idx) => {
      const a = locateAnchor(page, c.anchor);
      if (!a) return null;
      return {
        id: `${pageIndex}-${idx}`,
        page: pageIndex,
        endX: a.endX,
        endY: a.endY,
        fontHeight: a.fontHeight,
        type: c.type as VizType,
        label: c.label,
        ready: false,
        generating: autoGenerate,
        concept: c,
      };
    })
    .filter((t): t is PersistedTagServer => t !== null);
  appendDetectionResult(docId, pageIndex, newTags, autoGenerate);
}

function appendDetectionResult(
  docId: string,
  pageIndex: number,
  newTags: PersistedTagServer[],
  autoGenerate: boolean,
) {
  let added = 0;
  mergeTagsFile(docId, (file) => {
    const existingIds = new Set(file.tags.map((t) => t.id));
    const fresh = newTags.filter((t) => !existingIds.has(t.id));
    added = fresh.length;
    const merged: PersistedTagsFile = {
      ...file,
      tags: [...file.tags, ...fresh],
      pagesAnalyzed: Array.from(new Set([...file.pagesAnalyzed, pageIndex])),
    };
    return merged;
  });
  if (autoGenerate && added > 0) ensureVizQueue(docId);
}

// ── Viz queue ───────────────────────────────────────────────────────────

const vizInFlight = new Map<string, Promise<void>>();
const vizRetryTimer = new Map<string, NodeJS.Timeout>();

export function isVizQueueRunning(docId: string): boolean {
  return vizInFlight.has(docId);
}

export function ensureVizQueue(docId: string): void {
  if (vizInFlight.has(docId)) return;
  const t = vizRetryTimer.get(docId);
  if (t) {
    clearTimeout(t);
    vizRetryTimer.delete(docId);
  }
  const p = runVizQueue(docId)
    .catch((e) =>
      console.warn("[jobs/viz]", docId, e instanceof Error ? e.message : e),
    )
    .finally(() => {
      vizInFlight.delete(docId);
    });
  vizInFlight.set(docId, p);
}

/**
 * Mark a tag as needing (re)generation and kick the queue.
 *
 * Called by the viewer's click handler (no runtimeError) and by the
 * sandbox's runtime-error reporter (with the captured message). Honors
 * the retry budget: tags that exhausted their attempts get a permanent
 * `error` and won't be re-queued.
 */
export function requestVizGeneration(
  docId: string,
  tagId: string,
  runtimeError?: string,
): void {
  const settings = loadSettings();
  const maxRetries = settings.maxRetries;
  mergeTagsFile(docId, (file) => ({
    ...file,
    tags: file.tags.map((t) => {
      if (t.id !== tagId) return t;
      const attemptsSoFar = t.attempts ?? 0;
      if (runtimeError && attemptsSoFar > maxRetries) {
        return {
          ...t,
          ready: false,
          generating: false,
          error: `Couldn't render this concept — the agent's code kept failing to compile after ${attemptsSoFar} attempts.`,
          lastRuntimeError: runtimeError,
        };
      }
      return {
        ...t,
        ready: false,
        generating: true,
        error: undefined,
        lastRuntimeError: runtimeError ?? t.lastRuntimeError,
      };
    }),
  }));
  ensureVizQueue(docId);
}

async function runVizQueue(docId: string) {
  const doc = getDoc(docId);
  if (!doc) return;
  const docTitle = docTitleFromFilename(doc.filename);
  let rateLimitedRetryAt: number | null = null;
  const inFlightTagIds = new Set<string>();

  const pickNextTag = (): PersistedTagServer | null => {
    const file = loadTags(docId);
    if (!file) return null;
    for (const t of file.tags) {
      if (t.generating && !t.error && !inFlightTagIds.has(t.id)) return t;
    }
    return null;
  };

  await new Promise<void>((resolve) => {
    let active = 0;
    let done = false;

    const pump = () => {
      while (active < VIZ_CONCURRENCY) {
        const tag = pickNextTag();
        if (!tag) {
          if (active === 0 && !done) {
            done = true;
            resolve();
          }
          return;
        }
        inFlightTagIds.add(tag.id);
        active++;
        processViz(docId, tag.id, docTitle)
          .catch((e) => {
            if (e instanceof CodexError && e.kind === "rate_limit" && e.retryAt) {
              rateLimitedRetryAt = e.retryAt;
            } else {
              console.warn(
                "[jobs/viz-tag]",
                docId,
                tag.id,
                e instanceof Error ? e.message : e,
              );
            }
          })
          .finally(() => {
            inFlightTagIds.delete(tag.id);
            active--;
            if (rateLimitedRetryAt) {
              if (active === 0 && !done) {
                done = true;
                resolve();
              }
              return;
            }
            pump();
          });
      }
    };

    pump();
  });

  if (rateLimitedRetryAt) {
    const wait = Math.max(1000, rateLimitedRetryAt - Date.now() + 500);
    const t = setTimeout(() => {
      vizRetryTimer.delete(docId);
      ensureVizQueue(docId);
    }, wait);
    vizRetryTimer.set(docId, t);
  }
}

async function processViz(docId: string, tagId: string, docTitle: string) {
  // Re-read the tag fresh — it may have been mutated by a runtime-error
  // report or another concurrent request between pickNextTag and now.
  const file = loadTags(docId);
  if (!file) return;
  const tag = file.tags.find((t) => t.id === tagId);
  if (!tag || !tag.generating || tag.error) return;

  const previousAttempt =
    tag.spec && tag.lastRuntimeError
      ? { spec: tag.spec, runtimeError: tag.lastRuntimeError }
      : undefined;

  try {
    const spec = await generateVizSpec({
      type: tag.type,
      label: tag.concept.label,
      context: tag.concept.context,
      docTitle,
      previousAttempt,
    });
    mergeTagsFile(docId, (f) => ({
      ...f,
      tags: f.tags.map((t) =>
        t.id === tagId
          ? {
              ...t,
              spec,
              ready: true,
              generating: false,
              attempts: (t.attempts ?? 0) + 1,
              lastRuntimeError: undefined,
              error: undefined,
            }
          : t,
      ),
    }));
  } catch (e) {
    if (e instanceof CodexError && e.kind === "rate_limit") {
      // Re-throw so the queue runner can pick up the retryAt timer.
      throw e;
    }
    const msg = e instanceof Error ? e.message : "viz generation failed";
    mergeTagsFile(docId, (f) => ({
      ...f,
      tags: f.tags.map((t) =>
        t.id === tagId
          ? {
              ...t,
              ready: false,
              generating: false,
              attempts: (t.attempts ?? 0) + 1,
              error: msg,
            }
          : t,
      ),
    }));
  }
}

// ── Status snapshot ─────────────────────────────────────────────────────

export function getJobStatus(docId: string): {
  detectionRunning: boolean;
  vizQueueRunning: boolean;
} {
  return {
    detectionRunning: isDetectionRunning(docId),
    vizQueueRunning: isVizQueueRunning(docId),
  };
}
