"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, X, Trophy } from "lucide-react";
import { loadQuestions } from "@/lib/data";
import type { Question } from "@/lib/types";
import { useExam, resolveCorrect } from "@/lib/store";
import { gradeAnswer } from "@/lib/sampler";
import { AnswerActions } from "@/components/AnswerActions";
import { RevealedChoices } from "@/components/RevealedChoices";

export default function ExamResultPage({ params }: { params: { id: string } }) {
  const sp = useSearchParams();
  const expectedScore = Number(sp.get("s") || 0);
  const expectedN = Number(sp.get("n") || 0);
  const qids = (sp.get("qids") || "").split(",").filter(Boolean);

  const [all, setAll] = useState<Question[]>([]);
  const history = useExam((s) => s.history);
  const overrides = useExam((s) => s.overrides);

  useEffect(() => {
    loadQuestions().then(setAll);
  }, []);

  const session = useMemo(() => history.find((h) => h.id === params.id), [history, params.id]);

  const questions = useMemo(() => {
    const map = new Map(all.map((q) => [q.id, q]));
    return qids.map((id) => map.get(id)).filter(Boolean) as Question[];
  }, [all, qids]);

  const score = session?.score ?? expectedScore;
  const total = questions.length || expectedN;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-500/15 via-zinc-900/40 to-sky-500/10 p-8 text-center">
        <Trophy className="mx-auto h-10 w-10 text-amber-300" />
        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-zinc-400">Kết quả</p>
        <p className="mt-2 text-6xl font-semibold tracking-tight">
          {score}
          <span className="text-zinc-500">/{total}</span>
        </p>
        <p className="mt-3 text-lg text-zinc-300">{pct}%</p>
        <div className="mt-5 flex justify-center gap-3">
          <Link
            href="/exam"
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800/60"
          >
            Thi đề khác
          </Link>
          <Link
            href="/learn/flashcard"
            className="rounded-md bg-violet-500/20 px-4 py-2 text-sm text-violet-100 ring-1 ring-violet-500/40"
          >
            Ôn tiếp
          </Link>
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-400">
          Chi tiết từng câu
        </h2>
        <div className="space-y-3">
          {questions.map((q, i) => {
            const ans = session?.answers[q.id];
            const correct = resolveCorrect(q, overrides);
            const result = gradeAnswer(
              { ...q, correct_labels: correct, numeric_answer: overrides[q.id]?.numeric ?? q.numeric_answer },
              ans ?? null
            );
            return (
              <details
                key={q.id}
                className={`group rounded-xl border bg-zinc-900/40 p-4 ${
                  result === "correct"
                    ? "border-emerald-500/30"
                    : result === "incorrect"
                      ? "border-rose-500/30"
                      : "border-zinc-800"
                }`}
              >
                <summary className="flex cursor-pointer items-start gap-3">
                  <span className="mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-md bg-zinc-800/80 font-mono text-xs">
                    {i + 1}
                  </span>
                  {result === "correct" && (
                    <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" />
                  )}
                  {result === "incorrect" && (
                    <X className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-400" />
                  )}
                  {result === "unanswered" && (
                    <span className="mt-0.5 text-xs text-zinc-500">∅</span>
                  )}
                  <span className="flex-1 text-sm text-zinc-200">{q.question_text}</span>
                </summary>
                <div className="mt-3 space-y-2 pl-9 text-sm">
                  <RevealedChoices q={q} correct={correct} userPicked={ans} density="compact" />
                  <AnswerActions q={q} />
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </div>
  );
}
