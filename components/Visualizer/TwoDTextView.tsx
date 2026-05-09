"use client";

import ReactMarkdown from "react-markdown";
import { ExternalLink } from "lucide-react";
import type { TwoDTextSpec } from "@/lib/schemas";

type Props = { spec: TwoDTextSpec };

export default function TwoDTextView({ spec }: Props) {
  return (
    <div className="h-full w-full overflow-auto px-6 py-5 text-slate-200">
      <article className="prose prose-invert prose-sm max-w-none prose-headings:text-white prose-strong:text-white prose-a:text-sky-300">
        <ReactMarkdown>{spec.body_markdown}</ReactMarkdown>
      </article>
      {spec.citations.length > 0 && (
        <div className="mt-6 border-t border-white/10 pt-4">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-white/40">
            Sources
          </p>
          <ul className="space-y-2 text-xs">
            {spec.citations.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 inline-block h-5 w-5 shrink-0 rounded bg-white/10 text-center text-[10px] leading-5 text-white/60">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-slate-200">{c.label}</p>
                  <p className="text-slate-400">{c.source}</p>
                  {c.url && (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 text-sky-300 hover:text-sky-200"
                    >
                      {new URL(c.url).hostname}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
