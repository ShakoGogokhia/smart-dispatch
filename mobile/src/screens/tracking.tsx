import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { StorefrontBar } from "@/src/components/storefront-bar";
import {
  Alert,
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Panel,
  Row,
  Screen,
  Skeleton,
  StatusBadge,
  humanizeStatus,
  radius,
  useColors,
  withAlpha,
} from "@/src/components/ui";
import type { IconName } from "@/src/components/ui";
import { api } from "@/src/lib/api";
import { formatDateTime } from "@/src/lib/format";
import { usePreferences } from "@/src/providers/app-providers";
import type { RootStackParamList } from "@/src/types/navigation";

type TrackingProps = NativeStackScreenProps<RootStackParamList, "OrderTracking">;

type TrackingPayload = {
  code: string;
  status: string;
  pickup_address?: string | null;
  dropoff_address?: string | null;
  dropoff_lat?: number | string | null;
  dropoff_lng?: number | string | null;
  created_at?: string | null;
  eta_summary?: { estimated_delivery_at?: string | null; promised_at?: string | null; is_late?: boolean };
  market?: { name?: string | null; code?: string | null; address?: string | null } | null;
  driver?: {
    name?: string | null;
    status?: string | null;
    latest_ping?: { lat?: number | string | null; lng?: number | string | null; updated_at?: string | null } | null;
  } | null;
  timeline?: { key: string; label: string; at?: string | null; done: boolean }[];
  events?: { id: number; type: string; created_at?: string | null }[];
};

function toCoord(value: number | string | null | undefined) {
  const n = Number(value);
  return value != null && value !== "" && Number.isFinite(n) && n !== 0 ? n : null;
}

