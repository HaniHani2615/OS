"use client";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, RotateCcw, ArrowLeft, ArrowRight, AlertTriangle } from "lucide-react";
import { loadQuestions, filterByChapters } from "@/lib/data";
import { CHAPTERS_ALL, type Chapter, type Question } from "@/lib/types";
import { rng, shuffle, gradeAnswer } from "@/lib/sampler";
import { useExam, resolveCorrect } from "@/lib/store";
import { ChapterPicker } from "@/components/ChapterPicker";
import { AnswerActions } from "@/components/AnswerActions";
import { RevealedChoices } from "@/components/RevealedChoices";

export default function QuizPage() {
  const [all, setAll] = useState<Question[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([...CHAPTERS_ALL]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [seed, setSeed] = useState(1);
  const overrides = useExam((s) => s.overrides);
  const bookmarks = useExam((s) => s.bookmarks);
  const toggleBookmark = useExam((s) => s.toggleBookmark);

  const deck = useMemo(() => {
    let pool = filterByChapters(all, chapters);
    if (verifiedOnly)
      pool = pool.filter(
        (q) => q.confidence >= 0.85 || (overrides[q.id]?.correct?.length ?? 0) > 0
      );
    pool = pool.filter((q) => q.qtype === "single" && q.choices.length >= 2);
    return shuffle(pool, rng(seed));
  }, [all, chapters, verifiedOnly, overrides, seed]);

  const [idx, setIdx] = useState(0);
  // answers: qid → picked label. Presence of key = question has been answered (revealed).
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState(0);

  useEffect(() => {
    loadQuestions().then(setAll);
  }, []);
  useEffect(() => {
    setIdx(0);
    setAnswers({});
    setStreak(0);
    setScore(0);
  }, [chapters, verifiedOnly, seed]);

  const q = deck[idx];
  const correct = q ? resolveCorrect(q, overrides) : [];
  const picked = q ? (answers[q.id] ?? null) : null;
  const revealed = q ? q.id in answers : false;

  const isUnconfirmed = correct.length === 0;

  function pick(label: string) {
    if (revealed) return;
    setAnswers((a) => ({ ...a, [q.id]: label }));
    if (isUnconfirmed) {
      // Can't grade — just flag as risky and skip streak
      if (!bookmarks[q.id]) toggleBookmark(q.id);
      setStreak(0);
      return;
    }
    const ok = gradeAnswer(q, label) === "correct";
    if (ok) {
      setStreak((s) => s + 1);
      setScore((s) => s + 10 + Math.min(streak, 10));
    } else {
      setStreak(0);
    }
  }
  function nextQ() {
    setIdx((i) => Math.min(deck.length - 1, i + 1));
  }
  function prevQ() {
    setIdx((i) => Math.max(0, i - 1));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quiz nhanh</h1>
          <p className="text-sm text-zinc-400">Trả lời ngay, biết đúng/sai liền.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-amber-300 ring-1 ring-amber-500/30">
            <Flame className="h-3.5 w-3.5" /> Streak {streak}
          </span>
          <span className="rounded-md bg-zinc-800/60 px-2.5 py-1.5 font-mono text-zinc-200">
            {score} đ
          </span>
          <button
            onClick={() => setSeed((s) => s + 1)}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700/60 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800/60 active:scale-95"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Trộn
          </button>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-4">
        <ChapterPicker value={chapters} onChange={setChapters} />
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
            className="accent-violet-500"
          />
          Chỉ câu verified
        </label>
      </div>

      {!q ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center text-zinc-500">
          Hết câu trong deck.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>
              Câu {idx + 1} / {deck.length} · Ch {q.chapter}
            </span>
            <div className="h-1 w-32 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-violet-500"
                style={{ width: `${((idx + 1) / deck.length) * 100}%` }}
              />
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 md:p-6"
            >
              <p className="text-balance text-base leading-relaxed text-zinc-100 md:text-lg">
                {q.question_text}
              </p>
              <div className="mt-5">
                {revealed ? (
                  <RevealedChoices q={q} correct={correct} userPicked={picked} />
                ) : (
                  <div className="grid gap-2.5">
                    {q.choices.map((c) => (
                      <button
                        key={c.label}
                        onClick={() => pick(c.label)}
                        className="flex min-h-[48px] items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-left transition-all hover:bg-zinc-800/70 active:scale-[0.99]"
                      >
                        <span className="mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-md bg-zinc-800/80 font-mono text-xs uppercase text-zinc-300">
                          {c.label}
                        </span>
                        <span className="flex-1 text-sm leading-relaxed text-zinc-100">
                          {c.text}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {revealed && (
                <>
                  {isUnconfirmed ? (
                    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
                      <div className="flex-1 text-sm">
                        <p className="font-medium text-amber-300">Câu này chưa có đáp án xác nhận</p>
                        <p className="mt-0.5 text-xs text-amber-400/80">
                          Máy chưa chấm được câu này — đã tự động gắn cờ để bạn review sau.
                          Vào tab <b>Review</b> để xác nhận đáp án đúng.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm">
                        {gradeAnswer(q, picked) === "correct" ? (
                          <span className="text-emerald-400">Chính xác! +{10 + Math.min(streak - 1, 10)}đ</span>
                        ) : (
                          <span className="text-rose-400">
                            Đáp án đúng: <b>{correct.join(", ").toUpperCase()}</b>
                          </span>
                        )}
                      </span>
                      <button
                        onClick={nextQ}
                        disabled={idx === deck.length - 1}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-violet-900/40 transition-all duration-150 hover:bg-violet-500 active:scale-95 disabled:opacity-40"
                      >
                        Câu tiếp <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <AnswerActions q={q} highlightWrong={!isUnconfirmed && gradeAnswer(q, picked) !== "correct"} />
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation bar */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={prevQ}
              disabled={idx === 0}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-zinc-700/60 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800/60 active:scale-95 disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" /> Câu trước
            </button>
            <span className="text-xs text-zinc-600">
              {Object.keys(answers).length}/{deck.length} đã làm
            </span>
            <button
              onClick={nextQ}
              disabled={idx === deck.length - 1}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-zinc-700/60 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800/60 active:scale-95 disabled:opacity-40"
            >
              Câu sau <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
