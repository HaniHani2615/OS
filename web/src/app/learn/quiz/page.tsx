"use client";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, RotateCcw } from "lucide-react";
import { loadQuestions, filterByChapters } from "@/lib/data";
import { CHAPTERS_MIDTERM, type Chapter, type Question } from "@/lib/types";
import { rng, shuffle, gradeAnswer } from "@/lib/sampler";
import { useExam, resolveCorrect } from "@/lib/store";
import { ChapterPicker } from "@/components/ChapterPicker";
import { AnswerActions } from "@/components/AnswerActions";
import { RevealedChoices } from "@/components/RevealedChoices";

export default function QuizPage() {
  const [all, setAll] = useState<Question[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([...CHAPTERS_MIDTERM]);
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [seed, setSeed] = useState(1);
  const overrides = useExam((s) => s.overrides);

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
  const [picked, setPicked] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    loadQuestions().then(setAll);
  }, []);
  useEffect(() => {
    setIdx(0);
    setPicked(null);
    setStreak(0);
    setScore(0);
    setRevealed(false);
  }, [chapters, verifiedOnly, seed]);

  const q = deck[idx];
  const correct = q ? resolveCorrect(q, overrides) : [];

  function pick(label: string) {
    if (revealed) return;
    setPicked(label);
    setRevealed(true);
    const ok = gradeAnswer(q, label) === "correct";
    if (ok) {
      setStreak((s) => s + 1);
      setScore((s) => s + 10 + Math.min(streak, 10));
    } else {
      setStreak(0);
    }
  }
  function nextQ() {
    setPicked(null);
    setRevealed(false);
    setIdx((i) => Math.min(deck.length - 1, i + 1));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quiz nhanh</h1>
          <p className="text-sm text-zinc-400">Trả lời ngay, biết đúng/sai liền.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-3 py-1.5 text-amber-300 ring-1 ring-amber-500/30">
            <Flame className="h-4 w-4" /> Streak {streak}
          </span>
          <span className="rounded-md bg-zinc-800/60 px-3 py-1.5 font-mono text-zinc-200">
            {score} đ
          </span>
          <button
            onClick={() => setSeed((s) => s + 1)}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700/60 px-3 py-1.5 text-zinc-300 hover:bg-zinc-800/60"
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
              className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6"
            >
              <p className="text-balance text-lg leading-relaxed text-zinc-100">
                {q.question_text}
              </p>
              <div className="mt-6">
                {revealed ? (
                  <RevealedChoices q={q} correct={correct} userPicked={picked} />
                ) : (
                  <div className="grid gap-2.5">
                    {q.choices.map((c) => (
                      <button
                        key={c.label}
                        onClick={() => pick(c.label)}
                        className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-left transition-all hover:bg-zinc-800/70"
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
                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-sm text-zinc-400">
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
                      className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-violet-900/40 transition-all duration-150 hover:bg-violet-500 active:scale-95"
                    >
                      Câu tiếp →
                    </button>
                  </div>
                  <AnswerActions q={q} />
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
