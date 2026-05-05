#!/usr/bin/env python3
"""
AI Answer Reasoner — dùng Claude (Anthropic) hoặc Gemini để:
  1. Suy luận đáp án cho các câu chưa có / độ tin cậy thấp (--mode answers)
  2. Sinh giải thích chất lượng cao cho mọi câu (--mode explanations)
  3. Cả hai (--mode all)

Kết quả answers → web/public/data/questions.json (patch in-place, backup trước)
Kết quả explanations → web/public/data/explanations.json

Dùng:
  # Claude (khuyên dùng — thông minh hơn nhiều)
  export ANTHROPIC_API_KEY=<your-key>
  python3 tools/reason_answers.py --mode answers [--dry-run] [--limit 20] [--chapter 3-4]

  # Gemini (fallback)
  export GOOGLE_API_KEY=<your-key>
  python3 tools/reason_answers.py --provider gemini --mode all
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import time
import warnings
from pathlib import Path
from typing import Protocol, runtime_checkable

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "web" / "public" / "data"
KB_DIR = ROOT / "tools" / "kienthuc_extracted"


# ──────────────────────── Provider abstraction ──────────────────────────────

@runtime_checkable
class LLMProvider(Protocol):
    def chat(self, system: str, user: str) -> str: ...
    @property
    def name(self) -> str: ...


class ClaudeProvider:
    """Anthropic Claude — tốt nhất cho suy luận phức tạp."""

    def __init__(self, model: str = "claude-sonnet-4-5"):
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise EnvironmentError("ANTHROPIC_API_KEY chưa được set")
        import anthropic  # type: ignore
        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = model
        self._name = f"claude/{model}"

    @property
    def name(self) -> str:
        return self._name

    def chat(self, system: str, user: str) -> str:
        msg = self._client.messages.create(
            model=self._model,
            max_tokens=8192,
            temperature=0.1,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return msg.content[0].text


class GeminiProvider:
    """Google Gemini — fallback."""

    def __init__(self, model: str | None = None):
        api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise EnvironmentError("GOOGLE_API_KEY chưa được set")
        import google.generativeai as genai  # type: ignore
        genai.configure(api_key=api_key)
        candidates = [model] if model else ["gemini-1.5-flash-002", "gemini-1.5-flash"]
        for m in candidates:
            if not m:
                continue
            try:
                gm = genai.GenerativeModel(
                    m, generation_config={"temperature": 0.1, "max_output_tokens": 8192}
                )
                gm.generate_content("ping", generation_config={"max_output_tokens": 4})
                self._model = gm
                self._name = f"gemini/{m}"
                return
            except Exception:
                continue
        raise EnvironmentError("Không kết nối được Gemini")

    @property
    def name(self) -> str:
        return self._name

    def chat(self, system: str, user: str) -> str:
        resp = self._model.generate_content([system, user])
        return resp.text


def build_provider(args) -> LLMProvider:
    provider_pref = getattr(args, "provider", "auto")

    if provider_pref in ("claude", "auto"):
        try:
            p = ClaudeProvider(model=getattr(args, "model", None) or "claude-sonnet-4-5")
            print(f"  Provider: {p.name}")
            return p
        except EnvironmentError as e:
            if provider_pref == "claude":
                sys.exit(
                    f"\n[ERROR] {e}\n"
                    "  export ANTHROPIC_API_KEY=<your-key>\n"
                    "  Lấy key tại: https://console.anthropic.com/\n"
                )
            print(f"  Claude không khả dụng ({e}), thử Gemini...")

    if provider_pref in ("gemini", "auto"):
        try:
            p = GeminiProvider(model=getattr(args, "model", None))
            print(f"  Provider: {p.name}")
            return p
        except EnvironmentError as e:
            sys.exit(
                f"\n[ERROR] {e}\n"
                "  export ANTHROPIC_API_KEY=<anthropic-key>  # ưu tiên\n"
                "  export GOOGLE_API_KEY=<google-key>        # fallback\n"
            )

    sys.exit("[ERROR] Không có provider nào khả dụng.")



# ──────────────────────── Knowledge base ────────────────────────────────────

def load_kb() -> str:
    """Load all lecture notes into one string (trimmed)."""
    texts = []
    for f in sorted(KB_DIR.glob("*.txt")):
        raw = f.read_text(encoding="utf-8", errors="ignore")
        # strip page headers to save tokens
        raw = re.sub(r"----- Page \d+ -----", "", raw)
        raw = re.sub(r"Nguyễn Thi Hậu.*?\n", "", raw)
        raw = re.sub(r"\n{3,}", "\n\n", raw)
        texts.append(f"=== {f.stem} ===\n{raw.strip()}")
    return "\n\n".join(texts)


# ─────────────────────── Answer reasoning ───────────────────────────────────

ANSWER_SYSTEM = """Bạn là giáo viên môn Nguyên lý Hệ điều hành (OS) tại Đại học Công Nghệ - ĐHQGHN.
Nhiệm vụ: suy luận đáp án đúng cho các câu hỏi trắc nghiệm.

