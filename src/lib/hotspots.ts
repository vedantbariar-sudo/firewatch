import type { Hotspot, HotspotSource, LatLng } from "@/types";

/**
 * Live fire detections for the map.
 *
 * Source: the public NIFC (National Interagency Fire Center) active-incident
 * feed — an ArcGIS Online FeatureServer that needs no API key and sends CORS
 * headers, so the browser can call it directly. This replaces the NASA FIRMS
 * plan, which requires a MAP_KEY that can take days to arrive; the NIFC feed
 * is instant, keyless, and returns real current incidents (name, acreage,
 * discovery time) across the US.
 *
 * The live feed is queried per incident for its surrounding area. When no real
 * incidents are present (or the feed is unreachable), the app falls back to
 * deterministic simulated detections so the map never looks broken mid-demo;
 * the incident's `hotspotSource` tells the UI which one it is seeing.
 */

export interface HotspotResult {
  hotspots: Hotspot[];
  source: HotspotSource;
}

export interface HotspotBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Bounding box covering `points`, padded by a margin in degrees. */
export function computeBBox(
  points: LatLng[],
  marginDeg = 0.06,
): HotspotBounds {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lat, lng] of points) {
    if (lat < south) south = lat;
    if (lat > north) north = lat;
    if (lng < west) west = lng;
    if (lng > east) east = lng;
  }
  if (!Number.isFinite(west)) {
    return { west: -0.3, south: -0.3, east: 0.3, north: 0.3 };
  }
  return {
    west: west - marginDeg,
    south: south - marginDeg,
    east: east + marginDeg,
    north: north + marginDeg,
  };
}

/** NIFC active-incident layer (points with name/acreage/discovery attrs). */
const NIFC_LAYER =
  "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/EGP_Active_Incidents_Prod_Public_View/FeatureServer/0/query";
/** How far around an incident to look for live detections (~33 km). */
const LIVE_MARGIN_DEG = 0.3;

/** Intensity proxy (MW) from an incident's acreage, log-scaled. */
function intensityFromAcres(acres: number | null): number {
  if (!acres || acres <= 0) return 10;
  const value = Math.round(3 + Math.log10(acres + 1) * 8);
  return Math.min(45, Math.max(3, value));
}

/** NIFC discovery timestamps look like "2026-08-13 05:3052 UTC". */
function formatNifcTime(raw: unknown): string {
  const text = String(raw ?? "").trim();
  const match = /^(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}):(\d{2}))?/.exec(text);
  if (!match) return "recent";
  const time = match[2] ? `${match[2]}:${match[3]} UTC` : "";
  return time ? `${match[1]} ${time}` : match[1];
}

interface NifcProperties {
  Name?: string;
  DailyAcres?: number | null;
  CalculatedAcres?: number | null;
  Discovery_Date?: string | null;
  Sit209_Report_Status?: string | null;
}

interface NifcFeature {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: NifcProperties;
}

/** Parse the feed's GeoJSON payload into `Hotspot`s (skips malformed rows). */
export function parseNifcPayload(data: unknown): Hotspot[] {
  if (!data || typeof data !== "object") return [];
  const collection = data as { features?: unknown };
  if (!Array.isArray(collection.features)) return [];
  const out: Hotspot[] = [];
  for (const item of collection.features) {
    const feature = item as NifcFeature;
    const coords = feature.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const props = feature.properties ?? {};
    const acres = props.DailyAcres ?? props.CalculatedAcres ?? null;
    const numericAcres =
      typeof acres === "number" && Number.isFinite(acres) ? acres : null;
    const active = Boolean(props.Sit209_Report_Status);
    const confidence =
      numericAcres !== null && numericAcres >= 100
        ? "high"
        : numericAcres !== null && numericAcres >= 10
          ? "nominal"
          : active
            ? "nominal"
            : "low";
    out.push({
      id: `nifc-${lat.toFixed(4)},${lng.toFixed(4)}`,
      lat,
      lng,
      frp: intensityFromAcres(numericAcres),
      confidence,
      acquiredAt: formatNifcTime(props.Discovery_Date),
      satellite: "NIFC",
      name: props.Name?.trim() || undefined,
    });
  }
  return out;
}

