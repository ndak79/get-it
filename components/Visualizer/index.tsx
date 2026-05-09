"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Box, Activity, FileText, Sigma, BarChart3 } from "lucide-react";
import type { VizSpec, VizType } from "@/lib/schemas";
import ThreeDView from "./ThreeDView";
import TwoDAnimView from "./TwoDAnimView";
import TwoDTextView from "./TwoDTextView";
import FormulaView from "./FormulaView";
import GraphView from "./GraphView";

const TYPE_LABEL: Record<VizType, string> = {
  "3d": "3D Model",
  "2d-anim": "Animation",
  "2d-text": "Source",
  formula: "Formula",
  graph: "Graph",
};

const TYPE_ICON: Record<VizType, React.ComponentType<{ className?: string }>> = {
  "3d": Box,
  "2d-anim": Activity,
  "2d-text": FileText,
  formula: Sigma,
  graph: BarChart3,
};

type Props = {
  spec: VizSpec | null;
  loading?: boolean;
  emptyHint?: string;
};

export default function Visualizer({ spec, loading, emptyHint }: Props) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-slate-900/60 to-slate-900/30 px-5 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-lg">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">
              Braynr Visualizer
            </p>
            <p className="truncate text-sm font-semibold text-white">
              {spec ? spec.title : loading ? "Preparing visualization…" : "Pick a tag to begin"}
            </p>
          </div>
        </div>
        {spec && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-wider text-white/60">
            {(() => {
              const Icon = TYPE_ICON[spec.type];
              return <Icon className="h-3 w-3" />;
            })()}
            {TYPE_LABEL[spec.type]}
          </span>
        )}
      </header>

      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait">
          {loading && !spec && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="flex flex-col items-center gap-3 text-white/60">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-fuchsia-400 [animation-delay:0ms]" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400 [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400 [animation-delay:300ms]" />
                </div>
                <p className="text-xs">codex is composing the visualization</p>
              </div>
            </motion.div>
          )}

          {!spec && !loading && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center px-8 text-center"
            >
              <div className="max-w-sm">
                <div className="mb-4 flex justify-center gap-3 opacity-60">
                  {(["3d", "2d-anim", "formula", "graph", "2d-text"] as VizType[]).map((t) => {
                    const Icon = TYPE_ICON[t];
                    return (
                      <div key={t} className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
                        <Icon className="h-4 w-4 text-white/60" />
                      </div>
                    );
                  })}
                </div>
                <p className="text-sm text-white/70">
                  {emptyHint ?? "Click any tag in the document to render its concept here."}
                </p>
              </div>
            </motion.div>
          )}

          {spec && (
            <motion.div
              key={spec.title}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0"
            >
              {spec.type === "3d" && <ThreeDView spec={spec} />}
              {spec.type === "2d-anim" && <TwoDAnimView spec={spec} />}
              {spec.type === "2d-text" && <TwoDTextView spec={spec} />}
              {spec.type === "formula" && <FormulaView spec={spec} />}
              {spec.type === "graph" && <GraphView spec={spec} />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {spec && (
        <footer className="shrink-0 border-t border-white/10 bg-slate-950/40 px-5 py-3">
          <p className="text-xs leading-relaxed text-slate-300">{spec.caption}</p>
        </footer>
      )}
    </div>
  );
}
