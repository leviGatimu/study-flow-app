"use client";

import { useEffect, useRef } from "react";

/**
 * A number that counts up from zero when it first appears ("42", "87%",
 * "1,250 XP", "3.5h"). Anything that is not a plain number with an optional
 * suffix is shown as it is. The server renders the final text, and the count
 * writes straight into the span, so there is no re-render and nothing
 * changes for screen readers or with reduced motion.
 */
const NUMBER = /^(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(\D.*)?$/;

export function CountUp({ value, durationMs = 800 }: { value: string | number; durationMs?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const text = String(value);

  useEffect(() => {
    const el = ref.current;
    const m = NUMBER.exec(text);
    if (!el || !m) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const grouped = m[1].includes(",");
    const decimals = m[2] ? m[2].length - 1 : 0;
    const target = Number(m[1].replace(/,/g, "") + (m[2] ?? ""));
    const suffix = m[3] ?? "";
    if (!Number.isFinite(target) || target === 0) return;

    const format = (n: number) =>
      (grouped
        ? n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : n.toFixed(decimals)) + suffix;

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = format(target * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else el.textContent = text;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      el.textContent = text;
    };
  }, [text, durationMs]);

  return <span ref={ref}>{text}</span>;
}
