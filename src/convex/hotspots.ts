"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

/**
 * Server-side proxy for NASA FIRMS active-fire detections (VIIRS 375 m
 * near-real-time). FIRMS doesn't send CORS headers, so browsers can't call it
 * directly — this action makes the fetch from the Convex runtime and returns
 * the raw detection payload for the client to parse. The MAP_KEY lives in the
 * `FIRMS_API_KEY` Convex env var (set via the project Keys settings), never in
 * the browser bundle. Returns an empty array when the key is missing, the
 * request fails, or no detections exist for the area — the client then falls
 * back to simulated hotspots.
 *
 * Endpoint (per FIRMS docs): * https://firms.modaps.eosdis.nasa.gov/api/area/json/{MAP_KEY}/{SOURCE}/1/{w,s,e,n}
 */

const FIRMS_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/json";
const FIRMS_SOURCES = ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"];
const BBOX_MARGIN_DEG = 0.06;

interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

function computeBBox(points: number[][]): Bounds {
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
  if (!Number.isFinite(west)) return { west: -0.3, south: -0.3, east: 0.3, north: 0.3 };
  return {
    west: west - BBOX_MARGIN_DEG,
    south: south - BBOX_MARGIN_DEG,
    east: east + BBOX_MARGIN_DEG,
    north: north + BBOX_MARGIN_DEG,
  };
}

async function fetchSource(
  key: string,
  source: string,
  bounds: Bounds,
): Promise<Record<string, unknown>[]> {
  const bbox = `${bounds.west.toFixed(4)},${bounds.south.toFixed(4)},${bounds.east.toFixed(4)},${bounds.north.toFixed(4)}`;
  const url = `${FIRMS_URL}/${key}/${source}/1/${bbox}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) return [];
    const payload: unknown = await response.json().catch(() => null);
    return Array.isArray(payload)
      ? (payload as Record<string, unknown>[])
      : [];
  } catch {
    return [];
  }
}

export const fetchFirmsHotspots = action({
  args: {
    /** Incident perimeter as [lat, lng] points; used to build the query bbox. */
    points: v.array(v.array(v.number())),
  },
  handler: async (_ctx, { points }): Promise<{ payload: Record<string, unknown>[] }> => {
    const key = (process.env.FIRMS_API_KEY ?? "").trim();
    if (!key) return { payload: [] };

    const bounds = computeBBox(points);
    const settled = await Promise.allSettled(
      FIRMS_SOURCES.map((source) => fetchSource(key, source, bounds)),
    );
    const payload = settled.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    );
    return { payload };
  },
});
