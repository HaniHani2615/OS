#!/usr/bin/env python3
"""Inspect images / rects / curves to find which option has visual marker (radio fill, check icon)."""
import pdfplumber, sys

pdf_path = sys.argv[1]
page_num = int(sys.argv[2])

with pdfplumber.open(pdf_path) as pdf:
    page = pdf.pages[page_num - 1]
    print(f"=== PAGE {page_num} | size {page.width}x{page.height} ===")
    print(f"\nIMAGES ({len(page.images)}):")
    for img in page.images[:30]:
        print(f"  x0={img['x0']:.0f} top={img['top']:.0f} w={img['width']:.0f} h={img['height']:.0f} name={img.get('name')}")
    print(f"\nRECTS ({len(page.rects)}):")
    for r in page.rects[:30]:
        print(f"  x0={r['x0']:.0f} top={r['top']:.0f} w={r['width']:.0f} h={r['height']:.0f} fill={r.get('fill')} stroke={r.get('stroke')} non_stroking_color={r.get('non_stroking_color')}")
    print(f"\nCURVES ({len(page.curves)}):")
    for c in page.curves[:20]:
        print(f"  x0={c['x0']:.0f} top={c['top']:.0f} w={c['width']:.0f} h={c['height']:.0f} fill={c.get('fill')} non_stroking_color={c.get('non_stroking_color')}")
    print(f"\nLINES ({len(page.lines)}):")
    for l in page.lines[:10]:
        print(f"  x0={l['x0']:.0f} top={l['top']:.0f} w={l['width']:.0f} h={l['height']:.0f}")
