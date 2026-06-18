import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppShell } from "@/src/components/app-shell";
import {
  AppButton,
  EmptyBlock,
  HelperText,
  InputField,
  LoadingBlock,
  Pill,
  SectionCard,
  StatCard,
  StatGrid,
  uiStyles,
  usePalette,
} from "@/src/components/ui";
import { useProtectedAccess } from "@/src/hooks/use-protected-access";
import { api } from "@/src/lib/api";
import { getErrorMessage } from "@/src/lib/errors";
import { formatDateTime, formatMoney, formatOrderStatus } from "@/src/lib/format";
import { notifyIncomingOffer, prepareLocalNotifications } from "@/src/lib/notifications";
import { usePreferences } from "@/src/providers/app-providers";
import type { DriverFeed, Order } from "@/src/types/api";
import type { RootStackParamList } from "@/src/types/navigation";

type DriverHubProps = NativeStackScreenProps<RootStackParamList, "DriverHub">;

const OFFER_TIMEOUT_SECONDS = 300;

const copy = {
  title: "Driver hub",
  subtitle: "Status, offers, assigned drops, and earnings tuned for mobile dispatch work.",
  onlyDrivers: "This workspace is only available for driver accounts.",
  driverStatus: "Driver status",
  currentState: "Current state",
  activeShift: "Active shift",
  noActiveShift: "No active shift",
  currentBalance: "Current balance",
  totalEarned: "Total earned",
  offers: "Offers",
  assigned: "Assigned",
  liveNow: "Live now",
  liveOfferReady: "Offer ready now",
  assignedDeliveries: "Assigned deliveries",
  lastPing: "Last ping",
  dispatchPulse: "Dispatch pulse",
  dispatchPulseCopy: "Stay online, share your location, and react quickly when fresh work lands.",
  startShift: "Start shift",
  starting: "Starting...",
  endShift: "End shift",
  ending: "Ending...",
  locationTitle: "Location sync",
  locationCopy: "Keep dispatch updated so ETAs and live tracking stay accurate.",
  latitude: "Latitude",
  longitude: "Longitude",
  sendLocation: "Send location ping",
  sending: "Sending...",
  recentEarnings: "Recent earnings",
  delivered: "Delivered",
  activeDrops: "Active drops",
  noEarnings: "No earnings yet.",
  deliveryEarning: "Delivery earning",
  incomingOffers: "Incoming offers",
  incomingOffersCopy: "Fresh jobs appear here first. Accept quickly before the offer expires.",
  noOffers: "No live offers right now.",
  assignedDeliveriesCopy: "Your current jobs with proof-of-delivery actions kept close by.",
  noAssigned: "No assigned deliveries yet.",
  proofNote: "Proof note",
  proofPhoto: "Proof photo URL",
  proofSignature: "Proof signature",
  markDelivered: "Mark delivered",
  markPickedUp: "Mark picked up",
  accept: "Accept",
  decline: "Decline",
  latestOffer: "Latest offer",
  latestOfferCopy: "A new delivery just arrived with sound and vibration.",
  total: "Total",
  eta: "ETA",
  customer: "Customer",
  phone: "Phone",
  market: "Market",
  earningHint: "Potential earning",
  distance: "Distance",
  weather: "Weather",
  items: "Items",
  deliveryNotes: "Delivery notes",
  timeLeftToAccept: "Time left to accept",
  offerExpired: "Time expired. This offer is being reassigned.",
  offerExpiresSoon: "If the timer runs out, the order is automatically offered to another driver.",
  tapDismiss: "Dismiss",
} as const;

function getOfferSecondsRemaining(offerSentAt: string | null | undefined, nowMs: number) {
  if (!offerSentAt) {
    return OFFER_TIMEOUT_SECONDS;
  }

  const sentAtMs = new Date(offerSentAt).getTime();
  if (Number.isNaN(sentAtMs)) {
    return OFFER_TIMEOUT_SECONDS;
  }

  return Math.max(0, OFFER_TIMEOUT_SECONDS - Math.floor((nowMs - sentAtMs) / 1000));
}

