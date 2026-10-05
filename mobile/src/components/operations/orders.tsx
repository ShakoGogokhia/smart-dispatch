/**
 * Order cards, timeline and the order detail sheet used by OrdersScreen.
 * Mirrors web `OrdersPage` (ops cards, customer cards, detail Sheet).
 */
import { Image, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  Alert,
  AppText,
  Badge,
  Button,
  Card,
  Chip,
  IconButton,
  Input,
  ListItem,
  Panel,
  Row,
  Separator,
  Sheet,
  Skeleton,
  StatusBadge,
  radius,
  useColors,
  withAlpha,
} from "@/src/components/ui";
import type { IconName } from "@/src/components/ui";
import { formatDateTime, formatMoney, type AppLanguage } from "@/src/lib/format";
import type { Order } from "@/src/types/api";

import { DetailGrid, DetailSection, DetailStat } from "./shared";

export function driverNameOf(order: Order) {
  return order.assigned_driver?.user?.name || order.offered_driver?.user?.name || null;
}

export function customerNameOf(order: Order) {
  return order.customer_name || order.customer?.name || "Unknown";
}

function itemsLabel(order: Order) {
  const count = order.items?.length ?? 0;
  return count ? `${count} item${count === 1 ? "" : "s"}` : null;
}

/** Vertical timeline with done / pending steps. */
export function OrderTimeline({ steps, language }: { steps: NonNullable<Order["timeline"]>; language: AppLanguage }) {
  const c = useColors();
  if (steps.length === 0) {
    return <AppText variant="small" tone="muted">No timeline events yet.</AppText>;
  }
  return (
    <View>
      {steps.map((step, index) => (
        <View key={step.key} style={styles.timelineItem}>
          {index < steps.length - 1 ? (
            <View style={[styles.timelineLine, { backgroundColor: step.done ? withAlpha(c.success, 0.5) : c.border }]} />
          ) : null}
          <View style={[styles.timelineDot, { backgroundColor: step.done ? withAlpha(c.success, 0.15) : c.muted }]}>
            <Ionicons name={step.done ? "checkmark-circle" : "ellipse-outline"} size={step.done ? 16 : 11} color={step.done ? c.success : c.mutedForeground} />
          </View>
          <View style={styles.timelineBody}>
            <AppText variant="label" tone={step.done ? "default" : "muted"} style={styles.flexShrink}>
              {step.label}
            </AppText>
            <AppText variant="caption">{step.done ? formatDateTime(step.at, language) : "Pending"}</AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

function RecordRow({ label, value }: { label: string; value: string }) {
  return (
    <Row justify="space-between" gap={12}>
      <AppText variant="small" tone="muted">
        {label}
      </AppText>
      <AppText variant="small" numberOfLines={1} style={styles.recordValue}>
        {value}
      </AppText>
    </Row>
  );
}

/** Staff / driver order card (web mobile order card + OrderActionRow). */
export function OpsOrderCard({
  order,
  language,
  canManage,
  pending,
  onOpenDetail,
  onAccept,
  onMarkReady,
  onMore,
}: {
  order: Order;
  language: AppLanguage;
  canManage: boolean;
  pending: boolean;
  onOpenDetail: () => void;
  onAccept: () => void;
  onMarkReady: () => void;
  onMore: () => void;
}) {
  const items = itemsLabel(order);
  return (
    <Card onPress={onOpenDetail}>
      <Row justify="space-between" align="flex-start" gap={12}>
        <View style={styles.flexShrink}>
          <AppText variant="heading" numberOfLines={1}>
            {order.code}
          </AppText>
          <AppText variant="caption">{formatDateTime(order.created_at, language)}</AppText>
        </View>
        <View style={styles.badgeColumn}>
          <StatusBadge status={order.status} />
          {order.eta_summary?.is_late ? <Badge tone="destructive">Late</Badge> : null}
        </View>
      </Row>

      <View style={styles.records}>
        <RecordRow label="Customer" value={customerNameOf(order)} />
        <RecordRow label="Address" value={order.dropoff_address || "No address set"} />
        <RecordRow label="Market" value={order.market?.name || "Direct order"} />
        <RecordRow
          label="Total"
          value={`${order.total != null ? formatMoney(order.total, language) : "-"}${items ? ` · ${items}` : ""}`}
        />
        <RecordRow label="Driver" value={driverNameOf(order) ?? "Unassigned"} />
        <RecordRow label="ETA" value={formatDateTime(order.eta_summary?.estimated_delivery_at, language)} />
      </View>

      <Row gap={8} style={styles.cardActions}>
        {canManage && order.status === "MARKET_PENDING" ? (
          <Button size="sm" icon="checkmark-circle-outline" onPress={onAccept} loading={pending}>
            Accept
          </Button>
        ) : null}
        {canManage && order.status === "MARKET_ACCEPTED" ? (
          <Button size="sm" icon="cube-outline" onPress={onMarkReady} loading={pending}>
            Mark ready
          </Button>
        ) : null}
        <Button size="sm" variant="outline" icon="eye-outline" onPress={onOpenDetail}>
          Open detail
        </Button>
        <View style={styles.flex} />
        <IconButton icon="ellipsis-horizontal" onPress={onMore} accessibilityLabel={`More actions for ${order.code}`} size={36} />
      </Row>
    </Card>
  );
}

/** Overflow menu for an ops order card. */
export function OrderActionsSheet({
  order,
  canManage,
  onClose,
  onOpenDetail,
  onAccept,
  onMarkReady,
}: {
  order: Order | null;
  canManage: boolean;
  onClose: () => void;
  onOpenDetail: () => void;
  onAccept: () => void;
  onMarkReady: () => void;
}) {
  return (
    <Sheet visible={order != null} title={order?.code ?? "Order"} description="Order actions" onClose={onClose}>
      <View>
        <ListItem icon="eye-outline" title="Open detail" onPress={onOpenDetail} />
        {canManage && order?.status === "MARKET_PENDING" ? <ListItem icon="checkmark-circle-outline" title="Accept order" onPress={onAccept} /> : null}
        {canManage && order?.status === "MARKET_ACCEPTED" ? <ListItem icon="cube-outline" title="Mark ready for pickup" onPress={onMarkReady} /> : null}
      </View>
    </Sheet>
  );
}

/** Customer-friendly order card with progress steps (web CustomerOrderCard). */
export function CustomerOrderCard({
  order,
  language,
  onOpenDetail,
  onTrack,
  onReorder,
  onCancel,
  reorderPending,
}: {
  order: Order;
  language: AppLanguage;
  onOpenDetail: () => void;
  onTrack: () => void;
  onReorder: () => void;
  onCancel: () => void;
  reorderPending: boolean;
}) {
  const c = useColors();
  const steps = order.timeline ?? [];
  const doneSteps = steps.filter((step) => step.done).length;

  return (
    <Card>
      <Row justify="space-between" align="flex-start" gap={12}>
        <View style={styles.flexShrink}>
          <AppText variant="caption" numberOfLines={1}>
            {order.market?.name || order.market?.code || "Order"}
          </AppText>
          <AppText variant="heading" numberOfLines={1}>
            {order.code}
          </AppText>
          <AppText variant="small" tone="muted" numberOfLines={1}>
            {order.dropoff_address || "No address set"}
          </AppText>
        </View>
        <View style={styles.badgeColumn}>
          <StatusBadge status={order.status} />
          {order.eta_summary?.is_late ? <Badge tone="destructive">Late</Badge> : null}
        </View>
      </Row>

      <DetailGrid>
        <DetailStat icon="time-outline" label="Created" value={formatDateTime(order.created_at, language)} />
        <DetailStat icon="storefront-outline" label="Market" value={order.market?.name || "-"} />
        <DetailStat icon="car-outline" label="Driver" value={driverNameOf(order) || "Waiting for driver"} />
        <DetailStat icon="navigate-outline" label="ETA" value={formatDateTime(order.eta_summary?.estimated_delivery_at, language)} />
      </DetailGrid>

      {steps.length > 0 ? (
        <View style={styles.progressBlock}>
          <Row justify="space-between">
            <AppText variant="caption">Progress</AppText>
            <AppText variant="caption">
              {doneSteps} of {steps.length} steps
            </AppText>
          </Row>
          {steps.slice(0, 3).map((step) => (
            <View key={step.key} style={[styles.stepRow, { borderColor: c.border, backgroundColor: withAlpha(c.muted, 0.5) }]}>
              <Row gap={8} style={styles.flexShrink}>
                <Ionicons name={step.done ? "checkmark-circle" : "ellipse-outline"} size={16} color={step.done ? c.success : c.mutedForeground} />
                <AppText variant="label" numberOfLines={1} style={styles.flexShrink}>
                  {step.label}
                </AppText>
              </Row>
              <AppText variant="caption">{formatDateTime(step.at, language)}</AppText>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[styles.customerFooter, { borderTopColor: c.border }]}>
        <Button size="sm" icon="navigate-outline" onPress={onTrack}>
          Track
        </Button>
        <Button size="sm" variant="outline" icon="eye-outline" onPress={onOpenDetail}>
          Details
        </Button>
        <Button size="sm" variant="outline" icon="refresh-outline" onPress={onReorder} disabled={!order.actions?.can_reorder} loading={reorderPending}>
          Reorder
        </Button>
        <Button size="sm" variant="ghost" icon="close-circle-outline" onPress={onCancel} disabled={!order.actions?.can_cancel}>
          Cancel
        </Button>
      </View>
    </Card>
  );
}

/** Order detail bottom sheet (web detail Sheet). */
export function OrderDetailSheet({
  visible,
  order,
  isLoading,
  isError,
  language,
  isCustomerOnly,
  canManage,
  marketPending,
  onClose,
  onAccept,
  onMarkReady,
  onTrack,
  rating,
  setRating,
  feedback,
  setFeedback,
  onRate,
  ratePending,
  reason,
  setReason,
  refundReason,
  setRefundReason,
  onReorder,
  reorderPending,
  onRefund,
  refundPending,
  onCancel,
  cancelPending,
}: {
  visible: boolean;
  order?: Order | null;
  isLoading: boolean;
  isError: boolean;
  language: AppLanguage;
  isCustomerOnly: boolean;
  canManage: boolean;
  marketPending: boolean;
  onClose: () => void;
  onAccept: () => void;
  onMarkReady: () => void;
  onTrack: () => void;
  rating: string;
  setRating: (value: string) => void;
  feedback: string;
  setFeedback: (value: string) => void;
  onRate: () => void;
  ratePending: boolean;
  reason: string;
  setReason: (value: string) => void;
  refundReason: string;
  setRefundReason: (value: string) => void;
  onReorder: () => void;
  reorderPending: boolean;
  onRefund: () => void;
  refundPending: boolean;
  onCancel: () => void;
  cancelPending: boolean;
}) {
  const c = useColors();

  return (
    <Sheet
      visible={visible}
      title={order?.code || "Order detail"}
      description={order ? order.dropoff_address || "No address set" : isLoading ? "Loading order..." : undefined}
      onClose={onClose}
      footer={
        <>
          {order && isCustomerOnly ? (
            <Button variant="outline" icon="navigate-outline" onPress={onTrack} style={styles.flex}>
              Track order
            </Button>
          ) : null}
          <Button variant="secondary" onPress={onClose} style={styles.flex}>
            Close
          </Button>
        </>
      }
    >
      {order ? (
        <>
          <Row gap={6} wrap>
            <StatusBadge status={order.status} />
            <Badge>{order.total != null ? formatMoney(order.total, language) : "-"}</Badge>
            {order.eta_summary?.is_late ? <Badge tone="destructive">Late</Badge> : null}
            {order.market?.code ? <Badge variant="outline">{order.market.code}</Badge> : null}
          </Row>

          {order.eta_summary?.is_late ? (
            <Alert tone="destructive" title="This order needs attention." description="ETA has slipped past the expected window." />
          ) : null}

          <DetailGrid>
            <DetailStat icon="time-outline" label="ETA" value={formatDateTime(order.eta_summary?.estimated_delivery_at, language)} strong />
            <DetailStat icon="wallet-outline" label="Total" value={order.total != null ? formatMoney(order.total, language) : "-"} strong />
            <DetailStat icon="car-outline" label="Driver" value={driverNameOf(order) || "Waiting for driver"} strong />
            <DetailStat icon="person-outline" label="Customer" value={customerNameOf(order)} strong />
          </DetailGrid>

          {canManage && (order.status === "MARKET_PENDING" || order.status === "MARKET_ACCEPTED") ? (
            <Row gap={8} wrap>
              {order.status === "MARKET_PENDING" ? (
                <Button icon="checkmark-circle-outline" onPress={onAccept} loading={marketPending}>
                  Accept order
                </Button>
              ) : (
                <Button icon="cube-outline" onPress={onMarkReady} loading={marketPending}>
                  Mark ready for pickup
                </Button>
              )}
            </Row>
          ) : null}

          <DetailSection title="Order progress">
            <OrderTimeline steps={order.timeline ?? []} language={language} />
          </DetailSection>

          <DetailSection title="Delivery details">
            <Panel>
              <DetailLine icon="storefront-outline" label="Market" value={order.market?.name || "Direct order"} />
              <DetailLine icon="time-outline" label="Created" value={formatDateTime(order.created_at, language)} />
              <DetailLine icon="flag-outline" label="Promised" value={formatDateTime(order.eta_summary?.promised_at, language)} />
              <DetailLine icon="location-outline" label="Dropoff" value={order.dropoff_address || "No address set"} />
              <DetailLine icon="location-outline" label="Pickup" value={order.pickup_address || "No address set"} />
              <DetailLine icon="chatbox-ellipses-outline" label="Notes" value={order.notes || "-"} />
            </Panel>
          </DetailSection>

          <DetailSection title="Receipt" description={order.receipt?.number || "Pending receipt"} icon="receipt-outline">
            <View style={styles.receipt}>
              {(order.receipt?.items ?? []).map((item, index) => (
                <Row key={`${item.name}-${index}`} justify="space-between" align="flex-start" gap={12}>
                  <AppText variant="small" style={styles.flexShrink}>
                    {item.name} <AppText variant="small" tone="muted">x{item.qty}</AppText>
                  </AppText>
                  <AppText variant="small" style={styles.tabular}>
                    {formatMoney(item.line_total ?? 0, language)}
                  </AppText>
                </Row>
              ))}
              <Separator />
              <Row justify="space-between">
                <AppText variant="label" style={styles.semibold}>
                  Total
                </AppText>
                <AppText variant="label" style={[styles.semibold, styles.tabular]}>
                  {formatMoney(order.receipt?.total ?? order.total ?? 0, language)}
                </AppText>
              </Row>
              <AppText variant="caption">Refund: {order.refund_summary?.status || "none"}</AppText>
            </View>
          </DetailSection>

          <DetailSection title="Delivery proof">
            {order.delivery_proof?.photo_url ? (
              <Image source={{ uri: order.delivery_proof.photo_url }} resizeMode="cover" style={[styles.proofImage, { borderColor: c.border, backgroundColor: c.muted }]} />
            ) : null}
            <Panel>
              <AppText variant="small">
                {order.delivery_proof?.note || "No delivery proof has been attached yet."}
                {order.delivery_proof?.signature_name ? ` | Signature: ${order.delivery_proof.signature_name}` : ""}
              </AppText>
            </Panel>
          </DetailSection>

          <DetailSection title="Rate delivery" description="Available once the order has been delivered." icon="star-outline">
            <Row gap={6} wrap>
              {["5", "4", "3", "2", "1"].map((value) => (
                <Chip key={value} label={`${value} / 5`} icon="star" selected={rating === value} onPress={() => setRating(value)} />
              ))}
            </Row>
            <Input label="Feedback" value={feedback} onChangeText={setFeedback} placeholder="How did it go?" />
            <Button icon="star-outline" onPress={onRate} disabled={!order.actions?.can_rate} loading={ratePending} style={styles.selfStart}>
              Submit rating
            </Button>
          </DetailSection>

          <DetailSection title="Order changes" description="Buttons are enabled when the action is allowed for this order.">
            <Input label="Cancellation reason" value={reason} onChangeText={setReason} placeholder="Optional" />
            <Input label="Refund reason" value={refundReason} onChangeText={setRefundReason} placeholder='Defaults to "Requested by customer"' />
            <Row gap={8} wrap>
              <Button variant="outline" icon="refresh-outline" onPress={onReorder} disabled={!order.actions?.can_reorder} loading={reorderPending}>
                Reorder
              </Button>
              <Button variant="outline" icon="wallet-outline" onPress={onRefund} disabled={!order.actions?.can_request_refund} loading={refundPending}>
                Request refund
              </Button>
              <Button variant="destructive" icon="close-circle-outline" onPress={onCancel} disabled={!order.actions?.can_cancel} loading={cancelPending}>
                Cancel order
              </Button>
            </Row>
          </DetailSection>
        </>
      ) : isError ? (
        <Alert tone="destructive" title="Could not load this order" description="Close the panel and try again." />
      ) : (
        <View style={styles.skeletons}>
          <Row gap={8}>
            <Skeleton height={60} width="48%" />
            <Skeleton height={60} width="48%" />
          </Row>
          <Skeleton height={140} />
          <Skeleton height={100} />
        </View>
      )}
    </Sheet>
  );
}

function DetailLine({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const c = useColors();
  return (
    <Row gap={10} align="flex-start">
      <Ionicons name={icon} size={15} color={c.mutedForeground} style={styles.mt2} />
      <View style={styles.flexShrink}>
        <AppText variant="caption">{label}</AppText>
        <AppText variant="small">{value}</AppText>
      </View>
    </Row>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1, flexGrow: 1 },
  semibold: { fontWeight: "600" },
  tabular: { fontVariant: ["tabular-nums"] },
  mt2: { marginTop: 2 },
  selfStart: { alignSelf: "flex-start" },
  badgeColumn: { alignItems: "flex-end", gap: 4 },
  records: { gap: 6 },
  recordValue: { flexShrink: 1, textAlign: "right" },
  cardActions: { marginTop: 2 },
  progressBlock: { gap: 6 },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  customerFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
  timelineItem: { flexDirection: "row", gap: 10, paddingBottom: 14 },
  timelineLine: { position: "absolute", left: 11, top: 24, bottom: 0, width: 1 },
  timelineDot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  timelineBody: { flex: 1, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 6, minHeight: 24 },
  receipt: { gap: 8 },
  proofImage: { width: "100%", height: 200, borderRadius: radius.lg, borderWidth: 1 },
  skeletons: { gap: 10 },
});
