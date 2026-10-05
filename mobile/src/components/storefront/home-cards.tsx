import { Pressable, StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppText, Badge, Row, Skeleton, radius, toneColors, useColors, type Tone } from "@/src/components/ui";
import { formatMoney, toNumber } from "@/src/lib/format";
import { usePreferences } from "@/src/providers/app-providers";

import { MediaImage, RatingInline } from "./common";
import {
  calcItemFinalPrice,
  formatMarketHours,
  formatPromoLabel,
  getItemImageUrls,
  getMarketBannerUrl,
  isMarketOpen,
  marketStatusLabel,
  resolveMarketMediaUrl,
  type DiscoveryItem,
  type StorefrontMarket,
} from "./utils";

function badgeToneFor(market: StorefrontMarket): Tone {
  const tone = market.featured_theme?.tone;
  if (tone === "amber") return "warning";
  if (tone === "cyan") return "info";
  if (tone === "emerald") return "success";
  if (tone === "rose") return "destructive";
  const value = (market.featured_badge ?? "").toLowerCase();
  if (value.includes("vip")) return "warning";
  if (value.includes("new")) return "info";
  if (value.includes("staff")) return "primary";
  return "neutral";
}

/** Market card: banner + overlapping logo, name/code, address, rating, open/closed, hours, preview thumbs. */
export function MarketCard({ market, onPress, style }: { market: StorefrontMarket; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const { language } = usePreferences();
  const previewItems = (market.item_preview ?? []).slice(0, 3);
  const totalItems = Number(market.active_items_count ?? previewItems.length);
  const remainingItems = Math.max(totalItems - previewItems.length, 0);
  const reviewAverage = market.review_summary?.average ?? 0;
  const reviewCount = market.review_summary?.count ?? 0;
  const open = isMarketOpen(market);
  const hoursLabel = formatMarketHours(market);
  const blurb = market.featured_headline || market.featured_copy;
  const promoLabel = formatPromoLabel(market.active_promo, language);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${market.name}${open ? "" : " (closed)"}`}
      style={({ pressed }) => [styles.card, { backgroundColor: c.card, borderColor: c.border, shadowColor: c.shadow }, pressed && styles.pressed, style]}
    >
      <View>
        <MediaImage uri={getMarketBannerUrl(market)} style={styles.banner} dimmed={!open} iconSize={30} />
        {!open ? (
          <View style={[styles.closedStrip, { backgroundColor: c.background }]}>
            <AppText variant="caption" tone="default" numberOfLines={1} style={styles.medium}>
              Closed{hoursLabel ? ` · ${hoursLabel}` : ""}
            </AppText>
          </View>
        ) : null}
        <View style={styles.bannerBadges} pointerEvents="none">
          <Row gap={6} wrap style={styles.flexShrink}>
            {market.is_featured ? <Badge variant="outline">Featured</Badge> : null}
            {promoLabel ? (
              <Badge tone="primary" variant="solid" icon="pricetag-outline">
                {promoLabel}
              </Badge>
            ) : null}
          </Row>
          {market.featured_badge ? (
            <Badge tone={badgeToneFor(market)} variant="solid">
              {market.featured_badge}
            </Badge>
          ) : null}
        </View>
        <View style={[styles.logoWrap, { backgroundColor: c.card, borderColor: c.card }]}>
          <MediaImage uri={resolveMarketMediaUrl(market.logo_url)} style={styles.logo} iconSize={20} />
        </View>
      </View>

      <View style={[styles.body, !open && styles.dim]}>
        <View>
          <Row justify="space-between" align="baseline" gap={8}>
            <AppText variant="heading" numberOfLines={1} style={styles.flexShrink}>
              {market.name}
            </AppText>
            <Text style={[styles.code, { color: c.mutedForeground }]}>{market.code}</Text>
          </Row>
          <Row gap={4} style={styles.mt2}>
            <Ionicons name="location-outline" size={13} color={c.mutedForeground} />
            <AppText variant="small" tone="muted" numberOfLines={1} style={styles.flexShrink}>
              {market.address || "Marketplace location"}
            </AppText>
          </Row>
          {blurb ? (
            <AppText variant="caption" numberOfLines={1} style={styles.mt2}>
              {blurb}
            </AppText>
          ) : null}
        </View>

        <Row gap={10} wrap>
          <RatingInline value={reviewAverage} count={reviewCount} />
          <Badge tone={open ? "success" : "destructive"} dot>
            {marketStatusLabel(market)}
          </Badge>
          <AppText variant="small" tone="muted">
            {market.active_items_count ?? 0} items
          </AppText>
        </Row>

        {open && hoursLabel ? (
          <Row gap={4}>
            <Ionicons name="time-outline" size={13} color={c.mutedForeground} />
            <AppText variant="caption" numberOfLines={1}>
              {hoursLabel}
            </AppText>
          </Row>
        ) : null}

        <View style={[styles.previewRow, { borderTopColor: c.border }]}>
          {previewItems.length > 0 ? (
            <>
              {previewItems.map((item) => {
                const finalPrice = calcItemFinalPrice(item);
                const discounted = Math.abs(finalPrice - toNumber(item.price)) > 0.01;
                return (
                  <View key={item.id} style={styles.previewItem}>
                    <MediaImage uri={getItemImageUrls(item)[0]} style={styles.previewThumb} iconSize={14} />
                    <View style={styles.flexShrink}>
                      <AppText variant="caption" numberOfLines={1}>
                        {item.name}
                      </AppText>
                      <Text numberOfLines={1} style={[styles.previewPrice, { color: c.foreground }]}>
                        {formatMoney(finalPrice, language)}
                        {discounted ? <Text style={[styles.strike, { color: c.mutedForeground }]}> {formatMoney(item.price, language)}</Text> : null}
                      </Text>
                    </View>
                  </View>
                );
              })}
              {remainingItems > 0 ? <AppText variant="caption">+{remainingItems}</AppText> : null}
            </>
          ) : (
            <AppText variant="caption">No preview items available.</AppText>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export function MarketCardSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, style]}>
      <Skeleton height={150} style={styles.noRadius} />
      <View style={styles.body}>
        <Skeleton height={16} width="65%" />
        <Skeleton height={13} width="45%" />
        <Skeleton height={30} />
      </View>
    </View>
  );
}

/** Discovery product card (home rails): square image, deal/combo badges, name, market, price, rating. */
export function DiscoveryProductCard({ item, onPress, style }: { item: DiscoveryItem; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const { language } = usePreferences();
  const reviewAverage = item.review_summary?.average ?? 0;
  const reviewCount = item.review_summary?.count ?? 0;
  const comboCount = item.combo_offers?.length ?? 0;
  const basePrice = toNumber(item.price);
  const finalPrice = calcItemFinalPrice(item);
  const discounted = Math.abs(basePrice - finalPrice) > 0.01;
  const hasDeal = discounted || (!!item.discount_type && item.discount_type !== "none");
  const marketOpen = item.market?.operating_status?.is_open ?? item.market?.is_active ?? true;
  const info = toneColors(c, "info");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${item.name} at ${item.market?.name ?? "market"}${marketOpen ? "" : " (closed)"}`}
      style={({ pressed }) => [styles.card, { backgroundColor: c.card, borderColor: c.border, shadowColor: c.shadow }, pressed && styles.pressed, style]}
    >
      <View>
        <MediaImage uri={getItemImageUrls(item)[0]} style={styles.square} icon="cube-outline" dimmed={!marketOpen} />
        <View style={styles.productBadges} pointerEvents="none">
          {hasDeal ? (
            <Badge tone="destructive" variant="solid">
              Deal
            </Badge>
          ) : null}
          {comboCount > 0 ? (
            <View style={[styles.solidChip, { backgroundColor: info.solid }]}>
              <Text style={[styles.solidChipText, { color: info.solidFg }]}>
                {comboCount} combo{comboCount === 1 ? "" : "s"}
              </Text>
            </View>
          ) : null}
          {item.is_promoted ? (
            <View style={[styles.solidChip, { backgroundColor: c.foreground }]}>
              <Text style={[styles.solidChipText, { color: c.background }]}>Promoted</Text>
            </View>
          ) : null}
        </View>
        {!marketOpen ? (
          <View style={[styles.closedStripSmall, { backgroundColor: c.background }]}>
            <AppText variant="caption" tone="default" style={styles.medium}>
              Market closed
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.productBody}>
        <AppText variant="label" numberOfLines={1} style={styles.semibold}>
          {item.name}
        </AppText>
        <Row gap={4}>
          <Ionicons name="storefront-outline" size={12} color={c.mutedForeground} />
          <AppText variant="caption" numberOfLines={1} style={styles.flexShrink}>
            {item.market?.name ?? "Market item"}
          </AppText>
        </Row>
        <Row gap={6} align="baseline" wrap>
          <Text style={[styles.price, { color: c.foreground }]}>{formatMoney(finalPrice, language)}</Text>
          {discounted ? <Text style={[styles.strikeSmall, { color: c.mutedForeground }]}>{formatMoney(basePrice, language)}</Text> : null}
        </Row>
        <Row gap={6} wrap>
          <RatingInline value={reviewCount ? reviewAverage : 0} count={reviewCount} size="sm" />
          <AppText variant="caption" numberOfLines={1} style={styles.flexShrink}>
            · {item.category || "General"}
            {item.ordered_qty ? ` · ${item.ordered_qty} ordered` : ""}
          </AppText>
        </Row>
      </View>
    </Pressable>
  );
}

