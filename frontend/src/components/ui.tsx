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
          {title && (
            <h2 className="flex items-center gap-2.5 text-[15px] font-semibold">
              <span className="h-4 w-1 rounded-full bg-gradient-to-b from-accent to-accent-3 shadow-[0_0_10px_var(--color-accent)]" />
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="page-enter mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="eyebrow">InfraSentinel</div>
        <h1 className="mt-1.5 text-2xl font-bold md:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function LevelBadge({ level }: { level: Level }) {
  const color = LEVEL_COLOR[level];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
      style={{ color, background: `color-mix(in srgb, ${color} 8%, transparent)`, borderColor: `color-mix(in srgb, ${color} 33%, transparent)`, boxShadow: `0 0 14px -6px ${color}` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      {capitalize(level)}
    </span>
  );
}

export function ScoreBar({ score, level }: { score: number; level: Level }) {
  const color = LEVEL_COLOR[level];
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-ink/5">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${score}%`, background: `linear-gradient(90deg, color-mix(in srgb, ${color} 40%, transparent), ${color})`, boxShadow: `0 0 8px ${color}` }}
        />
      </div>
      <span className="w-8 text-right font-mono text-xs tabular-nums" style={{ color }}>
        {Math.round(score)}
      </span>
    </div>
  );
}

export function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card flex items-center justify-between gap-4 !border-critical/50 p-4 text-sm text-critical">
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
      const t = Math.min((now - start) / 900, 1);
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

export function Stat({ label, value, hint, color }: { label: string; value: React.ReactNode; hint?: string; color?: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-ink/8 bg-ink/[0.03] p-4"
      style={color ? { borderColor: `color-mix(in srgb, ${color} 20%, transparent)`, boxShadow: `inset 0 -24px 40px -30px ${color}` } : undefined}
    >
      {color && <span className="absolute inset-x-4 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />}
      <div className="text-xs text-muted">{label}</div>
      <div className="font-display mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}
