#!/usr/bin/env python3
"""Run parse.py on every PDF listed in sources.yaml; write per-file JSON."""
import yaml, glob, sys, os, traceback
from pathlib import Path
sys.path.insert(0, os.path.dirname(__file__))
from parse import parse_pdf
import json

ROOT = Path(__file__).resolve().parent.parent

def expand_sources(cfg):
    excluded = []
    for g in cfg.get("exclude_globs", []):
        excluded.extend(str(Path(p)) for p in ROOT.glob(g))
    excluded = set(excluded)

    items = []
    for s in cfg.get("sources", []):
        if s.get("skip_extract"): continue
        path = ROOT / s["path"]
        tier = s["tier"]
        scope = s.get("chapter_scope", [])
        if s.get("is_dir"):
            for pdf in sorted(path.rglob("*.pdf")):
                if str(pdf) in excluded: continue
                if "copy" in str(pdf).lower(): continue
                items.append((pdf, tier, scope))
        else:
            if path.exists():
                items.append((path, tier, scope))
    return items

def main():
    cfg = yaml.safe_load(open(ROOT / "tools/sources.yaml", encoding="utf-8"))
    items = expand_sources(cfg)
    out_dir = ROOT / "tools/raw"
    out_dir.mkdir(parents=True, exist_ok=True)
    summary = []
    for pdf, tier, scope in items:
        rel = pdf.relative_to(ROOT)
        slug = str(rel).replace("/", "__").replace(" ", "_").replace(".pdf", "")
        out = out_dir / f"{slug}.json"
        try:
            qs = parse_pdf(str(pdf), tier)
        except Exception as e:
            print(f"FAIL {rel}: {e}", file=sys.stderr)
            traceback.print_exc()
            continue
        for q in qs:
            q["chapter_scope"] = scope
        with open(out, "w", encoding="utf-8") as f:
            json.dump(qs, f, ensure_ascii=False, indent=2)
        confirmed = sum(1 for q in qs if q.get("confidence", 0) >= 0.85)
        summary.append((str(rel), tier, len(qs), confirmed))
        print(f"[{tier}] {rel}: {len(qs)} q ({confirmed} confirmed)")

    print("\n=== SUMMARY ===")
    total = sum(s[2] for s in summary)
    total_conf = sum(s[3] for s in summary)
    print(f"{len(summary)} files, {total} questions, {total_conf} confirmed ({total_conf/max(total,1)*100:.1f}%)")
    json.dump(
        [{"path": p, "tier": t, "n": n, "confirmed": c} for p, t, n, c in summary],
        open(out_dir / "_summary.json", "w", encoding="utf-8"),
        ensure_ascii=False, indent=2
    )

if __name__ == "__main__":
    main()
