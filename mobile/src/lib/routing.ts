import { useQuery } from "@tanstack/react-query";

/**
 * Road routes from OSRM (free, open-source routing on OpenStreetMap data, no API key).
 * Uses the public demo server; swap OSRM_URL for a self-hosted instance in production.
 * If routing fails, callers fall back to straight lines so the map always works.
 */
const OSRM_URL = process.env.EXPO_PUBLIC_OSRM_URL ?? "https://router.project-osrm.org";

export type LatLng = { lat: number; lng: number };

export type RouteLeg = { distanceKm: number; durationMin: number };

export type RoadRoute = {
  /** Path along the roads, in order. */
  points: LatLng[];
  distanceKm: number;
  durationMin: number;
  /** One entry per segment between consecutive waypoints. */
  legs: RouteLeg[];
};

async function fetchRoute(waypoints: LatLng[], signal?: AbortSignal): Promise<RoadRoute> {
  const coords = waypoints.map((p) => `${p.lng},${p.lat}`).join(";");
  const response = await fetch(`${OSRM_URL}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`, { signal });
  if (!response.ok) throw new Error(`Routing failed (${response.status})`);
  const data = await response.json();
  const route = data?.routes?.[0];
  if (data?.code !== "Ok" || !route) throw new Error("No route found");

  return {
    points: (route.geometry.coordinates as [number, number][]).map(([lng, lat]) => ({ lat, lng })),
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
    legs: (route.legs ?? []).map((leg: { distance: number; duration: number }) => ({
      distanceKm: leg.distance / 1000,
      durationMin: leg.duration / 60,
    })),
  };
}

/** Road route through the given waypoints (null entries are skipped). Cached per rounded coordinates. */
export function useRoadRoute(waypoints: Array<LatLng | null | undefined>) {
  const points = waypoints.filter((p): p is LatLng => !!p);
  // ~10 m precision so tiny GPS jitter doesn't refetch.
  const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|");

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
