import type { Hotspot, HotspotSource, LatLng } from "@/types";

/**
 * Satellite fire detections for the map.
 *
 * The live feed comes from NASA FIRMS (VIIRS 375 m near-real-time), fetched
 * server-side by the Convex action in `src/convex/hotspots.ts` — FIRMS does not
 * send CORS headers, so a browser call would always be blocked, and routing it
 * through Convex keeps the MAP_KEY server-side. This module holds the pure
 * pieces: payload parsing, deduping, bounding boxes, and the deterministic
 * simulated fallback used whenever live data isn't available, so the map never
 * looks broken mid-demo. `src/lib/api.ts` decides live vs. simulated and
 * surfaces that via the incident's `hotspotSource`.
 */

/** A single parsed detection, or a simulated one. */
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

interface FirmsDetection {
  latitude?: number | string;
  longitude?: number | string;
  frp?: number | string;
  confidence?: number | string;
  acq_date?: string;
  acq_time?: number | string;
  satellite?: string;
  instrument?: string;
}

/** Map a FIRMS confidence value ("h"/"n"/"l" or a MODIS 0–100 number). */
function confidenceLabel(
  confidence: number | string | undefined,
): Hotspot["confidence"] {
  const value = String(confidence ?? "").trim().toLowerCase();
  if (value === "h" || value === "high") return "high";
  if (value === "l" || value === "low") return "low";
  const numeric = Number(value);
  if (Number.isFinite(numeric) && value !== "") {
    if (numeric >= 80) return "high";
    if (numeric >= 40) return "nominal";
    return "low";
  }
  return "nominal";
}

/** Parse a FIRMS area-API JSON payload into `Hotspot`s (skips malformed rows). */
export function parseFirmsPayload(data: unknown): Hotspot[] {
  if (!Array.isArray(data)) return [];
  const out: Hotspot[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const d = item as FirmsDetection;
    const lat = Number(d.latitude);
    const lng = Number(d.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const frp = Number(d.frp);
    const rawTime = d.acq_time == null ? "" : String(d.acq_time);
    const time = rawTime.padStart(4, "0");
    const acquiredAt = rawTime
      ? `${d.acq_date ?? "—"} ${time.slice(0, 2)}:${time.slice(2)} UTC`
      : d.acq_date ?? "—";
    out.push({
      id: `${lat.toFixed(5)},${lng.toFixed(5)},${time}`,
      lat,
      lng,
      frp: Number.isFinite(frp) ? Math.max(0, Math.round(frp * 10) / 10) : 0,
      confidence: confidenceLabel(d.confidence),
      acquiredAt,
      satellite: d.satellite
        ? `${d.instrument ?? "VIIRS"}-${d.satellite}`
        : d.instrument ?? "VIIRS",
    });
  }
  return out;
}

/** Deduplicate by rounded position and cap the render count (FRP-first). */
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
 * sparser band along the current perimeter — what a real VIIRS pass would
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
      satellite: "VIIRS-SNPP",
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
