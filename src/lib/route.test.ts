import assert from "node:assert";
import { mockScenarios } from "@/data/mock";
import {
  assignRecommended,
  buildForecast,
  buildRouteStatuses,
} from "@/lib/spread";
import { generateRouteToShelter } from "@/lib/route";
import type { FireIncident } from "@/types";

/**
 * Regression tests for the guide-to-shelter route generator (src/lib/route.ts).
 *
 * Each scenario is turned into a full incident with the spread model's derived
 * forecast and route statuses (authored weather, no network), then every
 * shelter × forecast step is exercised.
 */

function incidents(): FireIncident[] {
  return mockScenarios.map((scenario) => {
    const forecast = buildForecast(scenario, null);
    const statuses = assignRecommended(
      buildRouteStatuses(scenario, forecast),
      forecast,
      scenario,
    );
    return {
      ...scenario,
      forecast,
      routes: scenario.routes.map((route, i) => ({
        ...route,
        statusByStep: statuses[i],
      })),
      hotspots: [],
      hotspotSource: "mock" as const,
    };
  });
}

function inside(point: [number, number], polygon: [number, number][]): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi
    ) {
      hit = !hit;
    }
  }
  return hit;
}

function haversineKm(
  a: [number, number],
  b: [number, number],
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

for (const incident of incidents()) {
  for (let step = 0; step < incident.forecast.length; step++) {
    for (const shelter of incident.shelters) {
      test(`${incident.id} step${step} -> ${shelter.id}: route exists and is sane`, () => {
        const route = generateRouteToShelter(incident, step, shelter);
        assert.ok(route, "route generated");
        assert.equal(route.id, `guidance-${shelter.id}`);
        assert.ok(route.path.length >= 2, "path has at least two points");
        assert.ok(route.distanceKm > 0, `distance positive (${route.distanceKm})`);
        assert.ok(route.etaMin >= 2, `eta sane (${route.etaMin})`);
        assert.ok(route.note.length > 0);
      });
    }
  }
}

test("routes start at the evacuation corridor and end exactly at the shelter", () => {
  for (const incident of incidents()) {
    for (let step = 0; step < incident.forecast.length; step++) {
      // Mirrors evacuationOrigin(): recommended corridor first, then the
      // first usable one, then the first route as a last resort.
      const openHead =
        incident.routes.find((r) => r.statusByStep[step] === "recommended") ??
        incident.routes.find((r) => r.statusByStep[step] !== "closed") ??
        incident.routes[0];
      for (const shelter of incident.shelters) {
        const route = generateRouteToShelter(incident, step, shelter);
        assert.ok(route);
        const start = route.path[0];
        const head = openHead.path[0];
        assert.ok(
          haversineKm(start, head) < 2,
          `${incident.id} step${step}: starts near the corridor head (${haversineKm(start, head).toFixed(2)} km away)`,
        );
        const end = route.path[route.path.length - 1];
        assert.deepEqual(end, shelter.location, "ends exactly at the shelter");
      }
    }
  }
});

test("routes to shelters outside the burn never enter the burn polygon", () => {
  for (const incident of incidents()) {
    for (let step = 0; step < incident.forecast.length; step++) {
      const burn = incident.forecast[step].riskZones[0].polygon;
      for (const shelter of incident.shelters) {
        if (inside(shelter.location, burn)) continue; // shelter inside the fire — skip
        const route = generateRouteToShelter(incident, step, shelter);
        assert.ok(route);
        for (const point of route.path.slice(1, -1)) {
          // The corridor head sits inside the danger zone when the backing
          // edge reaches town — only require the route to be burn-free once
          // it has exited the immediate evacuation area (~1 km).
          if (haversineKm(route.path[0], point) < 1) continue;
          assert.ok(
            !inside(point, burn),
            `${incident.id} step${step}: route point ${point} inside the burn`,
          );
        }
      }
    }
  }
});

test("route generation is deterministic", () => {
  const incident = incidents()[0];
  const shelter = incident.shelters[0];
  const first = generateRouteToShelter(incident, 2, shelter);
  const second = generateRouteToShelter(incident, 2, shelter);
  assert.deepEqual(second, first);
});

test("routes re-plan when the risk situation changes", () => {
  const incident = incidents().find((item) => item.id === "ridge-fire")!;
  const hesperia = incident.shelters.find((s) => s.id === "ridge-s3")!;
  const now = generateRouteToShelter(incident, 0, hesperia);
  const later = generateRouteToShelter(incident, 3, hesperia);
  assert.ok(now && later);
  // The +24h burn swallows every corridor, so the route must be re-planned
  // (different origin fallback and a materially different path).
  assert.notDeepEqual(later.path, now.path);
  assert.ok(
    Math.abs(later.distanceKm - now.distanceKm) < 15,
    "replanned distance stays in the same ballpark",
  );
});
