"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function TopProgressBar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // kick off bar
    setWidth(0);
    setVisible(true);

    // tick to ~80% quickly, then complete after a moment
    rafRef.current = requestAnimationFrame(() => {
      setWidth(72);
      timerRef.current = setTimeout(() => {
        setWidth(100);
        timerRef.current = setTimeout(() => setVisible(false), 300);
      }, 400);
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed left-0 top-0 z-[9999] h-[2.5px] transition-all duration-300 ease-out"
      style={{
        width: `${width}%`,
        background: "linear-gradient(90deg, #7c3aed, #06b6d4)",
        boxShadow: "0 0 8px rgba(124,58,237,0.8), 0 0 2px rgba(6,182,212,0.6)",
        opacity: width === 100 ? 0 : 1,
      }}
    />
  );
}
