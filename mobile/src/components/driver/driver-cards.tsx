import type { ReactNode } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppText, Badge, Button, Card, Panel, Progress, Row, StatusBadge, radius, useColors, withAlpha } from "@/src/components/ui";
import type { IconName } from "@/src/components/ui";
import { formatDateTime, formatMoney } from "@/src/lib/format";
import type { Order } from "@/src/types/api";

type Language = "en" | "ka";

export const OFFER_TIMEOUT_SECONDS = 300;

export function getOfferSecondsRemaining(offerSentAt: string | null | undefined, nowMs: number) {
  if (!offerSentAt) {
    return OFFER_TIMEOUT_SECONDS;
  }

  const sentAtMs = new Date(offerSentAt).getTime();
  if (Number.isNaN(sentAtMs)) {
    return OFFER_TIMEOUT_SECONDS;
  }

  return Math.max(0, OFFER_TIMEOUT_SECONDS - Math.floor((nowMs - sentAtMs) / 1000));
}

export function formatCountdown(secondsRemaining: number) {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function itemSummary(order: Order) {
  return order.items
    ?.map((item) => {
      const combo = item.combo_offer?.name ? ` [combo: ${item.combo_offer.name}]` : "";
      const removed = item.removed_ingredients?.length ? ` (without ${item.removed_ingredients.join(", ")})` : "";
      return `${item.name} x${item.qty}${combo}${removed}`;
    })
    .join(", ");
}

function RouteStop({ icon, label, value, tone }: { icon: IconName; label: string; value: string; tone: "primary" | "success" }) {
  const c = useColors();
  const color = tone === "primary" ? c.primary : c.success;
  return (
    <Row gap={12} align="flex-start">
      <View style={[styles.stopIcon, { backgroundColor: withAlpha(color, tone === "primary" ? 0.1 : 0.15) }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <View style={styles.flex}>
        <AppText variant="caption">{label}</AppText>
        <AppText variant="label">{value}</AppText>
      </View>
    </Row>
  );
}

/** Pickup -> dropoff block (web RouteSummary). */
export function RouteSummary({ order }: { order: Order }) {
  const c = useColors();
  return (
    <Panel style={styles.routePanel}>
      <RouteStop
        icon="storefront-outline"
        label="Pickup"
        value={order.pickup_address || order.market?.name || order.market?.code || "No address set"}
        tone="primary"
      />
      <View style={styles.arrowCol}>
        <Ionicons name="arrow-down" size={14} color={c.mutedForeground} />
      </View>
      <RouteStop icon="location-outline" label="Dropoff" value={order.dropoff_address || "No address set"} tone="success" />
    </Panel>
  );
}

function Tile({ label, value, sub, success }: { label: string; value: string; sub?: string; success?: boolean }) {
  const c = useColors();
  return (
    <View
      style={[
        styles.tile,
        { borderColor: c.border, backgroundColor: success ? withAlpha(c.success, 0.1) : withAlpha(c.muted, 0.5) },
      ]}
    >
      <AppText variant="caption" numberOfLines={1}>{label}</AppText>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.tileValue, { color: success ? c.success : c.foreground }]}>
        {value}
      </Text>
      {sub ? <AppText variant="caption" numberOfLines={1}>{sub}</AppText> : null}
    </View>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailField}>
      <AppText variant="caption">{label}</AppText>
      <AppText variant="label">{value}</AppText>
    </View>
  );
}