export function DiscoveryProductCardSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, style]}>
      <Skeleton height={150} style={styles.noRadius} />
      <View style={styles.productBody}>
        <Skeleton height={14} width="75%" />
        <Skeleton height={12} width="50%" />
        <Skeleton height={14} width="35%" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flexShrink: { flexShrink: 1 },
  mt2: { marginTop: 2 },
  medium: { fontWeight: "500" },
  semibold: { fontWeight: "600" },
  pressed: { opacity: 0.85 },
  dim: { opacity: 0.8 },
  noRadius: { borderRadius: 0 },
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: "hidden",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  banner: { width: "100%", aspectRatio: 16 / 9 },
  closedStrip: { position: "absolute", left: 0, right: 0, bottom: 0, paddingVertical: 5, paddingLeft: 84, paddingRight: 12, opacity: 0.92 },
  closedStripSmall: { position: "absolute", left: 0, right: 0, bottom: 0, paddingVertical: 4, paddingHorizontal: 10, opacity: 0.92 },
  bannerBadges: { position: "absolute", top: 8, left: 8, right: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  logoWrap: { position: "absolute", left: 16, bottom: -24, borderRadius: 14, borderWidth: 4, overflow: "hidden" },
  logo: { width: 52, height: 52, borderRadius: 10 },
  body: { paddingHorizontal: 16, paddingTop: 32, paddingBottom: 16, gap: 10 },
  code: { fontSize: 11, fontFamily: "monospace" },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: StyleSheet.hairlineWidth * 2, paddingTop: 12 },
  previewItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 },
  previewThumb: { width: 32, height: 32, borderRadius: radius.sm },
  previewPrice: { fontSize: 12, fontWeight: "500", fontVariant: ["tabular-nums"] },
  strike: { fontWeight: "400", textDecorationLine: "line-through" },
  square: { width: "100%", aspectRatio: 1 },
  productBadges: { position: "absolute", top: 8, left: 8, right: 8, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  solidChip: { borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 2 },
  solidChipText: { fontSize: 12, fontWeight: "500" },
  productBody: { padding: 12, gap: 6 },
  price: { fontSize: 15, fontWeight: "600", fontVariant: ["tabular-nums"] },
  strikeSmall: { fontSize: 12, textDecorationLine: "line-through", fontVariant: ["tabular-nums"] },
});
