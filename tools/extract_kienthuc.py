"""Extract text from kienthuc/ files into per-bai .txt for analysis."""
import os
from pathlib import Path
import pdfplumber
import docx

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "kienthuc"
OUT = ROOT / "tools" / "kienthuc_extracted"
OUT.mkdir(parents=True, exist_ok=True)


def extract_pdf(path: Path) -> str:
    parts = []
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            parts.append(f"\n----- Page {i+1} -----\n{text}")
    return "\n".join(parts)


def extract_docx(path: Path) -> str:
    d = docx.Document(path)
    return "\n".join(p.text for p in d.paragraphs if p.text.strip())


def main():
    for pdf in sorted((SRC / "Slide").glob("*.pdf")):
        out = OUT / (pdf.stem + ".txt")
        if out.exists() and out.stat().st_size > 0:
            print(f"skip {pdf.name}")
            continue
        print(f"extracting {pdf.name}...")
        text = extract_pdf(pdf)
        out.write_text(text, encoding="utf-8")
        print(f"  -> {len(text)} chars")

    for dx in SRC.glob("*.docx"):
        out = OUT / (dx.stem + ".txt")
        if out.exists() and out.stat().st_size > 0:
            print(f"skip {dx.name}")
            continue
        print(f"extracting {dx.name}...")
        text = extract_docx(dx)
        out.write_text(text, encoding="utf-8")
        print(f"  -> {len(text)} chars")


if __name__ == "__main__":
    main()
