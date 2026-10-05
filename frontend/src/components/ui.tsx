"use client";

import { useEffect, useRef, useState } from "react";
import type { Level } from "@/lib/api";
import { LEVEL_COLOR, capitalize } from "@/lib/labels";

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function LevelBadge({ level }: { level: Level }) {
  const color = LEVEL_COLOR[level];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ color, background: `${color}1f` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {capitalize(level)}
    </span>
  );
}

export function ScoreBar({ score, level }: { score: number; level: Level }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-panel-2">
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: LEVEL_COLOR[level] }} />
      </div>
      <span className="w-8 text-right text-xs tabular-nums text-muted">{Math.round(score)}</span>
    </div>
  );
}

export function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card flex items-center justify-between gap-4 border-critical/50 p-4 text-sm text-critical">
      <span>{message}</span>
      {onRetry && (
        <button className="btn btn-ghost" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted">{children}</p>;
}

/** Counts up to `value` on first render and whenever it changes. */
export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / 600, 1);
      setShown(Math.round(origin + (value - origin) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span className="tabular-nums">
      {shown}
      {suffix}
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl bg-panel-2 p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}
