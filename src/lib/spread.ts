import type {
  FireScenario,
  ForecastStep,
  LatLng,
  RiskLevel,
  RouteStatus,
  Weather,
} from "@/types";
import { RISK_ORDER } from "./status";
import { windCardinal } from "./format";
import type { LiveWeather } from "./weather";

/**
 * Fire-spread simulation.
 *
 * This is the demo's stand-in for the prediction backend: it takes a fire's
 * current perimeter, weather, and wind trend, then projects how the burn will
 * grow over the next 24 hours and what that means for evacuation routes.
 *
 * The model is intentionally simple — a wind-biased perimeter expansion whose
 * rate scales with wind speed and falls with humidity — but it is real,
 * deterministic code doing real prediction from real inputs (live weather when
 * available). The route statuses (open / recommended / caution / closed) are
 * derived by checking each corridor against the projected burn.
 */

const KM_PER_DEG = 111;
const DEFAULT_HOURS = [0, 6, 12, 24];
/** Average perimeter advance as a fraction of the head rate of spread. */
const HEAD_TO_AVERAGE = 0.22;
/** Fraction of the spread rate the fire backs upwind at. */
const BACKING_FRACTION = 0.12;
/** First stretch of each corridor (km, from the evacuation zone) is treated as
 *  in-town — it's where evacuees start, so it isn't counted as a closure. */
const IN_TOWN_KM = 1.0;

const CARDINAL_WORDS: Record<string, string> = {
  N: "north",
  NE: "northeast",
  E: "east",
  SE: "southeast",
  S: "south",
  SW: "southwest",
  W: "west",
  NW: "northwest",
};

/** Projected helper: [x = east km, y = north km] around a reference latitude. */
function project(lat: number, lng: number, cosLat: number): [number, number] {
  return [lng * cosLat * KM_PER_DEG, lat * KM_PER_DEG];
}

function meanLat(points: LatLng[]): number {
  return points.reduce((sum, p) => sum + p[0], 0) / Math.max(1, points.length);
}

function effectiveSpread(
  baseKmh: number,
  windSpeedKmh: number,
  humidityPct: number,
): number {
  const windFactor = 0.6 + windSpeedKmh / 45;
  const humidityFactor =
    humidityPct < 10 ? 1.35 : humidityPct < 20 ? 1.2 : humidityPct < 30 ? 1.05 : 0.85;
  return baseKmh * windFactor * humidityFactor;
}

function spreadToRisk(spreadKmh: number): RiskLevel {
  if (spreadKmh >= 3) return "catastrophic";
  if (spreadKmh >= 1.8) return "extreme";
  if (spreadKmh >= 0.9) return "high";
  if (spreadKmh >= 0.15) return "moderate";
  return "low";
}

/** The risk level one step down the ladder (used for the outer warning zones). */
function lowerRisk(level: RiskLevel): RiskLevel {
  return RISK_ORDER[Math.max(0, RISK_ORDER.indexOf(level) - 1)];
}

/**
 * Grow a polygon outward, stretching it downwind. `growthKm` is the average
 * expansion; the lee side (aligned with the wind) stretches further, which is
 * what makes the projected burn take its characteristic elongated shape.
 */
function growPolygon(
  polygon: LatLng[],
  growthKm: number,
  windFromDeg: number,
  windSpeedKmh: number,
  midLat: number,
): LatLng[] {
  const midLatRad = (midLat * Math.PI) / 180;
  const cosLat = Math.cos(midLatRad);
  const pts = polygon.map(([lat, lng]) => project(lat, lng, cosLat));
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  // Wind blows toward (from + 180°). [x = east, y = north] unit vector.
  const downRad = ((windFromDeg + 180) * Math.PI) / 180;
  const wX = Math.sin(downRad);
  const wY = Math.cos(downRad);
  const elong = 1 + windSpeedKmh / 80;

  return polygon.map(([lat, lng], i) => {
    const [px, py] = pts[i];
    const vx = px - cx;
    const vy = py - cy;
    const len = Math.hypot(vx, vy) || 1e-6;
    const nx = vx / len;
    const ny = vy / len;
    // The head races downwind while the flanks creep and the backing edge
    // barely moves — scale each vertex's advance by how aligned it is with
    // the wind, then add pure downwind stretch on the lee side.
    const align = Math.max(0, nx * wX + ny * wY);
    const radial = growthKm * (BACKING_FRACTION + (1 - BACKING_FRACTION) * align);
    let x = px + nx * radial;
    let y = py + ny * radial;
    const stretch = growthKm * (elong - 1) * align;
    x += wX * stretch;
    y += wY * stretch;
    return [y / KM_PER_DEG, x / (cosLat * KM_PER_DEG)] as LatLng;
  });
}

