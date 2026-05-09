/**
 * POST /api/analyze-pdf
 *   { docId, pageIndex }
 *
 * Returns: { concepts: DetectedConcept[], anchors: { id: { endX, endY, fontHeight } | null } }
 *
 * Calls codex once per page with outputSchema=detectionSchema. Then locates
 * each concept's anchor inside the page text-item layout so the client knows
 * where to draw the tag pill.
 */

import { NextResponse } from "next/server";
import { runJson } from "@/lib/codex";
import { detectionSchema } from "@/lib/schemas";
import type { DetectionResult } from "@/lib/schemas";
import { getDoc } from "@/lib/store";
import { locateAnchor } from "@/lib/pdf-extract";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM = `You are Braynr Visualizer's concept-extraction agent.

GOAL
Given the text of ONE page from a textbook-style PDF, identify the concepts
that would benefit MOST from a visual aid sitting next to the reader.

For each concept choose ONE renderer:
  • "3d"      — physical objects with meaningful 3D structure
                (organs, molecules, cells, anatomical regions, buildings,
                mechanical parts).
  • "2d-anim" — physical processes, simulations, mechanisms in motion
                (inclined plane, pendulum, blood flow path, chemical reaction
                progress, projectile trajectory, spring oscillation).
  • "formula" — equations, derivations, mathematical statements that benefit
                from a step-by-step LaTeX walkthrough.
  • "graph"   — function plots, scatter, bar charts, distributions, time
                series.
  • "2d-text" — citations, named statutes, articles, court rulings, named
                papers/sources, definitions where the visualizer should show
                an authoritative quote or summary.

RULES
1. Pick AT MOST 4 concepts per page. Quality over quantity. Skip pages with
   no good visualization candidates by returning an empty list.
2. Each concept's "anchor" MUST be a verbatim copy of the LAST 30–80
   characters of the sentence that introduces it, taken EXACTLY from the
   passage text (no paraphrase). The tag pill will be planted right after
   this anchor — so the anchor string MUST appear once, and the renderer
   anchors at its tail. Pick anchors that are unique on the page.
3. "label" is what shows on the pill (≤ 35 chars), in the language of the
   surrounding text.
4. "context" gives the visualizer everything it needs to render the concept
   without re-reading the full page: include the concept name, key
   parameters mentioned in the text, and the field of study. 1–3 sentences.
5. Avoid trivial picks (page numbers, headings, generic phrases). Avoid
   duplicates with the same concept across the page.

OUTPUT
A single JSON object conforming to the supplied schema. No prose.`;

export async function POST(req: Request) {
  const body = (await req.json()) as { docId?: string; pageIndex?: number };
  const docId = body.docId;
  const pageIndex = body.pageIndex;
  if (!docId || pageIndex == null) {
    return NextResponse.json({ error: "docId and pageIndex required" }, { status: 400 });
  }
  const doc = getDoc(docId);
  if (!doc) return NextResponse.json({ error: "doc not found" }, { status: 404 });
  const page = doc.extracted.pages[pageIndex];
  if (!page) return NextResponse.json({ error: "page out of range" }, { status: 400 });

  // Skip very short pages (title page etc.)
  if (page.text.length < 120) {
    return NextResponse.json({ concepts: [], anchors: {} });
  }

  const prompt = `${SYSTEM}\n\n--- PAGE ${pageIndex + 1} TEXT ---\n${page.text}\n--- END PAGE ---`;

  const { data } = await runJson<DetectionResult>(prompt, detectionSchema, {
    reasoning: "low",
  });

  // Locate anchors so the client can position pills.
  const anchors: Record<number, { endX: number; endY: number; fontHeight: number } | null> = {};
  data.concepts.forEach((c, idx) => {
    anchors[idx] = locateAnchor(page, c.anchor);
  });

  return NextResponse.json({
    concepts: data.concepts,
    anchors,
    pageWidth: page.width,
    pageHeight: page.height,
  });
}