/** Route + earning tiles + customer details (web OrderDetails). */
export function OrderDetails({ order, language }: { order: Order; language: Language }) {
  const compensation = order.driver_compensation;
  const items = itemSummary(order);
  return (
    <View style={styles.gap12}>
      <RouteSummary order={order} />

      {compensation?.earning_amount != null ? (
        <Row gap={8} align="stretch">
          <Tile label="Earning" value={formatMoney(compensation.earning_amount, language)} success />
          <Tile label="Distance" value={`${compensation.distance_km ?? 0} km`} />
          <Tile label="Weather" value={compensation.weather_condition || "clear"} sub={`x${compensation.weather_multiplier ?? 1}`} />
        </Row>
      ) : null}

      <Row gap={12} align="flex-start">
        <DetailField label="Customer" value={order.customer_name || order.customer?.name || "Unknown"} />
        <DetailField label="Phone" value={order.customer_phone || "Not provided"} />
      </Row>
      <DetailField label="Market" value={order.market?.name || "Direct order"} />
      {order.eta_summary?.estimated_delivery_at ? (
        <DetailField label="ETA" value={formatDateTime(order.eta_summary.estimated_delivery_at, language)} />
      ) : null}
      {order.notes ? <DetailField label="Delivery notes" value={order.notes} /> : null}
      {items ? <DetailField label="Items" value={items} /> : null}
    </View>
  );
}

function OrderHeader({ order, language }: { order: Order; language: Language }) {
  return (
    <Row justify="space-between" align="flex-start" gap={12}>
      <View style={styles.flex}>
        <AppText variant="caption">{order.market?.code || "Order"}</AppText>
        <AppText variant="heading" style={styles.code}>{order.code}</AppText>
      </View>
      <View style={styles.headerRight}>
        <StatusBadge status={order.status} />
        {order.total != null ? <AppText variant="label">{formatMoney(order.total, language)}</AppText> : null}
      </View>
    </Row>
  );
}