function conditionsForTrend(
  trend: FireScenario["windTrend"],
  windSpeedKmh: number,
  humidityPct: number,
): string {
  const gusty = windSpeedKmh >= 24 ? "gusty " : "";
  if (trend === "strengthening") return `Dry, ${gusty}winds strengthening`;
  if (trend === "weakening") return "Conditions easing";
  return `Dry ${gusty}winds`;
}

/** Fallback weather evolution when live data isn't available. */
function evolveWeather(
  base: Weather,
  trend: FireScenario["windTrend"],
  stepIndex: number,
): Weather {
  if (stepIndex === 0) return base;
  const t = stepIndex;
  let windSpeedKmh = base.windSpeedKmh;
  let windGustKmh = base.windGustKmh;
  let humidityPct = base.humidityPct;
  let tempC = base.tempC;
  if (trend === "strengthening") {
    windSpeedKmh = Math.round(base.windSpeedKmh * (1 + 0.14 * t));
    windGustKmh = base.windGustKmh
      ? Math.round(base.windGustKmh * (1 + 0.16 * t))
      : undefined;
    humidityPct = Math.max(5, Math.round(base.humidityPct - 1.5 * t));
    tempC = Math.round(base.tempC + 0.8 * t);
  } else if (trend === "weakening") {
    windSpeedKmh = Math.max(4, Math.round(base.windSpeedKmh * (1 - 0.12 * t)));
    windGustKmh = base.windGustKmh
      ? Math.max(6, Math.round(base.windGustKmh * (1 - 0.12 * t)))
      : undefined;
    humidityPct = Math.min(60, Math.round(base.humidityPct + 2.5 * t));
    tempC = Math.round(base.tempC - 1.2 * t);
  } else {
    windSpeedKmh = Math.round(base.windSpeedKmh * (1 + 0.03 * t));
    windGustKmh = base.windGustKmh
      ? Math.round(base.windGustKmh * (1 + 0.03 * t))
      : undefined;
    humidityPct = Math.round(base.humidityPct - 0.5 * t);
    tempC = Math.round(base.tempC + 0.4 * t);
  }
  return {
    tempC,
    humidityPct,
    windSpeedKmh,
    windGustKmh,
    windDirectionDeg: base.windDirectionDeg,
    conditions: conditionsForTrend(trend, windSpeedKmh, humidityPct),
  };
}

function weatherAt(
  scenario: FireScenario,
  live: LiveWeather | null,
  hoursFromNow: number,
  stepIndex: number,
): Weather {
  // Anchor the model in the live reading at the fire front when available;
  // future steps are the model's own projection (wind trend × humidity), not
  // a copy of a third-party forecast — that's the "prediction" the demo shows.
  const base = live?.now ?? scenario.weather;
  if (hoursFromNow === 0) return base;
  return evolveWeather(base, scenario.windTrend, stepIndex);
}

function riskNoteFor(
  hoursFromNow: number,
  spreadKmh: number,
  weather: Weather,
  directionWord: string,
): string {
  if (hoursFromNow === 0) {
    return `Front active — spreading ${directionWord} at ${spreadKmh} km/h under ${weather.windSpeedKmh} km/h winds.`;
  }
  return `Model projects the front advancing ${directionWord} within ${hoursFromNow} hours at ${spreadKmh} km/h as winds reach ${weather.windSpeedKmh} km/h.`;
}

