#!/usr/bin/env python3
"""Inspect character-level data near option lines to find correct-answer markers."""
import pdfplumber, sys, re

pdf_path = sys.argv[1]
page_num = int(sys.argv[2]) if len(sys.argv) > 2 else 1

with pdfplumber.open(pdf_path) as pdf:
    page = pdf.pages[page_num - 1]
    # Get lines via cluster of chars by y
    lines = {}
    for c in page.chars:
        y = round(c["top"], 0)
        lines.setdefault(y, []).append(c)

    for y in sorted(lines.keys()):
        chars = sorted(lines[y], key=lambda c: c["x0"])
        text = "".join(c["text"] for c in chars)
        if not text.strip():
            continue
        # Show line with leading char info if it starts with a/b/c/d. or special
        first = chars[0]
        info = f"x0={first['x0']:.0f} font={first['fontname'].split('+')[-1]} sz={first['size']:.1f}"
        # Check for non-ascii leading
        is_option = bool(re.match(r"^\s*[a-d]\.", text))
        marker = ""
        if is_option:
            # check unique chars in first 5
            head = chars[:8]
            marker = " | HEAD: " + " ".join(f"[{c['text']!r} {c['fontname'].split('+')[-1]}]" for c in head if c["text"].strip())
        print(f"y={y:.0f} {info} | {text[:120]}{marker}")
