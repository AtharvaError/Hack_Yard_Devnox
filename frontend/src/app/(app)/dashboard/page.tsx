"use client";

import {
  AlertTriangle, Building2, CloudRain, Droplets, Milestone, Route, Thermometer, Waves, Wind, Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Gauge, HazardDonut, TrendChart } from "@/components/charts";
import { Card, CountUp, Empty, ErrorNote, LevelBadge, ScoreBar, Skeleton, Stat } from "@/components/ui";
import type { Alert, AssetType, Overview } from "@/lib/api";
import { HAZARD_LABEL, HORIZONS, TYPE_LABEL, TYPE_SINGULAR, timeAgo } from "@/lib/labels";
import { useApi, useApp } from "@/lib/store";

const TILE_STYLE: Record<string, { icon: LucideIcon; color: string }> = {
  road: { icon: Route, color: "#f472b6" },
  bridge: { icon: Milestone, color: "#a855f7" },
  substation: { icon: Zap, color: "#fb923c" },
  hospital: { icon: Building2, color: "#60a5fa" },
  water: { icon: Droplets, color: "#2dd4bf" },
};

function Tiles({ tiles }: { tiles: Overview["tiles"] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {tiles.map((tile) => {
        const style = TILE_STYLE[tile.type];
        return (
          <div key={tile.type} className="card-hover rounded-xl border border-transparent bg-panel-2 p-4">
            <span className="grid h-9 w-9 place-items-center rounded-full text-white" style={{ background: style.color }}>
              <style.icon size={17} />
            </span>
            <div className="mt-3 text-2xl font-semibold">
              <CountUp value={tile.percent} suffix="%" />
            </div>
            <div className="mt-0.5 text-xs text-muted">{TYPE_LABEL[tile.type as AssetType]} at risk</div>
            <div className="mt-1 text-[11px] text-muted">
              {tile.at_risk} of {tile.total}
            </div>
          </div>
        );
      })}
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
        <div key={item.label} className="flex items-center gap-3 rounded-xl bg-panel-2 p-3">
          <item.icon size={18} className="shrink-0 text-accent" />
          <div className="min-w-0">
            <div className="truncate text-[11px] text-muted">{item.label}</div>
            <div className="text-sm font-semibold">{item.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { city, isAdmin, riskQuery, horizon, scenario } = useApp();
  const { data, error, reload } = useApi<Overview>(city ? `/api/cities/${city.id}/overview?${riskQuery}` : null);
  const alerts = useApi<Alert[]>(city ? `/api/alerts?city_id=${city.id}` : null);

  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) {
    return (
      <div className="grid gap-5 xl:grid-cols-3">
        <Skeleton className="h-56 xl:col-span-2" />
        <Skeleton className="h-56" />
        <Skeleton className="h-72 xl:col-span-2" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const period = HORIZONS.find((h) => h.value === horizon)?.label ?? "Now";
  const ranked = isAdmin ? [...data.assets].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) : [];
  const isolated = data.isolated_hospitals ?? [];

  return (
    <div className="space-y-5">
      {scenario && isAdmin && (
        <div className="flex items-center gap-2 rounded-xl border border-high/40 bg-high/10 px-4 py-2.5 text-sm text-high">
          <AlertTriangle size={16} />
          You are viewing a stress test, not the live forecast. Clear it from the top bar to return to live data.
        </div>
      )}
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

      <div className="grid gap-5 xl:grid-cols-3">
        <Card
          title="Current Risk"
          className="xl:col-span-2"
          action={<span className="rounded-full bg-panel-2 px-3 py-1 text-xs text-muted">{period === "Now" ? "Next 24 hours" : `24 h from ${period}`}</span>}
        >
          <Tiles tiles={data.tiles} />
        </Card>
        <Card title="Risk Score">
          <Gauge score={data.score} level={data.level} />
        </Card>

        <Card title="Risk Outlook, next 72 hours" className="xl:col-span-2">
          <TrendChart data={data.trend} horizon={horizon} />
        </Card>
        <Card title="Risk by Hazard">
          <HazardDonut split={data.hazard_split} />
          <div className="mt-5">
            <WeatherStrip weather={data.weather} />
          </div>
        </Card>

        {isAdmin ? (
          <>
            <Card
              title="Asset Details"
              className="xl:col-span-2"
              action={<Link href="/assets" className="text-xs text-accent hover:underline">View all {data.assets.length}</Link>}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="pb-2 font-medium">Asset</th>
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 font-medium">Main hazard</th>
                      <th className="pb-2 font-medium">Risk</th>
                      <th className="pb-2 font-medium">Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.slice(0, 8).map((a) => (
                      <tr key={a.id} className="border-t border-line">
                        <td className="max-w-[220px] truncate py-2.5 pr-3">{a.name}</td>
                        <td className="py-2.5 pr-3 text-muted">{TYPE_SINGULAR[a.type]}</td>
                        <td className="py-2.5 pr-3 text-muted">{a.dominant ? HAZARD_LABEL[a.dominant] : "None"}</td>
                        <td className="py-2.5 pr-3"><ScoreBar score={a.score ?? 0} level={a.level} /></td>
                        <td className="py-2.5"><LevelBadge level={a.level} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card title="Assets by Risk Level">
              <div className="grid grid-cols-2 gap-3">
                {(["critical", "high", "moderate", "low"] as const).map((level) => (
                  <Stat key={level} label={level[0].toUpperCase() + level.slice(1)} value={<CountUp value={data.counts[level]} />} />
                ))}
              </div>
              <p className="mt-4 text-xs text-muted">
                {data.assets.length} assets monitored within {data.city.radius_km} km of the centre. Forecast updated{" "}
                {timeAgo(data.city.weather_at)}.
              </p>
            </Card>
          </>
        ) : (
          <>
            <Card title="Essential Services Status" className="xl:col-span-2">
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Safe" value={<span className="text-low"><CountUp value={data.counts.safe} /></span>} hint="Operating normally" />
                <Stat label="Caution" value={<span className="text-moderate"><CountUp value={data.counts.caution} /></span>} hint="Could be disrupted" />
                <Stat label="Danger" value={<span className="text-critical"><CountUp value={data.counts.danger} /></span>} hint="Avoid if possible" />
              </div>
              <p className="mt-4 text-sm text-muted">
                Open the <Link href="/map" className="text-accent hover:underline">Live Map</Link> to see which
                hospitals, roads and bridges are affected, or find a{" "}
                <Link href="/route" className="text-accent hover:underline">safe route</Link> to the nearest hospital.
              </p>
            </Card>
            <Card title="Latest Alerts" action={<Link href="/alerts" className="text-xs text-accent hover:underline">All alerts</Link>}>
              {alerts.data?.length ? (
                <ul className="space-y-3">
                  {alerts.data.slice(0, 3).map((a) => (
                    <li key={a.id} className="rounded-xl bg-panel-2 p-3">
                      <div className="text-sm font-medium">{a.title}</div>
                      <div className="mt-0.5 line-clamp-2 text-xs text-muted">{a.message}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No active alerts for {data.city.name}.</Empty>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
