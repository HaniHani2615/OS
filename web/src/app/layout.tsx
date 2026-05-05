import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { TopProgressBar } from "@/components/TopProgressBar";
import { NavLinks } from "@/components/NavLinks";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "vietnamese"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Ôn thi OS · Giữa kì",
  description: "Hệ thống ôn tập Hệ điều hành – Flashcard, Quiz, Phòng thi.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${inter.variable} dark`}>
      <body className="antialiased font-sans">
        <TopProgressBar />
        <header className="sticky top-0 z-30 border-b border-zinc-800/60 bg-zinc-950/70 backdrop-blur-xl">
          <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-3 safe-x">
            <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
              <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-violet-600 text-sm font-bold text-white">
                OS
              </span>
              <span className="text-zinc-100">ÔnThi</span>
              <span className="rounded border border-zinc-700/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                giữa kì
              </span>
            </Link>
            <NavLinks />
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 pb-safe safe-x md:py-8">{children}</main>
        <footer className="mx-auto mt-16 max-w-6xl px-4 py-8 pb-safe safe-x text-center text-xs text-zinc-500">
          Dữ liệu trích từ tài liệu các anh chị · Đáp án có nhãn ✓ là chuẩn máy chấm.
        </footer>
      </body>
    </html>
  );
}
