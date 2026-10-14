"use client";

import { ArrowRight, GitFork, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { api, type AssetDetail, type AssetLink } from "@/lib/api";
import { HAZARD_COLOR, HAZARD_LABEL, LEVEL_COLOR, TYPE_SINGULAR, formatPeople } from "@/lib/labels";
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

/** The asset's own score over the next 72 hours, drawn without a chart library. */
function Outlook({ trend, color }: { trend: AssetDetail["trend"]; color: string }) {
  const width = 280;
  const height = 48;
  const top = Math.max(...trend.map((p) => p.score), 20);
  const points = trend.map((p, i) => `${(i * width) / (trend.length - 1)},${height - (p.score / top) * (height - 6)}`).join(" ");
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs text-muted">
        <span>Next 72 hours</span>
        <span className="tabular-nums">
          {Math.round(trend[0].score)} now, {Math.round(trend[trend.length - 1].score)} at +72 h
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Risk score over the next 72 hours">
        <polygon points={`0,${height} ${points} ${width},${height}`} fill={color} opacity={0.18} />
        <polyline points={points} fill="none" stroke={color} strokeWidth={2} />
      </svg>
    </div>
  );
}

/** Admin-only: why an asset has its score, what fails with it, and what to do about it. */
export function AssetDetailPanel({ assetId, onClose }: { assetId: number; onClose: () => void }) {
  const { city, riskQuery, notify } = useApp();
  const { data, error, reload } = useApi<AssetDetail>(
    city ? `/api/cities/${city.id}/assets/${assetId}?${riskQuery}` : null,
  );

  const assign = async () => {
    if (!data?.action) return;
    const crew = window.prompt(`Which crew takes "${data.action.action}" at ${data.name}?`, "Crew A");
    if (crew === null) return;
    try {
      await api(`/api/cities/${city!.id}/tasks`, { body: { asset_id: data.id, action: data.action.action, crew } });
      notify(`Assigned to ${crew || "a crew"}. Follow it on the Action Plan page.`);
    } catch (err) {
      notify((err as Error).message, "error");
    }
  };

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
            <span className="text-3xl font-semibold tabular-nums" style={{ color: LEVEL_COLOR[data.level] }}>{Math.round(data.score)}</span>
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
                          background: f.hazard === "reports" ? "var(--color-ink)" : HAZARD_COLOR[f.hazard],
                        }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted">{f.why}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {data.trend.length > 1 && <Outlook trend={data.trend} color={LEVEL_COLOR[data.level]} />}

          {data.action && (
            <div className="rounded-xl border border-accent/50 bg-accent/10 p-3">
              <div className="text-xs font-medium text-accent">Recommended action</div>
              <p className="mt-1 text-sm font-medium">{data.action.action}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                <span className="flex items-center gap-1 tabular-nums">
                  Risk {Math.round(data.action.score)} <ArrowRight size={12} /> <span className="text-low">{Math.round(data.action.risk_after)}</span>
                </span>
                <span>₹{data.action.cost} lakh</span>
                <span>{data.action.crews} crew{data.action.crews > 1 ? "s" : ""}</span>
              </div>
              <button className="btn mt-3 !px-3 !py-1.5 text-xs" onClick={assign}>
                <UserPlus size={13} /> Assign a crew
              </button>
            </div>
          )}

          {data.supports.length > 0 && (
            <div className="rounded-xl border border-critical/40 bg-critical/10 p-3">
              <div className="mb-2 text-xs font-medium text-critical">If this fails</div>
              <Links title={`${data.supports.length} asset${data.supports.length > 1 ? "s" : ""} rely on it`} items={data.supports} />
              <Link href={`/cascade?fail=${data.id}`} className="btn btn-ghost mt-3 !px-3 !py-1.5 text-xs">
                <GitFork size={13} /> Simulate this failure
              </Link>
            </div>
          )}

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
          {(data.relies_on.length > 0 || data.supports.length > 0) && (
            <p className="text-xs text-muted">Links are estimated from proximity unless real ones have been imported.</p>
          )}
        </div>
      )}
    </div>
  );
}
