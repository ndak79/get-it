"use client";

/**
 * Feynman method.
 *
 * The user IS the teacher; the AI plays a curious 8-year-old child that
 * asks short, pointed prompts. Sessions are bounded (4 turns) so the data
 * stays useful for the evaluator.
 *
 * UX must make this feel like teaching a kid — not being interrogated.
 * That's why:
 *   - the speech bubble looks like a child's question, not a quiz prompt
 *   - the input encourages plain language
 *   - we always show "you're explaining to a child", never "answer this"
 */

import { useCallback, useEffect, useState } from "react";
import { Baby, RefreshCw, Send, Trash2, Sparkles } from "lucide-react";
import type { FeynmanSession } from "@/lib/work-context-types";
import { consumePrefill } from "./prefill";

type Props = { docId: string };

type StartResp = {
  session: FeynmanSession;
  childPrompt: string;
  done: false;
  maxTurns: number;
};
type ExplainResp =
  | { session: FeynmanSession; childPrompt: string; done: false; maxTurns: number }
  | { session: FeynmanSession; done: true; summary: string; maxTurns: number };

export default function FeynmanView({ docId }: Props) {
  const [sessions, setSessions] = useState<FeynmanSession[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [pendingChildPrompt, setPendingChildPrompt] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maxTurns, setMaxTurns] = useState(4);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/feynman/${docId}`)
      .then((r) => r.json())
      .then((j: { sessions: FeynmanSession[]; maxTurns: number }) => {
        if (cancelled) return;
        setSessions(j.sessions);
        setMaxTurns(j.maxTurns);
        const prefill = consumePrefill(docId, "feynman");
        if (prefill) setTopic(prefill);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [docId]);

  const active = sessions?.find((s) => s.id === activeId) ?? null;

  const start = useCallback(async () => {
    const t = topic.trim();
    if (!t) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/feynman/${docId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "start", topic: t }),
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(`start failed (${r.status}): ${txt.slice(0, 120)}`);
      }
      const j = (await r.json()) as StartResp;
      setSessions((prev) => [j.session, ...(prev ?? [])]);
      setActiveId(j.session.id);
      setPendingChildPrompt(j.childPrompt);
      setDraft("");
      setMaxTurns(j.maxTurns);
      setTopic("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [docId, topic]);

  const explain = useCallback(async () => {
    if (!active || !pendingChildPrompt) return;
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    // Optimistic add of the user's reply.
    setSessions((prev) =>
      prev
        ? prev.map((s) =>
            s.id === active.id
              ? {
                  ...s,
                  turns: [
                    ...s.turns,
                    { childPrompt: pendingChildPrompt, userExplanation: text, ts: Date.now() },
                  ],
                }
              : s,
          )
        : prev,
    );
    setDraft("");
    setPendingChildPrompt(null);
    try {
      const r = await fetch(`/api/feynman/${docId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "explain",
          sessionId: active.id,
          userExplanation: text,
          childPrompt: pendingChildPrompt,
        }),
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(`explain failed (${r.status}): ${txt.slice(0, 120)}`);
      }
      const j = (await r.json()) as ExplainResp;
      setSessions((prev) =>
        prev ? prev.map((s) => (s.id === active.id ? j.session : s)) : prev,
      );
      if (!j.done) setPendingChildPrompt(j.childPrompt);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [active, docId, draft, pendingChildPrompt]);

  const deleteSession = useCallback(
    async (id: string) => {
      await fetch(`/api/feynman/${docId}?sessionId=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setSessions((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
      if (activeId === id) {
        setActiveId(null);
        setPendingChildPrompt(null);
      }
    },
    [activeId, docId],
  );

  if (sessions === null) {
    return (
      <div className="flex h-full items-center justify-center text-[12px] text-[var(--ink-500)]">
        <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> loading…
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-52 shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-canvas)]">
        <div className="m-2 rounded-md border border-[var(--border-subtle)] bg-white p-2">
          <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">
            Teach a topic
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. la circolazione del sangue"
            className="mb-2 w-full rounded border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1 text-[12px] focus:border-[var(--accent-500)] focus:outline-none"
            disabled={busy}
          />
          <button
            type="button"
            onClick={start}
            disabled={busy || !topic.trim()}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--ink-900)] py-1.5 text-[12px] font-medium text-white hover:bg-black disabled:opacity-50"
          >
            {busy ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> …
              </>
            ) : (
              <>
                <Baby className="h-3.5 w-3.5" /> Start session
              </>
            )}
          </button>
          {error && <p className="mt-2 text-[11px] text-rose-700">{error}</p>}
        </div>
        <div className="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">
          Past sessions
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
          {sessions.length === 0 ? (
            <p className="px-2 py-3 text-[11.5px] leading-relaxed text-[var(--ink-400)]">
              No sessions yet. Pick a topic above and explain it to the child.
            </p>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                className={`group flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-[11.5px] ${
                  activeId === s.id
                    ? "bg-white text-[var(--ink-900)] shadow-[0_1px_0_rgba(17,17,19,0.04)]"
                    : "text-[var(--ink-700)] hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(s.id);
                      setPendingChildPrompt(s.endedAt ? null : null /* resume via reload */);
                      setDraft("");
                    }}
                    className="min-w-0 flex-1 truncate text-left font-medium"
                    title={s.topic}
                  >
                    {s.topic}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSession(s.id)}
                    className="invisible h-5 w-5 shrink-0 rounded text-[var(--ink-400)] hover:bg-[var(--surface-sunken)] hover:text-rose-600 group-hover:visible"
                    title="Delete"
                  >
                    <Trash2 className="m-auto h-3 w-3" />
                  </button>
                </div>
                <div className="text-[10.5px] text-[var(--ink-400)]">
                  {s.turns.length}/{maxTurns} turns {s.endedAt ? "· done" : ""}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-white">
        {!active ? (
          <div className="flex flex-1 items-center justify-center px-8 text-center">
            <div className="max-w-sm">
              <Baby className="mx-auto mb-3 h-8 w-8 text-[var(--ink-400)]" />
              <p className="text-[13.5px] leading-relaxed text-[var(--ink-500)]">
                Pick a topic and teach it to a curious child. The child will ask up to{" "}
                {maxTurns} short questions; explain in plain words. The clearer your
                explanation, the more your <em>comprehension</em> score grows.
              </p>
            </div>
          </div>
        ) : (
          <ActiveSession
            session={active}
            pendingChildPrompt={pendingChildPrompt}
            draft={draft}
            setDraft={setDraft}
            busy={busy}
            onSend={explain}
            maxTurns={maxTurns}
          />
        )}
      </section>
    </div>
  );
}

