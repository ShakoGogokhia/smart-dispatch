import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useLiveLocation } from "@/src/hooks/use-live-location";
import { AppShell } from "@/src/components/app-shell";
import {
  CurrentDeliveryCard,
  NextDeliveryCard,
  type DriverOrder,
  type DriverStepAction,
} from "@/src/components/driver/current-delivery";
import { NewOfferBanner, OfferCard } from "@/src/components/driver/driver-cards";
import {
  Alert,
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  Row,
  SectionHeader,
  Separator,
  StatCard,
  StatGrid,
  StatusBadge,
  useColors,
  withAlpha,
} from "@/src/components/ui";
import { useProtectedAccess } from "@/src/hooks/use-protected-access";
import { api } from "@/src/lib/api";
import { getErrorMessage } from "@/src/lib/errors";
import { formatDateTime, formatMoney } from "@/src/lib/format";
import { notifyIncomingOffer, prepareLocalNotifications } from "@/src/lib/notifications";
import { usePreferences } from "@/src/providers/app-providers";
import type { DriverFeed, Order } from "@/src/types/api";
import type { RootStackParamList } from "@/src/types/navigation";

type DriverHubProps = NativeStackScreenProps<RootStackParamList, "DriverHub">;

type DriverAction = "accept" | "decline" | DriverStepAction;

const copy = {
  title: "Driver hub",
  subtitle: "One step at a time: accept, pick up, deliver.",
  onlyDrivers: "This workspace is only available for driver accounts.",
} as const;

const DRIVER_STATUS_LABEL: Record<string, string> = {
  ONLINE: "Online",
  ON_ROUTE: "On a delivery",
  OFFLINE: "Offline",
  BREAK: "On break",
};

