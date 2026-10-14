import { useEffect, useRef, type ReactNode } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { makeDotIcon } from "@/components/operations/map-markers";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

// Leaflet's default pin images don't resolve through Vite, so markers without an explicit
// icon rendered as broken images. Use the themed dot everywhere instead.
L.Marker.prototype.options.icon = makeDotIcon("bg-primary");

// Free OpenStreetMap tiles, no API key. Dark mode reuses them with a CSS filter (.map-dark in index.css).
const OSM_TILE = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "&copy; OpenStreetMap contributors",
};

/** Re-measure the map whenever its container changes size (sheets, dialogs, grid reflow). */
function AutoResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    // Also once after open animations (sheet slide-in) settle.
    const timer = window.setTimeout(() => map.invalidateSize(), 350);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [map]);
  return null;
}

/** Zoom to show every given point, once, when they first become available. */
function FitOnce({ points }: { points?: Array<[number, number]> }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !points?.length) return;
    done.current = true;
    if (points.length === 1) map.setView(points[0], Math.max(map.getZoom(), 14));
    else map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 15 });
  }, [map, points]);
  return null;
}

/**
 * Leaflet map with free OpenStreetMap tiles (no API key); dark mode inverts them.
 * Children are react-leaflet layers (Marker, Polyline, Popup...) or `useMap` helpers.
 */
export function MapView({
  center,
  zoom = 13,
  fitTo,
  className,
  children,
}: {
  center: [number, number];
  zoom?: number;
  /** Points to fit in view on first load. */
  fitTo?: Array<[number, number]>;
  className?: string;
  children?: ReactNode;
}) {
  const { theme } = useTheme();

  return (
    <MapContainer center={center} zoom={zoom} className={cn("z-0 h-full w-full", theme === "dark" && "map-dark", className)} scrollWheelZoom>
      <TileLayer attribution={OSM_TILE.attribution} url={OSM_TILE.url} maxZoom={19} />
      <AutoResize />
      <FitOnce points={fitTo} />
      {children}
    </MapContainer>
  );
}