QUY TẮC:
- Trả lời CHÍNH XÁC bằng JSON thuần, KHÔNG có markdown code fence, KHÔNG có text thừa trước/sau JSON.
- correct_label: chữ cái nhỏ (a/b/c/d) của đáp án đúng nhất.
- confidence: float 0.0–1.0 phản ánh mức chắc chắn của bạn.
  1.0 = hoàn toàn chắc (tìm thấy rõ ràng trong tài liệu)
  0.85 = rất chắc (hiểu sâu về OS, suy luận vững)
  0.7 = tương đối chắc (suy luận logic nhưng không thấy trong tài liệu)
  0.5 = đoán có cơ sở
- reasoning: 1-3 câu tiếng Việt giải thích ngắn gọn, chính xác tại sao đáp án đúng.
  Với bài toán tính toán: trình bày công thức và tính step-by-step.
- Trả về ĐÚNG số object bằng số câu hỏi được hỏi, theo đúng thứ tự.

OUTPUT FORMAT (array JSON):
[
  {
    "id": "...",
    "correct_label": "c",
    "confidence": 0.9,
    "reasoning": "..."
  }
]
"""


def reason_batch(provider: LLMProvider, questions: list[dict], kb: str) -> list[dict]:
    """Send a batch of questions to the LLM provider, get back answers."""
    qs_text = []
    for i, q in enumerate(questions):
        choices_str = "\n".join(
            f"  {c['label']}) {c['text']}" for c in q.get("choices", [])
        )
        qs_text.append(
            f"--- Câu {i+1} (id={q['id']}, ch={q.get('chapter','?')}) ---\n"
            f"{q['question_text']}\n{choices_str}"
        )

    user_prompt = (
        f"Dưới đây là tài liệu giảng dạy môn OS:\n\n{kb}\n\n"
        f"{'='*60}\n\n"
        f"Hãy trả lời {len(questions)} câu hỏi sau:\n\n"
        + "\n\n".join(qs_text)
        + "\n\nTrả về JSON array đúng format, mỗi object gồm: id, correct_label, confidence, reasoning."
    )

    raw = provider.chat(ANSWER_SYSTEM, user_prompt).strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```\s*$", "", raw.strip())
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"  [WARN] JSON parse error: {e}", file=sys.stderr)
        print(f"  Raw snippet: {raw[:400]}", file=sys.stderr)
        return []


# ─────────────────────── Explanation generation ─────────────────────────────

EXPLAIN_SYSTEM = """Bạn là giáo viên OS tại ĐH Công Nghệ - ĐHQGHN. Hãy viết giải thích sâu, chính xác, thực sự hữu ích cho người học.

QUY TẮC CỐT LÕI:
- Trả lời JSON thuần, KHÔNG có markdown fence, KHÔNG có text thừa.
- "why": 2-4 câu tiếng Việt giải thích cơ chế/lý do tại sao đáp án đúng là đúng.
  ✓ Giải thích bằng cơ chế OS cụ thể, dùng thuật ngữ chính xác
  ✓ Nếu có thể, trích dẫn hoặc liên hệ tới tài liệu
  ✓ Với bài toán: tính step-by-step, nêu công thức
  ✗ Không viết "đáp án X là đúng vì..." — giải thích trực tiếp cơ chế
  ✗ Không sao chép nguyên văn câu hỏi
