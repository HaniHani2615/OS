"use client";
import { CHAPTER_LABELS, CHAPTERS_MIDTERM, type Chapter } from "@/lib/types";

export function ChapterPicker({
  value,
  onChange,
}: {
  value: Chapter[];
  onChange: (next: Chapter[]) => void;
}) {
  const toggle = (ch: Chapter) => {
    onChange(value.includes(ch) ? value.filter((c) => c !== ch) : [...value, ch]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {CHAPTERS_MIDTERM.map((ch) => {
        const on = value.includes(ch);
        return (
          <button
            key={ch}
            onClick={() => toggle(ch)}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              on
                ? "border-violet-400/60 bg-violet-500/15 text-violet-100"
                : "border-zinc-700/60 bg-zinc-900/40 text-zinc-400 hover:bg-zinc-800/50"
            }`}
          >
            {CHAPTER_LABELS[ch]}
          </button>
        );
      })}
    </div>
  );
}
