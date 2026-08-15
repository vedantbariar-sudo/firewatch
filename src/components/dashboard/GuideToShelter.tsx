import { MapPin, Navigation } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Panel } from "./Panel";
import { windCardinal } from "@/lib/format";
import { ROUTE_META } from "@/lib/status";
import type {
  EvacuationRoute,
  FireIncident,
  LatLng,
  RouteStatus,
  Shelter,
} from "@/types";

const ROUTE_PRIORITY: Record<RouteStatus, number> = {
  recommended: 0,
  open: 1,
  caution: 2,
  closed: 3,
};

/** Squared degree distance — enough for ranking nearby endpoints. */
function distanceSq(a: LatLng, b: LatLng): number {
  const dLat = a[0] - b[0];
  const dLng = a[1] - b[1];
  return dLat * dLat + dLng * dLng;
}

/** Compass bearing (degrees) between two points, 0 = north. */
function bearingDegrees(from: LatLng, to: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const lat1 = toRad(from[0]);
  const lat2 = toRad(to[0]);
  const dLng = toRad(to[1] - from[1]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

interface GuideToShelterProps {
  incident: FireIncident;
  stepIndex: number;
  selectedRouteId: string | null;
  selectedShelterId: string | null;
  onSelectRoute: (id: string | null) => void;
  onSelectShelter: (id: string | null) => void;
}

/**
 * Google-Maps-style directions to the nearest safe shelter. Picks the safest
 * open evacuation route to the chosen shelter and highlights it on the map.
 */
export function GuideToShelter({
  incident,
  stepIndex,
  selectedRouteId,
  selectedShelterId,
  onSelectRoute,
  onSelectShelter,
}: GuideToShelterProps) {
  const shelters =
    incident.shelters.filter((s) => s.status === "open").length > 0
      ? incident.shelters.filter((s) => s.status === "open")
      : incident.shelters;

  const routeStatus = (route: EvacuationRoute): RouteStatus =>
    route.statusByStep[stepIndex] ?? "open";

  /** Safest usable route to a shelter — status first, then endpoint proximity. */
  const bestRouteFor = (shelter: Shelter): EvacuationRoute | null => {
    const usable = incident.routes
      .filter((route) => routeStatus(route) !== "closed")
      .sort((a, b) => {
        const diff = ROUTE_PRIORITY[routeStatus(a)] - ROUTE_PRIORITY[routeStatus(b)];
        if (diff !== 0) return diff;
        const end = shelter.location;
        return (
          distanceSq(a.path[a.path.length - 1], end) -
          distanceSq(b.path[b.path.length - 1], end)
        );
      });
    return usable[0] ?? null;
  };

  // Default destination: the shelter reachable by the safest (then fastest) route.
  const [shelterId, setShelterId] = useState<string | null>(() => {
    let best: { id: string; score: number; eta: number } | null = null;
    for (const shelter of shelters) {
      const route = bestRouteFor(shelter);
      if (!route) continue;
      const score = ROUTE_PRIORITY[routeStatus(route)];
      if (
        !best ||
        score < best.score ||
        (score === best.score && route.etaMin < best.eta)
      ) {
        best = { id: shelter.id, score, eta: route.etaMin };
      }
    }
    return best?.id ?? shelters[0]?.id ?? null;
  });

  const shelter = shelters.find((s) => s.id === shelterId) ?? null;
  const route = shelter ? bestRouteFor(shelter) : null;
  const status = route ? routeStatus(route) : null;
  const heading =
    route && route.path.length >= 2
      ? windCardinal(bearingDegrees(route.path[0], route.path[1]))
      : null;
  const active =
    route !== null && route.id === selectedRouteId && shelter?.id === selectedShelterId;

  return (
    <Panel
      title="Guide to shelter"
      right={
        status && (
          <span
            className="text-xs font-medium"
            style={{ color: ROUTE_META[status].color }}
          >
            {ROUTE_META[status].label}
          </span>
        )
      }
    >
      <div className="space-y-3">
        <Select value={shelterId ?? undefined} onValueChange={setShelterId}>
          <SelectTrigger className="h-9 w-full text-sm">
            <SelectValue placeholder="Choose a shelter" />
          </SelectTrigger>
          <SelectContent>
            {shelters.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {shelter && route && status ? (
          <>
            {/* Origin → destination, Google Maps style */}
            <div className="rounded-lg border border-border/70 bg-card/40 p-3.5">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 pt-1">
                  <span className="size-2.5 shrink-0 rounded-full border-2 border-emerald-400 bg-emerald-400/30" />
                  <span className="w-px flex-1 border-l-2 border-dashed border-border" />
                  <MapPin className="size-4 shrink-0 text-red-400" />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Evacuation zone
                    </p>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      {incident.locationLabel}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {shelter.name}
                    </p>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      {shelter.address}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Route summary */}
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {heading ? `Head ${heading.toLowerCase()} on ` : ""}
                  {route.name}
                </p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  via {route.communities.join(" · ")}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-base font-semibold tabular-nums">
                  {route.etaMin} min
                </p>
                <p className="text-xs text-muted-foreground">
                  {route.distanceKm} km
                </p>
              </div>
            </div>

            {route.note && (
              <p className="text-[13px] leading-6 text-muted-foreground">
                {route.note}
              </p>
            )}

            <Button
              type="button"
              variant={active ? "outline" : "default"}
              className="w-full cursor-pointer"
              disabled={active}
              onClick={() => {
                onSelectRoute(route.id);
                onSelectShelter(shelter.id);
              }}
            >
              <Navigation className="size-4" />
              {active ? "Showing on map" : "Start guidance"}
            </Button>
          </>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            No open route to {shelter?.name ?? "this shelter"} at the{" "}
            {incident.forecast[stepIndex]?.label ?? "current"} forecast step.
          </p>
        )}
      </div>
    </Panel>
  );
}
