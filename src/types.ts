/**
 * FireWatch domain types.
 *
 * `FireIncident` is the shape the frontend consumes — it mirrors what the
 * prediction backend will eventually serve over its API. Until then, the
 * service layer in `src/lib/api.ts` builds it from the raw `FireScenario`
 * records in `src/data/mock.ts` by running the spread simulation in
 * `src/lib/spread.ts` (weather, risk zones, route statuses). Swapping the
 * service layer to `fetch()` calls against the real backend is the only change
 * needed when it goes live.
 */

/** Geographic point as [latitude, longitude]. */
export type LatLng = [number, number];

export type IncidentStatus = "active" | "contained" | "watch";

export type RiskLevel = "low" | "moderate" | "high" | "extreme" | "catastrophic";

export type RouteStatus = "open" | "recommended" | "caution" | "closed";

/** How the wind is expected to trend over the forecast window. */
export type WindTrend = "strengthening" | "steady" | "weakening";

export type ShelterStatus = "open" | "at-capacity" | "closing";

export type AlertSeverity = "critical" | "warning" | "advisory";

/** Where an incident's hotspot layer came from. */
export type HotspotSource = "live" | "mock";

/** A single satellite fire detection (NASA FIRMS VIIRS / MODIS). */
export interface Hotspot {
  id: string;
  lat: number;
  lng: number;
  /** Fire Radiative Power in megawatts — an intensity proxy. */
  frp: number;
  confidence: "high" | "nominal" | "low";
  /** Detection time, e.g. "2026-08-15 14:25 UTC". */
  acquiredAt: string;
  /** Sensor, e.g. "VIIRS-NPP". */
  satellite: string;
}

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
  note?: string;
}

/** A route with its per-step status, filled in by the spread simulation. */
export type EvacuationRouteWithStatus = EvacuationRoute & {
  /** Route status at each forecast step (index-aligned with `forecast`). */
  statusByStep: RouteStatus[];
};

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
  routes: EvacuationRouteWithStatus[];
  shelters: Shelter[];
  stats: FireStats;
  alerts: Alert[];
  /** Active-fire detections from the satellite feed (live or simulated). */
  hotspots: Hotspot[];
  hotspotSource: HotspotSource;
}

/**
 * Raw incident record as authored in `src/data/mock.ts`.
 *
 * Holds the fire's current state plus the parameters the spread simulation
 * (`src/lib/spread.ts`) needs. `forecast` and per-route statuses are derived
 * from these, so the demo's predictions are produced by the model rather than
 * hand-written.
 */
export interface FireScenario
  extends Omit<FireIncident, "forecast" | "routes" | "hotspots" | "hotspotSource"> {
  /** Current conditions at the fire front (overridden by live data when available). */
  weather: Weather;
  /** How the wind is expected to trend over the forecast window. */
  windTrend: WindTrend;
  /** Baseline spread rate (km/h) before wind/humidity adjustments. */
  spreadBaseKmh: number;
  /** Forecast offsets in hours from now; defaults to [0, 6, 12, 24]. */
  forecastHours?: number[];
  routes: EvacuationRoute[];
}