export function OrderTrackingScreen({ route, navigation }: TrackingProps) {
  const c = useColors();
  const { language } = usePreferences();
  const [draftCode, setDraftCode] = useState(route.params?.code ?? "");
  const [code, setCode] = useState(route.params?.code ?? "");
  const trackingQ = useQuery({
    queryKey: ["public-tracking", code],
    queryFn: async () => (await api.get(`/api/public/track/${encodeURIComponent(code)}`)).data as TrackingPayload,
    enabled: code.trim().length > 0,
    refetchInterval: code ? 10000 : false,
    retry: false,
  });
  const order = trackingQ.data;

  const ping = order?.driver?.latest_ping;
  const driverCoord = useMemo(() => {
    const lat = toCoord(ping?.lat);
    const lng = toCoord(ping?.lng);
    return lat != null && lng != null ? { latitude: lat, longitude: lng } : null;
  }, [ping?.lat, ping?.lng]);
  const dropoffCoord = useMemo(() => {
    const lat = toCoord(order?.dropoff_lat);
    const lng = toCoord(order?.dropoff_lng);
    return lat != null && lng != null ? { latitude: lat, longitude: lng } : null;
  }, [order?.dropoff_lat, order?.dropoff_lng]);
  const mapCenter = driverCoord ?? dropoffCoord;

  const statusUpper = (order?.status ?? "").toUpperCase();
  const isStopped = statusUpper === "CANCELLED" || statusUpper === "FAILED";
  const isDelivered = statusUpper === "DELIVERED";

  const submit = () => setCode(draftCode.trim());

  const searchForm = (
    <Row gap={8} align="flex-start">
      <View style={styles.flex}>
        <Input
          value={draftCode}
          onChangeText={setDraftCode}
          placeholder="ORD-000001"
          icon="search-outline"
          autoCapitalize="characters"
          returnKeyType="search"
          onSubmitEditing={submit}
        />
      </View>
      <Button onPress={submit}>Track</Button>
    </Row>
  );

  return (
    <Screen header={<StorefrontBar navigation={navigation} showBack />}>
      {!code ? (
        <Card>
          <View style={styles.searchHero}>
            <View style={[styles.heroIcon, { backgroundColor: withAlpha(c.primary, 0.1) }]}>
              <Ionicons name="search-circle-outline" size={26} color={c.primary} />
            </View>
            <AppText variant="title" style={styles.center}>Track your order</AppText>
            <AppText variant="small" tone="muted" style={styles.center}>
              Enter the order code from your confirmation to see progress, ETA, driver details and the live map.
            </AppText>
          </View>
          <View style={styles.gap8}>
            {searchForm}
            <AppText variant="caption">Order codes look like ORD-000001.</AppText>
            <Button variant="ghost" icon="storefront-outline" onPress={() => navigation.navigate("PublicMarkets")}>
              Browse markets
            </Button>
          </View>
        </Card>
      ) : (
        <>
          <View style={styles.gap4}>
            <AppText variant="title">Track order</AppText>
            <AppText variant="small" tone="muted">Progress updates automatically every 10 seconds.</AppText>
          </View>
          {searchForm}

          {trackingQ.isLoading ? (
            <View style={styles.gap16}>
              <Skeleton height={160} style={styles.skeleton} />
              <Skeleton height={280} style={styles.skeleton} />
              <Skeleton height={160} style={styles.skeleton} />
            </View>
          ) : trackingQ.isError || !order ? (
            <EmptyState
              icon="search-outline"
              title="No order found"
              description={`We could not find an order with the code "${code}". Check the code and try again.`}
              action={
                <Button variant="outline" icon="storefront-outline" onPress={() => navigation.navigate("PublicMarkets")}>
                  Browse markets
                </Button>
              }
            />
          ) : (
            <>
              {/* Status hero */}
              <Card>
                <View style={styles.gap16}>
                  <Row justify="space-between" align="flex-start" gap={12}>
                    <View style={styles.flex}>
                      <AppText variant="caption">Order</AppText>
                      <AppText variant="title" style={styles.mono} numberOfLines={1}>{order.code}</AppText>
                      <View style={styles.statusWrap}>
                        <StatusBadge status={order.status} />
                      </View>
                    </View>
                    <Row gap={6}>
                      {trackingQ.isFetching ? (
                        <ActivityIndicator size="small" color={c.mutedForeground} />
                      ) : (
                        <View style={[styles.liveDot, { backgroundColor: c.success }]} />
                      )}
                      <AppText variant="caption">Live</AppText>
                    </Row>
                  </Row>

                  {isStopped ? (
                    <Alert
                      tone="destructive"
                      title={`This order was ${statusUpper === "FAILED" ? "not delivered" : "cancelled"}`}
                      description="Contact the market if you have questions about this order."
                    />
                  ) : null}

                  <View style={styles.gap8}>
                    <HeroStat
                      icon="time-outline"
                      label={isDelivered ? "Delivered" : "Estimated delivery"}
                      value={formatDateTime(order.eta_summary?.estimated_delivery_at, language)}
                      extra={order.eta_summary?.is_late ? <Badge tone="warning">Running late</Badge> : null}
                    />
                    {order.eta_summary?.promised_at ? (
                      <HeroStat icon="flag-outline" label="Promised" value={formatDateTime(order.eta_summary.promised_at, language)} />
                    ) : null}
                    <HeroStat icon="storefront-outline" label="Market" value={order.market?.name || "Direct order"} />
                    <HeroStat icon="car-outline" label="Driver" value={order.driver?.name || "Waiting for driver"} />
                  </View>
                </View>
              </Card>

              {/* Stepper */}
              <Card title="Progress" description="Each step is checked off as your order moves along.">
                {(order.timeline ?? []).length === 0 ? (
                  <EmptyState compact icon="time-outline" title="No progress yet" description="Steps will appear once the market receives your order." />
                ) : (
                  <Stepper steps={order.timeline ?? []} isStopped={isStopped} status={order.status} />
                )}
              </Card>

              {/* Delivery details */}
              <Card title="Delivery details" description="Where the order is coming from and going to.">
                <View style={styles.gap12}>
                  <AddressBlock icon="storefront-outline" label="Pickup" title={order.market?.name || "Direct order"} value={order.pickup_address ?? order.market?.address} />
                  <AddressBlock icon="location-outline" label="Drop-off" title="Delivery address" value={order.dropoff_address} />
                  {order.created_at ? <AppText variant="caption">Placed {formatDateTime(order.created_at, language)}</AppText> : null}
                </View>
              </Card>

              {/* Map */}
              <Card
                padded={false}
                title="Live map"
                right={ping?.updated_at ? <AppText variant="caption">Updated {formatDateTime(ping.updated_at, language)}</AppText> : undefined}
              >
                {mapCenter ? (
                  <View style={[styles.mapWrap, { borderTopColor: c.border, backgroundColor: c.muted }]}>
                    <MapView
                      style={StyleSheet.absoluteFill}
                      initialRegion={{ ...mapCenter, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
                    >
                      {driverCoord ? <Marker coordinate={driverCoord} title="Driver" pinColor={c.primary} /> : null}
                      {dropoffCoord ? <Marker coordinate={dropoffCoord} title="Drop-off" pinColor={c.success} /> : null}
                    </MapView>
                  </View>
                ) : (
                  <View style={[styles.mapEmpty, { borderTopColor: c.border }]}>
                    <EmptyState compact icon="location-outline" title="Map not available yet" description="The map appears once location data is available." />
                  </View>
                )}
              </Card>

              {/* Driver */}
              <Card title="Your driver">
                {order.driver ? (
                  <Row gap={12}>
                    <View style={[styles.driverIcon, { backgroundColor: withAlpha(c.primary, 0.1) }]}>
                      <Ionicons name="person-outline" size={20} color={c.primary} />
                    </View>
                    <View style={styles.flex}>
                      <AppText variant="label" numberOfLines={1}>{order.driver.name || "Driver"}</AppText>
                      <AppText variant="caption">
                        {ping ? `Sharing live location · ${formatDateTime(ping.updated_at, language)}` : "Location not shared yet"}
                      </AppText>
                    </View>
                    {order.driver.status ? <StatusBadge status={order.driver.status} /> : null}
                  </Row>
                ) : (
                  <EmptyState compact icon="car-outline" title="Waiting for driver" description="A driver will be assigned once the market prepares your order." />
                )}
              </Card>

              {/* Events */}
              <Card title="Latest events" description="The five most recent updates.">
                {(order.events ?? []).length === 0 ? (
                  <AppText variant="small" tone="muted">No events yet.</AppText>
                ) : (
                  <View style={styles.gap12}>
                    {(order.events ?? [])
                      .slice(-5)
                      .reverse()
                      .map((event) => (
                        <Row key={event.id} gap={12} align="flex-start">
                          <View style={[styles.eventDot, { backgroundColor: c.primary }]} />
                          <View style={styles.flex}>
                            <AppText variant="label">{humanizeStatus(event.type, language)}</AppText>
                            <AppText variant="caption">{formatDateTime(event.created_at, language)}</AppText>
                          </View>
                        </Row>
                      ))}
                  </View>
                )}
              </Card>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

function Stepper({
  steps,
  isStopped,
  status,
}: {
  steps: NonNullable<TrackingPayload["timeline"]>;
  isStopped: boolean;
  status: string;
}) {
  const c = useColors();
  const { language } = usePreferences();
  const firstPending = steps.findIndex((step) => !step.done);

  return (
    <View>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const isCurrent = index === firstPending;
        const failedHere = isStopped && isCurrent;
        const circle = step.done
          ? { borderColor: c.primary, backgroundColor: c.primary, fg: c.primaryForeground }
          : failedHere
            ? { borderColor: c.destructive, backgroundColor: c.destructive, fg: c.destructiveForeground }
            : isCurrent
              ? { borderColor: c.primary, backgroundColor: c.background, fg: c.primary }
              : { borderColor: c.border, backgroundColor: c.background, fg: c.mutedForeground };

        return (
          <View key={step.key} style={styles.stepRow}>
            <View style={styles.stepRail}>
              <View style={[styles.stepCircle, { borderColor: circle.borderColor, backgroundColor: circle.backgroundColor }]}>
                {step.done ? (
                  <Ionicons name="checkmark" size={16} color={circle.fg} />
                ) : failedHere ? (
                  <Ionicons name="close" size={16} color={circle.fg} />
                ) : (
                  <AppText variant="caption" style={[styles.stepNum, { color: circle.fg }]}>{index + 1}</AppText>
                )}
              </View>
              {!isLast ? <View style={[styles.stepLine, { backgroundColor: step.done ? c.primary : c.border }]} /> : null}
            </View>
            <View style={[styles.stepBody, !isLast && styles.stepBodyGap]}>
              <Row gap={8} wrap>
                <AppText variant="label" tone={!step.done && !isCurrent ? "muted" : "default"}>{step.label}</AppText>
                {step.done ? (
                  <Badge tone="success">Done</Badge>
                ) : failedHere ? (
                  <Badge tone="destructive">{humanizeStatus(status, language)}</Badge>
                ) : isCurrent ? (
                  <Badge tone="info">In progress</Badge>
                ) : (
                  <Badge tone="neutral">Pending</Badge>
                )}
              </Row>
              <AppText variant="caption">{step.at ? formatDateTime(step.at, language) : "Not yet"}</AppText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function HeroStat({ icon, label, value, extra }: { icon: IconName; label: string; value: string; extra?: ReactNode }) {
  const c = useColors();
  return (
    <Panel style={styles.gap4}>
      <Row gap={6}>
        <Ionicons name={icon} size={14} color={c.mutedForeground} />
        <AppText variant="caption">{label}</AppText>
      </Row>
      <AppText variant="label" numberOfLines={1}>{value}</AppText>
      {extra ? <View style={styles.extra}>{extra}</View> : null}
    </Panel>
  );
}

function AddressBlock({ icon, label, title, value }: { icon: IconName; label: string; title: string; value?: string | null }) {
  const c = useColors();
  return (
    <Panel style={styles.addressRow}>
      <View style={[styles.addressIcon, { backgroundColor: c.background }]}>
        <Ionicons name={icon} size={16} color={c.mutedForeground} />
      </View>
      <View style={styles.flex}>
        <AppText variant="caption">{label}</AppText>
        <AppText variant="label" numberOfLines={1}>{title}</AppText>
        <AppText variant="small" tone="muted">{value || "Not provided"}</AppText>
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  center: { textAlign: "center" },
  gap4: { gap: 4 },
  gap8: { gap: 8 },
  gap12: { gap: 12 },
  gap16: { gap: 16 },
  searchHero: { alignItems: "center", gap: 6, marginBottom: 16 },
  heroIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  skeleton: { borderRadius: radius.xl },
  mono: { fontVariant: ["tabular-nums"] },
  statusWrap: { marginTop: 8, flexDirection: "row" },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  extra: { marginTop: 4, flexDirection: "row" },
  stepRow: { flexDirection: "row", gap: 16 },
  stepRail: { alignItems: "center", width: 32 },
  stepCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  stepNum: { fontWeight: "600" },
  stepLine: { width: 2, flex: 1, minHeight: 16 },
  stepBody: { flex: 1, minWidth: 0, paddingTop: 5, gap: 2 },
  stepBodyGap: { paddingBottom: 20 },
  mapWrap: { height: 300, borderTopWidth: StyleSheet.hairlineWidth, overflow: "hidden", borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
  mapEmpty: { borderTopWidth: StyleSheet.hairlineWidth, padding: 16 },
  driverIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  eventDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  addressRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  addressIcon: { width: 32, height: 32, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
});
