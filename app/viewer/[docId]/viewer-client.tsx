"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, RefreshCw, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

import PdfViewer, { type Tag } from "@/components/PdfViewer";
import Visualizer from "@/components/Visualizer";
import type { DetectedConcept, VizSpec, VizType } from "@/lib/schemas";

const MAX_CONCURRENT_VIZ_GEN = 4;

type DocMeta = {
  docId: string;
  filename: string;
  pdfUrl: string;
  numPages: number;
  pages: Array<{ pageIndex: number; width: number; height: number; text: string }>;
};

type AnalyzeResult = {
  concepts: DetectedConcept[];
  anchors: Record<number, { endX: number; endY: number; fontHeight: number } | null>;
  pageWidth: number;
  pageHeight: number;
};

type TagState = Tag & {
  concept: DetectedConcept;
  spec?: VizSpec;
  error?: string;
};

const FILENAME_TO_TITLE: Record<string, string> = {
  "anatomy.pdf": "Anatomy & Physiology",
  "physics.pdf": "Classical Mechanics",
  "costituzione.pdf": "Costituzione Italiana",
  "calculus.pdf": "Differential & Integral Calculus",
  "chemistry.pdf": "Organic Chemistry",
};

export default function ViewerClient({ docId }: { docId: string }) {
  const [meta, setMeta] = useState<DocMeta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tags, setTags] = useState<TagState[]>([]);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [pagesAnalyzing, setPagesAnalyzing] = useState<Set<number>>(new Set());
  const [pagesAnalyzed, setPagesAnalyzed] = useState<Set<number>>(new Set());

  // ── Load document metadata ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/doc/${docId}`)
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(
            r.status === 404
              ? "This document is no longer in memory. Please re-upload from the home page."
              : `Could not load document (HTTP ${r.status})`,
          );
        }
        return (await r.json()) as DocMeta;
      })
      .then((m) => {
        if (!cancelled) setMeta(m);
      })
      .catch((e) => {
        if (!cancelled) setLoadError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [docId]);

  const docTitle = useMemo(
    () => meta && (FILENAME_TO_TITLE[meta.filename] || meta.filename.replace(/\.pdf$/i, "")),
    [meta],
  );

  // ── Page-by-page concept detection + queued viz generation ───────────
  const analyzedRef = useRef<Set<number>>(new Set());
  const vizQueueRef = useRef<TagState[]>([]);
  const vizInflightRef = useRef(0);

  useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    const ctrls: AbortController[] = [];

    function pumpVizQueue() {
      while (vizInflightRef.current < MAX_CONCURRENT_VIZ_GEN && vizQueueRef.current.length) {
        const next = vizQueueRef.current.shift()!;
        vizInflightRef.current++;
        const ctrl = new AbortController();
        ctrls.push(ctrl);
        fetch("/api/generate-viz", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            type: next.type,
            label: next.concept.label,
            context: next.concept.context,
            docTitle,
          }),
          signal: ctrl.signal,
        })
          .then(async (r) => {
            if (!r.ok) {
              const txt = await r.text().catch(() => "");
              throw new Error(`generate-viz ${r.status}: ${txt.slice(0, 200)}`);
            }
            return (await r.json()) as VizSpec;
          })
          .then((spec) => {
            if (cancelled) return;
            setTags((prev) =>
              prev.map((t) => (t.id === next.id ? { ...t, spec, ready: true } : t)),
            );
          })
          .catch((e) => {
            // Suppress aborts (component unmount, page navigation).
            if (
              cancelled ||
              ctrl.signal.aborted ||
              (e as Error).name === "AbortError" ||
              ((e as Error).message || "").includes("Failed to fetch")
            ) {
              return;
            }
            console.error("viz generation error for", next.label, e);
            setTags((prev) =>
              prev.map((t) =>
                t.id === next.id ? { ...t, error: (e as Error).message, ready: false } : t,
              ),
            );
          })
          .finally(() => {
            vizInflightRef.current--;
            if (!cancelled) pumpVizQueue();
          });
      }
    }

    async function runOne(pageIndex: number) {
      if (analyzedRef.current.has(pageIndex)) return;
      analyzedRef.current.add(pageIndex);
      setPagesAnalyzing((s) => new Set(s).add(pageIndex));
      const ctrl = new AbortController();
      ctrls.push(ctrl);
      try {
        const r = await fetch("/api/analyze-pdf", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ docId, pageIndex }),
          signal: ctrl.signal,
        });
        if (!r.ok) throw new Error(`analyze failed ${r.status}`);
        const j = (await r.json()) as AnalyzeResult;
        if (cancelled) return;
        const newTags: TagState[] = j.concepts
          .map((c, i) => {
            const a = j.anchors[i];
            if (!a) return null;
            return {
              id: `${pageIndex}-${i}`,
              page: pageIndex,
              endX: a.endX,
              endY: a.endY,
              fontHeight: a.fontHeight,
              type: c.type as VizType,
              label: c.label,
              ready: false,
              concept: c,
            };
          })
          .filter((t): t is TagState => t !== null);
        setTags((prev) => [...prev, ...newTags]);
        vizQueueRef.current.push(...newTags);
        pumpVizQueue();
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        console.error(`page ${pageIndex} analyze error`, e);
      } finally {
        if (!cancelled) {
          setPagesAnalyzing((s) => {
            const n = new Set(s);
            n.delete(pageIndex);
            return n;
          });
          setPagesAnalyzed((s) => new Set(s).add(pageIndex));
        }
      }
    }

    // Run pages in parallel, but cap concurrency at 3 to avoid hammering codex.
    const queue = Array.from({ length: meta.numPages }, (_, i) => i);
    const workers = Array.from({ length: 3 }, async () => {
      while (queue.length) {
        const idx = queue.shift();
        if (idx == null) return;
        await runOne(idx);
      }
    });
    Promise.all(workers).catch(() => {});

    return () => {
      cancelled = true;
      vizQueueRef.current = [];
      ctrls.forEach((c) => {
        try {
          c.abort();
        } catch {}
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, docId]);

  const activeTag = tags.find((t) => t.id === activeTagId) ?? null;
  const activeSpec = activeTag?.spec ?? null;

  // Auto-select the first ready tag the moment it becomes ready, so the
  // visualizer panel isn't empty when the user is waiting for tags.
  useEffect(() => {
    if (activeTagId) return;
    const firstReady = tags.find((t) => t.ready);
    if (firstReady) setActiveTagId(firstReady.id);
  }, [tags, activeTagId]);

  const handleTagClick = useCallback((id: string) => {
    setActiveTagId(id);
  }, []);

  if (loadError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-950 text-white">
        <AlertCircle className="h-7 w-7 text-rose-400" />
        <p className="text-sm text-white/80">{loadError}</p>
        <Link
          href="/"
          className="rounded-full bg-white/10 px-4 py-1.5 text-sm hover:bg-white/20"
        >
          Back to upload
        </Link>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white/60">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> loading document…
      </div>
    );
  }

  const detecting = pagesAnalyzing.size > 0;
  const totalPages = meta.numPages;
  const doneCount = pagesAnalyzed.size;
  const tagReadyCount = tags.filter((t) => t.ready).length;
  const tagPendingCount = tags.length - tagReadyCount;

  return (
    <div className="flex h-screen flex-col bg-slate-950">
      <header className="z-10 flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-slate-950/80 px-4 py-2.5 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs text-white/70 hover:bg-white/10"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
          <div className="flex items-center gap-2 text-white/80">
            <FileText className="h-4 w-4 text-white/40" />
            <p className="truncate text-sm font-medium">{docTitle ?? meta.filename}</p>
            <span className="text-xs text-white/40">· {meta.numPages} pages</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-white/55">
          <ProgressChip
            label="pages analyzed"
            value={doneCount}
            total={totalPages}
            spinning={detecting}
          />
          <ProgressChip
            label="visualizations ready"
            value={tagReadyCount}
            total={tagReadyCount + tagPendingCount}
            spinning={tagPendingCount > 0}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 border-r border-white/10">
          <PdfViewer
            pdfUrl={meta.pdfUrl}
            numPages={meta.numPages}
            pageDims={meta.pages.map((p) => ({ width: p.width, height: p.height }))}
            tags={tags}
            activeTagId={activeTagId}
            onTagClick={handleTagClick}
            detecting={detecting}
          />
        </div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-[44%] min-w-[420px] max-w-[720px] bg-gradient-to-br from-slate-900 via-slate-950 to-black"
        >
          <Visualizer
            spec={activeSpec}
            loading={activeTag != null && !activeTag.ready && !activeTag.error}
            emptyHint={
              tags.length === 0
                ? "codex is reading the document — tags will appear inline as soon as they're detected."
                : "Click any colored tag in the document to render its concept here."
            }
          />
          {activeTag?.error && (
            <div className="border-t border-rose-500/30 bg-rose-950/40 px-5 py-3 text-xs text-rose-200">
              {activeTag.error}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function ProgressChip({
  label,
  value,
  total,
  spinning,
}: {
  label: string;
  value: number;
  total: number;
  spinning?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1">
      {spinning && <RefreshCw className="h-3 w-3 animate-spin text-fuchsia-300" />}
      <span className="tabular-nums text-white/85">
        {value}
        <span className="text-white/40">/{total}</span>
      </span>
      <span className="text-white/45">{label}</span>
    </div>
  );
}
