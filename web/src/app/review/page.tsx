"use client";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  History,
  Undo2,
  Pencil,
} from "lucide-react";
import { loadQuestions, clearCache } from "@/lib/data";
import type { Question } from "@/lib/types";
import { useExam } from "@/lib/store";

type Tab = "needs_review" | "low_confidence" | "all" | "flagged" | "history";
type HistoryEntry = {
  hid?: string;
  id: string;
  ts: string;
  before: { correct_labels: string[]; numeric_answer?: string };
  after: { correct_labels: string[]; numeric_answer?: string };
  note?: string;
};

export default function ReviewPage() {
  const [rawAll, setRawAll] = useState<Question[]>([]);
  const [tab, setTab] = useState<Tab>("needs_review");
  const [idx, setIdx] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [legacyHistory, setLegacyHistory] = useState<HistoryEntry[]>([]);
  const [undoingHid, setUndoingHid] = useState<string | null>(null);
  const [pendingJumpId, setPendingJumpId] = useState<string | null>(null);
  const bookmarks = useExam((s) => s.bookmarks);
  const toggleBookmark = useExam((s) => s.toggleBookmark);
  const overrides = useExam((s) => s.overrides);
  const setOverride = useExam((s) => s.setOverride);
  const clearOverride = useExam((s) => s.clearOverride);
  const storeEdits = useExam((s) => s.editHistory);
  const addEdit = useExam((s) => s.addEdit);
  const removeEdit = useExam((s) => s.removeEdit);

  const isDev = process.env.NODE_ENV === "development";

  useEffect(() => {
    loadQuestions().then(setRawAll);
    fetch("/data/edit_history.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((h) => setLegacyHistory(Array.isArray(h) ? h : []))
      .catch(() => setLegacyHistory([]));
  }, []);

  // Apply client-side overrides (localStorage) on top of the bank so a
  // correction persists across reloads and works on Vercel, where the server
  // can't write the question bank.
  const all = useMemo<Question[]>(
    () =>
      rawAll.map((q) => {
        const o = overrides[q.id];
        if (!o) return q;
        const risky = o.note === "risky_unconfirmed";
        return {
          ...q,
          correct_labels: o.correct.length > 0 ? o.correct : q.correct_labels,
          numeric_answer: o.numeric ?? q.numeric_answer,
          confidence: risky ? 0.5 : 1,
          needs_review: false,
          decision: risky ? "acknowledged_risky" : "manual_verified",
        };
      }),
    [rawAll, overrides]
  );

  // Merge the client edit log (undoable everywhere) with the legacy baked-in
  // history file, newest first.
  const history = useMemo<HistoryEntry[]>(() => {
    const seen = new Set(storeEdits.map((e) => e.hid));
    return [...storeEdits, ...legacyHistory.filter((h) => !h.hid || !seen.has(h.hid))].sort(
      (a, b) => (a.ts < b.ts ? 1 : -1)
    );
  }, [storeEdits, legacyHistory]);

  const list = useMemo(() => {
    if (tab === "history" || tab === "all") return tab === "all" ? all : [];
    if (tab === "flagged") return all.filter((q) => bookmarks[q.id]);
    if (tab === "low_confidence") return all.filter((q) => q.confidence < 0.85);
    return all.filter((q) => q.needs_review);
  }, [all, tab, bookmarks]);

  const allById = useMemo(() => new Map(all.map((q) => [q.id, q])), [all]);

  // Reset idx on tab change (skip if we have a pending jump targeting this tab)
  useEffect(() => {
    if (pendingJumpId === null) setIdx(0);
  }, [tab, pendingJumpId]);

  // Clamp idx when list shrinks after a question is confirmed
  useEffect(() => {
    if (list.length > 0 && idx >= list.length) setIdx(list.length - 1);
  }, [list.length, idx]);

  // Resolve pending jump once list contains the target question
  useEffect(() => {
    if (!pendingJumpId) return;
    const target = list.findIndex((x) => x.id === pendingJumpId);
    if (target >= 0) {
      setIdx(target);
      setPendingJumpId(null);
    }
  }, [pendingJumpId, list]);

  function jumpToQuestion(id: string) {
    setPendingJumpId(id);
    setTab("all");
  }

  const q = list[idx];
  const [draft, setDraft] = useState<string[]>([]);
  const [numericDraft, setNumericDraft] = useState("");

  useEffect(() => {
    if (!q) return;
    setDraft(q.correct_labels);
    setNumericDraft(q.numeric_answer ?? "");
  }, [q]);

  function toggleLabel(label: string) {
    setDraft((d) => (d.includes(label) ? d.filter((x) => x !== label) : [...d, label]));
  }

  async function confirmAnswer() {
    if (!q) return;
    setSaveState("saving");

    const hid = crypto.randomUUID();
    const correct_labels = q.qtype === "numeric" ? q.correct_labels : draft;
    const numeric_answer = q.qtype === "numeric" ? numericDraft.trim() : undefined;

    const before: HistoryEntry["before"] = {
      correct_labels: q.correct_labels,
      ...(q.numeric_answer ? { numeric_answer: q.numeric_answer } : {}),
    };
    const after: HistoryEntry["after"] = {
      correct_labels,
      ...(numeric_answer !== undefined ? { numeric_answer } : {}),
    };

    // Persist client-side first — works everywhere, including Vercel.
    setOverride(q.id, correct_labels, numeric_answer);
    addEdit({ hid, id: q.id, ts: new Date().toISOString(), before, after });

    // In dev, also bake the change into the canonical bank (best-effort).
    if (isDev) {
      try {
        const res = await fetch("/api/confirm-answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hid, id: q.id, correct_labels, numeric_answer }),
        });
        if (res.ok) clearCache(); // bust module-level cache so other pages refetch
      } catch {
        /* ignore — client override already saved */
      }
    }

    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 1200);
  }

  async function skipAsRisky() {
    if (!q) return;
    setSaveState("saving");
    const hid = crypto.randomUUID();
    const correct_labels = q.correct_labels;
    const numeric_answer = q.qtype === "numeric" ? (q.numeric_answer ?? undefined) : undefined;

    const before = { correct_labels, ...(numeric_answer !== undefined ? { numeric_answer } : {}) };

    // Keep the machine answer but acknowledge it as risky — persisted client-side.
    setOverride(q.id, correct_labels, numeric_answer, "risky_unconfirmed");
    addEdit({
      hid, id: q.id, ts: new Date().toISOString(),
      before, after: before, note: "risky_unconfirmed",
    });
    if (!bookmarks[q.id]) toggleBookmark(q.id); // flag so it shows in "Đã gắn cờ"

    if (isDev) {
      try {
        const res = await fetch("/api/confirm-answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hid, id: q.id, correct_labels, numeric_answer, note: "risky_unconfirmed" }),
        });
        if (res.ok) clearCache();
      } catch {
        /* ignore — client override already saved */
      }
    }

    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 1200);
  }

  async function undoEntry(entry: HistoryEntry) {
    if (!entry.hid) return;
    setUndoingHid(entry.hid);

    // Revert client-side: drop the override (back to bank value) and the log entry.
    clearOverride(entry.id);
    removeEdit(entry.hid);
    setLegacyHistory((prev) => prev.filter((h) => h.hid !== entry.hid));

    // In dev, also revert the canonical bank (best-effort).
    if (isDev) {
      try {
        const res = await fetch("/api/undo-answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hid: entry.hid }),
        });
        if (res.ok) clearCache();
      } catch {
        /* ignore — client override already cleared */
      }
    }

    setUndoingHid(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Review &amp; xác minh đáp án</h1>
        <p className="text-sm text-zinc-400">
          Chọn đáp án đúng → Xác nhận. Câu rời queue ngay, xem &amp; hoàn tác trong tab Đã sửa.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["needs_review", `Cần review (${all.filter((q) => q.needs_review).length})`],
            ["low_confidence", "Confidence thấp"],
            ["flagged", "Đã gắn cờ"],
            ["all", "Tất cả"],
            ["history", `Đã sửa (${history.length})`],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-150 active:scale-95 ${
              tab === t
                ? t === "history"
                  ? "border-emerald-500/60 bg-emerald-600/20 text-emerald-200 shadow-sm"
                  : "border-violet-500/60 bg-violet-600 text-white shadow-sm shadow-violet-900/40"
                : "border-zinc-700/60 bg-zinc-900/40 text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 hover:border-zinc-600/60"
            }`}
          >
            {t === "history" && <History className="h-3.5 w-3.5" />}
            {label}
          </button>
        ))}
      </div>

      {/* History tab */}
      {tab === "history" && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          {history.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">Chưa có câu nào được xác nhận.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((h, i) => {
                const hq = allById.get(h.id);
                const noChange =
                  h.before.correct_labels.join(",") === h.after.correct_labels.join(",") &&
                  (h.before.numeric_answer ?? "") === (h.after.numeric_answer ?? "");
                return (
                <li
                  key={`${h.hid ?? h.id}-${i}`}
                  onClick={() => jumpToQuestion(h.id)}
                  className={`group flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm cursor-pointer transition-colors ${
                    noChange
                      ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-400/60 hover:bg-amber-500/10"
                      : "border-zinc-800 bg-zinc-950/50 hover:border-violet-500/40 hover:bg-zinc-900/60"
                  }`}
                  title="Click để mở câu này và sửa lại"
                >
                  {/* Question text */}
                  <p className="line-clamp-2 text-xs leading-relaxed text-zinc-300">
                    {hq ? hq.question_text : <span className="italic text-zinc-600">Đang tải…</span>}
                  </p>
                  {/* Metadata row */}
                  <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-xs text-zinc-500 tabular-nums">
                    {new Date(h.ts).toLocaleString("vi-VN")}
                  </span>
                  <span className="font-mono text-zinc-500">{h.id}</span>
                  {noChange && (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-300">
                      <AlertCircle className="h-3 w-3" /> trước=sau
                    </span>
                  )}
                  <span className={`rounded px-1.5 py-0.5 font-mono text-xs ${
                    noChange ? "bg-zinc-700/40 text-zinc-400" : "bg-rose-500/15 text-rose-300"
                  }`}>
                    {(h.before.correct_labels.join(", ") || h.before.numeric_answer || "—").toUpperCase()}
                  </span>
                  <span className="text-zinc-600">→</span>
                  <span className={`rounded px-1.5 py-0.5 font-mono text-xs ${
                    noChange ? "bg-zinc-700/40 text-zinc-400" : "bg-emerald-500/15 text-emerald-300"
                  }`}>
                    {(h.after.correct_labels.join(", ") || h.after.numeric_answer || "—").toUpperCase()}
                  </span>
                  {h.note && <span className="text-xs italic text-zinc-500">{h.note}</span>}
                  <div className="ml-auto flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => jumpToQuestion(h.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-zinc-700/60 px-2.5 py-1 text-xs text-zinc-400 transition-colors hover:border-violet-500/50 hover:bg-violet-500/10 hover:text-violet-300"
                    >
                      <Pencil className="h-3 w-3" />
                      Sửa lại
                    </button>
                    {h.hid ? (
                      <button
                        onClick={() => undoEntry(h)}
                        disabled={undoingHid === h.hid}
                        className="inline-flex items-center gap-1 rounded-md border border-zinc-700/60 px-2.5 py-1 text-xs text-zinc-400 transition-colors hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-40"
                      >
                        <Undo2 className="h-3 w-3" />
                        {undoingHid === h.hid ? "Đang hoàn tác..." : "Hoàn tác"}
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-700">legacy</span>
                    )}
                  </div>
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Question view */}
      {tab !== "history" && (
        <>
          {!q ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center text-zinc-500">
              {tab === "needs_review"
                ? "Không còn câu nào cần review. Kiểm tra tab Đã sửa."
                : "Không có câu nào với bộ lọc này."}
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
                            <span className="text-xs text-emerald-400" title="máy chấm đánh đúng">✓</span>
                          )}
                          {wasWrong && (
                            <span className="text-xs text-rose-400" title="máy chấm đánh sai">✗</span>
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
                    onClick={confirmAnswer}
                    disabled={saveState === "saving" || (q.qtype !== "numeric" && draft.length === 0)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium shadow-sm transition-all duration-150 active:scale-95 disabled:opacity-40 ${
                      saveState === "saved"
                        ? "bg-emerald-500/20 text-emerald-300 shadow-emerald-900/20"
                        : saveState === "error"
                          ? "bg-rose-500/20 text-rose-300"
                          : "bg-emerald-600 text-white shadow-emerald-900/40 hover:bg-emerald-500"
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {saveState === "saving"
                      ? "Đang lưu..."
                      : saveState === "saved"
                        ? "Đã xác nhận ✓"
                        : saveState === "error"
                          ? "Lỗi!"
                          : "Lưu"}
                  </button>
                  <button
                    onClick={skipAsRisky}
                    disabled={saveState === "saving"}
                    title="Bỏ qua, giữ nguyên đáp án máy, đánh dấu câu này là rủi ro (chưa được xác minh hoàn toàn)"
                    className="inline-flex items-center gap-1.5 rounded-md border border-amber-700/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-300 transition-colors hover:bg-amber-500/20 disabled:opacity-40"
                  >
                    <AlertCircle className="h-3.5 w-3.5" />
                    Bỏ qua (rủi ro)
                  </button>
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
                <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                  <AlertCircle className="h-3 w-3" />
                  {isDev ? "Lưu vào trình duyệt + bank gốc" : "Lưu vào trình duyệt (localStorage)"}
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
        </>
      )}
    </div>
  );
}
