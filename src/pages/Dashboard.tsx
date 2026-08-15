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
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowUpRight, Radio } from "lucide-react";
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
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Operations console
            </p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
              {firstName ? `Welcome back, ${firstName}` : "Incident overview"}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-400">
              <Radio className="size-3 animate-pulse" />
              Live
            </span>
            <span>Data refreshed 2 min ago</span>
          </div>
        </div>

        <StatsStrip incident={incident} />

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
                  className="flex h-7 items-center gap-1 rounded-md border border-border/70 bg-background/60 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                >
                  Open brief
                  <ArrowUpRight className="size-3.5" />
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
