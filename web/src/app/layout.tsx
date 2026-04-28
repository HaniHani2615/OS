import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { TopProgressBar } from "@/components/TopProgressBar";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "vietnamese"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Ôn thi OS · Giữa kì",
  description: "Hệ thống ôn tập Hệ điều hành – Flashcard, Quiz, Phòng thi.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={inter.variable}>
      <body className="antialiased font-sans">
        <TopProgressBar />
        <header className="sticky top-0 z-30 border-b border-zinc-800/60 bg-zinc-950/70 backdrop-blur-xl">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-sky-500 text-sm font-bold text-white shadow-lg shadow-violet-500/20">
                OS
              </span>
              <span>ÔnThi</span>
              <span className="ml-1 rounded-md border border-zinc-700/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                giữa kì
              </span>
            </Link>
            <div className="flex items-center gap-1 text-sm text-zinc-400">
              <NavLink href="/learn/theory">Lý thuyết</NavLink>
              <NavLink href="/learn/read">Đọc bank</NavLink>
              <NavLink href="/learn/flashcard">Flashcard</NavLink>
              <NavLink href="/learn/quiz">Quiz</NavLink>
              <NavLink href="/exam">Phòng thi</NavLink>
              <NavLink href="/review">Review</NavLink>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mx-auto mt-16 max-w-6xl px-4 py-8 text-center text-xs text-zinc-500">
          Dữ liệu trích từ tài liệu các anh chị · Đáp án có nhãn ✓ là chuẩn máy chấm.
        </footer>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 transition-colors hover:bg-zinc-800/60 hover:text-zinc-100"
    >
      {children}
    </Link>
  );
}
