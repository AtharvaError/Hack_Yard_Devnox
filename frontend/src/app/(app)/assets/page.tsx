"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AdminOnly } from "@/components/AdminOnly";
import { AssetDetailPanel } from "@/components/AssetDetailPanel";
import { Card, Empty, ErrorNote, LevelBadge, PageTitle, ScoreBar, Skeleton } from "@/components/ui";
import type { AssetType, Overview } from "@/lib/api";
import { HAZARD_LABEL, TYPE_LABEL, TYPE_SINGULAR } from "@/lib/labels";
import { useApi, useApp } from "@/lib/store";

function AssetsView() {
  const { city, riskQuery } = useApp();
  const { data, error, reload } = useApi<Overview>(city ? `/api/cities/${city.id}/overview?${riskQuery}` : null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<AssetType | "all">("all");
  const [selected, setSelected] = useState<number | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.assets ?? [])
      .filter((a) => (type === "all" || a.type === type) && (!q || a.name.toLowerCase().includes(q)))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }, [data, query, type]);
  const types = useMemo(() => [...new Set(data?.assets.map((a) => a.type) ?? [])], [data]);

  return (
    <div>
      <PageTitle title="Assets" subtitle="Every monitored asset, ranked by risk. Click a row to see why it scored that way." />
      {error && <ErrorNote message={error} onRetry={reload} />}
      <div className={`grid gap-5 ${selected ? "xl:grid-cols-[1fr_340px]" : ""}`}>
        <Card>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative min-w-52 flex-1">
              <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
              <input className="input !pl-9" placeholder="Filter by name…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Filter by name" />
            </div>
            <select className="input !w-auto" value={type} onChange={(e) => setType(e.target.value as AssetType | "all")} aria-label="Filter by type">
              <option value="all">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>{TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>
          {!data ? (
            <Skeleton className="h-96" />
          ) : rows.length === 0 ? (
            <Empty>No assets match this filter.</Empty>
          ) : (
            <div className="max-h-[calc(100vh-320px)] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-panel text-xs text-muted">
                  <tr>
                    <th className="pb-2 font-medium">Asset</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Main hazard</th>
                    <th className="pb-2 font-medium">Risk</th>
                    <th className="pb-2 font-medium">Level</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr
                      key={a.id}
                      onClick={() => setSelected(a.id)}
                      className={`cursor-pointer border-t border-line transition-colors hover:bg-panel-2 ${selected === a.id ? "bg-accent/10" : ""}`}
                    >
                      <td className="max-w-[260px] truncate py-2.5 pr-3">{a.name}</td>
                      <td className="py-2.5 pr-3 text-muted">{TYPE_SINGULAR[a.type]}</td>
                      <td className="py-2.5 pr-3 text-muted">{a.dominant ? HAZARD_LABEL[a.dominant] : "None"}</td>
                      <td className="py-2.5 pr-3"><ScoreBar score={a.score ?? 0} level={a.level} /></td>
                      <td className="py-2.5"><LevelBadge level={a.level} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        {selected && <AssetDetailPanel assetId={selected} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}

export default function AssetsPage() {
  return (
    <AdminOnly>
      <AssetsView />
    </AdminOnly>
  );
}