export function DriverHubScreen({ navigation }: DriverHubProps) {
  const access = useProtectedAccess("DriverHub");
  const { language } = usePreferences();
  const c = useColors();
  const queryClient = useQueryClient();
  const [proofNote, setProofNote] = useState("");
  const [proofPhoto, setProofPhoto] = useState("");
  const [proofSignature, setProofSignature] = useState("");
  const [latestOfferAlert, setLatestOfferAlert] = useState<Order | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const seenOfferIdsRef = useRef<Set<number> | null>(null);
  const alertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
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

  const actionM = useMutation({
    mutationFn: async ({ orderId, action }: { orderId: number; action: DriverAction }) =>
      action === "delivered"
        ? (
            await api.post(`/api/driver/orders/${orderId}/delivered`, {
              proof_note: proofNote || null,
              proof_photo_url: proofPhoto || null,
              proof_signature_name: proofSignature || null,
            })
          ).data
        : (await api.post(`/api/driver/orders/${orderId}/${action}`)).data,
    onSuccess: async (_data, { action }) => {
      if (action === "delivered") {
        setProofNote("");
        setProofPhoto("");
        setProofSignature("");
        setSuccessMessage("Delivered. Nice work!");
        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current);
        }
        successTimeoutRef.current = setTimeout(() => setSuccessMessage(null), 6000);
      }
      await refreshQueries();
    },
  });

  const lastAction = actionM.variables?.action;
  const isStepAction = lastAction != null && lastAction !== "accept" && lastAction !== "decline";

  // Step-action errors (e.g. "The market hasn't finished preparing this order yet") show inside the delivery card.
  const mutationError = useMemo(
    () =>
      [startShiftM.error, endShiftM.error, isStepAction ? null : actionM.error]
        .filter(Boolean)
        .map((error) => getErrorMessage(error, "Something went wrong"))
        .join("\n"),
    [actionM.error, endShiftM.error, isStepAction, startShiftM.error],
  );

  // Online drivers share live GPS so dispatch can see them and send the next order when they're ~500 m from the customer.
  const live = useLiveLocation(access.ready && Boolean(feedQ.data?.driver?.active_shift), () =>
    void queryClient.invalidateQueries({ queryKey: ["driver-feed"] }),
  );

  if (!access.ready) {
    return access.fallback;
  }

  if (!isDriver) {
    return (
      <AppShell navigation={navigation} screenName="DriverHub" title={copy.title} subtitle={copy.subtitle}>
        <EmptyState icon="car-outline" title="Driver access only" description={copy.onlyDrivers} />
      </AppShell>
    );
  }

  const activeShift = feedQ.data?.driver?.active_shift;
  const driverStatus = feedQ.data?.driver?.status ?? "OFFLINE";
  const offeredOrders = feedQ.data?.offered_orders ?? [];
  const assignedOrders = (feedQ.data?.assigned_orders ?? []) as DriverOrder[];
  const transactions = feedQ.data?.driver?.transactions ?? [];
  const latestPing = feedQ.data?.driver?.latest_ping;
  const isOnline = Boolean(activeShift);
  const [currentOrder, ...nextOrders] = assignedOrders;
  const stepError =
    isStepAction && actionM.error && currentOrder && actionM.variables?.orderId === currentOrder.id
      ? getErrorMessage(actionM.error, "Something went wrong")
      : null;

  return (
    <AppShell navigation={navigation} screenName="DriverHub" title={copy.title} subtitle={copy.subtitle}>
      {/* Shift status */}
      <Card style={isOnline ? { borderColor: withAlpha(c.success, 0.4) } : undefined}>
        <View style={styles.gap12}>
          <Row gap={12}>
            <View style={[styles.powerIcon, { backgroundColor: isOnline ? withAlpha(c.success, 0.15) : c.muted }]}>
              <Ionicons name="power" size={20} color={isOnline ? c.success : c.mutedForeground} />
            </View>
            <View style={styles.flex}>
              <AppText variant="heading">{isOnline ? "You're online" : "You're offline"}</AppText>
              <AppText variant="caption">
                {activeShift ? `Shift started ${formatDateTime(activeShift.started_at, language)}` : "Go online to receive offers"}
              </AppText>
            </View>
            <StatusBadge status={driverStatus} label={DRIVER_STATUS_LABEL[driverStatus] ?? driverStatus} />
          </Row>
          {isOnline ? (
            <Row gap={6}>
              <Ionicons
                name={live.status === "on" ? "locate" : live.status === "denied" || live.status === "unavailable" ? "warning-outline" : "locate-outline"}
                size={14}
                color={live.status === "on" ? c.success : live.status === "denied" || live.status === "unavailable" ? c.destructive : c.mutedForeground}
              />
              <AppText variant="caption" style={styles.flex}>
                {live.status === "on"
                  ? "Live location on — new orders arrive when you're close to finishing the current one."
                  : live.status === "denied"
                    ? "Location permission is off. Allow it in Settings so dispatch can send you nearby orders."
                    : live.status === "unavailable"
                      ? "Couldn't read your location. Check that GPS is on."
                      : "Turning on live location…"}
              </AppText>
            </Row>
          ) : null}
          {isOnline ? (
            <Button
              fullWidth
              variant="outline"
              icon="power"
              loading={endShiftM.isPending}
              onPress={() => endShiftM.mutate()}
              disabled={endShiftM.isPending}
            >
              {endShiftM.isPending ? "Ending..." : "Go offline (end shift)"}
            </Button>
          ) : (
            <Button
              size="lg"
              fullWidth
              icon="time-outline"
              loading={startShiftM.isPending}
              onPress={() => startShiftM.mutate()}
              disabled={startShiftM.isPending}
            >
              {startShiftM.isPending ? "Starting..." : "Go online (start shift)"}
            </Button>
          )}
        </View>
      </Card>

      {mutationError ? <Alert tone="destructive" title="Something went wrong" description={mutationError} /> : null}
      {successMessage ? (
        <Alert tone="success" title={successMessage} description="The delivery is complete and your earning was added." />
      ) : null}

      {latestOfferAlert ? (
        <NewOfferBanner order={latestOfferAlert} language={language} onDismiss={() => setLatestOfferAlert(null)} />
      ) : null}

      {feedQ.isLoading ? (
        <LoadingBlock message="Loading driver feed..." rows={2} />
      ) : (
        <>
          {/* Incoming offers */}
          {offeredOrders.length ? (
            <>
              <SectionHeader
                title={offeredOrders.length > 1 ? "New offers" : "New offer"}
                description="Accept before the timer runs out, or it goes to another driver."
                action={<Badge tone="warning" dot>{`${offeredOrders.length} live`}</Badge>}
              />
              {offeredOrders.map((order) => (
                <OfferCard
                  key={order.id}
                  order={order}
                  language={language}
                  nowMs={nowMs}
                  compact={Boolean(currentOrder)}
                  driverLocation={latestPing}
                  busy={actionM.isPending}
                  onAccept={() => actionM.mutate({ orderId: order.id, action: "accept" })}
                  onDecline={() => actionM.mutate({ orderId: order.id, action: "decline" })}
                />
              ))}
            </>
          ) : null}

          {/* Current delivery */}
          {currentOrder ? (
            <CurrentDeliveryCard
              order={currentOrder}
              driverPing={latestPing}
              language={language}
              busy={actionM.isPending && actionM.variables?.orderId === currentOrder.id}
              error={stepError}
              proof={{
                signature: proofSignature,
                photo: proofPhoto,
                note: proofNote,
                setSignature: setProofSignature,
                setPhoto: setProofPhoto,
                setNote: setProofNote,
              }}
              onAction={(action) => actionM.mutate({ orderId: currentOrder.id, action })}
            />
          ) : offeredOrders.length === 0 ? (
            <EmptyState
              icon={isOnline ? "bicycle-outline" : "power"}
              title="No active deliveries"
              description={isOnline ? "Stay online — new offers will appear here." : "Go online to start receiving offers."}
            />
          ) : null}

          {nextOrders.length ? (
            <>
              <SectionHeader title="Next deliveries" description="These start after the current delivery." />
              {nextOrders.map((order) => (
                <NextDeliveryCard key={order.id} order={order} language={language} />
              ))}
            </>
          ) : null}
        </>
      )}

      {/* Earnings */}
      <StatGrid>
        <StatCard label="Current balance" value={formatMoney(feedQ.data?.driver?.balance ?? 0, language)} icon="wallet-outline" tone="success" />
        <StatCard label="Total earned" value={formatMoney(feedQ.data?.driver?.total_earned ?? 0, language)} icon="cash-outline" tone="primary" />
      </StatGrid>

      {/* Recent earnings */}
      <Card title="Recent earnings" description={`Delivered: ${transactions.length}`}>
        {transactions.length === 0 ? (
          <EmptyState compact icon="cash-outline" title="No earnings yet." description="Complete a delivery to see earnings here." />
        ) : (
          <View>
            {transactions.map((transaction, index) => (
              <View key={transaction.id}>
                {index > 0 ? <Separator /> : null}
                <Row justify="space-between" gap={12} style={styles.txRow}>
                  <View style={styles.flex}>
                    <AppText variant="label" numberOfLines={1}>{transaction.description || "Delivery earning"}</AppText>
                    <AppText variant="caption">
                      {transaction.distance_km ?? 0} km · {transaction.weather_condition || "clear"} · {formatDateTime(transaction.created_at, language)}
                    </AppText>
                  </View>
                  <Badge tone="success">{formatMoney(transaction.amount, language)}</Badge>
                </Row>
              </View>
            ))}
          </View>
        )}
      </Card>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  gap12: { gap: 12 },
  powerIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  txRow: { paddingVertical: 12 },
});
