import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

type LiveLocation = {
  driver_id: number;
  lat: number | string;
  lng: number | string;
  updated_at?: string;
  driver?: { user?: { name: string } };
};

// Accept all possible backend response shapes
type LiveLocationsResponse =
  | LiveLocation[]
  | { locations: LiveLocation[] }
  | { data: LiveLocation[] }
  | Record<string, unknown>;

function extractLocations(payload: LiveLocationsResponse): LiveLocation[] {
  // If backend returns an array directly
  if (Array.isArray(payload)) return payload;

  // If backend returns { locations: [...] }
  const maybeLocations = (payload as any)?.locations;
  if (Array.isArray(maybeLocations)) return maybeLocations;

  // If backend returns { data: [...] } (common Laravel Resource shape)
  const maybeData = (payload as any)?.data;
  if (Array.isArray(maybeData)) return maybeData;

  return [];
}

export default function LiveMapPage() {
  const poll = Number(import.meta.env.VITE_POLL_INTERVAL ?? 3000);
  const centerLat = Number(import.meta.env.VITE_MAP_DEFAULT_LAT ?? 41.7151);
  const centerLng = Number(import.meta.env.VITE_MAP_DEFAULT_LNG ?? 44.8271);

  const liveQ = useQuery({
    queryKey: ["live-locations"],
    queryFn: async () => {
      const res = await api.get("/api/live/locations");
      // return raw payload; we'll normalize it below safely
      return res.data as LiveLocationsResponse;
    },
    refetchInterval: poll,
  });

  const locations = useMemo(() => extractLocations(liveQ.data ?? {}), [liveQ.data]);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Live Map</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-4">
          {liveQ.isLoading && (
            <div className="text-sm text-muted-foreground">Loading live locations...</div>
          )}

          {liveQ.error && (
            <div className="text-sm text-red-600">
              Failed to load live locations. Make sure backend has <b>GET /api/live/locations</b> and you are logged in (Sanctum token).
            </div>
          )}

          <div className="h-[70vh] w-full overflow-hidden rounded-md border">
            <MapContainer
              center={[centerLat, centerLng]}
              zoom={12}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {locations
                .filter((p) => p.lat !== undefined && p.lng !== undefined)
                .map((p) => (
                  <Marker key={p.driver_id} position={[Number(p.lat), Number(p.lng)]}>
                    <Popup>
                      <div className="text-sm">
                        <div className="font-medium">
                          Driver {p.driver?.user?.name ?? p.driver_id}
                        </div>
                        {p.updated_at && (
                          <div>Updated: {new Date(p.updated_at).toLocaleString()}</div>
                        )}
                        <div>
                          Lat: {Number(p.lat).toFixed(5)}, Lng: {Number(p.lng).toFixed(5)}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
            </MapContainer>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing {locations.length} driver(s). Poll every {poll}ms.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}