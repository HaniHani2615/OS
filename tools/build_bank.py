#!/usr/bin/env python3
"""
Pipeline: load all tools/raw/*.json → normalize → dedup (fuzzy cluster) →
reconcile correct answers (Tier A > B > C) → classify chapter/topic →
write web/public/data/questions.json + stats.json + REVIEW_NEEDED.md.
"""
from __future__ import annotations
import json, re, hashlib, unicodedata, sys
from pathlib import Path
from collections import defaultdict, Counter
from rapidfuzz import fuzz

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "tools/raw"
OUT_DIR = ROOT / "web/public/data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ---------- normalize ----------
def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")

def normalize(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"[^\w\sàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]", " ", s, flags=re.UNICODE)
    s = re.sub(r"\s+", " ", s).strip()
    return s

def norm_choice(s: str) -> str:
    return normalize(s)

# ---------- load ----------
def load_all():
    qs = []
    for f in sorted(RAW_DIR.glob("*.json")):
        if f.name == "_summary.json": continue
        try:
            data = json.load(open(f, encoding="utf-8"))
        except Exception as e:
            print(f"skip {f.name}: {e}", file=sys.stderr); continue
        for q in data:
            if not q.get("question_text") or not q.get("choices"):
                # keep numeric Qs even with no choices
                if q.get("qtype") != "numeric": continue
            q["_norm_q"] = normalize(q["question_text"])
            q["_norm_choices"] = sorted(norm_choice(c["text"]) for c in q.get("choices", []))
            q["_fp"] = hashlib.sha1(
                (q["_norm_q"] + "|" + "|".join(q["_norm_choices"])).encode("utf-8")
            ).hexdigest()
            qs.append(q)
    return qs

# ---------- cluster ----------
def cluster(qs, threshold=88):
    """Two-pass: bucket by exact fingerprint, then fuzzy-merge buckets sharing similar question_text."""
    by_fp = defaultdict(list)
    for q in qs:
        by_fp[q["_fp"]].append(q)
    buckets = list(by_fp.values())

    # fuzzy merge: cheap sketch — group by first 6 normalized words
    def sketch(q): 
        return " ".join(q["_norm_q"].split()[:6])

    sketches = defaultdict(list)
    for i, b in enumerate(buckets):
        sketches[sketch(b[0])].append(i)

    parent = list(range(len(buckets)))
    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]; x = parent[x]
        return x
    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb: parent[ra] = rb

    for ids in sketches.values():
        if len(ids) < 2: continue
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                a = buckets[ids[i]][0]; b = buckets[ids[j]][0]
                # quick reject by length diff
                if abs(len(a["_norm_q"]) - len(b["_norm_q"])) > max(len(a["_norm_q"]), 30) * 0.4: continue
                score = fuzz.token_set_ratio(a["_norm_q"], b["_norm_q"])
                if score < threshold: continue
                # also check choices overlap
                ca = set(a["_norm_choices"]); cb = set(b["_norm_choices"])
                if ca and cb:
                    overlap = len(ca & cb) / max(len(ca | cb), 1)
                    if overlap < 0.5: continue
                union(ids[i], ids[j])

    clusters = defaultdict(list)
    for i, b in enumerate(buckets):
        clusters[find(i)].extend(b)
    return list(clusters.values())

