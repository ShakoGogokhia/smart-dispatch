import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppShell } from "@/src/components/app-shell";
import { AppButton, EmptyBlock, HelperText, InputField, LoadingBlock, Pill, SectionCard, StatCard, StatGrid, uiStyles } from "@/src/components/ui";
import { useProtectedAccess } from "@/src/hooks/use-protected-access";
import { api } from "@/src/lib/api";
import { getErrorMessage } from "@/src/lib/errors";
import { formatDateTime, formatMoney, formatOrderStatus, getOrderStatusTone, toNumber } from "@/src/lib/format";
import { usePreferences } from "@/src/providers/app-providers";
import type { AnalyticsSummary, LivePayload, Order, Paginated, RoutePlan } from "@/src/types/api";
import type { RootStackParamList } from "@/src/types/navigation";

type OrdersProps = NativeStackScreenProps<RootStackParamList, "Orders">;
type RoutesProps = NativeStackScreenProps<RootStackParamList, "Routes">;
type LiveMapProps = NativeStackScreenProps<RootStackParamList, "LiveMap">;
type AnalyticsProps = NativeStackScreenProps<RootStackParamList, "Analytics">;

function statusTone(status: string) {
  return getOrderStatusTone(status);
}

function CustomerOrderCard({ order, language }: { order: Order; language: "en" | "ka" }) {
  const ping = order.assigned_driver?.latest_ping;
  const canShowTracking = order.status === "PICKED_UP" && ping;
  const lat = toNumber(order.dropoff_lat);
  const lng = toNumber(order.dropoff_lng);

  return (
    <SectionCard
      title={order.code}
      subtitle={order.dropoff_address || "No address set"}
      right={<Pill tone={statusTone(order.status)}>{formatOrderStatus(order.status, language)}</Pill>}
    >
      <StatGrid>
        <StatCard label="Placed" value={formatDateTime(order.created_at, language)} />
        <StatCard label="Market" value={order.market?.name || "Unknown market"} />
        <StatCard label="Driver" value={order.assigned_driver?.user?.name || order.offered_driver?.user?.name || "Waiting"} />
        <StatCard label="Total" value={formatMoney(order.total ?? 0, language)} />
      </StatGrid>

      {order.items?.length ? (
        <HelperText>{order.items.map((item) => `${item.name} x${item.qty}`).join(", ")}</HelperText>
      ) : null}

      {canShowTracking ? (
        <View style={styles.mapWrapper}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: toNumber(ping?.lat, lat),
              longitude: toNumber(ping?.lng, lng),
              latitudeDelta: 0.08,
              longitudeDelta: 0.08,
            }}
          >
            <Marker coordinate={{ latitude: toNumber(ping?.lat, lat), longitude: toNumber(ping?.lng, lng) }} title={order.assigned_driver?.user?.name || "Driver"} />
            <Marker coordinate={{ latitude: lat, longitude: lng }} title="Dropoff" />
          </MapView>
        </View>
      ) : (
        <HelperText>Live tracking appears once the driver has picked up the order.</HelperText>
      )}
    </SectionCard>
  );
}

