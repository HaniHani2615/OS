import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

type Body = {
  hid?: string;
  id: string;
  correct_labels: string[];
  numeric_answer?: string;
  note?: string;
};

type HistoryEntry = {
  hid: string;
  id: string;
  ts: string;
  before: { correct_labels: string[]; numeric_answer?: string };
  after: { correct_labels: string[]; numeric_answer?: string };
  note?: string;
};

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Only available in dev mode" }, { status: 403 });
  }

  const body: Body = await req.json();
  const { id, correct_labels, numeric_answer, note } = body;
  const hid = body.hid ?? randomUUID();

  const dataDir = path.join(process.cwd(), "public", "data");
  const qPath = path.join(dataDir, "questions.json");
  const hPath = path.join(dataDir, "edit_history.json");

  const questions = JSON.parse(await fs.readFile(qPath, "utf-8")) as Array<Record<string, unknown>>;

  const q = questions.find((x) => x.id === id);
  if (!q) {
    return NextResponse.json({ error: `Question ${id} not found` }, { status: 404 });
  }

  const before: HistoryEntry["before"] = {
    correct_labels: (q.correct_labels as string[]) ?? [],
    ...(q.numeric_answer ? { numeric_answer: q.numeric_answer as string } : {}),
  };

  // Apply patch
  q.correct_labels = correct_labels;
  if (numeric_answer !== undefined) q.numeric_answer = numeric_answer;
  q.confidence = 1;
  q.needs_review = false;
  q.decision = "manual_verified";

  const after: HistoryEntry["after"] = {
    correct_labels,
    ...(numeric_answer !== undefined ? { numeric_answer } : {}),
  };

  const ts = new Date().toISOString();
  const entry: HistoryEntry = { hid, id, ts, before, after, ...(note ? { note } : {}) };

  let history: HistoryEntry[] = [];
  try {
    history = JSON.parse(await fs.readFile(hPath, "utf-8"));
  } catch {
    history = [];
  }
  history.push(entry);

  await fs.writeFile(qPath, JSON.stringify(questions, null, 2) + "\n", "utf-8");
  await fs.writeFile(hPath, JSON.stringify(history, null, 2) + "\n", "utf-8");

  return NextResponse.json({ ok: true, entry });
}
