/**
 * Build-time and runtime configuration.
 *
 * Public flags must be prefixed with NEXT_PUBLIC_ so Next.js inlines them
 * into the client bundle.
 */

/**
 * If true (default), the moment a page's tags come back from detection we
 * eagerly fire visualization generation for every tag in parallel — the
 * user sees the right pane fill in by itself. This is the production UX.
 *
 * If false, generation is deferred and only kicked off when the user
 * actually clicks a tag. Useful during dev so we don't burn tokens on
 * every page load.
 *
 * The check uses `!== "false"` so any other value (or unset) defaults to
 * the eager / production behavior.
 */
export const AUTO_GENERATE_VIZ =
  process.env.NEXT_PUBLIC_AUTO_GENERATE_VIZ !== "false";

/**
 * When the visualizer fails to compile or run a generated spec (typically
 * a SyntaxError in LLM-emitted Three.js / Canvas code), we hand the broken
 * code + the error message back to codex and ask it to regenerate. This
 * sets the maximum number of additional generation calls per tag. So the
 * total number of attempts is `1 + MAX_VIZ_GEN_RETRIES`.
 *
 * Default: 3 (i.e. up to 4 generation calls per tag).
 */
export const MAX_VIZ_GEN_RETRIES = (() => {
  const raw = process.env.NEXT_PUBLIC_MAX_VIZ_GEN_RETRIES;
  if (!raw) return 3;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 3;
})();
