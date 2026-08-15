import { BellRing } from "lucide-react";
import { SEVERITY_META } from "@/lib/status";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import type { FireIncident } from "@/types";
import { Panel } from "./Panel";

export function AlertsPanel({ incident }: { incident: FireIncident }) {
  return (
    <Panel
      title="Alerts"
      icon={<BellRing className="size-4 text-amber-400" />}
      right={
        <span className="text-[11px] text-muted-foreground">
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
              className={cn(
                "border-l-2 px-4 py-3",
                meta.border,
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[15px] font-semibold leading-6">{alert.title}</p>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    meta.dot === "bg-red-500" &&
                      "bg-red-500/10 text-red-400",
                    meta.dot === "bg-amber-400" &&
                      "bg-amber-400/10 text-amber-400",
                    meta.dot === "bg-sky-400" &&
                      "bg-sky-400/10 text-sky-400",
                  )}
                >
                  {meta.label}
                </span>
              </div>
              <p className="mt-1 text-[13px] leading-6 text-muted-foreground">
                {alert.detail}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground/80">
                {alert.source} · {timeAgo(Date.now() - alert.ageMin * 60_000)}
              </p>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