function formatCountdown(secondsRemaining: number) {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function DriverOrderCard({
  order,
  language,
  nowMs,
  actions,
}: {
  order: Order;
  language: "en" | "ka";
  nowMs?: number;
  actions?: React.ReactNode;
}) {
  const palette = usePalette();
  const secondsRemaining = nowMs == null ? null : getOfferSecondsRemaining(order.offer_sent_at, nowMs);
  const isExpired = secondsRemaining === 0;
  const itemSummary = order.items
    ?.map((item) => {
      const combo = item.combo_offer?.name ? ` [combo: ${item.combo_offer.name}]` : "";
      const removed = item.removed_ingredients?.length ? ` (without ${item.removed_ingredients.join(", ")})` : "";
      return `${item.name} x${item.qty}${combo}${removed}`;
    })
    .join(", ");

  return (
    <SectionCard
      title={order.code}
      subtitle={order.dropoff_address || "No address set"}
      right={<Pill>{formatOrderStatus(order.status, language)}</Pill>}
    >
      <View style={styles.metaRow}>
        {order.market?.code ? <Pill tone="neutral">{order.market.code}</Pill> : null}
        {order.total != null ? <Pill tone="warning">{formatMoney(order.total, language)}</Pill> : null}
        {order.eta_summary?.estimated_delivery_at ? <Pill tone="success">{formatDateTime(order.eta_summary.estimated_delivery_at, language)}</Pill> : null}
      </View>

      <View style={styles.detailList}>
        <DetailLine label={copy.customer} value={order.customer_name || order.customer?.name || "Unknown"} />
        <DetailLine label={copy.phone} value={order.customer_phone || "Not provided"} />
        <DetailLine label={copy.market} value={order.market?.name || "Direct order"} />
      </View>

      {order.driver_compensation?.earning_amount != null ? (
        <View
          style={[
            styles.earningPanel,
            {
              backgroundColor: `${palette.primaryStrong}16`,
              borderColor: `${palette.primaryStrong}55`,
            },
          ]}
        >
          <Text style={[styles.earningTitle, { color: palette.primaryStrong }]}>
            {copy.earningHint}: {formatMoney(order.driver_compensation.earning_amount, language)}
          </Text>
          <Text style={[styles.earningMeta, { color: palette.muted }]}>
            {copy.distance}: {order.driver_compensation.distance_km ?? 0} km - {copy.weather}:{" "}
            {order.driver_compensation.weather_condition || "clear"} - x{order.driver_compensation.weather_multiplier ?? 1}
          </Text>
        </View>
      ) : null}

      {itemSummary ? <HelperText>{copy.items}: {itemSummary}</HelperText> : null}
      {order.notes ? <HelperText>{copy.deliveryNotes}: {order.notes}</HelperText> : null}

      {secondsRemaining != null ? (
        <View
          style={[
            styles.timerPanel,
            {
              backgroundColor: isExpired ? `${palette.danger}18` : secondsRemaining <= 60 ? `${palette.warning}18` : `${palette.primary}16`,
              borderColor: isExpired ? `${palette.danger}66` : secondsRemaining <= 60 ? `${palette.warning}66` : `${palette.primary}55`,
            },
          ]}
        >
          <View style={styles.timerHeader}>
            <Text style={[styles.timerLabel, { color: isExpired ? palette.danger : palette.text }]}>{copy.timeLeftToAccept}</Text>
            <Text style={[styles.timerValue, { color: isExpired ? palette.danger : palette.text }]}>
              {formatCountdown(secondsRemaining)}
            </Text>
          </View>
          <Text style={[styles.timerCopy, { color: isExpired ? palette.danger : palette.muted }]}>
            {isExpired ? copy.offerExpired : copy.offerExpiresSoon}
          </Text>
        </View>
      ) : null}

      {actions}
    </SectionCard>
  );
}

export function DriverHubScreen({ navigation }: DriverHubProps) {
  const access = useProtectedAccess("DriverHub");
  const { language } = usePreferences();
  const palette = usePalette();
  const queryClient = useQueryClient();
  const [lat, setLat] = useState("41.7151");
  const [lng, setLng] = useState("44.8271");
  const [proofNote, setProofNote] = useState("");
  const [proofPhoto, setProofPhoto] = useState("");
  const [proofSignature, setProofSignature] = useState("");
  const [latestOfferAlert, setLatestOfferAlert] = useState<Order | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const seenOfferIdsRef = useRef<Set<number> | null>(null);
  const alertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roles = access.me?.roles ?? [];
  const isDriver = roles.includes("driver");

  const feedQ = useQuery({
    queryKey: ["driver-feed"],
    queryFn: async () => (await api.get("/api/driver/orders/feed")).data as DriverFeed,
    refetchInterval: access.ready && isDriver ? 5000 : false,
    enabled: access.ready && isDriver,
  });

  useEffect(() => {
    void prepareLocalNotifications();
    const timerId = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      clearInterval(timerId);
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const offers = feedQ.data?.offered_orders ?? [];
    const nextIds = new Set(offers.map((order) => order.id));

    if (seenOfferIdsRef.current == null) {
      seenOfferIdsRef.current = nextIds;
      return;
    }

    const newestOffer = offers.find((order) => !seenOfferIdsRef.current?.has(order.id));
    seenOfferIdsRef.current = nextIds;

    if (!newestOffer) {
      return;
    }

    setLatestOfferAlert(newestOffer);
    if (alertTimeoutRef.current) {
      clearTimeout(alertTimeoutRef.current);
    }
    alertTimeoutRef.current = setTimeout(() => {
      setLatestOfferAlert((current) => (current?.id === newestOffer.id ? null : current));
    }, 9000);

    void notifyIncomingOffer(newestOffer);
  }, [feedQ.data?.offered_orders]);

  const refreshQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["driver-feed"] }),
      queryClient.invalidateQueries({ queryKey: ["orders"] }),
      queryClient.invalidateQueries({ queryKey: ["live-routes"] }),
      queryClient.invalidateQueries({ queryKey: ["live-locations"] }),
      queryClient.invalidateQueries({ queryKey: ["me"] }),
    ]);
  };

  const startShiftM = useMutation({
    mutationFn: async () => (await api.post("/api/shifts/start")).data,
    onSuccess: refreshQueries,
  });

  const endShiftM = useMutation({
    mutationFn: async () => (await api.post("/api/shifts/end")).data,
    onSuccess: refreshQueries,
  });

  const pingM = useMutation({
    mutationFn: async () => (await api.post("/api/tracking/ping", { lat: Number(lat), lng: Number(lng) })).data,
    onSuccess: refreshQueries,
  });

  const actionM = useMutation({
    mutationFn: async ({ orderId, action }: { orderId: number; action: string }) =>
      action === "delivered"
        ? (
            await api.post(`/api/driver/orders/${orderId}/delivered`, {
              proof_note: proofNote || null,
              proof_photo_url: proofPhoto || null,
              proof_signature_name: proofSignature || null,
            })
          ).data
        : (await api.post(`/api/driver/orders/${orderId}/${action}`)).data,
    onSuccess: async () => {
      setProofNote("");
      setProofPhoto("");
      setProofSignature("");
      await refreshQueries();
    },
  });

  const mutationError = useMemo(
    () =>
      [startShiftM.error, endShiftM.error, pingM.error, actionM.error]
        .filter(Boolean)
        .map((error) => getErrorMessage(error, "Something went wrong"))
        .join("\n"),
    [actionM.error, endShiftM.error, pingM.error, startShiftM.error],
  );

  if (!access.ready) {
    return access.fallback;
  }

  if (!isDriver) {
    return (
      <AppShell navigation={navigation} screenName="DriverHub" title={copy.title} subtitle={copy.subtitle}>
        <EmptyBlock message={copy.onlyDrivers} />
      </AppShell>
    );
  }

  const activeShift = feedQ.data?.driver?.active_shift;
  const driverStatus = feedQ.data?.driver?.status ?? "OFFLINE";
  const offeredOrders = feedQ.data?.offered_orders ?? [];
  const assignedOrders = feedQ.data?.assigned_orders ?? [];
  const transactions = feedQ.data?.driver?.transactions ?? [];
  const lastPingAt = feedQ.data?.driver?.latest_ping?.updated_at;

  return (
    <AppShell navigation={navigation} screenName="DriverHub" title={copy.title} subtitle={copy.subtitle}>
      <SectionCard title={copy.driverStatus}>
        <View style={[styles.statusHero, { backgroundColor: palette.dark ? "#06111f" : "#111827" }]}>
          <Text style={styles.statusHeroLabel}>{copy.currentState}</Text>
          <Text style={styles.statusHeroValue}>{driverStatus}</Text>
          <Text style={styles.statusHeroNote}>
            {activeShift ? `${copy.activeShift}: ${formatDateTime(activeShift.started_at, language)}` : copy.noActiveShift}
          </Text>
        </View>
        <StatGrid>
          <StatCard label={copy.currentBalance} value={formatMoney(feedQ.data?.driver?.balance ?? 0, language)} />
          <StatCard label={copy.totalEarned} value={formatMoney(feedQ.data?.driver?.total_earned ?? 0, language)} />
          <StatCard label={copy.offers} value={offeredOrders.length} note={copy.liveOfferReady} />
          <StatCard label={copy.assigned} value={assignedOrders.length} note={copy.assignedDeliveries} />
          <StatCard label={copy.liveNow} value={lastPingAt ? formatDateTime(lastPingAt, language) : "-"} note={copy.lastPing} />
        </StatGrid>
      </SectionCard>

      {latestOfferAlert ? (
        <View
          style={[
            styles.alertPanel,
            {
              backgroundColor: `${palette.primary}18`,
              borderColor: `${palette.primary}66`,
              shadowColor: palette.shadow,
            },
          ]}
        >
          <View style={styles.alertHeader}>
            <View style={styles.alertText}>
              <Text style={[styles.alertEyebrow, { color: palette.primaryStrong }]}>{copy.latestOffer}</Text>
              <Text style={[styles.alertTitle, { color: palette.text }]}>{latestOfferAlert.code}</Text>
              <Text style={[styles.alertCopy, { color: palette.muted }]}>{copy.latestOfferCopy}</Text>
            </View>
            <Pressable onPress={() => setLatestOfferAlert(null)} style={[styles.dismissButton, { borderColor: `${palette.border}aa` }]}>
              <Text style={[styles.dismissButtonText, { color: palette.text }]}>{copy.tapDismiss}</Text>
            </Pressable>
          </View>
          <View style={styles.metaRow}>
            <Pill tone="warning">{latestOfferAlert.total != null ? formatMoney(latestOfferAlert.total, language) : copy.total}</Pill>
            {latestOfferAlert.driver_compensation?.earning_amount != null ? (
              <Pill tone="success">{formatMoney(latestOfferAlert.driver_compensation.earning_amount, language)}</Pill>
            ) : null}
            <Pill tone="success">
              {latestOfferAlert.eta_summary?.estimated_delivery_at
                ? formatDateTime(latestOfferAlert.eta_summary.estimated_delivery_at, language)
                : copy.eta}
            </Pill>
          </View>
          <HelperText>{latestOfferAlert.dropoff_address || "No address set"}</HelperText>
        </View>
      ) : null}

      <SectionCard title={copy.dispatchPulse} subtitle={copy.dispatchPulseCopy}>
        <View style={styles.actionTray}>
          <View style={[styles.actionPill, { backgroundColor: `${palette.surfaceMuted}ef`, borderColor: `${palette.border}bf` }]}>
            <Text style={[styles.actionPillLabel, { color: palette.muted }]}>{copy.driverStatus}</Text>
            <Text style={[styles.actionPillValue, { color: palette.text }]}>{driverStatus}</Text>
          </View>
          <View style={[styles.actionPill, { backgroundColor: `${palette.surfaceMuted}ef`, borderColor: `${palette.border}bf` }]}>
            <Text style={[styles.actionPillLabel, { color: palette.muted }]}>{copy.activeShift}</Text>
            <Text style={[styles.actionPillValue, { color: palette.text }]}>
              {activeShift ? formatDateTime(activeShift.started_at, language) : copy.noActiveShift}
            </Text>
          </View>
        </View>

        <View style={styles.row}>
          <AppButton onPress={() => startShiftM.mutate()} disabled={!!activeShift || startShiftM.isPending}>
            {startShiftM.isPending ? copy.starting : copy.startShift}
          </AppButton>
          <AppButton variant="secondary" onPress={() => endShiftM.mutate()} disabled={!activeShift || endShiftM.isPending}>
            {endShiftM.isPending ? copy.ending : copy.endShift}
          </AppButton>
        </View>
      </SectionCard>

      <SectionCard title={copy.locationTitle} subtitle={copy.locationCopy}>
        <InputField label={copy.latitude} value={lat} onChangeText={setLat} keyboardType="numeric" />
        <InputField label={copy.longitude} value={lng} onChangeText={setLng} keyboardType="numeric" />
        <AppButton variant="secondary" onPress={() => pingM.mutate()} disabled={pingM.isPending}>
          {pingM.isPending ? copy.sending : copy.sendLocation}
        </AppButton>
        {mutationError ? <HelperText tone="danger">{mutationError}</HelperText> : null}
      </SectionCard>

      <SectionCard title={copy.recentEarnings}>
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryTile, { backgroundColor: `${palette.surfaceMuted}ef`, borderColor: `${palette.border}bf` }]}>
            <Text style={[styles.summaryLabel, { color: palette.muted }]}>{copy.delivered}</Text>
            <Text style={[styles.summaryValue, { color: palette.text }]}>{transactions.length}</Text>
          </View>
          <View style={[styles.summaryTile, { backgroundColor: `${palette.surfaceMuted}ef`, borderColor: `${palette.border}bf` }]}>
            <Text style={[styles.summaryLabel, { color: palette.muted }]}>{copy.offers}</Text>
            <Text style={[styles.summaryValue, { color: palette.text }]}>{offeredOrders.length}</Text>
          </View>
          <View style={[styles.summaryTile, { backgroundColor: `${palette.surfaceMuted}ef`, borderColor: `${palette.border}bf` }]}>
            <Text style={[styles.summaryLabel, { color: palette.muted }]}>{copy.activeDrops}</Text>
            <Text style={[styles.summaryValue, { color: palette.text }]}>{assignedOrders.length}</Text>
          </View>
        </View>
        {transactions.length === 0 ? (
          <EmptyBlock message={copy.noEarnings} />
        ) : (
          <View style={uiStyles.listGap}>
            {transactions.map((transaction) => (
              <View key={transaction.id} style={[styles.transactionRow, { backgroundColor: `${palette.surfaceMuted}ef`, borderColor: `${palette.border}bf` }]}>
                <View style={styles.transactionText}>
                  <Text style={[styles.transactionTitle, { color: palette.text }]}>{transaction.description || copy.deliveryEarning}</Text>
                  <Text style={[styles.transactionMeta, { color: palette.muted }]}>
                    {transaction.distance_km ?? 0} km - {transaction.weather_condition || "clear"} -{" "}
                    {formatDateTime(transaction.created_at, language)}
                  </Text>
                </View>
                <Pill tone="success">{formatMoney(transaction.amount, language)}</Pill>
              </View>
            ))}
          </View>
        )}
      </SectionCard>

      <SectionCard title={copy.incomingOffers} subtitle={copy.incomingOffersCopy}>
        {feedQ.isLoading ? (
          <LoadingBlock message="Loading driver feed..." />
        ) : offeredOrders.length === 0 ? (
          <EmptyBlock message={copy.noOffers} />
        ) : (
          <View style={uiStyles.listGap}>
            {offeredOrders.map((order) => {
              const isExpired = getOfferSecondsRemaining(order.offer_sent_at, nowMs) === 0;

              return (
                <DriverOrderCard
                  key={order.id}
                  order={order}
                  language={language}
                  nowMs={nowMs}
                  actions={
                    <View style={styles.row}>
                      <AppButton compact onPress={() => actionM.mutate({ orderId: order.id, action: "accept" })} disabled={actionM.isPending || isExpired}>
                        {copy.accept}
                      </AppButton>
                      <AppButton
                        variant="secondary"
                        compact
                        onPress={() => actionM.mutate({ orderId: order.id, action: "decline" })}
                        disabled={actionM.isPending || isExpired}
                      >
                        {copy.decline}
                      </AppButton>
                    </View>
                  }
                />
              );
            })}
          </View>
        )}
      </SectionCard>

      <SectionCard title={copy.assignedDeliveries} subtitle={copy.assignedDeliveriesCopy}>
        <View style={[styles.proofPanel, { backgroundColor: `${palette.surfaceMuted}ee`, borderColor: `${palette.border}bf` }]}>
          <InputField label={copy.proofNote} value={proofNote} onChangeText={setProofNote} />
          <InputField label={copy.proofPhoto} value={proofPhoto} onChangeText={setProofPhoto} />
          <InputField label={copy.proofSignature} value={proofSignature} onChangeText={setProofSignature} />
        </View>

        {assignedOrders.length === 0 ? (
          <EmptyBlock message={copy.noAssigned} />
        ) : (
          <View style={uiStyles.listGap}>
            {assignedOrders.map((order) => (
              <DriverOrderCard
                key={order.id}
                order={order}
                language={language}
                actions={
                  <View style={styles.row}>
                    {order.status === "ASSIGNED" ? (
                      <AppButton compact onPress={() => actionM.mutate({ orderId: order.id, action: "picked-up" })} disabled={actionM.isPending}>
                        {copy.markPickedUp}
                      </AppButton>
                    ) : null}
                    {order.status === "PICKED_UP" ? (
                      <AppButton compact onPress={() => actionM.mutate({ orderId: order.id, action: "delivered" })} disabled={actionM.isPending}>
                        {copy.markDelivered}
                      </AppButton>
                    ) : null}
                  </View>
                }
              />
            ))}
          </View>
        )}
      </SectionCard>
    </AppShell>
  );
}

