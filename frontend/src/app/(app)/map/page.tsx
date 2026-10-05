"use client";

import { Satellite } from "lucide-react";
import { useMemo, useState } from "react";
import { AssetDetailPanel } from "@/components/AssetDetailPanel";
import { Legend, RiskMap, assetPoint } from "@/components/RiskMap";
import { Card, ErrorNote, LevelBadge, PageTitle } from "@/components/ui";
import type { AssetType, Overview } from "@/lib/api";
import { TYPE_LABEL, TYPE_SINGULAR } from "@/lib/labels";
import { useApi, useApp } from "@/lib/store";

function yesterday(): string {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
}

export default function MapPage() {
  const { city, isAdmin, riskQuery } = useApp();
  const { data, error, reload } = useApi<Overview>(city ? `/api/cities/${city.id}/overview?${riskQuery}` : null);
  const [hidden, setHidden] = useState<Set<AssetType>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [satellite, setSatellite] = useState(false);
  const [date, setDate] = useState(yesterday);

  const types = useMemo(() => [...new Set(data?.assets.map((a) => a.type) ?? [])], [data]);
  const points = useMemo(
    () => (data?.assets ?? []).filter((a) => !hidden.has(a.type)).map((a) => assetPoint(a, a.id === selected)),
    [data, hidden, selected],
  );
  const center = useMemo<[number, number]>(() => [city!.lon, city!.lat], [city]);
  const picked = data?.assets.find((a) => a.id === selected);

  const toggle = (type: AssetType) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });

  return (
    <div>
      <PageTitle
        title="Live Map"
        subtitle={`${points.length} assets shown in ${city!.name}. Click a point for details.`}
        action={<Legend levels={isAdmin ? ["low", "moderate", "high", "critical"] : ["safe", "caution", "danger"]} />}
      />
      {error && <ErrorNote message={error} onRetry={reload} />}
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="card p-2">
          <RiskMap
            center={center}
            points={points}
            onSelect={setSelected}
            satelliteDate={satellite ? date : null}
            className="h-[calc(100vh-230px)] min-h-[420px]"
          />
        </div>

        <div className="space-y-5">
          <Card title="Layers">
            <div className="flex flex-wrap gap-2">
              {types.map((type) => (
                <button
                  key={type}
                  onClick={() => toggle(type)}
                  aria-pressed={!hidden.has(type)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    hidden.has(type) ? "border-line text-muted" : "border-accent/60 bg-accent/15 text-ink"
                  }`}
                >
                  {TYPE_LABEL[type]}
                </button>
              ))}
            </div>
            <div className="mt-4 border-t border-line pt-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={satellite} onChange={(e) => setSatellite(e.target.checked)} className="accent-[#a855f7]" />
                <Satellite size={15} className="text-accent" />
                Satellite image (NASA)
              </label>
              {satellite && (
                <>
                  <input
                    type="date"
                    className="input mt-3"
                    value={date}
                    max={yesterday()}
                    onChange={(e) => e.target.value && setDate(e.target.value)}
                    aria-label="Satellite image date"
                  />
                  <p className="mt-2 text-xs text-muted">
                    Daily MODIS true-colour image at about 250 m per pixel. Change the date to compare before and after
                    an event; cloudy days show cloud.
                  </p>
                </>
              )}
            </div>
          </Card>

          {selected && isAdmin && <AssetDetailPanel assetId={selected} onClose={() => setSelected(null)} />}
          {picked && !isAdmin && (
            <Card title={picked.name}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">{TYPE_SINGULAR[picked.type]}</span>
                <LevelBadge level={picked.level} />
              </div>
            </Card>
          )}
          {!selected && (
            <p className="px-1 text-xs text-muted">
              Use the time buttons in the top bar to see how risk changes over the next three days.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