/**
 * Query the NIFC feed for active incidents around `perimeter`. Returns an
 * empty array on any failure (offline, timeout, empty area) so the caller can
 * fall back to simulation.
 */
export async function fetchLiveHotspots(perimeter: LatLng[]): Promise<Hotspot[]> {
  const bounds = computeBBox(perimeter, LIVE_MARGIN_DEG);
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "Name,DailyAcres,CalculatedAcres,Discovery_Date,Sit209_Report_Status",
    returnGeometry: "true",
    f: "geojson",
    geometry: `${bounds.west.toFixed(4)},${bounds.south.toFixed(4)},${bounds.east.toFixed(4)},${bounds.north.toFixed(4)}`,
    geometryType: "esriGeometryEnvelope",
    spatialRel: "esriSpatialRelIntersects",
    inSR: "4326",
    outSR: "4326",
  });
  try {
    const response = await fetch(`${NIFC_LAYER}?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];
    const payload: unknown = await response.json().catch(() => null);
    return parseNifcPayload(payload);
  } catch {
    return [];
  }
}

/** Deduplicate by rounded position and cap the render count (intensity-first). */
export function dedupeHotspots(hotspots: Hotspot[], max = 150): Hotspot[] {
  const seen = new Set<string>();
  const out: Hotspot[] = [];
  for (const hotspot of [...hotspots].sort((a, b) => b.frp - a.frp)) {
    const key = `${hotspot.lat.toFixed(4)},${hotspot.lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hotspot);
    if (out.length >= max) break;
  }
  return out;
}

/** Deterministic PRNG so the simulated detections are stable across reloads. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic simulated detections: a hot cluster at the fire front plus a
 * sparser band along the current perimeter — what a real detection pass would
 * roughly look like. Used only when live data isn't available.
 */
export function buildMockHotspots(
  perimeter: LatLng[],
  fireFront: LatLng,
  seed = 7,
): Hotspot[] {
  const rand = mulberry32(seed);
  const out: Hotspot[] = [];
  const now = Date.now();
  const push = (lat: number, lng: number, frp: number, minutesAgo: number) => {
    const t = new Date(now - minutesAgo * 60_000);
    const hh = String(t.getUTCHours()).padStart(2, "0");
    const mm = String(t.getUTCMinutes()).padStart(2, "0");
    out.push({
      id: `mock-${out.length}`,
      lat: Number(lat.toFixed(5)),
      lng: Number(lng.toFixed(5)),
      frp: Math.round(frp * 10) / 10,
      confidence: rand() < 0.55 ? "high" : rand() < 0.85 ? "nominal" : "low",
      acquiredAt: `${t.toISOString().slice(0, 10)} ${hh}:${mm} UTC`,
      satellite: "simulated",
    });
  };
  // Hottest, densest detections at the active front.
  for (let i = 0; i < 9; i++) {
    push(
      fireFront[0] + (rand() - 0.5) * 0.012,
      fireFront[1] + (rand() - 0.5) * 0.012,
      8 + rand() * 34,
      5 + rand() * 30,
    );
  }
  // Cooler, sparser detections along the perimeter band.
  for (let i = 0; i < perimeter.length; i++) {
    const [lat, lng] = perimeter[i];
    const [lat2, lng2] = perimeter[(i + 1) % perimeter.length];
    if (rand() > 0.8) continue;
    const t = rand();
    push(
      lat + (lat2 - lat) * t + (rand() - 0.5) * 0.01,
      lng + (lng2 - lng) * t + (rand() - 0.5) * 0.01,
      3 + rand() * 14,
      15 + rand() * 120,
    );
  }
  return out;
}
