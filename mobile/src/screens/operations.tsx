import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppShell } from "@/src/components/app-shell";
import {
  AppButton,
  AppModal,
  EmptyBlock,
  HelperText,
  InputField,
  LoadingBlock,
  Pill,
  SectionCard,
  StatCard,
  StatGrid,
  uiStyles,
} from "@/src/components/ui";
import { useProtectedAccess } from "@/src/hooks/use-protected-access";
import { api } from "@/src/lib/api";
import { getErrorMessage } from "@/src/lib/errors";
import { formatDateTime, formatMoney, formatOrderStatus, getOrderStatusTone, toNumber } from "@/src/lib/format";
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
    ordersTitle: "Orders",
    customerSubtitle: "ETA, proof of delivery, and reorder flows stay visible in one timeline.",
    opsSubtitle: "Search, create, and inspect dispatch-ready orders from one mobile surface.",
    visibleOrders: "Visible orders",
    delivered: "Delivered",
    marketPending: "Market pending",
    inDriverFlow: "In driver flow",
    createOpsOrder: "Create ops order",
    createOpsText: "Manual order intake for dispatch or call center workflows.",
    detail: "Open detail",
    detailTitle: "Order detail",
    rateDelivery: "Rate delivery",
    feedback: "Feedback",
    rating: "Rating (1-5)",
    submit: "Submit",
    reorder: "Reorder",
    cancel: "Cancel order",
    reason: "Cancellation reason",
    timeline: "Timeline",
    proof: "Delivery proof",
    proofMissing: "No delivery proof has been attached yet.",
    eta: "ETA",
    promised: "Promised",
    loadingOrders: "Loading orders...",
    noOrders: "No orders matched this view yet.",
    searchOrders: "Search orders",
    liveMapTitle: "Live Map",
    liveMapSubtitle: "Driver positions, route playback, and alert queues in one view.",
    visibleDrivers: "Visible drivers",
    tracks: "Tracks",
    alerts: "Alerts",
    stale: "Stale",
    routePlayback: "Route playback",
    noHistory: "No route history in this playback window yet.",
    analyticsTitle: "Analytics",
    analyticsSubtitle: "Trend, funnel, market, and driver performance from the same backend summary.",
    deliveryRate: "Delivery rate",
    onTimeRate: "On-time rate",
    routesTitle: "Routes",
    routesSubtitle: "Current route plans with ETA and dispatch score visibility.",
  },
  ka: {
    ordersTitle: "შეკვეთები",
    customerSubtitle: "ETA, მიწოდების დადასტურება და ხელახალი შეკვეთა ერთ timeline-ში ჩანს.",
    opsSubtitle: "მოძებნეთ, შექმენით და ნახეთ დისპეტჩერისთვის მზად შეკვეთები ერთ მობილურ ეკრანზე.",
    visibleOrders: "ხილული შეკვეთები",
    delivered: "მიწოდებული",
    marketPending: "ბაზარს ელოდება",
    inDriverFlow: "მძღოლის პროცესში",
    createOpsOrder: "ოპერატორის შეკვეთა",
    createOpsText: "ხელით მიღება დისპეტჩერის ან ქოლ-ცენტრის პროცესისთვის.",
    detail: "დეტალი",
    detailTitle: "შეკვეთის დეტალი",
    rateDelivery: "მიწოდების შეფასება",
    feedback: "კომენტარი",
    rating: "შეფასება (1-5)",
    submit: "გაგზავნა",
    reorder: "ხელახლა შეკვეთა",
    cancel: "გაუქმება",
    reason: "გაუქმების მიზეზი",
    timeline: "ტაიმლაინი",
    proof: "მიწოდების დადასტურება",
    proofMissing: "მიწოდების დადასტურება ჯერ არ არის დამატებული.",
    eta: "ETA",
    promised: "დაპირებული დრო",
    loadingOrders: "შეკვეთები იტვირთება...",
    noOrders: "ამ ხედვაში შეკვეთები ჯერ არ არის.",
    searchOrders: "შეკვეთების ძებნა",
    liveMapTitle: "ცოცხალი რუკა",
    liveMapSubtitle: "მძღოლების პოზიციები, მოძრაობის ისტორია და გაფრთხილებები ერთ ხედში.",
    visibleDrivers: "ხილული მძღოლები",
    tracks: "მარშრუტის კვალი",
    alerts: "გაფრთხილებები",
    stale: "მოძველებული",
    routePlayback: "მარშრუტის ისტორია",
    noHistory: "ამ ფანჯარაში მარშრუტის ისტორია ჯერ არ არის.",
    analyticsTitle: "ანალიტიკა",
    analyticsSubtitle: "ტრენდი, funnel, ბაზრები და მძღოლები იმავე backend summary-დან.",
    deliveryRate: "მიწოდების მაჩვენებელი",
    onTimeRate: "დროულობის მაჩვენებელი",
    routesTitle: "მარშრუტები",
    routesSubtitle: "მიმდინარე მარშრუტები ETA-თი და dispatch score-ით.",
  },
} as const;

