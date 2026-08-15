import type {
  FireIncident,
  LatLng,
  RiskLevel,
  RouteStatus,
  Shelter,
} from "@/types";

/**
 * Demo route generator for the "Guide to shelter" panel.
 *
 * The real prediction backend will eventually serve evacuation routes over the
 * API (swap in `src/lib/api.ts`). Until then this module simulates that
 * endpoint: it runs a small grid search over the incident area that prefers
 * open evacuation corridors and avoids the projected risk zones for the
 * selected forecast step, then returns a polyline the map can draw.
 */

export interface GeneratedRoute {
  /** Stable per destination so the map can key its zoom by route. */
  id: string;
  name: string;
  path: LatLng[];
  distanceKm: number;
  etaMin: number;
  note: string;
}

/** Grid resolution — one cell ≈ 165 m. */
const CELL_DEG = 0.0015;
/** A cell within ~120 m of an evacuation corridor counts as "on road". */
const ROAD_CORRIDOR_DEG = 0.0011;

const RISK_MULT: Record<RiskLevel, number> = {
  low: 1.15,
  moderate: 1.8,
  high: 4,
  extreme: 7,
  catastrophic: 9,
};

const ROAD_MULT: Record<RouteStatus, number> = {
  recommended: 0.4,
  open: 0.4,
  caution: 0.75,
  closed: 1.9,
};

const RISK_RANK: Record<RiskLevel, number> = {
  low: 0,
  moderate: 1,
  high: 2,
  extreme: 3,
  catastrophic: 4,
};

