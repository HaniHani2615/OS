"use client";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Save, Trash2, CheckCircle, ArrowLeft, ArrowRight, Bookmark, BookmarkCheck } from "lucide-react";
import { loadQuestions } from "@/lib/data";
import type { Question } from "@/lib/types";
import { useExam } from "@/lib/store";

type Filter = "needs_review" | "low_confidence" | "all" | "overridden" | "flagged";

export default function ReviewPage() {
  const [all, setAll] = useState<Question[]>([]);
  const [filter, setFilter] = useState<Filter>("needs_review");
  const [idx, setIdx] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const overrides = useExam((s) => s.overrides);
  const setOverride = useExam((s) => s.setOverride);
  const clearOverride = useExam((s) => s.clearOverride);
  const bookmarks = useExam((s) => s.bookmarks);
  const toggleBookmark = useExam((s) => s.toggleBookmark);

  useEffect(() => {
    loadQuestions().then(setAll);
  }, []);

  const list = useMemo(() => {
    if (filter === "all") return all;
    if (filter === "overridden") return all.filter((q) => overrides[q.id]);
    if (filter === "flagged") return all.filter((q) => bookmarks[q.id]);
    if (filter === "low_confidence") return all.filter((q) => q.confidence < 0.85);
    return all.filter((q) => q.needs_review);
  }, [all, filter, overrides, bookmarks]);

  useEffect(() => setIdx(0), [filter]);

  const q = list[idx];
  const ov = q ? overrides[q.id] : undefined;
  const [draft, setDraft] = useState<string[]>([]);
  const [numericDraft, setNumericDraft] = useState("");

  useEffect(() => {
    if (!q) return;
    setDraft(ov?.correct ?? q.correct_labels);
    setNumericDraft(ov?.numeric ?? q.numeric_answer ?? "");
  }, [q, ov]);

  function toggleLabel(label: string) {
    setDraft((d) => (d.includes(label) ? d.filter((x) => x !== label) : [...d, label]));
  }

  async function saveToFile() {
    setSaveState("saving");
    try {
      const patch = Object.entries(overrides).map(([id, v]) => ({ id, ...v }));
      const res = await fetch("/api/save-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Review &amp; xác minh đáp án</h1>
          <p className="text-sm text-zinc-400">
            Sửa đáp án sai, override sẽ ghi vào localStorage và áp dụng cho mọi mode.
          </p>
        </div>
        <button
          onClick={saveToFile}
          disabled={Object.keys(overrides).length === 0 || saveState === "saving"}
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors disabled:opacity-40 ${
            saveState === "saved"
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
              : saveState === "error"
                ? "border-rose-500/50 bg-rose-500/10 text-rose-300"
                : "border-zinc-700/60 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800/60"
          }`}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          {saveState === "saving"
            ? "Đang lưu..."
            : saveState === "saved"
              ? `Đã lưu file (${Object.keys(overrides).length})`
              : saveState === "error"
                ? "Lỗi!"
                : `Lưu ra file (${Object.keys(overrides).length})`}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["needs_review", "low_confidence", "flagged", "overridden", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-150 active:scale-95 ${
              filter === f
                ? "border-violet-500/60 bg-violet-600 text-white shadow-sm shadow-violet-900/40"
                : "border-zinc-700/60 bg-zinc-900/40 text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 hover:border-zinc-600/60"
            }`}
          >
            {labelFor(f)}
          </button>
        ))}
      </div>

      {!q ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center text-zinc-500">
          Không có câu nào với bộ lọc này.
        </div>
      ) : (
        <>
          <div className="text-xs text-zinc-500">
            {idx + 1} / {list.length}
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 transition-all duration-150">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-md bg-zinc-800/80 px-2 py-0.5 font-mono text-zinc-300">
                Ch {q.chapter}
              </span>
              <span
                className={`rounded-md px-2 py-0.5 font-mono ${
                  q.confidence >= 0.85
                    ? "bg-emerald-500/15 text-emerald-300"
                    : q.confidence > 0
                      ? "bg-amber-500/15 text-amber-300"
                      : "bg-rose-500/15 text-rose-300"
                }`}
              >
                conf {q.confidence.toFixed(2)}
              </span>
              <span className="text-zinc-500">{q.evidence_count} nguồn</span>
              {q.decision && <span className="text-zinc-600">· {q.decision}</span>}
            </div>
            <p className="text-balance text-base leading-relaxed text-zinc-100">{q.question_text}</p>

            {q.qtype === "numeric" ? (
              <div className="mt-5">
                <label className="text-xs text-zinc-500">Đáp án số/chuỗi:</label>
                <input
                  value={numericDraft}
                  onChange={(e) => setNumericDraft(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm"
                />
              </div>
            ) : (
              <div className="mt-5 space-y-2">
                {q.choices.map((c) => {
                  const on = draft.includes(c.label);
                  const wasCorrect = q.correct_labels.includes(c.label);
                  const wasWrong = q.wrong_labels?.includes(c.label);
                  return (
                    <button
                      key={c.label}
                      onClick={() => toggleLabel(c.label)}
                      className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                        on
                          ? "border-emerald-500/50 bg-emerald-500/10"
                          : "border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/50"
                      }`}
                    >
                      <span className="mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-md bg-zinc-800/80 font-mono text-xs uppercase">
                        {c.label}
                      </span>
                      <span className="flex-1 text-sm leading-relaxed text-zinc-100">{c.text}</span>
                      {wasCorrect && (
                        <span className="text-xs text-emerald-400" title="máy chấm đánh đúng">
                          ✓
                        </span>
                      )}
                      {wasWrong && (
                        <span className="text-xs text-rose-400" title="máy chấm đánh sai">
                          ✗
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {q.sources && q.sources.length > 0 && (
              <details className="mt-4 text-xs text-zinc-500">
                <summary className="cursor-pointer hover:text-zinc-300">
                  Nguồn ({q.sources.length})
                </summary>
                <ul className="mt-2 space-y-1 font-mono">
                  {q.sources.map((s, i) => (
                    <li key={i}>
                      [{s.tier}] {s.path?.split("/").pop()}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  if (q.qtype === "numeric") setOverride(q.id, [], numericDraft.trim());
                  else setOverride(q.id, draft);
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-emerald-900/40 transition-all duration-150 hover:bg-emerald-500 active:scale-95"
              >
                <Save className="h-4 w-4" /> Lưu override
              </button>
              {ov && (
                <button
                  onClick={() => clearOverride(q.id)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800/60"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Bỏ override
                </button>
              )}
              <button
                onClick={() => toggleBookmark(q.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm ring-1 transition-colors ${
                  bookmarks[q.id]
                    ? "bg-amber-500/15 text-amber-200 ring-amber-500/40"
                    : "border border-zinc-700 text-zinc-300 ring-transparent hover:bg-zinc-800/60"
                }`}
              >
                {bookmarks[q.id] ? (
                  <BookmarkCheck className="h-3.5 w-3.5" />
                ) : (
                  <Bookmark className="h-3.5 w-3.5" />
                )}
                {bookmarks[q.id] ? "Đã gắn cờ" : "Gắn cờ"}
              </button>
              {ov && (
                <span className="text-xs text-emerald-400">
                  ✓ Đã override → {(ov.correct.join(", ") || ov.numeric || "—").toUpperCase()}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              disabled={idx === 0}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-700/60 px-4 py-2 text-sm disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" /> Trước
            </button>
            <span className="text-xs text-zinc-500 inline-flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Override lưu trên trình duyệt này
            </span>
            <button
              onClick={() => setIdx((i) => Math.min(list.length - 1, i + 1))}
              disabled={idx === list.length - 1}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-700/60 px-4 py-2 text-sm disabled:opacity-40"
            >
              Sau <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function labelFor(f: Filter) {
  return {
    needs_review: "Cần review",
    low_confidence: "Confidence thấp",
    flagged: "Đã gắn cờ",
    overridden: "Đã override",
    all: "Tất cả",
  }[f];
}
