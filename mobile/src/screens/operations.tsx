import { useMemo, useRef, useState } from "react";
import { Alert as RNAlert, Pressable, StyleSheet, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppShell } from "@/src/components/app-shell";
import {
  CustomerOrderCard,
  OpsOrderCard,
  OrderActionsSheet,
  OrderDetailSheet,
} from "@/src/components/operations/orders";
import { HBar, LegendDot, RankBadge } from "@/src/components/operations/shared";
import {
  Alert,
  AppText,
  Badge,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  Input,
  LoadingBlock,
  Panel,
  Progress,
  Row,
  Sheet,
  StatCard,
  StatGrid,
  StatusBadge,
  radius,
  useColors,
  withAlpha,
} from "@/src/components/ui";
import type { IconName, Tone } from "@/src/components/ui";
import { useProtectedAccess } from "@/src/hooks/use-protected-access";
import { api } from "@/src/lib/api";
import { getErrorMessage } from "@/src/lib/errors";
import { formatDateTime, formatMoney, toNumber } from "@/src/lib/format";
import { usePreferences } from "@/src/providers/app-providers";
import type {
  AnalyticsSummary,
  LiveAlertPayload,
  LiveHistoryPayload,
  LivePayload,
  Order,
  Paginated,
  RoutePlan,
} from "@/src/types/api";
import type { RootStackParamList } from "@/src/types/navigation";

type OrdersProps = NativeStackScreenProps<RootStackParamList, "Orders">;
type RoutesProps = NativeStackScreenProps<RootStackParamList, "Routes">;
type LiveMapProps = NativeStackScreenProps<RootStackParamList, "LiveMap">;
type AnalyticsProps = NativeStackScreenProps<RootStackParamList, "Analytics">;

const copy = {
  en: {
    myOrders: "My orders",
    myDeliveries: "My deliveries",
    ordersTitle: "Orders",
    customerSubtitle: "Follow your orders from the market to your door.",
    driverSubtitle: "Orders assigned or offered to you.",
    opsSubtitle: "Move orders through the market and driver flow.",
    liveMapTitle: "Live map",
    liveMapSubtitle: "Driver positions, route history and alerts.",
    analyticsTitle: "Analytics",
    analyticsSubtitle: "Delivery performance by day, market and driver.",
    routesTitle: "Routes",
    routesSubtitle: "Planned driver routes and their stops.",
  },
  ka: {
    myOrders: "ჩემი შეკვეთები",
    myDeliveries: "ჩემი მიწოდებები",
    ordersTitle: "შეკვეთები",
    customerSubtitle: "თვალი ადევნეთ შეკვეთას მარკეტიდან კარამდე.",
    driverSubtitle: "თქვენზე მიბმული ან შემოთავაზებული შეკვეთები.",
    opsSubtitle: "შეკვეთების მართვა მარკეტისა და მძღოლის ეტაპებზე.",
    liveMapTitle: "ცოცხალი რუკა",
    liveMapSubtitle: "მძღოლების პოზიციები, მარშრუტის ისტორია და გაფრთხილებები.",
    analyticsTitle: "ანალიტიკა",
    analyticsSubtitle: "მიწოდების მაჩვენებლები დღეების, ბაზრებისა და მძღოლების მიხედვით.",
    routesTitle: "მარშრუტები",
    routesSubtitle: "მძღოლების დაგეგმილი მარშრუტები და გაჩერებები.",
  },
} as const;

/* -------------------------------------------------------------------------------------------------
 * Orders
 * -----------------------------------------------------------------------------------------------*/

type StatusFilter = "all" | "pending" | "in_progress" | "delivered" | "cancelled";

const DRIVER_FLOW_STATUSES = ["READY_FOR_PICKUP", "OFFERED", "ASSIGNED", "PICKED_UP"];

const STATUS_GROUPS: Record<Exclude<StatusFilter, "all">, string[]> = {
  pending: ["MARKET_PENDING"],
  in_progress: ["MARKET_ACCEPTED", ...DRIVER_FLOW_STATUSES],
  delivered: ["DELIVERED"],
  cancelled: ["CANCELLED", "FAILED"],
};

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All",
  pending: "Waiting for market",
  in_progress: "In progress",
  delivered: "Delivered",
  cancelled: "Cancelled / failed",
};

function matchesStatus(order: Order, filter: StatusFilter) {
  return filter === "all" || STATUS_GROUPS[filter].includes(order.status);
}

