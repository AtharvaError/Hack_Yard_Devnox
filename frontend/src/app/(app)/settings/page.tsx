"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { AdminOnly } from "@/components/AdminOnly";
import { Card, Empty, ErrorNote, PageTitle, Skeleton, Stat } from "@/components/ui";
import { api, type City } from "@/lib/api";
import { timeAgo } from "@/lib/labels";
import { useApi, useApp } from "@/lib/store";

type Sources = {
  refresh_minutes: number;
  radius_km: number;
  ai_brief: string;
  photo_check: string;
  sources: { name: string; use: string }[];
};
type AuditRow = { id: number; actor: string; action: string; detail: string; at: string };

function SettingsView() {
  const { city, selectCity, notify } = useApp();
  const sources = useApi<Sources>("/api/sources");
  const audit = useApi<AuditRow[]>("/api/audit");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    try {
      selectCity(await api<City>(`/api/cities/${city!.id}/refresh`, { method: "POST" }));
      notify("Forecast refreshed. All scores are up to date.");
      audit.reload();
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageTitle title="Settings" subtitle="Data sources, refresh schedule and a log of who did what." />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card
          title="Live data"
          action={
            <button className="btn" onClick={refresh} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh now
            </button>
          }
        >
          {sources.error && <ErrorNote message={sources.error} onRetry={sources.reload} />}
          {!sources.data && !sources.error && <Skeleton className="h-64" />}
          {sources.data && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Last forecast" value={<span className="text-lg">{timeAgo(city!.weather_at)}</span>} />
                <Stat label="Auto-refresh" value={<span className="text-lg">{sources.data.refresh_minutes} min</span>} />
                <Stat label="Area analysed" value={<span className="text-lg">{sources.data.radius_km} km</span>} hint="Around the centre" />
              </div>
              <table className="mt-5 w-full text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="pb-2 font-medium">Source</th>
                    <th className="pb-2 font-medium">Used for</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.data.sources.map((s) => (
                    <tr key={s.name} className="border-t border-line">
                      <td className="py-2.5 pr-3 font-medium">{s.name}</td>
                      <td className="py-2.5 text-muted">{s.use}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-line">
                    <td className="py-2.5 pr-3 font-medium">AI brief</td>
                    <td className="py-2.5 text-muted">{sources.data.ai_brief}</td>
                  </tr>
                  <tr className="border-t border-line">
                    <td className="py-2.5 pr-3 font-medium">Report photo check</td>
                    <td className="py-2.5 text-muted">{sources.data.photo_check}</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-3 text-xs text-muted">Every data source is free and needs no API key. The AI brief and the AI photo check are optional and use
                your own key.</p>
            </>
          )}
        </Card>

        <Card title="Activity log">
          {audit.error && <ErrorNote message={audit.error} onRetry={audit.reload} />}
          {!audit.data && !audit.error && <Skeleton className="h-64" />}
          {audit.data?.length === 0 && <Empty>No activity recorded yet.</Empty>}
          <ul className="max-h-[calc(100vh-280px)] space-y-2 overflow-auto pr-1">
            {audit.data?.map((row) => (
              <li key={row.id} className="flex items-baseline justify-between gap-3 border-b border-line pb-2 text-sm last:border-0">
                <span className="min-w-0 truncate">
                  <span className="font-medium">{row.action.replaceAll("_", " ")}</span>
                  {row.detail && <span className="text-muted"> · {row.detail}</span>}
                  <span className="text-muted"> · {row.actor}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">{timeAgo(row.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AdminOnly>
      <SettingsView />
    </AdminOnly>
  );
}
