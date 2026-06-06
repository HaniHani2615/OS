"use client";
import { useEffect, useState } from "react";
import { Check, X, Lightbulb } from "lucide-react";
import type { Question, Explanation } from "@/lib/types";
import { loadExplanations } from "@/lib/data";
import { SHOW_EXPLANATIONS } from "@/lib/features";

export function RevealedChoices({
  q,
  correct,
  userPicked,
  density = "normal",
}: {
  q: Question;
  correct: string[];
  userPicked?: string[] | string | null;
  density?: "normal" | "compact";
}) {
  const [exp, setExp] = useState<Explanation | null>(null);
  // Set so multiple can be open at the same time
  const [openLabels, setOpenLabels] = useState<Set<string>>(new Set());
  const picked = Array.isArray(userPicked) ? userPicked : userPicked ? [userPicked] : [];

  useEffect(() => {
    // Mrs.Q's bank has no matching explanations — skip loading entirely.
    if (!SHOW_EXPLANATIONS) return;
    loadExplanations().then((all) => setExp(all[q.id] ?? null));
  }, [q.id]);

  function toggleLabel(label: string) {
    setOpenLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  const pad = density === "compact" ? "px-3 py-2" : "px-4 py-3";
  const gap = density === "compact" ? "space-y-1.5" : "space-y-2";

  return (
    <div className={gap}>
      {q.choices.map((c) => {
        const isCorrect = correct.includes(c.label);
        const isWrongPick = picked.includes(c.label) && !isCorrect;
        const isMutedPick = picked.length > 0 && !isCorrect && !isWrongPick;

        let cls = "border-zinc-800/80 bg-zinc-900/40 text-zinc-300";
        if (isCorrect) cls = "border-emerald-500/40 bg-emerald-500/10 text-emerald-50";
        else if (isWrongPick) cls = "border-rose-500/40 bg-rose-500/10 text-rose-50";
        else if (isMutedPick) cls = "border-zinc-800/60 bg-zinc-900/30 text-zinc-500";

        const why = isCorrect ? exp?.why : exp?.distractors?.[c.label];
        const isOpen = openLabels.has(c.label);
        const hasExp = !!why;

        return (
          <div key={c.label} className="space-y-1.5">
            <div className={`flex items-start gap-3 rounded-xl border ${pad} ${cls}`}>
              <span className="mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-md bg-zinc-800/70 font-mono text-xs uppercase text-zinc-300">
                {c.label}
              </span>
              <span className="flex-1 text-sm leading-relaxed">{c.text}</span>

              {isCorrect && <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" />}
              {isWrongPick && <X className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-400" />}

              {hasExp && (
                <button
                  type="button"
                  onClick={() => toggleLabel(c.label)}
                  title={isCorrect ? "Vì sao đáp án này đúng" : "Vì sao đáp án này sai"}
                  className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-full transition-all duration-200 ${
                    isOpen
                      ? "bg-gradient-to-b from-yellow-200 to-amber-400 text-amber-900 shadow-[0_0_14px_4px_rgba(251,191,36,0.55)]"
                      : "bg-gradient-to-b from-yellow-300 to-amber-500 text-amber-900 shadow-[0_0_7px_2px_rgba(251,191,36,0.30)] hover:shadow-[0_0_14px_4px_rgba(251,191,36,0.55)] hover:from-yellow-200 hover:to-amber-400"
                  }`}
                >
                  <Lightbulb className="h-4 w-4" />
                </button>
              )}
            </div>

            {isOpen && hasExp && (
              <div
                className={`ml-9 rounded-lg border-l-2 px-3 py-2.5 text-sm leading-relaxed ${
                  isCorrect
                    ? "border-emerald-400/60 bg-emerald-500/5 text-emerald-50/95"
                    : "border-rose-400/60 bg-rose-500/5 text-rose-50/95"
                }`}
              >
                <ExplanationBody markdown={why!} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ExplanationBody({ markdown }: { markdown: string }) {
  const blocks = markdown.split("\n\n");
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => (
        <p key={i} className="leading-relaxed">
          {renderInline(b)}
        </p>
      ))}
    </div>
  );
}

function renderInline(s: string): React.ReactNode {
  const tokens: { kind: "text" | "b" | "i" | "code"; v: string }[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) tokens.push({ kind: "text", v: s.slice(last, m.index) });
    if (m[0].startsWith("**")) tokens.push({ kind: "b", v: m[0].slice(2, -2) });
    else if (m[0].startsWith("`")) tokens.push({ kind: "code", v: m[0].slice(1, -1) });
    else tokens.push({ kind: "i", v: m[0].slice(1, -1) });
    last = m.index + m[0].length;
  }
  if (last < s.length) tokens.push({ kind: "text", v: s.slice(last) });
  return tokens.map((t, i) =>
    t.kind === "b" ? (
      <b key={i} className="font-semibold">
        {t.v}
      </b>
    ) : t.kind === "i" ? (
      <i key={i} className="opacity-90">
        {t.v}
      </i>
    ) : t.kind === "code" ? (
      <code key={i} className="rounded bg-zinc-800/70 px-1 py-0.5 font-mono text-[12px]">
        {t.v}
      </code>
    ) : (
      <span key={i}>{t.v}</span>
    )
  );
}
