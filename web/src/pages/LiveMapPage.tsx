import { useMemo } from "react";
import { AlertTriangle, Clock3, MapPinned, Route, Satellite, TimerReset } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { LiveAlertPayload, LiveHistoryPayload, LivePayload } from "@/types/api";

const copy = {
  en: {
    board: "Live telemetry",
    title: "Driver movement and alert visibility in one readable screen.",
    intro: "The live board keeps the map large, the alerts obvious, and the status text high-contrast so dispatch can scan quickly.",
    visibleDrivers: "Visible drivers",
    playbackTracks: "Playback tracks",
    staleTracking: "Stale tracking",
    activeAlerts: "Active alerts",
    telemetryMap: "Telemetry map",
    latestPings: "Latest pings",
    latestPingsText: "Each marker shows the latest known driver location.",
    playbackWindow: "Playback window",
    playbackWindowText: "Route history uses recent tracking points to show where drivers moved.",
    windowStarted: "Window started",
    alerts: "Alert queue",
    alertsCopy: "Late orders, idle drivers, and stale pings are grouped below.",
    lateOrders: "Late orders",
    idleDrivers: "Idle drivers",
    staleDrivers: "Stale drivers",
    noAlerts: "No alerts right now.",
    noHistory: "No route history available yet.",
    updated: "Updated",
    driver: "Driver #{id}",
    failed: "Failed to load live operations data.",
  },
  ka: {
    board: "ცოცხალი ტელემეტრია",
    title: "მძღოლების მოძრაობა და გაფრთხილებები ერთ კითხვად ეკრანზე.",
    intro: "ეს დაფა დიდ რუკას, მკაფიო გაფრთხილებებს და მაღალი კონტრასტის ტექსტს იყენებს, რომ დისპეტჩერმა სწრაფად დაასკანიროს.",
    visibleDrivers: "ხილული მძღოლები",
    playbackTracks: "მარშრუტის კვალი",
    staleTracking: "მოძველებული ტრეკინგი",
    activeAlerts: "აქტიური გაფრთხილებები",
    telemetryMap: "ტელემეტრიის რუკა",
    latestPings: "ბოლო პინგები",
    latestPingsText: "თითოეული მარკერი მძღოლის ბოლო ცნობილ ლოკაციას აჩვენებს.",
    playbackWindow: "ისტორიის ფანჯარა",
    playbackWindowText: "მარშრუტის ისტორია ბოლოდროინდელ ტრეკინგ წერტილებს იყენებს.",
    windowStarted: "ფანჯარა დაიწყო",
    alerts: "გაფრთხილებების რიგი",
    alertsCopy: "დაგვიანებული შეკვეთები, უქმად მდგომი მძღოლები და მოძველებული პინგები ქვემოთ ერთად ჩანს.",
    lateOrders: "დაგვიანებული შეკვეთები",
    idleDrivers: "უქმად მდგომი მძღოლები",
    staleDrivers: "მოძველებული პინგები",
    noAlerts: "ამჟამად გაფრთხილება არ არის.",
    noHistory: "მარშრუტის ისტორია ჯერ არ არის.",
    updated: "განახლდა",
    driver: "მძღოლი #{id}",
    failed: "ცოცხალი ოპერაციების მონაცემები ვერ ჩაიტვირთა.",
  },
} as const;

