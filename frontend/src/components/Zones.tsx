"use client";

import type { Zone } from "@/lib/api";
import { LEVEL_COLOR } from "@/lib/labels";
import { useApi, useApp } from "@/lib/store";
import { ErrorNote, Skeleton } from "./ui";

/** Three-by-three grid of the analysed area. These are compass zones, not official wards. */
export function ZoneGrid() {
  const { city, riskQuery } = useApp();
  const { data, error, reload } = useApi<Zone[]>(city ? `/api/cities/${city.id}/zones?${riskQuery}` : null);

  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-44" />;
  return (
    <>
      <div className="grid grid-cols-3 gap-1.5">
        {data.map((zone) => {
          const color = zone.assets ? LEVEL_COLOR[zone.level] : "#1e2445";
          return (
            <div
              key={zone.name}
              className="rounded-lg border p-2 text-center"
              style={{ borderColor: `${color}88`, background: `${color}1c` }}
              title={zone.assets ? `${zone.at_risk} of ${zone.assets} assets at high or critical risk` : "No monitored assets here"}
            >
              <div className="truncate text-[11px] text-muted">{zone.name}</div>
              <div className="text-base font-semibold tabular-nums" style={{ color: zone.assets ? color : undefined }}>
                {zone.assets ? `${zone.at_risk} / ${zone.assets}` : "–"}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted">Assets at high or critical risk out of those monitored. Compass zones, not official wards.</p>
    </>
  );
}
