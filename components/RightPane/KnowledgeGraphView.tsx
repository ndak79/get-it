"use client";

/**
 * Knowledge graph view.
 *
 * Renders the doc's concept graph as an SVG. Layout is a small fixed-budget
 * force simulation done in-browser (no external deps): repulsion between
 * every pair of nodes + spring along each edge + soft centering. Stops
 * after a couple hundred ticks; placement is deterministic given the same
 * graph.
 *
 * Click a node → side panel with the four 0–100 evaluation bars, the
 * evaluator's per-node note, and quick links to chat / flashcards / feynman
 * pre-filled with that concept.
 *
 * Polls /api/kg/[docId]/state every 4 s while mounted so the user sees
 * scores rise in (near) real time after a tool interaction.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, AlertCircle, Sparkles, Network } from "lucide-react";
import type { KGEvaluation, KGNode, KGEdge, KnowledgeGraph } from "@/lib/kg-types";
import { masteryScore } from "@/lib/kg-types";

type Props = {
  docId: string;
  /**
   * Called when the user clicks a node-action shortcut (e.g. "chat about this
   * concept"). Lets the right pane switch mode and jump straight in.
   */
  onJumpToTool?: (tool: "chat" | "flashcards" | "feynman", topic: string) => void;
};

export default function KnowledgeGraphView({ docId, onJumpToTool }: Props) {
  const [kg, setKg] = useState<KnowledgeGraph | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);

  const fetchState = useCallback(async () => {
    try {
      const r = await fetch(`/api/kg/${docId}/state`, { cache: "no-store" });
      if (!r.ok) throw new Error(`state ${r.status}`);
      const j = (await r.json()) as KnowledgeGraph;
      setKg(j);
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [docId]);

  // Initial load + ensure-build on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchState();
      if (cancelled) return;
      // Trigger a build if we haven't yet.
      const r = await fetch(`/api/kg/${docId}/state`).then((x) => x.json());
      if (cancelled) return;
      if (r.status === "missing") {
        setBuilding(true);
        try {
          await fetch(`/api/kg/${docId}/build`, { method: "POST" });
          await fetchState();
        } catch (e) {
          setLoadError((e as Error).message);
        } finally {
          if (!cancelled) setBuilding(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [docId, fetchState]);

  // Poll while open. We poll a bit more aggressively while the graph is
  // building or while the evaluation count is < some small number; once
  // things settle we slow down.
  useEffect(() => {
    if (!kg) return;
    const interval = kg.status === "building" ? 2500 : 4500;
    const t = setInterval(() => {
      fetchState();
    }, interval);
    return () => clearInterval(t);
  }, [kg, fetchState]);

  if (loadError && !kg) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <AlertCircle className="h-6 w-6 text-rose-500" />
        <p className="text-[13px] text-[var(--ink-700)]">Couldn&apos;t load the knowledge graph.</p>
        <p className="text-[11px] text-[var(--ink-400)]">{loadError}</p>
      </div>
    );
  }

  if (!kg || kg.status === "building" || building) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--ink-400)] [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--ink-400)] [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--ink-400)] [animation-delay:300ms]" />
        </div>
        <p className="text-[12.5px] text-[var(--ink-500)]">
          codex is mapping the document&apos;s concept graph
        </p>
        <p className="text-[10.5px] text-[var(--ink-400)]">
          this runs once per document, in parallel with concept detection
        </p>
      </div>
    );
  }

  if (kg.status === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <AlertCircle className="h-6 w-6 text-rose-500" />
        <p className="text-[13px] text-[var(--ink-700)]">Graph build failed.</p>
        <p className="text-[11px] text-[var(--ink-400)]">{kg.buildError}</p>
        <button
          type="button"
          onClick={async () => {
            setBuilding(true);
            try {
              await fetch(`/api/kg/${docId}/build`, { method: "POST" });
              await fetchState();
            } finally {
              setBuilding(false);
            }
          }}
          className="mt-2 rounded-md bg-[var(--ink-900)] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-black"
        >
          Retry
        </button>
      </div>
    );
  }

  if (kg.status === "missing") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <Network className="h-7 w-7 text-[var(--ink-400)]" />
        <p className="text-[13px] text-[var(--ink-700)]">No graph yet.</p>
      </div>
    );
  }

  const selected = kg.nodes.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Global note ribbon */}
        {kg.globalNote && (
          <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-5 py-2.5">
            <p className="flex items-start gap-1.5 text-[12.5px] leading-relaxed text-[var(--ink-700)]">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent-600)]" />
              <span>{kg.globalNote}</span>
            </p>
            <p className="mt-1 text-[10.5px] text-[var(--ink-400)]">
              {kg.lastEvaluatedAt
                ? `last evaluated ${humanise(kg.lastEvaluatedAt)} · ${kg.evaluationCount} pass${kg.evaluationCount === 1 ? "" : "es"}`
                : "no evaluations yet — interact with a tool to see scores update"}
            </p>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-hidden">
          <GraphCanvas
            nodes={kg.nodes}
            edges={kg.edges}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      </div>

      {selected && (
        <NodeDetail
          node={selected}
          onClose={() => setSelectedId(null)}
          onJumpToTool={onJumpToTool}
        />
      )}
    </div>
  );
}

