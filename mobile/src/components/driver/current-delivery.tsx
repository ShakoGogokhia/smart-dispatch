import { useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Alert, AppText, Badge, Button, Card, EmptyState, Input, Panel, Row, Separator, radius, useColors, withAlpha } from "@/src/components/ui";
import type { IconName } from "@/src/components/ui";
import { formatMoney } from "@/src/lib/format";
import type { Order } from "@/src/types/api";

import { DeliveryRouteMap } from "./offer-map";

type Language = "en" | "ka";

export type DriverStep = "offer" | "to_pickup" | "waiting_ready" | "pickup" | "to_dropoff" | "handover" | "done";

/** Order as returned by the driver feed (adds the step fields the backend decorates it with). */
export type DriverOrder = Order & {
  driver_step?: DriverStep;
  is_ready_for_pickup?: boolean;
  arrived_at_pickup_at?: string | null;
  arrived_at_dropoff_at?: string | null;
  pickup_lat?: number | string | null;
  pickup_lng?: number | string | null;
};

export type DriverStepAction = "arrived-pickup" | "picked-up" | "arrived-dropoff" | "delivered";

export type ProofState = {
  signature: string;
  photo: string;
  note: string;
  setSignature: (value: string) => void;
  setPhoto: (value: string) => void;
  setNote: (value: string) => void;
};

type LatLng = { lat: number; lng: number };

/** Backend sends `driver_step`; fall back to the order status for older payloads. */
export function getDriverStep(order: DriverOrder): DriverStep {
  if (order.driver_step) return order.driver_step;
  if (order.status === "OFFERED") return "offer";
  if (order.status === "ASSIGNED") {
    if (!order.arrived_at_pickup_at) return "to_pickup";
    return order.ready_for_pickup_at ? "pickup" : "waiting_ready";
  }
  if (order.status === "PICKED_UP") return order.arrived_at_dropoff_at ? "handover" : "to_dropoff";
  return "done";
}

const STEP_SHORT_LABEL: Record<DriverStep, string> = {
  offer: "Offer",
  to_pickup: "Go to market",
  waiting_ready: "Waiting at market",
  pickup: "Ready to pick up",
  to_dropoff: "On the way",
  handover: "At customer",
  done: "Done",
};

const STEPPER_LABELS = ["Go to market", "Pick up", "Go to customer", "Deliver"] as const;

/** 1-based stepper position for a driver step. */
function stepperIndex(step: DriverStep) {
  switch (step) {
    case "to_pickup":
      return 1;
    case "waiting_ready":
    case "pickup":
      return 2;
    case "to_dropoff":
      return 3;
    case "handover":
      return 4;
    case "done":
      return 5;
    default:
      return 0;
  }
}

function toCoord(lat: unknown, lng: unknown): LatLng | null {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln) || (la === 0 && ln === 0)) return null;
  return { lat: la, lng: ln };
}

function isPickupPhase(step: DriverStep) {
  return step === "to_pickup" || step === "waiting_ready" || step === "pickup";
}

function destinationFor(order: DriverOrder, step: DriverStep) {
  if (isPickupPhase(step)) {
    return {
      coord: toCoord(order.pickup_lat, order.pickup_lng) ?? toCoord(order.market?.lat, order.market?.lng),
      address: order.pickup_address || order.market?.address || null,
      label: order.market?.name || "Market",
    };
  }
  return {
    coord: toCoord(order.dropoff_lat, order.dropoff_lng),
    address: order.dropoff_address || null,
    label: order.customer_name || order.customer?.name || "Customer",
  };
}

function directionsUrl(coord: LatLng | null, address: string | null) {
  if (coord) return `https://www.google.com/maps/dir/?api=1&destination=${coord.lat},${coord.lng}`;
  if (address) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  return null;
}

/* -------------------------------------------------------------------------------------------------
 * Stepper
 * -----------------------------------------------------------------------------------------------*/

