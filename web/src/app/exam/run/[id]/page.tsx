"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, Clock, Send } from "lucide-react";
import { loadQuestions } from "@/lib/data";
import type { Question } from "@/lib/types";
import { useExam, resolveCorrect } from "@/lib/store";
import { gradeAnswer } from "@/lib/sampler";

export default function ExamRunPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const active = useExam((s) => s.active);
  const setAnswer = useExam((s) => s.setAnswer);
  const toggleFlag = useExam((s) => s.toggleFlag);
  const submit = useExam((s) => s.submitExam);
  const overrides = useExam((s) => s.overrides);

  const [all, setAll] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);

  useEffect(() => {
    loadQuestions().then(setAll);
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const questions = useMemo(() => {
    if (!active) return [];
    const map = new Map(all.map((q) => [q.id, q]));
    return active.questionIds.map((id) => map.get(id)).filter(Boolean) as Question[];
  }, [all, active]);

  if (!active || active.id !== params.id) {
    return (
      <div className="mx-auto max-w-md text-center text-zinc-400">
        Không tìm thấy phiên thi này. Quay về{" "}
        <a href="/exam" className="text-violet-400 underline">
          /exam
        </a>
      </div>
    );
  }

  const elapsed = Math.floor((now - active.startedAt) / 1000);
  const remaining = Math.max(0, active.durationSec - elapsed);
  const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");

  if (remaining === 0 && questions.length > 0 && !active.submittedAt) {
    handleSubmit();
  }

  function handleSubmit() {
    let score = 0;
    for (const q of questions) {
      const ans = active!.answers[q.id];
      const eff: Question = {
        ...q,
        correct_labels: resolveCorrect(q, overrides),
        numeric_answer: overrides[q.id]?.numeric ?? q.numeric_answer,
      };
      if (gradeAnswer(eff, ans ?? null) === "correct") score += 1;
    }
    submit(score);
    router.push(`/exam/result/${active!.id}?n=${questions.length}&s=${score}&qids=${encodeURIComponent(active!.questionIds.join(","))}`);
  }

  if (questions.length === 0) {
    return <div className="text-zinc-400">Đang tải đề…</div>;
  }
  const q = questions[idx];
  const picked = active.answers[q.id] as string | undefined;
  const flagged = active.flagged[q.id];
  const answered = Object.keys(active.answers).filter((k) => active.answers[k] != null).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-400">Câu</span>
            <span className="font-mono text-zinc-100">
              {idx + 1}/{questions.length}
            </span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400">Đã làm</span>
            <span className="font-mono text-emerald-300">{answered}</span>
          </div>
          <div
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-sm ${
              remaining < 60
                ? "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30 animate-pulse"
                : remaining < 300
                  ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30"
                  : "bg-zinc-800/60 text-zinc-200"
            }`}
          >
            <Clock className="h-4 w-4" />
            {mm}:{ss}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              Câu {idx + 1} · Ch {q.chapter}
            </span>
            <button
              onClick={() => toggleFlag(q.id)}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${
                flagged
                  ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Flag className="h-3 w-3" /> {flagged ? "Đã đánh dấu" : "Đánh dấu"}
            </button>
          </div>
          <p className="text-balance text-lg leading-relaxed text-zinc-100">{q.question_text}</p>
          <div className="mt-5 grid gap-2">
            {q.choices.map((c) => {
              const on = picked === c.label;
              return (
                <button
                  key={c.label}
                  onClick={() => setAnswer(q.id, on ? null : c.label)}
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                    on
                      ? "border-violet-500/60 bg-violet-600/90 text-white"
                      : "border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/50"
                  }`}
                >
                  <span
                    className={`mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-md font-mono text-xs uppercase ${
                      on ? "bg-white/20 text-white" : "bg-zinc-800/80 text-zinc-300"
                    }`}
                  >
                    {c.label}
                  </span>
                  <span className="flex-1 text-sm leading-relaxed">{c.text}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="rounded-md border border-zinc-700/60 bg-zinc-900/40 px-4 py-2 text-sm disabled:opacity-40"
          >
            ← Câu trước
          </button>
          {idx < questions.length - 1 ? (
            <button
              onClick={() => setIdx((i) => i + 1)}
              className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-violet-900/40 transition-all duration-150 hover:bg-violet-500 active:scale-95"
            >
              Câu sau →
            </button>
          ) : (
            <button
              onClick={() => setConfirmingSubmit(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-emerald-900/40 transition-all duration-150 hover:bg-emerald-500 active:scale-95"
            >
              <Send className="h-4 w-4" /> Nộp bài
            </button>
          )}
        </div>
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Bản đồ câu
          </p>
          <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-5">
            {questions.map((qq, i) => {
              const ans = active.answers[qq.id];
              const f = active.flagged[qq.id];
              const isCur = i === idx;
              let cls = "bg-zinc-800/60 text-zinc-400";
              if (ans != null) cls = "bg-violet-600 text-white";
              if (f) cls = "bg-amber-500 text-zinc-950";
              if (isCur) cls += " outline outline-2 outline-zinc-200/60";
              return (
                <button
                  key={qq.id}
                  onClick={() => setIdx(i)}
                  className={`h-8 rounded-md text-xs font-mono ${cls}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setConfirmingSubmit(true)}
            className="mt-3 w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm shadow-emerald-900/40 transition-all duration-150 hover:bg-emerald-500 active:scale-95"
          >
            Nộp bài
          </button>
        </div>
      </aside>

      {confirmingSubmit && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm">
          <div className="max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">Nộp bài?</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Bạn đã trả lời {answered}/{questions.length} câu. Sau khi nộp không thể sửa.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmingSubmit(false)}
                className="rounded-md border border-zinc-700 px-4 py-2 text-sm"
              >
                Hủy
              </button>
              <button
                onClick={handleSubmit}
                className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-400"
              >
                Nộp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