# ---------- reconcile ----------
def reconcile(cluster_qs):
    """Merge a cluster into a single canonical question with verified correct answers."""
    # pick representative: prefer A tier with most options
    cluster_qs_sorted = sorted(cluster_qs, key=lambda q: (
        {"A": 0, "B": 1, "C": 2}.get(q.get("source_tier", "C"), 3),
        -len(q.get("choices", [])),
        -len(q.get("question_text", "")),
    ))
    rep = cluster_qs_sorted[0]
    qtype = rep.get("qtype", "single")

    # Collect evidence per choice label
    # Build canonical choices from rep, map by normalized text → label
    choices = []
    label_by_norm = {}
    for ch in rep.get("choices", []):
        n = norm_choice(ch["text"])
        if n in label_by_norm: continue
        label = chr(ord("a") + len(choices))
        label_by_norm[n] = label
        choices.append({"label": label, "text": ch["text"].strip()})

    # vote: per canonical label, count {tier, vote_correct, vote_wrong}
    votes = {c["label"]: {"A_correct": 0, "A_wrong": 0, "B_correct": 0, "B_wrong": 0, "C_correct": 0, "C_wrong": 0} for c in choices}
    sources_used = []
    numeric_answers = Counter()

    for q in cluster_qs:
        tier = q.get("source_tier", "C")
        sources_used.append({"path": q.get("source"), "tier": tier, "raw_id": q.get("raw_id")})
        if qtype == "numeric" and q.get("numeric_answer") and q.get("attempt_outcome") == "correct":
            numeric_answers[q["numeric_answer"].strip()] += 1
            continue
        for ch in q.get("choices", []):
            n = norm_choice(ch["text"])
            # match to canonical label by exact norm or fuzzy
            label = label_by_norm.get(n)
            if not label:
                # fuzzy match against existing choices
                best = None; best_sc = 0
                for ln, lab in label_by_norm.items():
                    sc = fuzz.ratio(n, ln)
                    if sc > best_sc:
                        best_sc = sc; best = lab
                if best_sc >= 85:
                    label = best
                else:
                    # new choice variant — append
                    new_label = chr(ord("a") + len(choices))
                    label_by_norm[n] = new_label
                    choices.append({"label": new_label, "text": ch["text"].strip()})
                    votes[new_label] = {"A_correct": 0, "A_wrong": 0, "B_correct": 0, "B_wrong": 0, "C_correct": 0, "C_wrong": 0}
                    label = new_label
            # cast vote
            if ch.get("marker") == "correct":
                votes[label][f"{tier}_correct"] += 1
            elif ch.get("marker") == "incorrect":
                votes[label][f"{tier}_wrong"] += 1
            elif ch.get("selected"):
                if q.get("attempt_outcome") == "correct":
                    votes[label][f"{tier}_correct"] += 1
                elif q.get("attempt_outcome") == "incorrect":
                    votes[label][f"{tier}_wrong"] += 1

    # Decide correct
    correct = []
    confidence = 0.0
    decision_path = []
    if qtype == "numeric":
        if numeric_answers:
            ans, n = numeric_answers.most_common(1)[0]
            return {
                "qtype": "numeric",
                "question_text": rep["question_text"].strip(),
                "choices": [],
                "numeric_answer": ans,
                "correct_labels": [],
                "confidence": min(1.0, 0.7 + 0.1 * n),
                "evidence_count": len(cluster_qs),
                "sources": sources_used[:5],
                "votes": dict(numeric_answers),
                "decision": "numeric_majority",
            }
    # Step 1: any choice with A_correct > 0 and A_wrong == 0 → correct
    for c in choices:
        v = votes[c["label"]]
        if v["A_correct"] > 0 and v["A_wrong"] == 0:
            correct.append(c["label"]); confidence = 1.0
            decision_path.append(f"{c['label']}: A_correct={v['A_correct']}")
    # Step 2: if no A votes at all, fall back to B
    if not correct:
        any_a = any(votes[c["label"]]["A_correct"] + votes[c["label"]]["A_wrong"] > 0 for c in choices)
        if not any_a:
            best = None; best_score = 0
            for c in choices:
                v = votes[c["label"]]
                score = v["B_correct"] - v["B_wrong"] + 0.3 * (v["C_correct"] - v["C_wrong"])
                if score > best_score:
                    best_score = score; best = c["label"]
            if best and best_score > 0:
                correct = [best]; confidence = min(0.7, 0.3 + 0.1 * best_score)
                decision_path.append(f"{best}: B/C vote={best_score:.1f}")
        else:
            # A had only wrong votes → need review (we know which are wrong but not which is right)
            confidence = 0.0
            decision_path.append("A_wrong_only")
    return {
        "qtype": qtype,
        "question_text": rep["question_text"].strip(),
        "choices": choices,
        "correct_labels": correct,
        "wrong_labels": sorted([c["label"] for c in choices if votes[c["label"]]["A_wrong"] > 0 and c["label"] not in correct]),
        "confidence": confidence,
        "evidence_count": len(cluster_qs),
        "sources": sources_used[:5],
        "votes": votes,
        "decision": "; ".join(decision_path) if decision_path else "no_evidence",
    }

# ---------- classify chapter ----------
CHAPTER_KEYWORDS = {
    "1-2": [
        "hệ điều hành", "operating system", "kernel", "monolithic", "microkernel",
        "lời gọi hệ thống", "system call", "ngắt", "interrupt", "trap", "bootstrap",
        "shell", "user mode", "kernel mode", "chế độ nhân", "chế độ người dùng",
        "máy ảo", "virtual machine", "hypervisor", "đa chương", "multiprogramming",
        "đa xử lý", "multiprocessor", "thời gian thực", "real-time",
        "cấu trúc hđh", "kiến trúc",
    ],
    "3-4": [
        "tiến trình", "process", "thread", "luồng", "fork", "exec", "wait",
        "ipc", "pipe", "shared memory", "message passing", "context switch",
        "pcb", "process control", "trạng thái tiến trình", "ready", "running", "blocked",
        "lập lịch", "scheduling", "scheduler", "fcfs", "sjf", "srtf", "round robin",
        "priority", "multilevel", "burst", "turnaround", "waiting time", "response time",
        "preemptive", "non-preemptive", "ngắt giữa", "không ngắt giữa",
        "đa luồng", "multithread",
    ],
    "5-6": [
        "đồng bộ", "synchroniz", "race condition", "tương tranh",
        "critical section", "đoạn găng", "miền găng",
        "semaphore", "mutex", "monitor", "khóa", "lock",
        "producer", "consumer", "sản xuất", "tiêu thụ", "reader", "writer",
        "đọc ghi", "philosopher", "triết gia",
        "deadlock", "bế tắc", "khóa chết", "starvation", "đói",
        "banker", "an toàn", "safe state", "resource allocation",
        "peterson", "dekker", "bakery", "test and set", "swap",
    ],
    "7": [
        "bộ nhớ", "memory", "phân trang", "paging", "page table", "bảng trang",
        "phân đoạn", "segment", "tlb", "mmu", "địa chỉ", "address",
        "logical address", "physical address", "địa chỉ logic", "địa chỉ vật lý",
        "swap", "fragmentation", "phân mảnh", "compaction", "kết khối",
        "frame", "khung trang", "first fit", "best fit", "worst fit",
        "overlay", "phủ lấp", "dynamic loading", "nạp động",
        "linking", "liên kết", "relocation", "định vị lại",
    ],
    "8": [  # demand paging / virtual memory — out of scope nhưng track
        "demand paging", "page fault", "lỗi trang", "thay thế trang",
        "page replacement", "lru", "fifo", "optimal", "clock", "second chance",
        "thrashing", "working set", "tập làm việc", "virtual memory", "bộ nhớ ảo",
    ],
}

