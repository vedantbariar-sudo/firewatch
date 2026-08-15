/** Compact relative-time labels ("5 min ago", "3 h ago"). */
export function timeAgo(timestamp: number | string | Date): string {
  const then = typeof timestamp === "number" ? timestamp : new Date(timestamp).getTime();
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

const CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

/** 8-point compass label for a meteorological wind direction (degrees). */
export function windCardinal(directionDeg: number): string {
  return CARDINALS[Math.round(directionDeg / 45) % 8];
}

/** Rotation (deg) to point an arrow in the direction the wind blows TOWARD. */
export function windArrowRotation(directionDeg: number): number {
  return (directionDeg + 180) % 360;
}
