import { mockIncidents } from "@/data/mock";
import type { FireIncident } from "@/types";

/**
 * Service layer for situational data (fires, weather, risk, routes, shelters).
 *
 * The frontend never imports `src/data/mock.ts` directly — it goes through this
 * module, which mimics a remote API. When the prediction backend is ready,
 * replace the bodies of these functions with `fetch()` calls against it; the
 * rest of the app does not need to change.
 */

const simulateLatency = (ms = 350) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const incidentApi = {
  /** List all incidents (catalog / directory view). */
  async listIncidents(): Promise<FireIncident[]> {
    await simulateLatency();
    return mockIncidents;
  },

  /** Fetch a single incident, or null when the id is unknown. */
  async getIncident(id: string): Promise<FireIncident | null> {
    await simulateLatency(200);
    return mockIncidents.find((incident) => incident.id === id) ?? null;
  },
};

export type { FireIncident };
