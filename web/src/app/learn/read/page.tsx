"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, Bookmark, BookmarkCheck, BadgeCheck, AlertTriangle } from "lucide-react";
import { loadQuestions, filterByChapters } from "@/lib/data";
import { CHAPTERS_ALL, CHAPTER_LABELS, type Chapter, type Question } from "@/lib/types";
import { ChapterPicker } from "@/components/ChapterPicker";
import { AnswerActions } from "@/components/AnswerActions";
import { RevealedChoices } from "@/components/RevealedChoices";
import { useExam, resolveCorrect } from "@/lib/store";

const PAGE = 25;

export default function ReadPage() {
  const [all, setAll] = useState<Question[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([...CHAPTERS_ALL]);
  const [query, setQuery] = useState("");
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [page, setPage] = useState(0);
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const overrides = useExam((s) => s.overrides);
  const bookmarks = useExam((s) => s.bookmarks);
  const toggleBookmark = useExam((s) => s.toggleBookmark);

  useEffect(() => {
    loadQuestions().then(setAll);
  }, []);

  const filtered = useMemo(() => {
    let pool = filterByChapters(all, chapters);
    if (onlyVerified)
      pool = pool.filter(
        (q) => q.confidence >= 0.85 || (overrides[q.id]?.correct?.length ?? 0) > 0
      );
    if (onlyFlagged) pool = pool.filter((q) => bookmarks[q.id]);
    if (query.trim()) {
      const q = query.toLowerCase();
      pool = pool.filter(
        (x) =>
          x.question_text.toLowerCase().includes(q) ||
          x.choices.some((c) => c.text.toLowerCase().includes(q))
      );
    }
    return pool;
  }, [all, chapters, onlyVerified, onlyFlagged, query, overrides, bookmarks]);

  useEffect(() => setPage(0), [chapters, onlyVerified, onlyFlagged, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const slice = filtered.slice(page * PAGE, (page + 1) * PAGE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Đọc bank theo chương</h1>
        <p className="text-sm text-zinc-400">
          Lướt toàn bộ ngân hàng câu hỏi như tài liệu — bấm câu để xem đáp án + giải thích.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-4">
        <ChapterPicker value={chapters} onChange={setChapters} />
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm trong câu hỏi hoặc đáp án…"
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/60 focus:outline-none"
            />
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={onlyVerified}
              onChange={(e) => setOnlyVerified(e.target.checked)}
              className="accent-violet-500"
            />
            Chỉ chuẩn
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={onlyFlagged}
              onChange={(e) => setOnlyFlagged(e.target.checked)}
              className="accent-amber-500"
            />
            Chỉ gắn cờ
          </label>
        </div>
      </div>

      <div className="text-xs text-zinc-500">
        {filtered.length} câu · trang {page + 1}/{pages}
      </div>

      <div className="space-y-2">
        {slice.map((q, i) => (
          <ReadCard
            key={q.id}
            q={q}
            index={page * PAGE + i + 1}
            isOpen={!!openIds[q.id]}
            onToggle={() => setOpenIds((m) => ({ ...m, [q.id]: !m[q.id] }))}
            isBookmarked={!!bookmarks[q.id]}
            onBookmark={() => toggleBookmark(q.id)}
            correct={resolveCorrect(q, overrides)}
          />
        ))}
        {slice.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center text-zinc-500">
            Không có câu khớp bộ lọc.
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm disabled:opacity-40"
          >
            ← Trước
          </button>
          <span className="text-xs text-zinc-500">
            {page + 1} / {pages}
          </span>
          <button
            disabled={page >= pages - 1}
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm disabled:opacity-40"
          >
            Sau →
          </button>
        </div>
      )}
    </div>
  );
}

function ReadCard({
  q,
  index,
  isOpen,
  onToggle,
  isBookmarked,
  onBookmark,
  correct,
}: {
  q: Question;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  isBookmarked: boolean;
  onBookmark: () => void;
  correct: string[];
}) {
  const isVerified = q.confidence >= 0.85;
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30 transition-all duration-150 hover:border-zinc-700/80">
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-zinc-800/40"
      >
        <span className="flex-shrink-0 grid place-items-center rounded-xl bg-violet-600 text-white font-bold font-mono text-sm shadow shadow-violet-700/40 min-w-[2rem] h-8 px-2">
          {index}
        </span>
        <span className="flex-1 text-sm leading-relaxed text-zinc-100">
          {q.question_text}
        </span>
        <span className="flex flex-shrink-0 items-center gap-1.5 text-xs">
          {isVerified ? (
            <BadgeCheck className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          )}
          <span
            onClick={(e) => {
              e.stopPropagation();
              onBookmark();
            }}
            className={`grid h-6 w-6 cursor-pointer place-items-center rounded ${
              isBookmarked ? "text-amber-300" : "text-zinc-600 hover:text-zinc-300"
            }`}
            title={isBookmarked ? "Bỏ cờ" : "Gắn cờ"}
          >
            {isBookmarked ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
          </span>
          <span className="rounded-md bg-zinc-800/80 px-2 py-0.5 font-mono text-zinc-400">
            Ch {q.chapter}
          </span>
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-zinc-800 px-4 pb-4 pt-3">
          <RevealedChoices q={q} correct={correct} density="compact" />
          <AnswerActions q={q} />
          <p className="mt-2 text-[11px] text-zinc-600">
            {CHAPTER_LABELS[q.chapter]}
          </p>
        </div>
      )}
    </div>
  );
}
