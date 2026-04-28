"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Question } from "./types";

export interface ExamSession {
  id: string;
  startedAt: number;
  durationSec: number;
  questionIds: string[];
  answers: Record<string, string | string[] | null>;
  flagged: Record<string, boolean>;
  submittedAt?: number;
  score?: number;
}

interface ExamState {
  active: ExamSession | null;
  history: ExamSession[];
  /** User-overridden correct answers for review mode: id → labels[] */
  overrides: Record<string, { correct: string[]; numeric?: string; note?: string }>;
  /** Mastered card ids for flashcard SRS */
  mastered: Record<string, number>;
  /** Cross-session bookmarks: questions user wants to revisit */
  bookmarks: Record<string, boolean>;
  startExam(s: ExamSession): void;
  setAnswer(qid: string, ans: string | string[] | null): void;
  toggleFlag(qid: string): void;
  submitExam(score: number): void;
  abandonExam(): void;
  setOverride(id: string, correct: string[], numeric?: string, note?: string): void;
  setNote(id: string, note: string): void;
  clearOverride(id: string): void;
  bumpMastered(id: string): void;
  resetMastered(id: string): void;
  toggleBookmark(id: string): void;
}

export const useExam = create<ExamState>()(
  persist(
    (set) => ({
      active: null,
      history: [],
      overrides: {},
      mastered: {},
      bookmarks: {},
      startExam: (s) => set({ active: s }),
      setAnswer: (qid, ans) =>
        set((st) =>
          st.active
            ? { active: { ...st.active, answers: { ...st.active.answers, [qid]: ans } } }
            : st
        ),
      toggleFlag: (qid) =>
        set((st) =>
          st.active
            ? {
                active: {
                  ...st.active,
                  flagged: { ...st.active.flagged, [qid]: !st.active.flagged[qid] },
                },
              }
            : st
        ),
      submitExam: (score) =>
        set((st) => {
          if (!st.active) return st;
          const finished = { ...st.active, submittedAt: Date.now(), score };
          return { active: null, history: [finished, ...st.history].slice(0, 30) };
        }),
      abandonExam: () => set({ active: null }),
      setOverride: (id, correct, numeric, note) =>
        set((st) => ({ overrides: { ...st.overrides, [id]: { correct, numeric, note } } })),
      setNote: (id, note) =>
        set((st) => {
          const prev = st.overrides[id];
          return {
            overrides: {
              ...st.overrides,
              [id]: {
                correct: prev?.correct ?? [],
                numeric: prev?.numeric,
                note: note || undefined,
              },
            },
          };
        }),
      clearOverride: (id) =>
        set((st) => {
          const rest = { ...st.overrides };
          delete rest[id];
          return { overrides: rest };
        }),
      bumpMastered: (id) =>
        set((st) => ({ mastered: { ...st.mastered, [id]: (st.mastered[id] ?? 0) + 1 } })),
      resetMastered: (id) =>
        set((st) => {
          const rest = { ...st.mastered };
          delete rest[id];
          return { mastered: rest };
        }),
      toggleBookmark: (id) =>
        set((st) => {
          const next = { ...st.bookmarks };
          if (next[id]) delete next[id];
          else next[id] = true;
          return { bookmarks: next };
        }),
    }),
    { name: "os-onthi-v1" }
  )
);

/** Resolve effective correct labels for a question, applying user override if any. */
export function resolveCorrect(q: Question, overrides: ExamState["overrides"]): string[] {
  return overrides[q.id]?.correct ?? q.correct_labels;
}

export function resolveNumeric(q: Question, overrides: ExamState["overrides"]): string | null {
  return overrides[q.id]?.numeric ?? q.numeric_answer ?? null;
}