type ScreenCopy = Record<keyof (typeof copy)["en"], string>;

function statusTone(status: string) {
  return getOrderStatusTone(status);
}

function DetailModal({
  visible,
  order,
  language,
  text,
  onClose,
  onRate,
  onReorder,
  onCancel,
  rating,
  setRating,
  feedback,
  setFeedback,
  reason,
  setReason,
  refundReason,
  setRefundReason,
  onRefund,
}: {
  visible: boolean;
  order?: Order | null;
  language: "en" | "ka";
  text: ScreenCopy;
  onClose: () => void;
  onRate: () => void;
  onReorder: () => void;
  onCancel: () => void;
  rating: string;
  setRating: (value: string) => void;
  feedback: string;
  setFeedback: (value: string) => void;
  reason: string;
  setReason: (value: string) => void;
  refundReason: string;
  setRefundReason: (value: string) => void;
  onRefund: () => void;
}) {
  return (
    <AppModal visible={visible} title={order?.code || text.detailTitle} onClose={onClose}>
      <SectionCard title={text.timeline}>
        {(order?.timeline ?? []).map((step) => (
          <SectionCard key={step.key} title={step.label} subtitle={formatDateTime(step.at, language)} right={<Pill tone={step.done ? "success" : "neutral"}>{step.done ? "Done" : "Pending"}</Pill>} />
        ))}
      </SectionCard>

      <SectionCard title={text.proof}>
        <HelperText>{order?.delivery_proof?.note || text.proofMissing}</HelperText>
        {order?.delivery_proof?.photo_url ? <HelperText>{order.delivery_proof.photo_url}</HelperText> : null}
        {order?.delivery_proof?.signature_name ? <HelperText>Signature: {order.delivery_proof.signature_name}</HelperText> : null}
        <HelperText>{text.eta}: {formatDateTime(order?.eta_summary?.estimated_delivery_at, language)}</HelperText>
        <HelperText>{text.promised}: {formatDateTime(order?.eta_summary?.promised_at, language)}</HelperText>
      </SectionCard>

      <SectionCard title="Receipt">
        <HelperText>{order?.receipt?.number || "Pending receipt"}</HelperText>
        {(order?.receipt?.items ?? []).map((item, index) => (
          <HelperText key={`${item.name}-${index}`}>{item.name} x{item.qty} - {formatMoney(item.line_total ?? 0, language)}</HelperText>
        ))}
        <HelperText>Total: {formatMoney(order?.receipt?.total ?? order?.total ?? 0, language)}</HelperText>
        <HelperText>Refund: {order?.refund_summary?.status || "none"}</HelperText>
      </SectionCard>

      <SectionCard title={text.rateDelivery}>
        <InputField label={text.rating} value={rating} onChangeText={setRating} keyboardType="numeric" />
        <InputField label={text.feedback} value={feedback} onChangeText={setFeedback} />
        <InputField label={text.reason} value={reason} onChangeText={setReason} />
        <InputField label="Refund reason" value={refundReason} onChangeText={setRefundReason} />
        <View style={styles.actionRow}>
          <AppButton onPress={onRate} disabled={!order?.actions?.can_rate}>{text.submit}</AppButton>
          <AppButton variant="secondary" onPress={onReorder} disabled={!order?.actions?.can_reorder}>{text.reorder}</AppButton>
          <AppButton variant="secondary" onPress={onCancel} disabled={!order?.actions?.can_cancel}>{text.cancel}</AppButton>
          <AppButton variant="secondary" onPress={onRefund} disabled={!order?.actions?.can_request_refund}>Request refund</AppButton>
        </View>
      </SectionCard>
    </AppModal>
  );
}

