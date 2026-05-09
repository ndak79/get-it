/**
 * POST /api/generate-viz
 *   { type: VizType, label: string, context: string, docTitle?: string }
 *
 * Returns: VizSpec (object matching the type's schema)
 *
 * Uses codex with the per-type outputSchema. For "2d-text" we enable
 * web search so the agent can ground citations. For 3D / 2D-anim we use
 * medium reasoning because we're asking it to write actual code.
 */

import { NextResponse } from "next/server";
import { runJson } from "@/lib/codex";
import { vizSchemaFor, type VizSpec, type VizType, VIZ_TYPES } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 180;

const PROMPTS: Record<VizType, (ctx: { label: string; context: string; docTitle?: string }) => string> = {
  "3d": ({ label, context, docTitle }) => `You are Braynr Visualizer's 3D scene generator.

CONCEPT: ${label}
FIELD: ${docTitle ?? "general"}
CONTEXT: ${context}

Produce a JSON object matching the schema. The "setup_code" field MUST be a
JavaScript function BODY (do NOT wrap in 'function setup() { ... }') that
will be invoked as new Function("api", body)({ THREE, scene, camera, renderer, controls, group }).

The body MUST do all of:
  - position camera somewhere sensible (e.g. camera.position.set(0, 1.6, 4))
  - set scene.background = new THREE.Color('#0b1020')
  - add ambient + directional lights
  - build meshes representing the concept and add them to 'group' (the
    framework will spin/orbit the group). Be CREATIVE and accurate: if it
    is a heart, build atria + ventricles + aorta; if it's methane, central
    carbon + 4 hydrogens at tetrahedral angles; if benzene, hexagonal
    carbon ring with hydrogens and a torus for the pi system; if a cell,
    nucleus + organelles spheres.
  - return an object with an optional update(t) callback for animation.

CONSTRAINTS:
  - Use ONLY 'THREE' (already imported) and standard math globals (Math, etc).
  - DO NOT use external loaders, textures, or images.
  - DO NOT use 'document', 'window', 'fetch', 'import', 'require', 'eval'.
  - DO NOT use OrbitControls — the framework already auto-rotates the
    group and reacts to pointer drag/scroll. Ignore the 'controls' arg.
  - Keep total scene under ~500 primitives.
  - All meshes must be added to 'group' (not 'scene') so the framework can
    orbit them.
  - Use plain string concatenation ('foo ' + x) NOT template literals
    (\`foo \${x}\`) — backticks tend to get mangled in JSON output.

Reply with the JSON object only.`,

  "2d-anim": ({ label, context, docTitle }) => `You are Braynr Visualizer's 2D Canvas animation generator.

CONCEPT: ${label}
FIELD: ${docTitle ?? "general"}
CONTEXT: ${context}

Produce a JSON object matching the schema. The "setup_code" field MUST be a
JavaScript function BODY invoked as
   new Function("api", body)({ ctx, width, height });
The body MUST return an object { draw(ctx, width, height, time, dt) }.

The draw callback runs every frame. Build an INFORMATIVE animation:
  - inclined plane: slope, block sliding with correct g sin(theta)
  - pendulum: bob swinging with correct period sqrt(L/g)
  - projectile: parabolic trajectory traced over time
  - spring oscillation: mass on spring with amplitude decay
  - blood flow: vessel cross section with cells flowing
  - reaction: 2 molecules colliding, forming product
  - water cycle, etc.

Always paint a dark navy background ('#0b1020') as the first step of draw().
Use crisp colors (#7dd3fc, #fbbf24, #f472b6, #a78bfa, #34d399, white) and
add labelled axes / annotations with ctx.fillText.

CONSTRAINTS:
  - DO NOT touch document, window, fetch, import, require, eval.
  - DO NOT load images.
  - Use only 'ctx' (CanvasRenderingContext2D) plus Math globals.
  - Restart the animation cleanly when 'time' resets to 0.
  - Use plain string concatenation ('foo ' + x) NOT template literals
    (\`foo \${x}\`) — backticks tend to get mangled in JSON output.

Reply with the JSON object only.`,

  formula: ({ label, context, docTitle }) => `You are Braynr Visualizer's formula generator.

CONCEPT: ${label}
FIELD: ${docTitle ?? "general"}
CONTEXT: ${context}

Produce a JSON object matching the schema:
  - main_latex: the headline equation (no $ delimiters; KaTeX-compatible).
  - steps: 2 to 6 derivation/explanation steps, each with one LaTeX line and
    a 1-sentence explanation. Walk the reader from definition to result.
Avoid \\begin{align} environments unless necessary; prefer simple lines.

Reply with the JSON object only.`,

  graph: ({ label, context, docTitle }) => `You are Braynr Visualizer's graph generator.

CONCEPT: ${label}
FIELD: ${docTitle ?? "general"}
CONTEXT: ${context}

Produce a JSON object matching the schema. The "data_json" field must be a
STRING containing JSON (it will be JSON.parse'd on the client). Pick a
chart_type and fill data_json accordingly:

  chart_type="function": data_json = '{"fn":"<expr in x>","x_min":-5,"x_max":5,"samples":200}'
     The expression must be valid JS using x and Math.* (e.g. "Math.sin(x)*x").
  chart_type="points":   data_json = '{"points":[[x,y], ...]}'
  chart_type="bars":     data_json = '{"bars":[{"label":"A","value":1.0}, ...]}'
  chart_type="lines":    data_json = '{"series":[{"name":"foo","color":"#7dd3fc","points":[[x,y],...]}]}'

Pick sensible domain & sampling. Make sure the chart visually communicates
the concept (e.g. range R = v0^2 sin(2 alpha)/g plotted as alpha sweeps 0
to 90; or the bell curve; or a parabola).

Reply with the JSON object only.`,

  "2d-text": ({ label, context, docTitle }) => `You are Braynr Visualizer's text-source generator.

CONCEPT: ${label}
FIELD: ${docTitle ?? "general"}
CONTEXT: ${context}

Produce a JSON object matching the schema. The viewer expects an
authoritative card: a title, short caption, a body in markdown that quotes
or summarises the cited source, and a list of 1–4 citations with stable
URLs (Wikipedia, official government sites, arxiv, etc).

If you have web search available, use it to confirm the citation text and
URL; otherwise produce the best high-confidence quote you know. Prefer
direct quotation in italics for legal articles. Add bracketed source labels
in the text like [1], [2] linking to the citations array order.

Reply with the JSON object only.`,
};

export async function POST(req: Request) {
  const body = (await req.json()) as {
    type?: VizType;
    label?: string;
    context?: string;
    docTitle?: string;
  };
  if (!body.type || !VIZ_TYPES.includes(body.type)) {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }
  if (!body.label || !body.context) {
    return NextResponse.json({ error: "label and context required" }, { status: 400 });
  }

  const schema = vizSchemaFor(body.type);
  const prompt = PROMPTS[body.type]({
    label: body.label,
    context: body.context,
    docTitle: body.docTitle,
  });

  // "low" is roughly 4-6× faster than "medium" and the code-gen quality is
  // good enough for our demo budget. We can always lift specific types back
  // up to "medium" if quality regresses.
  const reasoning = "low";
  const webSearch = body.type === "2d-text";

  const { data } = await runJson<VizSpec>(prompt, schema, {
    reasoning,
    webSearch,
  });

  return NextResponse.json(data);
}
