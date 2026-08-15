/**
 * FireWatch domain types.
 *
 * These mirror the shape the prediction backend will eventually serve over its
 * API. The frontend currently reads from `src/data/mock.ts` through the service
 * layer in `src/lib/api.ts` — swapping that layer to `fetch()` calls is the
 * only change needed when the real backend goes live.
 */

/** Geographic point as [latitude, longitude]. */
export type LatLng = [number, number];

export type IncidentStatus = "active" | "contained" | "watch";

export type RiskLevel = "low" | "moderate" | "high" | "extreme" | "catastrophic";

export type RouteStatus = "open" | "recommended" | "caution" | "closed";

export type ShelterStatus = "open" | "at-capacity" | "closing";

export type AlertSeverity = "critical" | "warning" | "advisory";

export interface RiskZone {
  id: string;
  level: RiskLevel;
  polygon: LatLng[];
  label?: string;
}

export interface Weather {
  tempC: number;
  humidityPct: number;
  windSpeedKmh: number;
  windGustKmh?: number;
  /** Wind direction the wind blows FROM, in degrees (meteorological). */
  windDirectionDeg: number;
  conditions: string;
  smokeAdvisory?: string;
}

export interface EvacuationRoute {
  id: string;
  name: string;
  description: string;
  communities: string[];
  path: LatLng[];
  distanceKm: number;
  etaMin: number;
  /** Route status at each forecast step (index-aligned with `forecast`). */
  statusByStep: RouteStatus[];
  note?: string;
}

export interface Shelter {
  id: string;
  name: string;
  type: "Red Cross shelter" | "Evacuation center" | "Cooling center";
  location: LatLng;
  capacity: number;
  occupied: number;
  status: ShelterStatus;
  address: string;
}

export interface FireStats {
  acresBurned: number;
  containmentPct: number;
  personnel: number;
  engines: number;
  aircraft: number;
  structuresThreatened: number;
  /** Minutes since the last satellite thermal pass was processed. */
  lastSatellitePassMin: number;
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  source: string;
  /** Minutes since the alert was issued. */
  ageMin: number;
}

export interface ForecastStep {
  /** "Now", "+6h", "+12h", "+24h" — the slider/tab position on the map. */
  label: string;
  /** Hours from "now" this step represents. */
  hoursFromNow: number;
  riskZones: RiskZone[];
  weather: Weather;
  spreadKmh: number;
  riskLevel: RiskLevel;
  riskNote: string;
}

export interface FireIncident {
  id: string;
  name: string;
  status: IncidentStatus;
  county: string;
  region: string;
  reportedAt: string; // ISO date
  locationLabel: string;
  description: string;
  /** Current fire perimeter polygon. */
  perimeter: LatLng[];
  /** Point where the fire front is most active (for the pulsing marker). */
  fireFront: LatLng;
  forecast: ForecastStep[];
  routes: EvacuationRoute[];
  shelters: Shelter[];
  stats: FireStats;
  alerts: Alert[];
}
