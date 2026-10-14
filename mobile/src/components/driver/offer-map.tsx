import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { LeafletMap, type MapMarker, type MapPolyline } from "@/src/components/leaflet-map";
import { radius, useColors, withAlpha, type IconName } from "@/src/components/ui";
import { formatMoney, toNumber, type AppLanguage } from "@/src/lib/format";
import { formatDuration, useRoadRoute, type LatLng } from "@/src/lib/routing";
import type { Order } from "@/src/types/api";

/** Keep the route clear of the chips (top) and the legend (bottom) when zooming to fit. */
const MAP_FIT_PADDING = { top: 84, right: 28, bottom: 44, left: 28 };

/* -------------------------------------------------------------------------------------------------
 * Helpers
 * -----------------------------------------------------------------------------------------------*/

export function toCoord(lat: unknown, lng: unknown): LatLng | null {
  if (lat === null || lat === undefined || lat === "" || lng === null || lng === undefined || lng === "") return null;
  const a = toNumber(lat as number | string, Number.NaN);
  const b = toNumber(lng as number | string, Number.NaN);
  return Number.isFinite(a) && Number.isFinite(b) ? { lat: a, lng: b } : null;
}

/** Straight-line distance in km, used until the road route arrives (or if routing is unavailable). */
function haversineKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function Chip({ icon, value, tone }: { icon: IconName; value: string; tone: "success" | "neutral" }) {
  const c = useColors();
  const bg = tone === "success" ? c.success : withAlpha(c.card, 0.96);
  const fg = tone === "success" ? c.successForeground : c.foreground;
  return (
    <View style={[styles.chip, { backgroundColor: bg, borderColor: tone === "neutral" ? c.border : "transparent" }]}>
      <Ionicons name={icon} size={13} color={fg} />
      <Text numberOfLines={1} style={[styles.chipValue, { color: fg }]}>
        {value}
      </Text>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const c = useColors();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendText, { color: c.foreground }]}>{label}</Text>
    </View>
  );
}

