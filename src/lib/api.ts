import { mockScenarios } from "@/data/mock";
import {
  buildMockHotspots,
  dedupeHotspots,
  fetchLiveHotspots,
} from "@/lib/hotspots";
import {
  assignRecommended,
  buildForecast,
  buildRouteStatuses,
} from "@/lib/spread";
import { fetchLiveWeather } from "@/lib/weather";
import type { FireIncident, FireScenario, Hotspot, HotspotSource } from "@/types";

/**
 * Service layer for situational data (fires, weather, risk, routes, shelters).
 *
 * The frontend never imports `src/data/mock.ts` directly — it goes through this
 * module, which mimics a remote API. Today it builds each incident from the
 * scenario record by running the spread simulation (`src/lib/spread.ts`) and
 * pulling live data from two keyless feeds — Open-Meteo weather and the public
 * NIFC active-incident layer — falling back to authored/simulated data when
 * either is offline. When the prediction backend is ready, replace the bodies
 * of these functions with `fetch()` calls against it; the rest of the app does
 * not need to change.
 */

const simulateLatency = (ms = 350) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Built incidents are cached per session so repeated loads stay stable. */
const incidentCache = new Map<string, Promise<FireIncident>>();

/** Live NIFC detections when available; deterministic simulation otherwise. */
async function loadHotspotsFor(
  scenario: FireScenario,
): Promise<{ hotspots: Hotspot[]; source: HotspotSource }> {
  try {
    const live = await fetchLiveHotspots(scenario.perimeter);
    if (live.length > 0) {
      return { hotspots: dedupeHotspots(live), source: "live" };
    }
  } catch {
    // Feed unreachable — fall through to simulation.
  }
  return {
    hotspots: buildMockHotspots(scenario.perimeter, scenario.fireFront),
    source: "mock",
  };
}

async function loadIncident(scenario: FireScenario): Promise<FireIncident> {
  const [live, hotspotResult] = await Promise.all([
    fetchLiveWeather(scenario.fireFront[0], scenario.fireFront[1]),
    loadHotspotsFor(scenario),
  ]);
  const forecast = buildForecast(scenario, live);
  const statuses = assignRecommended(
    buildRouteStatuses(scenario, forecast),
    forecast,
    scenario,
  );
  const routes = scenario.routes.map((route, i) => ({
    ...route,
    statusByStep: statuses[i],
  }));
  return {
    ...scenario,
    forecast,
    routes,
    hotspots: hotspotResult.hotspots,
    hotspotSource: hotspotResult.source,
  };
}

function getCached(scenario: FireScenario): Promise<FireIncident> {
  let pending = incidentCache.get(scenario.id);
  if (!pending) {
    pending = loadIncident(scenario);
    incidentCache.set(scenario.id, pending);
  }
  return pending;
}

export const incidentApi = {
  /** List all incidents (catalog / directory view). */
  async listIncidents(): Promise<FireIncident[]> {
    await simulateLatency();
    return Promise.all(mockScenarios.map(getCached));
  },

  /** Fetch a single incident, or null when the id is unknown. */
  async getIncident(id: string): Promise<FireIncident | null> {
    await simulateLatency(200);
    const scenario = mockScenarios.find((item) => item.id === id);
    return scenario ? getCached(scenario) : null;
  },
};

export type { FireIncident };
