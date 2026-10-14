"use client";

import { Megaphone, Share2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Card, Empty, ErrorNote, PageTitle, Skeleton } from "@/components/ui";
import { api, type Alert } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { capitalize, timeAgo, whatsappLink } from "@/lib/labels";
import { useApi, useApp } from "@/lib/store";

const SEVERITY_COLOR = { advisory: "var(--hz-flood)", warning: "var(--color-high)", emergency: "var(--color-critical)" };

export default function AlertsPage() {
  const { city, isAdmin, notify } = useApp();
  const { data, error, reload } = useApi<Alert[]>(city ? `/api/alerts?city_id=${city.id}` : null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<Alert["severity"]>("advisory");
  const [busy, setBusy] = useState(false);
  const t = useT();

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/alerts", { body: { city_id: city!.id, title, message, severity } });
      setTitle("");
      setMessage("");
      notify("Alert sent to everyone viewing this city.");
      reload();
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (alert: Alert) => {
    if (!window.confirm(`Delete the alert "${alert.title}"? This cannot be undone.`)) return;
    try {
      await api(`/api/alerts/${alert.id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      notify((err as Error).message, "error");
    }
  };

  return (
    <div>
      <PageTitle
        title="Alerts"
        subtitle={isAdmin ? `Send warnings to everyone viewing ${city!.name}.` : `Official warnings for ${city!.name}.`}
      />
      <div className={`grid gap-5 ${isAdmin ? "xl:grid-cols-[360px_1fr]" : ""}`}>
        {isAdmin && (
          <Card title="Send an alert">
            <form onSubmit={send} className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1.5 block text-muted">Title</span>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={200} />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-muted">Message</span>
                <textarea className="input min-h-28" value={message} onChange={(e) => setMessage(e.target.value)} required minLength={3} />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-muted">Severity</span>
                <select className="input" value={severity} onChange={(e) => setSeverity(e.target.value as Alert["severity"])}>
                  <option value="advisory">Advisory</option>
                  <option value="warning">Warning</option>
                  <option value="emergency">Emergency</option>
                </select>
              </label>
              <button className="btn w-full" disabled={busy}>
                <Megaphone size={15} /> Send alert
              </button>
            </form>
          </Card>
        )}

        <Card title="Active alerts">
          {error && <ErrorNote message={error} onRetry={reload} />}
          {!data && !error && <Skeleton className="h-40" />}
          {data?.length === 0 && <Empty>No active alerts for {city!.name}.</Empty>}
          <ul className="space-y-3">
            {data?.map((a) => (
              <li key={a.id} className="flex gap-3 rounded-xl bg-panel-2 p-4" style={{ borderLeft: `3px solid ${SEVERITY_COLOR[a.severity]}` }}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.title}</span>
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ color: SEVERITY_COLOR[a.severity], background: `color-mix(in srgb, ${SEVERITY_COLOR[a.severity]} 13%, transparent)` }}>
                      {capitalize(a.severity)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-muted">{a.message}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-4 text-xs text-muted">
                    {timeAgo(a.created_at)}
                    <a href={whatsappLink(a, city!.name)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-low hover:underline">
                      <Share2 size={13} /> {t("share")}
                    </a>
                  </p>
                </div>
                {isAdmin && (
                  <button onClick={() => remove(a)} aria-label={`Delete alert ${a.title}`} className="self-start text-muted hover:text-critical">
                    <Trash2 size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
