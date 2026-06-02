"use client";
import { Bookmark, BookmarkCheck, BadgeCheck, AlertTriangle, BookMarked } from "lucide-react";
import type { Question } from "@/lib/types";
import { useExam, resolveConfidence } from "@/lib/store";

/** Compact bookmark + verified badge bar. The deep explanation now lives
 *  per-choice in <RevealedChoices />. */
export function AnswerActions({ q, highlightWrong }: { q: Question; highlightWrong?: boolean }) {
  const overrides = useExam((s) => s.overrides);
  const bookmarks = useExam((s) => s.bookmarks);
  const toggleBookmark = useExam((s) => s.toggleBookmark);

  const effConf = resolveConfidence(q, overrides);
  const isVerified = effConf >= 0.85;
  const isBookmarked = !!bookmarks[q.id];

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
      {isVerified ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-1 text-emerald-300 ring-1 ring-emerald-500/30">
          <BadgeCheck className="h-3.5 w-3.5" /> Đáp án chuẩn
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-1 text-amber-300 ring-1 ring-amber-500/30">
          <AlertTriangle className="h-3.5 w-3.5" /> Cần review
        </span>
      )}
      <span className="font-mono text-zinc-500">conf {effConf.toFixed(2)}</span>

      {/* When got wrong, show a more prominent "flag to practice" button */}
      {highlightWrong && !isBookmarked ? (
        <button
          onClick={() => toggleBookmark(q.id)}
          className="ml-auto inline-flex items-center gap-1 rounded-md bg-rose-500/20 px-2 py-1 text-rose-300 ring-1 ring-rose-500/40 transition-colors hover:bg-rose-500/30"
          title="Gắn cờ để luyện lại"
        >
          <BookMarked className="h-3.5 w-3.5" />
          Luyện lại
        </button>
      ) : (
        <button
          onClick={() => toggleBookmark(q.id)}
          className={`ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 ring-1 transition-colors ${
            isBookmarked
              ? "bg-amber-500/15 text-amber-200 ring-amber-500/40"
              : "bg-zinc-900/40 text-zinc-400 ring-zinc-700/60 hover:bg-zinc-800/60"
          }`}
          title={isBookmarked ? "Bỏ cờ" : "Gắn cờ để review sau"}
        >
          {isBookmarked ? (
            <BookmarkCheck className="h-3.5 w-3.5" />
          ) : (
            <Bookmark className="h-3.5 w-3.5" />
          )}
          {isBookmarked ? "Đã gắn cờ" : "Gắn cờ"}
        </button>
      )}
    </div>
  );
}
