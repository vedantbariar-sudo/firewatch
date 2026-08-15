import assert from "node:assert";
import {
  buildMockHotspots,
  computeBBox,
  parseFirmsPayload,
} from "@/lib/hotspots";
import { mockScenarios } from "@/data/mock";

/**
 * Regression tests for the satellite hotspot feed (src/lib/hotspots.ts).
 * The live FIRMS fetch itself is network-dependent, so these cover the pure
 * pieces: bbox math, payload parsing, and the deterministic mock fallback.
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

test("parseFirmsPayload maps VIIRS JSON fields", () => {
  const payload = [
    {
      latitude: 34.256,
      longitude: -117.178,
      frp: 18.4,
      confidence: "h",
      acq_date: "2026-08-15",
      acq_time: 1425,
      satellite: "NPP",
      instrument: "VIIRS",
    },
    {
      latitude: 34.26,
      longitude: -117.17,
      frp: 5.2,
      confidence: "n",
      acq_date: "2026-08-15",
      acq_time: 1425,
      satellite: "NPP",
      instrument: "VIIRS",
    },
    // Malformed row — must be skipped, not crash.
    { latitude: "nope", longitude: 1, frp: 3 },
    null,
  ];
  const hotspots = parseFirmsPayload(payload);
  assert.equal(hotspots.length, 2);
  const first = hotspots[0];
  assert.equal(first.frp, 18.4);
  assert.equal(first.confidence, "high");
  assert.equal(first.acquiredAt, "2026-08-15 14:25 UTC");
  assert.equal(first.satellite, "VIIRS-NPP");
  assert.ok(first.id.includes("34.256"));
  assert.equal(hotspots[1].confidence, "nominal");
});

test("parseFirmsPayload handles MODIS numeric confidence and missing time", () => {
  const hotspots = parseFirmsPayload([
    {
      latitude: 33.7,
      longitude: -116.7,
      frp: 30,
      confidence: 92,
      acq_date: "2026-08-14",
      satellite: "Aqua",
      instrument: "MODIS",
    },
  ]);
  assert.equal(hotspots.length, 1);
  assert.equal(hotspots[0].confidence, "high");
  assert.equal(hotspots[0].satellite, "MODIS-Aqua");
  assert.equal(hotspots[0].acquiredAt, "2026-08-14");
});

test("parseFirmsPayload rejects non-array input", () => {
  assert.deepEqual(parseFirmsPayload(null), []);
  assert.deepEqual(parseFirmsPayload({ latitude: 1 }), []);
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