/** Map frame with an expand / collapse button (bigger map for reading the route). */
function ExpandableFrame({
  height,
  expandedHeight = 520,
  children,
  overlay,
  legend,
}: {
  height: number;
  expandedHeight?: number;
  children: (expanded: boolean) => React.ReactNode;
  overlay?: React.ReactNode;
  legend?: React.ReactNode;
}) {
  const c = useColors();
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={[styles.wrap, { height: expanded ? expandedHeight : height, borderColor: c.border, backgroundColor: c.muted }]}>
      {children(expanded)}
      {overlay ? (
        <View style={styles.overlay} pointerEvents="none">
          {overlay}
        </View>
      ) : null}
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={expanded ? "Make the map smaller" : "Make the map bigger"}
        hitSlop={6}
        style={[styles.expand, { backgroundColor: withAlpha(c.card, 0.96), borderColor: c.border }]}
      >
        <Ionicons name={expanded ? "contract-outline" : "expand-outline"} size={18} color={c.foreground} />
      </Pressable>
      {legend ? (
        <View style={[styles.legend, { backgroundColor: withAlpha(c.card, 0.94), borderColor: c.border }]} pointerEvents="none">
          {legend}
        </View>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Offer map: you -> market -> customer
 * -----------------------------------------------------------------------------------------------*/

/**
 * Map for an incoming offer: the driver's position, the market and the customer, with the real road
 * route (OSRM), the earning, the delivery distance/time and how far the pickup is.
 */
export function OfferMap({
  order,
  driverLocation,
  language,
  height = 230,
}: {
  order: Order;
  driverLocation?: { lat: number | string; lng: number | string } | null;
  language: AppLanguage;
  height?: number;
}) {
  const c = useColors();
  const me = toCoord(driverLocation?.lat, driverLocation?.lng);
  const pickup = toCoord(order.pickup_lat, order.pickup_lng) ?? toCoord(order.market?.lat, order.market?.lng);
  const dropoff = toCoord(order.dropoff_lat, order.dropoff_lng);

  const toPickupRoute = useRoadRoute([me, pickup]);
  const deliveryRoute = useRoadRoute([pickup, dropoff]);

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [];
    if (me) list.push({ id: "me", ...me, color: c.warning, title: "You are here" });
    if (pickup) list.push({ id: "pickup", ...pickup, color: c.primary, title: order.market?.name ?? "Pickup", description: order.pickup_address ?? undefined });
    if (dropoff) list.push({ id: "dropoff", ...dropoff, color: c.success, title: "Customer", description: order.dropoff_address ?? undefined });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify([me, pickup, dropoff]), c.warning, c.primary, c.success, order.market?.name, order.pickup_address, order.dropoff_address]);

  const lines = useMemo<MapPolyline[]>(() => {
    const list: MapPolyline[] = [];
    if (me && pickup) list.push({ id: "to-pickup", points: toPickupRoute.data?.points ?? [me, pickup], color: c.warning, width: 4, dashed: true });
    if (pickup && dropoff) list.push({ id: "delivery", points: deliveryRoute.data?.points ?? [pickup, dropoff], color: c.primary, width: 5 });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify([me, pickup, dropoff]), toPickupRoute.data, deliveryRoute.data, c.warning, c.primary]);

  const center = pickup ?? dropoff ?? me;
  if (!center) return null;

  const earning = order.driver_compensation?.earning_amount;
  const deliveryKm = deliveryRoute.data?.distanceKm ?? toNumber(order.driver_compensation?.distance_km, Number.NaN);
  const deliveryLabel = Number.isFinite(deliveryKm)
    ? `${deliveryKm.toFixed(1)} km${deliveryRoute.data ? ` · ${formatDuration(deliveryRoute.data.durationMin)}` : ""}`
    : null;
  const pickupKm = toPickupRoute.data?.distanceKm ?? (me && pickup ? haversineKm(me, pickup) : null);
  const pickupLabel =
    pickupKm != null ? `${pickupKm.toFixed(1)} km${toPickupRoute.data ? ` · ${formatDuration(toPickupRoute.data.durationMin)}` : ""}` : null;
  const routeKey = `${toPickupRoute.data ? 1 : 0}${deliveryRoute.data ? 1 : 0}`;

  return (
    <ExpandableFrame
      height={height}
      overlay={
        <>
          {earning != null ? <Chip icon="cash-outline" value={`Earn ${formatMoney(earning, language)}`} tone="success" /> : null}
          {deliveryLabel ? <Chip icon="navigate-outline" value={deliveryLabel} tone="neutral" /> : null}
          {pickupLabel ? <Chip icon="car-outline" value={`${pickupLabel} away`} tone="neutral" /> : null}
        </>
      }
      legend={
        <>
          <LegendDot color={c.warning} label="You" />
          <LegendDot color={c.primary} label="Market" />
          <LegendDot color={c.success} label="Customer" />
        </>
      }
    >
      {(expanded) => (
        <LeafletMap
          key={`offer-${order.id}`}
          style={StyleSheet.absoluteFill}
          center={center}
          zoom={13}
          fitOnLoad
          fitKey={`${routeKey}-${expanded ? "big" : "small"}`}
          fitPadding={MAP_FIT_PADDING}
          markers={markers}
          polylines={lines}
        />
      )}
    </ExpandableFrame>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Current delivery map: you -> current destination
 * -----------------------------------------------------------------------------------------------*/

/** Road route from the driver to the current stop (market, then customer), with distance and ETA. */
export function DeliveryRouteMap({
  driverLocation,
  destination,
  destinationLabel,
  destinationAddress,
  destinationColor,
  routeKey,
  height = 260,
}: {
  driverLocation: LatLng | null;
  destination: LatLng | null;
  destinationLabel: string;
  destinationAddress?: string | null;
  destinationColor: string;
  /** Changes when the stop changes so the map re-fits. */
  routeKey: string;
  height?: number;
}) {
  const c = useColors();
  const route = useRoadRoute([driverLocation, destination]);

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [];
    if (destination) list.push({ id: "destination", ...destination, color: destinationColor, title: destinationLabel, description: destinationAddress ?? undefined });
    if (driverLocation) list.push({ id: "driver", ...driverLocation, color: c.warning, title: "You" });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify([driverLocation, destination]), destinationColor, destinationLabel, destinationAddress, c.warning]);

  const lines = useMemo<MapPolyline[]>(
    () =>
      driverLocation && destination
        ? [{ id: "route", points: route.data?.points ?? [driverLocation, destination], color: c.primary, width: 5, dashed: !route.data }]
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify([driverLocation, destination]), route.data, c.primary],
  );

  const center = destination ?? driverLocation;
  if (!center) return null;

  const km = route.data?.distanceKm ?? (driverLocation && destination ? haversineKm(driverLocation, destination) : null);

  return (
    <ExpandableFrame
      height={height}
      overlay={
        km != null ? (
          <>
            <Chip icon="navigate-outline" value={`${km.toFixed(1)} km`} tone="neutral" />
            {route.data ? <Chip icon="time-outline" value={`${formatDuration(route.data.durationMin)} drive`} tone="neutral" /> : null}
          </>
        ) : null
      }
      legend={
        <>
          <LegendDot color={c.warning} label="You" />
          <LegendDot color={destinationColor} label={destinationLabel} />
        </>
      }
    >
      {(expanded) => (
        <LeafletMap
          key={routeKey}
          style={StyleSheet.absoluteFill}
          center={center}
          zoom={14}
          fitOnLoad
          fitKey={`${route.data ? 1 : 0}-${expanded ? "big" : "small"}`}
          fitPadding={MAP_FIT_PADDING}
          markers={markers}
          polylines={lines}
        />
      )}
    </ExpandableFrame>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: radius.xl, overflow: "hidden" },
  overlay: { position: "absolute", top: 8, left: 8, right: 56, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 9,
    height: 28,
    shadowColor: "#000000",
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  chipValue: { fontSize: 12.5, fontWeight: "700", fontVariant: ["tabular-nums"] },
  expand: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  legend: { position: "absolute", left: 8, bottom: 8, flexDirection: "row", gap: 10, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 8, paddingVertical: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: "500" },
});
