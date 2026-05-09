"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileUp, Loader2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

type Sample = {
  id: string;
  title: string;
  description: string;
  color: string;
  sizeKb: number;
};

export default function UploadCard() {
  const router = useRouter();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("/api/sample-pdfs")
      .then((r) => r.json())
      .then((j) => setSamples(j.samples || []))
      .catch(() => {});
  }, []);

  const startSample = useCallback(
    async (id: string) => {
      setError(null);
      setBusy(id);
      try {
        const fd = new FormData();
        fd.set("sample", id);
        const r = await fetch("/api/upload", { method: "POST", body: fd });
        if (!r.ok) throw new Error((await r.json()).error ?? "upload failed");
        const j = await r.json();
        router.push(`/viewer/${j.docId}`);
      } catch (e) {
        setError((e as Error).message);
        setBusy(null);
      }
    },
    [router],
  );

  const startUpload = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setError("Please pick a PDF file");
        return;
      }
      setBusy("upload");
      try {
        const fd = new FormData();
        fd.set("file", file);
        const r = await fetch("/api/upload", { method: "POST", body: fd });
        if (!r.ok) throw new Error((await r.json()).error ?? "upload failed");
        const j = await r.json();
        router.push(`/viewer/${j.docId}`);
      } catch (e) {
        setError((e as Error).message);
        setBusy(null);
      }
    },
    [router],
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fuchsia-400" />
          Live demo · powered by codex
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-gradient-to-br from-white via-fuchsia-100 to-violet-200 bg-clip-text text-5xl font-bold tracking-tight text-transparent md:text-6xl"
        >
          Read with a brain on your shoulder.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mx-auto mt-4 max-w-2xl text-base text-white/60 md:text-lg"
        >
          Drop in any well-tagged PDF. Braynr&apos;s agent reads it, picks the
          concepts that benefit from a picture, and renders them — 3D models,
          animated simulations, formulas, graphs, or live source citations —
          right next to the text.
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) startUpload(f);
        }}
        className={[
          "mt-10 cursor-pointer rounded-2xl border-2 border-dashed bg-white/[0.02] px-8 py-10 text-center transition-colors",
          dragOver
            ? "border-fuchsia-400/70 bg-fuchsia-400/10"
            : "border-white/10 hover:border-white/20",
        ].join(" ")}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) startUpload(f);
          }}
        />
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500/30 to-violet-500/30 ring-1 ring-fuchsia-300/30">
          {busy === "upload" ? (
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          ) : (
            <Upload className="h-5 w-5 text-white" />
          )}
        </div>
        <p className="text-sm font-medium text-white">
          {busy === "upload" ? "Uploading and parsing…" : "Drop a PDF here, or click to browse"}
        </p>
        <p className="mt-1 text-xs text-white/40">
          Best with text-tagged PDFs. We don&apos;t OCR images.
        </p>
      </motion.div>

      <div className="mt-12">
        <p className="mb-4 text-center text-[11px] uppercase tracking-[0.2em] text-white/40">
          Or try one of our sample documents
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {samples.map((s, i) => (
            <motion.button
              key={s.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              onClick={() => startSample(s.id)}
              disabled={busy != null}
              className="group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-5 text-left transition hover:border-white/20 hover:bg-white/[0.04] disabled:opacity-50"
            >
              <div className={`absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br ${s.color} opacity-30 blur-2xl`} />
              <div className="relative">
                <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${s.color} shadow`}>
                  <FileUp className="h-4 w-4 text-white" />
                </div>
                <p className="text-sm font-semibold text-white">{s.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-white/55">{s.description}</p>
                <div className="mt-3 flex items-center justify-between text-[11px] text-white/40">
                  <span>{s.sizeKb} KB</span>
                  {busy === s.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                  )}
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mt-6 text-center text-sm text-rose-300">{error}</p>
      )}
    </div>
  );
}
