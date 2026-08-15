import type {
  AlertSeverity,
  IncidentStatus,
  RiskLevel,
  RouteStatus,
  ShelterStatus,
} from "@/types";

/** Label + color lookup maps shared by the map, panels, and pages. */

export const RISK_META: Record<
  RiskLevel,
  { label: string; color: string; fill: string; dot: string }
> = {
  low: { label: "Low", color: "#4ade80", fill: "#4ade80", dot: "bg-emerald-400" },
  moderate: { label: "Moderate", color: "#facc15", fill: "#facc15", dot: "bg-yellow-400" },
  high: { label: "High", color: "#fb923c", fill: "#fb923c", dot: "bg-orange-400" },
  extreme: { label: "Extreme", color: "#f43f5e", fill: "#f43f5e", dot: "bg-rose-500" },
  catastrophic: { label: "Catastrophic", color: "#dc2626", fill: "#dc2626", dot: "bg-red-600" },
};

export const RISK_ORDER: RiskLevel[] = [
  "low",
  "moderate",
  "high",
  "extreme",
  "catastrophic",
];

export const ROUTE_META: Record<
  RouteStatus,
  { label: string; color: string; dash: string; dot: string }
> = {
  recommended: { label: "Recommended", color: "#10b981", dash: "", dot: "bg-emerald-500" },
  open: { label: "Open", color: "#64748b", dash: "6 6", dot: "bg-slate-400" },
  caution: { label: "Caution", color: "#f59e0b", dash: "8 6", dot: "bg-amber-500" },
  closed: { label: "Closed", color: "#ef4444", dash: "4 4", dot: "bg-red-500" },
};

export const SHELTER_META: Record<
  ShelterStatus,
  { label: string; dot: string; text: string }
> = {
  open: { label: "Open", dot: "bg-emerald-400", text: "text-emerald-400" },
  "at-capacity": { label: "At capacity", dot: "bg-amber-400", text: "text-amber-400" },
  closing: { label: "Closing", dot: "bg-red-400", text: "text-red-400" },
};

export const SEVERITY_META: Record<
  AlertSeverity,
  { label: string; dot: string; text: string; border: string }
> = {
  critical: {
    label: "Critical",
    dot: "bg-red-500",
    text: "text-red-400",
    border: "border-l-red-500",
  },
  warning: {
    label: "Warning",
    dot: "bg-amber-400",
    text: "text-amber-400",
    border: "border-l-amber-400",
  },
  advisory: {
    label: "Advisory",
    dot: "bg-sky-400",
    text: "text-sky-400",
    border: "border-l-sky-400",
  },
};

export const INCIDENT_STATUS_META: Record<
  IncidentStatus,
  { label: string; className: string; text: string }
> = {
  active: { label: "Active", className: "border-red-500/40 bg-red-500/10 text-red-400", text: "text-red-400" },
  contained: { label: "Contained", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400", text: "text-emerald-400" },
  watch: { label: "Watch", className: "border-amber-500/40 bg-amber-500/10 text-amber-400", text: "text-amber-400" },
};
