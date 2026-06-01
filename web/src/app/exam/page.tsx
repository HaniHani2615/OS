"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Clock, Layers, Sparkles } from "lucide-react";
import { loadQuestions } from "@/lib/data";
import { CHAPTERS_ALL, type Chapter, type Question } from "@/lib/types";
import { sampleExam } from "@/lib/sampler";
import { useExam } from "@/lib/store";
import { ChapterPicker } from "@/components/ChapterPicker";

export default function ExamConfigPage() {
  const router = useRouter();
  const startExam = useExam((s) => s.startExam);
  const [all, setAll] = useState<Question[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([...CHAPTERS_ALL]);
  const [n, setN] = useState(30);
  const [mins, setMins] = useState(30);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  useEffect(() => {
    loadQuestions().then(setAll);
  }, []);

  const pool = useMemo(() => {
    let p = all.filter((q) => chapters.includes(q.chapter) && q.qtype === "single" && q.choices.length >= 2);
    if (verifiedOnly) p = p.filter((q) => q.confidence >= 0.85 && q.correct_labels.length > 0);
    return p;
  }, [all, chapters, verifiedOnly]);

  function start() {
    const sample = sampleExam(pool, { total: Math.min(n, pool.length), chapters });
    const id = `exam-${Date.now()}`;
    startExam({
      id,
      startedAt: Date.now(),
      durationSec: mins * 60,
      questionIds: sample.map((q) => q.id),
      answers: {},
      flagged: {},
    });
    router.push(`/exam/run/${id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-violet-300/70">
          Cấu hình đề
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Phòng thi thật</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Đề được lấy stratified theo chương để đảm bảo cấu trúc cân bằng. Thi xong mới chấm.
        </p>
      </div>

      <Section icon={<Layers className="h-4 w-4" />} title="Chương">
        <ChapterPicker value={chapters} onChange={setChapters} />
      </Section>

      <Section icon={<ClipboardList className="h-4 w-4" />} title="Số câu">
        <div className="flex flex-wrap gap-2">
          {[15, 20, 30, 40, 50].map((v) => (
            <button
              key={v}
              onClick={() => setN(v)}
              className={`rounded-md border px-4 py-1.5 text-sm font-medium transition-all duration-150 active:scale-95 ${
                n === v
                  ? "border-violet-500/60 bg-violet-600 text-white shadow-sm shadow-violet-900/40"
                  : "border-zinc-700/60 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800/60"
              }`}
            >
              {v} câu
            </button>
          ))}
        </div>
      </Section>

      <Section icon={<Clock className="h-4 w-4" />} title="Thời gian">
        <div className="flex flex-wrap gap-2">
          {[15, 30, 45, 60].map((v) => (
            <button
              key={v}
              onClick={() => setMins(v)}
              className={`rounded-md border px-4 py-1.5 text-sm font-medium transition-all duration-150 active:scale-95 ${
                mins === v
                  ? "border-violet-500/60 bg-violet-600 text-white shadow-sm shadow-violet-900/40"
                  : "border-zinc-700/60 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800/60"
              }`}
            >
              {v} phút
            </button>
          ))}
        </div>
      </Section>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-4">
        <input
          type="checkbox"
          checked={verifiedOnly}
          onChange={(e) => setVerifiedOnly(e.target.checked)}
          className="mt-0.5 accent-violet-500"
        />
        <div>
          <p className="text-sm font-medium text-zinc-100">Chỉ dùng câu verified</p>
          <p className="text-xs text-zinc-500">
            Khuyến nghị bật. Tắt nếu muốn thử cả những câu đáp án chưa chắc (confidence thấp).
          </p>
        </div>
      </label>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-zinc-900/0 p-5">
        <div>
          <p className="text-sm text-zinc-400">Pool sẵn sàng</p>
          <p className="text-2xl font-semibold tracking-tight">{pool.length} câu</p>
          <p className="mt-1 text-xs text-zinc-500">
            Tỉ lệ mặc định: 1-2 (15%) · 3-4 (35%) · 5-6 (30%) · 7 (20%)
          </p>
        </div>
        <button
          onClick={start}
          disabled={pool.length === 0 || n > pool.length * 2}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-lg bg-violet-500 px-5 py-3 font-medium text-white shadow-lg shadow-violet-500/30 hover:bg-violet-400 active:scale-95 disabled:opacity-40"
        >
          <Sparkles className="h-4 w-4" /> Bắt đầu thi
        </button>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-zinc-400">
        {icon} {title}
      </h2>
      {children}
    </div>
  );
}
