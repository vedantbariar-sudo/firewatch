import assert from "node:assert";
import {
  buildMockHotspots,
  computeBBox,
  parseNifcPayload,
} from "@/lib/hotspots";
import { mockScenarios } from "@/data/mock";

/**
 * Regression tests for the fire-detection feed (src/lib/hotspots.ts).
 * The live NIFC fetch itself is network-dependent, so these cover the pure
 * pieces: bbox math, GeoJSON parsing, and the deterministic mock fallback.
 */

test("computeBBox covers the points with a margin", () => {
  const bounds = computeBBox(
    [
      [34.2, -117.3],
      [34.3, -117.1],
    ],
    0.06,
  );
  assert.ok(bounds.west <= -117.3);
  assert.ok(bounds.south <= 34.2);
  assert.ok(bounds.east >= -117.1);
  assert.ok(bounds.north >= 34.3);
});

test("computeBBox handles an empty polygon", () => {
  const bounds = computeBBox([]);
  assert.ok(bounds.east > bounds.west);
  assert.ok(bounds.north > bounds.south);
});

test("parseNifcPayload maps a real feed response", () => {
  const payload = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: 1,
        geometry: { type: "Point", coordinates: [-116.7, 33.75] },
        properties: {
          Name: "PINE COVE",
          DailyAcres: 2450,
          Discovery_Date: "2026-08-13 05:3052 UTC",
          Sit209_Report_Status: "A",
        },
      },
      {
        type: "Feature",
        id: 2,
        geometry: { type: "Point", coordinates: [-116.8, 33.74] },
        properties: {
          Name: "IDYLLWILD RX",
          DailyAcres: null,
          Discovery_Date: "2026-08-12 18:4511 UTC",
          Sit209_Report_Status: null,
        },
      },
      // Malformed row — must be skipped, not crash.
      { type: "Feature", id: 3, geometry: { type: "Point" }, properties: {} },
      { type: "Feature", id: 4, geometry: null, properties: null },
    ],
  };
  const hotspots = parseNifcPayload(payload);
  assert.equal(hotspots.length, 2);
  const big = hotspots[0];
  assert.equal(big.name, "PINE COVE");
  assert.equal(big.lat, 33.75);
  assert.equal(big.lng, -116.7);
  assert.equal(big.satellite, "NIFC");
  assert.equal(big.confidence, "high");
  // NIFC timestamps are mangled (":3052") — we keep the sane HH:MM part.
  assert.equal(big.acquiredAt, "2026-08-13 05:30 UTC");
  assert.ok(big.frp >= 3 && big.frp <= 45, `intensity proxy sane (${big.frp})`);
  assert.equal(hotspots[1].confidence, "low");
  assert.equal(hotspots[1].name, "IDYLLWILD RX");
});

test("parseNifcPayload intensity scales with acreage and caps", () => {
  const make = (acres: number | null) =>
    parseNifcPayload({
      features: [
        {
          geometry: { type: "Point", coordinates: [-117, 34] },
          properties: { Name: "X", DailyAcres: acres },
        },
      ],
    })[0];
  assert.ok(make(5).frp < make(5000).frp, "bigger fire reads hotter");
  assert.equal(make(1_000_000).frp, 45, "intensity caps at 45");
  assert.equal(make(null).frp, 10, "unknown acreage uses a default");
});

test("parseNifcPayload rejects non-collection input", () => {
  assert.deepEqual(parseNifcPayload(null), []);
  assert.deepEqual(parseNifcPayload({ features: "nope" }), []);
  assert.deepEqual(parseNifcPayload([1, 2, 3]), []);
});

test("mock hotspots are deterministic, near the fire, and sane", () => {
  const scenario = mockScenarios[0]; // ridge-fire
  const bounds = computeBBox(scenario.perimeter);
  const first = buildMockHotspots(scenario.perimeter, scenario.fireFront, 7);
  const second = buildMockHotspots(scenario.perimeter, scenario.fireFront, 7);
  assert.equal(first.length, second.length);
  assert.deepEqual(
    first.map((h) => [h.lat, h.lng, h.frp]),
    second.map((h) => [h.lat, h.lng, h.frp]),
    "same seed produces the same detections",
  );
  assert.ok(first.length >= 10, "a believable number of detections");
  for (const hotspot of first) {
    assert.ok(
      hotspot.lat >= bounds.south && hotspot.lat <= bounds.north,
      "lat inside the incident bbox",
    );
    assert.ok(
      hotspot.lng >= bounds.west && hotspot.lng <= bounds.east,
      "lng inside the incident bbox",
    );
    assert.ok(hotspot.frp > 0, `positive FRP (${hotspot.frp})`);
    assert.ok(["high", "nominal", "low"].includes(hotspot.confidence));
    assert.ok(hotspot.acquiredAt.length > 0);
  }
});

test("mock hotspots stay deterministic across scenarios", () => {
  for (const scenario of mockScenarios) {
    const a = buildMockHotspots(scenario.perimeter, scenario.fireFront, 11);
    const b = buildMockHotspots(scenario.perimeter, scenario.fireFront, 11);
    assert.deepEqual(a, b, `${scenario.id} deterministic`);
    assert.ok(a.length > 0, `${scenario.id} has detections`);
  }
});
