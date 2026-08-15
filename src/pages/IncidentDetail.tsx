import { AppShell } from "@/components/layout/AppShell";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { EvacuationPanel } from "@/components/dashboard/EvacuationPanel";
import { MapToolbar } from "@/components/dashboard/MapToolbar";
import { Panel } from "@/components/dashboard/Panel";
import { SituationPanel } from "@/components/dashboard/SituationPanel";
import { GuideToShelter } from "@/components/dashboard/GuideToShelter";
import { ALL_LAYERS, FireMap } from "@/components/map/FireMap";
import type { LayerState } from "@/components/map/FireMap";
import { Skeleton } from "@/components/ui/skeleton";
import { incidentApi } from "@/lib/api";
import { generateRouteToShelter } from "@/lib/route";
import { INCIDENT_STATUS_META } from "@/lib/status";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FireIncident } from "@/types";
import { ChevronRight, Flame, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const [incident, setIncident] = useState<FireIncident | null | "loading">(
    "loading",
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [layers, setLayers] = useState<LayerState>(ALL_LAYERS);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedShelterId, setSelectedShelterId] = useState<string | null>(null);

  useEffect(() => {
    setIncident("loading");
    setStepIndex(0);
    setSelectedRouteId(null);
    setSelectedShelterId(null);
    if (!id) {
      setIncident(null);
      return;
    }
    incidentApi.getIncident(id).then((result) => setIncident(result));
  }, [id]);

  const selectedShelter =
    incident && typeof incident !== "string"
      ? incident.shelters.find((item) => item.id === selectedShelterId) ?? null
      : null;

  /** Generated route to the chosen shelter, re-run per forecast step. */
  const guidanceRoute = useMemo(() => {
    if (!incident || typeof incident === "string" || !selectedShelter) {
      return null;
    }
    return generateRouteToShelter(incident, stepIndex, selectedShelter);
  }, [incident, stepIndex, selectedShelter]);

  if (incident === "loading") {
    return (
      <AppShell active="incidents">
        <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-5 lg:px-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-10 w-80" />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-4">
              <Skeleton className="h-[480px] w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
            <Skeleton className="h-[560px] w-full rounded-xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!incident) {
    return (
      <AppShell active="incidents">
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <Flame className="mx-auto size-8 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold tracking-tight">
            Incident not found
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This incident may have been resolved or the link is out of date.
          </p>
          <Link
            to="/incidents"
            className="mt-6 inline-flex h-9 items-center rounded-md border border-border/70 bg-background/60 px-4 text-sm font-medium transition-colors hover:bg-accent"
          >
            Back to incident directory
          </Link>
        </div>
      </AppShell>
    );
  }

  const statusMeta = INCIDENT_STATUS_META[incident.status];

  return (
    <AppShell active="incidents">
      <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-5 lg:px-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/incidents" className="transition-colors hover:text-foreground">
            Incidents
          </Link>
          <ChevronRight className="size-3" />
          <span className="font-medium text-foreground">{incident.name}</span>
        </nav>

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h1 className="text-2xl font-semibold tracking-tight">
                {incident.name}
              </h1>
              <span className={cn("text-sm font-medium", statusMeta.text)}>
                {statusMeta.label}
              </span>
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-3.5" />
              {incident.locationLabel} · {incident.county} · reported{" "}
              {timeAgo(new Date(incident.reportedAt))}
            </p>
          </div>
          <div className="flex items-center gap-6 text-right">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Acres burned
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {incident.stats.acresBurned.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Containment
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {incident.stats.containmentPct}%
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Left column */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2.5">
              <MapToolbar
                steps={incident.forecast.map((step) => step.label)}
                stepIndex={stepIndex}
                onStepChange={setStepIndex}
                layers={layers}
                onLayersChange={setLayers}
              />
              <FireMap
                incident={incident}
                stepIndex={stepIndex}
                layers={layers}
                selectedRouteId={selectedRouteId}
                selectedShelterId={selectedShelterId}
                guidanceRoute={guidanceRoute}
                onSelectRoute={setSelectedRouteId}
                onSelectShelter={setSelectedShelterId}
                className="h-[420px] lg:h-[500px]"
              />
            </div>

            <Panel title="Incident summary">
              <p className="text-sm leading-6 text-foreground/90">
                {incident.description}
              </p>
            </Panel>

            <GuideToShelter
              incident={incident}
              stepIndex={stepIndex}
              selectedShelterId={selectedShelterId}
              onSelectShelter={setSelectedShelterId}
              guidanceRoute={guidanceRoute}
            />
          </div>

          {/* Right rail */}
          <div className="flex flex-col gap-4">
            <SituationPanel incident={incident} stepIndex={stepIndex} />
            <EvacuationPanel incident={incident} stepIndex={stepIndex} />
            <AlertsPanel incident={incident} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
