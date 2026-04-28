export type Chapter = "1-2" | "3-4" | "5-6" | "7" | "8" | "unknown";

export interface Choice {
  label: string;
  text: string;
}

export interface Question {
  id: string;
  qtype: "single" | "numeric";
  question_text: string;
  choices: Choice[];
  correct_labels: string[];
  wrong_labels?: string[];
  numeric_answer?: string | null;
  confidence: number;
  evidence_count: number;
  chapter: Chapter;
  needs_review: boolean;
  decision?: string;
  sources?: { path: string; tier: string }[];
  /** True when the question is pure theory (good for flashcards). */
  is_theory?: boolean;
}

export interface Explanation {
  why: string;
  distractors?: Record<string, string>;
  topic?: string;
  source: "auto" | "manual";
}

export interface Stats {
  total: number;
  in_scope: number;
  by_chapter: Record<Chapter, number>;
  verified_total: number;
  needs_review: number;
}

export const CHAPTERS_MIDTERM: Chapter[] = ["1-2", "3-4", "5-6", "7"];

export const CHAPTER_LABELS: Record<Chapter, string> = {
  "1-2": "Ch 1-2 · Tổng quan & Cấu trúc HĐH",
  "3-4": "Ch 3-4 · Tiến trình & Lập lịch CPU",
  "5-6": "Ch 5-6 · Đồng bộ & Bế tắc",
  "7": "Ch 7 · Quản lý bộ nhớ",
  "8": "Ch 8 · Bộ nhớ ảo (ngoài giữa kì)",
  unknown: "Chưa phân loại",
};

export const CHAPTER_COLORS: Record<Chapter, string> = {
  "1-2": "from-sky-500/20 to-sky-500/5 border-sky-500/30",
  "3-4": "from-violet-500/20 to-violet-500/5 border-violet-500/30",
  "5-6": "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
  "7": "from-amber-500/20 to-amber-500/5 border-amber-500/30",
  "8": "from-rose-500/20 to-rose-500/5 border-rose-500/30",
  unknown: "from-zinc-500/20 to-zinc-500/5 border-zinc-500/30",
};
