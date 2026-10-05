import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppShell } from "@/src/components/app-shell";
import { ActiveDeliveryCard, NewOfferBanner, OfferCard } from "@/src/components/driver/driver-cards";
import {
  Alert,
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  InfoRow,
  Input,
  LoadingBlock,
  Panel,
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

const copy = {
  title: "Driver hub",
  subtitle: "Go online, accept offers and update each delivery.",
  onlyDrivers: "This workspace is only available for driver accounts.",
} as const;

export function DriverHubScreen({ navigation }: DriverHubProps) {
  const access = useProtectedAccess("DriverHub");
  const { language } = usePreferences();
  const c = useColors();
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
        <EmptyState icon="car-outline" title="Driver access only" description={copy.onlyDrivers} />
      </AppShell>
    );
  }

  const activeShift = feedQ.data?.driver?.active_shift;
  const driverStatus = feedQ.data?.driver?.status ?? "OFFLINE";
  const offeredOrders = feedQ.data?.offered_orders ?? [];
  const assignedOrders = feedQ.data?.assigned_orders ?? [];
  const transactions = feedQ.data?.driver?.transactions ?? [];
  const lastPingAt = feedQ.data?.driver?.latest_ping?.updated_at;
  const isOnline = Boolean(activeShift);

  return (
    <AppShell navigation={navigation} screenName="DriverHub" title={copy.title} subtitle={copy.subtitle}>
      {/* Status */}
      <Card
        title="Driver status"
        description={activeShift ? `Shift started ${formatDateTime(activeShift.started_at, language)}` : "No active shift"}
        right={<StatusBadge status={driverStatus} label={driverStatus} />}
        style={isOnline ? { borderColor: withAlpha(c.success, 0.4) } : undefined}
      >
        <View style={styles.gap16}>
          <Panel style={styles.stateRow}>
            <View style={[styles.powerIcon, { backgroundColor: isOnline ? withAlpha(c.success, 0.15) : c.muted }]}>
              <Ionicons name="power" size={20} color={isOnline ? c.success : c.mutedForeground} />
            </View>
            <View style={styles.flex}>
              <AppText variant="caption">Current state</AppText>
              <AppText variant="heading">{isOnline ? "You're online and can receive offers" : "You're offline"}</AppText>
            </View>
          </Panel>

          <View style={styles.gap8}>
            <Button
              size="lg"
              fullWidth
              icon="time-outline"
              loading={startShiftM.isPending}
              onPress={() => startShiftM.mutate()}
              disabled={!!activeShift || startShiftM.isPending}
            >
              {startShiftM.isPending ? "Starting..." : "Go online (start shift)"}
            </Button>
            <Button
              size="lg"
              fullWidth
              variant="outline"
              icon="power"
              loading={endShiftM.isPending}
              onPress={() => endShiftM.mutate()}
              disabled={!activeShift || endShiftM.isPending}
            >
              {endShiftM.isPending ? "Ending..." : "Go offline (end shift)"}
            </Button>
          </View>

          <InfoRow label="Last location ping" icon="navigate-outline" value={lastPingAt ? formatDateTime(lastPingAt, language) : "-"} />

          {mutationError ? <Alert tone="destructive" title="Something went wrong" description={mutationError} /> : null}
        </View>
      </Card>

      {latestOfferAlert ? (
        <NewOfferBanner order={latestOfferAlert} language={language} onDismiss={() => setLatestOfferAlert(null)} />
      ) : null}

      <StatGrid>
        <StatCard label="Current balance" value={formatMoney(feedQ.data?.driver?.balance ?? 0, language)} icon="wallet-outline" tone="success" />
        <StatCard label="Total earned" value={formatMoney(feedQ.data?.driver?.total_earned ?? 0, language)} icon="cash-outline" tone="primary" />
        <StatCard label="Offers live" value={offeredOrders.length} icon="file-tray-outline" tone={offeredOrders.length ? "warning" : "neutral"} />
        <StatCard label="Active drops" value={assignedOrders.length} icon="git-branch-outline" tone="info" />
      </StatGrid>

      {/* Incoming offers */}
      <SectionHeader
        title="Incoming offers"
        description="If the timer runs out, the order is automatically offered to another driver."
        action={offeredOrders.length ? <Badge tone="warning" dot>{`${offeredOrders.length} live`}</Badge> : undefined}
      />
      {feedQ.isLoading ? (
        <LoadingBlock message="Loading driver feed..." rows={2} />
      ) : offeredOrders.length === 0 ? (
        <EmptyState
          icon="file-tray-outline"
          title="No offers right now."
          description={isOnline ? "New offers appear here automatically. Keep this screen open." : "Go online to start receiving offers."}
        />
      ) : (
        offeredOrders.map((order) => (
          <OfferCard
            key={order.id}
            order={order}
            language={language}
            nowMs={nowMs}
            busy={actionM.isPending}
            onAccept={() => actionM.mutate({ orderId: order.id, action: "accept" })}
            onDecline={() => actionM.mutate({ orderId: order.id, action: "decline" })}
          />
        ))
      )}

      {/* Assigned deliveries */}
      <SectionHeader title="Assigned deliveries" description="Pick up the order, then mark it delivered with proof." />
      <Card title="Proof of delivery" description='Attached when you tap "Mark delivered".'>
        <View style={styles.gap12}>
          <Input label="Proof signature" value={proofSignature} onChangeText={setProofSignature} placeholder="Name of the person who received it" icon="create-outline" />
          <Input label="Proof photo URL" value={proofPhoto} onChangeText={setProofPhoto} placeholder="https://..." icon="image-outline" autoCapitalize="none" keyboardType="url" />
          <Input label="Proof note" value={proofNote} onChangeText={setProofNote} placeholder="Optional note" icon="document-text-outline" multiline />
        </View>
      </Card>
      {assignedOrders.length === 0 ? (
        <EmptyState icon="cube-outline" title="No assigned deliveries yet." description="Accepted offers show up here as active deliveries." />
      ) : (
        assignedOrders.map((order) => (
          <ActiveDeliveryCard
            key={order.id}
            order={order}
            language={language}
            busy={actionM.isPending}
            onPickedUp={() => actionM.mutate({ orderId: order.id, action: "picked-up" })}
            onDelivered={() => actionM.mutate({ orderId: order.id, action: "delivered" })}
          />
        ))
      )}

      {/* Location */}
      <Card title="Send location" description="Share your position so dispatch can see where you are.">
        <View style={styles.gap12}>
          <Row gap={12} align="flex-start">
            <View style={styles.flex}>
              <Input label="Latitude" value={lat} onChangeText={setLat} keyboardType="numeric" />
            </View>
            <View style={styles.flex}>
              <Input label="Longitude" value={lng} onChangeText={setLng} keyboardType="numeric" />
            </View>
          </Row>
          <Button variant="outline" size="lg" fullWidth icon="navigate-outline" loading={pingM.isPending} onPress={() => pingM.mutate()} disabled={pingM.isPending}>
            {pingM.isPending ? "Sending..." : "Send ping"}
          </Button>
        </View>
      </Card>

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
  gap8: { gap: 8 },
  gap12: { gap: 12 },
  gap16: { gap: 16 },
  stateRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  powerIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  txRow: { paddingVertical: 12 },
});
