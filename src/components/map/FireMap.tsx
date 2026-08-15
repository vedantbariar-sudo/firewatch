import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  LayerGroup,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import { cn } from "@/lib/utils";
import { RISK_META, ROUTE_META } from "@/lib/status";
import type {
  FireIncident,
  RiskLevel,
  Shelter,
  ShelterStatus,
} from "@/types";

const CARTO_DARK =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const OSM_FALLBACK = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const RISK_FILL_OPACITY: Record<RiskLevel, number> = {
  low: 0.1,
  moderate: 0.12,
  high: 0.17,
  extreme: 0.22,
  catastrophic: 0.28,
};

const RISK_ORDER: RiskLevel[] = [
  "low",
  "moderate",
  "high",
  "extreme",
  "catastrophic",
];

function Tiles() {
  const [url, setUrl] = useState(CARTO_DARK);
  return (
    <TileLayer
      url={url}
      maxZoom={18}
      attribution={ATTRIBUTION}
      eventHandlers={{
        tileerror: () => setUrl((current) =>
          current === OSM_FALLBACK ? current : OSM_FALLBACK,
        ),
      }}
    />
  );
}

/** Fit the view to the incident's data once per incident (not per step scrub). */
function FitBounds({ incident }: { incident: FireIncident }) {
  const map = useMap();
  const fittedId = useRef<string | null>(null);
  useEffect(() => {
    if (fittedId.current === incident.id) return;
    fittedId.current = incident.id;
    const points: [number, number][] = [
      ...incident.perimeter,
      incident.fireFront,
    ];
    for (const step of incident.forecast) {
      for (const zone of step.riskZones) points.push(...zone.polygon);
    }
    for (const route of incident.routes) points.push(...route.path);
    for (const shelter of incident.shelters) points.push(shelter.location);
    map.fitBounds(L.latLngBounds(points), { padding: [30, 30] });
  }, [incident, map]);
  return null;
}

