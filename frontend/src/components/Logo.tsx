"use client";

import { useId } from "react";

/*
 * The InfraSentinel mark: a hexagon (the city's infrastructure) crossed by a pulse line (the live
 * signal it is watched with). The spike at the top is a risk being caught, and it pulses.
 * Animated, a spark runs along the pulse line and another traces the hexagon.
 */

const HEX = "M32 5.5 L54.5 18.5 V45.5 L32 58.5 L9.5 45.5 V18.5 Z";
const INNER_HEX = "M32 14 L47 22.7 V41.3 L32 50 L17 41.3 V22.7 Z";
const PULSE = "M9.5 33 H20.5 L24.5 26 L29.5 41.5 L35.5 17.5 L40.5 33 H54.5";
const PEAK = { x: 35.5, y: 17.5 };

type MarkProps = {
  size?: number;
  /** Turns the sparks and pulse off, for places where motion would distract. */
  animated?: boolean;
  /** Hides the mark from screen readers when a visible name sits next to it. */
  decorative?: boolean;
  /** Adds a soft neon glow around the mark. */
  glow?: boolean;
  className?: string;
};

export function LogoMark({ size = 32, animated = true, decorative = false, glow = true, className = "" }: MarkProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const neon = `logo-neon-${uid}`;
  const fill = `logo-fill-${uid}`;

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`shrink-0 overflow-visible ${glow ? "logo-glow" : ""} ${className}`}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "InfraSentinel"}
      aria-hidden={decorative || undefined}
    >
      <defs>
        <linearGradient id={neon} gradientUnits="userSpaceOnUse" x1="8" y1="8" x2="56" y2="56">
          <stop offset="0" stopColor="#00e5ff" />
          <stop offset="0.55" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#ff3cac" />
        </linearGradient>
        <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#111737" />
          <stop offset="1" stopColor="#070915" />
        </linearGradient>
      </defs>

      <path d={HEX} fill={`url(#${fill})`} stroke={`url(#${neon})`} strokeWidth="3.2" strokeLinejoin="round" />
      <path d={INNER_HEX} fill="none" stroke={`url(#${neon})`} strokeOpacity="0.28" strokeWidth="1" strokeLinejoin="round" />
      {animated && (
        <path className="logo-trace" d={HEX} pathLength={100} fill="none" stroke="#e6fbff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      )}

      <path d={PULSE} fill="none" stroke={`url(#${neon})`} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      {animated && (
        <path className="logo-spark" d={PULSE} pathLength={100} fill="none" stroke="#ffffff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      )}

      {animated && <circle className="logo-pulse" cx={PEAK.x} cy={PEAK.y} r="3.4" fill="none" stroke="#ff3cac" strokeWidth="1.6" />}
      <circle cx={PEAK.x} cy={PEAK.y} r="3.1" fill="#ffffff" stroke="#ff3cac" strokeWidth="1.6" />
    </svg>
  );
}

/** The mark with the name beside it, as used in the sidebar and on the login page. */
export function Logo({ size = 32, animated = true, textClass = "text-lg" }: { size?: number; animated?: boolean; textClass?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} animated={animated} decorative />
      <span className={`font-display leading-none font-bold tracking-tight ${textClass}`}>
        Infra<span className="neon-text">Sentinel</span>
      </span>
    </span>
  );
}