function humanise(ts: number): string {
  const dt = Date.now() - ts;
  if (dt < 30_000) return "just now";
  if (dt < 60_000) return `${Math.round(dt / 1000)}s ago`;
  if (dt < 3_600_000) return `${Math.round(dt / 60_000)}m ago`;
  return `${Math.round(dt / 3_600_000)}h ago`;
}

// ── Force-directed layout ─────────────────────────────────────────────

type LaidOutNode = KGNode & { x: number; y: number };

function layout(nodes: KGNode[], edges: KGEdge[]): LaidOutNode[] {
  const N = nodes.length;
  if (N === 0) return [];
  // Deterministic seed based on id hash so the layout is stable across reloads.
  const seeded = nodes.map((n, i) => {
    const h = hash(n.id);
    const angle = (i / N) * Math.PI * 2 + (h % 1000) / 1000;
    const r = 0.4 + ((h >> 10) % 1000) / 5000;
    return {
      ...n,
      x: 0.5 + Math.cos(angle) * r,
      y: 0.5 + Math.sin(angle) * r,
    } as LaidOutNode;
  });

  const adj = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    if (!adj.has(e.target)) adj.set(e.target, new Set());
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);
  }

  const REPULSION = 0.012; // pairwise push (in normalised square)
  const SPRING = 0.06;     // pull along edges
  const TARGET_LEN = 0.18;
  const CENTER = 0.005;
  const ITER = 220;

  for (let it = 0; it < ITER; it++) {
    // Repulsion
    const fx = new Array(N).fill(0);
    const fy = new Array(N).fill(0);
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = seeded[i].x - seeded[j].x;
        const dy = seeded[i].y - seeded[j].y;
        const d2 = dx * dx + dy * dy + 1e-4;
        const f = REPULSION / d2;
        fx[i] += dx * f;
        fy[i] += dy * f;
        fx[j] -= dx * f;
        fy[j] -= dy * f;
      }
    }
    // Spring
    for (const e of edges) {
      const a = seeded.findIndex((n) => n.id === e.source);
      const b = seeded.findIndex((n) => n.id === e.target);
      if (a < 0 || b < 0) continue;
      const dx = seeded[b].x - seeded[a].x;
      const dy = seeded[b].y - seeded[a].y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1e-4;
      const stretch = (d - TARGET_LEN) * SPRING;
      const ux = dx / d;
      const uy = dy / d;
      fx[a] += ux * stretch;
      fy[a] += uy * stretch;
      fx[b] -= ux * stretch;
      fy[b] -= uy * stretch;
    }
    // Soft pull to center
    for (let i = 0; i < N; i++) {
      fx[i] += (0.5 - seeded[i].x) * CENTER;
      fy[i] += (0.5 - seeded[i].y) * CENTER;
    }
    // Apply
    const damping = 1 - it / (ITER * 1.4); // gradually freeze
    for (let i = 0; i < N; i++) {
      seeded[i].x += fx[i] * damping;
      seeded[i].y += fy[i] * damping;
      // Soft walls
      seeded[i].x = Math.max(0.05, Math.min(0.95, seeded[i].x));
      seeded[i].y = Math.max(0.05, Math.min(0.95, seeded[i].y));
    }
  }

  return seeded;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) * 16777619;
  }
  return h >>> 0;
}

// ── Canvas ────────────────────────────────────────────────────────────

