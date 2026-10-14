import type { AssetType, Hazard, Level } from "./api";

export const LEVEL_COLOR: Record<Level, string> = {
  low: "#2bff9e",
  safe: "#2bff9e",
  moderate: "#ffd60a",
  caution: "#ffd60a",
  high: "#ff8f1f",
  critical: "#ff3b6b",
  danger: "#ff3b6b",
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
  flood: "#3ea8ff",
  heat: "#ff4fd8",
  landslide: "#b06bff",
  wind: "#22f0d0",
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

/** Opens WhatsApp with the alert ready to send to a contact or group. Free, and uses the sender's own account. */
export function whatsappLink(alert: { title: string; message: string }, cityName: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${alert.title} (${cityName})\n${alert.message}\nSent through InfraSentinel`)}`;
}
