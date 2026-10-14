import { useQuery } from "@tanstack/react-query";

/**
 * Road routes from OSRM (free, open-source routing on OpenStreetMap data, no API key).
 * Uses the public demo server; set VITE_OSRM_URL to a self-hosted instance in production.
 * Callers fall back to straight lines if routing is unavailable.
 */
const OSRM_URL = import.meta.env.VITE_OSRM_URL ?? "https://router.project-osrm.org";

export type LatLng = [number, number];

export type RoadRoute = { points: LatLng[]; distanceKm: number; durationMin: number };

async function fetchRoute(waypoints: LatLng[], signal?: AbortSignal): Promise<RoadRoute> {
  const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const response = await fetch(`${OSRM_URL}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`, { signal });
  if (!response.ok) throw new Error(`Routing failed (${response.status})`);
  const data = await response.json();
  const route = data?.routes?.[0];
  if (data?.code !== "Ok" || !route) throw new Error("No route found");
  return {
    points: (route.geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng] as LatLng),
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
  };
}

/** Road route through the given waypoints (nulls skipped), cached per ~10 m rounded coordinates. */
export function useRoadRoute(waypoints: Array<LatLng | null | undefined>) {
  const points = waypoints.filter((p): p is LatLng => !!p);
  const key = points.map(([lat, lng]) => `${lat.toFixed(4)},${lng.toFixed(4)}`).join("|");
  return useQuery({
    queryKey: ["road-route", key],
    queryFn: ({ signal }) => fetchRoute(points, signal),
    enabled: points.length >= 2,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  });
}

export function formatDuration(minutes: number) {
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function haversineKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
