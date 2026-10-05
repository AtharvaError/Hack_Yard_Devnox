"use client";

import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Hazard, Level } from "@/lib/api";
import { HAZARD_COLOR, HAZARD_LABEL, LEVEL_COLOR, capitalize } from "@/lib/labels";
import { CountUp } from "./ui";

const TOOLTIP_STYLE = {
  background: "#1c2036",
  border: "1px solid #262a44",
  borderRadius: 10,
  fontSize: 12,
  color: "#e8e9f3",
};

/** Half-circle gauge for the city score (0-1000). */
export function Gauge({ score, level }: { score: number; level: Level }) {
  const radius = 80;
  const length = Math.PI * radius;
  const color = LEVEL_COLOR[level];
  return (
    <div className="relative mx-auto w-[220px]">
      <svg viewBox="0 0 200 116" role="img" aria-label={`City risk score ${score} out of 1000, ${level}`}>
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#1c2036" strokeWidth="16" strokeLinecap="round" />
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - Math.min(score, 1000) / 1000)}
          style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.4s", filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-1 text-center">
        <div className="text-xs text-muted">Score</div>
        <div className="text-3xl leading-tight font-semibold">
          <CountUp value={score} />
        </div>
        <span className="mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-semibold" style={{ background: color, color: "#0b0d18" }}>
          {capitalize(level)}
        </span>
      </div>
      <div className="flex justify-between px-2 text-[11px] text-muted">
        <span>0</span>
        <span>1000</span>
      </div>
    </div>
  );
}

export function TrendChart({ data, horizon }: { data: { hour: number; score: number }[]; horizon: number }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#262a44" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="hour"
          tickFormatter={(h: number) => (h === 0 ? "Now" : `+${h}h`)}
          tick={{ fill: "#8b8fa8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        {/* Zoom in on calm days so the shape of the outlook is still readable. */}
        <YAxis domain={[0, (max: number) => Math.min(1000, Math.max(100, Math.ceil((max * 1.3) / 50) * 50))]} tick={{ fill: "#8b8fa8", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(h) => (Number(h) === 0 ? "Next 24 h" : `24 h starting +${h}h`)}
          formatter={(value) => [`${value} / 1000`, "City risk"]}
        />
        <Area
          type="monotone"
          dataKey="score"
          stroke="#a855f7"
          strokeWidth={2.5}
          fill="url(#trendFill)"
          isAnimationActive={false}
          dot={(props: { cx?: number; cy?: number; payload?: { hour: number }; index?: number }) =>
            props.payload?.hour === horizon ? (
              <circle key={props.index} cx={props.cx} cy={props.cy} r={5} fill="#a855f7" stroke="#fff" strokeWidth={2} />
            ) : (
              <g key={props.index} />
            )
          }
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function HazardDonut({ split }: { split: Record<Hazard, number> }) {
  const data = (Object.keys(split) as Hazard[]).map((h) => ({ name: HAZARD_LABEL[h], hazard: h, value: split[h] }));
  const active = data.filter((d) => d.value > 0);
  const top = [...data].sort((a, b) => b.value - a.value)[0];
  return (
    <div className="flex items-center gap-4">
      <ul className="flex-1 space-y-2.5 text-sm">
        {data.map((d) => (
          <li key={d.hazard} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: HAZARD_COLOR[d.hazard] }} />
            <span className="flex-1">{d.name}</span>
            <span className="tabular-nums text-muted">{d.value}%</span>
          </li>
        ))}
      </ul>
      <div className="relative h-[150px] w-[150px] shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={active.length ? active : [{ name: "None", hazard: "flood" as Hazard, value: 1 }]}
              dataKey="value"
              innerRadius={50}
              outerRadius={70}
              paddingAngle={active.length > 1 ? 4 : 0}
              cornerRadius={6}
              stroke="none"
            >
              {(active.length ? active : [null]).map((d, i) => (
                <Cell key={i} fill={d ? HAZARD_COLOR[d.hazard] : "#1c2036"} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-[11px] text-muted">{top.value > 0 ? top.name : "No risk"}</div>
            <div className="text-xl font-semibold">{top.value}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
