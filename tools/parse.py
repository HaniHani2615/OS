#!/usr/bin/env python3
"""
Parse Moodle attempt-review PDFs (Vietnamese & English).

Strategy:
- Cluster chars into lines by y-coordinate.
- Detect question headers via regex: 'Câu Hỏi N <Đúng/Sai>', 'Question N', '\d+\s*Question', plus Mark X out of Y.
- Detect option lines: starts with 'a.' 'b.' etc. OR sits between 'Select one:'/'Chọn câu:' and next question.
- For each option, look at curves on same y-band:
    * 3 curves at x≈54 = unselected radio
    * 4 curves (extra fill 4–7px) = selected radio
- Right side icon (12×12, x≈520-560):
    * RGB green ≈ (0.6, 0.8, 0.2) → option correct
    * RGB red   ≈ (R>0.6, G<0.3, B<0.3) → option incorrect
- Numeric answer: line matching r'Answer:\s*(.+)'.

Output: list of dict per question (see tools/schema.json).
"""
from __future__ import annotations
import re, json, sys, hashlib, argparse, os
from pathlib import Path
from typing import Any
import pdfplumber

# ---------- regex ----------
RE_Q_HEADER_VI = re.compile(r"Câu\s*Hỏi\s*(\d+)\s*(Đúng|Sai)?", re.I)
RE_Q_HEADER_EN = re.compile(r"Question\s*(\d+)\s*(Correct|Incorrect|Partially)?", re.I)
RE_Q_NUM_ONLY = re.compile(r"^\s*(\d+)\s*$")
RE_MARK = re.compile(r"Mark\s*([\d.,]+)\s*out\s*of\s*([\d.,]+)", re.I)
RE_SELECT_ONE = re.compile(r"(Select\s+one|Chọn\s+câu|Chọn\s+một)\s*:?", re.I)
RE_OPTION = re.compile(r"^\s*([a-eA-E])\s*[\.\)]\s*(.+)$")
RE_ANSWER = re.compile(r"^\s*Answer\s*:\s*(.+)$", re.I)
RE_FEEDBACK = re.compile(r"(Your\s+answer\s+is\s+(correct|incorrect)|Phản\s+hồi|Feedback|Câu\s*trả\s*lời\s*(đúng|sai))", re.I)
RE_NOISE = re.compile(r"^(Flag\s+question|Flagged|Not\s+flagged|Remove\s+flag|Đánh\s+dấu|Bỏ\s+đánh\s+dấu|Question\s+text)$", re.I)

# ---------- color helpers ----------
def is_green(rgb):
    if not rgb or len(rgb) < 3: return False
    r, g, b = rgb[0], rgb[1], rgb[2]
    # Lime green ~ (0.6, 0.8, 0.2)
    return g > 0.6 and r < 0.8 and b < 0.5 and g > r and g > b

def is_red(rgb):
    if not rgb or len(rgb) < 3: return False
    r, g, b = rgb[0], rgb[1], rgb[2]
    return r > 0.6 and g < 0.4 and b < 0.4

def is_yellow(rgb):
    if not rgb or len(rgb) < 3: return False
    r, g, b = rgb[0], rgb[1], rgb[2]
    return r > 0.85 and g > 0.85 and b < 0.3

# ---------- line clustering ----------
def cluster_lines(chars, y_tol=2.0):
    """Group chars by y; return list of dicts {y, x0, x1, text, chars}."""
    if not chars: return []
    sorted_chars = sorted(chars, key=lambda c: (c["top"], c["x0"]))
    lines = []
    cur = [sorted_chars[0]]
    cur_y = sorted_chars[0]["top"]
    for c in sorted_chars[1:]:
        if abs(c["top"] - cur_y) <= y_tol:
            cur.append(c)
        else:
            lines.append(cur)
            cur = [c]
            cur_y = c["top"]
    lines.append(cur)
    out = []
    for grp in lines:
        grp.sort(key=lambda c: c["x0"])
        text = "".join(c["text"] for c in grp)
        out.append({
            "y": min(c["top"] for c in grp),
            "y_bottom": max(c["bottom"] for c in grp),
            "x0": min(c["x0"] for c in grp),
            "x1": max(c["x1"] for c in grp),
            "text": text,
            "chars": grp,
        })
    return out

