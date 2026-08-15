import { Home, Users } from "lucide-react";
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
      icon={<Home className="size-4 text-sky-400" />}
      right={
        <span className="text-[11px] text-muted-foreground">
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
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-semibold leading-6">
                      {shelter.name}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[13px] text-muted-foreground">
                      <Users className="size-3.5" />
                      {shelter.occupied} / {shelter.capacity} occupied
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      meta.dot === "bg-emerald-400" &&
                        "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
                      meta.dot === "bg-amber-400" &&
                        "border-amber-500/40 bg-amber-500/10 text-amber-400",
                      meta.dot === "bg-red-400" &&
                        "border-red-500/40 bg-red-500/10 text-red-400",
                    )}
                  >
                    {meta.label}
                  </span>
                </div>
                <Progress value={pct} className="mt-2.5 h-1.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
