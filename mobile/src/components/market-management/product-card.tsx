import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { AppText, Badge, Button, Card, Panel, Row, useColors } from "@/src/components/ui";
import { usePreferences } from "@/src/providers/app-providers";
import { formatMoney } from "@/src/lib/format";
import type { Item } from "@/src/types/api";

import { computeFinalPrice, describeDiscount, getItemImageUrls, getStockState, hasDiscount, summarizeExtras, type StockState } from "./helpers";

export function StockBadge({ state }: { state: StockState }) {
  if (state === "out") return <Badge tone="destructive" dot>Out of stock</Badge>;
  if (state === "low") return <Badge tone="warning" dot>Low stock</Badge>;
  return <Badge tone="success" dot>In stock</Badge>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Hidden</Badge>;
}

export function ItemThumb({ item, size = 56 }: { item: Item; size?: number }) {
  const c = useColors();
  const url = getItemImageUrls(item)[0];
  return (
    <View style={[styles.thumb, { width: size, height: size, backgroundColor: c.muted, borderColor: c.border }]}>
      {url ? (
        <Image source={url} style={styles.fill} contentFit="cover" />
      ) : (
        <Ionicons name="image-outline" size={18} color={c.mutedForeground} />
      )}
    </View>
  );
}

export function ProductCard({ item, onEdit, onMore }: { item: Item; onEdit: () => void; onMore: () => void }) {
  const c = useColors();
  const { language } = usePreferences();
  const discounted = hasDiscount(item);
  const finalPrice = computeFinalPrice(item.price, item.discount_type, item.discount_value);
  const { scheduleLabel, extrasLabel } = summarizeExtras(item);
  const reviews = item.review_summary;

  return (
    <Card>
      <Row align="flex-start" gap={12}>
        <ItemThumb item={item} />
        <View style={styles.flex}>
          <Row justify="space-between" align="flex-start" gap={8}>
            <AppText variant="label" numberOfLines={1} style={styles.flex}>
              {item.name}
            </AppText>
            <ActiveBadge active={item.is_active} />
          </Row>
          <AppText variant="caption" numberOfLines={1}>
            {item.sku} · #{item.id} · {item.category || "No category"}
            {item.item_kind === "combo" ? " · Combo" : ""}
          </AppText>
          <Row gap={6} align="flex-end" style={styles.mt6}>
            <AppText variant="heading">{formatMoney(discounted ? finalPrice : item.price, language)}</AppText>
            {discounted ? (
              <AppText variant="caption" style={styles.strike}>
                {formatMoney(item.price, language)}
              </AppText>
            ) : null}
          </Row>
          <AppText variant="caption" tone={discounted ? "success" : "muted"}>
            {describeDiscount(item)}
          </AppText>
        </View>
      </Row>

      <Panel>
        <Row justify="space-between" gap={8}>
          <Row gap={8}>
            <AppText variant="label">{String(item.stock_qty)}</AppText>
            <AppText variant="caption">in stock</AppText>
          </Row>
          <StockBadge state={getStockState(item)} />
        </Row>
        <Row gap={6}>
          <Ionicons name="time-outline" size={13} color={c.mutedForeground} />
          <AppText variant="caption">{scheduleLabel}</AppText>
        </Row>
        <AppText variant="caption" numberOfLines={2}>
          {extrasLabel}
        </AppText>
        {item.item_kind === "combo" && (item.combo_offers?.[0]?.items ?? []).length > 0 ? (
          <AppText variant="caption" numberOfLines={2}>
            Includes: {(item.combo_offers?.[0]?.items ?? []).map((comboItem) => comboItem.name).join(", ")}
          </AppText>
        ) : null}
        {reviews?.count ? (
          <Row gap={4}>
            <Ionicons name="star" size={13} color={c.warning} />
            <AppText variant="small">{String(reviews.average ?? "-")}</AppText>
            <AppText variant="caption">({reviews.count})</AppText>
          </Row>
        ) : (
          <AppText variant="caption">No reviews</AppText>
        )}
      </Panel>

      <Row justify="flex-end" gap={8}>
        <Button variant="outline" size="sm" icon="create-outline" onPress={onEdit}>
          Edit
        </Button>
        <Button variant="ghost" size="sm" icon="ellipsis-horizontal" onPress={onMore} accessibilityLabel={`More actions for ${item.name}`}>
          More
        </Button>
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: "100%", height: "100%" },
  mt6: { marginTop: 6 },
  strike: { textDecorationLine: "line-through", marginBottom: 2 },
  thumb: { borderRadius: 8, borderWidth: 1, overflow: "hidden", alignItems: "center", justifyContent: "center" },
});
