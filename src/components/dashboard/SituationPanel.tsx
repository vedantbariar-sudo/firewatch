import { Progress } from "@/components/ui/progress";
import { RISK_META, RISK_ORDER } from "@/lib/status";
import { timeAgo, windCardinal } from "@/lib/format";
import type { FireIncident } from "@/types";
import { Panel } from "./Panel";

interface SituationPanelProps {
  incident: FireIncident;
  stepIndex: number;
}

/**
 * Fire status + weather + model risk grouped into one compact block with
 * light internal dividers — one visual unit instead of three separate cards.
 */
export function SituationPanel({ incident, stepIndex }: SituationPanelProps) {
  const step =
    incident.forecast[Math.min(stepIndex, incident.forecast.length - 1)];
  const weather = step.weather;
  const risk = RISK_META[step.riskLevel];
  const stats = incident.stats;

  const zoneLevels = RISK_ORDER.filter((level) =>
    step.riskZones.some((zone) => zone.level === level),
  );

  return (
    <Panel
      title="Situation"
      right={
        <span className="text-sm font-medium" style={{ color: risk.color }}>
          {risk.label} risk
        </span>
      }
      contentClassName="p-0"
    >
      <div className="divide-y divide-border/60">
        {/* Fire status */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3.5">
          <div>
            <p className="text-xs text-muted-foreground">Containment</p>
            <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">
              {stats.containmentPct}%
            </p>
            <Progress value={stats.containmentPct} className="mt-2 h-1.5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Acres burned</p>
            <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">
              {stats.acresBurned.toLocaleString()}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Satellite pass{" "}
              {timeAgo(Date.now() - stats.lastSatellitePassMin * 60_000)}
            </p>
          </div>
        </div>

        {/* Weather */}
        <div className="px-4 py-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-foreground">Weather</p>
            <p className="text-xs text-muted-foreground">{step.label}</p>
          </div>
          <div className="mt-2.5 flex items-end justify-between gap-4">
            <div>
              <span className="text-3xl font-semibold tabular-nums tracking-tight">
                {weather.tempC}°
              </span>
              <span className="ml-1.5 text-sm text-muted-foreground">
                C · {weather.conditions}
              </span>
            </div>
            <div className="space-y-1 text-right text-sm">
              <p className="text-muted-foreground">
                Wind{" "}
                <span className="font-medium text-foreground">
                  {weather.windSpeedKmh} km/h{" "}
                  {windCardinal(weather.windDirectionDeg)}
                </span>
              </p>
              <p className="text-muted-foreground">
                Humidity{" "}
                <span className="font-medium text-foreground">
                  {weather.humidityPct}%
                </span>
              </p>
              {weather.windGustKmh && (
                <p className="text-muted-foreground">
                  Gusts{" "}
                  <span className="font-medium text-foreground">
                    {weather.windGustKmh} km/h
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Spread outlook */}
        <div className="px-4 py-3.5">
          <p className="text-sm font-medium text-foreground">
            Fire spread · {step.spreadKmh} km/h
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {step.riskNote}
          </p>
          {zoneLevels.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Zones at risk:{" "}
              {zoneLevels.map((level, index) => (
                <span key={level}>
                  {index > 0 && ", "}
                  <span style={{ color: RISK_META[level].color }}>
                    {RISK_META[level].label.toLowerCase()}
                  </span>
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
