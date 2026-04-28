"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const links = [
  { href: "/learn/theory", label: "Lý thuyết" },
  { href: "/learn/read", label: "Đọc bank" },
  { href: "/learn/flashcard", label: "Flashcard" },
  { href: "/learn/quiz", label: "Quiz" },
  { href: "/exam", label: "Phòng thi" },
  { href: "/review", label: "Review" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-0.5 text-sm">
      {links.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
              active
                ? "bg-zinc-800/90 text-zinc-100 shadow-inner"
                : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-200"
            }`}
          >
            {label}
          </Link>
        );
      })}
      <div className="ml-2">
        <ThemeToggle />
      </div>
    </div>
  );
}