export function DeliveryStepper({ step }: { step: DriverStep }) {
  const c = useColors();
  const current = stepperIndex(step);

  return (
    <Row align="flex-start" gap={0}>
      {STEPPER_LABELS.map((label, i) => {
        const position = i + 1;
        const done = position < current;
        const active = position === current;
        const dotBg = done ? c.success : active ? c.primary : c.muted;
        const dotFg = done ? c.successForeground : active ? c.primaryForeground : c.mutedForeground;
        return (
          <View key={label} style={styles.stepCol}>
            <View style={styles.stepTrackRow}>
              <View style={[styles.stepLine, { backgroundColor: i === 0 ? "transparent" : position <= current ? c.success : c.border }]} />
              <View style={[styles.stepDot, { backgroundColor: dotBg }, active && { borderColor: withAlpha(c.primary, 0.3), borderWidth: 3 }]}>
                {done ? (
                  <Ionicons name="checkmark" size={14} color={dotFg} />
                ) : (
                  <Text style={[styles.stepNumber, { color: dotFg }]}>{position}</Text>
                )}
              </View>
              <View
                style={[
                  styles.stepLine,
                  { backgroundColor: i === STEPPER_LABELS.length - 1 ? "transparent" : position < current ? c.success : c.border },
                ]}
              />
            </View>
            <AppText
              variant="caption"
              numberOfLines={2}
              style={[styles.stepLabel, active ? { color: c.foreground, fontWeight: "600" } : undefined]}
            >
              {label}
            </AppText>
          </View>
        );
      })}
    </Row>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Small helpers
 * -----------------------------------------------------------------------------------------------*/

function Collapsible({ title, icon, defaultOpen = false, children }: PropsWithChildren<{ title: string; icon: IconName; defaultOpen?: boolean }>) {
  const c = useColors();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={[styles.collapsible, { borderColor: c.border }]}>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.collapsibleHeader, pressed && { backgroundColor: c.accent }]}
      >
        <Ionicons name={icon} size={16} color={c.mutedForeground} />
        <AppText variant="label" style={styles.flex}>{title}</AppText>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={c.mutedForeground} />
      </Pressable>
      {open ? <View style={styles.collapsibleBody}>{children}</View> : null}
    </View>
  );
}

function Instruction({ step, order, destination }: { step: DriverStep; order: DriverOrder; destination: ReturnType<typeof destinationFor> }) {
  const c = useColors();
  const marketName = order.market?.name || "the market";
  const customerName = order.customer_name || order.customer?.name || "the customer";

  const content: { icon: IconName; title: string; address?: string | null; hint: string; tone: "primary" | "success" | "warning" } = (() => {
    switch (step) {
      case "to_pickup":
        return { icon: "storefront-outline", title: `Go to ${marketName}`, address: destination.address, hint: "Tap “I've arrived” when you're at the market.", tone: "primary" };
      case "waiting_ready":
        return {
          icon: "hourglass-outline",
          title: "Waiting for the market to prepare the order",
          address: null,
          hint: "You'll be able to pick it up as soon as it's ready.",
          tone: "warning",
        };
      case "pickup":
        return { icon: "bag-check-outline", title: "The order is ready — pick it up", address: null, hint: "Check the items, then tap “Picked up the order”.", tone: "success" };
      case "to_dropoff":
        return { icon: "navigate-outline", title: `Deliver to ${customerName}`, address: destination.address, hint: "Tap “I've arrived” at the address.", tone: "primary" };
      case "handover":
        return { icon: "hand-left-outline", title: "Hand the order to the customer", address: destination.address, hint: "Then tap “Delivered”.", tone: "success" };
      default:
        return { icon: "checkmark-done-outline", title: "Delivery complete", address: null, hint: "", tone: "success" };
    }
  })();

  const color = content.tone === "success" ? c.success : content.tone === "warning" ? c.warning : c.primary;
  const iconColor = content.tone === "warning" ? c.warningForeground : color;

  return (
    <View style={[styles.instruction, { backgroundColor: withAlpha(color, 0.08), borderColor: withAlpha(color, 0.3) }]}>
      <View style={[styles.instructionIcon, { backgroundColor: withAlpha(color, content.tone === "warning" ? 0.25 : 0.15) }]}>
        {step === "waiting_ready" ? <ActivityIndicator color={iconColor} /> : <Ionicons name={content.icon} size={24} color={iconColor} />}
      </View>
      <View style={styles.flex}>
        <AppText variant="title">{content.title}</AppText>
        {content.address ? (
          <Row gap={6} align="flex-start" style={styles.mt4}>
            <Ionicons name="location-outline" size={15} color={c.mutedForeground} style={styles.mt2} />
            <AppText variant="body" style={styles.flex}>{content.address}</AppText>
          </Row>
        ) : null}
        {content.hint ? <AppText variant="small" tone="muted" style={styles.mt4}>{content.hint}</AppText> : null}
      </View>
    </View>
  );
}

