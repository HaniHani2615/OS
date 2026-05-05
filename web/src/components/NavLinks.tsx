"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Menu, X } from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <>
      {/* Desktop nav */}
      <div className="hidden items-center gap-0.5 text-sm md:flex">
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

      {/* Mobile: theme toggle + hamburger */}
      <div className="flex items-center gap-1 md:hidden" ref={menuRef}>
        <ThemeToggle />
        <button
          onClick={() => setOpen((o) => !o)}
          className="grid h-9 w-9 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 active:scale-95"
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute right-4 top-full z-50 mt-1 w-52 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/95 shadow-xl backdrop-blur-xl">
            {links.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center px-4 py-3 text-sm font-medium transition-colors ${
                    active
                      ? "bg-zinc-800/80 text-zinc-100"
                      : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                  }`}
                >
                  {label}
                  {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-500" />}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
