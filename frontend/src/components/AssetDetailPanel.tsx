"use client";

import { X } from "lucide-react";
import type { AssetDetail, AssetLink } from "@/lib/api";
import { HAZARD_COLOR, HAZARD_LABEL, TYPE_SINGULAR, formatPeople } from "@/lib/labels";
import { useApi, useApp } from "@/lib/store";
import { ErrorNote, LevelBadge, Skeleton } from "./ui";

function Links({ title, items }: { title: string; items: AssetLink[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted">{title}</div>
      <ul className="space-y-1.5">
        {items.slice(0, 6).map((l) => (
          <li key={`${l.id}-${l.kind}`} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">
              {l.name} <span className="text-muted">· {l.kind}</span>
            </span>
            <LevelBadge level={l.level} />
          </li>
        ))}
        {items.length > 6 && <li className="text-xs text-muted">and {items.length - 6} more</li>}
      </ul>
    </div>
  );
}

/** Admin-only: why an asset has its score, and what it is connected to. */
export function AssetDetailPanel({ assetId, onClose }: { assetId: number; onClose: () => void }) {
  const { city, riskQuery } = useApp();
  const { data, error, reload } = useApi<AssetDetail>(
    city ? `/api/cities/${city.id}/assets/${assetId}?${riskQuery}` : null,
  );

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{data?.name ?? "Loading…"}</h3>
          {data && <p className="text-xs text-muted">{TYPE_SINGULAR[data.type]}</p>}
        </div>
        <button onClick={onClose} aria-label="Close details" className="text-muted hover:text-ink">
          <X size={18} />
        </button>
      </div>

      {error && <div className="mt-4"><ErrorNote message={error} onRetry={reload} /></div>}
      {!data && !error && <Skeleton className="mt-4 h-48" />}
      {data && (
        <div className="mt-4 space-y-5">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-semibold tabular-nums">{Math.round(data.score)}</span>
            <span className="text-sm text-muted">/ 100</span>
            <LevelBadge level={data.level} />
          </div>

          <div>
            <div className="mb-2 text-xs font-medium text-muted">Why this score</div>
            {data.factors.length === 0 ? (
              <p className="text-sm text-muted">No hazard is contributing meaningfully in this period.</p>
            ) : (
              <ul className="space-y-2.5">
                {data.factors.map((f) => (
                  <li key={f.hazard}>
                    <div className="flex justify-between text-sm">
                      <span>{HAZARD_LABEL[f.hazard]}</span>
                      <span className="tabular-nums text-muted">+{f.points}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-panel-2">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(f.points, 100)}%`,
                          background: f.hazard === "reports" ? "#e8e9f3" : HAZARD_COLOR[f.hazard],
                        }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted">{f.why}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <dl className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-panel-2 p-2">
              <dt className="text-muted">Elevation</dt>
              <dd className="mt-0.5 text-sm font-medium">{data.elevation} m</dd>
            </div>
            <div className="rounded-lg bg-panel-2 p-2">
              <dt className="text-muted">Slope</dt>
              <dd className="mt-0.5 text-sm font-medium">{data.slope_pct}%</dd>
            </div>
            <div className="rounded-lg bg-panel-2 p-2">
              <dt className="text-muted">To water</dt>
              <dd className="mt-0.5 text-sm font-medium">{data.water_dist_m != null ? `${data.water_dist_m} m` : "n/a"}</dd>
            </div>
          </dl>

          {data.people > 0 && (
            <p className="text-sm">
              Serves about <strong>{formatPeople(data.people)}</strong> people{" "}
              <span className="text-muted">(estimate)</span>
            </p>
          )}
          <Links title="Relies on" items={data.relies_on} />
          <Links title="Supports" items={data.supports} />
          {(data.relies_on.length > 0 || data.supports.length > 0) && (
            <p className="text-xs text-muted">Links are estimated from proximity, not surveyed.</p>
          )}
        </div>
      )}
    </div>
  );
}
