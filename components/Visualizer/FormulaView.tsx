"use client";

import { useEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { FormulaSpec } from "@/lib/schemas";

function Tex({ tex, displayMode = true }: { tex: string; displayMode?: boolean }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      katex.render(tex, ref.current, {
        throwOnError: false,
        displayMode,
        strict: "ignore",
      });
    } catch (e) {
      ref.current.textContent = tex;
      console.error("KaTeX error", e);
    }
  }, [tex, displayMode]);
  return <span ref={ref} />;
}

type Props = { spec: FormulaSpec };

export default function FormulaView({ spec }: Props) {
  return (
    <div className="h-full w-full overflow-auto px-6 py-6 text-slate-200">
      <div className="rounded-xl bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-transparent p-6">
        <p className="mb-3 text-[10px] uppercase tracking-wider text-violet-300/80">
          Headline
        </p>
        <div className="text-2xl text-white">
          <Tex tex={spec.main_latex} />
        </div>
      </div>
      <p className="mt-5 mb-2 text-[10px] uppercase tracking-wider text-white/40">
        Step-by-step derivation
      </p>
      <ol className="space-y-3">
        {spec.steps.map((s, i) => (
          <li
            key={i}
            className="rounded-lg border border-white/5 bg-white/[0.03] p-4"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/20 text-[10px] text-violet-200">
                {i + 1}
              </span>
              <p className="text-xs text-slate-400">{s.explanation}</p>
            </div>
            <div className="text-base text-white">
              <Tex tex={s.latex} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
