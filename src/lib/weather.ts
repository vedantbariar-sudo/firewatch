import type { Weather } from "@/types";

/**
 * Live weather for the spread model, fetched from Open-Meteo (free, keyless,
 * CORS-enabled). `now` is the current reading at the fire front, which the
 * spread model uses as the anchor for its own forward projection; `byHour`
 * holds the raw hourly forecast for the offsets it needs (6h / 12h / 24h),
 * kept for when the real prediction backend takes over.
 *
 * Every call is cached per location for the session, and any failure returns
 * `null` so the simulation can fall back to the scenario's authored weather.
 */

export interface LiveWeather {
  now: Weather;
  byHour: Map<number, Weather>;
}

const cache = new Map<string, Promise<LiveWeather | null>>();

const FORECAST_OFFSETS = [6, 12, 24];

function describeConditions(windSpeedKmh: number, humidityPct: number): string {
  const bits: string[] = [];
  if (windSpeedKmh >= 30) bits.push("gusty");
  if (humidityPct < 20) bits.push("very dry");
  else if (humidityPct < 35) bits.push("dry");
  if (bits.length === 0) return "clear conditions";
  return `${bits.join(", ")} conditions`;
}

async function load(lat: number, lng: number): Promise<LiveWeather | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current:
      "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    hourly: "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m",
    forecast_days: "1",
    timezone: "auto",
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!response.ok) return null;
  const data: {
    current?: {
      temperature_2m?: number;
      relative_humidity_2m?: number;
      wind_speed_10m?: number;
      wind_direction_10m?: number;
      wind_gusts_10m?: number;
    };
    hourly?: {
      time?: string[];
      temperature_2m?: number[];
      relative_humidity_2m?: number[];
      wind_speed_10m?: number[];
      wind_direction_10m?: number[];
    };
  } = await response.json();
  if (!data.current || !data.hourly?.time?.length) return null;

  const current = data.current;
  const now: Weather = {
    tempC: Math.round(current.temperature_2m ?? 0),
    humidityPct: Math.round(current.relative_humidity_2m ?? 0),
    windSpeedKmh: Math.round(current.wind_speed_10m ?? 0),
    windGustKmh:
      current.wind_gusts_10m != null ? Math.round(current.wind_gusts_10m) : undefined,
    windDirectionDeg: Math.round(current.wind_direction_10m ?? 0),
    conditions: describeConditions(
      current.wind_speed_10m ?? 0,
      current.relative_humidity_2m ?? 0,
    ),
  };

  // Hourly forecast is aligned to the top of each hour — snap each offset to
  // the nearest available hour.
  const times = data.hourly.time.map((t) => new Date(t).getTime());
  const byHour = new Map<number, Weather>();
  const nowMs = Date.now();
  for (const offset of FORECAST_OFFSETS) {
    const target = nowMs + offset * 3_600_000;
    let best = 0;
    for (let i = 1; i < times.length; i++) {
      if (Math.abs(times[i] - target) < Math.abs(times[best] - target)) best = i;
    }
    byHour.set(offset, {
      tempC: Math.round(data.hourly.temperature_2m?.[best] ?? now.tempC),
      humidityPct: Math.round(
        data.hourly.relative_humidity_2m?.[best] ?? now.humidityPct,
      ),
      windSpeedKmh: Math.round(data.hourly.wind_speed_10m?.[best] ?? now.windSpeedKmh),
      windDirectionDeg: Math.round(
        data.hourly.wind_direction_10m?.[best] ?? now.windDirectionDeg,
      ),
      conditions: describeConditions(
        data.hourly.wind_speed_10m?.[best] ?? now.windSpeedKmh,
        data.hourly.relative_humidity_2m?.[best] ?? now.humidityPct,
      ),
    });
  }

  return { now, byHour };
}

/** Fetch live weather for a location, cached per session; null on any failure. */
export function fetchLiveWeather(
  lat: number,
  lng: number,
): Promise<LiveWeather | null> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = load(lat, lng);
    cache.set(key, pending);
  }
  return pending;
}
