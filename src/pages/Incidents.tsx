import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { incidentApi } from "@/lib/api";
import { INCIDENT_STATUS_META, RISK_META } from "@/lib/status";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FireIncident, IncidentStatus } from "@/types";
import { ArrowUpRight, Flame, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

const FILTERS: { value: "all" | IncidentStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "contained", label: "Contained" },
  { value: "watch", label: "Watch" },
];

function IncidentRow({ incident }: { incident: FireIncident }) {
  const statusMeta = INCIDENT_STATUS_META[incident.status];
  const risk = RISK_META[incident.forecast[0].riskLevel];
  return (
    <Link
      to={`/incidents/${incident.id}`}
      className="group flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-card/50 p-4 transition-colors hover:border-border hover:bg-accent/40"
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg border",
            incident.status === "active"
              ? "border-orange-500/30 bg-orange-500/10 text-orange-400"
              : incident.status === "contained"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-amber-500/30 bg-amber-500/10 text-amber-400",
          )}
        >
          <Flame className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight">{incident.name}</h3>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                statusMeta.className,
              )}
            >
              {statusMeta.label}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
            {incident.locationLabel} · {incident.county}
          </p>
        </div>
      </div>        <div className="hidden shrink-0 grid-cols-[100px_110px_90px_90px] items-center gap-6 text-right md:grid">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Acres
          </p>
          <p className="text-[15px] font-semibold tabular-nums">
            {incident.stats.acresBurned.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Containment
          </p>
          <p className="text-[15px] font-semibold tabular-nums">
            {incident.stats.containmentPct}%
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Risk
          </p>
          <p className="text-[15px] font-semibold" style={{ color: risk.color }}>
            {risk.label}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Updated
          </p>
          <p className="text-[15px] text-foreground/80">
            {timeAgo(new Date(incident.reportedAt))}
          </p>
        </div>
      </div>

      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
    </Link>
  );
}

export default function Incidents() {
  const [incidents, setIncidents] = useState<FireIncident[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | IncidentStatus>("all");

  useEffect(() => {
    incidentApi.listIncidents().then(setIncidents);
  }, []);

  const filtered = useMemo(() => {
    if (!incidents) return null;
    const q = query.trim().toLowerCase();
    return incidents.filter((incident) => {
      const matchesFilter = filter === "all" || incident.status === filter;
      const matchesQuery =
        !q ||
        incident.name.toLowerCase().includes(q) ||
        incident.county.toLowerCase().includes(q) ||
        incident.region.toLowerCase().includes(q) ||
        incident.locationLabel.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [incidents, query, filter]);

  const activeCount =
    incidents?.filter((incident) => incident.status === "active").length ?? 0;
  const totalAcres =
    incidents?.reduce((sum, incident) => sum + incident.stats.acresBurned, 0) ?? 0;

  return (
    <AppShell active="incidents">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 lg:px-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Incident directory
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
            All incidents
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Every active, watched, and contained incident tracked by FireWatch.
            Open an incident to inspect its forecast, evacuation routes, and
            operations log.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, county, or region…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-card/50 p-1">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={cn(
                  "rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                  filter === item.value
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {incidents
            ? `${filtered?.length ?? 0} incident${(filtered?.length ?? 0) === 1 ? "" : "s"} · ${activeCount} active · ${totalAcres.toLocaleString()} acres combined`
            : "Loading…"}
        </p>

        <div className="space-y-2.5">
          {filtered === null ? (
            <>
              <Skeleton className="h-[76px] w-full rounded-xl" />
              <Skeleton className="h-[76px] w-full rounded-xl" />
              <Skeleton className="h-[76px] w-full rounded-xl" />
            </>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-border/70 bg-card/50 px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">
                No incidents match your search
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try a different name, county, or status filter.
              </p>
            </div>
          ) : (
            filtered.map((incident) => (
              <IncidentRow key={incident.id} incident={incident} />
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
