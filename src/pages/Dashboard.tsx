import { useAuth } from "@/hooks/use-auth";
import { incidentApi } from "@/lib/api";
import type { FireIncident } from "@/types";
import { ALL_LAYERS, FireMap } from "@/components/map/FireMap";
import type { LayerState } from "@/components/map/FireMap";
import { AppShell } from "@/components/layout/AppShell";
import { MapToolbar } from "@/components/dashboard/MapToolbar";
import { SituationPanel } from "@/components/dashboard/SituationPanel";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { EvacuationPanel } from "@/components/dashboard/EvacuationPanel";
import { SheltersPanel } from "@/components/dashboard/SheltersPanel";
import { StatsStrip } from "@/components/dashboard/StatsStrip";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowUpRight, Radio, Route } from "lucide-react";
import { Link } from "react-router";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<FireIncident[] | null>(null);
  const [selectedId, setSelectedId] = useState("ridge-fire");
  const [stepIndex, setStepIndex] = useState(0);
  const [layers, setLayers] = useState<LayerState>(ALL_LAYERS);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedShelterId, setSelectedShelterId] = useState<string | null>(null);

  useEffect(() => {
    incidentApi.listIncidents().then(setIncidents);
  }, []);

  const incident =
    incidents?.find((item) => item.id === selectedId) ?? null;
  const firstName = user?.name?.split(" ")[0] || "";

  const handleSelectIncident = (id: string) => {
    setSelectedId(id);
    setSelectedRouteId(null);
    setSelectedShelterId(null);
    setStepIndex(0);
  };

  if (!incident) {
    return (
      <AppShell active="operations">
        <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-5 lg:px-6">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Skeleton className="h-[520px] w-full rounded-xl lg:h-[620px]" />
            <div className="space-y-4">
              <Skeleton className="h-80 w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell active="operations">
      <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-5 lg:px-6">
        {/* Page header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Dashboard
            </p>
            <h1 className="mt-0.5 text-3xl font-semibold tracking-tight">
              {firstName ? `Hello, ${firstName}` : "Today's fire situation"}
            </h1>
            <p className="mt-1 text-[15px] text-muted-foreground">
              Here&apos;s what is happening right now.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-medium text-emerald-400">
              <Radio className="size-3 animate-pulse" />
              Live
            </span>
            <span>Updated a few minutes ago</span>
          </div>
        </div>

        <StatsStrip incident={incident} />

        {/* Recommended route — the one thing people need to know */}
        {(() => {
          const recommended = incident.routes.find(
            (route) => route.statusByStep[stepIndex] === "recommended",
          );
          if (!recommended) return null;
          return (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] px-4 py-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <Route className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-foreground">
                  {stepIndex === 0
                    ? `Recommended route now: ${recommended.name}`
                    : `Recommended route later: ${recommended.name}`}
                </p>
                <p className="mt-0.5 text-sm leading-6 text-muted-foreground">
                  {stepIndex === 0
                    ? "If you are in the affected area, this is the safest way out. "
                    : "This route is expected to stay clear as the fire moves. "}
                  {recommended.note}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="cursor-pointer"
                onClick={() => setSelectedRouteId(recommended.id)}
              >
                Show on map
              </Button>
            </div>
          );
        })()}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Map column */}
          <div className="flex flex-col gap-2.5">
            <MapToolbar
              incidents={incidents ?? []}
              selectedIncidentId={incident.id}
              onSelectIncident={handleSelectIncident}
              steps={incident.forecast.map((step) => step.label)}
              stepIndex={stepIndex}
              onStepChange={setStepIndex}
              layers={layers}
              onLayersChange={setLayers}
              right={
                <Link
                  to={`/incidents/${incident.id}`}
                  className="flex h-9 items-center gap-1.5 rounded-md border border-border/70 bg-background/60 px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
                >
                  Open brief
                  <ArrowUpRight className="size-4" />
                </Link>
              }
            />
            <FireMap
              incident={incident}
              stepIndex={stepIndex}
              layers={layers}
              selectedRouteId={selectedRouteId}
              onSelectRoute={setSelectedRouteId}
              onSelectShelter={setSelectedShelterId}
              onOpenIncident={() => navigate(`/incidents/${incident.id}`)}
              className="h-[440px] lg:h-[560px]"
            />
          </div>

          {/* Situation rail */}
          <div className="flex flex-col gap-4">
            <SituationPanel incident={incident} stepIndex={stepIndex} />
            <AlertsPanel incident={incident} />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <EvacuationPanel
            incident={incident}
            stepIndex={stepIndex}
            selectedRouteId={selectedRouteId}
            onSelectRoute={setSelectedRouteId}
          />
          <SheltersPanel
            incident={incident}
            selectedShelterId={selectedShelterId}
            onSelectShelter={setSelectedShelterId}
          />
        </div>
      </div>
    </AppShell>
  );
}