export default function LiveMapPage() {
  const { language } = useI18n();
  const text = copy[language];
  const pollInterval = Number(import.meta.env.VITE_POLL_INTERVAL ?? 4000);
  const centerLat = Number(import.meta.env.VITE_MAP_DEFAULT_LAT ?? 41.7151);
  const centerLng = Number(import.meta.env.VITE_MAP_DEFAULT_LNG ?? 44.8271);

  const liveQ = useQuery({
    queryKey: ["live-locations"],
    queryFn: async () => (await api.get("/api/live/locations")).data as LivePayload,
    refetchInterval: pollInterval,
  });

  const alertsQ = useQuery({
    queryKey: ["live-alerts"],
    queryFn: async () => (await api.get("/api/live/alerts")).data as LiveAlertPayload,
    refetchInterval: pollInterval,
  });

  const historyQ = useQuery({
    queryKey: ["live-history"],
    queryFn: async () => (await api.get("/api/live/history", { params: { minutes: 45 } })).data as LiveHistoryPayload,
    refetchInterval: pollInterval * 2,
  });

  const locations = useMemo(() => liveQ.data?.locations ?? [], [liveQ.data?.locations]);
  const tracks = historyQ.data?.history ?? [];
  const lateOrders = alertsQ.data?.late_orders ?? [];
  const idleDrivers = alertsQ.data?.idle_drivers ?? [];
  const staleDrivers = alertsQ.data?.stale_tracking ?? [];
  const alertCount = lateOrders.length + idleDrivers.length + staleDrivers.length;

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="dashboard-card">
          <div className="command-chip">{text.board}</div>
          <h1 className="section-title mt-4">{text.title}</h1>
          <p className="section-copy mt-3 max-w-3xl">{text.intro}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard title={text.visibleDrivers} value={locations.length} icon={MapPinned} />
          <MetricCard title={text.playbackTracks} value={tracks.length} icon={Route} />
          <MetricCard title={text.staleTracking} value={staleDrivers.length} icon={TimerReset} />
          <MetricCard title={text.activeAlerts} value={alertCount} icon={AlertTriangle} tone="warn" />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="map-frame">
          <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
            <div>
              <div className="panel-title text-xl">{text.telemetryMap}</div>
              <div className="panel-copy mt-1">
                {text.windowStarted}: {formatDateTime(historyQ.data?.since || liveQ.data?.since)}
              </div>
            </div>
            <div className="status-chip">{locations.length}</div>
          </div>

          <div className="h-[66vh] min-h-[440px]">
            <MapContainer center={[centerLat, centerLng]} zoom={12} style={{ height: "100%", width: "100%" }}>
              <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

              {tracks.map((track) =>
                track.points.length > 1 ? (
                  <Polyline
                    key={`track-${track.driver_id}`}
                    positions={track.points.map((point) => [Number(point.lat), Number(point.lng)])}
                    pathOptions={{ color: "#0891b2", weight: 5, opacity: 0.7 }}
                  />
                ) : null,
              )}

              {locations.map((location) => (
                <Marker key={location.driver_id} position={[Number(location.lat), Number(location.lng)]}>
                  <Popup>
                    <div className="text-sm">
                      <div className="font-semibold">{text.driver.replace("{id}", String(location.driver_id))}</div>
                      <div>{text.updated}: {formatDateTime(location.updated_at || location.created_at)}</div>
                      <div>{Number(location.lat).toFixed(5)}, {Number(location.lng).toFixed(5)}</div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>

        <div className="grid gap-4">
          <InfoCard title={text.latestPings} copy={text.latestPingsText} icon={Satellite} />
          <InfoCard title={text.playbackWindow} copy={text.playbackWindowText} icon={Clock3} />

          {(liveQ.isError || alertsQ.isError || historyQ.isError) && (
            <div className="dashboard-card border-rose-200 bg-rose-50 text-sm text-rose-700 dark:border-rose-300/20 dark:bg-rose-300/10 dark:text-rose-100">
              {text.failed}
            </div>
          )}
        </div>
      </section>

      <section className="dashboard-card">
        <div className="mb-4">
          <div className="panel-title">{text.alerts}</div>
          <div className="panel-copy mt-1">{text.alertsCopy}</div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <AlertColumn title={text.lateOrders} items={lateOrders.map((order) => `${order.code} • ${order.dropoff_address || "-"}`)} emptyLabel={text.noAlerts} />
          <AlertColumn title={text.idleDrivers} items={idleDrivers.map((driver) => driver.user?.name || text.driver.replace("{id}", String(driver.id)))} emptyLabel={text.noAlerts} />
          <AlertColumn title={text.staleDrivers} items={staleDrivers.map((driver) => driver.user?.name || text.driver.replace("{id}", String(driver.id)))} emptyLabel={text.noAlerts} />
        </div>

        {tracks.length === 0 && <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">{text.noHistory}</div>}
      </section>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  tone = "normal",
}: {
  title: string;
  value: number;
  icon: typeof MapPinned;
  tone?: "normal" | "warn";
}) {
  return (
    <div className={`dashboard-card ${tone === "warn" ? "border-amber-200/80 dark:border-amber-300/15" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="section-kicker">{title}</div>
          <div className="font-display theme-ink mt-3 text-5xl font-semibold tracking-[-0.05em]">{value}</div>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-[16px] ${tone === "warn" ? "bg-amber-50 text-amber-700 dark:bg-amber-300/12 dark:text-amber-100" : "bg-cyan-50 text-cyan-700 dark:bg-cyan-300/12 dark:text-cyan-100"}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function InfoCard({ title, copy, icon: Icon }: { title: string; copy: string; icon: typeof Satellite }) {
  return (
    <div className="dashboard-card">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-cyan-50 text-cyan-700 dark:bg-cyan-300/12 dark:text-cyan-100">
          <Icon className="h-5 w-5" />
        </div>
        <div className="theme-ink font-semibold">{title}</div>
      </div>
      <div className="theme-copy mt-3 text-sm leading-7">{copy}</div>
    </div>
  );
}

function AlertColumn({ title, items, emptyLabel }: { title: string; items: string[]; emptyLabel: string }) {
  return (
    <div className="subpanel p-4">
      <div className="section-kicker">{title}</div>
      {items.length === 0 ? (
        <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">{emptyLabel}</div>
      ) : (
        <div className="mt-3 grid gap-2">
          {items.slice(0, 5).map((item) => (
            <div key={item} className="rounded-[18px] border border-slate-200/80 bg-white/90 px-4 py-3 text-sm text-slate-800 dark:border-white/10 dark:bg-white/6 dark:text-slate-100">
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