/** Highlighted incoming offer with countdown and Accept / Decline. */
export function OfferCard({
  order,
  language,
  nowMs,
  busy,
  onAccept,
  onDecline,
}: {
  order: Order;
  language: Language;
  nowMs: number;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const c = useColors();
  const secondsRemaining = getOfferSecondsRemaining(order.offer_sent_at, nowMs);
  const isExpired = secondsRemaining === 0;
  const isUrgent = !isExpired && secondsRemaining <= 60;
  const timerBg = isExpired ? withAlpha(c.destructive, 0.1) : isUrgent ? withAlpha(c.warning, 0.15) : withAlpha(c.muted, 0.5);
  const timerFg = isExpired ? c.destructive : c.foreground;

  return (
    <Card highlighted>
      <View style={styles.gap16}>
        <OrderHeader order={order} language={language} />

        <View style={[styles.timer, { backgroundColor: timerBg, borderColor: isExpired ? withAlpha(c.destructive, 0.35) : c.border }]}>
          <Row justify="space-between" gap={12}>
            <AppText variant="label" style={{ color: timerFg }}>Time left to accept</AppText>
            <Text style={[styles.countdown, { color: timerFg }]}>{formatCountdown(secondsRemaining)}</Text>
          </Row>
          <Progress
            value={(secondsRemaining / OFFER_TIMEOUT_SECONDS) * 100}
            tone={isExpired ? "destructive" : isUrgent ? "warning" : "primary"}
          />
          <AppText variant="caption" style={isExpired ? { color: c.destructive } : undefined}>
            {isExpired
              ? "Time expired. This offer is being reassigned."
              : "If the timer runs out, the order is automatically offered to another driver."}
          </AppText>
        </View>

        <OrderDetails order={order} language={language} />

        <View style={styles.gap8}>
          <Button size="lg" fullWidth icon="checkmark-circle-outline" onPress={onAccept} disabled={busy || isExpired}>
            Accept
          </Button>
          <Button size="lg" fullWidth variant="outline" icon="close-circle-outline" onPress={onDecline} disabled={busy || isExpired}>
            Decline
          </Button>
        </View>
      </View>
    </Card>
  );
}

function navigateUrl(order: Order) {
  const hasCoords = Boolean(Number(order.dropoff_lat) && Number(order.dropoff_lng));
  if (hasCoords) {
    return `https://www.google.com/maps/dir/?api=1&destination=${order.dropoff_lat},${order.dropoff_lng}`;
  }
  return order.dropoff_address ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.dropoff_address)}` : null;
}

/** Assigned delivery with Navigate / Call links and the next step button. */
export function ActiveDeliveryCard({
  order,
  language,
  busy,
  onPickedUp,
  onDelivered,
}: {
  order: Order;
  language: Language;
  busy: boolean;
  onPickedUp: () => void;
  onDelivered: () => void;
}) {
  const navUrl = navigateUrl(order);
  const phone = order.customer_phone;
  const step: ReactNode =
    order.status === "ASSIGNED" ? (
      <Button size="lg" fullWidth icon="cube-outline" onPress={onPickedUp} disabled={busy}>
        Mark picked up
      </Button>
    ) : order.status === "PICKED_UP" ? (
      <Button size="lg" fullWidth icon="checkmark-done-outline" onPress={onDelivered} disabled={busy}>
        Mark delivered
      </Button>
    ) : null;

  return (
    <Card footer={step ?? undefined}>
      <View style={styles.gap16}>
        <OrderHeader order={order} language={language} />
        <OrderDetails order={order} language={language} />
        {navUrl || phone ? (
          <Row gap={8}>
            {navUrl ? (
              <Button variant="outline" size="lg" icon="navigate-outline" style={styles.flex} onPress={() => void Linking.openURL(navUrl)}>
                Navigate
              </Button>
            ) : null}
            {phone ? (
              <Button variant="outline" size="lg" icon="call-outline" style={styles.flex} onPress={() => void Linking.openURL(`tel:${phone}`)}>
                Call
              </Button>
            ) : null}
          </Row>
        ) : null}
      </View>
    </Card>
  );
}

/** Banner for the newest offer that just arrived (sound + vibration notification). */
export function NewOfferBanner({ order, language, onDismiss }: { order: Order; language: Language; onDismiss: () => void }) {
  const c = useColors();
  return (
    <View style={[styles.banner, { backgroundColor: withAlpha(c.primary, 0.08), borderColor: withAlpha(c.primary, 0.35) }]}>
      <Row justify="space-between" align="flex-start" gap={12}>
        <Row gap={10} align="flex-start" style={styles.flex}>
          <Ionicons name="notifications-outline" size={18} color={c.primary} />
          <View style={styles.flex}>
            <AppText variant="label" tone="primary">New offer</AppText>
            <AppText variant="heading">{order.code}</AppText>
            <AppText variant="caption">A new delivery just arrived with sound and vibration.</AppText>
          </View>
        </Row>
        <Button size="sm" variant="ghost" onPress={onDismiss}>
          Dismiss
        </Button>
      </Row>
      <Row gap={6} wrap>
        {order.total != null ? <Badge tone="warning">{formatMoney(order.total, language)}</Badge> : null}
        {order.driver_compensation?.earning_amount != null ? (
          <Badge tone="success">{formatMoney(order.driver_compensation.earning_amount, language)}</Badge>
        ) : null}
        {order.eta_summary?.estimated_delivery_at ? (
          <Badge tone="info" icon="time-outline">{formatDateTime(order.eta_summary.estimated_delivery_at, language)}</Badge>
        ) : null}
      </Row>
      <AppText variant="small" tone="muted" numberOfLines={2}>{order.dropoff_address || "No address set"}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  gap8: { gap: 8 },
  gap12: { gap: 12 },
  gap16: { gap: 16 },
  code: { fontVariant: ["tabular-nums"] },
  headerRight: { alignItems: "flex-end", gap: 6 },
  routePanel: { gap: 4 },
  stopIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 2 },
  arrowCol: { width: 28, alignItems: "center" },
  tile: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: radius.lg, padding: 10, gap: 2 },
  tileValue: { fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"], textTransform: "capitalize" },
  detailField: { flex: 1, minWidth: 0, gap: 2 },
  timer: { borderWidth: 1, borderRadius: radius.lg, padding: 12, gap: 8 },
  countdown: { fontSize: 20, fontWeight: "600", fontVariant: ["tabular-nums"] },
  banner: { borderWidth: 1, borderRadius: radius.xl, padding: 16, gap: 10 },
});