# ---------- option detection per page ----------
def detect_option_marker(curves, line_y, line_y_bottom, page_width):
    """Return (selected_left, marker_right) for an option on this y-band.
    selected_left: True if there's a 4-curve radio (filled inner dot) on left.
    marker_right: 'correct' | 'incorrect' | None based on right-side icon color.
    """
    band_top = line_y - 8
    band_bottom = line_y_bottom + 4
    # Left radio fill: small filled curve (4-7px) at x≈40-80
    selected_left = False
    for c in curves:
        if c["top"] < band_top or c["top"] > band_bottom: continue
        if c["x0"] > 100: continue  # not left side
        w = c.get("width", 0)
        h = c.get("height", 0)
        if 3.5 <= w <= 7.5 and 3.5 <= h <= 7.5 and c.get("fill"):
            # extra inner dot of selected radio
            selected_left = True
            break
    # Right marker: 10-14px filled colored shape at x > page_width/2
    marker_right = None
    for c in curves:
        if c["top"] < band_top or c["top"] > band_bottom: continue
        if c["x0"] < page_width * 0.6: continue
        w = c.get("width", 0)
        h = c.get("height", 0)
        if 8 <= w <= 16 and 8 <= h <= 16:
            color = c.get("non_stroking_color")
            if is_green(color): marker_right = "correct"; break
            if is_red(color): marker_right = "incorrect"; break
    return selected_left, marker_right

def detect_highlight_rect(rects, line_y, line_y_bottom):
    """For TestBank-style highlights: yellow rect over option line = correct, red = incorrect chosen."""
    band_top = line_y - 4
    band_bottom = line_y_bottom + 4
    for r in rects:
        if r["top"] < band_top or r["top"] > band_bottom: continue
        if r.get("width", 0) < 50: continue
        color = r.get("non_stroking_color")
        if is_yellow(color): return "correct"
        if is_red(color): return "incorrect_chosen"
    return None

# ---------- main parser ----------
def parse_page(page, page_num: int, source: str):
    """Yield raw 'segments' — each segment is a contiguous run of lines belonging to a question on this page.
    Final question assembly happens at file level (questions can span pages)."""
    chars = page.chars
    if not chars: return []
    lines = cluster_lines(chars)
    page_width = page.width
    curves = page.curves
    rects = page.rects

    segments = []  # list of (q_num, outcome, header_y, lines_with_meta)

    # Walk lines, build per-line meta
    enriched = []
    for ln in lines:
        text = ln["text"].strip()
        if not text: continue
        if RE_NOISE.match(text): continue

        meta = {"text": text, "y": ln["y"], "y_bottom": ln["y_bottom"], "x0": ln["x0"]}
        # Option?
        m_opt = RE_OPTION.match(text)
        if m_opt:
            label = m_opt.group(1).lower()
            opt_text = m_opt.group(2).strip()
            sel, marker = detect_option_marker(curves, ln["y"], ln["y_bottom"], page_width)
            hl = detect_highlight_rect(rects, ln["y"], ln["y_bottom"])
            if hl == "correct" and not marker: marker = "correct"
            if hl == "incorrect_chosen" and not marker: marker = "incorrect"; sel = True
            meta.update({"kind": "option", "label": label, "opt_text": opt_text, "selected": sel, "marker": marker})
        # Q header?
        elif RE_Q_HEADER_VI.search(text) or RE_Q_HEADER_EN.search(text):
            m = RE_Q_HEADER_VI.search(text) or RE_Q_HEADER_EN.search(text)
            outcome_raw = (m.group(2) or "").lower()
            outcome = None
            if outcome_raw in ("đúng", "correct"): outcome = "correct"
            elif outcome_raw in ("sai", "incorrect"): outcome = "incorrect"
            elif outcome_raw == "partially": outcome = "partial"
            meta.update({"kind": "q_header", "q_num": int(m.group(1)), "outcome": outcome})
        elif RE_MARK.search(text):
            m = RE_MARK.search(text)
            try:
                got = float(m.group(1).replace(",", "."))
                total = float(m.group(2).replace(",", "."))
                outcome = "correct" if got >= total - 0.01 else ("partial" if got > 0 else "incorrect")
            except: outcome = None
            meta.update({"kind": "mark", "outcome": outcome})
        elif RE_ANSWER.match(text):
            m = RE_ANSWER.match(text)
            meta.update({"kind": "answer", "answer_text": m.group(1).strip()})
        elif RE_SELECT_ONE.search(text):
            meta.update({"kind": "select_marker"})
        elif RE_FEEDBACK.search(text):
            t = text.lower()
            outcome = "correct" if ("correct" in t and "incorrect" not in t) or "đúng" in t else "incorrect"
            meta.update({"kind": "feedback", "outcome": outcome})
        else:
            meta.update({"kind": "text"})
        enriched.append(meta)
    return enriched

