import type { Question, Stats, Chapter, Explanation } from "./types";

let cache: Question[] | null = null;
let statsCache: Stats | null = null;
let expCache: Record<string, Explanation> | null = null;

// Bump this when data files change to bust browser cache.
const DATA_VERSION = "v2";

type OverridePatch = { id: string; correct: string[]; numeric?: string; note?: string };

export function clearCache() {
  cache = null;
  statsCache = null;
}

export async function loadQuestions(): Promise<Question[]> {
  if (cache) return cache;
  const [qs, patches] = await Promise.all([
    fetch(`/data/questions.json?${DATA_VERSION}`, { cache: "no-store" }).then(
      (r) => r.json() as Promise<Question[]>
    ),
    fetch(`/data/overrides.json?${DATA_VERSION}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<OverridePatch[]>)
      .catch(() => [] as OverridePatch[]),
  ]);
  if (patches.length > 0) {
    const map = new Map(patches.map((p) => [p.id, p]));
    cache = qs.map((q) => {
      const p = map.get(q.id);
      if (!p) return q;
      return {
        ...q,
        correct_labels: p.correct,
        ...(p.numeric !== undefined && { numeric_answer: p.numeric }),
      };
    });
  } else {
    cache = qs;
  }
  return cache;
}

export async function loadStats(): Promise<Stats> {
  if (statsCache) return statsCache;
  const res = await fetch(`/data/stats.json?${DATA_VERSION}`, { cache: "no-store" });
  statsCache = (await res.json()) as Stats;
  return statsCache;
}

export async function loadExplanations(): Promise<Record<string, Explanation>> {
  if (expCache) return expCache;
  try {
    const res = await fetch(`/data/explanations.json?${DATA_VERSION}`, { cache: "no-store" });
    expCache = (await res.json()) as Record<string, Explanation>;
  } catch {
    expCache = {};
  }
  return expCache;
}

export function filterByChapters(qs: Question[], chapters: Chapter[]): Question[] {
  const set = new Set(chapters);
  return qs.filter((q) => set.has(q.chapter));
}

export function verified(qs: Question[]): Question[] {
  return qs.filter((q) => q.confidence >= 0.85 && q.correct_labels.length > 0);
}
