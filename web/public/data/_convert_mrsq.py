"""Convert Mrs.Q's testbank (final.json) into the schema the web expects.

Mrs.Q's bank uses a different schema than Mrs.H's (questions.json):
  - confidence is "high"/"medium" (string)  -> number (high=1.0, medium=0.7)
  - no chapter field                         -> "unknown"
  - id is int                                -> string
  - review_flag                              -> needs_review
  - qtype may be "multi"                     -> "single"
  - no wrong_labels                          -> derived from choices

Run from web/public/data:  python _convert_mrsq.py
Writes:  questions.json (Mrs.Q, web schema) + stats.json
Backs up current Mrs.H questions.json -> questions.mrs_h.json (once).
"""
import json, os, io

HERE = os.path.dirname(os.path.abspath(__file__))

def p(name):
    return os.path.join(HERE, name)

CONF_MAP = {"high": 1.0, "medium": 0.7, "low": 0.4}

def load(name):
    with io.open(p(name), encoding="utf-8") as f:
        return json.load(f)

def dump(name, data):
    with io.open(p(name), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)

# 1) Back up Mrs.H's active questions.json once.
if os.path.exists(p("questions.json")) and not os.path.exists(p("questions.mrs_h.json")):
    os.replace(p("questions.json"), p("questions.mrs_h.json"))
    print("backed up Mrs.H -> questions.mrs_h.json")

src = load("final.json")
out = []
for q in src:
    labels = [c["label"] for c in q.get("choices", [])]
    correct = q.get("correct_labels", []) or []
    qtype = q.get("qtype", "single")
    if qtype not in ("single", "numeric"):
        qtype = "single"  # collapse "multi" -> "single"
    conf = CONF_MAP.get(str(q.get("confidence", "")).lower(), 0.7)
    out.append({
        "id": str(q["id"]),
        "qtype": qtype,
        "question_text": q.get("question_text", ""),
        "choices": q.get("choices", []),
        "correct_labels": correct,
        "wrong_labels": [l for l in labels if l not in correct],
        "confidence": conf,
        "evidence_count": len(q.get("source", []) or []),
        "chapter": "unknown",
        "needs_review": bool(q.get("review_flag", False)),
        "sources": [{"path": s, "tier": "mrs_q"} for s in (q.get("source", []) or [])],
        "is_theory": False,
    })

dump("questions.json", out)

verified = sum(1 for q in out if q["confidence"] >= 0.85)
need = sum(1 for q in out if q["needs_review"])
stats = {
    "total": len(out),
    "in_scope": len(out),
    "out_of_scope": 0,
    "by_chapter": {"unknown": len(out)},
    "verified_total": verified,
    "needs_review": need,
}
dump("stats.json", stats)

print("wrote questions.json:", len(out), "questions")
print("verified (>=0.85):", verified, "| needs_review:", need)
