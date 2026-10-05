import { useEffect, useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, Clock3, MapPinned, RefreshCw, Route, Satellite, Search, TimerReset, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { makeDotIcon } from "@/components/operations/map-markers";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatCard, StatGrid } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
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

type DriverState = "live" | "idle" | "stale";
type DriverFilter = "all" | DriverState;

const STATE_DOT: Record<DriverState, string> = {
  live: "bg-primary",
  idle: "bg-info",
  stale: "bg-warning",
};

const STATE_LABEL: Record<DriverState, string> = {
  live: "Live",
  idle: "Idle",
  stale: "Stale ping",
};

const STATE_TONE: Record<DriverState, "primary" | "info" | "warning"> = {
  live: "primary",
  idle: "info",
  stale: "warning",
};

function FlyToDriver({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [map, position]);
  return null;
}

export default function LiveMapPage() {
  const text = copy.en;
  const { theme } = useTheme();
  const pollInterval = Number(import.meta.env.VITE_POLL_INTERVAL ?? 4000);
  const centerLat = Number(import.meta.env.VITE_MAP_DEFAULT_LAT ?? 41.7151);
  const centerLng = Number(import.meta.env.VITE_MAP_DEFAULT_LNG ?? 44.8271);
  const tileUrl =
    theme === "dark"
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const tileAttribution =
    theme === "dark" ? "&copy; OpenStreetMap &copy; CARTO" : "&copy; OpenStreetMap";

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DriverFilter>("all");
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);

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
  const idleDrivers = useMemo(() => alertsQ.data?.idle_drivers ?? [], [alertsQ.data?.idle_drivers]);
  const staleDrivers = useMemo(() => alertsQ.data?.stale_tracking ?? [], [alertsQ.data?.stale_tracking]);
  const alertCount = lateOrders.length + idleDrivers.length + staleDrivers.length;

  const driverInfo = useMemo(() => {
    const names = new Map<number, string>();
    const states = new Map<number, DriverState>();
    for (const driver of idleDrivers) {
      if (driver.user?.name) names.set(driver.id, driver.user.name);
      states.set(driver.id, "idle");
    }
    for (const driver of staleDrivers) {
      if (driver.user?.name) names.set(driver.id, driver.user.name);
      states.set(driver.id, "stale");
    }
    return { names, states };
  }, [idleDrivers, staleDrivers]);

  const driverName = (id: number) => driverInfo.names.get(id) ?? text.driver.replace("{id}", String(id));
  const driverState = (id: number): DriverState => driverInfo.states.get(id) ?? "live";

  const visibleLocations = locations.filter((location) => {
    if (filter !== "all" && driverState(location.driver_id) !== filter) return false;
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return driverName(location.driver_id).toLowerCase().includes(term) || String(location.driver_id).includes(term);
  });

  const selectedLocation = locations.find((location) => location.driver_id === selectedDriverId);
  const selectedPosition = useMemo<[number, number] | null>(
    () => (selectedLocation ? [Number(selectedLocation.lat), Number(selectedLocation.lng)] : null),
    // Fly only when the selection changes, not on every location poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedDriverId],
  );

  const lastUpdated = liveQ.dataUpdatedAt ? new Date(liveQ.dataUpdatedAt).toISOString() : null;
  const isFetching = liveQ.isFetching || alertsQ.isFetching || historyQ.isFetching;
  const refreshAll = () => {
    void liveQ.refetch();
    void alertsQ.refetch();
    void historyQ.refetch();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live map"
        description={text.title}
        actions={
          <>
            <span className="text-xs text-muted-foreground">
              {text.updated}: {lastUpdated ? formatDateTime(lastUpdated) : "-"}
            </span>
            <Button variant="outline" onClick={refreshAll} disabled={isFetching}>
              <RefreshCw className={cn(isFetching && "animate-spin")} />
              Refresh
            </Button>
          </>
        }
      />

      {(liveQ.isError || alertsQ.isError || historyQ.isError) && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>{text.failed}</AlertTitle>
          <AlertDescription>The map keeps retrying every few seconds.</AlertDescription>
        </Alert>
      )}

      <StatGrid>
        <StatCard label={text.visibleDrivers} value={locations.length} icon={MapPinned} tone="primary" />
        <StatCard label={text.playbackTracks} value={tracks.length} icon={Route} tone="info" />
        <StatCard label={text.staleTracking} value={staleDrivers.length} icon={TimerReset} tone={staleDrivers.length > 0 ? "warning" : "default"} />
        <StatCard label={text.activeAlerts} value={alertCount} icon={AlertTriangle} tone={alertCount > 0 ? "warning" : "default"} />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="relative h-[calc(100svh-12rem)] min-h-[420px] gap-0 overflow-hidden rounded-xl py-0">
          <MapContainer center={[centerLat, centerLng]} zoom={12} style={{ height: "100%", width: "100%" }}>
            <TileLayer attribution={tileAttribution} url={tileUrl} />

            {tracks.map((track) =>
              track.points.length > 1 ? (
                <Polyline
                  key={`track-${track.driver_id}`}
                  positions={track.points.map((point) => [Number(point.lat), Number(point.lng)])}
                  pathOptions={{ className: "stroke-primary", weight: 5, opacity: 0.7 }}
                />
              ) : null,
            )}

            {locations.map((location) => {
              const state = driverState(location.driver_id);
              const selected = location.driver_id === selectedDriverId;
              return (
                <Marker
                  key={location.driver_id}
                  position={[Number(location.lat), Number(location.lng)]}
                  icon={makeDotIcon(STATE_DOT[state], { size: selected ? 26 : 20, selected })}
                  zIndexOffset={selected ? 1000 : 0}
                  eventHandlers={{ click: () => setSelectedDriverId(location.driver_id) }}
                >
                  <Popup>
                    <div className="text-sm">
                      <div className="font-semibold">{driverName(location.driver_id)}</div>
                      <div>{text.updated}: {formatDateTime(location.updated_at || location.created_at)}</div>
                      <div className="tabular-nums">{Number(location.lat).toFixed(5)}, {Number(location.lng).toFixed(5)}</div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            <FlyToDriver position={selectedPosition} />
          </MapContainer>

          <div className="pointer-events-none absolute top-3 right-3 z-[1000] flex max-w-[calc(100%-5rem)] flex-col items-end gap-2">
            <div className="pointer-events-auto rounded-lg border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
              <div className="font-medium">{text.telemetryMap}</div>
              <div className="text-muted-foreground">
                {text.windowStarted}: {formatDateTime(historyQ.data?.since || liveQ.data?.since)}
              </div>
            </div>
          </div>

          <div className="pointer-events-auto absolute bottom-3 left-3 z-[1000] rounded-lg border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
            <div className="mb-1.5 font-medium">Legend</div>
            <div className="grid gap-1 text-muted-foreground">
              <LegendDot className={STATE_DOT.live} label="Live driver" />
              <LegendDot className={STATE_DOT.idle} label="Idle driver" />
              <LegendDot className={STATE_DOT.stale} label="Stale ping" />
              <span className="flex items-center gap-2">
                <span className="h-1 w-3 rounded-full bg-primary/70" />
                Route history (45 min)
              </span>
            </div>
          </div>
        </Card>

        <Card className="gap-3 py-4 lg:h-[calc(100svh-12rem)] lg:min-h-[420px]">
          <CardHeader className="px-4">
            <CardTitle className="text-base font-semibold">Drivers on map</CardTitle>
            <CardDescription>{text.latestPingsText}</CardDescription>
            <CardAction>
              <StatusBadge tone="neutral">{locations.length}</StatusBadge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-4">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search drivers..." value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search drivers" />
            </div>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={filter}
              onValueChange={(value) => value && setFilter(value as DriverFilter)}
              className="w-full"
            >
              <ToggleGroupItem value="all" className="flex-1">All</ToggleGroupItem>
              <ToggleGroupItem value="live" className="flex-1">Live</ToggleGroupItem>
              <ToggleGroupItem value="idle" className="flex-1">Idle</ToggleGroupItem>
              <ToggleGroupItem value="stale" className="flex-1">Stale</ToggleGroupItem>
            </ToggleGroup>

            {visibleLocations.length === 0 ? (
              <EmptyState
                compact
                icon={Truck}
                title={locations.length === 0 ? "No drivers reporting" : "No matching drivers"}
                description={locations.length === 0 ? "Drivers appear once their app sends a location ping." : "Change the search or filter."}
              />
            ) : (
              <ScrollArea className="max-h-80 min-h-0 flex-1 lg:max-h-none">
                <div className="grid gap-1.5 pr-2">
                  {visibleLocations.map((location) => {
                    const state = driverState(location.driver_id);
                    const selected = location.driver_id === selectedDriverId;
                    return (
                      <button
                        key={location.driver_id}
                        type="button"
                        onClick={() => setSelectedDriverId(location.driver_id)}
                        aria-pressed={selected}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                          selected ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                        )}
                      >
                        <span className={cn("size-2.5 shrink-0 rounded-full", STATE_DOT[state])} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{driverName(location.driver_id)}</span>
                          <span className="block truncate text-xs text-muted-foreground">{formatDateTime(location.updated_at || location.created_at)}</span>
                        </span>
                        <StatusBadge tone={STATE_TONE[state]} className="shrink-0">{STATE_LABEL[state]}</StatusBadge>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard title={text.latestPings} copy={text.latestPingsText} icon={Satellite} />
        <InfoCard title={text.playbackWindow} copy={text.playbackWindowText} icon={Clock3} />
      </div>

      <Card className="gap-4">
        <CardHeader>
          <CardTitle className="text-base font-semibold">{text.alerts}</CardTitle>
          <CardDescription>{text.alertsCopy}</CardDescription>
          <CardAction>
            <StatusBadge tone={alertCount > 0 ? "warning" : "success"} dot>
              {alertCount} active
            </StatusBadge>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <AlertColumn title={text.lateOrders} tone="destructive" items={lateOrders.map((order) => `${order.code} - ${order.dropoff_address || "-"}`)} emptyLabel={text.noAlerts} />
            <AlertColumn title={text.idleDrivers} tone="info" items={idleDrivers.map((driver) => driver.user?.name || text.driver.replace("{id}", String(driver.id)))} emptyLabel={text.noAlerts} />
            <AlertColumn title={text.staleDrivers} tone="warning" items={staleDrivers.map((driver) => driver.user?.name || text.driver.replace("{id}", String(driver.id)))} emptyLabel={text.noAlerts} />
          </div>
          {tracks.length === 0 && <p className="text-sm text-muted-foreground">{text.noHistory}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn("size-2.5 rounded-full border border-background", className)} />
      {label}
    </span>
  );
}

function InfoCard({ title, copy, icon: Icon }: { title: string; copy: string; icon: LucideIcon }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <p className="mt-0.5 text-sm text-muted-foreground">{copy}</p>
      </div>
    </div>
  );
}

function AlertColumn({
  title,
  items,
  emptyLabel,
  tone,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
  tone: "destructive" | "info" | "warning";
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{title}</div>
        <StatusBadge tone={items.length > 0 ? tone : "neutral"}>{items.length}</StatusBadge>
      </div>
      {items.length === 0 ? (
        <div className="mt-3 text-sm text-muted-foreground">{emptyLabel}</div>
      ) : (
        <div className="mt-3 grid gap-2">
          {items.slice(0, 5).map((item) => (
            <div key={item} className="truncate rounded-md border bg-card px-3 py-2 text-sm">
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