- "distractors": object với key là label của từng đáp án SAI.
  Mỗi value: 1 câu giải thích điều đáp án đó thực sự mô tả và tại sao nó không đúng cho câu này.
  (bỏ qua label của đáp án đúng)
- "topic": 2-5 từ tiếng Việt/Anh tóm tắt chủ đề (vd: "Round Robin scheduling", "Banker's Algorithm deadlock")
- Trả về ĐÚNG số object bằng số câu.

OUTPUT (array JSON):
[
  {
    "id": "...",
    "why": "...",
    "distractors": {"a": "...", "c": "..."},
    "topic": "..."
  }
]
"""


def explain_batch(provider: LLMProvider, questions: list[dict], kb: str) -> list[dict]:
    qs_text = []
    for i, q in enumerate(questions):
        correct = q.get("correct_labels", [])
        choices_str = "\n".join(
            f"  {c['label']}) {c['text']}{'  ← ĐÚNG' if c['label'] in correct else ''}"
            for c in q.get("choices", [])
        )
        qs_text.append(
            f"--- Câu {i+1} (id={q['id']}, ch={q.get('chapter','?')}) ---\n"
            f"{q['question_text']}\n{choices_str}"
        )

    user_prompt = (
        f"Tài liệu OS:\n\n{kb}\n\n{'='*60}\n\n"
        f"Viết giải thích cho {len(questions)} câu sau:\n\n"
        + "\n\n".join(qs_text)
        + "\n\nTrả về JSON array."
    )

    raw = provider.chat(EXPLAIN_SYSTEM, user_prompt).strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```\s*$", "", raw.strip())
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"  [WARN] JSON parse error: {e}", file=sys.stderr)
        print(f"  Raw snippet: {raw[:400]}", file=sys.stderr)
        return []



# ──────────────────────────── Main logic ────────────────────────────────────

def load_questions() -> list[dict]:
    return json.loads((DATA_DIR / "questions.json").read_text(encoding="utf-8"))


def save_questions(questions: list[dict], dry_run: bool):
    path = DATA_DIR / "questions.json"
    if dry_run:
        print(f"  [DRY-RUN] Would write {path}")
        return
    backup = DATA_DIR / "questions.json.bak"
    shutil.copy(path, backup)
    path.write_text(json.dumps(questions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  Saved {path} (backup: {backup})")


def save_explanations(new_exps: dict, dry_run: bool):
    path = DATA_DIR / "explanations.json"
    existing: dict = {}
    if path.exists():
        existing = json.loads(path.read_text(encoding="utf-8"))
    existing.update(new_exps)
    if dry_run:
        print(f"  [DRY-RUN] Would write {path} ({len(new_exps)} new entries)")
        return
    path.write_text(json.dumps(existing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  Saved {path} ({len(new_exps)} new + existing)")


def run_answers(provider: LLMProvider, kb: str, args):
    questions = load_questions()
    q_map = {q["id"]: i for i, q in enumerate(questions)}

    # Select targets: empty correct_labels OR low confidence, single-choice only
    targets = [
        q for q in questions
        if q.get("qtype") == "single"
        and q.get("choices")
        and (
            not q.get("correct_labels")
            or (q.get("confidence", 0) < 0.85 and q.get("needs_review"))
        )
    ]

    if args.chapter:
        targets = [q for q in targets if q.get("chapter") == args.chapter]

    if args.limit:
        targets = targets[: args.limit]

    print(f"\n[ANSWERS] Sẽ xử lý {len(targets)} câu hỏi...")

    batch_size = 8
    total_updated = 0

    for start in range(0, len(targets), batch_size):
        batch = targets[start : start + batch_size]
        print(f"  Batch {start//batch_size + 1}: câu {start+1}–{min(start+batch_size, len(targets))}", end="", flush=True)

        if args.dry_run:
            print(" [DRY-RUN skip]")
            continue

        try:
            results = reason_batch(provider, batch, kb)
        except Exception as e:
            print(f" [ERROR: {e}]")
            time.sleep(5)
            continue

        updated = 0
        for r in results:
            qid = r.get("id")
            label = r.get("correct_label", "").lower().strip()
            confidence = float(r.get("confidence", 0.5))
            reasoning = r.get("reasoning", "")

            if qid not in q_map:
                continue
            idx = q_map[qid]
            q = questions[idx]
            valid_labels = {c["label"] for c in q.get("choices", [])}
            if label not in valid_labels:
                print(f"\n  [WARN] id={qid}: label '{label}' not in choices {valid_labels}")
                continue

            # Only update if: no current answer OR AI more confident than existing
            current_conf = q.get("confidence", 0)
            if not q.get("correct_labels") or confidence > current_conf:
                q["correct_labels"] = [label]
                q["confidence"] = round(confidence, 2)
                q["decision"] = f"ai_reasoned:{reasoning[:80]}"
                # Keep needs_review=True so human can still verify
                # but remove it if AI is very confident
                if confidence >= 0.85:
                    q["needs_review"] = False
                updated += 1

        total_updated += updated
        print(f" → {updated}/{len(batch)} updated")
        time.sleep(1.5)  # rate limiting

    print(f"\n  Total updated: {total_updated}")
    save_questions(questions, args.dry_run)


def run_explanations(provider: LLMProvider, kb: str, args):
    questions = load_questions()
    existing_path = DATA_DIR / "explanations.json"
    existing_ids: set[str] = set()
    if existing_path.exists():
        existing_ids = set(json.loads(existing_path.read_text(encoding="utf-8")).keys())

    # Explain questions that have confirmed answers but no explanation yet
    # (or all if --force)
    targets = [
        q for q in questions
        if q.get("qtype") == "single"
        and q.get("correct_labels")
        and q.get("choices")
        and (args.force or q["id"] not in existing_ids)
    ]

    if args.chapter:
        targets = [q for q in targets if q.get("chapter") == args.chapter]

    if args.limit:
        targets = targets[: args.limit]

    print(f"\n[EXPLANATIONS] Sẽ xử lý {len(targets)} câu hỏi...")

    batch_size = 6
    new_exps: dict = {}

    for start in range(0, len(targets), batch_size):
        batch = targets[start : start + batch_size]
        print(f"  Batch {start//batch_size + 1}: câu {start+1}–{min(start+batch_size, len(targets))}", end="", flush=True)

        if args.dry_run:
            print(" [DRY-RUN skip]")
            continue

        try:
            results = explain_batch(provider, batch, kb)
        except Exception as e:
            print(f" [ERROR: {e}]")
            time.sleep(5)
            continue

        for r in results:
            qid = r.get("id")
            if not qid:
                continue
            new_exps[qid] = {
                "why": r.get("why", ""),
                "distractors": r.get("distractors", {}),
                "topic": r.get("topic", ""),
                "source": "ai",
            }

        print(f" → {len(results)} explanations")
        time.sleep(1.5)

    print(f"\n  Total generated: {len(new_exps)}")
    save_explanations(new_exps, args.dry_run)


# ────────────────────────────── CLI ─────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="AI answer reasoner + explanation generator")
    parser.add_argument("--mode", choices=["answers", "explanations", "all"], default="all")
    parser.add_argument("--provider", choices=["auto", "claude", "gemini"], default="auto",
                        help="LLM provider (auto: Claude ưu tiên, fallback Gemini)")
    parser.add_argument("--model", type=str, default=None,
                        help="Override model name (vd: claude-opus-4-5, gemini-1.5-pro)")
    parser.add_argument("--dry-run", action="store_true", help="Không ghi file, chỉ in ra")
    parser.add_argument("--limit", type=int, default=None, help="Số câu tối đa xử lý")
    parser.add_argument("--chapter", type=str, default=None, help="Lọc theo chapter (1-2, 3-4, 5-6, 7, 8)")
    parser.add_argument("--force", action="store_true", help="Sinh lại explanation dù đã có")
    args = parser.parse_args()

    print("Đang nạp tài liệu kiến thức...")
    kb = load_kb()
    print(f"  {len(kb):,} ký tự kiến thức nạp xong.")

    print("Kết nối LLM provider...")
    provider = build_provider(args)

    if args.mode in ("answers", "all"):
        run_answers(provider, kb, args)

    if args.mode in ("explanations", "all"):
        run_explanations(provider, kb, args)

    print("\nHoàn tất.")


if __name__ == "__main__":
    main()
