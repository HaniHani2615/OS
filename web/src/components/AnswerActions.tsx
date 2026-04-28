"use client";
import { Bookmark, BookmarkCheck, BadgeCheck, AlertTriangle } from "lucide-react";
import type { Question } from "@/lib/types";
import { useExam } from "@/lib/store";

/** Compact bookmark + verified badge bar. The deep explanation now lives
 *  per-choice in <RevealedChoices />. */
export function AnswerActions({ q }: { q: Question }) {
  const overrides = useExam((s) => s.overrides);
  const bookmarks = useExam((s) => s.bookmarks);
  const toggleBookmark = useExam((s) => s.toggleBookmark);

  const isVerified = q.confidence >= 0.85 || (overrides[q.id]?.correct?.length ?? 0) > 0;
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
      <span className="font-mono text-zinc-500">conf {q.confidence.toFixed(2)}</span>

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
    </div>
  );
}
