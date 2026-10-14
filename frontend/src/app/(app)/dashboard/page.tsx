"use client";

import {
  AlertTriangle, ArrowRight, CloudRain, Flag, Hospital, Navigation, Pause, Phone, Play, Share2, Thermometer, Waves, Wind,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AssetDetailPanel } from "@/components/AssetDetailPanel";
import { HazardDonut, TrendChart } from "@/components/charts";
import { Legend, RiskMap, assetPoint } from "@/components/RiskMap";
import { Card, CountUp, Empty, ErrorNote, ScoreBar, Skeleton, Stat } from "@/components/ui";
import { ZoneGrid } from "@/components/Zones";
import type { Alert, Level, Overview, Plan } from "@/lib/api";
import { type TextKey, useT } from "@/lib/i18n";
import { LEVEL_COLOR, TYPE_SINGULAR, capitalize, timeAgo, whatsappLink } from "@/lib/labels";
import { useApi, useApp } from "@/lib/store";

const ALERTS_KEY = "infrasentinel.alerts";

function Kpi({ label, value, hint, color, icon: Icon }: { label: string; value: React.ReactNode; hint: string; color: string; icon: LucideIcon }) {
  return (
    <div className="tile flex min-w-0 flex-col justify-between p-4" style={{ "--tone": color } as React.CSSProperties}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs leading-snug text-muted">{label}</span>
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl"
          style={{ color, background: `${color}1a`, boxShadow: `0 0 18px -6px ${color}` }}
        >
          <Icon size={16} />
        </span>
      </div>
      <div>
        <div className="font-display mt-2 text-[28px] leading-tight font-bold tabular-nums">{value}</div>
        <div className="truncate text-xs font-medium" style={{ color }}>{hint}</div>
      </div>
    </div>
  );
}