export function OrdersScreen({ navigation }: OrdersProps) {
  const access = useProtectedAccess("Orders");
  const { language } = usePreferences();
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

  const filteredOrders = useMemo(() => {
    const orders = ordersQ.data?.data ?? [];
    const value = search.trim().toLowerCase();
    if (!value) return orders;

    return orders.filter((order) =>
      [order.code, order.dropoff_address ?? "", order.status, order.customer_name ?? "", order.market?.name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(value),
    );
  }, [ordersQ.data?.data, search]);

  const deliveredCount = filteredOrders.filter((order) => order.status === "DELIVERED").length;
  const marketPendingCount = filteredOrders.filter((order) => order.status === "MARKET_PENDING").length;
  const driverFlowCount = filteredOrders.filter((order) => ["READY_FOR_PICKUP", "OFFERED", "ASSIGNED", "PICKED_UP"].includes(order.status)).length;

  if (!access.ready) {
    return access.fallback;
  }

  return (
    <AppShell
      navigation={navigation}
      screenName="Orders"
      title={text.ordersTitle}
      subtitle={isCustomerOnly ? text.customerSubtitle : text.opsSubtitle}
    >
      <StatGrid>
        <StatCard label={text.visibleOrders} value={filteredOrders.length} />
        <StatCard label={text.marketPending} value={marketPendingCount} />
        <StatCard label={text.inDriverFlow} value={driverFlowCount} />
        <StatCard label={text.delivered} value={deliveredCount} />
      </StatGrid>

      {!isCustomerOnly && isOpsUser ? (
        <SectionCard title={text.createOpsOrder} subtitle={text.createOpsText}>
          <InputField label="Address" value={dropoffAddress} onChangeText={setDropoffAddress} />
          <InputField label="Latitude" value={dropoffLat} onChangeText={setDropoffLat} keyboardType="numeric" />
          <InputField label="Longitude" value={dropoffLng} onChangeText={setDropoffLng} keyboardType="numeric" />
          <AppButton onPress={() => createOrderM.mutate()} disabled={createOrderM.isPending}>
            {createOrderM.isPending ? "Creating..." : text.createOpsOrder}
          </AppButton>
        </SectionCard>
      ) : null}

      <SectionCard title={text.searchOrders}>
        <InputField label={text.searchOrders} value={search} onChangeText={setSearch} placeholder={text.searchOrders} />
      </SectionCard>

      {ordersQ.isLoading ? (
        <LoadingBlock message={text.loadingOrders} />
      ) : ordersQ.isError ? (
        <EmptyBlock message={getErrorMessage(ordersQ.error) || text.noOrders} />
      ) : filteredOrders.length === 0 ? (
        <EmptyBlock message={text.noOrders} />
      ) : (
        <View style={uiStyles.listGap}>
          {filteredOrders.map((order) => (
            <SectionCard
              key={order.id}
              title={order.code}
              subtitle={order.dropoff_address || "No address"}
              right={<Pill tone={statusTone(order.status)}>{formatOrderStatus(order.status, language)}</Pill>}
            >
              <HelperText>{text.eta}: {formatDateTime(order.eta_summary?.estimated_delivery_at, language)}</HelperText>
              <HelperText>{text.promised}: {formatDateTime(order.eta_summary?.promised_at, language)}</HelperText>
              <HelperText>{order.market?.name || "Direct order"} • {order.customer_name || order.customer?.name || "Unknown"}</HelperText>
              <HelperText>{order.assigned_driver?.user?.name || order.offered_driver?.user?.name || "-"}</HelperText>
              <View style={styles.actionRow}>
                <AppButton compact variant="secondary" onPress={() => setSelectedOrderId(order.id)}>{text.detail}</AppButton>
                {isOpsUser && order.status === "MARKET_PENDING" ? (
                  <AppButton compact onPress={() => marketActionM.mutate({ orderId: order.id, action: "market-accept" })}>Accept</AppButton>
                ) : null}
                {isOpsUser && order.status === "MARKET_ACCEPTED" ? (
                  <AppButton compact onPress={() => marketActionM.mutate({ orderId: order.id, action: "mark-ready" })}>Ready</AppButton>
                ) : null}
              </View>
            </SectionCard>
          ))}
        </View>
      )}

      <DetailModal
        visible={selectedOrderId != null}
        order={detailQ.data}
        language={language}
        text={text}
        onClose={() => setSelectedOrderId(null)}
        onRate={() => detailQ.data && rateM.mutate(detailQ.data.id)}
        onReorder={() => detailQ.data && reorderM.mutate(detailQ.data.id)}
        onCancel={() => detailQ.data && cancelM.mutate(detailQ.data.id)}
        rating={rating}
        setRating={setRating}
        feedback={feedback}
        setFeedback={setFeedback}
        reason={reason}
        setReason={setReason}
        refundReason={refundReason}
        setRefundReason={setRefundReason}
        onRefund={() => detailQ.data && refundM.mutate(detailQ.data.id)}
      />
    </AppShell>
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

  return (
    <AppShell navigation={navigation} screenName="Routes" title={text.routesTitle} subtitle={text.routesSubtitle}>
      {routesQ.isLoading ? (
        <LoadingBlock message="Loading routes..." />
      ) : routesQ.isError ? (
        <EmptyBlock message="Failed to load routes." />
      ) : (
        <View style={uiStyles.listGap}>
          {(routesQ.data ?? []).map((route) => (
            <SectionCard key={route.id} title={`Route #${route.id}`} subtitle={`${route.driver?.user?.name || `Driver #${route.driver_id}`} • ${route.route_date}`} right={<Pill>{route.status}</Pill>}>
              <StatGrid>
                <StatCard label="Distance" value={route.planned_distance_km != null ? `${route.planned_distance_km} km` : "-"} />
                <StatCard label="Duration" value={route.planned_duration_min != null ? `${route.planned_duration_min} min` : "-"} />
              </StatGrid>
              {(route.stops ?? []).map((stop) => (
                <SectionCard key={stop.id} title={`Stop ${stop.sequence}`} subtitle={stop.order?.code || `Order #${stop.order_id}`} right={<Pill>{stop.status}</Pill>}>
                  <HelperText>{stop.order?.dropoff_address || "No address"}</HelperText>
                  <HelperText>ETA {formatDateTime(stop.eta, language)}</HelperText>
                  <HelperText>Score {stop.dispatch_score ?? "-"}</HelperText>
                </SectionCard>
              ))}
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
  const text = copy[language];
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

  const locations = liveQ.data?.locations ?? [];

  if (!access.ready) {
    return access.fallback;
  }

  return (
    <AppShell navigation={navigation} screenName="LiveMap" title={text.liveMapTitle} subtitle={text.liveMapSubtitle}>
      <StatGrid>
        <StatCard label={text.visibleDrivers} value={locations.length} />
        <StatCard label={text.tracks} value={(historyQ.data?.history ?? []).length} />
        <StatCard label={text.alerts} value={(alertsQ.data?.late_orders.length ?? 0) + (alertsQ.data?.idle_drivers.length ?? 0)} />
        <StatCard label={text.stale} value={alertsQ.data?.stale_tracking.length ?? 0} />
      </StatGrid>

      <SectionCard title={text.routePlayback}>
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
            {(historyQ.data?.history ?? []).map((track) =>
              track.points.length > 1 ? (
                <Polyline
                  key={`track-${track.driver_id}`}
                  coordinates={track.points.map((point) => ({ latitude: toNumber(point.lat, centerLat), longitude: toNumber(point.lng, centerLng) }))}
                  strokeColor="#0e7490"
                  strokeWidth={4}
                />
              ) : null,
            )}
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
        {(historyQ.data?.history.length ?? 0) === 0 ? <HelperText>{text.noHistory}</HelperText> : null}
      </SectionCard>

      <SectionCard title={text.alerts}>
        <HelperText>Late orders: {alertsQ.data?.late_orders.length ?? 0}</HelperText>
        <HelperText>Idle drivers: {alertsQ.data?.idle_drivers.length ?? 0}</HelperText>
        <HelperText>Stale tracking: {alertsQ.data?.stale_tracking.length ?? 0}</HelperText>
      </SectionCard>
    </AppShell>
  );
}

export function AnalyticsScreen({ navigation }: AnalyticsProps) {
  const access = useProtectedAccess("Analytics");
  const { language } = usePreferences();
  const text = copy[language];

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
    <AppShell navigation={navigation} screenName="Analytics" title={text.analyticsTitle} subtitle={text.analyticsSubtitle}>
      <StatGrid>
        <StatCard label={text.deliveryRate} value={`${deliveredRate}%`} />
        <StatCard label={text.onTimeRate} value={summary?.on_time_rate != null ? `${summary.on_time_rate}%` : "-"} />
      </StatGrid>

      {summaryQ.isLoading ? (
        <LoadingBlock message="Loading analytics..." />
      ) : summaryQ.isError || !summary ? (
        <EmptyBlock message="Failed to load analytics." />
      ) : (
        <>
          <StatGrid>
            <StatCard label="Orders" value={summary.orders.total} />
            <StatCard label="Delivered" value={summary.orders.delivered} />
            <StatCard label="Failed" value={summary.orders.failed} />
            <StatCard label="Routes" value={summary.routes_planned} />
          </StatGrid>

          <SectionCard title="Trend">
            {(summary.trend ?? []).map((entry) => (
              <SectionCard key={entry.date} title={entry.date} subtitle={`${entry.total} total • ${entry.delivered} delivered • ${entry.cancelled} cancelled`} />
            ))}
          </SectionCard>

          <SectionCard title="Markets">
            {(summary.by_market ?? []).map((entry) => (
              <SectionCard key={entry.market_id} title={entry.market_name} subtitle={`${entry.orders} orders • ${entry.delivered} delivered`}>
                <HelperText>{formatMoney(entry.revenue, language)}</HelperText>
              </SectionCard>
            ))}
          </SectionCard>

          <SectionCard title="Drivers">
            {(summary.by_driver ?? []).map((entry) => (
              <SectionCard key={entry.driver_id} title={entry.driver_name} subtitle={`${entry.assigned} assigned • ${entry.delivered} delivered`}>
                <HelperText>Avg rating: {entry.avg_rating || "-"}</HelperText>
              </SectionCard>
            ))}
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
});
