import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

type Body = { hid: string };

type HistoryEntry = {
  hid?: string;
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

  const { hid }: Body = await req.json();

  const dataDir = path.join(process.cwd(), "public", "data");
  const qPath = path.join(dataDir, "questions.json");
  const hPath = path.join(dataDir, "edit_history.json");

  let history: HistoryEntry[] = [];
  try {
    history = JSON.parse(await fs.readFile(hPath, "utf-8"));
  } catch {
    history = [];
  }

  const entry = history.find((h) => h.hid === hid);
  if (!entry) {
    return NextResponse.json({ error: `History entry ${hid} not found` }, { status: 404 });
  }

  const questions = JSON.parse(await fs.readFile(qPath, "utf-8")) as Array<Record<string, unknown>>;
  const q = questions.find((x) => x.id === entry.id);
  if (q) {
    q.correct_labels = entry.before.correct_labels;
    if (entry.before.numeric_answer !== undefined) {
      q.numeric_answer = entry.before.numeric_answer;
    }
    q.confidence = 0;
    q.needs_review = true;
    q.decision = "reverted";
  }

  const newHistory = history.filter((h) => h.hid !== hid);

  await fs.writeFile(qPath, JSON.stringify(questions, null, 2) + "\n", "utf-8");
  await fs.writeFile(hPath, JSON.stringify(newHistory, null, 2) + "\n", "utf-8");

  return NextResponse.json({ ok: true, restored: entry.before });
}
