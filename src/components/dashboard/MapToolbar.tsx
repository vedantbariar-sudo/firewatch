import type { ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { Layers } from "lucide-react";
import type { FireIncident } from "@/types";
import type { LayerState } from "@/components/map/FireMap";

interface MapToolbarProps {
  incidents?: FireIncident[];
  selectedIncidentId?: string;
  onSelectIncident?: (id: string) => void;
  steps: string[];
  stepIndex: number;
  onStepChange: (index: number) => void;
  layers: LayerState;
  onLayersChange: (layers: LayerState) => void;
  right?: ReactNode;
}

export function MapToolbar({
  incidents,
  selectedIncidentId,
  onSelectIncident,
  steps,
  stepIndex,
  onStepChange,
  layers,
  onLayersChange,
  right,
}: MapToolbarProps) {
  const layerButtons: { key: keyof LayerState; label: string }[] = [
    { key: "perimeter", label: "Perimeter" },
    { key: "risk", label: "Risk" },
    { key: "routes", label: "Routes" },
    { key: "shelters", label: "Shelters" },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-card/50 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {incidents && onSelectIncident && (
          <Select value={selectedIncidentId} onValueChange={onSelectIncident}>
            <SelectTrigger className="h-8 w-[190px] text-sm">
              <SelectValue placeholder="Select incident" />
            </SelectTrigger>
            <SelectContent>
              {incidents.map((incident) => (
                <SelectItem key={incident.id} value={incident.id}>
                  {incident.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Tabs
          value={String(stepIndex)}
          onValueChange={(value) => onStepChange(Number(value))}
        >
          <TabsList className="h-8">
            {steps.map((step, index) => (
              <TabsTrigger key={step} value={String(index)} className="px-3 text-[13px]">
                {step}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Layers className="size-4" />
          Show:
        </span>
        {layerButtons.map(({ key, label }) => (
          <Toggle
            key={key}
            size="sm"
            variant="outline"
            pressed={layers[key]}
            onPressedChange={(pressed) =>
              onLayersChange({ ...layers, [key]: pressed })
            }
            aria-label={`Toggle ${label} layer`}
            className="h-8 px-3 text-[13px]"
          >
            {label}
          </Toggle>
        ))}
        {right}
      </div>
    </div>
  );
}
