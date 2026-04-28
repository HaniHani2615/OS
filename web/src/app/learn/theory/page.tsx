"use client";
import { useEffect, useState } from "react";
import { FileText, Download, ExternalLink, BookOpen, Presentation } from "lucide-react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const SLIDES: { file: string; title: string; chapter: string; inMidterm: boolean }[] = [
  { file: "Bai-1.pdf", title: "Bài 1 · Giới thiệu + Cấu trúc HĐH (Phần 1+2)", chapter: "1-2", inMidterm: true },
  { file: "NLHĐH-Bai-2.pdf", title: "Bài 2 · Tiến trình (Phần 3)", chapter: "3-4", inMidterm: true },
  { file: "NLHĐH-Bai-3.pdf", title: "Bài 3 · Lập lịch CPU (Phần 4)", chapter: "3-4", inMidterm: true },
  { file: "NLHĐH-Bai-4.pdf", title: "Bài 4 · Đồng bộ tiến trình (Phần 5)", chapter: "5-6", inMidterm: true },
  { file: "NLHĐH-Bai-5.pdf", title: "Bài 5 · Bế tắc (Phần 6)", chapter: "5-6", inMidterm: true },
  { file: "NLHĐH-Bai-6.pdf", title: "Bài 6 · Quản lý bộ nhớ (Phần 7)", chapter: "7-8", inMidterm: true },
  { file: "NLHĐH-Bai-7.pdf", title: "Bài 7 · Bộ nhớ ảo (Phần 8)", chapter: "7-8", inMidterm: false },
  { file: "NLHĐH-Bai-8.pdf", title: "Bài 8 · Giao diện hệ thống tập tin (Phần 9)", chapter: "7-8", inMidterm: false },
  { file: "NLHĐH-Bai-9.pdf", title: "Bài 9 · Cài đặt hệ thống tập tin (Phần 10)", chapter: "7-8", inMidterm: false },
  { file: "NLHĐH-Bai-10.pdf", title: "Bài 10 · Các hệ thống lưu trữ (Phần 11)", chapter: "7-8", inMidterm: false },
];

const NOTES: { file: string; title: string; chapter: string }[] = [
  { file: "ch1-2.md", title: "Chương 1–2 · Giới thiệu + Cấu trúc HĐH", chapter: "1-2" },
  { file: "ch3-4.md", title: "Chương 3–4 · Tiến trình + Lập lịch CPU", chapter: "3-4" },
  { file: "ch5-6.md", title: "Chương 5–6 · Đồng bộ + Bế tắc", chapter: "5-6" },
  { file: "ch7-8.md", title: "Chương 7–8 · Bộ nhớ + File system + Lưu trữ", chapter: "7-8" },
];

type Tab = "slides" | "notes";

export default function TheoryPage() {
  const [tab, setTab] = useState<Tab>("notes");
  const [activeSlide, setActiveSlide] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<string>(NOTES[0].file);
  const [mdContent, setMdContent] = useState<string>("");

  useEffect(() => {
    if (tab !== "notes") return;
    setMdContent("");
    fetch(`/summaries/${activeNote}`)
      .then((r) => r.text())
      .then(setMdContent)
      .catch(() => setMdContent("> Không tải được tóm tắt."));
  }, [activeNote, tab]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lý thuyết</h1>
        <p className="text-sm text-zinc-400">
          Tóm tắt cô đọng theo chương + slide gốc để tra cứu nhanh.
        </p>
      </div>

      <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900/40 p-1">
        <button
          onClick={() => setTab("notes")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
            tab === "notes" ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-zinc-100"
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" /> Tóm tắt theo chương
        </button>
        <button
          onClick={() => setTab("slides")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
            tab === "slides" ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-zinc-100"
          }`}
        >
          <Presentation className="h-3.5 w-3.5" /> Slide gốc
        </button>
      </div>

      {tab === "notes" && (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="space-y-2">
            {NOTES.map((n) => (
              <button
                key={n.file}
                onClick={() => setActiveNote(n.file)}
                className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                  activeNote === n.file
                    ? "border-violet-500/50 bg-violet-500/10 text-zinc-100"
                    : "border-zinc-800 bg-zinc-900/30 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/40"
                }`}
              >
                <BookOpen className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-violet-300" />
                <span>{n.title}</span>
              </button>
            ))}
          </div>
          <article className="theory-md rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
            {mdContent ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{mdContent}</ReactMarkdown>
            ) : (
              <p className="text-sm text-zinc-500">Đang tải…</p>
            )}
          </article>
        </div>
      )}

      {tab === "slides" && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {SLIDES.map((s) => (
              <button
                key={s.file}
                onClick={() => setActiveSlide(s.file)}
                className={`group flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                  activeSlide === s.file
                    ? "border-violet-500/50 bg-violet-500/10"
                    : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-800/40"
                }`}
              >
                <span
                  className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg ${
                    s.inMidterm ? "bg-violet-500/15 text-violet-300" : "bg-zinc-800/80 text-zinc-500"
                  }`}
                >
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">{s.title}</p>
                  <p className="text-xs text-zinc-500">
                    {s.inMidterm ? `Trong giữa kỳ · Ch ${s.chapter}` : "Ngoài giữa kỳ"}
                  </p>
                </div>
                <a
                  href={`/slides/${encodeURIComponent(s.file)}`}
                  download
                  onClick={(e) => e.stopPropagation()}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  title="Tải xuống"
                >
                  <Download className="h-4 w-4 text-zinc-400 hover:text-zinc-100" />
                </a>
              </button>
            ))}
          </div>

          {activeSlide && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-400">
                  Đang xem: <span className="text-zinc-100">{activeSlide}</span>
                </p>
                <a
                  href={`/slides/${encodeURIComponent(activeSlide)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200"
                >
                  Mở tab mới <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                <iframe
                  src={`/slides/${encodeURIComponent(activeSlide)}#view=FitH`}
                  className="h-[80vh] w-full"
                  title={activeSlide}
                />
              </div>
            </div>
          )}
        </>
      )}

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 text-sm text-zinc-400">
        Cần ôn theo dạng câu hỏi? Sang{" "}
        <Link href="/learn/read" className="text-violet-300 hover:text-violet-200">
          Đọc bank
        </Link>{" "}
        hoặc{" "}
        <Link href="/learn/flashcard" className="text-violet-300 hover:text-violet-200">
          Flashcard
        </Link>
        .
      </div>
    </div>
  );
}
