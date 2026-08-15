import { Progress } from "@/components/ui/progress";
import { SHELTER_META } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { FireIncident } from "@/types";
import { Panel } from "./Panel";

interface SheltersPanelProps {
  incident: FireIncident;
  selectedShelterId?: string | null;
  onSelectShelter?: (shelterId: string | null) => void;
}

export function SheltersPanel({
  incident,
  selectedShelterId,
  onSelectShelter,
}: SheltersPanelProps) {
  return (
    <Panel
      title="Shelters"
      right={
        <span className="text-xs text-muted-foreground">
          {incident.shelters.filter((s) => s.status === "open").length} open
        </span>
      }
      contentClassName="p-2"
    >
      <ul className="space-y-1">
        {incident.shelters.map((shelter) => {
          const meta = SHELTER_META[shelter.status];
          const pct = Math.round((shelter.occupied / shelter.capacity) * 100);
          const selected = selectedShelterId === shelter.id;
          return (
            <li key={shelter.id}>
              <button
                type="button"
                onClick={() => onSelectShelter?.(selected ? null : shelter.id)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                  selected
                    ? "border-sky-500/60 bg-sky-500/[0.06]"
                    : "border-transparent hover:bg-accent/60",
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[15px] font-semibold leading-6">
                    {shelter.name}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 text-xs font-medium",
                      meta.text,
                    )}
                  >
                    {meta.label}
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {shelter.occupied} / {shelter.capacity} occupied
                </p>
                <Progress value={pct} className="mt-2.5 h-1.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
