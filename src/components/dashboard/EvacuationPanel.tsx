import { Route, MapPin } from "lucide-react";
import { ROUTE_META } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { FireIncident } from "@/types";
import { Panel } from "./Panel";

interface EvacuationPanelProps {
  incident: FireIncident;
  stepIndex: number;
  selectedRouteId?: string | null;
  onSelectRoute?: (routeId: string | null) => void;
}

export function EvacuationPanel({
  incident,
  stepIndex,
  selectedRouteId,
  onSelectRoute,
}: EvacuationPanelProps) {
  return (
    <Panel
      title="Evacuation routes"
      icon={<Route className="size-4 text-emerald-400" />}
      right={
        <span className="text-xs text-muted-foreground">
          {incident.forecast[stepIndex]?.label}
        </span>
      }
      contentClassName="p-2"
    >
      <ul className="space-y-1">
        {incident.routes.map((route) => {
          const status = route.statusByStep[stepIndex] ?? "open";
          const meta = ROUTE_META[status];
          const selected = selectedRouteId === route.id;
          return (
            <li key={route.id}>
              <button
                type="button"
                onClick={() => onSelectRoute?.(selected ? null : route.id)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                  selected
                    ? "border-emerald-500/60 bg-emerald-500/[0.06]"
                    : status === "recommended"
                      ? "border-emerald-500/35 bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08]"
                      : "border-transparent hover:bg-accent/60",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={cn("mt-1.5 size-2 shrink-0 rounded-full", meta.dot)}
                    />
                    <div>
                      <p className="text-[15px] font-semibold leading-6">
                        {route.name}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[13px] text-muted-foreground">
                        <MapPin className="size-3.5" />
                        {route.communities.join(" · ")}
                      </p>
                    </div>
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
                {status === "recommended" && (
                  <span className="mt-2 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                    Recommended
                  </span>
                )}
                {route.note && (
                  <p className="mt-1.5 text-[13px] leading-6 text-muted-foreground">
                    {route.note}
                  </p>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
