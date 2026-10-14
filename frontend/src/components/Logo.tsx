"use client";

import { useId } from "react";

/*
 * The InfraSentinel mark: a shield holding a small network of assets around a central "sentinel" hub,
 * watched by a radar sweep. Each asset lights up as the sweep passes, and the at-risk asset pulses.
 * Assets use the app's risk colours: low (green), moderate (amber) and critical (red).
 */

const HUB = { x: 32, y: 33 };
const SHIELD = "M32 6.5 L51.5 13.2 V30.8 C51.5 43.6 43.2 52 32 57.5 C20.8 52 12.5 43.6 12.5 30.8 V13.2 Z";
const SWEEP_SECONDS = 4;
const RADIUS = 30;

// `angle` is where the sweep passes each asset, in degrees clockwise from straight up.
const NODES = [
  { x: 22.5, y: 24.5, color: "#34d399", angle: 312 },
  { x: 41.5, y: 23.5, color: "#34d399", angle: 45 },
  { x: 22, y: 42, color: "#fbbf24", angle: 228 },
  { x: 42, y: 42.5, color: "#f43f5e", angle: 134 },
];
const AT_RISK = NODES[3];

function point(angle: number) {
  const a = (angle * Math.PI) / 180;
  return `${(HUB.x + RADIUS * Math.sin(a)).toFixed(2)} ${(HUB.y - RADIUS * Math.cos(a)).toFixed(2)}`;
}

// The fading tail behind the sweep line, as three wedges of falling opacity.
const WEDGES = [
  { from: -24, to: 0, opacity: 0.42 },
  { from: -48, to: -24, opacity: 0.22 },
  { from: -72, to: -48, opacity: 0.1 },
].map((w) => ({ d: `M${HUB.x} ${HUB.y} L${point(w.from)} A${RADIUS} ${RADIUS} 0 0 1 ${point(w.to)} Z`, opacity: w.opacity }));

type MarkProps = {
  size?: number;
  /** Turns the sweep, blips and pulse off, for places where motion would distract. */
  animated?: boolean;
  /** Hides the mark from screen readers when a visible name sits next to it. */
  decorative?: boolean;
  className?: string;
};

export function LogoMark({ size = 32, animated = true, decorative = false, className = "" }: MarkProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const tile = `logo-tile-${uid}`;
  const clip = `logo-clip-${uid}`;

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "InfraSentinel"}
      aria-hidden={decorative || undefined}
    >
      <defs>
        <linearGradient id={tile} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#341a6e" />
          <stop offset="1" stopColor="#120b2b" />
        </linearGradient>
        <clipPath id={clip}>
          <path d={SHIELD} />
        </clipPath>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${tile})`} />
      <path d={SHIELD} fill="#a855f7" fillOpacity="0.12" />
      <g clipPath={`url(#${clip})`}>
        <circle cx={HUB.x} cy={HUB.y} r="10" fill="none" stroke="#a855f7" strokeOpacity="0.22" strokeWidth="0.8" />
        <circle cx={HUB.x} cy={HUB.y} r="19" fill="none" stroke="#a855f7" strokeOpacity="0.16" strokeWidth="0.8" />
        <g className={animated ? "logo-sweep" : undefined} transform={animated ? undefined : `rotate(40 ${HUB.x} ${HUB.y})`}>
          {WEDGES.map((w) => (
            <path key={w.d} d={w.d} fill="#c084fc" fillOpacity={w.opacity} />
          ))}
          <line x1={HUB.x} y1={HUB.y} x2={HUB.x} y2={HUB.y - RADIUS} stroke="#e9d5ff" strokeWidth="1.3" strokeOpacity="0.9" />
        </g>
      </g>
      <g stroke="#c4b5fd" strokeOpacity="0.55" strokeWidth="1.5" strokeLinecap="round">
        {NODES.map((n) => (
          <line key={`${n.x}-${n.y}`} x1={HUB.x} y1={HUB.y} x2={n.x} y2={n.y} />
        ))}
        <line x1={NODES[0].x} y1={NODES[0].y} x2={NODES[1].x} y2={NODES[1].y} />
      </g>
      {animated && (
        <circle
          className="logo-pulse"
          cx={AT_RISK.x}
          cy={AT_RISK.y}
          r="3"
          fill="none"
          stroke="#f43f5e"
          strokeWidth="1.4"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {NODES.map((n) => (
        <g key={`node-${n.x}-${n.y}`}>
          {animated && (
            <circle
              className="logo-blip"
              cx={n.x}
              cy={n.y}
              r="3"
              fill={n.color}
              style={{ animationDelay: `${(n.angle / 360) * SWEEP_SECONDS}s` }}
            />
          )}
          <circle cx={n.x} cy={n.y} r="3" fill={n.color} />
        </g>
      ))}
      <circle cx={HUB.x} cy={HUB.y} r="3.6" fill="#f5f3ff" stroke="#a855f7" strokeWidth="1.2" />
      <path d={SHIELD} fill="none" stroke="#a855f7" strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  );
}

/** The mark with the name beside it, as used in the sidebar and on the login page. */
export function Logo({ size = 32, animated = true, textClass = "text-lg" }: { size?: number; animated?: boolean; textClass?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} animated={animated} decorative />
      <span className={`font-semibold tracking-tight ${textClass}`}>
        Infra<span className="text-accent">Sentinel</span>
      </span>
    </span>
  );
}