function ActiveSession({
  session,
  pendingChildPrompt,
  draft,
  setDraft,
  busy,
  onSend,
  maxTurns,
}: {
  session: FeynmanSession;
  pendingChildPrompt: string | null;
  draft: string;
  setDraft: (s: string) => void;
  busy: boolean;
  onSend: () => void;
  maxTurns: number;
}) {
  const ended = session.endedAt != null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-2 text-[11.5px] text-[var(--ink-500)]">
        <span className="truncate">
          You are teaching: <strong className="text-[var(--ink-900)]">{session.topic}</strong>
        </span>
        <span>
          {session.turns.length}/{maxTurns}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {session.turns.map((t, i) => (
          <TurnBlock key={i} childPrompt={t.childPrompt} userExplanation={t.userExplanation} />
        ))}
        {pendingChildPrompt && !ended && (
          <ChildBubble text={pendingChildPrompt} />
        )}
        {!pendingChildPrompt && !ended && session.turns.length === 0 && (
          <p className="text-center text-[12px] text-[var(--ink-400)]">
            Waiting for the child to ask the first question…
          </p>
        )}
        {ended && session.summary && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4">
            <div className="mb-1 flex items-center gap-1.5 text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" />
              <p className="text-[11px] font-semibold uppercase tracking-wider">
                End-of-session feedback
              </p>
            </div>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--ink-900)]">
              {session.summary}
            </p>
          </div>
        )}
      </div>

      {!ended && pendingChildPrompt && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSend();
          }}
          className="shrink-0 border-t border-[var(--border-subtle)] bg-white p-3"
        >
          <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">
            Explain to the child (plain words, like teaching a friend)
          </p>
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  onSend();
                }
              }}
              placeholder="Imagine you're talking to a curious 8-year-old…"
              rows={3}
              className="min-h-[60px] flex-1 resize-none rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2 text-[13px] leading-relaxed text-[var(--ink-900)] focus:border-[var(--accent-500)] focus:outline-none"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="flex h-[60px] w-[44px] items-center justify-center rounded-md bg-[var(--ink-900)] text-white hover:bg-black disabled:opacity-40"
              title="Send (⌘/Ctrl+Enter)"
            >
              {busy ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function TurnBlock({
  childPrompt,
  userExplanation,
}: {
  childPrompt: string;
  userExplanation: string;
}) {
  return (
    <div className="mb-4 space-y-2">
      <ChildBubble text={childPrompt} />
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-[var(--ink-900)] px-3 py-2 text-[13px] leading-relaxed text-white">
          {userExplanation}
        </div>
      </div>
    </div>
  );
}

function ChildBubble({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <Baby className="h-3.5 w-3.5" />
      </div>
      <div className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-amber-50 px-3 py-2 text-[13px] leading-relaxed text-[var(--ink-900)] ring-1 ring-amber-200">
        {text}
      </div>
    </div>
  );
}