/** Ring gauge for the city score (0-1000), with the level written in its own colour. */
function ScoreHero({ score, level, label, note }: { score: number; level: Level; label: string; note: string }) {
  const color = LEVEL_COLOR[level];
  const r = 52;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75;
  const filled = arc * Math.min(score, 1000) / 1000;
  return (
    <div className="tile col-span-2 flex items-center gap-5 p-4 lg:col-span-1" style={{ "--tone": color } as React.CSSProperties}>
      <div className="relative h-[124px] w-[124px] shrink-0">
        <svg viewBox="0 0 124 124" className="h-full w-full rotate-[135deg]">
          <circle cx="62" cy="62" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${arc} ${circ}`} />
          <circle
            cx="62"
            cy="62"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circ}`}
            style={{ transition: "stroke-dasharray 1s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.4s", filter: `drop-shadow(0 0 8px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="font-display text-[32px] leading-none font-bold">
              <CountUp value={score} />
            </div>
            <div className="mt-1 text-[10px] text-muted">of 1000</div>
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted">City risk score</div>
        <div className="font-display mt-1 text-2xl font-bold" style={{ color, textShadow: `0 0 20px ${color}88` }}>
          {capitalize(level)}
        </div>
        <div className="mt-1 text-xs text-muted">{label}</div>
        <div className="mt-2 inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-muted">{note}</div>
      </div>
    </div>
  );
}

/** Slider and play button that step every screen through the next 72 hours. */
function Playback() {
  const { horizon, setHorizon } = useApp();
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (horizon >= 72) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setHorizon(horizon + 6), 1800);
    return () => clearTimeout(timer);
  }, [playing, horizon, setHorizon]);

  const start = () => {
    if (horizon >= 72) setHorizon(0);
    setPlaying((p) => !p);
  };

  return (
    <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/5 bg-bg/50 px-3 py-2.5">
      <button onClick={start} className="btn !px-3 !py-1.5" aria-label={playing ? "Pause" : "Play the next 72 hours"}>
        {playing ? <Pause size={14} /> : <Play size={14} />}
        <span className="hidden sm:inline">{playing ? "Pause" : "Play 72 h"}</span>
      </button>
      <input
        type="range"
        min={0}
        max={72}
        step={6}
        value={horizon}
        onChange={(e) => {
          setPlaying(false);
          setHorizon(Number(e.target.value));
        }}
        className="min-w-0 flex-1"
        aria-label="Hours from now"
      />
      <span className="w-14 shrink-0 text-right font-mono text-sm font-semibold text-accent tabular-nums">{horizon === 0 ? "Now" : `+${horizon} h`}</span>
    </div>
  );
}

function WeatherStrip({ weather }: { weather: Overview["weather"] }) {
  const items = [
    { icon: CloudRain, label: "Rain, 24 h", value: `${weather.rain24} mm` },
    { icon: Thermometer, label: "Feels like, max", value: `${weather.apparent_max} °C` },
    { icon: Wind, label: "Gusts, max", value: `${weather.gust} km/h` },
    { icon: Waves, label: "River vs normal", value: `${weather.river_ratio}x` },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
            <item.icon size={16} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[11px] text-muted">{item.label}</div>
            <div className="text-sm font-semibold">{item.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Administrator's first screen: the map, the headline numbers and the next actions together. */
function CommandCentre({ data }: { data: Overview }) {
  const { city, riskQuery, horizon, scenario } = useApp();
  const plan = useApi<Plan>(`/api/cities/${city!.id}/plan?${riskQuery}`);
  const [selected, setSelected] = useState<number | null>(null);

  const ranked = useMemo(() => [...data.assets].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)), [data]);
  const points = useMemo(() => data.assets.map((a) => assetPoint(a, a.id === selected)), [data, selected]);
  const center = useMemo<[number, number]>(() => [city!.lon, city!.lat], [city]);
  const isolated = data.isolated_hospitals ?? [];
  const atRisk = data.counts.high + data.counts.critical;

  return (
    <div className="stagger space-y-4">
      {scenario && (
        <div className="flex items-center gap-2 rounded-xl border border-high/40 bg-high/10 px-4 py-2.5 text-sm text-high">
          <AlertTriangle size={16} />
          You are viewing a stress test, not the live forecast. Clear it from the top bar to return to live data.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(300px,1.5fr)_repeat(4,minmax(0,1fr))]">
        <ScoreHero
          score={data.score}
          level={data.level}
          label={horizon === 0 ? "Next 24 hours" : `24 hours starting +${horizon} h`}
          note={data.city.data_mode === "demo" ? "Demo storm" : data.city.data_mode === "replay" ? `Replay · ${data.city.replay_date}` : "Live forecast"}
        />
        <Kpi icon={AlertTriangle} label="Assets at risk" value={<CountUp value={atRisk} />} hint={`of ${data.assets.length} monitored`} color={atRisk ? "#ff3b6b" : "#2bff9e"} />
        <Kpi
          icon={Hospital}
          label="Hospitals that may be cut off"
          value={<CountUp value={isolated.length} />}
          hint={isolated.length ? "every access route at high risk" : "access routes are open"}
          color={isolated.length ? "#ff3b6b" : "#2bff9e"}
        />
        <Kpi icon={CloudRain} label="Rain, 24 hours" value={`${data.weather.rain24} mm`} hint={`${data.weather.antecedent} mm in the 3 days before`} color="#3ea8ff" />
        <Kpi icon={Waves} label="River level" value={`${data.weather.river_ratio}×`} hint="of normal flow" color="#7c5cff" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="card p-2">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="font-display flex items-center gap-2 text-sm font-semibold">
              <span className="live-dot" />
              {horizon === 0 ? "Next 24 hours" : `24 hours starting +${horizon} h`}
            </span>
            <Legend levels={["low", "moderate", "high", "critical"]} />
          </div>
          <RiskMap center={center} points={points} onSelect={setSelected} className="h-[520px]" />
          <Playback />
        </div>

        <div className="space-y-4">
          {selected ? (
            <AssetDetailPanel assetId={selected} onClose={() => setSelected(null)} />
          ) : (
            <>
              <Card title="Top risks right now" action={<Link href="/assets" className="text-xs text-accent hover:underline">All {data.assets.length}</Link>}>
                <ul className="-mx-2">
                  {ranked.slice(0, 5).map((a) => (
                    <li key={a.id}>
                      <button
                        onClick={() => setSelected(a.id)}
                        className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/[0.04]"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium group-hover:text-accent">{a.name}</span>
                          <span className="text-xs text-muted">{TYPE_SINGULAR[a.type]}</span>
                        </span>
                        <ScoreBar score={a.score ?? 0} level={a.level} />
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card title="Do these first" action={<Link href="/plan" className="text-xs text-accent hover:underline">Full plan</Link>}>
                {plan.error && <ErrorNote message={plan.error} onRetry={plan.reload} />}
                {!plan.data && !plan.error && <Skeleton className="h-28" />}
                {plan.data?.selected.length === 0 && <Empty>No action is needed in this period.</Empty>}
                <ul className="space-y-3">
                  {plan.data?.selected.slice(0, 3).map((a) => (
                    <li key={a.asset_id} className="flex gap-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-2 font-mono text-xs font-bold text-on-accent shadow-[0_0_14px_-4px_var(--color-accent)]">{a.rank}</span>
                      <div className="min-w-0">
                        <div className="text-sm leading-snug">{a.action}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                          <span className="truncate">{a.asset}</span>
                          <span className="flex items-center gap-1 tabular-nums">
                            {Math.round(a.score)} <ArrowRight size={11} /> <span className="text-low">{Math.round(a.risk_after)}</span>
                          </span>
                          <span>₹{a.cost} lakh</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}
        </div>
      </div>

      {isolated.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-critical/40 bg-critical/10 px-4 py-2.5 text-sm text-critical">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            {isolated.length} hospital{isolated.length > 1 ? "s" : ""} could be cut off because every mapped access
            route is at high risk: {isolated.slice(0, 3).map((h) => h.name).join(", ")}
            {isolated.length > 3 ? ` and ${isolated.length - 3} more` : ""}.
          </span>
        </div>
      )}

      <div className="stagger grid gap-4 xl:grid-cols-3">
        <Card title="Risk outlook, next 72 hours" className="xl:col-span-2">
          <TrendChart data={data.trend} horizon={horizon} />
        </Card>
        <Card title="Risk by hazard">
          <HazardDonut split={data.hazard_split} />
          <div className="mt-5">
            <WeatherStrip weather={data.weather} />
          </div>
        </Card>
        <Card title="Risk by zone">
          <ZoneGrid />
        </Card>
        <Card title="Assets by risk level" className="xl:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["critical", "high", "moderate", "low"] as const).map((level) => (
              <Stat key={level} color={LEVEL_COLOR[level]} label={capitalize(level)} value={<span style={{ color: LEVEL_COLOR[level], textShadow: `0 0 18px ${LEVEL_COLOR[level]}66` }}><CountUp value={data.counts[level]} /></span>} />
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">
            {data.assets.length} assets monitored within {data.city.radius_km} km of the centre.{" "}
            {data.city.data_mode === "demo"
              ? `Demo data: scored against a modelled storm (${data.city.demo_storm}), not today's weather.`
              : data.city.data_mode === "replay"
                ? `Replay: scored against the weather recorded on ${data.city.replay_date}.`
                : `Forecast updated ${timeAgo(data.city.weather_at)}.`}
          </p>
        </Card>
      </div>
    </div>
  );
}

