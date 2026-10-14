import { useMemo } from "react";
import { Banknote, Footprints, Navigation } from "lucide-react";
import { Marker, Polyline, Popup } from "react-leaflet";

import { MapView } from "@/components/app/map-view";
import { makeDotIcon, toLatLng } from "@/components/operations/map-markers";
import { formatMoney } from "@/lib/format";
import { formatDuration, haversineKm, useRoadRoute } from "@/lib/routing";
import { cn } from "@/lib/utils";

import type { DriverOrder, DriverPing } from "./types";

type LatLng = [number, number];

function Chip({ icon: Icon, value, label, success }: { icon: typeof Banknote; value: string; label: string; success?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 shadow-sm",
        success ? "border-transparent bg-success text-success-foreground" : "bg-card/95 backdrop-blur",
      )}
    >
      <Icon className="size-4" />
      <div className="leading-tight">
        <div className="text-sm font-bold tabular-nums">{value}</div>
        <div className="text-[10px] font-medium opacity-80">{label}</div>
      </div>
    </div>
  );
}

/**
 * Map for an incoming offer: the driver's position, the market to pick up from and the customer,
 * with the earning, the delivery distance and how far the pickup is shown on the map.
 */
export function OfferMap({ order, driverLocation, className }: { order: DriverOrder; driverLocation?: DriverPing; className?: string }) {
  const me = toLatLng(driverLocation?.lat, driverLocation?.lng);
  const pickup = toLatLng(order.pickup_lat, order.pickup_lng) ?? toLatLng(order.market?.lat, order.market?.lng);
  const dropoff = toLatLng(order.dropoff_lat, order.dropoff_lng);
  const toPickupRoute = useRoadRoute([me, pickup]);
  const deliveryRoute = useRoadRoute([pickup, dropoff]);
  const points = useMemo(
    () => [...(toPickupRoute.data?.points ?? []), ...(deliveryRoute.data?.points ?? []), me, pickup, dropoff].filter((p): p is LatLng => !!p),
    [me, pickup, dropoff, toPickupRoute.data, deliveryRoute.data],
  );

  const center = pickup ?? dropoff ?? me;
  if (!center) return null;

  const earning = order.driver_compensation?.earning_amount;
  const tripKm = deliveryRoute.data?.distanceKm ?? order.driver_compensation?.distance_km ?? (pickup && dropoff ? haversineKm(pickup, dropoff) : null);
  const toPickupKm = toPickupRoute.data?.distanceKm ?? (me && pickup ? haversineKm(me, pickup) : null);
  const tripTime = deliveryRoute.data ? ` · ${formatDuration(deliveryRoute.data.durationMin)}` : "";
  const pickupTime = toPickupRoute.data ? ` · ${formatDuration(toPickupRoute.data.durationMin)}` : "";

  return (
    <div className={cn("relative h-60 overflow-hidden rounded-xl border bg-muted", className)}>
      <MapView key={`offer-${order.id}-${toPickupRoute.data ? 1 : 0}${deliveryRoute.data ? 1 : 0}`} center={center} zoom={13} fitTo={points}>
        {me && pickup ? (
          <Polyline positions={toPickupRoute.data?.points ?? [me, pickup]} pathOptions={{ className: "stroke-warning", weight: 4, dashArray: "6 8" }} />
        ) : null}
        {pickup && dropoff ? (
          <Polyline positions={deliveryRoute.data?.points ?? [pickup, dropoff]} pathOptions={{ className: "stroke-primary", weight: 5 }} />
        ) : null}
        {me ? (
          <Marker position={me} icon={makeDotIcon("bg-warning")}>
            <Popup>You are here</Popup>
          </Marker>
        ) : null}
        {pickup ? (
          <Marker position={pickup} icon={makeDotIcon("bg-primary")}>
            <Popup>{order.market?.name ?? "Pickup"}</Popup>
          </Marker>
        ) : null}
        {dropoff ? (
          <Marker position={dropoff} icon={makeDotIcon("bg-success")}>
            <Popup>Customer</Popup>
          </Marker>
        ) : null}
      </MapView>

      <div className="pointer-events-none absolute inset-x-2 top-2 z-[1000] flex flex-wrap gap-1.5">
        {earning != null ? <Chip icon={Banknote} value={formatMoney(earning)} label="You earn" success /> : null}
        {tripKm != null ? <Chip icon={Navigation} value={`${Number(tripKm).toFixed(1)} km${tripTime}`} label="Delivery" /> : null}
        {toPickupKm != null ? <Chip icon={Footprints} value={`${toPickupKm.toFixed(1)} km${pickupTime}`} label="To pickup" /> : null}
      </div>

      <div className="pointer-events-none absolute bottom-2 left-2 z-[1000] flex gap-3 rounded-md border bg-card/95 px-2 py-1 text-[11px] font-medium backdrop-blur">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-warning" /> You
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-primary" /> Market
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-success" /> Customer
        </span>
      </div>
    </div>
  );
}