export function OrdersScreen({ navigation }: OrdersProps) {
  const access = useProtectedAccess("Orders");
  const { language } = usePreferences();
  const c = useColors();
  const text = copy[language];
  const queryClient = useQueryClient();
  const [dropoffAddress, setDropoffAddress] = useState("Tbilisi Center");
  const [dropoffLat, setDropoffLat] = useState("41.7151");
  const [dropoffLng, setDropoffLng] = useState("44.8271");
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [rating, setRating] = useState("5");
  const [feedback, setFeedback] = useState("");
  const [reason, setReason] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [marketFilter, setMarketFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<number | null>(null);
  const [menuOrder, setMenuOrder] = useState<Order | null>(null);

  const roles = access.me?.roles ?? [];
  const isCustomerOnly =
    roles.includes("customer") && !roles.some((role: string) => ["admin", "owner", "staff", "driver"].includes(role));
  const isOpsUser = roles.some((role: string) => ["admin", "owner", "staff"].includes(role));
  const isDriver = roles.includes("driver");

  const ordersQ = useQuery({
    queryKey: ["orders"],
    queryFn: async () => (await api.get("/api/orders")).data as Paginated<Order>,
    refetchInterval: access.ready && isCustomerOnly ? 8000 : false,
    enabled: access.ready,
  });

  const detailQ = useQuery({
    queryKey: ["order-detail", selectedOrderId],
    queryFn: async () => (await api.get(`/api/orders/${selectedOrderId}`)).data as Order,
    enabled: access.ready && selectedOrderId != null,
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
      setCreateOpen(false);
    },
  });

  const marketActionM = useMutation({
    mutationFn: async ({ orderId, action }: { orderId: number; action: "market-accept" | "mark-ready" }) =>
      (await api.post(`/api/orders/${orderId}/${action}`)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["order-detail"] });
    },
  });

  const cancelM = useMutation({
    mutationFn: async (orderId: number) => (await api.post(`/api/orders/${orderId}/request-cancel`, { reason: reason || null })).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["order-detail"] });
      setReason("");
    },
  });

  const reorderM = useMutation({
    mutationFn: async (orderId: number) => (await api.post(`/api/orders/${orderId}/reorder`)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const refundM = useMutation({
    mutationFn: async (orderId: number) => (await api.post(`/api/orders/${orderId}/request-refund`, { reason: refundReason || "Requested by customer" })).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["order-detail"] });
      setRefundReason("");
    },
  });

  const rateM = useMutation({
    mutationFn: async (orderId: number) => (await api.post(`/api/orders/${orderId}/rate`, { rating: Number(rating), feedback: feedback || null })).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["order-detail"] });
      setFeedback("");
      setRating("5");
    },
  });

  const allOrders = useMemo(() => ordersQ.data?.data ?? [], [ordersQ.data?.data]);

  const filteredOrders = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return allOrders;

    return allOrders.filter((order) =>
      [order.code, order.dropoff_address ?? "", order.status, order.customer_name ?? "", order.market?.name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(value),
    );
  }, [allOrders, search]);

  const markets = useMemo(() => {
    const map = new Map<number, string>();
    for (const order of allOrders) {
      if (order.market) map.set(order.market.id, order.market.name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [allOrders]);

  const visibleOrders = useMemo(
    () =>
      filteredOrders.filter(
        (order) => matchesStatus(order, statusFilter) && (marketFilter === "all" || String(order.market?.id ?? "") === marketFilter),
      ),
    [filteredOrders, statusFilter, marketFilter],
  );

  const deliveredCount = filteredOrders.filter((order) => order.status === "DELIVERED").length;
  const marketPendingCount = filteredOrders.filter((order) => order.status === "MARKET_PENDING").length;
  const driverFlowCount = filteredOrders.filter((order) => DRIVER_FLOW_STATUSES.includes(order.status)).length;
  const inProgressCount = filteredOrders.filter((order) => matchesStatus(order, "in_progress")).length;
  const cancelledCount = filteredOrders.filter((order) => matchesStatus(order, "cancelled")).length;

  if (!access.ready) {
    return access.fallback;
  }

  const actionError =
    getErrorMessage(marketActionM.error) ||
    getErrorMessage(cancelM.error) ||
    getErrorMessage(reorderM.error) ||
    getErrorMessage(rateM.error) ||
    getErrorMessage(refundM.error);

  const toggleStatus = (value: StatusFilter) => setStatusFilter((current) => (current === value ? "all" : value));
  const filtersActive = search.trim() !== "" || statusFilter !== "all" || marketFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setMarketFilter("all");
  };

  const title = isCustomerOnly ? text.myOrders : isDriver && !isOpsUser ? text.myDeliveries : text.ordersTitle;
  const subtitle = isCustomerOnly ? text.customerSubtitle : isDriver && !isOpsUser ? text.driverSubtitle : text.opsSubtitle;

  const acceptOrder = (orderId: number) => marketActionM.mutate({ orderId, action: "market-accept" });
  const markReady = (orderId: number) => marketActionM.mutate({ orderId, action: "mark-ready" });
  const trackOrder = (code: string) => {
    setSelectedOrderId(null);
    navigation.navigate("OrderTracking", { code });
  };
  const confirmDetailCancel = (orderId: number) =>
    RNAlert.alert("Cancel this order?", "We'll send a cancellation request to the market. Orders already on the way may not be cancellable.", [
      { text: "Keep order", style: "cancel" },
      { text: "Cancel order", style: "destructive", onPress: () => cancelM.mutate(orderId) },
    ]);

  const detailOrder = detailQ.data;
  const noOrdersAtAll = isCustomerOnly && allOrders.length === 0;

  return (
    <AppShell navigation={navigation} screenName="Orders" title={title} subtitle={subtitle}>
      {!isCustomerOnly && isOpsUser ? (
        <Row justify="flex-end">
          <Button icon="add-circle-outline" onPress={() => setCreateOpen(true)}>
            New order
          </Button>
        </Row>
      ) : null}

      <StatGrid>
        <StatCard
          label={isCustomerOnly ? "Your orders" : "Visible orders"}
          value={filteredOrders.length}
          icon="clipboard-outline"
          note={statusFilter === "all" ? "Showing all" : "Tap to show all"}
          onPress={() => setStatusFilter("all")}
          active={statusFilter === "all"}
        />
        <StatCard
          label="Waiting for market"
          value={marketPendingCount}
          icon="storefront-outline"
          tone="warning"
          note="Needs market acceptance"
          onPress={() => toggleStatus("pending")}
          active={statusFilter === "pending"}
        />
        <StatCard
          label="In progress"
          value={inProgressCount}
          icon="car-outline"
          tone="info"
          note={`${driverFlowCount} in driver flow`}
          onPress={() => toggleStatus("in_progress")}
          active={statusFilter === "in_progress"}
        />
        <StatCard
          label="Delivered"
          value={deliveredCount}
          icon="checkmark-done-outline"
          tone="success"
          note={cancelledCount > 0 ? `${cancelledCount} cancelled / failed` : "With delivery proof"}
          onPress={() => toggleStatus("delivered")}
          active={statusFilter === "delivered"}
        />
      </StatGrid>

      <View style={styles.filters}>
        <Input
          value={search}
          onChangeText={setSearch}
          icon="search"
          placeholder={isCustomerOnly ? "Search by order code or address" : "Search code, address, customer, market..."}
          returnKeyType="search"
          right={search ? <Ionicons name="close-circle" size={18} color={c.mutedForeground} onPress={() => setSearch("")} /> : undefined}
        />
        <ChipRow>
          {(Object.keys(STATUS_FILTER_LABELS) as StatusFilter[]).map((key) => (
            <Chip key={key} label={STATUS_FILTER_LABELS[key]} selected={statusFilter === key} onPress={() => setStatusFilter(key)} />
          ))}
        </ChipRow>
        {!isCustomerOnly && markets.length > 1 ? (
          <ChipRow>
            <Chip label="All markets" icon="storefront-outline" selected={marketFilter === "all"} onPress={() => setMarketFilter("all")} />
            {markets.map(([id, name]) => (
              <Chip key={id} label={name} selected={marketFilter === String(id)} onPress={() => setMarketFilter(String(id))} />
            ))}
          </ChipRow>
        ) : null}
        {filtersActive ? (
          <Row justify="space-between">
            <AppText variant="caption">
              Showing {visibleOrders.length} of {allOrders.length} orders
            </AppText>
            <Button variant="ghost" size="sm" onPress={clearFilters}>
              Clear filters
            </Button>
          </Row>
        ) : null}
      </View>

      {actionError ? <Alert tone="destructive" title="Action failed" description={actionError} /> : null}

      {ordersQ.isLoading ? (
        <LoadingBlock message="Loading orders..." rows={4} />
      ) : ordersQ.isError ? (
        <Alert tone="destructive" title="Failed to load orders" description={getErrorMessage(ordersQ.error) || "Check your connection and try again."} />
      ) : visibleOrders.length === 0 ? (
        <EmptyState
          icon="clipboard-outline"
          title={noOrdersAtAll ? "You have not placed any orders yet." : "No orders matched your filters."}
          description={
            noOrdersAtAll ? "Browse markets and place your first order. It will show up here with live status." : "Try a different search term or clear the filters."
          }
          action={
            noOrdersAtAll ? (
              <Button icon="storefront-outline" onPress={() => navigation.navigate("PublicMarkets")}>
                Browse markets
              </Button>
            ) : filtersActive ? (
              <Button variant="outline" onPress={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : isCustomerOnly ? (
        <View style={styles.list}>
          {visibleOrders.map((order) => (
            <CustomerOrderCard
              key={order.id}
              order={order}
              language={language}
              onOpenDetail={() => setSelectedOrderId(order.id)}
              onTrack={() => trackOrder(order.code)}
              onReorder={() => reorderM.mutate(order.id)}
              onCancel={() => setCancelTargetId(order.id)}
              reorderPending={reorderM.isPending && reorderM.variables === order.id}
            />
          ))}
        </View>
      ) : (
        <View style={styles.list}>
          {visibleOrders.map((order) => (
            <OpsOrderCard
              key={order.id}
              order={order}
              language={language}
              canManage={isOpsUser}
              pending={marketActionM.isPending && marketActionM.variables?.orderId === order.id}
              onOpenDetail={() => setSelectedOrderId(order.id)}
              onAccept={() => acceptOrder(order.id)}
              onMarkReady={() => markReady(order.id)}
              onMore={() => setMenuOrder(order)}
            />
          ))}
        </View>
      )}

      <OrderActionsSheet
        order={menuOrder}
        canManage={isOpsUser}
        onClose={() => setMenuOrder(null)}
        onOpenDetail={() => {
          const id = menuOrder?.id ?? null;
          setMenuOrder(null);
          setSelectedOrderId(id);
        }}
        onAccept={() => {
          if (menuOrder) acceptOrder(menuOrder.id);
          setMenuOrder(null);
        }}
        onMarkReady={() => {
          if (menuOrder) markReady(menuOrder.id);
          setMenuOrder(null);
        }}
      />

      <Sheet
        visible={createOpen}
        title="Create ops order"
        description="Manual order intake for call center or dispatch scenarios."
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button variant="outline" onPress={() => setCreateOpen(false)} style={styles.flex}>
              Cancel
            </Button>
            <Button icon="add-circle-outline" onPress={() => createOrderM.mutate()} loading={createOrderM.isPending} style={styles.flex}>
              Create order
            </Button>
          </>
        }
      >
        <Input label="Dropoff address" value={dropoffAddress} onChangeText={setDropoffAddress} icon="location-outline" />
        <Row gap={12} align="flex-start">
          <View style={styles.flex}>
            <Input label="Latitude" value={dropoffLat} onChangeText={setDropoffLat} keyboardType="numeric" />
          </View>
          <View style={styles.flex}>
            <Input label="Longitude" value={dropoffLng} onChangeText={setDropoffLng} keyboardType="numeric" />
          </View>
        </Row>
        <AppText variant="caption">Created with priority 2, size 1 and a manual ops note.</AppText>
        {createOrderM.error ? <Alert tone="destructive" title="Could not create order" description={getErrorMessage(createOrderM.error) ?? undefined} /> : null}
      </Sheet>

      <Sheet
        visible={cancelTargetId != null}
        title="Cancel this order?"
        description="We'll send a cancellation request to the market. Orders already on the way may not be cancellable."
        onClose={() => setCancelTargetId(null)}
        footer={
          <>
            <Button variant="outline" onPress={() => setCancelTargetId(null)} style={styles.flex}>
              Keep order
            </Button>
            <Button
              variant="destructive"
              loading={cancelM.isPending}
              onPress={() => {
                if (cancelTargetId != null) cancelM.mutate(cancelTargetId);
                setCancelTargetId(null);
              }}
              style={styles.flex}
            >
              Cancel order
            </Button>
          </>
        }
      >
        <Input label="Reason (optional)" value={reason} onChangeText={setReason} placeholder="Tell the market why you're cancelling" multiline />
      </Sheet>

      <OrderDetailSheet
        visible={selectedOrderId != null}
        order={detailOrder}
        isLoading={detailQ.isLoading}
        isError={detailQ.isError}
        language={language}
        isCustomerOnly={isCustomerOnly}
        canManage={!isCustomerOnly && isOpsUser}
        marketPending={marketActionM.isPending}
        onClose={() => setSelectedOrderId(null)}
        onAccept={() => detailOrder && acceptOrder(detailOrder.id)}
        onMarkReady={() => detailOrder && markReady(detailOrder.id)}
        onTrack={() => detailOrder && trackOrder(detailOrder.code)}
        rating={rating}
        setRating={setRating}
        feedback={feedback}
        setFeedback={setFeedback}
        onRate={() => detailOrder && rateM.mutate(detailOrder.id)}
        ratePending={rateM.isPending}
        reason={reason}
        setReason={setReason}
        refundReason={refundReason}
        setRefundReason={setRefundReason}
        onReorder={() => detailOrder && reorderM.mutate(detailOrder.id)}
        reorderPending={reorderM.isPending}
        onRefund={() => detailOrder && refundM.mutate(detailOrder.id)}
        refundPending={refundM.isPending}
        onCancel={() => detailOrder && confirmDetailCancel(detailOrder.id)}
        cancelPending={cancelM.isPending}
      />
    </AppShell>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Routes
 * -----------------------------------------------------------------------------------------------*/

function MetaItem({ icon, label }: { icon: IconName; label: string }) {
  const c = useColors();
  return (
    <Row gap={5}>
      <Ionicons name={icon} size={14} color={c.mutedForeground} />
      <AppText variant="small" tone="muted">
        {label}
      </AppText>
    </Row>
  );
}

function RouteCard({ route, defaultOpen, language }: { route: RoutePlan; defaultOpen: boolean; language: "en" | "ka" }) {
  const c = useColors();
  const [open, setOpen] = useState(defaultOpen);
  const stops = route.stops ?? [];

  return (
    <Card title={`Route #${route.id}`} right={<StatusBadge status={route.status} />}>
      <Row gap={14} wrap>
        <MetaItem icon="car-outline" label={route.driver?.user?.name || `Driver #${route.driver_id}`} />
        <MetaItem icon="calendar-outline" label={route.route_date} />
        <MetaItem icon="location-outline" label={`${stops.length} stop${stops.length === 1 ? "" : "s"}`} />
        {route.planned_distance_km != null ? <MetaItem icon="git-branch-outline" label={`${route.planned_distance_km} km`} /> : null}
        {route.planned_duration_min != null ? <MetaItem icon="timer-outline" label={`${route.planned_duration_min} min`} /> : null}
      </Row>

      <Button variant="outline" size="sm" icon={open ? "chevron-up" : "chevron-down"} onPress={() => setOpen((value) => !value)} style={styles.selfStart}>
        {open ? "Hide stops" : "Show stops"}
      </Button>

      {open ? (
        stops.length === 0 ? (
          <EmptyState compact icon="location-outline" title="No stops on this route yet" />
        ) : (
          <View style={styles.stopList}>
            {[...stops]
              .sort((a, b) => a.sequence - b.sequence)
              .map((stop) => (
                <View key={stop.id} style={[styles.stop, { borderColor: c.border, backgroundColor: withAlpha(c.muted, 0.5) }]}>
                  <View style={[styles.stopNumber, { backgroundColor: c.primary }]}>
                    <AppText variant="caption" style={[styles.semibold, { color: c.primaryForeground }]}>
                      {stop.sequence}
                    </AppText>
                  </View>
                  <View style={styles.flexShrink}>
                    <Row justify="space-between" align="flex-start" gap={8}>
                      <View style={styles.flexShrink}>
                        <AppText variant="label" style={styles.semibold}>
                          {stop.order?.code || `Order #${stop.order_id}`}
                        </AppText>
                        <AppText variant="caption" numberOfLines={1}>
                          {stop.order?.dropoff_address || "No address set"}
                        </AppText>
                      </View>
                      <StatusBadge status={stop.status} />
                    </Row>
                    <Row gap={12} wrap style={styles.mt6}>
                      <Row gap={4}>
                        <Ionicons name="time-outline" size={13} color={c.mutedForeground} />
                        <AppText variant="caption">ETA {formatDateTime(stop.eta, language)}</AppText>
                      </Row>
                      <AppText variant="caption">
                        Score <AppText variant="caption" tone="default" style={styles.semibold}>{String(stop.dispatch_score ?? "-")}</AppText>
                      </AppText>
                    </Row>
                  </View>
                </View>
              ))}
          </View>
        )
      ) : null}
    </Card>
  );
}

export function RoutesScreen({ navigation }: RoutesProps) {
  const access = useProtectedAccess("Routes");
  const { language } = usePreferences();
  const text = copy[language];

  const routesQ = useQuery({
    queryKey: ["live-routes"],
    queryFn: async () => (await api.get("/api/live/routes")).data as RoutePlan[],
    enabled: access.ready,
  });

  if (!access.ready) {
    return access.fallback;
  }

  const routes = routesQ.data ?? [];
  const totalStops = routes.reduce((sum, route) => sum + (route.stops?.length ?? 0), 0);
  const subtitle =
    routes.length > 0
      ? `${routes.length} planned route${routes.length === 1 ? "" : "s"} with ${totalStops} stop${totalStops === 1 ? "" : "s"}.`
      : text.routesSubtitle;

  return (
    <AppShell navigation={navigation} screenName="Routes" title={text.routesTitle} subtitle={subtitle}>
      {routesQ.isLoading ? (
        <LoadingBlock message="Loading routes..." />
      ) : routesQ.isError ? (
        <Alert tone="destructive" title="Failed to load routes" description="Something went wrong while fetching route plans. Pull to refresh or try again." />
      ) : routes.length === 0 ? (
        <EmptyState icon="git-branch-outline" title="No routes are planned yet" description="Routes appear here once orders are dispatched and assigned to drivers." />
      ) : (
        <View style={styles.list}>
          {routes.map((route, index) => (
            <RouteCard key={route.id} route={route} defaultOpen={index === 0} language={language} />
          ))}
        </View>
      )}
    </AppShell>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Live map
 * -----------------------------------------------------------------------------------------------*/

type DriverState = "live" | "idle" | "stale";
type DriverFilter = "all" | DriverState;

const STATE_LABEL: Record<DriverState, string> = { live: "Live", idle: "Idle", stale: "Stale ping" };
const STATE_TONE: Record<DriverState, Tone> = { live: "primary", idle: "info", stale: "warning" };

function AlertColumn({ title, items, tone }: { title: string; items: string[]; tone: Tone }) {
  const c = useColors();
  return (
    <Panel>
      <Row justify="space-between">
        <AppText variant="label">{title}</AppText>
        <Badge tone={items.length > 0 ? tone : "neutral"}>{String(items.length)}</Badge>
      </Row>
      {items.length === 0 ? (
        <AppText variant="small" tone="muted">
          No alerts right now.
        </AppText>
      ) : (
        items.slice(0, 5).map((item, index) => (
          <View key={`${item}-${index}`} style={[styles.alertItem, { borderColor: c.border, backgroundColor: c.card }]}>
            <AppText variant="small" numberOfLines={1}>
              {item}
            </AppText>
          </View>
        ))
      )}
    </Panel>
  );
}

export function LiveMapScreen({ navigation }: LiveMapProps) {
  const access = useProtectedAccess("LiveMap");
  const { language } = usePreferences();
  const c = useColors();
  const text = copy[language];
  const mapRef = useRef<MapView>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DriverFilter>("all");
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const pollInterval = Number(process.env.EXPO_PUBLIC_POLL_INTERVAL ?? 4000);
  const centerLat = Number(process.env.EXPO_PUBLIC_MAP_DEFAULT_LAT ?? 41.7151);
  const centerLng = Number(process.env.EXPO_PUBLIC_MAP_DEFAULT_LNG ?? 44.8271);

  const liveQ = useQuery({
    queryKey: ["live-locations"],
    queryFn: async () => (await api.get("/api/live/locations")).data as LivePayload,
    refetchInterval: access.ready ? pollInterval : false,
    enabled: access.ready,
  });

  const alertsQ = useQuery({
    queryKey: ["live-alerts"],
    queryFn: async () => (await api.get("/api/live/alerts")).data as LiveAlertPayload,
    refetchInterval: access.ready ? pollInterval : false,
    enabled: access.ready,
  });

  const historyQ = useQuery({
    queryKey: ["live-history"],
    queryFn: async () => (await api.get("/api/live/history", { params: { minutes: 45 } })).data as LiveHistoryPayload,
    refetchInterval: access.ready ? pollInterval * 2 : false,
    enabled: access.ready,
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

  if (!access.ready) {
    return access.fallback;
  }

  const stateColor: Record<DriverState, string> = { live: c.primary, idle: c.info, stale: c.warning };
  const driverName = (id: number) => driverInfo.names.get(id) ?? `Driver #${id}`;
  const driverState = (id: number): DriverState => driverInfo.states.get(id) ?? "live";

  const term = search.trim().toLowerCase();
  const visibleLocations = locations.filter((location) => {
    if (filter !== "all" && driverState(location.driver_id) !== filter) return false;
    if (!term) return true;
    return driverName(location.driver_id).toLowerCase().includes(term) || String(location.driver_id).includes(term);
  });

  const selectDriver = (driverId: number) => {
    setSelectedDriverId(driverId);
    const location = locations.find((entry) => entry.driver_id === driverId);
    if (location) {
      mapRef.current?.animateToRegion(
        {
          latitude: toNumber(location.lat, centerLat),
          longitude: toNumber(location.lng, centerLng),
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        },
        600,
      );
    }
  };

  const isFetching = liveQ.isFetching || alertsQ.isFetching || historyQ.isFetching;
  const refreshAll = () => {
    void liveQ.refetch();
    void alertsQ.refetch();
    void historyQ.refetch();
  };
  const lastUpdated = liveQ.dataUpdatedAt ? new Date(liveQ.dataUpdatedAt).toISOString() : null;

  return (
    <AppShell navigation={navigation} screenName="LiveMap" title={text.liveMapTitle} subtitle={text.liveMapSubtitle}>
      <Row justify="space-between" gap={12}>
        <AppText variant="caption" style={styles.flexShrink}>
          Updated: {lastUpdated ? formatDateTime(lastUpdated, language) : "-"}
        </AppText>
        <Button variant="outline" size="sm" icon="refresh" onPress={refreshAll} loading={isFetching}>
          Refresh
        </Button>
      </Row>

      {liveQ.isError || alertsQ.isError || historyQ.isError ? (
        <Alert tone="destructive" title="Failed to load live operations data." description="The map keeps retrying every few seconds." />
      ) : null}

      <StatGrid>
        <StatCard label="Visible drivers" value={locations.length} icon="location-outline" tone="primary" />
        <StatCard label="Playback tracks" value={tracks.length} icon="git-branch-outline" tone="info" />
        <StatCard label="Stale tracking" value={staleDrivers.length} icon="timer-outline" tone={staleDrivers.length > 0 ? "warning" : "neutral"} />
        <StatCard label="Active alerts" value={alertCount} icon="warning-outline" tone={alertCount > 0 ? "warning" : "neutral"} />
      </StatGrid>

      <Card padded={false}>
        <View style={styles.mapWrapper}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: centerLat,
              longitude: centerLng,
              latitudeDelta: 0.2,
              longitudeDelta: 0.2,
            }}
          >
            {tracks.map((track) =>
              track.points.length > 1 ? (
                <Polyline
                  key={`track-${track.driver_id}`}
                  coordinates={track.points.map((point) => ({ latitude: toNumber(point.lat, centerLat), longitude: toNumber(point.lng, centerLng) }))}
                  strokeColor={withAlpha(c.primary, 0.7)}
                  strokeWidth={4}
                />
              ) : null,
            )}
            {locations.map((location) => {
              const state = driverState(location.driver_id);
              return (
                <Marker
                  key={`${location.driver_id}-${state}`}
                  coordinate={{ latitude: toNumber(location.lat, centerLat), longitude: toNumber(location.lng, centerLng) }}
                  title={driverName(location.driver_id)}
                  description={formatDateTime(location.updated_at || location.created_at, language)}
                  pinColor={stateColor[state]}
                  zIndex={location.driver_id === selectedDriverId ? 1000 : 0}
                  onPress={() => setSelectedDriverId(location.driver_id)}
                />
              );
            })}
          </MapView>
          <View style={[styles.mapOverlay, { backgroundColor: withAlpha(c.card, 0.95), borderColor: c.border }]}>
            <AppText variant="caption" tone="default" style={styles.medium}>
              Telemetry map
            </AppText>
            <AppText variant="caption">Window: {formatDateTime(historyQ.data?.since || liveQ.data?.since, language)}</AppText>
          </View>
        </View>
        <View style={styles.legend}>
          <LegendDot color={stateColor.live} label="Live driver" />
          <LegendDot color={stateColor.idle} label="Idle driver" />
          <LegendDot color={stateColor.stale} label="Stale ping" />
          <LegendDot color={withAlpha(c.primary, 0.7)} label="Route history (45 min)" line />
        </View>
      </Card>

      <Card title="Drivers on map" description="Each marker shows the latest known driver location." right={<Badge>{String(locations.length)}</Badge>}>
        <Input value={search} onChangeText={setSearch} icon="search" placeholder="Search drivers..." />
        <ChipRow>
          {(["all", "live", "idle", "stale"] as DriverFilter[]).map((value) => (
            <Chip key={value} label={value === "all" ? "All" : value === "stale" ? "Stale" : STATE_LABEL[value]} selected={filter === value} onPress={() => setFilter(value)} />
          ))}
        </ChipRow>
        {visibleLocations.length === 0 ? (
          <EmptyState
            compact
            icon="car-outline"
            title={locations.length === 0 ? "No drivers reporting" : "No matching drivers"}
            description={locations.length === 0 ? "Drivers appear once their app sends a location ping." : "Change the search or filter."}
          />
        ) : (
          <View style={styles.driverList}>
            {visibleLocations.map((location) => {
              const state = driverState(location.driver_id);
              const selected = location.driver_id === selectedDriverId;
              return (
                <Pressable
                  key={location.driver_id}
                  onPress={() => selectDriver(location.driver_id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.driverRow,
                    {
                      borderColor: selected ? c.primary : c.border,
                      backgroundColor: selected ? withAlpha(c.primary, 0.06) : pressed ? withAlpha(c.muted, 0.6) : c.card,
                    },
                  ]}
                >
                  <View style={[styles.stateDot, { backgroundColor: stateColor[state] }]} />
                  <View style={styles.flexShrink}>
                    <AppText variant="label" numberOfLines={1}>
                      {driverName(location.driver_id)}
                    </AppText>
                    <AppText variant="caption" numberOfLines={1}>
                      {formatDateTime(location.updated_at || location.created_at, language)}
                    </AppText>
                  </View>
                  <Badge tone={STATE_TONE[state]}>{STATE_LABEL[state]}</Badge>
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>

      <Card
        title="Alert queue"
        description="Late orders, idle drivers, and stale pings."
        right={
          <Badge tone={alertCount > 0 ? "warning" : "success"} dot>
            {`${alertCount} active`}
          </Badge>
        }
      >
        <AlertColumn title="Late orders" tone="destructive" items={lateOrders.map((order) => `${order.code} - ${order.dropoff_address || "-"}`)} />
        <AlertColumn title="Idle drivers" tone="info" items={idleDrivers.map((driver) => driver.user?.name || `Driver #${driver.id}`)} />
        <AlertColumn title="Stale drivers" tone="warning" items={staleDrivers.map((driver) => driver.user?.name || `Driver #${driver.id}`)} />
        {tracks.length === 0 ? (
          <AppText variant="small" tone="muted">
            No route history available yet.
          </AppText>
        ) : null}
      </Card>
    </AppShell>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Analytics
 * -----------------------------------------------------------------------------------------------*/

function RateCard({ label, value, note, icon, tone }: { label: string; value: number | null; note: string; icon: IconName; tone: Tone }) {
  const c = useColors();
  return (
    <Card>
      <Row justify="space-between" align="flex-start">
        <View style={styles.flexShrink}>
          <AppText variant="caption">{label}</AppText>
          <AppText variant="display">{value != null ? `${value}%` : "-"}</AppText>
        </View>
        <View style={[styles.rateIcon, { backgroundColor: withAlpha(tone === "success" ? c.success : c.info, 0.15) }]}>
          <Ionicons name={icon} size={18} color={tone === "success" ? c.success : c.info} />
        </View>
      </Row>
      <Progress value={value ?? 0} tone={tone} />
      <AppText variant="caption">{note}</AppText>
    </Card>
  );
}

export function AnalyticsScreen({ navigation }: AnalyticsProps) {
  const access = useProtectedAccess("Analytics");
  const { language } = usePreferences();
  const c = useColors();
  const text = copy[language];

  const summaryQ = useQuery({
    queryKey: ["analytics-summary"],
    queryFn: async () => (await api.get("/api/analytics/summary")).data as AnalyticsSummary,
    enabled: access.ready,
  });

  if (!access.ready) {
    return access.fallback;
  }

  const summary = summaryQ.data;
  const deliveredRate = summary && summary.orders.total > 0 ? Math.round((summary.orders.delivered / summary.orders.total) * 100) : 0;
  const trend = summary?.trend ?? [];
  const maxTrend = Math.max(1, ...trend.map((entry) => entry.total));
  const funnelEntries = Object.entries(summary?.funnel ?? {});
  const maxFunnel = Math.max(1, ...funnelEntries.map(([, value]) => Number(value) || 0));
  const markets = [...(summary?.by_market ?? [])].sort((a, b) => Number(b.revenue) - Number(a.revenue));
  const drivers = [...(summary?.by_driver ?? [])].sort((a, b) => b.delivered - a.delivered);
  const subtitle = summary?.range ? `${text.analyticsSubtitle} ${summary.range.from} – ${summary.range.to}` : text.analyticsSubtitle;

  return (
    <AppShell navigation={navigation} screenName="Analytics" title={text.analyticsTitle} subtitle={subtitle}>
      <Row justify="flex-end">
        <Button variant="outline" size="sm" icon="refresh" onPress={() => void summaryQ.refetch()} loading={summaryQ.isFetching}>
          Refresh
        </Button>
      </Row>

      {summaryQ.isLoading ? (
        <LoadingBlock message="Loading analytics..." rows={4} />
      ) : summaryQ.isError || !summary ? (
        <Alert tone="destructive" title="No analytics data available." description="Try refreshing in a moment." />
      ) : (
        <>
          <RateCard label="Delivery rate" value={deliveredRate} note="Orders completed successfully" icon="trending-up" tone="success" />
          <RateCard label="On-time rate" value={summary.on_time_rate ?? null} note="Delivered on schedule" icon="time-outline" tone="info" />

          <StatGrid>
            <StatCard label="Total orders" value={summary.orders.total} icon="cube-outline" tone="primary" />
            <StatCard label="Delivered" value={summary.orders.delivered} icon="checkmark-circle-outline" tone="success" />
            <StatCard label="Failed" value={summary.orders.failed} icon="alert-circle-outline" tone="destructive" />
            <StatCard label="Cancelled" value={summary.orders.cancelled} icon="close-circle-outline" tone="warning" />
            <StatCard label="Routes planned" value={summary.routes_planned} icon="git-branch-outline" />
          </StatGrid>

          <Card title="Recent trend" description="Orders per day, split by outcome.">
            <Row gap={14} wrap>
              <LegendDot color={c.chart2} label="Delivered" />
              <LegendDot color={c.chart5} label="Cancelled" />
              <LegendDot color={c.chart1} label="Other" />
            </Row>
            {trend.length === 0 ? (
              <EmptyState compact icon="trending-up" title="No trend data yet" />
            ) : (
              trend.map((entry) => {
                const rate = entry.total > 0 ? Math.round((entry.delivered / entry.total) * 100) : 0;
                const other = Math.max(0, entry.total - entry.delivered - entry.cancelled);
                return (
                  <View key={entry.date} style={styles.barBlock}>
                    <Row justify="space-between" gap={8} wrap>
                      <AppText variant="caption" tone="default" style={styles.medium}>
                        {entry.date}
                      </AppText>
                      <AppText variant="caption">
                        {entry.total} total · {entry.delivered} delivered · {rate}%
                      </AppText>
                    </Row>
                    <HBar
                      max={maxTrend}
                      height={10}
                      segments={[
                        { value: entry.delivered, color: c.chart2 },
                        { value: entry.cancelled, color: c.chart5 },
                        { value: other, color: c.chart1 },
                      ]}
                    />
                  </View>
                );
              })
            )}
          </Card>

          <Card title="Fulfillment funnel" description="How many orders reached each stage.">
            {funnelEntries.length === 0 ? (
              <EmptyState compact title="No funnel data" />
            ) : (
              funnelEntries.map(([key, value]) => (
                <View key={key} style={styles.barBlock}>
                  <Row justify="space-between">
                    <AppText variant="small" tone="muted">
                      {key.replace(/_/g, " ").replace(/^\w/, (ch) => ch.toUpperCase())}
                    </AppText>
                    <AppText variant="small" style={styles.semibold}>
                      {String(value)}
                    </AppText>
                  </Row>
                  <HBar max={maxFunnel} segments={[{ value: Number(value) || 0, color: c.chart3 }]} />
                </View>
              ))
            )}
          </Card>

          <Card title="By market" description="Ranked by revenue.">
            {markets.length === 0 ? (
              <EmptyState compact title="No market data" />
            ) : (
              markets.map((entry, index) => {
                const marketRate = entry.orders > 0 ? Math.round((entry.delivered / entry.orders) * 100) : 0;
                return (
                  <View key={entry.market_id} style={[styles.rankRow, index > 0 && { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth * 2 }]}>
                    <RankBadge rank={index + 1} />
                    <View style={styles.flexShrink}>
                      <Row gap={6}>
                        <AppText variant="label" numberOfLines={1} style={styles.flexShrink}>
                          {entry.market_name}
                        </AppText>
                        <AppText variant="caption">{entry.market_code}</AppText>
                      </Row>
                      <AppText variant="caption">
                        {entry.orders} orders · {entry.delivered} delivered · {marketRate}%
                      </AppText>
                      <View style={styles.mt6}>
                        <HBar max={100} height={6} segments={[{ value: marketRate, color: c.chart1 }]} />
                      </View>
                    </View>
                    <View style={styles.rankValue}>
                      <AppText variant="caption">Revenue</AppText>
                      <AppText variant="label" style={styles.semibold}>
                        {formatMoney(entry.revenue, language)}
                      </AppText>
                    </View>
                  </View>
                );
              })
            )}
          </Card>

          <Card title="By driver" description="Ranked by deliveries completed.">
            {drivers.length === 0 ? (
              <EmptyState compact title="No driver data" />
            ) : (
              drivers.map((entry, index) => {
                const driverRate = entry.assigned > 0 ? Math.round((entry.delivered / entry.assigned) * 100) : 0;
                return (
                  <View key={entry.driver_id} style={[styles.rankRow, index > 0 && { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth * 2 }]}>
                    <RankBadge rank={index + 1} />
                    <View style={styles.flexShrink}>
                      <AppText variant="label" numberOfLines={1}>
                        {entry.driver_name}
                      </AppText>
                      <AppText variant="caption">
                        {entry.assigned} assigned · {entry.delivered} delivered · {entry.failed} failed · {driverRate}%
                      </AppText>
                      <View style={styles.mt6}>
                        <HBar max={100} height={6} segments={[{ value: driverRate, color: c.chart2 }]} />
                      </View>
                    </View>
                    <Row gap={4}>
                      <Ionicons name="star" size={14} color={c.warning} />
                      <AppText variant="label" style={styles.semibold}>
                        {String(entry.avg_rating || "-")}
                      </AppText>
                    </Row>
                  </View>
                );
              })
            )}
          </Card>
        </>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1, flexGrow: 1 },
  semibold: { fontWeight: "600" },
  medium: { fontWeight: "500" },
  selfStart: { alignSelf: "flex-start" },
  mt6: { marginTop: 6 },
  list: { gap: 12 },
  filters: { gap: 10 },
  stopList: { gap: 8 },
  stop: { flexDirection: "row", gap: 10, borderWidth: 1, borderRadius: radius.lg, padding: 10 },
  stopNumber: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  mapWrapper: { height: 320, overflow: "hidden" },
  map: { width: "100%", height: "100%" },
  mapOverlay: { position: "absolute", top: 10, right: 10, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 10, paddingVertical: 6, maxWidth: "70%" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 16, paddingBottom: 14 },
  driverList: { gap: 6 },
  driverRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 8 },
  stateDot: { width: 10, height: 10, borderRadius: 5 },
  alertItem: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 8 },
  rateIcon: { width: 36, height: 36, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  barBlock: { gap: 6 },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 12 },
  rankValue: { alignItems: "flex-end" },
});