function shelterIcon(status: ShelterStatus, selected = false) {
  const color =
    status === "open" ? "#34d399" : status === "at-capacity" ? "#fbbf24" : "#f87171";
  const size = selected ? 40 : 32;
  return L.divIcon({
    className: "fw-shelter-marker",
    html: `<div class="relative flex items-center justify-center rounded-full border-2 bg-[#05070c]/95 shadow-[0_0_0_3px_rgba(0,0,0,0.45)] ${selected ? "ring-2 ring-white/80" : ""}" style="border-color:${color};width:${size}px;height:${size}px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const frontIcon = L.divIcon({
  className: "fw-fire-front",
  html: `<span class="relative flex h-5 w-5"><span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-500 opacity-60"></span><span class="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white/90 bg-orange-500"></span></span>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

export interface LayerState {
  perimeter: boolean;
  risk: boolean;
  routes: boolean;
  shelters: boolean;
}

export const ALL_LAYERS: LayerState = {
  perimeter: true,
  risk: true,
  routes: true,
  shelters: true,
};

interface FireMapProps {
  incident: FireIncident;
  stepIndex?: number;
  selectedRouteId?: string | null;
  selectedShelterId?: string | null;
  onSelectRoute?: (routeId: string | null) => void;
  onSelectShelter?: (shelterId: string | null) => void;
  onOpenIncident?: () => void;
  /** Disables pan/zoom and controls — used for the landing preview. */
  interactive?: boolean;
  showLegend?: boolean;
  /** Toggle individual layers; defaults to everything visible. */
  layers?: Partial<LayerState>;
  className?: string;
}

export function FireMap({
  incident,
  stepIndex = 0,
  selectedRouteId,
  selectedShelterId,
  onSelectRoute,
  onSelectShelter,
  onOpenIncident,
  interactive = true,
  showLegend = true,
  layers,
  className,
}: FireMapProps) {
  const visible = { ...ALL_LAYERS, ...layers };
  const step = incident.forecast[Math.min(stepIndex, incident.forecast.length - 1)];
  const zones = useMemo(
    () =>
      [...step.riskZones].sort(
        (a, b) => RISK_ORDER.indexOf(a.level) - RISK_ORDER.indexOf(b.level),
      ),
    [step],
  );
  const routeStatuses = useMemo(() => {
    const statuses = new Set(
      incident.routes.map((route) => route.statusByStep[stepIndex] ?? "open"),
    );
    return statuses;
  }, [incident.routes, stepIndex]);

  const stop = (event: { originalEvent: MouseEvent }) => {
    L.DomEvent.stopPropagation(event.originalEvent);
  };

  return (
    <div className={cn("relative z-0 isolate overflow-hidden rounded-xl border border-border/70 bg-[#070b11]", className)}>
      <MapContainer
        center={incident.fireFront}
        zoom={11}
        className="h-full w-full"
        zoomControl={interactive}
        dragging={interactive}
        scrollWheelZoom={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        keyboard={interactive}
        attributionControl={true}
      >
        <Tiles />
        <FitBounds incident={incident} />

        {/* Risk zones for the selected forecast step */}
        {visible.risk && (
          <LayerGroup>
            {zones.map((zone) => {
              const meta = RISK_META[zone.level];
              return (
                <Polygon
                  key={`${step.label}-${zone.id}`}
                  positions={zone.polygon}
                  interactive={false}
                  pathOptions={{
                    color: meta.color,
                    weight: 1.25,
                    fillColor: meta.color,
                    fillOpacity: RISK_FILL_OPACITY[zone.level],
                    dashArray: "4 5",
                  }}
                >
                  <Tooltip sticky direction="center">
                    {zone.label ?? meta.label} risk
                  </Tooltip>
                </Polygon>
              );
            })}
          </LayerGroup>
        )}

        {/* Active perimeter — click to open the incident brief */}
        {visible.perimeter && (
          <Polygon
            positions={incident.perimeter}
            pathOptions={{
              color: "#fbbf24",
              weight: 2,
              fillColor: "#f97316",
              fillOpacity: 0.28,
              dashArray: "7 5",
            }}
            eventHandlers={{
              click: (event) => {
                stop(event);
                onOpenIncident?.();
              },
            }}
          >
            <Tooltip sticky>
              {incident.name} — active perimeter ({incident.stats.acresBurned.toLocaleString()} acres)
            </Tooltip>
          </Polygon>
        )}

        {visible.perimeter && incident.status === "active" && (
          <Marker position={incident.fireFront} icon={frontIcon} interactive={false}>
            <Tooltip direction="top" offset={[0, -10]}>
              Fire front
            </Tooltip>
          </Marker>
        )}

        {/* Evacuation routes */}
        {visible.routes && (
          <LayerGroup>
            {incident.routes.map((route) => {
              const status = route.statusByStep[stepIndex] ?? "open";
              const meta = ROUTE_META[status];
              const selected = selectedRouteId === route.id;
              const weight =
                selected ? 6 : status === "recommended" ? 5 : status === "open" ? 3.5 : 3;
              return (
                <Polyline
                  key={route.id}
                  positions={route.path}
                  pathOptions={{
                    color: meta.color,
                    weight,
                    opacity: selected ? 1 : 0.9,
                    dashArray: meta.dash,
                    lineCap: "round",
                  }}
                  eventHandlers={{
                    click: (event) => {
                      stop(event);
                      onSelectRoute?.(route.id);
                    },
                  }}
                >
                  <Tooltip sticky direction="top">
                    <span className="font-medium">{route.name}</span>
                    <span className="ml-2 text-xs opacity-80">{meta.label}</span>
                  </Tooltip>
                </Polyline>
              );
            })}
          </LayerGroup>
        )}

        {/* Shelters */}
        {visible.shelters && (
          <LayerGroup>
            {incident.shelters.map((shelter: Shelter) => (
              <Marker
                key={shelter.id}
                position={shelter.location}
                icon={shelterIcon(shelter.status, shelter.id === selectedShelterId)}
                eventHandlers={{
                  click: () => onSelectShelter?.(shelter.id),
                }}
              >
                <Tooltip direction="top" offset={[0, -12]}>
                  <span className="font-medium">{shelter.name}</span>
                  <span className="ml-2 text-xs opacity-80">
                    {shelter.occupied}/{shelter.capacity} occupied
                  </span>
                </Tooltip>
              </Marker>
            ))}
          </LayerGroup>
        )}
      </MapContainer>

      {/* Forecast HUD chip */}
      <div className="pointer-events-none absolute left-3 top-3 z-[800] rounded-md border border-border/60 bg-[#0a0f16]/85 px-3 py-2 text-sm text-foreground/90 backdrop-blur">
        <span className="font-medium text-foreground">{step.label}</span>
        <span className="mx-2 text-border">·</span>
        <span>{step.spreadKmh} km/h spread</span>
        <span className="mx-2 text-border">·</span>
        <span className="font-medium" style={{ color: RISK_META[step.riskLevel].color }}>
          {RISK_META[step.riskLevel].label} risk
        </span>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[800] max-w-[260px] rounded-lg border border-border/60 bg-[#0a0f16]/85 p-3.5 text-[13px] leading-6 text-foreground/90 backdrop-blur">
          {visible.perimeter && (
            <div className="flex items-center gap-2">
              <span className="h-[3px] w-4 rounded-full border-t-2 border-dashed border-amber-300" />
              Active perimeter
            </div>
          )}
          {visible.risk &&
            zones.map((zone) => (
              <div key={zone.id} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: RISK_META[zone.level].color }}
                />
                {RISK_META[zone.level].label} risk
              </div>
            ))}
          {visible.routes &&
            [...routeStatuses].map((status) => (
              <div key={status} className="flex items-center gap-2">
                <span
                  className="h-[3px] w-4 rounded-full"
                  style={{
                    backgroundColor: ROUTE_META[status].color,
                    ...(ROUTE_META[status].dash
                      ? { backgroundImage: `repeating-linear-gradient(90deg, ${ROUTE_META[status].color} 0 4px, transparent 4px 8px)` }
                      : {}),
                  }}
                />
                {ROUTE_META[status].label}
              </div>
            ))}
          {visible.shelters && (
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-emerald-400" />
              Shelter
            </div>
          )}
        </div>
      )}
    </div>
  );
}
