import assert from "node:assert";
import { mockScenarios } from "@/data/mock";
import {
  assignRecommended,
  buildForecast,
  buildRouteStatuses,
} from "@/lib/spread";
import { RISK_ORDER } from "@/lib/status";

/**
 * Regression tests for the spread simulation (src/lib/spread.ts).
 *
 * Every test builds forecasts from the authored scenario weather (live = null)
 * so runs are deterministic and never touch the network. These encode the
 * model's intended behavior: wind-trend evolution, monotonic burn growth,
 * outward-descending risk zones, and route statuses derived from corridor
 * proximity to the projected burn.
 */

function buildScenario(id: string) {
  const scenario = mockScenarios.find((item) => item.id === id);
  assert.ok(scenario, `scenario ${id} exists`);
  return scenario;
}

function area(polygon: [number, number][]): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % polygon.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

for (const scenario of mockScenarios) {
  const label = scenario.id;

  const forecast = buildForecast(scenario, null);
  const statuses = assignRecommended(
    buildRouteStatuses(scenario, forecast),
    forecast,
    scenario,
  );

  test(`${label}: forecast shape and sane numbers`, () => {
    const hours = scenario.forecastHours ?? [0, 6, 12, 24];
    assert.equal(forecast.length, hours.length);
    forecast.forEach((step, i) => {
      assert.equal(step.hoursFromNow, hours[i]);
      assert.equal(step.label, hours[i] === 0 ? "Now" : `In ${hours[i]} hours`);
      assert.ok(step.spreadKmh > 0, `spread is positive (${step.spreadKmh})`);
      assert.ok(Number.isFinite(step.weather.tempC));
      assert.ok(step.weather.windSpeedKmh >= 0);
      assert.ok(step.weather.humidityPct >= 0 && step.weather.humidityPct <= 100);
      assert.ok(step.riskNote.length > 0);
      assert.ok(step.riskZones.length >= 2, "at least two risk zones per step");
    });
  });

  test(`${label}: risk zones descend outward`, () => {
    for (const step of forecast) {
      for (let i = 1; i < step.riskZones.length; i++) {
        const prev = RISK_ORDER.indexOf(step.riskZones[i - 1].level);
        const next = RISK_ORDER.indexOf(step.riskZones[i].level);
        assert.ok(
          next < prev,
          `${step.label}: zone ${i} (${step.riskZones[i].level}) is less severe than zone ${i - 1} (${step.riskZones[i - 1].level})`,
        );
      }
    }
  });

  test(`${label}: burn area grows monotonically across the forecast`, () => {
    const areas = forecast.map((step) => area(step.riskZones[0].polygon));
    for (let i = 1; i < areas.length; i++) {
      assert.ok(
        areas[i] > areas[i - 1],
        `step ${i} burn (${areas[i].toFixed(4)}) larger than step ${i - 1} (${areas[i - 1].toFixed(4)})`,
      );
    }
  });

  test(`${label}: route statuses are valid and derived`, () => {
    assert.equal(statuses.length, scenario.routes.length);
    assert.equal(statuses[0].length, forecast.length);
    const valid = new Set(["open", "recommended", "caution", "closed"]);
    for (const row of statuses) {
      for (const status of row) {
        assert.ok(valid.has(status), `valid status, got ${status}`);
      }
    }
    // At most one route recommended per step, and only when something is open.
    for (let step = 0; step < forecast.length; step++) {
      const atStep = statuses.map((row) => row[step]);
      const recommended = atStep.filter((s) => s === "recommended").length;
      const open = atStep.filter((s) => s !== "closed").length;
      assert.ok(recommended <= 1, `at most one recommended (${recommended})`);
      if (open === 0) assert.equal(recommended, 0, "no recommended when all closed");
      if (recommended === 1) assert.ok(open >= 1);
    }
  });
}

test("ridge: wind trend strengthens and risk escalates", () => {
  const scenario = buildScenario("ridge-fire");
  const forecast = buildForecast(scenario, null);
  const winds = forecast.map((step) => step.weather.windSpeedKmh);
  for (let i = 1; i < winds.length; i++) {
    assert.ok(winds[i] > winds[i - 1], `wind climbs (${winds.join(" -> ")})`);
  }
  assert.equal(forecast[0].riskLevel, "extreme");
  assert.equal(forecast[forecast.length - 1].riskLevel, "catastrophic");
});

test("mesa: weakening wind eases and routes stay open", () => {
  const scenario = buildScenario("mesa-fire");
  const forecast = buildForecast(scenario, null);
  const winds = forecast.map((step) => step.weather.windSpeedKmh);
  for (let i = 1; i < winds.length; i++) {
    assert.ok(winds[i] < winds[i - 1], `wind falls (${winds.join(" -> ")})`);
  }
  const statuses = assignRecommended(
    buildRouteStatuses(scenario, forecast),
    forecast,
    scenario,
  );
  for (const row of statuses) {
    for (const status of row) {
      assert.notEqual(status, "closed", "contained fire never closes a route");
    }
  }
});

test("ridge: downwind corridor closes before the upwind one", () => {
  const scenario = buildScenario("ridge-fire");
  const forecast = buildForecast(scenario, null);
  const statuses = assignRecommended(
    buildRouteStatuses(scenario, forecast),
    forecast,
    scenario,
  );
  const byId = (id: string) =>
    statuses[scenario.routes.findIndex((r) => r.id === id)];
  // SR-18 East runs toward the wind (the fire's push) — closed from the start.
  assert.equal(byId("ridge-r1")[0], "closed");
  // SR-138 West heads upwind — still usable at step 0.
  assert.notEqual(byId("ridge-r3")[0], "closed");
  // The step-0 recommendation must be the one open upwind corridor.
  assert.equal(byId("ridge-r3")[0], "recommended");
});

test("pinnacle: north corridor closes as fire pushes north; west stays open", () => {
  const scenario = buildScenario("pinnacle-fire");
  const forecast = buildForecast(scenario, null);
  const statuses = assignRecommended(
    buildRouteStatuses(scenario, forecast),
    forecast,
    scenario,
  );
  const byId = (id: string) =>
    statuses[scenario.routes.findIndex((r) => r.id === id)];
  assert.ok(byId("pin-r2").every((s) => s === "closed"), "SR-74 East closed");
  assert.ok(byId("pin-r3").every((s) => s === "recommended"), "SR-74 West recommended");
  assert.equal(byId("pin-r1")[0], "caution");
  assert.ok(byId("pin-r1").slice(1).every((s) => s === "closed"), "SR-243 closes by +6h");
});
