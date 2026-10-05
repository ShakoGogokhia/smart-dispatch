import { Pressable, StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppText, Badge, Button, Skeleton, radius, useColors } from "@/src/components/ui";
import { formatMoney, toNumber } from "@/src/lib/format";
import { usePreferences } from "@/src/providers/app-providers";

import { MediaImage, QtyStepper, RatingInline } from "./common";
import {
  calcItemFinalPrice,
  getComboIncludedItems,
  getComboRemovableCount,
  getItemImageUrls,
  getRemovableIngredients,
  itemNeedsDetails,
  type StorefrontItem,
} from "./utils";

function describeItem(item: StorefrontItem) {
  const parts: string[] = [];
  const ingredients = item.ingredients ?? [];
  const removableCount = getRemovableIngredients(item).length;
  const comboItems = getComboIncludedItems(item);
  const comboRemovableCount = getComboRemovableCount(item);
  const comboCount = item.combo_offers?.length ?? 0;

  if (item.item_kind === "combo" && comboItems.length > 0) {
    const names = comboItems.slice(0, 3).map((comboItem) => comboItem.name).join(", ");
    const more = comboItems.length > 3 ? ` +${comboItems.length - 3} more` : "";
    parts.push(`Includes ${comboItems.length} item${comboItems.length === 1 ? "" : "s"}: ${names}${more}`);
    if (comboRemovableCount > 0) parts.push(`${comboRemovableCount} removable in combo`);
  } else {
    if (ingredients.length > 0) parts.push(ingredients.map((ingredient) => ingredient.name).join(", "));
    if (removableCount > 0) parts.push(`${removableCount} removable`);
    if (comboCount > 0) parts.push(`${comboCount} combo deal${comboCount === 1 ? "" : "s"} available`);
  }

  return parts.join(" · ");
}

export function StockBadge({ item }: { item: StorefrontItem }) {
  const showStock = item.show_stock_quantity ?? true;
  if (item.stock_qty <= 0) return <Badge tone="destructive" dot>Out of stock</Badge>;
  if (item.is_low_stock) return <Badge tone="warning" dot>{`Low stock${showStock ? ` · ${item.stock_qty} left` : ""}`}</Badge>;
  if (showStock) return <Badge tone="success" dot>{`In stock · ${item.stock_qty}`}</Badge>;
  return null;
}

export function MarketProductCard({
  item,
  marketIsOpen,
  cartQty,
  canFavorite,
  isFavorite,
  onToggleFavorite,
  onOpen,
  onAdd,
  onChangeQty,
  style,
}: {
  item: StorefrontItem;
  marketIsOpen: boolean;
  cartQty: number;
  canFavorite: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onOpen: () => void;
  onAdd: () => void;
  onChangeQty: (delta: number) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const { language } = usePreferences();
  const imageUrls = getItemImageUrls(item);
  const finalPrice = calcItemFinalPrice(item);
  const discounted = Math.abs(toNumber(item.price) - finalPrice) > 0.01;
  const outOfStock = item.stock_qty <= 0;
  const needsDetails = itemNeedsDetails(item);
  const description = describeItem(item) || item.category || "";
  const addDisabled = outOfStock || !item.is_active || !marketIsOpen;
  const addLabel = !marketIsOpen ? "Closed" : outOfStock ? "Sold out" : needsDetails ? "Choose" : "Add";
  const isCombo = item.item_kind === "combo" || (item.combo_offers?.length ?? 0) > 0;

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, shadowColor: c.shadow }, style]}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`View ${item.name}`}>
        <MediaImage uri={imageUrls[0]} style={styles.image} dimmed={outOfStock} />
        <View style={styles.topBadges} pointerEvents="none">
          {discounted ? <Badge tone="destructive" variant="solid">Deal</Badge> : null}
          {isCombo ? <Badge variant="solid">{item.item_kind === "combo" ? "Combo" : "Combo deals"}</Badge> : null}
          {item.is_promoted ? <Badge tone="primary" variant="solid">Promoted</Badge> : null}
        </View>
        {imageUrls.length > 1 ? (
          <View style={[styles.photoCount, { backgroundColor: c.background }]} pointerEvents="none">
            <Ionicons name="images-outline" size={11} color={c.foreground} />
            <Text style={[styles.photoCountText, { color: c.foreground }]}>{imageUrls.length}</Text>
          </View>
        ) : null}
      </Pressable>
      {canFavorite ? (
        <Pressable
          onPress={onToggleFavorite}
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? "Remove from favorites" : "Add to favorites"}
          accessibilityState={{ selected: isFavorite }}
          hitSlop={6}
          style={[styles.heart, { backgroundColor: c.background, shadowColor: c.shadow }]}
        >
          <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={16} color={isFavorite ? c.destructive : c.mutedForeground} />
        </Pressable>
      ) : null}

      <View style={styles.body}>
        <Pressable onPress={onOpen} accessibilityRole="button" style={styles.gap4}>
          <AppText variant="label" numberOfLines={2} style={styles.title}>
            {item.name}
          </AppText>
          <RatingInline value={item.review_summary?.average ?? null} count={item.review_summary?.count ?? 0} size="sm" />
        </Pressable>
        {description ? (
          <AppText variant="caption" numberOfLines={2}>
            {description}
          </AppText>
        ) : null}
        <View style={styles.badges}>
          {!item.is_active ? <Badge variant="outline">Unavailable</Badge> : null}
          <StockBadge item={item} />
          {cartQty > 0 ? <Badge tone="primary">{`In cart ×${cartQty}`}</Badge> : null}
        </View>

        <View style={styles.footer}>
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: c.foreground }]}>{formatMoney(finalPrice, language)}</Text>
            {discounted ? <Text style={[styles.strike, { color: c.mutedForeground }]}>{formatMoney(item.price, language)}</Text> : null}
          </View>
          {cartQty > 0 && !addDisabled ? (
            <QtyStepper qty={cartQty} size="sm" label={item.name} onDecrease={() => onChangeQty(-1)} onIncrease={() => onChangeQty(1)} />
          ) : (
            <Button size="sm" onPress={onAdd} disabled={addDisabled} variant={needsDetails ? "outline" : "default"} icon={!addDisabled ? "add" : undefined} fullWidth>
              {addLabel}
            </Button>
          )}
        </View>
      </View>
    </View>
  );
}

export function MarketProductCardSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, style]}>
      <Skeleton height={110} style={styles.noRadius} />
      <View style={styles.body}>
        <Skeleton height={14} width="75%" />
        <Skeleton height={12} />
        <Skeleton height={32} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gap4: { gap: 4 },
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
  image: { width: "100%", aspectRatio: 4 / 3 },
  topBadges: { position: "absolute", top: 8, left: 8, right: 44, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  photoCount: { position: "absolute", right: 8, bottom: 8, flexDirection: "row", alignItems: "center", gap: 3, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2, opacity: 0.92 },
  photoCountText: { fontSize: 11, fontWeight: "500" },
  heart: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  body: { flex: 1, padding: 12, gap: 8 },
  title: { fontWeight: "600" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  footer: { marginTop: "auto", gap: 8 },
  priceRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 6 },
  price: { fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] },
  strike: { fontSize: 12, textDecorationLine: "line-through", fontVariant: ["tabular-nums"] },
});
