import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

type Override = { id: string; correct: string[]; numeric?: string; note?: string };
type HistoryEntry = {
  id: string;
  ts: string;
  before: { correct_labels: string[]; numeric_answer?: string };
  after: { correct_labels: string[]; numeric_answer?: string };
  note?: string;
};

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Only available in dev mode" }, { status: 403 });
  }

  const dataDir = path.join(process.cwd(), "public", "data");
  const qPath = path.join(dataDir, "questions.json");
  const oPath = path.join(dataDir, "overrides.json");
  const hPath = path.join(dataDir, "edit_history.json");

  const overrides: Override[] = JSON.parse(await fs.readFile(oPath, "utf-8"));
  if (overrides.length === 0) {
    return NextResponse.json({ ok: true, applied: 0, message: "No overrides to apply" });
  }

  const questions = JSON.parse(await fs.readFile(qPath, "utf-8")) as Array<Record<string, unknown>>;
  let history: HistoryEntry[] = [];
  try {
    history = JSON.parse(await fs.readFile(hPath, "utf-8"));
  } catch {
    history = [];
  }

  const ovMap = new Map(overrides.map((o) => [o.id, o]));
  const ts = new Date().toISOString();
  let applied = 0;

  for (const q of questions) {
    const o = ovMap.get(q.id as string);
    if (!o) continue;
    const before = {
      correct_labels: (q.correct_labels as string[]) ?? [],
      numeric_answer: q.numeric_answer as string | undefined,
    };
    const after = {
      correct_labels: o.correct,
      ...(o.numeric !== undefined ? { numeric_answer: o.numeric } : {}),
    };
    q.correct_labels = o.correct;
    if (o.numeric !== undefined) q.numeric_answer = o.numeric;
    q.confidence = 1;
    q.needs_review = false;
    q.decision = "manual_verified";
    history.push({ id: q.id as string, ts, before, after, note: o.note });
    applied++;
  }

  await fs.writeFile(qPath, JSON.stringify(questions, null, 2) + "\n", "utf-8");
  await fs.writeFile(hPath, JSON.stringify(history, null, 2) + "\n", "utf-8");
  await fs.writeFile(oPath, "[]\n", "utf-8");

  return NextResponse.json({ ok: true, applied, totalHistory: history.length });
}
