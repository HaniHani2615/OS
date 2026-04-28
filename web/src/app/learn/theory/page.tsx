"use client";
import { useState } from "react";
import { FileText, Download, ExternalLink } from "lucide-react";
import Link from "next/link";

const SLIDES: { file: string; title: string; chapter: string; inMidterm: boolean }[] = [
  { file: "Bai-1.pdf", title: "Bài 1 · Giới thiệu về HĐH", chapter: "1-2", inMidterm: true },
  { file: "NLHĐH-Bai-2.pdf", title: "Bài 2 · Cấu trúc hệ điều hành", chapter: "1-2", inMidterm: true },
  { file: "NLHĐH-Bai-3.pdf", title: "Bài 3 · Tiến trình", chapter: "3-4", inMidterm: true },
  { file: "NLHĐH-Bai-4.pdf", title: "Bài 4 · Luồng (Threads)", chapter: "3-4", inMidterm: true },
  { file: "NLHĐH-Bai-5.pdf", title: "Bài 5 · Lập lịch CPU", chapter: "3-4", inMidterm: true },
  { file: "NLHĐH-Bai-6.pdf", title: "Bài 6 · Đồng bộ tiến trình", chapter: "5-6", inMidterm: true },
  { file: "NLHĐH-Bai-7.pdf", title: "Bài 7 · Bế tắc (Deadlock)", chapter: "5-6", inMidterm: true },
  { file: "NLHĐH-Bai-8.pdf", title: "Bài 8 · Quản lý bộ nhớ chính", chapter: "7", inMidterm: true },
  { file: "NLHĐH-Bai-9.pdf", title: "Bài 9 · Bộ nhớ ảo", chapter: "8", inMidterm: false },
  { file: "NLHĐH-Bai-10.pdf", title: "Bài 10 · Hệ thống tệp", chapter: "—", inMidterm: false },
];

export default function TheoryPage() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lý thuyết — Slide bài giảng</h1>
        <p className="text-sm text-zinc-400">
          Đọc trực tiếp slide gốc của môn. Bấm vào bài để mở viewer ngay tại đây.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {SLIDES.map((s) => (
          <button
            key={s.file}
            onClick={() => setActive(s.file)}
            className={`group flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
              active === s.file
                ? "border-violet-500/50 bg-violet-500/10"
                : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-800/40"
            }`}
          >
            <span
              className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg ${
                s.inMidterm
                  ? "bg-violet-500/15 text-violet-300"
                  : "bg-zinc-800/80 text-zinc-500"
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

      {active && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">
              Đang xem: <span className="text-zinc-100">{active}</span>
            </p>
            <a
              href={`/slides/${encodeURIComponent(active)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200"
            >
              Mở tab mới <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
            <iframe
              src={`/slides/${encodeURIComponent(active)}#view=FitH`}
              className="h-[80vh] w-full"
              title={active}
            />
          </div>
        </div>
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
