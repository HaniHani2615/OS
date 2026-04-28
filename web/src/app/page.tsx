"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { loadStats } from "@/lib/data";
import { CHAPTER_LABELS, CHAPTERS_MIDTERM, type Stats } from "@/lib/types";
import {
  BookOpen,
  Zap,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  FileText,
  ScrollText,
} from "lucide-react";

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    loadStats().then(setStats);
  }, []);

  return (
    <div className="space-y-12">
      <section className="pt-8 text-center">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-violet-400">
          Hệ điều hành — Giữa kì
        </p>
        <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight md:text-6xl">
          Ôn cho buổi thi <span className="text-zinc-500">không có lần thi lại</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-balance text-zinc-400">
          {stats ? (
            <>
              <b className="text-zinc-200">{stats.in_scope}</b> câu hỏi trong phạm vi Ch&nbsp;1-7,{" "}
              <b className="text-emerald-400">{stats.verified_total}</b> đã đối chiếu chuẩn máy chấm.
            </>
          ) : (
            "Đang tải ngân hàng câu hỏi…"
          )}
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <ModeCard
          href="/exam"
          icon={<ClipboardList className="h-5 w-5" />}
          title="Phòng thi"
          desc="Đề ngẫu nhiên đúng tỉ lệ chương, có đếm giờ. Chấm khi nộp."
          accent="violet"
          highlight
        />
        <ModeCard
          href="/learn/quiz"
          icon={<Zap className="h-5 w-5" />}
          title="Quiz nhanh"
          desc="Trả lời từng câu, phản hồi tức thì + streak + giải thích."
          accent="emerald"
        />
        <ModeCard
          href="/learn/flashcard"
          icon={<BookOpen className="h-5 w-5" />}
          title="Flashcard"
          desc="Lật thẻ câu lý thuyết, đánh dấu đã thuộc."
          accent="sky"
        />
        <ModeCard
          href="/learn/theory"
          icon={<FileText className="h-5 w-5" />}
          title="Lý thuyết"
          desc="Tóm tắt cô đọng theo chương + slide gốc PDF."
          accent="amber"
        />
        <ModeCard
          href="/learn/read"
          icon={<ScrollText className="h-5 w-5" />}
          title="Đọc bank"
          desc="Lướt toàn bộ ngân hàng theo chương — có gắn cờ & giải thích."
          accent="rose"
        />
        <ModeCard
          href="/review"
          icon={<AlertCircle className="h-5 w-5" />}
          title="Review"
          desc="Sửa đáp án sai, chuẩn hoá vào bank, xem lịch sử."
          accent="zinc"
        />
      </section>

      {stats && (
        <section>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-400">
            Phân bổ theo chương
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {CHAPTERS_MIDTERM.map((ch) => {
              const n = stats.by_chapter[ch] ?? 0;
              return (
                <div
                  key={ch}
                  className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{CHAPTER_LABELS[ch]}</p>
                    <p className="text-xs text-zinc-500">{n} câu unique</p>
                  </div>
                  <div className="h-1.5 w-32 overflow-hidden rounded-full bg-zinc-800/80">
                    <div
                      className="h-full rounded-full bg-violet-500/70"
                      style={{ width: `${Math.min(100, (n / 320) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              {stats.verified_total} câu đáp án verified (✓ máy chấm)
            </span>
            <span className="flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
              {stats.needs_review} câu cần review
            </span>
            <Link
              href="/review"
              className="ml-auto inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-100"
            >
              Mở Review mode <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

const accentMap: Record<string, { border: string; icon: string; glow: string }> = {
  violet: { border: "border-violet-500/30", icon: "text-violet-400", glow: "bg-violet-500/8" },
  emerald: { border: "border-zinc-800/80", icon: "text-emerald-400", glow: "bg-emerald-500/6" },
  sky:     { border: "border-zinc-800/80", icon: "text-sky-400",     glow: "bg-sky-500/6" },
  amber:   { border: "border-zinc-800/80", icon: "text-amber-400",   glow: "bg-amber-500/6" },
  rose:    { border: "border-zinc-800/80", icon: "text-rose-400",    glow: "bg-rose-500/6" },
  zinc:    { border: "border-zinc-800/80", icon: "text-zinc-400",    glow: "" },
};

function ModeCard({
  href,
  icon,
  title,
  desc,
  accent = "zinc",
  highlight,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  accent?: string;
  highlight?: boolean;
}) {
  const a = accentMap[accent] ?? accentMap.zinc;
  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-2xl border bg-zinc-900/40 p-6 transition-all duration-150 hover:-translate-y-1 hover:bg-zinc-900/70 active:translate-y-0 active:duration-75 ${
        highlight ? a.border : "border-zinc-800/80 hover:border-zinc-700/60"
      }`}
    >
      {a.glow && (
        <div className={`pointer-events-none absolute inset-0 ${a.glow} transition-opacity group-hover:opacity-150`} />
      )}
      <div className="relative">
        <div className={`mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-950/80 ring-1 ring-zinc-700/50 ${a.icon}`}>
          {icon}
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-zinc-100">{title}</h3>
        <p className="mt-1.5 text-sm text-zinc-400">{desc}</p>
        <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-zinc-500 transition-all duration-150 group-hover:gap-2 group-hover:text-zinc-300">
          Bắt đầu
          <ArrowRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}
