import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppText, Badge, Button, EmptyState, Panel, Row, Separator, Sheet, Skeleton, radius, useColors, withAlpha } from "@/src/components/ui";
import { formatMoney, toNumber } from "@/src/lib/format";
import { usePreferences } from "@/src/providers/app-providers";
import type { ReviewRecord } from "@/src/types/api";

import { MediaImage, QtyStepper, RatingInline, ReviewForm, ReviewListItem } from "./common";
import { StockBadge } from "./market-product-card";
import { calcItemFinalPrice, getComboIncludedItems, getRemovableIngredients, type StorefrontItem } from "./utils";

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <View>
      <AppText variant="label" style={styles.semibold}>
        {title}
      </AppText>
      {description ? <AppText variant="caption">{description}</AppText> : null}
    </View>
  );
}

export function ProductSheet({
  visible,
  onClose,
  item,
  imageUrls,
  imageIndex,
  onImageIndexChange,
  quantity,
  onQuantityChange,
  cartQty,
  marketIsOpen,
  onAddToCart,
  reviews,
  reviewsLoading,
  isLoggedIn,
  reviewRating,
  onReviewRatingChange,
  reviewComment,
  onReviewCommentChange,
  reviewError,
  reviewPending,
  onSubmitReview,
}: {
  visible: boolean;
  onClose: () => void;
  item: StorefrontItem | null;
  imageUrls: string[];
  imageIndex: number;
  onImageIndexChange: (index: number) => void;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  cartQty: number;
  marketIsOpen: boolean;
  onAddToCart: () => void;
  reviews?: ReviewRecord[];
  reviewsLoading: boolean;
  isLoggedIn: boolean;
  reviewRating: number;
  onReviewRatingChange: (value: number) => void;
  reviewComment: string;
  onReviewCommentChange: (value: string) => void;
  reviewError: string | null;
  reviewPending: boolean;
  onSubmitReview: () => void;
}) {
  const c = useColors();
  const { language } = usePreferences();
  const unitPrice = item ? calcItemFinalPrice(item) : 0;
  const discounted = item ? Math.abs(toNumber(item.price) - unitPrice) > 0.01 : false;
  const outOfStock = (item?.stock_qty ?? 0) <= 0;
  const addDisabled = !item || outOfStock || !item.is_active || !marketIsOpen;
  const removable = getRemovableIngredients(item);
  const comboItems = getComboIncludedItems(item);
  const comboOffers = item && item.item_kind !== "combo" ? item.combo_offers ?? [] : [];
  const ingredients = item?.item_kind === "combo" ? [] : item?.ingredients ?? [];
  const currentImage = imageUrls[imageIndex] ?? imageUrls[0];

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={item?.name || "Selected item"}
      description={item ? `${item.category ? `${item.category} · ` : ""}${item.sku}` : undefined}
      footer={
        item ? (
          <Row gap={10} style={styles.flex}>
            <QtyStepper qty={quantity} onDecrease={() => onQuantityChange(Math.max(1, quantity - 1))} decreaseDisabled={quantity <= 1} onIncrease={() => onQuantityChange(quantity + 1)} />
            <Button size="lg" onPress={onAddToCart} disabled={addDisabled} style={styles.flex}>
              {!marketIsOpen ? "Market closed" : outOfStock ? "Out of stock" : !item.is_active ? "Unavailable" : `Add to cart · ${formatMoney(unitPrice * quantity, language)}`}
            </Button>
          </Row>
        ) : undefined
      }
    >
      {item ? (
        <>
          {/* Gallery */}
          <View>
            <MediaImage uri={currentImage} style={[styles.hero, { borderColor: c.border }]} iconSize={48} />
            {imageUrls.length > 1 ? (
              <>
                <Pressable
                  onPress={() => onImageIndexChange(imageIndex === 0 ? imageUrls.length - 1 : imageIndex - 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Previous photo"
                  style={[styles.navButton, styles.navLeft, { backgroundColor: c.background }]}
                >
                  <Ionicons name="chevron-back" size={18} color={c.foreground} />
                </Pressable>
                <Pressable
                  onPress={() => onImageIndexChange(imageIndex === imageUrls.length - 1 ? 0 : imageIndex + 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Next photo"
                  style={[styles.navButton, styles.navRight, { backgroundColor: c.background }]}
                >
                  <Ionicons name="chevron-forward" size={18} color={c.foreground} />
                </Pressable>
              </>
            ) : null}
          </View>
          {imageUrls.length > 1 ? (
            <Row gap={8} wrap>
              {imageUrls.map((url, index) => (
                <Pressable
                  key={`${url}-${index}`}
                  onPress={() => onImageIndexChange(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Show photo ${index + 1}`}
                  style={[styles.thumbWrap, { borderColor: index === imageIndex ? c.primary : c.border, borderWidth: index === imageIndex ? 2 : 1 }]}
                >
                  <MediaImage uri={url} style={styles.thumb} />
                </Pressable>
              ))}
            </Row>
          ) : null}

          {/* Price + badges */}
          <View style={styles.gap8}>
            <Row gap={8} align="baseline" wrap>
              <Text style={[styles.price, { color: c.foreground }]}>{formatMoney(unitPrice, language)}</Text>
              {discounted ? <Text style={[styles.strike, { color: c.mutedForeground }]}>{formatMoney(item.price, language)}</Text> : null}
            </Row>
            <Row gap={6} wrap>
              <RatingInline value={item.review_summary?.average ?? null} count={item.review_summary?.count ?? 0} />
              {discounted ? <Badge tone="destructive" variant="solid">Deal</Badge> : null}
              {item.is_promoted ? <Badge tone="primary" variant="solid">Promoted</Badge> : null}
              {item.item_kind === "combo" ? <Badge variant="solid">Combo</Badge> : null}
              {!item.is_active ? <Badge variant="outline">Unavailable</Badge> : null}
              <StockBadge item={item} />
              {cartQty > 0 ? <Badge tone="primary">{`In cart ×${cartQty}`}</Badge> : null}
            </Row>
          </View>

          <Separator />

          {/* Ingredients */}
          {ingredients.length > 0 ? (
            <View style={styles.gap10}>
              <SectionTitle
                title="Ingredients"
                description={removable.length > 0 ? `${removable.length} optional ingredient${removable.length === 1 ? "" : "s"} can be left out on request.` : "Required ingredients stay on the item."}
              />
              <View style={styles.gap6}>
                {ingredients.map((ingredient) => (
                  <View
                    key={ingredient.name}
                    style={[styles.ingredient, { borderColor: c.border, backgroundColor: ingredient.removable ? c.card : withAlpha(c.muted, 0.5) }]}
                  >
                    <Ionicons name="checkmark-circle" size={16} color={ingredient.removable ? c.primary : c.mutedForeground} />
                    <AppText variant="small" numberOfLines={1} style={styles.flex}>
                      {ingredient.name}
                    </AppText>
                    <AppText variant="caption">{ingredient.removable ? "Optional" : "Required"}</AppText>
                  </View>
                ))}
              </View>
            </View>
          ) : item.item_kind !== "combo" ? (
            <View style={[styles.dashed, { borderColor: c.border }]}>
              <AppText variant="small" tone="muted">
                No ingredients listed for this item yet.
              </AppText>
            </View>
          ) : null}

          {/* Combo contents */}
          {comboItems.length > 0 ? (
            <View style={styles.gap10}>
              <SectionTitle title="Included in this combo" description="This combo item already uses the combo price shown above." />
              {comboItems.map((comboItem) => (
                <Panel key={comboItem.id}>
                  <AppText variant="label">{comboItem.name}</AppText>
                  {(comboItem.ingredients ?? []).length > 0 ? (
                    <Row gap={4} wrap>
                      {(comboItem.ingredients ?? []).map((ingredient) => (
                        <Badge key={`${comboItem.id}-${ingredient.name}`} variant={ingredient.removable ? "soft" : "outline"}>
                          {`${ingredient.name}${ingredient.removable ? " · removable" : ""}`}
                        </Badge>
                      ))}
                    </Row>
                  ) : (
                    <AppText variant="caption">No ingredients listed</AppText>
                  )}
                </Panel>
              ))}
            </View>
          ) : null}

          {/* Combo offers (regular items) */}
          {comboOffers.length > 0 ? (
            <View style={styles.gap10}>
              <SectionTitle title="Combo deals" description="Combo deals the market offers with this item." />
              {comboOffers.map((offer) => (
                <Panel key={offer.name}>
                  <Row justify="space-between" align="flex-start" gap={12}>
                    <View style={styles.flex}>
                      <AppText variant="label">{offer.name}</AppText>
                      {(offer.items ?? []).length > 0 ? (
                        <AppText variant="caption">Includes: {(offer.items ?? []).map((entry) => entry.name).join(", ")}</AppText>
                      ) : null}
                      {offer.description ? <AppText variant="caption">{offer.description}</AppText> : null}
                    </View>
                    <AppText variant="label" style={styles.tabular}>
                      {formatMoney(offer.combo_price, language)}
                    </AppText>
                  </Row>
                </Panel>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {/* Reviews */}
      <Separator />
      <Row justify="space-between" gap={8}>
        <AppText variant="heading">Reviews</AppText>
        {item ? <RatingInline value={item.review_summary?.average ?? null} count={item.review_summary?.count ?? 0} /> : null}
      </Row>
      {reviewsLoading ? (
        <View style={styles.gap8}>
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
      ) : (reviews ?? []).length > 0 ? (
        <View>
          {(reviews ?? []).map((review, index) => (
            <View key={review.id}>
              {index > 0 ? <Separator style={styles.reviewSep} /> : null}
              <ReviewListItem name={review.user?.name || "Customer"} rating={Number(review.rating)} comment={review.comment} createdAt={review.created_at} />
            </View>
          ))}
        </View>
      ) : (
        <EmptyState compact icon="chatbubble-outline" title="No reviews yet" description="Be the first to review this item." />
      )}
      {isLoggedIn ? (
        <ReviewForm
          title="Your rating"
          rating={reviewRating}
          onRatingChange={onReviewRatingChange}
          comment={reviewComment}
          onCommentChange={onReviewCommentChange}
          placeholder="What did you think of this item?"
          error={reviewError}
          isPending={reviewPending}
          submitLabel={`Post ${reviewRating}-star review`}
          onSubmit={onSubmitReview}
        />
      ) : (
        <AppText variant="caption">Sign in to leave a review.</AppText>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  semibold: { fontWeight: "600" },
  tabular: { fontVariant: ["tabular-nums"] },
  gap6: { gap: 6 },
  gap8: { gap: 8 },
  gap10: { gap: 10 },
  hero: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.lg, borderWidth: 1 },
  navButton: { position: "absolute", top: "50%", marginTop: -18, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", opacity: 0.92 },
  navLeft: { left: 8 },
  navRight: { right: 8 },
  thumbWrap: { borderRadius: radius.md, overflow: "hidden", padding: 1 },
  thumb: { width: 52, height: 52, borderRadius: radius.sm },
  price: { fontSize: 24, fontWeight: "600", fontVariant: ["tabular-nums"] },
  strike: { fontSize: 14, textDecorationLine: "line-through", fontVariant: ["tabular-nums"] },
  ingredient: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 9 },
  dashed: { borderWidth: 1, borderStyle: "dashed", borderRadius: radius.lg, padding: 12 },
  reviewSep: { marginVertical: 12 },
});
