import { useMemo } from "react";
import { MapPinned, Satellite } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LiveLocation = {
  driver_id: number;
  lat: number | string;
  lng: number | string;
  created_at?: string;
  updated_at?: string;
};

type LivePayload = {
  locations?: LiveLocation[];
  since?: string;
};

export default function LiveMapPage() {
  const pollInterval = Number(import.meta.env.VITE_POLL_INTERVAL ?? 4000);
  const centerLat = Number(import.meta.env.VITE_MAP_DEFAULT_LAT ?? 41.7151);
  const centerLng = Number(import.meta.env.VITE_MAP_DEFAULT_LNG ?? 44.8271);

  const liveQ = useQuery({
    queryKey: ["live-locations"],
    queryFn: async () => (await api.get("/api/live/locations")).data as LivePayload,
    refetchInterval: pollInterval,
  });

  const locations = useMemo(() => liveQ.data?.locations ?? [], [liveQ.data?.locations]);

  return (
    <div className="grid gap-6">
      <div className="rounded-[30px] bg-[linear-gradient(135deg,_rgba(20,184,166,0.16),_rgba(255,255,255,0.95)),linear-gradient(180deg,_#feffff_0%,_#f0fbfb_100%)] p-6">
        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Live map</div>
        <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight text-slate-950">
          Real-time driver locations
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Polling `/api/live/locations` every {pollInterval} ms for active driver pings.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden rounded-[30px]">
          <CardContent className="p-0">
            <div className="h-[68vh] min-h-[420px]">
              <MapContainer center={[centerLat, centerLng]} zoom={12} style={{ height: "100%", width: "100%" }}>
                <TileLayer
                  attribution="&copy; OpenStreetMap"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {locations.map((location) => (
                  <Marker key={location.driver_id} position={[Number(location.lat), Number(location.lng)]}>
                    <Popup>
                      <div className="text-sm">
                        <div className="font-semibold">Driver #{location.driver_id}</div>
                        <div>Updated: {formatDateTime(location.updated_at || location.created_at)}</div>
                        <div>
                          {Number(location.lat).toFixed(5)}, {Number(location.lng).toFixed(5)}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="rounded-[30px]">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Telemetry</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="rounded-[24px] bg-slate-950 p-5 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                    <MapPinned className="h-5 w-5 text-teal-300" />
                  </div>
                  <div>
                    <div className="text-sm text-slate-300">Visible drivers</div>
                    <div className="text-3xl font-semibold">{locations.length}</div>
                  </div>
                </div>
              </div>
              <div className="rounded-[24px] bg-slate-50 p-5 text-sm text-slate-600">
                Latest telemetry window started at {formatDateTime(liveQ.data?.since)}.
              </div>
              {liveQ.isError && (
                <div className="rounded-[24px] bg-red-50 p-5 text-sm text-red-700">
                  Failed to load live locations from `/api/live/locations`.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[30px]">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Map notes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-slate-600">
              <div className="rounded-[24px] bg-slate-50 p-4">
                <Satellite className="mb-2 h-4 w-4 text-slate-500" />
                Positions are the latest pings returned by the backend, grouped by driver.
              </div>
              <div className="rounded-[24px] bg-slate-50 p-4">
                If nothing appears, confirm the tracking endpoint is receiving pings and the pings
                are recent enough for the server window.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
