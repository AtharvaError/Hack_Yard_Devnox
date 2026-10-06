"use client";

import { useEffect, useMemo, useState } from "react";
import { RiskMap, type MapPoint } from "@/components/RiskMap";
import { Lightbox, ReportCard, STATUS_COLOR } from "@/components/ReportCard";
import { ReportForm } from "@/components/ReportForm";
import { Card, Empty, ErrorNote, PageTitle, Skeleton } from "@/components/ui";
import { api, type Report, type ReportOptions } from "@/lib/api";
import { capitalize } from "@/lib/labels";
import { useApi, useApp } from "@/lib/store";

type Filter = "pending" | "verified" | "rejected" | "all";
const FILTERS: Filter[] = ["pending", "verified", "rejected", "all"];

export default function ReportsPage() {
  const { city, isAdmin, notify } = useApp();
  const { data, error, reload } = useApi<Report[]>(city ? `/api/reports?city_id=${city.id}` : null);
  const options = useApi<ReportOptions>("/api/report-options");
  const [pin, setPin] = useState<[number, number] | null>(null);
  const [filter, setFilter] = useState<Filter>(isAdmin ? "pending" : "all");
  const [selected, setSelected] = useState<number | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  const center = useMemo<[number, number]>(() => [city!.lon, city!.lat], [city]);
  const shown = useMemo(() => (data ?? []).filter((r) => filter === "all" || r.status === filter), [data, filter]);
  const points = useMemo<MapPoint[]>(
    () =>
      shown.map((r) => ({
        id: r.id,
        name: `#${r.id} ${r.category}`,
        lat: r.lat,
        lon: r.lon,
        color: STATUS_COLOR[r.status],
        label: `${capitalize(r.severity)} · ${capitalize(r.status)}`,
        ring: r.id === selected,
      })),
    [shown, selected],
  );

  // Clicking a point on the map brings its card into view.
  useEffect(() => {
    if (selected) document.getElementById(`report-${selected}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  const review = async (report: Report, status: "verified" | "rejected") => {
    try {
      await api(`/api/reports/${report.id}`, { method: "PATCH", body: { status } });
      reload();
    } catch (err) {
      notify((err as Error).message, "error");
    }
  };

  const recheck = async (report: Report) => {
    try {
      await api(`/api/reports/${report.id}/recheck`, { method: "POST" });
      reload();
    } catch (err) {
      notify((err as Error).message, "error");
    }
  };

  const count = (f: Filter) => (data ?? []).filter((r) => f === "all" || r.status === f).length;

  return (
    <div>
      <PageTitle
        title={isAdmin ? "Citizen Reports" : "Report an Issue"}
        subtitle={
          isAdmin
            ? "Each report's photos are screened automatically; you make the final call. A verified report raises the risk score of assets within 400 m."
            : "Tell the city about damage you can see. Click the map to mark the spot, add a photo and send."
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <div className="card self-start p-2 xl:sticky xl:top-0">
          <RiskMap
            center={center}
            points={points}
            pin={pin}
            onSelect={setSelected}
            onMapClick={isAdmin ? undefined : (lat, lon) => setPin([lon, lat])}
            className="h-[calc(100vh-230px)] min-h-[420px]"
          />
        </div>

        <div className="space-y-5">
          {!isAdmin && (
            <Card title="New report">
              {options.error && <ErrorNote message={options.error} onRetry={options.reload} />}
              {!options.data && !options.error && <Skeleton className="h-80" />}
              {options.data && <ReportForm options={options.data} pin={pin} onPin={setPin} onSubmitted={reload} />}
            </Card>
          )}

          <Card title={isAdmin ? "Review queue" : "My reports"}>
            {isAdmin && (
              <div className="mb-4 flex rounded-xl border border-line bg-panel-2 p-0.5 text-xs" role="group" aria-label="Filter reports">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    aria-pressed={filter === f}
                    className={`flex-1 rounded-lg py-1.5 font-medium transition-colors ${
                      filter === f ? "bg-accent text-white" : "text-muted hover:text-ink"
                    }`}
                  >
                    {capitalize(f)} {count(f)}
                  </button>
                ))}
              </div>
            )}
            {error && <ErrorNote message={error} onRetry={reload} />}
            {!data && !error && <Skeleton className="h-32" />}
            {data && shown.length === 0 && (
              <Empty>
                {!isAdmin
                  ? "You have not sent any reports yet."
                  : filter === "pending"
                    ? "Nothing is waiting for review."
                    : `No ${filter === "all" ? "" : filter + " "}reports for ${city!.name}.`}
              </Empty>
            )}
            <ul className="space-y-3">
              {shown.map((r) => (
                <ReportCard
                  key={r.id}
                  report={r}
                  selected={r.id === selected}
                  onSelect={() => setSelected(r.id)}
                  onOpenPhoto={setPhoto}
                  onReview={isAdmin ? (status) => review(r, status) : undefined}
                  onRecheck={isAdmin ? () => recheck(r) : undefined}
                />
              ))}
            </ul>
          </Card>
        </div>
      </div>
      {photo && <Lightbox src={photo} onClose={() => setPhoto(null)} />}
    </div>
  );
}