export function OrdersScreen({ navigation }: OrdersProps) {
  const access = useProtectedAccess("Orders");
  const { language } = usePreferences();
  const queryClient = useQueryClient();
  const [dropoffAddress, setDropoffAddress] = useState("Tbilisi Center");
  const [dropoffLat, setDropoffLat] = useState("41.7151");
  const [dropoffLng, setDropoffLng] = useState("44.8271");
  const [search, setSearch] = useState("");

  const roles = access.me?.roles ?? [];
  const isCustomerOnly =
    roles.includes("customer") && !roles.some((role: string) => ["admin", "owner", "staff", "driver"].includes(role));
  const isOpsUser = roles.some((role: string) => ["admin", "owner", "staff"].includes(role));

  const ordersQ = useQuery({
    queryKey: ["orders"],
    queryFn: async () => (await api.get("/api/orders")).data as Paginated<Order>,
    refetchInterval: access.ready && isCustomerOnly ? 8000 : false,
    enabled: access.ready,
  });

  const createOrderM = useMutation({
    mutationFn: async () =>
      (
        await api.post("/api/orders", {
          dropoff_lat: Number(dropoffLat),
          dropoff_lng: Number(dropoffLng),
          dropoff_address: dropoffAddress,
          priority: 2,
          size: 1,
          notes: "Manual mobile ops order",
        })
      ).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      setDropoffAddress("");
    },
  });

  const marketActionM = useMutation({
    mutationFn: async ({ orderId, action }: { orderId: number; action: "market-accept" | "mark-ready" }) =>
      (await api.post(`/api/orders/${orderId}/${action}`)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const filteredOrders = useMemo(() => {
    const orders = ordersQ.data?.data ?? [];
    const text = search.trim().toLowerCase();
    if (!text) {
      return orders;
    }

    return orders.filter((order) =>
      [order.code, order.dropoff_address ?? "", order.status, order.customer_name ?? "", order.market?.name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(text),
    );
  }, [ordersQ.data?.data, search]);

  const deliveredCount = filteredOrders.filter((order) => order.status === "DELIVERED").length;
  const marketPendingCount = filteredOrders.filter((order) => order.status === "MARKET_PENDING").length;
  const driverFlowCount = filteredOrders.filter((order) => ["READY_FOR_PICKUP", "OFFERED", "ASSIGNED", "PICKED_UP"].includes(order.status)).length;

  if (!access.ready) {
    return access.fallback;
  }

  if (isCustomerOnly) {
    return (
      <AppShell navigation={navigation} screenName="Orders" title="Orders" subtitle="Your delivery timeline and live tracking in one place.">
        <StatGrid>
          <StatCard label="Visible orders" value={filteredOrders.length} />
          <StatCard label="Delivered" value={deliveredCount} />
        </StatGrid>

        {ordersQ.isLoading ? (
          <LoadingBlock message="Loading your orders..." />
        ) : ordersQ.isError ? (
          <EmptyBlock message="Failed to load orders." />
        ) : filteredOrders.length === 0 ? (
          <EmptyBlock message="You have not placed any orders yet." />
        ) : (
          <View style={uiStyles.listGap}>
            {filteredOrders.map((order) => (
              <CustomerOrderCard key={order.id} order={order} language={language} />
            ))}
          </View>
        )}
      </AppShell>
    );
  }

  return (
    <AppShell navigation={navigation} screenName="Orders" title="Orders" subtitle="Search, create, and move orders from one mobile operations surface.">
      <StatGrid>
        <StatCard label="Visible orders" value={filteredOrders.length} />
        <StatCard label="Market pending" value={marketPendingCount} />
        <StatCard label="In driver flow" value={driverFlowCount} />
        <StatCard label="Delivered" value={deliveredCount} />
      </StatGrid>

      {isOpsUser ? (
        <SectionCard title="Create ops order" subtitle="Manual order intake for dispatch or call center workflows.">
          <InputField label="Dropoff address" value={dropoffAddress} onChangeText={setDropoffAddress} placeholder="Dropoff address" />
          <InputField label="Latitude" value={dropoffLat} onChangeText={setDropoffLat} keyboardType="numeric" />
          <InputField label="Longitude" value={dropoffLng} onChangeText={setDropoffLng} keyboardType="numeric" />
          {createOrderM.error ? <HelperText tone="danger">{getErrorMessage(createOrderM.error)}</HelperText> : null}
          <AppButton onPress={() => createOrderM.mutate()} disabled={createOrderM.isPending}>
            {createOrderM.isPending ? "Creating..." : "Create order"}
          </AppButton>
        </SectionCard>
      ) : null}

      <SectionCard title="Operations order list">
        <InputField label="Search orders" value={search} onChangeText={setSearch} placeholder="Code, customer, market, status" />
      </SectionCard>

      {ordersQ.isLoading ? (
        <LoadingBlock message="Loading orders..." />
      ) : ordersQ.isError ? (
        <EmptyBlock message="Failed to load orders." />
      ) : filteredOrders.length === 0 ? (
        <EmptyBlock message="No orders matched your search." />
      ) : (
        <View style={uiStyles.listGap}>
          {filteredOrders.map((order) => (
            <SectionCard
              key={order.id}
              title={order.code}
              subtitle={`${order.market?.name || "Direct order"} • ${order.customer_name || order.customer?.name || "Unknown customer"}`}
              right={<Pill tone={statusTone(order.status)}>{formatOrderStatus(order.status, language)}</Pill>}
            >
              <HelperText>{order.dropoff_address || "No address set"}</HelperText>
              <HelperText>
                Driver: {order.assigned_driver?.user?.name || order.offered_driver?.user?.name || "Unassigned"} • Total: {order.total != null ? formatMoney(order.total, language) : "-"}
              </HelperText>
              <HelperText>Created: {formatDateTime(order.created_at, language)}</HelperText>

              {isOpsUser && order.market ? (
                <View style={styles.actionRow}>
                  {order.status === "MARKET_PENDING" ? (
                    <AppButton compact onPress={() => marketActionM.mutate({ orderId: order.id, action: "market-accept" })}>
                      Accept
                    </AppButton>
                  ) : null}
                  {order.status === "MARKET_ACCEPTED" ? (
                    <AppButton compact onPress={() => marketActionM.mutate({ orderId: order.id, action: "mark-ready" })}>
                      Mark ready
                    </AppButton>
                  ) : null}
                  {order.status === "READY_FOR_PICKUP" ? <Pill tone="warning">Waiting for driver</Pill> : null}
                  {["OFFERED", "ASSIGNED", "PICKED_UP", "DELIVERED"].includes(order.status) ? <Pill>In delivery flow</Pill> : null}
                </View>
              ) : null}
            </SectionCard>
          ))}
        </View>
      )}
    </AppShell>
  );
}

export function RoutesScreen({ navigation }: RoutesProps) {
  const access = useProtectedAccess("Routes");
  const { language } = usePreferences();

  const routesQ = useQuery({
    queryKey: ["live-routes"],
    queryFn: async () => (await api.get("/api/live/routes")).data as RoutePlan[],
    enabled: access.ready,
  });

  if (!access.ready) {
    return access.fallback;
  }

  return (
    <AppShell navigation={navigation} screenName="Routes" title="Routes" subtitle="Current route plans and stop sequences from /api/live/routes.">
      {routesQ.isLoading ? (
        <LoadingBlock message="Loading routes..." />
      ) : routesQ.isError ? (
        <EmptyBlock message="Failed to load routes." />
      ) : (routesQ.data ?? []).length === 0 ? (
        <EmptyBlock message="No routes are planned for today yet." />
      ) : (
        <View style={uiStyles.listGap}>
          {(routesQ.data ?? []).map((route) => (
            <SectionCard
              key={route.id}
              title={`Route #${route.id}`}
              subtitle={`${route.driver?.user?.name || `Driver #${route.driver_id}`} • ${route.route_date}`}
              right={<Pill>{route.status}</Pill>}
            >
              <StatGrid>
                <StatCard label="Distance" value={route.planned_distance_km != null ? `${route.planned_distance_km} km` : "-"} />
                <StatCard label="Duration" value={route.planned_duration_min != null ? `${route.planned_duration_min} min` : "-"} />
              </StatGrid>

              {(route.stops ?? []).length === 0 ? (
                <HelperText>No stops on this route yet.</HelperText>
              ) : (
                <View style={uiStyles.listGap}>
                  {(route.stops ?? []).map((stop) => (
                    <SectionCard
                      key={stop.id}
                      title={`Stop ${stop.sequence}`}
                      subtitle={stop.order?.code || `Order #${stop.order_id}`}
                      right={<Pill>{stop.status}</Pill>}
                    >
                      <HelperText>{stop.order?.dropoff_address || "No address set"}</HelperText>
                      {stop.eta ? <HelperText>ETA {formatDateTime(stop.eta, language)}</HelperText> : null}
                    </SectionCard>
                  ))}
                </View>
              )}
            </SectionCard>
          ))}
        </View>
      )}
    </AppShell>
  );
}

export function LiveMapScreen({ navigation }: LiveMapProps) {
  const access = useProtectedAccess("LiveMap");
  const { language } = usePreferences();
  const pollInterval = Number(process.env.EXPO_PUBLIC_POLL_INTERVAL ?? 4000);
  const centerLat = Number(process.env.EXPO_PUBLIC_MAP_DEFAULT_LAT ?? 41.7151);
  const centerLng = Number(process.env.EXPO_PUBLIC_MAP_DEFAULT_LNG ?? 44.8271);

  const liveQ = useQuery({
    queryKey: ["live-locations"],
    queryFn: async () => (await api.get("/api/live/locations")).data as LivePayload,
    refetchInterval: access.ready ? pollInterval : false,
    enabled: access.ready,
  });

  const locations = liveQ.data?.locations ?? [];

  if (!access.ready) {
    return access.fallback;
  }

  return (
    <AppShell navigation={navigation} screenName="LiveMap" title="Live Map" subtitle="Driver locations update on the same polling interval used on the web app.">
      <StatGrid>
        <StatCard label="Visible drivers" value={locations.length} />
        <StatCard label="Poll interval" value={`${pollInterval} ms`} />
        <StatCard label="Window started" value={formatDateTime(liveQ.data?.since, language)} />
      </StatGrid>

      <SectionCard title="Telemetry map">
        <View style={styles.mapWrapper}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: centerLat,
              longitude: centerLng,
              latitudeDelta: 0.2,
              longitudeDelta: 0.2,
            }}
          >
            {locations.map((location) => (
              <Marker
                key={location.driver_id}
                coordinate={{ latitude: toNumber(location.lat, centerLat), longitude: toNumber(location.lng, centerLng) }}
                title={`Driver #${location.driver_id}`}
                description={formatDateTime(location.updated_at || location.created_at, language)}
              />
            ))}
          </MapView>
        </View>
        {liveQ.isError ? <HelperText tone="danger">Failed to load live locations.</HelperText> : null}
      </SectionCard>
    </AppShell>
  );
}

export function AnalyticsScreen({ navigation }: AnalyticsProps) {
  const access = useProtectedAccess("Analytics");

  const summaryQ = useQuery({
    queryKey: ["analytics-summary"],
    queryFn: async () => (await api.get("/api/analytics/summary")).data as AnalyticsSummary,
    enabled: access.ready,
  });

  const summary = summaryQ.data;
  const deliveredRate = summary && summary.orders.total > 0 ? Math.round((summary.orders.delivered / summary.orders.total) * 100) : 0;

  if (!access.ready) {
    return access.fallback;
  }

  return (
    <AppShell navigation={navigation} screenName="Analytics" title="Analytics" subtitle="Operational summary mirrored directly from /api/analytics/summary.">
      <SectionCard title="Delivery rate" subtitle="Percentage of delivered orders in the current summary range.">
        <Text style={styles.analyticsRate}>{deliveredRate}%</Text>
        <AppButton variant="secondary" onPress={() => void summaryQ.refetch()}>
          Refresh
        </AppButton>
      </SectionCard>

      {summaryQ.isLoading ? (
        <LoadingBlock message="Loading analytics..." />
      ) : summaryQ.isError || !summary ? (
        <EmptyBlock message="Failed to load analytics." />
      ) : (
        <>
          <StatGrid>
            <StatCard label="Total orders" value={summary.orders.total} />
            <StatCard label="Delivered" value={summary.orders.delivered} />
            <StatCard label="Failed" value={summary.orders.failed} />
            <StatCard label="Cancelled" value={summary.orders.cancelled} />
            <StatCard label="Routes planned" value={summary.routes_planned} />
          </StatGrid>

          <SectionCard title="Reporting range">
            <HelperText>From {summary.range.from}</HelperText>
            <HelperText>To {summary.range.to}</HelperText>
          </SectionCard>
        </>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  mapWrapper: {
    borderRadius: 20,
    overflow: "hidden",
    minHeight: 260,
  },
  map: {
    width: "100%",
    height: 280,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  analyticsRate: {
    fontSize: 48,
    fontWeight: "800",
    color: "#0f172a",
  },
});
