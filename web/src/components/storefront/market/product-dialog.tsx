import { ChevronLeft, ChevronRight, Minus, Plus, Store } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { ComboOffer, ItemIngredient } from "@/lib/cart";
import { formatMoney, toNumber } from "@/lib/format";
import { calcStorefrontPrice } from "@/lib/storefront";
import { cn } from "@/lib/utils";
import type { ReviewRecord } from "@/types/api";

import { RatingInline, ReviewForm, ReviewListItem } from "./market-ratings";
import type { MarketItem } from "./market-utils";

const STANDARD_OPTION = "__standard__";

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <div className="text-sm font-semibold">{title}</div>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function ProductDialog({
  open,
  onOpenChange,
  item,
  imageUrls,
  imageIndex,
  onImageIndexChange,
  removableIngredients,
  removedIngredients,
  onRemovedIngredientsChange,
  comboOfferName,
  onComboOfferNameChange,
  selectedComboOffer,
  quantity,
  onQuantityChange,
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MarketItem | null;
  imageUrls: string[];
  imageIndex: number;
  onImageIndexChange: (updater: (prev: number) => number) => void;
  removableIngredients: ItemIngredient[];
  removedIngredients: string[];
  onRemovedIngredientsChange: (updater: (current: string[]) => string[]) => void;
  comboOfferName: string;
  onComboOfferNameChange: (name: string) => void;
  selectedComboOffer: ComboOffer | null;
  quantity: number;
  onQuantityChange: (qty: number) => void;
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
  const basePrice = item ? calcStorefrontPrice(item) : 0;
  const unitPrice = selectedComboOffer ? toNumber(selectedComboOffer.combo_price) : basePrice;
  const isDiscounted = item ? Math.abs(toNumber(item.price) - basePrice) > 0.01 : false;
  const outOfStock = (item?.stock_qty ?? 0) <= 0;
  const addDisabled = !item || outOfStock || !item.is_active || !marketIsOpen;
  const comboItems = item?.item_kind === "combo" ? item.combo_offers?.[0]?.items ?? [] : [];
  const comboOffers = item && item.item_kind !== "combo" ? item.combo_offers ?? [] : [];
  const showStock = item?.show_stock_quantity ?? true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-4 pr-12 text-left">
          <DialogTitle className="text-lg">{item?.name || "Selected item"}</DialogTitle>
          <DialogDescription>
            {item?.category ? `${item.category} · ` : ""}
            <span className="font-mono text-xs">{item?.sku}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {item ? (
            <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
              {/* Gallery */}
              <div className="space-y-3">
                <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
                  {imageUrls[0] ? (
                    <img
                      src={imageUrls[imageIndex] ?? imageUrls[0]}
                      alt={item.name}
                      className="size-full object-contain"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-muted-foreground/50">
                      <Store className="size-14" />
                    </div>
                  )}

                  {imageUrls.length > 1 ? (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon-sm"
                        className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-background/90 shadow-sm"
                        onClick={() => onImageIndexChange((prev) => (prev === 0 ? imageUrls.length - 1 : prev - 1))}
                        aria-label="Previous photo"
                      >
                        <ChevronLeft />
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon-sm"
                        className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-background/90 shadow-sm"
                        onClick={() => onImageIndexChange((prev) => (prev === imageUrls.length - 1 ? 0 : prev + 1))}
                        aria-label="Next photo"
                      >
                        <ChevronRight />
                      </Button>
                    </>
                  ) : null}
                </div>

                {imageUrls.length > 1 ? (
                  <div className="flex flex-wrap gap-2">
                    {imageUrls.map((url, index) => (
                      <button
                        key={`${url}-${index}`}
                        type="button"
                        onClick={() => onImageIndexChange(() => index)}
                        className={cn(
                          "size-14 overflow-hidden rounded-md border bg-muted p-0.5 transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          index === imageIndex && "ring-2 ring-primary",
                        )}
                        aria-label={`Show photo ${index + 1}`}
                      >
                        <img src={url} alt={`${item.name} ${index + 1}`} className="size-full object-contain" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Details */}
              <div className="min-w-0 space-y-5">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-2xl font-semibold tabular-nums">{formatMoney(unitPrice)}</span>
                    {!selectedComboOffer && isDiscounted ? (
                      <span className="text-sm text-muted-foreground tabular-nums line-through">{formatMoney(item.price)}</span>
                    ) : null}
                  </div>
                  {selectedComboOffer ? (
                    <p className="text-sm text-primary">Combo selected: {selectedComboOffer.name}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <RatingInline value={item.review_summary?.average ?? null} count={item.review_summary?.count ?? 0} />
                    {isDiscounted ? <Badge variant="destructive">Deal</Badge> : null}
                    {item.is_promoted ? <Badge>Promoted</Badge> : null}
                    {item.item_kind === "combo" ? <Badge variant="secondary">Combo</Badge> : null}
                    {!item.is_active ? <Badge variant="outline">Unavailable</Badge> : null}
                    {outOfStock ? (
                      <StatusBadge tone="destructive">
                        Out of stock
                      </StatusBadge>
                    ) : item.is_low_stock ? (
                      <StatusBadge tone="warning">
                        Low stock{showStock ? ` · ${item.stock_qty} left` : ""}
                      </StatusBadge>
                    ) : showStock ? (
                      <StatusBadge tone="success">
                        In stock · {item.stock_qty}
                      </StatusBadge>
                    ) : null}
                  </div>
                </div>

                <Separator />

                {/* Ingredients */}
                {(item.ingredients ?? []).length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <SectionTitle
                        title="Ingredients"
                        description={
                          removableIngredients.length > 0
                            ? "Uncheck optional ingredients you don't want. Required ones stay on the item."
                            : "Required ingredients stay on the item."
                        }
                      />
                      {removableIngredients.length > 0 ? (
                        <div className="flex gap-1">
                          <Button type="button" variant="ghost" size="xs" onClick={() => onRemovedIngredientsChange(() => [])}>
                            Keep all
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => onRemovedIngredientsChange(() => removableIngredients.map((ingredient) => ingredient.name))}
                          >
                            Remove all optional
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {(item.ingredients ?? []).map((ingredient) => {
                        const isRemovable = removableIngredients.some(
                          (entry) => entry.name.toLowerCase() === ingredient.name.toLowerCase(),
                        );
                        const removed = removedIngredients.some(
                          (entry) => entry.toLowerCase() === ingredient.name.toLowerCase(),
                        );
                        const id = `ingredient-${item.id}-${ingredient.name}`;

                        return (
                          <Label
                            key={ingredient.name}
                            htmlFor={id}
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg border px-3 py-2 font-normal",
                              isRemovable ? "cursor-pointer hover:bg-accent/50" : "bg-muted/30 text-muted-foreground",
                            )}
                          >
                            <Checkbox
                              id={id}
                              checked={!removed}
                              disabled={!isRemovable}
                              onCheckedChange={() =>
                                onRemovedIngredientsChange((current) =>
                                  removed
                                    ? current.filter((entry) => entry.toLowerCase() !== ingredient.name.toLowerCase())
                                    : [...current, ingredient.name],
                                )
                              }
                            />
                            <span className={cn("min-w-0 flex-1 truncate", removed && "text-muted-foreground line-through")}>
                              {ingredient.name}
                            </span>
                            <span className="text-xs text-muted-foreground">{isRemovable ? "Optional" : "Required"}</span>
                          </Label>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    No ingredients listed for this item yet.
                  </p>
                )}

                {/* Combo contents (combo items) */}
                {comboItems.length > 0 ? (
                  <div className="space-y-3">
                    <SectionTitle
                      title="Included in this combo"
                      description="This combo item already uses the combo price shown above."
                    />
                    <div className="grid gap-2">
                      {comboItems.map((comboItem) => (
                        <div key={comboItem.id} className="rounded-lg border bg-muted/30 p-3">
                          <div className="text-sm font-medium">{comboItem.name}</div>
                          {(comboItem.ingredients ?? []).length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {(comboItem.ingredients ?? []).map((ingredient) => (
                                <Badge
                                  key={`${comboItem.id}-${ingredient.name}`}
                                  variant={ingredient.removable ? "secondary" : "outline"}
                                >
                                  {ingredient.name}
                                  {ingredient.removable ? " · removable" : ""}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-1 text-xs text-muted-foreground">No ingredients listed</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Combo offers (regular items) */}
                {comboOffers.length > 0 ? (
                  <div className="space-y-3">
                    <SectionTitle
                      title="Make it a combo"
                      description="Choose the standard item or a discounted combo prepared by the market."
                    />
                    <RadioGroup
                      value={comboOfferName ? comboOfferName : STANDARD_OPTION}
                      onValueChange={(value) => onComboOfferNameChange(value === STANDARD_OPTION ? "" : value)}
                      className="gap-2"
                    >
                      <Label
                        htmlFor={`combo-${item.id}-standard`}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal hover:bg-accent/50",
                          !comboOfferName && "border-primary bg-primary/5",
                        )}
                      >
                        <RadioGroupItem id={`combo-${item.id}-standard`} value={STANDARD_OPTION} />
                        <span className="flex-1 font-medium">Standard item</span>
                        <span className="tabular-nums">{formatMoney(basePrice)}</span>
                      </Label>

                      {comboOffers.map((comboOffer, index) => {
                        const active = comboOfferName.toLowerCase() === comboOffer.name.toLowerCase();
                        const id = `combo-${item.id}-${index}`;
                        return (
                          <Label
                            key={comboOffer.name}
                            htmlFor={id}
                            className={cn(
                              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal hover:bg-accent/50",
                              active && "border-primary bg-primary/5",
                            )}
                          >
                            <RadioGroupItem id={id} value={comboOffer.name} className="mt-0.5" />
                            <span className="min-w-0 flex-1 space-y-1">
                              <span className="block font-medium">{comboOffer.name}</span>
                              {(comboOffer.items ?? []).length > 0 ? (
                                <span className="block text-xs text-muted-foreground">
                                  Includes: {(comboOffer.items ?? []).map((entry) => entry.name).join(", ")}
                                </span>
                              ) : null}
                              {comboOffer.description ? (
                                <span className="block text-xs text-muted-foreground">{comboOffer.description}</span>
                              ) : null}
                            </span>
                            <span className="tabular-nums">{formatMoney(comboOffer.combo_price)}</span>
                          </Label>
                        );
                      })}
                    </RadioGroup>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Reviews */}
          <div className="space-y-4 border-t p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-base font-semibold">Reviews</div>
              {item ? (
                <RatingInline value={item.review_summary?.average ?? null} count={item.review_summary?.count ?? 0} />
              ) : null}
            </div>

            {reviewsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (reviews ?? []).length > 0 ? (
              <div className="divide-y">
                {reviews?.map((review) => (
                  <ReviewListItem
                    key={review.id}
                    name={review.user?.name}
                    rating={Number(review.rating)}
                    comment={review.comment}
                    createdAt={review.created_at}
                  />
                ))}
              </div>
            ) : (
              <EmptyState compact title="No reviews yet" description="Be the first to review this item." />
            )}

            {isLoggedIn ? (
              <ReviewForm
                id="item-review-comment"
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
            ) : null}
          </div>
        </div>

        {/* Sticky footer */}
        {item ? (
          <div className="flex flex-col gap-2 border-t bg-background px-6 py-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 text-xs text-muted-foreground">
              {selectedComboOffer ? <div className="truncate">Combo: {selectedComboOffer.name}</div> : null}
              {removedIngredients.length > 0 ? <div className="truncate">Without: {removedIngredients.join(", ")}</div> : null}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-md border">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                >
                  <Minus />
                </Button>
                <span className="w-8 text-center text-sm font-medium tabular-nums">{quantity}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onQuantityChange(quantity + 1)}
                  aria-label="Increase quantity"
                >
                  <Plus />
                </Button>
              </div>
              <Button size="lg" className="flex-1 sm:flex-none" onClick={onAddToCart} disabled={addDisabled}>
                {!marketIsOpen
                  ? "Market closed"
                  : outOfStock
                    ? "Out of stock"
                    : `Add to cart · ${formatMoney(unitPrice * quantity)}`}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
