"use client";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, RotateCcw, Sparkles, AlertTriangle } from "lucide-react";
import { loadQuestions, filterByChapters } from "@/lib/data";
import { CHAPTERS_MIDTERM, type Chapter, type Question } from "@/lib/types";
import { useExam, resolveCorrect, resolveNumeric } from "@/lib/store";
import { ChapterPicker } from "@/components/ChapterPicker";
import { AnswerActions } from "@/components/AnswerActions";
import { RevealedChoices } from "@/components/RevealedChoices";
import { rng, shuffle } from "@/lib/sampler";

export default function FlashcardPage() {
  const [all, setAll] = useState<Question[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([...CHAPTERS_MIDTERM]);
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [theoryOnly, setTheoryOnly] = useState(true);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [seed, setSeed] = useState(1);

  const overrides = useExam((s) => s.overrides);
  const mastered = useExam((s) => s.mastered);
  const bumpMastered = useExam((s) => s.bumpMastered);

  useEffect(() => {
    loadQuestions().then(setAll);
  }, []);

  const deck = useMemo(() => {
    let pool = filterByChapters(all, chapters);
    if (verifiedOnly)
      pool = pool.filter(
        (q) => q.confidence >= 0.85 || (overrides[q.id]?.correct?.length ?? 0) > 0
      );
    if (theoryOnly) pool = pool.filter((q) => q.is_theory !== false);
    pool = pool.filter((q) => (mastered[q.id] ?? 0) < 3);
    return shuffle(pool, rng(seed));
  }, [all, chapters, verifiedOnly, theoryOnly, overrides, mastered, seed]);

  useEffect(() => {
    setIdx(0);
    setFlipped(false);
  }, [chapters, verifiedOnly, theoryOnly, seed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const card = deck[idx];

  const next = () => {
    setFlipped(false);
    setIdx((i) => Math.min(deck.length - 1, i + 1));
  };
  const prev = () => {
    setFlipped(false);
    setIdx((i) => Math.max(0, i - 1));
  };
  const markMastered = () => {
    if (card) bumpMastered(card.id);
    next();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Flashcard</h1>
          <p className="text-sm text-zinc-400">Space để lật · ←/→ chuyển thẻ.</p>
        </div>
        <button
          onClick={() => setSeed((s) => s + 1)}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700/60 bg-zinc-900/40 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800/60"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Trộn lại
        </button>
      </div>

      <div className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-4">
        <ChapterPicker value={chapters} onChange={setChapters} />
        <div className="flex flex-wrap gap-4">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
              className="accent-violet-500"
            />
            Chỉ học câu verified (chuẩn máy chấm)
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={theoryOnly}
              onChange={(e) => setTheoryOnly(e.target.checked)}
              className="accent-violet-500"
            />
            Chỉ câu lý thuyết (bỏ tính toán & “ý nào đúng nhất”)
          </label>
        </div>
      </div>

      {!card ? (
        <EmptyState />
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>
              Thẻ {idx + 1} / {deck.length}
            </span>
            <span>Đã thuộc: {Object.keys(mastered).length}</span>
          </div>

          <div className="relative h-[420px] perspective-1000">
            <AnimatePresence mode="wait">
              <motion.div
                key={card.id + (flipped ? "-b" : "-f")}
                initial={{ opacity: 0, rotateY: flipped ? -90 : 90 }}
                animate={{ opacity: 1, rotateY: 0 }}
                exit={{ opacity: 0, rotateY: flipped ? 90 : -90 }}
                transition={{ duration: 0.25 }}
                onClick={() => setFlipped((f) => !f)}
                className="absolute inset-0 cursor-pointer rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl shadow-black/40"
              >
                {!flipped ? (
                  <FrontFace q={card} />
                ) : (
                  <BackFace q={card} overrides={overrides} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {flipped && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
              <AnswerActions q={card} />
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={prev}
              disabled={idx === 0}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-700/60 bg-zinc-900/40 px-4 py-2 text-sm disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" /> Trước
            </button>
            <button
              onClick={markMastered}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-emerald-900/40 transition-all duration-150 hover:bg-emerald-500 active:scale-95"
            >
              <Sparkles className="h-4 w-4" /> Đã thuộc
            </button>
            <button
              onClick={next}
              disabled={idx === deck.length - 1}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-700/60 bg-zinc-900/40 px-4 py-2 text-sm disabled:opacity-40"
            >
              Sau <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function FrontFace({ q }: { q: Question }) {
  return (
    <div className="flex h-full flex-col">
      <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
        Ch {q.chapter} · {q.qtype === "numeric" ? "Điền đáp án" : "Trắc nghiệm"}
      </span>
      <div className="mt-4 flex-1 overflow-y-auto pr-2 scrollbar-thin">
        <p className="text-balance text-xl leading-relaxed text-zinc-100">{q.question_text}</p>
      </div>
      <p className="mt-4 text-xs text-zinc-500">Bấm thẻ hoặc Space để lật xem đáp án</p>
    </div>
  );
}

function BackFace({ q, overrides }: { q: Question; overrides: ReturnType<typeof useExam.getState>["overrides"] }) {
  const correct = resolveCorrect(q, overrides);
  const numeric = resolveNumeric(q, overrides);
  const lowConf = q.confidence < 0.85 && !overrides[q.id];

  return (
    <div className="flex h-full flex-col">
      <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-400/80">Đáp án</span>
      {q.qtype === "numeric" ? (
        <div className="mt-6 text-center">
          <p className="text-zinc-400">{q.question_text}</p>
          <p className="mt-6 text-4xl font-semibold tracking-tight text-emerald-300">
            {numeric ?? "—"}
          </p>
        </div>
      ) : (
        <div className="mt-4 flex-1 overflow-y-auto pr-2 scrollbar-thin">
          <RevealedChoices q={q} correct={correct} density="compact" />
        </div>
      )}
      {lowConf && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-300 ring-1 ring-amber-500/30">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            Đáp án này chưa chắc 100%. Nếu sai, mở /review để chỉnh.
          </span>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center text-zinc-500">
      Hết thẻ rồi 🎉 — chọn thêm chương hoặc bỏ tick &quot;chỉ verified&quot; để mở rộng deck.
    </div>
  );
}