/** Build the full forecast for a scenario: weather, spread, and risk zones. */
export function buildForecast(
  scenario: FireScenario,
  live: LiveWeather | null,
): ForecastStep[] {
  const midLat = meanLat(scenario.perimeter);
  const hours = scenario.forecastHours ?? DEFAULT_HOURS;

  return hours.map((hoursFromNow, stepIndex) => {
    const weather = weatherAt(scenario, live, hoursFromNow, stepIndex);
    const spreadKmh =
      Math.round(
        effectiveSpread(scenario.spreadBaseKmh, weather.windSpeedKmh, weather.humidityPct) * 10,
      ) / 10;
    const riskLevel = spreadToRisk(spreadKmh);
    const downwindDeg = (weather.windDirectionDeg + 180) % 360;
    const directionWord =
      CARDINAL_WORDS[windCardinal(downwindDeg)] ?? "downwind";

    const growthKm = spreadKmh * hoursFromNow * HEAD_TO_AVERAGE;
    const burn = growPolygon(
      scenario.perimeter,
      growthKm,
      weather.windDirectionDeg,
      weather.windSpeedKmh,
      midLat,
    );
    const outer1 = lowerRisk(riskLevel);
    const outer2 = lowerRisk(outer1);

    const riskZones = [
      {
        id: `${scenario.id}-${stepIndex}-burn`,
        level: riskLevel,
        polygon: burn,
        label: "Active burn",
      },
      {
        id: `${scenario.id}-${stepIndex}-outer1`,
        level: outer1,
        polygon: growPolygon(
          scenario.perimeter,
          growthKm + 1.0,
          weather.windDirectionDeg,
          weather.windSpeedKmh,
          midLat,
        ),
      },
      ...(outer2 !== outer1
        ? [
            {
              id: `${scenario.id}-${stepIndex}-outer2`,
              level: outer2,
              polygon: growPolygon(
                scenario.perimeter,
                growthKm + 2.3,
                weather.windDirectionDeg,
                weather.windSpeedKmh,
                midLat,
              ),
            },
          ]
        : []),
    ];

    return {
      label: hoursFromNow === 0 ? "Now" : `In ${hoursFromNow} hours`,
      hoursFromNow,
      riskLevel,
      riskNote: riskNoteFor(hoursFromNow, spreadKmh, weather, directionWord),
      spreadKmh,
      weather,
      riskZones,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Route statuses — derived by checking corridors against the burn.    */
/* ------------------------------------------------------------------ */

function pointInPolygon(lat: number, lng: number, polygon: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (
      yi > lng !== yj > lng &&
      lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Sample a route path as points with their cumulative distance (km) along
 * the corridor, and drop the in-town section near the evacuation zone.
 */
function corridorSamples(
  path: LatLng[],
  cosLat: number,
): { lat: number; lng: number }[] {
  const out: { lat: number; lng: number }[] = [];
  let cumKm = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const [lat1, lng1] = path[i];
    const [lat2, lng2] = path[i + 1];
    const [x1, y1] = project(lat1, lng1, cosLat);
    const [x2, y2] = project(lat2, lng2, cosLat);
    const segKm = Math.hypot(x2 - x1, y2 - y1);
    const midKm = cumKm + segKm / 2;
    if (cumKm >= IN_TOWN_KM) out.push({ lat: lat1, lng: lng1 });
    if (midKm >= IN_TOWN_KM) out.push({ lat: (lat1 + lat2) / 2, lng: (lng1 + lng2) / 2 });
    cumKm += segKm;
  }
  const last = path[path.length - 1];
  if (cumKm >= IN_TOWN_KM) out.push({ lat: last[0], lng: last[1] });
  return out;
}

/** Minimum distance (km) from the corridor (beyond the in-town section) to the burn. */
function corridorMinDistanceKm(
  path: LatLng[],
  polygon: LatLng[],
  midLat: number,
): number {
  const midLatRad = (midLat * Math.PI) / 180;
  const cosLat = Math.cos(midLatRad);
  const segs: [number, number, number, number][] = [];
  for (let i = 0; i < polygon.length - 1; i++) {
    const [a1, a2] = project(polygon[i][0], polygon[i][1], cosLat);
    const [b1, b2] = project(polygon[i + 1][0], polygon[i + 1][1], cosLat);
    segs.push([a1, a2, b1, b2]);
  }
  const samples = corridorSamples(path, cosLat);
  if (samples.length === 0) return Infinity;
  let best = Infinity;
  for (const { lat, lng } of samples) {
    const [px, py] = project(lat, lng, cosLat);
    for (const [ax, ay, bx, by] of segs) {
      const dx = bx - ax;
      const dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d < best) best = d;
    }
  }
  return best;
}

/** Compute each route's status at each forecast step (open / caution / closed). */
export function buildRouteStatuses(
  scenario: FireScenario,
  forecast: ForecastStep[],
): RouteStatus[][] {
  const midLat = meanLat(scenario.perimeter);
  const cosLat = Math.cos((midLat * Math.PI) / 180);
  return scenario.routes.map((route) => {
    const samples = corridorSamples(route.path, cosLat);
    return forecast.map((step) => {
      const burn = step.riskZones[0].polygon;
      const high = step.riskZones[1]?.polygon ?? burn;
      if (samples.some((p) => pointInPolygon(p.lat, p.lng, burn))) {
        return "closed";
      }
      if (
        samples.some((p) => pointInPolygon(p.lat, p.lng, high)) ||
        corridorMinDistanceKm(route.path, burn, midLat) < 0.45
      ) {
        return "caution";
      }
      return "open";
    });
  });
}

/**
 * Mark exactly one route "recommended" per step: the open corridor that stays
 * furthest from the projected burn (ties broken by fastest ETA).
 */
export function assignRecommended(
  statuses: RouteStatus[][],
  forecast: ForecastStep[],
  scenario: FireScenario,
): RouteStatus[][] {
  const midLat = meanLat(scenario.perimeter);
  for (let step = 0; step < forecast.length; step++) {
    const burn = forecast[step].riskZones[0].polygon;
    const open = scenario.routes
      .map((route, i) => ({
        i,
        dist: corridorMinDistanceKm(route.path, burn, midLat),
      }))
      .filter((c) => statuses[c.i][step] === "open")
      .sort(
        (a, b) =>
          b.dist - a.dist ||
          scenario.routes[a.i].etaMin - scenario.routes[b.i].etaMin,
      );
    if (open.length > 0) {
      statuses[open[0].i][step] = "recommended";
    }
  }
  return statuses;
}