def classify_chapter(text: str, scope_hint=None):
    t = text.lower()
    scores = {ch: 0 for ch in CHAPTER_KEYWORDS}
    for ch, kws in CHAPTER_KEYWORDS.items():
        for kw in kws:
            if kw in t:
                scores[ch] += len(kw)  # weight by length to prefer specific terms
    # apply scope hint
    if scope_hint:
        for ch in list(scores.keys()):
            if ch == "1-2" and not any(c in scope_hint for c in [1, 2]): scores[ch] *= 0.3
            if ch == "3-4" and not any(c in scope_hint for c in [3, 4]): scores[ch] *= 0.3
            if ch == "5-6" and not any(c in scope_hint for c in [5, 6]): scores[ch] *= 0.3
            if ch == "7" and 7 not in scope_hint: scores[ch] *= 0.3
            if ch == "8" and 8 not in scope_hint: scores[ch] *= 0.3
    best = max(scores.items(), key=lambda x: x[1])
    return best[0] if best[1] > 0 else "unknown", scores

# ---------- main ----------
def main():
    print("Loading…")
    qs = load_all()
    print(f"  {len(qs)} questions loaded")

    print("Clustering…")
    clusters = cluster(qs)
    print(f"  {len(clusters)} unique clusters (dedup ratio: {len(qs)/max(len(clusters),1):.2f}x)")

    print("Reconciling…")
    bank = []
    for i, cl in enumerate(clusters):
        canon = reconcile(cl)
        # gather scope hint from sources
        scope_hint = []
        for q in cl:
            for s in (q.get("chapter_scope") or []):
                if s not in scope_hint: scope_hint.append(s)
        chapter, ch_scores = classify_chapter(canon["question_text"] + " " + " ".join(c.get("text","") for c in canon.get("choices",[])), scope_hint)
        canon["chapter"] = chapter
        canon["chapter_scores"] = ch_scores
        canon["id"] = f"q{i:05d}"
        canon["needs_review"] = canon["confidence"] < 0.85 or chapter == "unknown" or canon.get("decision") == "A_wrong_only"
        bank.append(canon)

    # filter midterm scope (1-7), keep ch 8/unknown but flag
    midterm_chapters = {"1-2", "3-4", "5-6", "7"}
    in_scope = [q for q in bank if q["chapter"] in midterm_chapters]
    out_scope = [q for q in bank if q["chapter"] not in midterm_chapters]

    print(f"\n=== STATS ===")
    print(f"Total clusters: {len(bank)}")
    print(f"In midterm scope (Ch 1-7): {len(in_scope)}")
    by_ch = Counter(q["chapter"] for q in bank)
    for ch, n in sorted(by_ch.items()):
        verified = sum(1 for q in bank if q["chapter"] == ch and q["confidence"] >= 0.85)
        print(f"  Ch {ch:8s}: {n:5d} ({verified} verified)")
    needs_review = sum(1 for q in bank if q["needs_review"])
    print(f"Needs review: {needs_review}")

    # Write
    json.dump(bank, open(OUT_DIR / "questions.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    stats = {
        "total": len(bank),
        "in_scope": len(in_scope),
        "out_of_scope": len(out_scope),
        "by_chapter": dict(by_ch),
        "verified_total": sum(1 for q in bank if q["confidence"] >= 0.85),
        "needs_review": needs_review,
    }
    json.dump(stats, open(OUT_DIR / "stats.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"\nWrote {OUT_DIR}/questions.json ({len(bank)} canonical questions)")
    print(f"Wrote {OUT_DIR}/stats.json")

if __name__ == "__main__":
    main()
