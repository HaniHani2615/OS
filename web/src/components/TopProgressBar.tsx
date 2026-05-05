"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * GitHub-style top progress bar.
 * - Starts immediately on internal link click (feels instant).
 * - Crawls to ~85% while waiting for the new page to load.
 * - Completes + fades out once the pathname actually changes.
 */
export function TopProgressBar() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [opacity, setOpacity] = useState(0);

  const crawlRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(false);

  function clearAll() {
    if (crawlRef.current) clearInterval(crawlRef.current);
    if (hideRef.current) clearTimeout(hideRef.current);
  }

  function start() {
    clearAll();
    startedRef.current = true;
    setWidth(0);
    setOpacity(1);

    // Quick jump to 20% then crawl slowly toward 85%
    requestAnimationFrame(() => {
      setWidth(20);
      crawlRef.current = setInterval(() => {
        setWidth((w) => {
          if (w >= 85) {
            clearInterval(crawlRef.current!);
            return 85;
          }
          // Decelerate as it approaches 85%
          return w + (85 - w) * 0.045;
        });
      }, 160);
    });
  }

  function finish() {
    if (!startedRef.current) return;
    clearAll();
    startedRef.current = false;
    setWidth(100);
    hideRef.current = setTimeout(() => {
      setOpacity(0);
      hideRef.current = setTimeout(() => setWidth(0), 350);
    }, 200);
  }

  // Complete bar when pathname changes (route loaded)
  useEffect(() => {
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Intercept internal link clicks to start bar immediately
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = (e.target as Element).closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href) return;
      // Only internal same-origin non-hash links
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("http")) return;
      if (target.getAttribute("target") === "_blank") return;
      start();
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[9999] h-[2.5px]"
      style={{
        width: `${width}%`,
        opacity,
        background: "linear-gradient(90deg, oklch(55% 0.22 270), oklch(70% 0.18 215))",
        boxShadow: "0 0 10px oklch(55% 0.22 270 / 0.7)",
        transition: width === 100
          ? "width 200ms ease-out, opacity 350ms ease"
          : width === 0
          ? "none"
          : "width 160ms ease-out, opacity 200ms ease",
      }}
    />
  );
}
