import type { AssetType, Hazard, Level } from "./api";

export const LEVEL_COLOR: Record<Level, string> = {
  low: "#34d399",
  safe: "#34d399",
  moderate: "#fbbf24",
  caution: "#fbbf24",
  high: "#fb923c",
  critical: "#f43f5e",
  danger: "#f43f5e",
};

export const TYPE_LABEL: Record<AssetType, string> = {
  hospital: "Hospitals",
  substation: "Substations",
  power_plant: "Power plants",
  bridge: "Bridges",
  road: "Roads",
  water: "Water facilities",
  fire_station: "Fire stations",
};

export const TYPE_SINGULAR: Record<AssetType, string> = {
  hospital: "Hospital",
  substation: "Substation",
  power_plant: "Power plant",
  bridge: "Bridge",
  road: "Road",
  water: "Water facility",
  fire_station: "Fire station",
};

export const HAZARD_LABEL: Record<Hazard | "reports", string> = {
  flood: "Flood",
  heat: "Heat",
  landslide: "Landslide",
  wind: "Wind",
  reports: "Citizen reports",
};

export const HAZARD_COLOR: Record<Hazard, string> = {
  flood: "#60a5fa",
  heat: "#f472b6",
  landslide: "#a855f7",
  wind: "#2dd4bf",
};

export const HORIZONS = [
  { value: 0, label: "Now" },
  { value: 24, label: "+24h" },
  { value: 48, label: "+48h" },
  { value: 72, label: "+72h" },
];

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

export function formatPeople(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}