/** Citizen's first screen, laid out for a phone: status, the two things to do, and alerts. */
function CitizenHome({ data }: { data: Overview }) {
  const { city } = useApp();
  const t = useT();
  const alerts = useApi<Alert[]>(`/api/alerts?city_id=${city!.id}`);
  const [saved, setSaved] = useState<Alert[] | null>(null);

  // Keep the last alerts on the device so they still show if the server cannot be reached.
  useEffect(() => {
    try {
      if (alerts.data) localStorage.setItem(`${ALERTS_KEY}.${city!.id}`, JSON.stringify(alerts.data));
      else if (alerts.error) setSaved(JSON.parse(localStorage.getItem(`${ALERTS_KEY}.${city!.id}`) ?? "null"));
    } catch {}
  }, [alerts.data, alerts.error, city]);

  const status = data.level === "low" ? "safe" : data.level === "moderate" ? "caution" : "danger";
  const color = LEVEL_COLOR[status];
  const list = alerts.data ?? saved ?? [];

  return (
    <div className="stagger mx-auto max-w-3xl space-y-4">
      <div className="card overflow-hidden p-6" style={{ borderColor: `${color}66`, boxShadow: `0 24px 60px -34px ${color}` }}>
        <div className="pointer-events-none absolute -top-24 -right-20 h-64 w-64 rounded-full blur-3xl" style={{ background: `${color}2e` }} />
        <div className="relative flex items-center gap-5">
          <div className="relative grid h-20 w-20 shrink-0 place-items-center" style={{ color }}>
            <span className="halo" />
            <span className="halo" />
            <span className="halo" />
            <span
              className="h-12 w-12 rounded-full"
              style={{ background: `radial-gradient(circle at 35% 30%, #ffffff, ${color} 45%, ${color}66)`, boxShadow: `0 0 34px ${color}` }}
            />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
              {t("yourCity")} · {data.city.name}
            </div>
            <div className="font-display mt-1 text-4xl font-bold" style={{ color, textShadow: `0 0 26px ${color}88` }}>{t(status)}</div>
            <p className="mt-1 text-sm text-ink/90">{t(`${status}Msg` as TextKey)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/route" className="btn !justify-center !py-4 text-base">
          <Navigation size={18} /> {t("btnRoute")}
        </Link>
        <Link href="/reports" className="btn btn-ghost !justify-center !py-4 text-base">
          <Flag size={18} /> {t("btnReport")}
        </Link>
      </div>

      <Card title={t("latestAlerts")} action={<Link href="/alerts" className="text-xs text-accent hover:underline">{t("allAlerts")}</Link>}>
        {alerts.error && saved && <p className="mb-3 text-xs text-moderate">{t("offline")}</p>}
        {alerts.error && !saved && <ErrorNote message={alerts.error} onRetry={alerts.reload} />}
        {list.length === 0 && !alerts.error && <Empty>{t("noAlerts")}</Empty>}
        <ul className="space-y-3">
          {list.slice(0, 3).map((a) => (
            <li key={a.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
              <div className="text-sm font-medium">{a.title}</div>
              <div className="mt-0.5 line-clamp-3 text-xs text-muted">{a.message}</div>
              <a href={whatsappLink(a, data.city.name)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs text-low hover:underline">
                <Share2 size={13} /> {t("share")}
              </a>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title={t("services")}>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat color="#2bff9e" label={t("safe")} value={<span className="text-low"><CountUp value={data.counts.safe} /></span>} />
            <Stat color="#ffd60a" label={t("caution")} value={<span className="text-moderate"><CountUp value={data.counts.caution} /></span>} />
            <Stat color="#ff3b6b" label={t("danger")} value={<span className="text-critical"><CountUp value={data.counts.danger} /></span>} />
          </div>
        </Card>
        <Card title={t("emergency")}>
          <div className="flex flex-wrap gap-2">
            <a href="tel:112" className="flex items-center gap-2 rounded-full border border-critical/50 bg-critical/15 px-4 py-2 text-sm font-semibold text-critical shadow-[0_0_20px_-6px_var(--color-critical)]">
              <Phone size={15} /> {t("call112")}
            </a>
            <Link href="/map?relief=1" className="rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm text-accent">{t("reliefPoints")}</Link>
          </div>
        </Card>
      </div>

      <Card title={t("zones")}>
        <ZoneGrid />
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  const { city, isAdmin, riskQuery } = useApp();
  const { data, error, reload } = useApi<Overview>(city ? `/api/cities/${city.id}/overview?${riskQuery}` : null);

  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) {
    return (
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-24 xl:col-span-3" />
        <Skeleton className="h-96 xl:col-span-2" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  return isAdmin ? <CommandCentre data={data} /> : <CitizenHome data={data} />;
}
