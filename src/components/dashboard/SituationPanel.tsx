import { Progress } from "@/components/ui/progress";
import {
  ArrowUp,
  Cloud,
  Droplets,
  Flame,
  Thermometer,
  Wind,
} from "lucide-react";
import { RISK_META, RISK_ORDER } from "@/lib/status";
import { timeAgo, windArrowRotation, windCardinal } from "@/lib/format";
import type { FireIncident } from "@/types";
import { Panel } from "./Panel";

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
      {sub}
    </div>
  );
}

interface SituationPanelProps {
  incident: FireIncident;
  stepIndex: number;
}

/**
 * Fire status + weather + model risk grouped into one compact block with
 * light internal dividers — one visual unit instead of three separate cards.
 */
export function SituationPanel({ incident, stepIndex }: SituationPanelProps) {
  const step = incident.forecast[Math.min(stepIndex, incident.forecast.length - 1)];
  const weather = step.weather;
  const risk = RISK_META[step.riskLevel];
  const stats = incident.stats;

  const zoneLevels = RISK_ORDER.filter((level) =>
    step.riskZones.some((zone) => zone.level === level),
  );

  return (
    <Panel
      title="Situation"
      icon={<Flame className="size-4 text-orange-400" />}
      right={
        <span
          className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
          style={{
            color: risk.color,
            borderColor: `${risk.color}66`,
            backgroundColor: `${risk.color}14`,
          }}
        >
          {risk.label} risk
        </span>
      }
      contentClassName="p-0"
    >
      <div className="divide-y divide-border/60">
        {/* Fire status */}
        <div className="grid grid-cols-3 gap-3 p-4">
          <Stat
            label="Containment"
            value={`${stats.containmentPct}%`}
            sub={<Progress value={stats.containmentPct} className="mt-1.5" />}
          />
          <Stat label="Acres burned" value={stats.acresBurned.toLocaleString()} />
          <Stat
            label="Satellite pass"
            value={timeAgo(Date.now() - stats.lastSatellitePassMin * 60_000)}
            sub={
              <p className="mt-0.5 text-xs text-muted-foreground">
                last check
              </p>
            }
          />
        </div>

        {/* Weather */}
        <div className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Weather — {step.label}
          </p>
          <div className="mt-2 grid grid-cols-[auto_1fr] items-start gap-4">
            <div className="flex items-start gap-1.5">
              <Thermometer className="mt-1 size-4 text-amber-400" />
              <div>
                <span className="text-3xl font-semibold tabular-nums tracking-tight">
                  {weather.tempC}°
                </span>
                <span className="ml-1 text-sm text-muted-foreground">C</span>
                <p className="mt-0.5 max-w-[150px] text-xs leading-5 text-muted-foreground">
                  {weather.conditions}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Wind className="size-3.5 text-sky-400" />
                  Wind
                </span>
                <span className="flex items-center gap-2 text-sm font-medium tabular-nums">
                  <ArrowUp
                    className="size-3.5 text-sky-400"
                    style={{
                      transform: `rotate(${windArrowRotation(weather.windDirectionDeg)}deg)`,
                    }}
                  />
                  {weather.windSpeedKmh} km/h · {windCardinal(weather.windDirectionDeg)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Droplets className="size-3.5 text-sky-400" />
                  Humidity
                </span>
                <span className="text-sm font-medium tabular-nums">
                  {weather.humidityPct}%
                </span>
              </div>
              {weather.windGustKmh && (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Cloud className="size-3.5 text-sky-400" />
                    Gusts
                  </span>
                  <span className="text-sm font-medium tabular-nums">
                    {weather.windGustKmh} km/h
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Model outlook */}
        <div className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Fire spread — {step.spreadKmh} km/h
          </p>
          <p className="mt-1.5 text-[15px] leading-7 text-foreground/90">
            {step.riskNote}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {zoneLevels.map((level) => (
              <span
                key={level}
                className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
                style={{
                  color: RISK_META[level].color,
                  borderColor: `${RISK_META[level].color}55`,
                }}
              >
                {RISK_META[level].label} risk
              </span>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}
