"use client";

/**
 * Flashcards.
 *
 * Flow:
 *   1. Pick a topic (free text, defaults to "all the document").
 *   2. Codex generates 4–10 cards.
 *   3. Card-by-card: type your answer (optional), reveal, self-grade
 *      (1=again / 2=hard / 3=good / 4=easy).
 *   4. Deck end → server marks the session ended and triggers KG eval.
 *
 * Past sessions live in the right rail so the user can see what they've
 * studied. Selecting a past session shows it read-only.
 */

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import type { FlashcardSession } from "@/lib/work-context-types";
import { consumePrefill } from "./prefill";

type Props = { docId: string };

const RATING_LABELS: Record<1 | 2 | 3 | 4, { text: string; tone: string }> = {
  1: { text: "Again", tone: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100" },
  2: { text: "Hard", tone: "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100" },
  3: { text: "Good", tone: "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100" },
  4: { text: "Easy", tone: "bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100" },
};

export default function FlashcardsView({ docId }: Props) {
  const [sessions, setSessions] = useState<FlashcardSession[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/flashcards/${docId}`)
      .then((r) => r.json())
      .then((j: { sessions: FlashcardSession[] }) => {
        if (cancelled) return;
        setSessions(j.sessions);
        const prefill = consumePrefill(docId, "flashcards");
        if (prefill) {
          setTopic(prefill);
          return;
        }
        const live = j.sessions.find((s) => !s.endedAt);
        if (live) {
          setActiveId(live.id);
          const firstUnanswered = live.cards.findIndex((c) => c.rating == null);
          setCardIndex(firstUnanswered === -1 ? Math.max(0, live.cards.length - 1) : firstUnanswered);
        }
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [docId]);

  const active = sessions?.find((s) => s.id === activeId) ?? null;

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const r = await fetch(`/api/flashcards/${docId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "generate", topic: topic.trim() || "all" }),
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(`generate failed (${r.status}): ${txt.slice(0, 120)}`);
      }
      const j = (await r.json()) as { session: FlashcardSession };
      setSessions((prev) => [j.session, ...(prev ?? [])]);
      setActiveId(j.session.id);
      setCardIndex(0);
      setRevealed(false);
      setUserAnswer("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }, [docId, topic]);

  const rate = useCallback(
    async (rating: 1 | 2 | 3 | 4) => {
      if (!active) return;
      const idx = cardIndex;
      // Optimistic.
      setSessions((prev) =>
        prev
          ? prev.map((s) =>
              s.id === active.id
                ? {
                    ...s,
                    cards: s.cards.map((c, i) =>
                      i === idx ? { ...c, rating, userAnswer: userAnswer || undefined } : c,
                    ),
                  }
                : s,
            )
          : prev,
      );
      try {
        await fetch(`/api/flashcards/${docId}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "rate",
            sessionId: active.id,
            cardIndex: idx,
            rating,
            userAnswer: userAnswer || undefined,
          }),
        });
      } catch {
        /* leave optimistic state — next refresh will reconcile */
      }
      // Advance.
      const nextIdx = idx + 1;
      if (nextIdx >= active.cards.length) {
        // End the session — triggers KG eval server-side.
        try {
          const r = await fetch(`/api/flashcards/${docId}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "end", sessionId: active.id }),
          });
          const j = (await r.json()) as { session: FlashcardSession };
          setSessions((prev) =>
            prev ? prev.map((s) => (s.id === active.id ? j.session : s)) : prev,
          );
        } catch {
          /* noop */
        }
      }
      setCardIndex(nextIdx);
      setRevealed(false);
      setUserAnswer("");
    },
    [active, cardIndex, docId, userAnswer],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      await fetch(`/api/flashcards/${docId}?sessionId=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setSessions((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
      if (activeId === id) setActiveId(null);
    },
    [activeId, docId],
  );

  if (sessions === null) {
    return (
      <div className="flex h-full items-center justify-center text-[12px] text-[var(--ink-500)]">
        <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> loading flashcards…
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-52 shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-canvas)]">
        <div className="m-2 rounded-md border border-[var(--border-subtle)] bg-white p-2">
          <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">
            New deck
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic (or empty for whole doc)"
            className="mb-2 w-full rounded border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1 text-[12px] focus:border-[var(--accent-500)] focus:outline-none"
            disabled={generating}
          />
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--ink-900)] py-1.5 text-[12px] font-medium text-white hover:bg-black disabled:opacity-50"
          >
            {generating ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> generating…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" /> Generate
              </>
            )}
          </button>
          {error && <p className="mt-2 text-[11px] text-rose-700">{error}</p>}
        </div>
        <div className="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">
          Past decks
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
          {sessions.length === 0 ? (
            <p className="px-2 py-3 text-[11.5px] leading-relaxed text-[var(--ink-400)]">
              Nothing yet. Generate your first deck above.
            </p>
          ) : (
            sessions.map((s) => {
              const done = s.cards.filter((c) => c.rating != null).length;
              return (
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
                        const firstUnanswered = s.cards.findIndex((c) => c.rating == null);
                        setCardIndex(
                          firstUnanswered === -1 ? Math.max(0, s.cards.length - 1) : firstUnanswered,
                        );
                        setRevealed(s.endedAt != null);
                        setUserAnswer("");
                      }}
                      className="min-w-0 flex-1 truncate text-left font-medium"
                      title={s.topic}
                    >
                      {s.topic === "all" ? "Whole document" : s.topic}
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
                    {done}/{s.cards.length} {s.endedAt ? "· done" : "· in progress"}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-white">
        {!active ? (
          <EmptyHint
            icon={<Plus className="h-7 w-7 text-[var(--ink-400)]" />}
            text="Pick a topic on the left and generate a deck. Each rating you give feeds the knowledge graph."
          />
        ) : (
          <CardRunner
            session={active}
            cardIndex={cardIndex}
            revealed={revealed}
            userAnswer={userAnswer}
            onUserAnswer={setUserAnswer}
            onReveal={() => setRevealed(true)}
            onRate={rate}
            onJump={(i) => {
              setCardIndex(i);
              setRevealed(false);
              setUserAnswer("");
            }}
          />
        )}
      </section>
    </div>
  );
}

function CardRunner({
  session,
  cardIndex,
  revealed,
  userAnswer,
  onUserAnswer,
  onReveal,
  onRate,
  onJump,
}: {
  session: FlashcardSession;
  cardIndex: number;
  revealed: boolean;
  userAnswer: string;
  onUserAnswer: (s: string) => void;
  onReveal: () => void;
  onRate: (r: 1 | 2 | 3 | 4) => void;
  onJump: (i: number) => void;
}) {
  const total = session.cards.length;
  const safeIndex = Math.min(Math.max(cardIndex, 0), total - 1);
  const card = session.cards[safeIndex];
  const rating = card?.rating;
  const done = session.endedAt != null || cardIndex >= total;

  if (done) {
    const answered = session.cards.filter((c) => c.rating != null);
    const avg =
      answered.length > 0
        ? answered.reduce((s, c) => s + (c.rating ?? 0), 0) / answered.length
        : 0;
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
        <Sparkles className="h-7 w-7 text-emerald-600" />
        <p className="text-[14px] font-medium text-[var(--ink-900)]">Deck complete</p>
        <p className="text-[12.5px] text-[var(--ink-500)]">
          Average self-grade {avg.toFixed(1)}/4 across {answered.length} cards. The knowledge
          graph is updating in the background.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {session.cards.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onJump(i)}
              className={`h-7 w-7 rounded-md border text-[11px] font-medium ${
                c.rating === 1
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : c.rating === 2
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : c.rating === 3
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : c.rating === 4
                        ? "border-sky-200 bg-sky-50 text-sky-800"
                        : "border-[var(--border-subtle)] bg-white text-[var(--ink-500)]"
              }`}
              title={`Card ${i + 1}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-2 text-[11.5px] text-[var(--ink-500)]">
        <span>
          Card {safeIndex + 1} / {total}
        </span>
        <span className="truncate">topic: {session.topic}</span>
      </header>

      <div className="flex flex-1 flex-col items-stretch justify-center gap-4 px-8 py-6">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-400)]">
            Question
          </p>
          <p className="mt-1 whitespace-pre-wrap text-[14.5px] leading-relaxed text-[var(--ink-900)]">
            {card.q}
          </p>
        </div>

        <textarea
          value={userAnswer}
          onChange={(e) => onUserAnswer(e.target.value)}
          placeholder="Type your answer (optional, for your own honesty)…"
          rows={3}
          disabled={revealed}
          className="resize-none rounded-md border border-[var(--border-subtle)] bg-white px-3 py-2 text-[13px] leading-relaxed text-[var(--ink-900)] focus:border-[var(--accent-500)] focus:outline-none disabled:bg-[var(--surface-sunken)]"
        />

        {revealed ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
              Answer
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--ink-900)]">
              {card.a}
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={onReveal}
            className="self-center rounded-md bg-[var(--ink-900)] px-4 py-2 text-[12.5px] font-medium text-white hover:bg-black"
          >
            Reveal answer
          </button>
        )}

        {revealed && rating == null && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {([1, 2, 3, 4] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onRate(r)}
                className={`rounded-md border px-3 py-1.5 text-[12px] font-medium ${RATING_LABELS[r].tone}`}
              >
                {r} · {RATING_LABELS[r].text}
              </button>
            ))}
          </div>
        )}
        {rating != null && (
          <p className="text-center text-[11.5px] text-[var(--ink-500)]">
            You graded this {rating} ·{" "}
            <button
              type="button"
              className="underline hover:text-[var(--ink-900)]"
              onClick={() => onJump(safeIndex + 1)}
            >
              next
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

function EmptyHint({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-1 items-center justify-center px-8 text-center">
      <div className="max-w-sm">
        <div className="mb-3 flex justify-center">{icon}</div>
        <p className="text-[13.5px] leading-relaxed text-[var(--ink-500)]">{text}</p>
      </div>
    </div>
  );
}