/** Is `p` inside `polygon`? (ray casting — polygons are small here) */
function pointInPolygon(p: [number, number], polygon: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (
      yi > p[1] !== yj > p[1] &&
      p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function distToSegment(p: [number, number], a: LatLng, b: LatLng): number {
  const [px, py] = p;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - a[0], py - a[1]);
  let t = ((px - a[0]) * dx + (py - a[1]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Head of the current recommended (or first usable) corridor. */
function evacuationOrigin(incident: FireIncident, stepIndex: number): LatLng {
  const atStep = (route: (typeof incident.routes)[number]) =>
    route.statusByStep[stepIndex] ?? "open";
  const preferred =
    incident.routes.find((route) => atStep(route) === "recommended") ??
    incident.routes.find((route) => atStep(route) !== "closed") ??
    incident.routes[0];
  return preferred?.path[0] ?? incident.fireFront;
}

/** Drop grid cells that don't meaningfully change heading. */
function simplifyPath(path: LatLng[]): LatLng[] {
  const keep: LatLng[] = [path[0]];
  const tol = Math.cos((14 * Math.PI) / 180); // keep turns sharper than 14°
  for (let i = 1; i < path.length - 1; i++) {
    const [ax, ay] = path[i - 1];
    const [bx, by] = path[i];
    const [cx, cy] = path[i + 1];
    const v1x = bx - ax;
    const v1y = by - ay;
    const v2x = cx - bx;
    const v2y = cy - by;
    const m1 = Math.hypot(v1x, v1y);
    const m2 = Math.hypot(v2x, v2y);
    if (m1 === 0 || m2 === 0) continue;
    const dot = (v1x * v2x + v1y * v2y) / (m1 * m2);
    if (dot < tol) keep.push(path[i]);
  }
  keep.push(path[path.length - 1]);
  const out: LatLng[] = [keep[0]];
  for (let i = 1; i < keep.length; i++) {
    const prev = out[out.length - 1];
    if (
      Math.hypot(keep[i][0] - prev[0], keep[i][1] - prev[1]) > CELL_DEG * 0.5
    ) {
      out.push(keep[i]);
    }
  }
  return out;
}

/**
 * Generate the safest route from the evacuation zone to a shelter for the
 * given forecast step. Returns null only when no connected path exists.
 */
export function generateRouteToShelter(
  incident: FireIncident,
  stepIndex: number,
  shelter: Shelter,
): GeneratedRoute | null {
  const step =
    incident.forecast[Math.min(stepIndex, incident.forecast.length - 1)];
  const origin = evacuationOrigin(incident, stepIndex);
  const goal = shelter.location;

  // Bounds covering every shape we care about, with a buffer for detours.
  const pts: LatLng[] = [origin, goal];
  for (const zone of step.riskZones) pts.push(...zone.polygon);
  for (const route of incident.routes) pts.push(...route.path);
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of pts) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  const margin = 0.03;
  minLat -= margin;
  maxLat += margin;
  minLng -= margin;
  maxLng += margin;

  // Equirectangular projection so grid cells are ~square.
  const cosLat = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180)) || 1;
  const project = (p: LatLng): [number, number] => [p[1] * cosLat, p[0]];
  const unproject = (x: number, y: number): LatLng => [y, x / cosLat];

  const minX = minLng * cosLat;
  const cols = Math.max(2, Math.ceil((maxLng * cosLat - minX) / CELL_DEG));
  const rows = Math.max(2, Math.ceil((maxLat - minLat) / CELL_DEG));
  const cellCount = cols * rows;

  const idx = (cx: number, cy: number) => cy * cols + cx;
  const centerOf = (cx: number, cy: number): LatLng =>
    unproject(minX + (cx + 0.5) * CELL_DEG, minLat + (cy + 0.5) * CELL_DEG);

  // Per-cell cost multipliers: risk (worst zone wins) × road preference.
  const riskCost = new Float64Array(cellCount).fill(1);
  const roadCost = new Float64Array(cellCount).fill(1);
  const segments: { a: LatLng; b: LatLng; status: RouteStatus }[] = [];
  for (const route of incident.routes) {
    const status = route.statusByStep[stepIndex] ?? "open";
    for (let i = 0; i < route.path.length - 1; i++) {
      segments.push({ a: route.path[i], b: route.path[i + 1], status });
    }
  }
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const cell = centerOf(cx, cy);
      let rank = -1;
      let risk = 1;
      for (const zone of step.riskZones) {
        if (!pointInPolygon(cell, zone.polygon)) continue;
        const zoneRank =
          zone.label === "Active burn" ? 5 : RISK_RANK[zone.level];
        if (zoneRank > rank) {
          rank = zoneRank;
          risk = zone.label === "Active burn" ? 14 : RISK_MULT[zone.level];
        }
      }
      riskCost[idx(cx, cy)] = risk;

      let nearest = Infinity;
      let status: RouteStatus | null = null;
      for (const seg of segments) {
        const d = distToSegment(cell, seg.a, seg.b);
        if (d < nearest) {
          nearest = d;
          status = seg.status;
        }
      }
      if (status && nearest < ROAD_CORRIDOR_DEG) {
        roadCost[idx(cx, cy)] = ROAD_MULT[status];
      }
    }
  }

  // Dijkstra over the grid.
  const [sx, sy] = project(origin);
  const [gx, gy] = project(goal);
  const clamp = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, v));
  const startCx = clamp(Math.round((sx - minX) / CELL_DEG), 0, cols - 1);
  const startCy = clamp(Math.round((sy - minLat) / CELL_DEG), 0, rows - 1);
  const goalCx = clamp(Math.round((gx - minX) / CELL_DEG), 0, cols - 1);
  const goalCy = clamp(Math.round((gy - minLat) / CELL_DEG), 0, rows - 1);
  const start = idx(startCx, startCy);
  const goalNode = idx(goalCx, goalCy);

  const dist = new Float64Array(cellCount).fill(Infinity);
  const prev = new Int32Array(cellCount).fill(-1);
  const done = new Uint8Array(cellCount);
  const heap: number[] = [];
  const heapPos = new Int32Array(cellCount).fill(-1);

  const swap = (a: number, b: number) => {
    const na = heap[a];
    const nb = heap[b];
    heap[a] = nb;
    heap[b] = na;
    heapPos[na] = b;
    heapPos[nb] = a;
  };
  const heapPush = (node: number) => {
    heapPos[node] = heap.length;
    heap.push(node);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (dist[heap[parent]] <= dist[heap[i]]) break;
      swap(i, parent);
      i = parent;
    }
  };
  const heapSiftUp = (node: number) => {
    let i = heapPos[node];
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (dist[heap[parent]] <= dist[heap[i]]) break;
      swap(i, parent);
      i = parent;
    }
  };
  const heapPop = (): number => {
    const top = heap[0];
    heapPos[top] = -1;
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      heapPos[last] = 0;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let smallest = i;
        if (l < heap.length && dist[heap[l]] < dist[heap[smallest]]) {
          smallest = l;
        }
        if (r < heap.length && dist[heap[r]] < dist[heap[smallest]]) {
          smallest = r;
        }
        if (smallest === i) break;
        swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  };

  dist[start] = 0;
  heapPush(start);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const;

  while (heap.length > 0) {
    const cur = heapPop();
    if (done[cur]) continue;
    done[cur] = 1;
    if (cur === goalNode) break;
    const cx = cur % cols;
    const cy = (cur / cols) | 0;
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const neighbor = idx(nx, ny);
      if (done[neighbor]) continue;
      const stepDist = Math.hypot(dx, dy) * CELL_DEG;
      const next =
        dist[cur] + stepDist * riskCost[neighbor] * roadCost[neighbor];
      if (next < dist[neighbor]) {
        dist[neighbor] = next;
        prev[neighbor] = cur;
        if (heapPos[neighbor] === -1) heapPush(neighbor);
        else heapSiftUp(neighbor);
      }
    }
  }

  if (dist[goalNode] === Infinity) return null;

  // Reconstruct the path (grid cells → [lat, lng]).
  const raw: LatLng[] = [];
  let node = goalNode;
  while (node !== -1) {
    const cx = node % cols;
    const cy = (node / cols) | 0;
    raw.push(centerOf(cx, cy));
    node = prev[node];
  }
  raw.reverse();
  raw[0] = origin;
  raw[raw.length - 1] = goal;

  const path = simplifyPath(raw);
  let distanceKm = 0;
  for (let i = 1; i < path.length; i++) {
    distanceKm += haversineKm(path[i - 1], path[i]);
  }
  distanceKm = Math.max(0.5, Math.round(distanceKm * 10) / 10);
  const etaMin = Math.max(2, Math.round((distanceKm / 42) * 60));

  return {
    id: `guidance-${shelter.id}`,
    name: `Safe route to ${shelter.name}`,
    path,
    distanceKm,
    etaMin,
    note: `Routed along open roads to avoid the projected risk zones for ${step.label}.`,
  };
}
