import { MapPin } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Panel } from "./Panel";
import { windCardinal } from "@/lib/format";
import type { GeneratedRoute } from "@/lib/route";
import type { FireIncident, LatLng } from "@/types";

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
  selectedShelterId: string | null;
  onSelectShelter: (shelterId: string | null) => void;
  /** Generated route to the selected shelter for the current forecast step. */
  guidanceRoute: GeneratedRoute | null;
}

/**
 * Google-Maps-style directions to a shelter. Picking a shelter generates a
 * route that follows open roads and avoids the projected risk zones for the
 * current forecast step, then highlights it on the map.
 */
export function GuideToShelter({
  incident,
  stepIndex,
  selectedShelterId,
  onSelectShelter,
  guidanceRoute,
}: GuideToShelterProps) {
  const shelter =
    incident.shelters.find((item) => item.id === selectedShelterId) ?? null;
  const stepLabel = incident.forecast[stepIndex]?.label ?? "current";
  const heading =
    guidanceRoute && guidanceRoute.path.length >= 2
      ? windCardinal(
          bearingDegrees(guidanceRoute.path[0], guidanceRoute.path[1]),
        )
      : null;

  return (
    <Panel
      title="Guide to shelter"
      right={
        guidanceRoute ? (
          <span className="text-xs font-medium text-emerald-400">
            Safe route
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {incident.shelters.filter((s) => s.status === "open").length} open
          </span>
        )
      }
    >
      <div className="space-y-3">
        <Select
          value={selectedShelterId ?? undefined}
          onValueChange={onSelectShelter}
        >
          <SelectTrigger className="h-9 w-full text-sm">
            <SelectValue placeholder="Choose a shelter" />
          </SelectTrigger>
          <SelectContent>
            {incident.shelters.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {shelter && guidanceRoute ? (
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
                  {heading ? `Head ${heading.toLowerCase()}` : "Safest path"}
                </p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  Generated for {stepLabel}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-base font-semibold tabular-nums">
                  {guidanceRoute.etaMin} min
                </p>
                <p className="text-xs text-muted-foreground">
                  {guidanceRoute.distanceKm} km
                </p>
              </div>
            </div>

            <p className="text-[13px] leading-6 text-muted-foreground">
              {guidanceRoute.note}
            </p>
          </>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            {incident.shelters.length === 0
              ? "No shelters are listed for this incident yet."
              : "Choose a shelter to generate the safest route on the map."}
          </p>
        )}
      </div>
    </Panel>
  );
}
