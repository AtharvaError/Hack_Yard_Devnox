"use client";

import { Check, LocateFixed, Send, X } from "lucide-react";
import { useMemo, useState } from "react";
import { RiskMap, type MapPoint } from "@/components/RiskMap";
import { Card, Empty, ErrorNote, PageTitle, Skeleton } from "@/components/ui";
import { api, type Report } from "@/lib/api";
import { capitalize, timeAgo } from "@/lib/labels";
import { useApi, useApp } from "@/lib/store";

const STATUS_COLOR = { pending: "#fbbf24", verified: "#34d399", rejected: "#8b8fa8" };

export default function ReportsPage() {
  const { city, isAdmin, notify } = useApp();
  const { data, error, reload } = useApi<Report[]>(city ? `/api/reports?city_id=${city.id}` : null);
  const categories = useApi<string[]>("/api/report-categories");
  const [category, setCategory] = useState("Flooded road");
  const [description, setDescription] = useState("");
  const [pin, setPin] = useState<[number, number] | null>(null);
  const [busy, setBusy] = useState(false);

  const center = useMemo<[number, number]>(() => [city!.lon, city!.lat], [city]);
  const points = useMemo<MapPoint[]>(
    () =>
      (data ?? []).map((r) => ({
        id: r.id,
        name: r.category,
        lat: r.lat,
        lon: r.lon,
        color: STATUS_COLOR[r.status],
        label: `${capitalize(r.status)} · ${r.description.slice(0, 60)}`,
      })),
    [data],
  );

  const locate = () => {
    if (!navigator.geolocation) return notify("Your browser does not share location. Click the map instead.", "error");
    navigator.geolocation.getCurrentPosition(
      (pos) => setPin([pos.coords.longitude, pos.coords.latitude]),
      () => notify("Could not get your location. Click the map instead.", "error"),
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return notify("Click the map to mark where the problem is.", "error");
    setBusy(true);
    try {
      await api("/api/reports", { body: { city_id: city!.id, category, description, lat: pin[1], lon: pin[0] } });
      setDescription("");
      setPin(null);
      notify("Report submitted. An administrator will review it.");
      reload();
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const review = async (report: Report, status: Report["status"]) => {
    try {
      await api(`/api/reports/${report.id}`, { method: "PATCH", body: { status } });
      reload();
    } catch (err) {
      notify((err as Error).message, "error");
    }
  };

  return (
    <div>
      <PageTitle
        title={isAdmin ? "Citizen Reports" : "Report an Issue"}
        subtitle={
          isAdmin
            ? "Verify reports from the public. A verified report raises the risk score of assets within 400 m."
            : "Tell the city about flooding, damage or outages you can see. Click the map to mark the spot."
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="card p-2">
          <RiskMap
            center={center}
            points={points}
            pin={pin}
            onMapClick={isAdmin ? undefined : (lat, lon) => setPin([lon, lat])}
            className="h-[calc(100vh-230px)] min-h-[420px]"
          />
        </div>

        <div className="space-y-5">
          {!isAdmin && (
            <Card title="New report">
              <form onSubmit={submit} className="space-y-3">
                <label className="block text-sm">
                  <span className="mb-1.5 block text-muted">What is the problem?</span>
                  <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                    {(categories.data ?? [category]).map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-muted">Describe what you see</span>
                  <textarea className="input min-h-24" value={description} onChange={(e) => setDescription(e.target.value)} required minLength={5} />
                </label>
                <div className="flex items-center justify-between gap-2 text-xs text-muted">
                  <span>{pin ? `Location set: ${pin[1].toFixed(4)}, ${pin[0].toFixed(4)}` : "No location yet. Click the map."}</span>
                  <button type="button" onClick={locate} className="flex shrink-0 items-center gap-1 text-accent hover:underline">
                    <LocateFixed size={13} /> Use my location
                  </button>
                </div>
                <button className="btn w-full" disabled={busy}>
                  <Send size={15} /> Submit report
                </button>
              </form>
            </Card>
          )}

          <Card title={isAdmin ? "All reports" : "My reports"}>
            {error && <ErrorNote message={error} onRetry={reload} />}
            {!data && !error && <Skeleton className="h-32" />}
            {data?.length === 0 && <Empty>{isAdmin ? "No reports have been submitted yet." : "You have not submitted any reports."}</Empty>}
            <ul className="max-h-[50vh] space-y-3 overflow-auto pr-1">
              {data?.map((r) => (
                <li key={r.id} className="rounded-xl bg-panel-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{r.category}</span>
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ color: STATUS_COLOR[r.status], background: `${STATUS_COLOR[r.status]}22` }}>
                      {capitalize(r.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{r.description}</p>
                  <p className="mt-1.5 text-xs text-muted">
                    {isAdmin ? `${r.user_email} · ` : ""}
                    {timeAgo(r.created_at)}
                  </p>
                  {isAdmin && r.status === "pending" && (
                    <div className="mt-3 flex gap-2">
                      <button className="btn flex-1 !py-1.5" onClick={() => review(r, "verified")}>
                        <Check size={14} /> Verify
                      </button>
                      <button className="btn btn-ghost flex-1 !py-1.5" onClick={() => review(r, "rejected")}>
                        <X size={14} /> Reject
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
