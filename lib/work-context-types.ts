/**
 * Pure types for the work context.
 *
 * Imported by client components; the storage-side helpers live in
 * lib/work-context.ts and stay server-only because they use node:fs.
 */

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  ts: number;
};

export type ChatThread = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
};

export type Flashcard = {
  q: string;
  a: string;
  userAnswer?: string;
  rating?: 1 | 2 | 3 | 4;
  answeredAt?: number;
};

export type FlashcardSession = {
  id: string;
  topic: string;
  createdAt: number;
  endedAt?: number;
  cards: Flashcard[];
};

export type FeynmanTurn = {
  childPrompt: string;
  userExplanation: string;
  ts: number;
};

export type FeynmanSession = {
  id: string;
  topic: string;
  createdAt: number;
  endedAt?: number;
  turns: FeynmanTurn[];
  summary?: string;
};

export type WorkContext = {
  v: 1;
  docId: string;
  chats: ChatThread[];
  flashcards: FlashcardSession[];
  feynman: FeynmanSession[];
};