def assemble_questions(all_lines: list[dict], source_path: str, source_tier: str):
    """all_lines: flat list across pages, in order. Each has page_num + meta."""
    questions = []
    cur = None
    pending_outcome = None
    pending_q_num = None
    state = "idle"   # idle | in_question | in_options
    for ln in all_lines:
        kind = ln.get("kind")
        if kind == "q_header":
            if cur:
                if pending_outcome and not cur.get("attempt_outcome"):
                    cur["attempt_outcome"] = pending_outcome
                questions.append(cur)
            cur = {
                "raw_id": f"{Path(source_path).stem}#p{ln['page']}q{ln['q_num']}",
                "source": source_path,
                "source_tier": source_tier,
                "page": ln["page"],
                "q_num_local": ln["q_num"],
                "question_text": "",
                "choices": [],
                "qtype": "single",
                "numeric_answer": None,
                "attempt_outcome": ln.get("outcome"),
                "lang": "vi",
            }
            state = "in_question"
            pending_outcome = None
        elif kind == "mark" and cur:
            if not cur.get("attempt_outcome"):
                cur["attempt_outcome"] = ln.get("outcome")
        elif kind == "select_marker" and cur:
            state = "in_options"
        elif kind == "option" and cur:
            cur["choices"].append({
                "label": ln["label"],
                "text": ln["opt_text"],
                "selected": ln.get("selected", False),
                "marker": ln.get("marker"),
            })
            state = "in_options"
        elif kind == "answer" and cur:
            cur["qtype"] = "numeric" if re.fullmatch(r"[\-\d.,\s]+", ln["answer_text"]) else "text"
            cur["numeric_answer"] = ln["answer_text"]
        elif kind == "feedback" and cur:
            if not cur.get("attempt_outcome"):
                cur["attempt_outcome"] = ln.get("outcome")
        elif kind == "text" and cur:
            t = ln["text"].strip()
            # Skip page footer/header noise
            if re.match(r"^https?://", t): continue
            if re.match(r"^\d+/\d+$", t): continue
            if "review.php" in t: continue
            # Outcome word on its own line right after header
            tlow = t.lower()
            if not cur.get("question_text") and tlow in ("đúng", "sai", "correct", "incorrect", "partially correct"):
                if not cur.get("attempt_outcome"):
                    cur["attempt_outcome"] = "correct" if tlow in ("đúng", "correct") else ("partial" if "partial" in tlow else "incorrect")
                continue
            if state == "in_question":
                if cur["question_text"]:
                    cur["question_text"] += " " + t
                else:
                    cur["question_text"] = t
            # else (in_options): ignore stray text between options for now
    if cur:
        questions.append(cur)
    return questions

def derive_correct(q):
    """Apply rules to determine correct labels. Add 'correct_labels' (list) and 'confidence'."""
    correct_labels = []
    sources = []  # what evidence
    # Rule: any option with marker == 'correct' → correct
    for ch in q["choices"]:
        if ch.get("marker") == "correct":
            correct_labels.append(ch["label"])
            sources.append("right_icon_green")
    # Rule: if no marker, but attempt_outcome=correct and exactly one selected → that selected is correct
    if not correct_labels:
        selected = [c for c in q["choices"] if c.get("selected")]
        if q.get("attempt_outcome") == "correct" and len(selected) == 1:
            correct_labels.append(selected[0]["label"])
            sources.append("attempt_correct+selected")
    # Rule: if attempt=incorrect and exactly one selected → that label is WRONG
    wrong_labels = []
    if q.get("attempt_outcome") == "incorrect":
        for c in q["choices"]:
            if c.get("selected"): wrong_labels.append(c["label"])
            if c.get("marker") == "incorrect": wrong_labels.append(c["label"])
    q["correct_labels"] = sorted(set(correct_labels))
    q["wrong_labels"] = sorted(set(wrong_labels))
    if q["correct_labels"]:
        q["confidence"] = 1.0 if "right_icon_green" in sources else 0.85
    else:
        q["confidence"] = 0.0
    q["evidence"] = sources
    return q

def parse_pdf(pdf_path: str, source_tier: str = "B"):
    all_lines = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            try:
                lines = parse_page(page, i + 1, pdf_path)
            except Exception as e:
                print(f"  WARN page {i+1}: {e}", file=sys.stderr)
                continue
            for ln in lines:
                ln["page"] = i + 1
                all_lines.append(ln)
    qs = assemble_questions(all_lines, pdf_path, source_tier)
    for q in qs:
        if q.get("qtype") != "numeric":
            derive_correct(q)
        else:
            q["correct_labels"] = []
            q["wrong_labels"] = []
            q["confidence"] = 1.0 if q.get("attempt_outcome") == "correct" and q.get("numeric_answer") else 0.4
            q["evidence"] = ["numeric_attempt_correct"] if q["confidence"] == 1.0 else []
    return qs

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--tier", default="B")
    ap.add_argument("--out", default=None)
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()
    qs = parse_pdf(args.pdf, args.tier)
    if args.limit: qs = qs[: args.limit]
    out = args.out or f"tools/raw/{Path(args.pdf).stem}.json"
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(qs, f, ensure_ascii=False, indent=2)
    print(f"{args.pdf} → {len(qs)} questions → {out}")
    # Stats
    confirmed = sum(1 for q in qs if q.get("confidence", 0) >= 0.85)
    print(f"  confirmed: {confirmed}/{len(qs)}")

if __name__ == "__main__":
    main()
