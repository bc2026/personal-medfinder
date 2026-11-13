import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import {
  hasStockSignal,
  latestStatus,
  mapMarkerColor,
  STATUS_LABELS,
} from "../lib/status";
import type { Pharmacy, PharmacyStatus } from "../types";
import "leaflet/dist/leaflet.css";

function markerIcon(status: PharmacyStatus) {
  const color = mapMarkerColor(status);
  return L.divIcon({
    className: "stock-map-marker",
    html: `<span style="background:${color};width:16px;height:16px;border-radius:50%;border:2px solid var(--color-surface-elevated);box-shadow:0 1px 4px rgba(0,0,0,.35);display:block"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 14 });
  }, [map, points]);

  return null;
}

interface StockMapProps {
  pharmacies: Pharmacy[];
  stockOnly?: boolean;
  /** When true, map fills a parent `.card` without an extra inner border. */
  embedded?: boolean;
  className?: string;
}

export function StockMap({
  pharmacies,
  stockOnly = false,
  embedded = false,
  className = "",
}: StockMapProps) {
  const mappable = useMemo(
    () =>
      pharmacies.filter(
        (p): p is Pharmacy & { lat: number; lng: number } =>
          p.lat != null && p.lng != null
      ),
    [pharmacies]
  );

  const visible = useMemo(() => {
    if (!stockOnly) return mappable;
    return mappable.filter((p) =>
      hasStockSignal(latestStatus(p.contactLogs))
    );
  }, [mappable, stockOnly]);

  const points = useMemo(
    () => visible.map((p) => [p.lat, p.lng] as [number, number]),
    [visible]
  );

  const stockCount = mappable.filter((p) =>
    hasStockSignal(latestStatus(p.contactLogs))
  ).length;

  if (mappable.length === 0) {
    return (
      <div
        className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6 text-sm text-[var(--color-muted)] ${className}`}
      >
        No pharmacies have map coordinates for this session. Locations from
        OpenStreetMap or Google Places include coordinates; mock data may not.
      </div>
    );
  }

  const center = points[0] ?? [mappable[0].lat!, mappable[0].lng!];

  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-[var(--color-muted)]">
          {visible.length} on map
          {stockOnly ? " (stock signals only)" : ""}
          {" · "}
          <span className="font-medium text-[var(--color-success)]">
            {stockCount} with stock signal
          </span>
        </span>
        <MapLegend />
      </div>
      <p className="mb-2 text-xs text-[var(--color-muted)]">
        Use the map’s + / − controls or pinch to zoom. Scroll wheel zoom is off to avoid accidental zoom.
      </p>

      {stockOnly && visible.length === 0 && (
        <p className="mb-2 text-sm text-[var(--color-muted)]">
          No pharmacies marked in stock, partial stock, or will order yet. Turn
          off “Stock only” to see all locations.
        </p>
      )}

      <div
        className={`overflow-hidden h-[min(420px,55vh)] min-h-[280px] z-0 ${
          embedded
            ? "rounded-[calc(1rem-1px)]"
            : "rounded-xl border border-[var(--color-border)]"
        }`}
      >
        <MapContainer
          center={center}
          zoom={12}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={points} />
          {visible.map((p) => {
            const status = latestStatus(p.contactLogs);
            const log = p.contactLogs[0];
            return (
              <Marker
                key={p.id}
                position={[p.lat, p.lng]}
                icon={markerIcon(status)}
              >
                <Popup>
                  <div className="min-w-[180px] text-sm">
                    <p className="stock-map-popup-name">{p.name}</p>
                    <p className="stock-map-popup-muted mt-0.5">{p.address}</p>
                    {p.distanceMiles != null && (
                      <p className="stock-map-popup-muted mt-1 text-xs">
                        {p.distanceMiles} mi away
                      </p>
                    )}
                    <p
                      className="stock-map-popup-status mt-2"
                      style={{ color: mapMarkerColor(status) }}
                    >
                      {STATUS_LABELS[status]}
                    </p>
                    {log?.note && (
                      <p className="stock-map-popup-muted mt-1 text-xs line-clamp-3">
                        {log.note}
                      </p>
                    )}
                    {p.phone && (
                      <a
                        href={`tel:${p.phone.replace(/\D/g, "")}`}
                        className="stock-map-popup-link"
                      >
                        {p.phone}
                      </a>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {mappable.length < pharmacies.length && (
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          {pharmacies.length - mappable.length} pharmacies hidden (no coordinates).
        </p>
      )}
    </div>
  );
}

function MapLegend() {
  const items: { status: PharmacyStatus; label: string }[] = [
    { status: "in_stock", label: "In stock" },
    { status: "partial_stock", label: "Partial" },
    { status: "will_order", label: "Will order" },
    { status: "out_of_stock", label: "Out" },
    { status: "called", label: "Called" },
    { status: "not_contacted", label: "Not contacted" },
  ];

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {items.map(({ status, label }) => (
        <span key={status} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: mapMarkerColor(status) }}
          />
          <span className="text-xs text-[var(--color-muted)]">{label}</span>
        </span>
      ))}
    </div>
  );
}
