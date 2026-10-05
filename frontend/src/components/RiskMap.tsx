"use client";

import dynamic from "next/dynamic";
import type { Asset } from "@/lib/api";
import { LEVEL_COLOR, TYPE_SINGULAR, capitalize } from "@/lib/labels";
import type { MapPoint } from "./RiskMapInner";

// MapLibre needs the browser, so the map is never rendered on the server.
export const RiskMap = dynamic(() => import("./RiskMapInner"), {
  ssr: false,
  loading: () => <div className="skeleton h-[520px] w-full" />,
});

export type { MapPoint };

export function assetPoint(asset: Asset, selected = false): MapPoint {
  const score = asset.score !== undefined ? ` · ${Math.round(asset.score)}/100` : "";
  return {
    id: asset.id,
    name: asset.name,
    lat: asset.lat,
    lon: asset.lon,
    color: LEVEL_COLOR[asset.level],
    label: `${TYPE_SINGULAR[asset.type]} · ${capitalize(asset.level)}${score}`,
    ring: selected,
  };
}

export function Legend({ levels }: { levels: (keyof typeof LEVEL_COLOR)[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {levels.map((level) => (
        <span key={level} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: LEVEL_COLOR[level] }} />
          {capitalize(level)}
        </span>
      ))}
    </div>
  );
}
