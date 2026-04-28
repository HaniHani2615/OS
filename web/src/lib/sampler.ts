import type { Question, Chapter } from "./types";

/** Mulberry32 PRNG for replayable sampling. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface SampleConfig {
  total: number;
  chapters: Chapter[];
  ratio?: Partial<Record<Chapter, number>>; // weights, normalized
  preferVerified?: boolean;
  seed?: number;
}

const DEFAULT_RATIO: Record<Chapter, number> = {
  "1-2": 0.15,
  "3-4": 0.35,
  "5-6": 0.3,
  "7": 0.2,
  "8": 0,
  unknown: 0,
};

/** Stratified sampling by chapter. Falls back to less-confident questions if a chapter is short. */
export function sampleExam(
  pool: Question[],
  cfg: SampleConfig
): Question[] {
  const seed = cfg.seed ?? Math.floor(Math.random() * 1e9);
  const rand = rng(seed);
  const ratio: Record<string, number> = {};
  let totalWeight = 0;
  for (const ch of cfg.chapters) {
    const w = cfg.ratio?.[ch] ?? DEFAULT_RATIO[ch] ?? 0;
    ratio[ch] = w;
    totalWeight += w;
  }
  if (totalWeight === 0) {
    for (const ch of cfg.chapters) ratio[ch] = 1 / cfg.chapters.length;
    totalWeight = 1;
  }

  // partition pool by chapter
  const buckets: Record<string, Question[]> = {};
  for (const ch of cfg.chapters) buckets[ch] = [];
  for (const q of pool) {
    if (cfg.chapters.includes(q.chapter)) buckets[q.chapter].push(q);
  }

  // sort each bucket: verified first, then by evidence_count desc
  for (const ch of cfg.chapters) {
    buckets[ch].sort((a, b) => {
      const va = a.confidence >= 0.85 && a.correct_labels.length > 0 ? 1 : 0;
      const vb = b.confidence >= 0.85 && b.correct_labels.length > 0 ? 1 : 0;
      if (va !== vb) return vb - va;
      return b.evidence_count - a.evidence_count;
    });
    // shuffle within tier
    const verified = buckets[ch].filter(
      (q) => q.confidence >= 0.85 && q.correct_labels.length > 0
    );
    const rest = buckets[ch].filter(
      (q) => !(q.confidence >= 0.85 && q.correct_labels.length > 0)
    );
    buckets[ch] = [...shuffle(verified, rand), ...shuffle(rest, rand)];
  }

  // allocate counts
  const counts: Record<string, number> = {};
  let allocated = 0;
  for (const ch of cfg.chapters) {
    counts[ch] = Math.floor((ratio[ch] / totalWeight) * cfg.total);
    allocated += counts[ch];
  }
  // distribute remainder to chapters with highest weight first
  let remainder = cfg.total - allocated;
  const orderByWeight = [...cfg.chapters].sort(
    (a, b) => (ratio[b] || 0) - (ratio[a] || 0)
  );
  for (const ch of orderByWeight) {
    if (remainder <= 0) break;
    counts[ch] += 1;
    remainder--;
  }

  // pick
  const picked: Question[] = [];
  const overflow: Question[] = [];
  for (const ch of cfg.chapters) {
    const need = counts[ch];
    const take = buckets[ch].slice(0, need);
    picked.push(...take);
    overflow.push(...buckets[ch].slice(need));
    if (take.length < need) {
      // we'll backfill from overflow at the end
    }
  }

  // backfill if some chapters were short
  if (picked.length < cfg.total) {
    const remaining = cfg.total - picked.length;
    const fill = shuffle(overflow, rand).slice(0, remaining);
    picked.push(...fill);
  }

  return shuffle(picked, rand);
}

export function gradeAnswer(q: Question, answer: string | string[] | null): "correct" | "incorrect" | "unanswered" {
  if (answer == null || (Array.isArray(answer) && answer.length === 0) || answer === "") return "unanswered";
  if (q.qtype === "numeric") {
    const expected = (q.numeric_answer || "").trim().toLowerCase();
    const got = String(answer).trim().toLowerCase();
    return expected === got ? "correct" : "incorrect";
  }
  const got = Array.isArray(answer) ? answer.slice().sort() : [answer];
  const expected = q.correct_labels.slice().sort();
  if (got.length !== expected.length) return "incorrect";
  return got.every((g, i) => g === expected[i]) ? "correct" : "incorrect";
}
