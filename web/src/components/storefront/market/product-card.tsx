import { Heart, Images, Plus, Store } from "lucide-react";

import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, toNumber } from "@/lib/format";
import { calcStorefrontPrice } from "@/lib/storefront";
import { cn } from "@/lib/utils";

import { RatingInline } from "./market-ratings";
import {
  getComboIncludedItems,
  getComboRemovableCount,
  getItemImageUrls,
  getRemovableIngredients,
  itemNeedsCustomization,
  type MarketItem,
} from "./market-utils";

function describeItem(item: MarketItem) {
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
    if (ingredients.length > 0) {
      parts.push(ingredients.map((ingredient) => ingredient.name).join(", "));
    }
    if (removableCount > 0) parts.push(`${removableCount} removable`);
    if (comboCount > 0) parts.push(`${comboCount} combo deal${comboCount === 1 ? "" : "s"} available`);
  }

  return parts.join(" · ");
}

export function ProductCard({
  item,
  marketIsOpen,
  canFavorite,
  isFavorite,
  onToggleFavorite,
  onOpen,
  onAdd,
}: {
  item: MarketItem;
  marketIsOpen: boolean;
  canFavorite: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onOpen: () => void;
  onAdd: () => void;
}) {
  const imageUrls = getItemImageUrls(item);
  const finalPrice = calcStorefrontPrice(item);
  const isDiscounted = Math.abs(toNumber(item.price) - finalPrice) > 0.01;
  const outOfStock = item.stock_qty <= 0;
  const needsCustomization = itemNeedsCustomization(item);
  const showStock = item.show_stock_quantity ?? true;
  const description = describeItem(item);
  const addDisabled = outOfStock || !item.is_active || !marketIsOpen;
  const addLabel = !marketIsOpen ? "Closed" : outOfStock ? "Sold out" : needsCustomization ? "Choose" : "Add";

  return (
    <Card className="group gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <button
          type="button"
          onClick={onOpen}
          className="block size-full focus-visible:outline-none"
          aria-label={`View ${item.name}`}
        >
          {imageUrls[0] ? (
            <img
              src={imageUrls[0]}
              alt={item.name}
              loading="lazy"
              className={cn("size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]", outOfStock && "opacity-60")}
            />
          ) : (
            <span className="flex size-full items-center justify-center text-muted-foreground/50">
              <Store className="size-10" />
            </span>
          )}
        </button>

        <div className="pointer-events-none absolute top-2 left-2 flex flex-wrap gap-1">
          {isDiscounted ? <Badge variant="destructive">Deal</Badge> : null}
          {item.item_kind === "combo" || (item.combo_offers?.length ?? 0) > 0 ? (
            <Badge variant="secondary">{item.item_kind === "combo" ? "Combo" : "Combo deals"}</Badge>
          ) : null}
          {item.is_promoted ? <Badge>Promoted</Badge> : null}
        </div>

        {canFavorite ? (
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            onClick={onToggleFavorite}
            className="absolute top-2 right-2 rounded-full bg-background/90 shadow-sm hover:bg-background"
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={isFavorite}
          >
            <Heart className={cn(isFavorite ? "fill-destructive text-destructive" : "text-muted-foreground")} />
          </Button>
        ) : null}

        {imageUrls.length > 1 ? (
          <span className="pointer-events-none absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-md bg-background/90 px-1.5 py-0.5 text-xs font-medium">
            <Images className="size-3" />
            {imageUrls.length}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={onOpen} className="min-w-0 text-left hover:underline focus-visible:outline-none">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{item.name}</h3>
          </button>
          <RatingInline value={item.review_summary?.average ?? null} count={item.review_summary?.count ?? 0} className="shrink-0 text-xs" />
        </div>

        {description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{description}</p>
        ) : item.category ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{item.category}</p>
        ) : null}

        <div className="flex flex-wrap gap-1">
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

        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
            <span className="text-base font-semibold tabular-nums">{formatMoney(finalPrice)}</span>
            {isDiscounted ? (
              <span className="text-xs text-muted-foreground tabular-nums line-through">{formatMoney(item.price)}</span>
            ) : null}
          </div>
          <Button size="sm" onClick={onAdd} disabled={addDisabled} variant={needsCustomization ? "outline" : "default"}>
            {!addDisabled ? <Plus /> : null}
            {addLabel}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function ProductCardSkeleton() {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
    </Card>
  );
}
