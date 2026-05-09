/**
 * Thin wrapper around @openai/codex-sdk that gives us:
 *   - lazily-initialized singleton
 *   - sane defaults for "answer-only" mode (read-only sandbox, no approvals,
 *     web search off by default)
 *   - a `runJson` helper that runs a one-shot turn against an output-schema
 *     and returns the parsed JSON, with retry-on-parse-failure
 */

import { Codex } from "@openai/codex-sdk";
import type { ThreadOptions } from "@openai/codex-sdk";
import os from "node:os";

// codex requires a working directory it can write traces to. Use a per-process
// scratch dir under the OS temp folder so we never accidentally touch the repo.
const SCRATCH_DIR = `${os.tmpdir()}/codex-braynr-scratch`;
import fs from "node:fs";
fs.mkdirSync(SCRATCH_DIR, { recursive: true });

let _codex: Codex | null = null;

function getCodex(): Codex {
  if (_codex) return _codex;
  _codex = new Codex({
    config: {
      // disable image generation so we can use 'low' reasoning; the demo is
      // text-only so there is nothing to lose.
      tools: { image_gen: false },
    },
  });
  return _codex;
}

export type RunOptions = {
  /** Defaults to "low" — fastest answer-only model setting that allows tools=image_gen=false. */
  reasoning?: "low" | "medium" | "high";
  /** Allow live web search for this call (e.g. legal citations). */
  webSearch?: boolean;
  /** AbortSignal forwarded to the underlying child process. */
  signal?: AbortSignal;
  /** Override default thread options. */
  threadOverrides?: Partial<ThreadOptions>;
};

function buildThread(opts: RunOptions = {}) {
  const codex = getCodex();
  return codex.startThread({
    sandboxMode: "read-only",
    approvalPolicy: "never",
    skipGitRepoCheck: true,
    workingDirectory: SCRATCH_DIR,
    modelReasoningEffort: opts.reasoning ?? "low",
    webSearchEnabled: opts.webSearch ?? false,
    ...(opts.threadOverrides ?? {}),
  });
}

/**
 * Run a single turn that must return JSON conforming to the supplied schema.
 * Retries once if the model returns un-parseable text.
 */
export async function runJson<T>(
  prompt: string,
  outputSchema: object,
  opts: RunOptions = {},
): Promise<{ data: T; usage: unknown }> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const thread = buildThread(opts);
    try {
      const turn = await thread.run(prompt, {
        outputSchema,
        signal: opts.signal,
      });
      const text = turn.finalResponse?.trim();
      if (!text) throw new Error("Empty finalResponse from codex");
      // The schema-enforced response is typically pure JSON, but sometimes
      // wraps in code fences when the model is chatty. Strip those.
      const cleaned = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```$/i, "")
        .trim();
      return { data: JSON.parse(cleaned) as T, usage: turn.usage };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error("runJson failed");
}
