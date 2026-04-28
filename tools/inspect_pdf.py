#!/usr/bin/env python3
"""Inspect a PDF: dump first/last N pages of text + font flag info to understand format."""
import sys, pdfplumber, json, argparse

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--pages", default="1-3")
    ap.add_argument("--show-fonts", action="store_true")
    args = ap.parse_args()

    if "-" in args.pages:
        a, b = args.pages.split("-")
        page_range = range(int(a) - 1, int(b))
    else:
        page_range = [int(args.pages) - 1]

    with pdfplumber.open(args.pdf) as pdf:
        print(f"=== {args.pdf} | {len(pdf.pages)} pages ===")
        for i in page_range:
            if i >= len(pdf.pages):
                break
            page = pdf.pages[i]
            print(f"\n--- PAGE {i+1} ---")
            text = page.extract_text() or ""
            print(text[:3000])
            if args.show_fonts:
                chars = page.chars[:50]
                fonts = {}
                for c in page.chars:
                    key = (c.get("fontname"), round(c.get("size", 0), 1))
                    fonts[key] = fonts.get(key, 0) + 1
                print("\nFONT USAGE:", json.dumps({str(k): v for k, v in sorted(fonts.items(), key=lambda x: -x[1])[:10]}, ensure_ascii=False))

if __name__ == "__main__":
    main()
