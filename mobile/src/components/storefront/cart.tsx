import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { AppText, Button, EmptyState, Row, Separator, Sheet, radius, useColors, withAlpha } from "@/src/components/ui";
import { formatMoney } from "@/src/lib/format";
import type { CartItem } from "@/src/lib/storage";
import { usePreferences } from "@/src/providers/app-providers";

import { MediaImage, QtyStepper, SummaryRow } from "./common";
import { formatPromoLabel } from "./utils";

export type CartTotals = { quantity: number; subtotal: number };

export function CartLines({
  cart,
  onChangeQty,
  imageFor,
}: {
  cart: CartItem[];
  onChangeQty: (itemId: number, delta: number) => void;
  imageFor?: (itemId: number) => string | null | undefined;
}) {
  const { language } = usePreferences();
  return (
    <View>
      {cart.map((line, index) => (
        <View key={line.item_id}>
          {index > 0 ? <Separator style={styles.lineSep} /> : null}
          <View style={styles.line}>
            <MediaImage uri={imageFor?.(line.item_id)} style={styles.thumb} icon="bag-handle-outline" iconSize={18} />
            <View style={styles.flex}>
              <Row justify="space-between" align="flex-start" gap={8}>
                <View style={styles.flex}>
                  <AppText variant="label" numberOfLines={2}>
                    {line.name}
                  </AppText>
                  <AppText variant="caption" style={styles.tabular}>
                    {formatMoney(line.price, language)} each
                  </AppText>
                </View>
                <AppText variant="label" style={[styles.semibold, styles.tabular]}>
                  {formatMoney(line.price * line.qty, language)}
                </AppText>
              </Row>
              <Row justify="space-between" gap={8} style={styles.mt8}>
                <QtyStepper qty={line.qty} size="sm" label={line.name} onDecrease={() => onChangeQty(line.item_id, -1)} onIncrease={() => onChangeQty(line.item_id, 1)} />
                <Button variant="ghost" size="sm" icon="trash-outline" onPress={() => onChangeQty(line.item_id, -line.qty)}>
                  Remove
                </Button>
              </Row>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

export function CartPromoNote({ promo }: { promo?: Parameters<typeof formatPromoLabel>[0] }) {
  const c = useColors();
  const { language } = usePreferences();
  if (!promo?.code) return null;
  return (
    <View style={[styles.promo, { borderColor: withAlpha(c.primary, 0.2), backgroundColor: withAlpha(c.primary, 0.05) }]}>
      <Ionicons name="pricetag-outline" size={14} color={c.primary} style={styles.mt2} />
      <AppText variant="caption" tone="default" style={styles.flex}>
        Use code <Text style={styles.mono}>{promo.code}</Text> at checkout ({formatPromoLabel(promo, language)?.split(" · ")[1]}).
      </AppText>
    </View>
  );
}

export function CartSheet({
  visible,
  onClose,
  cart,
  totals,
  marketName,
  promo,
  onChangeQty,
  imageFor,
  onCheckout,
  onClear,
}: {
  visible: boolean;
  onClose: () => void;
  cart: CartItem[];
  totals: CartTotals;
  marketName?: string;
  promo?: Parameters<typeof formatPromoLabel>[0];
  onChangeQty: (itemId: number, delta: number) => void;
  imageFor?: (itemId: number) => string | null | undefined;
  onCheckout: () => void;
  onClear: () => void;
}) {
  const { language } = usePreferences();
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Your cart"
      description={
        totals.quantity > 0
          ? `${totals.quantity} item${totals.quantity === 1 ? "" : "s"} from ${marketName ?? "this market"}`
          : "Items you add will appear here."
      }
      footer={
        <View style={styles.footer}>
          <CartPromoNote promo={promo} />
          <View style={styles.gap6}>
            <SummaryRow label={`Subtotal · ${totals.quantity} item${totals.quantity === 1 ? "" : "s"}`} value={formatMoney(totals.subtotal, language)} />
            <SummaryRow label="Delivery fee and promo discounts" value="At checkout" valueTone="muted" />
            <Separator style={styles.sep} />
            <SummaryRow label="Total" value={formatMoney(totals.subtotal, language)} strong />
          </View>
          <Button size="lg" fullWidth onPress={onCheckout} disabled={totals.quantity === 0} iconRight="arrow-forward">
            Checkout
          </Button>
          <Button variant="ghost" size="sm" fullWidth onPress={onClear} disabled={totals.quantity === 0}>
            Clear cart
          </Button>
        </View>
      }
    >
      {cart.length > 0 ? (
        <CartLines cart={cart} onChangeQty={onChangeQty} imageFor={imageFor} />
      ) : (
        <EmptyState compact icon="bag-handle-outline" title="Your cart is empty" description="Add items from the menu to start your order." />
      )}
    </Sheet>
  );
}

/** Sticky "View cart · N items · $total" bar for the Screen footer slot. */
export function ViewCartBar({ totals, onPress }: { totals: CartTotals; onPress: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { language } = usePreferences();
  return (
    <View style={[styles.bar, { backgroundColor: c.background, borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="View cart"
        style={({ pressed }) => [styles.barButton, { backgroundColor: c.primary }, pressed && styles.pressed]}
      >
        <Row gap={8}>
          <Ionicons name="bag-handle-outline" size={18} color={c.primaryForeground} />
          <Text style={[styles.barText, { color: c.primaryForeground }]}>View cart</Text>
        </Row>
        <Text style={[styles.barText, styles.tabular, { color: c.primaryForeground }]}>
          {totals.quantity} item{totals.quantity === 1 ? "" : "s"} · {formatMoney(totals.subtotal, language)}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mt2: { marginTop: 2 },
  mt8: { marginTop: 8 },
  gap6: { gap: 6 },
  semibold: { fontWeight: "600" },
  tabular: { fontVariant: ["tabular-nums"] },
  mono: { fontFamily: "monospace", fontWeight: "600" },
  pressed: { opacity: 0.85 },
  line: { flexDirection: "row", gap: 12 },
  lineSep: { marginVertical: 12 },
  thumb: { width: 48, height: 48, borderRadius: radius.md },
  promo: { flexDirection: "row", gap: 8, borderWidth: 1, borderRadius: radius.lg, padding: 10 },
  footer: { flex: 1, gap: 10 },
  sep: { marginVertical: 4 },
  bar: { borderTopWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 16, paddingTop: 12 },
  barButton: { height: 48, borderRadius: radius.md, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  barText: { fontSize: 15, fontWeight: "500" },
});