function GraphCanvas({
  nodes,
  edges,
  selectedId,
  onSelect,
}: {
  nodes: KGNode[];
  edges: KGEdge[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 400 });

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const laid = useMemo(() => layout(nodes, edges), [nodes, edges]);

  // node id -> mastery score (used for size/color)
  const masteryById = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of nodes) m.set(n.id, masteryScore(n.evaluation));
    return m;
  }, [nodes]);

  return (
    <div ref={containerRef} className="relative h-full w-full bg-white">
      <svg width={size.w} height={size.h} className="block">
        {/* Edges */}
        {edges.map((e, i) => {
          const a = laid.find((n) => n.id === e.source);
          const b = laid.find((n) => n.id === e.target);
          if (!a || !b) return null;
          const x1 = a.x * size.w;
          const y1 = a.y * size.h;
          const x2 = b.x * size.w;
          const y2 = b.y * size.h;
          const involves =
            selectedId && (selectedId === e.source || selectedId === e.target);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={involves ? "#4f5ae0" : "#d8d6d2"}
              strokeWidth={involves ? 1.6 : 1}
              opacity={selectedId && !involves ? 0.4 : 1}
            />
          );
        })}
        {/* Nodes */}
        {laid.map((n) => {
          const cx = n.x * size.w;
          const cy = n.y * size.h;
          const score = masteryById.get(n.id) ?? 0;
          const r = 7 + (score / 100) * 9; // 7..16
          const fill = scoreToColor(score);
          const isSelected = selectedId === n.id;
          return (
            <g
              key={n.id}
              transform={`translate(${cx}, ${cy})`}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(isSelected ? null : n.id);
              }}
            >
              <circle
                r={r + 4}
                fill="white"
                stroke={isSelected ? "#111113" : "transparent"}
                strokeWidth={isSelected ? 2 : 0}
              />
              <circle r={r} fill={fill} stroke="#fff" strokeWidth={1.5} />
              <text
                x={r + 6}
                y={4}
                fontSize={11}
                fill="#1a1a1d"
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {n.label.length > 32 ? n.label.slice(0, 32) + "…" : n.label}
              </text>
            </g>
          );
        })}
      </svg>
      {/* Background click to deselect */}
      <div
        className="absolute inset-0 -z-10"
        onClick={() => onSelect(null)}
      />
    </div>
  );
}

function scoreToColor(score: number): string {
  // 0   → soft slate     #b6b6ba
  // 25  → cool sky       #6c9bcd
  // 50  → calm violet    #8b78d9
  // 75  → fresh emerald  #4fae84
  // 100 → strong emerald #16a06d
  if (score < 1) return "#b6b6ba";
  if (score < 25) return "#7e9bc8";
  if (score < 50) return "#8b78d9";
  if (score < 75) return "#4fae84";
  return "#16a06d";
}

// ── Detail panel ──────────────────────────────────────────────────────

function NodeDetail({
  node,
  onClose,
  onJumpToTool,
}: {
  node: KGNode;
  onClose: () => void;
  onJumpToTool?: (tool: "chat" | "flashcards" | "feynman", topic: string) => void;
}) {
  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-[var(--border-subtle)] bg-[var(--surface-canvas)]">
      <header className="flex items-start justify-between gap-2 border-b border-[var(--border-subtle)] bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-400)]">
            Concept
          </p>
          <p className="mt-0.5 text-[14px] font-medium text-[var(--ink-900)]">{node.label}</p>
          {node.pageHints.length > 0 && (
            <p className="mt-1 text-[10.5px] text-[var(--ink-400)]">
              pages: {node.pageHints.join(", ")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="tab-icon-btn shrink-0"
          title="Close"
        >
          ×
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <p className="mb-4 text-[12.5px] leading-relaxed text-[var(--ink-700)]">{node.summary}</p>

        <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">
          Evaluation
        </p>
        <EvalBars e={node.evaluation} />

        <div className="my-4 h-px bg-[var(--border-subtle)]" />

        <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">
          What to work on
        </p>
        <p className="text-[12.5px] leading-relaxed text-[var(--ink-700)]">
          {node.evaluatorNote || (
            <span className="text-[var(--ink-400)]">
              No evaluator note yet — interact with this concept (chat, flashcards, or feynman) and
              an updated note will appear here.
            </span>
          )}
        </p>
      </div>

      <footer className="grid grid-cols-3 gap-1.5 border-t border-[var(--border-subtle)] bg-white p-2">
        <button
          type="button"
          onClick={() => onJumpToTool?.("chat", node.label)}
          className="rounded-md border border-[var(--border-subtle)] bg-white px-2 py-1.5 text-[11.5px] font-medium text-[var(--ink-700)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink-900)]"
        >
          Chat
        </button>
        <button
          type="button"
          onClick={() => onJumpToTool?.("flashcards", node.label)}
          className="rounded-md border border-[var(--border-subtle)] bg-white px-2 py-1.5 text-[11.5px] font-medium text-[var(--ink-700)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink-900)]"
        >
          Flashcards
        </button>
        <button
          type="button"
          onClick={() => onJumpToTool?.("feynman", node.label)}
          className="rounded-md border border-[var(--border-subtle)] bg-white px-2 py-1.5 text-[11.5px] font-medium text-[var(--ink-700)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink-900)]"
        >
          Feynman
        </button>
      </footer>
    </aside>
  );
}

function EvalBars({ e }: { e: KGEvaluation }) {
  return (
    <div className="space-y-2">
      <Bar label="Memory" value={e.memory} />
      <Bar label="Comprehension" value={e.comprehension} />
      <Bar label="Structure" value={e.structure} />
      <Bar label="Application" value={e.application} />
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-[11px]">
        <span className="text-[var(--ink-700)]">{label}</span>
        <span className="tabular-nums text-[var(--ink-500)]">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${Math.min(100, Math.max(0, value))}%`,
            background: scoreToColor(value),
          }}
        />
      </div>
    </div>
  );
}
