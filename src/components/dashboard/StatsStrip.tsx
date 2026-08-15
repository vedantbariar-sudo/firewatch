import type { FireIncident } from "@/types";

interface StatsStripProps {
  incident: FireIncident;
}

/** One row of headline numbers — hairline dividers, no boxed cards. */
export function StatsStrip({ incident }: StatsStripProps) {
  const stats = incident.stats;
  const items = [
    { label: "Acres burned", value: stats.acresBurned.toLocaleString() },
    { label: "Containment", value: `${stats.containmentPct}%` },
    { label: "Personnel", value: stats.personnel.toLocaleString() },
    {
      label: "Shelters open",
      value: String(
        incident.shelters.filter((s) => s.status === "open").length,
      ),
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/70 bg-border/70 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-card/50 px-4 py-3.5">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
