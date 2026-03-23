import { useMemo } from "react";
import { MapPinned, Satellite, TimerReset } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();
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
      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="dashboard-card page-enter">
          <div className="command-chip">{t("live.board")}</div>
          <h1 className="section-title mt-5">{t("live.titleLong")}</h1>
          <p className="section-copy mt-4">
            {t("live.metricCopy", { value: pollInterval })}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="metric-dark page-enter page-enter-delay-1">
            <div className="section-kicker text-slate-300">{t("live.visibleDrivers")}</div>
            <div className="mt-3 font-display text-6xl font-semibold tracking-[-0.05em]">{locations.length}</div>
          </div>
          <div className="metric-block page-enter page-enter-delay-2">
            <MapPinned className="h-5 w-5" />
            <div className="mt-4 font-semibold text-slate-950">{t("live.mapCenter")}</div>
            <div className="mt-2 text-sm leading-7 text-slate-600">
              {centerLat.toFixed(4)}, {centerLng.toFixed(4)}
            </div>
          </div>
          <div className="metric-block page-enter page-enter-delay-3">
            <TimerReset className="h-5 w-5" />
            <div className="mt-4 font-semibold text-slate-950">{t("live.windowStarted")}</div>
            <div className="mt-2 text-sm leading-7 text-slate-600">{formatDateTime(liveQ.data?.since)}</div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="map-frame page-enter">
          <div className="h-[68vh] min-h-[440px]">
            <MapContainer center={[centerLat, centerLng]} zoom={12} style={{ height: "100%", width: "100%" }}>
              <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {locations.map((location) => (
                <Marker key={location.driver_id} position={[Number(location.lat), Number(location.lng)]}>
                  <Popup>
                    <div className="text-sm">
                      <div className="font-semibold">{t("live.driverNumber", { id: location.driver_id })}</div>
                      <div>{t("common.updated")}: {formatDateTime(location.updated_at || location.created_at)}</div>
                      <div>
                        {Number(location.lat).toFixed(5)}, {Number(location.lng).toFixed(5)}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-3xl font-semibold tracking-[-0.04em]">{t("live.mapNotesTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="metric-block">
                <Satellite className="h-5 w-5" />
                <div className="mt-4 font-semibold text-slate-950">{t("live.latestPingsOnly")}</div>
                <div className="mt-2 text-sm leading-7 text-slate-600">
                  {t("live.latestPingsText")}
                </div>
              </div>
              <div className="metric-block">
                <MapPinned className="h-5 w-5" />
                <div className="mt-4 font-semibold text-slate-950">{t("live.operationalUse")}</div>
                <div className="mt-2 text-sm leading-7 text-slate-600">
                  {t("live.operationalUseText")}
                </div>
              </div>
              {liveQ.isError && (
                <div className="rounded-[20px] border-2 border-red-700 bg-red-50 p-4 text-sm text-red-700">
                  {t("live.failed")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
