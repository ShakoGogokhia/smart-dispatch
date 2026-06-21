import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Clock3, MapPin, PackageSearch, Truck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { formatDateTime, formatOrderStatus } from "@/lib/format";
import type { TrackingPayload } from "@/types/api";

export default function OrderTrackingPage() {
  const params = useParams();
  const [draftCode, setDraftCode] = useState(params.code ?? "");
  const [code, setCode] = useState(params.code ?? "");

  const trackingQ = useQuery({
    queryKey: ["public-tracking", code],
    queryFn: async () => (await api.get(`/api/public/track/${encodeURIComponent(code)}`)).data as TrackingPayload,
    enabled: code.trim().length > 0,
    refetchInterval: code ? 10000 : false,
    retry: false,
  });

  const order = trackingQ.data;
  const driverPosition = order?.driver?.latest_ping;
  const mapCenter = useMemo<[number, number] | null>(() => {
    if (driverPosition) return [Number(driverPosition.lat), Number(driverPosition.lng)];
    if (order?.dropoff_lat && order?.dropoff_lng) return [Number(order.dropoff_lat), Number(order.dropoff_lng)];
    return null;
  }, [driverPosition, order?.dropoff_lat, order?.dropoff_lng]);

  return (
    <div className="mx-auto grid min-h-screen max-w-6xl gap-6 bg-slate-100 px-4 py-6 text-slate-950 dark:bg-[#020617] dark:text-white md:py-10">
      <section className="rounded-[34px] border border-slate-200/70 bg-slate-950 p-6 text-white shadow-[0_25px_80px_rgba(0,0,0,0.22)]">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
              <PackageSearch className="h-3.5 w-3.5" />
              Track order
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] md:text-6xl">Where is my order?</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
              Enter an order code to see progress, ETA, driver details, and the live map when tracking is available.
            </p>
          </div>

          <form
            className="flex w-full gap-2 md:max-w-md"
            onSubmit={(event) => {
              event.preventDefault();
              setCode(draftCode.trim());
            }}
          >
            <Input
              value={draftCode}
              onChange={(event) => setDraftCode(event.target.value)}
              placeholder="ORD-000001"
              className="h-12 rounded-[18px] border-white/10 bg-white/10 text-white placeholder:text-white/45"
            />
            <Button className="h-12 rounded-[18px]" type="submit">Track</Button>
          </form>
        </div>
      </section>

      {!code ? (
        <Card className="rounded-[30px]">
          <CardContent className="p-8 text-sm text-slate-600 dark:text-slate-300">Enter an order code to begin.</CardContent>
        </Card>
      ) : trackingQ.isLoading ? (
        <Card className="rounded-[30px]">
          <CardContent className="p-8 text-sm text-slate-600 dark:text-slate-300">Loading tracking...</CardContent>
        </Card>
      ) : trackingQ.isError || !order ? (
        <Card className="rounded-[30px]">
          <CardContent className="p-8 text-sm text-rose-700 dark:text-rose-200">No order was found for that code.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="rounded-[30px]">
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-3xl font-semibold tracking-[-0.05em]">{order.code}</CardTitle>
                  <div className="mt-2 text-sm text-slate-500 dark:text-slate-300">{order.dropoff_address}</div>
                </div>
                <Badge className="status-chip status-neutral rounded-full">{formatOrderStatus(order.status)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-4 md:grid-cols-3">
                <TrackingStat icon={Clock3} label="ETA" value={formatDateTime(order.eta_summary?.estimated_delivery_at)} />
                <TrackingStat icon={MapPin} label="Market" value={order.market?.name ?? "Direct order"} />
                <TrackingStat icon={Truck} label="Driver" value={order.driver?.name ?? "Waiting for driver"} />
              </div>

              <div className="grid gap-3">
                {(order.timeline ?? []).map((step, index) => (
                  <div key={step.key} className="grid gap-3 rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[44px_minmax(0,1fr)_auto] md:items-center">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold ${step.done ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-300/15 dark:text-emerald-100" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-950 dark:text-white">{step.label}</div>
                      <div className="mt-1 text-sm text-slate-500 dark:text-slate-300">{formatDateTime(step.at)}</div>
                    </div>
                    <Badge className={`status-chip ${step.done ? "status-good" : "status-neutral"}`}>{step.done ? "Done" : "Pending"}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card className="rounded-[30px]">
              <CardHeader>
                <CardTitle className="text-xl">Live map</CardTitle>
              </CardHeader>
              <CardContent>
                {mapCenter ? (
                  <div className="h-[360px] overflow-hidden rounded-[24px] border border-slate-200 dark:border-slate-800">
                    <MapContainer center={mapCenter} zoom={13} style={{ height: "100%", width: "100%" }}>
                      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      {driverPosition && <Marker position={[Number(driverPosition.lat), Number(driverPosition.lng)]} />}
                      {order.dropoff_lat && order.dropoff_lng && <Marker position={[Number(order.dropoff_lat), Number(order.dropoff_lng)]} />}
                    </MapContainer>
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-dashed border-slate-300 p-8 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">Map coordinates are not available yet.</div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[30px]">
              <CardHeader>
                <CardTitle className="text-xl">Latest events</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {(order.events ?? []).slice(-5).reverse().map((event) => (
                  <div key={event.id} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="font-semibold text-slate-950 dark:text-white">{event.type}</div>
                    <div className="mt-1 text-slate-500 dark:text-slate-300">{formatDateTime(event.created_at)}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function TrackingStat({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-3 text-sm font-semibold leading-6 text-slate-950 dark:text-white">{value}</div>
    </div>
  );
}
