export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  // A FormData body (file uploads) is sent as-is so the browser sets the multipart boundary itself.
  const isForm = options.body instanceof FormData;
  const res = await fetch(path, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: options.body && !isForm ? { "Content-Type": "application/json" } : undefined,
    body: isForm ? (options.body as FormData) : options.body ? JSON.stringify(options.body) : undefined,
    credentials: "same-origin",
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data.detail === "string") message = data.detail;
      else if (Array.isArray(data.detail)) message = data.detail.map((d: { msg: string }) => d.msg).join(", ");
    } catch {
      if (res.status >= 500) message = "The server is not reachable. Is the backend running?";
    }
    throw new ApiError(res.status, message);
  }
  return res.json();
}

export type Role = "admin" | "user";
export type User = { id: number; email: string; name: string; role: Role };

export type City = {
  id: number;
  name: string;
  country: string;
  admin1: string;
  lat: number;
  lon: number;
  population: number;
  radius_km: number;
  weather_at: string | null;
  asset_count: number | null;
};

export type Place = { name: string; country: string; admin1: string; lat: number; lon: number; population: number };

export type Level = "low" | "moderate" | "high" | "critical" | "safe" | "caution" | "danger";
export type Hazard = "flood" | "heat" | "landslide" | "wind";
export type AssetType = "hospital" | "substation" | "power_plant" | "bridge" | "road" | "water" | "fire_station";

export type Factor = { hazard: Hazard | "reports"; points: number; why: string };

export type Asset = {
  id: number;
  name: string;
  type: AssetType;
  lat: number;
  lon: number;
  level: Level;
  // Admin-only detail below.
  score?: number;
  dominant?: Hazard | null;
  elevation?: number;
  slope_pct?: number;
  water_dist_m?: number | null;
  by_hazard?: Record<Hazard, number>;
  factors?: Factor[];
};

export type AssetLink = { id: number; name: string; type: AssetType; level: Level; kind: string };
export type AssetDetail = Required<Asset> & { relies_on: AssetLink[]; supports: AssetLink[]; people: number };

export type Weather = { rain24: number; antecedent: number; apparent_max: number; gust: number; river_ratio: number };

export type Overview = {
  city: City;
  horizon: number;
  scenario: string | null;
  score: number;
  level: Level;
  weather: Weather;
  hazard_split: Record<Hazard, number>;
  tiles: { type: AssetType; total: number; at_risk: number; percent: number }[];
  trend: { hour: number; score: number }[];
  counts: Record<string, number>;
  isolated_hospitals?: { id: number; name: string; routes: string[] }[];
  assets: Asset[];
};

export type Scenario = { id: string; name: string; description: string };

export type Impact = {
  id: number;
  name: string;
  type: AssetType;
  lat: number;
  lon: number;
  people: number;
  status: string;
  reason: string;
  wave: number;
};
export type CascadeResult = {
  impacted: Impact[];
  waves: number;
  links: { from: [number, number]; to: [number, number]; kind: string }[];
  summary: { total: number; knock_on: number; hospitals: number; people: number };
};

export type PlanAction = {
  asset_id: number;
  asset: string;
  type: AssetType;
  hazard: Hazard;
  score: number;
  level: Level;
  action: string;
  cost: number;
  crews: number;
  risk_after: number;
  dependents: number;
  people: number;
  rank?: number;
  deferred_because?: string;
};
export type Plan = {
  selected: PlanAction[];
  deferred: PlanAction[];
  totals: { cost: number; crews: number; actions: number; people: number; benefit_share: number };
};

export type Alert = {
  id: number;
  title: string;
  message: string;
  severity: "advisory" | "warning" | "emergency";
  created_by: string;
  created_at: string;
};

export type Severity = "minor" | "serious" | "dangerous";
export type CheckLabel = "pending" | "genuine" | "review" | "irrelevant" | "inappropriate" | "unchecked";

export type Report = {
  id: number;
  category: string;
  severity: Severity;
  description: string;
  address: string;
  lat: number;
  lon: number;
  status: "pending" | "verified" | "rejected";
  created_at: string;
  photos: { id: number; url: string }[];
  // Administrators only: who sent it and what the automatic photo check found.
  user_email?: string;
  check?: { label: CheckLabel; reason: string; confidence: number | null; source: string };
  flags?: { code: string; text: string }[];
};

export type ReportOptions = {
  damage_types: string[];
  severities: Severity[];
  max_photos: number;
  photo_check: { enabled: boolean; name: string | null };
};

export type RouteResult = {
  hospital: { id: number; name: string; lat: number; lon: number };
  hospital_status: string;
  skipped_nearest: string | null;
  alternatives_checked: number;
  geometry: { type: "LineString"; coordinates: [number, number][] };
  distance_km: number;
  minutes: number;
  hazards: { id: number; name: string; type: AssetType; level: Level }[];
};