function OrderDetailsBody({ order, language }: { order: DriverOrder; language: Language }) {
  const items = order.items ?? [];
  return (
    <View style={styles.gap8}>
      <Row justify="space-between" gap={12}>
        <AppText variant="small" tone="muted">Order code</AppText>
        <AppText variant="label" style={styles.tabular}>{order.code}</AppText>
      </Row>
      <Row justify="space-between" gap={12}>
        <AppText variant="small" tone="muted">Market</AppText>
        <AppText variant="label">{order.market?.name || "Direct order"}</AppText>
      </Row>
      {items.length ? <Separator /> : null}
      {items.map((item, index) => {
        const extras = [
          item.combo_offer?.name ? `combo: ${item.combo_offer.name}` : null,
          item.removed_ingredients?.length ? `without ${item.removed_ingredients.join(", ")}` : null,
        ].filter(Boolean);
        return (
          <Row key={`${item.name}-${index}`} justify="space-between" align="flex-start" gap={12}>
            <View style={styles.flex}>
              <AppText variant="body">{item.name}</AppText>
              {extras.length ? <AppText variant="caption">{extras.join(" · ")}</AppText> : null}
            </View>
            <Badge tone="neutral">{`x${item.qty}`}</Badge>
          </Row>
        );
      })}
      {order.total != null ? (
        <>
          <Separator />
          <Row justify="space-between" gap={12}>
            <AppText variant="label">Total</AppText>
            <AppText variant="heading">{formatMoney(order.total, language)}</AppText>
          </Row>
        </>
      ) : null}
      {order.notes ? (
        <Panel>
          <AppText variant="caption">Delivery notes</AppText>
          <AppText variant="body">{order.notes}</AppText>
        </Panel>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Current delivery
 * -----------------------------------------------------------------------------------------------*/

export function CurrentDeliveryCard({
  order,
  driverPing,
  language,
  busy,
  error,
  proof,
  onAction,
}: {
  order: DriverOrder;
  driverPing?: { lat: number | string; lng: number | string } | null;
  language: Language;
  busy: boolean;
  error?: string | null;
  proof: ProofState;
  onAction: (action: DriverStepAction) => void;
}) {
  const c = useColors();
  const step = getDriverStep(order);
  const destination = destinationFor(order, step);
  const driverCoord = driverPing ? toCoord(driverPing.lat, driverPing.lng) : null;
  const navUrl = directionsUrl(destination.coord, destination.address);
  const phone = !isPickupPhase(step) ? order.customer_phone : null;
  const pickupPhase = isPickupPhase(step);
  const earning = order.driver_compensation?.earning_amount;

  const mapCenter = destination.coord ?? driverCoord;

  const action: { label: string; icon: IconName; action: DriverStepAction } | null =
    step === "to_pickup"
      ? { label: "I've arrived at the market", icon: "flag-outline", action: "arrived-pickup" }
      : step === "pickup"
        ? { label: "Picked up the order", icon: "bag-check-outline", action: "picked-up" }
        : step === "to_dropoff"
          ? { label: "I've arrived at the customer", icon: "flag-outline", action: "arrived-dropoff" }
          : step === "handover"
            ? { label: "Delivered", icon: "checkmark-done-outline", action: "delivered" }
            : null;

  // The one thing to do right now — placed right under the instruction so it never needs scrolling.
  const actionBlock = (
    <View style={styles.gap8}>
      {error ? <Alert tone="destructive" title="Couldn't update the delivery" description={error} /> : null}
      {action ? (
        <Button size="lg" fullWidth icon={action.icon} loading={busy} disabled={busy} onPress={() => onAction(action.action)} style={styles.bigButton}>
          {action.label}
        </Button>
      ) : step === "waiting_ready" ? (
        <View style={[styles.waitingBox, { backgroundColor: c.muted }]}>
          <ActivityIndicator size="small" color={c.mutedForeground} />
          <AppText variant="label" tone="muted">{"Waiting for the market…"}</AppText>
        </View>
      ) : null}
    </View>
  );

  return (
    <Card highlighted>
      <View style={styles.gap16}>
        <Row justify="space-between" align="flex-start" gap={12}>
          <View style={styles.flex}>
            <AppText variant="caption" tone="primary" style={styles.eyebrow}>Current delivery</AppText>
            <AppText variant="heading" style={styles.tabular}>{order.code}</AppText>
          </View>
          {earning != null ? <Badge tone="success" icon="cash-outline">{formatMoney(earning, language)}</Badge> : null}
        </Row>

        <DeliveryStepper step={step} />

        <Instruction step={step} order={order} destination={destination} />

        {step === "handover" ? (
          <Collapsible title="Add proof (optional)" icon="camera-outline">
            <View style={styles.gap12}>
              <Input label="Received by" value={proof.signature} onChangeText={proof.setSignature} placeholder="Name of the person who received it" icon="create-outline" />
              <Input label="Photo URL" value={proof.photo} onChangeText={proof.setPhoto} placeholder="https://..." icon="image-outline" autoCapitalize="none" keyboardType="url" />
              <Input label="Note" value={proof.note} onChangeText={proof.setNote} placeholder="Optional note" icon="document-text-outline" multiline />
            </View>
          </Collapsible>
        ) : null}

        {actionBlock}

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

        {mapCenter ? (
          <DeliveryRouteMap
            driverLocation={driverCoord}
            destination={destination.coord}
            destinationLabel={pickupPhase ? "Market" : "Customer"}
            destinationAddress={destination.address}
            destinationColor={pickupPhase ? c.primary : c.success}
            routeKey={`${order.id}-${pickupPhase ? "pickup" : "dropoff"}`}
          />
        ) : (
          <View style={[styles.mapWrap, { borderColor: c.border, backgroundColor: c.muted }]}>
            <View style={styles.mapEmpty}>
              <EmptyState compact icon="map-outline" title="No map location" description="Use the address above to find the stop." />
            </View>
          </View>
        )}

        <Collapsible title={`Order details${order.items?.length ? ` · ${order.items.length} item${order.items.length === 1 ? "" : "s"}` : ""}`} icon="receipt-outline">
          <OrderDetailsBody order={order} language={language} />
        </Collapsible>
      </View>
    </Card>
  );
}

/** Compact card for queued deliveries after the current one. */
export function NextDeliveryCard({ order, language }: { order: DriverOrder; language: Language }) {
  const c = useColors();
  const step = getDriverStep(order);
  const earning = order.driver_compensation?.earning_amount;
  return (
    <Card>
      <Row gap={12} align="flex-start">
        <View style={[styles.nextIcon, { backgroundColor: withAlpha(c.primary, 0.1) }]}>
          <Ionicons name="cube-outline" size={18} color={c.primary} />
        </View>
        <View style={[styles.flex, styles.gap4]}>
          <Row justify="space-between" gap={8}>
            <AppText variant="label" style={styles.tabular}>{order.code}</AppText>
            <Badge tone="info">{STEP_SHORT_LABEL[step]}</Badge>
          </Row>
          <AppText variant="small" numberOfLines={1}>{order.market?.name || "Direct order"}</AppText>
          <AppText variant="caption" numberOfLines={1}>{`To: ${order.dropoff_address || "No address set"}`}</AppText>
          {earning != null ? <AppText variant="caption" tone="success">{formatMoney(earning, language)}</AppText> : null}
        </View>
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  gap4: { gap: 4 },
  gap8: { gap: 8 },
  gap12: { gap: 12 },
  gap16: { gap: 16 },
  mt2: { marginTop: 2 },
  mt4: { marginTop: 4 },
  tabular: { fontVariant: ["tabular-nums"] },
  eyebrow: { textTransform: "uppercase", letterSpacing: 0.6, fontWeight: "600" },
  stepCol: { flex: 1, alignItems: "center", gap: 6 },
  stepTrackRow: { flexDirection: "row", alignItems: "center", alignSelf: "stretch" },
  stepLine: { flex: 1, height: 2 },
  stepDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stepNumber: { fontSize: 12, fontWeight: "700" },
  stepLabel: { textAlign: "center", paddingHorizontal: 2 },
  instruction: { flexDirection: "row", gap: 12, borderWidth: 1, borderRadius: radius.xl, padding: 14, alignItems: "flex-start" },
  instructionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  mapWrap: { height: 240, borderRadius: radius.xl, borderWidth: 1, overflow: "hidden" },
  mapEmpty: { flex: 1, justifyContent: "center" },
  collapsible: { borderWidth: 1, borderRadius: radius.lg, overflow: "hidden" },
  collapsibleHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 12 },
  collapsibleBody: { paddingHorizontal: 12, paddingBottom: 12 },
  bigButton: { height: 56 },
  waitingBox: { height: 56, borderRadius: radius.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  nextIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
