import { SEVERITY_META } from "@/lib/status";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import type { FireIncident } from "@/types";
import { Panel } from "./Panel";

export function AlertsPanel({ incident }: { incident: FireIncident }) {
  return (
    <Panel
      title="Alerts"
      right={
        <span className="text-xs text-muted-foreground">
          {incident.alerts.length} active
        </span>
      }
      contentClassName="p-0"
    >
      <ul className="divide-y divide-border/60">
        {incident.alerts.map((alert) => {
          const meta = SEVERITY_META[alert.severity];
          return (
            <li
              key={alert.id}
              className={cn("border-l-2 px-4 py-3", meta.border)}
            >
              <p className="text-[15px] font-semibold leading-6">
                {alert.title}
              </p>
              <p className="mt-0.5 text-[13px] leading-6 text-muted-foreground">
                {alert.detail}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/80">
                {alert.source} · {timeAgo(Date.now() - alert.ageMin * 60_000)}
              </p>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