function DetailLine({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  const palette = usePalette();

  return (
    <View style={styles.detailLine}>
      <Text style={[styles.detailLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: emphasize ? palette.primaryStrong : palette.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  detailList: {
    gap: 8,
  },
  detailLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    flex: 1,
  },
  detailValue: {
    flex: 1.2,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },
  alertPanel: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 18,
    gap: 10,
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  alertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  alertText: {
    flex: 1,
    gap: 4,
  },
  alertEyebrow: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  alertTitle: {
    fontSize: 24,
    fontWeight: "900",
  },
  alertCopy: {
    fontSize: 14,
    lineHeight: 20,
  },
  dismissButton: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dismissButtonText: {
    fontSize: 12,
    fontWeight: "800",
  },
  actionTray: {
    gap: 10,
  },
  actionPill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  actionPillLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  actionPillValue: {
    fontSize: 15,
    fontWeight: "800",
  },
  proofPanel: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    gap: 12,
  },
  statusHero: {
    borderRadius: 24,
    padding: 18,
    gap: 5,
  },
  statusHeroLabel: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  statusHeroValue: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "900",
  },
  statusHeroNote: {
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 18,
  },
  earningPanel: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    gap: 4,
  },
  earningTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  earningMeta: {
    fontSize: 12,
    lineHeight: 17,
  },
  timerPanel: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    gap: 5,
  },
  timerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  timerLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
  },
  timerValue: {
    fontSize: 18,
    fontWeight: "900",
  },
  timerCopy: {
    fontSize: 12,
    lineHeight: 17,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  summaryTile: {
    minWidth: "30%",
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    gap: 4,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "900",
  },
  transactionRow: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  transactionText: {
    flex: 1,
    gap: 4,
  },
  transactionTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  transactionMeta: {
    fontSize: 12,
    lineHeight: 17,
  },
});
